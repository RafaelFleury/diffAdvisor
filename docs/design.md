## Reproduction Specification: CodeMentor UI Prototype

**Technology:** React JSX single-file artifact. Inline styles only (no Tailwind, no CSS files). Import only `useState`, `useEffect`, `useRef` from React. Load JetBrains Mono font via Google Fonts link tag inside the JSX.

---

### THEME SYSTEM

The app has two themes: light and dark. It starts in dark. All components receive the theme object `t` as a prop and use its properties for all colors. Never hardcode colors in components.

**Dark theme colors:**
- bg: `#0a0a0a`, bgSecondary: `#141414`, bgTertiary: `#1c1c1c`, bgHover: `#262626`
- border: `#2a2a2a`, borderLight: `#222222`
- text: `#e5e5e5`, textSecondary: `#a3a3a3`, textTertiary: `#737373`
- sidebarBg: `#0f0f0f`, cardBg: `#141414`, codeBg: `#1a1a1a`, inputBg: `#141414`
- diffAdd: `#052e16`, diffAddText: `#86efac`, diffAddBorder: `#14532d`
- diffDel: `#450a0a`, diffDelText: `#fca5a5`, diffDelBorder: `#7f1d1d`
- critical: `#ef4444`, criticalBg: `#1c0a0a`, criticalBorder: `#451a1a`
- warning: `#f59e0b`, warningBg: `#1c1505`, warningBorder: `#452f0a`
- info: `#3b82f6`, infoBg: `#0a1628`, infoBorder: `#1e3a5f`
- success: `#22c55e`, successBg: `#0a1c12`
- badgePending: `#1c1c1c`, badgePendingText: `#a3a3a3`
- badgeReviewed: `#0a1c12`, badgeReviewedText: `#86efac`
- shadow: `0 1px 3px rgba(0,0,0,0.3)`

**Light theme colors:**
- bg: `#ffffff`, bgSecondary: `#f5f5f5`, bgTertiary: `#ebebeb`, bgHover: `#e8e8e8`
- border: `#d4d4d4`, borderLight: `#e5e5e5`
- text: `#171717`, textSecondary: `#525252`, textTertiary: `#737373`
- sidebarBg: `#fafafa`, cardBg: `#ffffff`, codeBg: `#f5f5f5`, inputBg: `#ffffff`
- diffAdd: `#dcfce7`, diffAddText: `#166534`, diffAddBorder: `#bbf7d0`
- diffDel: `#fee2e2`, diffDelText: `#991b1b`, diffDelBorder: `#fecaca`
- critical: `#dc2626`, criticalBg: `#fef2f2`, criticalBorder: `#fecaca`
- warning: `#d97706`, warningBg: `#fffbeb`, warningBorder: `#fde68a`
- info: `#2563eb`, infoBg: `#eff6ff`, infoBorder: `#bfdbfe`
- success: `#16a34a`, successBg: `#f0fdf4`
- badgePending: `#f5f5f5`, badgePendingText: `#525252`
- badgeReviewed: `#f0fdf4`, badgeReviewedText: `#166534`
- shadow: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`

---

### GENERAL LAYOUT

The app occupies 100vw x 100vh with horizontal `display: flex`. The base font of the body is `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. Background and color transition 0.2s ease when switching themes.

**Left sidebar (56px fixed width):**
- Background: `t.sidebarBg`, right border 1px solid `t.border`
- Flex column, centered items, `justify-content: space-between`, padding top and bottom 16px
- At top: logo, then the 4 navigation buttons. At bottom: theme toggle button.

**Logo:** div 32x32px, borderRadius 8, background `t.text`, color `t.bg`, fontSize 14, fontWeight 700, JetBrains Mono. Content: text `</>`. Margin-bottom 16px below it.

**Navigation buttons:** 4 buttons (Dashboard, Debrief, Knowledge, Settings). Each is 40x40px, borderRadius 8, display flex centered. Icons are 18x18 SVGs with 2px stroke, no fill. Gap of 4px between buttons. The active button has background `t.bgHover` and color `t.text`. Inactive ones have transparent background and color `t.textTertiary`. Hover on inactive: background `t.bgHover`, color `t.textSecondary`. Transition 0.15s ease.

