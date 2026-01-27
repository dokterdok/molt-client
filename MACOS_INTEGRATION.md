# macOS Native Window Chrome Integration

## Overview

Molt Client features **Slack/Discord-style window chrome** on macOS with integrated traffic lights and native drag regions.

---

## Configuration

### Tauri Config (`tauri.conf.json`)

```json
{
  "windows": [{
    "titleBarStyle": "overlay",
    "hiddenTitle": true,
    "decorations": true
  }]
}
```

**What this does:**
- `titleBarStyle: "overlay"` - Traffic lights overlay the content (not a separate title bar)
- `hiddenTitle: true` - Hides the window title text
- `decorations: true` - Shows system decorations (traffic lights)

---

## Implementation

### Platform Detection

```typescript
const isMacOS = typeof navigator !== "undefined" && 
  navigator.platform.toLowerCase().includes("mac");
```

Used throughout the app to conditionally apply macOS-specific styling.

---

## Sidebar Integration

**File:** `src/components/Sidebar.tsx`

### Header Area (Draggable)

```tsx
<div 
  className={cn("p-3 pb-0", isMacOS && "pt-2")}
  data-tauri-drag-region
>
  <div 
    className={cn("flex items-center gap-2 mb-3 px-1", isMacOS && "pl-[70px]")}
    data-tauri-drag-region
  >
    <span className="text-2xl select-none">🦞</span>
    <span className="font-semibold text-lg select-none">Molt</span>
    {/* Connection status */}
  </div>
</div>
```

**Key features:**
- `data-tauri-drag-region` - Makes area draggable for window movement
- `pt-2` (macOS) - Reduced top padding to align with traffic lights
- `pl-[70px]` (macOS) - Left padding to avoid traffic lights (~70px wide)
- `select-none` - Prevents text selection during drag

---

## Main Header Integration

**File:** `src/App.tsx`

### Header Bar (Draggable)

```tsx
<header 
  className={cn(
    "h-12 border-b border-border flex items-center justify-between px-4",
    isMacOS && "pt-2"
  )}
  data-tauri-drag-region
>
  <div 
    className={cn(
      "flex items-center gap-2",
      isMacOS && !sidebarOpen && "pl-[70px]"
    )}
    data-tauri-drag-region
  >
    {/* Sidebar toggle + title */}
    <h1 className="font-semibold select-none" data-tauri-drag-region>
      {currentConversation?.title || "Molt"}
    </h1>
  </div>
  
  <div className="flex items-center gap-2" data-tauri-drag-region>
    {/* Connection status */}
  </div>
</header>
```

**Behavior:**
- Entire header is draggable
- Traffic light padding **only when sidebar is closed** (otherwise sidebar handles it)
- Connection status is draggable (doesn't block window movement)

---

## Onboarding Integration

**File:** `src/components/onboarding/OnboardingFlow.tsx`

### Skip Hint Positioning

```tsx
<div className={cn(
  "absolute right-4 text-xs text-muted-foreground",
  isMacOS ? "top-2" : "top-4"
)}>
  Press <kbd>Esc</kbd> to skip
</div>
```

**Why:**
- `top-2` on macOS - Positions below traffic lights
- `top-4` elsewhere - Standard spacing
- Maintains visual consistency across the app

---

## Traffic Light Dimensions

macOS traffic lights occupy approximately:
- **Width**: ~70px (from left edge)
- **Height**: ~28px (from top edge)
- **Vertical center**: ~12-14px from top

We use `pl-[70px]` to ensure content starts after the traffic lights.

---

## Drag Region Best Practices

### ✅ **Do:**
- Apply `data-tauri-drag-region` to:
  - Headers
  - Title areas
  - Status displays
  - Non-interactive content
- Add `select-none` to draggable text
- Use on container elements

### ❌ **Don't:**
- Apply to interactive buttons (they handle their own clicks)
  - Exception: Can apply to container, button still captures clicks
- Apply to input fields
- Apply to scrollable areas

---

## Visual Result

On macOS:
```
┌─[●●●]─────────────────────────┐
│  🦞 Molt        ● Online      │ ← Draggable, traffic lights integrated
├───────────────────────────────┤
│  [New Chat]                   │
│  [Search...]                  │
│                               │
```

On Windows/Linux:
```
┌─ Molt ──────────────[─][□][×]─┐ ← System title bar
│  🦞 Molt        ● Online      │
├───────────────────────────────┤
│  [New Chat]                   │
```

---

## Testing

### Verify Integration Works:

1. **Dragging:**
   - Click and drag the sidebar header → window moves ✓
   - Click and drag the main header (sidebar closed) → window moves ✓
   - Click buttons → buttons work, window doesn't move ✓

2. **Traffic Lights:**
   - Open app on macOS
   - Traffic lights should overlay the sidebar
   - Content should not overlap traffic lights
   - Sidebar content starts after ~70px

3. **Keyboard:**
   - Text should not highlight when dragging
   - All shortcuts should still work (⌘N, ⌘K, etc.)

---

## Platform Differences

| Feature | macOS | Windows/Linux |
|---------|-------|---------------|
| **Title bar** | Hidden (overlay) | System default |
| **Traffic lights** | Overlay sidebar | Standard decorations |
| **Dragging** | Custom regions | System title bar |
| **Top padding** | `pt-2` | `pt-3` (default) |
| **Left padding** | `pl-[70px]` (when needed) | Default |

---

## Related Commits

- `721ad90` - macOS window chrome integration (App.tsx, Sidebar.tsx)
- `0cabc04` - Onboarding macOS skip hint positioning
- Earlier commits with Sidebar traffic light handling

---

## References

- [Tauri Window Customization](https://tauri.app/v1/guides/features/window-customization/)
- [macOS Human Interface Guidelines - Window Management](https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/)
- Inspiration: Slack Desktop, Discord, Linear

---

**Result:** Native macOS feel with full drag support and proper traffic light integration. 🎉
