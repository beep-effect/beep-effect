import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { ActionEnvironmentError, GitHubContext, RunnerContext } from "../../effected/github-actions/ActionEnvironment.ts";
describe("ActionEnvironment property floor", () => {
  roundTrips("ActionEnvironmentError encode/decode fidelity", ActionEnvironmentError);
  roundTrips("GitHubContext encode/decode fidelity", GitHubContext);
  roundTrips("RunnerContext encode/decode fidelity", RunnerContext);
});

it.layer(ActionEnvironment.layerFrom({ GITHUB_EVENT_PATH: "/event.json" }).pipe(Layer.provideMerge(MemoryFileSystem.layer)), { timeout: "30 seconds" })((it) => {
  const Json = S.fromJsonString(S.Json);
  it.effect.prop("webhook payload parser preserves JSON through parse/stringify/parse", [Arbitrary.schema(S.Json)], ([value]) => Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const env = yield* ActionEnvironment;
    const encoded = yield* S.encodeEffect(Json)(value);
    yield* fs.writeFileString("/event.json", encoded);
    const parsed = yield* S.decodeUnknownEffect(S.Json)(yield* env.payload);
    assert.isTrue(S.toEquivalence(S.Json)(parsed, value));
    const formatted = yield* S.encodeEffect(Json)(parsed);
    yield* fs.writeFileString("/event.json", formatted);
    const reparsed = yield* S.decodeUnknownEffect(S.Json)(yield* env.payload);
    assert.isTrue(S.toEquivalence(S.Json)(reparsed, parsed));
    assert.strictEqual(yield* S.encodeEffect(Json)(reparsed), formatted);
  }), runs);
});
