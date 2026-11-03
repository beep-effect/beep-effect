import { MemoryFileSystem } from "@beep/memfs";
import {
  expectedIntegrity,
  FetchRequest,
  fetchArgs,
  makeFetchConfigDependency,
  RegistrySettings,
  registrySettingsOf,
  scratchWorkspaceYaml,
} from "@beep/repo-workspaces/internal/configDependencyFetch";
import { Yaml } from "@beep/yaml";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { fakeProcess } from "../support/fakeProcess.ts";
import type { MemoryFileSystemFaults } from "@beep/memfs/MemoryFileSystem";
import type { ProcessAction } from "../support/fakeProcess.ts";

const sri = `sha512-${Str.repeat(86)("A")}==`;
const ROOT = "/repo";
const NO_LOCKS = Effect.as(Effect.void, undefined);
const request = FetchRequest.make({
  root: ROOT,
  name: "config",
  version: "1.0.0",
  spec: `1.0.0+${sri}`,
  stores: [],
  side: {},
});
const SCRATCH_LOCKFILE = `---\nlockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    configDependencies:\n      "config":\n        specifier: "1.0.0"\n        version: "1.0.0"\n\npackages:\n\n  "config@1.0.0":\n    resolution: {integrity: "${sri}"}\n\nsnapshots:\n\n  "config@1.0.0": {}\n\n---\n`;

/** A permission failure on `method`, the shape a real IO error takes. */
const denied = (method: string, path: string): PlatformError.PlatformError =>
  PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method, pathOrDescriptor: path });

/** A fake pnpm that links `.pnpm-config/config` at `relative` (under the scratch) holding `manifest`. */
const linksAt =
  (relative: string, manifest: string): ProcessAction =>
  (_command, args) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const scratch = args[args.indexOf("--dir") + 1] ?? "";
      const readFileString1 = yield* fs.readFileString(path.join(scratch, "pnpm-lock.yaml"));
      assert.strictEqual(readFileString1, SCRATCH_LOCKFILE);
      const target = path.join(scratch, relative);
      yield* fs.makeDirectory(target, { recursive: true });
      yield* fs.writeFileString(path.join(target, "package.json"), manifest);
      const linked = path.join(scratch, "node_modules", ".pnpm-config", "config");
      yield* fs.makeDirectory(path.dirname(linked), { recursive: true });
      yield* fs.symlink(target, linked);
    });

const STORE_COPY = "store/links/config/1.0.0/hash/node_modules/config";
const VERSIONED = '{"version":"1.0.0"}';

/** The fake pnpm, the virtual volume it writes into, and the fetch rung's services, as one layer. */
const fetchWorld = (
  act: ProcessAction,
  seed: Readonly<Record<string, string>> = {},
  faults?: MemoryFileSystemFaults
) => {
  const fake = fakeProcess({ act });
  const volume = Layer.merge(
    MemoryFileSystem.layerWith(seed, faults === undefined ? undefined : { faults }),
    Path.layer
  );
  return { fake, layer: fake.layer.pipe(Layer.provideMerge(volume)) };
};

const fetchOnce = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* makeFetchConfigDependency(spawner)(request, NO_LOCKS);
});

it.effect("invalid inline integrity fails before consulting locks", () =>
  Effect.gen(function* () {
    const failure = yield* Effect.flip(expectedIntegrity({ ...request, spec: "1.0.0+not-sri" }, NO_LOCKS));
    assert.strictEqual(failure.reason, "integrityUnavailable");
    assert.include(failure.message, "not an SRI hash");
    assert.deepStrictEqual(
      registrySettingsOf({ registry: 2, registries: { ok: "url", bad: 2 } }),
      RegistrySettings.make({ registries: { ok: "url" } })
    );
    assert.deepStrictEqual(fetchArgs([])("/scratch"), ["install", "--frozen-lockfile", "--dir", "/scratch"]);
  })
);

it.effect("own __proto__ and normal registry scopes survive extraction and scratch YAML in order", () =>
  Effect.gen(function* () {
    const text =
      'registry: "https://default.test"\nregistries:\n  "__proto__": "https://proto.test"\n  "@normal": "https://normal.test"\n  "@ignored": 42\n';
    const document = yield* Yaml.parse(text);
    const settings = registrySettingsOf(document);
    assert.isTrue(R.has(settings.registries, "__proto__"));
    assert.deepStrictEqual(R.toEntries(settings.registries), [
      ["__proto__", "https://proto.test"],
      ["@normal", "https://normal.test"],
    ]);
    const yaml = scratchWorkspaceYaml("config", "1.0.0", settings);
    assert.strictEqual(
      yaml,
      'configDependencies:\n  "config": "1.0.0"\nregistry: "https://default.test"\nregistries:\n  "__proto__": "https://proto.test"\n  "@normal": "https://normal.test"\n'
    );
    const parsed = yield* Yaml.parse(yaml);
    assert.deepStrictEqual(registrySettingsOf(parsed), settings);
    for (const input of [undefined, null, 42, [], { registry: 42, registries: [] }]) {
      assert.deepStrictEqual(registrySettingsOf(input), RegistrySettings.make({ registries: {} }));
    }
  })
);

