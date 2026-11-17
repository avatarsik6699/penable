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
  cover-blue: "#e3edfc"
  cover-blue-ink: "#245392"
  cover-teal: "#dcefeb"
  cover-teal-ink: "#1d615b"
  cover-green: "#e5efd9"
  cover-green-ink: "#46652a"
  cover-amber: "#fff0cf"
  cover-amber-ink: "#805711"
  cover-orange: "#ffeadb"
  cover-orange-ink: "#944a23"
  cover-red: "#fbe3e3"
  cover-red-ink: "#9b383e"
  cover-violet: "#ece5fc"
  cover-violet-ink: "#68449c"
  cover-pink: "#f8e2ef"
  cover-pink-ink: "#953f71"
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
  appearance-title:
    fontFamily: "Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  control: "8px"
  chrome: "12px"
  popover: "14px"
  delete-dialog: "14px"
  insertion-notice: "10px"
  library-sidebar: "16px"
  board-cover: "10px"
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
White paper, compact English/Russian labels and one consistent Lucide SVG icon family keep writing central.
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

**Brief writing locks.** During an active stroke, toolbar controls retain their available colors,
selected state and hovered appearance while native disabled blocks activation. Intrinsically
unavailable controls (read-only or empty history) retain Disabled Slate. The document status dot
continues to report saving without dimming the whole toolbar on every stroke.

## Typography

Segoe UI with system/sans-serif fallback is the interface family throughout. There is no separate display face or downloaded font.
The frontmatter records observed brand, title, label, body and helper roles; numeric width, stabilization and zoom readouts use tabular figures.
Brand lettering tightens slightly; functional labels stay in sentence case. Supporting panel text uses line heights from 1.5 to 1.7.

## Layout

The board fills the viewport; all chrome and panels are out of flow. Opening panels or changing save/selection feedback never resizes or remounts the canvas.
Desktop layouts at 1440×900 and 1280×720 place one dock top-center, static brand top-left,
zoom/return/minimap bottom-right and Help bottom-left. Tools, history, contextual controls and
save status/settings share that dock; no separate top-right status pill remains.
The dock uses the width available between safe side insets. Fine-pointer single row is778×56;
coarse single row is814×60. When it no longer fits, the centered compact dock is383×104 fine
or399×112 coarse: board chooser + editing tools above, history + context + storage below.
Below those usable widths it becomes286×152 fine or294×164 coarse: chooser + storage,
editing tools, then context + history. Its smallest width can contract to280px usable space;
controls retain40px/44px targets. The board chooser is always128px; compact context reserves178px
and retains a useful slider/color target rather than shrinking to104px. Decorative brand remains
hidden below1200px. The full-viewport query frame accounts for safe-area padding without changing
fixed sheets' viewport-sized containing block. Tool changes never change dock bounds.
The current-board chooser leads the dock; the current board name
truncates only when space requires it. Context and status/settings stay in their reserved areas.

Panels constrain width to the viewport and scroll internally with contained overscroll, using the
space available below the dock so a tall selection menu remains reachable on short screens. The
board library is a left sidebar up to 360px wide, with a heading and close control, name search,
scrollable cover/name rows with per-row actions, and a creation form below the list. At narrow
widths it becomes a viewport-bounded drawer. Phone tool/settings panels are scrollable sheets;
tablet panels remain contextual. Safe-area insets and visualViewport keyboard bounds keep
fields and final actions reachable. Touch defaults to finger navigation and stylus writing,
with an explicit Draw with finger («Рисовать пальцем») checkbox in writing settings.

## Elevation & Depth

Solid white floating chrome uses the app's `chrome-shadow`; contextual panels use the stronger `popover-shadow`. Both have soft offset shadows rather than a tinted halo.
Secondary recovery buttons use a quiet inset divider outline. Depth identifies controls above the writing field; it does not imitate physical paper or glass.
Exact shadow and motion values are recorded in the sidecar and originate in `src/app/styles.css`.

## Shapes

Controls have softly rounded corners, floating chrome is rounder, and contextual panels use the largest radius in the frontmatter.
Main dock icon targets are40px on fine-pointer desktop and44px on coarse-pointer devices. Compact template choices are36px wide; panel help/close targets are28px. Icons use static named lucide-react imports: 24-unit viewBox, round joins/caps, 2px stroke and22px normal size. Smaller status/recovery marks inherit their local size. Icons are decorative within named controls.
Selection keeps the actual drawn region and its whitespace, using the established blue outline.
Its resize handles sit on the selection boundary, with a separate rotation handle above it; these
handles expose direct manipulation rather than decoration.

