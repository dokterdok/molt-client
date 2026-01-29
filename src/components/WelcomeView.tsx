import { useStore } from "../stores/store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../lib/utils";
import { Plus, AlertTriangle, Cpu } from "lucide-react";
import { Button } from "./ui/button";

export function WelcomeView() {
  // PERF: Use selective subscriptions with shallow equality to prevent unnecessary re-renders
  const {
    createConversation,
    addMessage,
    connected,
    settings,
    availableModels,
  } = useStore(
    useShallow((state) => ({
      createConversation: state.createConversation,
      addMessage: state.addMessage,
      connected: state.connected,
      settings: state.settings,
      availableModels: state.availableModels,
    }))
  );

  // Moltz-specific suggestions showcasing agentic capabilities
  const suggestions = [
    {
      icon: "📅",
      title: "What's on my calendar today?",
      description: "Check your schedule and upcoming meetings",
      prompt: "What's on my calendar today? Summarize any upcoming meetings.",
    },
    {
      icon: "📧",
      title: "Check my unread emails",
      description: "Summarize what needs your attention",
      prompt:
        "Check my unread emails and summarize anything important or urgent.",
    },
    {
      icon: "🎙️",
      title: "What was my last meeting about?",
      description: "Review transcripts and action items",
      prompt:
        "What did we discuss in my most recent meeting? Any action items for me?",
    },
    {
      icon: "💬",
      title: "Message someone for me",
      description: "Draft and send via Slack, email, or chat",
      prompt: "Help me send a message. Who should I contact?",
    },
    {
      icon: "🔍",
      title: "Find a file or document",
      description: "Search across your files and folders",
      prompt: "Help me find a file. What are you looking for?",
    },
    {
      icon: "🏠",
      title: "Control my smart home",
      description: "Lights, thermostat, and more",
      prompt:
        "What smart home devices can I control? Show me what's available.",
    },
  ];

  const handleSuggestionClick = async (suggestion: (typeof suggestions)[0]) => {
    const conv = createConversation();
    // Auto-send the suggestion prompt
    addMessage(conv.id, {
      role: "user",
      content: suggestion.prompt,
    });
  };

  // Get display name for current model
  const currentModelName = (() => {
    const model = availableModels.find((m) => m.id === settings.defaultModel);
    if (model) return model.name;
    // Fallback: extract name from ID
    const parts = settings.defaultModel.split("/");
    return parts[parts.length - 1]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  })();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="max-w-3xl w-full text-center">
        {/* Semantic heading for screen readers */}
        <h1 className="sr-only">Moltz AI Assistant - Welcome</h1>
        
        {/* Logo */}
        <div className="mb-8 animate-in zoom-in-50 duration-500">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 shadow-xl shadow-orange-500/20 mb-6 transform hover:scale-105 transition-transform">
            <span className="text-5xl drop-shadow-lg" role="img" aria-label="Moltz lobster mascot">🦞</span>
          </div>
          <h2 className="text-5xl font-bold bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent mb-3" aria-hidden="true">
            Moltz
          </h2>
          <p className="text-lg text-muted-foreground">
            Your AI that actually{" "}
            <span className="font-medium text-foreground">does things</span>
          </p>
        </div>

        {/* Connection status banner */}
        {!connected && (
          <div className="mb-8 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" strokeWidth={2} />
              <span className="font-medium">Not Connected Yet</span>
            </div>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1 text-center">
              You can browse saved chats, but you'll need to connect before you can chat with Moltz.
            </p>
            <p className="text-xs text-amber-600/60 dark:text-amber-400/60 mt-2 text-center">
              Open Settings (⌘,) to set up your connection.
            </p>
          </div>
        )}

        {/* Model info */}
        {connected && (
          <div className="mb-8 flex items-center justify-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-300">
            <Cpu className="w-4 h-4" strokeWidth={2} />
            <span>Powered by</span>
            <span className="px-2 py-0.5 bg-muted rounded-md font-medium text-foreground">
              {currentModelName}
            </span>
          </div>
        )}

        {/* Suggestions */}
        <div className="mb-8">
          <h3 className="sr-only">Suggested actions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try asking me to...
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={!connected}
                className={cn(
                  "group p-4 text-left rounded-xl border transition-[colors,transform,box-shadow] duration-200",
                  "animate-in fade-in slide-in-from-bottom-2",
                  connected
                    ? "border-border/50 hover:border-primary/30 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5 cursor-pointer"
                    : "border-border/50 opacity-50 cursor-not-allowed",
                )}
                style={{ animationDelay: `${i * 50 + 200}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">
                    {suggestion.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium group-hover:text-primary transition-colors truncate">
                      {suggestion.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* New chat button */}
        <Button
          onClick={() => createConversation()}
          disabled={!connected}
          variant="primary"
          size="lg"
          leftIcon={<Plus className="w-5 h-5" />}
          className={cn(
            "animate-in fade-in zoom-in-95 duration-500",
            connected &&
              "hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0",
          )}
          style={{ animationDelay: "400ms" }}
        >
          Start New Chat
        </Button>

        {/* Keyboard hint */}
        <p
          className="mt-4 text-xs text-muted-foreground animate-in fade-in duration-500"
          style={{ animationDelay: "500ms" }}
        >
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono mx-0.5">
            ⌘N
          </kbd>{" "}
          to start a new chat
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono mx-0.5">
            ⌘K
          </kbd>{" "}
          to search
        </p>
      </div>
    </div>
  );
}
