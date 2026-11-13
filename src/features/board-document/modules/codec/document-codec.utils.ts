import { CodecConfig } from "./document-codec.config";

function invalid(field: string): never {
  throw new Error(`Недопустимые данные: ${field}.`);
}

function object(value: unknown, field: string): Record<string, unknown> {
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
  field: string,
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

function coordinate(value: unknown, field: string) {
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
