import type { ClipMask } from "../board.types";

export class SelectionOperation {
  private pending: AbortController | null = null;
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
  }

  run<T>(
    prepare: (signal: AbortSignal) => T | Promise<T>,
    accept: (value: T) => void,
    finish: (success: boolean) => void = () => {},
    outline: ClipMask | null = null,
  ) {
    const pending = new AbortController();

    this.pending = pending;

    const complete = (success: boolean, value?: T, error?: unknown) => {
      if (this.pending !== pending || pending.signal.aborted) return;

      this.pending = null;
      this.outline = null;

      if (success) {
        try {
          accept(value as T);
        } catch (failure) {
          success = false;
          error = failure;
        }
      }

      finish(success);

      if (!success) this.options.report(error);

      this.options.changed();
    };

    try {
      const result = prepare(pending.signal);

      if (result && typeof (result as Promise<T>).then === "function") {
        this.outline = outline;
        this.options.pending();
        this.options.changed();

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
