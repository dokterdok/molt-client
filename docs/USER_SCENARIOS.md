# USER SCENARIOS: UX for Different Use Cases

This document outlines optimal UX design for different Molt user personas and scenarios.

---

## User Personas

### 1. Power User (Tech Professional)

**Profile:**
- Tech-savvy developer or power user
- Uses AI for coding, research, complex tasks
- Values efficiency and speed over hand-holding
- Comfortable with keyboard navigation
- Manages multiple concurrent conversations
- Wants advanced features at fingertips

**Key Needs:**
- Keyboard shortcuts for everything
- Fast conversation switching
- Search across all conversations
- Quick access to settings/models
- Minimal UI chrome when focused
- Export/share capabilities

**Frustrations to Avoid:**
- Slow navigation requiring mouse
- Hidden features requiring clicks to discover
- Modal dialogs that break flow
- Lack of search/filtering
- Can't customize or configure

---

### 2. Casual User

**Profile:**
- Non-technical or occasional AI user
- Just wants to ask questions and get answers
- Doesn't care about models, tokens, or advanced features
- May be intimidated by complexity
- Uses mouse more than keyboard
- Single conversation at a time

**Key Needs:**
- Dead simple onboarding
- Clean, uncluttered interface
- Obvious "type here" input
- Features are discoverable when needed
- Forgiving (undo, edit messages)
- Helpful, not overwhelming

**Frustrations to Avoid:**
- Technical jargon (API keys, endpoints, models)
- Too many options/settings upfront
- Unclear how to start a conversation
- Intimidating "advanced" UI
- Requires reading documentation

---

### 3. Team Admin

**Profile:**
- Sets up Molt for team or organization
- Manages Gateway, configurations, user access
- Cares about security, cost control, consistency
- May not use Molt daily themselves
- Needs visibility into usage
- Troubleshoots issues for others

**Key Needs:**
- Clear admin/setup mode
- Gateway configuration wizard
- User management (if applicable)
- Usage monitoring
- Export configurations
- Troubleshooting tools

**Frustrations to Avoid:**
- Settings scattered across UI
- No visibility into what users are doing
- Hard to replicate configurations
- Can't control costs or limits
- No audit logs

---

## Scenario Walkthroughs

### Scenario A: First-Time Setup (No Gateway)

**User:** Casual User or Power User (first time)

**Flow:**
1. **Launch Molt** → Welcome screen appears
2. **Welcome Screen** shows:
   - "Welcome to Molt - Your AI Assistant"
   - Two clear paths:
     - **Quick Start**: "Use cloud AI (requires API key)"
     - **Advanced**: "Connect to local Gateway (recommended for teams)"
3. **User chooses Quick Start**
4. **API Key Screen**:
   - Simple explanation: "Molt needs an AI provider. We support Anthropic, OpenAI, and others."
   - Drop-down: Select provider (Anthropic selected by default)
   - Input: "Paste your API key here"
   - Link: "Don't have one? Get an Anthropic key here →"
   - Button: "Continue"
   - Advanced toggle: "⚙️ Advanced settings" (collapsed)
5. **Verify Connection**:
   - "Testing connection..." (spinner)
   - Success: "✓ Connected! Starting your first conversation..."
6. **Land in Chat**:
   - Clean, single conversation view
   - Welcome message from AI: "Hi! I'm Claude. What can I help you with?"
   - Input field focused, ready to type

**UX Principles:**
- ✅ Path of least resistance to first message
- ✅ Advanced options hidden but accessible
- ✅ Progressive disclosure (API key → chat)
- ✅ No jargon ("API key" briefly explained)
- ✅ Success feedback at each step

---

### Scenario B: First-Time Setup (Existing Gateway)

**User:** Power User or Team Member

**Flow:**
1. **Launch Molt** → Welcome screen
2. **User chooses "Connect to Gateway"**
3. **Gateway Connection Screen**:
   - Input: "Gateway URL" (placeholder: `http://localhost:3000`)
   - Auto-detect: "🔍 Searching for local Gateway..." (button)
   - Help text: "Your admin should provide this URL"
   - Button: "Connect"
