/**
 * Keychain utilities for secure credential storage
 * Uses OS-native credential store via Tauri
 */

import { invoke } from "@tauri-apps/api/core";

const SERVICE_NAME = "com.moltz.client";

/**
 * Get the gateway token from the OS keychain
 * Throws on error to allow callers to handle failures
 */
export async function getGatewayToken(): Promise<string> {
  try {
    const token = await invoke<string>("keychain_get", {
      service: SERVICE_NAME,
      key: "gateway_token",
    });
    return token;
  } catch (err) {
    console.warn("[keychain] Failed to get gateway token:", err);
    throw err; // Re-throw so callers know it failed
  }
}

/**
 * Try to get the gateway token, returning empty string on failure
 * Use this for non-critical reads where missing token is acceptable
 */
export async function tryGetGatewayToken(): Promise<string> {
  try {
    return await getGatewayToken();
  } catch {
    return "";
  }
}

/**
 * Save the gateway token to the OS keychain
 * Returns true if saved successfully, false if keychain unavailable
 */
export async function setGatewayToken(token: string): Promise<boolean> {
  if (!token) {
    // If token is empty, delete it from keychain
    try {
      await deleteGatewayToken();
    } catch {
      // Ignore delete failures
    }
    return true;
  }

  try {
    await invoke("keychain_set", {
      service: SERVICE_NAME,
      key: "gateway_token",
      value: token,
    });
    return true;
  } catch (err) {
    console.warn("[keychain] Failed to save token (keychain unavailable):", err);
    // Don't throw - token will stay in memory store
    return false;
  }
}

/**
 * Delete the gateway token from the OS keychain
 */
export async function deleteGatewayToken(): Promise<void> {
  try {
    await invoke("keychain_delete", {
      service: SERVICE_NAME,
      key: "gateway_token",
    });
  } catch {
    // Ignore errors (token might not exist)
  }
}
