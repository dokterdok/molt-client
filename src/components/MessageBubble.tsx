import {
  useState,
  useRef,
  useEffect,
  KeyboardEvent,
  memo,
  lazy,
  Suspense,
} from "react";
import { Message, Attachment } from "../stores/store";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  User,
  Copy,
  Link as LinkIcon,
  Cpu,
  Pencil,
  RefreshCw,
  X,
  Send,
  FileText,
  Brain,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ImageRenderer } from "./ImageRenderer";
import { Spinner } from "./ui/spinner";

// PERF: Lazy load MarkdownRenderer to defer the 340 kB markdown chunk
const MarkdownRenderer = lazy(() =>
  import("./MarkdownRenderer").then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

interface MessageBubbleProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: (messageId: string) => void;
  isLastAssistantMessage?: boolean;
  /** Compact mode - tighter spacing for power users */
  compact?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onEdit,
  onRegenerate,
  isLastAssistantMessage,
  compact = false,
}: MessageBubbleProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, [isEditing]);

  // Reset edit content when message changes
  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  const [messageCopied, setMessageCopied] = useState(false);

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.content);
    setMessageCopied(true);
    setTimeout(() => setMessageCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content && onEdit) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      handleCancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(message.id);
    }
  };

  const isUser = message.role === "user";
  
  // CRITICAL FIX: Safe timestamp handling to prevent crash on invalid dates
  // formatDistanceToNow throws on invalid date, so we fallback to "just now"
  const messageTimestamp = new Date(message.timestamp);
  const timestampLabel = Number.isNaN(messageTimestamp.getTime())
    ? "just now"
    : formatDistanceToNow(messageTimestamp, { addSuffix: true });

  return (
    <div
      className={cn(
        "group flex animate-message-in",
        compact ? "gap-2" : "gap-3",
        isUser && "flex-row-reverse",
      )}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
      role="article"
      aria-label={`Message from ${isUser ? "You" : "Moltz"} sent ${timestampLabel}`}
    >
      {/* Avatar - smaller in compact mode */}
      <div
        className={cn(
          "flex-shrink-0 rounded-xl flex items-center justify-center text-white font-medium shadow-sm",
          compact ? "w-6 h-6 text-xs" : "w-9 h-9 text-sm",
          isUser
            ? "bg-gradient-to-br from-blue-500 to-blue-600"
            : "bg-gradient-to-br from-orange-500 to-red-500",
        )}
      >
        {isUser ? (
          <User className={compact ? "w-3.5 h-3.5" : "w-5 h-5"} strokeWidth={2} />
        ) : (
          <span className={compact ? "text-sm" : "text-lg"}>🦞</span>
        )}
      </div>

      {/* Content */}
      <div
        className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}
      >
        {/* Header - smaller in compact mode */}
        <div className={cn("flex items-center gap-2", compact ? "mb-0.5" : "mb-1")}>
          <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
            {isUser ? "You" : "Moltz"}
          </span>
          {message.isPending && !message.sendStatus && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground animate-pulse" />
              Sending...
            </span>
          )}
          {message.sendStatus === "sending" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
              Sending...
            </span>
          )}
          {message.sendStatus === "queued" && (
            <span
              className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
              title="Message will be sent when reconnected"
            >
              <span className="inline-block w-1 h-1 rounded-full bg-amber-500" />
              Queued
            </span>
          )}
          {message.sendStatus === "failed" && (
            <span
              className="text-xs text-destructive flex items-center gap-1"
              title={message.sendError || "Failed to send"}
            >
              <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
              Failed
            </span>
          )}
          <span
            className={cn(
              "text-xs text-muted-foreground transition-opacity duration-200",
              showTimestamp || message.isPending ? "opacity-100" : "opacity-0",
            )}
          >
            {!message.isPending && timestampLabel}
            {/* Token usage for assistant messages */}
            {!isUser && message.usage?.totalTokens && (
              <span className="ml-2 text-muted-foreground/70">
                · {message.usage.totalTokens.toLocaleString()} tokens
              </span>
            )}
          </span>
        </div>

        {/* Message content */}
        <div
          className={cn(
            "relative",
            isUser ? "text-right" : "",
            isUser &&
              !isEditing &&
              cn(
                "bg-gradient-to-br from-primary/10 to-primary/[0.06] shadow-sm shadow-primary/10 rounded-2xl rounded-tr-sm",
                compact ? "px-3 py-2" : "px-4 py-3"
              ),
            // Streaming state: subtle border pulse
            message.isStreaming &&
              !isUser &&
              cn(
                "border border-primary/30 rounded-2xl animate-streaming-pulse",
                compact ? "px-3 py-2" : "px-4 py-3"
              ),
            // Compact mode text size
            compact && "text-sm",
          )}
        >
          {isEditing ? (
            <div className="w-full">
              <label htmlFor={`edit-message-${message.id}`} className="sr-only">
                Edit message
              </label>
              <textarea
                id={`edit-message-${message.id}`}
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                aria-label="Edit your message"
                aria-describedby={`edit-hint-${message.id}`}
                className={cn(
                  "w-full min-h-[100px] p-3 text-sm rounded-lg border border-primary/50",
                  "bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30",
                  "text-left",
                )}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
              <div className="flex items-center gap-2 mt-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim()}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                    editContent.trim()
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                >
                  <Send className="w-4 h-4" />
                  Save & Send
                </button>
              </div>
              <p
                id={`edit-hint-${message.id}`}
                className="text-xs text-muted-foreground mt-1 text-right"
              >
                <kbd
                  className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]"
                  aria-label="Enter key"
                >
                  Enter
                </kbd>{" "}
                to save
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <kbd
                  className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]"
                  aria-label="Escape key"
                >
                  Esc
                </kbd>{" "}
                to cancel
              </p>
            </div>
          ) : message.isStreaming && !message.content ? (
            <TypingIndicator />
          ) : (
            <>
              {/* Thinking block (collapsible) */}
              {!isUser && message.thinkingContent && (
                <div className="mb-3">
                  <button
                    onClick={() => setThinkingExpanded(!thinkingExpanded)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1 px-2 rounded-md hover:bg-muted/50"
                    aria-expanded={thinkingExpanded}
                    aria-controls={`thinking-${message.id}`}
                  >
                    <Brain className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="font-medium">Thinking</span>
                    {thinkingExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                    )}
                  </button>
                  {thinkingExpanded && (
                    <div
                      id={`thinking-${message.id}`}
                      className="mt-2 pl-4 border-l-2 border-muted text-muted-foreground text-sm italic animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                      <Suspense
                        fallback={
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <Spinner size="sm" />
                            Loading...
                          </div>
                        }
                      >
                        <MarkdownRenderer
                          content={message.thinkingContent}
                          copiedCode={copiedCode}
                          onCopyCode={copyToClipboard}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              )}

              {/* Main message content */}
              {!message.content && !isUser ? (
                <div className="text-muted-foreground text-sm italic">
                  ⚠️ Empty response
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Spinner size="sm" />
                      Loading...
                    </div>
                  }
                >
                  <MarkdownRenderer
                    content={message.content}
                    copiedCode={copiedCode}
                    onCopyCode={copyToClipboard}
                  />
                </Suspense>
              )}
            </>
          )}

          {/* Streaming cursor - P1: smooth blink */}
          {message.isStreaming && message.content && (
            <span className="inline-block w-[2px] h-4 bg-primary animate-cursor-blink ml-0.5" />
          )}

          {/* Screen reader announcement for streaming status */}
          {!isUser && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {message.isStreaming
                ? "Assistant is typing"
                : "Response complete"}
            </div>
          )}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <AttachmentsDisplay attachments={message.attachments} />
        )}

        {/* Actions (visible on hover) */}
        {!message.isStreaming && !isEditing && (
          <div
            className={cn(
              "flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
              isUser && "justify-end",
              "bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg p-0.5 w-fit shadow-sm",
            )}
          >
            <button
              onClick={copyMessage}
              className={cn(
                "p-1.5 rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                messageCopied 
                  ? "text-green-600 dark:text-green-400 bg-green-500/10 animate-copy-success" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95"
              )}
              title={messageCopied ? "Copied!" : "Copy message"}
              aria-label={messageCopied ? "Message copied to clipboard" : "Copy message to clipboard"}
            >
              {messageCopied ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <Copy className="w-4 h-4" strokeWidth={2} />
              )}
            </button>
            {/* Edit button for user messages */}
            {isUser && onEdit && (
              <button
                onClick={handleStartEdit}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                title="Edit message (will resend)"
                aria-label="Edit message"
              >
                <Pencil className="w-4 h-4" strokeWidth={2} />
              </button>
            )}
            {/* Regenerate button for assistant messages (only last one) */}
            {!isUser && isLastAssistantMessage && onRegenerate && (
              <button
                onClick={handleRegenerate}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                title="Regenerate response"
                aria-label="Regenerate response"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={2} />
              </button>
            )}
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" strokeWidth={2} />
              Sources
            </h4>
            <div className="space-y-1">
              {message.sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <span className="truncate">{source.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Model badge */}
        {message.modelUsed && (
          <span className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1">
            <Cpu className="w-3 h-3" strokeWidth={2} />
            {message.modelUsed.split("/").pop()}
          </span>
        )}
      </div>
    </div>
  );
});

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 py-3 px-2 animate-spring-bounce">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-primary/70 typing-dot shadow-sm shadow-primary/30"
            style={{
              animationDelay: `${i * 0.15}s`,
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground animate-thinking-breathe font-medium">
        Thinking...
      </span>
    </div>
  );
}

interface AttachmentsDisplayProps {
  attachments: Attachment[];
}

const AttachmentsDisplay = memo(function AttachmentsDisplay({
  attachments,
}: AttachmentsDisplayProps) {
  // Separate images from other files
  const images = attachments.filter((a) => a.mimeType?.startsWith("image/"));
  const files = attachments.filter((a) => !a.mimeType?.startsWith("image/"));

  return (
    <div className="mt-3 space-y-3">
      {/* Image grid */}
      {images.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-2",
            images.length === 1 ? "" : "grid grid-cols-2 sm:grid-cols-3",
          )}
        >
          {images.map((attachment) => {
            const src = attachment.data
              ? `data:${attachment.mimeType};base64,${attachment.data}`
              : attachment.url;

            if (!src) return null;

            return (
              <ImageRenderer
                key={attachment.id}
                src={src}
                alt={attachment.filename || "Attached image"}
                maxWidth={images.length === 1 ? 400 : 200}
                maxHeight={images.length === 1 ? 400 : 200}
              />
            );
          })}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-sm border border-border"
            >
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span
                className="truncate max-w-[200px]"
                title={attachment.filename}
              >
                {attachment.filename || "Unnamed file"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
