import type { ComponentProps } from "react";

export namespace ButtonTypes {
  export type Props = ComponentProps<"button"> & {
    transientDisabled?: boolean;
  };
}
