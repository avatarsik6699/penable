import type { ChangeEvent } from "react";
export type DocumentFile = Pick<File, "size" | "text">;
function fromInput(
  event: ChangeEvent<HTMLInputElement>,
): DocumentFile | undefined {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  return file;
}
export const StorageFiles = { fromInput };
export type StorageInput = HTMLInputElement;
