import { useState, useEffect, useCallback } from "react";
import { useStore, ModelInfo } from "../stores/store";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Switch } from "./ui/switch";
import { Skeleton } from "./ui/skeleton";
import { useToast } from "./ui/toast";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onRerunSetup?: () => void;
}

// Result from the connect command
interface ConnectResult {
  success: boolean;
  used_url: string;
  protocol_switched: boolean;
}

// Fallback models when Gateway doesn't provide a list
const FALLBACK_MODELS: ModelInfo[] = [
  { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "anthropic" },
  { id: "anthropic/claude-opus-4-5", name: "Claude Opus 4.5", provider: "anthropic" },
  { id: "anthropic/claude-haiku-4", name: "Claude Haiku 4", provider: "anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini", provider: "openai" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google" },
];

export function SettingsDialog({ open, onClose, onRerunSetup }: SettingsDialogProps) {
  const { settings, updateSettings, connected, setConnected, availableModels, setAvailableModels, modelsLoading, setModelsLoading } = useStore();
  const { showSuccess, showError: showToastError } = useToast();
  const [formData, setFormData] = useState(settings);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [protocolNotice, setProtocolNotice] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Only sync form data when dialog opens, not when settings reference changes
  // This prevents reverting edits when the store updates during typing
  useEffect(() => {
    if (open) {
      setFormData(settings);
      setShowToken(false);
      setUrlError(null);
      setError(null);
      setProtocolNotice(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Fetch models callback
  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const models = await invoke<ModelInfo[]>("get_models");
      if (models && models.length > 0) {
        setAvailableModels(models);
      }
    } catch {
      // Could not fetch models from Gateway, using fallbacks
    } finally {
      setModelsLoading(false);
    }
  }, [setModelsLoading, setAvailableModels]);

  // Fetch models when dialog opens and connected
  useEffect(() => {
    if (open && connected) {
      fetchModels();
    }
  }, [open, connected, fetchModels]);

  // Validate URL and suggest wss:// for non-localhost
  const validateUrl = (url: string): string | null => {
    if (!url.trim()) {
      return "Gateway URL is required";
    }
    
    try {
      // Check if it's a valid WebSocket URL
      if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
        return "URL must start with ws:// or wss://";
      }
      
      // Parse URL to check validity
      const urlObj = new URL(url);
      
      // Suggest wss:// for non-localhost URLs (security best practice)
      if (url.startsWith("ws://") && !urlObj.hostname.match(/^(localhost|127\.0\.0\.1|::1|\[::1\])$/)) {
        return "⚠️ Consider using wss:// (secure WebSocket) for remote connections";
      }
      
      return null;
    } catch {
      return "Invalid URL format";
    }
  };

  // Update URL with validation
  const handleUrlChange = (newUrl: string) => {
    setFormData({ ...formData, gatewayUrl: newUrl });
    const error = validateUrl(newUrl);
    setUrlError(error?.startsWith("⚠️") ? null : error); // Only show hard errors
    if (error?.startsWith("⚠️")) {
      setProtocolNotice(error.replace("⚠️ ", ""));
    } else {
      setProtocolNotice(null);
    }
  };

  const handleSave = async () => {
    // Validate URL before saving
    const urlValidation = validateUrl(formData.gatewayUrl);
    if (urlValidation && !urlValidation.startsWith("⚠️")) {
      setUrlError(urlValidation);
      showToastError("Please fix the errors before saving");
      return;
    }
    
    // Try to reconnect with new settings
    const needsReconnect = formData.gatewayUrl !== settings.gatewayUrl || formData.gatewayToken !== settings.gatewayToken;
    
    if (needsReconnect) {
      setConnectionStatus("connecting");
      setError(null);
      setProtocolNotice(null);
      try {
        await invoke("disconnect");
        const result = await invoke<ConnectResult>("connect", {
          url: formData.gatewayUrl,
          token: formData.gatewayToken,
        });
        setConnectionStatus("idle");
        
        // If protocol was switched, save the working URL
        if (result.protocol_switched) {
          await updateSettings({ ...formData, gatewayUrl: result.used_url });
        } else {
          await updateSettings(formData);
        }
        
        showSuccess("Settings saved successfully");
      } catch (err: unknown) {
        setConnectionStatus("error");
        setError(String(err));
        setConnected(false);
        // Still save settings even if connection failed
        await updateSettings(formData);
        showToastError("Settings saved, but connection failed");
        return; // Don't close dialog on error
      }
    } else {
      await updateSettings(formData);
      showSuccess("Settings saved successfully");
    }
    
    onClose();
  };

  const handleTestConnection = async () => {
    setConnectionStatus("connecting");
    setError(null);
    setProtocolNotice(null);
    try {
      await invoke("disconnect");
      const result = await invoke<ConnectResult>("connect", {
        url: formData.gatewayUrl,
        token: formData.gatewayToken,
      });
      setConnectionStatus("idle");
      
      // If protocol was switched, update the URL and show notice
      if (result.protocol_switched) {
        setFormData({ ...formData, gatewayUrl: result.used_url });
        setProtocolNotice(`Connected using ${result.used_url.startsWith("wss://") ? "wss://" : "ws://"} (auto-detected)`);
      }
      
      // Try to fetch models after successful connection
      fetchModels();
    } catch (err: unknown) {
      setConnectionStatus("error");
      setError(String(err));
    }
  };

  // Use available models from Gateway, or fall back to defaults
  const models = availableModels.length > 0 ? availableModels : FALLBACK_MODELS;
  
  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    const provider = model.provider || "other";
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  const providerNames: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    other: "Other",
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border/50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="settings-dialog-title" className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 space-y-6 flex-1 overflow-y-auto">
          {/* Connection Section */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Gateway Connection
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="gateway-url" className="block text-sm font-medium mb-1.5">Gateway URL</label>
                <input
                  id="gateway-url"
                  type="text"
                  value={formData.gatewayUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="ws://localhost:18789"
                  aria-describedby={urlError ? "gateway-url-error" : undefined}
                  aria-invalid={urlError ? "true" : undefined}
                  className={cn(
                    "w-full px-3 py-2 rounded-xl border bg-muted/30 focus:outline-none focus:ring-2 transition-colors",
                    urlError 
                      ? "border-destructive focus:ring-destructive/50" 
                      : "border-border focus:ring-primary/50"
                  )}
                />
                {urlError && (
                  <p id="gateway-url-error" className="text-sm text-destructive mt-1.5" role="alert">{urlError}</p>
                )}
              </div>
              <div>
                <label htmlFor="gateway-token" className="block text-sm font-medium mb-1.5">
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
                <div className="relative">
                  <input
                    id="gateway-token"
                    type={showToken ? "text" : "password"}
                    value={formData.gatewayToken}
                    onChange={(e) => setFormData({ ...formData, gatewayToken: e.target.value })}
                    placeholder="Stored securely in OS keychain"
                    aria-describedby="gateway-token-hint"
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                    aria-label={showToken ? "Hide token" : "Show token"}
                    title={showToken ? "Hide token" : "Show token"}
                  >
                    {showToken ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p id="gateway-token-hint" className="text-xs text-muted-foreground mt-1.5">
                  🔒 Token is stored securely in your OS keychain (not in browser storage)
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={connectionStatus === "connecting"}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      "border border-border hover:bg-muted",
                      connectionStatus === "connecting" && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {connectionStatus === "connecting" ? "Connecting..." : "Test Connection"}
                  </button>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        connected ? "bg-green-500" : "bg-red-500"
                      )}
                    />
                    <span className="text-sm text-muted-foreground">
                      {connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                </div>
                {onRerunSetup && (
                  <button
                    onClick={() => {
                      onClose();
                      onRerunSetup();
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 transition-colors"
                    title="Run the setup wizard again"
                  >
                    Re-run Setup
                  </button>
                )}
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {protocolNotice && (
                <p className="text-sm text-green-600 dark:text-green-400">{protocolNotice}</p>
              )}
            </div>
          </section>

          {/* Chat Section */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Chat Settings
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="default-model" className="block text-sm font-medium">Default Model</label>
                  {modelsLoading && (
                    <span className="text-xs text-muted-foreground animate-pulse" aria-live="polite">
                      Loading models...
                    </span>
                  )}
                  {!modelsLoading && availableModels.length === 0 && connected && (
                    <span className="text-xs text-muted-foreground">
                      Using common models
                    </span>
                  )}
                </div>
                {modelsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <>
                    <select
                      id="default-model"
                      value={formData.defaultModel}
                      onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
                      aria-describedby={!connected ? "model-hint" : undefined}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                    >
                      {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                        <optgroup key={provider} label={providerNames[provider] || provider}>
                          {providerModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {!connected && (
                      <p id="model-hint" className="text-xs text-muted-foreground mt-1.5">
                        Connect to Gateway to see available models
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="thinking-default" className="text-sm font-medium">Enable Thinking by Default</label>
                  <p id="thinking-hint" className="text-xs text-muted-foreground">Extended reasoning for complex tasks</p>
                </div>
                <Switch
                  id="thinking-default"
                  checked={formData.thinkingDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, thinkingDefault: checked })}
                  aria-describedby="thinking-hint"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label htmlFor="system-prompt" className="block text-sm font-medium mb-1.5">
                  Default System Prompt
                </label>
                <p id="system-prompt-hint" className="text-xs text-muted-foreground mb-2">
                  Custom instructions for the AI (applied to new conversations)
                </p>
                <textarea
                  id="system-prompt"
                  value={formData.defaultSystemPrompt || ""}
                  onChange={(e) => setFormData({ ...formData, defaultSystemPrompt: e.target.value })}
                  placeholder="e.g., You are a helpful assistant that responds concisely..."
                  aria-describedby="system-prompt-hint"
                  className="w-full h-24 px-3 py-2 rounded-xl text-sm border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent resize-none transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Appearance
            </h3>
            <fieldset>
              <legend className="block text-sm font-medium mb-1.5">Theme</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="Select theme">
                {(["light", "dark", "system"] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    role="radio"
                    aria-checked={formData.theme === theme}
                    onClick={() => {
                      setFormData({ ...formData, theme });
                      // Apply theme immediately
                      if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                        document.documentElement.classList.add("dark");
                      } else if (theme === "light") {
                        document.documentElement.classList.remove("dark");
                      }
                    }}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      formData.theme === theme
                        ? "bg-primary text-primary-foreground"
                        : "border border-border hover:bg-muted"
                    )}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t border-border bg-muted/30 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
