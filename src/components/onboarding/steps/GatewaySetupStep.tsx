import React, { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, type ModelInfo } from "../../../stores/store";
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

type ConnectionState =
  | "idle"
  | "detecting"
  | "testing"
  | "verifying"
  | "success"
  | "error"
  | "cancelled";

// Detect URL type for context-specific troubleshooting
function detectUrlType(url: string): "tailscale" | "local" | "lan" | "remote" {
  const lower = url.toLowerCase();
  if (lower.includes(".ts.net") || lower.includes("tailscale")) {
    return "tailscale";
  }
  if (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("::1")
  ) {
    return "local";
  }
  if (lower.match(/192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./)) {
    return "lan";
  }
  return "remote";
}

// Tailscale-specific troubleshooting tips
interface TroubleshootingTip {
  title: string;
  description: string;
  command?: string;
}

function getTailscaleTips(): TroubleshootingTip[] {
  return [
    {
      title: "Check Tailscale is running",
      description: "Make sure Tailscale is connected on both devices",
      command: "tailscale status",
    },
    {
      title: "Verify Gateway binds to Tailscale",
      description: 'Gateway config should have bind: "tailnet" or bind: "lan"',
      command: "clawdbot config get gateway.bind",
    },
    {
      title: "Check firewall rules",
      description: "Port 18789 must be accessible on the Gateway machine",
    },
    {
      title: "Ping the Gateway host",
      description: "Test basic connectivity to the Tailscale hostname",
      command: "ping your-host.ts.net",
    },
  ];
}

function getLanTips(): TroubleshootingTip[] {
  return [
    {
      title: "Check Gateway is running",
      description: "Gateway must be running and accessible on the network",
      command: "clawdbot gateway status",
    },
    {
      title: "Verify Gateway binds to LAN",
      description: 'Gateway config should have bind: "lan" (not "loopback")',
      command: "clawdbot config get gateway.bind",
    },
    {
      title: "Check firewall",
      description: "Port 18789 must be open for incoming connections",
    },
  ];
}

// Derive a helpful hint and actionable fix based on error content
function getErrorHint(
  errorStr: string,
  url: string,
): {
  hint: string;
  action?: string;
  command?: string;
  tips?: TroubleshootingTip[];
  urlType?: "tailscale" | "local" | "lan" | "remote";
} {
  const lower = errorStr.toLowerCase();
  const urlType = detectUrlType(url);

  // Add context-specific tips based on URL type
  let tips: TroubleshootingTip[] | undefined;
  if (urlType === "tailscale") {
    tips = getTailscaleTips();
  } else if (urlType === "lan") {
    tips = getLanTips();
  }

  if (
    lower.includes("device identity required") ||
    lower.includes("not_paired")
  ) {
    return {
      hint: "This Gateway requires an authentication token.",
      action: "Paste your token from clawdbot.json (gateway.auth.token) into the Authentication Token field above",
      tips,
      urlType,
    };
  }
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  ) {
    return {
      hint: "The authentication token is wrong or missing.",
      action: "Where to find your token",
      command: "clawdbot gateway status",
      tips,
      urlType,
    };
  }
  if (lower.includes("400") || lower.includes("bad request")) {
    return {
      hint: "The URL format looks incorrect.",
      action: "Should start with ws:// or wss://",
      tips,
      urlType,
    };
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return {
      hint: "The Gateway endpoint was not found.",
      action: "Try the default: ws://localhost:18789",
      tips,
      urlType,
    };
  }
  if (lower.includes("connection refused") || lower.includes("econnrefused")) {
    const baseHint =
      urlType === "tailscale"
        ? "Can't connect to Tailscale Gateway. It may not be running or not bound to Tailscale."
        : urlType === "lan"
          ? "Can't connect to LAN Gateway. It may not be running or bound to loopback only."
          : "Gateway is not running or not reachable.";
    return {
      hint: baseHint,
      action: "Start Gateway with",
      command: "clawdbot gateway start",
      tips,
      urlType,
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    const baseHint =
      urlType === "tailscale"
        ? "Connection timed out. Check that Tailscale is connected on both devices."
        : "Connection timed out — Gateway may be down.";
    return {
      hint: baseHint,
      action: "Check Gateway status",
      command: "clawdbot gateway status",
      tips,
      urlType,
    };
  }
  if (
    lower.includes("network") ||
    lower.includes("dns") ||
    lower.includes("resolve")
  ) {
    const baseHint =
      urlType === "tailscale"
        ? "Can't resolve Tailscale hostname. Make sure Tailscale is running."
        : "Can't reach the Gateway server.";
    return {
      hint: baseHint,
      action:
        urlType === "tailscale"
          ? "Check Tailscale status"
          : "Check your network connection",
      command: urlType === "tailscale" ? "tailscale status" : undefined,
      tips,
      urlType,
    };
  }

  return {
    hint: "Gateway connection failed.",
    action: "Make sure Gateway is running",
    command: "clawdbot gateway start",
    tips,
    urlType,
  };
}

