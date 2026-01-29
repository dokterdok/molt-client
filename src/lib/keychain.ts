/**
 * Keychain utilities for secure credential storage
 * Uses OS-native credential store via Tauri, with localStorage fallback
 */

import { invoke } from "@tauri-apps/api/core";

const SERVICE_NAME = "com.moltz.client";
const FALLBACK_KEY = "moltz-token-fallback";

/**
 * Get the gateway token from keychain or localStorage fallback
 */
export async function getGatewayToken(): Promise<string> {
  // Try keychain first
  try {
    const token = await invoke<string>("keychain_get", {
      service: SERVICE_NAME,
      key: "gateway_token",
    });
    if (token) return token;
  } catch (err) {
    console.warn("[keychain] Keychain read failed, trying fallback:", err);
  }
  
  // Fallback to localStorage
  const fallback = localStorage.getItem(FALLBACK_KEY);
  if (fallback) {
    console.log("[keychain] Using localStorage fallback token");
    return fallback;
  }
  
  return "";
}

/**
 * Try to get the gateway token, returning empty string on failure
 */
export async function tryGetGatewayToken(): Promise<string> {
  return await getGatewayToken();
}

/**
 * Save the gateway token to keychain AND localStorage fallback
 */
export async function setGatewayToken(token: string): Promise<boolean> {
  if (!token) {
    await deleteGatewayToken();
    return true;
  }

  // Always save to localStorage as fallback
  localStorage.setItem(FALLBACK_KEY, token);
  
  // Try to save to keychain (best effort)
  try {
    await invoke("keychain_set", {
      service: SERVICE_NAME,
      key: "gateway_token",
      value: token,
    });
    console.log("[keychain] Token saved to keychain");
    return true;
  } catch (err) {
    console.warn("[keychain] Keychain save failed, using localStorage fallback:", err);
    return true; // Still return true since fallback worked
  }
}

/**
 * Delete the gateway token from keychain and localStorage
 */
export async function deleteGatewayToken(): Promise<void> {
  localStorage.removeItem(FALLBACK_KEY);
  try {
    await invoke("keychain_delete", {
      service: SERVICE_NAME,
      key: "gateway_token",
    });
  } catch {
    // Ignore keychain errors
  }
}
