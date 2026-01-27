import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../stores/store";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import { searchPersistedMessages } from "../lib/persistence";

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

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
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
      
      const searchResults: SearchResult[] = messages.map(msg => {
        // Extract a snippet around the match
        const queryLower = searchQuery.toLowerCase();
        const index = msg.content.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, index - 50);
        const end = Math.min(msg.content.length, index + searchQuery.length + 50);
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
      searchResults.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setResults(searchResults.slice(0, 50)); // Limit results
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search all messages..."
            className="flex-1 bg-transparent focus:outline-none text-lg"
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-mono bg-muted rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.conversationId}-${result.messageId}`}
                  onClick={() => {
                    selectConversation(result.conversationId);
                    onClose();
                  }}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors",
                    index === selectedIndex ? "bg-muted" : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      result.role === "user" 
                        ? "bg-blue-500/10 text-blue-500" 
                        : "bg-orange-500/10 text-orange-500"
                    )}>
                      {result.role === "user" ? "You" : "Molt"}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {result.conversationTitle}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(result.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    <HighlightedText text={result.matchSnippet} query={query} />
                  </p>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">Type to search across all conversations</p>
              <div className="flex gap-2 mt-4 text-xs">
                <kbd className="px-2 py-1 bg-muted rounded">↑↓</kbd>
                <span>Navigate</span>
                <kbd className="px-2 py-1 bg-muted rounded">Enter</kbd>
                <span>Select</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Highlight matching text in search results
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
