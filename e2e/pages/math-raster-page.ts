import { expect, type Page } from "@playwright/test";
import type { TestBoardTypes } from "../data/board.types";

export class MathRasterPage {
  constructor(private readonly page: Page) {}

  async capturePreview() {
    return this.page
      .getByRole("img", { name: "Предварительный вид заготовки", exact: true })
      .evaluate((element) => new XMLSerializer().serializeToString(element));
  }

  async expectPngAgreement(
    bytes: Buffer,
    svg: string,
    config: TestBoardTypes.TemplateItem["template"],
  ) {
    const comparison = await this.page.evaluate(
      async (input) => {
        const bytes = Uint8Array.from(atob(input.base64), (entry) =>
          entry.charCodeAt(0),
        );

        const png = await createImageBitmap(
          new Blob([bytes], { type: "image/png" }),
        );

        const canvas = document.createElement("canvas");

        canvas.width = png.width;
        canvas.height = png.height;

        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

        ctx.drawImage(png, 0, 0);
        png.close();

        const actual = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        const source = new DOMParser().parseFromString(
          input.svg,
          "image/svg+xml",
        ).documentElement;

        const padding = input.config.lineWidth / 2;

        source.setAttribute("width", String(canvas.width));
        source.setAttribute("height", String(canvas.height));

        source.setAttribute(
          "viewBox",
          `${-padding} ${-padding} ${input.config.width + padding * 2} ${input.config.height + padding * 2}`,
        );

        const url = URL.createObjectURL(
          new Blob([new XMLSerializer().serializeToString(source)], {
            type: "image/svg+xml",
          }),
        );

        try {
          const image = new Image();

          image.src = url;
          await image.decode();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0);

          const reference = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;

          let error = 0,
            mass = 0,
            ink = 0;

          for (let i = 3; i < actual.length; i += 4) {
            error += Math.abs(actual[i]! - reference[i]!);
            mass += Math.max(actual[i]!, reference[i]!);

            if (actual[i]! > 0) ink++;
          }

          return {
            ratio: error / Math.max(1, mass),
            ink,
            width: canvas.width,
            height: canvas.height,
          };
        } finally {
          URL.revokeObjectURL(url);
        }
      },
      { base64: bytes.toString("base64"), svg, config },
    );

    expect(comparison.ink).toBeGreaterThan(1000);

    // SVG and Canvas may differ at antialiased edges; geometry and lettering must agree.
    expect(comparison.ratio, JSON.stringify(comparison)).toBeLessThanOrEqual(
      0.005,
    );
  }
}
