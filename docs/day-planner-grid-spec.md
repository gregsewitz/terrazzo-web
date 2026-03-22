# Day Planner Grid Layout — Implementation Spec

**Status:** Pre-implementation
**Date:** March 17, 2026
**Scope:** Desktop `DayBoardView` only (mobile `DayPlanner` unchanged)

---

## 1. Goal

Transform the desktop day planner from a free-flowing column layout into a true spreadsheet-style grid where time slot rows align horizontally across all day columns. This gives users the at-a-glance scanability of the Google Sheets workflow Terrazzo replaces.

---

## 2. Current Architecture

The desktop view lives in `DayBoardView.tsx` (~740 lines). Each day is a vertical column (`COL_WIDTH: 280px`) rendered in a horizontally-scrollable flex container. Within each column, 6 time slots stack vertically inside `SlotContainer` components. Each slot grows to fit its content — there is no cross-column height coordination.

**Key constants (current):**
- `COL_WIDTH`: 280px desktop, 240px mobile
- `CARD_H`: 50px desktop, 42px mobile
- `SLOT_LABEL_H`: 32px desktop, 26px mobile
- `MIN_SLOT_H`: `SLOT_LABEL_H + CARD_H + 6` (~88px)

**Card types rendered per slot:**
- Confirmed places (`PlacedCard`) — pointer-drag enabled, 50px height
- Ghost cards — dashed border, cream background, 50px height
- Quick entries (`QuickEntryCard`) — lightweight text items
- Collaborator suggestions (`CollaboratorGhostCard`)

**Transport:** `TransportBanner` components render between slots based on `afterSlot` ID, inline within each column.

---

## 3. Layout Model

### 3.1 Grid Structure

Replace the current `flex` column layout with a CSS Grid (or equivalent coordinated layout) where:

- **Columns** = days (plus a frozen left-side row-header column for slot labels)
- **Rows** = time slots (breakfast, morning, lunch, afternoon, dinner, evening), with conditional transport rows between them

```
         │  Day 1     │  Day 2     │  Day 3     │  Day 4     │
─────────┼────────────┼────────────┼────────────┼────────────┤
 Header  │ Thu 12 Rome│ Fri 13 Rome│ Sat 14 Amal│ Sun 15 Amal│
 Context │ Hotel Alma │ Hotel Alma │ Villa Rosa │ Villa Rosa │
─────────┼────────────┼────────────┼────────────┼────────────┤
Breakfast│ ░░░░░░░░░░ │ Roscioli   │ ░░░░░░░░░░ │ Hotel bkfst│
         │            │ Forno Campo│            │            │
─────────┼────────────┼────────────┼────────────┼────────────┤
Morning  │ Vatican    │ Borghese   │ ░░░░░░░░░░ │ Path of Go.│
─────────┼────────────┼────────────┼────────────┼────────────┤
Lunch    │ Armando    │ Da Enzo    │ Lo Scoglio │ ░░░░░░░░░░ │
─────────┼────────────┼────────────┼────────────┼────────────┤
 🚗      │            │            │ Drive coast│            │
─────────┼────────────┼────────────┼────────────┼────────────┤
Afternoon│ Trastevere │ ░░░░░░░░░░ │ Emerald Gr.│ Ravello    │
─────────┼────────────┼────────────┼────────────┼────────────┤
Dinner   │ Retrobotteg│ Piatto Roma│ Da Adolfo  │ Rossellini │
─────────┼────────────┼────────────┼────────────┼────────────┤
Evening  │ ░░░░░░░░░░ │ Gelato run │ ░░░░░░░░░░ │ ░░░░░░░░░░ │
─────────┴────────────┴────────────┴────────────┴────────────┘
```

### 3.2 Row Header Column (Frozen)

A narrow left column (~60–70px) stays fixed during horizontal scroll. Contains:
- Slot icon (from `SLOT_ICONS`)
- Slot label (Breakfast, Morning, etc.) — horizontal text, not rotated
- Slot time (8:00 AM, 10:00 AM, etc.) — subtle secondary text

