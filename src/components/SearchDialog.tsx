import React, { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../stores/store";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import { searchPersistedMessages } from "../lib/persistence";
import { EmptyState } from "./ui/empty-state";
import { MessageSquare, Frown } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
  matchSnippet: string;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const { selectConversation } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<(HTMLButtonElement | null)[]>([]);
  useFocusTrap(dialogRef, open);

  // Focus input when dialog opens (instant)
  useEffect(() => {
    if (open) {
      // Immediate focus - no delay needed
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Search across all messages (including encrypted data in IndexedDB)
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Search encrypted messages in IndexedDB
      const messages = await searchPersistedMessages(searchQuery);

      const searchResults: SearchResult[] = messages.map((msg) => {
        // Extract a snippet around the match
        const queryLower = searchQuery.toLowerCase();
        const index = msg.content.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, index - 50);
        const end = Math.min(
          msg.content.length,
          index + searchQuery.length + 50,
        );
        let snippet = msg.content.slice(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < msg.content.length) snippet = snippet + "...";

        return {
          conversationId: msg.conversationId,
          conversationTitle: msg.conversationTitle,
          messageId: msg.id,
          content: msg.content,
          role: msg.role,
          timestamp: msg.timestamp,
          matchSnippet: snippet,
        };
      });

      // Sort by timestamp (most recent first)
      searchResults.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      setResults(searchResults.slice(0, 50)); // Limit results
      setSelectedIndex(0);
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search (150ms - more responsive)
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Keyboard navigation with smooth scrolling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => {
          const newIndex = Math.min(i + 1, results.length - 1);
          // Scroll to selected item
          setTimeout(() => {
            resultsRef.current[newIndex]?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }, 0);
          return newIndex;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => {
          const newIndex = Math.max(i - 1, 0);
          // Scroll to selected item
          setTimeout(() => {
            resultsRef.current[newIndex]?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }, 0);
          return newIndex;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          selectConversation(results[selectedIndex].conversationId);
          onClose();
        }
        break;
      case "Escape":
        onClose();
        break;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-100"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
        className="relative bg-background rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-150 border border-border/50"
      >
        <h2 id="search-dialog-title" className="sr-only">
          Search messages
        </h2>
        {/* Security notice */}
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
          <svg
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>
            <strong className="font-medium">Privacy note:</strong> Messages are
            encrypted at rest, but search text is processed locally in plain
            text. Sensitive searches remain private to your device.
          </span>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg
            className="w-5 h-5 text-muted-foreground flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <label htmlFor="search-input" className="sr-only">
            Search all messages
          </label>
          <input
            id="search-input"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search all messages..."
            aria-describedby="search-instructions"
            className="flex-1 bg-transparent focus:outline-none text-lg"
          />
          <kbd
            className="hidden sm:inline-flex px-2 py-1 text-xs font-mono bg-muted rounded"
            aria-hidden="true"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isSearching && query.length > 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
              <span className="ml-3 text-sm text-muted-foreground">
                Searching...
              </span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/50">
                {results.length} {results.length === 1 ? "result" : "results"}{" "}
                found
              </div>
              <div className="py-2">
                {results.map((result, index) => (
                <button
                  key={`${result.conversationId}-${result.messageId}`}
                  ref={(el) => (resultsRef.current[index] = el)}
                  onClick={() => {
                    selectConversation(result.conversationId);
                    onClose();
                  }}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors duration-75",
                    index === selectedIndex ? "bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded",
                        result.role === "user"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-orange-500/10 text-orange-500",
                      )}
                    >
                      {result.role === "user" ? "You" : "Moltz"}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {result.conversationTitle}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(result.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    <HighlightedText text={result.matchSnippet} query={query} />
                  </p>
                </button>
                ))}
              </div>
            </>
          
          ) : query ? (
            <EmptyState
              icon={<Frown className="w-8 h-8" strokeWidth={1.5} />}
              title="No results found"
              description={`No messages match "${query}". Try different keywords.`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare
                className="w-12 h-12 mb-3 opacity-50"
                strokeWidth={1.5}
              />
              <p className="text-sm font-medium mb-1">
                Search all conversations
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Find messages across encrypted history
              </p>
              <div id="search-instructions" className="flex gap-2 mt-2 text-xs">
                <kbd
                  className="px-2 py-1 bg-muted rounded"
                  aria-label="Arrow keys"
                >
                  ↑↓
                </kbd>
                <span>Navigate</span>
                <kbd
                  className="px-2 py-1 bg-muted rounded"
                  aria-label="Enter key"
                >
                  Enter
                </kbd>
                <span>Select</span>
                <kbd
                  className="px-2 py-1 bg-muted rounded"
                  aria-label="Escape key"
                >
                  Esc
                </kbd>
                <span>Close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Highlight matching text in search results - optimized
const HighlightedText = React.memo(
  ({ text, query }: { text: string; query: string }) => {
    if (!query.trim()) return <>{text}</>;

    const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              className="bg-yellow-300 dark:bg-yellow-500/40 text-foreground font-medium rounded px-0.5"
            >
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          ),
        )}
      </>
    );
  },
);

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
