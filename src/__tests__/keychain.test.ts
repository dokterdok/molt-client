/**
 * Keychain Tests
 *
 * Tests the secure credential storage layer that wraps Tauri's
 * native keychain functionality for gateway token storage.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getGatewayToken,
  setGatewayToken,
  deleteGatewayToken,
} from "../lib/keychain";

// In-memory keychain simulation - must be declared before vi.mock
let keychainStore: Record<string, string> = {};

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((command: string, params?: Record<string, string>) => {
    if (command === "keychain_get") {
      const key = params?.key || "";
      const service = params?.service || "";
      const storeKey = `${service}:${key}`;
      if (keychainStore[storeKey] !== undefined) {
        return Promise.resolve(keychainStore[storeKey]);
      }
      return Promise.reject(new Error("Key not found"));
    }
    if (command === "keychain_set") {
      const key = params?.key || "";
      const service = params?.service || "";
      const value = params?.value || "";
      keychainStore[`${service}:${key}`] = value;
      return Promise.resolve();
    }
    if (command === "keychain_delete") {
      const key = params?.key || "";
      const service = params?.service || "";
      delete keychainStore[`${service}:${key}`];
      return Promise.resolve();
    }
    return Promise.reject(new Error(`Unknown command: ${command}`));
  }),
}));

const { invoke } = await import("@tauri-apps/api/core");

describe("Keychain", () => {
  beforeEach(() => {
    keychainStore = {};
    vi.clearAllMocks();
  });

  describe("getGatewayToken", () => {
    it("should return the stored token", async () => {
      keychainStore["com.moltz.client:gateway_token"] = "my-secret-token";

      const token = await getGatewayToken();
      expect(token).toBe("my-secret-token");
    });

    it("should return empty string when no token is stored", async () => {
      // keychainStore is empty
      const token = await getGatewayToken();
      expect(token).toBe("");
    });

    it("should return empty string on keychain error", async () => {
      // Override invoke to throw for this test
      vi.mocked(invoke).mockImplementationOnce(() =>
        Promise.reject(new Error("Keychain access denied")),
      );

      const token = await getGatewayToken();
      expect(token).toBe("");
    });

    it("should call invoke with correct service and key", async () => {
      await getGatewayToken();

      expect(invoke).toHaveBeenCalledWith("keychain_get", {
        service: "com.moltz.client",
        key: "gateway_token",
      });
    });
  });

  describe("setGatewayToken", () => {
    it("should store a token in the keychain", async () => {
      await setGatewayToken("new-token-123");

      expect(keychainStore["com.moltz.client:gateway_token"]).toBe(
        "new-token-123",
      );
    });

    it("should call invoke with correct parameters", async () => {
      await setGatewayToken("test-token");

      expect(invoke).toHaveBeenCalledWith("keychain_set", {
        service: "com.moltz.client",
        key: "gateway_token",
        value: "test-token",
      });
    });

    it("should overwrite an existing token", async () => {
      keychainStore["com.moltz.client:gateway_token"] = "old-token";

      await setGatewayToken("new-token");

      expect(keychainStore["com.moltz.client:gateway_token"]).toBe("new-token");
    });

    it("should delete the token when setting to empty string", async () => {
      keychainStore["com.moltz.client:gateway_token"] = "existing-token";

      await setGatewayToken("");

      // Should have called delete, not set with empty
      expect(keychainStore["com.moltz.client:gateway_token"]).toBeUndefined();
    });

    it("should handle special characters in token", async () => {
      const specialToken = "tk_!@#$%^&*()_+-=[]{}|;:'\",.<>?/~`";
      await setGatewayToken(specialToken);

      expect(keychainStore["com.moltz.client:gateway_token"]).toBe(
        specialToken,
      );
    });

    it("should handle very long tokens", async () => {
      const longToken = "x".repeat(10000);
      await setGatewayToken(longToken);

      expect(keychainStore["com.moltz.client:gateway_token"]).toBe(longToken);
    });
  });

  describe("deleteGatewayToken", () => {
    it("should delete the stored token", async () => {
      keychainStore["com.moltz.client:gateway_token"] = "to-delete";

      await deleteGatewayToken();

      expect(keychainStore["com.moltz.client:gateway_token"]).toBeUndefined();
    });

    it("should not throw when token does not exist", async () => {
      // keychainStore is empty, should not throw
      await expect(deleteGatewayToken()).resolves.toBeUndefined();
    });

    it("should call invoke with correct service and key", async () => {
      await deleteGatewayToken();

      expect(invoke).toHaveBeenCalledWith("keychain_delete", {
        service: "com.moltz.client",
        key: "gateway_token",
      });
    });

    it("should handle keychain error on delete gracefully", async () => {
      vi.mocked(invoke).mockImplementationOnce(() =>
        Promise.reject(new Error("Permission denied")),
      );

      // Should not throw (error is caught internally)
      await expect(deleteGatewayToken()).resolves.toBeUndefined();
    });
  });

  describe("token lifecycle", () => {
    it("should handle set-get-delete cycle", async () => {
      // Set
      await setGatewayToken("lifecycle-token");

      // Get
      const token = await getGatewayToken();
      expect(token).toBe("lifecycle-token");

      // Delete
      await deleteGatewayToken();

      // Get again - should be empty
      const afterDelete = await getGatewayToken();
      expect(afterDelete).toBe("");
    });

    it("should handle multiple set operations", async () => {
      await setGatewayToken("first");
      expect(await getGatewayToken()).toBe("first");

      await setGatewayToken("second");
      expect(await getGatewayToken()).toBe("second");

      await setGatewayToken("third");
      expect(await getGatewayToken()).toBe("third");
    });

    it("should handle set-empty-set cycle", async () => {
      await setGatewayToken("initial");
      expect(await getGatewayToken()).toBe("initial");

      await setGatewayToken(""); // Clear
      expect(await getGatewayToken()).toBe("");

      await setGatewayToken("restored");
      expect(await getGatewayToken()).toBe("restored");
    });
  });
});
