export namespace BoardRowTypes {
  export type Props = {
    id: string;
    preview?: string;
    title: string;
    active: boolean;
    disabled: boolean;
    last: boolean;
    onSwitch: () => void;
    onRename: (title: string) => Promise<void>;
    onDelete: () => void;
  };
}
