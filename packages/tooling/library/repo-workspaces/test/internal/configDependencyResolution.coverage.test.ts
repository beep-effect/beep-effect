import { MemoryFileSystem } from "@beep/memfs";
import { FetchFailure } from "@beep/repo-workspaces/internal/configDependencyFetch";
import {
  lookupPnpmfiles,
  ResolvedPnpmfile,
  resolvePnpmfiles,
} from "@beep/repo-workspaces/internal/configDependencyResolution";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { MemoryFileSystemSeed } from "@beep/memfs/MemoryFileSystem";
import type { FetchConfigDependency } from "@beep/repo-workspaces/internal/configDependencyFetch";

const UnknownJson = S.fromJsonString(S.Unknown);

const ROOT = "/repo";

/** A virtual volume over `seed`, counting every read the ladder makes. */
const counted = (seed: MemoryFileSystemSeed = {}) => {
  const reads = { count: 0 };
  const count = () => {
    reads.count += 1;
    return undefined;
  };
  const layer = Layer.merge(
    MemoryFileSystem.layerWith(seed, {
      faults: { readDirectory: count, readFileString: count, realPath: count },
    }),
    Path.layer
  );
  return { reads, layer };
};

/** A fetch rung that records how often it was asked. */
const recordingFetch = (answer: string) => {
  const calls = { count: 0 };
  const fetch: FetchConfigDependency = () => {
    calls.count += 1;
    return Effect.succeed(answer);
  };
  return { calls, fetch };
};

{
  const volume = counted();
  it.layer(volume.layer, { timeout: "30 seconds" })((it) => {
    it.effect("both resolvers reject traversal versions before filesystem reads or fetch", () =>
      Effect.gen(function* () {
        const { calls, fetch } = recordingFetch("/outside");
        for (const version of ["../../outside", "..\\..\\outside", "../../../../outside+sha512-pin"]) {
          const failure = yield* Effect.flip(resolvePnpmfiles({ pkg: version }, undefined, fetch)("/workspace"));
          assert.strictEqual(failure._tag, "CatalogAssemblyError");
          assert.strictEqual(failure.source, "hooks");
          assert.strictEqual(failure.path, "pkg");
          assert.include(
            failure.cause instanceof Error ? failure.cause.message : "",
            "version has a '..' path segment"
          );
          const supplied = yield* Effect.flip(
            lookupPnpmfiles({ [`pkg@${version}`]: "/outside/pnpmfile.cjs" }, { pkg: version })
          );
          assert.strictEqual(supplied._tag, "CatalogAssemblyError");
          assert.strictEqual(supplied.source, "hooks");
          assert.strictEqual(supplied.path, "pkg");
          assert.include(
            supplied.cause instanceof Error ? supplied.cause.message : "",
            "version has a '..' path segment"
          );
        }
        assert.strictEqual(volume.reads.count, 0);
        assert.strictEqual(calls.count, 0);
      })
    );
    it.effect("both resolvers still reject traversal names before filesystem reads or fetch", () =>
      Effect.gen(function* () {
        const { calls, fetch } = recordingFetch("/outside");
        const failure = yield* Effect.flip(resolvePnpmfiles("/workspace", { "../../pkg": "1.0.0" }, undefined, fetch));
        const supplied = yield* Effect.flip(
          lookupPnpmfiles({ "../../pkg@1.0.0": "/outside/pnpmfile.cjs" }, { "../../pkg": "1.0.0" })
        );
        for (const error of [failure, supplied]) {
          assert.strictEqual(error._tag, "CatalogAssemblyError");
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, "../../pkg");
          assert.include(error.cause instanceof Error ? error.cause.message : "", "name has a '..' path segment");
        }
        assert.strictEqual(volume.reads.count, 0);
        assert.strictEqual(calls.count, 0);
      })
    );
    it.effect("an empty supplied map diagnoses that no keys are known", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(lookupPnpmfiles({ config: "1.0.0" })({}));
        assert.include(failure.message, "hooks");
        assert.instanceOf(failure.cause, Error);
        assert.include(failure.cause instanceof Error ? failure.cause.message : "", "known: none");
      })
    );
    it.effect("a fetched directory resolves its optional pnpmfile", () =>
      Effect.gen(function* () {
        const { fetch } = recordingFetch(ROOT);
        const result = yield* resolvePnpmfiles(ROOT, { config: "1.0.0" }, undefined, fetch);
        assert.deepStrictEqual(result, [
          ResolvedPnpmfile.make({ name: "config", version: "1.0.0", source: "fetched", path: undefined }),
        ]);
      })
    );
  });
}

