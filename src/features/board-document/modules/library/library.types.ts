import type { MessageTypes } from "~/shared/lib/messages";
import type { BoardSnapshot } from "~/entities/board";
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
  recovery?: LibraryRecoveryState;
}>;

export type LibraryRecoveryState = Readonly<{
  previewId: string | null;
  pendingId: string | null;
  message: MessageTypes.Value;
}>;

export type LibraryOptions = Pick<
  SessionOptions,
  "snapshot" | "onHydrate" | "onState"
> & {
  onLibrary?: (state: LibraryState) => void;
  onRecoveryPreview?: (board: BoardSnapshot | null) => void;
  initialTitle?: string;
  decode?: SessionOptions["decode"];
  prepareOwned?: (
    id: string,
    signal: AbortSignal,
  ) => Promise<import("../jobs").OwnedPreparedBoard | null>;
  preflight?: (document: BoardDocument, signal: AbortSignal) => Promise<void>;
  acquire: () => Promise<WriterLease>;
  open: (
    invalidated: (message: MessageTypes.Value) => void,
  ) => Promise<LibraryRepository>;
  session: (
    id: string,
    lease: WriterLease,
    options: Pick<
      SessionOptions,
      "snapshot" | "onHydrate" | "onState" | "initialLoad" | "onInvalidated"
    >,
  ) => DocumentSession;
  id: () => string;
};
