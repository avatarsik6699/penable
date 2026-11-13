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

The production editor follows the owner-approved Change14 visual direction implemented in Change15.
White paper, compact Russian labels and one consistent SVG icon family keep writing central.
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
Desktop layouts at 1440×900 and 1280×720 place the dock top-center, board menu top-left, save status top-right, zoom/fit bottom-right and Help bottom-left.
The dock starts 16px from the top; corner chrome uses 20px edges. Board/save controls and lower chrome are 48px high; the main dock is 56px high.
At widths up to 900px the dock moves below the corner controls. Up to 700px, corner edges compact to 12px and top controls use 16px top spacing.
At widths up to 520px the dock fits the available width, tightens width controls, and selection controls wrap onto their own row. The 390px layout retains all tools.
Panels constrain width to the viewport and scroll internally with contained overscroll. No separate mobile drawing behavior is introduced.

## Elevation & Depth

Solid white floating chrome uses the app's `chrome-shadow`; contextual panels use the stronger `popover-shadow`. Both have soft offset shadows rather than a tinted halo.
Secondary recovery buttons use a quiet inset divider outline. Depth identifies controls above the writing field; it does not imitate physical paper or glass.
Exact shadow and motion values are recorded in the sidecar and originate in `src/app/styles.css`.

## Shapes

Controls have softly rounded corners, floating chrome is rounder, and contextual panels use the largest radius in the frontmatter.
Icon targets are at least 40px. Authored SVG icons share a 24-unit viewBox, round joins/caps and 1.7 stroke weight; normal icons are 21px, menu/status icons commonly 18px.
Selection keeps the actual drawn region and its whitespace, using the established blue outline; there are no decorative transform handles.

## Components

**Tool dock.** Pen, whole-stroke eraser, selection and history share one group. Width stays inline for Pen; clicking the selected Pen again opens stabilization. Selected state uses both shape/background and blue color.
**Contextual panels.** One workspace-owned main panel opens at a time: board, save, pen, selection or Help. Outside interaction dismisses; Escape closes and returns focus to the persistent trigger. Opening a nonmodal panel preserves pending selection validation.
**Pinned diagnostics.** Help can open diagnostics as a separate pinned region. Writing leaves it visible; opening another main panel replaces it. Explicit close or Escape returns focus to Help; Actions and diagnostics retain their required Escape input-cancellation behavior.
**Document controls.** Brand opens board actions/background/recovery copies; the local save trigger exposes status details, retry and download. Loading, dirty, saving, saved, failure and read-only states remain explicit. Import retains a true modal dialog and protected focus.
**Selection actions.** Rectangle/lasso remain inline; actions disclose a vertical icon-and-label list with shortcut hints. Busy/read-only/clipboard availability controls disabled state, and feedback remains visible without changing canvas dimensions.
**Navigation and fields.** Bottom-right zoom/reset/fit uses stable tabular readouts. Ranges have a 40px interaction height, a thin neutral track and accent thumb. Keyboard focus is an accent outline with a 3px offset.
**Motion.** Button color/background changes use 100ms ease only when reduced motion is not requested; the writing surface has no decorative entrance animation.

## Do's and Don'ts

- Do keep the writing field dominant and preserve the out-of-flow layout.
- Do keep frequent controls visible and disclose secondary settings/actions contextually.
- Do retain visible focus, accessible names, 40px targets and readable numeric readouts.
- Do preserve the pinned diagnostics exception so pressure can be observed while writing.
- Don't import the mock's synthetic note or Caveat font into the production editor.
- Don't cancel pending selection work merely because a nonmodal panel opens or closes.
- Don't change ink geometry, document data or canvas backing dimensions as a visual styling shortcut.
