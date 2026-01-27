import { useState, useRef, useEffect, KeyboardEvent, ReactNode, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { Message, Attachment } from "../stores/store";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  User,
  Copy,
  Check,
  Link as LinkIcon,
  Cpu,
  Pencil,
  RefreshCw,
  X,
  Send,
  FileText,
} from "lucide-react";
import { ImageRenderer } from "./ImageRenderer";

// Type definitions for ReactMarkdown components
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

interface LinkProps {
  href?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

interface ImageProps {
  src?: string;
  alt?: string;
  [key: string]: unknown;
}

interface TableProps {
  children?: ReactNode;
  [key: string]: unknown;
}

/**
 * Recursively extracts plain text from React children.
 * Handles strings, numbers, arrays, and React elements (e.g., syntax-highlighted spans).
 */
function extractTextFromChildren(children: ReactNode): string {
  if (children == null) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("");
  }
  if (isValidElement(children)) {
    return extractTextFromChildren(children.props.children);
  }
  return "";
}

interface MessageBubbleProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: (messageId: string) => void;
  isLastAssistantMessage?: boolean;
}

export function MessageBubble({ message, onEdit, onRegenerate, isLastAssistantMessage }: MessageBubbleProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  // Reset edit content when message changes
  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.content);
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

  return (
    <div 
      className={cn("group flex gap-3", isUser && "flex-row-reverse")}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
      role="article"
      aria-label={`Message from ${isUser ? "You" : "Moltzer"}`}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-medium shadow-sm",
          isUser 
            ? "bg-gradient-to-br from-blue-500 to-blue-600" 
            : "bg-gradient-to-br from-orange-500 to-red-500"
        )}
      >
        {isUser ? (
          <User className="w-5 h-5" strokeWidth={2} />
        ) : (
          <span className="text-lg">🦞</span>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            {isUser ? "You" : "Moltzer"}
          </span>
          {message.isPending && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground animate-pulse" />
              Sending...
            </span>
          )}
          <span 
            className={cn(
              "text-xs text-muted-foreground transition-opacity duration-200",
              showTimestamp || message.isPending ? "opacity-100" : "opacity-0"
            )}
          >
            {!message.isPending && formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
          </span>
        </div>

        {/* Message content */}
        <div
          className={cn(
            "relative",
            isUser ? "text-right" : "",
            isUser && !isEditing && "bg-primary/5 rounded-2xl rounded-tr-sm px-4 py-3",
            // Streaming state: subtle border pulse (P1)
            message.isStreaming && !isUser && "border border-primary/30 rounded-2xl px-4 py-3 animate-streaming-pulse"
          )}
        >
          {isEditing ? (
            <div className="w-full">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className={cn(
                  "w-full min-h-[100px] p-3 text-sm rounded-lg border border-primary/50",
                  "bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30",
                  "text-left"
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
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Send className="w-4 h-4" />
                  Save & Send
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">Enter</kbd> to save
                <span className="mx-1.5">·</span>
                <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">Esc</kbd> to cancel
              </p>
            </div>
          ) : message.isStreaming && !message.content ? (
            <TypingIndicator />
          ) : (
            <div className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize, rehypeHighlight]}
                components={{
                  code({ inline, className, children, ...props }: CodeProps) {
                    const match = /language-(\w+)/.exec(className || "");
                    // Extract plain text from children (handles syntax-highlighted spans from rehype-highlight)
                    const code = extractTextFromChildren(children).replace(/\n$/, "");

                    if (!inline && match) {
                      return (
                        <div className="relative group/code my-4 -mx-4 sm:mx-0">
                          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-800 rounded-t-lg border border-b-0 border-zinc-700">
                            <span className="text-xs text-zinc-400 font-mono">{match[1]}</span>
                            <button
                              onClick={() => copyToClipboard(code)}
                              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-2 py-1"
                              aria-label={copiedCode === code ? "Code copied" : "Copy code to clipboard"}
                            >
                              {copiedCode === code ? (
                                <>
                                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="!mt-0 !rounded-t-none !bg-zinc-900 dark:!bg-zinc-800 !border !border-t-0 !border-zinc-700 overflow-x-auto">
                            <code className={cn(className, "text-sm")} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    }

                    return (
                      <code
                        className="px-1.5 py-0.5 rounded-md bg-muted text-sm font-mono before:content-none after:content-none"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  a({ href, children, ...props }: LinkProps) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                  img({ src, alt }: ImageProps) {
                    if (!src) return null;
                    return (
                      <ImageRenderer 
                        src={src} 
                        alt={alt || "Image"} 
                        className="my-2"
                      />
                    );
                  },
                  table({ children, ...props }: TableProps) {
                    return (
                      <div className="overflow-x-auto my-4 rounded-lg border border-border">
                        <table className="w-full" {...props}>
                          {children}
                        </table>
                      </div>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && message.content && (
            <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
          )}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <AttachmentsDisplay attachments={message.attachments} />
        )}

        {/* Actions (visible on hover) */}
        {!message.isStreaming && !isEditing && (
          <div className={cn(
            "flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            isUser && "justify-end"
          )}>
            <button
              onClick={copyMessage}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              title="Copy message"
              aria-label="Copy message to clipboard"
            >
              <Copy className="w-4 h-4" strokeWidth={2} />
            </button>
            {/* Edit button for user messages */}
            {isUser && onEdit && (
              <button
                onClick={handleStartEdit}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            {message.modelUsed.split('/').pop()}
          </span>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-primary/70 animate-bounce shadow-sm"
          style={{ 
            animationDelay: `${i * 0.15}s`,
            animationDuration: "0.6s"
          }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Moltzer is typing...</span>
    </div>
  );
}

interface AttachmentsDisplayProps {
  attachments: Attachment[];
}

function AttachmentsDisplay({ attachments }: AttachmentsDisplayProps) {
  // Separate images from other files
  const images = attachments.filter(a => a.mimeType?.startsWith('image/'));
  const files = attachments.filter(a => !a.mimeType?.startsWith('image/'));

  return (
    <div className="mt-3 space-y-3">
      {/* Image grid */}
      {images.length > 0 && (
        <div className={cn(
          "flex flex-wrap gap-2",
          images.length === 1 ? "" : "grid grid-cols-2 sm:grid-cols-3"
        )}>
          {images.map((attachment) => {
            // Construct image source from data or url
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
              <span className="truncate max-w-[200px]" title={attachment.filename}>
                {attachment.filename || 'Unnamed file'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
