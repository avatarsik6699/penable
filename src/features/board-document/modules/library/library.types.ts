import type {
  BoardDocument,
  LibraryRepository,
  WriterLease,
} from "../../board-document.types";

export type {
  BoardCatalog,
  LibraryRepository,
} from "../../board-document.types";

import type { SessionOptions, DocumentSession } from "../session";

export type LibraryState = Readonly<{
  previews?: Readonly<Record<string, string>>;
  activeId: string;
  boards: ReadonlyArray<Readonly<{ id: string; title: string }>>;
  busy: boolean;
  message: string;
}>;

export type LibraryOptions = Pick<
  SessionOptions,
  "snapshot" | "onHydrate" | "onState"
> & {
  previewLoad?: (id: string, signal: AbortSignal) => Promise<Blob>;
  preview?: import("../previews").BoardPreviewsTypes.Renderer;
  onLibrary?: (state: LibraryState) => void;
  preflight?: (document: BoardDocument, signal: AbortSignal) => Promise<void>;
  acquire: () => Promise<WriterLease>;
  open: (invalidated: (message: string) => void) => Promise<LibraryRepository>;
  session: (
    id: string,
    lease: WriterLease,
    options: Pick<SessionOptions, "snapshot" | "onHydrate" | "onState">,
  ) => DocumentSession;
  id: () => string;
};
