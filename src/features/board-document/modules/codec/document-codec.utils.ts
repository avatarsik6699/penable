import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { CodecConfig } from "./document-codec.config";

function invalid(field: MessageTypes.Value): never {
  throw Messages.error(Messages.create("invalidDataValue", { p0: field }));
}

function object(
  value: unknown,
  field: MessageTypes.Value,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid(field);

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null)
    return invalid(field);

  for (const key of ["__proto__", "constructor", "prototype"]) {
    if (Object.hasOwn(value, key)) return invalid(`${field}.${key}`);
  }

  return value as Record<string, unknown>;
}

function own(value: Record<string, unknown>, key: string): unknown {
  if (!Object.hasOwn(value, key)) return invalid(key);

  return value[key];
}

function number(
  value: unknown,
  min: number,
  max: number,
  field: MessageTypes.Value,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    return invalid(field);

  return value;
}

function coordinate(value: unknown, field: MessageTypes.Value) {
  return number(
    value,
    -CodecConfig.COORDINATE_LIMIT,
    CodecConfig.COORDINATE_LIMIT,
    field,
  );
}

export const CodecPrimitives: {
  invalid: typeof invalid;
  object: typeof object;
  number: typeof number;
  own: typeof own;
  coordinate: typeof coordinate;
} = { invalid, object, number, own, coordinate };
