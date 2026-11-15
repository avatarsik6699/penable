import { Messages } from "~/shared/lib/messages";
import type { WriterLease } from "../board-document.types";

const WRITER_LOCK = "penable:board:main";

async function acquireWriterLease(
  manager: LockManager | undefined = typeof navigator !== "undefined"
    ? navigator.locks
    : undefined,
): Promise<WriterLease> {
  if (!manager)
    return {
      acquired: false,
      message: Messages.create("writingIsUnavailableThisBrowserCannotLock"),

      release: async () => {},
    };

  return new Promise<WriterLease>((resolve, reject) => {
    let releaseHold: () => void = () => {};

    const hold = new Promise<void>((done) => {
      releaseHold = done;
    });

    const request = manager.request(
      WRITER_LOCK,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (!lock) {
          resolve({
            acquired: false,
            message: Messages.create("thisBoardIsOpenInAnotherTab"),

            release: async () => {},
          });

          return;
        }

        resolve({
          acquired: true,
          message: "",

          release: async () => {
            releaseHold();
            await request;
          },
        });

        await hold;
      },
    );

    void request.catch(reject);
  });
}

export const DocumentWriterLease = { WRITER_LOCK, acquireWriterLease };
