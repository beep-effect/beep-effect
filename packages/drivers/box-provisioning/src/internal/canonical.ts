import { createHash } from "node:crypto";
import { Sha256Hex } from "@beep/schema";
import { Order } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

type CanonicalEntry = readonly [key: string, value: unknown];

const byKeyAscending = Order.mapInput(Order.String, ([key]: CanonicalEntry) => key);

const canonicalJson = (value: unknown): string => {
  if (P.isNull(value) || P.isString(value) || P.isNumber(value) || P.isBoolean(value)) {
    return JSON.stringify(value);
  }
  if (A.isArray(value)) {
    return `[${A.join(A.map(value, canonicalJson), ",")}]`;
  }
  if (P.isObject(value)) {
    const entries = A.sort(R.toEntries(value), byKeyAscending);
    return `{${A.join(
      A.map(entries, ([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`),
      ","
    )}}`;
  }
  return "null";
};

export const digestEncoded = (value: unknown): Sha256Hex => {
  const json = S.decodeUnknownSync(S.Json)(value);
  return Sha256Hex.make(createHash("sha256").update(canonicalJson(json), "utf8").digest("hex"));
};

export const digestText = (value: string): Sha256Hex =>
  Sha256Hex.make(createHash("sha256").update(value, "utf8").digest("hex"));
