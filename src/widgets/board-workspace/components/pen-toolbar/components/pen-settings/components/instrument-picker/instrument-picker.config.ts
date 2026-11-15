import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import type { InkInstrument } from "~/entities/board";
import type { EditorIconTypes } from "~/shared/ui/editor-icon";

export const InstrumentPickerConfig = {
  entries: [
    { value: "pen", label: Messages.create("pen303"), icon: "pen" },
    {
      value: "pressure",
      label: Messages.create("pressurePen"),
      icon: "pressure-pen",
    },
    {
      value: "highlighter",
      label: Messages.create("highlighter"),
      icon: "highlighter",
    },
  ] satisfies {
    value: InkInstrument;
    label: MessageTypes.Value;
    icon: EditorIconTypes.Name;
  }[],
};