**Sidebar SVG icons (all 18x18, stroke="currentColor", strokeWidth=2, strokeLinecap/Join="round", fill="none"):**
- Dashboard: 4 rectangles (3,3,7,7 rx=1), (14,3,7,7 rx=1), (3,14,7,7 rx=1), (14,14,7,7 rx=1)
- Debrief: path "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", polyline "14,2 14,8 20,8", lines (16,13 to 8,13) and (16,17 to 8,17)
- Knowledge: path "M4 19.5A2.5 2.5 0 016.5 17H20", path "M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z", lines (8,7 to 16,7) and (8,11 to 13,11)
- Settings: circle cx=12 cy=12 r=3, full gear path (standard long path for gear icon)

**Theme button (bottom of sidebar):** 36x36px, borderRadius 8, transparent background, color `t.textTertiary`. Hover: background `t.bgHover`, color `t.text`. Shows sun icon (16x16) in dark theme, moon in light theme.

**Main content area:** flex: 1, overflow auto. Renders the active page.

---

### PAGE 1: DASHBOARD

Padding: 32px top/bottom, 40px left/right. maxWidth: 960px.

**Header:** h1 "Dashboard", fontSize 22, fontWeight 600, color `t.text`, letterSpacing -0.02em, JetBrains Mono. Below: text "~/projects/e-commerce-api", fontSize 13, color `t.textTertiary`, marginTop 6.

**Stat cards (3 in grid):** `grid-template-columns: repeat(3, 1fr)`, gap 12, marginBottom 32. Each card: background `t.cardBg`, border 1px solid `t.border`, borderRadius 8, padding 18px 20px. Label: fontSize 11, uppercase, letterSpacing 0.06em, color `t.textTertiary`, JetBrains Mono, marginBottom 8. Value: fontSize 28, fontWeight 700, JetBrains Mono, color varies (warning for "Pending Reviews" value 2, success for "Reviewed" value 2, critical for "Gaps Found" value 7).

**"Pending Review" section:** h2 with fontSize 13, fontWeight 600, color `t.textSecondary`, uppercase, letterSpacing 0.06em, JetBrains Mono, marginBottom 12. List of commit cards with gap 8 between them.

**Commit card (pending):** background `t.cardBg`, border 1px solid `t.border`, borderRadius 8, padding 14px 18px. Flex row, space-between, cursor pointer. Hover: borderColor changes to `t.textTertiary`, background changes to `t.bgSecondary`. Left side: GitCommit icon (14x14, circle cx=12 cy=12 r=4 with two horizontal lines) in color `t.warning`, gap 12, then commit message text (fontSize 13, fontWeight 500, color `t.text`, JetBrains Mono) and below it metadata (fontSize 11, color `t.textTertiary`, JetBrains Mono): "hash · time · X files · +additions -deletions". Right side: "pending" badge with fontSize 11, padding 3px 10px, borderRadius 99, background `t.badgePending`, color `t.badgePendingText`, JetBrains Mono.

**"Reviewed" section:** same h2 format. Identical commit cards but with opacity 0.7, Check icon (14x14 SVG, polyline "20,6 9,17 4,12", strokeWidth 2.5) in color `t.success`. "reviewed" badge with background `t.badgeReviewed`, color `t.badgeReviewedText`. Hover: opacity returns to 1.

**Mock data (4 commits):** 2 pending ("feat: add user authentication endpoint" hash a3f7c2d, 12 min ago, 3 files, +87 -4; "fix: update database connection pooling" hash e91b4f8, 2 hours ago, 2 files, +23 -11) and 2 reviewed ("feat: add product listing API" hash 7d2e5a1, yesterday, 4 files, +112 -8; "refactor: extract validation middleware" hash b8c3f01, 2 days ago, 5 files, +45 -67).

Clicking a pending commit opens the Debrief page with that commit.

