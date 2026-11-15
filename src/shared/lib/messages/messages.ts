import { EnglishMessages } from "./catalogs/en";
import { RussianMessages } from "./catalogs/ru";
import type { MessageTypes } from "./messages.types";

const russian: Record<MessageTypes.Code, string> = RussianMessages;

function create(
  code: MessageTypes.Code,
  params?: MessageTypes.Params,
): MessageTypes.Descriptor {
  return params ? { code, params } : { code };
}

function is(value: unknown): value is MessageTypes.Descriptor {
  return Boolean(
    value &&
    typeof value === "object" &&
    "code" in value &&
    typeof value.code === "string" &&
    Object.hasOwn(EnglishMessages, value.code),
  );
}

function parameter(value: MessageTypes.Parameter): string {
  if (Array.isArray(value)) return value.map(parameter).join("");

  if (is(value)) return plain(value);

  return String(value ?? "");
}

// Canonical Russian diagnostic text preserves existing error matching; user-facing
// presentation always resolves the descriptor using the active interface language.
function plain(value: MessageTypes.Value): string {
  if (typeof value === "string") return value;

  return russian[value.code].replace(/{{(\w+)}}/g, (_, key: string) =>
    parameter(value.params?.[key] ?? ""),
  );
}

class MessageError extends Error {
  readonly detail: MessageTypes.Value;

  constructor(value: MessageTypes.Value) {
    super(plain(value));
    this.detail = value;
  }
}

function from(
  value: unknown,
  fallback: MessageTypes.Value = create("unknownStorageError"),
): MessageTypes.Value {
  if (value instanceof MessageError) return value.detail;

  if (
    value &&
    typeof value === "object" &&
    "detail" in value &&
    is(value.detail)
  )
    return value.detail;

  if (is(value)) return value;

  if (value instanceof Error) return value.message;

  if (typeof value === "string") return value;

  return fallback;
}

function error(value: MessageTypes.Value): Error {
  return new MessageError(value);
}

function concat(...parts: MessageTypes.Value[]): MessageTypes.Descriptor {
  return create("joinedMessage", { parts });
}

export const Messages = {
  create,
  is,
  from,
  error,
  concat,
  plain,
  resources: { en: EnglishMessages, ru: RussianMessages },
};
