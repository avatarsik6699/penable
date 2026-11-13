import type { OverlayElements } from "~/shared/lib/overlay";

export namespace PenSettingsTypes {
  export type Props = {
    width: number;
    stabilization: number;
    readOnly: boolean;
    onStabilizationChange: (value: number) => void;
    bindRoot: (node: OverlayElements.Container | null) => void;
    onClose: () => void;
  };
}
