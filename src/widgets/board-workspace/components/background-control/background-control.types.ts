import type { BackgroundMode } from "~/entities/board";

export namespace BackgroundControlTypes {
  export type Props = {
    background: BackgroundMode;
    readOnly: boolean;
    onBackgroundChange: (value: BackgroundMode) => void;
  };
}
