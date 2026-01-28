/**
 * Encryption Edge Cases Tests
 *
 * Tests edge cases in the encryption layer that could cause issues
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  encrypt,
  decrypt,
  encryptMessage,
  decryptMessage,
  clearCachedKey,
  deleteMasterKey,
  isEncryptionAvailable,
} from "../lib/encryption";

// Mock keychain
const mockKeychainStorage = new Map<string, string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((command: string, params?: any) => {
    if (command === "keychain_get") {
      const key = `${params.service}:${params.key}`;
      const value = mockKeychainStorage.get(key);
      if (!value) {
        return Promise.reject(new Error("Key not found"));
      }
      return Promise.resolve(value);
    }
    if (command === "keychain_set") {
      const key = `${params.service}:${params.key}`;
      mockKeychainStorage.set(key, params.value);
      return Promise.resolve();
    }
    if (command === "keychain_delete") {
      const key = `${params.service}:${params.key}`;
      mockKeychainStorage.delete(key);
      return Promise.resolve();
    }
    return Promise.reject(new Error("Unknown command"));
  }),
}));

describe("Encryption Edge Cases", () => {
  beforeEach(() => {
    clearCachedKey();
    mockKeychainStorage.clear();
  });

  afterEach(() => {
    clearCachedKey();
    mockKeychainStorage.clear();
  });

  describe("empty and special string handling", () => {
    it("should handle empty strings", async () => {
      const encrypted = await encrypt("");
      expect(encrypted).toBe("");

      const decrypted = await decrypt("");
      expect(decrypted).toBe("");
    });

    it("should handle whitespace-only strings", async () => {
      const text = "   \t\n   ";
      const encrypted = await encrypt(text);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it("should handle unicode characters correctly", async () => {
      const text = "Hello 👋 世界 🌍 مرحبا";
      const encrypted = await encrypt(text);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it("should handle emoji sequences", async () => {
      const text = "👨‍👩‍👧‍👦 👍🏽 🏴󠁧󠁢󠁳󠁣󠁴󠁿";
      const encrypted = await encrypt(text);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it("should handle newlines and special characters", async () => {
      const text = "Line 1\nLine 2\r\nLine 3\tTabbed\0Null";
      const encrypted = await encrypt(text);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it("should handle very long strings", async () => {
      const text = "A".repeat(1000000); // 1MB of text
      const encrypted = await encrypt(text);
      expect(encrypted).not.toBe(text);
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
      expect(decrypted.length).toBe(1000000);
    });

    it("should handle strings with null bytes", async () => {
      const text = "Before\0After\0\0Multiple";
      const encrypted = await encrypt(text);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
    });
  });

  describe("encryption consistency", () => {
    it("should produce different ciphertext for same plaintext (due to random IV)", async () => {
      const text = "Same plaintext";
      const encrypted1 = await encrypt(text);
      const encrypted2 = await encrypt(text);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same plaintext
      expect(await decrypt(encrypted1)).toBe(text);
      expect(await decrypt(encrypted2)).toBe(text);
    });

    it("should use cached key for multiple operations", async () => {
      const text1 = "First text";
      const text2 = "Second text";

      const encrypted1 = await encrypt(text1);
      const encrypted2 = await encrypt(text2);

      // Both should decrypt correctly using cached key
      expect(await decrypt(encrypted1)).toBe(text1);
      expect(await decrypt(encrypted2)).toBe(text2);
    });

    it("should regenerate key after clearing cache", async () => {
      const text = "Test text";
      const encrypted1 = await encrypt(text);

      clearCachedKey();

      // Should still be able to decrypt (loads from keychain)
      const decrypted = await decrypt(encrypted1);
      expect(decrypted).toBe(text);
    });
  });

  describe("corrupted data handling", () => {
    it("should reject ciphertext with invalid base64", async () => {
      await expect(decrypt("not-valid-base64!@#$")).rejects.toThrow();
    });

    it("should reject ciphertext that's too short", async () => {
      // Need at least 12 bytes for IV
      const shortCiphertext = btoa("short");
      await expect(decrypt(shortCiphertext)).rejects.toThrow();
    });

    it("should reject tampered ciphertext", async () => {
      const text = "Original text";
      const encrypted = await encrypt(text);

      // Tamper with the ciphertext
      const tampered = encrypted.slice(0, -4) + "XXXX";

      await expect(decrypt(tampered)).rejects.toThrow();
    });

    it("should reject ciphertext encrypted with different key", async () => {
      const text = "Secret message";
      const encrypted = await encrypt(text);

      // Delete the key and force a new one
      await deleteMasterKey();
      clearCachedKey();

      // Try to decrypt with new key - should fail
      await expect(decrypt(encrypted)).rejects.toThrow();
    });
  });

  describe("message object encryption", () => {
    it("should encrypt and decrypt message objects", async () => {
      const message = {
        id: "msg-1",
        role: "user" as const,
        content: "Test message",
        timestamp: new Date(),
      };

      const encrypted = await encryptMessage(message);
      expect(encrypted.content).not.toBe(message.content);
      expect(encrypted.id).toBe(message.id);
      expect(encrypted.role).toBe(message.role);

      const decrypted = await decryptMessage(encrypted);
      expect(decrypted.content).toBe(message.content);
    });

    it("should handle message with empty content", async () => {
      const message = {
        id: "msg-1",
        role: "user" as const,
        content: "",
        timestamp: new Date(),
      };

      const encrypted = await encryptMessage(message);
      expect(encrypted.content).toBe("");

      const decrypted = await decryptMessage(encrypted);
      expect(decrypted.content).toBe("");
    });
  });

  describe("encryption availability", () => {
    it("should detect when encryption is available", () => {
      expect(isEncryptionAvailable()).toBe(true);
    });
  });

  describe("key management", () => {
    it("should persist key across cache clears", async () => {
      const text = "Persistent test";
      const encrypted = await encrypt(text);

      clearCachedKey();

      // Should still decrypt after clearing cache (loads from keychain)
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
    });

    it("should handle multiple deletions gracefully", async () => {
      await deleteMasterKey();
      await deleteMasterKey();
      await deleteMasterKey();

      // Should not throw, should be able to create new key
      const text = "New key test";
      const encrypted = await encrypt(text);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
    });
  });

  describe("concurrent operations", () => {
    it("should handle multiple simultaneous encryptions", async () => {
      // Reduce concurrency to avoid overwhelming Web Crypto API
      const texts = Array.from({ length: 20 }, (_, i) => `Text ${i}`);

      const encrypted = await Promise.all(texts.map((t) => encrypt(t)));

      // All should decrypt correctly
      const decrypted = await Promise.all(encrypted.map((e) => decrypt(e)));
      expect(decrypted).toEqual(texts);

      // Due to random IVs, all should be unique
      const uniqueValues = new Set(encrypted);
      expect(uniqueValues.size).toBe(20);
    });

    it("should handle racing key generation", async () => {
      clearCachedKey();
      mockKeychainStorage.clear();

      // Start multiple encryptions simultaneously with different text
      // This could trigger multiple key generations
      // Use smaller batch to avoid Web Crypto API limits
      const promises = Array.from({ length: 5 }, (_, i) =>
        encrypt(`Test concurrent key generation ${i}`),
      );

      const results = await Promise.all(promises);

      // All should succeed and decrypt correctly
      const decrypted = await Promise.all(results.map((r) => decrypt(r)));
      decrypted.forEach((d, i) => {
        expect(d).toBe(`Test concurrent key generation ${i}`);
      });
    });
  });

  describe("edge case: base64 encoding", () => {
    it("should handle strings that produce base64 with padding", async () => {
      // These strings produce base64 with different padding
      const texts = [
        "a", // 1 byte -> padding ==
        "ab", // 2 bytes -> padding =
        "abc", // 3 bytes -> no padding
        "abcd", // 4 bytes -> no padding
      ];

      for (const text of texts) {
        const encrypted = await encrypt(text);
        const decrypted = await decrypt(encrypted);
        expect(decrypted).toBe(text);
      }
    });

    it("should handle strings with characters that look like base64", async () => {
      const text = "aGVsbG8gd29ybGQ="; // This IS base64 for "hello world"
      const encrypted = await encrypt(text);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(text);
    });
  });

  describe("memory efficiency", () => {
    it("should not leak sensitive data in errors", async () => {
      const sensitiveText = "TOP SECRET PASSWORD 12345";

      try {
        await encrypt(sensitiveText);
        // Now try to decrypt garbage
        await decrypt("invalid-data");
      } catch (error) {
        // Error message should not contain sensitive data
        const errorStr = String(error);
        expect(errorStr).not.toContain(sensitiveText);
        expect(errorStr).not.toContain("SECRET");
        expect(errorStr).not.toContain("12345");
      }
    });
  });
});
