import type { InputDiagnostics } from "../../model/workspace-model.types";

export namespace HelpControlsTypes {
  export type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    diagnostics: InputDiagnostics;
    diagnosticsOpen: boolean;
    onDiagnosticsChange: (open: boolean) => void;
    onCancelActiveInput: () => void;
  };
}
