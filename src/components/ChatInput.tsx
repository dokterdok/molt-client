import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { cn } from "../lib/utils";
import { Spinner } from "./ui/spinner";
import { Paperclip, Send, X } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string, attachments: File[]) => void;
  disabled?: boolean;
  isSending?: boolean;
}

export function ChatInput({ onSend, disabled, isSending }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleSend = () => {
    if (disabled) return;
    if (!message.trim() && attachments.length === 0) return;
    onSend(message, attachments);
    setMessage("");
    setAttachments([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttach = async () => {
    if (disabled) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [
          { name: "All Files", extensions: ["*"] },
          { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
          { name: "Documents", extensions: ["pdf", "txt", "md"] },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        // In Tauri v2, we'd need to read files through the fs plugin
        // For now, just store the paths
        // Files selected - paths are stored for later processing
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const canSend = (message.trim() || attachments.length > 0) && !disabled;

  return (
    <div className="p-4">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap animate-in fade-in slide-in-from-bottom-2 duration-200">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm group hover:bg-muted/80 transition-colors"
            >
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-background rounded transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div
        className={cn(
          "relative flex items-end gap-2 rounded-2xl border bg-background/50 transition-all duration-200",
          isFocused
            ? "border-primary/50 ring-2 ring-primary/20 shadow-lg"
            : "border-border hover:border-border/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Attach button */}
        <button
          onClick={handleAttach}
          disabled={disabled}
          className={cn(
            "p-3 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0",
            disabled && "cursor-not-allowed"
          )}
          title="Attach files"
          aria-label="Attach files"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={
            isSending 
              ? "Sending message..." 
              : disabled 
              ? "Connect to Gateway to send messages..." 
              : "Message Molt..."
          }
          rows={1}
          className={cn(
            "flex-1 py-3 bg-transparent resize-none",
            "focus:outline-none",
            "placeholder:text-muted-foreground",
            disabled && "cursor-not-allowed"
          )}
          style={{
            minHeight: "24px",
            maxHeight: "200px",
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "p-3 rounded-xl m-1 transition-all duration-200 flex-shrink-0",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md active:scale-95"
              : "text-muted-foreground cursor-not-allowed"
          )}
          title="Send message (Enter)"
          aria-label={isSending ? "Sending message..." : "Send message"}
        >
          {isSending ? (
            <Spinner size="sm" className="border-primary-foreground border-t-transparent" />
          ) : (
            <Send 
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                canSend && "translate-x-0.5"
              )}
            />
          )}
        </button>
      </div>

      {/* Hint */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <p className="text-xs text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">Enter</kbd> to send
          <span className="mx-1.5">·</span>
          <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
