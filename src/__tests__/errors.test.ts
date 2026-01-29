import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  translateError,
  formatErrorForDisplay,
  getErrorTitle,
  logError,
} from "../lib/errors";

describe("Error Translation", () => {
  describe("translateError - Connection Errors", () => {
    it("should translate connection refused errors", () => {
      const result = translateError("Connection refused");
      expect(result.title).toBe("Can't connect");
      expect(result.message).toBe("Nothing is responding at that address.");
      expect(result.suggestion).toContain("Make sure Moltz is running");
    });

    it("should translate ECONNREFUSED errors", () => {
      const result = translateError("ECONNREFUSED to localhost:8080");
      expect(result.title).toBe("Can't connect");
    });

    it("should translate timeout errors", () => {
      const result = translateError("Request timeout");
      expect(result.title).toBe("Taking too long");
      expect(result.message).toBe("The connection is timing out.");
      expect(result.suggestion).toContain("Check your connection settings");
    });

    it("should translate timed out errors", () => {
      const result = translateError("Connection timed out");
      expect(result.title).toBe("Taking too long");
    });

    it("should translate websocket errors", () => {
      const result = translateError("WebSocket connection failed");
      expect(result.title).toBe("Connection problem");
      expect(result.message).toBe("Can't establish the connection.");
    });

    it("should translate ws:// protocol errors", () => {
      const result = translateError("Failed to connect to ws://localhost");
      expect(result.title).toBe("Connection problem");
    });

    it("should translate wss:// protocol errors", () => {
      const result = translateError("Failed to connect to wss://example.com");
      expect(result.title).toBe("Connection problem");
    });

    it("should translate DNS errors", () => {
      const result = translateError("DNS lookup failed");
      expect(result.title).toBe("Address not found");
      expect(result.message).toBe("Can't find that address.");
      expect(result.suggestion).toContain("Double-check the address");
    });

    it("should translate getaddrinfo errors", () => {
      const result = translateError("getaddrinfo ENOTFOUND");
      expect(result.title).toBe("Address not found");
    });

    it("should translate ENOTFOUND errors", () => {
      const result = translateError("ENOTFOUND example.com");
      expect(result.title).toBe("Address not found");
    });

    it("should translate certificate errors", () => {
      const result = translateError("Certificate verification failed");
      expect(result.title).toBe("Security error");
      expect(result.message).toContain("secure connection");
      expect(result.suggestion).toContain("ws:// instead of wss://");
    });

    it("should translate SSL errors", () => {
      const result = translateError("SSL handshake failed");
      expect(result.title).toBe("Security error");
    });

    it("should translate TLS errors", () => {
      const result = translateError("TLS negotiation failed");
      expect(result.title).toBe("Security error");
    });

    it("should translate connection lost errors", () => {
      const result = translateError("Connection lost to gateway");
      expect(result.title).toBe("Connection lost");
      expect(result.message).toBe("Lost contact with the Gateway.");
      expect(result.suggestion).toContain("Reconnecting");
    });

    it("should translate network errors", () => {
      const result = translateError("Network error occurred");
      expect(result.title).toBe("Network issue");
      expect(result.message).toBe("Can't reach the internet.");
    });

    it("should translate offline errors", () => {
      const result = translateError("You are offline");
      expect(result.title).toBe("Network issue");
    });
  });

  describe("translateError - Authentication Errors", () => {
    it("should translate unauthorized errors", () => {
      const result = translateError("Unauthorized access");
      expect(result.title).toBe("Wrong password");
      expect(result.message).toContain("security password");
      expect(result.suggestion).toContain("Check your password");
    });

    it("should translate 401 status errors", () => {
      const result = translateError("HTTP 401 Unauthorized");
      expect(result.title).toBe("Wrong password");
    });

    it("should translate invalid token errors", () => {
      const result = translateError("Invalid token provided");
      expect(result.title).toBe("Wrong password");
    });

    it("should translate forbidden errors", () => {
      const result = translateError("Forbidden");
      expect(result.title).toBe("Access denied");
      expect(result.message).toContain("don't have permission");
    });

    it("should translate 403 status errors", () => {
      const result = translateError("HTTP 403 Forbidden");
      expect(result.title).toBe("Access denied");
    });
  });

  describe("translateError - Rate Limiting", () => {
    it("should translate rate limit errors", () => {
      const result = translateError("Rate limit exceeded");
      expect(result.title).toBe("Slow down");
      expect(result.message).toContain("Too many requests");
      expect(result.suggestion).toContain("Wait a moment");
    });

    it("should translate 429 status errors", () => {
      const result = translateError("HTTP 429 Too Many Requests");
      expect(result.title).toBe("Slow down");
    });

    it("should translate 'too many' errors", () => {
      const result = translateError("Too many connections");
      expect(result.title).toBe("Slow down");
    });
  });

  describe("translateError - Model Errors", () => {
    it("should translate model not found errors", () => {
      const result = translateError("Model not found: gpt-4");
      expect(result.title).toBe("Model unavailable");
      expect(result.message).toContain("AI model isn't available");
      expect(result.suggestion).toContain("Try a different model");
    });

    it("should translate model unavailable errors", () => {
      const result = translateError("Model unavailable at this time");
      expect(result.title).toBe("Model unavailable");
    });
  });

  describe("translateError - File System Errors", () => {
    it("should translate permission denied errors", () => {
      const result = translateError("Permission denied");
      expect(result.title).toBe("Permission denied");
      expect(result.message).toContain("Don't have permission");
      expect(result.suggestion).toContain("Check file permissions");
    });

    it("should translate EACCES errors", () => {
      const result = translateError("EACCES: access denied");
      expect(result.title).toBe("Permission denied");
    });

    it("should translate no such file errors", () => {
      const result = translateError("No such file or directory");
      expect(result.title).toBe("File not found");
      expect(result.message).toContain("doesn't exist");
    });

    it("should translate ENOENT errors", () => {
      const result = translateError("ENOENT: file not found");
      expect(result.title).toBe("File not found");
    });

    it("should translate disk space errors", () => {
      const result = translateError("Disk full");
      expect(result.title).toBe("Out of space");
      expect(result.message).toContain("Not enough disk space");
    });

    it("should translate ENOSPC errors", () => {
      const result = translateError("ENOSPC: no space left");
      expect(result.title).toBe("Out of space");
    });
  });

  describe("translateError - Other Errors", () => {
    it("should translate clipboard errors", () => {
      const result = translateError("Clipboard access denied");
      expect(result.title).toBe("Clipboard error");
      expect(result.message).toContain("Couldn't access the clipboard");
    });

    it("should translate cancelled errors", () => {
      const result = translateError("Operation cancelled");
      expect(result.title).toBe("Cancelled");
      expect(result.message).toBe("The operation was cancelled.");
      expect(result.suggestion).toBeUndefined();
    });

    it("should translate canceled errors (US spelling)", () => {
      const result = translateError("Operation canceled");
      expect(result.title).toBe("Cancelled");
    });

    it("should translate aborted errors", () => {
      const result = translateError("Request aborted");
      expect(result.title).toBe("Cancelled");
    });
  });

  describe("translateError - Error Objects", () => {
    it("should handle Error objects", () => {
      const error = new Error("Connection refused");
      const result = translateError(error);
      expect(result.title).toBe("Can't connect");
    });

    it("should handle Error objects with stack traces", () => {
      const error = new Error("Timeout occurred");
      error.stack = "Error: Timeout\n  at test.js:10";
      const result = translateError(error);
      expect(result.title).toBe("Taking too long");
    });
  });

  describe("translateError - Case Insensitivity", () => {
    it("should be case insensitive", () => {
      expect(translateError("CONNECTION REFUSED").title).toBe("Can't connect");
      expect(translateError("Timeout").title).toBe("Taking too long");
      expect(translateError("UNAUTHORIZED").title).toBe("Wrong password");
    });

    it("should handle mixed case errors", () => {
      expect(translateError("WebSocket Error").title).toBe(
        "Connection problem",
      );
      expect(translateError("DNS Lookup Failed").title).toBe(
        "Address not found",
      );
    });
  });

  describe("translateError - Default Fallback", () => {
    it("should provide friendly fallback for unknown errors", () => {
      const result = translateError("Some completely unknown error");
      expect(result.title).toBe("Something went wrong");
      expect(result.message).toBe("Some completely unknown error");
      expect(result.suggestion).toContain("Try again");
    });

    it("should truncate long fallback messages", () => {
      const longError = "x".repeat(200);
      const result = translateError(longError);
      expect(result.message.length).toBeLessThanOrEqual(100);
    });

    it("should only show first line for multiline errors", () => {
      const multilineError = "First line\nSecond line\nThird line";
      const result = translateError(multilineError);
      expect(result.message).toBe("First line");
    });

    it("should handle empty error strings", () => {
      const result = translateError("");
      expect(result.title).toBe("Something went wrong");
      expect(result.message).toBe("");
    });
  });

  describe("formatErrorForDisplay", () => {
    it("should format error with suggestion", () => {
      const formatted = formatErrorForDisplay("Connection refused");
      expect(formatted).toContain("Can't connect");
      expect(formatted).toContain("Nothing is responding");
      expect(formatted).toContain("Make sure Moltz is running");
    });

    it("should format error without suggestion", () => {
      const formatted = formatErrorForDisplay("Operation cancelled");
      expect(formatted).toBe("Cancelled: The operation was cancelled.");
      expect(formatted).not.toContain("\n");
    });

    it("should handle Error objects", () => {
      const error = new Error("Timeout");
      const formatted = formatErrorForDisplay(error);
      expect(formatted).toContain("Taking too long");
    });

    it("should include newline separator for suggestions", () => {
      const formatted = formatErrorForDisplay("DNS error");
      expect(formatted).toMatch(/.*\n.*/);
    });
  });

  describe("getErrorTitle", () => {
    it("should return just the title", () => {
      const title = getErrorTitle("Connection refused");
      expect(title).toBe("Can't connect");
    });

    it("should work with Error objects", () => {
      const error = new Error("Unauthorized");
      const title = getErrorTitle(error);
      expect(title).toBe("Wrong password");
    });

    it("should return compact title for status bar", () => {
      const title = getErrorTitle("Rate limit exceeded");
      expect(title).toBe("Slow down");
      expect(title.length).toBeLessThan(20);
    });
  });

  describe("logError", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should log error to console", () => {
      logError("Test error");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        " Error:",
        "Test error",
      );
    });

    it("should log error with context", () => {
      logError("Test error", "WebSocket");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[WebSocket] Error:",
        "Test error",
      );
    });

    it("should log additional data", () => {
      const additionalData = { url: "ws://localhost", retry: 3 };
      logError("Connection failed", "WebSocket", additionalData);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[WebSocket] Error:",
        "Connection failed",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[WebSocket] Additional context:",
        additionalData,
      );
    });

    it("should log Error object stack trace", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test\n  at test.js:10";

      logError(error, "TestContext");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[TestContext] Error:",
        error,
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[TestContext] Stack trace:",
        error.stack,
      );
    });

    it("should handle Error without stack trace", () => {
      const error = new Error("Test error");
      delete error.stack;

      logError(error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(" Error:", error);
    });

    it("should not log empty additional data", () => {
      logError("Test error", "Context", {});

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Context] Error:",
        "Test error",
      );
    });

    it("should handle undefined context", () => {
      logError("Test error", undefined, { detail: "info" });

      expect(consoleErrorSpy).toHaveBeenCalledWith(" Error:", "Test error");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        " Additional context:",
        { detail: "info" },
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle errors with multiple matching patterns", () => {
      // Should match the first pattern (connection refused)
      const result = translateError("Connection refused timeout");
      expect(result.title).toBe("Can't connect");
    });

    it("should handle errors with mixed keywords", () => {
      const result = translateError("WebSocket connection timeout");
      // Matches the first applicable pattern (timeout in this case)
      expect(result.title).toBe("Taking too long");
    });

    it("should handle numeric error codes", () => {
      expect(translateError("Error 401").title).toBe("Wrong password");
      expect(translateError("Error 403").title).toBe("Access denied");
      expect(translateError("Error 429").title).toBe("Slow down");
    });

    it("should handle URL-like errors", () => {
      expect(translateError("Failed: ws://localhost:8080").title).toBe(
        "Connection problem",
      );
      expect(translateError("Error at wss://api.example.com").title).toBe(
        "Connection problem",
      );
    });
  });
});
