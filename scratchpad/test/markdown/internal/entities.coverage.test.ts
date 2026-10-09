import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { decodeEntity } from "../../../effected/markdown/internal/entities.ts";

it.effect("rejects malformed references and replaces invalid Unicode scalars", () => Effect.sync(() => {
  for (const text of ["amp;", "&amp", "&unknown;", "&#;", "&#x;", "&#X;", "&#xyz;", "&#-1;", "&#12a;"]) {
    assert.strictEqual(decodeEntity(text), undefined);
  }
  for (const text of ["&#0;", "&#55296;", "&#57343;", "&#1114112;", "&#xD800;"]) {
    assert.strictEqual(decodeEntity(text), "�");
  }
  assert.strictEqual(decodeEntity("&#55295;"), "\ud7ff");
  assert.strictEqual(decodeEntity("&#57344;"), "\ue000");
  assert.strictEqual(decodeEntity("&#1114111;"), "\udbff\udfff");
}));
