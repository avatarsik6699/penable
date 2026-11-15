import { Messages } from "~/shared/lib/messages";

export const StorageStatusConfig = {
  labels: {
    loading: Messages.create("loading"),
    dirty: Messages.create("unsavedChanges"),
    saving: Messages.create("saving"),
    saved: Messages.create("savedLocally"),
    error: Messages.create("couldNotSave"),
  },
};
