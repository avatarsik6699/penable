import { I18n } from "~/shared/lib/i18n";
import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import {
  BoardIds,
  BoardViewport,
  type Position,
  type BoardItem,
} from "~/entities/board";
import { ImageAssets } from "~/features/board-document";
import type { ImageInputTypes } from "./image-input.types";

export class ImageInput {
  private generation = 0;
  private disposed = false;
  private pending = false;
  private controller: AbortController | null = null;
  status: {
    phase: "idle" | "choosing" | "processing" | "success" | "error";
    message: MessageTypes.Value;
  } = { phase: "idle", message: "" };
  private input: HTMLInputElement;
  private pendingClaim: ImageInputTypes.PendingClaim | null = null;

  private stopLanguage = () => {};

  constructor(private readonly options: ImageInputTypes.Options) {
    this.input = document.createElement("input");
    this.input.type = "file";
    this.input.accept = "image/png,image/jpeg";
    this.input.hidden = true;
    this.input.setAttribute("aria-label", I18n.t("imageFile"));

    this.stopLanguage = I18n.bind(() =>
      this.input.setAttribute("aria-label", I18n.t("imageFile")),
    );

    document.body.append(this.input);
    this.input.addEventListener("change", this.file);
    options.canvas.addEventListener("dragover", this.drag);
    options.canvas.addEventListener("drop", this.drop);
    this.input.addEventListener("cancel", this.pickerCancelled);
  }

  get busy() {
    return this.pending || this.status.phase === "choosing";
  }

  private eventAllowed(target: EventTarget | null) {
    return (
      this.options.allowed() &&
      target instanceof Element &&
      !target.closest(
        "input,textarea,select,[contenteditable],dialog,[data-editor-chrome]",
      ) &&
      (target === this.options.canvas || target === document.body)
    );
  }

  readonly open = () => {
    if (this.options.allowed() && !this.pending) {
      this.status = {
        phase: "choosing",
        message: Messages.create("choosePngOrJpeg"),
      };

      this.options.changed();
      this.input.value = "";
      this.input.click();
    }
  };

  private readonly file = () => {
    const file = this.input.files?.[0];

    if (file) void this.insertFile(file);
    else this.pickerCancelled();
  };

  private readonly pickerCancelled = () => {
    if (this.status.phase === "choosing") {
      this.status = { phase: "idle", message: "" };
      this.options.changed();
    }
  };

