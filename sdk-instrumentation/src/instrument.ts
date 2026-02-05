/**
 * Main instrumentation function for Claude Agent SDK
 */

import { LightningClient } from './client';
import { StepBuffer } from './buffer';
import { createHooks } from './hooks';
import { InstrumentationConfig, InstrumentationResult, Outcome } from './types';
import { randomBytes } from 'crypto';

const DEFAULT_CONFIG: Partial<InstrumentationConfig> = {
  enabled: true,
  batchSize: 10,
  flushInterval: 5000,
  debug: false,
};

export function instrument(userConfig: InstrumentationConfig): InstrumentationResult {
  const config: InstrumentationConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  // Generate session ID
  const sessionId = randomBytes(16).toString('hex');

  // Initialize client
  const client = new LightningClient(config.collectorUrl, config.apiKey, config.debug);

  // Will be set after trajectory starts
  let trajectoryId: string | null = null;
  let buffer: StepBuffer | null = null;
  let hooks: any = null;
  let initialized = false;

  const log = (...args: any[]) => {
    if (config.debug) {
      console.log('[Lightning Instrumentation]', ...args);
    }
  };

  /**
   * Lazy initialization - starts trajectory on first use
   */
  const ensureInitialized = async () => {
    if (initialized) return;

    try {
      log('Initializing instrumentation...');

      // Start trajectory
      trajectoryId = await client.startTrajectory(config.agentId, config.taskType);

      // Create buffer
      buffer = new StepBuffer(
        config.batchSize!,
        async (steps) => {
          if (trajectoryId) {
            await client.addSteps(trajectoryId, steps);
          }
        },
        config.flushInterval
      );

      // Create hooks
      hooks = createHooks(client, config, trajectoryId, buffer);

      initialized = true;
      log('Instrumentation initialized with trajectory:', trajectoryId);
    } catch (error) {
      log('Failed to initialize instrumentation:', error);
      // Don't throw - gracefully degrade
      hooks = createNoopHooks();
    }
  };

  /**
   * Create no-op hooks for graceful degradation
   */
  const createNoopHooks = () => ({
    SessionStart: async () => {},
    PreToolUse: async () => {},
    PostToolUse: async () => {},
    Stop: async () => {},
  });

  /**
   * Lazy-loading hooks that initialize on first call
   */
  const lazyHooks = {
    SessionStart: async (context: any) => {
      await ensureInitialized();
      if (hooks?.SessionStart) await hooks.SessionStart(context);
    },

    PreToolUse: async (toolName: string, input: any, context?: any) => {
      await ensureInitialized();
      if (hooks?.PreToolUse) await hooks.PreToolUse(toolName, input, context);
    },

    PostToolUse: async (toolName: string, input: any, output: any, context?: any) => {
      await ensureInitialized();
      if (hooks?.PostToolUse) await hooks.PostToolUse(toolName, input, output, context);
    },

    Stop: async (result: any, context?: any) => {
      await ensureInitialized();
      if (hooks?.Stop) await hooks.Stop(result, context);

      // Cleanup
      if (buffer) {
        buffer.destroy();
      }
    },
  };

  return {
    hooks: lazyHooks,

    flush: async () => {
      await ensureInitialized();
      if (buffer) {
        await buffer.flush();
      }
    },

    getSessionId: () => sessionId,

    getTrajectoryId: () => trajectoryId || '',

    complete: async (outcome: Outcome) => {
      await ensureInitialized();
      if (buffer) {
        await buffer.flush();
      }
      if (trajectoryId) {
        await client.completeTrajectory(trajectoryId, outcome);
      }
    },
  };
}

export { InstrumentationConfig } from './types';
