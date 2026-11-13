import type { AffineMatrix, ClipMask, Position } from "../../../board.types";
import { BoardTransforms } from "../../../transforms";
import { BoardRegions } from "../../../regions";

type Handle = {
  x: number;
  y: number;
  kind: "resize" | "rotate";
  index: number;
};

type Contact = {
  pointerId: number;
  handle: Handle;
  bounds: { left: number; top: number; right: number; bottom: number };
  start: Position;
  region: ClipMask;
  matrix: AffineMatrix;
};

export class SelectionTransform {
  private contact: Contact | null = null;

  get pointerId() {
    return this.contact?.pointerId ?? null;
  }

  get matrix() {
    return this.contact?.matrix ?? BoardTransforms.IDENTITY;
  }

  get region() {
    return this.contact
      ? BoardTransforms.mask(this.contact.region, this.contact.matrix)
      : null;
  }

  handles(region: ClipMask, zoom: number): Handle[] {
    const b = BoardRegions.maskBounds(region);

    if (!b) return [];

    const xs = [b.left, (b.left + b.right) / 2, b.right],
      ys = [b.top, (b.top + b.bottom) / 2, b.bottom];

    const result: Handle[] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ].map(([x, y], index) => ({
      x: xs[x!]!,
      y: ys[y!]!,
      kind: "resize" as const,
      index,
    }));

    result.push({ x: xs[1]!, y: b.top - 28 / zoom, kind: "rotate", index: 8 });

    return result;
  }

  down(
    pointerId: number,
    point: Position,
    region: ClipMask,
    zoom: number,
  ): boolean {
    const handle = this.handles(region, zoom).sort(
      (a, b) =>
        Math.hypot(a.x - point.x, a.y - point.y) -
        Math.hypot(b.x - point.x, b.y - point.y),
    )[0];

    const bounds = BoardRegions.maskBounds(region);

    if (
      !handle ||
      !bounds ||
      Math.hypot(handle.x - point.x, handle.y - point.y) > 9 / zoom
    )
      return false;

    this.contact = {
      pointerId,
      handle,
      bounds,
      start: point,
      region,
      matrix: BoardTransforms.IDENTITY,
    };

    return true;
  }

  move(point: Position, shift = false): AffineMatrix | null {
    const c = this.contact;

    if (!c) return null;

    const b = c.bounds;

    if (c.handle.index === 8) {
      const center = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };

      let degrees =
        ((Math.atan2(point.y - center.y, point.x - center.x) -
          Math.atan2(c.start.y - center.y, c.start.x - center.x)) *
          180) /
        Math.PI;

      if (shift) degrees = Math.round(degrees / 15) * 15;

      c.matrix = BoardTransforms.around(center, 1, 1, degrees);
    } else {
      const h = c.handle,
        center = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };

      const anchor = {
        x: h.x === center.x ? center.x : h.x === b.left ? b.right : b.left,
        y: h.y === center.y ? center.y : h.y === b.top ? b.bottom : b.top,
      };

      let sx =
          h.x === anchor.x
            ? 1
            : (h.x + point.x - c.start.x - anchor.x) / (h.x - anchor.x),
        sy =
          h.y === anchor.y
            ? 1
            : (h.y + point.y - c.start.y - anchor.y) / (h.y - anchor.y);

      sx = Math.max(0.001, sx);
      sy = Math.max(0.001, sy);

      if (shift) {
        const scale =
          h.x === anchor.x
            ? sy
            : h.y === anchor.y
              ? sx
              : Math.abs(sx - 1) > Math.abs(sy - 1)
                ? sx
                : sy;

        sx = scale;
        sy = scale;
      }

      c.matrix = BoardTransforms.around(anchor, sx, sy, 0);
    }

    return c.matrix;
  }

  cancel() {
    this.contact = null;
  }
}