---

### PAGE 2: DEBRIEF

Occupies 100% height. Flex column.

**Header bar:** padding 12px 20px, borderBottom 1px solid `t.border`, flex row, space-between, flexShrink 0. Left: "← Dashboard" button (background none, border none, color `t.textSecondary`, fontSize 13, JetBrains Mono, hover color `t.text`), separator "|" in color `t.border`, commit message (fontSize 13, fontWeight 500, color `t.text`, JetBrains Mono), commit hash (fontSize 11, color `t.textTertiary`, JetBrains Mono). Right: two buttons. "Save to KB": background `t.bgTertiary`, border 1px solid `t.border`, color `t.textSecondary`, padding 6px 14px, borderRadius 6, fontSize 12, JetBrains Mono, with Knowledge icon (14x14) on the left, gap 6. "Mark Reviewed": background `t.text`, color `t.bg`, no border, padding 6px 14px, borderRadius 6, fontSize 12, fontWeight 500, JetBrains Mono, with Check icon on the left.

**Split view:** flex: 1, display flex horizontal, overflow hidden.

**Left panel (diff):** width of `dividerPos`% (default 55%), overflow auto, background `t.codeBg`. Top bar: padding 10px 0, borderBottom 1px solid `t.border`. Inside it: padding 0 16px, flex row space-between. File name "src/routes/auth.ts" (fontSize 12, color `t.textSecondary`, JetBrains Mono) and stats "+87" in color `t.diffAddText` and "-4" in color `t.diffDelText` (fontSize 11, JetBrains Mono).

**Diff rendering:** each line is a div with: borderLeft 3px solid (transparent by default, `t.diffAddBorder` for + lines, `t.diffDelBorder` for - lines), padding 1px 12px 1px 8px, flex row gap 12. Line number on the left: color `t.textTertiary`, userSelect none, minWidth 28, textAlign right, fontSize 11. Content: pre tag with margin 0, JetBrains Mono, whiteSpace pre-wrap, wordBreak break-all, fontSize 12.5, lineHeight 22px. Text color: `t.textSecondary` by default, `t.diffAddText` with background `t.diffAdd` for lines starting with +, `t.diffDelText` with background `t.diffDel` for lines starting with -, `t.info` for lines starting with @@.

**Draggable divider:** div 5px wide, cursor col-resize, background `t.border`, flexShrink 0, zIndex 10. Hover: background `t.textTertiary`. When dragging, updates dividerPos between 30 and 75.

**Right panel (debrief):** width of `(100 - dividerPos)%`, overflow auto, padding 20px. Contains 4 collapsible sections.

**Collapsible section component:** marginBottom 16. Toggle button: flex row, gap 8, width 100%, padding 8px 0, background none, border none, cursor pointer, color `t.text`, fontSize 13, fontWeight 600, JetBrains Mono, textAlign left. ChevronDown icon (14x14, polyline "6,9 12,15 18,9") that rotates: transform rotate(0) when expanded, rotate(-90deg) when collapsed, transition 0.15s. After the icon, comes the section icon and title. Content: paddingLeft 4, paddingTop 4, visible only when expanded.

**Section 1: "Architectural Overview" (Eye icon 14x14, expanded by default):**
- Summary text: fontSize 13, lineHeight 1.7, color `t.textSecondary`, margin 0.
- Pattern tags: flex row, gap 6, flexWrap wrap, marginTop 12. Each tag: fontSize 11, padding 3px 10px, borderRadius 4, background `t.bgTertiary`, color `t.textSecondary`, border 1px solid `t.border`, JetBrains Mono.

**Section 2: "Decisions Made" (text icon "⚖", collapsed by default):**
- For each decision: div with marginBottom 16 (except last). Decision title: fontSize 13, fontWeight 500, color `t.text`, marginBottom 6. "Alternatives:": fontSize 12, "Alternatives:" in color `t.textSecondary`, rest in `t.textTertiary`, marginBottom 4. "Trade-offs:": same format.

