import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { ConfigDependencyHooks, WorkspaceCatalogs, Workspaces } from "@beep/repo-workspaces";
import { HookInjection, NoPeerDependencyRules, PeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
import { HookReplay } from "@beep/repo-workspaces/ConfigDependencyReplay";
import { join } from "@beep/utils/Path";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { manifest, platform } from "../support/fixtures.ts";
import {
  installConfigDependency,
  installedDir,
  linkConfigDependency,
  pnpmfileInjecting,
  pnpmfileInjectingCjs,
  storeConfigDependency,
  writeModulesYaml,
} from "./utils/configDependencyFixtures.ts";
import { nodeHost } from "./utils/nodeFixture.ts";
import type { Vitest } from "@effect/vitest";
import type { Tree } from "../support/fixtures.ts";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
const SEED = { default: { effect: "^4.0.0" } } as const;

const NAME = "cfg-ladder";
const NO_HOOK = "cfg-nohook";
const NO_MANIFEST = "cfg-nomanifest";
const UNVERSIONED = "cfg-unversioned";
const EMPTY_VERSION = "cfg-emptyversion";
const STORE_ONLY_PNPMFILE_JS = "cfg-js";
const STORE_ONLY_SCOPED = "@scope/cfg-scoped";
const AMBIGUOUS = "cfg-ambiguous";
const ENV_ONLY = "cfg-env";
const TWO_STORES = "cfg-twostores";
const FORMATS = "cfg-formats";

let root: string;
let store: string;
let storeReal: string;
let linkedRoot: string;
let bareRoot: string;
let envHome: string;
let aliasRoot: string;

const HooksLive = ConfigDependencyHooks.layerLive.pipe(Layer.provide(nodeHost));
const HooksSubprocess = ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(nodeHost));

const withOnlyPnpmHome = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ PNPM_HOME: envHome }));

