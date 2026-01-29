import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { Window } from "@tauri-apps/api/window";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { UpdateNotification } from "./components/UpdateNotification";
import { useStore, type ModelInfo } from "./stores/store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "./lib/utils";
import { ToastContainer, useToast } from "./components/ui/toast";
import { Spinner } from "./components/ui/spinner";
import { loadPersistedData } from "./lib/persistence";
import { translateError, getErrorTitle } from "./lib/errors";

// Lazy load main app components for better initial load time
// These will be preloaded during onboarding
const Sidebar = lazy(() =>
  import("./components/Sidebar").then((module) => ({
    default: module.Sidebar,
  })),
);
const ChatView = lazy(() =>
  import("./components/ChatView").then((module) => ({
    default: module.ChatView,
  })),
);
const WelcomeView = lazy(() =>
  import("./components/WelcomeView").then((module) => ({
    default: module.WelcomeView,
  })),
);

// Check if running on macOS (for traffic light padding)
const isMacOS =
  typeof navigator !== "undefined" &&
  navigator.platform.toLowerCase().includes("mac");

// Exponential backoff delays: 5s → 10s → 30s → 60s (capped)
const BACKOFF_DELAYS = [5, 10, 30, 60];

// Result from the connect command
interface ConnectResult {
  success: boolean;
  used_url: string;
  protocol_switched: boolean;
}

// Check if onboarding is needed BEFORE rendering (prevents UI flash)
function checkOnboardingNeeded(): boolean {
  const onboardingCompleted = localStorage.getItem(
    "moltz-onboarding-completed",
  );
  const onboardingSkipped = localStorage.getItem("moltz-onboarding-skipped");

  // If completed or skipped, no onboarding needed
  if (onboardingCompleted || onboardingSkipped) {
    return false;
  }

  // Otherwise, onboarding is needed
  return true;
}

// Check if running in Tauri (desktop app) vs browser
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Browser-only download prompt component (no hooks)
function BrowserDownloadPrompt() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 shadow-xl shadow-orange-500/30">
          <span className="text-5xl">🦞</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Moltz Desktop App Required
        </h1>
        <p className="text-gray-600 text-lg">
          Moltz is a desktop application that runs locally on your computer for
          maximum privacy and speed.
        </p>
        <p className="text-gray-500">
          Please download and install the Moltz app to get started.
        </p>
        <a
          href="https://moltz.app/download"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          Download Moltz
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}

