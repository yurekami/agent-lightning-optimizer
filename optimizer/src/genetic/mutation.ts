import { PromptContent, MutationType, Mutation, MutationResult } from '../types';

/**
 * All available mutation types.
 * These are placeholders that will be replaced by actual LLM-based mutations
 * in a separate service.
 */
export const MUTATION_TYPES: MutationType[] = [
  'rephrase_clarity',
  'add_examples',
  'remove_examples',
  'increase_verbosity',
  'decrease_verbosity',
  'add_edge_cases',
  'restructure_sections',
  'change_tone_formal',
  'change_tone_casual',
];

/**
 * Mutation descriptions for use with LLM-based mutation service.
 */
export const MUTATION_DESCRIPTIONS: Record<MutationType, string> = {
  rephrase_clarity:
    'Rephrase instructions to be clearer and more precise without changing meaning.',
  add_examples:
    'Add concrete examples to illustrate abstract instructions.',
  remove_examples:
    'Remove examples to make the prompt more concise.',
  increase_verbosity:
    'Expand instructions with more detail and explanation.',
  decrease_verbosity:
    'Condense instructions to be more concise while preserving meaning.',
  add_edge_cases:
    'Add handling for edge cases and error scenarios.',
  restructure_sections:
    'Reorganize sections for better logical flow.',
  change_tone_formal:
    'Make the tone more formal and professional.',
  change_tone_casual:
    'Make the tone more conversational and approachable.',
};

/**
 * Mutation probabilities based on effectiveness (can be tuned).
 * Higher values mean the mutation is selected more often.
 */
const MUTATION_WEIGHTS: Record<MutationType, number> = {
  rephrase_clarity: 2.0,
  add_examples: 1.5,
  remove_examples: 1.0,
  increase_verbosity: 1.0,
  decrease_verbosity: 1.0,
  add_edge_cases: 1.5,
  restructure_sections: 0.8,
  change_tone_formal: 0.5,
  change_tone_casual: 0.5,
};

/**
 * Select a mutation type using weighted random selection.
 */
export function selectMutationType(): MutationType {
  const totalWeight = Object.values(MUTATION_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (const [type, weight] of Object.entries(MUTATION_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      return type as MutationType;
    }
  }

  // Fallback (shouldn't reach here)
  return 'rephrase_clarity';
}

/**
 * Select multiple unique mutation types.
 */
export function selectMutationTypes(count: number): MutationType[] {
  const selected: MutationType[] = [];
  const available = [...MUTATION_TYPES];

  for (let i = 0; i < count && available.length > 0; i++) {
    // Calculate weights for available mutations
    const weights = available.map((t) => MUTATION_WEIGHTS[t]);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let random = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let j = 0; j < weights.length; j++) {
      random -= weights[j];
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }

    selected.push(available[selectedIndex]);
    available.splice(selectedIndex, 1);
  }

  return selected;
}

/**
 * Create a placeholder mutation that marks the content for LLM processing.
 * The actual mutation will be performed by a separate LLM service.
 */
export function createPlaceholderMutation(type: MutationType): Mutation {
  return {
    type,
    async apply(content: PromptContent): Promise<PromptContent> {
      // This is a placeholder - actual LLM mutation is in a separate service.
      // For now, we just mark the content with metadata about the intended mutation.
      // The mutation service will read this and apply the actual LLM-based mutation.

      return {
        ...content,
        // Add mutation metadata (this would be read by the mutation service)
        systemPrompt: addMutationMarker(content.systemPrompt, type),
      };
    },
  };
}

/**
 * Add a mutation marker to the prompt for tracking.
 * This is removed after actual mutation is applied.
 */
function addMutationMarker(prompt: string, type: MutationType): string {
  // In practice, this marker would be processed by the LLM mutation service
  // and removed after the mutation is applied.
  // For now, we return the prompt unchanged.
  return prompt;
}

/**
 * Simple non-LLM mutations for testing and baseline comparison.
 * These apply rule-based transformations without LLM involvement.
 */
