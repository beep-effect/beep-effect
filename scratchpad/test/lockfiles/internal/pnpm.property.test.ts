import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PnpmExtension } from "../../../effected/lockfiles/PnpmExtension.ts";
const runs = { arbitrary: fcRuns(100) };
import { parsePnpm } from "../../../effected/lockfiles/internal/pnpm.ts";
import { LockfileFields } from "../../../effected/lockfiles/internal/shared.ts";
import { Yaml } from "../../../effected/yaml/Yaml.ts";
const render = Yaml.stringify;
const read = Yaml.parse;

it.effect.prop("pnpm parser fidelity and document rendering idempotence preserve instance identity", [Arbitrary.schema(S.Struct({ version: S.Literals(["1.0.0", "2.3.4", "4.0.0-beta.1"]), names: S.Array(S.Literals(["effect", "typescript"])) }))], ([sample]) => Effect.gen(function* () {
  const text = yield* render({ lockfileVersion: 9, importers: { ".": {} }, packages: { [`effect@${sample.version}`]: {} }, snapshots: { [`effect@${sample.version}`]: {} }, overrides: { effect: sample.version } });
  const parsed = yield* parsePnpm(text, false);
  const canonical = yield* render(yield* read(text));
  assert.strictEqual(yield* render(yield* read(canonical)), canonical);
  assertTrue(S.toEquivalence(LockfileFields)(yield* parsePnpm(canonical, false), parsed));
  assert.strictEqual(parsed.packages[0]?.version, sample.version);
  assert.strictEqual(parsed.packages[0]?.instanceId, `effect@${sample.version}`);
  assert.deepStrictEqual(parsed.extension, PnpmExtension.make({ overrides: { effect: sample.version } }));
}), runs);
