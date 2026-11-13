export type TaskClock = {
  schedule: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof setTimeout>;
  cancel: (handle: ReturnType<typeof setTimeout> | undefined) => void;
};
export const TaskClock = {
  schedule: (callback: () => void, delay: number) =>
    setTimeout(callback, delay),
  cancel: (handle: ReturnType<typeof setTimeout> | undefined) =>
    clearTimeout(handle),
};
