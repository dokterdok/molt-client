/**
 * Export Dialog Component
 * 
 * Allows users to export conversations in various formats
 * with customizable options.
 */

import React, { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Conversation } from "../stores/store";
import { 
  ExportFormat, 
  exportConversation, 
  generateFilename, 
  getFileExtension 
} from "../lib/export";
import { Button } from "./ui/button";
import { 
  X, 
  Download, 
  FileText, 
  FileJson, 
  FileType, 
  Globe, 
  Copy, 
  Check,
  Loader2 
} from "lucide-react";
import { cn } from "../lib/utils";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
}

interface FormatOption {
  value: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const formatOptions: FormatOption[] = [
  {
    value: "markdown",
    label: "Markdown",
    description: "Clean, readable format for documentation",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    value: "json",
    label: "JSON",
    description: "Complete data with all metadata",
    icon: <FileJson className="w-5 h-5" />,
  },
  {
    value: "text",
    label: "Plain Text",
    description: "Simple text without formatting",
    icon: <FileType className="w-5 h-5" />,
  },
  {
    value: "html",
    label: "HTML",
    description: "Styled, shareable web page",
    icon: <Globe className="w-5 h-5" />,
  },
];

export function ExportDialog({ open, onClose, conversation }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("markdown");
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeThinking, setIncludeThinking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const hasThinkingContent = conversation.messages.some((m) => m.thinkingContent);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const content = exportConversation(conversation, {
        format: selectedFormat,
        includeTimestamps,
        includeMetadata,
        includeThinking,
      });

      const defaultFilename = generateFilename(conversation, selectedFormat);
      const extension = getFileExtension(selectedFormat);

      // Open native save dialog
      const filePath = await save({
        defaultPath: defaultFilename,
        filters: [
          {
            name: formatOptions.find((f) => f.value === selectedFormat)?.label || "File",
            extensions: [extension],
          },
        ],
      });

      if (filePath) {
        await writeTextFile(filePath, content);
        onClose();
      }
    } catch (err: any) {
      console.error("Export failed:", err);
      setError(err.message || "Failed to export conversation");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const content = exportConversation(conversation, {
        format: selectedFormat,
        includeTimestamps,
        includeMetadata,
        includeThinking,
      });

      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      console.error("Copy failed:", err);
      setError(err.message || "Failed to copy to clipboard");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold">Export Conversation</h2>
              <p className="text-sm text-muted-foreground truncate max-w-[280px]">
                {conversation.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Format selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {formatOptions.map((format) => (
                  <button
                    key={format.value}
                    onClick={() => setSelectedFormat(format.value)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                      selectedFormat === format.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 mt-0.5",
                      selectedFormat === format.value ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{format.label}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {format.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="text-sm font-medium block">Options</label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                />
                <span className="text-sm">Include metadata (model, dates)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTimestamps}
                  onChange={(e) => setIncludeTimestamps(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                />
                <span className="text-sm">Include timestamps</span>
              </label>

              {hasThinkingContent && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeThinking}
                    onChange={(e) => setIncludeThinking(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                  />
                  <span className="text-sm">Include thinking content</span>
                </label>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
            <Button
              onClick={handleCopyToClipboard}
              variant="ghost"
              size="sm"
              leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              disabled={isExporting}
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                variant="primary"
                size="sm"
                leftIcon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                disabled={isExporting}
              >
                {isExporting ? "Exporting..." : "Save File"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
