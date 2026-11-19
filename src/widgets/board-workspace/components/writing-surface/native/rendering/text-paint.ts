import { BoardConstants, BoardText, type TextItem } from "~/entities/board";
import { Messages } from "~/shared/lib/messages";
import { Theme, type ThemeTypes } from "~/shared/lib/theme";
import type { RenderingContext } from "./rendering-context.types";

const font = `${BoardText.fontSize}px "Segoe UI", system-ui, sans-serif`;

function display(text: string) {
  return text.replace(/\n$/, "").replace(/\t/g, "    ");
}

function layout(
  context: Pick<RenderingContext, "font" | "measureText" | "save" | "restore">,
  value: string,
  width: number,
): Pick<TextItem, "text" | "width" | "lines"> {
  const text = value.replace(/\r\n?/g, "\n");

  if (text.length > BoardText.maxLength)
    throw Messages.error(Messages.create("boardTextTooLong"));

  if (!text.trim()) throw Messages.error(Messages.create("boardTextEmpty"));

  const lines: number[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let offset = 0;

  const append = (position: number) => {
    if (lines.length === BoardText.maxLines)
      throw Messages.error(Messages.create("boardTextTooManyLines"));

    lines.push(position);
  };

  context.save();

  try {
    context.font = font;

    for (const paragraph of text.split("\n")) {
      append(offset);

      const parts = Array.from(segmenter.segment(paragraph));
      let start = 0;

      while (start < parts.length) {
        let next = start + 1;
        let preferred = next;

        while (next < parts.length) {
          const end = parts[next + 1]?.index ?? paragraph.length;
          const candidate = paragraph.slice(parts[start]!.index, end);

          if (context.measureText(display(candidate)).width > width) break;

          if (/\s/u.test(parts[next]!.segment)) preferred = next + 1;

          next++;
        }

        if (next === parts.length) break;

        if (preferred > start + 1) next = preferred;

        append(offset + parts[next]!.index);
        start = next;
      }

      offset += paragraph.length + 1;
    }
  } finally {
    context.restore();
  }

  return { text, width, lines };
}

function paint(
  context: RenderingContext,
  item: TextItem,
  theme: ThemeTypes.Effective,
) {
  context.globalAlpha = 1;
  context.fillStyle = Theme.color(BoardConstants.INK, theme);
  context.font = font;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.direction = "ltr";

  for (let row = 0; row < item.lines.length; row++) {
    const start = item.lines[row]!;
    const content = display(item.text.slice(start, item.lines[row + 1]));

    if (content)
      context.fillText(
        content,
        0,
        row * BoardText.lineHeight + BoardText.fontSize,
        item.width,
      );
  }
}

export const TextPaint = { layout, paint };
