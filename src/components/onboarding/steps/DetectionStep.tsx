import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../../../lib/utils";
import { Spinner } from "../../ui/spinner";

interface DetectionStepProps {
  onGatewayFound: (url: string) => void;
  onNoGateway: () => void;
  onSkip: () => void;
}

interface ConnectResult {
  success: boolean;
  used_url: string;
  protocol_switched: boolean;
}

export function DetectionStep({ onGatewayFound, onNoGateway, onSkip }: DetectionStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [foundUrl, setFoundUrl] = useState<string | null>(null); // NEW: Hold found URL for confirmation
  
  // Track mounted state to prevent updates after unmount
  const isMountedRef = useRef(true);
  // Track if detection was cancelled
  const isCancelledRef = useRef(false);
  // Track if detection has already run to prevent double-execution
  const hasRunRef = useRef(false);

  const autoDetectGateway = useCallback(async () => {
    // Prevent running twice
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;
    
    setError(null);
    
    const commonUrls = [
      "ws://localhost:18789",
      "ws://127.0.0.1:18789",
      "ws://localhost:8789",
      "wss://localhost:18789",
    ];

    // Global timeout for entire detection (30 seconds max)
    const globalTimeout = setTimeout(() => {
      if (!isCancelledRef.current && isMountedRef.current) {
        isCancelledRef.current = true;
        onNoGateway();
      }
    }, 30000);

    try {
      for (let i = 0; i < commonUrls.length; i++) {
        // Check if cancelled or unmounted before each attempt
        if (isCancelledRef.current || !isMountedRef.current) {
          clearTimeout(globalTimeout);
          return;
        }
        
        const url = commonUrls[i];
        setCurrentUrl(url);
        setProgress(((i + 1) / commonUrls.length) * 100);
        
        try {
          const result = await invoke<ConnectResult>("connect", { url, token: "" });
          
          // Check again after async operation
          if (isCancelledRef.current || !isMountedRef.current) {
            clearTimeout(globalTimeout);
            return;
          }
          
          // Success! Gateway found - but don't auto-proceed, let user confirm
          clearTimeout(globalTimeout);
          
          if (isCancelledRef.current || !isMountedRef.current) {
            return;
          }
          
          // Show confirmation UI instead of auto-proceeding
          setFoundUrl(result.used_url);
          return;
        } catch {
          // Check before delay
          if (isCancelledRef.current || !isMountedRef.current) {
            clearTimeout(globalTimeout);
            return;
          }
          // Try next URL with a short delay
          await new Promise(resolve => setTimeout(resolve, 300));
          continue;
        }
      }

      clearTimeout(globalTimeout);
      
      // Check before calling onNoGateway
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }

      // No Gateway found after checking all URLs
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (isCancelledRef.current || !isMountedRef.current) {
        return;
      }
      
      onNoGateway();
    } catch (err) {
      clearTimeout(globalTimeout);
      console.error('[DetectionStep] Unexpected error:', err);
      if (!isCancelledRef.current && isMountedRef.current) {
        setError(String(err));
        onNoGateway();
      }
    }
  }, [onNoGateway]);

  useEffect(() => {
    // Reset mounted/cancelled state on mount
    isMountedRef.current = true;
    isCancelledRef.current = false;
    // Don't reset hasRunRef here - it prevents double execution
    
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsVisible(true);
      }
    }, 100);
    
    // Only run if not already run
    if (!hasRunRef.current) {
      autoDetectGateway();
    }
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [autoDetectGateway]);

  // Handle skip - cancel detection and call onSkip
  const handleSkip = useCallback(() => {
    isCancelledRef.current = true;
    onSkip();
  }, [onSkip]);

  // Handler for confirming the found URL
  const handleConfirmUrl = useCallback(() => {
    if (foundUrl) {
      onGatewayFound(foundUrl);
    }
  }, [foundUrl, onGatewayFound]);

  // Handler for entering URL manually instead
  const handleEnterManually = useCallback(() => {
    onSkip();
  }, [onSkip]);

  // If we found a Gateway, show confirmation UI
  if (foundUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-xl w-full space-y-8">
          {/* Success header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 shadow-xl shadow-green-500/20 mb-6">
              <svg
                className="w-10 h-10 text-white"
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
            <h2 className="text-4xl font-bold mb-3">Gateway Found!</h2>
            <p className="text-lg text-muted-foreground">
              We detected a Gateway at:
            </p>
          </div>

          {/* Found URL display */}
          <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
            <p className="font-mono text-lg text-green-600 dark:text-green-400">
              {foundUrl}
            </p>
          </div>

          {/* Confirmation question */}
          <div className="text-center">
            <p className="text-muted-foreground mb-6">
              Is this the Gateway you want to connect to?
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleConfirmUrl}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Yes, connect to this Gateway
              </button>
              <button
                onClick={handleEnterManually}
                className="px-6 py-3 rounded-xl border border-border bg-background hover:bg-muted font-medium transition-all duration-200"
              >
                No, enter URL manually
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: scanning UI
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-xl shadow-blue-500/20 mb-6 animate-pulse">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h2 className="text-4xl font-bold mb-3">Looking for Gateway...</h2>
          <p className="text-lg text-muted-foreground">
            Checking common ports for a Gateway
          </p>
        </div>

        {/* Progress card */}
        <div
          className={cn(
            "p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-4 transition-all duration-700 delay-200 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <div className="flex-1">
              <p className="font-medium text-blue-600 dark:text-blue-400">
                Auto-detecting...
              </p>
              <p className="text-sm text-muted-foreground font-mono">
                {currentUrl || "Scanning..."}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Info */}
        <div
          className={cn(
            "text-center space-y-2 transition-all duration-700 delay-400 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <p className="text-sm text-muted-foreground">
            This usually takes just a few seconds
          </p>
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Skip auto-detection
          </button>
        </div>
      </div>
    </div>
  );
}
