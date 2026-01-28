/**
 * Keyboard Shortcuts Help Dialog
 * 
 * Provides a comprehensive list of all keyboard shortcuts available in the app.
 * Improves discoverability and helps keyboard-only users navigate efficiently.
 */

import { useRef, useEffect } from "react";
import { cn } from "../lib/utils";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { Keyboard, X } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Navigation
  { keys: ["⌘", "\\"], description: "Toggle sidebar", category: "Navigation" },
  { keys: ["Esc"], description: "Close sidebar (mobile)", category: "Navigation" },
  { keys: ["⌘", "K"], description: "Search messages", category: "Navigation" },
  { keys: ["⌘", "N"], description: "New conversation", category: "Navigation" },
  { keys: ["⌘", ","], description: "Open settings", category: "Navigation" },
  
  // Chat
  { keys: ["Enter"], description: "Send message", category: "Chat" },
  { keys: ["Shift", "Enter"], description: "New line in message", category: "Chat" },
  { keys: ["⌘", "Shift", "Space"], description: "Quick input (global)", category: "Chat" },
  
  // Message Editing
  { keys: ["Enter"], description: "Save edited message", category: "Editing" },
  { keys: ["Esc"], description: "Cancel editing", category: "Editing" },
  
  // Search Dialog
  { keys: ["↑"], description: "Previous result", category: "Search" },
  { keys: ["↓"], description: "Next result", category: "Search" },
  { keys: ["Enter"], description: "Open selected conversation", category: "Search" },
  { keys: ["Esc"], description: "Close search", category: "Search" },
  
  // General
  { keys: ["Tab"], description: "Navigate forward", category: "General" },
  { keys: ["Shift", "Tab"], description: "Navigate backward", category: "General" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "General" },
];

const categories = Array.from(new Set(shortcuts.map(s => s.category)));

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="relative bg-background rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Keyboard className="w-5 h-5 text-primary" />
            </div>
            <h2 id="shortcuts-dialog-title" className="text-lg font-semibold">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-muted rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Close shortcuts dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="space-y-6">
            {categories.map(category => (
              <section key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter(s => s.category === category)
                    .map((shortcut, i) => (
                      <div
                        key={`${category}-${i}`}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, j) => (
                            <kbd
                              key={j}
                              className={cn(
                                "px-2 py-1 text-xs font-mono bg-muted border border-border rounded shadow-sm",
                                j < shortcut.keys.length - 1 && "mr-0.5"
                              )}
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono mx-1">?</kbd> 
            anytime to view shortcuts, or <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono mx-1">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
