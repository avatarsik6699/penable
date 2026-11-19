import type { BoardSnapshot } from "~/entities/board";
import { Messages } from "~/shared/lib/messages";
import { DocumentErrors } from "../session";
import type { LibraryRecoveryState } from "./library.types";

export class LibraryRecovery {
  private controller: AbortController | null = null;
  private readonly pending = new Set<Promise<void>>();
  private current: LibraryRecoveryState = {
    previewId: null,
    pendingId: null,
    message: "",
  };

  constructor(
    private readonly load: (
      id: string,
      signal: AbortSignal,
    ) => Promise<BoardSnapshot>,
    private readonly display: (board: BoardSnapshot | null) => void,
    private readonly publish: () => void,
  ) {}

  get state() {
    return this.current;
  }

  select(id: string, title: string) {
    this.controller?.abort();

    const controller = new AbortController();

    this.controller = controller;
    this.current = { ...this.current, pendingId: id, message: "" };
    this.publish();

    const pending = this.open(id, title, controller);

    this.pending.add(pending);

    void pending.then(
      () => this.pending.delete(pending),
      () => this.pending.delete(pending),
    );

    return pending;
  }

  private async open(id: string, title: string, controller: AbortController) {
    try {
      const board = await this.load(id, controller.signal);

      if (controller.signal.aborted) return;

      this.current = { previewId: id, pendingId: null, message: "" };
      this.display(board);
    } catch (error) {
      if (controller.signal.aborted) return;

      this.current = {
        ...this.current,
        pendingId: null,
        message: Messages.concat(
          Messages.create("couldNotPreviewBoard", { p0: title }),
          DocumentErrors.messageOf(error),
        ),
      };
    } finally {
      if (!controller.signal.aborted) {
        this.controller = null;
        this.publish();
      }
    }
  }

  close() {
    this.controller?.abort();
    this.controller = null;

    const displayed = this.current.previewId !== null;

    this.current = { previewId: null, pendingId: null, message: "" };

    if (displayed) this.display(null);

    this.publish();
  }

  drain() {
    return Promise.allSettled(this.pending);
  }
}