it.effect("string JSON quoting preserves hostile YAML scalar text and the final newline", () =>
  Effect.gen(function* () {
    const name = 'config"\n: #';
    const version = "1.0.0\\\t";
    const yaml = scratchWorkspaceYaml(
      name,
      version,
      RegistrySettings.make({ registry: 'https://r.test/"\n', registries: { '@x"\n': "https://s.test/\\" } })
    );
    assert.strictEqual(
      yaml,
      'configDependencies:\n  "config\\"\\n: #": "1.0.0\\\\\\t"\nregistry: "https://r.test/\\"\\n"\nregistries:\n  "@x\\"\\n": "https://s.test/\\\\"\n'
    );
    const parsed2 = yield* Yaml.parse(yaml);
    assert.deepStrictEqual(parsed2, {
      configDependencies: { [name]: version },
      registry: 'https://r.test/"\n',
      registries: { '@x"\n': "https://s.test/\\" },
    });
  })
);

{
  const world = fetchWorld(linksAt(STORE_COPY, VERSIONED), {
    [`${ROOT}/pnpm-workspace.yaml`]: 'registry: "https://example.test"\nregistries:\n  "@a": "https://scope.test"\n',
  });
  it.layer(world.layer, { timeout: "30 seconds" })((it) => {
    it.effect("fetches the exact store version using the workspace registry settings", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const resolved = yield* fetchOnce;
        assert.include(resolved, "/links/config/1.0.0/");
        // The store copy lived under the scratch workspace, which is removed.
        const exists3 = yield* fs.exists(resolved);
        assert.isFalse(exists3);
      })
    );
  });
}

{
  const cause = denied("readFileString", `${ROOT}/pnpm-workspace.yaml`);
  const world = fetchWorld(
    linksAt(STORE_COPY, VERSIONED),
    {},
    {
      readFileString: (path) => (path === `${ROOT}/pnpm-workspace.yaml` ? Effect.fail(cause) : undefined),
    }
  );
  it.layer(world.layer, { timeout: "30 seconds" })((it) => {
    it.effect("workspace read failures retain the cause and do not spawn", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(fetchOnce);
        assert.strictEqual(failure.cause, cause);
        assert.include(failure.message, "reading the workspace pnpm-workspace.yaml failed");
        assert.strictEqual(world.fake.scripted.spawns.length, 0);
      })
    );
  });
}

{
  const world = fetchWorld(linksAt(STORE_COPY, VERSIONED), { [`${ROOT}/pnpm-workspace.yaml`]: "registry: [" });
  it.layer(world.layer, { timeout: "30 seconds" })((it) => {
    it.effect("malformed workspace YAML refuses to select a registry", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(fetchOnce);
        assert.include(failure.message, "reading the workspace pnpm-workspace.yaml failed");
        assert.instanceOf(failure.cause, Error);
      })
    );
  });
}

{
  const cause = denied("copyFile", `${ROOT}/.npmrc`);
  const world = fetchWorld(linksAt(STORE_COPY, VERSIONED), {}, { copyFile: () => Effect.fail(cause) });
  it.layer(world.layer, { timeout: "30 seconds" })((it) => {
    it.effect("a non-absence npmrc copy failure fails closed", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(fetchOnce);
        assert.strictEqual(failure.cause, cause);
        assert.include(failure.message, "writing the scratch workspace failed");
      })
    );
  });
}

{
  const world = fetchWorld(
    linksAt(STORE_COPY, VERSIONED),
    {},
    {
      remove: (path) => Effect.fail(denied("remove", path)),
    }
  );
  it.layer(world.layer, { timeout: "30 seconds" })((it) => {
    it.effect("cleanup failure does not mask a verified result", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const resolved = yield* fetchOnce;
        assert.include(resolved, "/links/config/1.0.0/");
        const scratch = world.fake.scripted.spawns.at(-1)?.args[3] ?? "";
        const exists4 = yield* fs.exists(scratch);
        assert.isTrue(exists4);
      })
    );
  });
}

{
  const world = fetchWorld(linksAt(STORE_COPY, "{"));
  it.layer(world.layer, { timeout: "30 seconds" })((it) => {
    it.effect("invalid fetched manifest JSON fails with the manifest cause", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(fetchOnce);
        assert.include(failure.message, "unreadable package.json");
        assert.instanceOf(failure.cause, Error);
      })
    );
  });
}

{
  const world = fetchWorld(linksAt("unversioned", "{}"));
  it.layer(world.layer, { timeout: "30 seconds" })((it) => {
    it.effect("a fetched unversioned copy is refused", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(fetchOnce);
        assert.include(failure.message, "no version");
      })
    );
  });
}
