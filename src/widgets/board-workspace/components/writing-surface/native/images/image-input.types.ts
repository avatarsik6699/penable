import type { BoardItem, Scene, Viewport } from "~/entities/board";
import type { BitmapCache } from "./bitmap-cache";

export namespace ImageInputTypes {
  export type Options = {
    canvas: HTMLCanvasElement;
    scene: Scene;
    images: BitmapCache;
    viewport: () => Viewport;
    allowed: () => boolean;
    insert: (items: BoardItem[]) => void | boolean | Promise<void | boolean>;
    pasteFragment: () => void;
    notice: (message: string) => void;
    changed: () => void;
  };

  export type PendingClaim = { release: () => void };
}
