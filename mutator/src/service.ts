import Anthropic from '@anthropic-ai/sdk';
import { Database } from './db';
import {
  PromptVersion,
  PromptContent,
  MutationType,
  MutationContext,
  MutatorConfig,
} from './types';
import { getMutation, selectRandomMutation, selectModelForMutation } from './mutations';
import { validateMutation, validatePromptContent } from './validation';

/**
 * Main mutation service
 * Applies Claude-powered mutations to prompts and saves results
 */
export class MutationService {
  private anthropic: Anthropic;
  private db: Database;
  private config: MutatorConfig;

  constructor(anthropic: Anthropic, db: Database, config: MutatorConfig) {
    this.anthropic = anthropic;
    this.db = db;
    this.config = config;
  }

  /**
   * Apply a specific mutation to a prompt version
   */
  async applyMutation(
    versionId: string,
    mutationType: MutationType
  ): Promise<PromptVersion> {
    const startTime = Date.now();

    try {
      // Get the original prompt version
      const originalVersion = await this.db.getPromptVersion(versionId);
      if (!originalVersion) {
        throw new Error(`Prompt version ${versionId} not found`);
      }

      // Validate content structure
      if (!validatePromptContent(originalVersion.content)) {
        throw new Error('Invalid prompt content structure');
      }

      // Get mutation configuration
      const mutation = getMutation(mutationType);
      if (!mutation) {
        throw new Error(`Unknown mutation type: ${mutationType}`);
      }

      console.log(`[Mutator] Applying ${mutation.name} to version ${versionId}`);

      // Select appropriate model based on complexity
      const model = selectModelForMutation(
        mutationType,
        this.config.defaultModel,
        this.config.complexModel
      );

      // Apply mutation with retry logic
      const mutatedContent = await this.applyWithRetry(
        mutation.apply,
        originalVersion.content,
        { anthropic: this.anthropic, model, maxRetries: this.config.maxRetries }
      );

      // Validate the mutation
      const validation = await validateMutation(
        originalVersion.content,
        mutatedContent,
        {
          minLength: this.config.minPromptLength,
          maxLength: this.config.maxPromptLength,
          minSemanticSimilarity: this.config.minSemanticSimilarity,
        }
      );

      if (!validation.valid) {
        throw new Error(`Mutation validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn(`[Mutator] Warnings: ${validation.warnings.join(', ')}`);
      }

      // Save the mutated version
      const mutatedVersion = await this.db.createPromptVersion({
        agentId: originalVersion.agent_id,
        branchId: originalVersion.branch_id,
        content: mutatedContent,
        parentIds: [versionId],
        mutationType: mutationType,
        mutationDetails: {
          model,
          validation: validation.metadata,
        },
      });

      const duration = Date.now() - startTime;

      // Log successful mutation
      await this.db.logMutationAttempt({
        versionId,
        mutationType,
        success: true,
        resultVersionId: mutatedVersion.id,
        duration,
      });

      console.log(
        `[Mutator] ✓ Created version ${mutatedVersion.version} (${duration}ms)`
      );

      return mutatedVersion;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed mutation
      await this.db.logMutationAttempt({
        versionId,
        mutationType,
        success: false,
        error: errorMessage,
        duration,
      });

      console.error(`[Mutator] ✗ Mutation failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Apply a random mutation based on weights
   */
  async applyRandomMutation(versionId: string): Promise<PromptVersion> {
    const mutationType = selectRandomMutation();
    return await this.applyMutation(versionId, mutationType);
  }

  /**
   * Generate N mutated variants of a prompt
   */
  async generateVariants(
    versionId: string,
    count: number
  ): Promise<PromptVersion[]> {
    const variants: PromptVersion[] = [];
    const errors: string[] = [];

    console.log(`[Mutator] Generating ${count} variants of version ${versionId}`);

    for (let i = 0; i < count; i++) {
      try {
        const variant = await this.applyRandomMutation(versionId);
        variants.push(variant);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Variant ${i + 1}: ${errorMessage}`);
        console.error(`[Mutator] Failed to create variant ${i + 1}: ${errorMessage}`);
      }
    }

    console.log(`[Mutator] Generated ${variants.length}/${count} variants successfully`);

    if (errors.length > 0) {
      console.warn(`[Mutator] Errors encountered:\n${errors.join('\n')}`);
    }

    return variants;
  }

  /**
   * Apply mutation with exponential backoff retry
   */
  private async applyWithRetry(
    mutationFn: (content: PromptContent, context: MutationContext) => Promise<PromptContent>,
    content: PromptContent,
    context: MutationContext
  ): Promise<PromptContent> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= context.maxRetries; attempt++) {
      try {
        return await mutationFn(content, context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a rate limit error
        const isRateLimitError =
          lastError.message.includes('rate_limit') ||
          lastError.message.includes('429');

        if (attempt < context.maxRetries && isRateLimitError) {
          const backoffMs = this.config.retryBackoffMs * Math.pow(2, attempt - 1);
          console.warn(
            `[Mutator] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt}/${context.maxRetries})`
          );
          await this.sleep(backoffMs);
        } else if (attempt < context.maxRetries) {
          // For other errors, shorter backoff
          await this.sleep(this.config.retryBackoffMs);
        }
      }
    }

    throw lastError || new Error('Mutation failed after retries');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
