import type { TextEditHandle } from "../../model/workspace-model.types";

export namespace TextEditDialogTypes {
  export type Props = {
    edit: TextEditHandle;
    onClose: () => void;
  };
}
