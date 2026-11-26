import { ScriptedSpawner } from "@beep/commands";
import { MemoryFileSystem } from "@beep/memfs";
import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { ConfigDependencyHooks } from "@beep/repo-workspaces";
import { HookInjection, NoPeerDependencyRules, PeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const JsonValue = S.fromJsonString(S.Unknown);

const ROOT = "/repo";
const SEED = { default: { effect: "^4.0.0" }, named: { "left-pad": "^1.0.0" } } as const;
const INSTALLED = ["dep", "dep-a", "@scope/dep-b", "@scope/pkg", "broken-dep"] as const;

const pnpmfileOf = (name: string): string => `${ROOT}/node_modules/.pnpm-config/${name}/pnpmfile.mjs`;
const pnpmfileUrlOf = (name: string): string => `file://${pnpmfileOf(name)}`;

const installedAt100WithPnpmfilesTheSpawnerNeverLoads = R.fromEntries(
  A.flatMap(INSTALLED, (name) => [
    [
      `${ROOT}/node_modules/.pnpm-config/${name}/package.json`,
      Result.getOrThrowWith(S.encodeUnknownResult(JsonValue)({ name, version: "1.0.0" }), identity),
    ],
    [pnpmfileOf(name), "export const hooks = {};\n"],
  ])
);

const emitted = (payload: unknown, noise = ""): string =>
  `${noise}\n${Result.getOrThrowWith(S.encodeUnknownResult(JsonValue)(payload), identity)}\n`;

const parentSideOverScriptedSpawner = (script: Parameters<typeof ScriptedSpawner.make>[0]) => {
  const spawner = ScriptedSpawner.make(script);
  const layer = ConfigDependencyHooks.layerSubprocess.pipe(
    Layer.provide(spawner.layer),
    Layer.provide(Layer.merge(MemoryFileSystem.layerWith(installedAt100WithPnpmfilesTheSpawnerNeverLoads), Path.layer))
  );
  return { spawner, layer };
};

describe("ConfigDependencyHooks.layerSubprocess — no-spawn fast paths", () => {
  {
    const { spawner, layer } = parentSideOverScriptedSpawner(() => ({ stdout: emitted({ ok: true, config: {} }) }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("empty configDependencies returns the seed without spawning anything", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(ROOT, {}, SEED);
          assert.deepStrictEqual(
            result,
            HookInjection.make({
              catalogs: SEED,
              releaseAge: {},
              peerDependencyRules: NoPeerDependencyRules,
              replays: {},
            })
          );
          assert.strictEqual(
            spawner.spawns.length,
            0,
            "the discriminating half: nothing was spawned to produce that answer"
          );
        })
      );
    });
  }

  {
    const { spawner, layer } = parentSideOverScriptedSpawner(() => ({ stdout: emitted({ ok: true, config: {} }) }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a '..' path segment in a name fails typed BEFORE any spawn", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(ROOT, { "../../evil": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, "../../evil");
          assert.strictEqual(spawner.spawns.length, 0, "the malicious name never reached a subprocess");
        })
      );
    });
  }

  {
    const { spawner, layer } = parentSideOverScriptedSpawner(() => ({ stdout: emitted({ ok: true, config: {} }) }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a scoped name (a legitimate '/') is not rejected and DOES spawn", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          yield* hooks.inject(ROOT, { "@scope/pkg": "1.0.0" }, SEED);
          assert.strictEqual(spawner.spawns.length, 1);
        })
      );
    });
  }
});

