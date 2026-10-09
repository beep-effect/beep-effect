import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { PnpmEnvLockfile } from "../../effected/lockfiles/PnpmEnvLockfile.ts";
import { PackageManagerLock } from "../../effected/lockfiles/PackageManagerLock.ts";
import { ConfigDependencyLock } from "../../effected/lockfiles/ConfigDependencyLock.ts";
import { Yaml } from "../../effected/yaml/Yaml.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  version: S.Literals(["11.22.0", "12.6.0"]),
  name: S.Literals(["@acme/config", "constructor", "__proto__"]),
  specifier: S.Literals(["^1.0.0", "1.2.3"]),
  integrity: S.Literals(["sha512-YWJj", "sha256-ZGVm"]),
});

it.effect.prop("env readers preserve recorded pins and checksums through idempotent YAML stream rendering", [Arbitrary.schema(Sample)], ([sample]) =>
  Effect.gen(function* () {
    const preamble = {
      lockfileVersion: "9.0",
      importers: { ".": {
        packageManagerDependencies: { pnpm: { specifier: sample.version, version: sample.version } },
        configDependencies: { [sample.name]: { specifier: sample.specifier, version: "1.2.3" } },
      } },
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
      return (yield* Effect.forEach(docs, (doc) => Yaml.stringify(doc))).join("---\n");
    });
    const canonical = yield* render(text);
    assert.strictEqual(yield* render(canonical), canonical);
    const manager = yield* PnpmEnvLockfile.packageManager(text);
    const dependencies = yield* PnpmEnvLockfile.configDependencies(text);
    assertSome(manager, PackageManagerLock.make({ name: "pnpm", specifier: sample.version, version: sample.version, integrity: sample.integrity, nativeIntegrity: {} }));
    assertSome(HashMap.get(dependencies, sample.name), ConfigDependencyLock.make({ name: sample.name, specifier: sample.specifier, version: "1.2.3", integrity: sample.integrity }));
    assert.deepStrictEqual(yield* PnpmEnvLockfile.packageManager(canonical), manager);
    assert.deepStrictEqual(HashMap.toEntries(yield* PnpmEnvLockfile.configDependencies(canonical)), HashMap.toEntries(dependencies));
  }), runs);
