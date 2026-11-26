import { ScriptedSpawner } from "@beep/commands";
import { Git } from "@beep/git";
import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import {
  CatalogSet,
  ChangeDetector,
  ConfigDependencyHooks,
  WorkspaceCatalogs,
  WorkspaceSnapshots,
  Workspaces,
} from "@beep/repo-workspaces";
import { HookInjection, NoPeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
import { HookReplay } from "@beep/repo-workspaces/ConfigDependencyReplay";
import { join } from "@beep/utils/Path";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { manifest, platform } from "../support/fixtures.ts";
import { nodeHost } from "./utils/nodeFixture.ts";
import type { Tree } from "../support/fixtures.ts";

class RealFileSystem extends Context.Service<RealFileSystem, FileSystem.FileSystem>()(
  "@beep/repo-workspaces/test/integration/ConfigDependencyHooks.int.test/RealFileSystem"
) {}

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
const CJS_FIXTURE = join(FIXTURES, "hook-pnpmfile.cjs");
const MJS_FIXTURE = join(FIXTURES, "hook-pnpmfile.mjs");
const NESTED_MISSING_FIXTURE = join(FIXTURES, "hook-pnpmfile-nested-missing.mjs");
const AGE_4320_FIXTURE = join(FIXTURES, "hook-pnpmfile-age-4320.mjs");
const AGE_1440_FIXTURE = join(FIXTURES, "hook-pnpmfile-age-1440.mjs");
const AGE_GARBAGE_FIXTURE = join(FIXTURES, "hook-pnpmfile-age-garbage.mjs");
const PEER_RULES_FIXTURE = join(FIXTURES, "hook-pnpmfile-peer-rules.mjs");

const LEGACY_CJS_ONLY_DEP = "cfg-fixture";
const MJS_ONLY_PNPM11_DEP = "cfg-fixture-mjs";
const NO_PNPMFILE_DEP = "cfg-fixture-neither";
const NESTED_IMPORT_MISSING_DEP = "cfg-fixture-nested-missing";
const AGE_4320_DEP_NAME = "cfg-fixture-age-4320";
const AGE_1440_DEP_NAME = "cfg-fixture-age-1440";
const AGE_GARBAGE_DEP_NAME = "cfg-fixture-age-garbage";
const PEER_RULE_INJECTING_DEP = "cfg-fixture-peer-rules";
const SEED = { default: { effect: "^4.0.0" } } as const;

let root: string;

const configDepDir = Effect.fn("configDepDir")(function* (name: string) {
  const fs = yield* RealFileSystem;
  const dir = join(root, "node_modules", ".pnpm-config", name);
  yield* fs.makeDirectory(dir, { recursive: true });
  yield* fs.writeFileString(join(dir, "package.json"), manifest(name));
  return dir;
});

const FixtureLayer = Layer.effect(
  RealFileSystem,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const createInstalledAtDeclaredVersion = Effect.fn("createConfigDepDir")(function* (name: string) {
      const dir = join(root, "node_modules", ".pnpm-config", name);
      yield* fs.makeDirectory(dir, { recursive: true });
      yield* fs.writeFileString(join(dir, "package.json"), manifest(name));
      return dir;
    });

    root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-hooks-" });
    const cjsDir = yield* createInstalledAtDeclaredVersion(LEGACY_CJS_ONLY_DEP);
    yield* fs.makeDirectory(cjsDir, { recursive: true });
    yield* fs.copyFile(CJS_FIXTURE, join(cjsDir, "pnpmfile.cjs"));
    const mjsDir = yield* createInstalledAtDeclaredVersion(MJS_ONLY_PNPM11_DEP);
    yield* fs.makeDirectory(mjsDir, { recursive: true });
    yield* fs.copyFile(MJS_FIXTURE, join(mjsDir, "pnpmfile.mjs"));
    yield* createInstalledAtDeclaredVersion(NO_PNPMFILE_DEP);
    const nestedDir = yield* createInstalledAtDeclaredVersion(NESTED_IMPORT_MISSING_DEP);
    yield* fs.makeDirectory(nestedDir, { recursive: true });
    yield* fs.copyFile(NESTED_MISSING_FIXTURE, join(nestedDir, "pnpmfile.mjs"));
    const age4320Dir = yield* createInstalledAtDeclaredVersion(AGE_4320_DEP_NAME);
    yield* fs.makeDirectory(age4320Dir, { recursive: true });
    yield* fs.copyFile(AGE_4320_FIXTURE, join(age4320Dir, "pnpmfile.mjs"));
    const age1440Dir = yield* createInstalledAtDeclaredVersion(AGE_1440_DEP_NAME);
    yield* fs.makeDirectory(age1440Dir, { recursive: true });
    yield* fs.copyFile(AGE_1440_FIXTURE, join(age1440Dir, "pnpmfile.mjs"));
    const ageGarbageDir = yield* createInstalledAtDeclaredVersion(AGE_GARBAGE_DEP_NAME);
    yield* fs.makeDirectory(ageGarbageDir, { recursive: true });
    yield* fs.copyFile(AGE_GARBAGE_FIXTURE, join(ageGarbageDir, "pnpmfile.mjs"));
    const peerRulesDir = yield* createInstalledAtDeclaredVersion(PEER_RULE_INJECTING_DEP);
    yield* fs.makeDirectory(peerRulesDir, { recursive: true });
    yield* fs.copyFile(PEER_RULES_FIXTURE, join(peerRulesDir, "pnpmfile.mjs"));
    return fs;
  })
).pipe(Layer.provideMerge(nodeHost));

