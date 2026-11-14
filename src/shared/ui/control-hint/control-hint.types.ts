import type { ReactNode } from "react";

export namespace ControlHintTypes {
  export type Props = {
    label: string;
    children: ReactNode;
    align?: "start" | "end";
  };
}
