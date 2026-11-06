import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ConfigDependencyLock } from "@beep/lockfiles/ConfigDependencyLock";
import { PackageManagerLock } from "@beep/lockfiles/PackageManagerLock";
import { PnpmEnvLockfile } from "@beep/lockfiles/PnpmEnvLockfile";
import { Yaml } from "@beep/yaml/Yaml";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  version: S.Literals(["11.22.0", "12.6.0"]),
  name: S.Literals(["@acme/config", "constructor", "__proto__"]),
  specifier: S.Literals(["^1.0.0", "1.2.3"]),
  integrity: S.Literals(["sha512-YWJj", "sha256-ZGVm"]),
});

it.effect.prop(
  "env readers preserve recorded pins and checksums through idempotent YAML stream rendering",
  [Arbitrary.schema(Sample)],
  ([sample]) =>
    Effect.gen(function* () {
      const preamble = {
        lockfileVersion: "9.0",
        importers: {
          ".": {
            packageManagerDependencies: { pnpm: { specifier: sample.version, version: sample.version } },
            configDependencies: { [sample.name]: { specifier: sample.specifier, version: "1.2.3" } },
          },
        },
        packages: {
          [`pnpm@${sample.version}`]: { resolution: { integrity: sample.integrity } },
          [`${sample.name}@1.2.3`]: { resolution: { integrity: sample.integrity } },
        },
        snapshots: { [`pnpm@${sample.version}`]: {} },
      };
      const main = { lockfileVersion: "9.0", importers: { ".": {} } };
      const text = `${yield* Yaml.stringify(preamble)}---\n${yield* Yaml.stringify(main)}`;
      const render = Effect.fnUntraced(function* (content: string) {
        const docs = yield* Yaml.parseAll(content);
        const forEach1 = yield* Effect.forEach(docs, (doc) => Yaml.stringify(doc));
        return A.join(forEach1, "---\n");
      });
      const canonical = yield* render(text);
      const render2 = yield* render(canonical);
      assert.strictEqual(render2, canonical);
      const manager = yield* PnpmEnvLockfile.packageManager(text);
      const dependencies = yield* PnpmEnvLockfile.configDependencies(text);
      assertSome(
        manager,
        PackageManagerLock.make({
          name: "pnpm",
          specifier: sample.version,
          version: sample.version,
          integrity: sample.integrity,
          nativeIntegrity: {},
        })
      );
      assertSome(
        HashMap.get(dependencies, sample.name),
        ConfigDependencyLock.make({
          name: sample.name,
          specifier: sample.specifier,
          version: "1.2.3",
          integrity: sample.integrity,
        })
      );
      const packageManager3 = yield* PnpmEnvLockfile.packageManager(canonical);
      assert.deepStrictEqual(packageManager3, manager);
      const configDependencies4 = yield* PnpmEnvLockfile.configDependencies(canonical);
      assert.deepStrictEqual(HashMap.toEntries(configDependencies4), HashMap.toEntries(dependencies));
    }),
  runs
);
