import { useEffect, useState } from "react";
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

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { toasts, dismissToast, showError, showSuccess, showWarning } = useToast();
  const { 
    currentConversation,
    connected,
    setConnected,
    appendToCurrentMessage,
    completeCurrentMessage,
    settings 
  } = useStore();

  // Check if this is first launch (onboarding needed)
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('molt-onboarding-completed');
    const onboardingSkipped = localStorage.getItem('molt-onboarding-skipped');
    const hasSettings = localStorage.getItem('molt-settings');
    
    // Show onboarding if never completed and no settings configured
    if (!onboardingCompleted && !onboardingSkipped && !hasSettings) {
      setShowOnboarding(true);
      setIsLoadingData(false);
      setIsConnecting(false);
      return;
    }
    
    // Otherwise, load normally
    const loadData = async () => {
      try {
        const { conversations } = await loadPersistedData();
        
        // Load settings from localStorage (not encrypted)
        const savedSettings = localStorage.getItem('molt-settings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          useStore.getState().updateSettings(parsedSettings);
        }

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

    loadData();
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

  // Connect to Gateway on mount (skip during onboarding)
  useEffect(() => {
    // Don't attempt connection during onboarding
    if (showOnboarding) {
      setIsConnecting(false);
      return;
    }

    let reconnectTimer: number | undefined;
    let connectingFlag = false;
    let attempts = 0;

    const connectToGateway = async () => {
      if (connectingFlag) return;
      connectingFlag = true;
      setIsConnecting(true);
      attempts++;
      setReconnectAttempts(attempts);

      try {
        await invoke("connect", { 
          url: settings.gatewayUrl, 
          token: settings.gatewayToken 
        });
        // Fetch available models after connection
        try {
          const models = await invoke<any[]>("get_models");
          if (models && models.length > 0) {
            useStore.getState().setAvailableModels(models);
          }
        } catch (err) {
          console.error("Failed to fetch models:", err);
        }
        setIsConnecting(false);
        
        // Show success on reconnection (not initial)
        if (attempts > 1) {
          showSuccess("Reconnected to Gateway");
          attempts = 0;
          setReconnectAttempts(0);
        }
      } catch (err) {
        console.error("Failed to connect:", err);
        setIsConnecting(false);
        
        // Show error on first attempt only (not during onboarding)
        if (attempts === 1 && !showOnboarding) {
          showError("Failed to connect to Gateway. Retrying...");
        }
        
        // Retry connection with exponential backoff (max 30s)
        const delay = Math.min(5000 * Math.pow(1.5, Math.min(attempts - 1, 4)), 30000);
        reconnectTimer = window.setTimeout(() => {
          connectingFlag = false;
          connectToGateway();
        }, delay);
      } finally {
        connectingFlag = false;
      }
    };

    connectToGateway();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [settings.gatewayUrl, settings.gatewayToken, showError, showSuccess, showOnboarding]);

  // Listen for Gateway events
  useEffect(() => {
    const unlisten = Promise.all([
      listen("gateway:connected", async () => {
        setConnected(true);
        setIsConnecting(false);
        // Fetch models on connection
        try {
          const models = await invoke<any[]>("get_models");
          if (models && models.length > 0) {
            useStore.getState().setAvailableModels(models);
          }
        } catch (err) {
          console.error("Failed to fetch models:", err);
        }
      }),
      listen("gateway:disconnected", () => {
        setConnected(false);
        // Suppress toasts during onboarding
        if (!showOnboarding) {
          showWarning("Connection lost. Attempting to reconnect...");
        }
        // Auto-reconnect after 5 seconds
        setTimeout(async () => {
          setIsConnecting(true);
          try {
            await invoke("connect", { 
              url: settings.gatewayUrl, 
              token: settings.gatewayToken 
            });
            if (!showOnboarding) {
              showSuccess("Reconnected to Gateway");
            }
          } catch (err) {
            console.error("Reconnection failed:", err);
            setIsConnecting(false);
            if (!showOnboarding) {
              showError("Reconnection failed. Will retry...");
            }
          }
        }, 5000);
      }),
      listen<string>("gateway:stream", (event) => {
        appendToCurrentMessage(event.payload);
      }),
      listen("gateway:complete", () => {
        completeCurrentMessage();
      }),
    ]);

    return () => {
      unlisten.then((listeners) => {
        listeners.forEach((fn) => fn());
      });
    };
  }, [setConnected, appendToCurrentMessage, completeCurrentMessage, settings.gatewayUrl, settings.gatewayToken]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Trigger a connection attempt with new settings
    setIsConnecting(true);
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
          <Sidebar onToggle={() => setSidebarOpen(!sidebarOpen)} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Reconnection banner */}
        {!connected && !isConnecting && (
          <div 
            className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-amber-700 dark:text-amber-300 text-sm animate-in slide-in-from-top-2 duration-300"
            role="alert"
            aria-live="polite"
          >
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
            </span>
            <span className="font-medium">Connection lost</span>
            <span className="hidden sm:inline">— Attempting to reconnect to Gateway...</span>
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
                <span className="hidden sm:inline select-none" data-tauri-drag-region>Reconnecting...</span>
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
              <div className="text-center">
                <p className="text-sm font-medium mb-1">Connecting to Gateway</p>
                <p className="text-xs text-muted-foreground">Please wait...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
