/**
 * SDK hooks generator for capturing trajectory data
 */

import { LightningClient } from './client';
import { StepBuffer } from './buffer';
import { InstrumentationConfig, Hooks, TrajectoryStep } from './types';

export function createHooks(
  client: LightningClient,
  config: InstrumentationConfig,
  trajectoryId: string,
  buffer: StepBuffer
): Hooks {
  let stepCounter = 0;
  let sessionStartTime = Date.now();

  const log = (...args: any[]) => {
    if (config.debug) {
      console.log('[Lightning Hooks]', ...args);
    }
  };

  const createStep = (
    toolName: string,
    toolInput: any,
    toolOutput?: any,
    error?: string
  ): TrajectoryStep => {
    stepCounter++;
    return {
      stepNumber: stepCounter,
      timestamp: new Date().toISOString(),
      toolName,
      toolInput: sanitizeData(toolInput),
      toolOutput: toolOutput ? sanitizeData(toolOutput) : undefined,
      error,
    };
  };

  const sanitizeData = (data: any): any => {
    try {
      // Create a deep copy and limit size
      const str = JSON.stringify(data);
      if (str.length > 50000) {
        return {
          _truncated: true,
          _originalSize: str.length,
          preview: str.substring(0, 1000),
        };
      }
      return JSON.parse(str);
    } catch {
      return { _error: 'Failed to serialize data' };
    }
  };

  const safeAddStep = async (step: TrajectoryStep) => {
    if (!config.enabled) return;

    try {
      await buffer.add(step);
    } catch (error) {
      log('Failed to add step:', error);
      // Don't throw - we never want to crash the agent
    }
  };

  return {
    SessionStart: async (context: any) => {
      log('Session started');
      sessionStartTime = Date.now();
      stepCounter = 0;
    },

    PreToolUse: async (toolName: string, input: any, context?: any) => {
      log(`Pre-tool: ${toolName}`);

      const step = createStep(toolName, input);
      await safeAddStep(step);
    },

    PostToolUse: async (toolName: string, input: any, output: any, context?: any) => {
      log(`Post-tool: ${toolName}`);

      // Update the last step with output
      const step = createStep(toolName, input, output);
      await safeAddStep(step);
    },

    Stop: async (result: any, context?: any) => {
      log('Session stopped');

      // Flush remaining steps
      try {
        await buffer.flush();

        // Complete the trajectory
        const duration = Date.now() - sessionStartTime;
        await client.completeTrajectory(trajectoryId, {
          success: !result?.error,
          result: sanitizeData(result),
          error: result?.error,
          totalSteps: stepCounter,
          duration,
        });
      } catch (error) {
        log('Failed to complete trajectory:', error);
      }
    },
  };
}
