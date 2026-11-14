import type { InkInstrument } from "~/entities/board";

export namespace InstrumentPickerTypes {
  export type Props = {
    value: InkInstrument;
    disabled: boolean;
    onChange: (value: InkInstrument) => void;
  };
}
