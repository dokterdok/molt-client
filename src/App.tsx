import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { WelcomeView } from "./components/WelcomeView";
import { useStore } from "./stores/store";
import { cn } from "./lib/utils";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const { 
    currentConversation, 
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

  // Connect to Gateway on mount
  useEffect(() => {
    let reconnectTimer: number | undefined;
    let connectingFlag = false;

    const connectToGateway = async () => {
      if (connectingFlag) return;
      connectingFlag = true;
      setIsConnecting(true);

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
      } catch (err) {
        console.error("Failed to connect:", err);
        setIsConnecting(false);
        // Retry connection after 5 seconds
        reconnectTimer = window.setTimeout(() => {
          connectingFlag = false;
          connectToGateway();
        }, 5000);
      } finally {
        connectingFlag = false;
      }
    };

    connectToGateway();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [settings.gatewayUrl, settings.gatewayToken]);

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
        // Auto-reconnect after 5 seconds
        setTimeout(async () => {
          setIsConnecting(true);
          try {
            await invoke("connect", { 
              url: settings.gatewayUrl, 
              token: settings.gatewayToken 
            });
          } catch (err) {
            console.error("Reconnection failed:", err);
            setIsConnecting(false);
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "border-r border-border transition-all duration-300 ease-in-out flex-shrink-0",
          sidebarOpen ? "w-64" : "w-0"
        )}
      >
        <div className={cn(
          "w-64 h-full transition-opacity duration-200",
          sidebarOpen ? "opacity-100" : "opacity-0"
        )}>
          <Sidebar onToggle={() => setSidebarOpen(!sidebarOpen)} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title={sidebarOpen ? "Hide sidebar (⌘\\)" : "Show sidebar (⌘\\)"}
            >
              <svg
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  !sidebarOpen && "rotate-180"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="hidden sm:inline">Connecting...</span>
              </div>
            ) : !connected ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm animate-in fade-in duration-200">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
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
        <div className="flex-1 min-h-0">
          {currentConversation ? <ChatView /> : <WelcomeView />}
        </div>
      </div>
    </div>
  );
}
