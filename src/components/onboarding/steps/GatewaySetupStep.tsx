import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../../stores/store";
import { cn } from "../../../lib/utils";
import { Spinner } from "../../ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";

interface GatewaySetupStepProps {
  gatewayUrl: string;
  gatewayToken: string;
  onGatewayUrlChange: (url: string) => void;
  onGatewayTokenChange: (token: string) => void;
  onSuccess: () => void;
  onBack: () => void;
  onSkip: () => void;
}

type ConnectionState = "idle" | "detecting" | "testing" | "success" | "error";

// Derive a helpful hint based on error content
function getErrorHint(errorStr: string): string {
  const lower = errorStr.toLowerCase();
  
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return "The authentication token may be wrong or missing.";
  }
  if (lower.includes("400") || lower.includes("bad request")) {
    return "Check your Gateway URL format (should be ws:// or wss://).";
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return "The Gateway endpoint was not found. Check the URL.";
  }
  if (lower.includes("connection refused") || lower.includes("econnrefused")) {
    return "Make sure Gateway is running and the URL is correct.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "The connection timed out. Check if the Gateway is reachable.";
  }
  if (lower.includes("network") || lower.includes("dns") || lower.includes("resolve")) {
    return "Can't reach the Gateway. Check your network connection.";
  }
  
  return "Make sure Gateway is running and the URL is correct.";
}

// Format raw error message for display
function formatErrorMessage(err: any): string {
  const errStr = err?.toString() || "Unknown error";
  // Remove "Error: " prefix if present for cleaner display
  return errStr.replace(/^Error:\s*/i, "");
}

