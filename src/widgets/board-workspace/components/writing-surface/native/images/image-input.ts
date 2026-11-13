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
  private input: HTMLInputElement;
  private pendingClaim: ImageInputTypes.PendingClaim | null = null;

  constructor(private readonly options: ImageInputTypes.Options) {
    this.input = document.createElement("input");
    this.input.type = "file";
    this.input.accept = "image/png,image/jpeg";
    this.input.hidden = true;
    this.input.setAttribute("aria-label", "Файл изображения");
    document.body.append(this.input);
    this.input.addEventListener("change", this.file);
    options.canvas.addEventListener("dragover", this.drag);
    options.canvas.addEventListener("drop", this.drop);
    window.addEventListener("paste", this.paste);
    window.addEventListener("blur", this.cancel);
  }

  get busy() {
    return this.pending;
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
      this.input.value = "";
      this.input.click();
    }
  };

  private readonly file = () => {
    const file = this.input.files?.[0];

    if (file) void this.insertFile(file);
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

  private readonly paste = (event: ClipboardEvent) => {
    if (!this.eventAllowed(event.target)) return;

    const file = Array.from(event.clipboardData?.items ?? [])
      .find((item) => item.kind === "file")
      ?.getAsFile();

    event.preventDefault();

    if (file) void this.insertFile(file);
    else this.options.pasteFragment();
  };

  async readClipboard() {
    if (!this.options.allowed() || this.pending) return;

    const generation = ++this.generation;

    try {
      if (!navigator.clipboard?.read)
        throw new Error("Чтение системного буфера недоступно.");

      const items = await navigator.clipboard.read();

      if (
        this.disposed ||
        generation !== this.generation ||
        !this.options.allowed()
      )
        return;

      const item = items.find(
        (item) =>
          item.types.includes("image/png") || item.types.includes("image/jpeg"),
      );

      if (!item)
        throw new Error(
          "В системном буфере нет PNG или JPEG. Для фрагмента доски используйте «Вставить».",
        );

      const blob = await item.getType(
        item.types.includes("image/png") ? "image/png" : "image/jpeg",
      );

      if (
        this.disposed ||
        generation !== this.generation ||
        !this.options.allowed()
      )
        return;

      await this.insertFile(blob);
    } catch (error) {
      if (!this.disposed && generation === this.generation)
        this.options.notice(
          error instanceof Error
            ? error.message
            : "Нет доступа к системному буферу.",
        );
    }
  }

  async insertFile(file: Blob, point?: Position) {
    if (!this.options.allowed() || this.pending) return;

    const generation = ++this.generation;

    this.pending = true;
    this.options.changed();

    let claim: ImageInputTypes.PendingClaim | null = null;

    try {
      if (file.size > ImageAssets.LIMITS.bytes)
        throw new Error("Изображение превышает 8 MiB.");

      const bytes = new Uint8Array(await file.arrayBuffer()),
        header = ImageAssets.inspect(bytes);

      if (
        this.disposed ||
        generation !== this.generation ||
        !this.options.allowed()
      )
        return;

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
        throw new Error("Некорректный тип изображения.");

      const assetClaim = this.options.images.claim(reconciled.asset);

      claim = {
        release: () =>
          assetClaim.release(
            this.options.scene.strokes.some(
              (item) =>
                item.kind === "image" && item.asset === reconciled.asset,
            ),
          ),
      };

      this.pendingClaim = claim;
      await assetClaim.ready;

      if (
        this.disposed ||
        generation !== this.generation ||
        !this.options.allowed()
      )
        return;

      const rect = this.options.canvas.getBoundingClientRect(),
        viewport = this.options.viewport(),
        center =
          point ??
          BoardViewport.screenToWorld(
            { x: rect.width / 2, y: rect.height / 2 },
            viewport,
          );

      const scale = Math.min(
        1,
        (rect.width * 0.7) / viewport.zoom / header.width,
        (rect.height * 0.7) / viewport.zoom / header.height,
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

      const insertedSuccessfully = await this.options.insert([inserted]);

      if (
        !this.disposed &&
        generation === this.generation &&
        insertedSuccessfully !== false
      )
        this.options.notice("");
    } catch (error) {
      if (!this.disposed && generation === this.generation)
        this.options.notice(
          error instanceof Error
            ? error.message
            : "Не удалось вставить изображение.",
        );
    } finally {
      claim?.release();

      if (this.pendingClaim === claim) this.pendingClaim = null;

      if (!this.disposed && generation === this.generation) {
        this.pending = false;
        this.options.changed();
      }
    }
  }

  readonly cancel = () => {
    const pending = this.pending;

    this.generation++;
    this.pendingClaim?.release();
    this.pendingClaim = null;
    this.pending = false;

    if (pending) this.options.changed();
  };

  dispose() {
    this.disposed = true;
    this.cancel();
    this.input.removeEventListener("change", this.file);
    this.input.remove();
    this.options.canvas.removeEventListener("dragover", this.drag);
    this.options.canvas.removeEventListener("drop", this.drop);
    window.removeEventListener("paste", this.paste);
    window.removeEventListener("blur", this.cancel);
  }
}