describe("ConfigDependencyHooks.layerSubprocess — the argv contract", () => {
  {
    const { spawner, layer } = parentSideOverScriptedSpawner(() => ({ stdout: emitted({ ok: true, config: {} }) }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("spawns node with the static script and seed/rules/resolved pairs via argv, never interpolated", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          yield* hooks.inject(ROOT, { "dep-a": "1.0.0", "@scope/dep-b": "1.0.0+sha512-abc" }, SEED);
          const spawn = spawner.spawns[0];
          assert.isDefined(spawn);
          assert.strictEqual(spawn.command, "node");
          assert.strictEqual(spawn.args[0], "--input-type=module");
          assert.strictEqual(spawn.args[1], "-e");
          const script = spawn.args[2];
          assert.isDefined(script);
          assert.isFalse(
            Str.includes(ROOT)(script),
            "the script is a static constant: seed, rules and resolved pairs travel only as argv"
          );
          assert.isFalse(Str.includes("dep-a")(script));
          assert.strictEqual(spawn.args[3], "beep-replay");
          assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(spawn.args[4] ?? "")), SEED);
          assert.deepStrictEqual(
            Result.getOrThrow(S.decodeResult(JsonValue)(spawn.args[5] ?? "")),
            PeerDependencyRules.make({
              allowedVersions: {},
              ignoreMissing: [],
              allowAny: [],
            }),
            "the rules seed rides argv in its own slot ahead of the pairs, never spliced into the script"
          );
          assert.deepStrictEqual(
            Result.getOrThrow(S.decodeResult(JsonValue)(spawn.args[6] ?? "")),
            [
              ["dep-a", pnpmfileUrlOf("dep-a")],
              ["@scope/dep-b", pnpmfileUrlOf("@scope/dep-b")],
            ],
            "the parent resolves each pnpmfile to a file: URL; the child gets the pairs as one JSON argument and looks nothing up"
          );
          assert.strictEqual(spawn.args.length, 7);
        })
      );
    });
  }

  {
    const { spawner, layer } = parentSideOverScriptedSpawner(() => ({ stdout: emitted({ ok: true, config: {} }) }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a declared version the ladder cannot resolve fails typed BEFORE any spawn", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(ROOT, { dep: "2.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, "dep", "dep is installed at 1.0.0, so a declared 2.0.0 is found nowhere");
          assert.strictEqual(spawner.spawns.length, 0);
        })
      );
    });
  }

  {
    const { spawner, layer } = parentSideOverScriptedSpawner(() => ({ stdout: emitted({ ok: true, config: {} }) }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("carries the supplied peer-dependency rules through argv, not the empty default", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const rules = PeerDependencyRules.make({
            allowedVersions: { "a>b": "1.2.3" },
            ignoreMissing: ["c"],
            allowAny: [],
          });
          yield* hooks.inject(ROOT, { "dep-a": "1.0.0" }, SEED, rules);
          const spawn = spawner.spawns[0];
          assert.isDefined(spawn);
          assert.deepStrictEqual(
            Result.getOrThrow(S.decodeResult(JsonValue)(spawn.args[5] ?? "")),
            rules,
            "seeded, not merged by us: the hooks merge onto the threaded rules, exactly as pnpm seeds its own config"
          );
          assert.isFalse(Str.includes("1.2.3")(spawn.args[2] ?? ""));
        })
      );
    });
  }
});