it.layer(
  counted({
    [`${ROOT}/node_modules/.pnpm-config/pkg/package.json`]: '{"name":"pkg","version":"1.0.0-beta..1"}',
  }).layer,
  { timeout: "30 seconds" }
)((it) => {
  it.effect("a single-segment prerelease containing dots resolves through both resolvers", () =>
    Effect.gen(function* () {
      const result = yield* resolvePnpmfiles(ROOT, { pkg: "1.0.0-beta..1" });
      assert.deepStrictEqual(result, [
        ResolvedPnpmfile.make({ name: "pkg", version: "1.0.0-beta..1", source: "installed", path: undefined }),
      ]);
      const supplied = yield* lookupPnpmfiles({ "pkg@1.0.0-beta..1": "/hooks/pnpmfile.cjs" }, { pkg: "1.0.0-beta..1" });
      assert.deepStrictEqual(supplied, [
        ResolvedPnpmfile.make({
          name: "pkg",
          version: "1.0.0-beta..1",
          source: "supplied",
          path: "/hooks/pnpmfile.cjs",
        }),
      ]);
    })
  );
});

for (const text of ["storeDir: [", "null", "storeDir: 42", 'storeDir: ""']) {
  it.layer(counted({ [`${ROOT}/node_modules/.modules.yaml`]: text }).layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      `malformed and unusable modules YAML contributes no store (${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(text), identity)})`,
      () =>
        Effect.gen(function* () {
          const failure = yield* Effect.flip(
            resolvePnpmfiles({ config: "1.0.0" }, undefined, () =>
              Effect.fail(FetchFailure.make({ reason: "integrityMismatch", message: "pins disagree" }))
            )(ROOT)
          );
          assert.strictEqual(failure.reason, "integrityMismatch");
          assert.include(failure.cause instanceof Error ? failure.cause.message : "", "pins disagree");
          assert.notInclude(failure.cause instanceof Error ? failure.cause.message : "", "pnpm add --config");
        })
    );
  });
}

it.layer(counted({ [`${ROOT}/node_modules/.pnpm-config/stale`]: MemoryFileSystem.symlink(`${ROOT}/missing`) }).layer, {
  timeout: "30 seconds",
})((it) => {
  it.effect("a dangling config symlink is absence during best-effort store discovery", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(resolvePnpmfiles(ROOT, { config: "1.0.0" }));
      assert.strictEqual(failure.reason, "notInstalled");
    })
  );
});

/** One platform and store-root value: only a non-empty root is searched. */
const storeRootsCase = Effect.fnUntraced(function* (platform: string, value: string | undefined) {
  const environment = ConfigProvider.fromUnknown(
    {
      HOME: "/no-home",
      USERPROFILE: "/no-home",
      ...(value === undefined ? {} : { PNPM_HOME: value, XDG_DATA_HOME: value, LOCALAPPDATA: value }),
    },
    { preserveEmptyStrings: true }
  );
  const failure = yield* Effect.flip(resolvePnpmfiles(ROOT, { config: "1.0.0" })).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, environment),
    Effect.provideService(HostProcessPlatform, platform)
  );
  assert.strictEqual(failure.reason, "notInstalled");
  assert.include(
    failure.cause instanceof Error ? failure.cause.message : "",
    value === ROOT ? `searched ${ROOT}/store/v11, ${ROOT}/pnpm/store/v10` : "no pnpm store directory could be located"
  );
});

it.layer(
  counted({
    [`${ROOT}/store/v11`]: MemoryFileSystem.directory(),
    [`${ROOT}/pnpm/store/v10`]: MemoryFileSystem.directory(),
  }).layer,
  { timeout: "30 seconds" }
)((it) => {
  it.effect("environment store roots are expanded and empty values are ignored on both platforms", () =>
    Effect.forEach(
      A.cartesian(["linux", "win32"] as const, [undefined, "", ROOT] as const),
      ([platform, value]) => storeRootsCase(platform, value),
      { discard: true }
    )
  );
});

/** One home-variable environment: only a set `HOME` or `USERPROFILE` names the home-based store roots. */
const homeStoreCase = Effect.fnUntraced(function* (environment: Readonly<Record<string, string>>, expected: string) {
  const failure = yield* Effect.flip(resolvePnpmfiles(ROOT, { config: "1.0.0" })).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment)),
    Effect.provideService(HostProcessPlatform, "linux")
  );
  assert.strictEqual(failure.reason, "notInstalled");
  assert.include(failure.cause instanceof Error ? failure.cause.message : "", expected);
});

it.layer(counted({ "/home/u/.local/share/pnpm/store/v10": MemoryFileSystem.directory() }).layer, {
  timeout: "30 seconds",
})((it) => {
  it.effect("with HOME and USERPROFILE both unset the home-based store roots are absent (no passwd fallback)", () =>
    Effect.gen(function* () {
      yield* homeStoreCase({}, "no pnpm store directory could be located");
      yield* homeStoreCase({ HOME: "/home/u" }, "searched /home/u/.local/share/pnpm/store/v10");
    })
  );
});
