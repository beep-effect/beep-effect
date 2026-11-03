import { CommandFailedError, CommandOutput, CommandOutputError, Run, RunOptions } from "@beep/commands/Run";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";

const withLayer =
  <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) =>
  <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context))
    );

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decode(encode(x)) preserves x and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(equivalent(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("Run schema property floor", () => {
  roundTrips("CommandOutput", CommandOutput);
  roundTrips("CommandFailedError", CommandFailedError);
  roundTrips("CommandOutputError", CommandOutputError);
});

// Generation hints are test-local: the exported codec still performs every encode/decode.
const RunOptionsSample = RunOptions.mapFields((fields) => ({
  ...fields,
  timeout: fields.timeout.schema
    .annotate({
      toCodecArbitrary: () =>
        S.link<RunOptions["timeout"]>()(S.Finite, {
          decode: SchemaGetter.transform((value) => value),
          encode: SchemaGetter.forbiddenEncoding,
        }),
    })
    .pipe(S.optionalKey),
  maxOutputBytes: fields.maxOutputBytes.schema
    .annotate({
      toCodecArbitrary: () =>
        S.link<number>()(S.Finite, {
          decode: SchemaGetter.transform((value) => value),
          encode: SchemaGetter.forbiddenEncoding,
        }),
    })
    .pipe(S.optionalKey),
}));
it.effect.prop(
  "RunOptions: encoded policies decode without changing duration, budget or secrets",
  [Arbitrary.schema(RunOptionsSample)],
  ([value]) =>
    Effect.gen(function* () {
      const options = RunOptions.make(value);
      const encoded = yield* S.encodeEffect(RunOptions)(options);
      const decoded = yield* S.decodeEffect(RunOptions)(encoded);
      assert.isTrue(S.toEquivalence(RunOptions)(decoded, options));
      const value2 = yield* S.encodeEffect(RunOptions)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);

it.effect.prop(
  "JSON parsing preserves JSON values through stringify and repeated decoding",
  [Arbitrary.schema(S.Json)],
  ([value]) =>
    Effect.gen(function* () {
      const codec = S.fromJsonString(S.Json);
      const text = yield* S.encodeEffect(codec)(value);
      const spawner = ScriptedSpawner.make(() => ({ stdout: text }));
      const parsed = yield* Run.json(ChildProcess.make("json"), S.Json).pipe(withLayer(spawner.layer));
      const rendered = yield* S.encodeEffect(codec)(parsed);
      const reparsed = yield* Run.json(ChildProcess.make("json"), S.Json).pipe(
        withLayer(ScriptedSpawner.make(() => ({ stdout: rendered })).layer)
      );
      assert.isTrue(S.toEquivalence(S.Json)(parsed, value));
      assert.isTrue(S.toEquivalence(S.Json)(reparsed, parsed));
      const value3 = yield* S.encodeEffect(codec)(reparsed);
      assert.strictEqual(value3, rendered);
    }),
  runs
);

it.effect.prop(
  "jsonLine keeps the last valid payload despite child logging and a failing exit",
  [Arbitrary.schema(S.Json)],
  ([value]) =>
    Effect.gen(function* () {
      const codec = S.fromJsonString(S.Json);
      const payload = yield* S.encodeEffect(codec)(value);
      const command = ChildProcess.make("protocol");
      const output = `starting\n${payload}\nfinished\n`;
      const parsed = yield* Run.jsonLine(command, S.Json).pipe(
        withLayer(ScriptedSpawner.make(() => ({ stdout: output, exit: 7 })).layer)
      );
      const encoded = yield* S.encodeEffect(codec)(parsed);
      const reparsed = yield* Run.jsonLine(command, S.Json).pipe(
        withLayer(ScriptedSpawner.make(() => ({ stdout: encoded })).layer)
      );
      assert.isTrue(S.toEquivalence(S.Json)(parsed, value));
      assert.isTrue(S.toEquivalence(S.Json)(reparsed, parsed));
      const value4 = yield* S.encodeEffect(codec)(reparsed);
      assert.strictEqual(value4, encoded);
    }),
  runs
);

it.effect.prop(
  "text normalization is idempotent and lines preserve the ordered non-empty trimmed lines",
  [Arbitrary.schema(S.String)],
  ([stdout]) =>
    Effect.gen(function* () {
      const command = ChildProcess.make("text");
      const spawner = ScriptedSpawner.make(() => ({ stdout }));
      const transmitted = new TextDecoder().decode(new TextEncoder().encode(stdout));
      const text = yield* Run.text(command).pipe(withLayer(spawner.layer));
      assert.strictEqual(text, Str.trim(transmitted));
      const pipe5 = yield* Run.text(command).pipe(withLayer(ScriptedSpawner.make(() => ({ stdout: text })).layer));
      assert.strictEqual(pipe5, text);
      const lines = yield* Run.lines(command).pipe(withLayer(spawner.layer));
      assert.deepStrictEqual(
        lines,
        A.filter(
          A.map(Str.split(/\r?\n/)(transmitted), (line) => Str.trim(line)),
          (line) => line.length > 0
        )
      );
      const reparsed = yield* Run.lines(command).pipe(
        withLayer(ScriptedSpawner.make(() => ({ stdout: A.join(lines, "\n") })).layer)
      );
      assert.deepStrictEqual(reparsed, lines);
    }),
  runs
);
