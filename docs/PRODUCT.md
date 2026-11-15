# Product

<!-- impeccable:product-schema 1 -->

Product context for design work; [SPEC.md](SPEC.md) remains the canonical product contract.
This file records confirmed context, not a new implementation/schema specification.

## Platform

web

## Users and purpose

Personal handwritten notes on a free board, primarily Windows11 with Wacom One. The owner wants
comfortable long writing sessions, clear navigation and safe local notes. Secondary input is mouse.

## Capabilities and constraints

React/TypeScript/Canvas2D; browser-local storage and JSON recovery copies. Current pen, whole-stroke
eraser, rectangle/lasso selection, move/copy/edit, undo/redo, pan/zoom and backgrounds exist.
Implemented extensions include affine selection transforms, immutable PNG/JPEG assets, independent
named boards with colored/icon covers, pressure pen/highlighter, vector mathematical templates,
touch navigation and a prepared production offline shell. There is no backend, collaboration or account. Hardware writing quality is separate
from visual mock acceptance. Source/scene/data behavior stays under SPEC and FRONTEND.

## Brand commitments

Name: penable. The current interface is Russian; owner-approved ru/en localization is planned in
Change36, with browser detection and an explicit setting. Light paper and compact tools. Miro/Notability inform familiar
editing ergonomics. Owner selected a floating horizontal dock for the editor world,
inline width and click-to-open stabilization. The separate Change14 mock was approved on2026-11-13
for transfer into the real editor in Change15; acceptance covers visual direction, not hardware behavior.
