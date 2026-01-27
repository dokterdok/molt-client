import { useState, useEffect } from "react";
import { useStore, Conversation } from "../stores/store";
import { SettingsDialog } from "./SettingsDialog";
import { SearchDialog } from "./SearchDialog";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";

// Check if running on macOS (for traffic light padding)
const isMacOS = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

interface SidebarProps {
  onToggle: () => void;
}

export function Sidebar({ onToggle: _onToggle }: SidebarProps) {
  const {
    conversations,
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
            <span className="text-2xl select-none" role="img" aria-label="Molt logo">🦞</span>
            <span className="font-semibold text-lg select-none">Molt</span>
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
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Create new conversation"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="flex-1 text-left">New Chat</span>
          <kbd className="text-xs opacity-70 font-mono">⌘N</kbd>
        </button>
      </div>

      {/* Search button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setSearchDialogOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-background/50 hover:bg-muted/50 transition-colors text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Search messages"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="flex-1 text-left">Search messages...</span>
          <kbd className="text-xs font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Quick filter */}
      <div className="px-3 pb-2">
        <input
          type="text"
          placeholder="Filter conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          aria-label="Filter conversations by title or content"
        />
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
        {pinnedConversations.length > 0 && (
          <ConversationSection
            title="Pinned"
            icon={
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
                <path d="M8 10h4v7l-2-2-2 2v-7z" />
              </svg>
            }
            conversations={pinnedConversations}
            currentId={currentConversationId}
            onSelect={selectConversation}
            onDelete={deleteConversation}
            onPin={pinConversation}
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
          />
        )}

        {filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center text-muted-foreground text-sm py-12 px-4">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {searchQuery ? (
              <p>No conversations match "{searchQuery}"</p>
            ) : (
              <>
                <p className="font-medium">No conversations yet</p>
                <p className="text-xs mt-1">Start a new chat to begin</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Open settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="flex-1 text-left">Settings</span>
          <kbd className="text-xs font-mono opacity-50">⌘,</kbd>
        </button>
      </div>

      {/* Dialogs */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SearchDialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} />
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
}

function ConversationSection({
  title,
  icon,
  conversations,
  currentId,
  onSelect,
  onDelete,
  onPin,
}: ConversationSectionProps) {
  return (
    <div className="mb-4">
      <h3 className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {icon}
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
  style?: React.CSSProperties;
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onDelete,
  onPin,
  style,
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);

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
          onDelete();
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
          <svg 
            className={cn(
              "w-3.5 h-3.5",
              conversation.isPinned ? "text-orange-500" : "text-muted-foreground"
            )} 
            fill={conversation.isPinned ? "currentColor" : "none"}
            stroke="currentColor" 
            viewBox="0 0 20 20"
          >
            <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
            <path d="M8 10h4v7l-2-2-2 2v-7z" />
          </svg>
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
          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
                <path d="M8 10h4v7l-2-2-2 2v-7z" />
              </svg>
              {conversation.isPinned ? "Unpin" : "Pin"}
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="w-full px-3 py-2 text-sm text-left text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setShowMenu(false);
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </>
      )}
    </button>
  );
}
