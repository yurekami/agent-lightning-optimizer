import { MutationConfig, MutationType } from '../types';
import { rephraseForClarity } from './rephrase';
import { addExamples, removeExamples } from './examples';
import { increaseVerbosity, decreaseVerbosity } from './verbosity';
import { restructureSections, addEdgeCases, addConstraints, simplifyInstructions } from './structure';
import { changeToneFormal, changeToneCasual } from './tone';

/**
 * Central registry of all available mutations
 * Weight determines probability of selection (higher = more likely)
 * Complexity determines which Claude model to use
 */
export const MUTATIONS: Record<MutationType, MutationConfig> = {
  rephrase_clarity: {
    name: 'Rephrase for Clarity',
    description: 'Rewrite the prompt to be clearer and more direct',
    weight: 1.0,
    complexity: 'medium',
    apply: rephraseForClarity,
  },

  add_examples: {
    name: 'Add Examples',
    description: 'Add concrete examples to illustrate instructions',
    weight: 0.8,
    complexity: 'medium',
    apply: addExamples,
  },

  remove_examples: {
    name: 'Remove Examples',
    description: 'Remove specific examples, keep general guidance',
    weight: 0.6,
    complexity: 'simple',
    apply: removeExamples,
  },

  increase_verbosity: {
    name: 'Increase Verbosity',
    description: 'Add more detail and explanation to instructions',
    weight: 0.7,
    complexity: 'medium',
    apply: increaseVerbosity,
  },

  decrease_verbosity: {
    name: 'Decrease Verbosity',
    description: 'Make the prompt more concise',
    weight: 0.7,
    complexity: 'simple',
    apply: decreaseVerbosity,
  },

  add_edge_cases: {
    name: 'Add Edge Cases',
    description: 'Add guidance for handling edge cases and unusual scenarios',
    weight: 0.8,
    complexity: 'medium',
    apply: addEdgeCases,
  },

  restructure_sections: {
    name: 'Restructure Sections',
    description: 'Reorganize sections for better logical flow',
    weight: 0.6,
    complexity: 'medium',
    apply: restructureSections,
  },

  change_tone_formal: {
    name: 'Change Tone (Formal)',
    description: 'Adjust tone to be more formal and professional',
    weight: 0.5,
    complexity: 'simple',
    apply: changeToneFormal,
  },

  change_tone_casual: {
    name: 'Change Tone (Casual)',
    description: 'Adjust tone to be more casual and approachable',
    weight: 0.5,
    complexity: 'simple',
    apply: changeToneCasual,
  },

  add_constraints: {
    name: 'Add Constraints',
    description: 'Add explicit constraints and limitations',
    weight: 0.7,
    complexity: 'medium',
    apply: addConstraints,
  },

  simplify_instructions: {
    name: 'Simplify Instructions',
    description: 'Break down complex instructions into simpler steps',
    weight: 0.8,
    complexity: 'simple',
    apply: simplifyInstructions,
  },
};

/**
 * Get all mutation types
 */
export function getAllMutationTypes(): MutationType[] {
  return Object.keys(MUTATIONS) as MutationType[];
}

/**
 * Get mutation configuration
 */
export function getMutation(type: MutationType): MutationConfig | undefined {
  return MUTATIONS[type];
}

/**
 * Select a random mutation based on weights
 */
export function selectRandomMutation(): MutationType {
  const types = getAllMutationTypes();
  const weights = types.map(type => MUTATIONS[type].weight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let random = Math.random() * totalWeight;

  for (let i = 0; i < types.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return types[i];
    }
  }

  // Fallback (should never reach here)
  return types[0];
}

/**
 * Determine which Claude model to use based on mutation complexity
 */
export function selectModelForMutation(
  type: MutationType,
  defaultModel: string,
  complexModel: string
): string {
  const mutation = MUTATIONS[type];
  if (!mutation) {
    return defaultModel;
  }

  switch (mutation.complexity) {
    case 'simple':
      return defaultModel; // Use Haiku for simple mutations
    case 'medium':
      return defaultModel; // Use Haiku/Sonnet for medium complexity
    case 'complex':
      return complexModel; // Use Sonnet/Opus for complex mutations
    default:
      return defaultModel;
  }
}
