import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ConfigDependencyLock } from "@beep/lockfiles/ConfigDependencyLock";
import { readPnpmConfigDependencies, readPnpmPackageManager } from "@beep/lockfiles/internal/pnpmEnv";
import { PackageManagerLock } from "@beep/lockfiles/PackageManagerLock";
import { Yaml } from "@beep/yaml/Yaml";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "env readers preserve pinned versions, specifiers and integrity through idempotent YAML rendering",
  [
    Arbitrary.schema(
      S.Struct({
        version: S.Literals(["11.0.0", "12.6.0"]),
        specifier: S.String,
        integrity: S.Literals(["sha512-YWJj", "sha256-ZGVm"]),
      })
    ),
  ],
  ([sample]) =>
    Effect.gen(function* () {
      const document = {
        lockfileVersion: 9,
        importers: {
          ".": {
            packageManagerDependencies: { pnpm: { specifier: sample.specifier, version: sample.version } },
            configDependencies: { config: { specifier: sample.specifier, version: sample.version } },
          },
        },
        packages: {
          [`pnpm@${sample.version}`]: { resolution: { integrity: sample.integrity } },
          [`config@${sample.version}`]: { resolution: { integrity: sample.integrity } },
        },
        snapshots: { [`pnpm@${sample.version}`]: {} },
      };
      const render = Effect.fnUntraced(function* (value: unknown) {
        return `${yield* Yaml.stringify(value)}\n---\n`;
      });
      const text = yield* render(document);
      const stringify4 = yield* Yaml.stringify(document);
      const parsed = yield* Yaml.parse(stringify4);
      const canonical = yield* render(parsed);
      assert.strictEqual(canonical, text);
      const render1 = yield* render((yield* Yaml.parseAll(canonical))[0]);
      assert.strictEqual(render1, canonical);
      const manager = yield* readPnpmPackageManager(text);
      const configs = yield* readPnpmConfigDependencies(text);
      const readPnpmPackageManager2 = yield* readPnpmPackageManager(canonical);
      assert.deepStrictEqual(readPnpmPackageManager2, manager);
      const readPnpmConfigDependencies3 = yield* readPnpmConfigDependencies(canonical);
      assert.deepStrictEqual(readPnpmConfigDependencies3, configs);
      const expected = yield* S.decodeEffect(PackageManagerLock)({ name: "pnpm", ...sample, nativeIntegrity: {} });
      assertSome(manager, expected);
      const config = yield* S.decodeEffect(ConfigDependencyLock)({ name: "config", ...sample });
      assertSome(HashMap.get(configs, "config"), config);
    }),
  runs
);
