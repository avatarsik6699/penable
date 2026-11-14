# Prepared mathematical lettering

The atlas contains only the required `0123456789xyπ−/. ` glyph outlines and advance/ink metrics
from **Klee One Regular**, copyright 2020 The Klee Project Authors. It is distributed under the
SIL Open Font License 1.1 in the adjacent OFL.txt. The extracted asset is named `GlyphAtlas`,
is not installable as a font, and includes no unrelated glyphs.

Source: https://raw.githubusercontent.com/google/fonts/main/ofl/kleeone/KleeOne-Regular.ttf
Upstream project: https://github.com/fontworks-fonts/Klee/tree/8b0532731b63ad8a445ca341d8d7d941079b83ab
Source TTF SHA256: bf4063f030cc2ae6adf0a11424a1888e5c0eb4438f1f6d02f52294af868e9b3a

Preparation uses fontTools 4.64 TTFont.getBestCmap/getGlyphSet, SVGPathPen and BoundsPen.
Each glyph is replayed through TransformPen(1,0,0,-1,0,0), preserving font-unit coordinates,
original advance and exact curve bounds. The source unitsPerEm is 1000. No outlines were
redrawn, stretched or synthesized, including π and the mathematical minus sign. Runtime
layout scales these paths uniformly and derives every label box from the extracted ink metrics.
SVG preview, Canvas editor and PNG worker all replay this same prepared atlas; no system-font
or network-font dependency is involved.
