import type { MessageTypes } from "~/shared/lib/messages";

export namespace HelpHintTypes {
  export type Props = {
    label: MessageTypes.Value;
    text: string;
  };
}
