import {
  DocumentJobs,
  FragmentCodec,
  FragmentReader,
} from "~/features/board-document";
import { BoardPNG } from "../rendering";
import type { BoardClipboardTypes } from "./board-clipboard.types";

export class BoardClipboard {
  private readonly jobs = new DocumentJobs();
  private pending: AbortController | null = null;
  private disposed = false;
  private requiresWrite = false;
  private copying: AbortController | null = null;
  private queuedPaste: AbortController | null = null;

  constructor(private readonly options: BoardClipboardTypes.Options) {
    window.addEventListener("copy", this.copyEvent);
    window.addEventListener("cut", this.cutEvent);
    window.addEventListener("paste", this.pasteEvent);
  }

  get busy() {
    return this.pending !== null;
  }

  private eventAllowed(event: ClipboardEvent, queueAfterCopy = false) {
    const target = event.target;

    return (
      (this.options.allowed() ||
        (queueAfterCopy &&
          this.copying === this.pending &&
          this.pending !== null &&
          this.options.writable())) &&
      target instanceof Element &&
      !target.closest("input,textarea,select,[contenteditable],dialog") &&
      (target === this.options.canvas ||
        target === document.body ||
        Boolean(target.closest("[data-board-selection-toolbar]")))
    );
  }

  private readonly copyEvent = (event: ClipboardEvent) => {
    if (this.eventAllowed(event)) {
      event.preventDefault();
      void this.copy(false);
    }
  };

  private readonly cutEvent = (event: ClipboardEvent) => {
    if (this.eventAllowed(event)) {
      event.preventDefault();
      void this.copy(true);
    }
  };

  private readonly pasteEvent = (event: ClipboardEvent) => {
    if (!this.eventAllowed(event, true)) return;

    event.preventDefault();

    const file = Array.from(event.clipboardData?.items ?? [])
      .find(
        (item) =>
          item.kind === "file" &&
          ["image/png", "image/jpeg"].includes(item.type),
      )
      ?.getAsFile();

    const advertised = Array.from(event.clipboardData?.types ?? []);

    const ownAdvertised =
      advertised.includes(FragmentCodec.MIME) ||
      advertised.includes(FragmentCodec.MIME.replace(/^web /, ""));

    void this.paste(file ?? undefined, ownAdvertised);
  };

  private begin(message: string, writable = false) {
    if (
      this.disposed ||
      this.pending ||
      !this.options.allowed() ||
      (writable && !this.options.writable())
    )
      return null;

    const pending = new AbortController();

    this.pending = pending;
    this.requiresWrite = writable;
    this.notice(message);

    return pending;
  }

  private current(pending: AbortController, writable = false) {
    return (
      !this.disposed &&
      this.pending === pending &&
      !pending.signal.aborted &&
      this.options.allowed() &&
      (!writable || this.options.writable())
    );
  }

  private notice(message: string) {
    this.options.selection.message = message;
    this.options.changed();
  }

  private finish(pending: AbortController) {
    if (this.pending !== pending) return;

    this.pending = null;
    this.options.changed();
  }

  async copy(cut: boolean) {
    const capture = this.options.selection.capture();

    if (!capture) return;

    const pending = this.begin("Подготовка системного буфера…", cut);

    if (!pending) return;

    this.copying = pending;

    let copied = false;

    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write)
        throw new Error(
          "Запись редактируемого фрагмента недоступна. Исходные записи сохранены.",
        );

      const fragment = this.jobs.fragment(capture.fragment, pending.signal);

      const png = BoardPNG.fragmentPNG(fragment, pending.signal);

      void fragment.catch(() => {});
      void png.catch(() => {});

      // Both deferred representations belong to the same user-gesture write.
      const written = navigator.clipboard.write([
        new ClipboardItem({ [FragmentCodec.MIME]: fragment, "image/png": png }),
      ]);

      const results = await Promise.allSettled([fragment, png, written]);
      const rejected = results.find((result) => result.status === "rejected");

      if (rejected?.status === "rejected") throw rejected.reason;

      if (!this.current(pending, cut)) return;

      copied = true;

