export namespace DeleteBoardDialogTypes {
  export type Props = {
    title: string;
    busy: boolean;
    error: string;
    onConfirm: () => void;
    onCancel: () => void;
  };
}