**Section 3: "Gaps Found (5)" (Alert triangle icon 14x14, expanded by default):**
- Flex column, gap 10. Each gap is a card: background and border vary by severity (critical: bg `t.criticalBg`, border 1px solid `t.criticalBorder`; warning: bg `t.warningBg`, border `t.warningBorder`; info: bg `t.infoBg`, border `t.infoBorder`). BorderRadius 6, padding 12px 14px.
- Inside the card: header with flex row, gap 8, marginBottom 6. Severity label: fontSize 10, fontWeight 700, JetBrains Mono, letterSpacing 0.05em, color varies (critical color, warning color, info color), text "CRITICAL"/"WARNING"/"INFO". Category: fontSize 10, color `t.textTertiary`, JetBrains Mono.
- Description: fontSize 13, fontWeight 500, color `t.text`, marginBottom 6.
- Explanation: fontSize 12, color `t.textSecondary`, lineHeight 1.6, marginBottom 8.
- Suggestion box: fontSize 12, color `t.textSecondary`, lineHeight 1.6, padding 8px 12px, background `t.codeBg`, borderRadius 4, borderLeft 2px solid in severity color. "Suggestion: " in fontWeight 500, color `t.text`.

**Section 4: "Checkpoint" (text icon "❓", expanded by default):**
- Question tabs: flex row, gap 6, marginBottom 16. Each tab: padding 4px 12px, fontSize 12, borderRadius 4, cursor pointer, JetBrains Mono, border 1px solid `t.border`. Active tab: background `t.text`, color `t.bg`. Inactive tab: transparent background, color `t.textSecondary`. Tabs with answers show " ✓" next to them.
- Question text: fontSize 13, lineHeight 1.7, color `t.text`, padding 14px 16px, background `t.bgSecondary`, borderRadius 6, border 1px solid `t.border`, marginBottom 14.
- If unanswered: textarea with width 100%, minHeight 80, padding 10px 12px, fontSize 13, background `t.inputBg`, border 1px solid `t.border`, borderRadius 6, color `t.text`, JetBrains Mono, lineHeight 1.6, outline none, boxSizing border-box. Focus: borderColor `t.textTertiary`. "Submit Answer" button below: marginTop 8, padding 7px 18px, fontSize 12, background `t.text`, color `t.bg`, no border, borderRadius 6, JetBrains Mono, fontWeight 500. Opacity 0.4 if field empty, 1 if filled.
- If answered: card with padding 12px 14px, background `t.successBg`, border 1px solid `t.success` at 30% opacity, borderRadius 6. "Your answer:" in fontSize 12, fontWeight 500, color `t.success`, JetBrains Mono, marginBottom 6. Answer text in fontSize 12, color `t.textSecondary`, lineHeight 1.6. Below: italic text "AI evaluation would appear here analyzing your response..." in fontSize 12, color `t.textTertiary`, marginTop 10.

**Debrief mock data:** architectural summary about JWT authentication with Express.js. 3 patterns: "Stateless JWT Authentication", "Express Router Module Pattern", "Password Hashing with bcrypt". 2 decisions (JWT vs sessions, 24h expiration vs refresh tokens). 5 gaps (2 critical: JWT secret hardcoded and no input validation; 2 warning: no rate limiting and no error handling for DB failures; 1 info: registration returns data without auth). 3 checkpoint questions about token revocation, brute force at 10k requests, and security risk on line 7.

---

### PAGE 3: KNOWLEDGE BASE

Occupies 100% height. Flex row.

**Left sidebar (260px):** borderRight 1px solid `t.border`, flex column, flexShrink 0, background `t.sidebarBg`.

- **Search bar (top):** padding 12px 12px 8px. Container: flex row, gap 8, padding 7px 10px, background `t.inputBg`, border 1px solid `t.border`, borderRadius 6. Search icon (15x15, circle cx=11 cy=11 r=8, line 21,21 to 16.65,16.65). Input: border none, transparent background, outline none, color `t.text`, fontSize 12, width 100%, JetBrains Mono, placeholder "Search notes...".

