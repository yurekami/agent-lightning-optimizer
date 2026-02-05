/**
 * Meta-prompts used for different mutation types
 * These prompts instruct Claude how to mutate the agent prompts
 */

export const MUTATION_PROMPTS = {
  rephrase_clarity: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Rephrase this prompt to be clearer and more direct while preserving all functionality.

GUIDELINES:
- Use simpler, more direct language
- Remove ambiguity and vague terms
- Make instructions more explicit
- Preserve all requirements and constraints
- Do not add new capabilities or remove existing ones
- Maintain the same overall structure

OUTPUT: Return ONLY the modified system prompt text, with no explanation or meta-commentary.

MODIFIED PROMPT:`,

  add_examples: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Add 2-3 concrete examples that illustrate how the instructions should be followed.

GUIDELINES:
- Examples should be realistic and representative
- Show both correct and incorrect approaches where helpful
- Keep examples concise but informative
- Integrate examples naturally into the existing structure
- Do not remove any existing content
- Examples should clarify instructions, not add new requirements

OUTPUT: Return ONLY the modified system prompt text with examples integrated, no explanation.

MODIFIED PROMPT:`,

  remove_examples: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Remove specific examples while keeping the core instructions clear.

GUIDELINES:
- Remove concrete examples but keep general guidance
- Ensure instructions remain clear without examples
- Preserve all functional requirements
- Make instructions more abstract/general
- Do not remove non-example content

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,

  increase_verbosity: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Increase verbosity by adding more detail and explanation to instructions.

GUIDELINES:
- Expand on existing points with more context
- Add clarifying details and rationale
- Explain the "why" behind instructions
- Add edge case handling guidance
- Do not change core requirements
- Make implicit knowledge explicit

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,

  decrease_verbosity: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Decrease verbosity by making the prompt more concise.

GUIDELINES:
- Remove redundant explanations
- Use more concise language
- Keep essential instructions only
- Combine related points
- Preserve all functional requirements
- Remove filler words and phrases

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,

  add_edge_cases: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Add guidance for handling edge cases and unusual scenarios.

GUIDELINES:
- Identify likely edge cases for this agent's role
- Add specific instructions for handling them
- Include error handling guidance
- Address boundary conditions
- Keep additions realistic and relevant
- Do not remove existing content

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,

  restructure_sections: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Restructure the sections for better logical flow and organization.

GUIDELINES:
- Reorganize content for clarity
- Group related instructions together
- Improve information hierarchy
- Use clear section headings if appropriate
- Preserve all content, just reorganize
- Maintain consistent formatting

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,

  change_tone_formal: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Adjust the tone to be more formal and professional.

GUIDELINES:
- Use formal, professional language
- Remove casual expressions
- Use precise, technical terminology
- Maintain authoritative tone
- Preserve all instructions and requirements
- Keep the same structure

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,

  change_tone_casual: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Adjust the tone to be more casual and approachable.

GUIDELINES:
- Use conversational language
- Make instructions feel friendly
- Remove overly formal language
- Keep instructions clear but relaxed
- Preserve all requirements
- Maintain professional clarity

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,

  add_constraints: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Add explicit constraints and limitations to guide agent behavior.

GUIDELINES:
- Add constraints that prevent undesired behaviors
- Include safety and quality guardrails
- Define clear boundaries
- Specify what the agent should NOT do
- Keep constraints realistic and relevant
- Do not remove existing content

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,

  simplify_instructions: `You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: Simplify complex instructions into clearer, more straightforward steps.

GUIDELINES:
- Break down complex instructions
- Use simpler vocabulary
- Make steps more explicit
- Remove unnecessary complexity
- Preserve all requirements
- Maintain logical flow

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:`,
};

/**
 * Apply a mutation prompt template with the original content
 */
export function formatMutationPrompt(
  mutationType: string,
  originalPrompt: string
): string {
  const template = MUTATION_PROMPTS[mutationType as keyof typeof MUTATION_PROMPTS];
  if (!template) {
    throw new Error(`Unknown mutation type: ${mutationType}`);
  }
  return template.replace('{original_prompt}', originalPrompt);
}
