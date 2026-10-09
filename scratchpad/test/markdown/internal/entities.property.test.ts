import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { decodeEntity } from "../../../effected/markdown/internal/entities.ts";
import { ENTITY_MAP } from "../../../effected/markdown/internal/entityMap.ts";

const runs = { arbitrary: fcRuns(100) };
const scalar = S.Int.check(S.isBetween({ minimum: 1, maximum: 0x10ffff })).check(S.makeFilter((code) => code < 0xd800 || code > 0xdfff));

it.effect.prop("decimal and hexadecimal references decode identically and retain their scalar under re-encoding", [Arbitrary.schema(scalar)], ([code]) => Effect.sync(() => {
  const value = String.fromCodePoint(code);
  assert.strictEqual(decodeEntity(`&#${code};`), value);
  assert.strictEqual(decodeEntity(`&#x${code.toString(16)};`), value);
  assert.strictEqual(decodeEntity(`&#X${code.toString(16)};`), value);
  const decoded = decodeEntity(`&#${code};`);
  assert.strictEqual(decodeEntity(`&#${decoded?.codePointAt(0)};`), value);
}), runs);

it.effect.prop("named references agree with the HTML5 table and preserve multi-codepoint values", [Arbitrary.schema(S.Literals([...ENTITY_MAP.keys()]))], ([name]) => Effect.sync(() => {
  const value = ENTITY_MAP.get(name);
  assert.strictEqual(decodeEntity(`&${name};`), value);
  assert.strictEqual(decodeEntity(`&${name}`), undefined);
}), runs);
