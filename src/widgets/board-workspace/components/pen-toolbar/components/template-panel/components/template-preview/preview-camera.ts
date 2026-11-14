import { BoardTemplates, type TemplateConfig } from "~/entities/board";

export class PreviewCamera {
  private width = 280;
  private height = 180;
  private x: number;
  private y: number;
  private scale = 1;
  private mode: "close" | "whole" | "custom" = "whole";

  constructor(private readonly config: TemplateConfig) {
    const origin = BoardTemplates.origin(
      config,
      BoardTemplates.version(config),
    );

    this.x = origin.x;
    this.y = origin.y;
  }

  get snapshot() {
    const b = BoardTemplates.layout(
      this.config,
      BoardTemplates.version(this.config),
    ).bounds;

    const scale =
      this.mode === "whole"
        ? Math.max(
            (b.right - b.left + 20) / this.width,
            (b.bottom - b.top + 20) / this.height,
          )
        : this.scale;

    const width = this.width * scale,
      height = this.height * scale;

    const x = this.mode === "whole" ? (b.left + b.right) / 2 : this.x;
    const y = this.mode === "whole" ? (b.top + b.bottom) / 2 : this.y;

    return {
      mode: this.mode,
      viewBox: `${x - width / 2} ${y - height / 2} ${width} ${height}`,
    };
  }

  resize(width: number, height: number) {
    if (width > 0 && height > 0) {
      this.width = width;
      this.height = height;
    }
  }

  choose(mode: "close" | "whole") {
    this.mode = mode;
    this.scale = 1;

    const origin = BoardTemplates.origin(
      this.config,
      BoardTemplates.version(this.config),
    );

    this.x = origin.x;
    this.y = origin.y;
  }

  pan(dx: number, dy: number) {
    const [left, top, width, height] = this.snapshot.viewBox
      .split(" ")
      .map(Number) as [number, number, number, number];

    this.x = left + width / 2 - (dx * width) / this.width;
    this.y = top + height / 2 - (dy * height) / this.height;
    // Panning a fitted view retains its uniform scale instead of jumping to closeup.
    this.scale = width / this.width;
    this.mode = this.scale === 1 ? "close" : "custom";
  }
}
