import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { ConfigDependencyHooks, WorkspaceCatalogs, Workspaces } from "@beep/repo-workspaces";
import { HookInjection, NoPeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
import { HookReplay } from "@beep/repo-workspaces/ConfigDependencyReplay";
import { join } from "@beep/utils/Path";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import { assert, describe, it, vi } from "@effect/vitest";
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
  "@beep/repo-workspaces/test/integration/ConfigDependencyHooksSubprocess.int.test/RealFileSystem"
) {}

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
const CJS_FIXTURE = join(FIXTURES, "hook-pnpmfile.cjs");
const MJS_FIXTURE = join(FIXTURES, "hook-pnpmfile.mjs");
const NESTED_MISSING_FIXTURE = join(FIXTURES, "hook-pnpmfile-nested-missing.mjs");
const AGE_4320_FIXTURE = join(FIXTURES, "hook-pnpmfile-age-4320.mjs");
const AGE_1440_FIXTURE = join(FIXTURES, "hook-pnpmfile-age-1440.mjs");
const PEER_RULES_FIXTURE = join(FIXTURES, "hook-pnpmfile-peer-rules.mjs");

const LEGACY_CJS_ONLY_DEP = "cfg-fixture";
const BOTH_PNPMFILES_DEP = "cfg-fixture-both";
const NO_PNPMFILE_DEP = "cfg-fixture-neither";
const NESTED_IMPORT_MISSING_DEP = "cfg-fixture-nested-missing";
const UNPARSEABLE_PNPMFILE_DEP = "cfg-fixture-syntax-error";
const THROWS_WHEN_CALLED_DEP = "cfg-fixture-throwing";
const MALFORMED_EVERY_KEY_DEP = "cfg-fixture-malformed";
const NON_STRING_PEER_RULE_DEP = "cfg-fixture-peer-rules-garbage";
const MERGING_PEER_RULES_DEP = "cfg-fixture-peer-rules";
const AGE_4320_DEP_NAME = "cfg-fixture-age-4320";
const AGE_1440_DEP_NAME = "cfg-fixture-age-1440";
const PASS_THROUGH_DEP = "cfg-fixture-identity";
const SEED = { default: { effect: "^4.0.0" } } as const;

let root: string;

const RealSpawnerOverRealFs = NodeChildProcessSpawner.layer.pipe(Layer.provide(nodeHost));
const HooksSubprocess = ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(nodeHost));

