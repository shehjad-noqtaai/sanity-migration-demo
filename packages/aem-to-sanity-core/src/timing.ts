/**
 * Tiny timer utility used by each CLI to report how long the overall run
 * and each phase took. `performance.now()` gives monotonic milliseconds —
 * immune to wall-clock adjustments while a long migration is in progress.
 */
export interface Timer {
  /** Milliseconds since the timer started. */
  elapsedMs(): number;
  /** Human-friendly `"1.2s"` / `"2m 3.4s"` formatted elapsed time. */
  elapsed(): string;
}

export function startTimer(): Timer {
  const start = performance.now();
  return {
    elapsedMs: () => performance.now() - start,
    elapsed: () => formatDuration(performance.now() - start),
  };
}

/**
 * Format a duration in milliseconds as a compact human-readable string.
 * Always picks a single unit so the log stays scannable:
 *   999ms → `"999ms"`
 *   1500ms → `"1.5s"`
 *   65000ms → `"1m 5.0s"`
 *   3700000ms → `"1h 1m"`
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) {
    const min = Math.floor(ms / 60_000);
    const sec = ((ms % 60_000) / 1000).toFixed(1);
    return `${min}m ${sec}s`;
  }
  const hr = Math.floor(ms / 3_600_000);
  const min = Math.floor((ms % 3_600_000) / 60_000);
  return `${hr}h ${min}m`;
}