4. **Auto-detect finds Gateway**:
   - "✓ Found Gateway at http://localhost:3000"
   - Pre-fills URL field
5. **Connect & Authenticate**:
   - If Gateway requires auth: prompt for token/password
   - If open: auto-connect
6. **Success**:
   - "✓ Connected to Gateway"
   - Shows available models
   - "Start chatting →"
7. **Land in Chat**

**UX Principles:**
- ✅ Auto-discovery reduces friction
- ✅ Clear for team environments
- ✅ Handles auth gracefully
- ✅ Admin can pre-configure URL

---

### Scenario C: Daily Coding Assistance

**User:** Power User

**Flow:**
1. **Launch Molt** (already configured)
   - Opens to last conversation OR conversation list
2. **User needs new coding session**:
   - Keyboard: `Cmd/Ctrl+N` → New conversation
   - OR click "New Chat" button
3. **Conversation starts**:
   - User types: "Help me refactor this Python function..."
   - Pastes code
   - Sends (`Enter` or `Cmd+Enter` depending on setting)
4. **AI responds with suggestions**
5. **User iterates**:
   - Edits their previous message (click edit icon or `↑` key when input empty)
   - Branches conversation (if supported)
   - Copies code blocks (click copy icon)
6. **User switches to another conversation**:
   - Keyboard: `Cmd/Ctrl+K` → Quick switcher
   - Types partial conversation name
   - `Enter` to switch
7. **Returns to coding conversation**:
   - Continues where left off
   - All context preserved

**UX Principles:**
- ✅ Keyboard-first workflow
- ✅ Fast conversation switching
- ✅ Context preservation
- ✅ Code-friendly (copy buttons, syntax highlighting)
- ✅ Edit/branch for iteration

