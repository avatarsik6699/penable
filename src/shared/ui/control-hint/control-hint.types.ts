import type { MessageTypes } from "~/shared/lib/messages";
import type { ReactNode } from "react";

export namespace ControlHintTypes {
  export type Props = {
    label: MessageTypes.Value;
    children: ReactNode;
    align?: "start" | "end";
  };
}
