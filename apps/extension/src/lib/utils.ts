/**
 * Shared async utilities for the extension.
 */

/** Pause execution for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
