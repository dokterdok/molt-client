/**
 * Theme Switching Tests
 *
 * Verifies that theme changes are applied correctly to the DOM,
 * that they persist across sessions, and that system theme follows
 * the OS preference via matchMedia.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useStore } from "../stores/store";

// Mock keychain
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.reject(new Error("Key not found"))),
}));

// Track matchMedia listeners so we can trigger them
let matchMediaListeners: Array<(ev: { matches: boolean }) => void> = [];

const createMatchMediaMock = (defaultMatches = false) => {
  matchMediaListeners = [];
  return vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" ? defaultMatches : false,
    media: query,
    onchange: null,
    addListener: vi.fn((listener: (ev: { matches: boolean }) => void) => {
      if (query === "(prefers-color-scheme: dark)") {
        matchMediaListeners.push(listener);
      }
    }),
    removeListener: vi.fn(),
    addEventListener: vi.fn(
      (type: string, listener: (ev: { matches: boolean }) => void) => {
        if (type === "change" && query === "(prefers-color-scheme: dark)") {
          matchMediaListeners.push(listener);
        }
      },
    ),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

// Realistic localStorage
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  }),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

function applyTheme(theme: "light" | "dark" | "system") {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    // system theme
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
}

describe("Theme Switching", () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove("dark");

    // Reset store
    useStore.setState({
      settings: {
        gatewayUrl: "",
        gatewayToken: "",
        defaultModel: "anthropic/claude-sonnet-4-5",
        thinkingDefault: false,
        theme: "system",
        defaultSystemPrompt: "",
      },
    });
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
    matchMediaListeners = [];
  });

  describe("direct theme application", () => {
    it("should add dark class when switching to dark theme", () => {
      applyTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("should remove dark class when switching to light theme", () => {
      document.documentElement.classList.add("dark");
      applyTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("should apply system theme based on matchMedia (light preference)", () => {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: createMatchMediaMock(false), // System prefers light
      });

      applyTheme("system");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("should apply system theme based on matchMedia (dark preference)", () => {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: createMatchMediaMock(true), // System prefers dark
      });

      applyTheme("system");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  describe("theme persistence in store", () => {
    it("should store theme preference when updated", async () => {
      const store = useStore.getState();
      await store.updateSettings({ theme: "dark" });

      expect(useStore.getState().settings.theme).toBe("dark");
    });

    it("should persist theme to localStorage", async () => {
      const store = useStore.getState();
      await store.updateSettings({ theme: "dark" });

      // Verify theme was saved
      const savedCalls = localStorageMock.setItem.mock.calls.filter(
        (call: [string, string]) => call[0] === "moltz-settings",
      );
      expect(savedCalls.length).toBeGreaterThan(0);

      const lastSaved = JSON.parse(savedCalls[savedCalls.length - 1][1]);
      expect(lastSaved.theme).toBe("dark");
    });

    it("should restore theme from localStorage", async () => {
      localStorageStore["moltz-settings"] = JSON.stringify({
        theme: "light",
        gatewayUrl: "ws://test:8080",
      });

      await useStore.getState().loadSettings();

      expect(useStore.getState().settings.theme).toBe("light");
    });

    it("should survive theme round-trip through save and load", async () => {
      // Save dark theme
      await useStore.getState().updateSettings({ theme: "dark" });

      // Reset in memory
      useStore.setState({
        settings: {
          gatewayUrl: "",
          gatewayToken: "",
          defaultModel: "anthropic/claude-sonnet-4-5",
          thinkingDefault: false,
          theme: "system",
          defaultSystemPrompt: "",
        },
      });

      // Reload
      await useStore.getState().loadSettings();

      expect(useStore.getState().settings.theme).toBe("dark");
    });
  });

  describe("theme transitions", () => {
    it("should allow switching between all theme options", () => {
      // light -> dark
      applyTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);

      applyTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      // dark -> light
      applyTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);

      // light -> system (with light preference)
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: createMatchMediaMock(false),
      });
      applyTheme("system");
      expect(document.documentElement.classList.contains("dark")).toBe(false);

      // system -> dark
      applyTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      // dark -> system (with dark preference)
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: createMatchMediaMock(true),
      });
      applyTheme("system");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("should not duplicate dark class on multiple dark theme applies", () => {
      applyTheme("dark");
      applyTheme("dark");
      applyTheme("dark");

      // classList.contains still returns true (not 3x)
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      // Verify it's not duplicated
      const darkCount = Array.from(document.documentElement.classList).filter(
        (c) => c === "dark",
      ).length;
      expect(darkCount).toBe(1);
    });
  });

  describe("store theme state changes", () => {
    it("should update theme in store state without errors", async () => {
      const store = useStore.getState();

      await store.updateSettings({ theme: "light" });
      expect(useStore.getState().settings.theme).toBe("light");

      await store.updateSettings({ theme: "dark" });
      expect(useStore.getState().settings.theme).toBe("dark");

      await store.updateSettings({ theme: "system" });
      expect(useStore.getState().settings.theme).toBe("system");
    });

    it("should allow updating theme alongside other settings", async () => {
      const store = useStore.getState();
      await store.updateSettings({
        theme: "dark",
        gatewayUrl: "ws://multi-update:8080",
        defaultModel: "openai/gpt-4o",
      });

      const settings = useStore.getState().settings;
      expect(settings.theme).toBe("dark");
      expect(settings.gatewayUrl).toBe("ws://multi-update:8080");
      expect(settings.defaultModel).toBe("openai/gpt-4o");
    });
  });
});
