/**
 * Keychain utilities for secure credential storage
 * Uses OS-native credential store via Tauri
 */

import { invoke } from "@tauri-apps/api/core";

const SERVICE_NAME = "com.molt.client";

/**
 * Get the gateway token from the OS keychain
 */
export async function getGatewayToken(): Promise<string> {
  try {
    const token = await invoke<string>("keychain_get", {
      service: SERVICE_NAME,
      key: "gateway_token",
    });
    return token;
  } catch {
    // Token not found or error - return empty string
    return "";
  }
}

/**
 * Save the gateway token to the OS keychain
 */
export async function setGatewayToken(token: string): Promise<void> {
  if (!token) {
    // If token is empty, delete it from keychain
    await deleteGatewayToken();
    return;
  }
  
  await invoke("keychain_set", {
    service: SERVICE_NAME,
    key: "gateway_token",
    value: token,
  });
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