const mirroredInstall = (name: string, pnpmfile: string): Tree => ({
  [`${root}/node_modules/.pnpm-config/${name}/package.json`]: manifest(name),
  [`${root}/node_modules/.pnpm-config/${name}/${pnpmfile}`]: "",
});

it.layer(FixtureLayer, { timeout: "30 seconds" })((it) => {
  describe("ConfigDependencyHooks.layerLive — replays the pnpmfile", () => {
    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("loads the config dependency's updateConfig and injects its catalogs", () => {
        const markerPath = join(root, "live-marker.txt");
        vi.stubEnv("HOOK_MARKER", markerPath);
        return Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [LEGACY_CJS_ONLY_DEP]: "1.0.0" }, SEED);
          assert.strictEqual(result.catalogs.default?.["hooked-dep"], "^9.9.9");
          assert.strictEqual(
            result.catalogs.default?.effect,
            "^4.0.0",
            "the seed survived beside the injections into the default catalog and a named one"
          );
          assert.strictEqual(result.catalogs.extra?.["extra-dep"], "^1.2.3");
          assert.deepStrictEqual(
            result.releaseAge,
            {},
            "this fixture sets no release-age keys, so it contributes an empty gate"
          );
          const markerWritten = yield* (yield* RealFileSystem).exists(markerPath);
          assert.isTrue(
            markerWritten,
            "the side-effect marker proves the real pnpmfile.cjs, copied from the committed fixture under a temp root since node_modules is gitignored, executed"
          );
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              vi.unstubAllEnvs();
            })
          )
        );
      });
    });

    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a declared config dependency that is installed nowhere fails closed, never a silent skip", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { "absent-dep": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(
            error.path,
            "absent-dep",
            "no .pnpm-config/absent-dep/ directory and no store copy: the declared version cannot be honoured, and a silent skip here is how a hook-only catalog went missing on one side of a diff"
          );
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          assert.include(error.cause.message, "pnpm add --config absent-dep@1.0.0");
        })
      );
    });
  });

  describe("ConfigDependencyHooks.layerLive — pnpm 11 .mjs pnpmfile and load discrimination", () => {
    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("an .mjs-only config dependency replays its hook — proving .mjs is loaded", () => {
        const markerPath = join(root, "mjs-marker.txt");
        vi.stubEnv("HOOK_MARKER", markerPath);
        return Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [MJS_ONLY_PNPM11_DEP]: "1.0.0" }, SEED);
          assert.strictEqual(result.catalogs.default?.["mjs-dep"], "^2.0.0");
          assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
          assert.strictEqual(
            result.catalogs.mjsExtra?.["mjs-extra-dep"],
            "^3.4.5",
            "the dep ships only pnpmfile.mjs, tried first and replayed: the distinct mjs-dep and mjsExtra entries prove the .mjs loaded, with no .cjs to have loaded, and the seed survived"
          );
          const markerWritten = yield* (yield* RealFileSystem).exists(markerPath);
          assert.isTrue(markerWritten, "the side-effect marker proves the .mjs fixture actually executed");
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              vi.unstubAllEnvs();
            })
          )
        );
      });
    });

    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect(
        "a config-dependency directory with neither pnpmfile.mjs nor pnpmfile.cjs is skipped, not a failure",
        () =>
          Effect.gen(function* () {
            const hooks = yield* ConfigDependencyHooks;
            const result = yield* hooks.inject(root, { [NO_PNPMFILE_DEP]: "1.0.0" }, SEED);
            assert.deepStrictEqual(
              result,
              HookInjection.make({
                catalogs: SEED,
                releaseAge: {},
                peerDependencyRules: NoPeerDependencyRules,
                replays: { [NO_PNPMFILE_DEP]: HookReplay.make({ version: "1.0.0", source: "installed" }) },
              }),
              "the directory exists at the declared version with no pnpmfile candidate, the one legitimate skip: resolved, so recorded, and contributing nothing"
            );
          })
      );
    });

    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a pnpmfile whose OWN nested import is missing fails typed, never silently skipped", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { [NESTED_IMPORT_MISSING_DEP]: "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(
            error.path,
            NESTED_IMPORT_MISSING_DEP,
            "pnpmfile.mjs statically imports a module that does not resolve: ERR_MODULE_NOT_FOUND for the nested module, err.url differing from the candidate URL, must surface typed, the case a broad ERR_MODULE_NOT_FOUND-means-no-pnpmfile skip would swallow"
          );
        })
      );
    });
  });

  describe("ConfigDependencyHooks.layerLive — rejects a traversal name before import()", () => {
    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a config dependency version with a '..' segment fails typed before hook replay", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          for (const version of ["../../outside", "..\\..\\outside", "../../outside+sha512-pin"]) {
            const error = yield* Effect.flip(hooks.inject(root, { [LEGACY_CJS_ONLY_DEP]: version }, SEED));
            assert.instanceOf(error, CatalogAssemblyError);
            assert.strictEqual(error.source, "hooks");
            assert.strictEqual(error.path, LEGACY_CJS_ONLY_DEP);
            assert.include(error.cause instanceof Error ? error.cause.message : "", "version has a '..' path segment");
          }
        })
      );
    });

    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a single-segment prerelease containing '..' still resolves at its declared version", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const name = "cfg-dotted-prerelease";
          const version = "1.0.0-beta..1";
          const dir = yield* configDepDir(name);
          yield* (yield* RealFileSystem).writeFileString(join(dir, "package.json"), manifest(name, { version }));
          const result = yield* hooks.inject(root, { [name]: version }, SEED);
          assert.deepStrictEqual(
            result,
            HookInjection.make({
              catalogs: SEED,
              releaseAge: {},
              peerDependencyRules: NoPeerDependencyRules,
              replays: { [name]: HookReplay.make({ version, source: "installed" }) },
            })
          );
        })
      );
    });

    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a config dependency name with a '..' segment fails typed, never escaping .pnpm-config", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { "../../evil": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(
            error.path,
            "../../evil",
            "../../evil would import() a path outside .pnpm-config; the guard rejects it typed, on the hooks source, before any path is built"
          );
        })
      );
    });

    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a scoped name (a legitimate '/') is NOT rejected — only '..' segments are", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          yield* configDepDir("@scope/pkg");
          const result = yield* hooks.inject(root, { "@scope/pkg": "1.0.0" }, SEED);
          assert.deepStrictEqual(
            result,
            HookInjection.make({
              catalogs: SEED,
              releaseAge: {},
              peerDependencyRules: NoPeerDependencyRules,
              replays: { "@scope/pkg": HookReplay.make({ version: "1.0.0", source: "installed" }) },
            }),
            "@scope/pkg has a / but no ..: it resolves inside .pnpm-config, installed at 1.0.0 with no pnpmfile, and contributes nothing, the seed passing through"
          );
        })
      );
    });
  });

  describe("Workspaces.layer default — provably never executes a config dependency's pnpmfile", () => {
    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const treeAtRealTempRoot: Tree = {
            [`${root}/pnpm-workspace.yaml`]: A.join(
              [
                "packages:",
                "  - packages/*",
                "catalog:",
                "  effect: ^4.0.0",
                "configDependencies:",
                `  ${LEGACY_CJS_ONLY_DEP}: '1.0.0'`,
                "",
              ],
              "\n"
            ),
            [`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
            [`${root}/packages/a/package.json`]: manifest("@x/a", { dependencies: { effect: "catalog:" } }),
          };
          const defaultLayer = Workspaces.layer({ cwd: root }).pipe(Layer.provideMerge(platform(treeAtRealTempRoot)));
          return defaultLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("set() succeeds and the real pnpmfile marker is never written under the DEFAULT layer", () => {
        const markerPath = join(root, "default-layer-marker.txt");
        vi.stubEnv("HOOK_MARKER", markerPath);

        return Effect.gen(function* () {
          const catalogs = yield* WorkspaceCatalogs;
          const set = yield* catalogs.set;
          const inlineCatalogAssembled = set.rangeOf("effect", O.none());
          assertSome(inlineCatalogAssembled, "^4.0.0");
          const markerWritten = yield* (yield* RealFileSystem).exists(markerPath);
          assert.isFalse(
            markerWritten,
            "the default Workspaces.layer wires ConfigDependencyHooks.layerNoop, so assembly never imports the real pnpmfile.cjs FixtureLayer copied under root; under layerLive the marker appears, the discriminating test whose absence let the default silently regress"
          );
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              vi.unstubAllEnvs();
            })
          )
        );
      });
    });
  });

  const noSpawns = ScriptedSpawner.make((command, args) => {
    throw new Error(`unexpected spawn: ${command} ${A.join(args, " ")}; composing this layer must not shell out`);
  });

  describe("Workspaces.layerWithGitAndConfigDependencies — git tier over replaying catalogs, discriminated against layerWithGit", () => {
    const hookedTree = (): Tree => ({
      [`${root}/pnpm-workspace.yaml`]: A.join(
        [
          "packages:",
          "  - packages/*",
          "catalog:",
          "  effect: ^4.0.0",
          "configDependencies:",
          `  ${LEGACY_CJS_ONLY_DEP}: '1.0.0'`,
          "",
        ],
        "\n"
      ),
      [`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
      [`${root}/packages/a/package.json`]: manifest("@x/a", { dependencies: { effect: "catalog:" } }),
      ...mirroredInstall(LEGACY_CJS_ONLY_DEP, "pnpmfile.cjs"),
    });

    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const appLayer = Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(
            Layer.provideMerge(platform(hookedTree())),
            Layer.provideMerge(noSpawns.layer)
          );
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("assembles the hook-injected catalog AND provides the git tier in one composite", () =>
        Effect.gen(function* () {
          const catalogs = yield* WorkspaceCatalogs;
          const set = yield* catalogs.set;
          const inlineCatalogControl = set.rangeOf("effect", O.none());
          assertSome(inlineCatalogControl, "^4.0.0");
          const hookedCatalogFromReplay = set.rangeOf("hooked-dep", O.none());
          assertSome(hookedCatalogFromReplay, "^9.9.9");
          const WorkspaceSnapshots4 = yield* WorkspaceSnapshots;
          assert.isDefined(
            WorkspaceSnapshots4,
            "a composite that quietly wired the no-op catalogs would pass every is-the-service-present check like this one, so the replayed hooked-dep and its layerWithGit control are the discrimination: same tree, fixture and assertions, only the composite differs"
          );
          const ChangeDetector5 = yield* ChangeDetector;
          assert.isDefined(ChangeDetector5);
          const Git6 = yield* Git;
          assert.isDefined(
            Git6,
            "Git is provided but never invoked; before this composite a consumer rebuilt the whole layerWithGit service graph by hand, since layerWithGit hard-wires the no-op catalogs layer"
          );
        })
      );
    });

    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const appLayer = Workspaces.layerWithGit({ cwd: root }).pipe(
            Layer.provideMerge(platform(hookedTree())),
            Layer.provideMerge(noSpawns.layer)
          );
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("layerWithGit over the same tree sees no hook-injected catalog — the control", () =>
        Effect.gen(function* () {
          const catalogs = yield* WorkspaceCatalogs;
          const set = yield* catalogs.set;
          assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
          const defaultRunsNoConfigDependencyCode = set.rangeOf("hooked-dep", O.none());
          assertNone(defaultRunsNoConfigDependencyCode);
        })
      );
    });

    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const seedCatalogs = CatalogSet.make({ entries: { default: { "seeded-dep": "^1.0.0" } } });
          const appLayer = Workspaces.layerWithGitAndConfigDependencies({ cwd: root, seedCatalogs }).pipe(
            Layer.provideMerge(platform(hookedTree())),
            Layer.provideMerge(noSpawns.layer)
          );
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("threads seedCatalogs through to the snapshots it provides", () =>
        Effect.gen(function* () {
          const snapshots = yield* WorkspaceSnapshots;
          const live = yield* snapshots.worktree;
          assertSome(live.resolve("seeded-dep", "catalog:"), "^1.0.0");
        })
      );
    });
  });

  describe("ConfigDependencyHooks.layerNoop — provably never loads the pnpmfile", () => {
    it.layer(ConfigDependencyHooks.layerNoop, { timeout: "30 seconds" })((it) => {
      it.effect("returns the seed untouched and executes no config-dependency code", () => {
        const markerPath = join(root, "noop-marker.txt");
        vi.stubEnv("HOOK_MARKER", markerPath);
        return Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [LEGACY_CJS_ONLY_DEP]: "1.0.0" }, SEED);
          assert.deepStrictEqual(
            result,
            HookInjection.make({
              catalogs: SEED,
              releaseAge: {},
              peerDependencyRules: NoPeerDependencyRules,
              replays: {},
            }),
            "same root and declared config dependency as the live test, only the layer differs: the seed is unchanged and nothing was resolved, so nothing is recorded as replayed"
          );
          const markerWritten = yield* (yield* RealFileSystem).exists(markerPath);
          assert.isFalse(
            markerWritten,
            "the marker the fixture would write if it ran stays absent: the default catalog path never loads the pnpmfile"
          );
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              vi.unstubAllEnvs();
            })
          )
        );
      });
    });

    it.layer(ConfigDependencyHooks.layerNoop, { timeout: "30 seconds" })((it) => {
      it.effect("contributes an empty release-age gate — the no-op runs no hooks", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [AGE_4320_DEP_NAME]: "1.0.0" }, SEED);
          assert.deepStrictEqual(
            result.releaseAge,
            {},
            "declaring the age-setting config dependency changes nothing under the no-op: it runs no hooks"
          );
        })
      );
    });
  });

  describe("ConfigDependencyHooks.layerLive — surfaces the release-age keys hooks set", () => {
    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a hook's numeric minimumReleaseAge and array exclude become the gate contribution", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [AGE_1440_DEP_NAME]: "1.0.0" }, SEED);
          assert.deepStrictEqual(
            result.releaseAge,
            { ageMinutes: 1440, exclude: ["@scope/b"] },
            "the age-1440 fixture sets minimumReleaseAge 1440 and minimumReleaseAgeExclude [@scope/b], mapped onto ageMinutes and exclude"
          );
          assert.deepStrictEqual(result.catalogs, SEED);
        })
      );
    });

    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a later hook rewrites an earlier hook's release-age value — last-wins, not max", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(
            root,
            { [AGE_4320_DEP_NAME]: "1.0.0", [AGE_1440_DEP_NAME]: "1.0.0" },
            SEED
          );
          assert.deepStrictEqual(
            result.releaseAge,
            { ageMinutes: 1440, exclude: ["@scope/b"] },
            "age-4320 then age-1440 replayed in order: threading is last-wins over one config object as pnpm replays, so the later, lower 1440 wins where a strictest-wins merge would keep 4320, and the exclude is last-wins too (@scope/b, not @scope/a)"
          );
        })
      );
    });

    it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
      it.effect("a hook returning garbage release-age values drops them — tolerant, never a typed failure", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [AGE_GARBAGE_DEP_NAME]: "1.0.0" }, SEED);
          assert.deepStrictEqual(
            result.releaseAge,
            {},
            "the age-garbage fixture returns a non-numeric age and a non-array exclude; a hook's returned data is read tolerantly and only a load or replay mechanism failure is typed"
          );
        })
      );
    });
  });

  describe("WorkspaceCatalogs.releaseAgeGate — combines inline + hook sources strictest-wins", () => {
    const treeWith = (inlineAge: number, inlineExclude: readonly string[], dep: string): Tree => ({
      [`${root}/pnpm-workspace.yaml`]: A.join(
        [
          "packages:",
          "  - packages/*",
          `minimumReleaseAge: ${inlineAge}`,
          ...(inlineExclude.length > 0
            ? ["minimumReleaseAgeExclude:", ...A.map(inlineExclude, (pattern) => `  - "${pattern}"`)]
            : []),
          "configDependencies:",
          `  ${dep}: '1.0.0'`,
          "",
        ],
        "\n"
      ),
      [`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
      [`${root}/packages/a/package.json`]: manifest("@x/a"),
      ...mirroredInstall(dep, "pnpmfile.mjs"),
    });

    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const tree = treeWith(1440, ["inline-excl"], AGE_4320_DEP_NAME);
          const appLayer = Workspaces.layerWithConfigDependencies({ cwd: root }).pipe(
            Layer.provideMerge(platform(tree))
          );
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("the hook's stricter age wins and excludes union", () =>
        Effect.gen(function* () {
          const catalogs = yield* WorkspaceCatalogs;
          const gate = yield* catalogs.releaseAgeGate;
          assert.strictEqual(gate.ageMinutes, 4320, "inline 1440 vs hook 4320: the max is the hook's 4320");
          assert.deepStrictEqual(
            [...gate.exclude].sort(),
            ["@scope/a", "inline-excl", "typescript"],
            "excludes union: the inline pattern plus the hook's two, deduped"
          );
        })
      );
    });

    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const tree = treeWith(10_000, [], AGE_1440_DEP_NAME);
          const appLayer = Workspaces.layerWithConfigDependencies({ cwd: root }).pipe(
            Layer.provideMerge(platform(tree))
          );
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("the inline stricter age wins", () =>
        Effect.gen(function* () {
          const catalogs = yield* WorkspaceCatalogs;
          const gate = yield* catalogs.releaseAgeGate;
          assert.strictEqual(gate.ageMinutes, 10_000, "inline 10000 vs hook 1440: the max is the inline 10000");
          assert.deepStrictEqual(
            [...gate.exclude],
            ["@scope/b"],
            "only the hook set an exclude here; an empty inline exclude emits no bare minimumReleaseAgeExclude: key, whose null value pnpm treats as no excludes"
          );
        })
      );
    });
  });

  describe("WorkspaceCatalogs.peerDependencyRules — the injected rules reach the caller", () => {
    const tree = (): Tree => ({
      [`${root}/pnpm-workspace.yaml`]: A.join(
        [
          "packages:",
          "  - packages/*",
          "peerDependencyRules:",
          "  allowedVersions:",
          '    "inline-parent@1.2.3>inline-peer": "^1.0.0"',
          "configDependencies:",
          `  ${PEER_RULE_INJECTING_DEP}: '1.0.0'`,
          "",
        ],
        "\n"
      ),
      [`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
      [`${root}/packages/a/package.json`]: manifest("@x/a"),
      ...mirroredInstall(PEER_RULE_INJECTING_DEP, "pnpmfile.mjs"),
    });

    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const appLayer = Workspaces.layerWithConfigDependencies({ cwd: root }).pipe(
            Layer.provideMerge(platform(tree()))
          );
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("a hook-injected rule arrives, alongside the seeded workspace-file rule", () =>
        Effect.gen(function* () {
          const catalogs = yield* WorkspaceCatalogs;
          const rules = yield* catalogs.peerDependencyRules;

          assert.strictEqual(
            rules.allowedVersions["hooked-parent>hooked-peer"],
            "^9.0.0",
            "fails if the call site stops reading injection.peerDependencyRules, and only then: a discard-by-projection there compiled, passed every seam unit test and returned an empty rules set indistinguishable from a workspace declaring none"
          );
          assert.strictEqual(
            rules.allowedVersions["inline-parent@1.2.3>inline-peer"],
            "^1.0.0",
            "the seeded workspace-file half, in the parent-versioned spelling pnpm:export materializes, survives the replay, which is why seeding works"
          );
          assert.strictEqual(
            R.keys(rules.allowedVersions).length,
            2,
            "both key spellings coexist, unversioned from the plugin and versioned from the file"
          );
        })
      );
    });

    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const appLayer = Workspaces.layerWithConfigDependencies({ cwd: root }).pipe(
            Layer.provideMerge(platform(tree()))
          );
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("the unconsumed axes arrive empty rather than absent", () =>
        Effect.gen(function* () {
          const rules = yield* (yield* WorkspaceCatalogs).peerDependencyRules;
          assert.deepStrictEqual(rules.ignoreMissing, []);
          assert.deepStrictEqual(rules.allowAny, []);
        })
      );
    });
  });
});