const FixtureLayer = Layer.effect(
  RealFileSystem,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const createConfigDepDir = Effect.fn("createConfigDepDir")(function* (name: string) {
      const dir = join(root, "node_modules", ".pnpm-config", name);
      yield* fs.makeDirectory(dir, { recursive: true });
      yield* fs.writeFileString(join(dir, "package.json"), manifest(name));
      return dir;
    });

    root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-hooks-subprocess-" });
    const cjsDir = yield* createConfigDepDir(LEGACY_CJS_ONLY_DEP);
    yield* fs.makeDirectory(cjsDir, { recursive: true });
    yield* fs.copyFile(CJS_FIXTURE, join(cjsDir, "pnpmfile.cjs"));
    const bothDir = yield* createConfigDepDir(BOTH_PNPMFILES_DEP);
    yield* fs.makeDirectory(bothDir, { recursive: true });
    yield* fs.copyFile(MJS_FIXTURE, join(bothDir, "pnpmfile.mjs"));
    yield* fs.copyFile(CJS_FIXTURE, join(bothDir, "pnpmfile.cjs"));
    yield* createConfigDepDir(NO_PNPMFILE_DEP);
    const nestedDir = yield* createConfigDepDir(NESTED_IMPORT_MISSING_DEP);
    yield* fs.makeDirectory(nestedDir, { recursive: true });
    yield* fs.copyFile(NESTED_MISSING_FIXTURE, join(nestedDir, "pnpmfile.mjs"));
    const syntaxDir = yield* createConfigDepDir(UNPARSEABLE_PNPMFILE_DEP);
    yield* fs.makeDirectory(syntaxDir, { recursive: true });
    yield* fs.writeFileString(join(syntaxDir, "pnpmfile.mjs"), "export const hooks = {\n");
    const throwingDir = yield* createConfigDepDir(THROWS_WHEN_CALLED_DEP);
    yield* fs.makeDirectory(throwingDir, { recursive: true });
    yield* fs.writeFileString(
      join(throwingDir, "pnpmfile.mjs"),
      'export const hooks = {\n\tupdateConfig() {\n\t\tthrow new Error("hook exploded");\n\t},\n};\n'
    );
    const malformedDir = yield* createConfigDepDir(MALFORMED_EVERY_KEY_DEP);
    yield* fs.makeDirectory(malformedDir, { recursive: true });
    yield* fs.writeFileString(
      join(malformedDir, "pnpmfile.mjs"),
      'export const hooks = {\n\tupdateConfig() {\n\t\treturn { catalog: 42, catalogs: ["nope"], minimumReleaseAge: "soon", minimumReleaseAgeExclude: "nope" };\n\t},\n};\n'
    );
    const peerRulesGarbageDir = yield* createConfigDepDir(NON_STRING_PEER_RULE_DEP);
    yield* fs.makeDirectory(peerRulesGarbageDir, { recursive: true });
    yield* fs.writeFileString(
      join(peerRulesGarbageDir, "pnpmfile.mjs"),
      'export const hooks = {\n\tupdateConfig(config) {\n\t\treturn { ...config, peerDependencyRules: { allowedVersions: { "a>b": 1 }, ignoreMissing: ["from-hook"] } };\n\t},\n};\n'
    );
    const peerRulesDir = yield* createConfigDepDir(MERGING_PEER_RULES_DEP);
    yield* fs.makeDirectory(peerRulesDir, { recursive: true });
    yield* fs.copyFile(PEER_RULES_FIXTURE, join(peerRulesDir, "pnpmfile.mjs"));
    const age4320Dir = yield* createConfigDepDir(AGE_4320_DEP_NAME);
    yield* fs.makeDirectory(age4320Dir, { recursive: true });
    yield* fs.copyFile(AGE_4320_FIXTURE, join(age4320Dir, "pnpmfile.mjs"));
    const age1440Dir = yield* createConfigDepDir(AGE_1440_DEP_NAME);
    yield* fs.makeDirectory(age1440Dir, { recursive: true });
    yield* fs.copyFile(AGE_1440_FIXTURE, join(age1440Dir, "pnpmfile.mjs"));
    const identityDir = yield* createConfigDepDir(PASS_THROUGH_DEP);
    yield* fs.writeFileString(
      join(identityDir, "pnpmfile.mjs"),
      "export const hooks = { updateConfig: (config) => config };\n"
    );
    return fs;
  })
).pipe(Layer.provide(nodeHost));

