import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ProcessGuardPolicy, ProcessGuardInjection, ProcessGuard } from "../../effected/engine/ProcessGuard.ts";

const runs = { arbitrary: fcRuns(100) };

describe("ProcessGuard property floor", () => {
  it.effect.prop(
    "ProcessGuardPolicy encoding decodes successfully to an equivalent value",
    [Arbitrary.schema(ProcessGuardPolicy)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ProcessGuardPolicy)(value);
      const decoded = yield* S.decodeEffect(ProcessGuardPolicy)(encoded);
      assert.strictEqual(S.toEquivalence(ProcessGuardPolicy)(decoded, value), true);
    }),
    runs,
  );
  it.effect.prop(
    "ProcessGuardInjection encoding decodes successfully to an equivalent value",
    [Arbitrary.schema(ProcessGuardInjection)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ProcessGuardInjection)(value);
      const decoded = yield* S.decodeEffect(ProcessGuardInjection)(encoded);
      assert.strictEqual(S.toEquivalence(ProcessGuardInjection)(decoded, value), true);
    }),
    runs,
  );
  it.effect.prop(
    "injection parsing is faithful and canonical rendering is idempotent",
    [Arbitrary.schema(ProcessGuardInjection)],
    ([value]) => Effect.sync(() => {
      const text = `${value.at}:${value.kind}`;
      const parsed = ProcessGuard.parseInjectCrash(text);
      assert.deepStrictEqual(parsed, value);
      assert.ok(parsed);
      const rendered = `${parsed.at}:${parsed.kind}`;
      assert.strictEqual(rendered, text);
      assert.deepStrictEqual(ProcessGuard.parseInjectCrash(rendered), parsed);
    }),
    runs,
  );
  it.effect.prop(
    "arbitrary text either rejects or retains its parsed value through canonical rendering",
    [Arbitrary.schema(S.String)],
    ([text]) => Effect.sync(() => {
      const parsed = ProcessGuard.parseInjectCrash(text);
      if (parsed === undefined) {
        assert.strictEqual(S.is(ProcessGuardInjection)({
          at: Str.split(text, ":")[0], kind: Str.split(text, ":")[1],
        }) && Str.split(text, ":").length === 2, false);
      } else {
        assert.deepStrictEqual(ProcessGuard.parseInjectCrash(`${parsed.at}:${parsed.kind}`), parsed);
      }
    }),
    runs,
  );
});