**Prominent Features:**
- Quick switcher (`Cmd+K`)
- New conversation (`Cmd+N`)
- Edit message (`↑` or edit icon)
- Code copy buttons
- Conversation list (sidebar or `Cmd+\`)

**Hidden/Secondary:**
- Settings
- Model selection (defaults work)
- Export/share

---

### Scenario D: Long Research Session

**User:** Power User or Casual User

**Flow:**
1. **User starts conversation**: "Help me research the history of neural networks"
2. **AI provides overview**
3. **User asks follow-ups** over 30-60 minutes:
   - "What about transformers?"
   - "Compare CNNs vs RNNs"
   - "Who invented backprop?"
4. **User wants to save/reference this**:
   - Names conversation: Click title → "Neural Network History Research"
   - OR conversation auto-titled by AI
5. **User takes break**:
   - Closes Molt
6. **Returns later**:
   - Conversation list shows "Neural Network History Research"
   - Opens it, continues

**UX Principles:**
- ✅ Long conversations well-supported
- ✅ Scroll position preserved
- ✅ Easy to name/organize
- ✅ Search to find later

**Prominent Features:**
- Conversation title (editable)
- Save indicator (auto-save)
- Scroll to top/bottom buttons (long conversations)
- Search across conversations

**Hidden/Secondary:**
- Export full conversation
- Share link (if supported)

---

### Scenario E: Quick Question

**User:** Casual User

**Flow:**
1. **User opens Molt**
2. **Types quick question**: "What's the capital of Latvia?"
3. **AI responds**: "Riga"
4. **User is done**
   - Closes app OR leaves it open

**UX Principles:**
- ✅ Zero friction to ask
- ✅ Immediate response
- ✅ No need to manage conversation
- ✅ Ephemeral okay for casual users

**Prominent Features:**
- Input field (always visible, always ready)
- Fast response

**Hidden/Secondary:**
- Everything else

---

### Scenario F: Sharing Conversation

**User:** Power User or Team Admin

**Flow:**
1. **User has valuable conversation** (e.g., debugging session)
2. **Wants to share with colleague**
3. **Options**:
   - **Export**: File → Export as Markdown/JSON
   - **Share Link**: Click "Share" → Generate shareable link (if Gateway supports)
   - **Copy All**: Select all messages → Copy to clipboard
4. **User chooses Export**:
   - Dialog: "Export conversation"
   - Format: Markdown ✓ / JSON / HTML
   - Include: All messages / Selected messages
   - Button: "Export"
5. **File saved**: `conversation-2024-01-15.md`
6. **User sends file to colleague**

**UX Principles:**
- ✅ Multiple export formats
- ✅ Shareable links (when possible)
- ✅ Preserves formatting

**Prominent Features:**
- Export button (toolbar or conversation menu)
- Share link (if available)

**Hidden/Secondary:**
- Format options (default to Markdown)

---

## UX Recommendations by Scenario

### Power User (Alex) Recommendations

#### **Prominent:**
- **Keyboard shortcuts** - displayed in tooltips, help menu
- **Quick switcher** (`Cmd+K`) - fuzzy search across conversations
- **Sidebar** - conversation list always accessible (`Cmd+\` to toggle)
- **Command palette** - `Cmd+Shift+P` for all actions
- **Model selector** - visible in header, quick dropdown
- **Search** - `Cmd+F` within conversation, `Cmd+Shift+F` across all
- **Code blocks** - syntax highlighting, copy button, line numbers

#### **Hidden/Secondary:**
- Welcome screens (only first launch)
- Tutorials (link in help menu)
- Explanatory text (use tooltips)

#### **Ideal Flow:**
```
Launch → Conversation list → Cmd+N → Type → Iterate → Cmd+K → Switch → Repeat
```

**Settings to expose:**
- Keyboard shortcuts customization
- Model defaults
- `Enter` behavior (send vs newline)
- Theme (dark/light)
- Sidebar position (left/right)

---

### Casual User Recommendations

#### **Prominent:**
- **Input field** - large, obvious, placeholder: "Ask me anything..."
- **Send button** - visible (don't rely on `Enter`)
- **New chat button** - clear, top of conversation
- **Conversation title** - editable, auto-generated
- **Simple menu** - hamburger or gear icon

#### **Hidden/Secondary:**
- Keyboard shortcuts (support but don't advertise)
- Model selection (use smart default)
- Advanced settings (in separate "Advanced" section)
- Technical details (tokens, cost, latency)

#### **Ideal Flow:**
```
Launch → See input field → Type question → Click send → Read answer → Done
```

**Progressive Disclosure:**
- First launch: Just input + send
- After 5 messages: Suggest "You can start a new conversation"
- After 3 conversations: Suggest "You can search your past conversations"
- Settings: Hidden until user explores

---

### Team Admin Recommendations

#### **Prominent:**
- **Admin panel** - separate section or dedicated app
- **Gateway status** - connected/disconnected, URL
- **User management** - add/remove users (if applicable)
- **Usage dashboard** - tokens used, costs, activity
- **Configuration** - model settings, rate limits, allowed models

#### **Hidden/Secondary:**
- Day-to-day chat interface (may not use)

#### **Ideal Flow:**
```
Install Gateway → Configure → Set up users → Monitor → Troubleshoot
```

**Admin-specific features:**
- **Gateway setup wizard** - step-by-step configuration
- **Config export/import** - deploy to multiple instances
- **Logs** - troubleshoot connection issues
- **Defaults** - set for all users
- **Security** - API key management, auth settings

---

## Universal UX Principles

### 1. **Keyboard + Mouse Harmony**
- Everything accessible via mouse (casual users)
- Everything accessible via keyboard (power users)
- Tooltips show keyboard shortcuts on hover

### 2. **Progressive Disclosure**
- Start simple, reveal complexity as needed
- Advanced settings in collapsible sections
- "Show advanced options" toggles

### 3. **Responsive Feedback**
- Loading states (spinners, progress)
- Success confirmations (✓ saved, ✓ sent)
- Error messages (clear, actionable)

### 4. **Forgiving**
- Edit sent messages
- Undo actions where possible
- Confirm destructive actions (delete conversation)

### 5. **Fast**
- Instant navigation between conversations
- Lazy load old messages
- Optimistic UI updates (send message immediately, show sending state)

### 6. **Accessible**
- Keyboard navigation (tab order)
- Screen reader support
- High contrast mode
- Configurable font sizes

---

## Feature Visibility Matrix

| Feature | Power User | Casual User | Team Admin |
|---------|-----------|-------------|------------|
| **Keyboard shortcuts** | Prominent | Hidden | Secondary |
| **New conversation** | Cmd+N | Big button | Secondary |
| **Conversation list** | Always visible | Hamburger menu | Secondary |
| **Search** | Cmd+F | "Search" in menu | Prominent (usage) |
| **Model selector** | Header dropdown | Hidden (auto) | Config panel |
| **Settings** | Cmd+, | Gear icon | Admin panel |
| **Export** | Right-click menu | Share button | Prominent |
| **Gateway config** | Settings tab | Hidden | Wizard |
| **Usage stats** | Optional widget | Hidden | Dashboard |

---

## Onboarding Strategies

### Power User
- **Skip intro** - option to skip welcome screens
- **Import conversations** - from other tools
- **Keyboard cheat sheet** - `?` to display

### Casual User
- **Guided tutorial** - optional 30-second intro
- **Contextual tips** - "💡 Tip: You can edit your messages"
- **Empty states** - helpful suggestions when no conversations

### Team Admin
- **Setup wizard** - step-by-step Gateway configuration
- **Documentation links** - prominently placed
- **Test mode** - verify setup before rolling out

---

## Dark Patterns to Avoid

❌ **Hiding exit/delete** - always allow users to leave or delete
❌ **Forced registration** - allow local use without account
❌ **Nagging** - don't repeatedly prompt for reviews/feedback
❌ **Dark patterns** - no tricks to lock users in
❌ **Data hostage** - easy export anytime

---

## Success Metrics by Persona

### Power User
- Time to first message: <5 seconds
- Conversations created per day: 5-20
- Keyboard shortcut usage: >80%
- Feature discovery: 8+ features used

### Casual User
- Time to first message: <30 seconds (first launch)
- Time to first message: <3 seconds (returning)
- Completion rate: >90% get answer to question
- Return rate: 3+ sessions per week

### Team Admin
- Setup time: <15 minutes (Gateway)
- User setup time: <2 minutes per user
- Support tickets: <1 per 10 users
- Configuration success: 100% (wizard-guided)

---

## Recommended UI Modes

### 1. **Focus Mode** (Power User)
- Hide sidebar, maximize chat area
- `Cmd+Shift+F` to toggle
- Distraction-free for deep work

### 2. **Compact Mode** (All)
- Smaller message spacing
- More messages visible
- Toggle in View menu

### 3. **Presentation Mode** (Sharing)
- Hide UI chrome
- Show only conversation
- For screenshots/demos

### 4. **Admin Mode** (Team Admin)
- Show Gateway status, usage stats
- Configuration shortcuts
- System health indicators

---

## Implementation Priorities

### Phase 1: MVP (Casual User focused)
- Simple chat interface
- API key setup
- Basic conversation management
- Export to Markdown

### Phase 2: Power Features
- Keyboard shortcuts
- Quick switcher
- Search
- Conversation sidebar

### Phase 3: Team/Admin
- Gateway configuration UI
- User management
- Usage dashboard
- Advanced settings

### Phase 4: Polish
- Themes
- Customization
- Accessibility
- Mobile-responsive

---

## Conclusion

**The Golden Rule**: Design for casual users by default, but provide escape hatches for power users.

- **Simple things should be simple** (casual user asks question)
- **Complex things should be possible** (power user automates workflow)
- **Expert things should be discoverable** (admin configures Gateway)

Molt should feel as simple as a notepad for casual users, yet as powerful as a terminal for power users.
