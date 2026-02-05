import { PromptContent, CrossoverType, CrossoverResult } from '../types';

/**
 * Single-point crossover: takes the system prompt from one parent
 * and tool descriptions from another.
 *
 * This is useful when you want to test different combinations
 * of core instructions with different tool descriptions.
 */
export function singlePointCrossover(
  parent1: PromptContent,
  parent2: PromptContent,
  parent1Id: string,
  parent2Id: string
): CrossoverResult {
  // Randomly decide which parent contributes system prompt
  const useParent1SystemPrompt = Math.random() < 0.5;

  const offspring: PromptContent = {
    systemPrompt: useParent1SystemPrompt ? parent1.systemPrompt : parent2.systemPrompt,
    toolDescriptions: useParent1SystemPrompt ? parent2.toolDescriptions : parent1.toolDescriptions,
  };

  // For subagent prompts, take from the parent that didn't contribute system prompt
  if (parent1.subagentPrompts || parent2.subagentPrompts) {
    offspring.subagentPrompts = useParent1SystemPrompt
      ? parent2.subagentPrompts
      : parent1.subagentPrompts;
  }

  return {
    offspring,
    parent1Id,
    parent2Id,
    crossoverType: 'single_point',
  };
}

/**
 * Uniform crossover: randomly selects each component from either parent.
 * Each piece has a 50% chance of coming from each parent.
 */
export function uniformCrossover(
  parent1: PromptContent,
  parent2: PromptContent,
  parent1Id: string,
  parent2Id: string
): CrossoverResult {
  // System prompt: random choice
  const systemPrompt = Math.random() < 0.5 ? parent1.systemPrompt : parent2.systemPrompt;

  // Tool descriptions: mix and match individual tools
  const toolDescriptions: Record<string, string> = {};
  const allToolKeys = new Set([
    ...Object.keys(parent1.toolDescriptions),
    ...Object.keys(parent2.toolDescriptions),
  ]);

  for (const key of allToolKeys) {
    const hasInParent1 = key in parent1.toolDescriptions;
    const hasInParent2 = key in parent2.toolDescriptions;

    if (hasInParent1 && hasInParent2) {
      // Both parents have this tool - random choice
      toolDescriptions[key] = Math.random() < 0.5
        ? parent1.toolDescriptions[key]
        : parent2.toolDescriptions[key];
    } else if (hasInParent1) {
      // Only parent1 has it - include with 50% probability
      if (Math.random() < 0.5) {
        toolDescriptions[key] = parent1.toolDescriptions[key];
      }
    } else if (hasInParent2) {
      // Only parent2 has it - include with 50% probability
      if (Math.random() < 0.5) {
        toolDescriptions[key] = parent2.toolDescriptions[key];
      }
    }
  }

  // Ensure at least some tools are included
  if (Object.keys(toolDescriptions).length === 0) {
    // Fallback to one parent's tools
    Object.assign(toolDescriptions, Math.random() < 0.5
      ? parent1.toolDescriptions
      : parent2.toolDescriptions);
  }

  // Subagent prompts: similar approach
  let subagentPrompts: Record<string, string> | undefined;

  if (parent1.subagentPrompts || parent2.subagentPrompts) {
    subagentPrompts = {};
    const allSubagentKeys = new Set([
      ...Object.keys(parent1.subagentPrompts || {}),
      ...Object.keys(parent2.subagentPrompts || {}),
    ]);

    for (const key of allSubagentKeys) {
      const inP1 = parent1.subagentPrompts && key in parent1.subagentPrompts;
      const inP2 = parent2.subagentPrompts && key in parent2.subagentPrompts;

      if (inP1 && inP2) {
        subagentPrompts[key] = Math.random() < 0.5
          ? parent1.subagentPrompts![key]
          : parent2.subagentPrompts![key];
      } else if (inP1 && Math.random() < 0.5) {
        subagentPrompts[key] = parent1.subagentPrompts![key];
      } else if (inP2 && Math.random() < 0.5) {
        subagentPrompts[key] = parent2.subagentPrompts![key];
      }
    }

    // Remove empty object
    if (Object.keys(subagentPrompts).length === 0) {
      subagentPrompts = undefined;
    }
  }

  const offspring: PromptContent = {
    systemPrompt,
    toolDescriptions,
  };

  if (subagentPrompts) {
    offspring.subagentPrompts = subagentPrompts;
  }

  return {
    offspring,
    parent1Id,
    parent2Id,
    crossoverType: 'uniform',
  };
}

/**
 * Blend crossover for system prompts: interpolates between two prompts
 * by taking sections from each.
 *
 * Splits prompts by paragraphs and alternates between parents.
 */
export function blendSystemPrompts(
  prompt1: string,
  prompt2: string
): string {
  const paragraphs1 = prompt1.split(/\n\n+/).filter((p) => p.trim());
  const paragraphs2 = prompt2.split(/\n\n+/).filter((p) => p.trim());

  const result: string[] = [];
  const maxLength = Math.max(paragraphs1.length, paragraphs2.length);

  for (let i = 0; i < maxLength; i++) {
    // Alternate between parents, with some randomness
    const useFirst = (i % 2 === 0) !== (Math.random() < 0.3); // 70% follow pattern, 30% flip

    if (useFirst && i < paragraphs1.length) {
      result.push(paragraphs1[i]);
    } else if (!useFirst && i < paragraphs2.length) {
      result.push(paragraphs2[i]);
    } else if (i < paragraphs1.length) {
      result.push(paragraphs1[i]);
    } else if (i < paragraphs2.length) {
      result.push(paragraphs2[i]);
    }
  }

  return result.join('\n\n');
}

