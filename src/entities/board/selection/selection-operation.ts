import { Messages } from "~/shared/lib/messages";
import type { ClipMask } from "../board.types";
import type { SelectionCommitResult } from "./selection.types";

export class SelectionOperation {
  private pending: AbortController | null = null;
  private cancelled: (() => void) | null = null;
  outline: ClipMask | null = null;

  constructor(
    private readonly options: {
      changed: () => void;
      report: (error: unknown) => void;
      pending: () => void;
    },
  ) {}

  get busy() {
    return this.pending !== null;
  }

  cancel() {
    this.pending?.abort();
    this.pending = null;
    this.outline = null;

    const cancelled = this.cancelled;

    this.cancelled = null;
    cancelled?.();
  }

  run<T>(
    prepare: (signal: AbortSignal) => T | Promise<T>,
    accept: (value: T) => void,
    finish: (result: SelectionCommitResult) => void = () => {},
    outline: ClipMask | null = null,
    signal?: AbortSignal,
  ) {
    if (signal?.aborted) {
      finish({ status: "cancelled" });

      return;
    }

    const pending = new AbortController();

    const abort = () => {
      if (this.pending !== pending) return;

      this.cancel();
      this.options.changed();
    };

    const settle = (result: SelectionCommitResult) => {
      signal?.removeEventListener("abort", abort);
      finish(result);
    };

    this.pending = pending;
    this.cancelled = () => settle({ status: "cancelled" });
    signal?.addEventListener("abort", abort, { once: true });

    const complete = (success: boolean, value?: T, error?: unknown) => {
      if (this.pending !== pending || pending.signal.aborted) return;

      this.pending = null;
      this.cancelled = null;
      this.outline = null;

      if (success) {
        try {
          accept(value as T);
        } catch (failure) {
          success = false;
          error = failure;
        }
      }

      if (success) settle({ status: "committed" });
      else {
        const reason = Messages.from(
          error,
          Messages.create("couldNotProcessTheSelection"),
        );

        settle({ status: "rejected", reason });
        this.options.report(reason);
      }

      this.options.changed();
    };

    try {
      const result = prepare(pending.signal);

      if (result && typeof (result as Promise<T>).then === "function") {
        if (this.pending === pending && !pending.signal.aborted) {
          this.outline = outline;
          this.options.pending();
          this.options.changed();
        }

        void Promise.resolve(result).then(
          (value) => complete(true, value),
          (error) => complete(false, undefined, error),
        );
      } else complete(true, result as T);
    } catch (error) {
      complete(false, undefined, error);
    }
  }
}
