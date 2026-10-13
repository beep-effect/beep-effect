import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { BunExtension } from "../../../effected/lockfiles/BunExtension.ts";
const runs = { arbitrary: fcRuns(100) };
import { parseBun } from "../../../effected/lockfiles/internal/bun.ts";
import { LockfileFields } from "../../../effected/lockfiles/internal/shared.ts";
const codec = S.fromJsonString(S.Unknown);
const render = S.encodeEffect(codec);
const read = S.decodeEffect(codec);

it.effect.prop("bun parser fidelity and document rendering idempotence preserve instance identity", [Arbitrary.schema(S.Struct({ version: S.Literals(["1.0.0", "2.3.4", "4.0.0-beta.1"]), names: S.Array(S.Literals(["effect", "typescript"])) }))], ([sample]) => Effect.gen(function* () {
  const text = yield* render({ lockfileVersion: 1, workspaces: {}, packages: { effect: [`effect@${sample.version}`, "", {}] }, trustedDependencies: sample.names, overrides: { effect: sample.version } });
  const parsed = yield* parseBun(text);
  const canonical = yield* render(yield* read(text));
  assert.strictEqual(yield* render(yield* read(canonical)), canonical);
  assertTrue(S.toEquivalence(LockfileFields)(yield* parseBun(canonical), parsed));
  assert.strictEqual(parsed.packages[0]?.version, sample.version);
  assert.strictEqual(parsed.packages[0]?.instanceId, "effect");
  assert.deepStrictEqual(parsed.extension, BunExtension.make({ trustedDependencies: sample.names, overrides: { effect: sample.version } }));
}), runs);
