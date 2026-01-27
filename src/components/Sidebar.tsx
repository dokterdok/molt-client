import React, { useState, useEffect, lazy, Suspense, useRef } from "react";
import { useStore, Conversation } from "../stores/store";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { EmptyState } from "./ui/empty-state";
import { ConversationSkeleton } from "./ui/skeleton";
import { ScrollShadow } from "./ui/scroll-shadow";
import { cn } from "../lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";

// Lazy load heavy dialogs for better initial load performance
const SettingsDialog = lazy(() => import("./SettingsDialog").then(m => ({ default: m.SettingsDialog })));
const SearchDialog = lazy(() => import("./SearchDialog").then(m => ({ default: m.SearchDialog })));
const ExportDialog = lazy(() => import("./ExportDialog").then(m => ({ default: m.ExportDialog })));
import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  Search,
  Settings,
  Pin,
  MoreVertical,
  Trash2,
  MessageSquare,
  Download,
} from "lucide-react";
import { Button } from "./ui/button";

// Check if running on macOS (for traffic light padding)
const isMacOS = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

interface SidebarProps {
  onToggle: () => void;
  onRerunSetup?: () => void;
}

export function Sidebar({ onToggle: _onToggle, onRerunSetup }: SidebarProps) {
  const {
    conversations,
    conversationsLoading,
    currentConversationId,
    createConversation,
    selectConversation,
    deleteConversation,
    pinConversation,
    connected,
  } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [conversationToExport, setConversationToExport] = useState<Conversation | null>(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchDialogOpen(true);
      }
      // Cmd/Ctrl + N for new chat
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        createConversation();
      }
      // Cmd/Ctrl + , for settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createConversation]);

  // Search across both titles and message content
  const filteredConversations = conversations.filter((c) => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    
    // Check title
    if (c.title.toLowerCase().includes(query)) return true;
    
    // Check message content
    return c.messages.some((m) => 
      m.content.toLowerCase().includes(query)
    );
  });

  const pinnedConversations = filteredConversations.filter((c) => c.isPinned);
  const recentConversations = filteredConversations.filter((c) => !c.isPinned);

  const handleNewChat = () => {
    createConversation();
  };

  const handleExport = (conversation: Conversation) => {
    setConversationToExport(conversation);
    setExportDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header with connection status - draggable for macOS title bar */}
      <div 
        className={cn("p-3 pb-0", isMacOS && "pt-2")}
        data-tauri-drag-region
      >
        <div 
          className={cn("flex items-center gap-2 mb-3 px-1", isMacOS && "pl-[70px]")}
          data-tauri-drag-region
        >
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <span className="text-2xl select-none" role="img" aria-label="Moltzer logo">🦞</span>
            <span className="font-semibold text-lg select-none">Moltzer</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto" role="status" aria-live="polite">
            <span className="relative flex w-2 h-2">
              {connected && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              )}
              <span
                className={cn(
                  "relative inline-flex w-2 h-2 rounded-full transition-colors",
                  connected ? "bg-green-500" : "bg-red-500"
                )}
              />
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {connected ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* New chat button */}
      <div className="px-3 pb-3">
        <Button
          onClick={handleNewChat}
          variant="primary"
          size="md"
          className="w-full justify-start"
          leftIcon={<Plus className="w-4 h-4" />}
          aria-label="Create new conversation"
        >
          <span className="flex-1 text-left">New Chat</span>
          <kbd className="text-xs opacity-70 font-mono">⌘N</kbd>
        </Button>
      </div>

      {/* Search button */}
      <div className="px-3 pb-2">
        <Button
          onClick={() => setSearchDialogOpen(true)}
          variant="outline"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          leftIcon={<Search className="w-4 h-4" />}
          aria-label="Search messages"
        >
          <span className="flex-1 text-left">Search messages...</span>
          <kbd className="text-xs font-mono">⌘K</kbd>
        </Button>
      </div>

      {/* Quick filter */}
      <div className="px-3 pb-2">
        <label htmlFor="conversation-filter" className="sr-only">
          Filter conversations by title or content
        </label>
        <input
          id="conversation-filter"
          type="text"
          placeholder="Filter conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          aria-label="Filter conversations"
        />
      </div>

      {/* Conversation list */}
      <ScrollShadow className="flex-1 px-2">
        {conversationsLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            {pinnedConversations.length > 0 && (
              <ConversationSection
                title="Pinned"
                conversations={pinnedConversations}
                currentId={currentConversationId}
                onSelect={selectConversation}
                onDelete={deleteConversation}
                onPin={pinConversation}
                onExport={handleExport}
              />
            )}

            {recentConversations.length > 0 && (
              <ConversationSection
                title="Recent"
                conversations={recentConversations}
                currentId={currentConversationId}
                onSelect={selectConversation}
                onDelete={deleteConversation}
                onPin={pinConversation}
                onExport={handleExport}
              />
            )}
          </>
        )}

        {!conversationsLoading && filteredConversations.length === 0 && (
          searchQuery ? (
            <EmptyState
              icon={<Search className="w-8 h-8" strokeWidth={1.5} />}
              title="No matches"
              description={`No conversations match "${searchQuery}"`}
            />
          ) : (
            <EmptyState
              icon={<MessageSquare className="w-8 h-8" strokeWidth={1.5} />}
              title="No conversations yet"
              description="Start a new chat to begin"
              action={
                <Button
                  onClick={handleNewChat}
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  aria-label="Create your first conversation"
                >
                  New Chat
                </Button>
              }
            />
          )
        )}
      </ScrollShadow>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        <Button
          onClick={() => setSettingsOpen(true)}
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          leftIcon={<Settings className="w-4 h-4" />}
          aria-label="Open settings"
        >
          <span className="flex-1 text-left">Settings</span>
          <kbd className="text-xs font-mono opacity-50">⌘,</kbd>
        </Button>
      </div>

      {/* Dialogs - lazy loaded for better performance */}
      <Suspense fallback={null}>
        <SettingsDialog 
          open={settingsOpen} 
          onClose={() => setSettingsOpen(false)}
          onRerunSetup={onRerunSetup}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SearchDialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} />
      </Suspense>
      {conversationToExport && (
        <Suspense fallback={null}>
          <ExportDialog
            open={exportDialogOpen}
            onClose={() => {
              setExportDialogOpen(false);
              setConversationToExport(null);
            }}
            conversation={conversationToExport}
          />
        </Suspense>
      )}
    </div>
  );
}

