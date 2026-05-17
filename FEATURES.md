# Meridian — Feature Implementation Tracker

> Last updated: 2026-05-17 (6 features implemented)
> Architecture constraint: single HTML file, no build step, CDN-only libraries, localStorage persistence.

**Status legend**
| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done |
| `[-]` | Deferred / won't do |

---

## 1. Editor Enhancements

| # | Feature | Complexity | New library? | Status | Notes |
|---|---------|-----------|-------------|--------|-------|
| 1.1 | [Multi-line comment toggle](#11-multi-line-comment-toggle) | S | No | `[-]` | |
| 1.2 | [Find & Replace](#12-find--replace) | S | Optional (CM6 search) | `[-]` | |
| 1.3 | [Auto-format / Prettify Input](#13-auto-format--prettify-input) | M | No | `[-]` | |
| 1.4 | [Context-aware Autocomplete](#14-context-aware-autocomplete) | S | No | `[x]` | |
| 1.5 | [Scratch Pad / Secondary Input](#15-scratch-pad--secondary-input) | S | No | `[-]` | |

---

## 2. Preview / Canvas Enhancements

| # | Feature | Complexity | New library? | Status | Notes |
|---|---------|-----------|-------------|--------|-------|
| 2.1 | [Focus / Isolation Mode](#21-focus--isolation-mode) | M | No | `[-]` | |
| 2.2 | [Hover Tooltip on Nodes](#22-hover-tooltip-on-nodes) | S | No | `[x]` | |
| 2.3 | [Minimap](#23-minimap) | M | No | `[-]` | |
| 2.4 | [Relationship Table Panel](#24-relationship-table-panel) | M | No | `[-]` | |
| 2.5 | [Annotation / Sticky Note Layer](#25-annotation--sticky-note-layer) | M | No | `[-]` | |

---

## 3. New Diagram Types

| # | Feature | Complexity | New library? | Status | Notes |
|---|---------|-----------|-------------|--------|-------|
| 3.1 | [ER Diagram (`erDiagram`)](#31-er-diagram) | M | No | `[-]` | Mermaid v11 native |
| 3.2 | [State Diagram (`stateDiagram-v2`)](#32-state-diagram) | M | No | `[-]` | Mermaid v11 native |
| 3.3 | [Gantt Chart](#33-gantt-chart) | S | No | `[-]` | Pass-through mode |
| 3.4 | [Mindmap](#34-mindmap) | S | No | `[-]` | Pass-through mode |
| 3.5 | [Timeline](#35-timeline) | S | No | `[-]` | Pass-through mode |

---

## 4. Intelligence & Linting

| # | Feature | Complexity | New library? | Status | Notes |
|---|---------|-----------|-------------|--------|-------|
| 4.1 | [Circular Dependency Detection](#41-circular-dependency-detection) | S | No | `[x]` | New lint rule |
| 4.2 | [Naming Convention Linting](#42-naming-convention-linting) | M | No | `[x]` | Settings-driven |
| 4.3 | [Architecture Health Score](#43-architecture-health-score) | S | No | `[-]` | Status bar badge |
| 4.4 | [Suggest Missing Connections](#44-suggest-missing-connections) | S | No | `[-]` | One-click fix |

---

## 5. Export & Sharing

| # | Feature | Complexity | New library? | Status | Notes |
|---|---------|-----------|-------------|--------|-------|
| 5.1 | [Print / PDF Export](#51-print--pdf-export) | S | No | `[-]` | `@media print` CSS |
| 5.2 | [Export to PlantUML](#52-export-to-plantuml) | M | No | `[-]` | `parser.toPlantUML()` |
| 5.3 | [Version Snapshots](#53-version-snapshots) | M | No | `[-]` | localStorage |
| 5.4 | [Embed Playground Link (LZ)](#54-embed-playground-link) | S | lz-string (~3 KB) | `[-]` | Full-state URL |

---

## 6. UX Improvements

| # | Feature | Complexity | New library? | Status | Notes |
|---|---------|-----------|-------------|--------|-------|
| 6.1 | [Command Palette (Ctrl+K)](#61-command-palette) | M | No | `[-]` | |
| 6.2 | [Node Inspector Panel](#62-node-inspector-panel) | M | No | `[x]` | |
| 6.3 | [Cycle Diagram Types Shortcut](#63-cycle-diagram-types-shortcut) | S | No | `[-]` | Ctrl+Shift+T |
| 6.4 | [Multi-node Selection & Bulk Ops](#64-multi-node-selection--bulk-ops) | L | No | `[-]` | |
| 6.5 | [Dark Mode Keyboard Shortcut](#65-dark-mode-keyboard-shortcut) | S | No | `[-]` | Ctrl+Shift+D |
| 6.6 | [Collapsible Subgraph Groups](#66-collapsible-subgraph-groups) | L | No | `[x]` | |

---

## Detailed Specifications

### 1.1 Multi-line Comment Toggle
**Status**: `[ ]`

Extend `toggleCommentLine()` so that Ctrl+/ on a multi-line selection toggles `//` on every line in the range.

**Implementation**
- In `toggleCommentLine()`, check whether `state.selection.main.from !== state.selection.main.to`
- Collect all lines from `lineAt(from)` through `lineAt(to)` into an array
- Rule: if *any* line in the selection is uncommented, comment all; if all are commented, uncomment all
- Build a batch `changes: []` array and dispatch as a single `state.update({ changes })`
- Cursor lands at the start of the last affected line

**Files to change**: `meridian.html` — `toggleCommentLine()` function

---

### 1.2 Find & Replace
**Status**: `[ ]`

Ctrl+H opens a slim panel above the Smart Input with Find / Replace / Replace All fields.

**Implementation (custom modal — no new import)**
- Add `<div id="findReplaceBar">` with two inputs and three buttons (Find Next, Replace, Replace All)
- Maintain `_findReplaceOpen` flag; Ctrl+H toggles; Escape closes
- "Find Next": scan `$input.value` for next occurrence after cursor, select it via `_cmView.dispatch({ selection: ... })`
- "Replace": replace current selection if it matches, then advance
- "Replace All": `_cmView.dispatch(state.update({ changes: allOccurrences.map(...) }))` in a single transaction
- Optional regex toggle: wrap query in `new RegExp(query, flags)` when active

**Files to change**: `meridian.html` — HTML panel, global keydown handler, new `openFindReplace()` / `closeFindReplace()` functions

---

### 1.3 Auto-format / Prettify Input
**Status**: `[ ]`

Toolbar button (or Ctrl+Shift+I) that reformats the Smart Input text into canonical order.

**Implementation**
- Canonical order: comments → env/net/domain blocks → standalone entities → relationships
- Parse lines into buckets using the same `//`/`#` comment detection and block detection logic already in `SmartParser`
- Within each bucket, sort alphabetically
- Normalise indentation in blocks to 2 spaces
- Dispatch the formatted string back via `_cmView.dispatch(state.update({ changes: [{ from:0, to: doc.length, insert: formatted }] }))` — this is a single undoable transaction

**Files to change**: `meridian.html` — new `prettifyInput()` function, toolbar button HTML

---

### 1.4 Context-aware Autocomplete
**Status**: `[x]`

After an arrow token or NL connector, suggest entity names as targets instead of type prefixes.

**Implementation**
- In `meridianCompletion(context)`, look back one token using `context.matchBefore(/.*/)` for the last non-whitespace word
- If it's an arrow (`-->`, `>>`, `calls`, `reads from`, etc.) boost entity-label completions and suppress type-prefix completions
- Completions already include all entity labels from `parser.entities` — just reorder/filter them contextually

**Files to change**: `meridian.html` — `meridianCompletion()` function inside `initCM()`

---

### 1.5 Scratch Pad / Secondary Input
**Status**: `[ ]`

A second collapsible CM6 editor tab for notes and draft diagrams. Does not affect the live preview.

**Implementation**
- Add a tab strip above `#smartInput`: "Smart Input" | "Scratch"
- Mount a second `EditorView` into a `<div id="scratchPad">` sibling (hidden by default)
- Tab click swaps `display` between the two divs
- Persist scratch content to `localStorage` key `meridian_scratch_v1` via an `updateListener`
- No wiring to parser or renderer

**Files to change**: `meridian.html` — HTML tab strip, second CM6 view init in `initCM()`

---

### 2.1 Focus / Isolation Mode
**Status**: `[ ]`

Right-click a node (or toolbar toggle + click) to re-render showing only that node and its direct neighbours.

**Implementation**
- Add `_focusEntityId: string | null` global (null = no focus)
- Right-click context: add "Focus on this node" menu item; sets `_focusEntityId` and calls `onInput()`
- In `renderDiagram()`, before selecting the `toFlowchart()` / `toSequence()` etc. path: if `_focusEntityId` is set, build a filtered relationship list (only edges touching the focused entity) and a filtered entity set (focused node + its neighbours)
- Pass filtered data into a temporary parser snapshot rather than the live `parser`
- A "Show all" badge in the preview header exits focus mode

**Files to change**: `meridian.html` — `renderDiagram()`, context panel HTML, new `setFocusMode()` / `clearFocusMode()` helpers

---

### 2.2 Hover Tooltip on Nodes
**Status**: `[x]`

A floating card appears when hovering a node in the preview: type badge, connected entity count, relationship list.

**Implementation**
- On `mouseover` of SVG `g[id^="flowchart-"]` elements (already used for click handling), resolve the entity ID and look up `parser.relationships`
- Build tooltip HTML: type badge, `→ X outgoing`, `← Y incoming`, list of connected names (max 5, then "+ N more")
- Position a fixed `<div id="nodeTooltip">` at `e.clientX + 12, e.clientY + 12`, clamp to viewport
- `mouseleave` on the SVG hides it
- Tooltip disappears instantly (no hover delay needed — it's supplemental info)

**Files to change**: `meridian.html` — tooltip div HTML/CSS, `mouseover`/`mouseleave` handlers in preview interaction section

---

### 2.3 Minimap
**Status**: `[ ]`

A 160×110 px thumbnail in the bottom-right of the preview showing the whole diagram with a highlighted viewport rectangle.

**Implementation**
- After each successful render, clone `#mermaidOutput svg`, wrap in a `<div id="minimap">` overlay (fixed, bottom-right, collapsible)
- Apply `transform: scale(N)` where N = 160 / svgWidth; adjust height accordingly
- Compute viewport rect: `scrollLeft / totalWidth * minimapWidth` etc., render as a semi-transparent `<div class="minimap-viewport">`
- Click on minimap → compute target scroll position and set `#mermaidOutput` scroll offsets
- `#zoomWrapper` pan updates also refresh the viewport rect

**Files to change**: `meridian.html` — minimap HTML/CSS, render callback, `updateMinimapViewport()` helper

---

### 2.4 Relationship Table Panel
**Status**: `[ ]`

A drawer panel listing all relationships as sortable rows. Click a row to jump to the source line.

**Implementation**
- Add a toolbar button "⇄ Relations" that toggles `<div id="relTablePanel">` below the preview
- Build table from `parser.relationships` (index-aligned with `parser.relationshipSources`)
- Columns: From entity, style icon (→ / ⇢ / ⟹), To entity, Label
- Clicking a row calls `jumpToSourceLine(parser.relationshipSources[i].line)` and highlights the SVG edge
- Sort: click column headers, toggle asc/desc with `Array.sort`

**Files to change**: `meridian.html` — panel HTML, `buildRelationshipTable()` function, called at end of `renderDiagram()`

---

### 2.5 Annotation / Sticky Note Layer
**Status**: `[ ]`

Floating sticky notes on the canvas, not part of Mermaid output. Stored in project bundles.

**Implementation**
- Data model: `_annotations: [{id, x, y, text, color}]`, persisted to `meridian_annotations_v1`
- Toolbar toggle "📌 Annotate" sets `_annotateMode = true`; click on empty canvas (not an SVG node) fires `addAnnotation(x, y)`
- Each annotation renders as an absolutely-positioned `<div class="annotation">` inside `#mermaidOutput` (which is `position: relative`)
- Annotations are draggable (mousedown + mousemove on the note div)
- Include `_annotations` in project export bundle (serialiser / deserialiser)

**Files to change**: `meridian.html` — annotation divs, `addAnnotation()` / `deleteAnnotation()`, export/import handlers

---

### 3.1 ER Diagram
**Status**: `[ ]`

Maps `db:` entities to ER entities and relationships to cardinalities using Mermaid's `erDiagram` syntax.

**Implementation**
- Add `parser.toERDiagram()` method:
  - Emit `erDiagram`
  - For each `db:` entity: `ENTITY_NAME { string id PK }`
  - For each relationship: infer cardinality from `bidir` flag → `||--o{` (one-to-many) or `||--||` (one-to-one bidirectional)
  - Relationship label becomes the relationship name (required by Mermaid ER syntax)
- Add `<option value="er">ER Diagram</option>` in `#diagramType`
- Add `case 'er': code = parser.toERDiagram(); break;` in `renderDiagram()`
- Add ER template in Templates panel

**Files to change**: `meridian.html` — `SmartParser` class, `#diagramType` HTML, `renderDiagram()`, templates section

---

### 3.2 State Diagram
**Status**: `[ ]`

State machine diagrams using Mermaid's `stateDiagram-v2`. Relationships become transitions.

**Implementation**
- Add optional `state:` type prefix (maps to a rounded state node in Mermaid)
- Auto-detect "state" keywords: idle, active, pending, failed, success, waiting, running
- Add `parser.toStateDiagram()`:
  - Emit `stateDiagram-v2`
  - Special token `start:Initial` → `[*] --> Initial`; `end:Done` → `Done --> [*]`
  - Each relationship → `StateA --> StateB : label`
- Add `<option value="state">State</option>` and matching `renderDiagram()` case
- Add state machine template

**Files to change**: `meridian.html` — `SmartParser` class, type map, `#diagramType` HTML, `renderDiagram()`

---

### 3.3 Gantt Chart
**Status**: `[ ]`

Pass-through mode: the Smart Input is written as raw Mermaid gantt syntax; Meridian prepends `gantt\n` and renders.

**Implementation**
- When diagram type = "gantt", skip `parser.parse()` entirely
- In `renderDiagram()`, `code = 'gantt\n' + rawInput`
- Provide a gantt-specific template with example tasks
- Add a help section explaining the gantt DSL
- Lint is disabled in pass-through mode (no Meridian-specific semantic checks)

**Files to change**: `meridian.html` — `renderDiagram()`, `#diagramType` HTML, templates section, help modal

---

### 3.4 Mindmap
**Status**: `[ ]`

Pass-through mode for Mermaid's `mindmap` syntax. Indentation defines hierarchy.

**Implementation**
- Same pass-through pattern as Gantt: `code = 'mindmap\n' + rawInput`
- Provide a mindmap template (root → children → grandchildren via indentation)
- Note in help panel: "In Mindmap mode, Smart Input is raw Mermaid mindmap syntax"

**Files to change**: `meridian.html` — `renderDiagram()`, `#diagramType` HTML, templates section

---

### 3.5 Timeline
**Status**: `[ ]`

Pass-through mode for Mermaid's `timeline` syntax.

**Implementation**
- `code = 'timeline\n' + rawInput`
- Template: year/quarter labels with events
- Same pattern as Gantt and Mindmap

**Files to change**: `meridian.html` — `renderDiagram()`, `#diagramType` HTML, templates section

---

### 4.1 Circular Dependency Detection
**Status**: `[x]`

New lint rule `CIRCULAR_DEPENDENCY` — finds directed cycles in the relationship graph.

**Implementation**
- In `SmartParser.validate()`, after building all relationships, run DFS cycle detection:
  - Build adjacency list from `this.relationships` (directed: `from → to`)
  - Iterative DFS with a "white / grey / black" coloring per node
  - On back-edge detection, reconstruct the cycle path from the DFS stack
- Emit a `warning` issue: `{ severity: 'warning', code: 'CIRCULAR_DEPENDENCY', message: 'Cycle: A → B → C → A', line: firstNodeSourceLine }`
- Clicking the lint item jumps to the first node in the cycle

**Files to change**: `meridian.html` — `SmartParser.validate()` method

---

### 4.2 Naming Convention Linting
**Status**: `[x]`

Configurable lint rules for entity label formatting, enforced in settings.

**Implementation**
- Add a "Linting" tab to the settings panel with:
  - Dropdown: "Label case: Any / PascalCase / snake_case / UPPER_CASE"
  - Number input: "Max label length" (default: off)
- Store in `_editorSettings.linting: { caseRule, maxLength }`
- In `SmartParser.validate()`, check each entity label against the chosen convention; emit `NAMING_CONVENTION` warning with the offending label and expected format
- Re-validate on settings change (call `onInput()`)

**Files to change**: `meridian.html` — settings panel HTML, `_editorSettings` default, `SmartParser.validate()`

---

### 4.3 Architecture Health Score
**Status**: `[ ]`

A 0–100 score badge in the status bar, computed from connectivity, domain coverage, orphan ratio, and lint issue count.

**Implementation**
- After each `parser.validate()` call, compute:
  - `connected` = entities in at least one relationship / total entities × 40 pts
  - `domainCoverage` = entities in a domain / total entities × 20 pts
  - `noOrphans` = 1 - (orphan count / total entities) × 20 pts
  - `noLintIssues` = 1 - min(issueCount / 10, 1) × 20 pts
  - `score = Math.round(connected + domainCoverage + noOrphans + noLintIssues)`
- Render in status bar: `🏥 Score: 87` — green ≥80, amber ≥50, red <50
- Click opens a breakdown modal with each metric's contribution

**Files to change**: `meridian.html` — status bar HTML, `computeHealthScore()` function, score modal

---

### 4.4 Suggest Missing Connections
**Status**: `[ ]`

One-click fix for `ORPHAN_NODE` lint items — inserts a draft relationship line in the editor.

**Implementation**
- Extend the lint panel's click handler: if `issue.code === 'ORPHAN_NODE'`, render a "⚡ Fix" button next to the lint item
- On "Fix" click:
  - Find the most structurally related existing entity (same `type` or highest name-similarity via Levenshtein-lite)
  - Insert `// TODO: ${orphanToken} --> ${bestMatch}` on the line after the orphan's source line
  - Move cursor to that line and select the `?` target for immediate editing
- Uses existing `jumpToSourceLine()` and `_cmView.dispatch()`

**Files to change**: `meridian.html` — lint panel render loop, `fixOrphanNode()` helper

---

### 5.1 Print / PDF Export
**Status**: `[ ]`

Print the diagram via `window.print()` with print-optimised CSS. The browser handles PDF generation.

**Implementation**
- Add `@media print` CSS block:
  - `body * { visibility: hidden }` except `#mermaidOutput` and its children
  - `#mermaidOutput { position: fixed; top: 0; left: 0; width: 100%; }`
  - White background regardless of app theme
  - Hide all controls, lint panel, status bar, toolbars
- Add a "🖨️ Print" button in the Export dropdown that calls `window.print()`
- Optional: a `beforeprint` event listener that auto-fits the zoom to page width

**Files to change**: `meridian.html` — CSS `@media print` block, export dropdown HTML

---

### 5.2 Export to PlantUML
**Status**: `[ ]`

"Copy as PlantUML" and "Download .puml" options in the Copy/Export menus.

**Implementation**
- Add `SmartParser.toPlantUML()` method:
  - Header: `@startuml`
  - Entity type map: `app:` → `component`, `db:` → `database`, `server:` → `node`, `instance:` → `rectangle`, `interface:` → `interface`, `batch:` → `usecase`, `config:` → `file`
  - Groups: `package "Production" { ... }` for `env:`, `frame "Finance" { ... }` for `domain:`
  - Relationships: `Frontend --> PostgreSQL : queries`
  - Footer: `@enduml`
- Add "Copy as PlantUML" to the Copy dropdown (calls `navigator.clipboard.writeText()`)
- Add "Download .puml" to the Export dropdown

**Files to change**: `meridian.html` — `SmartParser` class, Copy/Export dropdown HTML and handlers

---

### 5.3 Version Snapshots
**Status**: `[ ]`

Named, timestamped project state snapshots stored in localStorage with diff counts.

**Implementation**
- localStorage key: `meridian_snapshots_v1` — array of `{ id, name, timestamp, bundle }`
- Toolbar button "📸 Snapshot" (or Ctrl+Shift+K): prompt for name, save current `buildProjectBundle()` output
- Snapshot browser panel: list entries, each showing name, timestamp, and entity diff vs. current (`+N / -M entities`)
- "Restore" button: loads the bundle via the existing `applyProjectBundle()` path
- Max 20 snapshots; oldest is dropped when limit is reached

**Files to change**: `meridian.html` — snapshot modal HTML, `saveSnapshot()` / `listSnapshots()` / `restoreSnapshot()` functions, toolbar button

---

### 5.4 Embed Playground Link
**Status**: `[ ]`

Full-state shareable URL using LZ-string compression instead of plain base64.

**Implementation**
- Load `lz-string` from CDN: `<script src="https://cdn.jsdelivr.net/npm/lz-string@1/libs/lz-string.min.js"></script>` (~3 KB)
- Encode: `LZString.compressToEncodedURIComponent(JSON.stringify(fullBundle))` where `fullBundle` includes input, type, theme, settings, nodePositions (custom icons excluded — too large)
- Decode on load: detect hash prefix `#p:` (distinct from existing `#d:`) and decompress
- The existing `#d:` format remains supported for backward compatibility

**Files to change**: `meridian.html` — CDN script tag, `buildShareUrl()`, `loadFromHash()` functions

---

### 6.1 Command Palette
**Status**: `[ ]`

Ctrl+K opens a Spotlight-style floating search box. Filter and execute any app action.

**Implementation**
- Static `COMMANDS` registry array: `[{ label, keywords, icon, action }]`
  - Entity types → "Insert app:", "Insert db:", etc.
  - Templates → "Load template: Microservices", etc.
  - Diagram types → "Switch to Flowchart LR", etc.
  - Settings sections → "Open settings: Editor", "Open settings: Diagram"
  - Shortcuts reference → "Copy share URL", "Open library", etc.
- `<div id="commandPalette">` modal with a text input, filtered list, keyboard navigation (↑↓ to move, Enter to execute, Escape to close)
- Fuzzy filter: lowercase `includes()` across `label + keywords`
- Opens focused on input; no mouse required

**Files to change**: `meridian.html` — palette modal HTML/CSS, `COMMANDS` array, `openCommandPalette()`, global keydown `Ctrl+K` handler

---

### 6.2 Node Inspector Panel
**Status**: `[x]`

A persistent right-side panel that updates live as the cursor moves in the editor, showing details about the entity at the cursor.

**Implementation**
- Add `<div id="inspectorPanel">` as a collapsible right panel (toggle with Ctrl+Shift+I or a toolbar button)
- In CM6's `updateListener`, on `selectionSet`, call `resolveEntityAtCursor(_cmView.state)`:
  - Walk backward/forward from `state.selection.main.head` to find a token matching a known entity ID
  - Look up in `parser.entities`, `parser.relationships`, `parser.entitySources`, `parser.environments`, `parser.domains`
- Render: type badge + icon, incoming edges list, outgoing edges list, group memberships
- "Jump" link on each related entity scrolls to it in both the editor and the SVG

**Files to change**: `meridian.html` — inspector panel HTML, `resolveEntityAtCursor()`, CM updateListener callback, keydown handler

---

### 6.3 Cycle Diagram Types Shortcut
**Status**: `[ ]`

Ctrl+Shift+T cycles through all diagram types in the dropdown order.

**Implementation**
```js
// In global keydown handler:
if (e.shiftKey && e.key === 'T') {
  e.preventDefault();
  const el = document.getElementById('diagramType');
  const opts = [...el.options];
  const next = (el.selectedIndex + 1) % opts.length;
  el.selectedIndex = next;
  el.dispatchEvent(new Event('change'));
  toast(`Diagram: ${opts[next].text}`);
  return;
}
```

**Files to change**: `meridian.html` — global keydown handler

---

### 6.4 Multi-node Selection & Bulk Ops
**Status**: `[ ]`

Rubber-band drag on the SVG canvas selects multiple nodes. Bulk actions: delete, move, group.

**Implementation**
- `_selectedNodes: Set<entityId>` global state
- On SVG canvas `mousedown` on empty space (not a node): start rubber-band rect (`<div id="rubberBand">` absolute overlay)
- On `mousemove`: update rubber-band dimensions
- On `mouseup`: collect all `g[id^="flowchart-"]` elements whose bounding boxes intersect the rubber-band; add their IDs to `_selectedNodes`; show bulk action toolbar
- Ctrl+click on nodes: toggle individual selection
- Bulk delete: remove all selected entities and their relationships from `$input.value`, dispatch
- Bulk group: prompt for name, wrap selected entities in `env:Name { ... }` block, insert into editor
- Bulk move: accumulated drag delta applied to all selected nodes' position entries

**Files to change**: `meridian.html` — rubber-band div, `_selectedNodes` logic, bulk toolbar HTML, `bulkDelete()` / `bulkGroup()` helpers

---

### 6.5 Dark Mode Keyboard Shortcut
**Status**: `[ ]`

Ctrl+Shift+D toggles dark/light app theme.

**Implementation**
```js
// In global keydown handler:
if (e.shiftKey && e.key === 'D') {
  e.preventDefault();
  document.getElementById('themeToggle').click();
  return;
}
```

**Files to change**: `meridian.html` — global keydown handler, help modal shortcut table

---

### 6.6 Collapsible Subgraph Groups
**Status**: `[x]`

Click a subgraph title in the preview to collapse the group to a single summary node.

**Implementation**
- `_collapsedGroups: Set<groupId>` global state, persisted to localStorage `meridian_collapsed_v1`
- After each render, attach a `click` listener to Mermaid's `g.cluster-label` elements; resolve the group entity ID; toggle `_collapsedGroups` and call `onInput()`
- In `renderDiagram()`, before calling `toFlowchart()`: for each collapsed group, replace its children with a single synthetic proxy entity (e.g., `app:Production_Group_[5_nodes]`) and redirect any external relationships to point at the proxy
- The proxy entity is display-only — never written to the Smart Input

**Files to change**: `meridian.html` — `renderDiagram()` pre-processing, SVG click handler, localStorage persistence

---

## Progress Summary

| Category | Total | Done | In Progress | Not Started |
|----------|-------|------|-------------|-------------|
| Editor Enhancements | 5 | 1 | 0 | 4 |
| Canvas / Preview | 5 | 1 | 0 | 4 |
| Diagram Types | 5 | 0 | 0 | 5 |
| Intelligence & Linting | 4 | 2 | 0 | 2 |
| Export & Sharing | 4 | 0 | 0 | 4 |
| UX Improvements | 6 | 2 | 0 | 4 |
| **Total** | **29** | **6** | **0** | **23** |