This replaces the per-slot inline label currently rendered inside each `SlotContainer`.

### 3.3 Column Headers

Each day column gets a fixed-height header area with two sub-rows:

1. **Day title row** (consistent height, ~36px): Day-of-week, date number, destination tag — same data as current, using `generateDestColor` for the background tint.
2. **Context bar row** (consistent height, ~30px): Hotel badge, transport button, directions button. When no hotel is set, show the "+ Hotel" affordance so the row height stays consistent.

Both rows must be the same height across all columns regardless of content.

### 3.4 Column Width

- **Minimum column width:** 260px (current is 280px, keep similar)
- **Responsive behavior:** Columns fill available width up to showing ~4–5 days at once on a standard 1440px screen. For a 4-day trip on a 1440px screen (minus ~70px for row headers and padding), columns would be ~340px each — plenty of room.
- **Horizontal scroll:** Kicks in when `(dayCount * minColWidth) + rowHeaderWidth > viewportWidth`. For a 7-day trip on a laptop, that's roughly 5 columns visible with 2 scrolled off-screen.
- **Never squish below minimum:** Columns maintain `minColWidth` and scroll rather than compress.

---

## 4. Cell Rendering

### 4.1 Fixed Row Height

**Default row height:** `2 * CARD_H + SLOT_LABEL_H + padding` ≈ **138px**

Breakdown:
- Slot label area: 32px
- Card 1: 50px
- Card 2: 50px
- Vertical padding/gaps: ~6px

This accommodates 2 cards of any type (confirmed place, ghost card, quick entry, collaborator suggestion). All card types count equally toward this limit.

**In practice**, this will be the row height for virtually all trips since at least one slot somewhere will have 2+ items. Hard-code this as the default rather than implementing adaptive logic.

### 4.2 Overflow Handling (3+ Items)

When a cell contains more than 2 items (any combination of places, ghosts, quick entries, suggestions):

1. **Render the first 2 items** normally within the fixed-height cell.
2. **Show a "View all" bar** at the bottom of the cell:
   - Text: `"View all (N)"` where N is total item count
   - Style: subtle, ~20px height, tucked into the padding area
   - Full-width clickable area
   - Replaces the 2nd card's bottom margin space — doesn't add height to the cell

3. **Clicking "View all" opens a slot overlay** (see §4.3).

**Priority order for which 2 items to show:**
1. Confirmed places (sorted by `specificTime` if set, then insertion order)
2. Quick entries
3. Ghost cards
4. Collaborator suggestions

This ensures confirmed bookings are always visible in the collapsed view.

### 4.3 Slot Overlay (Expanded View)

A modal-like popover anchored to the cell that triggered it. Contains the full slot contents with all current interaction capabilities.

**Behavior:**
- Appears as a floating panel positioned directly over/adjacent to the originating cell
- Fixed width matching the column width (~260–340px depending on responsive sizing)
- Max height: ~400px with internal scroll if needed
- Light shadow + subtle border, white background
- Closes on: click outside, Escape key, explicit close button

**Contents (in order):**
- Slot label + time at top
- All confirmed places (full `PlacedCard` rendering with drag, remove, time editor)
- All quick entries (with edit/remove/confirm)
- All ghost cards (with Add/Dismiss)
- All collaborator suggestions (with Accept/Reject)
- Quick entry input at the bottom (replaces the old per-cell input)

**Drag and drop:** Must work from within the overlay. When a user starts dragging a card from the overlay, the overlay should remain open (or gracefully close) and the drag should transfer to the main grid's drag system via `TripDragContext`.

### 4.4 Empty Cells

Empty cells (no places, no ghosts, no quick entries, no suggestions) render as blank space within the fixed row height. No "+ add" placeholder text.

**The entire cell is a drop target.** Drop indicator styling (current: left border teal + background tint) applies to the full cell area. This is already close to how `SlotContainer` works — just remove the empty-state placeholder div.

**Adding items to empty cells:** Double-click or right-click to open the quick entry input, or drag a card in from the pool or another slot. No single-click-to-add behavior (reduces accidental triggers).

