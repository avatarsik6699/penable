import type { MessageTypes } from "~/shared/lib/messages";

export namespace DeleteBoardDialogTypes {
  export type Props = {
    title: string;
    busy: boolean;
    error: MessageTypes.Value;
    onConfirm: () => void;
    onCancel: () => void;
  };
}
