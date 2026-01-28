/**
 * Sidebar Component Tests
 *
 * Tests the sidebar navigation including:
 * - Conversation listing and selection
 * - Filter/search functionality
 * - Keyboard shortcuts (Cmd+K, Cmd+N, Cmd+,)
 * - Pin/unpin from context menu
 * - Connection status display
 * - Empty states
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import { useStore } from "../stores/store";

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock lazy-loaded dialogs
vi.mock("./SettingsDialog", () => ({
  SettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="settings-dialog">Settings Dialog</div> : null,
}));
vi.mock("./SearchDialog", () => ({
  SearchDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="search-dialog">Search Dialog</div> : null,
}));
vi.mock("./ExportDialog", () => ({
  ExportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="export-dialog">Export Dialog</div> : null,
}));

// Mock ScrollShadow to avoid ResizeObserver issues
vi.mock("./ui/scroll-shadow", () => ({
  ScrollShadow: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

// Mock react-virtual (not needed for tests with <30 items)
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
  }),
}));

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.reject(new Error("Key not found"))),
}));

// Mock lucide-react (include all icons used by Sidebar and its sub-components)
vi.mock("lucide-react", () => ({
  Plus: () => <svg />,
  Search: () => <svg />,
  Settings: () => <svg />,
  Pin: () => <svg />,
  MoreVertical: () => <svg />,
  Trash2: () => <svg />,
  MessageSquare: () => <svg />,
  Download: () => <svg />,
  AlertTriangle: () => <svg />,
  X: () => <svg />,
}));

describe("Sidebar", () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store
    const store = useStore.getState();
    store.conversations.forEach((c) => store.deleteConversation(c.id));
    store.setConnected(false);
  });

  describe("connection status", () => {
    it("should show Offline status when disconnected", () => {
      const store = useStore.getState();
      store.setConnected(false);

      render(<Sidebar onToggle={mockOnToggle} />);

      expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    it("should show Online status when connected", () => {
      const store = useStore.getState();
      store.setConnected(true);

      render(<Sidebar onToggle={mockOnToggle} />);

      expect(screen.getByText("Online")).toBeInTheDocument();
    });
  });

  describe("new conversation", () => {
    it("should create new conversation when New Chat button is clicked", async () => {
      const user = userEvent.setup();
      render(<Sidebar onToggle={mockOnToggle} />);

      const newChatBtn = screen.getByLabelText("Create new conversation");
      await user.click(newChatBtn);

      const state = useStore.getState();
      expect(state.conversations).toHaveLength(1);
      expect(state.conversations[0].title).toBe("New Chat");
    });

    it("should create new conversation with Cmd+N keyboard shortcut", () => {
      render(<Sidebar onToggle={mockOnToggle} />);

      fireEvent.keyDown(window, { key: "n", ctrlKey: true });

      const state = useStore.getState();
      expect(state.conversations).toHaveLength(1);
    });
  });

  describe("conversation listing", () => {
    it("should display conversations in the sidebar", () => {
      const store = useStore.getState();
      const conv1 = store.createConversation();
      store.updateConversation(conv1.id, { title: "My First Chat" });
      const conv2 = store.createConversation();
      store.updateConversation(conv2.id, { title: "My Second Chat" });

      render(<Sidebar onToggle={mockOnToggle} />);

      expect(screen.getByText("My First Chat")).toBeInTheDocument();
      expect(screen.getByText("My Second Chat")).toBeInTheDocument();
    });

    it("should select conversation when clicked", async () => {
      const user = userEvent.setup();
      const store = useStore.getState();
      const conv = store.createConversation();
      store.updateConversation(conv.id, { title: "Clickable Chat" });

      render(<Sidebar onToggle={mockOnToggle} />);

      const convItem = screen.getByText("Clickable Chat");
      await user.click(convItem);

      expect(useStore.getState().currentConversationId).toBe(conv.id);
    });

    it("should show selected state for current conversation", () => {
      const store = useStore.getState();
      const conv = store.createConversation();
      store.updateConversation(conv.id, { title: "Active Chat" });
      store.selectConversation(conv.id);

      render(<Sidebar onToggle={mockOnToggle} />);

      // The active conversation should have aria-current="page"
      const convBtn = screen.getByLabelText(
        /Conversation: Active Chat \(active\)/,
      );
      expect(convBtn).toHaveAttribute("aria-current", "page");
    });

    it("should show empty state when no conversations exist", () => {
      render(<Sidebar onToggle={mockOnToggle} />);

      expect(screen.getByText("Ready to chat?")).toBeInTheDocument();
      expect(screen.getByText("Create your first conversation to get started")).toBeInTheDocument();
    });
  });

  describe("conversation filtering", () => {
    it("should filter conversations by title", async () => {
      const user = userEvent.setup();
      const store = useStore.getState();
      const conv1 = store.createConversation();
      store.updateConversation(conv1.id, { title: "TypeScript Tutorial" });
      const conv2 = store.createConversation();
      store.updateConversation(conv2.id, { title: "Python Basics" });

      render(<Sidebar onToggle={mockOnToggle} />);

      const filterInput = screen.getByLabelText("Filter conversations");
      await user.type(filterInput, "TypeScript");

      expect(screen.getByText("TypeScript Tutorial")).toBeInTheDocument();
      expect(screen.queryByText("Python Basics")).not.toBeInTheDocument();
    });

    it("should filter conversations by message content", async () => {
      const user = userEvent.setup();
      const store = useStore.getState();

      const conv1 = store.createConversation();
      // Add message first (this auto-generates title), then override
      store.addMessage(conv1.id, {
        role: "user",
        content: "Tell me about quantum computing",
      });
      store.updateConversation(conv1.id, { title: "Chat 1" });

      const conv2 = store.createConversation();
      store.addMessage(conv2.id, {
        role: "user",
        content: "How to cook pasta",
      });
      store.updateConversation(conv2.id, { title: "Chat 2" });

      render(<Sidebar onToggle={mockOnToggle} />);

      const filterInput = screen.getByLabelText("Filter conversations");
      await user.type(filterInput, "quantum");

      expect(screen.getByText("Chat 1")).toBeInTheDocument();
      expect(screen.queryByText("Chat 2")).not.toBeInTheDocument();
    });

    it("should show no matches message when filter returns nothing", async () => {
      const user = userEvent.setup();
      const store = useStore.getState();
      store.createConversation();

      render(<Sidebar onToggle={mockOnToggle} />);

      const filterInput = screen.getByLabelText("Filter conversations");
      await user.type(filterInput, "xyznonexistent");

      expect(screen.getByText("No matches found")).toBeInTheDocument();
      expect(screen.getByText("Try a different search term")).toBeInTheDocument();
    });

    it("should show all conversations when filter is empty", async () => {
      const user = userEvent.setup();
      const store = useStore.getState();
      const conv1 = store.createConversation();
      store.updateConversation(conv1.id, { title: "First" });
      const conv2 = store.createConversation();
      store.updateConversation(conv2.id, { title: "Second" });

      render(<Sidebar onToggle={mockOnToggle} />);

      // Type and then clear filter
      const filterInput = screen.getByLabelText("Filter conversations");
      await user.type(filterInput, "First");
      expect(screen.queryByText("Second")).not.toBeInTheDocument();

      await user.clear(filterInput);
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    });
  });

  describe("pinned conversations", () => {
    it("should separate pinned and recent conversations", () => {
      const store = useStore.getState();
      const pinned = store.createConversation();
      store.updateConversation(pinned.id, { title: "Pinned Chat" });
      store.pinConversation(pinned.id);

      const recent = store.createConversation();
      store.updateConversation(recent.id, { title: "Recent Chat" });

      render(<Sidebar onToggle={mockOnToggle} />);

      expect(screen.getByText("Pinned")).toBeInTheDocument();
      expect(screen.getByText("Recent")).toBeInTheDocument();
      expect(screen.getByText("Pinned Chat")).toBeInTheDocument();
      expect(screen.getByText("Recent Chat")).toBeInTheDocument();
    });

    it("should not show Pinned section when no conversations are pinned", () => {
      const store = useStore.getState();
      store.createConversation();

      render(<Sidebar onToggle={mockOnToggle} />);

      expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
      expect(screen.getByText("Recent")).toBeInTheDocument();
    });
  });

  describe("keyboard shortcuts", () => {
    it("should open search dialog with Cmd+K", () => {
      render(<Sidebar onToggle={mockOnToggle} />);

      fireEvent.keyDown(window, { key: "k", ctrlKey: true });

      expect(screen.getByTestId("search-dialog")).toBeInTheDocument();
    });

    it("should open settings dialog with Cmd+,", () => {
      render(<Sidebar onToggle={mockOnToggle} />);

      fireEvent.keyDown(window, { key: ",", ctrlKey: true });

      expect(screen.getByTestId("settings-dialog")).toBeInTheDocument();
    });

    it("should create new conversation with Cmd+N", () => {
      render(<Sidebar onToggle={mockOnToggle} />);

      const initialCount = useStore.getState().conversations.length;
      fireEvent.keyDown(window, { key: "n", ctrlKey: true });

      expect(useStore.getState().conversations.length).toBe(initialCount + 1);
    });
  });

  describe("settings button", () => {
    it("should show settings dialog when settings button clicked", async () => {
      const user = userEvent.setup();
      render(<Sidebar onToggle={mockOnToggle} />);

      const settingsBtn = screen.getByLabelText("Open settings");
      await user.click(settingsBtn);

      expect(screen.getByTestId("settings-dialog")).toBeInTheDocument();
    });
  });

  describe("search button", () => {
    it("should show search dialog when search button clicked", async () => {
      const user = userEvent.setup();
      render(<Sidebar onToggle={mockOnToggle} />);

      const searchBtn = screen.getByLabelText("Search messages");
      await user.click(searchBtn);

      expect(screen.getByTestId("search-dialog")).toBeInTheDocument();
    });
  });

  describe("conversation context menu", () => {
    it("should show pin button on hover", () => {
      const store = useStore.getState();
      const conv = store.createConversation();
      store.updateConversation(conv.id, { title: "Pin Me" });

      render(<Sidebar onToggle={mockOnToggle} />);

      // Pin button exists but is initially hidden (opacity-0)
      const pinBtn = screen.getByLabelText("Pin conversation");
      expect(pinBtn).toBeInTheDocument();
    });

    it("should show more options button", () => {
      const store = useStore.getState();
      const conv = store.createConversation();
      store.updateConversation(conv.id, { title: "More Options" });

      render(<Sidebar onToggle={mockOnToggle} />);

      const moreBtn = screen.getByLabelText("More options");
      expect(moreBtn).toBeInTheDocument();
    });
  });

  describe("keyboard navigation on conversations", () => {
    it("should select conversation on Enter key", async () => {
      const store = useStore.getState();
      const conv = store.createConversation();
      store.updateConversation(conv.id, { title: "Keyboard Nav" });

      render(<Sidebar onToggle={mockOnToggle} />);

      const convBtn = screen.getByLabelText(/Conversation: Keyboard Nav/);
      fireEvent.keyDown(convBtn, { key: "Enter" });

      expect(useStore.getState().currentConversationId).toBe(conv.id);
    });

    it("should select conversation on Space key", async () => {
      const store = useStore.getState();
      const conv = store.createConversation();
      store.updateConversation(conv.id, { title: "Space Nav" });

      render(<Sidebar onToggle={mockOnToggle} />);

      const convBtn = screen.getByLabelText(/Conversation: Space Nav/);
      fireEvent.keyDown(convBtn, { key: " " });

      expect(useStore.getState().currentConversationId).toBe(conv.id);
    });

    it("should show delete confirmation on Delete key", () => {
      const store = useStore.getState();
      const conv = store.createConversation();
      store.updateConversation(conv.id, { title: "Delete Me" });

      render(<Sidebar onToggle={mockOnToggle} />);

      const convBtn = screen.getByLabelText(/Conversation: Delete Me/);
      fireEvent.keyDown(convBtn, { key: "Delete" });

      // Delete confirmation dialog should appear
      expect(screen.getByText("Delete Conversation?")).toBeInTheDocument();
    });
  });

  describe("Moltz branding", () => {
    it("should show Moltz logo and name", () => {
      render(<Sidebar onToggle={mockOnToggle} />);

      expect(screen.getByLabelText("Moltz logo")).toBeInTheDocument();
      expect(screen.getByText("Moltz")).toBeInTheDocument();
    });
  });
});
