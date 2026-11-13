---
name: penable editor proposal
description: Proposal for a writing-first light notebook editor; owner-approved visual reference for Change15.
colors:
  ink: "#182230"
  muted: "#526176"
  accent: "#175cd3"
  active: "#eaf1ff"
  hover: "#f1f4f8"
  line: "#e0e5ec"
  error: "#b42318"
  editor-bg: "#f3f5f8"
  paper: "#ffffff"
typography:
  body:
    fontFamily: "Segoe UI, system-ui, sans-serif"
rounded:
  control: "8px"
  chrome: "12px"
  popover: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  icon-control:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "40px"
  floating-dock:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chrome}"
    height: "56px"
---

# Design System: penable editor proposal

## Overview

**APPROVED MOCK REFERENCE.** This document describes the isolated mock in this directory.
The owner approved visual transfer on2026-11-13 in Change15. SPEC §5.3/5.14 remains the production authority.

**Creative North Star: "The Writing-First Notebook"**

The proposal gives the writing surface most of the screen and places frequent actions in one floating horizontal dock. Familiar notebook controls, light paper, compact labels, and precise blue selection keep the editor legible without adding a permanent tutorial row. The visual language follows the mock's solid white chrome, system UI type, and single authored SVG icon family.

The board menu, pen settings, selection actions, and save recovery are shown as contextual panels around a synthetic note. All interface behavior and content in the mock are demonstrations; they do not operate on application data.

**Key Characteristics:**
- Writing-first, light digital notebook composition.
- Floating horizontal dock with inline width and click-to-open stabilization.
- Russian labels, system UI typography, and compact controls.
- Visual direction approved for Change15; runtime acceptance is separate.

## Colors

The mock uses a cool neutral interface with a blue interaction accent, dark ink, and a separate red error state.

### Primary
- **Notebook Blue** (#175cd3): selected controls, focus outlines, range progress, and selection geometry.

### Neutral
- **Ink** (#182230): primary interface text and synthetic note strokes.
- **Muted Slate** (#526176): secondary labels, save status, and supporting text.
- **Editor Mist** (#f3f5f8): review-shell background; the editor canvas itself is white.
- **Paper White** (#ffffff): board and popover surfaces.
- **Soft Blue Selection** (#eaf1ff): selected tool and option backgrounds.
- **Control Hover** (#f1f4f8): hover surface for controls.
- **Divider Gray** (#e0e5ec): separators and quiet borders.
- **Error Red** (#b42318): failed-save status and destructive selection action.

## Typography

**Body Font:** Segoe UI, system-ui, sans-serif.

**Character:** System UI text keeps controls familiar and compact. The synthetic note uses a locally bundled Caveat font; it is sample content, not an interface typeface or evidence of real handwriting quality.

### Hierarchy
- **Brand** (650, 20px, letter-spacing -0.035em): compact board identity in the top-left control.
- **Panel title** (600, 14px): contextual panel headings.
- **Control label** (regular, 12–13px): toolbar, menu, and setting text.
- **Supporting label** (regular, 10–12px): hints, units, and range endpoints.
- **Review heading** (600, 15px): mock-only state gallery label outside the product frame.

## Layout

The proposal targets desktop frames at 1440×900 and 1280×720. A full-bleed white board carries a synthetic math note. The 56px dock floats top-center; board menu and save status sit 20px from the top corners, with zoom navigation bottom-right and help bottom-left. Context panels open beside their triggers.

The review gallery is outside the product frame and is omitted from previews. At widths below 1100px, the mock hides the save label and compresses its review chrome; this does not define a mobile layout. Do not generalize beyond the two stated desktop targets.

The brief's composition quality bar is under 10% chrome coverage and no overlap at both target frames. This is a design criterion, not documented production or hardware acceptance.

## Elevation & Depth

White surfaces lift from the board through restrained shadows. The dock and corner controls use `0 3px 14px rgb(24 34 48 / 8%), 0 1px 3px rgb(24 34 48 / 5%)`; popovers use `0 6px 24px rgb(24 34 48 / 12%), 0 1px 4px rgb(24 34 48 / 5%)`. The selected state gallery button has a smaller `0 1px 4px rgb(24 34 48 / 8%)` shadow.

## Shapes

Controls use restrained rounded corners: 8px icon controls, 7px shape and state controls, and 12px board/save chrome. Popovers use 14px corners. Dividers remain thin and square; the canvas and paper stay edge-to-edge. Keep focus visible as a 2px accent outline with a 3px offset.

## Components

### Floating tool dock
- White, 56px high, 8px internal padding, 12px corners, and a subtle shadow.
- Tool groups use 4px gaps; groups are separated by 1px dividers. The dock is centered at the top.
- Tool targets are 40×40px. Selected tools use blue text on a pale-blue surface; hover and active surfaces are distinct.
- Pen width is always inline. Clicking the already-selected pen opens stabilization settings.

### Board and save controls
- White 48px-high controls with 12px corners sit at the upper board corners.
- The board control opens its menu. Save status is visible at rest and turns red in the mock error state.

### Context panels
- White panels use 14px corners, 16px padding, and the popover shadow.
- Menus use 40px minimum-height rows. Selected background options use blue text, a pale-blue fill, and a blue-tinted border.
- Error recovery offers retry and copy actions in the mock; these controls do not perform real operations.

### Selection and focus
- Selection geometry uses the blue accent, a translucent blue fill, and a dashed outline.
- Buttons and inputs retain the visible accent focus outline. Disabled controls use muted gray.

## Do's and Don'ts

- Do keep the writing surface visually dominant and the frequent actions together in the floating horizontal dock.
- Do keep width inline and open stabilization on a repeated click of the selected pen.
- Do preserve the five mock states: writing, pen settings, selection, board menu, and save error.
- Do keep text labels, selected states, focus, and disabled treatments distinct.
- Don't add a permanent tutorial or status row inside the proposed product frame.
- Don't present the synthetic note as real user content or proof of handwriting quality.
- Don't treat this proposal or its static previews as production, application, or Wacom acceptance.
- Don't treat mock approval as hardware or production acceptance; follow Change15 and SPEC.