/**
 * Section-based crossover: identifies common sections (headers)
 * and crosses over entire sections.
 */
export function sectionCrossover(
  parent1: PromptContent,
  parent2: PromptContent,
  parent1Id: string,
  parent2Id: string
): CrossoverResult {
  // Parse sections from system prompts
  const sections1 = parseSections(parent1.systemPrompt);
  const sections2 = parseSections(parent2.systemPrompt);

  // Get all unique section headers
  const allHeaders = new Set([...sections1.keys(), ...sections2.keys()]);

  // Build new system prompt by selecting sections from either parent
  const resultSections: string[] = [];

  for (const header of allHeaders) {
    const inS1 = sections1.has(header);
    const inS2 = sections2.has(header);

    if (inS1 && inS2) {
      // Both have this section - random choice
      const section = Math.random() < 0.5 ? sections1.get(header)! : sections2.get(header)!;
      resultSections.push(section);
    } else if (inS1) {
      // Only in parent1
      resultSections.push(sections1.get(header)!);
    } else if (inS2) {
      // Only in parent2
      resultSections.push(sections2.get(header)!);
    }
  }

  const offspring: PromptContent = {
    systemPrompt: resultSections.join('\n\n'),
    toolDescriptions: Math.random() < 0.5
      ? { ...parent1.toolDescriptions }
      : { ...parent2.toolDescriptions },
  };

  // Handle subagent prompts
  if (parent1.subagentPrompts || parent2.subagentPrompts) {
    offspring.subagentPrompts = Math.random() < 0.5
      ? parent1.subagentPrompts
      : parent2.subagentPrompts;
  }

  return {
    offspring,
    parent1Id,
    parent2Id,
    crossoverType: 'uniform', // Section crossover is a variant of uniform
  };
}

/**
 * Parse a prompt into sections based on markdown headers.
 */
function parseSections(prompt: string): Map<string, string> {
  const sections = new Map<string, string>();

  // Match markdown headers (# or ##)
  const headerRegex = /^(#{1,3})\s+(.+)$/gm;
  const matches = [...prompt.matchAll(headerRegex)];

  if (matches.length === 0) {
    // No headers found - treat entire prompt as one section
    sections.set('__main__', prompt);
    return sections;
  }

  // Extract sections
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const header = match[2].trim();
    const startIndex = match.index! + match[0].length;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index! : prompt.length;

    const content = match[0] + prompt.slice(startIndex, endIndex).trim();
    sections.set(header, content);
  }

  // Include any content before the first header
  const firstHeaderIndex = matches[0].index!;
  if (firstHeaderIndex > 0) {
    const preamble = prompt.slice(0, firstHeaderIndex).trim();
    if (preamble) {
      sections.set('__preamble__', preamble);
    }
  }

  return sections;
}

/**
 * Perform crossover based on the specified type.
 */
export function crossover(
  parent1: PromptContent,
  parent2: PromptContent,
  parent1Id: string,
  parent2Id: string,
  type: CrossoverType = 'uniform'
): CrossoverResult {
  switch (type) {
    case 'single_point':
      return singlePointCrossover(parent1, parent2, parent1Id, parent2Id);
    case 'uniform':
    default:
      return uniformCrossover(parent1, parent2, parent1Id, parent2Id);
  }
}

/**
 * Multi-parent crossover: combines elements from multiple parents.
 * Useful when you want to explore more diverse combinations.
 */
export function multiParentCrossover(
  parents: PromptContent[],
  parentIds: string[]
): CrossoverResult {
  if (parents.length < 2) {
    throw new Error('Multi-parent crossover requires at least 2 parents');
  }

  // System prompt: randomly select from parents
  const systemPromptSource = Math.floor(Math.random() * parents.length);
  const systemPrompt = parents[systemPromptSource].systemPrompt;

  // Tool descriptions: gather all tools and randomly assign sources
  const toolDescriptions: Record<string, string> = {};
  const allToolKeys = new Set(parents.flatMap((p) => Object.keys(p.toolDescriptions)));

  for (const key of allToolKeys) {
    // Get parents that have this tool
    const parentsWithTool = parents.filter((p) => key in p.toolDescriptions);
    if (parentsWithTool.length > 0) {
      const source = Math.floor(Math.random() * parentsWithTool.length);
      toolDescriptions[key] = parentsWithTool[source].toolDescriptions[key];
    }
  }

  // Subagent prompts: similar approach
  let subagentPrompts: Record<string, string> | undefined;
  const parentsWithSubagents = parents.filter((p) => p.subagentPrompts);

  if (parentsWithSubagents.length > 0) {
    subagentPrompts = {};
    const allSubagentKeys = new Set(
      parentsWithSubagents.flatMap((p) => Object.keys(p.subagentPrompts || {}))
    );

    for (const key of allSubagentKeys) {
      const parentsWithKey = parentsWithSubagents.filter(
        (p) => p.subagentPrompts && key in p.subagentPrompts
      );
      if (parentsWithKey.length > 0) {
        const source = Math.floor(Math.random() * parentsWithKey.length);
        subagentPrompts[key] = parentsWithKey[source].subagentPrompts![key];
      }
    }
  }

  const offspring: PromptContent = { systemPrompt, toolDescriptions };
  if (subagentPrompts && Object.keys(subagentPrompts).length > 0) {
    offspring.subagentPrompts = subagentPrompts;
  }

  return {
    offspring,
    parent1Id: parentIds[0],
    parent2Id: parentIds[1] || parentIds[0],
    crossoverType: 'uniform',
  };
}
