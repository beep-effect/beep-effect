import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as ChildProcess from "effect/process/ChildProcess";
import { ScriptResult, ScriptedSpawner, SpawnRecord } from "../../effected/commands/ScriptedSpawner.ts";

const runs = { arbitrary: fcRuns(100) };
const ScriptResultSample = S.Union([
  ScriptResult.members[0].annotate({ toCodecArbitrary: () => S.link<ScriptResult>()(S.String, { decode: SchemaGetter.transform(ScriptedSpawner.notFound), encode: SchemaGetter.forbiddenEncoding }) }),
  ScriptResult.members[1].mapFields((fields) => ({
    ...fields,
    exit: fields.exit.schema.members[0].annotate({ toCodecArbitrary: () => S.link<number>()(S.Finite, { decode: SchemaGetter.transform((value) => value), encode: SchemaGetter.forbiddenEncoding }) }).pipe(S.optional),
  })),
]);
const OptionsSample = S.Struct({
  cwd: S.optional(S.String), env: S.optional(S.Record(S.String, S.UndefinedOr(S.String))),
  extendEnv: S.optional(S.Boolean), shell: S.optional(S.Union([S.Boolean, S.String])),
  detached: S.optional(S.Boolean), windowsHide: S.optional(S.Boolean),
  stdin: S.optional(S.Literals(["pipe", "ignore", "inherit", "overlapped"])),
  stdout: S.optional(S.Literals(["pipe", "ignore", "inherit", "overlapped"])),
  stderr: S.optional(S.Literals(["pipe", "ignore", "inherit", "overlapped"])),
});
const SpawnRecordSample = SpawnRecord.mapFields((fields) => ({
  ...fields,
  options: fields.options.annotate({ toCodecArbitrary: () => S.link<ChildProcess.CommandOptions>()(OptionsSample, { decode: SchemaGetter.transform((value) => value), encode: SchemaGetter.forbiddenEncoding }) }),
}));
it.effect.prop("ScriptResult: encoding and decoding preserves outcomes and platform failures", [Arbitrary.schema(ScriptResultSample)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(ScriptResult)(value);
  const decoded = yield* S.decodeEffect(ScriptResult)(encoded);
  assert.isTrue(S.toEquivalence(ScriptResult)(decoded, value));
  assert.deepStrictEqual(yield* S.encodeEffect(ScriptResult)(decoded), encoded);
}), runs);
it.effect.prop("SpawnRecord: encoding and decoding preserves argv, environment and options", [Arbitrary.schema(SpawnRecordSample)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(SpawnRecord)(value);
  const decoded = yield* S.decodeEffect(SpawnRecord)(encoded);
  assert.isTrue(S.toEquivalence(SpawnRecord)(decoded, value));
  assert.deepStrictEqual(yield* S.encodeEffect(SpawnRecord)(decoded), encoded);
}), runs);
