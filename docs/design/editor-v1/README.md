# penable editor mock

**Visual direction approved on2026-11-13.** This directory preserves the isolated historical
mock used for Change15's production transfer under SPEC5.3/5.14. It is not the current editor.
The synthetic note does not demonstrate real handwriting quality. Original Russian mock labels
and frozen screenshots/assets remain unchanged as accepted historical references.

## Open

From the repository root:

```bash
npm run mock:serve
```

Open http://127.0.0.1:4190. The selector above the board shows five states: writing, pen settings,
selection, board menu and save error. Click the selected pen again for stabilization; width is
inline. Outside click/Escape closes menus; Escape returns focus to the trigger.

Sliders, instrument/background selection and recovery controls change only the mock. They do not
draw, open files/clipboard or use browser storage. Operation buttons show a demonstration notice.
Only same-origin SVG/font assets are fetched; no external resources are required.

## Previews

All PNGs are1440×900 board frames without the external state selector:

- [Writing](previews/writing.png)
- [Pen settings](previews/pen.png)
- [Selection](previews/selection.png)
- [Board menu](previews/board.png)
- [Save error](previews/error.png)

Without the selector: `/?preview=1&state=writing`. States: `writing`, `pen`, `selection`, `board`,
`error`. The proposal targeted1440×900 and1280×720; it did not define the mobile app layout.

## Boundaries

[BRIEF.md](BRIEF.md) records the chosen composition/criteria. [DESIGN.md](DESIGN.md) describes
implemented proposal elements without replacing production design authority. The owner approved
transfer to the working editor in Change15. These static files are excluded from Vite/Pages builds.

## Assets and license

`assets/scene.svg` is an authored synthetic note, not user content. Icons are authored inline SVGs
without a third-party library. The mock bundles [Caveat from Google Fonts](https://github.com/google/fonts/tree/main/ofl/caveat),
a400–700 variable font with Cyrillic support, for the synthetic handwriting. SIL Open Font License1.1
is included in [assets/OFL.txt](assets/OFL.txt). UI text uses Segoe UI/system sans-serif.
