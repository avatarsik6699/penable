import type { BoardSelection } from "~/entities/board";
import type { BitmapCache } from "../images";

export namespace BoardClipboardTypes {
  export type Options = {
    canvas: HTMLCanvasElement;
    selection: BoardSelection;
    images: BitmapCache;
    allowed: () => boolean;
    writable: () => boolean;
    insertImage: (blob: Blob) => Promise<void>;
    activate: () => void;
    changed: () => void;
  };
}