// Main app component with all hooks (only renders in Tauri)
function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  // Initialize showOnboarding immediately to prevent flash
  const [showOnboarding, setShowOnboarding] = useState(() =>
    checkOnboardingNeeded(),
  );
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [retryNowFn, setRetryNowFn] = useState<(() => void) | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [cancelConnection, setCancelConnection] = useState<(() => void) | null>(
    null,
  );
  const [hasUpdateDismissed, setHasUpdateDismissed] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { toasts, dismissToast, showError, showSuccess } = useToast();
  // PERF: Use selective subscriptions with shallow equality to prevent unnecessary re-renders
  const {
    currentConversationId,
    conversations,
    connected,
    setConnected,
    appendToCurrentMessage,
    completeCurrentMessage,
    settings,
    retryQueuedMessages,
    getQueuedMessagesCount,
  } = useStore(
    useShallow((state) => ({
      currentConversationId: state.currentConversationId,
      conversations: state.conversations,
      connected: state.connected,
      setConnected: state.setConnected,
      appendToCurrentMessage: state.appendToCurrentMessage,
      completeCurrentMessage: state.completeCurrentMessage,
      settings: state.settings,
      retryQueuedMessages: state.retryQueuedMessages,
      getQueuedMessagesCount: state.getQueuedMessagesCount,
    })),
  );
  
  // Derive currentConversation from id + conversations
  const currentConversation = currentConversationId 
    ? conversations.find(c => c.id === currentConversationId) || null 
    : null;

  // Refs for tracking state across async operations
  const isMountedRef = useRef(true);
  const connectionCancelledRef = useRef(false);
  // Track the URL we're currently connecting with to prevent re-triggers
  const lastAttemptedUrlRef = useRef<string | null>(null);

  // Load persisted data and validate onboarding status
  useEffect(() => {
    const APP_VERSION = "1.0.0"; // Should match package.json version
    const storedVersion = localStorage.getItem("moltz-app-version");

    // Version upgrade: Clear stale onboarding flags
    if (storedVersion && storedVersion !== APP_VERSION) {
      localStorage.removeItem("moltz-onboarding-completed");
      localStorage.removeItem("moltz-onboarding-skipped");
      localStorage.removeItem("moltz-onboarding-progress");
    }

    // Store current version
    localStorage.setItem("moltz-app-version", APP_VERSION);

    const loadData = async () => {
      try {
        // Load settings from localStorage + keychain
        await useStore.getState().loadSettings();

        // Set loading state for conversations
        useStore.getState().setConversationsLoading(true);

        // Load conversations from IndexedDB
        const { conversations } = await loadPersistedData();

        // Restore conversations to store (sorted by most recent)
        if (conversations.length > 0) {
          const sorted = [...conversations].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          
          // Check if this is first launch after onboarding or a returning user
          const hasLaunchedBefore = localStorage.getItem("moltz-has-launched");
          
          if (hasLaunchedBefore) {
            // Returning user: auto-select most recent conversation
            useStore.setState({ 
              conversations: sorted,
              currentConversationId: sorted[0].id,
            });
          } else {
            // First launch: show welcome screen, conversations parked in sidebar
            useStore.setState({ conversations: sorted });
            // Mark as launched for next time
            localStorage.setItem("moltz-has-launched", "true");
          }
        }
      } catch (err) {
        console.error("Failed to load persisted data:", err);
        showError("Failed to load saved conversations");
      } finally {
        useStore.getState().setConversationsLoading(false);
        setIsLoadingData(false);
      }
    };

    // Validate onboarding status after loading settings
    const validateOnboarding = async () => {
      await loadData();

      const currentSettings = useStore.getState().settings;

      // Check if Gateway URL is actually configured (not empty, not just whitespace, valid format)
      const hasValidGatewayUrl =
        currentSettings.gatewayUrl &&
        currentSettings.gatewayUrl.trim() !== "" &&
        (currentSettings.gatewayUrl.startsWith("ws://") ||
          currentSettings.gatewayUrl.startsWith("wss://"));

      // If no valid Gateway URL exists, force onboarding
      if (!hasValidGatewayUrl && !showOnboarding) {
        setShowOnboarding(true);
        setIsConnecting(false);
      }
    };

    validateOnboarding();
    // NOTE: showOnboarding intentionally REMOVED from dependencies.
    // This should only run on mount. When transitioning from onboarding
    // to main app, we don't want to reload settings because:
    // 1. Settings are already correct in Zustand state (set by updateSettings)
    // 2. Calling loadSettings would race with keychain save and potentially
    //    overwrite the token with an empty value before save completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  // Apply theme on mount and when settings change
  useEffect(() => {
    const applyTheme = () => {
      const isDark =
        settings.theme === "dark" ||
        (settings.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

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

    // CRITICAL: Don't attempt connection while settings are still loading
    // This prevents a race condition where connect is called before
    // the gateway token has been loaded from the keychain
    if (isLoadingData) {
      console.log("[connect] Waiting for settings to load...");
      return;
    }

    // Don't attempt connection if no Gateway URL is configured
    // BUT don't re-trigger onboarding if it was just completed (check localStorage)
    if (!settings.gatewayUrl || settings.gatewayUrl.trim() === "") {
      const justCompleted = localStorage.getItem("moltz-onboarding-completed");
      const justSkipped = localStorage.getItem("moltz-onboarding-skipped");
      if (!justCompleted && !justSkipped) {
        setIsConnecting(false);
        setShowOnboarding(true); // Force onboarding if no URL and not just completed
      }
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
      if (
        connectingFlag ||
        connectionCancelledRef.current ||
        !isMountedRef.current
      )
        return;
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
        // Debug: Log what we're sending to the gateway
        const tokenStatus = settings.gatewayToken
          ? `present (${settings.gatewayToken.length} chars)`
          : "EMPTY";
        console.log(
          `[connect] Attempting connection to ${settings.gatewayUrl}, token: ${tokenStatus}`,
        );

        const result = await invoke<ConnectResult>("connect", {
          url: settings.gatewayUrl,
          token: settings.gatewayToken,
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
        invoke<ModelInfo[]>("get_models")
          .then((models) => {
            if (models && models.length > 0 && isMountedRef.current) {
              useStore.getState().setAvailableModels(models);
            }
          })
          .catch((err) => {
            console.error("Failed to fetch models:", err);
          });

        if (isMountedRef.current) {
          setIsConnecting(false);
          setConnectionError(null);
          setCancelConnection(null);

          // Show success on reconnection (not initial)
          if (attempts > 1) {
            const protocolMsg = result.protocol_switched
              ? ` (using ${result.used_url.startsWith("wss://") ? "wss://" : "ws://"})`
              : "";
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

        const errorMessage =
          typeof err === "string" ? err : "Connection failed";
        setConnectionError(errorMessage);
        setIsConnecting(false);
        setCancelConnection(null);
        connectingFlag = false;

        // Detect auth errors and auto-open settings
        const lowerError = errorMessage.toLowerCase();
        if (
          lowerError.includes("unauthorized") ||
          lowerError.includes("authentication") ||
          lowerError.includes("token") ||
          lowerError.includes("forbidden")
        ) {
          // Auth error - open settings after a brief delay
          setTimeout(() => {
            if (isMountedRef.current) {
              setShowSettings(true);
            }
          }, 1500);
        }

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
  }, [
    settings.gatewayUrl,
    settings.gatewayToken,
    showSuccess,
    showOnboarding,
    isLoadingData,
  ]);

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
        invoke<ModelInfo[]>("get_models")
          .then((models) => {
            if (models && models.length > 0 && eventListenerMounted) {
              useStore.getState().setAvailableModels(models);
            }
          })
          .catch((err) => {
            console.error("Failed to fetch models:", err);
          });

        // Retry queued messages after successful reconnection
        try {
          await retryQueuedMessages();
        } catch (err) {
          console.error("Failed to retry queued messages:", err);
        }
      }),
      listen<string>("gateway:disconnected", (event) => {
        if (!eventListenerMounted) return;
        setConnected(false);
        // Capture the actual disconnect reason from the gateway
        const reason = event.payload || "Connection to Gateway lost";
        setConnectionError(reason);
        clearTimers();

        // No toast spam - the header bar shows the status
        // Start reconnect with exponential backoff
        disconnectAttempts++;
        setReconnectAttempts(disconnectAttempts);

        const backoffIndex = Math.min(
          disconnectAttempts - 1,
          BACKOFF_DELAYS.length - 1,
        );
        const delaySeconds = BACKOFF_DELAYS[backoffIndex];

        let countdown = delaySeconds;
        setRetryCountdown(countdown);

        const attemptReconnect = async () => {
          if (!eventListenerMounted) return;
          clearTimers();
          setRetryCountdown(null);
          setIsConnecting(true);
          setConnectionError(null);
          setErrorDismissed(false); // Reset so user can see new errors

          // CRITICAL: Get fresh settings from store, not stale closure values!
          // The event listener captures `settings` at setup time, but we need
          // the current values which may have been updated during onboarding.
          const currentSettings = useStore.getState().settings;

          try {
            const result = await invoke<ConnectResult>("connect", {
              url: currentSettings.gatewayUrl,
              token: currentSettings.gatewayToken,
            });

            if (!eventListenerMounted) return;

            // If protocol was switched, update settings with the working URL
            if (result.protocol_switched) {
              lastAttemptedUrlRef.current = result.used_url;
              useStore
                .getState()
                .updateSettings({ gatewayUrl: result.used_url });
            }

            setConnectionError(null);
            if (!showOnboarding) {
              const protocolMsg = result.protocol_switched
                ? ` (using ${result.used_url.startsWith("wss://") ? "wss://" : "ws://"})`
                : "";
              showSuccess(`Reconnected to Gateway${protocolMsg}`);
            }
            disconnectAttempts = 0;
          } catch (err) {
            if (!eventListenerMounted) return;
            console.error("Reconnection failed:", err);
            const errorMessage =
              typeof err === "string" ? err : "Reconnection failed";
            setConnectionError(errorMessage);
            setIsConnecting(false);
            // Schedule next retry with backoff
            disconnectAttempts++;
            setReconnectAttempts(disconnectAttempts);
            const nextBackoffIndex = Math.min(
              disconnectAttempts - 1,
              BACKOFF_DELAYS.length - 1,
            );
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
      listen<{
        usage?: { input?: number; output?: number; totalTokens?: number };
        stopReason?: string;
      }>("gateway:complete", (event) => {
        if (!eventListenerMounted) return;
        completeCurrentMessage(event.payload?.usage);
      }),
      // P1: Handle streaming errors and timeouts gracefully
      listen<{ runId: string; timeoutSecs: number }>(
        "gateway:stream_timeout",
        (event) => {
          if (!eventListenerMounted) return;
          console.error("Stream timeout:", event.payload);
          // Complete the current message with error indication
          const { currentConversation, currentStreamingMessageId } =
            useStore.getState();
          if (currentConversation && currentStreamingMessageId) {
            const message = currentConversation.messages.find(
              (m) => m.id === currentStreamingMessageId,
            );
            if (message) {
              // Append timeout notice to the message
              appendToCurrentMessage(
                `\n\n⚠️ *Stream timed out after ${event.payload.timeoutSecs} seconds*`,
              );
            }
          }
          completeCurrentMessage();
          showError(
            "Response timed out. The model may be experiencing issues.",
          );
        },
      ),
      listen<string>("gateway:error", (event) => {
        if (!eventListenerMounted) return;
        console.error("Gateway error during streaming:", event.payload);
        // Complete current message if streaming
        const { currentStreamingMessageId } = useStore.getState();
        if (currentStreamingMessageId) {
          appendToCurrentMessage(`\n\n⚠️ *Error: ${event.payload}*`);
          completeCurrentMessage();
        }
        showError(event.payload);
      }),
      listen("gateway:aborted", () => {
        if (!eventListenerMounted) return;
        // Stream aborted by user - silent cleanup
        // Complete current message cleanly
        const { currentStreamingMessageId } = useStore.getState();
        if (currentStreamingMessageId) {
          completeCurrentMessage();
        }
      }),
      // Listen for quick input submissions
      listen<{ message: string }>("quickinput:submit", (event) => {
        if (!eventListenerMounted) return;
        const { message } = event.payload;
        if (message) {
          // Create a new conversation with the message from quick input
          const { createConversation, selectConversation } =
            useStore.getState();

          // Create new conversation
          const newConv = createConversation();
          selectConversation(newConv.id);

          // Add the user message - the ChatView will detect and send it
          // We use a small delay to ensure the conversation is set
          setTimeout(() => {
            // Set the message in the input field via a custom event
            window.dispatchEvent(
              new CustomEvent("quickinput:setmessage", { detail: { message } }),
            );
          }, 100);
        }
      }),
      // Menu event listeners
      listen("menu:new_conversation", () => {
        if (!eventListenerMounted) return;
        const { createConversation, selectConversation } = useStore.getState();
        const newConv = createConversation();
        selectConversation(newConv.id);
      }),
      listen("menu:toggle_sidebar", () => {
        if (!eventListenerMounted) return;
        setSidebarOpen((prev) => !prev);
      }),
      listen("menu:search", () => {
        if (!eventListenerMounted) return;
        // Trigger search dialog via keyboard shortcut simulation
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            ctrlKey: true,
          }),
        );
      }),
      listen("menu:preferences", () => {
        if (!eventListenerMounted) return;
        // Trigger settings dialog via keyboard shortcut simulation
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: ",", metaKey: true }),
        );
      }),
      listen("menu:export", () => {
        if (!eventListenerMounted) return;
        // Trigger export dialog
        window.dispatchEvent(new CustomEvent("menu:open_export"));
      }),
    ]);

    // Register global shortcut for quick input (Cmd/Ctrl+Shift+Space)
    const shortcut = navigator.platform.includes("Mac")
      ? "Command+Shift+Space"
      : "Control+Shift+Space";
    register(shortcut, async () => {
      const quickInputWindow = new Window("quickinput");
      const isVisible = await quickInputWindow.isVisible();
      if (isVisible) {
        await quickInputWindow.hide();
      } else {
        await quickInputWindow.show();
        await quickInputWindow.setFocus();
      }
    }).catch((err) => {
      console.error("Failed to register global shortcut:", err);
    });

    return () => {
      eventListenerMounted = false;
      clearTimers();
      // Unregister global shortcut
      unregister(shortcut).catch(() => {});
      // Safely clean up event listeners (guard against double-cleanup in React Strict Mode)
      unlisten
        .then((listeners) => {
          listeners.forEach((fn) => {
            try {
              if (typeof fn === "function") fn();
            } catch {
              // Ignore cleanup errors (listener may already be removed)
            }
          });
        })
        .catch(() => {});
    };
  }, [
    setConnected,
    appendToCurrentMessage,
    completeCurrentMessage,
    settings.gatewayUrl,
    settings.gatewayToken,
    showOnboarding,
    showSuccess,
    retryQueuedMessages,
    showError,
  ]);

  // Preload heavy components during onboarding for smooth transition
  useEffect(() => {
    if (showOnboarding) {
      // Start preloading main app components in the background
      // This happens while user is completing onboarding steps
      const preloadTimer = setTimeout(() => {
        // Trigger lazy imports to start loading
        import("./components/Sidebar");
        import("./components/ChatView");
        import("./components/WelcomeView");
      }, 2000); // Start after 2s to let onboarding UI settle

      return () => clearTimeout(preloadTimer);
    }
  }, [showOnboarding]);

  const handleOnboardingComplete = () => {
    // Clear progress
    localStorage.removeItem("moltz-onboarding-progress");
    
    // NOTE: Don't call loadSettings() here! The GatewaySetupStep already
    // called updateSettings() which set the token in Zustand state AND
    // started the async keychain save. Calling loadSettings() would read
    // from keychain which might not have the new token yet (race condition).
    // The Zustand state already has the correct token.
    
    // Transition to main app
    setShowOnboarding(false);
    
    // Only trigger connection if not already connected (onboarding keeps connection alive)
    if (!useStore.getState().connected) {
      setIsConnecting(true);
    }
  };

  const handleRerunSetup = () => {
    // Clear onboarding flags to trigger setup again
    localStorage.removeItem("moltz-onboarding-completed");
    localStorage.removeItem("moltz-onboarding-skipped");
    localStorage.removeItem("moltz-onboarding-progress");
    setShowOnboarding(true);
  };

  // Show onboarding flow if needed
  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <UpdateNotification
        onUpdateDismissed={() => setHasUpdateDismissed(true)}
      />
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSidebarOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-label="Close sidebar"
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "border-r border-border transition-all duration-300 ease-in-out flex-shrink-0",
            "fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto",
            sidebarOpen ? "w-64" : "w-0 -translate-x-full lg:translate-x-0",
          )}
          role="complementary"
          aria-label="Conversation history and settings"
        >
          <div
            id="sidebar"
            className={cn(
              "w-64 h-full transition-opacity duration-200 bg-background",
              sidebarOpen ? "opacity-100" : "opacity-0 lg:opacity-0",
            )}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <Spinner size="md" />
                </div>
              }
            >
              <Sidebar
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                onRerunSetup={handleRerunSetup}
                hasUpdateAvailable={hasUpdateDismissed}
                forceShowSettings={showSettings}
                onSettingsClosed={() => setShowSettings(false)}
              />
            </Suspense>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Reconnection banner */}
          {!connected && !isConnecting && (
            <div
              className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-2 text-amber-700 dark:text-amber-300 text-sm animate-in slide-in-from-top-2 duration-300"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="relative flex w-2 h-2 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
                </span>
                <span className="font-medium flex-shrink-0">Offline Mode</span>
                {(() => {
                  const queuedCount = getQueuedMessagesCount();
                  if (queuedCount > 0) {
                    return (
                      <span className="hidden sm:inline truncate">
                        — {queuedCount} message{queuedCount > 1 ? "s" : ""}{" "}
                        queued
                      </span>
                    );
                  }
                  if (retryCountdown !== null) {
                    return (
                      <>
                        <span className="hidden sm:inline truncate">
                          — Retry in {retryCountdown}s
                        </span>
                        <span className="sm:hidden">— {retryCountdown}s</span>
                      </>
                    );
                  }
                  if (connectionError) {
                    return (
                      <span className="hidden sm:inline truncate text-xs">
                        — {getErrorTitle(connectionError)}
                      </span>
                    );
                  }
                  return null;
                })()}
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
              isMacOS && "pt-2",
            )}
            data-tauri-drag-region
          >
            <div
              className={cn(
                "flex items-center gap-2",
                isMacOS && !sidebarOpen && "pl-[70px]",
              )}
              data-tauri-drag-region
            >
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                title={
                  sidebarOpen ? "Hide sidebar (⌘\\)" : "Show sidebar (⌘\\)"
                }
                aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                aria-expanded={sidebarOpen}
                aria-controls="sidebar"
              >
                <svg
                  className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    !sidebarOpen && "rotate-180",
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
              <h1
                className="font-semibold text-sm truncate select-none"
                data-tauri-drag-region
              >
                {currentConversation?.title || "Moltz"}
              </h1>
            </div>

            {/* Connection status */}
            <div className="flex items-center gap-2" data-tauri-drag-region>
              {isConnecting ? (
                <div
                  className="flex items-center gap-2 text-muted-foreground text-sm animate-in fade-in duration-200"
                  data-tauri-drag-region
                >
                  <Spinner size="sm" />
                  <span
                    className="hidden sm:inline select-none"
                    data-tauri-drag-region
                  >
                    {reconnectAttempts > 1
                      ? `Reconnecting (${reconnectAttempts})...`
                      : "Connecting..."}
                  </span>
                </div>
              ) : !connected ? (
                <div
                  className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm animate-in fade-in duration-200"
                  data-tauri-drag-region
                >
                  <span
                    className="relative flex w-2 h-2"
                    data-tauri-drag-region
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
                  </span>
                  {retryCountdown !== null ? (
                    <>
                      <span
                        className="hidden sm:inline select-none"
                        data-tauri-drag-region
                      >
                        Reconnecting in {retryCountdown}s...
                      </span>
                      <span
                        className="sm:hidden select-none"
                        data-tauri-drag-region
                      >
                        {retryCountdown}s
                      </span>
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
                    <span
                      className="hidden sm:inline select-none"
                      data-tauri-drag-region
                    >
                      Reconnecting...
                    </span>
                  )}
                </div>
              ) : null /* Connected state shown in sidebar */}
            </div>
          </header>

          {/* Chat or Welcome */}
          <main id="main-content" className="flex-1 min-h-0 relative">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <Spinner size="lg" />
                </div>
              }
            >
              {currentConversation ? <ChatView /> : <WelcomeView />}
            </Suspense>

            {/* Data loading overlay */}
            {isLoadingData && (
              <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50 animate-in fade-in duration-300">
                <Spinner size="lg" />
                <div className="text-center">
                  <p className="text-sm font-medium mb-1">
                    Loading conversations
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Decrypting data...
                  </p>
                  {/* Screen reader announcement */}
                  <div role="status" aria-live="polite" className="sr-only">
                    Loading your conversations, please wait
                  </div>
                </div>
              </div>
            )}

            {/* Initial connection loading overlay */}
            {!isLoadingData && isConnecting && reconnectAttempts === 1 && (
              <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-40 animate-in fade-in duration-300">
                <Spinner size="lg" />
                <div className="text-center max-w-md px-4">
                  <p className="text-sm font-medium mb-1">
                    Connecting to Gateway
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Please wait...
                  </p>
                  {/* Screen reader announcement */}
                  <div role="status" aria-live="polite" className="sr-only">
                    Connecting to Gateway, please wait
                  </div>
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

            {/* Connection error overlay - dismissible */}
            {!isLoadingData &&
              !isConnecting &&
              connectionError &&
              reconnectAttempts === 1 &&
              !errorDismissed &&
              (() => {
                const friendlyError = translateError(connectionError);
                const isAuthError =
                  connectionError.toLowerCase().includes("unauthorized") ||
                  connectionError.toLowerCase().includes("authentication") ||
                  connectionError.toLowerCase().includes("token") ||
                  connectionError.toLowerCase().includes("forbidden");

                return (
                  <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-40 animate-in fade-in duration-300">
                    {/* Close button */}
                    <button
                      onClick={() => setErrorDismissed(true)}
                      className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                      title="Dismiss and continue offline"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    <div
                      className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center mb-2",
                        isAuthError ? "bg-amber-500/10" : "bg-destructive/10",
                      )}
                    >
                      <svg
                        className={cn(
                          "w-8 h-8",
                          isAuthError
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-destructive",
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        {isAuthError ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        )}
                      </svg>
                    </div>
                    <div className="text-center max-w-md px-4">
                      <p className="text-sm font-medium mb-2">
                        {friendlyError.title}
                      </p>
                      <p className="text-xs text-muted-foreground mb-1">
                        {friendlyError.message}
                      </p>
                      {friendlyError.suggestion && (
                        <p className="text-xs text-muted-foreground/70 mb-4">
                          {friendlyError.suggestion}
                        </p>
                      )}
                      <div className="flex gap-2 justify-center mt-4">
                        {isAuthError && (
                          <button
                            onClick={() => {
                              setErrorDismissed(true);
                              setShowSettings(true);
                            }}
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Open Settings
                          </button>
                        )}
                        {retryNowFn && !isAuthError && (
                          <button
                            onClick={retryNowFn}
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Retry Now
                          </button>
                        )}
                        <button
                          onClick={() => setErrorDismissed(true)}
                          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                          Continue Offline
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </main>
        </div>
      </div>
    </>
  );
}

// Wrapper component that checks for Tauri before rendering hooks
export default function App() {
  // Block browser access - only allow Tauri client
  if (!isTauri) {
    return <BrowserDownloadPrompt />;
  }
  return <AppContent />;
}
