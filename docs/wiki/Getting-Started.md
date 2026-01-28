# Getting Started

Get Moltz running in 5 minutes.

---

## What You're Installing

**Moltz** is a desktop app for chatting with AI (ChatGPT, Claude, etc.).

**Clawdbot Gateway** is the behind-the-scenes service that connects Moltz to AI providers. Think of it like a router for AI requests.

**Why two things?** Gateway handles your API keys and runs in the background. Moltz is the friendly UI you actually use.

---

## Quick Install (Most People)

### 1. Download Moltz

**macOS:**
- [Download for Apple Silicon (M1/M2/M3)](https://github.com/AlixHQ/moltz/releases/latest/download/Moltz_aarch64.dmg)
- [Download for Intel](https://github.com/AlixHQ/moltz/releases/latest/download/Moltz_x64.dmg)

**Windows:**
- [Download installer](https://github.com/AlixHQ/moltz/releases/latest/download/Moltz_x64.msi)

**Linux:**
- [.deb (Ubuntu/Debian)](https://github.com/AlixHQ/moltz/releases/latest/download/moltz_amd64.deb)
- [.rpm (Fedora)](https://github.com/AlixHQ/moltz/releases/latest/download/moltz.rpm)
- [AppImage (Universal)](https://github.com/AlixHQ/moltz/releases/latest/download/moltz.AppImage)

---

### 2. Install Moltz

**macOS:**
1. Open the `.dmg` file
2. Drag Moltz to your Applications folder
3. Double-click to open

**Seeing "unidentified developer"?** Right-click → Open → Open again. (We're new, don't have expensive code signing yet.)

**Windows:**
1. Run the `.msi` installer
2. Click through the wizard
3. Launch from Start Menu

**"Windows protected your PC"?** Click "More info" → "Run anyway". (We're open-source, you can verify the code.)

**Linux:**
```bash
# Debian/Ubuntu
sudo dpkg -i moltz_amd64.deb

# Fedora
sudo rpm -i moltz.rpm

# AppImage
chmod +x moltz.AppImage
./moltz.AppImage
```

---

### 3. Install Clawdbot Gateway

Moltz needs Gateway to actually talk to AI. Install it:

```bash
npm install -g clawdbot
clawdbot setup
clawdbot gateway start
```

**Don't have Node.js?** [Install it first](https://nodejs.org/) (takes 2 minutes).

**What just happened?** Gateway is now running in the background on port 18789.

---

### 4. Connect Moltz to Gateway

Launch Moltz. You'll see the setup wizard:

**📸 SCREENSHOT NEEDED: Onboarding welcome screen**

Click **Next**.

**📸 SCREENSHOT NEEDED: Gateway setup screen**

**Most people:** Just click "Test Connection". If Gateway is running, you're done!

**Connection failed?** See [Troubleshooting](#connection-issues) below.

---

### 5. Start Chatting

**📸 SCREENSHOT NEEDED: Empty chat view with input field**

Type a message, press Enter, watch the magic happen.

**Tips:**
- `Shift+Enter` for new lines
- `↑` arrow to edit your last message
- Click 📎 to attach files

---

## Connection Issues

### "Cannot connect to Gateway"

**Most common fix:**
```bash
# Is Gateway running?
clawdbot status

# Not running? Start it:
clawdbot start
```

**Still not working?**
1. Check your token: `clawdbot token show`
2. Copy the token
3. In Moltz: Settings → Connection → paste token
4. Click "Test Connection"

---

### "Gateway not found"

Gateway isn't installed. Go back to step 3 above.

---

### Windows: "Command 'clawdbot' not found"

Node.js isn't in your PATH. Two options:

**Option 1 (Easy):** Reinstall Node.js, check "Add to PATH"

**Option 2 (Manual):**
```bash
npm config get prefix
# Add that path to your System Environment Variables
```

---

## Advanced Setup

### Remote Gateway (Power Users)

Running Gateway on another machine? No problem.

**In Moltz:**
1. Settings → Connection
2. Change URL to `wss://your-gateway-hostname`
3. Paste your token
4. Test connection

**Using Tailscale?** First connection on macOS takes ~2 minutes (known macOS bug). Be patient. After that, it's instant.

---

### Multiple Gateways

Not supported yet. Coming in v1.1. For now, change the URL in Settings when switching.

---

## Next Steps

**New to Moltz?**
- [User Guide](./User-Guide.md) — Learn keyboard shortcuts, tips, tricks
- [Features](./Features.md) — See everything Moltz can do

**Want to customize?**
- [Configuration](./Configuration.md) — Themes, fonts, shortcuts

**Something broken?**
- [Troubleshooting](./Troubleshooting.md) — Common problems & fixes

---

## Still Stuck?

1. Check [GitHub Issues](https://github.com/AlixHQ/moltz/issues) for known problems
2. Ask in [Discussions](https://github.com/AlixHQ/moltz/discussions)
3. Open a new issue with:
   - What you tried
   - Error messages (Settings → View Logs)
   - Your OS and versions

We're here to help!

---

**Last updated:** January 2026
