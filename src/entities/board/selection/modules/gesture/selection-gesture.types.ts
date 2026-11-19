import type {
  ClipMask,
  PointerInput,
  Position,
  RegionInput,
  SelectionShape,
  Viewport,
} from "../../../board.types";

export type GestureOptions = {
  allowTouch?: () => boolean;
  world: (event: Pick<PointerInput, "clientX" | "clientY">) => Position;
  viewport: () => Viewport;
  writable: () => boolean;
  hit: (point: Position) => boolean;
  shape: () => SelectionShape;
};

export type GestureContact = {
  pointerId: number;
  start: Position;
  current: Position;
  points: Position[];
  viewport: Viewport;
  moving: boolean;
  moved: boolean;
};

export type GestureUpdate =
  | { kind: "ignored" | "handled" | "draft" | "cancel" }
  | { kind: "drag"; delta: Position }
  | { kind: "error"; error: Error };

export type GestureRelease =
  | { kind: "none" }
  | { kind: "drag"; viewport: Viewport }
  | { kind: "region"; input: RegionInput };

export type GestureOutline = ClipMask | null;
