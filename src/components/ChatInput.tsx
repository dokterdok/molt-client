import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { cn } from "../lib/utils";
import { translateError } from "../lib/errors";
import { Spinner } from "./ui/spinner";
import {
  Paperclip,
  Send,
  X,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

// Attachment with base64 data ready to send
export interface PreparedAttachment {
  id: string;
  filename: string;
  mimeType: string;
  data: string; // base64
  path: string; // original path for display
  previewUrl?: string; // data URL for image preview
}

// Supported file types and their MIME mappings
const MIME_TYPES: Record<string, string> = {
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  // Text files
  txt: "text/plain",
  md: "text/markdown",
  // Code files (all as text/plain for the API)
  js: "text/plain",
  ts: "text/plain",
  jsx: "text/plain",
  tsx: "text/plain",
  py: "text/plain",
  rs: "text/plain",
  go: "text/plain",
  java: "text/plain",
  c: "text/plain",
  cpp: "text/plain",
  h: "text/plain",
  css: "text/plain",
  html: "text/html",
  json: "application/json",
  yaml: "text/plain",
  yml: "text/plain",
  toml: "text/plain",
  xml: "text/plain",
  csv: "text/csv",
  // Documents
  pdf: "application/pdf",
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function getMimeType(filename: string): string | null {
  const ext = getExtension(filename);
  return MIME_TYPES[ext] || null;
}

function isImageMime(mimeType: string): boolean {
  return IMAGE_TYPES.includes(mimeType);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface ChatInputProps {
  onSend: (content: string, attachments: PreparedAttachment[]) => void;
  disabled?: boolean;
  isSending?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export function ChatInput({ onSend, disabled, isSending, inputRef: externalRef }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalRef;

  // Auto-focus on mount
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // Listen for quick input messages
  useEffect(() => {
    const handleQuickInputMessage = (e: CustomEvent<{ message: string }>) => {
      const { message: quickMessage } = e.detail;
      if (quickMessage) {
        setMessage(quickMessage);
        // Auto-submit after a short delay
        setTimeout(() => {
          onSend(quickMessage, []);
        }, 150);
      }
    };

    window.addEventListener(
      "quickinput:setmessage",
      handleQuickInputMessage as unknown as (e: Event) => void,
    );
    return () => {
      window.removeEventListener(
        "quickinput:setmessage",
        handleQuickInputMessage as unknown as (e: Event) => void,
      );
    };
  }, [onSend]);

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
    if (disabled || isLoadingFiles) return;
    setFileError(null);

    try {
      const selected = await open({
        multiple: true,
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
          {
            name: "Documents",
            extensions: ["pdf", "txt", "md", "html", "csv", "json"],
          },
          {
            name: "Code",
            extensions: [
              "js",
              "ts",
              "jsx",
              "tsx",
              "py",
              "rs",
              "go",
              "java",
              "c",
              "cpp",
              "h",
              "css",
              "yaml",
              "yml",
              "toml",
              "xml",
            ],
          },
        ],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      setIsLoadingFiles(true);

      const newAttachments: PreparedAttachment[] = [];
      const errors: string[] = [];

      for (const path of paths) {
        try {
          // Get filename from path
          const filename = path.split(/[/\\]/).pop() || path;
          const mimeType = getMimeType(filename);

          if (!mimeType) {
            errors.push(`Unsupported file type: ${filename}`);
            continue;
          }

          // Read file as binary
          const fileData = await readFile(path);

          // Check file size
          if (fileData.byteLength > MAX_FILE_SIZE) {
            errors.push(`File too large (max 10MB): ${filename}`);
            continue;
          }

          // Convert to base64
          const base64 = arrayBufferToBase64(fileData.buffer);

          // Create preview URL for images
          let previewUrl: string | undefined;
          if (isImageMime(mimeType)) {
            previewUrl = `data:${mimeType};base64,${base64}`;
          }

          newAttachments.push({
            id: crypto.randomUUID(),
            filename,
            mimeType,
            data: base64,
            path,
            previewUrl,
          });
        } catch (err) {
          console.error(`Failed to read file ${path}:`, err);
          const filename = path.split(/[/\\]/).pop() || path;
          errors.push(`Failed to read: ${filename}`);
        }
      }

      if (errors.length > 0) {
        setFileError(errors.join("; "));
        // Auto-dismiss after 8 seconds for file errors
        setTimeout(() => setFileError(null), 8000);
      }

      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
      const friendly = translateError(err instanceof Error ? err : String(err));
      setFileError(`${friendly.title}: ${friendly.message}${friendly.suggestion ? ' ' + friendly.suggestion : ''}`);
      setTimeout(() => setFileError(null), 8000);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const canSend =
    (message.trim() || attachments.length > 0) && !disabled && !isLoadingFiles;

  return (
    <div className="p-4">
      {/* File error message */}
      {fileError && (
        <div
          className="flex items-center gap-2 mb-3 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive animate-in fade-in slide-in-from-bottom-2 duration-200"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 whitespace-pre-line">{fileError}</span>
          <button
            onClick={handleAttach}
            className="p-1 hover:bg-destructive/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/50 flex items-center gap-1 text-xs"
            aria-label="Try attaching files again"
            disabled={disabled || isLoadingFiles}
          >
            <RotateCcw className="w-3 h-3" />
            <span className="sr-only">Retry</span>
          </button>
          <button
            onClick={() => setFileError(null)}
            className="p-0.5 hover:bg-destructive/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/50"
            aria-label="Dismiss error message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {attachments.map((file, i) => (
            <div
              key={file.id}
              className="relative flex items-center gap-2 px-3 py-2 bg-muted/60 border border-border/50 rounded-xl text-sm group hover:bg-muted transition-colors animate-in fade-in slide-in-from-bottom-2 duration-200"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {/* Image preview or file icon */}
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt={file.filename}
                  className="w-8 h-8 object-cover rounded"
                />
              ) : isImageMime(file.mimeType) ? (
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              ) : (
                <FileText className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="truncate max-w-[150px]">{file.filename}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-background rounded transition-colors"
                aria-label={`Remove ${file.filename}`}
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
          "relative flex items-end gap-2 rounded-2xl border bg-background/60 transition-colors duration-200",
          isFocused
            ? "border-primary/40 ring-2 ring-primary/15 shadow-md shadow-primary/5"
            : "border-border hover:border-border/70",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {/* Attach button */}
        <button
          onClick={handleAttach}
          disabled={disabled || isLoadingFiles}
          className={cn(
            "p-3 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0",
            (disabled || isLoadingFiles) && "cursor-not-allowed",
          )}
          title="Attach files (images, documents, code)"
          aria-label="Attach files"
        >
          {isLoadingFiles ? (
            <Spinner size="sm" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        {/* Text input */}
        <label htmlFor="message-input" className="sr-only">
          Message input
        </label>
        <textarea
          id="message-input"
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
                : "Message Moltz..."
          }
          rows={1}
          aria-label="Type your message"
          aria-describedby="chat-input-hint"
          className={cn(
            "flex-1 py-3 bg-transparent resize-none",
            "focus:outline-none",
            "placeholder:text-muted-foreground",
            disabled && "cursor-not-allowed",
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
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:scale-105 active:scale-95"
              : "text-muted-foreground cursor-not-allowed",
          )}
          title="Send message (Enter)"
          aria-label={isSending ? "Sending message..." : "Send message"}
        >
          {isSending ? (
            <Spinner
              size="sm"
              className="border-primary-foreground border-t-transparent"
            />
          ) : (
            <Send
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                canSend && "translate-x-0.5",
              )}
            />
          )}
        </button>
      </div>

      {/* Hint */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <p id="chat-input-hint" className="text-xs text-muted-foreground">
          <kbd
            className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]"
            aria-label="Enter key"
          >
            Enter
          </kbd>{" "}
          to send
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          <kbd
            className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]"
            aria-label="Shift plus Enter"
          >
            Shift+Enter
          </kbd>{" "}
          for new line
        </p>
      </div>
    </div>
  );
}
