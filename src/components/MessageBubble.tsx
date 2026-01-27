import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { Message } from "../stores/store";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  User,
  Copy,
  Check,
  Link as LinkIcon,
  Cpu,
} from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showTimestamp, setShowTimestamp] = useState(false);

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.content);
  };

  const isUser = message.role === "user";

  return (
    <div 
      className={cn("group flex gap-3", isUser && "flex-row-reverse")}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
      role="article"
      aria-label={`Message from ${isUser ? "You" : "Molt"}`}
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
            {isUser ? "You" : "Molt"}
          </span>
          <span 
            className={cn(
              "text-xs text-muted-foreground transition-opacity duration-200",
              showTimestamp ? "opacity-100" : "opacity-0"
            )}
          >
            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
          </span>
        </div>

        {/* Message content */}
        <div
          className={cn(
            "relative",
            isUser ? "text-right" : "",
            isUser && "bg-primary/5 rounded-2xl rounded-tr-sm px-4 py-3"
          )}
        >
          {message.isStreaming && !message.content ? (
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
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const code = String(children).replace(/\n$/, "");

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
                  a({ href, children, ...props }: any) {
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
                  table({ children, ...props }: any) {
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

        {/* Actions (visible on hover) */}
        {!message.isStreaming && (
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
      <span className="sr-only">Molt is typing...</span>
    </div>
  );
}