- **"New Note" button:** padding 4px 12px 8px. Button: flex row, gap 6, width 100%, padding 6px 10px, background none, border 1px dashed `t.border`, borderRadius 6, cursor pointer, color `t.textTertiary`, fontSize 12, JetBrains Mono. Plus icon (14x14, two crossed lines). Hover: borderColor `t.textSecondary`, color `t.textSecondary`.

- **Folder tree:** flex 1, overflow auto, padding 4px 6px. Each folder: clickable div with flex row, gap 6, padding 5px 8px, paddingLeft increases 16px per depth level, fontSize 12, color `t.textSecondary`, borderRadius 4, JetBrains Mono. ChevronRight icon (14x14) when closed, ChevronDown when open. Folder icon (14x14, folder path). Hover: background `t.bgHover`. Each file inside folder: same style but additional paddingLeft of 26px + depth, File icon (14x14), color `t.textTertiary` when not selected, color `t.text` and background `t.bgHover` when selected.

**Mock tree:** Languages > JavaScript (Event Loop, Closures & Scope, Promises & Async/Await), Python (Decorators, Generators & Yield). Concepts > Security (JWT Authentication [selected by default], Input Validation, Rate Limiting), Architecture (REST API Design, Middleware Pattern). Checklists > Deployment (Pre-Deploy Security, Production Readiness). Folders "languages", "concepts" and "security" start expanded.

**Content area (right):** flex 1, overflow auto, padding 24px 36px. maxWidth 720.

- **Breadcrumb:** fontSize 11, color `t.textTertiary`, JetBrains Mono, marginBottom 16. Text "concepts / security / jwt-auth.md". Next to it, "auto-generated" badge: marginLeft 10, fontSize 10, padding 2px 8px, borderRadius 4, background `t.bgTertiary`, color `t.textTertiary`.

