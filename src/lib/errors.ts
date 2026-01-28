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
  const errorString = typeof error === 'string' ? error : error.message;
  const lowerError = errorString.toLowerCase();

  // Connection errors
  if (lowerError.includes('connection refused') || lowerError.includes('econnrefused')) {
    return {
      title: "Can't reach Gateway",
      message: "The Gateway isn't responding.",
      suggestion: "Make sure the Gateway is running and the URL is correct."
    };
  }

  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return {
      title: "Connection timed out",
      message: "The Gateway is taking too long to respond.",
      suggestion: "Check your network connection or try again in a moment."
    };
  }

  if (lowerError.includes('websocket') || lowerError.includes('ws://') || lowerError.includes('wss://')) {
    return {
      title: "Connection issue",
      message: "Couldn't establish a WebSocket connection.",
      suggestion: "Verify the Gateway URL starts with ws:// or wss://"
    };
  }

  if (lowerError.includes('dns') || lowerError.includes('getaddrinfo') || lowerError.includes('enotfound')) {
    return {
      title: "Gateway not found",
      message: "The Gateway address couldn't be resolved.",
      suggestion: "Check the Gateway URL for typos."
    };
  }

  if (lowerError.includes('certificate') || lowerError.includes('ssl') || lowerError.includes('tls')) {
    return {
      title: "Security error",
      message: "There's a problem with the secure connection.",
      suggestion: "Try using ws:// instead of wss:// for local connections."
    };
  }

  // Authentication errors
  if (lowerError.includes('unauthorized') || lowerError.includes('401') || lowerError.includes('invalid token')) {
    return {
      title: "Authentication failed",
      message: "The Gateway didn't accept your credentials.",
      suggestion: "Check your Gateway token in Settings."
    };
  }

  if (lowerError.includes('forbidden') || lowerError.includes('403')) {
    return {
      title: "Access denied",
      message: "You don't have permission to access this Gateway.",
      suggestion: "Contact the Gateway administrator."
    };
  }

  // Rate limiting
  if (lowerError.includes('rate limit') || lowerError.includes('429') || lowerError.includes('too many')) {
    return {
      title: "Slow down",
      message: "Too many requests. Taking a brief pause.",
      suggestion: "Wait a moment before trying again."
    };
  }

  // Model errors
  if (lowerError.includes('model') && (lowerError.includes('not found') || lowerError.includes('unavailable'))) {
    return {
      title: "Model unavailable",
      message: "The selected AI model isn't available right now.",
      suggestion: "Try a different model or check your API configuration."
    };
  }

  // Generic connection lost
  if (lowerError.includes('connection') && lowerError.includes('lost')) {
    return {
      title: "Connection lost",
      message: "Lost contact with the Gateway.",
      suggestion: "Reconnecting automatically..."
    };
  }

  // Network errors
  if (lowerError.includes('network') || lowerError.includes('offline')) {
    return {
      title: "Network issue",
      message: "Can't reach the internet.",
      suggestion: "Check your network connection."
    };
  }

  // Cancelled
  if (lowerError.includes('cancelled') || lowerError.includes('canceled') || lowerError.includes('aborted')) {
    return {
      title: "Cancelled",
      message: "The operation was cancelled.",
      suggestion: undefined
    };
  }

  // Default fallback - still show something useful
  return {
    title: "Something went wrong",
    message: errorString.split('\n')[0].slice(0, 100), // First line, max 100 chars
    suggestion: "Try again or check Settings."
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
