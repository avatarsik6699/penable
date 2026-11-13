---
name: penable
description: Light personal handwriting editor with compact floating controls.
colors:
  paper: "#fff"
  ink: "#182230"
  muted: "#526176"
  accent: "#175cd3"
  selected: "#eaf1ff"
  selected-border: "#c5d8fb"
  hover: "#f1f4f8"
  disabled: "#86909f"
  divider: "#e0e5ec"
  error: "#b42318"
  saved: "#36724c"
  pending: "#b77916"
  idle: "#7a8798"
typography:
  brand:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  compact-brand:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
  label:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
  body:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
  helper:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
rounded:
  control: "8px"
  chrome: "12px"
  popover: "14px"
  delete-dialog: "14px"
  insertion-notice: "10px"
  library-sidebar: "16px"
  library-preview: "5px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  edge: "20px"
components:
  icon-button:
    size: "40px"
    rounded: "{rounded.control}"
    textColor: "{colors.ink}"
    backgroundColor: "transparent"
  primary-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  floating-dock:
    height: "56px"
    padding: "8px"
    rounded: "{rounded.chrome}"
    backgroundColor: "{colors.paper}"
---

# Design System: penable

## Overview

**Creative North Star: "The Writing-First Notebook"**

The production editor follows the owner-approved Change14 visual direction implemented in Change15 and refined in Change16.
White paper, compact Russian labels and one consistent Lucide SVG icon family keep writing central.
Contextual panels expose settings, document actions and recovery without a permanent instruction row.
This file describes the built visual system; [SPEC](docs/SPEC.md) owns product behavior and [FRONTEND](docs/FRONTEND.md) owns architecture.

**Key Characteristics:**
- Light writing field with a compact floating horizontal tool dock.
- Inline width, contextual stabilization and restrained peripheral controls.
- Explicit save/error/read-only states and discoverable recovery actions.
- System UI typography; no external font or synthetic note in production.

## Colors

Blue marks interaction and selection; dark ink and cool neutrals carry ordinary controls.
Primary roles: **Notebook Blue** (`accent`) for focus, selected controls and range thumbs; **Error Red** (`error`) for failures and destructive actions.
Neutral roles: **Paper White** (`paper`) for the board and chrome, **Ink** (`ink`) for primary text, **Muted Slate** (`muted`) for supporting text, **Soft Selection** (`selected`) for active tools, **Hover Mist** (`hover`) for hover, **Divider** for separators, and **Disabled Slate** for unavailable actions.
**The Semantic State Rule.** Keep error, selected, hover and disabled treatments distinct; do not rely on color alone to name a failure.

## Typography

Segoe UI with system/sans-serif fallback is the interface family throughout. There is no separate display face or downloaded font.
The frontmatter records observed brand, title, label, body and helper roles; numeric width, stabilization and zoom readouts use tabular figures.
Brand lettering tightens slightly; functional labels stay in sentence case. Supporting panel text uses line heights from 1.5 to 1.7.

## Layout

The board fills the viewport; all chrome and panels are out of flow. Opening panels or changing save/selection feedback never resizes or remounts the canvas.
Desktop layouts at 1440×900 and 1280×720 place one dock top-center, static brand top-left,
zoom/return/minimap bottom-right and Help bottom-left. Tools, history, contextual controls and
save status/settings share that dock; no separate top-right status pill remains.
At widths of 1200px and above, the dock is fixed at 730×56px with 128px board and 190px context slots and centered 16px from the top.
From 651px through 1199px, it is up to960px wide, sits80px from the top, and uses two rows
within a 104px dock. At 650px and below, it uses three rows in a 152px dock, with 40px controls
and viewport width minus 24px. The current-board chooser leads the dock; the current board name
truncates only when space requires it. Context and status/settings stay in their reserved areas.

Panels constrain width to the viewport and scroll internally with contained overscroll, using the
space available below the dock so a tall selection menu remains reachable on short screens. The
board library is a left sidebar up to 360px wide, with a heading and close control, name search,
scrollable preview/name rows with per-row actions, and a creation form below the list. At narrow
widths it uses the available width beneath the dock. No separate mobile drawing behavior is introduced.

## Elevation & Depth

