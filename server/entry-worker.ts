import { JobRunner } from './lib/job-runner.js';
import type { AppContext } from './lib/context.js';
import { createSweepJob } from './system/system-sweep.js';

/** Worker role: runs the hourly maintenance sweep. Later versions register more jobs here. */
export function startWorker(ctx: AppContext): { stop: () => Promise<void> } {
  const runner = new JobRunner(ctx.logger, { concurrency: 1, tickMs: 30_000 });
  runner.register(createSweepJob(ctx));
  runner.start();
  return { stop: () => runner.stop() };
}
