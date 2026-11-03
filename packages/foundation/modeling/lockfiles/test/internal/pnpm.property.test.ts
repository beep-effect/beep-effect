import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { PnpmExtension } from "@beep/lockfiles/PnpmExtension";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { parsePnpm } from "@beep/lockfiles/internal/pnpm";
import { LockfileFields } from "@beep/lockfiles/internal/shared";
import { Yaml } from "@beep/yaml/Yaml";

const render = Yaml.stringify;
const read = Yaml.parse;

it.effect.prop(
  "pnpm parser fidelity and document rendering idempotence preserve instance identity",
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
        lockfileVersion: 9,
        importers: { ".": {} },
        packages: { [`effect@${sample.version}`]: {} },
        snapshots: { [`effect@${sample.version}`]: {} },
        overrides: { effect: sample.version },
      });
      const parsed = yield* parsePnpm(text, false);
      const read1 = yield* read(text);
      const canonical = yield* render(read1);
      const read3 = yield* read(canonical);
      const render2 = yield* render(read3);
      assert.strictEqual(render2, canonical);
      const argument = S.toEquivalence(LockfileFields);
      const parsedPnpm = yield* parsePnpm(canonical, false);
      assertTrue(argument(parsedPnpm, parsed));
      assert.strictEqual(parsed.packages[0]?.version, sample.version);
      assert.strictEqual(parsed.packages[0]?.instanceId, `effect@${sample.version}`);
      assert.deepStrictEqual(parsed.extension, PnpmExtension.make({ overrides: { effect: sample.version } }));
    }),
  runs
);