it.layer(FixtureLayer, { timeout: "30 seconds" })((it) => {
  describe("ConfigDependencyHooks.layerSubprocess — replays the pnpmfile in a real node child process over real fixtures on disk", () => {
    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("loads the config dependency's updateConfig and injects its catalogs", () => {
        const markerPath = join(root, "subprocess-marker.txt");
        vi.stubEnv("HOOK_MARKER", markerPath);
        return Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [LEGACY_CJS_ONLY_DEP]: "1.0.0" }, SEED);
          assert.strictEqual(result.catalogs.default?.["hooked-dep"], "^9.9.9");
          assert.strictEqual(
            result.catalogs.default?.effect,
            "^4.0.0",
            "the seed survived beside the injections into the default and a named catalog, identical to the layerLive assertions"
          );
          assert.strictEqual(result.catalogs.extra?.["extra-dep"], "^1.2.3");
          assert.deepStrictEqual(result.releaseAge, {});
          const markerWritten = yield* (yield* RealFileSystem).exists(markerPath);
          assert.isTrue(
            markerWritten,
            "the marker proves the fixture executed in the child, which inherits the environment"
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

    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("the child preserves an own __proto__ catalog beside a normal named catalog", () =>
        Effect.gen(function* () {
          const named = R.fromEntries([
            ["__proto__", { effect: "^4.0.0" }],
            ["named", { foo: "^1" }],
          ]);
          const seed = { default: { typescript: "^6" }, ...named };
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [PASS_THROUGH_DEP]: "1.0.0" }, seed);
          assert.deepStrictEqual(result.catalogs.default, seed.default);
          assert.isTrue(R.has(result.catalogs, "__proto__"));
          assert.deepStrictEqual(R.get(result.catalogs, "__proto__"), O.some({ effect: "^4.0.0" }));
          assert.deepStrictEqual(
            R.keys(result.catalogs),
            ["__proto__", "named", "default"],
            "the parent folds the named catalogs first and the default catalog last"
          );
        })
      );
    });

    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("surfaces the release-age keys a hook sets", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [AGE_1440_DEP_NAME]: "1.0.0" }, SEED);
          assert.deepStrictEqual(result.releaseAge, { ageMinutes: 1440, exclude: ["@scope/b"] });
          assert.deepStrictEqual(result.catalogs, SEED);
        })
      );
    });

    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("threads release-age keys last-hook-wins over ONE config object, in declaration order", () =>
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
            "age-4320 then age-1440: the later, lower 1440 wins, last-wins threading and not a strictest-wins merge inside the replay"
          );
        })
      );
    });
  });

  describe("ConfigDependencyHooks.layerSubprocess — a malformed peer-rules axis", () => {
    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("drops a non-string allowedVersions entry INSIDE the child, before the next hook reads it", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(
            root,
            { [NON_STRING_PEER_RULE_DEP]: "1.0.0", [MERGING_PEER_RULES_DEP]: "1.0.0" },
            SEED,
            { allowedVersions: { "seeded>peer": "1.0.0" }, ignoreMissing: [], allowAny: [] }
          );
          assert.deepStrictEqual(
            result.peerDependencyRules.allowedVersions,
            { "seeded>peer": "1.0.0", "hooked-parent>hooked-peer": "^9.0.0" },
            'the replay script carries its own copy of the threading helpers, so the axis rules hold on both sides or the layers stop being interchangeable; the child copy shows only through a second, merging hook: kept, the object-shaped { "a>b": 1 } the first one wrote would make the parent reject the whole axis and lose the good hooked entry'
          );
          assert.deepStrictEqual(
            result.peerDependencyRules.ignoreMissing,
            ["from-hook"],
            "the garbage hook's well-formed sibling axis still lands: one bad axis never takes a good one down with it"
          );
        })
      );
    });
  });

  describe("ConfigDependencyHooks.layerSubprocess — pnpm 11 loader order and skip discrimination", () => {
    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("tries pnpmfile.mjs FIRST when both files exist — the .cjs is never loaded", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [BOTH_PNPMFILES_DEP]: "1.0.0" }, SEED);
          assert.strictEqual(result.catalogs.default?.["mjs-dep"], "^2.0.0");
          assert.strictEqual(result.catalogs.mjsExtra?.["mjs-extra-dep"], "^3.4.5");
          assert.isUndefined(result.catalogs.default?.["hooked-dep"]);
          assert.isUndefined(
            result.catalogs.extra,
            "the .mjs injects entries distinct from the .cjs, so its present and the .cjs absent injections prove which file loaded"
          );
        })
      );
    });

    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("a config dependency with no pnpmfile contributes nothing, not a failure — and spawns nothing", () =>
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
            "installed at the declared version with no pnpmfile candidate: the legitimate skip, decided and recorded in the parent though nothing was spawned"
          );
        })
      );
    });

    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("a declared config dependency installed nowhere fails closed BEFORE any spawn", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { "absent-dep": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(
            error.path,
            "absent-dep",
            "no .pnpm-config/absent-dep/ directory and no store copy: the parent's ladder fails typed, identical to layerLive"
          );
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          assert.include(error.cause.message, "pnpm add --config absent-dep@1.0.0");
        })
      );
    });

    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("a pnpmfile whose OWN nested import is missing fails typed, never silently skipped", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { [NESTED_IMPORT_MISSING_DEP]: "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(
            error.path,
            NESTED_IMPORT_MISSING_DEP,
            "ERR_MODULE_NOT_FOUND for the nested module: the parent resolved the pnpmfile itself, so any import failure in the child is real and must surface typed, the case a broad ERR_MODULE_NOT_FOUND-means-no-pnpmfile skip would swallow"
          );
        })
      );
    });
  });

  describe("ConfigDependencyHooks.layerSubprocess — load/replay failures name the dependency", () => {
    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("a pnpmfile with a syntax error fails typed, naming that dependency", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { [UNPARSEABLE_PNPMFILE_DEP]: "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(
            error.path,
            UNPARSEABLE_PNPMFILE_DEP,
            "a real load failure, not an absent file; written inline because a committed syntax-error fixture would trip the repo lint gates"
          );
        })
      );
    });

    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("a hook that throws when called fails typed, naming that dependency", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { [THROWS_WHEN_CALLED_DEP]: "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, THROWS_WHEN_CALLED_DEP);
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          assert.include(
            String(error.cause.message),
            "hook exploded",
            "the child-side failure detail crossed the process boundary"
          );
        })
      );
    });

    it.layer(HooksSubprocess, { timeout: "30 seconds" })((it) => {
      it.effect("a config dependency name with a '..' segment fails typed", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { "../../evil": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, "../../evil");
        })
      );
    });
  });

  class InProcessHooks extends Context.Service<InProcessHooks, ConfigDependencyHooks["Service"]>()(
    "@beep/repo-workspaces/test/integration/ConfigDependencyHooksSubprocess.int.test/InProcessHooks"
  ) {}
  const ParityHooks = Layer.mergeAll(
    Layer.effect(InProcessHooks, ConfigDependencyHooks).pipe(
      Layer.provide(ConfigDependencyHooks.layerLive),
      Layer.provide(nodeHost)
    ),
    HooksSubprocess
  );

  describe("ConfigDependencyHooks.layerSubprocess — drop-in interchangeable with layerLive", () => {
    it.layer(ParityHooks, { timeout: "30 seconds" })((it) => {
      it.effect("the two layers produce identical HookInjections for the same root and dependencies", () => {
        const deps = {
          [LEGACY_CJS_ONLY_DEP]: "1.0.0",
          [MALFORMED_EVERY_KEY_DEP]: "1.0.0",
          [AGE_1440_DEP_NAME]: "1.0.0",
        };
        return Effect.gen(function* () {
          const inProcess = yield* (yield* InProcessHooks).inject(root, deps, SEED);
          const subprocess = yield* (yield* ConfigDependencyHooks).inject(root, deps, SEED);
          assert.deepStrictEqual(
            subprocess,
            inProcess,
            "layerSubprocess exists because a bundler compiles layerLive's computed import() into a context module that cannot resolve at runtime, so the two must be interchangeable; the malformed hook between two good ones is threaded tolerantly by both copies of configOf, finiteNumberOr and stringArrayOr, each key falling back to the prior threaded value, not the seed"
          );
          assert.strictEqual(
            subprocess.catalogs.default?.["hooked-dep"],
            "^9.9.9",
            "the parity is over a well-formed outcome: the first hook's catalog injections survived the malformed rewrite"
          );
          assert.strictEqual(subprocess.catalogs.extra?.["extra-dep"], "^1.2.3");
          assert.deepStrictEqual(
            subprocess.releaseAge,
            { ageMinutes: 1440, exclude: ["@scope/b"] },
            "the last hook's release-age keys landed on the threaded object"
          );
        });
      });
    });
  });

  describe("Workspaces.layerWithConfigDependenciesSubprocess — releaseAgeGate reaches the hooks", () => {
    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const mirroredInstallTree: Tree = {
            [`${root}/pnpm-workspace.yaml`]: A.join(
              [
                "packages:",
                "  - packages/*",
                "catalog:",
                "  effect: ^4.0.0",
                "minimumReleaseAge: 720",
                "configDependencies:",
                `  ${AGE_1440_DEP_NAME}: '1.0.0'`,
                "",
              ],
              "\n"
            ),
            [`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
            [`${root}/packages/a/package.json`]: manifest("@x/a"),
            [`${root}/node_modules/.pnpm-config/${AGE_1440_DEP_NAME}/package.json`]: manifest(AGE_1440_DEP_NAME),
            [`${root}/node_modules/.pnpm-config/${AGE_1440_DEP_NAME}/pnpmfile.mjs`]: "",
          };
          const appLayer = Workspaces.layerWithConfigDependenciesSubprocess({ cwd: root }).pipe(
            Layer.provide(RealSpawnerOverRealFs),
            Layer.provideMerge(platform(mirroredInstallTree))
          );
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "combines inline + subprocess-replayed hook sources strictest-wins, given only the real spawner beyond the tree",
        () =>
          Effect.gen(function* () {
            const catalogs = yield* WorkspaceCatalogs;
            const gate = yield* catalogs.releaseAgeGate;
            assert.strictEqual(gate.ageMinutes, 1440, "inline 720 vs the hook's 1440: the strictest (max) wins");
            assert.deepStrictEqual([...gate.exclude], ["@scope/b"]);
            const set = yield* catalogs.set;
            assert.strictEqual(
              set.entries.default?.effect,
              "^4.0.0",
              "the inline catalog still assembled through the same pass"
            );
          })
      );
    });
  });
});
