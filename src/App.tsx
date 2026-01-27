import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { WelcomeView } from "./components/WelcomeView";
import { useStore } from "./stores/store";
import { cn } from "./lib/utils";
import { ToastContainer, useToast } from "./components/ui/toast";
import { Spinner } from "./components/ui/spinner";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { toasts, dismissToast, showError, showSuccess, showWarning } = useToast();
  const { 
    currentConversation,
    connected,
    setConnected,
    appendToCurrentMessage,
    completeCurrentMessage,
    settings 
  } = useStore();

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

  // Connect to Gateway on mount
  useEffect(() => {
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
        
        // Show error on first attempt only
        if (attempts === 1) {
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
  }, [settings.gatewayUrl, settings.gatewayToken, showError, showSuccess]);

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
        showWarning("Connection lost. Attempting to reconnect...");
        // Auto-reconnect after 5 seconds
        setTimeout(async () => {
          setIsConnecting(true);
          try {
            await invoke("connect", { 
              url: settings.gatewayUrl, 
              token: settings.gatewayToken 
            });
            showSuccess("Reconnected to Gateway");
          } catch (err) {
            console.error("Reconnection failed:", err);
            setIsConnecting(false);
            showError("Reconnection failed. Will retry...");
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
        
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
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
            <h1 className="font-semibold truncate">
              {currentConversation?.title || "Molt"}
            </h1>
          </div>
          
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {isConnecting ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm animate-in fade-in duration-200">
                <Spinner size="sm" />
                <span className="hidden sm:inline">
                  {reconnectAttempts > 1 ? `Reconnecting (${reconnectAttempts})...` : "Connecting..."}
                </span>
              </div>
            ) : !connected ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm animate-in fade-in duration-200">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
                </span>
                <span className="hidden sm:inline">Reconnecting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm animate-in fade-in duration-200" title="Connected to Gateway">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="hidden sm:inline">Connected</span>
              </div>
            )}
          </div>
        </header>

        {/* Chat or Welcome */}
        <div className="flex-1 min-h-0 relative">
          {currentConversation ? <ChatView /> : <WelcomeView />}
          
          {/* Initial connection loading overlay */}
          {isConnecting && reconnectAttempts === 1 && (
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
