import type { ThemeTypes } from "~/shared/lib/theme";
import { I18n } from "~/shared/lib/i18n";
import { Messages } from "~/shared/lib/messages";
import type { OverviewResult } from "~/features/board-document";
import type { Viewport } from "~/entities/board";
import type { MinimapElements } from "./minimap.types";

function paint(
  canvas: HTMLCanvasElement,
  result: OverviewResult,
  theme: ThemeTypes.Effective = "light",
) {
  canvas.width = result.width;
  canvas.height = result.height;

  const context = canvas.getContext("2d");

  if (!context)
    throw Messages.error(Messages.create("overviewCanvasIsUnavailable"));

  const image = context.createImageData(result.width, result.height);

  for (let i = 0; i < result.values.length; i++) {
    image.data[i * 4] = theme === "dark" ? 168 : 82;
    image.data[i * 4 + 1] = theme === "dark" ? 180 : 97;
    image.data[i * 4 + 2] = theme === "dark" ? 198 : 118;
    image.data[i * 4 + 3] = result.values[i]!;
  }

  context.putImageData(image, 0, 0);
}

function viewport(
  elements: MinimapElements,
  result: OverviewResult | null,
  view: Viewport,
  size: {
    width: number;
    height: number;
  },
  blocked: boolean,
) {
  const bounds = result?.bounds,
    frame = elements.mapFrame;

  if (!bounds || !frame) {
    frame?.setAttribute("visibility", "hidden");
    elements.mapMarker?.setAttribute("visibility", "hidden");

    if (elements.mapOutside) elements.mapOutside.hidden = true;

    if (elements.mapFit) elements.mapFit.disabled = true;

    return;
  }

  const x =
    ((-view.x / view.zoom - bounds.left) / (bounds.right - bounds.left)) * 256;

  const y =
    ((-view.y / view.zoom - bounds.top) / (bounds.bottom - bounds.top)) * 160;

  const w = (size.width / view.zoom / (bounds.right - bounds.left)) * 256;
  const h = (size.height / view.zoom / (bounds.bottom - bounds.top)) * 160;
  const outside = x + w < 0 || y + h < 0 || x > 256 || y > 160;

  frame.setAttribute("visibility", outside ? "hidden" : "visible");

  elements.mapMarker?.setAttribute(
    "visibility",
    outside ? "visible" : "hidden",
  );

  elements.mapMarker?.setAttribute(
    "cx",
    String(Math.min(252, Math.max(4, x + w / 2))),
  );

  elements.mapMarker?.setAttribute(
    "cy",
    String(Math.min(156, Math.max(4, y + h / 2))),
  );

  frame.setAttribute("x", String(Math.max(0, Math.min(255, x))));
  frame.setAttribute("y", String(Math.max(0, Math.min(159, y))));

  frame.setAttribute(
    "width",
    String(Math.max(1, Math.min(256, x + w) - Math.max(0, x))),
  );

  frame.setAttribute(
    "height",
    String(Math.max(1, Math.min(160, y + h) - Math.max(0, y))),
  );

  const fitZoom = Math.min(
    (size.width - 96) / (bounds.right - bounds.left),
    (size.height - 96) / (bounds.bottom - bounds.top),
  );

  if (elements.mapOutside) {
    elements.mapOutside.hidden = !outside && fitZoom >= 0.25;

    elements.mapOutside.textContent = I18n.t(
      outside
        ? "theCurrentViewIsOutsideYourNotes"
        : "notesAreFarApartChooseAnArea",
    );
  }

  if (elements.mapFit) elements.mapFit.disabled = fitZoom < 0.25 || blocked;
}

export const MinimapPresentation = { paint, viewport };
