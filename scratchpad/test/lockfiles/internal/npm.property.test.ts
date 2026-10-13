import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { parseNpm } from "../../../effected/lockfiles/internal/npm.ts";
import { LockfileFields } from "../../../effected/lockfiles/internal/shared.ts";
const codec = S.fromJsonString(S.Unknown);
const render = S.encodeEffect(codec);
const read = S.decodeEffect(codec);

it.effect.prop("npm parser fidelity and document rendering idempotence preserve instance identity", [Arbitrary.schema(S.Struct({ version: S.Literals(["1.0.0", "2.3.4", "4.0.0-beta.1"]), names: S.Array(S.Literals(["effect", "typescript"])) }))], ([sample]) => Effect.gen(function* () {
  const text = yield* render({ lockfileVersion: 3, packages: { "node_modules/effect": { version: sample.version } } });
  const parsed = yield* parseNpm(text);
  const canonical = yield* render(yield* read(text));
  assert.strictEqual(yield* render(yield* read(canonical)), canonical);
  assertTrue(S.toEquivalence(LockfileFields)(yield* parseNpm(canonical), parsed));
  assert.strictEqual(parsed.packages[0]?.version, sample.version);
  assert.strictEqual(parsed.packages[0]?.instanceId, "node_modules/effect");
}), runs);
