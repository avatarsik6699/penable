import type { TemplateKind } from "~/entities/board";

export namespace TemplatePickerTypes {
  export type Props = {
    value: TemplateKind;
    disabled: boolean;
    onChange: (kind: TemplateKind) => void;
  };
}