const OnDiskFixtureBuiltOnce = Layer.effectDiscard(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const temp = (prefix: string) => fs.makeTempDirectoryScoped({ prefix });
    root = yield* temp("effected-ladder-root-");
    const temp1 = yield* temp("effected-ladder-store-");
    store = path.join(temp1, "v11");
    yield* fs.makeDirectory(store, { recursive: true });
    storeReal = yield* fs.realPath(store);
    linkedRoot = yield* temp("effected-ladder-linked-");
    bareRoot = yield* temp("effected-ladder-bare-");

    yield* writeModulesYaml(root, store);
    yield* installConfigDependency(root, NAME, "1.0.0", ["pnpmfile.mjs", pnpmfileInjecting("^1.0.0")]);
    yield* installConfigDependency(root, NO_HOOK, "2.0.0");
    const installedDir2 = yield* installedDir(root, NO_MANIFEST);
    yield* fs.makeDirectory(installedDir2, { recursive: true });
    yield* installConfigDependency(root, UNVERSIONED, undefined, ["pnpmfile.mjs", pnpmfileInjecting("^6.0.0")]);
    yield* installConfigDependency(root, EMPTY_VERSION, "");

    const stored = yield* storeConfigDependency(store, NAME, "2.0.0", Str.repeat(64)("a"), [
      "pnpmfile.mjs",
      pnpmfileInjecting("^2.0.0"),
    ]);
    const lyingManifestCopy = path.join(store, "links", NAME, "2.0.0", Str.repeat(64)("b"), "node_modules", NAME);
    yield* fs.makeDirectory(lyingManifestCopy, { recursive: true });
    yield* fs.writeFileString(path.join(lyingManifestCopy, "package.json"), `{"name":"${NAME}","version":"9.9.9"}`);
    yield* fs.writeFileString(path.join(lyingManifestCopy, "pnpmfile.mjs"), pnpmfileInjecting("^9.9.9"));
    yield* storeConfigDependency(store, STORE_ONLY_PNPMFILE_JS, "1.0.0", Str.repeat(64)("c"), [
      "pnpmfile.js",
      pnpmfileInjectingCjs("^7.0.0"),
    ]);
    yield* storeConfigDependency(store, STORE_ONLY_SCOPED, "1.0.0", Str.repeat(64)("d"), [
      "pnpmfile.mjs",
      pnpmfileInjecting("^5.0.0"),
    ]);

    yield* storeConfigDependency(store, AMBIGUOUS, "1.0.0", Str.repeat(64)("e"), [
      "pnpmfile.mjs",
      pnpmfileInjecting("^1.0.0"),
    ]);
    yield* storeConfigDependency(store, AMBIGUOUS, "1.0.0", Str.repeat(64)("f"), [
      "pnpmfile.mjs",
      pnpmfileInjecting("^1.0.1"),
    ]);

    yield* linkConfigDependency(linkedRoot, NAME, stored);

    envHome = yield* temp("effected-ladder-pnpmhome-");
    yield* storeConfigDependency(path.join(envHome, "store", "v11"), ENV_ONLY, "1.0.0", Str.repeat(64)("1"), [
      "pnpmfile.mjs",
      pnpmfileInjecting("^8.0.0"),
    ]);
    yield* storeConfigDependency(store, TWO_STORES, "1.0.0", Str.repeat(64)("2"), [
      "pnpmfile.mjs",
      pnpmfileInjecting("^3.0.0"),
    ]);
    yield* storeConfigDependency(path.join(envHome, "store", "v11"), TWO_STORES, "1.0.0", Str.repeat(64)("3"), [
      "pnpmfile.mjs",
      pnpmfileInjecting("^4.0.0"),
    ]);

    for (const [format, range] of [
      ["v9", "^9.0.0"],
      ["v10", "^10.0.0"],
      ["v11", "^11.0.0"],
    ] as const) {
      yield* storeConfigDependency(path.join(envHome, "store", format), FORMATS, "1.0.0", Str.repeat(64)("4"), [
        "pnpmfile.mjs",
        pnpmfileInjecting(range),
      ]);
    }

    aliasRoot = yield* temp("effected-ladder-alias-");
    const alias = path.join(aliasRoot, "store-alias");
    yield* fs.symlink(store, alias);
    yield* writeModulesYaml(aliasRoot, alias);
    yield* linkConfigDependency(aliasRoot, NAME, stored);
  })
).pipe(Layer.provide(nodeHost));

const hooked = (result: { readonly catalogs: Readonly<Record<string, Readonly<Record<string, string>>>> }) =>
  result.catalogs.default?.["hooked-dep"];

