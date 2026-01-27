/**
 * Encryption utilities for Molt Client
 * 
 * Provides transparent encryption/decryption of sensitive data using:
 * - Web Crypto API (AES-GCM 256-bit encryption)
 * - OS Keychain integration via Tauri (secure key storage)
 * 
 * Architecture:
 * 1. Master key stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
 * 2. Each message encrypted with unique IV (nonce)
 * 3. Zero user friction - all automatic
 */

import { invoke } from "@tauri-apps/api/core";

const ENCRYPTION_KEY_NAME = "molt-client-master-key";
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

let cachedKey: CryptoKey | null = null;

/**
 * Get or create the master encryption key
 * Key is stored securely in OS keychain
 */
async function getMasterKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  try {
    // Try to load existing key from keychain
    const storedKey = await invoke<string>("keychain_get", {
      service: "com.molt.client",
      key: ENCRYPTION_KEY_NAME,
    });

    if (storedKey) {
      // Import the base64-encoded key
      const keyData = base64ToArrayBuffer(storedKey);
      cachedKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ["encrypt", "decrypt"]
      );
      return cachedKey;
    }
  } catch {
    // No existing key found, generating new one
  }

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );

  // Export and store in keychain
  const exportedKey = await crypto.subtle.exportKey("raw", key);
  const base64Key = arrayBufferToBase64(exportedKey);

  try {
    await invoke("keychain_set", {
      service: "com.molt.client",
      key: ENCRYPTION_KEY_NAME,
      value: base64Key,
    });
  } catch (err) {
    console.warn("Failed to store key in keychain:", err);
    // Continue anyway - key will be in memory for this session
  }

  cachedKey = key;
  return key;
}

/**
 * Encrypt a string value
 * Returns base64-encoded ciphertext with IV prepended
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;

  const key = await getMasterKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt a string value
 * Expects base64-encoded ciphertext with IV prepended
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) return ciphertext;

  const key = await getMasterKey();
  const combined = base64ToArrayBuffer(ciphertext);

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypt a message object
 * Encrypts the content field
 */
export async function encryptMessage(message: {
  content: string;
  [key: string]: any;
}): Promise<typeof message> {
  return {
    ...message,
    content: await encrypt(message.content),
  };
}

/**
 * Decrypt a message object
 * Decrypts the content field
 */
export async function decryptMessage(message: {
  content: string;
  [key: string]: any;
}): Promise<typeof message> {
  return {
    ...message,
    content: await decrypt(message.content),
  };
}

/**
 * Clear the cached key (for logout, etc.)
 */
export function clearCachedKey() {
  cachedKey = null;
}

/**
 * Delete the master key from keychain
 * WARNING: This will make all encrypted data unrecoverable
 */
export async function deleteMasterKey(): Promise<void> {
  try {
    await invoke("keychain_delete", {
      service: "com.molt.client",
      key: ENCRYPTION_KEY_NAME,
    });
  } catch (err) {
    console.warn("Failed to delete key from keychain:", err);
  }
  clearCachedKey();
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Check if encryption is available
 * Returns false if Web Crypto API is not available (very rare in modern browsers)
 */
export function isEncryptionAvailable(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}
