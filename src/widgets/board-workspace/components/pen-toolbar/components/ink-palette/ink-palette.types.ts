import type { MessageTypes } from "~/shared/lib/messages";
import type { InkColor } from "~/entities/board";

export namespace InkPaletteTypes {
  export type Props = {
    compact?: boolean;
    color: InkColor;
    label?: MessageTypes.Value;
    disabled: boolean;
    onChange: (color: InkColor) => void;
  };
}
