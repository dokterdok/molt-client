/**
 * Invoke wrapper with timeout to prevent indefinite hangs
 * Falls back to regular invoke if timeout isn't needed
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Invoke a Tauri command with a timeout
 * Throws if the command doesn't complete within the timeout
 */
export async function invokeWithTimeout<T>(
  cmd: string,
  args?: Record<string, unknown>,
  timeoutMs = 30000, // 30s default timeout
): Promise<T> {
  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs / 1000}s. The server might be unresponsive.`));
    }, timeoutMs);
  });

  // Race between the invoke and the timeout
  try {
    return await Promise.race([
      tauriInvoke<T>(cmd, args),
      timeoutPromise,
    ]);
  } catch (err) {
    // Re-throw with better error message
    if (err instanceof Error && err.message.includes("timed out")) {
      throw err; // Timeout error - keep the message
    }
    throw err; // Other errors - pass through
  }
}
