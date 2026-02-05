import { PromptContent, MutationContext } from '../types';
import { formatMutationPrompt } from '../prompts';

/**
 * Change tone to formal/professional
 */
export async function changeToneFormal(
  content: PromptContent,
  context: MutationContext
): Promise<PromptContent> {
  const prompt = formatMutationPrompt('change_tone_formal', content.systemPrompt);

  const response = await context.anthropic.messages.create({
    model: context.model,
    max_tokens: 8000,
    temperature: 0.7,
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
 * Change tone to casual/approachable
 */
export async function changeToneCasual(
  content: PromptContent,
  context: MutationContext
): Promise<PromptContent> {
  const prompt = formatMutationPrompt('change_tone_casual', content.systemPrompt);

  const response = await context.anthropic.messages.create({
    model: context.model,
    max_tokens: 8000,
    temperature: 0.8, // Higher temperature for casual tone
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