      if (cut) {
        const removed = await this.options.selection.removeCaptured(capture);

        if (!this.current(pending, true)) return;

        this.notice(
          removed
            ? "Фрагмент вырезан в системный буфер."
            : "Фрагмент скопирован, но доска или выделение изменились. Исходные записи сохранены.",
        );
      } else this.notice("Фрагмент скопирован в системный буфер.");
    } catch (error) {
      if (this.current(pending))
        this.notice(
          error instanceof Error
            ? `Не удалось записать редактируемый фрагмент. ${error.message} Исходные записи сохранены.`
            : "Не удалось записать фрагмент. Исходные записи сохранены.",
        );
    } finally {
      const queued = this.queuedPaste === pending;

      if (queued) this.queuedPaste = null;

      if (this.copying === pending) this.copying = null;

      this.finish(pending);

      if (
        queued &&
        copied &&
        !this.disposed &&
        !pending.signal.aborted &&
        this.options.allowed() &&
        this.options.writable()
      )
        await this.paste();
      else if (queued && !this.disposed)
        this.notice(`${this.options.selection.message} Вставка отменена.`);
    }
  }

  async paste(fallback?: Blob, ownAdvertised = false) {
    if (
      !this.disposed &&
      this.pending &&
      this.copying === this.pending &&
      this.options.writable()
    ) {
      this.queuedPaste = this.pending;
      this.notice("Вставка после завершения копирования…");

      return;
    }

    const pending = this.begin("Чтение системного буфера…", true);

    if (!pending) return;

    try {
      let blob: Blob | undefined,
        own = false;

      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();

        if (!this.current(pending, true)) return;

        const editable = items.find((item) =>
          item.types.includes(FragmentCodec.MIME),
        );

        if (editable) {
          blob = await editable.getType(FragmentCodec.MIME);
          own = true;
        } else {
          const image = items.find(
            (item) =>
              item.types.includes("image/png") ||
              item.types.includes("image/jpeg"),
          );

          if (image)
            blob = await image.getType(
              image.types.includes("image/png") ? "image/png" : "image/jpeg",
            );
        }
      } else {
        if (ownAdvertised)
          throw new Error(
            "Чтение редактируемого фрагмента недоступно. Разрешите системный буфер и повторите вставку.",
          );

        blob = fallback;
      }

      if (!this.current(pending, true)) return;

      if (!blob)
        throw new Error(
          typeof navigator.clipboard?.read === "function"
            ? "В буфере нет фрагмента Penable, PNG или JPEG."
            : "Чтение буфера недоступно. Вставьте PNG или JPEG сочетанием Ctrl+V.",
        );

      if (own) {
        const fragment = await FragmentReader.read(blob, pending.signal);

        if (!this.current(pending, true)) return;

        this.options.activate();

        const inserted = await this.options.selection.insertFragment(fragment);

        if (this.current(pending, true))
          this.notice(
            inserted
              ? "Фрагмент вставлен."
              : "Фрагмент не вставлен. Повторите действие.",
          );
      } else {
        await this.options.insertImage(blob);
      }
    } catch (error) {
      if (this.current(pending))
        this.notice(
          error instanceof Error && error.name === "NotAllowedError"
            ? "Нет доступа к системному буферу. Разрешите чтение и повторите вставку."
            : error instanceof Error
              ? error.message
              : "Не удалось прочитать системный буфер.",
        );
    } finally {
      this.finish(pending);
    }
  }

  async download() {
    const capture = this.options.selection.capture(),
      pending = capture && this.begin("Подготовка PNG…");

    if (!capture || !pending) return;

    try {
      const fragment = this.jobs.fragment(capture.fragment, pending.signal);
      const blob = await BoardPNG.fragmentPNG(fragment, pending.signal);

      if (this.current(pending)) {
        BoardPNG.downloadPNG(blob);
        this.notice("PNG подготовлен для скачивания.");
      }
    } catch (error) {
      if (this.current(pending))
        this.notice(
          error instanceof Error ? error.message : "Не удалось создать PNG.",
        );
    } finally {
      this.finish(pending);
    }
  }

  permissionChanged() {
    if (this.pending && this.requiresWrite && !this.options.writable())
      this.cancel();
  }

  cancel() {
    const pending = this.pending;
    const queued = pending !== null && this.queuedPaste === pending;

    this.copying = null;
    this.queuedPaste = null;

    this.pending?.abort();
    this.pending = null;
    this.jobs.cancel();

    if (pending && !this.disposed)
      this.notice(
        queued
          ? "Копирование и ожидающая вставка отменены."
          : "Операция с буфером отменена.",
      );
  }

  dispose() {
    this.disposed = true;
    this.cancel();
    window.removeEventListener("copy", this.copyEvent);
    window.removeEventListener("cut", this.cutEvent);
    window.removeEventListener("paste", this.pasteEvent);
    void this.jobs.close();
  }
}
