function abortError() {
  return new DOMException("Действие отменено.", "AbortError");
}

async function yieldTask(): Promise<void> {
  const scheduler = globalThis.scheduler;

  if (scheduler?.yield) await scheduler.yield();
  else await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export const JobScheduling = { abortError, yieldTask };
