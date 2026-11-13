import type { BoardAppearance } from "../../../../board-document.types";

export namespace BoardRowTypes {
  export type Props = {
    id: string;
    appearance: BoardAppearance;
    restoreFocus: boolean;
    onAppearance: () => void;
    title: string;
    active: boolean;
    disabled: boolean;
    last: boolean;
    onSwitch: () => void;
    onRename: (title: string) => Promise<void>;
    onDelete: () => void;
  };
}
