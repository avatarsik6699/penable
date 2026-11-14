import type { InkInstrument } from "~/entities/board";
import type { EditorIconTypes } from "~/shared/ui/editor-icon";

export const InstrumentPickerConfig = {
  entries: [
    { value: "pen", label: "Ручка", icon: "pen" },
    { value: "pressure", label: "Перо с нажимом", icon: "pressure-pen" },
    { value: "highlighter", label: "Маркер", icon: "highlighter" },
  ] satisfies {
    value: InkInstrument;
    label: string;
    icon: EditorIconTypes.Name;
  }[],
};
