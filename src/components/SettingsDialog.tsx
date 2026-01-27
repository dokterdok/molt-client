import { useState, useEffect } from "react";
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

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
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

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, updateSettings, connected, setConnected, availableModels, setAvailableModels, modelsLoading, setModelsLoading } = useStore();
  const [formData, setFormData] = useState(settings);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [protocolNotice, setProtocolNotice] = useState<string | null>(null);

  // Only sync form data when dialog opens, not when settings reference changes
  // This prevents reverting edits when the store updates during typing
  useEffect(() => {
    if (open) {
      setFormData(settings);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch models when dialog opens and connected
  useEffect(() => {
    if (open && connected) {
      fetchModels();
    }
  }, [open, connected]);

  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const models = await invoke<ModelInfo[]>("get_models");
      if (models && models.length > 0) {
        setAvailableModels(models);
      }
    } catch (err) {
      console.log("Could not fetch models from Gateway, using fallbacks");
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSave = async () => {
    // Try to reconnect with new settings
    if (formData.gatewayUrl !== settings.gatewayUrl || formData.gatewayToken !== settings.gatewayToken) {
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
          updateSettings({ ...formData, gatewayUrl: result.used_url });
        } else {
          updateSettings(formData);
        }
      } catch (err: any) {
        setConnectionStatus("error");
        setError(err.toString());
        setConnected(false);
        // Still save settings even if connection failed
        updateSettings(formData);
      }
    } else {
      updateSettings(formData);
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
    } catch (err: any) {
      setConnectionStatus("error");
      setError(err.toString());
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
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border/50 ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Connection Section */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Gateway Connection
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Gateway URL</label>
                <input
                  type="text"
                  value={formData.gatewayUrl}
                  onChange={(e) => setFormData({ ...formData, gatewayUrl: e.target.value })}
                  placeholder="ws://localhost:18789"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
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
                <input
                  type="password"
                  value={formData.gatewayToken}
                  onChange={(e) => setFormData({ ...formData, gatewayToken: e.target.value })}
                  placeholder="Leave blank if not required"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
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
                  <label className="block text-sm font-medium">Default Model</label>
                  {modelsLoading && (
                    <span className="text-xs text-muted-foreground animate-pulse">
                      Loading models...
                    </span>
                  )}
                  {!modelsLoading && availableModels.length === 0 && connected && (
                    <span className="text-xs text-muted-foreground">
                      Using common models
                    </span>
                  )}
                </div>
                <select
                  value={formData.defaultModel}
                  onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
                  disabled={modelsLoading}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50",
                    modelsLoading && "opacity-50 cursor-not-allowed"
                  )}
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
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Connect to Gateway to see available models
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Enable Thinking by Default</label>
                  <p className="text-xs text-muted-foreground">Extended reasoning for complex tasks</p>
                </div>
                <Switch
                  checked={formData.thinkingDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, thinkingDefault: checked })}
                />
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Appearance
            </h3>
            <div>
              <label className="block text-sm font-medium mb-1.5">Theme</label>
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map((theme) => (
                  <button
                    key={theme}
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
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
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
