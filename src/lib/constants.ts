/**
 * Application constants
 */

// Gateway connection
export const DEFAULT_GATEWAY_PORT = 18789;
export const DEFAULT_GATEWAY_URLS = [
  `ws://localhost:${DEFAULT_GATEWAY_PORT}`,
  `ws://127.0.0.1:${DEFAULT_GATEWAY_PORT}`,
  `ws://localhost:8789`, // Legacy port
  `wss://localhost:${DEFAULT_GATEWAY_PORT}`, // Secure fallback
] as const;

export const DEFAULT_GATEWAY_URL = DEFAULT_GATEWAY_URLS[0];

// Timeouts (in milliseconds)
export const CONNECTION_TIMEOUT = 10000; // 10 seconds
export const GATEWAY_DETECTION_TIMEOUT = 5000; // 5 seconds
export const ERROR_DISPLAY_DURATION = 10000; // 10 seconds

// UI Constants
export const SCROLL_NEAR_BOTTOM_THRESHOLD = 100; // pixels
export const VIRTUAL_SCROLL_THRESHOLD = 50; // messages
export const MESSAGE_ESTIMATED_HEIGHT = 200; // pixels
export const SCROLL_THROTTLE_MS = 16; // ~60 FPS

// Encryption
export const ENCRYPTION_KEY_NAME = "moltz-client-master-key";
export const ENCRYPTION_SERVICE = "com.moltz.client";

// Storage
export const DB_NAME = "MoltzDB";
export const ONBOARDING_PROGRESS_KEY = "Moltz-onboarding-progress";

// Models
export const DEFAULT_MODEL = "claude-sonnet-4";

// File upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

// URLs
export const GITHUB_RELEASES_URL = "https://github.com/AlixHQ/moltz/releases";
export const MOLTBOT_GITHUB_URL = "https://github.com/moltbot/moltbot";
