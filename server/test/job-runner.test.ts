import { describe, expect, it, vi } from 'vitest';
import { JobRunner } from '../lib/job-runner.js';
import { createLogger } from '../lib/log.js';

describe('job runner', () => {
  it('runs due jobs, respects the delay and never exceeds the concurrency limit', async () => {
    const runner = new JobRunner(createLogger('silent'), { concurrency: 1, tickMs: 1000 });
    let running = 0;
    let peak = 0;
    const work = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running -= 1;
    };
    const a = vi.fn(work);
    const b = vi.fn(work);
    runner.register({ name: 'a', everyMs: 1000, initialDelayMs: 0, run: a }, 0);
    runner.register({ name: 'b', everyMs: 1000, initialDelayMs: 5000, run: b }, 0);

    runner.runDue(100);
    runner.runDue(100);
    await runner.idle();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(peak).toBe(1);

    runner.runDue(Date.now() + 10_000);
    await runner.idle();
    expect(b).toHaveBeenCalledTimes(1);
    await runner.stop();
  });

  it('survives a failing job and keeps scheduling it', async () => {
    const runner = new JobRunner(createLogger('silent'), { concurrency: 2, tickMs: 1000 });
    const failing = vi.fn(async () => {
      throw new Error('boom');
    });
    runner.register({ name: 'failing', everyMs: 1000, initialDelayMs: 0, run: failing }, 0);
    runner.runDue(1);
    await runner.idle();
    runner.runDue(Date.now() + 5000);
    await runner.idle();
    expect(failing).toHaveBeenCalledTimes(2);
    await runner.stop();
  });
});
