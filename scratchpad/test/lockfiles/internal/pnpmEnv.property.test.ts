import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { Yaml } from "../../../effected/yaml/Yaml.ts";
import { ConfigDependencyLock } from "../../../effected/lockfiles/ConfigDependencyLock.ts";
import { PackageManagerLock } from "../../../effected/lockfiles/PackageManagerLock.ts";
import { readPnpmPackageManager, readPnpmConfigDependencies } from "../../../effected/lockfiles/internal/pnpmEnv.ts";
const runs = { arbitrary: fcRuns(100) };

it.effect.prop("env readers preserve pinned versions, specifiers and integrity through idempotent YAML rendering", [Arbitrary.schema(S.Struct({ version: S.Literals(["11.0.0", "12.6.0"]), specifier: S.String, integrity: S.Literals(["sha512-YWJj", "sha256-ZGVm"]) }))], ([sample]) => Effect.gen(function* () {
  const document = { lockfileVersion: 9, importers: { ".": {
    packageManagerDependencies: { pnpm: { specifier: sample.specifier, version: sample.version } },
    configDependencies: { config: { specifier: sample.specifier, version: sample.version } },
  } }, packages: {
    [`pnpm@${sample.version}`]: { resolution: { integrity: sample.integrity } },
    [`config@${sample.version}`]: { resolution: { integrity: sample.integrity } },
  }, snapshots: { [`pnpm@${sample.version}`]: {} } };
  const render = Effect.fnUntraced(function* (value: unknown) { return `${yield* Yaml.stringify(value)}\n---\n`; });
  const text = yield* render(document);
  const canonical = yield* render(yield* Yaml.parse((yield* Yaml.stringify(document))));
  assert.strictEqual(canonical, text);
  assert.strictEqual(yield* render((yield* Yaml.parseAll(canonical))[0]), canonical);
  const manager = yield* readPnpmPackageManager(text);
  const configs = yield* readPnpmConfigDependencies(text);
  assert.deepStrictEqual(yield* readPnpmPackageManager(canonical), manager);
  assert.deepStrictEqual(yield* readPnpmConfigDependencies(canonical), configs);
  const expected = yield* S.decodeEffect(PackageManagerLock)({ name: "pnpm", ...sample, nativeIntegrity: {} });
  assert.deepStrictEqual(manager, expected);
  const config = yield* S.decodeEffect(ConfigDependencyLock)({ name: "config", ...sample });
  assertSome(HashMap.get(configs, "config"), config);
}), runs);
