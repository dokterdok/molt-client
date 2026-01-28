# Auto-Update System

Moltzer includes a comprehensive auto-update mechanism using Tauri's plugin-updater with custom UI and UX.

## Features

✅ **Automatic Update Checks**
- On app startup (10 seconds after initialization)
- Periodically every 4-6 hours (randomized to prevent server load spikes)
- After network reconnection

✅ **Non-Intrusive UI**
- Toast notification when update is available
- Two options only: "Update Now" or "Later" (no "skip this version")
- Visual badge on Settings icon if user dismisses update
- Progress indicator during download
- Never interrupts active conversations

✅ **User Consent**
- Never auto-restarts without user permission
- Clear progress indication during download
- Automatic restart only after successful installation

✅ **Secure Updates**
- All updates are cryptographically signed
- Signature verification before installation
- Downloads from official GitHub Releases only

## Architecture

### Backend (Rust)

**Module:** `src-tauri/src/updater.rs`

Key components:
- `check_for_updates()` - Manual update check
- `install_update()` - Download and install update
- `get_update_status()` - Get current pending update
- `dismiss_update()` - Clear pending update notification
- `setup_periodic_checks()` - Background timer for periodic checks
- `setup_network_listener()` - Listen for gateway reconnection events

### Frontend (React)

**Component:** `src/components/UpdateNotification.tsx`

Provides:
- Toast notification UI
- Download progress indicator
- "Update Now" / "Later" actions
- Error handling and display

**Integration:** `src/App.tsx`

- Renders UpdateNotification component
- Manages dismissed update state
- Passes badge state to Sidebar

**Badge:** `src/components/Sidebar.tsx`

- Shows blue pulsing dot on Settings icon when update is dismissed

## Configuration

### tauri.conf.json

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": false,
      "endpoints": [
        "https://github.com/AlixHQ/moltzer-community/releases/latest/download/latest.json"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

**Important:** `dialog: false` disables Tauri's built-in dialog, allowing our custom UI.

## Setting Up Code Signing

### 1. Generate Signing Keys

```bash
# Install tauri-cli if not already installed
npm install -g @tauri-apps/cli

# Generate signing keypair
tauri signer generate -w ~/.tauri/moltzer.key

# This outputs:
# - Private key (save securely!)
# - Public key (add to tauri.conf.json)
```

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository:

**Required:**
- `TAURI_SIGNING_PRIVATE_KEY` - The private key from step 1
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Password for the private key (if set)

**For macOS code signing:**
- `APPLE_CERTIFICATE` - Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD` - Password for the certificate
- `APPLE_SIGNING_IDENTITY` - Signing identity name
- `APPLE_ID` - Apple Developer ID email
- `APPLE_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Apple Developer Team ID

### 3. Update tauri.conf.json

Replace `YOUR_PUBLIC_KEY_HERE` with the public key from step 1.

## Release Process

### Manual Release (Recommended)

1. **Update version** in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. **Commit and tag:**
   ```bash
   git add .
   git commit -m "Release v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```

3. **GitHub Actions will:**
   - Build for macOS (universal), Windows, Linux
   - Sign all binaries
   - Create GitHub Release (draft)
   - Upload installers and update manifests

4. **Publish release:**
   - Go to GitHub Releases
   - Edit the draft release
   - Add release notes
   - Publish

### Automated Release

Run the workflow manually from GitHub Actions:
```
Actions → Release → Run workflow
```

Input the version number (e.g., `1.0.1`)

## Update Flow (User Experience)

1. **Update Check Triggers:**
   - App starts → Wait 10s → Check
   - Timer fires (every 4-6h) → Check
   - Gateway reconnects → Check

2. **Update Available:**
   - Toast notification appears (bottom-right)
   - Shows: version number, release notes
   - Two buttons: "Update Now" | "Later"

3. **User Clicks "Update Now":**
   - Download starts
   - Progress bar shows percentage
   - Message: "The app will restart automatically after installation"
   - Download completes → Install → **App restarts**

4. **User Clicks "Later":**
   - Toast dismisses
   - Blue pulsing badge appears on Settings icon
   - Update check won't trigger again until:
     - App restarts, OR
     - User manually checks in Settings, OR
     - New version is released

## Testing

### Local Testing

1. **Build current version:**
   ```bash
   npm run tauri build
   ```

2. **Increment version** in all three files

3. **Build new version and create test release**

4. **Point updater to test release:**
   Update `endpoints` in `tauri.conf.json` temporarily

5. **Run app:**
   - Should detect update
   - Toast should appear
   - Test "Update Now" and "Later" flows

### Production Testing

Before releasing to users:

1. Create a pre-release on GitHub
2. Test updater with pre-release URL
3. Verify:
   - Update detection works
   - Download completes
   - Signature verification passes
   - Installation succeeds
   - App restarts correctly
   - New version runs properly

## Troubleshooting

### Update Check Fails

**Symptom:** No updates detected, errors in console

**Causes:**
- Network issues
- GitHub API rate limiting
- Invalid endpoint URL
- Manifest file missing

**Debug:**
```rust
// Enable debug logging in updater.rs
println!("Update check failed: {}", e);
```

### Signature Verification Fails

**Symptom:** Download completes but installation fails

**Causes:**
- Public key mismatch in tauri.conf.json
- Binary not signed (missing private key in CI)
- Corrupted download

**Fix:**
- Verify public key matches the private key used in CI
- Check GitHub Actions logs for signing errors
- Re-download and try again

### Update Downloads but Doesn't Install

**Symptom:** Progress reaches 100% but nothing happens

**Causes:**
- Insufficient permissions (Windows/Linux)
- Antivirus blocking
- File in use

**Fix:**
- Run as administrator (Windows)
- Add exclusion for Moltzer in antivirus
- Ensure no other instances are running

## Manual Override

Users can always download and install manually:
1. Go to GitHub Releases
2. Download installer for their platform
3. Run installer
4. Overwrites existing installation

## Metrics

Track update success rate:
- Add analytics event on `update-downloaded`
- Add analytics event on app launch (version)
- Calculate adoption rate

## Future Enhancements

- [ ] Background downloads (start download on "Later" click)
- [ ] Delta updates (download only changed files)
- [ ] Rollback mechanism (revert if new version crashes)
- [ ] Update channels (stable, beta, alpha)
- [ ] Configurable update frequency in Settings
- [ ] "Check for updates" button in Settings UI
- [ ] Update history/changelog viewer
- [ ] Bandwidth throttling for large downloads

## Security Considerations

✅ **Implemented:**
- Signature verification (tauri-plugin-updater)
- HTTPS-only downloads
- GitHub as trusted source

⚠️ **Recommendations:**
- Rotate signing keys periodically
- Use separate keys per platform
- Implement Content Security Policy (CSP)
- Monitor for supply chain attacks
- Code review all releases

## References

- [Tauri Updater Plugin Docs](https://v2.tauri.app/plugin/updater/)
- [Code Signing Guide](https://tauri.app/v1/guides/distribution/sign-android)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