## Components

Color names in this document describe the palette, not CSS custom-property names. Production controls use `--focus`, `--control-selected-bg`, `--control-selected-text`, `--control-selected-border` and `--control-hover` from `src/app/styles.css`; do not invent `--accent` or `--selected` aliases.

**Tool dock.** Pen, whole-stroke eraser, selection and history share one group. Width stays inline for Pen; clicking the selected Pen again opens the writing instrument, palette and stabilization settings. Selected state uses both shape/background and blue color.
**Writing controls.** Constant pen, pressure pen and highlighter share the existing writing slot and a compact horizontal icon radio group. Ten fixed swatches form a dense row where space permits, wrap on narrow screens, have subtle dimensional highlights/shadows and a blue selection tile/check badge and a distinct keyboard focus outline. Compact fine-pointer palette targets are30×32px; coarse palettes use44px targets in two rows. Primary controls use40px/44px respectively. Pressure and opacity controls appear only for the relevant instrument; a compact actual-geometry sample previews settings. Descriptive help opens on hover, keyboard focus or click rather than occupying permanent panel space.
**Vector templates.** A dedicated Lucide shapes control opens a compact icon chooser grouping geometry and mathematics, an approximately100px preview and applicable pre-insertion parameters. Figure names are exposed by hover/focus hints and accessible icon labels; selection uses the existing blue treatment. Mathematical choices use Lucide MoveHorizontal, Move and Radius through the same22px/2px EditorIcon as geometry. Outline width uses a slider; numeric width/height are absent. Default click placement fits about320CSSpx and selects the vector object with resize handles. The primary placement button stays blue with white text on hover. Automatic axis spacing displays its effective step and supports manual entry. Invalid drafts retain the explicitly marked last-valid preview and a concrete repair action. Desktop primary panel flows fit1280×720 without scrolling; short screens scroll safely.
**Board library.** The current-board chooser stacks an 11px muted Boards («Доски») label above the 14px semibold current-board name inside its 40px button. Long names truncate within the reserved slot; the full name remains in the button tooltip. The chooser sits at the leading edge of the dock and opens a left sidebar up to 360px wide, with 16px corners. It has a heading and close control, name search, independently scrolling rows with 44×44 color/icon covers and 10px corners, per-row appearance/rename/delete actions, and a creation form below the list. The active row uses the existing selected treatment. Deletion uses a protected confirmation dialog that names the board and warns that local copies will be removed. The dialog has 14px corners and its heading is 18px, a deliberate dialog-specific hierarchy role alongside the 14px contextual-panel title.
**Board appearance.** Eight tonal color pairs and sixteen 22px Lucide symbols identify boards independently of their content. Cover/icon contrast is 5.30–6.52; the active row keeps its separate selected treatment. Appearance («Оформление») replaces the sidebar list with a draft editor: sample, four-column color/icon radio grids and save/cancel actions. Selected radios have a dark outline plus Lucide check badge; keyboard focus has a distinct outer outline. Options have 48px hit areas; the panel scrolls on short screens. The editor uses a 16px bold heading, 13px field labels and the existing system type. Saving commits before returning focus to the row action; cancellation preserves the stored cover.
**Contextual panels.** One workspace-owned main panel opens at a time: board, save, pen, selection or Help. Outside interaction dismisses; Escape closes and returns focus to the persistent trigger. Opening a nonmodal panel preserves pending selection validation.
**Pinned diagnostics.** Help can open diagnostics as a separate pinned region. Writing leaves it visible; opening another main panel replaces it. Explicit close or Escape returns focus to Help; Actions and diagnostics retain their required Escape input-cancellation behavior.
**Feedback.** Help ends with an Telegram feedback («Обратная связь в Telegram») link below Diagnostics, using the shared Lucide message icon, blue link text, visible keyboard focus and a44px minimum hit area. It opens the owner's Telegram in a new tab.
**Document controls.** Brand is static. Settings gear in the dock opens one panel: View contains background mode, contrast and spacing; Files and copies contains unique import/export/recovery/retry controls. The adjacent status dot opens Files. Green means saved, amber pending, gray loading/read-only, red error; hover and accessible descriptions name every status, and errors also retain visible text. Import remains a true modal dialog with protected focus.
**Selection actions.** Rectangle/lasso remain inline; actions disclose a vertical icon-and-label list with shortcut hints. Resize and rotation handles act directly on the selection. The Transform section also exposes numeric width and height percentages plus an angle in degrees, followed by an apply action. The image-insert control is 40×40px and accepts PNG and JPEG; its insertion notice has 10px corners. Ordinary Copy/Paste negotiate editable board content and images, with PNG download for a selected region. There are no separate image-copy or image-paste commands. Choosing, processing, success, and error feedback remains visible without changing canvas dimensions.
**Navigation and fields.** Bottom-right zoom/return/minimap uses stable tabular readouts. Percentage resets zoom around the current center; return restores the last completed pen working view. The collapsible minimap stays visible while writing, uses occupancy plus viewport outline, and holds the secondary fit-all action. Background contrast/spacing share immediate world-anchored settings for dots/grid. Ranges have a 40px interaction height (44px for coarse pointers), a thin neutral track and accent thumb. Keyboard focus is an accent outline with a 3px offset.
**Motion.** Button color/background changes use 100ms ease only when reduced motion is not requested; the writing surface has no decorative entrance animation.

