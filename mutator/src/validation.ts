import { PromptContent, ValidationResult } from './types';

/**
 * Validate a mutated prompt against the original
 */
export async function validateMutation(
  original: PromptContent,
  mutated: PromptContent,
  config: {
    minLength: number;
    maxLength: number;
    minSemanticSimilarity: number;
  }
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const originalText = original.systemPrompt;
  const mutatedText = mutated.systemPrompt;

  // Length validation
  if (mutatedText.length < config.minLength) {
    errors.push(`Mutated prompt too short: ${mutatedText.length} < ${config.minLength}`);
  }

  if (mutatedText.length > config.maxLength) {
    errors.push(`Mutated prompt too long: ${mutatedText.length} > ${config.maxLength}`);
  }

  // Check for empty prompt
  if (!mutatedText.trim()) {
    errors.push('Mutated prompt is empty');
  }

  // Check if mutation changed the prompt significantly
  if (mutatedText === originalText) {
    warnings.push('Mutation did not change the prompt');
  }

  // Check for extreme length changes (>500% or <20%)
  const lengthRatio = mutatedText.length / originalText.length;
  if (lengthRatio > 5.0) {
    warnings.push(`Prompt length increased by ${Math.round(lengthRatio * 100)}%`);
  } else if (lengthRatio < 0.2) {
    warnings.push(`Prompt length decreased to ${Math.round(lengthRatio * 100)}% of original`);
  }

  // Validate JSON structure
  try {
    // Ensure toolDescriptions is still a record
    if (mutated.toolDescriptions && typeof mutated.toolDescriptions !== 'object') {
      errors.push('toolDescriptions must be an object');
    }

    // Ensure subagentPrompts is still a record
    if (mutated.subagentPrompts && typeof mutated.subagentPrompts !== 'object') {
      errors.push('subagentPrompts must be an object');
    }
  } catch (e) {
    errors.push(`Invalid JSON structure: ${e}`);
  }

  // Check for critical content removal (basic heuristic)
  const criticalKeywords = extractKeywords(originalText);
  const mutatedKeywords = extractKeywords(mutatedText);

  const removedKeywords = criticalKeywords.filter(kw => !mutatedKeywords.includes(kw));
  if (removedKeywords.length > criticalKeywords.length * 0.5) {
    warnings.push(`Many critical keywords removed: ${removedKeywords.slice(0, 5).join(', ')}...`);
  }

  // Semantic similarity (simplified - would use embeddings in production)
  const similarity = calculateSimpleSimilarity(originalText, mutatedText);

  if (similarity < config.minSemanticSimilarity) {
    warnings.push(`Low semantic similarity: ${similarity.toFixed(2)} < ${config.minSemanticSimilarity}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      originalLength: originalText.length,
      mutatedLength: mutatedText.length,
      semanticSimilarity: similarity,
    },
  };
}

/**
 * Extract important keywords from text (basic implementation)
 */
function extractKeywords(text: string): string[] {
  // Extract words that are likely important (longer than 4 chars, not common words)
  const commonWords = new Set([
    'that', 'this', 'with', 'from', 'have', 'been', 'will', 'your',
    'their', 'what', 'about', 'which', 'when', 'where', 'should',
    'would', 'could', 'these', 'those', 'there', 'must', 'also',
  ]);

  return text
    .toLowerCase()
    .match(/\b\w{5,}\b/g)
    ?.filter(word => !commonWords.has(word))
    .filter((word, index, arr) => arr.indexOf(word) === index) // unique
    .slice(0, 50) || [];
}

/**
 * Calculate simple similarity based on shared words
 * In production, use embeddings (e.g., OpenAI embeddings) for better accuracy
 */
function calculateSimpleSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
  const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Validate prompt content structure
 */
export function validatePromptContent(content: unknown): content is PromptContent {
  if (!content || typeof content !== 'object') {
    return false;
  }

  const c = content as any;

  if (typeof c.systemPrompt !== 'string') {
    return false;
  }

  if (c.toolDescriptions && typeof c.toolDescriptions !== 'object') {
    return false;
  }

  if (c.subagentPrompts && typeof c.subagentPrompts !== 'object') {
    return false;
  }

  return true;
}