export const SimpleMutations: Record<string, Mutation> = {
  /**
   * Add emphasis markers to key phrases.
   */
  add_emphasis: {
    type: 'rephrase_clarity',
    async apply(content: PromptContent): Promise<PromptContent> {
      const emphasisKeywords = [
        'important',
        'critical',
        'must',
        'always',
        'never',
        'required',
      ];

      let systemPrompt = content.systemPrompt;

      for (const keyword of emphasisKeywords) {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
        systemPrompt = systemPrompt.replace(regex, '**$1**');
      }

      return { ...content, systemPrompt };
    },
  },

  /**
   * Remove duplicate whitespace and normalize formatting.
   */
  normalize_formatting: {
    type: 'decrease_verbosity',
    async apply(content: PromptContent): Promise<PromptContent> {
      let systemPrompt = content.systemPrompt;

      // Normalize multiple newlines
      systemPrompt = systemPrompt.replace(/\n{3,}/g, '\n\n');

      // Normalize multiple spaces
      systemPrompt = systemPrompt.replace(/ {2,}/g, ' ');

      // Trim lines
      systemPrompt = systemPrompt
        .split('\n')
        .map((line) => line.trim())
        .join('\n');

      return { ...content, systemPrompt };
    },
  },

  /**
   * Convert bullet points to numbered lists.
   */
  bullets_to_numbers: {
    type: 'restructure_sections',
    async apply(content: PromptContent): Promise<PromptContent> {
      let systemPrompt = content.systemPrompt;

      // Find bullet list sections and convert to numbers
      const bulletPattern = /^(\s*)[-*•]\s+/gm;
      let counter = 0;
      let lastIndent = '';

      systemPrompt = systemPrompt.replace(bulletPattern, (match, indent) => {
        if (indent !== lastIndent) {
          counter = 0;
          lastIndent = indent;
        }
        counter++;
        return `${indent}${counter}. `;
      });

      return { ...content, systemPrompt };
    },
  },

  /**
   * Add newlines before headers for better readability.
   */
  space_headers: {
    type: 'restructure_sections',
    async apply(content: PromptContent): Promise<PromptContent> {
      let systemPrompt = content.systemPrompt;

      // Add blank line before headers if not present
      systemPrompt = systemPrompt.replace(/([^\n])\n(#{1,3}\s)/g, '$1\n\n$2');

      return { ...content, systemPrompt };
    },
  },
};

/**
 * Apply a random simple mutation (for testing without LLM).
 */
export async function applySimpleMutation(
  content: PromptContent
): Promise<MutationResult> {
  const mutations = Object.values(SimpleMutations);
  const mutation = mutations[Math.floor(Math.random() * mutations.length)];

  const mutatedContent = await mutation.apply(content);

  return {
    originalContent: content,
    mutatedContent,
    mutationType: mutation.type,
    applied: true,
  };
}

/**
 * Check if a mutation should be applied based on mutation rate.
 */
export function shouldMutate(mutationRate: number): boolean {
  return Math.random() < mutationRate;
}

/**
 * Interface for external mutation service.
 * This would be implemented by a separate LLM-based service.
 */
export interface MutationService {
  /**
   * Apply an LLM-based mutation to prompt content.
   */
  mutate(content: PromptContent, type: MutationType): Promise<PromptContent>;

  /**
   * Check if the service is available.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Placeholder mutation service that returns content unchanged.
 * Replace with actual LLM service in production.
 */
export class PlaceholderMutationService implements MutationService {
  async mutate(content: PromptContent, _type: MutationType): Promise<PromptContent> {
    // In production, this would call an LLM to perform the mutation
    console.log(`[PlaceholderMutationService] Would apply mutation: ${_type}`);
    return content;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * Create a mutation request object for the external mutation service.
 */
export function createMutationRequest(
  content: PromptContent,
  type: MutationType
): {
  content: PromptContent;
  mutationType: MutationType;
  instruction: string;
} {
  return {
    content,
    mutationType: type,
    instruction: MUTATION_DESCRIPTIONS[type],
  };
}
