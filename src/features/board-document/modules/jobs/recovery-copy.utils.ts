import { DocumentSchema } from "../codec";

function plain(value: unknown): value is object {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function data(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return Boolean(descriptor && Object.hasOwn(descriptor, "value"));
}

function descriptors(value: object): PropertyDescriptorMap {
  return Object.getOwnPropertyDescriptors(value) as PropertyDescriptorMap;
}

function cloneArray(
  value: unknown[],
  properties = descriptors(value),
): unknown[] {
  return Object.defineProperties(new Array<unknown>(value.length), properties);
}

function matrix(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    return null;

  const properties = descriptors(value);

  if (!data(properties.length) || properties.length.value !== 6) return null;

  for (let index = 0; index < 6; index++) {
    const descriptor = properties[index];

    if (
      !data(descriptor) ||
      typeof descriptor.value !== "number" ||
      !Number.isFinite(descriptor.value)
    )
      return null;
  }

  return cloneArray(value, properties);
}

// IDB preserves the codec's shared identity matrix. Detach only that known wire field;
// every other descriptor/value remains available to the unchanged raw serializer.
function project(value: unknown): {
  value: unknown;
  identities: WeakMap<object, object>;
} {
  const identities = new WeakMap<object, object>();
  const unchanged = { value, identities };

  if (!plain(value)) return unchanged;

  const root = descriptors(value);

  if (
    !data(root.format) ||
    root.format.value !== "penable-board" ||
    !data(root.schemaVersion) ||
    !DocumentSchema.itemDocument(root.schemaVersion.value) ||
    !data(root.items)
  )
    return unchanged;

  const items = root.items.value;

  if (
    !Array.isArray(items) ||
    Object.getPrototypeOf(items) !== Array.prototype ||
    items.length > 20000
  )
    return unchanged;

  const entries = descriptors(items);
  const projected = new Map<object, object>();
  let changed = false;

  for (let index = 0; index < items.length; index++) {
    const descriptor = entries[index];

    if (!data(descriptor) || !plain(descriptor.value)) continue;

    const item = descriptor.value;
    const cached = projected.get(item);

    if (cached) {
      descriptor.value = cached;
      changed = true;
      continue;
    }

    const properties = descriptors(item);

    if (
      !data(properties.kind) ||
      !["ink", "image", "template", "text"].includes(
        properties.kind.value as string,
      ) ||
      !data(properties.matrix)
    )
      continue;

    const detached = matrix(properties.matrix.value);

    if (!detached) continue;

    properties.matrix.value = detached;

    const copy = Object.create(
      Object.getPrototypeOf(item),
      properties,
    ) as object;

    projected.set(item, copy);
    identities.set(copy, item);
    descriptor.value = copy;
    changed = true;
  }

  if (!changed) return unchanged;

  const copiedItems = cloneArray(items, entries);

  identities.set(copiedItems, items);
  root.items.value = copiedItems;

  const copy = Object.create(Object.getPrototypeOf(value), root) as object;

  identities.set(copy, value);

  return { value: copy, identities };
}

function schemaVersion(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;

  const descriptor = Object.getOwnPropertyDescriptor(value, "schemaVersion");

  return data(descriptor) ? descriptor.value : undefined;
}

export const RecoveryCopyProjection = { project, schemaVersion };
