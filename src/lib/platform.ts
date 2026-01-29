/**
 * Platform detection and keyboard shortcut utilities
 */

// Detect if running on macOS
export const isMacOS = typeof navigator !== "undefined" && 
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Get the modifier key symbol for the current platform
 * Mac: ⌘ (Command)
 * Windows/Linux: Ctrl
 */
export function getModifierKey(): string {
  return isMacOS ? "⌘" : "Ctrl+";
}

/**
 * Format a keyboard shortcut for the current platform
 * @param key - The key (e.g., "N", "K", ",")
 * @returns Formatted shortcut (e.g., "⌘N" on Mac, "Ctrl+N" on Windows)
 */
export function formatShortcut(key: string): string {
  return `${getModifierKey()}${key}`;
}
