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
      message:
        "Запись недоступна: браузер не поддерживает блокировку вкладок. Используйте актуальный Chrome или Edge.",

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
            message:
              "Доска открыта в другой вкладке. Здесь только просмотр. Закройте её и повторите подключение.",

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
