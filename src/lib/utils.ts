/**
 * Utility functions for Moltzer Client
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with conflict resolution
 * 
 * Combines multiple class names and resolves Tailwind conflicts intelligently.
 * For example: `cn("px-2", "px-4")` → `"px-4"` (later value wins)
 * 
 * @param inputs - Class names (strings, arrays, objects, conditional values)
 * @returns Merged class string with conflicts resolved
 * 
 * @example
 * ```tsx
 * // Basic usage
 * cn("text-red-500", "font-bold") // → "text-red-500 font-bold"
 * 
 * // Conflict resolution
 * cn("px-2 py-1", "px-4") // → "px-4 py-1"
 * 
 * // Conditional classes
 * cn("base-class", { "active": isActive, "disabled": isDisabled })
 * 
 * // Common pattern in components
 * <div className={cn("default-styles", className, { "special": isSpecial })} />
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
