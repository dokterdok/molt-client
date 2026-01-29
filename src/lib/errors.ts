/**
 * Error message translation for user-friendly display
 *
 * Converts technical error messages into human-readable explanations
 * with actionable suggestions.
 */

interface UserFriendlyError {
  title: string;
  message: string;
  suggestion?: string;
}

/**
 * Translate a technical error message into a user-friendly format
 */
export function translateError(error: string | Error): UserFriendlyError {
  const errorString = typeof error === "string" ? error : error.message;
  const lowerError = errorString.toLowerCase();

  // Connection errors
  if (
    lowerError.includes("connection refused") ||
    lowerError.includes("econnrefused")
  ) {
    return {
      title: "Can't connect",
      message: "Nothing is responding at that address.",
      suggestion:
        "Make sure Moltz is running on your computer. Check Settings to update the connection.",
    };
  }

  if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
    return {
      title: "Taking too long",
      message: "The connection is timing out.",
      suggestion: "Check your connection settings or try again in a moment.",
    };
  }

  if (
    lowerError.includes("websocket") ||
    lowerError.includes("ws://") ||
    lowerError.includes("wss://")
  ) {
    return {
      title: "Connection problem",
      message: "Can't establish the connection.",
      suggestion: "Check your connection settings.",
    };
  }

  if (
    lowerError.includes("dns") ||
    lowerError.includes("getaddrinfo") ||
    lowerError.includes("enotfound")
  ) {
    return {
      title: "Address not found",
      message: "Can't find that address.",
      suggestion: "Double-check the address in Settings for typos.",
    };
  }

  if (
    lowerError.includes("certificate") ||
    lowerError.includes("ssl") ||
    lowerError.includes("tls")
  ) {
    return {
      title: "Security error",
      message: "There's a problem with the secure connection.",
      suggestion: "Try using ws:// instead of wss:// for local connections.",
    };
  }

  // Gateway protocol/schema errors
  if (
    lowerError.includes("invalid connect params") ||
    lowerError.includes("client/id")
  ) {
    return {
      title: "Protocol mismatch",
      message: "The gateway rejected the connection handshake.",
      suggestion:
        "Try updating both Moltz and Clawdbot to the latest version. If using an older gateway, check if 'allowInsecureAuth' is enabled in gateway config.",
    };
  }

  // Authentication errors
  if (
    lowerError.includes("unauthorized") ||
    lowerError.includes("401") ||
    lowerError.includes("invalid token")
  ) {
    return {
      title: "Wrong password",
      message: "The security password isn't correct.",
      suggestion:
        "Check your password in Settings, or try without a password if you didn't set one up.",
    };
  }

  if (lowerError.includes("forbidden") || lowerError.includes("403")) {
    return {
      title: "Access denied",
      message: "You don't have permission to connect.",
      suggestion:
        "Check your security password or contact whoever set this up.",
    };
  }

  // Rate limiting
  if (
    lowerError.includes("rate limit") ||
    lowerError.includes("429") ||
    lowerError.includes("too many")
  ) {
    return {
      title: "Slow down",
      message: "Too many requests. Taking a brief pause.",
      suggestion: "Wait a moment before trying again.",
    };
  }

  // Model errors
  if (
    lowerError.includes("model") &&
    (lowerError.includes("not found") || lowerError.includes("unavailable"))
  ) {
    return {
      title: "Model unavailable",
      message: "The selected AI model isn't available right now.",
      suggestion: "Try a different model or check your API configuration.",
    };
  }

  // Generic connection lost
  if (lowerError.includes("connection") && lowerError.includes("lost")) {
    return {
      title: "Connection lost",
      message: "Lost contact with the Gateway.",
      suggestion: "Reconnecting automatically...",
    };
  }

  // Network errors
  if (lowerError.includes("network") || lowerError.includes("offline")) {
    return {
      title: "Network issue",
      message: "Can't reach the internet.",
      suggestion: "Check your network connection.",
    };
  }

  // File system errors
  if (
    lowerError.includes("permission denied") ||
    lowerError.includes("eacces")
  ) {
    return {
      title: "Permission denied",
      message: "Don't have permission to access this file or folder.",
      suggestion: "Check file permissions or try a different location.",
    };
  }

  if (lowerError.includes("no such file") || lowerError.includes("enoent")) {
    return {
      title: "File not found",
      message: "The file or folder doesn't exist.",
      suggestion: "Check the file path and try again.",
    };
  }

  if (lowerError.includes("disk") || lowerError.includes("enospc")) {
    return {
      title: "Out of space",
      message: "Not enough disk space available.",
      suggestion: "Free up some space and try again.",
    };
  }

  // Clipboard errors
  if (lowerError.includes("clipboard")) {
    return {
      title: "Clipboard error",
      message: "Couldn't access the clipboard.",
      suggestion: "Try copying again or check clipboard permissions.",
    };
  }

  // Cancelled
  if (
    lowerError.includes("cancelled") ||
    lowerError.includes("canceled") ||
    lowerError.includes("aborted")
  ) {
    return {
      title: "Cancelled",
      message: "The operation was cancelled.",
      suggestion: undefined,
    };
  }

  // Default fallback - still show something useful
  return {
    title: "Something went wrong",
    message: errorString.split("\n")[0].slice(0, 100), // First line, max 100 chars
    suggestion: "Try again or check Settings if this keeps happening.",
  };
}

/**
 * Format error for display in UI
 */
export function formatErrorForDisplay(error: string | Error): string {
  const friendly = translateError(error);
  if (friendly.suggestion) {
    return `${friendly.title}: ${friendly.message}\n${friendly.suggestion}`;
  }
  return `${friendly.title}: ${friendly.message}`;
}

/**
 * Get just the title for compact display (e.g., status bar)
 */
export function getErrorTitle(error: string | Error): string {
  return translateError(error).title;
}

/**
 * Log error with context for debugging
 * Logs the full technical error while showing user-friendly messages in UI
 */
export function logError(
  error: string | Error,
  context?: string,
  additionalData?: Record<string, unknown>,
): void {
  const prefix = context ? `[${context}]` : "";
  console.error(`${prefix} Error:`, error);

  if (additionalData && Object.keys(additionalData).length > 0) {
    console.error(`${prefix} Additional context:`, additionalData);
  }

  // Also log the stack trace if available
  if (error instanceof Error && error.stack) {
    console.error(`${prefix} Stack trace:`, error.stack);
  }
}
