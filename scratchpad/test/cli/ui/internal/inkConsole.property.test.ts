import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeInkConsole } from "../../../../effected/cli/ui/internal/inkConsole.ts";
import { UiStreams } from "../../../../effected/cli/ui/UiStreams.ts";
import { makeFakeStreams } from "../../../../effected/cli/ui/testing/fakeStreams.ts";
const runs = { arbitrary: fcRuns(100) };
const Data = S.Record(S.String, S.Json);
const codec = S.fromJsonString(Data);
const equivalent = S.toEquivalence(Data);
it.effect.prop("console object formatting preserves data through parse and stringify and is stable as text", [Arbitrary.schema(Data)], ([value]) => Effect.gen(function* () {
  const fake = makeFakeStreams();
  const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
  bridge.writer.log(value);
  const formatted = fake.stdout().slice(0, -1);
  const decoded = yield* S.decodeEffect(codec)(formatted);
  assert.isTrue(equivalent(decoded, value));
  assert.deepStrictEqual(yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(decoded)), decoded);
  const before = fake.stdout();
  bridge.writer.log(formatted);
  assert.strictEqual(fake.stdout(), before + formatted + "\n");
}), runs);
it.effect.prop("table output is stable when formatted again as scalar text and preserves safe cell values", [Arbitrary.schema(S.String)], ([value]) => Effect.gen(function* () {
  const safe = value.replace(/[\r\n|]/g, "");
  const fake = makeFakeStreams();
  const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
  bridge.writer.table({ row: { value: safe } });
  const table = fake.stdout().slice(0, -1);
  assert.include(table, safe);
  const before = fake.stdout();
  bridge.writer.table(table);
  assert.strictEqual(fake.stdout(), before + table + "\n");
}), runs);

it.effect("JSON fidelity uses structural equivalence for negative zero", () => Effect.gen(function* () {
  const fake = makeFakeStreams();
  const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
  const value = { n: [-0] };
  bridge.writer.log(value);
  assert.strictEqual(fake.stdout(), '{"n":[0]}\n');
  assert.isTrue(equivalent(yield* S.decodeEffect(codec)(fake.stdout()), value));
}));
