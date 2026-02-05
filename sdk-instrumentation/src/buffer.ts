/**
 * Step buffer for batching trajectory steps before sending to collector
 */

import { TrajectoryStep } from './types';

export class StepBuffer {
  private buffer: TrajectoryStep[] = [];
  private maxSize: number;
  private flushInterval: number;
  private onFlush: (steps: TrajectoryStep[]) => Promise<void>;
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(
    maxSize: number,
    onFlush: (steps: TrajectoryStep[]) => Promise<void>,
    flushInterval = 5000
  ) {
    this.maxSize = maxSize;
    this.onFlush = onFlush;
    this.flushInterval = flushInterval;
  }

  /**
   * Add a step to the buffer, flushing if necessary
   */
  async add(step: TrajectoryStep): Promise<void> {
    this.buffer.push(step);

    // Reset the timer on each add
    this.resetTimer();

    // Flush if buffer is full
    if (this.buffer.length >= this.maxSize) {
      await this.flush();
    }
  }

  /**
   * Manually flush all buffered steps
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) {
      return;
    }

    this.flushing = true;
    this.clearTimer();

    const steps = [...this.buffer];
    this.buffer = [];

    try {
      await this.onFlush(steps);
    } catch (error) {
      // On error, put steps back in buffer to retry
      console.error('[StepBuffer] Flush failed, requeueing steps:', error);
      this.buffer.unshift(...steps);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Clear the buffer without flushing
   */
  clear(): void {
    this.buffer = [];
    this.clearTimer();
  }

  /**
   * Reset the auto-flush timer
   */
  private resetTimer(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.flush().catch(error => {
        console.error('[StepBuffer] Auto-flush failed:', error);
      });
    }, this.flushInterval);
  }

  /**
   * Clear the auto-flush timer
   */
  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearTimer();
    this.buffer = [];
  }
}
