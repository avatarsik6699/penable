import type { BoardAppearance } from "../../../../board-document.types";

export namespace AppearanceEditorTypes {
  export type Props = {
    id: string;
    title: string;
    appearance: BoardAppearance;
    disabled: boolean;
    onSave: (id: string, appearance: BoardAppearance) => Promise<void>;
    onReturn: () => void;
  };
}
