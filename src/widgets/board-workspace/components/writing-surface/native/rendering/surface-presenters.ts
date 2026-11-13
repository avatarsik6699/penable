import {
  BoardBackground,
  type Viewport,
  type BackgroundSettings,
  type BoardSelection,
  type DrawingTool,
} from "~/entities/board";

function background(
  element: HTMLDivElement | null,
  viewport: Viewport,
  settings: BackgroundSettings = { contrast: 45, spacing: 24 },
) {
  const style = element?.style;

  if (!style) return;

  const layout = BoardBackground.backgroundLayout(viewport, settings.spacing);

  style.setProperty("--background-contrast", String(settings.contrast / 100));

  style.setProperty("--background-step", `${layout.screenStep}px`);
  style.setProperty("--background-x", `${layout.phaseX}px`);
  style.setProperty("--background-y", `${layout.phaseY}px`);

  style.setProperty(
    "--background-dot-x",
    `${layout.phaseX - layout.screenStep / 2}px`,
  );

  style.setProperty(
    "--background-dot-y",
    `${layout.phaseY - layout.screenStep / 2}px`,
  );
}

function selection(
  path: SVGPathElement | null,
  viewport: Viewport,
  selection: BoardSelection,
  tool: DrawingTool,
  handles?: SVGPathElement | null,
) {
  if (!path) return;

  handles?.setAttribute(
    "d",
    tool === "selection"
      ? selection
          .handles()
          .map((handle) => {
            const x = handle.x * viewport.zoom + viewport.x,
              y = handle.y * viewport.zoom + viewport.y;

            return handle.index === 8
              ? `M${x - 5},${y}a5,5 0 1,0 10,0a5,5 0 1,0 -10,0`
              : `M${x - 4},${y - 4}h8v8h-8Z`;
          })
          .join(" ")
      : "",
  );

  path.setAttribute(
    "d",
    tool === "selection"
      ? selection.outline
          .map((polygon) =>
            polygon
              .map(
                (ring) =>
                  ring
                    .map(
                      ([x, y], index) =>
                        `${index ? "L" : "M"}${x * viewport.zoom + viewport.x},${y * viewport.zoom + viewport.y}`,
                    )
                    .join(" ") + "Z",
              )
              .join(" "),
          )
          .join(" ")
      : "",
  );
}

export const SurfacePresenters = { background, selection };