### 4.5 Ghost Card Badge (Collapsed View)

When a slot has 3+ total items AND at least one ghost card that's hidden behind "View all":

- Show a small indicator badge in the top-right corner of the cell
- Text: `"1 suggestion"` or `"2 suggestions"`
- Style: pill badge, `var(--t-cream)` background, dashed border matching ghost card style
- Clicking the badge opens the slot overlay scrolled to the ghost cards section

This prevents Terrazzo suggestions from going unnoticed when slots are full.

---

## 5. Transport Rows

### 5.1 Model

Transport stays on `TripDay.transport` with the `afterSlot` ID system. Transport banners become conditional grid rows that span the full width.

### 5.2 When Transport Rows Appear

A transport row appears between two time slot rows **only when at least one day in the trip** has a transport event at that boundary. The row spans the entire grid width.

For example, if Day 3 has a "drive to coast" after lunch:
- A transport row appears between the Lunch and Afternoon rows for ALL days
- Day 3's cell in that row shows the transport banner
- All other days' cells in that row are empty (blank, minimal height)

### 5.3 Transport Row Height

- **When populated:** ~40px — enough for one transport banner (icon + mode + route + time)
- **When empty:** Same height (40px) to maintain grid alignment. The empty cells are just blank.

Since transport events are relatively rare, most trips will have 0–2 transport rows total. A trip with no transport events has zero transport rows (they don't appear at all).

### 5.4 Transport Row Visual Treatment

Transport rows should look visually distinct from time slot rows:
- Slightly different background tint (e.g., `rgba(0,0,0,0.015)` or a very subtle stripe)
- No slot label in the row header — instead, show a small transport icon or a horizontal rule
- Transport banners within the row use the existing `TransportBanner` component (compact variant)

### 5.5 Early Departures

Transports that occur before the first slot (derived `afterSlot` is undefined or before breakfast) render as a transport row above the Breakfast row. The `getTransportsBeforeSlots` helper already identifies these.

### 5.6 Adding Transport

The "+ Transport" button stays in the day context bar (column header area). The `TransportInput` form expands below the context bar, same as current behavior. Once saved, the transport appears in the appropriate transport row based on its departure time.

---

## 6. Interaction Changes

### 6.1 Drag and Drop

**Source behaviors:**
- Drag from a visible card in a collapsed cell → works as today via `useDragGesture` long-press
- Drag from a card in the expanded overlay → same gesture, overlay closes on drag start, drag transfers to grid-level `TripDragContext`

**Target behaviors:**
- Any cell (empty or populated) is a drop target
- Drop onto a collapsed cell with 2 items → item is added, cell now shows "View all (3)"
- Drop indicators: full-cell background tint + border highlight (adapt current `SlotContainer` isDropActive styling)

**Cross-column and cross-row drops** work exactly as today — the hit-testing in `onRegisterSlotRef` already uses bounding rects.

### 6.2 Cell Interactions

| Action | Behavior |
|---|---|
| Single click on card | Open place detail (`PlaceDetailContext`) |
| Long-press on card | Initiate drag |
| Double-click on empty cell | Open quick entry input inline |
| Click "View all (N)" | Open slot overlay |
| Click ghost badge | Open slot overlay, scrolled to suggestions |
| Drop onto cell | Add item to that slot |

### 6.3 Quick Entry Input

In collapsed cells, the quick entry input should appear as a temporary inline element that can push the cell content slightly (acceptable since it's a transient interaction). Alternatively, the overlay could open with the input focused at the bottom. Recommend the overlay approach for consistency — any "I want to add to this full slot" action goes through the overlay.

For empty cells: double-click opens a minimal inline input within the cell bounds.

---

## 7. Component Changes

### 7.1 New Components

| Component | Purpose |
|---|---|
| `DayPlannerGrid` | New top-level grid layout, replaces `DayBoardView` |
| `GridRowHeader` | Frozen left column with slot labels |
| `GridCell` | Single cell in the grid, handles overflow + "View all" |
| `SlotOverlay` | Modal popover for expanded slot view |
| `TransportRow` | Conditional row for transport events between slots |
| `GhostBadge` | Small pill indicator for hidden suggestions |

### 7.2 Modified Components

| Component | Changes |
|---|---|
| `SlotContainer` | Adapt to work within fixed-height grid cells (remove flex-grow behavior, enforce fixed height) |
| `PlacedCard` | No changes — already a self-contained card |
| `QuickEntryCard` | No changes |
| `TransportBanner` | No changes — already has a compact variant |

### 7.3 Removed Patterns

- Per-slot inline label (moves to `GridRowHeader`)
- "+ add entry" placeholder in empty cells
- "+ add entry" button below slot content (moves to overlay)
- Per-column vertical slot scrolling (grid rows handle this now)

### 7.4 Migration Strategy

Build `DayPlannerGrid` as a new component alongside `DayBoardView`. Gate with a feature flag or viewport check during development. Once stable, swap the import in the parent and remove `DayBoardView`.

---

## 8. State Management

No changes to `tripStore` or `poolStore` are needed. The data model (days → slots → places/ghosts/quickEntries) is unchanged. The grid is purely a rendering concern.

**New local state in `DayPlannerGrid`:**
- `expandedSlot: { dayNumber: number, slotId: string } | null` — which slot overlay is open
- `activeQuickInput: { dayNumber: number, slotId: string } | null` — carried over from current

**State from contexts (unchanged):**
- `TripDragContext` — drag source, drop target, slot ref registration
- `PlaceDetailContext` — opening place detail panel
- `TripCollaborationContext` — suggestions, reactions, roles

---

## 9. Sizing Reference

| Element | Height | Notes |
|---|---|---|
| Column header (day title) | 36px | Fixed across all columns |
| Column header (context bar) | 30px | Fixed, includes hotel + transport buttons |
| Time slot row | 138px | 32px label + 2×50px cards + 6px padding |
| Transport row | 40px | Only when any day has transport at that boundary |
| PlacedCard | 50px | Unchanged |
| Ghost card | 50px | Unchanged |
| QuickEntryCard | ~30–40px | Variable, but counts as one card slot |
| "View all" bar | 20px | Sits within the cell's padding area |
| Ghost badge | 18px | Absolute-positioned in cell corner |

**Total grid height for a trip with no transport:**
66px (headers) + 6 × 138px (slot rows) = **894px**

This fits comfortably in a standard laptop viewport (~900px content height) with minimal or no vertical scrolling, which is ideal for the spreadsheet feel.

---

## 10. Edge Cases Summary

| Scenario | Handling |
|---|---|
| Slot has 0 items | Empty cell, full drop target, double-click for quick entry |
| Slot has 1 item | Card rendered with remaining space empty |
| Slot has 2 items | Both cards visible, fills the row height |
| Slot has 3+ items | Show top 2 by priority, "View all (N)" bar at bottom |
| Slot has 2 items + hidden ghost | Ghost badge in cell corner |
| Transport after lunch on 1 day | Transport row between Lunch and Afternoon for all days |
| Transport before breakfast | Transport row above Breakfast row |
| No transport in entire trip | No transport rows rendered |
| 3-day trip on wide screen | Columns expand to fill, no horizontal scroll |
| 8-day trip on laptop | ~5 columns visible, horizontal scroll for remainder |
| Drag from overlay | Overlay closes, drag enters grid-level drag system |
| Drop onto full (collapsed) cell | Item added, count increments, "View all" appears if now 3+ |
| Slot notes | Icon indicator in cell, full content in overlay |
| Quick entry in empty cell | Double-click opens inline input within cell bounds |
| Quick entry in populated cell | Opens overlay with input focused at bottom |
| Delete day confirmation | Existing modal dialog, unchanged |
| Collaborator suggestions in overflow | Lowest display priority, visible in overlay |

---

## 11. Out of Scope

- Mobile `DayPlanner` view — no changes
- `OverviewItinerary` — separate dossier/briefing view, untouched
- Pool tray interactions — unchanged
- Map view — unchanged
- Taste matching or intelligence — unchanged
- Data model or API changes — none required
