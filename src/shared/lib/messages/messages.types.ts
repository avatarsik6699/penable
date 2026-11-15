import type { EnglishMessages } from "./catalogs/en";

export namespace MessageTypes {
  export type Code = keyof typeof EnglishMessages;

  export type Parameter =
    Value | number | boolean | null | readonly Parameter[];

  export type Params = Readonly<Record<string, Parameter>>;

  export type Descriptor = Readonly<{ code: Code; params?: Params }>;

  export type Value = string | Descriptor;
}