export function GatewaySetupStep({
  gatewayUrl,
  gatewayToken,
  onGatewayUrlChange,
  onGatewayTokenChange,
  onSuccess,
  onBack,
  onSkip,
}: GatewaySetupStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorHint, setErrorHint] = useState<string>("");
  const [autoDetected, setAutoDetected] = useState(false);
  const { updateSettings } = useStore();

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
    
    // Auto-detect local Gateway
    autoDetectGateway();
  }, []);

  const autoDetectGateway = async () => {
    setConnectionState("detecting");
    setErrorMessage("");
    
    const commonUrls = [
      "ws://localhost:18789",
      "ws://127.0.0.1:18789",
      "ws://localhost:8789",
    ];

    for (const url of commonUrls) {
      try {
        await invoke("connect", { url, token: "" });
        // Success! Gateway found
        onGatewayUrlChange(url);
        setAutoDetected(true);
        setConnectionState("success");
        
        // Auto-save settings
        updateSettings({ gatewayUrl: url, gatewayToken: "" });
        
        // Auto-advance after a moment
        setTimeout(() => {
          onSuccess();
        }, 1500);
        return;
      } catch (err) {
        // Try next URL
        continue;
      }
    }

    // No Gateway found
    setConnectionState("idle");
  };

  const handleTestConnection = async () => {
    if (!gatewayUrl.trim()) {
      setErrorMessage("Please enter a Gateway URL");
      return;
    }

    setConnectionState("testing");
    setErrorMessage("");

    try {
      await invoke("disconnect");
      await invoke("connect", { url: gatewayUrl, token: gatewayToken });
      
      // Success!
      setConnectionState("success");
      updateSettings({ gatewayUrl, gatewayToken });

      // Fetch models
      try {
        const models = await invoke<any[]>("get_models");
        if (models && models.length > 0) {
          useStore.getState().setAvailableModels(models);
        }
      } catch (err) {
        console.error("Failed to fetch models:", err);
      }

      // Auto-advance
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setConnectionState("error");
      
      // Show the actual error message with a contextual hint
      const formattedError = formatErrorMessage(err);
      setErrorMessage(formattedError);
      setErrorHint(getErrorHint(formattedError));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && connectionState === "idle") {
      e.preventDefault();
      handleTestConnection();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-8">
        {/* Header */}
        <div
          className={cn(
            "text-center transition-all duration-700 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <h2 className="text-4xl font-bold mb-3">Connect to Gateway</h2>
          <p className="text-lg text-muted-foreground">
            {autoDetected
              ? "Great! We found your Gateway."
              : "Enter your Gateway URL to get started"}
          </p>
        </div>

        {/* Auto-detection status */}
        {connectionState === "detecting" && (
          <div
            className={cn(
              "p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-in fade-in slide-in-from-top-2 duration-300"
            )}
          >
            <div className="flex items-center gap-3">
              <Spinner size="sm" />
              <div>
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  Auto-detecting Gateway...
                </p>
                <p className="text-sm text-muted-foreground">
                  Checking common ports
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {connectionState === "success" && (
          <div
            className={cn(
              "p-6 rounded-xl bg-green-500/10 border border-green-500/20 animate-in fade-in zoom-in-95 duration-300"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-green-600 dark:text-green-400">
                  Connected successfully!
                </p>
                <p className="text-sm text-muted-foreground">
                  {autoDetected ? "Auto-detected at" : "Connected to"} {gatewayUrl}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {connectionState !== "success" && connectionState !== "detecting" && (
          <div
            className={cn(
              "space-y-4 transition-all duration-700 delay-200 ease-out",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <div>
              <label className="block text-sm font-medium mb-2">
                Gateway URL
              </label>
              <input
                type="text"
                value={gatewayUrl}
                onChange={(e) => onGatewayUrlChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ws://localhost:18789"
                autoFocus
                className={cn(
                  "w-full px-4 py-3 rounded-lg border bg-muted/30 focus:outline-none focus:ring-2 transition-all",
                  connectionState === "error"
                    ? "border-red-500/50 focus:ring-red-500/50"
                    : "border-border focus:ring-primary/50"
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Authentication Token{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                        aria-label="Token info"
                      >
                        ?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="font-medium mb-1">When do I need this?</p>
                      <p className="text-muted-foreground mb-2">
                        Required if your Gateway has authentication enabled (most setups do).
                      </p>
                      <p className="font-medium mb-1">Where do I find it?</p>
                      <p className="text-muted-foreground">
                        Check your Gateway config file or ask your admin. Run{" "}
                        <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                          clawdbot gateway status
                        </code>{" "}
                        to see if auth is enabled.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <input
                type="password"
                value={gatewayToken}
                onChange={(e) => onGatewayTokenChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Leave blank if not required"
                className="w-full px-4 py-3 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            {/* Error message */}
            {connectionState === "error" && errorMessage && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-red-600 dark:text-red-400">
                      Failed to connect: {errorMessage}
                    </p>
                    {errorHint && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {errorHint}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleTestConnection}
              disabled={connectionState === "testing" || !gatewayUrl.trim()}
              className={cn(
                "w-full px-6 py-4 rounded-lg font-semibold text-lg transition-all duration-200",
                connectionState === "testing"
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              {connectionState === "testing" ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  Testing Connection...
                </span>
              ) : (
                "Test Connection"
              )}
            </button>

            {/* Keyboard hint */}
            <p className="text-center text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd> to test
            </p>
          </div>
        )}

        {/* Actions */}
        <div
          className={cn(
            "flex items-center justify-between pt-4 transition-all duration-700 delay-400 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <button
            onClick={onBack}
            disabled={connectionState === "testing"}
            className={cn(
              "px-6 py-3 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors",
              connectionState === "testing" && "opacity-50 cursor-not-allowed"
            )}
          >
            ← Back
          </button>

          <button
            onClick={onSkip}
            disabled={connectionState === "testing"}
            className={cn(
              "text-sm text-muted-foreground hover:text-foreground transition-colors",
              connectionState === "testing" && "opacity-50 cursor-not-allowed"
            )}
          >
            I'll do this later
          </button>
        </div>
      </div>
    </div>
  );
}