## Do's and Don'ts

- Do keep the writing field dominant and preserve the out-of-flow layout.
- Do keep frequent controls visible and disclose secondary settings/actions contextually.
- Do retain visible focus, accessible names, 40px primary targets, 30×32px compact palette targets and readable numeric readouts.
- Do preserve the pinned diagnostics exception so pressure can be observed while writing.
- Don't import the mock's synthetic note or Caveat font into the production editor.
- Don't cancel pending selection work merely because a nonmodal panel opens or closes.
- Don't change ink geometry, document data or canvas backing dimensions as a visual styling shortcut.


## Touch adaptation

Finger navigation and Pencil input share one native ownership policy, outside React. Touch
selection handles accept a22CSSpx radius without changing visible or stored geometry. Coarse
pickers wrap, tooltips remain available by explicit help controls, and the selected template
name stays visible. Text fields use at least16px on coarse pointers to avoid focus zoom.
Phone/tablet changes preserve the desktop visual language and the existing two ink canvases.


## Mathematical template refinement

New math templates use compact KleeOne handwritten vector lettering, with common exact glyph
metrics across preview/editor/PNG. Application chrome retains system UI typography; no webfont
is loaded. Every numeric tick is retained and source geometry grows to fit its labels.
The math panel uses up to640px/two columns from760px viewport width; narrower screens keep one
column. Its palette uses five columns at the existing30px fine/44px coarse targets.

Preview has explicit Detail/Fit («Крупно»/«Целиком») modes and an independent pointer/touch/keyboard camera.
Number lines use120px preview height; XY/circles240px wide and180px narrow. Whole is the default. Closeup prioritizes
readable lettering nearzero; Whole is an overview and may reduce labels on large ranges.
Circle angles sit outside and coordinates±1inside, with separate controls. Axis origin labels
clear the axes and neighbors. Prior generator1 items retain their earlier appearance.

Ordinary shape previews fill the available panel content width, retain their96px height and
uniform figure proportions. Mathematical previews continue to fill their assigned grid column.

## Application availability (Change31)

Installation/offline controls reuse the existing light surface, semantic tokens and visible
keyboard focus. Keep them contextual and separate from per-sample writing/dock geometry.
Offline readiness describes the cached app; local note status remains independently authoritative.

## Language preference (Change36)

The existing gear View section ends with a labelled native Language select (Auto, English,
Русский) and a short profile-wide preference hint. It reuses the light field/focus tokens and
40px minimum target. Both translations preserve dock/panel geometry; existing board titles
are user content and retain their language. Preference remains available in readonly.

## Application theme (Change45)

Preserve the Writing-First Notebook's typography, geometry, compact dock and interaction states.
Light remains the default and retains the original paper/ink palette. A labelled native Theme
select beside Language offers Light, Dark and System, with one browser-wide preference.
Dark uses a muted graphite writing surface, slightly raised panels, light neutral text and clear
blue focus/selection states. Text, disabled/error/status colors, fields, overlays and navigation
remain legible without increasing visual noise or adding layout wrappers.

Pair all ten vector ink colors across themes, preserving hue identity and alpha. Match swatches,
stroke samples, SVG/template previews, native ink, mathematical glyphs, cursor/selection,
grid/dots and overview coverage. Images retain their colors; PNG/clipboard imagery keeps light
colors and transparency. The stored palette stays independent of presentation. Theme changes
preserve active input, editor identity, selection, camera and history.
