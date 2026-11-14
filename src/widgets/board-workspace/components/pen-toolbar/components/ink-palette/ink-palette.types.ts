import type { InkColor } from "~/entities/board";

export namespace InkPaletteTypes {
  export type Props = {
    color: InkColor;
    label?: string;
    disabled: boolean;
    onChange: (color: InkColor) => void;
  };
}
