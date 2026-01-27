# Moltzer Setup Guide

Complete guide to installing and configuring Moltzer and Clawdbot Gateway.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installing Clawdbot Gateway](#installing-clawdbot-gateway)
- [Installing Moltzer](#installing-Moltzer)
- [Configuring Gateway for Moltzer](#configuring-gateway-for-Moltzer)
- [Connecting Moltzer to Gateway](#connecting-Moltzer-to-gateway)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

### System Requirements

**Moltzer client:**
- **macOS:** 10.15 (Catalina) or later
- **Windows:** Windows 10 or later
- **Linux:** Modern distro with WebKit2GTK 4.1+
  - Ubuntu 20.04+
  - Fedora 36+
  - Arch Linux (latest)

**Hardware:**
- 100MB free disk space
- 4GB RAM (recommended)
- Internet connection for Gateway communication

### Network Requirements

- **Local Gateway:** Moltzer and Gateway can run on the same machine (default)
- **Remote Gateway:** Ensure firewall allows WebSocket connections (ports 18789 or custom)
- **TLS/SSL:** Optional but recommended for remote connections (use `wss://` URLs)

---

## Installing Clawdbot Gateway

Moltzer requires a running Clawdbot Gateway instance. Follow these steps to install it.

### Option 1: Using npm (Recommended)

```bash
# Install Clawdbot CLI globally
npm install -g clawdbot

# Verify installation
clawdbot --version
```

### Option 2: Using Docker

```bash
# Pull the Docker image
docker pull clawdbot/gateway:latest

# Run the Gateway
docker run -d \
  --name clawdbot-gateway \
  -p 18789:18789 \
  -v ~/.config/clawdbot:/root/.config/clawdbot \
  clawdbot/gateway:latest
```

### Option 3: From Source

```bash
# Clone the repository
git clone https://github.com/clawdbot/clawdbot.git
cd clawdbot

# Install dependencies
npm install

# Build and start
npm run build
npm start
```

### Initial Gateway Setup

1. **Start the Gateway:**
   ```bash
   clawdbot gateway start
   ```

2. **Check status:**
   ```bash
   clawdbot gateway status
   ```

   You should see:
   ```
   Gateway Status: Running
   WebSocket URL: ws://localhost:18789
   Auth: Enabled
   Token: eyJhbGciOiJIUzI1NiIs...
   ```

3. **Note your authentication token:**
   - The token is displayed in the status output
   - Or check `~/.config/clawdbot/clawdbot.json`

---

## Installing Moltzer

### macOS

**Method 1: Download .dmg**
1. Go to [Releases](https://github.com/dokterdok/molt-client/releases)
2. Download `Moltzer-1.0.0.dmg`
3. Open the .dmg file
4. Drag Moltzer to Applications folder
5. Launch Moltzer from Applications

**Method 2: Homebrew** *(if available)*
```bash
brew install molt-client
```

**Note:** First launch may show "Moltzer cannot be opened because the developer cannot be verified"
- Right-click Moltzer ? Open ? Open anyway
- This only needs to be done once

### Windows

**Method 1: Download .msi installer**
1. Go to [Releases](https://github.com/dokterdok/molt-client/releases)
2. Download `Moltzer-1.0.0.msi`
3. Run the installer
4. Follow the installation wizard
5. Launch Moltzer from Start Menu

**Method 2: Portable .exe**
1. Download `Moltzer-1.0.0.exe`
2. No installation needed — just run it!

**Note:** Windows Defender may show a warning (unsigned app)
- Click "More info" ? "Run anyway"

### Linux

**Method 1: AppImage** *(Recommended)*
```bash
# Download AppImage
wget https://github.com/dokterdok/molt-client/releases/download/v1.0.0/Moltzer-1.0.0.AppImage

# Make executable
chmod +x Moltzer-1.0.0.AppImage

# Run
./Moltzer-1.0.0.AppImage
```

**Method 2: .deb (Debian/Ubuntu)**
```bash
wget https://github.com/dokterdok/molt-client/releases/download/v1.0.0/Moltzer-1.0.0.deb
sudo dpkg -i Moltzer-1.0.0.deb
Moltzer
```

**Method 3: Build from source**
See [CONTRIBUTING.md](CONTRIBUTING.md) for build instructions.

---

## Configuring Gateway for Moltzer

### Basic Configuration

Moltzer works with default Gateway settings out-of-the-box. No special configuration needed!

### Custom Port

If you need to change the Gateway port:

**Edit Gateway config:**
```bash
# Open config file
nano ~/.config/clawdbot/clawdbot.json
```

**Change the port:**
```json
{
  "gateway": {
    "port": 8080,  // Change from default 18789
    "host": "0.0.0.0"
  }
}
```

**Restart Gateway:**
```bash
clawdbot gateway restart
```

**Update Moltzer settings:**
- Open Moltzer ? Settings
- Change Gateway URL to `ws://localhost:8080`

### Enable/Disable Authentication

**Disable auth** *(not recommended for remote access)*:
```json
{
  "gateway": {
    "auth": {
      "enabled": false
    }
  }
}
```

**Regenerate token:**
```bash
clawdbot gateway regenerate-token
```

### Remote Access

To access Gateway from another machine:

1. **Configure Gateway to listen on all interfaces:**
   ```json
   {
     "gateway": {
       "host": "0.0.0.0",
       "port": 18789
     }
   }
   ```

2. **Configure firewall:**
   ```bash
   # Linux (ufw)
   sudo ufw allow 18789/tcp
   
   # macOS
   # System Settings ? Network ? Firewall ? Allow port 18789
   
   # Windows
   # Windows Defender Firewall ? Allow app through firewall
   ```

3. **in Moltzer, use the remote IP:**
   ```
   ws://192.168.1.100:18789
   ```

4. **For security, use TLS/SSL:**
   - Set up reverse proxy (nginx, Caddy)
   - Use `wss://` URL in Moltzer

---

## Connecting Moltzer to Gateway

### First Launch Setup

1. **Launch Moltzer** — You'll see the onboarding screen

2. **Enter Gateway details:**
   - **Gateway URL:** `ws://localhost:18789` (or your custom URL)
   - **Auth Token:** Paste from Gateway status or config file

3. **Test connection:**
   - Click "Test Connection"
   - Green checkmark = success!
   - Red X = see [Troubleshooting](#troubleshooting)

4. **Complete setup:**
   - Click "Continue"
   - You're ready to chat!

### Manual Connection (Settings)

If you skipped onboarding or need to reconnect:

1. **Open Settings:** Press **?,** (Mac) or **Ctrl+,** (Windows/Linux)

2. **Update Gateway connection:**
   - Gateway URL: `ws://localhost:18789`
   - Auth Token: Your token

3. **Test connection:**
   - Click "Test Connection"
   - Wait for green status

4. **Save changes:**
   - Click "Save Changes"
   - Moltzer will reconnect automatically

### Automatic Protocol Detection

Moltzer automatically tries both `ws://` and `wss://` if one fails:

- Enter `ws://example.com:18789`
- If connection fails, Moltzer tries `wss://example.com:18789`
- The working URL is saved automatically

**No need to guess!**

---

## Troubleshooting

### Moltzer won't connect to Gateway

**Symptoms:**
- "Connection lost" banner
- "Disconnected" status
- "Failed to connect" error

**Solutions:**

1. **Verify Gateway is running:**
   ```bash
   clawdbot gateway status
   ```
   
   If not running:
   ```bash
   clawdbot gateway start
   ```

2. **Check Gateway URL:**
   - Default: `ws://localhost:18789`
   - Match the port in Gateway status output
   - Try `127.0.0.1` instead of `localhost`

3. **Verify auth token:**
   ```bash
   clawdbot gateway status
   ```
   
   Copy the exact token, including any trailing characters.

4. **Check firewall:**
   ```bash
   # Test connectivity
   curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     ws://localhost:18789
   ```

5. **Try protocol fallback:**
   - Change `ws://` to `wss://` (or vice versa)
   - Moltzer should auto-detect, but manual override can help

### Gateway crashes or won't start

**Check logs:**
```bash
# View Gateway logs
clawdbot gateway logs

# Or check log file
tail -f ~/.config/clawdbot/logs/gateway.log
```

**Common issues:**

- **Port already in use:**
  ```bash
  # Find what's using port 18789
  lsof -i :18789  # macOS/Linux
  netstat -ano | findstr :18789  # Windows
  
  # Kill the process or change Gateway port
  ```

- **Corrupted config:**
  ```bash
  # Backup and reset config
  mv ~/.config/clawdbot/clawdbot.json ~/.config/clawdbot/clawdbot.json.bak
  clawdbot gateway start  # Creates new config
  ```

- **Missing API keys:**
  - Gateway needs Anthropic API key for Claude
  - Check config: `~/.config/clawdbot/clawdbot.json`
  - Add your API key:
    ```json
    {
      "providers": {
        "anthropic": {
          "apiKey": "sk-ant-..."
        }
      }
    }
    ```

### Moltzer crashes on startup

**macOS:**
```bash
# Check for crash reports
ls ~/Library/Logs/DiagnosticReports/Moltzer*

# Run from terminal to see errors
/Applications/Moltzer.app/Contents/MacOS/Moltzer
```

**Windows:**
```powershell
# Check Event Viewer
eventvwr.msc

# Run from PowerShell
& "C:\Program Files\Moltzer\Moltzer.exe"
```

**Linux:**
```bash
# Run from terminal
./Moltzer-1.0.0.AppImage

# Check system logs
journalctl -xe | grep Moltzer
```

### Messages not encrypting

**Symptoms:**
- No lock icon on messages
- Settings ? Storage shows 0 conversations

**Solutions:**

1. **Check keychain access:**
   ```bash
   # macOS: Open Keychain Access.app
   # Search for "molt-client-master-key"
   
   # Windows: Control Panel ? Credential Manager
   # Look for "com.moltzer.client"
   
   # Linux: Check secret-service
   secret-tool lookup service com.moltzer.client key molt-client-master-key
   ```

2. **Reset encryption key** *(deletes all local data)*:
   - Settings ? Advanced ? Reset encryption key
   - Or manually delete from keychain

3. **Check browser compatibility:**
   - Web Crypto API required
   - Works in all modern browsers/webviews

### Search not working

**Check IndexedDB:**

1. Open Developer Tools:
   - macOS: **??I**
   - Windows/Linux: **Ctrl+Shift+I**

2. Go to Application ? Storage ? IndexedDB
3. Look for "MoltzerDB"
4. Check if conversations and messages exist

**Rebuild index:**
- Settings ? Advanced ? Clear local data ? Reimport from Gateway

---

## Advanced Configuration

### Custom Gateway URL with Proxy

If using a reverse proxy (nginx, Caddy):

**nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name gateway.example.com;
    
    location / {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

**Moltzer URL:**
```
wss://gateway.example.com
```

### Multiple Gateway Profiles

Moltzer stores settings per OS user. To use multiple Gateways:

1. **Create separate OS user accounts**
2. **Or manually switch settings:**
   - Settings ? Gateway URL ? Enter new Gateway
   - Settings ? Auth Token ? Enter new token
   - Test connection ? Save

### Environment Variables

Override default config via environment variables:

```bash
# macOS/Linux
export moltzer_GATEWAY_URL="ws://localhost:8080"
export moltzer_GATEWAY_TOKEN="your-token-here"
./Moltzer-1.0.0.AppImage

# Windows PowerShell
$env:moltzer_GATEWAY_URL="ws://localhost:8080"
$env:moltzer_GATEWAY_TOKEN="your-token-here"
& "C:\Program Files\Moltzer\Moltzer.exe"
```

### Developer Tools

Enable developer tools for debugging:

```bash
# macOS/Linux
moltzer_DEVTOOLS=1 ./Moltzer-1.0.0.AppImage

# Windows
$env:moltzer_DEVTOOLS=1
& "C:\Program Files\Moltzer\Moltzer.exe"
```

Then press **??I** (Mac) or **Ctrl+Shift+I** (Windows/Linux)

---

## Next Steps

- **Read [FEATURES.md](FEATURES.md)** — Explore all Moltzer features
- **Read [SECURITY.md](SECURITY.md)** — Understand how your data is protected
- **Join the community** — [GitHub Discussions](https://github.com/dokterdok/molt-client/discussions)

---

## Need Help?

- **GitHub Issues:** [Report a bug](https://github.com/dokterdok/molt-client/issues/new)
- **Discussions:** [Ask a question](https://github.com/dokterdok/molt-client/discussions/new)
- **Email:** support@moltzer.dev
