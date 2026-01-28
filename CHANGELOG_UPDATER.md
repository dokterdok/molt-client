# Auto-Update Implementation - Changelog

## Summary

Implemented a comprehensive auto-update mechanism for Moltzer desktop application with the following features:

✅ **All CEO Requirements Met:**
1. ✅ Check for updates on app startup (10s delay)
2. ✅ Check periodically while running (every 4-6 hours, randomized)
3. ✅ Check after network reconnection (listens to gateway:reconnected)
4. ✅ Non-intrusive toast notification with "Update available" message
5. ✅ Two options ONLY: "Update now" or "Later" (NO "skip this version")
6. ✅ Badge on settings icon if user dismisses update
7. ✅ Never auto-restart without consent (user must click "Update now")
8. ✅ Doesn't interrupt active conversations (toast is non-modal)

## Files Added

### Backend (Rust)
- `src-tauri/src/updater.rs` - Core update logic and commands

### Frontend (React/TypeScript)
- `src/components/UpdateNotification.tsx` - Toast notification UI

### Documentation
- `docs/UPDATER.md` - Comprehensive updater documentation
- `docs/SETUP_SIGNING.md` - Step-by-step signing setup guide
- `CHANGELOG_UPDATER.md` - This file

### CI/CD
- `.github/workflows/release.yml` - GitHub Actions release workflow

## Files Modified

### Backend
- `src-tauri/Cargo.toml` - Added `rand` dependency
- `src-tauri/src/lib.rs` - Integrated updater module, added commands, setup hooks
- `src-tauri/tauri.conf.json` - Configured updater plugin (dialog: false, endpoint, pubkey)

### Frontend
- `src/App.tsx` - Imported and rendered UpdateNotification component
- `src/components/Sidebar.tsx` - Added badge indicator for dismissed updates

### Documentation
- `README.md` - Added "Always Up-to-Date" feature section

## Technical Architecture

### Update Check Flow

```
App Startup
    ↓
Wait 10s
    ↓
check_for_updates() ──→ Tauri Updater Plugin ──→ GitHub Releases API
    ↓                                                      ↓
Update Available?                                   latest.json
    ↓                                                      ↓
Emit "update-available" event              {version, url, signature}
    ↓
UpdateNotification component listens
    ↓
Show toast with "Update Now" / "Later"
```

### Periodic Check Flow

```
Periodic Timer (4-6h random)
    ↓
check_for_updates()
    ↓
If update available → Emit event → Show toast
```

### Network Reconnection Flow

```
Gateway Reconnects
    ↓
Emit "gateway:reconnected" event
    ↓
Updater listens → check_for_updates()
    ↓
If update available → Show toast
```

### Install Flow

```
User clicks "Update Now"
    ↓
install_update() command
    ↓
Download update (with progress events)
    ↓
Verify signature
    ↓
Install
    ↓
App restarts automatically
```

## Tauri Commands Added

| Command | Description |
|---------|-------------|
| `check_for_updates` | Manually trigger update check |
| `install_update` | Download and install pending update |
| `get_update_status` | Get current pending update info |
| `dismiss_update` | Clear pending update notification |

## Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `update-available` | `UpdateInfo` | New update detected |
| `update-download-progress` | `number` (0-100) | During download |
| `update-downloaded` | `()` | Download complete |

## Events Listened To

| Event | Source | Action |
|-------|--------|--------|
| `gateway:reconnected` | Gateway module | Trigger update check |

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
      "pubkey": "<base64-encoded-public-key>"
    }
  }
}
```

**Note:** `dialog: false` disables Tauri's built-in update dialog, allowing our custom UI.

## GitHub Actions Workflow

**Trigger:** Push tag matching `v*.*.*` or manual workflow dispatch

**Jobs:**
1. `create-release` - Creates draft GitHub Release
2. `build-tauri` - Builds for macOS, Windows, Linux in parallel
3. `publish-release` - Publishes the release

**Artifacts Created:**
- macOS: `.dmg` (universal binary), `.app.tar.gz`, `.app.tar.gz.sig`
- Windows: `.msi`, `.exe`, `.msi.zip`, `.msi.zip.sig`
- Linux: `.AppImage`, `.deb`, `.AppImage.tar.gz`, `.AppImage.tar.gz.sig`
- `latest.json` - Update manifest with version, URLs, signatures

## Security

✅ **Code Signing:**
- All binaries signed with Tauri's minisign
- Public key in `tauri.conf.json` for signature verification
- Private key stored securely in GitHub Secrets

✅ **Update Verification:**
- Signature verification before installation
- HTTPS-only downloads
- Official GitHub Releases only

## Testing Status

✅ **Compilation:**
- Rust backend: ✅ `cargo check` passed
- TypeScript frontend: ✅ `npm run build` passed

⚠️ **Runtime Testing Required:**
- [ ] Test update check on startup
- [ ] Test periodic update checks
- [ ] Test network reconnection trigger
- [ ] Test "Update Now" flow
- [ ] Test "Later" flow and badge
- [ ] Test progress indicator
- [ ] Test signature verification
- [ ] Test GitHub Actions workflow
- [ ] Test on all platforms (macOS, Windows, Linux)

## Next Steps for Deployment

1. **Generate Signing Keys:**
   ```bash
   tauri signer generate -w ~/.tauri/moltzer.key
   ```

2. **Configure GitHub Secrets:**
   - Add `TAURI_SIGNING_PRIVATE_KEY`
   - Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (if password set)

3. **Update tauri.conf.json:**
   - Replace `YOUR_PUBLIC_KEY_HERE` with actual public key from step 1

4. **Test Release:**
   ```bash
   git tag v1.0.1-test
   git push origin v1.0.1-test
   ```
   Watch GitHub Actions, verify build succeeds

5. **First Production Release:**
   - Update version in package.json, Cargo.toml, tauri.conf.json
   - Commit and tag: `git tag v1.0.0`
   - Push: `git push origin main --tags`
   - Wait for GitHub Actions
   - Publish draft release on GitHub

6. **Test Update Flow:**
   - Install v1.0.0
   - Create v1.0.1 release
   - Launch v1.0.0
   - Verify update notification appears
   - Test "Update Now" → should download, install, restart
   - Verify v1.0.1 is running

## Known Limitations

- **First installation:** Users must download manually (obviously)
- **Key rotation:** Changing signing keys requires users to reinstall
- **Offline:** Update checks fail gracefully when offline
- **Rate limiting:** GitHub API has rate limits (60/hour unauthenticated)

## Future Improvements

See `docs/UPDATER.md` → "Future Enhancements" section for planned features.

## Documentation

- **For users:** Update flow is automatic and documented in app
- **For maintainers:** See `docs/UPDATER.md` and `docs/SETUP_SIGNING.md`
- **For developers:** Code is documented inline with rustdoc and JSDoc

## Conclusion

The auto-update mechanism is **fully implemented** and **ready for deployment** after:
1. Setting up code signing keys
2. Configuring GitHub Secrets
3. Testing the release workflow

All CEO requirements have been met with a user-friendly, non-intrusive update experience.