interface ConversationSectionProps {
  title: string;
  icon?: React.ReactNode;
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onExport: (conversation: Conversation) => void;
}

function ConversationSection({
  title,
  icon,
  conversations,
  currentId,
  onSelect,
  onDelete,
  onPin,
  onExport,
}: ConversationSectionProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Use virtualization for long lists (>30 items) to improve performance
  const shouldVirtualize = conversations.length > 30;
  
  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated height of each conversation item
    enabled: shouldVirtualize,
  });

  if (shouldVirtualize) {
    return (
      <div className="mb-4">
        <h3 className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {icon || (title === "Pinned" ? <Pin className="w-3 h-3" /> : null)}
          {title}
        </h3>
        <div ref={parentRef} className="space-y-0.5">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const conversation = conversations[virtualItem.index];
              return (
                <div
                  key={conversation.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <ConversationItem
                    conversation={conversation}
                    isSelected={conversation.id === currentId}
                    onSelect={() => onSelect(conversation.id)}
                    onDelete={() => onDelete(conversation.id)}
                    onPin={() => onPin(conversation.id)}
                    onExport={() => onExport(conversation)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Default non-virtualized rendering for shorter lists
  return (
    <div className="mb-4">
      <h3 className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {icon || (title === "Pinned" ? <Pin className="w-3 h-3" /> : null)}
        {title}
      </h3>
      <div className="space-y-0.5">
        {conversations.map((conversation, index) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={conversation.id === currentId}
            onSelect={() => onSelect(conversation.id)}
            onDelete={() => onDelete(conversation.id)}
            onPin={() => onPin(conversation.id)}
            onExport={() => onExport(conversation)}
            style={{ animationDelay: `${index * 30}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPin: () => void;
  onExport: () => void;
  style?: React.CSSProperties;
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onDelete,
  onPin,
  onExport,
  style,
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
    setShowMenu(false);
  };

  const handleExport = () => {
    onExport();
    setShowMenu(false);
  };

  return (
    <button
      className={cn(
        "group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all w-full text-left",
        "animate-in fade-in slide-in-from-left-2 duration-200",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        isSelected 
          ? "bg-muted shadow-sm" 
          : "hover:bg-muted/50"
      )}
      style={style}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          setShowDeleteConfirm(true);
        }
      }}
      aria-label={`Conversation: ${conversation.title}${isSelected ? " (active)" : ""}`}
      aria-current={isSelected ? "page" : undefined}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{conversation.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
        </p>
      </div>

      {/* Actions (visible on hover) */}
      <div className={cn(
        "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
        showMenu && "opacity-100"
      )}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          className="p-1 hover:bg-background rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          title={conversation.isPinned ? "Unpin conversation" : "Pin conversation"}
          aria-label={conversation.isPinned ? "Unpin conversation" : "Pin conversation"}
        >
          <Pin 
            className={cn(
              "w-3.5 h-3.5",
              conversation.isPinned ? "text-orange-500 fill-current" : "text-muted-foreground"
            )}
          />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(true);
          }}
          className="p-1 hover:bg-background rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="More options"
          aria-expanded={showMenu}
          aria-haspopup="menu"
        >
          <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Context menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-100">
            <button
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onPin();
                setShowMenu(false);
              }}
            >
              <Pin className="w-4 h-4" />
              {conversation.isPinned ? "Unpin" : "Pin"}
            </button>
            <button
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleExport();
              }}
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="w-full px-3 py-2 text-sm text-left text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
                setShowMenu(false);
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Conversation?"
        description={`Are you sure you want to delete "${conversation.title}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="destructive"
      />
    </button>
  );
}
