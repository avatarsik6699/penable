import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import {
  DocumentJobs,
  FragmentCodec,
  FragmentReader,
} from "~/features/board-document";
import {
  BoardRegions,
  BoardText,
  type SelectionClipboard,
} from "~/entities/board";
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

    const advertised = Array.from(event.clipboardData?.types ?? []);

    const ownAdvertised =
      advertised.includes(FragmentCodec.MIME) ||
      advertised.includes(FragmentCodec.MIME.replace(/^web /, ""));

    const text =
      advertised.includes("text/plain") &&
      advertised.every((type) =>
        ["text/plain", "text/html", "text/uri-list"].includes(type),
      )
        ? event.clipboardData?.getData("text/plain")
        : undefined;

    const file = ownAdvertised
      ? undefined
      : Array.from(event.clipboardData?.items ?? [])
          .find(
            (item) =>
              item.kind === "file" &&
              ["image/png", "image/jpeg"].includes(item.type),
          )
          ?.getAsFile();

    void this.paste(file ?? undefined, ownAdvertised, true, text);
  };

  private begin(message: MessageTypes.Value, writable = false) {
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

  private notice(message: MessageTypes.Value) {
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

    const pending = this.begin(
      Messages.create("preparingSystemClipboard"),
      cut,
    );

    if (!pending) return;

    this.copying = pending;

    let copied = false;

    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write)
        throw Messages.error(
          Messages.create(
            "editableFragmentWritingIsUnavailableOriginalContent",
          ),
        );

      const includePng = this.offersClipboardPng(capture.fragment);
      const fragment = this.jobs.fragment(capture.fragment, pending.signal);

      const png = includePng
        ? BoardPNG.fragmentPNG(fragment, pending.signal)
        : undefined;

      const representations: Record<string, Promise<Blob>> = {
        [FragmentCodec.MIME]: fragment,
      };

      if (png) representations["image/png"] = png;

      void fragment.catch(() => {});
      void png?.catch(() => {});

      // Write the negotiated representations in one user gesture.
      const written = navigator.clipboard.write([
        new ClipboardItem(representations),
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
            ? Messages.create(
                includePng
                  ? "fragmentCutToTheSystemClipboard"
                  : "tallTextFragmentCut",
              )
            : Messages.create("fragmentCopiedButTheBoardOrSelection"),
        );
      } else
        this.notice(
          Messages.create(
            includePng
              ? "fragmentCopiedToTheSystemClipboard"
              : "tallTextFragmentCopied",
          ),
        );
    } catch (error) {
      if (this.current(pending))
        this.notice(
          error instanceof Error
            ? Messages.create("couldNotWriteTheEditableFragmentValue", {
                p0: Messages.from(error),
              })
            : Messages.create("couldNotWriteTheFragmentOriginalContent"),
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
        this.notice(
          Messages.create("valuePasteCancelled", {
            p0: this.options.selection.message,
          }),
        );
    }
  }

  private offersClipboardPng(fragment: SelectionClipboard) {
    if (!fragment.strokes.some((item) => item.kind === "text")) return true;

    const bounds = fragment.region && BoardRegions.maskBounds(fragment.region);

    if (!bounds) return true;

    try {
      BoardPNG.pngDimensions(bounds, 0);

      return true;
    } catch {
      return false;
    }
  }

  async paste(
    fallback?: Blob,
    ownAdvertised = false,
    nativePaste = false,
    eventText?: string,
  ) {
    if (
      !this.disposed &&
      this.pending &&
      this.copying === this.pending &&
      this.options.writable()
    ) {
      this.queuedPaste = this.pending;
      this.notice(Messages.create("waitingForCopyingBeforePaste"));

      return;
    }

    const pending = this.begin(Messages.create("readingSystemClipboard"), true);

    if (!pending) return;

    try {
      if (eventText !== undefined) {
        await this.pasteText(eventText, pending);

        return;
      }

      let blob: Blob | undefined,
        own = false,
        plainText = false,
        unavailableOpaqueFormats = false;

      const read = navigator.clipboard?.read;

      if (read) {
        let attempt = 0;

        while (attempt < 2 && !blob) {
          attempt++;

          let opaque = false;

          try {
            const items = await read.call(navigator.clipboard);

            if (!this.current(pending, true)) return;

            const editable = items.find((item) =>
              item.types.includes(FragmentCodec.MIME),
            );

            if (editable) {
              blob = await editable.getType(FragmentCodec.MIME);
              own = true;
            } else {
              if (ownAdvertised)
                throw Messages.error(
                  Messages.create(
                    "editableFragmentReadingIsUnavailableAllowClipboard",
                  ),
                );

              const image = items.find(
                (item) =>
                  item.types.includes("image/png") ||
                  item.types.includes("image/jpeg"),
              );

              if (image)
                blob = await image.getType(
                  image.types.includes("image/png")
                    ? "image/png"
                    : "image/jpeg",
                );
              else {
                const text = items.find((item) =>
                  item.types.includes("text/plain"),
                );

                if (text) {
                  blob = await text.getType("text/plain");
                  plainText = true;
                } else
                  opaque =
                    items.length > 0 &&
                    items.every((item) => !item.types.length);
              }
            }

            if (!this.current(pending, true)) return;

            if (blob) break;

            if (opaque && nativePaste && fallback && attempt === 1) {
              blob = fallback;
              break;
            }

            if (opaque && attempt === 1) continue;

            if (opaque && attempt === 2) unavailableOpaqueFormats = true;

            break;
          } catch (error) {
            if (!this.current(pending, true)) return;

            const transient =
              error instanceof DOMException &&
              ["DataError", "InvalidStateError", "NotReadableError"].includes(
                error.name,
              );

            if (transient && attempt === 1) continue;

            throw error;
          }
        }
      } else {
        if (ownAdvertised)
          throw Messages.error(
            Messages.create(
              "editableFragmentReadingIsUnavailableAllowClipboard",
            ),
          );

        blob = fallback;
      }

      if (!this.current(pending, true)) return;

      if (!blob)
        throw Messages.error(
          unavailableOpaqueFormats || !read
            ? Messages.create("clipboardReadingIsUnavailablePasteAPng")
            : Messages.create("theClipboardContainsNoPenableFragmentPng"),
        );

      if (own) {
        const fragment = await FragmentReader.read(blob, pending.signal);

        if (!this.current(pending, true)) return;

        this.options.activate();

        const inserted = await this.options.selection.insertFragment(fragment);

        if (this.current(pending, true))
          this.notice(
            inserted
              ? Messages.create("fragmentPasted")
              : Messages.create("fragmentWasNotPastedTryTheAction"),
          );
      } else if (plainText) {
        if (blob.size > BoardText.maxLength * 4)
          throw Messages.error(Messages.create("boardTextTooLong"));

        const text = await blob.text();

        if (this.current(pending, true)) await this.pasteText(text, pending);
      } else {
        await this.options.insertImage(blob);
      }
    } catch (error) {
      if (this.current(pending))
        this.notice(
          error instanceof Error && error.name === "NotAllowedError"
            ? Messages.create("systemClipboardAccessDeniedAllowReadingAnd")
            : error instanceof Error
              ? Messages.from(error)
              : Messages.create("couldNotReadTheSystemClipboard"),
        );
    } finally {
      this.finish(pending);
    }
  }

  private async pasteText(value: string, pending: AbortController) {
    const result = await this.options.insertText(value, pending.signal);

    if (!this.current(pending, true) || result.status === "cancelled") return;

    this.notice(
      result.status === "committed"
        ? Messages.create("boardTextPasted")
        : result.reason,
    );
  }

  async download() {
    const capture = this.options.selection.capture(),
      pending = capture && this.begin(Messages.create("preparingPng"));

    if (!capture || !pending) return;

    try {
      const fragment = this.jobs.fragment(capture.fragment, pending.signal);
      const blob = await BoardPNG.fragmentPNG(fragment, pending.signal);

      if (this.current(pending)) {
        BoardPNG.downloadPNG(blob);
        this.notice(Messages.create("pngIsReadyToDownload"));
      }
    } catch (error) {
      if (this.current(pending))
        this.notice(
          error instanceof Error
            ? Messages.from(error)
            : Messages.create("couldNotCreatePng"),
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
          ? Messages.create("copyingAndPendingPasteCancelled")
          : Messages.create("clipboardOperationCancelled"),
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
