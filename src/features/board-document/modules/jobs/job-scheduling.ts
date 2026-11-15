import { Messages } from "~/shared/lib/messages";

function abortError() {
  return Object.assign(
    new DOMException(
      Messages.plain(Messages.create("actionCancelled")),
      "AbortError",
    ),
    { detail: Messages.create("actionCancelled") },
  );
}

async function yieldTask(): Promise<void> {
  const scheduler = globalThis.scheduler;

  if (scheduler?.yield) await scheduler.yield();
  else await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export const JobScheduling = { abortError, yieldTask };
