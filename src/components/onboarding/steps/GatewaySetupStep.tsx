import React, { useEffect, useState, useRef, useCallback } from "react";
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
  /** If true, skip auto-detection (we already tried in DetectionStep) */
  skipAutoDetect?: boolean;
}

// Result from the connect command
interface ConnectResult {
  success: boolean;
  used_url: string;
  protocol_switched: boolean;
}

type ConnectionState = "idle" | "detecting" | "testing" | "success" | "error" | "cancelled";

// Derive a helpful hint and actionable fix based on error content
function getErrorHint(errorStr: string): { hint: string; action?: string; command?: string } {
  const lower = errorStr.toLowerCase();
  
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return {
      hint: "The authentication token is wrong or missing.",
      action: "Where to find your token",
      command: "clawdbot gateway status"
    };
  }
  if (lower.includes("400") || lower.includes("bad request")) {
    return {
      hint: "The URL format looks incorrect.",
      action: "Should start with ws:// or wss://"
    };
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return {
      hint: "The Gateway endpoint was not found.",
      action: "Try the default: ws://localhost:18789"
    };
  }
  if (lower.includes("connection refused") || lower.includes("econnrefused")) {
    return {
      hint: "Gateway is not running or not reachable.",
      action: "Start Gateway with",
      command: "clawdbot gateway start"
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return {
      hint: "Connection timed out — Gateway may be down.",
      action: "Check Gateway status",
      command: "clawdbot gateway status"
    };
  }
  if (lower.includes("network") || lower.includes("dns") || lower.includes("resolve")) {
    return {
      hint: "Can't reach the Gateway server.",
      action: "Check your network connection or firewall settings"
    };
  }
  
  return {
    hint: "Gateway connection failed.",
    action: "Make sure Gateway is running",
    command: "clawdbot gateway start"
  };
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
  skipAutoDetect = false,
}: GatewaySetupStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorHint, setErrorHint] = useState<{ hint: string; action?: string; command?: string } | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [suggestedPort, setSuggestedPort] = useState<string | null>(null);
  const [protocolNotice, setProtocolNotice] = useState<string>("");
  const { updateSettings } = useStore();
  
  // Track mounted state and cancellation
  const isMountedRef = useRef(true);
  const isCancelledRef = useRef(false);

  const autoDetectGateway = useCallback(async () => {
    // Skip if coming from detection flow (already tried)
    if (skipAutoDetect) {
      setConnectionState("idle");
      return;
    }
    
    setConnectionState("detecting");
    setErrorMessage("");
    setErrorHint(null);
    setProtocolNotice("");
    setSuggestedPort(null);
    
    const commonUrls = [
      "ws://localhost:18789",
      "ws://127.0.0.1:18789",
      "ws://localhost:8789",
    ];

    for (const url of commonUrls) {
      // Check if cancelled or unmounted
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }
      
      try {
        const result = await invoke<ConnectResult>("connect", { url, token: "" });
        
        // Check again after async operation
        if (isCancelledRef.current || !isMountedRef.current) {
          return;
        }
        
        // Success! Gateway found
        const actualUrl = result.used_url;
        onGatewayUrlChange(actualUrl);
        setAutoDetected(true);
        setConnectionState("success");
        
        // Show protocol notice if it switched
        if (result.protocol_switched) {
          setProtocolNotice(`Using ${actualUrl.startsWith("wss://") ? "wss://" : "ws://"} (auto-detected)`);
        }
        
        // Auto-save settings with the working URL
        updateSettings({ gatewayUrl: actualUrl, gatewayToken: "" });
        
        // Save progress
        localStorage.setItem('molt-onboarding-progress', JSON.stringify({
          step: 'setup-complete',
          gatewayUrl: actualUrl,
          timestamp: Date.now()
        }));
        
        // Auto-advance after a moment (if still mounted)
        setTimeout(() => {
          if (isMountedRef.current && !isCancelledRef.current) {
            onSuccess();
          }
        }, 1500);
        return;
      } catch {
        // Try next URL
        continue;
      }
    }

    // No Gateway found (if still mounted)
    if (isMountedRef.current && !isCancelledRef.current) {
      setConnectionState("idle");
    }
  }, [skipAutoDetect, onGatewayUrlChange, updateSettings, onSuccess]);

  useEffect(() => {
    // Reset refs on mount
    isMountedRef.current = true;
    isCancelledRef.current = false;
    
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsVisible(true);
      }
    }, 100);
    
    // Auto-detect local Gateway
    autoDetectGateway();
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [autoDetectGateway]);

  // Cancel any ongoing connection test
  const handleCancel = useCallback(() => {
    isCancelledRef.current = true;
    setConnectionState("idle");
    setErrorMessage("");
    setErrorHint(null);
  }, []);

  const handleTestConnection = async () => {
    // Reset cancelled state for new test
    isCancelledRef.current = false;
    
    // Auto-fix: Trim whitespace from inputs
    const trimmedUrl = gatewayUrl.trim();
    const trimmedToken = gatewayToken.trim();
    
    if (!trimmedUrl) {
      setErrorMessage("Please enter a Gateway URL");
      return;
    }

    // Apply trimmed values
    if (trimmedUrl !== gatewayUrl) {
      onGatewayUrlChange(trimmedUrl);
    }
    if (trimmedToken !== gatewayToken) {
      onGatewayTokenChange(trimmedToken);
    }

    setConnectionState("testing");
    setErrorMessage("");
    setErrorHint(null);
    setProtocolNotice("");
    setSuggestedPort(null);

    try {
      await invoke("disconnect");
      
      // Check if cancelled
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }
      
      const result = await invoke<ConnectResult>("connect", { url: trimmedUrl, token: trimmedToken });
      
      // Check if cancelled after async operation
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }
      
      // Success!
      setConnectionState("success");
      
      // If protocol was switched, update the URL and show notice
      const actualUrl = result.used_url;
      if (result.protocol_switched) {
        onGatewayUrlChange(actualUrl);
        setProtocolNotice(`Connected using ${actualUrl.startsWith("wss://") ? "wss://" : "ws://"} (auto-detected)`);
      }
      
      updateSettings({ gatewayUrl: actualUrl, gatewayToken: trimmedToken });

      // Save progress (token NOT stored here - goes to keychain via updateSettings)
      localStorage.setItem('molt-onboarding-progress', JSON.stringify({
        step: 'setup-complete',
        gatewayUrl: actualUrl,
        timestamp: Date.now()
      }));

      // Fetch models (but don't block on it)
      invoke<any[]>("get_models").then(models => {
        if (models && models.length > 0 && isMountedRef.current) {
          useStore.getState().setAvailableModels(models);
        }
      }).catch(err => {
        console.error("Failed to fetch models:", err);
      });

      // Auto-advance (if still mounted and not cancelled)
      setTimeout(() => {
        if (isMountedRef.current && !isCancelledRef.current) {
          onSuccess();
        }
      }, 1500);
    } catch (err: any) {
      // Check if cancelled
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }
      
      setConnectionState("error");
      
      // Show the actual error message with a contextual hint
      const formattedError = formatErrorMessage(err);
      setErrorMessage(formattedError);
      setErrorHint(getErrorHint(formattedError));
      
      // Auto-suggest port fix if port looks wrong
      if (trimmedUrl.includes("localhost") || trimmedUrl.includes("127.0.0.1")) {
        const currentPort = trimmedUrl.match(/:(\d+)/)?.[1];
        if (currentPort && currentPort !== "18789" && currentPort !== "8789") {
          setSuggestedPort("18789");
        }
      }
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
                {protocolNotice && (
                  <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                    {protocolNotice}
                  </p>
                )}
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

            {/* Error message with actionable fixes */}
            {connectionState === "error" && errorMessage && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
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
                  <div className="flex-1">
                    <p className="font-medium text-red-600 dark:text-red-400">
                      {errorMessage}
                    </p>
                    {errorHint && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {errorHint.hint}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actionable fix */}
                {errorHint?.action && (
                  <div className="pl-8 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {errorHint.action}:
                    </p>
                    {errorHint.command && (
                      <div className="flex items-center gap-2 bg-black/80 dark:bg-black/60 rounded p-2 font-mono text-xs text-green-400">
                        <code className="flex-1">{errorHint.command}</code>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(errorHint.command!);
                            } catch (err) {
                              console.error("Failed to copy:", err);
                            }
                          }}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] font-medium text-white transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Port suggestion */}
                {suggestedPort && (
                  <div className="pl-8">
                    <button
                      onClick={() => {
                        const newUrl = gatewayUrl.replace(/:\d+/, `:${suggestedPort}`);
                        onGatewayUrlChange(newUrl);
                        setSuggestedPort(null);
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Try default port {suggestedPort} instead? →
                    </button>
                  </div>
                )}
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
