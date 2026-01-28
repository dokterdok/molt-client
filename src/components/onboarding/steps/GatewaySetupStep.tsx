import React, { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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

type ConnectionState = "idle" | "detecting" | "testing" | "success" | "error" | "cancelled";

// Detect URL type for context-specific troubleshooting
function detectUrlType(url: string): "tailscale" | "local" | "lan" | "remote" {
  const lower = url.toLowerCase();
  if (lower.includes(".ts.net") || lower.includes("tailscale")) {
    return "tailscale";
  }
  if (lower.includes("localhost") || lower.includes("127.0.0.1") || lower.includes("::1")) {
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
      command: "tailscale status"
    },
    {
      title: "Verify Gateway binds to Tailscale",
      description: "Gateway config should have bind: \"tailnet\" or bind: \"lan\"",
      command: "clawdbot config get gateway.bind"
    },
    {
      title: "Check firewall rules",
      description: "Port 18789 must be accessible on the Gateway machine"
    },
    {
      title: "Ping the Gateway host",
      description: "Test basic connectivity to the Tailscale hostname",
      command: "ping your-host.ts.net"
    }
  ];
}

function getLanTips(): TroubleshootingTip[] {
  return [
    {
      title: "Check Gateway is running",
      description: "Gateway must be running and accessible on the network",
      command: "clawdbot gateway status"
    },
    {
      title: "Verify Gateway binds to LAN",
      description: "Gateway config should have bind: \"lan\" (not \"loopback\")",
      command: "clawdbot config get gateway.bind"
    },
    {
      title: "Check firewall",
      description: "Port 18789 must be open for incoming connections"
    }
  ];
}