Solid white floating chrome uses the app's `chrome-shadow`; contextual panels use the stronger `popover-shadow`. Both have soft offset shadows rather than a tinted halo.
Secondary recovery buttons use a quiet inset divider outline. Depth identifies controls above the writing field; it does not imitate physical paper or glass.
Exact shadow and motion values are recorded in the sidecar and originate in `src/app/styles.css`.

## Shapes

Controls have softly rounded corners, floating chrome is rounder, and contextual panels use the largest radius in the frontmatter.
Icon targets are at least 40px. Icons use static named lucide-react imports: 24-unit viewBox, round joins/caps, 2px stroke and22px normal size. Smaller status/recovery marks inherit their local size. Icons are decorative within named controls.
Selection keeps the actual drawn region and its whitespace, using the established blue outline.
Its resize handles sit on the selection boundary, with a separate rotation handle above it; these
handles expose direct manipulation rather than decoration.

## Components

**Tool dock.** Pen, whole-stroke eraser, selection and history share one group. Width stays inline for Pen; clicking the selected Pen again opens stabilization. Selected state uses both shape/background and blue color.
**Board library.** The current-board chooser stacks an 11px muted «Доски» label above the 14px semibold current-board name inside its 40px button. Long names truncate within the reserved slot; the full name remains in the button tooltip. The chooser sits at the leading edge of the dock and opens a left sidebar up to 360px wide, with 16px corners. It has a heading and close control, name search, independently scrolling preview/name rows with 5px preview corners, per-row rename/delete actions, and a creation form below the list. The active row uses the existing selected treatment. Deletion uses a protected confirmation dialog that names the board and warns that local copies will be removed. The dialog has 14px corners and its heading is 18px, a deliberate dialog-specific hierarchy role alongside the 14px contextual-panel title.
**Contextual panels.** One workspace-owned main panel opens at a time: board, save, pen, selection or Help. Outside interaction dismisses; Escape closes and returns focus to the persistent trigger. Opening a nonmodal panel preserves pending selection validation.
**Pinned diagnostics.** Help can open diagnostics as a separate pinned region. Writing leaves it visible; opening another main panel replaces it. Explicit close or Escape returns focus to Help; Actions and diagnostics retain their required Escape input-cancellation behavior.
**Document controls.** Brand is static. Settings gear in the dock opens one panel: View contains background mode, contrast and spacing; Files and copies contains unique import/export/recovery/retry controls. The adjacent status dot opens Files. Green means saved, amber pending, gray loading/read-only, red error; hover and accessible descriptions name every status, and errors also retain visible text. Import remains a true modal dialog with protected focus.
**Selection actions.** Rectangle/lasso remain inline; actions disclose a vertical icon-and-label list with shortcut hints. Resize and rotation handles act directly on the selection. The Transform section also exposes numeric width and height percentages plus an angle in degrees, followed by an apply action. The image-insert control is 40×40px and accepts PNG and JPEG; its insertion notice has 10px corners. Ordinary Copy/Paste negotiate editable board content and images, with PNG download for a selected region. There are no separate image-copy or image-paste commands. Choosing, processing, success, and error feedback remains visible without changing canvas dimensions.
**Navigation and fields.** Bottom-right zoom/return/minimap uses stable tabular readouts. Percentage resets zoom around the current center; return restores the last completed pen working view. The collapsible minimap stays visible while writing, uses occupancy plus viewport outline, and holds the secondary fit-all action. Background contrast/spacing share immediate world-anchored settings for dots/grid. Ranges have a 40px interaction height, a thin neutral track and accent thumb. Keyboard focus is an accent outline with a 3px offset.
**Motion.** Button color/background changes use 100ms ease only when reduced motion is not requested; the writing surface has no decorative entrance animation.

## Do's and Don'ts

- Do keep the writing field dominant and preserve the out-of-flow layout.
- Do keep frequent controls visible and disclose secondary settings/actions contextually.
- Do retain visible focus, accessible names, 40px targets and readable numeric readouts.
- Do preserve the pinned diagnostics exception so pressure can be observed while writing.
- Don't import the mock's synthetic note or Caveat font into the production editor.
- Don't cancel pending selection work merely because a nonmodal panel opens or closes.
- Don't change ink geometry, document data or canvas backing dimensions as a visual styling shortcut.
