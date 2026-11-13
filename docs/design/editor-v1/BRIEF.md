# Penable editor proposal

Status: PROPOSAL FOR OWNER REVIEW. This is not the working editor or an approved replacement of SPEC5.3.

## Direction contract

- THESIS: writing owns the screen; a compact floating dock keeps frequent actions near the pen.
- OWN-WORLD: established light digital notebook/editor, precise blue selection, solid white chrome,
  dark monochrome synthetic handwriting, system UI typography and one consistent SVG icon family.
- STORY: open a personal board → write → adjust the pen → select/edit → recover safely when saving fails.
- FIRST VIEWPORT: full white dotted board with a legible synthetic math note; dock top-center,
  board menu top-left, local save status top-right, navigation bottom-right, help bottom-left.
- FORM: native-looking Operate controls,40–44px targets,56px dock, restrained offset shadows,
  current blue accent#175CD3, ink#182230, clear focus and labels. No permanent tutorial/status rows.

## Quality bar

Tools feel like one coherent editor rather than disconnected settings. Main chrome covers<10% of
viewport; no overlapping chrome at1440×900 or1280×720. Labels/readouts stay legible; selected,
hover, focus and disabled treatments are distinct. The note is demonstration content, not a claim
about generated handwriting or a new text/shape feature. No decorative motion or new feature affordances.

## States

Writing; pen parameters with stabilization65%; selected area with margins and current actions;
board menu with import/export/backups/background; save error with retry/copy. Main pen width3.0px.
All controls are demonstrations: no drawing, file access, downloads, storage, clipboard or external network actions. Only same-origin mock assets are fetched.
The gallery/state selector is outside the product frame and screenshots crop it out.

## Scope boundary

Only docs/design/editor-v1 contains the proposal. Keep current src and app API/data unchanged.
After this proposal is presented, the owner reviews the visual direction before a separate app change.

## References

[Miro toolbars](https://help.miro.com/hc/en-us/articles/360017730553-Toolbars),
[Notability toolbox](https://support.gingerlabs.com/en-us/articles/16300108-getting-started-with-notability).