// Derive a helpful hint and actionable fix based on error content
function getErrorHint(errorStr: string, url: string): { 
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
  
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return {
      hint: "The authentication token is wrong or missing.",
      action: "Where to find your token",
      command: "clawdbot gateway status",
      tips,
      urlType
    };
  }
  if (lower.includes("400") || lower.includes("bad request")) {
    return {
      hint: "The URL format looks incorrect.",
      action: "Should start with ws:// or wss://",
      tips,
      urlType
    };
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return {
      hint: "The Gateway endpoint was not found.",
      action: "Try the default: ws://localhost:18789",
      tips,
      urlType
    };
  }
  if (lower.includes("connection refused") || lower.includes("econnrefused")) {
    const baseHint = urlType === "tailscale" 
      ? "Can't connect to Tailscale Gateway. It may not be running or not bound to Tailscale."
      : urlType === "lan"
      ? "Can't connect to LAN Gateway. It may not be running or bound to loopback only."
      : "Gateway is not running or not reachable.";
    return {
      hint: baseHint,
      action: "Start Gateway with",
      command: "clawdbot gateway start",
      tips,
      urlType
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    const baseHint = urlType === "tailscale"
      ? "Connection timed out. Check that Tailscale is connected on both devices."
      : "Connection timed out — Gateway may be down.";
    return {
      hint: baseHint,
      action: "Check Gateway status",
      command: "clawdbot gateway status",
      tips,
      urlType
    };
  }
  if (lower.includes("network") || lower.includes("dns") || lower.includes("resolve")) {
    const baseHint = urlType === "tailscale"
      ? "Can't resolve Tailscale hostname. Make sure Tailscale is running."
      : "Can't reach the Gateway server.";
    return {
      hint: baseHint,
      action: urlType === "tailscale" ? "Check Tailscale status" : "Check your network connection",
      command: urlType === "tailscale" ? "tailscale status" : undefined,
      tips,
      urlType
    };
  }
  
  return {
    hint: "Gateway connection failed.",
    action: "Make sure Gateway is running",
    command: "clawdbot gateway start",
    tips,
    urlType
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
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
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
        localStorage.setItem('moltzer-onboarding-progress', JSON.stringify({
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

  // Listen for gateway errors during testing
  useEffect(() => {
    if (connectionState !== "testing") return;
    
    let unlistenState: UnlistenFn | undefined;
    let unlistenError: UnlistenFn | undefined;
    
    const setupListeners = async () => {
      // Listen for state changes (e.g., Failed state)
      unlistenState = await listen<{ reason?: string; can_retry?: boolean }>("gateway:state", (event) => {
        const payload = event.payload as { reason?: string } | string;
        if (typeof payload === "object" && payload.reason) {
          // Failed state
          if (isMountedRef.current && connectionState === "testing") {
            setConnectionState("error");
            setErrorMessage(payload.reason);
            setErrorHint(getErrorHint(payload.reason, gatewayUrl));
          }
        }
      });
      
      // Listen for explicit errors
      unlistenError = await listen<string>("gateway:error", (event) => {
        if (isMountedRef.current && connectionState === "testing") {
          setConnectionState("error");
          const errMsg = typeof event.payload === "string" ? event.payload : "Connection error";
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

    // Frontend timeout failsafe (8 seconds max)
    const CONNECT_TIMEOUT_MS = 8000;
    
    try {
      await invoke("disconnect");
      
      // Check if cancelled
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }
      
      // Race between connect and timeout
      const connectPromise = invoke<ConnectResult>("connect", { url: trimmedUrl, token: trimmedToken });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Connection timed out after 8 seconds")), CONNECT_TIMEOUT_MS);
      });
      
      const result = await Promise.race([connectPromise, timeoutPromise]);
      
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
      localStorage.setItem('moltzer-onboarding-progress', JSON.stringify({
        step: 'setup-complete',
        gatewayUrl: actualUrl,
        timestamp: Date.now()
      }));

      // Fetch models (but don't block on it)
      invoke<ModelInfo[]>("get_models").then(models => {
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
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="ml-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors"
                        aria-label="Token info"
                      >
                        What's this?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm p-4">
                      <p className="font-semibold mb-2">🔑 Authentication Token</p>
                      <p className="text-muted-foreground mb-3">
                        Most Moltbot Gateways require a token to connect. If you get a 401/403 error, you need this.
                      </p>
                      <p className="font-medium mb-1">Where to find it:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 mb-3">
                        <li>• Run <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">clawdbot gateway status</code></li>
                        <li>• Check your <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">clawdbot.json</code> config</li>
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
                              if (errorHint.command) {
                                await navigator.clipboard.writeText(errorHint.command);
                              }
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

                {/* Smart troubleshooting tips */}
                {errorHint?.tips && errorHint.tips.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-red-500/20">
                    <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      {errorHint.urlType === "tailscale" ? "Tailscale Troubleshooting" : "Troubleshooting Tips"}
                    </p>
                    <div className="space-y-3">
                      {errorHint.tips.map((tip, i) => (
                        <div key={i} className="pl-2 border-l-2 border-red-500/30">
                          <p className="text-sm font-medium text-foreground">{tip.title}</p>
                          <p className="text-xs text-muted-foreground">{tip.description}</p>
                          {tip.command && (
                            <div className="flex items-center gap-2 mt-1.5 bg-black/80 dark:bg-black/60 rounded p-1.5 font-mono text-[11px] text-green-400">
                              <code className="flex-1">{tip.command}</code>
                              <button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(tip.command || "");
                                  } catch (e) {
                                    console.error("Failed to copy:", e);
                                  }
                                }}
                                className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[9px] font-medium text-white transition-colors"
                              >
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                if (connectionState === "testing") {
                  // Cancel the test
                  isCancelledRef.current = true;
                  setConnectionState("idle");
                } else {
                  handleTestConnection();
                }
              }}
              disabled={!gatewayUrl.trim() && connectionState !== "testing"}
              onMouseEnter={() => setIsButtonHovered(true)}
              onMouseLeave={() => setIsButtonHovered(false)}
              className={cn(
                "w-full px-6 py-4 rounded-lg font-semibold text-lg transition-all duration-200",
                connectionState === "testing"
                  ? isButtonHovered
                    ? "bg-red-500 text-white cursor-pointer hover:bg-red-600"
                    : "bg-muted text-muted-foreground cursor-pointer"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              {connectionState === "testing" ? (
                isButtonHovered ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Testing Connection...
                  </span>
                )
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
