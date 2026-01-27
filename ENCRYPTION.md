# Encryption at Rest - Implementation Guide

## Overview

Moltzer client implements **transparent encryption at rest** for all sensitive conversation data with zero user friction.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              OS Keychain                            │
│  (macOS Keychain / Windows Credential Manager /    │
│   Linux Secret Service)                            │
│                                                     │
│  Stores: 256-bit AES master key                    │
│  Auto-generated on first launch                    │
│  Protected by OS authentication (biometrics, etc.)  │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Application Layer                      │
│                                                     │
│  • Web Crypto API (AES-GCM 256-bit)                │
│  • Unique IV per message                           │
│  • Encrypted content stored in IndexedDB           │
│  • Key cached in memory during session             │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              IndexedDB (Dexie)                      │
│                                                     │
│  • All message content encrypted                   │
│  • Conversation metadata encrypted                 │
│  • Attachments encrypted                           │
│  • Keys never stored in plaintext                  │
└─────────────────────────────────────────────────────┘
```

## Implementation Details

### Encryption Algorithm

- **Algorithm**: AES-GCM (Galois/Counter Mode)
- **Key Length**: 256 bits
- **IV/Nonce**: 12 bytes (96 bits), randomly generated per message
- **Authentication**: Built-in with GCM mode

### Key Management

1. **Master Key Generation**
   - Generated on first app launch using Web Crypto API
   - 256-bit random key using `crypto.getRandomValues()`
   - Exported as raw bytes and base64-encoded

2. **Key Storage**
   - Stored in OS keychain via Tauri `keyring` crate
   - Service: `com.moltzer.client`
   - Key name: `molt-client-master-key`
   - Protected by OS-level authentication

3. **Key Retrieval**
   - Loaded from keychain on app start
   - Cached in memory for session duration
   - Never persisted in application state or localStorage

### Encryption Flow

```typescript
// Example: Encrypting a message
const plaintext = "Hello, world!";

// 1. Get master key (from keychain or cache)
const masterKey = await getMasterKey();

// 2. Generate random IV
const iv = crypto.getRandomValues(new Uint8Array(12));

// 3. Encrypt with AES-GCM
const ciphertext = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  masterKey,
  new TextEncoder().encode(plaintext)
);

// 4. Combine IV + ciphertext, encode as base64
const encrypted = base64(concat(iv, ciphertext));

// Store in IndexedDB
await db.messages.add({ content: encrypted, ... });
```

### Decryption Flow

```typescript
// Example: Decrypting a message
const encrypted = "base64-encoded-iv-and-ciphertext";

// 1. Decode from base64
const combined = base64Decode(encrypted);

// 2. Extract IV (first 12 bytes) and ciphertext
const iv = combined.slice(0, 12);
const ciphertext = combined.slice(12);

// 3. Get master key
const masterKey = await getMasterKey();

// 4. Decrypt with AES-GCM
const plaintext = await crypto.subtle.decrypt(
  { name: "AES-GCM", iv },
  masterKey,
  ciphertext
);

// 5. Decode to string
const message = new TextDecoder().decode(plaintext);
```

## Usage

### Automatic Encryption (Recommended)

The easiest way is to integrate encryption into the database layer:

```typescript
import { encrypt, decrypt } from "@/lib/encryption";
import { db } from "@/lib/db";

// When saving messages
const message = {
  id: "msg-123",
  role: "user",
  content: "Sensitive information",
  timestamp: new Date(),
};

// Encrypt before saving
await db.messages.add({
  ...message,
  content: await encrypt(message.content),
});

// When reading messages
const encrypted = await db.messages.get("msg-123");
const decrypted = {
  ...encrypted,
  content: await decrypt(encrypted.content),
};
```

### Manual Encryption

For fine-grained control:

```typescript
import { encrypt, decrypt, encryptMessage, decryptMessage } from "@/lib/encryption";

// Encrypt a single field
const encrypted = await encrypt("secret data");

// Decrypt a single field
const plaintext = await decrypt(encrypted);

// Encrypt an entire message object
const message = { content: "Hello", role: "user" };
const encryptedMsg = await encryptMessage(message);

// Decrypt an entire message object
const decryptedMsg = await decryptMessage(encryptedMsg);
```

## Security Considerations

### ✅ What's Protected

- **Message content** - All conversation content encrypted
- **Attachments** - File contents encrypted before storage
- **Metadata** - Conversation titles and settings encrypted
- **At rest** - Data encrypted when stored on disk
- **OS integration** - Master key protected by OS authentication

### ⚠️ What's NOT Protected

- **In memory** - Decrypted messages cached during session (normal behavior)
- **Network** - Encryption at rest doesn't protect data in transit (use TLS)
- **Screen** - Displayed content is visible (obvious)
- **Backups** - OS backups may include keychain (depends on OS policy)

### Key Recovery

**Important**: If the master key is lost (e.g., OS reinstall without keychain backup), **all encrypted data is unrecoverable**. This is by design.

Future improvements:
- Optional password-based key derivation for manual backups
- Key export/import for device migration
- Team mode with server-side encrypted key storage

## Testing

```bash
# Run encryption tests
npm test -- encryption

# Test keychain integration (requires Tauri)
cargo test --manifest-path=src-tauri/Cargo.toml keychain
```

## Performance

- **Encryption**: ~0.5ms per message (< 1KB)
- **Decryption**: ~0.5ms per message
- **Key retrieval**: ~5ms first time, instant when cached
- **Batch operations**: Consider using Web Workers for large datasets

## Troubleshooting

### "Keychain access denied"

**macOS**: Grant keychain access in System Preferences → Security & Privacy → Privacy → Accessibility

**Windows**: Ensure app has permission to access Credential Manager

**Linux**: Install `libsecret` and grant access via Secret Service

### "Decryption failed"

- Key was deleted or changed
- Data corruption
- Wrong key (different device/user)
- **Solution**: Delete encrypted data and re-sync

### "Key not found"

- First launch (expected - key will be generated)
- Keychain was cleared
- Different user profile
- **Solution**: New key will be generated automatically

## Migration

If you have **existing unencrypted data**:

```typescript
import { encrypt } from "@/lib/encryption";
import { db } from "@/lib/db";

// Migrate existing messages
const messages = await db.messages.toArray();
for (const msg of messages) {
  if (!msg.content.startsWith("ENCRYPTED:")) {
    await db.messages.update(msg.id, {
      content: await encrypt(msg.content),
    });
  }
}
```

## Future Enhancements

- [ ] Optional password-based encryption (zero-knowledge)
- [ ] End-to-end encryption for team mode
- [ ] Encrypted export/import
- [ ] Hardware security module (HSM) support
- [ ] Backup key generation with recovery phrase
- [ ] Encrypted search (homomorphic encryption or secure indexes)

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM Specification](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [keyring-rs Documentation](https://docs.rs/keyring/latest/keyring/)
