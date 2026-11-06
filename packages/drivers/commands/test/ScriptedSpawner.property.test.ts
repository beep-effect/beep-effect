import { ScriptedSpawner, ScriptResult, SpawnRecord } from "@beep/commands/ScriptedSpawner";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import type * as ChildProcess from "effect/process/ChildProcess";

const runs = { arbitrary: fcRuns(100) };
const ScriptResultSample = S.Union([
  ScriptResult.members[0].annotate({
    toCodecArbitrary: () =>
      S.link<ScriptResult>()(S.String, {
        decode: SchemaGetter.transform(ScriptedSpawner.notFound),
        encode: SchemaGetter.forbiddenEncoding,
      }),
  }),
  ScriptResult.members[1],
]);
const OptionsSample = S.Struct({
  cwd: S.optionalKey(S.String),
  env: S.optionalKey(S.Record(S.String, S.UndefinedOr(S.String))),
  extendEnv: S.optionalKey(S.Boolean),
  shell: S.optionalKey(S.Union([S.Boolean, S.String])),
  detached: S.optionalKey(S.Boolean),
  windowsHide: S.optionalKey(S.Boolean),
  stdin: S.optionalKey(S.Literals(["pipe", "ignore", "inherit", "overlapped"])),
  stdout: S.optionalKey(S.Literals(["pipe", "ignore", "inherit", "overlapped"])),
  stderr: S.optionalKey(S.Literals(["pipe", "ignore", "inherit", "overlapped"])),
});
const SpawnRecordSample = SpawnRecord.mapFields((fields) => ({
  ...fields,
  options: fields.options.annotate({
    toCodecArbitrary: () =>
      S.link<ChildProcess.CommandOptions>()(OptionsSample, {
        decode: SchemaGetter.transform((value) => value),
        encode: SchemaGetter.forbiddenEncoding,
      }),
  }),
}));
it.effect.prop(
  "ScriptResult: encoding and decoding preserves outcomes and platform failures",
  [Arbitrary.schema(ScriptResultSample)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ScriptResult)(value);
      const decoded = yield* S.decodeEffect(ScriptResult)(encoded);
      assert.isTrue(S.toEquivalence(ScriptResult)(decoded, value));
      const value1 = yield* S.encodeEffect(ScriptResult)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
it.effect.prop(
  "SpawnRecord: encoding and decoding preserves argv, environment and options",
  [Arbitrary.schema(SpawnRecordSample)],
  ([value]) =>
    Effect.gen(function* () {
      const record = SpawnRecord.make(value);
      const encoded = yield* S.encodeEffect(SpawnRecord)(record);
      const decoded = yield* S.decodeEffect(SpawnRecord)(encoded);
      assert.isTrue(S.toEquivalence(SpawnRecord)(decoded, record));
      const value2 = yield* S.encodeEffect(SpawnRecord)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);
