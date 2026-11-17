import type { ThemeTypes } from "~/shared/lib/theme";
import { I18n } from "~/shared/lib/i18n";
import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { DocumentJobs, type OverviewResult } from "~/features/board-document";
import { MinimapPresentation } from "./minimap-presentation";
import type { MinimapOptions } from "./minimap.types";

export class NativeMinimap {
  private theme: ThemeTypes.Effective = "light";
  private open = false;
  private jobs: DocumentJobs | null = null;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private revision = 0;
  private renderedRevision = -1;
  private result: OverviewResult | null = null;
  private area: HTMLButtonElement | null = null;
  private fit: HTMLButtonElement | null = null;
  private statusMessage: MessageTypes.Value = "";

  private stopLanguage = () => {};

  constructor(private readonly options: MinimapOptions) {
    this.stopLanguage = I18n.bind(() => {
      this.setStatus(this.statusMessage);
      this.viewportChanged();
    });
  }

  private setStatus(message: MessageTypes.Value) {
    this.statusMessage = message;

    const status = this.options.elements.mapStatus;

    if (status) status.textContent = I18n.text(message);
  }

  setTheme(theme: ThemeTypes.Effective) {
    if (this.theme === theme) return;

    this.theme = theme;

    const canvas = this.options.elements.mapCanvas;

    if (this.open && this.result && canvas)
      MinimapPresentation.paint(canvas, this.result, this.theme);
  }

  setOpen(open: boolean) {
    if (open === this.open) {
      if (open) this.viewportChanged();

      return;
    }

    this.open = open;

    if (!open) {
      this.release();

      return;
    }

    this.area = this.options.elements.mapArea;
    this.fit = this.options.elements.mapFit;
    this.area?.addEventListener("click", this.clicked);
    this.area?.addEventListener("keydown", this.keyDown);
    this.fit?.addEventListener("click", this.fitAll);
    this.jobs = new DocumentJobs();
    this.schedule();
  }

  invalidate() {
    this.revision++;

    if (this.open) this.schedule();
  }

  private schedule() {
    clearTimeout(this.timer);
    this.abort?.abort();
    this.generation++;
    this.options.elements.mapHost?.setAttribute("aria-busy", "true");

    const status = this.options.elements.mapStatus;

    if (status) this.setStatus(Messages.create("updatingOverview"));

    this.viewportChanged();

    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.build();
    }, 150);
  }

  private async build() {
    if (!this.open || !this.jobs) return;

    const generation = this.generation,
      revision = this.revision;

    const controller = new AbortController();

    this.abort = controller;

    try {
      const result = await this.jobs.overview(
        this.options.scene.strokes,
        controller.signal,
      );

      if (!this.open || generation !== this.generation) return;

      this.result = result;
      this.renderedRevision = revision;

      const canvas = this.options.elements.mapCanvas;

      if (!canvas) return;

      MinimapPresentation.paint(canvas, result, this.theme);

      const status = this.options.elements.mapStatus;

      if (status)
        this.setStatus(
          result.bounds
            ? Messages.create("clickAnAreaToGoThere")
            : Messages.create("noNotesOnThisBoardYet"),
        );

      this.options.elements.mapHost?.setAttribute("aria-busy", "false");
      this.viewportChanged();
    } catch {
      if (
        !this.open ||
        generation !== this.generation ||
        controller.signal.aborted
      )
        return;

      this.result = null;
      this.options.elements.mapHost?.setAttribute("aria-busy", "false");

      const status = this.options.elements.mapStatus;

      if (status)
        this.setStatus(Messages.create("couldNotPrepareTheOverviewCloseAnd"));

      this.viewportChanged();
    }
  }

  viewportChanged() {
    this.setStatus(this.statusMessage);

    if (!this.open) return;

    MinimapPresentation.viewport(
      this.options.elements,
      this.result,
      this.options.viewport(),
      this.options.bounds(),
      this.options.blocked() || this.renderedRevision !== this.revision,
    );
  }

  private navigate(view: import("~/entities/board").Viewport) {
    if (!this.options.navigate(view)) {
      const status = this.options.elements.mapStatus;

      if (status) this.setStatus(Messages.create("thisAreaIsTooFarAwayTo"));
    }
  }

  private readonly clicked = (event: MouseEvent) => {
    const bounds = this.result?.bounds;

    if (
      !bounds ||
      this.options.blocked() ||
      this.renderedRevision !== this.revision ||
      !this.area
    )
      return;

    const rect = this.area.getBoundingClientRect();

    const x =
      event.detail === 0
        ? 0.5
        : Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));

    const y =
      event.detail === 0
        ? 0.5
        : Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    const center = {
      x: bounds.left + x * (bounds.right - bounds.left),
      y: bounds.top + y * (bounds.bottom - bounds.top),
    };

    const size = this.options.bounds(),
      zoom = this.options.viewport().zoom;

    this.navigate({
      zoom,
      x: size.width / 2 - center.x * zoom,
      y: size.height / 2 - center.y * zoom,
    });
  };

  private readonly keyDown = (event: KeyboardEvent) => {
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };

    const delta = direction[event.key];

    if (!delta || event.ctrlKey || event.metaKey || event.altKey) return;

    event.preventDefault();
    event.stopPropagation();

    if (this.options.blocked()) return;

    const view = this.options.viewport(),
      size = this.options.bounds();

    this.navigate({
      ...view,
      x: view.x - delta[0] * size.width * 0.1,
      y: view.y - delta[1] * size.height * 0.1,
    });
  };

  private readonly fitAll = () => {
    const bounds = this.result?.bounds;

    if (
      !bounds ||
      this.options.blocked() ||
      this.renderedRevision !== this.revision
    )
      return;

    const size = this.options.bounds();

    const requested = Math.min(
      (size.width - 96) / (bounds.right - bounds.left),
      (size.height - 96) / (bounds.bottom - bounds.top),
    );

    if (requested < 0.25) return;

    const zoom = Math.min(8, requested);

    this.navigate({
      zoom,
      x: size.width / 2 - ((bounds.left + bounds.right) / 2) * zoom,
      y: size.height / 2 - ((bounds.top + bounds.bottom) / 2) * zoom,
    });
  };

  private release() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    void this.jobs?.close().catch(() => {});
    this.jobs = null;
    this.area?.removeEventListener("click", this.clicked);
    this.area?.removeEventListener("keydown", this.keyDown);
    this.fit?.removeEventListener("click", this.fitAll);
    this.area = null;
    this.fit = null;

    const canvas = this.options.elements.mapCanvas;

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    this.result = null;
    this.renderedRevision = -1;
  }

  dispose() {
    this.stopLanguage();
    this.open = false;
    this.release();
  }
}
