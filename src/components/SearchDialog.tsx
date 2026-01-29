import React, { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../stores/store";
import { cn } from "../lib/utils";
import { safeFormatDistanceToNow } from "../lib/safe-date";
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
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [roleFilter, setRoleFilter] = useState<
    "all" | "user" | "assistant"
  >("all");
  const [totalMatches, setTotalMatches] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  // Focus input when dialog opens (instant)
  useEffect(() => {
    if (open) {
      // Immediate focus - no delay needed
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      // Clear state on open (fresh start each time)
      setQuery("");
      setResults([]);
      setFilteredResults([]);
      setSelectedIndex(0);
      setRoleFilter("all");
      setTotalMatches(0);
    }
  }, [open]);

  // Apply role filter to results
  useEffect(() => {
    if (roleFilter === "all") {
      setFilteredResults(results);
    } else {
      setFilteredResults(results.filter((r) => r.role === roleFilter));
    }
    setSelectedIndex(0);
  }, [results, roleFilter]);

  // Search across all messages (including encrypted data in IndexedDB)
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    
    if (!trimmed) {
      setResults([]);
      return;
    }

    // Prevent excessively long search queries (could cause performance issues)
    if (trimmed.length > 500) {
      console.warn("Search query too long, truncating to 500 chars");
      searchQuery = trimmed.slice(0, 500);
    }

    setIsSearching(true);

    try {
      // Search encrypted messages in IndexedDB
      const allMessages = await searchPersistedMessages(searchQuery);
      
      // Store total count before limiting (for display)
      setTotalMatches(allMessages.length);
      
      // Limit to first 100 results for performance (show total in UI)
      const messages = allMessages.slice(0, 100);

      const searchResults: SearchResult[] = messages.map((msg) => {
        // Extract a snippet around the match - optimized
        const contentLower = msg.content.toLowerCase();
        const queryLower = searchQuery.toLowerCase();
        const matchIndex = contentLower.indexOf(queryLower);

        let snippet: string;
        if (matchIndex === -1) {
          // Fallback: show start of message
          snippet = msg.content.slice(0, 100);
          if (msg.content.length > 100) snippet += "...";
        } else {
          // Show context around match (50 chars before, 50 after)
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(
            msg.content.length,
            matchIndex + searchQuery.length + 50,
          );
          snippet = msg.content.slice(start, end);
          if (start > 0) snippet = "..." + snippet;
          if (end < msg.content.length) snippet += "...";
        }

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

      setTotalMatches(searchResults.length);
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

  // Reset scroll position when results change
  useEffect(() => {
    if (resultsContainerRef.current) {
      resultsContainerRef.current.scrollTop = 0;
    }
  }, [results]);

  // Keyboard navigation with smooth scrolling and filtering
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Filter shortcuts (Alt/Option + key)
    if (e.altKey) {
      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          setRoleFilter("all");
          return;
        case "u":
          e.preventDefault();
          setRoleFilter("user");
          return;
        case "m":
          e.preventDefault();
          setRoleFilter("assistant");
          return;
      }
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => {
          const newIndex = Math.min(i + 1, filteredResults.length - 1);
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
        if (filteredResults[selectedIndex]) {
          selectConversation(filteredResults[selectedIndex].conversationId);
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
        aria-hidden="true"
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
            <strong className="font-medium">Privacy:</strong> Your messages are encrypted, but we decrypt them temporarily on your device to search. Nothing leaves your computer.
          </span>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg
            className={cn(
              "w-5 h-5 flex-shrink-0 transition-colors",
              isSearching
                ? "text-primary animate-pulse"
                : "text-muted-foreground",
            )}
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
            className="flex-1 bg-transparent focus:outline-none text-lg placeholder:text-muted-foreground/50"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          <kbd
            className="hidden sm:inline-flex px-2 py-1 text-xs font-mono bg-muted rounded text-muted-foreground"
            aria-hidden="true"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsContainerRef} className="max-h-[60vh] overflow-y-auto">
          {isSearching && query.length > 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
              <span className="ml-3 text-sm text-muted-foreground">
                Searching...
              </span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {filteredResults.length}{" "}
                  {filteredResults.length === 1 ? "result" : "results"}
                  {roleFilter !== "all" && (
                    <span className="text-primary">
                      {" "}
                      • {roleFilter === "user" ? "Your messages" : "Moltz replies"}
                    </span>
                  )}
                  {totalMatches > 100 && (
                    <span className="text-orange-500 ml-2">
                      (showing top 100 of {totalMatches})
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setRoleFilter("all")}
                    className={cn(
                      "px-2 py-1 text-xs rounded transition-colors",
                      roleFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80",
                    )}
                    title="All messages (Alt+A)"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setRoleFilter("user")}
                    className={cn(
                      "px-2 py-1 text-xs rounded transition-colors",
                      roleFilter === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-muted hover:bg-muted/80",
                    )}
                    title="Your messages only (Alt+U)"
                  >
                    You
                  </button>
                  <button
                    onClick={() => setRoleFilter("assistant")}
                    className={cn(
                      "px-2 py-1 text-xs rounded transition-colors",
                      roleFilter === "assistant"
                        ? "bg-orange-500 text-white"
                        : "bg-muted hover:bg-muted/80",
                    )}
                    title="Moltz replies only (Alt+M)"
                  >
                    Moltz
                  </button>
                </div>
              </div>
              <div className="py-2">
                {filteredResults.map((result, index) => (
                <button
                  key={`${result.conversationId}-${result.messageId}`}
                  ref={(el) => (resultsRef.current[index] = el)}
                  onClick={() => {
                    selectConversation(result.conversationId);
                    onClose();
                  }}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-all duration-75 animate-in fade-in slide-in-from-left-2",
                    index === selectedIndex
                      ? "bg-muted ring-2 ring-primary/20 ring-inset"
                      : "hover:bg-muted/50",
                  )}
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        result.role === "user"
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                      )}
                    >
                      {result.role === "user" ? "You" : "Moltz"}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate flex-1">
                      {result.conversationTitle}
                    </span>
                    <span className="text-xs text-muted-foreground/70 whitespace-nowrap">
                      {safeFormatDistanceToNow(result.timestamp, {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground/90 line-clamp-2 leading-relaxed">
                    <HighlightedText text={result.matchSnippet} query={query} />
                  </p>
                </button>
                ))}
              </div>
            </>
          ) : query && results.length > 0 && filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Frown className="w-8 h-8 mb-3 opacity-50" strokeWidth={1.5} />
              <p className="text-sm font-medium mb-1">
                No {roleFilter === "user" ? "user" : "assistant"} messages
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Try a different filter
              </p>
              <button
                onClick={() => setRoleFilter("all")}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 transition-colors"
              >
                Show all results
              </button>
            </div>
          ) : query ? (
            <EmptyState
              icon={<Frown className="w-8 h-8" strokeWidth={1.5} />}
              title="No results found"
              description={`Try different keywords or check your spelling`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare
                className="w-12 h-12 mb-3 opacity-50"
                strokeWidth={1.5}
              />
              <p className="text-sm font-medium mb-1">
                Search your conversations
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Search across all your messages, even encrypted ones
              </p>
              <div
                id="search-instructions"
                className="flex flex-col gap-3 mt-2 text-xs"
              >
                <div className="flex gap-2 justify-center">
                  <kbd className="px-2 py-1 bg-muted rounded" aria-label="Arrow keys">
                    ↑↓
                  </kbd>
                  <span>Navigate</span>
                  <kbd className="px-2 py-1 bg-muted rounded" aria-label="Enter key">
                    Enter
                  </kbd>
                  <span>Select</span>
                  <kbd className="px-2 py-1 bg-muted rounded" aria-label="Escape key">
                    Esc
                  </kbd>
                  <span>Close</span>
                </div>
                <div className="flex gap-2 justify-center">
                  <kbd className="px-2 py-1 bg-muted rounded">Alt+A</kbd>
                  <span>All</span>
                  <kbd className="px-2 py-1 bg-muted rounded">Alt+U</kbd>
                  <span>You</span>
                  <kbd className="px-2 py-1 bg-muted rounded">Alt+M</kbd>
                  <span>Moltz</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Highlight matching text in search results - optimized with multi-word support
const HighlightedText = React.memo(
  ({ text, query }: { text: string; query: string }) => {
    if (!query.trim()) return <>{text}</>;

    // Split query into words for multi-word highlighting
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (queryWords.length === 0) return <>{text}</>;

    // Create pattern for all query words
    const pattern = queryWords.map((w) => escapeRegex(w)).join("|");
    const parts = text.split(new RegExp(`(${pattern})`, "gi"));

    return (
      <>
        {parts.map((part, i) => {
          const isMatch = queryWords.some(
            (word) => part.toLowerCase() === word.toLowerCase(),
          );
          return isMatch ? (
            <mark
              key={i}
              className="bg-yellow-300 dark:bg-yellow-500/40 text-foreground font-semibold rounded px-0.5"
            >
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          );
        })}
      </>
    );
  },
);

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
