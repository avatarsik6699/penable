import { Messages } from "~/shared/lib/messages";

function serializeRawBackup(
  value: unknown,
  identities?: WeakMap<object, object>,
): string {
  const seen = new Set<object>();

  const compatible = (entry: unknown): boolean => {
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "boolean"
    )
      return true;

    if (typeof entry === "number") return Number.isFinite(entry);

    if (typeof entry !== "object") return false;

    const identity = identities?.get(entry) ?? entry;

    if (seen.has(identity)) return false;

    seen.add(identity);

    const array = Array.isArray(entry);
    const prototype = Object.getPrototypeOf(entry);

    if (
      array
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    )
      return false;

    const keys = Reflect.ownKeys(entry);

    if (array) {
      if (keys.length !== entry.length + 1) return false;

      for (let index = 0; index < entry.length; index++)
        if (!Object.hasOwn(entry, index)) return false;
    }

    for (const key of keys) {
      if (array && key === "length") continue;

      if (typeof key !== "string") return false;

      const descriptor = Object.getOwnPropertyDescriptor(entry, key);

      if (
        !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, "value") ||
        !compatible(descriptor.value)
      )
        return false;
    }

    return true;
  };

  try {
    if (!compatible(value)) throw Messages.error("unsupported");

    return JSON.stringify(value);
  } catch {
    throw Messages.error(
      Messages.create("theOriginalRecordCannotBeRepresentedAs"),
    );
  }
}

export const BackupSerializer = { serializeRawBackup };
