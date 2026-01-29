import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useStore, ModelInfo } from "../stores/store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../lib/utils";
import {
  Search,
  Plus,
  Settings,
  Moon,
  Sun,
  Monitor,
  Cpu,
  MessageSquare,
  Zap,
  PanelLeftClose,
  PanelLeft,
  Command,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: "actions" | "navigation" | "models" | "settings";
}

export function CommandPalette({
  open,
  onClose,
  onOpenSettings,
  onOpenSearch,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    createConversation,
    selectConversation,
    conversations,
    settings,
    updateSettings,
    availableModels,
    currentConversationId,
  } = useStore(
    useShallow((state) => ({
      createConversation: state.createConversation,
      selectConversation: state.selectConversation,
      conversations: state.conversations,
      settings: state.settings,
      updateSettings: state.updateSettings,
      availableModels: state.availableModels,
      currentConversationId: state.currentConversationId,
    }))
  );

  const currentConversation = currentConversationId
    ? conversations.find((c) => c.id === currentConversationId)
    : null;

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Actions
      {
        id: "new-chat",
        label: "New Chat",
        description: "Start a new conversation",
        icon: <Plus className="w-4 h-4" />,
        shortcut: "⌘N",
        action: () => {
          createConversation();
          onClose();
        },
        category: "actions",
      },
      {
        id: "search",
        label: "Search Messages",
        description: "Search across all conversations",
        icon: <Search className="w-4 h-4" />,
        shortcut: "⌘F",
        action: () => {
          onClose();
          onOpenSearch();
        },
        category: "actions",
      },
      // Settings
      {
        id: "settings",
        label: "Open Settings",
        description: "Configure Moltz",
        icon: <Settings className="w-4 h-4" />,
        shortcut: "⌘,",
        action: () => {
          onClose();
          onOpenSettings();
        },
        category: "settings",
      },
      {
        id: "toggle-compact",
        label: settings.compactMode ? "Disable Compact Mode" : "Enable Compact Mode",
        description: "Toggle information density",
        icon: <Zap className="w-4 h-4" />,
        action: () => {
          updateSettings({ compactMode: !settings.compactMode });
          onClose();
        },
        category: "settings",
      },
      {
        id: "toggle-sidebar",
        label: settings.sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar",
        description: "Toggle sidebar visibility",
        icon: settings.sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />,
        shortcut: "⌘\\",
        action: () => {
          updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed });
          onClose();
        },
        category: "settings",
      },
      // Theme
      {
        id: "theme-light",
        label: "Light Theme",
        icon: <Sun className="w-4 h-4" />,
        action: () => {
          updateSettings({ theme: "light" });
          onClose();
        },
        category: "settings",
      },
      {
        id: "theme-dark",
        label: "Dark Theme",
        icon: <Moon className="w-4 h-4" />,
        action: () => {
          updateSettings({ theme: "dark" });
          onClose();
        },
        category: "settings",
      },
      {
        id: "theme-system",
        label: "System Theme",
        icon: <Monitor className="w-4 h-4" />,
        action: () => {
          updateSettings({ theme: "system" });
          onClose();
        },
        category: "settings",
      },
    ];

    // Add model switching commands
    availableModels.forEach((model: ModelInfo) => {
      const isCurrentDefault = settings.defaultModel === model.id;
      items.push({
        id: `model-${model.id}`,
        label: `Switch to ${model.name}`,
        description: isCurrentDefault ? "Current default" : model.provider,
        icon: <Cpu className="w-4 h-4" />,
        action: () => {
          if (currentConversation) {
            useStore.getState().updateConversation(currentConversation.id, { model: model.id });
          }
          onClose();
        },
        category: "models",
      });
    });

    // Add recent conversations for quick navigation
    const recentConvs = conversations.slice(0, 5);
    recentConvs.forEach((conv) => {
      if (conv.id !== currentConversationId) {
        items.push({
          id: `conv-${conv.id}`,
          label: conv.title || "Untitled",
          description: `${conv.messages.length} messages`,
          icon: <MessageSquare className="w-4 h-4" />,
          action: () => {
            selectConversation(conv.id);
            onClose();
          },
          category: "navigation",
        });
      }
    });

    return items;
  }, [
    createConversation,
    onClose,
    onOpenSearch,
    onOpenSettings,
    settings,
    updateSettings,
    availableModels,
    conversations,
    currentConversation,
    currentConversationId,
    selectConversation,
  ]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      actions: [],
      navigation: [],
      models: [],
      settings: [],
    };
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Command className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Command search"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded">
              esc
            </kbd>
          </div>

          {/* Command list */}
          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No commands found
              </div>
            ) : (
              <>
                {/* Actions */}
                {groupedCommands.actions.length > 0 && (
                  <CommandGroup label="Actions">
                    {groupedCommands.actions.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          selected={index === selectedIndex}
                          onSelect={cmd.action}
                          onHover={() => setSelectedIndex(index)}
                        />
                      );
                    })}
                  </CommandGroup>
                )}

                {/* Navigation */}
                {groupedCommands.navigation.length > 0 && (
                  <CommandGroup label="Recent Chats">
                    {groupedCommands.navigation.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          selected={index === selectedIndex}
                          onSelect={cmd.action}
                          onHover={() => setSelectedIndex(index)}
                        />
                      );
                    })}
                  </CommandGroup>
                )}

                {/* Models */}
                {groupedCommands.models.length > 0 && (
                  <CommandGroup label="Models">
                    {groupedCommands.models.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          selected={index === selectedIndex}
                          onSelect={cmd.action}
                          onHover={() => setSelectedIndex(index)}
                        />
                      );
                    })}
                  </CommandGroup>
                )}

                {/* Settings */}
                {groupedCommands.settings.length > 0 && (
                  <CommandGroup label="Settings">
                    {groupedCommands.settings.map((cmd) => {
                      const index = flatIndex++;
                      return (
                        <CommandRow
                          key={cmd.id}
                          command={cmd}
                          selected={index === selectedIndex}
                          onSelect={cmd.action}
                          onHover={() => setSelectedIndex(index)}
                        />
                      );
                    })}
                  </CommandGroup>
                )}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd> select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function CommandGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  );
}

function CommandRow({
  command,
  selected,
  onSelect,
  onHover,
}: {
  command: CommandItem;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
        selected ? "bg-primary/10 text-primary" : "hover:bg-muted"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
      data-selected={selected}
    >
      <span className={cn("flex-shrink-0", selected ? "text-primary" : "text-muted-foreground")}>
        {command.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{command.label}</div>
        {command.description && (
          <div className="text-xs text-muted-foreground truncate">
            {command.description}
          </div>
        )}
      </div>
      {command.shortcut && (
        <kbd className="flex-shrink-0 px-1.5 py-0.5 text-xs text-muted-foreground bg-muted rounded">
          {command.shortcut}
        </kbd>
      )}
    </button>
  );
}
