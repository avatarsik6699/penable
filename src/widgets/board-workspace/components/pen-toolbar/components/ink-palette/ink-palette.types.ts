import type { InkColor } from "~/entities/board";

export namespace InkPaletteTypes {
  export type Props = {
    compact?: boolean;
    color: InkColor;
    label?: string;
    disabled: boolean;
    onChange: (color: InkColor) => void;
  };
}
