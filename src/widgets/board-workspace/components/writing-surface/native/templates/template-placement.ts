import { Messages } from "~/shared/lib/messages";
import {
  BoardTemplates,
  BoardViewport,
  type TemplateConfig,
  type TemplateItem,
} from "~/entities/board";
import type { TemplatePlacementOptions } from "./template-placement.types";

export class TemplatePlacement {
  private item: TemplateItem | null = null;
  private client: {
    x: number;
    y: number;
  } | null = null;

  constructor(private readonly options: TemplatePlacementOptions) {}

  get active() {
    return this.item !== null;
  }

  arm(config: TemplateConfig, explicitSize = false) {
    if (!this.options.allowed()) return;

    const generatorVersion = BoardTemplates.version(config);
    const error = BoardTemplates.validate(config, generatorVersion);

    if (error) {
      this.options.notice(error);

      return;
    }

    const bounds = this.options.bounds(),
      viewport = this.options.viewport();

    const availableWidth = Math.max(40, bounds.width - 48),
      availableHeight = Math.max(40, bounds.height - 48);

    const scale =
      generatorVersion === 2
        ? 1 / viewport.zoom
        : explicitSize
          ? Math.min(
              1,
              availableWidth / (config.width * viewport.zoom),
              availableHeight / (config.height * viewport.zoom),
            )
          : Math.min(
              1,
              320 / Math.max(config.width, config.height),
              availableWidth / config.width,
              availableHeight / config.height,
            ) / viewport.zoom;

    this.item = {
      kind: "template",
      id: 1,
      generatorVersion,
      template: Object.freeze({ ...BoardTemplates.prepare(config) }),
      matrix: [scale, 0, 0, scale, 0, 0],
    };

    this.client = {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };

    this.refresh();
    this.options.notice(Messages.create("clickTheBoardToPlaceEscTo"));
  }

  move(clientX: number, clientY: number) {
    if (!this.item) return;

    this.client = { x: clientX, y: clientY };
    this.refresh();
  }

  refresh() {
    if (!this.item || !this.client) return;

    if (!this.options.allowed()) {
      this.cancel();

      return;
    }

    const bounds = this.options.bounds();

    const world = BoardViewport.screenToWorld(
      { x: this.client.x - bounds.left, y: this.client.y - bounds.top },
      this.options.viewport(),
    );

    const matrix = this.item.matrix;

    const anchor =
      this.item.generatorVersion === 2
        ? BoardTemplates.origin(this.item.template, 2)
        : { x: this.item.template.width / 2, y: this.item.template.height / 2 };

    this.item = {
      ...this.item,
      matrix: [
        matrix[0],
        0,
        0,
        matrix[3],
        world.x - anchor.x * matrix[0],
        world.y - anchor.y * matrix[3],
      ],
    };

    this.options.draw(this.item);
  }

  place(clientX: number, clientY: number) {
    if (!this.item || !this.options.allowed()) return false;

    this.move(clientX, clientY);

    const item = this.item;

    if (!item) return false;

    this.item = null;
    this.client = null;
    this.options.draw(null);
    this.options.notice("");

    const id = this.options.allocate();

    if (!Number.isSafeInteger(id) || id < 1) {
      this.options.notice(Messages.create("boardItemLimitReached"));

      return true;
    }

    void this.options
      .insert({ ...item, id })
      .catch(() =>
        this.options.notice(
          Messages.create("couldNotInsertTheTemplateTryAgain"),
        ),
      );

    return true;
  }

  cancel() {
    if (!this.item) return false;

    this.item = null;
    this.client = null;
    this.options.draw(null);
    this.options.notice("");

    return true;
  }
}
