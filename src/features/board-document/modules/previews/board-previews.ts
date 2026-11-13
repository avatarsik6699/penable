import type { BoardPreviewsTypes } from "./board-previews.types";

export class BoardPreviews {
  private readonly cache = new Map<string, BoardPreviewsTypes.Preview>();
  private readonly failed = new Set<string>();
  private visible = new Set<string>();
  private pending: { id: string; abort: AbortController } | null = null;
  private tail: Promise<void> = Promise.resolve();
  private disposed = false;
  private opened = false;

  constructor(private readonly options: BoardPreviewsTypes.Options) {}

  get urls(): Readonly<Record<string, string>> {
    return Object.fromEntries(
      [...this.cache].map(([id, value]) => [id, value.url]),
    );
  }

  show(ids: readonly string[]) {
    if (this.disposed) return;

    this.opened = true;
    this.visible = new Set(ids);

    for (const id of ids) {
      const value = this.cache.get(id);

      if (value) {
        this.cache.delete(id);
        this.cache.set(id, value);
      }
    }

    if (this.pending && !this.visible.has(this.pending.id))
      this.pending.abort.abort();

    this.pump();
  }

  close() {
    this.opened = false;
    this.visible.clear();
    this.failed.clear();
    this.pending?.abort.abort();
  }

  invalidate(id: string) {
    this.cache.get(id)?.release();
    this.cache.delete(id);
    this.failed.delete(id);

    if (this.pending?.id === id) this.pending.abort.abort();

    this.options.changed();
    this.pump();
  }

  private pump() {
    if (this.disposed || !this.opened || this.pending) return;

    const id = [...this.visible].find(
      (id) => !this.cache.has(id) && !this.failed.has(id),
    );

    if (!id) return;

    const pending = { id, abort: new AbortController() };

    this.pending = pending;

    this.tail = (async () => {
      let preview: BoardPreviewsTypes.Preview | null = null;

      try {
        const document = await this.options.load(id, pending.abort.signal);

        if (pending.abort.signal.aborted) return;

        preview = await this.options.render(document, pending.abort.signal);

        if (
          this.disposed ||
          pending.abort.signal.aborted ||
          !this.visible.has(id)
        )
          return;

        if (
          !Number.isFinite(preview.bytes) ||
          preview.bytes < 0 ||
          preview.bytes > 8 * 1024 * 1024
        ) {
          this.failed.add(id);

          return;
        }

        this.cache.set(id, preview);
        preview = null;

        while (
          this.cache.size > 32 ||
          [...this.cache.values()].reduce((sum, item) => sum + item.bytes, 0) >
            8 * 1024 * 1024
        ) {
          const oldest = this.cache.keys().next().value!;

          this.cache.get(oldest)!.release();
          this.cache.delete(oldest);

          if (this.visible.has(oldest)) this.failed.add(oldest);
        }

        this.options.changed();
      } catch {
        if (!pending.abort.signal.aborted) this.failed.add(id);
      } finally {
        preview?.release();

        if (this.pending === pending) this.pending = null;

        this.pump();
      }
    })();
  }

  async dispose() {
    this.disposed = true;
    this.close();
    await this.tail;

    for (const value of this.cache.values()) value.release();

    this.cache.clear();
  }
}