const ladderCases = (it: Vitest.MethodsNonLive, label: string, hooksLayer: Layer.Layer<ConfigDependencyHooks>) => {
  describe(`${label} — resolves the DECLARED version`, () => {
    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("declared version installed under .pnpm-config → that copy runs (candidate A)", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [NAME]: "1.0.0" }, SEED);
          assert.strictEqual(
            hooked(result),
            "^1.0.0",
            "each NAME pnpmfile injects a different range, so the injected catalog proves which file ran"
          );
          assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
          assert.deepStrictEqual(result.replays, {
            [NAME]: HookReplay.make({ version: "1.0.0", source: "installed" }),
          });
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a `<version>+<integrity>` spec resolves by its version part", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [NAME]: "1.0.0+sha512-abcdef" }, SEED);
          assert.strictEqual(hooked(result), "^1.0.0");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("declared version NOT installed but in the store → the store copy runs (candidate B)", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [NAME]: "2.0.0+sha512-xyz" }, SEED);
          assert.strictEqual(
            hooked(result),
            "^2.0.0",
            ".pnpm-config holds 1.0.0 and the ref declares 2.0.0: the store pnpmfile's range proves the installed one did not run"
          );
          assert.deepStrictEqual(
            result.replays,
            { [NAME]: HookReplay.make({ version: "2.0.0", source: "store" }) },
            "the record names the declared version, integrity stripped, and the rung"
          );
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a store hash directory whose manifest carries another version is not trusted", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [NAME]: "2.0.0" }, SEED);
          assert.notStrictEqual(
            hooked(result),
            "^9.9.9",
            "both links/<name>/2.0.0/<hash> entries exist and only the one whose inner package.json says 2.0.0 may run; ^9.9.9 means the ladder trusted the path"
          );
          assert.strictEqual(hooked(result), "^2.0.0");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("declared version installed nowhere → typed, fail-closed, naming the remediation", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { [NAME]: "3.0.0+sha512-nope" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, NAME);
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          const message = error.cause.message;
          assert.include(message, `${NAME}@3.0.0`);
          assert.include(message, "version 1.0.0", "what .pnpm-config holds instead");
          assert.include(message, store, "where the store was searched");
          assert.include(message, `pnpm add --config ${NAME}@3.0.0`, "how to fix it");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a .pnpm-config directory with no package.json is 'nothing', not a match", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { [NO_MANIFEST]: "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.path, NO_MANIFEST);
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          assert.include(error.cause.message, "holds nothing");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a .pnpm-config manifest with no usable version is 'a package with no version', not a match", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const reason = Str.includes("layerSubprocess")(label) ? "integrityUnavailable" : "notInstalled";
          for (const name of [UNVERSIONED, EMPTY_VERSION]) {
            const error = yield* Effect.flip(hooks.inject(root, { [name]: "1.0.0" }, SEED));
            assert.instanceOf(error, CatalogAssemblyError);
            assert.strictEqual(error.path, name);
            assert.strictEqual(
              error.reason,
              reason,
              "the subprocess layer would fetch, but a bare spec with no lockfile records no integrity, so it fails before any spawn with the same not-installed diagnosis"
            );
            if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
            const message = error.cause.message;
            assert.include(
              message,
              `node_modules/.pnpm-config/${name} holds a package with no version,`,
              "an unversioned manifest and an empty-version one both carry no usable version (effected#613)"
            );
            assert.notInclude(
              message,
              "declares a different version",
              "no version to compare, so no different-version diagnosis"
            );
          }
          const empty = yield* Effect.flip(hooks.inject(root, { [EMPTY_VERSION]: "" }, SEED));
          assert.strictEqual(empty.reason, reason, "nor does an empty declared version match an unversioned manifest");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a declared dependency that is not installed at all fails closed — never a silent skip", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { "absent-dep": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(
            error.path,
            "absent-dep",
            "the pre-ladder behaviour skipped an absent directory as no pnpmfile; a declared config dependency that cannot be found is an error, since a silent skip is how a hook-only catalog went missing on one side of a diff"
          );
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("the store is found through a .pnpm-config symlink's realpath when .modules.yaml is absent", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(linkedRoot, { [STORE_ONLY_PNPMFILE_JS]: "1.0.0" }, SEED);
          assert.strictEqual(
            hooked(result),
            "^7.0.0",
            "linkedRoot has no .modules.yaml and its only .pnpm-config entry is cfg-ladder symlinked into the store, so a sibling living only there proves the store was found by walking the symlink to its links ancestor, not by rung 1 or candidate A"
          );
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a symlinked .pnpm-config entry at the declared version is candidate A", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(linkedRoot, { [NAME]: "2.0.0" }, SEED);
          assert.strictEqual(hooked(result), "^2.0.0");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("pnpmfile.js is accepted, after .mjs and .cjs", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [STORE_ONLY_PNPMFILE_JS]: "1.0.0" }, SEED);
          assert.strictEqual(hooked(result), "^7.0.0");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a scoped name resolves through the store's nested links directory", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [STORE_ONLY_SCOPED]: "1.0.0" }, SEED);
          assert.strictEqual(hooked(result), "^5.0.0");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a resolved dependency with no pnpmfile contributes nothing — the one legitimate skip", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(root, { [NO_HOOK]: "2.0.0" }, SEED);
          assert.deepStrictEqual(
            result,
            HookInjection.make({
              catalogs: SEED,
              releaseAge: {},
              peerDependencyRules: NoPeerDependencyRules,
              replays: { [NO_HOOK]: HookReplay.make({ version: "2.0.0", source: "installed" }) },
            }),
            "still recorded: it was resolved, it just contributed nothing"
          );
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("declaration order is replay order across installed and store copies", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const forward = yield* hooks.inject(root, { [NAME]: "1.0.0", [STORE_ONLY_PNPMFILE_JS]: "1.0.0" }, SEED);
          const reverse = yield* hooks.inject(root, { [STORE_ONLY_PNPMFILE_JS]: "1.0.0", [NAME]: "1.0.0" }, SEED);
          assert.strictEqual(
            hooked(forward),
            "^7.0.0",
            "cfg-ladder@1.0.0 installed then cfg-js@1.0.0 from the store: the later hook rewrites hooked-dep, last write wins"
          );
          assert.strictEqual(hooked(reverse), "^1.0.0", "swapping the declaration order flips the winner");
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("two honest store copies of one version are AMBIGUOUS → typed, naming both, replaying neither", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(root, { [AMBIGUOUS]: "1.0.0+sha512-pinned" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, AMBIGUOUS);
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          const message = error.cause.message;
          assert.include(
            message,
            "ambiguous",
            "two honest copies of one version: neither manifest lies, so the version check cannot separate them, only an integrity the store does not record could, and the ladder refuses to guess"
          );
          assert.include(message, "2 copies");
          assert.include(
            message,
            `store at ${storeReal}`,
            "the store is named by its realpath (macOS /var is /private/var): discovery canonicalizes spellings so one store never counts twice"
          );
          assert.include(message, Str.repeat(64)("e"));
          assert.include(message, Str.repeat(64)("f"));
          const lyingSecondCopyResolves = yield* hooks.inject(root, { [NAME]: "2.0.0" }, SEED);
          assert.strictEqual(
            hooked(lyingSecondCopyResolves),
            "^2.0.0",
            "the control: the same two-hash shape with one manifest lying resolves fine; ambiguity is about two honest copies, not a second directory existing"
          );
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("one store reached by two spellings is ONE store — an aliased path is never 'ambiguous'", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(aliasRoot, { [STORE_ONLY_PNPMFILE_JS]: "1.0.0" }, SEED);
          assert.strictEqual(
            hooked(result),
            "^7.0.0",
            "aliasRoot discovers one physical store twice, through the .modules.yaml symlink spelling (rung 1) and the .pnpm-config realpath (rung 2); STORE_ONLY_PNPMFILE_JS lives only there under one honest hash, so it resolves from the store once"
          );
          assert.deepStrictEqual(result.replays, {
            [STORE_ONLY_PNPMFILE_JS]: HookReplay.make({ version: "1.0.0", source: "store" }),
          });
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a version held by two distinct stores resolves from the FIRST in discovery order", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          yield* withOnlyPnpmHome(
            Effect.gen(function* () {
              const result = yield* hooks.inject(root, { [TWO_STORES]: "1.0.0" }, SEED);
              assert.strictEqual(
                hooked(result),
                "^3.0.0",
                "root names store in .modules.yaml (rung 1) and PNPM_HOME adds a second store (rung 3) holding the same version with a different pnpmfile; not ambiguous, the workspace store wins"
              );
            })
          );
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("store formats are consulted NEWEST first, numerically — v11 beats v10 beats v9", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          yield* withOnlyPnpmHome(
            Effect.gen(function* () {
              const result = yield* hooks.inject(bareRoot, { [FORMATS]: "1.0.0" }, SEED);
              assert.strictEqual(
                hooked(result),
                "^11.0.0",
                "v9, v10 and v11 side by side as a pnpm major upgrade leaves them, the injected range naming the format: a lexical sort would put v10 first, and an upgrade that left the old store behind would replay the stale copy"
              );
            })
          );
        })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect(
        "rung 3: a store named only by $PNPM_HOME is found when .modules.yaml and .pnpm-config say nothing",
        () =>
          Effect.gen(function* () {
            const hooks = yield* ConfigDependencyHooks;
            yield* withOnlyPnpmHome(
              Effect.gen(function* () {
                const result = yield* hooks.inject(bareRoot, { [ENV_ONLY]: "1.0.0" }, SEED);
                assert.strictEqual(
                  hooked(result),
                  "^8.0.0",
                  "bareRoot has no node_modules at all, so rungs 1 and 2 contribute no store and only the environment rung can answer"
                );
                assert.deepStrictEqual(result.replays, {
                  [ENV_ONLY]: HookReplay.make({ version: "1.0.0", source: "store" }),
                });
              })
            );
            const error = yield* Effect.flip(hooks.inject(bareRoot, { [ENV_ONLY]: "1.0.0" }, SEED));
            assert.instanceOf(error, CatalogAssemblyError);
            if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
            assert.notInclude(
              error.cause.message,
              envHome,
              "the control: without the variable the same declaration fails closed, the env store not among those searched"
            );
          })
      );
    });

    it.layer(hooksLayer, { timeout: "30 seconds" })((it) => {
      it.effect("a '..' segment is refused before any path is built", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(bareRoot, { "../../evil": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.path, "../../evil");
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          assert.include(error.cause.message, "'..' path segment");
        })
      );
    });
  });
};