describe("ConfigDependencyHooks.layerSubprocess — transport failures are typed, never defects", () => {
  {
    const { layer } = parentSideOverScriptedSpawner((command) => ScriptedSpawner.notFound(command));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a spawn failure (node not found) fails typed as a hooks-source CatalogAssemblyError", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(ROOT, { dep: "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, ROOT);
        })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({ stdout: "", stderr: "boom from node", exit: 7 }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a non-zero exit with no result payload fails typed, carrying exit code and stderr", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(ROOT, { dep: "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, ROOT);
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          assert.include(
            String(error.cause.message),
            "exit 7",
            "the cause is Run.jsonLine's CommandOutputError, carrying the exit code and stderr tail"
          );
          assert.include(String(error.cause.message), "boom from node");
        })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({ stdout: "definitely not json\nnor this\n" }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("unparseable stdout (a zero exit, but no JSON line) fails typed", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(ROOT, { dep: "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
        })
      );
    });
  }

  {
    const started = Deferred.makeUnsafe<void>();
    const { spawner, layer } = parentSideOverScriptedSpawner(() => {
      Deferred.doneUnsafe(started, Effect.void);
      return { hang: true };
    });
    it.effect(
      "a replay whose pnpmfile never settles fails typed through the hooks source at the thirty-second ceiling, never a hang of the memoized assemble or a defect",
      () =>
        Effect.gen(function* () {
          const builtPerTestToOwnTheAdvancedTestClock = yield* Layer.build(layer);
          const hooks = Context.get(builtPerTestToOwnTheAdvancedTestClock, ConfigDependencyHooks);
          const fiber = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED).pipe(Effect.flip, Effect.forkChild);
          yield* Deferred.await(started).pipe(Effect.raceFirst(Fiber.join(fiber)));
          assert.strictEqual(
            spawner.spawns.length,
            1,
            "the replay child was never spawned — did resolution fail first? The wait races the fiber so an early typed failure lands here rather than hanging"
          );
          yield* TestClock.adjust("31 seconds");
          const error = yield* Fiber.join(fiber);
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, ROOT);
        })
    );
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({
      stdout: emitted({
        ok: false,
        name: "broken-dep",
        message: "Unexpected token",
        stack: "SyntaxError: Unexpected token\n  at x",
      }),
    }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a serialized per-name failure maps to a typed error NAMING that dependency", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const error = yield* Effect.flip(hooks.inject(ROOT, { "broken-dep": "1.0.0" }, SEED));
          assert.instanceOf(error, CatalogAssemblyError);
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, "broken-dep", "per-name attribution survives the process boundary");
          if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
          const cause = error.cause;
          assert.strictEqual(cause.message, "Unexpected token");
          assert.strictEqual(cause.stack, "SyntaxError: Unexpected token\n  at x");
        })
      );
    });
  }
});

