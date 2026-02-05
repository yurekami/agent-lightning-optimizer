/**
 * @agent-lightning/instrumentation
 *
 * Lightweight instrumentation for Claude Agent SDK to capture trajectories
 * for Agent Lightning Optimizer (APO).
 *
 * @example
 * ```typescript
 * import { query } from '@anthropic-ai/claude-agent-sdk';
 * import { instrument } from '@agent-lightning/instrumentation';
 *
 * const lightning = instrument({
 *   collectorUrl: 'http://localhost:4000',
 *   apiKey: process.env.LIGHTNING_API_KEY,
 *   agentId: 'my-code-agent'
 * });
 *
 * for await (const message of query({
 *   prompt: "Fix the bug in auth.py",
 *   options: {
 *     allowedTools: ["Read", "Edit", "Bash"],
 *     hooks: lightning.hooks
 *   }
 * })) {
 *   console.log(message);
 * }
 * ```
 */

export { instrument, InstrumentationConfig } from './instrument';
export { LightningClient } from './client';
export { createHooks } from './hooks';
export { StepBuffer } from './buffer';
export * from './types';