it.layer(OnDiskFixtureBuiltOnce, { timeout: "30 seconds" })((it) => {
  ladderCases(it, "ConfigDependencyHooks.layerLive", HooksLive);
  ladderCases(it, "ConfigDependencyHooks.layerSubprocess", HooksSubprocess);

  class SubprocessHooks extends Context.Service<SubprocessHooks, ConfigDependencyHooks["Service"]>()(
    "@beep/repo-workspaces/test/integration/ConfigDependencyResolution.int.test/SubprocessHooks"
  ) {}
  const ComparisonLayers = Layer.mergeAll(
    HooksLive,
    Layer.effect(SubprocessHooks, ConfigDependencyHooks).pipe(Layer.provide(HooksSubprocess))
  );

  describe("layerLive and layerSubprocess — the ladder is one implementation", () => {
    it.layer(ComparisonLayers, { timeout: "30 seconds" })((it) => {
      it.effect("both layers produce identical injections across installed, store and skipped dependencies", () =>
        Effect.gen(function* () {
          const deps = { [NAME]: "2.0.0+sha512-x", [NO_HOOK]: "2.0.0", [STORE_ONLY_SCOPED]: "1.0.0" };
          const liveHooks = yield* ConfigDependencyHooks;
          const subprocessHooks = yield* SubprocessHooks;
          const live = yield* liveHooks.inject(root, deps, SEED);
          const subprocess = yield* subprocessHooks.inject(root, deps, SEED);
          assert.deepStrictEqual(
            subprocess,
            live,
            "one on-disk fixture, a fake .pnpm-config install and a fake pnpm store links/ tree, pins both replaying layers to resolve identically"
          );
          assert.strictEqual(hooked(live), "^5.0.0");
          assert.deepStrictEqual(live.replays, {
            [NAME]: HookReplay.make({ version: "2.0.0", source: "store" }),
            [NO_HOOK]: HookReplay.make({ version: "2.0.0", source: "installed" }),
            [STORE_ONLY_SCOPED]: HookReplay.make({ version: "1.0.0", source: "store" }),
          });
        })
      );
    });
  });

  describe("ConfigDependencyHooks.layerFrom — replays caller-supplied files, resolving nothing", () => {
    const ONE = join(FIXTURES, "hook-pnpmfile.mjs");
    const TWO = join(FIXTURES, "hook-pnpmfile.cjs");

    it.layer(
      ConfigDependencyHooks.layerFrom({ "@scope/plugin@1.0.0": ONE, "@scope/plugin@2.0.0": TWO }).pipe(
        Layer.provide(Path.layer)
      ),
      {
        timeout: "30 seconds",
      }
    )((it) => {
      it.effect("a hit replays the mapped file for that declared version, never looking at the root", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const rootThatDoesNotExist = "/nowhere/at/all";
          const result = yield* hooks.inject(rootThatDoesNotExist, { "@scope/plugin": "1.0.0+sha512-abc" }, SEED);
          assert.strictEqual(result.catalogs.default?.["mjs-dep"], "^2.0.0");
          assert.isUndefined(
            result.catalogs.default?.["hooked-dep"],
            "hook-pnpmfile.mjs injects mjs-dep; the .cjs would inject hooked-dep"
          );
          assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
          assert.deepStrictEqual(result.replays, {
            "@scope/plugin": HookReplay.make({ version: "1.0.0", source: "supplied" }),
          });
        })
      );
    });

    it.layer(
      ConfigDependencyHooks.layerFrom({ "@scope/plugin@1.0.0": ONE, "@scope/plugin@2.0.0": TWO }).pipe(
        Layer.provide(Path.layer)
      ),
      {
        timeout: "30 seconds",
      }
    )((it) => {
      it.effect("two declared versions of one name map to two different files", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const v2 = yield* hooks.inject("/nowhere", { "@scope/plugin": "2.0.0" }, SEED);
          assert.strictEqual(v2.catalogs.default?.["hooked-dep"], "^9.9.9");
          assert.isUndefined(v2.catalogs.default?.["mjs-dep"]);
        })
      );
    });

    it.layer(ConfigDependencyHooks.layerFrom({ "@scope/plugin@1.0.0": ONE }).pipe(Layer.provide(Path.layer)), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("a miss fails closed with the same hooks-source shape as an uninstalled version", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject("/nowhere", { "@scope/plugin": "3.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, "@scope/plugin");
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          assert.include(error.cause.message, "@scope/plugin@3.0.0");
        })
      );
    });

    it.layer(ConfigDependencyHooks.layerFrom({}).pipe(Layer.provide(Path.layer)), { timeout: "30 seconds" })((it) => {
      it.effect("empty configDependencies returns the seed untouched", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const rules = PeerDependencyRules.make({
            allowedVersions: { "a>b": "1.0.0" },
            ignoreMissing: [],
            allowAny: [],
          });
          const result = yield* hooks.inject("/nowhere", {}, SEED, rules);
          assert.deepStrictEqual(
            result,
            HookInjection.make({ catalogs: SEED, releaseAge: {}, peerDependencyRules: rules, replays: {} })
          );
        })
      );
    });

    it.layer(ConfigDependencyHooks.layerFrom({ "../../evil@1.0.0": ONE }).pipe(Layer.provide(Path.layer)), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("a '..' segment is refused before the lookup", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject("/nowhere", { "../../evil": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.path, "../../evil");
        })
      );
    });

    it.layer(
      Layer.unwrap(
        Effect.sync(() => {
          const tree: Tree = {
            "/repo/pnpm-workspace.yaml": A.join(
              [
                "packages:",
                "  - packages/*",
                "catalog:",
                "  effect: ^4.0.0",
                "configDependencies:",
                "  '@scope/plugin': '2.0.0+sha512-abc'",
                "",
              ],
              "\n"
            ),
            "/repo/package.json": '{"name":"root","version":"0.0.0","private":true}',
            "/repo/packages/a/package.json": manifest("@x/a", { dependencies: { effect: "catalog:" } }),
          };
          const hooks = ConfigDependencyHooks.layerFrom({ "@scope/plugin@2.0.0": TWO });
          const core = Workspaces.layer({ cwd: "/repo" });
          const catalogs = Layer.effect(WorkspaceCatalogs, WorkspaceCatalogs.make({ cwd: "/repo" })).pipe(
            Layer.provide(hooks),
            Layer.provide(core)
          );
          const appLayer = Layer.mergeAll(core, catalogs).pipe(Layer.provideMerge(platform(tree)));
          return appLayer;
        })
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("works under a memfs FileSystem: the whole catalog path replays with no real root", () =>
        Effect.gen(function* () {
          const set = yield* (yield* WorkspaceCatalogs).set;
          assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
          assertSome(set.rangeOf("hooked-dep", O.none()), "^9.9.9");
        })
      );
    });
  });
});
