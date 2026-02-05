import { PromptContent, MutationContext } from '../types';
import { formatMutationPrompt } from '../prompts';

/**
 * Add concrete examples to the prompt
 */
export async function addExamples(
  content: PromptContent,
  context: MutationContext
): Promise<PromptContent> {
  const prompt = formatMutationPrompt('add_examples', content.systemPrompt);

  const response = await context.anthropic.messages.create({
    model: context.model,
    max_tokens: 8000,
    temperature: 0.8, // Higher temperature for creative examples
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const mutatedSystemPrompt = extractTextFromResponse(response);

  return {
    ...content,
    systemPrompt: mutatedSystemPrompt,
  };
}

/**
 * Remove examples from the prompt
 */
export async function removeExamples(
  content: PromptContent,
  context: MutationContext
): Promise<PromptContent> {
  const prompt = formatMutationPrompt('remove_examples', content.systemPrompt);

  const response = await context.anthropic.messages.create({
    model: context.model,
    max_tokens: 8000,
    temperature: 0.6,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const mutatedSystemPrompt = extractTextFromResponse(response);

  return {
    ...content,
    systemPrompt: mutatedSystemPrompt,
  };
}

/**
 * Extract text content from Claude API response
 */
function extractTextFromResponse(response: any): string {
  if (!response.content || response.content.length === 0) {
    throw new Error('Empty response from Claude API');
  }

  const textBlocks = response.content.filter((block: any) => block.type === 'text');
  if (textBlocks.length === 0) {
    throw new Error('No text content in Claude API response');
  }

  return textBlocks.map((block: any) => block.text).join('\n').trim();
}
