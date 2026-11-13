export {};
declare global {
  var scheduler: { yield?: () => Promise<void> } | undefined;
}
