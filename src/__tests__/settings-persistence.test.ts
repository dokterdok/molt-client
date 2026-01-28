/**
 * Settings Persistence Tests
 * 
 * Tests the critical path of settings being saved to localStorage
 * and loaded back across sessions. Also tests the token migration
 * path from localStorage to OS keychain.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useStore } from '../stores/store';

// Realistic localStorage mock that actually stores data
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    // Expose the raw store for inspection
    _store: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
};

// Mock keychain to capture what's stored
let keychainStore: Record<string, string> = {};
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, params?: Record<string, string>) => {
    if (command === 'keychain_get') {
      const key = params?.key || '';
      if (keychainStore[key] !== undefined) {
        return Promise.resolve(keychainStore[key]);
      }
      return Promise.reject(new Error('Key not found'));
    }
    if (command === 'keychain_set') {
      keychainStore[params?.key || ''] = params?.value || '';
      return Promise.resolve();
    }
    if (command === 'keychain_delete') {
      delete keychainStore[params?.key || ''];
      return Promise.resolve();
    }
    return Promise.reject(new Error('Unknown command'));
  }),
}));

const localStorageMock = createLocalStorageMock();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

describe('Settings Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    keychainStore = {};
    
    // Reset store to defaults
    const store = useStore.getState();
    store.setConnected(false);
    // Reset settings to defaults
    useStore.setState({
      settings: {
        gatewayUrl: '',
        gatewayToken: '',
        defaultModel: 'anthropic/claude-sonnet-4-5',
        thinkingDefault: false,
        theme: 'system',
        defaultSystemPrompt: '',
      },
    });
  });

  afterEach(() => {
    localStorageMock.clear();
    keychainStore = {};
  });

  describe('saving settings to localStorage', () => {
    it('should save settings to localStorage when updateSettings is called', async () => {
      const store = useStore.getState();
      await store.updateSettings({
        gatewayUrl: 'ws://myserver:8080',
        theme: 'dark',
        defaultModel: 'openai/gpt-4o',
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Verify the saved data
      const savedJson = localStorageMock.setItem.mock.calls.find(
        (call: [string, string]) => call[0] === 'moltzer-settings'
      );
      expect(savedJson).toBeDefined();
      
      const savedSettings = JSON.parse(savedJson![1]);
      expect(savedSettings.gatewayUrl).toBe('ws://myserver:8080');
      expect(savedSettings.theme).toBe('dark');
      expect(savedSettings.defaultModel).toBe('openai/gpt-4o');
    });

    it('should NOT save gatewayToken to localStorage', async () => {
      const store = useStore.getState();
      await store.updateSettings({
        gatewayToken: 'secret-token-123',
        gatewayUrl: 'ws://test:8080',
      });

      // Find the moltzer-settings call
      const savedJson = localStorageMock.setItem.mock.calls.find(
        (call: [string, string]) => call[0] === 'moltzer-settings'
      );
      expect(savedJson).toBeDefined();
      
      const savedSettings = JSON.parse(savedJson![1]);
      expect(savedSettings.gatewayToken).toBeUndefined();
    });

    it('should save token to keychain when updated', async () => {
      const store = useStore.getState();
      await store.updateSettings({
        gatewayToken: 'my-secret-token',
      });

      // Token should be in the keychain store
      expect(keychainStore['gateway_token']).toBe('my-secret-token');
    });

    it('should delete token from keychain when set to empty', async () => {
      // First set a token
      keychainStore['gateway_token'] = 'existing-token';
      
      const store = useStore.getState();
      await store.updateSettings({
        gatewayToken: '',
      });

      // Token should be removed from keychain
      expect(keychainStore['gateway_token']).toBeUndefined();
    });
  });

  describe('loading settings from localStorage', () => {
    it('should load settings from localStorage on loadSettings', async () => {
      // Pre-populate localStorage with saved settings
      localStorageMock._setStore({
        'moltzer-settings': JSON.stringify({
          gatewayUrl: 'ws://saved-server:9090',
          theme: 'light',
          defaultModel: 'google/gemini-2.5-pro',
          thinkingDefault: true,
          defaultSystemPrompt: 'You are a helpful bot.',
        }),
      });

      const store = useStore.getState();
      await store.loadSettings();

      const settings = useStore.getState().settings;
      expect(settings.gatewayUrl).toBe('ws://saved-server:9090');
      expect(settings.theme).toBe('light');
      expect(settings.defaultModel).toBe('google/gemini-2.5-pro');
      expect(settings.thinkingDefault).toBe(true);
      expect(settings.defaultSystemPrompt).toBe('You are a helpful bot.');
    });

    it('should load token from keychain on loadSettings', async () => {
      // Pre-populate keychain with a token
      keychainStore['gateway_token'] = 'keychain-token-abc';

      const store = useStore.getState();
      await store.loadSettings();

      const settings = useStore.getState().settings;
      expect(settings.gatewayToken).toBe('keychain-token-abc');
    });

    it('should handle empty localStorage gracefully', async () => {
      // localStorage returns null for unset keys
      const store = useStore.getState();
      await store.loadSettings();

      // Should have default settings
      const settings = useStore.getState().settings;
      expect(settings.defaultModel).toBe('anthropic/claude-sonnet-4-5');
      expect(settings.theme).toBe('system');
    });

    it('should handle corrupted JSON in localStorage', async () => {
      localStorageMock._setStore({
        'moltzer-settings': 'this-is-not-valid-json{{{',
      });

      const store = useStore.getState();
      // Should not throw
      await store.loadSettings();

      // Should still have default settings
      const settings = useStore.getState().settings;
      expect(settings.theme).toBe('system');
    });
  });

  describe('token migration from localStorage to keychain', () => {
    it('should migrate token from localStorage to keychain', async () => {
      // Simulate legacy settings with token in localStorage
      localStorageMock._setStore({
        'moltzer-settings': JSON.stringify({
          gatewayUrl: 'ws://legacy:8080',
          gatewayToken: 'legacy-token-in-storage', // Old format: token in localStorage
          theme: 'dark',
        }),
      });

      const store = useStore.getState();
      await store.loadSettings();

      // Token should now be in keychain
      expect(keychainStore['gateway_token']).toBe('legacy-token-in-storage');

      // Token should be removed from localStorage
      const updatedJson = localStorageMock.setItem.mock.calls.find(
        (call: [string, string]) => call[0] === 'moltzer-settings'
      );
      if (updatedJson) {
        const updatedSettings = JSON.parse(updatedJson[1]);
        expect(updatedSettings.gatewayToken).toBeUndefined();
      }

      // Settings should still be loaded correctly
      const settings = useStore.getState().settings;
      expect(settings.gatewayUrl).toBe('ws://legacy:8080');
      expect(settings.gatewayToken).toBe('legacy-token-in-storage');
      expect(settings.theme).toBe('dark');
    });
  });

  describe('round-trip persistence', () => {
    it('should survive a save-then-load cycle', async () => {
      const store = useStore.getState();
      
      // Save settings
      await store.updateSettings({
        gatewayUrl: 'ws://roundtrip:3000',
        theme: 'dark',
        defaultModel: 'anthropic/claude-opus-4-5',
        thinkingDefault: true,
        defaultSystemPrompt: 'Be concise.',
        gatewayToken: 'roundtrip-token',
      });

      // Reset in-memory state
      useStore.setState({
        settings: {
          gatewayUrl: '',
          gatewayToken: '',
          defaultModel: 'anthropic/claude-sonnet-4-5',
          thinkingDefault: false,
          theme: 'system',
          defaultSystemPrompt: '',
        },
      });

      // Reload settings
      await useStore.getState().loadSettings();

      const settings = useStore.getState().settings;
      expect(settings.gatewayUrl).toBe('ws://roundtrip:3000');
      expect(settings.theme).toBe('dark');
      expect(settings.defaultModel).toBe('anthropic/claude-opus-4-5');
      expect(settings.thinkingDefault).toBe(true);
      expect(settings.defaultSystemPrompt).toBe('Be concise.');
      expect(settings.gatewayToken).toBe('roundtrip-token');
    });

    it('should preserve settings not being updated', async () => {
      const store = useStore.getState();
      
      // Set initial settings
      await store.updateSettings({
        gatewayUrl: 'ws://preserve:5000',
        theme: 'light',
        defaultModel: 'openai/gpt-4o',
        thinkingDefault: true,
      });

      // Update only theme
      await store.updateSettings({ theme: 'dark' });

      // Other settings should be preserved in store
      const settings = useStore.getState().settings;
      expect(settings.gatewayUrl).toBe('ws://preserve:5000');
      expect(settings.defaultModel).toBe('openai/gpt-4o');
      expect(settings.thinkingDefault).toBe(true);
      expect(settings.theme).toBe('dark');
    });

    it('should handle partial localStorage data (missing fields)', async () => {
      // Simulate localStorage with only some fields
      localStorageMock._setStore({
        'moltzer-settings': JSON.stringify({
          gatewayUrl: 'ws://partial:8080',
          // theme is missing
          // defaultModel is missing
        }),
      });

      const store = useStore.getState();
      await store.loadSettings();

      const settings = useStore.getState().settings;
      expect(settings.gatewayUrl).toBe('ws://partial:8080');
      // Missing fields should keep defaults
      expect(settings.theme).toBe('system');
      expect(settings.defaultModel).toBe('anthropic/claude-sonnet-4-5');
    });
  });

  describe('keychain error handling', () => {
    it('should handle keychain read failure gracefully', async () => {
      // keychain will throw for non-existent keys (default mock behavior)
      localStorageMock._setStore({
        'moltzer-settings': JSON.stringify({
          gatewayUrl: 'ws://keychain-fail:8080',
        }),
      });

      const store = useStore.getState();
      // Should not throw even if keychain fails
      await store.loadSettings();

      const settings = useStore.getState().settings;
      expect(settings.gatewayUrl).toBe('ws://keychain-fail:8080');
      expect(settings.gatewayToken).toBe(''); // Default when keychain fails
    });
  });
});
