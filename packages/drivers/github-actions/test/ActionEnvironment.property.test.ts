import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ActionEnvironment } from "@beep/github-actions/ActionEnvironment";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

import { ActionEnvironmentError, GitHubContext, RunnerContext } from "@beep/github-actions/ActionEnvironment";

describe("ActionEnvironment property floor", () => {
  roundTrips("ActionEnvironmentError encode/decode fidelity", ActionEnvironmentError);
  roundTrips("GitHubContext encode/decode fidelity", GitHubContext);
  roundTrips("RunnerContext encode/decode fidelity", RunnerContext);
});

it.layer(
  ActionEnvironment.layerFrom({ GITHUB_EVENT_PATH: "/event.json" }).pipe(Layer.provideMerge(MemoryFileSystem.layer)),
  { timeout: "30 seconds" }
)((it) => {
  const Json = S.fromJsonString(S.Json);
  it.effect.prop(
    "webhook payload parser preserves JSON through parse/stringify/parse",
    [Arbitrary.schema(S.Json)],
    ([value]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const env = yield* ActionEnvironment;
        const encoded = yield* S.encodeEffect(Json)(value);
        yield* fs.writeFileString("/event.json", encoded);
        const argument = S.decodeUnknownEffect(S.Json);
        const payload1 = yield* env.payload;
        const parsed = yield* argument(payload1);
        assert.isTrue(S.toEquivalence(S.Json)(parsed, value));
        const formatted = yield* S.encodeEffect(Json)(parsed);
        yield* fs.writeFileString("/event.json", formatted);
        const argument1 = S.decodeUnknownEffect(S.Json);
        const payload2 = yield* env.payload;
        const reparsed = yield* argument1(payload2);
        assert.isTrue(S.toEquivalence(S.Json)(reparsed, parsed));
        const value2 = yield* S.encodeEffect(Json)(reparsed);
        assert.strictEqual(value2, formatted);
      }),
    runs
  );
});
