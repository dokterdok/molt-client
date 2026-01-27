import { useEffect, useState } from "react";
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

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
    autoDetectGateway();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoDetectGateway = async () => {
    const commonUrls = [
      "ws://localhost:18789",
      "ws://127.0.0.1:18789",
      "ws://localhost:8789",
      "wss://localhost:18789",
    ];

    for (let i = 0; i < commonUrls.length; i++) {
      const url = commonUrls[i];
      setCurrentUrl(url);
      setProgress(((i + 1) / commonUrls.length) * 100);
      
      try {
        const result = await invoke<ConnectResult>("connect", { url, token: "" });
        // Success! Gateway found
        await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause to show success
        onGatewayFound(result.used_url);
        return;
      } catch {
        // Try next URL
        await new Promise(resolve => setTimeout(resolve, 400)); // Delay between attempts
        continue;
      }
    }

    // No Gateway found after checking all URLs
    await new Promise(resolve => setTimeout(resolve, 500));
    onNoGateway();
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
            Checking common ports for Clawdbot Gateway
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
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Skip auto-detection
          </button>
        </div>
      </div>
    </div>
  );
}
