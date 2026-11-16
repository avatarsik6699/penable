import { test as base } from "../fixtures";
import type {
  ImageInsertionFile,
  ImageWorkerGateState,
  ImageWorkerGateWindow,
} from "../data/image-insertion.types";
import { ImageInsertionPage } from "../pages/image-insertion-page";
import type { Page } from "@playwright/test";

type WorkerGate = {
  arm: () => Promise<void>;
  release: () => Promise<boolean>;
  state: () => Promise<ImageWorkerGateState>;
};

type Fixtures = {
  imageWorkerGate: WorkerGate;
  noisyImage: ImageInsertionFile;
  imageInsertion: ImageInsertionPage;
};

async function createNoisyPng(page: Page): Promise<ImageInsertionFile> {
  const image = await page.evaluate(() => {
    const canvas = Object.assign(document.createElement("canvas"), {
      width: 512,
      height: 512,
    });

    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 0x44c0ffee;

    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[offset] = seed >>> 24;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[offset + 1] = seed >>> 24;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[offset + 2] = seed >>> 24;
      pixels.data[offset + 3] = 255;
    }

    context.putImageData(pixels, 0, 0);

    return canvas.toDataURL("image/png").split(",")[1]!;
  });

  const bytes = Buffer.from(image, "base64").length;

  if (bytes <= 128 * 1024)
    throw new Error(
      `Noisy PNG must exceed 128 KiB after encoding; got ${bytes}`,
    );

  return {
    name: "image-insertion-noisy-512.png",
    mimeType: "image/png",
    base64: image,
    bytes,
  };
}

export const test = base.extend<Fixtures>({
  imageWorkerGate: [
    async ({ page }, provide) => {
      await page.addInitScript(() => {
        type GateState = {
          validateStarts: number;
          validateFinishes: number;
          terminalReplies: number;
          heldReplies: number;
          acknowledgements: number;
          chunks: number;
          jobIds: number[];
          workerCreations: number;
          validationWorkerIds: number[];
          held: boolean;
        };

        type HeldReply = {
          worker: Worker;
          data: unknown;
          id: number;
        };

        const state: GateState = {
          validateStarts: 0,
          validateFinishes: 0,
          terminalReplies: 0,
          heldReplies: 0,
          acknowledgements: 0,
          chunks: 0,
          jobIds: [],
          workerCreations: 0,
          validationWorkerIds: [],
          held: false,
        };

        const validating = new WeakMap<Worker, Set<number>>();
        const NativeWorker = window.Worker;
        let nextWorkerId = 0;
        const workerIds = new WeakMap<Worker, number>();

        let armed = false,
          held: HeldReply | null = null,
          replaying = false;

        window.Worker = class extends NativeWorker {
          constructor(scriptURL: string | URL, options?: WorkerOptions) {
            super(scriptURL, options);
            workerIds.set(this, ++nextWorkerId);
            state.workerCreations++;

            this.addEventListener(
              "message",
              (event: MessageEvent) => {
                if (replaying) return;

                const data = event.data as {
                  id?: number;
                  ack?: number;
                  seq?: number;
                  chunk?: unknown;
                  error?: unknown;
                };

                const jobs = validating.get(this);

                if (data.ack !== undefined) state.acknowledgements++;

                if (data.chunk !== undefined) state.chunks++;

                if (
                  !Number.isInteger(data.id) ||
                  !jobs?.has(data.id!) ||
                  data.ack !== undefined ||
                  data.seq !== undefined ||
                  data.chunk !== undefined
                )
                  return;

                state.terminalReplies++;

                if (!armed) {
                  jobs.delete(data.id!);

                  return;
                }

                armed = false;
                state.held = true;
                state.heldReplies++;
                held = { worker: this, data, id: data.id! };
                event.stopImmediatePropagation();
              },
              { capture: true },
            );
          }

          override postMessage(
            message: unknown,
            transferOrOptions?: Transferable[] | StructuredSerializeOptions,
          ) {
            const request = message as {
              type?: string;
              kind?: string;
              id?: number;
            };

            if (request.type === "start" && request.kind === "validate") {
              const jobs = validating.get(this) ?? new Set<number>();

              jobs.add(request.id!);
              validating.set(this, jobs);
              state.validateStarts++;
              state.jobIds.push(request.id!);
              state.validationWorkerIds.push(workerIds.get(this)!);
            }

            if (
              request.type === "finish" &&
              validating.get(this)?.has(request.id!)
            )
              state.validateFinishes++;

            if (Array.isArray(transferOrOptions))
              super.postMessage(message, transferOrOptions);
            else super.postMessage(message, transferOrOptions);
          }
        };

        Object.defineProperty(window, "__imageInsertion44", {
          configurable: true,
          value: {
            arm: () => {
              if (held) throw new Error("A validation reply is already held");

              armed = true;
            },

            release: () => {
              if (!held) return false;

              const reply = held;

              held = null;
              state.held = false;
              validating.get(reply.worker)?.delete(reply.id);
              replaying = true;

              try {
                reply.worker.dispatchEvent(
                  new MessageEvent("message", { data: reply.data }),
                );
              } finally {
                replaying = false;
              }

              return true;
            },

            cleanup: () => {
              if (held) {
                const reply = held;

                held = null;
                state.held = false;
                validating.get(reply.worker)?.delete(reply.id);
                replaying = true;

                try {
                  reply.worker.dispatchEvent(
                    new MessageEvent("message", { data: reply.data }),
                  );
                } finally {
                  replaying = false;
                }
              }

              window.Worker = NativeWorker;
            },

            state: () => ({
              ...state,
              jobIds: [...state.jobIds],
              validationWorkerIds: [...state.validationWorkerIds],
            }),
          },
        });
      });

      try {
        await provide({
          arm: () =>
            page.evaluate(() => {
              const gate = (window as ImageWorkerGateWindow).__imageInsertion44;

              if (!gate) throw new Error("Image Worker gate is missing");

              gate.arm();
            }),
          release: () =>
            page.evaluate(
              () =>
                (
                  window as ImageWorkerGateWindow
                ).__imageInsertion44?.release() ?? false,
            ),
          state: () =>
            page.evaluate(() => {
              const gate = (window as ImageWorkerGateWindow).__imageInsertion44;

              if (!gate) throw new Error("Image Worker gate is missing");

              return gate.state();
            }),
        });
      } finally {
        await page.evaluate(() =>
          (window as ImageWorkerGateWindow).__imageInsertion44?.cleanup(),
        );
      }
    },
    { auto: true },
  ],

  noisyImage: async (
    { page, board: _board, imageWorkerGate: _gate },
    provide,
  ) => {
    await provide(await createNoisyPng(page));
  },

  imageInsertion: async (
    { page, board, noisyImage, imageWorkerGate },
    provide,
  ) => {
    const focusReturn = async (whileOutsideFocused?: () => Promise<void>) => {
      const outside = await page.context().newPage();

      try {
        await outside.goto("about:blank");
        await outside.bringToFront();
        await whileOutsideFocused?.();
      } finally {
        await outside.close();
        await page.bringToFront();
      }
    };

    await provide(
      new ImageInsertionPage(
        page,
        board,
        noisyImage,
        imageWorkerGate,
        focusReturn,
      ),
    );
  },
});

export { expect } from "@playwright/test";