- **Markdown rendering:** parses the .md text and renders with styles:
  - H1 (`# `): fontSize 20, fontWeight 700, color `t.text`, margin 20px 0 10px, JetBrains Mono, letterSpacing -0.02em
  - H2 (`## `): fontSize 15, fontWeight 600, color `t.text`, margin 18px 0 8px, JetBrains Mono
  - Paragraphs: fontSize 13, color `t.textSecondary`, lineHeight 1.7, margin 6px 0
  - Lists (lines starting with `- ` or numbers): flex row, gap 8, fontSize 13, color `t.textSecondary`, lineHeight 1.7, marginBottom 4, paddingLeft 4. Bullet: "·" in color `t.textTertiary`
  - Inline code (between backticks): padding 1px 5px, background `t.bgTertiary`, borderRadius 3, fontSize 12, JetBrains Mono, color `t.text`
  - Bold (`**text**`): fontWeight 600, color `t.text`
  - Code blocks (between ```): container with margin 12px 0, borderRadius 6, overflow hidden, border 1px solid `t.border`. If has language identifier: top bar with padding 4px 12px, background `t.bgTertiary`, fontSize 10, color `t.textTertiary`, JetBrains Mono, borderBottom 1px solid `t.border`. Pre block: margin 0, padding 12px 14px, background `t.codeBg`, fontSize 12, lineHeight 1.7, color `t.textSecondary`, overflowX auto, JetBrains Mono
  - Horizontal line (`---`): border none, borderTop 1px solid `t.border`, margin 16px 0
  - Italic lines (starting and ending with `*`): fontSize 12, color `t.textTertiary`, lineHeight 1.6, margin 4px 0, fontStyle italic

**Mock .md content:** An article about JWT Authentication with sections "What it is", "How it works in this project", "Key Trade-offs" (with sublists "When to use JWT" and "When to prefer sessions"), "Security Essentials" (with JavaScript code block showing NEVER vs ALWAYS for JWT_SECRET), "Common Vulnerabilities" (numbered list), and italic footer with auto-generation date.

---

### PAGE 4: SETTINGS

Padding 32px 40px. maxWidth 640.

**Header:** h1 "Settings", fontSize 22, fontWeight 600, color `t.text`, letterSpacing -0.02em, JetBrains Mono, marginBottom 32.

**Section structure:** each section has h2 as title (fontSize 12, fontWeight 600, color `t.textTertiary`, uppercase, letterSpacing 0.06em, marginBottom 14, JetBrains Mono), followed by a container (background `t.cardBg`, border 1px solid `t.border`, borderRadius 8, overflow hidden) that contains rows. MarginBottom 28 between sections.

**Setting row:** padding 14px 18px, borderBottom 1px solid `t.borderLight`, flex row, alignItems center, gap 16. Label: fontSize 13, color `t.text`, minWidth 180, flexShrink 0, JetBrains Mono. Content on the right: flex 1, flex row, alignItems center.

**Input/select styles:** padding 8px 12px, background `t.inputBg`, border 1px solid `t.border`, borderRadius 6, color `t.text`, fontSize 13, outline none, width 100%, JetBrains Mono. Selects have custom chevron SVG as backgroundImage on the right (right 12px center), appearance none.

**Auxiliary buttons ("Browse", "Test"):** padding 8px 14px, background `t.bgTertiary`, border 1px solid `t.border`, borderRadius 6, color `t.textSecondary`, fontSize 12, cursor pointer, JetBrains Mono, whiteSpace nowrap.

**Toggle switch:** 38px width, 22px height, borderRadius 11, cursor pointer. When off: background `t.bgTertiary`, border 1px solid `t.border`. When on: background `t.text`, border 1px solid `t.text`. Inner circle: 16x16px, borderRadius 8. When off: background `t.textTertiary`, left 2px. When on: background `t.bg`, left 19px. Position absolute, top 2. Transition 0.2s ease on everything. Descriptive text beside: fontSize 11, color `t.textTertiary`, marginLeft 8.

**Theme buttons (Light/Dark):** flex row, gap 8. Each button: padding 7px 16px, fontSize 12, borderRadius 6, cursor pointer, JetBrains Mono, border 1px solid `t.border`. Active: background `t.text`, color `t.bg`. Inactive: transparent background, color `t.textSecondary`.

**Settings sections and their fields:**

1. **PROJECT:** Monitored Directory (readonly input + Browse button), File Extensions (editable input, default ".ts, .tsx, .js, .jsx, .py, .rs"), Ignored Paths (editable input, default "node_modules, .git, dist, __pycache__")

2. **AI PROVIDER:** Provider (select: Anthropic / OpenAI), Model (select that changes based on provider: Anthropic shows "Claude Sonnet 4" and "Claude Opus 4"; OpenAI shows "GPT-4.1" and "GPT-4.1 Mini"), API Key (password type input + Test button), Web Search (toggle ON + text "Search for CVEs and best practices")

3. **ANALYSIS:** Auto-Analyze on Commit (toggle OFF), Checkpoint Mode (select: "Free Text (deeper learning, uses more tokens)" / "Multiple Choice (faster review)"), Analysis Depth (select: "Quick" / "Balanced (recommended)" / "Deep")

4. **KNOWLEDGE BASE:** Storage Path (input + Browse button, default "~/.codementor/knowledge"), Auto-Generate Notes (toggle ON + text "Create .md notes from debriefs automatically")

5. **APPEARANCE:** Theme (Light/Dark buttons), Debrief Language (select: English / Português / Auto-detect)

---

### NAVIGATION AND STATE

- Global state: `theme` (dark/light), `page` (dashboard/debrief/knowledge/settings), `selectedCommit` (null or commit object).
- Clicking a commit on the Dashboard sets `selectedCommit` and changes `page` to "debrief".
- "← Dashboard" button on Debrief sets `page` to "dashboard".
- If page is "debrief" and selectedCommit is null, show empty state: centered text "Select a commit from the Dashboard to start a debrief" with Debrief icon, fontSize 13, JetBrains Mono, color `t.textTertiary`, padding 80px 0.
- Clicking sidebar icons changes `page`.
- Theme toggle switches `theme` between "dark" and "light".