  private readonly drag = (event: DragEvent) => {
    if (
      this.eventAllowed(event.target) &&
      event.dataTransfer?.types.includes("Files")
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  private readonly drop = (event: DragEvent) => {
    if (!this.eventAllowed(event.target)) return;

    const file = event.dataTransfer?.files[0];

    if (!file) return;

    event.preventDefault();

    const rect = this.options.canvas.getBoundingClientRect();

    void this.insertFile(
      file,
      BoardViewport.screenToWorld(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        this.options.viewport(),
      ),
    );
  };

  async insertFile(file: Blob, point?: Position) {
    if (!this.options.allowed() || this.pending) return;

    const generation = ++this.generation;
    const controller = new AbortController();

    this.controller = controller;

    this.pending = true;

    this.status = {
      phase: "processing",
      message: Messages.create("processingImage"),
    };

    this.options.changed();

    let claim: ImageInputTypes.PendingClaim | null = null;

    try {
      if (file.size > ImageAssets.LIMITS.bytes)
        throw Messages.error(Messages.create("imageExceeds8Mib"));

      const bytes = new Uint8Array(await file.arrayBuffer()),
        header = ImageAssets.inspect(bytes);

      if (
        this.disposed ||
        controller.signal.aborted ||
        generation !== this.generation
      )
        return;

      if (!this.options.allowed()) {
        this.cancel();

        return;
      }

      const base64 = ImageAssets.encodeBase64(bytes),
        asset = Object.freeze({
          id: `image-${crypto.randomUUID()}`,
          ...header,
          base64,
        });

      const item: BoardItem = {
        kind: "image",
        id: BoardIds.allocateStrokeId(this.options.scene.strokes),
        asset,
        matrix: [1, 0, 0, 1, 0, 0],
      };

      const reconciled = ImageAssets.reconcile(this.options.scene.strokes, [
        item,
      ])[0]!;

      ImageAssets.validateBoard(
        [...this.options.scene.strokes, reconciled],
        false,
      );

      if (reconciled.kind !== "image")
        throw Messages.error(Messages.create("invalidImageType"));

      const assetClaim = this.options.images.claim(reconciled.asset);

      let released = false;

      claim = {
        release: () => {
          if (released) return;

          released = true;

          assetClaim.release(
            this.options.scene.strokes.some(
              (item) =>
                item.kind === "image" && item.asset === reconciled.asset,
            ),
          );
        },
      };

      this.pendingClaim = claim;
      await assetClaim.ready;

      if (
        this.disposed ||
        controller.signal.aborted ||
        generation !== this.generation
      )
        return;

      if (!this.options.allowed()) {
        this.cancel();

        return;
      }

      const rect = this.options.canvas.getBoundingClientRect(),
        viewport = this.options.viewport(),
        dock = document
          .querySelector?.("[data-editor-dock]")
          ?.getBoundingClientRect(),
        top = Math.min(
          rect.height - 32,
          Math.max(16, (dock?.bottom ?? rect.top) - rect.top + 16),
        ),
        bottom = Math.max(top + 1, rect.height - 84),
        usableWidth = Math.max(1, rect.width - 32),
        usableHeight = Math.max(1, bottom - top),
        center =
          point ??
          BoardViewport.screenToWorld(
            { x: rect.width / 2, y: (top + bottom) / 2 },
            viewport,
          );

      const scale = Math.min(
        1,
        usableWidth / viewport.zoom / header.width,
        usableHeight / viewport.zoom / header.height,
      );

      const inserted = {
        ...reconciled,
        matrix: [
          scale,
          0,
          0,
          scale,
          center.x - (header.width * scale) / 2,
          center.y - (header.height * scale) / 2,
        ] as const,
      };

      const result = await this.options.insert([inserted], controller.signal);

      if (!this.disposed && generation === this.generation) {
        if (result.status === "cancelled") {
          this.status = { phase: "idle", message: "" };
        } else {
          this.status =
            result.status === "rejected"
              ? { phase: "error", message: result.reason }
              : {
                  phase: "success",
                  message: Messages.create("imageInsertedDragItOrResizeWith"),
                };

          this.options.notice(this.status.message);
        }
      }
    } catch (error) {
      if (!this.disposed && generation === this.generation) {
        this.status = {
          phase: "error",
          message:
            error instanceof Error
              ? Messages.from(error)
              : Messages.create("couldNotInsertTheImage"),
        };

        this.options.notice(this.status.message);
      }
    } finally {
      claim?.release();

      if (this.pendingClaim === claim) this.pendingClaim = null;

      if (!this.disposed && generation === this.generation) {
        this.controller = null;
        this.pending = false;
        this.options.changed();
      }
    }
  }

  readonly dismiss = () => {
    if (this.pending || this.status.phase === "choosing") return;

    this.status = { phase: "idle", message: "" };
    this.options.notice("");
    this.options.changed();
  };

  readonly cancel = () => {
    const pending = this.pending || this.status.phase === "choosing";

    this.generation++;
    this.controller?.abort();
    this.controller = null;
    this.pendingClaim?.release();
    this.pendingClaim = null;
    this.pending = false;
    this.status = { phase: "idle", message: "" };

    if (pending) this.options.changed();
  };

  dispose() {
    this.stopLanguage();
    this.disposed = true;
    this.cancel();
    this.input.removeEventListener("change", this.file);
    this.input.remove();
    this.options.canvas.removeEventListener("dragover", this.drag);
    this.options.canvas.removeEventListener("drop", this.drop);
    this.input.removeEventListener("cancel", this.pickerCancelled);
  }
}