describe("ConfigDependencyHooks.layerSubprocess — result folding in the parent", () => {
  {
    const { layer } = parentSideOverScriptedSpawner(() => ({
      stdout: emitted(
        {
          ok: true,
          config: {
            catalog: { effect: "^4.0.0", "hooked-dep": "^9.9.9" },
            catalogs: { named: { "left-pad": "^1.0.0" }, extra: { "extra-dep": "^1.2.3" } },
            minimumReleaseAge: 1440,
            minimumReleaseAgeExclude: ["@scope/b"],
          },
        },
        "hook says hello\n{not json either"
      ),
    }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect(
        "the returned config slice, read from the LAST stdout line past a hook's console noise, folds through the same normalization as layerLive",
        () =>
          Effect.gen(function* () {
            const hooks = yield* ConfigDependencyHooks;
            const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED);
            assert.strictEqual(
              result.catalogs.default?.["hooked-dep"],
              "^9.9.9",
              "the default catalog is re-folded under default, named catalogs kept"
            );
            assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
            assert.strictEqual(result.catalogs.named?.["left-pad"], "^1.0.0");
            assert.strictEqual(result.catalogs.extra?.["extra-dep"], "^1.2.3");
            assert.deepStrictEqual(
              result.releaseAge,
              { ageMinutes: 1440, exclude: ["@scope/b"] },
              "release-age keys map onto the partial gate's field names"
            );
          })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({
      stdout: emitted({
        ok: true,
        config: {
          peerDependencyRules: PeerDependencyRules.make({
            allowedVersions: { "seeded>peer": "1.0.0", "hooked>peer": "2.0.0" },
            ignoreMissing: ["from-hook"],
            allowAny: [],
          }),
        },
      }),
    }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a hook MERGING onto the seeded rules keeps both, which is why we seed", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(
            ROOT,
            { dep: "1.0.0" },
            SEED,
            PeerDependencyRules.make({
              allowedVersions: { "seeded>peer": "1.0.0" },
              ignoreMissing: [],
              allowAny: [],
            })
          );
          assert.deepStrictEqual(
            result.peerDependencyRules,
            PeerDependencyRules.make({
              allowedVersions: { "seeded>peer": "1.0.0", "hooked>peer": "2.0.0" },
              ignoreMissing: ["from-hook"],
              allowAny: [],
            })
          );
        })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({
      stdout: emitted({
        ok: true,
        config: { peerDependencyRules: { allowedVersions: { "only>hook": "3.0.0" } } },
      }),
    }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a hook OVERWRITING the seeded rules wins — pnpm's behaviour, not a bug to repair", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(
            ROOT,
            { dep: "1.0.0" },
            SEED,
            PeerDependencyRules.make({
              allowedVersions: { "seeded>peer": "1.0.0" },
              ignoreMissing: [],
              allowAny: [],
            })
          );
          assert.deepStrictEqual(result.peerDependencyRules.allowedVersions, { "only>hook": "3.0.0" });
        })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({
      stdout: emitted({
        ok: true,
        config: { peerDependencyRules: { allowedVersions: { "a>b": "1.0.0" }, ignoreMissing: "not-an-array" } },
      }),
    }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a malformed rules axis leaves the prior value, without blanking its siblings", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(
            ROOT,
            { dep: "1.0.0" },
            SEED,
            PeerDependencyRules.make({
              allowedVersions: {},
              ignoreMissing: ["seeded-ignore"],
              allowAny: [],
            })
          );
          assert.deepStrictEqual(result.peerDependencyRules.allowedVersions, { "a>b": "1.0.0" });
          assert.deepStrictEqual(result.peerDependencyRules.ignoreMissing, ["seeded-ignore"]);
        })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({
      stdout: emitted({
        ok: true,
        config: { peerDependencyRules: { allowedVersions: { "a>b": 1 }, ignoreMissing: ["from-hook"] } },
      }),
    }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("an allowedVersions entry that is not a string is a malformed axis too", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(
            ROOT,
            { dep: "1.0.0" },
            SEED,
            PeerDependencyRules.make({
              allowedVersions: { "seeded>peer": "1.0.0" },
              ignoreMissing: [],
              allowAny: [],
            })
          );
          assert.deepStrictEqual(
            result.peerDependencyRules.allowedVersions,
            { "seeded>peer": "1.0.0" },
            "the contract is name→range, so an object holding a non-string entry is malformed and the prior value stands"
          );
          assert.deepStrictEqual(
            result.peerDependencyRules.ignoreMissing,
            ["from-hook"],
            "and it does not blank its siblings, exactly as the array axes do not"
          );
        })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({
      stdout: emitted({
        ok: true,
        config: { peerDependencyRules: { allowedVersions: { "a>b": "1" } } },
      }),
    }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect(
        "an allowedVersions block whose entries are ALL strings still wins, which a check on the block's presence rather than its entries would fail",
        () =>
          Effect.gen(function* () {
            const hooks = yield* ConfigDependencyHooks;
            const result = yield* hooks.inject(
              ROOT,
              { dep: "1.0.0" },
              SEED,
              PeerDependencyRules.make({
                allowedVersions: { "seeded>peer": "1.0.0" },
                ignoreMissing: [],
                allowAny: [],
              })
            );
            assert.deepStrictEqual(result.peerDependencyRules.allowedVersions, { "a>b": "1" });
          })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({ stdout: emitted({ ok: true, config: { catalog: {} } }) }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("hooks that touch no rules return the seeded rules unchanged", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const seeded = PeerDependencyRules.make({
            allowedVersions: { "a>b": "1.0.0" },
            ignoreMissing: [],
            allowAny: [],
          });
          const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED, seeded);
          assert.deepStrictEqual(result.peerDependencyRules, seeded);
        })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({ stdout: emitted({ ok: true, config: "garbage" }) }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("a malformed returned config slice falls back to the seed — data is never fatal", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED);
          assert.deepStrictEqual(result.catalogs, SEED);
          assert.deepStrictEqual(result.releaseAge, {});
        })
      );
    });
  }

  {
    const { layer } = parentSideOverScriptedSpawner(() => ({
      stdout: emitted({ ok: true, config: { catalog: {}, catalogs: {} } }),
    }));
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("absent release-age keys contribute an empty gate, never explicit undefined", () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject(ROOT, { dep: "1.0.0" }, SEED);
          assert.deepStrictEqual(result.releaseAge, {});
          assert.isFalse("ageMinutes" in result.releaseAge);
          assert.isFalse("exclude" in result.releaseAge);
        })
      );
    });
  }
});
