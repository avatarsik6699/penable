import {
  BoardBackground,
  type Viewport,
  type BoardSelection,
  type DrawingTool,
} from "~/entities/board";

function background(element: HTMLDivElement | null, viewport: Viewport) {
  const style = element?.style;

  if (!style) return;

  const layout = BoardBackground.backgroundLayout(viewport);

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
) {
  if (!path) return;

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
