import type { MessageTypes } from "~/shared/lib/messages";
import type {
  BoardDocument,
  BoardAppearance,
  LibraryRepository,
  WriterLease,
} from "../../board-document.types";

export type {
  BoardCatalog,
  LibraryRepository,
} from "../../board-document.types";

import type { SessionOptions, DocumentSession } from "../session";

export type LibraryState = Readonly<{
  activeId: string;
  boards: ReadonlyArray<
    Readonly<{
      id: string;
      title: string;
      appearance: BoardAppearance;
    }>
  >;
  busy: boolean;
  message: MessageTypes.Value;
}>;

export type LibraryOptions = Pick<
  SessionOptions,
  "snapshot" | "onHydrate" | "onState"
> & {
  onLibrary?: (state: LibraryState) => void;
  initialTitle?: string;
  decode?: SessionOptions["decode"];
  preflight?: (document: BoardDocument, signal: AbortSignal) => Promise<void>;
  acquire: () => Promise<WriterLease>;
  open: (
    invalidated: (message: MessageTypes.Value) => void,
  ) => Promise<LibraryRepository>;
  session: (
    id: string,
    lease: WriterLease,
    options: Pick<SessionOptions, "snapshot" | "onHydrate" | "onState">,
  ) => DocumentSession;
  id: () => string;
};
