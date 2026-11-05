import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { parseNpm } from "@beep/lockfiles/internal/npm";
import { LockfileFields } from "@beep/lockfiles/internal/shared";

const codec = S.fromJsonString(S.Unknown);
const render = S.encodeEffect(codec);
const read = S.decodeEffect(codec);

it.effect.prop(
  "npm parser fidelity and document rendering idempotence preserve instance identity",
  [
    Arbitrary.schema(
      S.Struct({
        version: S.Literals(["1.0.0", "2.3.4", "4.0.0-beta.1"]),
        names: S.Array(S.Literals(["effect", "typescript"])),
      })
    ),
  ],
  ([sample]) =>
    Effect.gen(function* () {
      const text = yield* render({
        lockfileVersion: 3,
        packages: { "node_modules/effect": { version: sample.version } },
      });
      const parsed = yield* parseNpm(text);
      const read1 = yield* read(text);
      const canonical = yield* render(read1);
      const read3 = yield* read(canonical);
      const render2 = yield* render(read3);
      assert.strictEqual(render2, canonical);
      const argument = S.toEquivalence(LockfileFields);
      const parsedNpm = yield* parseNpm(canonical);
      assertTrue(argument(parsedNpm, parsed));
      assert.strictEqual(parsed.packages[0]?.version, sample.version);
      assert.strictEqual(parsed.packages[0]?.instanceId, "node_modules/effect");
    }),
  runs
);
