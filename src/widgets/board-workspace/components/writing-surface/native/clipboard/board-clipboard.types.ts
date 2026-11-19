import type { BoardSelection, SelectionCommitResult } from "~/entities/board";
import type { BitmapCache } from "../images";

export namespace BoardClipboardTypes {
  export type Options = {
    canvas: HTMLCanvasElement;
    selection: BoardSelection;
    images: BitmapCache;
    allowed: () => boolean;
    writable: () => boolean;
    insertImage: (blob: Blob) => Promise<void>;
    insertText: (
      value: string,
      signal: AbortSignal,
    ) => Promise<SelectionCommitResult>;
    activate: () => void;
    changed: () => void;
  };
}