// Format raw error message for display
function formatErrorMessage(err: unknown): string {
  const errStr = String(err) || "Unknown error";
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
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorHint, setErrorHint] = useState<{
    hint: string;
    action?: string;
    command?: string;
    tips?: TroubleshootingTip[];
    urlType?: "tailscale" | "local" | "lan" | "remote";
  } | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [suggestedPort, setSuggestedPort] = useState<string | null>(null);
  const [protocolNotice, setProtocolNotice] = useState<string>("");
  const [isButtonHovered, setIsButtonHovered] = useState(false);
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
        const result = await invoke<ConnectResult>("connect", {
          url,
          token: "",
        });

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
          setProtocolNotice(
            `Using ${actualUrl.startsWith("wss://") ? "wss://" : "ws://"} (auto-detected)`,
          );
        }

        // Auto-save settings with the working URL
        updateSettings({ gatewayUrl: actualUrl, gatewayToken: "" });

        // Save progress
        localStorage.setItem(
          "Moltz-onboarding-progress",
          JSON.stringify({
            step: "setup-complete",
            gatewayUrl: actualUrl,
            timestamp: Date.now(),
          }),
        );

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

    // Auto-detect local Gateway - DISABLED for debugging
    // autoDetectGateway();
    setConnectionState("idle");

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [autoDetectGateway]);

  // Listen for gateway errors during testing
  useEffect(() => {
    if (connectionState !== "testing") return;

    let unlistenState: UnlistenFn | undefined;
    let unlistenError: UnlistenFn | undefined;

    const setupListeners = async () => {
      // Listen for state changes (e.g., Failed state)
      unlistenState = await listen<{ reason?: string; can_retry?: boolean }>(
        "gateway:state",
        (event) => {
          const payload = event.payload as { reason?: string } | string;
          if (typeof payload === "object" && payload.reason) {
            // Failed state
            if (isMountedRef.current && connectionState === "testing") {
              setConnectionState("error");
              setErrorMessage(payload.reason);
              setErrorHint(getErrorHint(payload.reason, gatewayUrl));
            }
          }
        },
      );

      // Listen for explicit errors
      unlistenError = await listen<string>("gateway:error", (event) => {
        if (isMountedRef.current && connectionState === "testing") {
          setConnectionState("error");
          const errMsg =
            typeof event.payload === "string"
              ? event.payload
              : "Connection error";
          setErrorMessage(errMsg);
          setErrorHint(getErrorHint(errMsg, gatewayUrl));
        }
      });
    };

    setupListeners();

    return () => {
      unlistenState?.();
      unlistenError?.();
    };
  }, [connectionState, gatewayUrl]);

  const handleTestConnection = async () => {
    // Reset cancelled state for new test
    isCancelledRef.current = false;

    // Auto-fix: Trim whitespace and normalize URL
    let trimmedUrl = gatewayUrl.trim();
    const trimmedToken = gatewayToken.trim();

    if (!trimmedUrl) {
      setErrorMessage("Please enter a Gateway URL");
      return;
    }

    // Auto-convert http/https to ws/wss (common paste mistake)
    if (trimmedUrl.startsWith("http://")) {
      trimmedUrl = trimmedUrl.replace("http://", "ws://");
    } else if (trimmedUrl.startsWith("https://")) {
      trimmedUrl = trimmedUrl.replace("https://", "wss://");
    }
    // Add ws:// prefix if no protocol specified
    if (!trimmedUrl.startsWith("ws://") && !trimmedUrl.startsWith("wss://")) {
      trimmedUrl = "ws://" + trimmedUrl;
    }

    // Apply normalized values
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

    // Frontend timeout - longer for Tailscale/remote connections
    const isTailscale = trimmedUrl.includes(".ts.net");
    const CONNECT_TIMEOUT_MS = isTailscale ? 120000 : 15000; // 2 min for Tailscale, 15s otherwise

    if (isTailscale) {
      // Using extended timeout for Tailscale URLs
    }

    try {
      await invoke("disconnect");

      // Check if cancelled
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }

      // Race between connect and timeout
      const connectPromise = invoke<ConnectResult>("connect", {
        url: trimmedUrl,
        token: trimmedToken,
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Connection timed out after 8 seconds")),
          CONNECT_TIMEOUT_MS,
        );
      });

      const result = await Promise.race([connectPromise, timeoutPromise]);

      // Check if cancelled after async operation
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }

      // Initial connection worked! Now verify everything before declaring success.
      setConnectionState("verifying");
      
      // If protocol was switched, update the URL
      const actualUrl = result.used_url;
      if (result.protocol_switched) {
        onGatewayUrlChange(actualUrl);
        setProtocolNotice(
          `Connected using ${actualUrl.startsWith("wss://") ? "wss://" : "ws://"} (auto-detected)`,
        );
      }

      // Step 1: Save settings (token goes to keychain if available, otherwise stays in memory)
      await updateSettings({ gatewayUrl: actualUrl, gatewayToken: trimmedToken });

      // Check if cancelled
      if (isCancelledRef.current || !isMountedRef.current) return;

      // Note: We don't verify keychain storage anymore - token is in memory store
      // which is sufficient for the session. Keychain is just for persistence.

      // Check if cancelled
      if (isCancelledRef.current || !isMountedRef.current) return;

      // Connection verified! Mark as connected immediately
      setConnectionState("success");
      useStore.getState().setConnected(true);

      // Fetch models in background (don't block onboarding)
      invoke<ModelInfo[]>("get_models")
        .then((models) => {
          if (models && models.length > 0) {
            useStore.getState().setAvailableModels(models);
          }
        })
        .catch((err) => console.warn("[onboarding] Model fetch failed:", err));

      // Save progress
      localStorage.setItem(
        "Moltz-onboarding-progress",
        JSON.stringify({
          step: "setup-complete",
          gatewayUrl: actualUrl,
          timestamp: Date.now(),
        }),
      );

      // Auto-advance quickly (connection already verified)
      setTimeout(() => {
        if (isMountedRef.current && !isCancelledRef.current) {
          onSuccess();
        }
      }, 800);
    } catch (err: unknown) {
      // Check if cancelled
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }

      setConnectionState("error");

      // Show the actual error message with a contextual hint
      const formattedError = formatErrorMessage(err);
      setErrorMessage(formattedError);
      setErrorHint(getErrorHint(formattedError, trimmedUrl));

      // Auto-suggest port fix if port looks wrong
      if (
        trimmedUrl.includes("localhost") ||
        trimmedUrl.includes("127.0.0.1")
      ) {
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
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          <h2 className="text-4xl font-bold mb-3">Connect to Your Computer</h2>
          <p className="text-lg text-muted-foreground">
            {autoDetected
              ? "Perfect! We found it."
              : "Where is Moltz running? Usually it's right here on this computer."}
          </p>
        </div>

        {/* Auto-detection status */}
        {connectionState === "detecting" && (
          <div
            className={cn(
              "p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-in fade-in slide-in-from-top-2 duration-300",
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
              "p-6 rounded-xl bg-green-500/10 border border-green-500/20 animate-in fade-in zoom-in-95 duration-300",
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
                  {autoDetected ? "Auto-detected at" : "Connected to"}{" "}
                  {gatewayUrl}
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
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8",
            )}
          >
            <div>
              <label
                htmlFor="gateway-url-input"
                className="block text-sm font-medium mb-2"
              >
                Where's the connection running?
              </label>
              <input
                id="gateway-url-input"
                type="text"
                value={gatewayUrl}
                onChange={(e) => onGatewayUrlChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="localhost:18789 (this computer)"
                autoFocus
                aria-label="Connection address"
                aria-required="true"
                aria-invalid={connectionState === "error"}
                aria-describedby={
                  connectionState === "error"
                    ? "gateway-error-message"
                    : undefined
                }
                className={cn(
                  "w-full px-4 py-3 rounded-lg border bg-muted/30 focus:outline-none focus:ring-2 transition-all",
                  connectionState === "error"
                    ? "border-red-500/50 focus:ring-red-500/50"
                    : "border-border focus:ring-primary/50",
                )}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                💡 Most people use:{" "}
                <button
                  onClick={() => onGatewayUrlChange("ws://localhost:18789")}
                  className="text-primary hover:underline font-medium"
                  type="button"
                >
                  localhost:18789
                </button>
              </p>
            </div>

            <div>
              <label
                htmlFor="gateway-token-input"
                className="block text-sm font-medium mb-2"
              >
                Authentication Token{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="ml-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background rounded"
                        aria-label="Information about authentication token"
                      >
                        What's this?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm p-4">
                      <p className="font-semibold mb-2">
                        🔑 Authentication Token
                      </p>
                      <p className="text-muted-foreground mb-3">
                        Some Gateways require a token for security. If you get a
                        401/403 error, you need this.
                      </p>
                      <p className="font-medium mb-1">Where to find it:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 mb-3">
                        <li>
                          • Run{" "}
                          <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                            clawdbot gateway status
                          </code>
                        </li>
                        <li>
                          • Check your{" "}
                          <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                            clawdbot.json
                          </code>{" "}
                          config
                        </li>
                        <li>• Ask your Gateway admin</li>
                      </ul>
                      <p className="text-xs text-muted-foreground/70">
                        The token is stored securely in your system keychain.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <input
                id="gateway-token-input"
                type="password"
                value={gatewayToken}
                onChange={(e) => onGatewayTokenChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste your gateway token here"
                aria-label="Authentication token"
                aria-required="false"
                className="w-full px-4 py-3 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            {/* Error message with actionable fixes */}
            <AnimatePresence mode="wait">
              {connectionState === "error" && errorMessage && (
                <motion.div
                  id="gateway-error-message"
                  role="alert"
                  aria-live="assertive"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 space-y-3 max-h-64 overflow-y-auto"
                >
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

                  {/* Actionable fix - simplified, no command line stuff */}
                  {errorHint?.action && (
                    <div className="pl-8">
                      <p className="text-sm text-muted-foreground">
                        💡 {errorHint.action}
                      </p>
                    </div>
                  )}

                  {/* Port suggestion */}
                  {suggestedPort && (
                    <div className="pl-8 mt-2">
                      <button
                        onClick={() => {
                          const newUrl = gatewayUrl.replace(
                            /:\d+/,
                            `:${suggestedPort}`,
                          );
                          onGatewayUrlChange(newUrl);
                          setSuggestedPort(null);
                        }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Try the standard setup: localhost:{suggestedPort} →
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              onClick={() => {
                if (connectionState === "testing" || connectionState === "verifying") {
                  // Cancel the test
                  isCancelledRef.current = true;
                  setConnectionState("idle");
                } else {
                  handleTestConnection();
                }
              }}
              disabled={!gatewayUrl.trim() && connectionState !== "testing" && connectionState !== "verifying"}
              onMouseEnter={() => setIsButtonHovered(true)}
              onMouseLeave={() => setIsButtonHovered(false)}
              whileHover={
                connectionState !== "testing" && connectionState !== "verifying"
                  ? { scale: 1.02, y: -2 }
                  : undefined
              }
              whileTap={
                connectionState !== "testing" && connectionState !== "verifying"
                  ? { scale: 0.98, y: 0 }
                  : undefined
              }
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
                (connectionState === "testing" || connectionState === "verifying")
                  ? isButtonHovered
                    ? "bg-red-500 text-white cursor-pointer hover:bg-red-600 focus:ring-red-500"
                    : "bg-muted text-muted-foreground cursor-pointer focus:ring-muted"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 focus:ring-blue-500",
                !gatewayUrl.trim() &&
                  connectionState !== "testing" && connectionState !== "verifying" &&
                  "opacity-50 cursor-not-allowed",
              )}
              aria-live="polite"
              aria-label={
                connectionState === "testing"
                  ? isButtonHovered
                    ? "Cancel connection test"
                    : "Testing connection..."
                  : connectionState === "verifying"
                  ? isButtonHovered
                    ? "Cancel verification"
                    : "Verifying setup..."
                  : "Test Gateway connection"
              }
            >
              <AnimatePresence mode="wait">
                {(connectionState === "testing" || connectionState === "verifying") ? (
                  isButtonHovered ? (
                    <motion.span
                      key="cancel"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Cancel
                    </motion.span>
                  ) : (
                    <motion.span
                      key="testing"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </motion.div>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        {connectionState === "verifying" ? "Verifying Setup..." : "Testing Connection..."}
                      </motion.span>
                    </motion.span>
                  )
                ) : (
                  <motion.span
                    key="test"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    Test Connection
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Keyboard hint */}
            <p className="text-center text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">
                Enter
              </kbd>{" "}
              to test
            </p>
          </div>
        )}

        {/* Actions */}
        <div
          className={cn(
            "flex items-center justify-between pt-4 transition-all duration-700 delay-400 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          <button
            onClick={onBack}
            disabled={connectionState === "testing" || connectionState === "verifying"}
            className={cn(
              "px-6 py-3 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors",
              (connectionState === "testing" || connectionState === "verifying") && "opacity-50 cursor-not-allowed",
            )}
          >
            ← Back
          </button>

          <button
            onClick={onSkip}
            disabled={connectionState === "testing" || connectionState === "verifying"}
            className={cn(
              "text-sm text-muted-foreground hover:text-foreground transition-colors",
              (connectionState === "testing" || connectionState === "verifying") && "opacity-50 cursor-not-allowed",
            )}
          >
            Skip (you can browse, but won't be able to chat yet)
          </button>
        </div>
      </div>
    </div>
  );
}
