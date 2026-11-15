import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18n } from "~/shared/lib/i18n";
import { Messages } from "~/shared/lib/messages";
import type { MessageTypes } from "~/shared/lib/messages";
import { useAppearanceEditor } from "./use-appearance-editor";

const hooks = vi.hoisted(() => ({ states: [] as unknown[] }));

// Exercise the actual asynchronous save/catch boundary without a DOM renderer.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,

    useState: (initial: unknown) => {
      const index = hooks.states.length;

      hooks.states.push(initial);

      return [
        initial,
        (value: unknown) => {
          hooks.states[index] = value;
        },
      ];
    },

    useRef: (initial: unknown) => ({ current: initial }),

    useEffect: (effect: () => unknown) => {
      effect();
    },
  };
});

beforeEach(async () => {
  hooks.states.length = 0;
  await I18n.initialize("en");
  await I18n.instance.changeLanguage("en");
});

describe("appearance save error ownership", () => {
  it("retains a failed save descriptor so the visible error can change language", async () => {
    const failure = Messages.create("couldNotSaveAppearance");
    const onReturn = vi.fn();

    const editor = useAppearanceEditor({
      id: "main",
      title: "My notes",
      appearance: { color: "blue", icon: "notebook" },
      disabled: false,
      onSave: vi.fn(async () => {
        throw Messages.error(failure);
      }),
      onReturn,
    });

    await editor.save();

    expect(onReturn).not.toHaveBeenCalled();
    expect(hooks.states[1]).toBe(false);
    expect(hooks.states[2]).toEqual({ code: "couldNotSaveAppearance" });

    const retained = hooks.states[2] as MessageTypes.Value;

    expect(I18n.text(retained)).toBe("Could not save appearance.");
    await I18n.instance.changeLanguage("ru");
    expect(I18n.text(retained)).toBe("Не удалось сохранить оформление.");
  });
});
