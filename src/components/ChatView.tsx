import { useRef, useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { invokeWithTimeout } from "../lib/invoke-with-timeout";
import { useStore } from "../stores/store";
import { ChatInput, PreparedAttachment } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { MessageSkeleton } from "./ui/skeleton";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  AlertTriangle,
  X,
  MessageSquare,
  StopCircle,
  RotateCcw,
  WifiOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { translateError } from "../lib/errors";
import { useErrorTimeout } from "../hooks/useErrorTimeout";

export function ChatView() {
  const {
    currentConversation,
    addMessage,
    updateMessage,
    deleteMessagesAfter,
    deleteMessage,
    connected,
    settings,
    completeCurrentMessage,
    currentStreamingMessageId,
  } = useStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { error, setError, clearError } = useErrorTimeout(10000); // Default 10s auto-clear
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<{
    content: string;
    attachments: PreparedAttachment[];
  } | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const lastConversationIdRef = useRef<string | null>(null);

  // Edit confirmation state
  const [pendingEdit, setPendingEdit] = useState<{
    messageId: string;
    newContent: string;
    subsequentCount: number;
  } | null>(null);

  // Show loading state when switching conversations
  useEffect(() => {
    if (
      currentConversation &&
      lastConversationIdRef.current !== currentConversation.id
    ) {
      setMessagesLoading(true);
      lastConversationIdRef.current = currentConversation.id;
      // Brief delay to simulate loading (messages load from memory instantly, but we want the skeleton for visual feedback)
      const timer = setTimeout(() => setMessagesLoading(false), 150);
      return () => clearTimeout(timer);
    }
  }, [currentConversation]);

  // PERF: Virtual scrolling for conversations with many messages (>50)
  const shouldVirtualize = currentConversation ? currentConversation.messages.length > 50 : false;
  
  const virtualizer = useVirtualizer({
    count: currentConversation?.messages.length || 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback(() => 200, []), // Estimated height of each message
    enabled: shouldVirtualize || undefined, // Convert false to undefined for type safety
    overscan: 5, // Render 5 extra items above/below viewport
  });

  // Auto-scroll to bottom on new messages (only if already near bottom)
  // Use instant scroll during streaming to prevent jank, smooth otherwise
  useEffect(() => {
    if (isNearBottom) {
      const behavior = currentStreamingMessageId ? "instant" : "smooth";
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  }, [currentConversation, isNearBottom, currentStreamingMessageId]);

  // Track scroll position
  // PERF: Throttled scroll handler to prevent excessive re-renders (60 FPS)
  const lastScrollTime = useRef(0);
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    
    const now = Date.now();
    if (now - lastScrollTime.current < 16) return; // 60 FPS max
    lastScrollTime.current = now;

    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsNearBottom(distanceFromBottom < 100);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleStopGenerating = useCallback(() => {
    if (currentStreamingMessageId) {
      completeCurrentMessage();
      setIsSending(false);
    }
  }, [currentStreamingMessageId, completeCurrentMessage]);

  // Keyboard shortcut: Esc to stop generating
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && currentStreamingMessageId) {
        handleStopGenerating();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStreamingMessageId, handleStopGenerating]);

  const handleRetry = () => {
    if (lastFailedMessage) {
      handleSendMessage(
        lastFailedMessage.content,
        lastFailedMessage.attachments,
      );
      setLastFailedMessage(null);
    }
  };

  // Actually execute the edit (after confirmation if needed)
  const executeEdit = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentConversation) return;

      // Check connection before attempting to edit
      if (!connected) {
        setError("You're offline right now. Reconnect to edit messages.", 10000);
        setPendingEdit(null);
        return;
      }

      // Delete all messages after this one (including any assistant response)
      deleteMessagesAfter(currentConversation.id, messageId);

      // Update the message content
      updateMessage(currentConversation.id, messageId, newContent);

      clearError();
      setIsSending(true);
      setPendingEdit(null);

      try {
        // Add placeholder for assistant response
        addMessage(currentConversation.id, {
          role: "assistant",
          content: "",
          isStreaming: true,
        });

        // Send to gateway with updated message (60s timeout)
        await invokeWithTimeout("send_message", {
          params: {
            message: newContent,
            session_key: currentConversation.id,
            model: currentConversation.model || settings.defaultModel,
            thinking: currentConversation.thinkingEnabled ? "low" : null,
          },
        }, 60000);
      } catch (err: unknown) {
        console.error("Failed to send edited message:", err);
        const errorMsg = typeof err === "string" ? err : String(err).replace("Error: ", "");
        setError(errorMsg, 15000);
      } finally {
        setIsSending(false);
      }
    },
    [
      currentConversation,
      settings.defaultModel,
      deleteMessagesAfter,
      updateMessage,
      addMessage,
      connected,
      setError,
      clearError,
    ],
  );

  // Handle editing a user message - checks for subsequent messages and shows confirmation
  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!currentConversation || isSending || currentStreamingMessageId)
        return;

      // Find the message index
      const messageIndex = currentConversation.messages.findIndex(
        (m) => m.id === messageId,
      );
      if (messageIndex === -1) return;

      // Check for subsequent messages
      const subsequentCount =
        currentConversation.messages.length - messageIndex - 1;

      if (subsequentCount > 0) {
        // Show confirmation dialog
        setPendingEdit({ messageId, newContent, subsequentCount });
      } else {
        // No subsequent messages, proceed directly
        executeEdit(messageId, newContent);
      }
    },
    [currentConversation, isSending, currentStreamingMessageId, executeEdit],
  );

  const handleConfirmEdit = useCallback(() => {
    if (pendingEdit) {
      executeEdit(pendingEdit.messageId, pendingEdit.newContent);
    }
  }, [pendingEdit, executeEdit]);

  const handleCancelEdit = useCallback(() => {
    setPendingEdit(null);
  }, []);

  // Handle regenerating an assistant response
  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!currentConversation || isSending || currentStreamingMessageId)
        return;

      // Check connection before attempting to regenerate
      if (!connected) {
        setError("You're offline right now. Reconnect to regenerate responses.", 10000);
        return;
      }

      // Find the assistant message
      const messageIndex = currentConversation.messages.findIndex(
        (m) => m.id === messageId,
      );
      if (messageIndex === -1) return;

      // Find the preceding user message
      const precedingUserMessage = currentConversation.messages
        .slice(0, messageIndex)
        .reverse()
        .find((m) => m.role === "user");

      if (!precedingUserMessage) return;

      // Delete the assistant message we're regenerating
      deleteMessage(currentConversation.id, messageId);

      clearError();
      setIsSending(true);

      try {
        // Add placeholder for new assistant response
        addMessage(currentConversation.id, {
          role: "assistant",
          content: "",
          isStreaming: true,
        });

        // Resend the preceding user message (60s timeout)
        await invokeWithTimeout("send_message", {
          params: {
            message: precedingUserMessage.content,
            session_key: currentConversation.id,
            model: currentConversation.model || settings.defaultModel,
            thinking: currentConversation.thinkingEnabled ? "low" : null,
          },
        }, 60000);
      } catch (err: unknown) {
        console.error("Failed to regenerate response:", err);
        const errorMsg = typeof err === "string" ? err : String(err).replace("Error: ", "");
        setError(errorMsg, 15000);
      } finally {
        setIsSending(false);
      }
    },
    [
      currentConversation,
      isSending,
      currentStreamingMessageId,
      settings.defaultModel,
      deleteMessage,
      addMessage,
      connected,
      setError,
      clearError,
    ],
  );

  const handleSendMessage = async (
    content: string,
    attachments: PreparedAttachment[],
  ) => {
    if (!currentConversation || isSending) return;
    
    // Check connection before attempting to send
    if (!connected) {
      setError("You're offline right now. Reconnect to send messages.", 10000);
      setLastFailedMessage({ content, attachments });
      return;
    }

    clearError();
    setLastFailedMessage(null);
    setIsSending(true);

    try {
      // Add user message with pending state (optimistic update)
      const userMessage = addMessage(currentConversation.id, {
        role: "user",
        content,
        isPending: true, // Mark as pending until Gateway confirms
        attachments: attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          data: a.previewUrl ? a.data : undefined, // Only store base64 for images (for preview)
        })),
      });

      // Add placeholder for assistant response
      addMessage(currentConversation.id, {
        role: "assistant",
        content: "",
        isStreaming: true,
      });

      // Send to gateway with attachments (60s timeout for large attachments)
      await invokeWithTimeout("send_message", {
        params: {
          message: content,
          session_key: currentConversation.id,
          model: currentConversation.model || settings.defaultModel,
          thinking: currentConversation.thinkingEnabled ? "low" : null,
          attachments: attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mimeType,
            data: a.data,
          })),
        },
      }, 60000);

      // Mark user message as sent (no longer pending)
      useStore
        .getState()
        .markMessageSent(currentConversation.id, userMessage.id);
    } catch (err: unknown) {
      console.error("Failed to send message:", err);
      const errorMsg = typeof err === "string" ? err : String(err).replace("Error: ", "");
      setError(errorMsg, 15000);
      setLastFailedMessage({ content, attachments });
    } finally {
      setIsSending(false);
    }
  };

  if (!currentConversation) {
    return null;
  }

  const hasMessages = currentConversation.messages.length > 0;

  // Find the last assistant message for regenerate button
  const lastAssistantMessageId = currentConversation.messages
    .filter((m) => m.role === "assistant" && !m.isStreaming)
    .slice(-1)[0]?.id;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Edit confirmation dialog */}
      <ConfirmDialog
        open={!!pendingEdit}
        onClose={handleCancelEdit}
        onConfirm={handleConfirmEdit}
        title="Edit message?"
        description={`This will delete ${pendingEdit?.subsequentCount} message${pendingEdit?.subsequentCount === 1 ? "" : "s"} after this one and regenerate a new response.`}
        confirmText="Edit & Regenerate"
        confirmVariant="destructive"
      />

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messagesLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <MessageSkeleton key={i} isUser={i % 2 === 0} />
              ))}
            </div>
          ) : !hasMessages ? (
            <EmptyConversation />
          ) : shouldVirtualize ? (
            // PERF: Virtual scrolling for long conversations (>50 messages)
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const message = currentConversation?.messages[virtualRow.index];
                if (!message) return null;
                return (
                  <div
                    key={message.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                  >
                    <div className="pb-6">
                      <MessageBubble
                        message={message}
                        onEdit={handleEditMessage}
                        onRegenerate={handleRegenerate}
                        isLastAssistantMessage={
                          message.id === lastAssistantMessageId
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Standard rendering for shorter conversations
            <div className="space-y-6">
              {currentConversation.messages.map((message, index) => (
                <div
                  key={message.id}
                  className="animate-message-in"
                  style={{
                    animationDelay: `${Math.min(index * 30, 300)}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <MessageBubble
                    message={message}
                    onEdit={handleEditMessage}
                    onRegenerate={handleRegenerate}
                    isLastAssistantMessage={
                      message.id === lastAssistantMessageId
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Stop generating button (with Esc shortcut) */}
      {currentStreamingMessageId && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200 z-20">
          <Button
            onClick={handleStopGenerating}
            variant="destructive"
            size="sm"
            className="shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-150 active:scale-95"
            leftIcon={<StopCircle className="w-4 h-4" />}
            aria-label="Stop generating response (Esc)"
            title="Stop generating (Esc)"
          >
            Stop generating
          </Button>
        </div>
      )}

      {/* Scroll to bottom button */}
      {!isNearBottom && hasMessages && !currentStreamingMessageId && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Button
            onClick={scrollToBottom}
            variant="outline"
            size="sm"
            className="shadow-lg hover:shadow-xl hover:scale-105"
            leftIcon={<ArrowDown className="w-4 h-4" />}
            aria-label="Scroll to bottom of conversation"
          >
            Jump to bottom
          </Button>
        </div>
      )}

      {/* Error banner - user-friendly error messages */}
      {error && (() => {
        const friendlyError = translateError(error);
        return (
          <div
            className="px-4 py-3 bg-destructive/10 border-t-2 border-destructive/40 animate-in slide-in-from-bottom duration-200"
            role="alert"
            aria-live="assertive"
          >
            <div className="max-w-3xl mx-auto flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
                  <AlertTriangle
                    className="w-4 h-4 text-destructive"
                    strokeWidth={2.5}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-destructive mb-1">
                    {friendlyError.title}
                  </p>
                  <p className="text-xs text-destructive/80 break-words leading-relaxed mb-1">
                    {friendlyError.message}
                  </p>
                  {friendlyError.suggestion && (
                    <p className="text-xs text-destructive/70 break-words leading-relaxed">
                      💡 {friendlyError.suggestion}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {lastFailedMessage && (
                  <Button
                    onClick={handleRetry}
                    variant="destructive"
                    size="sm"
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    aria-label="Retry sending message"
                  >
                    Retry
                  </Button>
                )}
                <button
                  onClick={() => {
                    setError(null);
                    setLastFailedMessage(null);
                  }}
                  className="flex-shrink-0 p-1.5 text-destructive hover:text-destructive/80 hover:bg-destructive/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/50"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Connection warning - helpful and actionable */}
      {!connected && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 animate-in slide-in-from-bottom duration-200">
          <div className="max-w-3xl mx-auto flex items-center gap-3 text-amber-700 dark:text-amber-300 text-sm">
            <WifiOff className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <span className="font-medium">You're offline</span>
              <span className="mx-1.5">·</span>
              <span className="text-xs opacity-90">
                Check the connection status at the top to reconnect
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 bg-background/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={handleSendMessage}
            disabled={!connected || isSending}
            isSending={isSending}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyConversation() {
  const suggestions = [
    { label: "✨ Write code", prompt: "Help me write a function that " },
    { label: "💡 Explain something", prompt: "Explain how " },
    { label: "🎨 Brainstorm ideas", prompt: "Help me brainstorm ideas for " },
    { label: "🔍 Debug an error", prompt: "I'm getting this error: " },
    { label: "📝 Write content", prompt: "Help me write " },
    { label: "🚀 Plan a project", prompt: "Help me plan out " },
  ];

  const handleSuggestion = (prompt: string) => {
    // Dispatch to fill the chat input
    window.dispatchEvent(
      new CustomEvent("quickinput:setmessage", { detail: { message: prompt } }),
    );
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in duration-500">
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400/10 to-red-500/10 mb-6 shadow-sm animate-in zoom-in-95 duration-500"
        style={{ animationDelay: "100ms" }}
      >
        <MessageSquare className="w-10 h-10 text-primary" strokeWidth={1.5} />
      </div>
      <h2
        className="text-xl font-semibold mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "200ms" }}
      >
        Ready to chat?
      </h2>
      <p
        className="text-muted-foreground max-w-md text-sm sm:text-base leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "300ms" }}
      >
        Choose a quick starter below, or type your own message to get started.
      </p>

      {/* Quick action suggestions — clickable to fill input */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-8 max-w-2xl w-full animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "400ms" }}
      >
        {suggestions.map((action, i) => (
          <button
            key={action.label}
            onClick={() => handleSuggestion(action.prompt)}
            className="px-4 py-3 text-sm bg-muted/50 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-105 active:scale-95 border border-border/50 hover:border-primary/30 cursor-pointer shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${400 + i * 40}ms` }}
            aria-label={`Start with: ${action.label}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
