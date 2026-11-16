import type { MessageTypes } from "~/shared/lib/messages";
import type {
  BoardItem,
  Scene,
  Viewport,
  SelectionCommitResult,
} from "~/entities/board";
import type { BitmapCache } from "./bitmap-cache";

export namespace ImageInputTypes {
  export type Options = {
    canvas: HTMLCanvasElement;
    scene: Scene;
    images: BitmapCache;
    viewport: () => Viewport;
    allowed: () => boolean;
    insert: (
      items: BoardItem[],
      signal: AbortSignal,
    ) => SelectionCommitResult | Promise<SelectionCommitResult>;
    notice: (message: MessageTypes.Value) => void;
    changed: () => void;
  };

  export type PendingClaim = {
    release: () => void;
  };
}
