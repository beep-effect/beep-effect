import { it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { decodeEntity } from "../../../effected/markdown/internal/entities.ts";

it.effect("rejects malformed references and replaces invalid Unicode scalars", () => Effect.sync(() => {
  for (const text of ["amp;", "&amp", "&unknown;", "&#;", "&#x;", "&#X;", "&#xyz;", "&#-1;", "&#12a;"]) {
    assertNone(decodeEntity(text));
  }
  for (const text of ["&#0;", "&#55296;", "&#57343;", "&#1114112;", "&#xD800;"]) {
    assertSome(decodeEntity(text), "�");
  }
  assertSome(decodeEntity("&#55295;"), "\ud7ff");
  assertSome(decodeEntity("&#57344;"), "\ue000");
  assertSome(decodeEntity("&#1114111;"), "\udbff\udfff");
}));
