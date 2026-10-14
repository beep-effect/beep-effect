import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { assertDefined } from "@effect/vitest/utils";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as S from "effect/Schema";
import { ActionOutputs, RunnerFileUnavailableError, RunnerFileWriteError, InvalidOutputNameError, OutputEncodeError, DetachedOutputError, RecordedOutput } from "../../effected/github-actions/ActionOutputs.ts";
const Defect = S.Defect();
const runs = { arbitrary: fcRuns(100) };
// Defect is a JSON boundary: compare causes in their documented wire form,
// which intentionally omits Error stacks and normalizes non-JSON values.
const structural = Effect.fn("structural")(function*<A extends object>(value: A) {
  const fields = "name" in value ? { ...value, name: value.name } : { ...value };
  return "cause" in value
    ? { ...fields, cause: yield* S.encodeEffect(Defect)(value.cause) }
    : fields;
});
const roundTrips = <A extends object, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.deepStrictEqual(yield* structural(decoded), yield* structural(value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
describe("ActionOutputs schema fidelity", () => {
  roundTrips("RunnerFileUnavailableError round-trips without decode failure", RunnerFileUnavailableError);
  roundTrips("RunnerFileWriteError round-trips without decode failure", RunnerFileWriteError);
  roundTrips("InvalidOutputNameError round-trips without decode failure", InvalidOutputNameError);
  roundTrips("OutputEncodeError round-trips without decode failure", OutputEncodeError);
  roundTrips("DetachedOutputError round-trips without decode failure", DetachedOutputError);
  roundTrips("RecordedOutput round-trips without decode failure", RecordedOutput);
});

const OutputPayload = S.Struct({ text: S.String, count: S.Int });
const OutputJson = S.fromJsonString(OutputPayload);
it.layer(ActionOutputs.layer.pipe(Layer.provideMerge(Layer.mergeAll(ActionEnvironment.layerTest({ GITHUB_OUTPUT: "/output" }), MemoryFileSystem.layer))), { timeout: "30 seconds" })((it) => {
  it.effect.prop("JSON output formatting is stable and the runner receives the original value", [Arbitrary.schema(OutputPayload)], ([value]) => Effect.gen(function* () {
    const outputs = yield* ActionOutputs;
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString("/output", "");
    yield* outputs.setJson("payload", value, OutputPayload);
    const text = (yield* fs.readFileString("/output")).split("\n")[1];
    assertDefined(text);
    const parsed = yield* S.decodeEffect(OutputJson)(text);
    assert.isTrue(S.toEquivalence(OutputPayload)(parsed, value));
    yield* fs.writeFileString("/output", "");
    yield* outputs.setJson("payload", parsed, OutputPayload);
    const reformatted = (yield* fs.readFileString("/output")).split("\n")[1];
    assertDefined(reformatted);
    assert.strictEqual(reformatted, text);
    assert.deepStrictEqual(yield* S.decodeEffect(OutputJson)(reformatted), parsed);
  }), runs);
});
