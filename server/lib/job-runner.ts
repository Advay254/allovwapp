import type { Logger } from './log.js';
import { describeError } from './log.js';

export interface Job {
  name: string;
  everyMs: number;
  initialDelayMs?: number;
  run: () => Promise<void>;
}

interface Entry {
  job: Job;
  nextRunAt: number;
  running: boolean;
}

export interface JobRunnerOptions {
  concurrency: number;
  tickMs: number;
}

/** Small scheduler with bounded concurrency. Later versions add jobs with register(). */
export class JobRunner {
  private readonly entries: Entry[] = [];
  private readonly inflight = new Set<Promise<void>>();
  private timer: NodeJS.Timeout | null = null;
  private active = 0;
  private stopped = false;

  constructor(
    private readonly log: Logger,
    private readonly options: JobRunnerOptions,
  ) {}

  register(job: Job, now = Date.now()): void {
    this.entries.push({ job, nextRunAt: now + (job.initialDelayMs ?? job.everyMs), running: false });
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.runDue(), this.options.tickMs);
    this.timer.unref();
  }

  /** Starts every due job, never more than the concurrency limit. */
  runDue(now = Date.now()): void {
    if (this.stopped) return;
    for (const entry of this.entries) {
      if (this.active >= this.options.concurrency) return;
      if (entry.running || now < entry.nextRunAt) continue;
      this.launch(entry);
    }
  }

  private launch(entry: Entry): void {
    entry.running = true;
    this.active += 1;
    const task = (async () => {
      try {
        await entry.job.run();
      } catch (err) {
        this.log.error({ job: entry.job.name, err: describeError(err) }, 'Job failed');
      } finally {
        entry.running = false;
        entry.nextRunAt = Date.now() + entry.job.everyMs;
        this.active -= 1;
      }
    })();
    this.inflight.add(task);
    void task.finally(() => this.inflight.delete(task));
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await Promise.allSettled([...this.inflight]);
  }

  /** For tests: resolves when every running job has finished. */
  async idle(): Promise<void> {
    await Promise.allSettled([...this.inflight]);
  }
}
