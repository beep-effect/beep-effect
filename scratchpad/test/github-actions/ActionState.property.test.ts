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
import { ActionOutputs } from "../../effected/github-actions/ActionOutputs.ts";
import { ActionState, InvalidActionStateNameError, ActionStateError } from "../../effected/github-actions/ActionState.ts";
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
describe("ActionState schema fidelity", () => {
  roundTrips("InvalidActionStateNameError round-trips without decode failure", InvalidActionStateNameError);
  roundTrips("ActionStateError round-trips without decode failure", ActionStateError);
});

const StatePayload = S.Struct({ text: S.String, count: S.Int });
const StateJson = S.fromJsonString(StatePayload);
const phaseEnvironment: Record<string, string> = { GITHUB_STATE: "/state" };
it.layer(ActionState.layer.pipe(Layer.provideMerge(Layer.mergeAll(ActionEnvironment.layerFrom(phaseEnvironment).pipe(Layer.provide(MemoryFileSystem.layer)), MemoryFileSystem.layer, ActionOutputs.layerTest()))), { timeout: "30 seconds" })((it) => {
  it.effect.prop("phase-state parsing preserves values and save/read/save has stable JSON", [Arbitrary.schema(StatePayload)], ([value]) => Effect.gen(function* () {
    const state = yield* ActionState;
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString("/state", "");
    yield* state.save("payload", value, StatePayload);
    const text = (yield* fs.readFileString("/state")).split("\n")[1];
    assertDefined(text);
    phaseEnvironment["STATE_payload"] = text;
    const parsed = yield* state.get("payload", StatePayload);
    assert.isTrue(S.toEquivalence(StatePayload)(parsed, value));
    yield* fs.writeFileString("/state", "");
    yield* state.save("payload", parsed, StatePayload);
    const reformatted = (yield* fs.readFileString("/state")).split("\n")[1];
    assertDefined(reformatted);
    assert.strictEqual(reformatted, text);
    phaseEnvironment["STATE_payload"] = yield* S.encodeEffect(StateJson)(parsed);
    assert.deepStrictEqual(yield* state.get("payload", StatePayload), parsed);
  }), runs);
});
