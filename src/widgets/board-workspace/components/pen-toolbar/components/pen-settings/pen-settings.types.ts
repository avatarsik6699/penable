import type { OverlayElements } from "~/shared/lib/overlay";

export namespace PenSettingsTypes {
  export type Props = {
    width: number;
    fingerInput: boolean;
    onFingerInputChange: (value: boolean) => void;
    writing: import("~/entities/board").WritingSettings;
    onInstrumentChange: (
      instrument: import("~/entities/board").InkInstrument,
    ) => void;
    onInkSettingsChange: (
      patch: Partial<import("~/entities/board").InstrumentSettings>,
    ) => void;
    stabilization: number;
    readOnly: boolean;
    onStabilizationChange: (value: number) => void;
    bindRoot: (node: OverlayElements.Container | null) => void;
    onClose: () => void;
  };
}
