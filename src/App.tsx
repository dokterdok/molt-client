import { useEffect, useState, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { WelcomeView } from "./components/WelcomeView";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { useStore } from "./stores/store";
import { cn } from "./lib/utils";
import { ToastContainer, useToast } from "./components/ui/toast";
import { Spinner } from "./components/ui/spinner";
import { loadPersistedData } from "./lib/persistence";

// Check if running on macOS (for traffic light padding)
const isMacOS = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

// Exponential backoff delays: 5s → 10s → 30s → 60s (capped)
const BACKOFF_DELAYS = [5, 10, 30, 60];

// Result from the connect command
interface ConnectResult {
  success: boolean;
  used_url: string;
  protocol_switched: boolean;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [retryNowFn, setRetryNowFn] = useState<(() => void) | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [cancelConnection, setCancelConnection] = useState<(() => void) | null>(null);
  const { toasts, dismissToast, showError, showSuccess } = useToast();
  const { 
    currentConversation,
    connected,
    setConnected,
    appendToCurrentMessage,
    completeCurrentMessage,
    settings 
  } = useStore();
  
  // Refs for tracking state across async operations
  const isMountedRef = useRef(true);
  const connectionCancelledRef = useRef(false);
  // Track the URL we're currently connecting with to prevent re-triggers
  const lastAttemptedUrlRef = useRef<string | null>(null);

  // Check if this is first launch (onboarding needed)
  useEffect(() => {
    const APP_VERSION = "1.0.0"; // Should match package.json version
    const storedVersion = localStorage.getItem('molt-app-version');
    
    // Version upgrade: Clear stale onboarding flags
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log(`App upgraded from ${storedVersion} to ${APP_VERSION} - clearing stale onboarding data`);
      localStorage.removeItem('molt-onboarding-completed');
      localStorage.removeItem('molt-onboarding-skipped');
      localStorage.removeItem('molt-onboarding-progress');
    }
    
    // Store current version
    localStorage.setItem('molt-app-version', APP_VERSION);
    
    const loadData = async () => {
      try {
        // Load settings from localStorage + keychain
        await useStore.getState().loadSettings();
        
        // Load conversations from IndexedDB
        const { conversations } = await loadPersistedData();

        // Restore conversations to store
        if (conversations.length > 0) {
          useStore.setState({ conversations });
        }
      } catch (err) {
        console.error('Failed to load persisted data:', err);
        showError('Failed to load saved conversations');
      } finally {
        setIsLoadingData(false);
      }
    };

    // Check if onboarding is needed AFTER loading settings
    const checkOnboarding = async () => {
      await loadData();
      
      const onboardingCompleted = localStorage.getItem('molt-onboarding-completed');
      const onboardingSkipped = localStorage.getItem('molt-onboarding-skipped');
      const currentSettings = useStore.getState().settings;
      
      // Check if Gateway URL is actually configured (not empty, not just whitespace, valid format)
      const hasValidGatewayUrl = 
        currentSettings.gatewayUrl && 
        currentSettings.gatewayUrl.trim() !== "" &&
        (currentSettings.gatewayUrl.startsWith("ws://") || currentSettings.gatewayUrl.startsWith("wss://"));
      
      // ALWAYS show onboarding if Gateway URL is not configured
      // Otherwise, respect the onboarding completed/skipped flags
      const needsOnboarding = !hasValidGatewayUrl || (!onboardingCompleted && !onboardingSkipped);
      
      if (needsOnboarding) {
        console.log('Onboarding needed:', {
          completed: !!onboardingCompleted,
          skipped: !!onboardingSkipped,
          hasValidUrl: hasValidGatewayUrl,
          currentUrl: currentSettings.gatewayUrl
        });
        setShowOnboarding(true);
        setIsConnecting(false);
      }
    };

    checkOnboarding();
  }, [showError]);

  // Apply theme on mount and when settings change
  useEffect(() => {
    const applyTheme = () => {
      const isDark = 
        settings.theme === "dark" || 
        (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (settings.theme === "system") applyTheme();
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [settings.theme]);

  // Keyboard shortcut for sidebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + \ to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // Escape to close sidebar on mobile
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  // Connect to Gateway on mount (skip during onboarding or if no URL configured)
  useEffect(() => {
    // Reset mounted ref
    isMountedRef.current = true;
    
    // Don't attempt connection during onboarding
    if (showOnboarding) {
      setIsConnecting(false);
      return;
    }
    
    // Don't attempt connection if no Gateway URL is configured
    if (!settings.gatewayUrl || settings.gatewayUrl.trim() === '') {
      setIsConnecting(false);
      setShowOnboarding(true); // Force onboarding if no URL
      return;
    }
    
    // Prevent re-triggering if we just updated the URL due to protocol switch
    // This avoids an infinite loop when protocol_switched updates the URL
    if (lastAttemptedUrlRef.current === settings.gatewayUrl) {
      return;
    }

    let reconnectTimer: number | undefined;
    let countdownInterval: number | undefined;
    let connectingFlag = false;
    let attempts = 0;

    const clearTimers = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (countdownInterval) clearInterval(countdownInterval);
      if (isMountedRef.current) {
        setRetryCountdown(null);
        setRetryNowFn(null);
        setCancelConnection(null);
      }
    };

    const connectToGateway = async () => {
      if (connectingFlag || connectionCancelledRef.current || !isMountedRef.current) return;
      connectingFlag = true;
      connectionCancelledRef.current = false;
      clearTimers();
      
      // Track which URL we're attempting
      lastAttemptedUrlRef.current = settings.gatewayUrl;
      
      if (isMountedRef.current) {
        setIsConnecting(true);
        setConnectionError(null);
        attempts++;
        setReconnectAttempts(attempts);
      }

      // Set up cancel function - this immediately updates UI even though
      // the Rust invoke can't be cancelled mid-flight
      const cancelFn = () => {
        connectionCancelledRef.current = true;
        connectingFlag = false;
        clearTimers();
        if (isMountedRef.current) {
          setIsConnecting(false);
          setConnectionError("Connection cancelled");
          setCancelConnection(null);
        }
      };
      if (isMountedRef.current) {
        setCancelConnection(() => cancelFn);
      }

      try {
        const result = await invoke<ConnectResult>("connect", { 
          url: settings.gatewayUrl, 
          token: settings.gatewayToken 
        });
        
        // Check if cancelled or unmounted during connection
        if (connectionCancelledRef.current || !isMountedRef.current) {
          return;
        }
        
        // If protocol was switched, update settings with the working URL
        // But mark it as the "last attempted" URL to prevent re-trigger
        if (result.protocol_switched) {
          lastAttemptedUrlRef.current = result.used_url;
          useStore.getState().updateSettings({ gatewayUrl: result.used_url });
        }
        
        // Fetch available models after connection (non-blocking)
        invoke<any[]>("get_models").then(models => {
          if (models && models.length > 0 && isMountedRef.current) {
            useStore.getState().setAvailableModels(models);
          }
        }).catch(err => {
          console.error("Failed to fetch models:", err);
        });
        
        if (isMountedRef.current) {
          setIsConnecting(false);
          setConnectionError(null);
          setCancelConnection(null);
          
          // Show success on reconnection (not initial)
          if (attempts > 1) {
            const protocolMsg = result.protocol_switched ? ` (using ${result.used_url.startsWith("wss://") ? "wss://" : "ws://"})` : "";
            showSuccess(`Reconnected to Gateway${protocolMsg}`);
            attempts = 0;
            setReconnectAttempts(0);
          }
        }
      } catch (err) {
        console.error("Failed to connect:", err);
        
        // Check if cancelled or unmounted
        if (connectionCancelledRef.current || !isMountedRef.current) {
          return;
        }
        
        const errorMessage = typeof err === 'string' ? err : 'Connection failed';
        setConnectionError(errorMessage);
        setIsConnecting(false);
        setCancelConnection(null);
        connectingFlag = false;
        
        // Calculate delay using exponential backoff: 5s → 10s → 30s → 60s (capped)
        const backoffIndex = Math.min(attempts - 1, BACKOFF_DELAYS.length - 1);
        const delaySeconds = BACKOFF_DELAYS[backoffIndex];
        
        // Start countdown
        let countdown = delaySeconds;
        if (isMountedRef.current) {
          setRetryCountdown(countdown);
        }
        
        // Create retry now function
        const retryNow = () => {
          clearTimers();
          connectingFlag = false;
          connectionCancelledRef.current = false;
          if (isMountedRef.current) {
            setConnectionError(null);
          }
          connectToGateway();
        };
        if (isMountedRef.current) {
          setRetryNowFn(() => retryNow);
        }
        
        // Update countdown every second
        countdownInterval = window.setInterval(() => {
          if (!isMountedRef.current || connectionCancelledRef.current) {
            clearTimers();
            return;
          }
          countdown--;
          if (countdown <= 0) {
            clearTimers();
            connectingFlag = false;
            connectToGateway();
          } else {
            setRetryCountdown(countdown);
          }
        }, 1000);
      }
    };

    connectToGateway();

    return () => {
      isMountedRef.current = false;
      connectionCancelledRef.current = true;
      clearTimers();
    };
  }, [settings.gatewayUrl, settings.gatewayToken, showSuccess, showOnboarding]);

  // Listen for Gateway events
  useEffect(() => {
    let reconnectTimer: number | undefined;
    let countdownInterval: number | undefined;
    let disconnectAttempts = 0;
    let eventListenerMounted = true;

    const clearTimers = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (countdownInterval) clearInterval(countdownInterval);
    };

    const unlisten = Promise.all([
      listen("gateway:connected", async () => {
        if (!eventListenerMounted) return;
        setConnected(true);
        setIsConnecting(false);
        setRetryCountdown(null);
        setRetryNowFn(null);
        disconnectAttempts = 0;
        // Fetch models on connection (non-blocking)
        invoke<any[]>("get_models").then(models => {
          if (models && models.length > 0 && eventListenerMounted) {
            useStore.getState().setAvailableModels(models);
          }
        }).catch(err => {
          console.error("Failed to fetch models:", err);
        });
      }),
      listen("gateway:disconnected", () => {
        if (!eventListenerMounted) return;
        setConnected(false);
        setConnectionError("Connection to Gateway lost");
        clearTimers();
        
        // No toast spam - the header bar shows the status
        // Start reconnect with exponential backoff
        disconnectAttempts++;
        setReconnectAttempts(disconnectAttempts);
        
        const backoffIndex = Math.min(disconnectAttempts - 1, BACKOFF_DELAYS.length - 1);
        const delaySeconds = BACKOFF_DELAYS[backoffIndex];
        
        let countdown = delaySeconds;
        setRetryCountdown(countdown);
        
        const attemptReconnect = async () => {
          if (!eventListenerMounted) return;
          clearTimers();
          setRetryCountdown(null);
          setIsConnecting(true);
          setConnectionError(null);
          
          try {
            const result = await invoke<ConnectResult>("connect", { 
              url: settings.gatewayUrl, 
              token: settings.gatewayToken 
            });
            
            if (!eventListenerMounted) return;
            
            // If protocol was switched, update settings with the working URL
            if (result.protocol_switched) {
              lastAttemptedUrlRef.current = result.used_url;
              useStore.getState().updateSettings({ gatewayUrl: result.used_url });
            }
            
            setConnectionError(null);
            if (!showOnboarding) {
              const protocolMsg = result.protocol_switched ? ` (using ${result.used_url.startsWith("wss://") ? "wss://" : "ws://"})` : "";
              showSuccess(`Reconnected to Gateway${protocolMsg}`);
            }
            disconnectAttempts = 0;
          } catch (err) {
            if (!eventListenerMounted) return;
            console.error("Reconnection failed:", err);
            const errorMessage = typeof err === 'string' ? err : 'Reconnection failed';
            setConnectionError(errorMessage);
            setIsConnecting(false);
            // Schedule next retry with backoff
            disconnectAttempts++;
            setReconnectAttempts(disconnectAttempts);
            const nextBackoffIndex = Math.min(disconnectAttempts - 1, BACKOFF_DELAYS.length - 1);
            const nextDelaySeconds = BACKOFF_DELAYS[nextBackoffIndex];
            
            let nextCountdown = nextDelaySeconds;
            setRetryCountdown(nextCountdown);
            
            setRetryNowFn(() => attemptReconnect);
            
            countdownInterval = window.setInterval(() => {
              if (!eventListenerMounted) {
                clearTimers();
                return;
              }
              nextCountdown--;
              if (nextCountdown <= 0) {
                clearTimers();
                attemptReconnect();
              } else {
                setRetryCountdown(nextCountdown);
              }
            }, 1000);
          }
        };
        
        setRetryNowFn(() => attemptReconnect);
        
        countdownInterval = window.setInterval(() => {
          if (!eventListenerMounted) {
            clearTimers();
            return;
          }
          countdown--;
          if (countdown <= 0) {
            clearTimers();
            attemptReconnect();
          } else {
            setRetryCountdown(countdown);
          }
        }, 1000);
      }),
      listen<string>("gateway:stream", (event) => {
        if (!eventListenerMounted) return;
        appendToCurrentMessage(event.payload);
      }),
      listen("gateway:complete", () => {
        if (!eventListenerMounted) return;
        completeCurrentMessage();
      }),
    ]);

    return () => {
      eventListenerMounted = false;
      clearTimers();
      unlisten.then((listeners) => {
        listeners.forEach((fn) => fn());
      });
    };
  }, [setConnected, appendToCurrentMessage, completeCurrentMessage, settings.gatewayUrl, settings.gatewayToken, showOnboarding, showSuccess]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Clear progress
    localStorage.removeItem('molt-onboarding-progress');
    // Trigger a connection attempt with new settings
    setIsConnecting(true);
  };

  const handleRerunSetup = () => {
    // Clear onboarding flags to trigger setup again
    localStorage.removeItem('molt-onboarding-completed');
    localStorage.removeItem('molt-onboarding-skipped');
    localStorage.removeItem('molt-onboarding-progress');
    setShowOnboarding(true);
  };

  // Show onboarding flow if needed
  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "border-r border-border transition-all duration-300 ease-in-out flex-shrink-0",
          "fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto",
          sidebarOpen ? "w-64" : "w-0 -translate-x-full lg:translate-x-0"
        )}
      >
        <div 
          id="sidebar"
          className={cn(
            "w-64 h-full transition-opacity duration-200 bg-background",
            sidebarOpen ? "opacity-100" : "opacity-0 lg:opacity-0"
          )}
          role="navigation"
          aria-label="Conversation sidebar"
        >
          <Sidebar 
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            onRerunSetup={handleRerunSetup}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Reconnection banner */}
        {!connected && !isConnecting && (
          <div 
            className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-2 text-amber-700 dark:text-amber-300 text-sm animate-in slide-in-from-top-2 duration-300"
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="relative flex w-2 h-2 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
              </span>
              <span className="font-medium flex-shrink-0">Offline Mode</span>
              {retryCountdown !== null ? (
                <>
                  <span className="hidden sm:inline truncate">— Retry in {retryCountdown}s</span>
                  <span className="sm:hidden">— {retryCountdown}s</span>
                </>
              ) : connectionError ? (
                <span className="hidden sm:inline truncate text-xs">— {connectionError.split('\n')[0]}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {retryNowFn && (
                <button
                  onClick={retryNowFn}
                  className="px-2 py-0.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Header - draggable on macOS */}
        <header 
          className={cn(
            "h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0",
            isMacOS && "pt-2"
          )}
          data-tauri-drag-region
        >
          <div 
            className={cn(
              "flex items-center gap-2",
              isMacOS && !sidebarOpen && "pl-[70px]"
            )}
            data-tauri-drag-region
          >
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              title={sidebarOpen ? "Hide sidebar (⌘\\)" : "Show sidebar (⌘\\)"}
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              aria-expanded={sidebarOpen}
              aria-controls="sidebar"
            >
              <svg
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  !sidebarOpen && "rotate-180"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="font-semibold truncate select-none" data-tauri-drag-region>
              {currentConversation?.title || "Molt"}
            </h1>
          </div>
          
          {/* Connection status */}
          <div className="flex items-center gap-2" data-tauri-drag-region>
            {isConnecting ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm animate-in fade-in duration-200" data-tauri-drag-region>
                <Spinner size="sm" />
                <span className="hidden sm:inline select-none" data-tauri-drag-region>
                  {reconnectAttempts > 1 ? `Reconnecting (${reconnectAttempts})...` : "Connecting..."}
                </span>
              </div>
            ) : !connected ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm animate-in fade-in duration-200" data-tauri-drag-region>
                <span className="relative flex w-2 h-2" data-tauri-drag-region>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
                </span>
                {retryCountdown !== null ? (
                  <>
                    <span className="hidden sm:inline select-none" data-tauri-drag-region>
                      Reconnecting in {retryCountdown}s...
                    </span>
                    <span className="sm:hidden select-none" data-tauri-drag-region>{retryCountdown}s</span>
                    {retryNowFn && (
                      <button
                        onClick={retryNowFn}
                        className="px-2 py-0.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </>
                ) : (
                  <span className="hidden sm:inline select-none" data-tauri-drag-region>Reconnecting...</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm animate-in fade-in duration-200" title="Connected to Gateway" data-tauri-drag-region>
                <span className="w-2 h-2 bg-green-500 rounded-full" data-tauri-drag-region />
                <span className="hidden sm:inline select-none" data-tauri-drag-region>Connected</span>
              </div>
            )}
          </div>
        </header>

        {/* Chat or Welcome */}
        <div className="flex-1 min-h-0 relative">
          {currentConversation ? <ChatView /> : <WelcomeView />}
          
          {/* Data loading overlay */}
          {isLoadingData && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50 animate-in fade-in duration-300">
              <Spinner size="lg" />
              <div className="text-center">
                <p className="text-sm font-medium mb-1">Loading conversations</p>
                <p className="text-xs text-muted-foreground">Decrypting data...</p>
              </div>
            </div>
          )}
          
          {/* Initial connection loading overlay */}
          {!isLoadingData && isConnecting && reconnectAttempts === 1 && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-40 animate-in fade-in duration-300">
              <Spinner size="lg" />
              <div className="text-center max-w-md px-4">
                <p className="text-sm font-medium mb-1">Connecting to Gateway</p>
                <p className="text-xs text-muted-foreground mb-4">Please wait...</p>
                {cancelConnection && (
                  <button
                    onClick={cancelConnection}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Connection error overlay */}
          {!isLoadingData && !isConnecting && connectionError && reconnectAttempts === 1 && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-40 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-center max-w-md px-4">
                <p className="text-sm font-medium mb-2">Connection Failed</p>
                <p className="text-xs text-muted-foreground mb-4 whitespace-pre-line">{connectionError}</p>
                <div className="flex gap-2 justify-center">
                  {retryNowFn && (
                    <button
                      onClick={retryNowFn}
                      className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Retry Now
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setConnectionError(null);
                      setIsConnecting(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Use Offline Mode
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
