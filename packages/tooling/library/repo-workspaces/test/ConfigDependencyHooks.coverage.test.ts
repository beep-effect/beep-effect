import { ScriptedSpawner } from "@beep/commands";
import { MemoryFileSystem } from "@beep/memfs";
import { HookReplay } from "@beep/repo-workspaces/ConfigDependencyReplay";
import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { PeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";

const JsonValue = S.fromJsonString(S.Unknown);

vi.doMock("../src/internal/configDependencyResolution.ts", (original) =>
  original<typeof import("@beep/repo-workspaces/internal/configDependencyResolution")>().then((actual) => ({
    ...actual,
    resolvePnpmfiles: () =>
      Effect.succeed([
        {
          name: "cfg",
          version: "1.0.0",
          source: "installed" as const,
          path: `${import.meta.dirname}/fixtures/hook-pnpmfile.mjs`,
        },
      ]),
  }))
);

vi.doMock("./fixtures/hook-pnpmfile.mjs", () => ({
  default: undefined,
  updateConfig: undefined,
  hooks: {
    updateConfig: (config: { readonly catalog: Record<string, unknown> }) => {
      const scenario = config.catalog.scenario;
      if (scenario === "throw") throw new Error("hook failed");
      if (scenario === "empty") return { peerDependencyRules: {} };
      if (scenario === "allowed") return { peerDependencyRules: { allowedVersions: { peer: "^1" } } };
      if (scenario === "missing") return { peerDependencyRules: { ignoreMissing: ["peer"] } };
      if (scenario === "any") return { peerDependencyRules: { allowAny: ["peer"] } };
      if (scenario === "malformed")
        return {
          catalog: 0,
          catalogs: 0,
          peerDependencyRules: { allowedVersions: { peer: 0 }, ignoreMissing: [0], allowAny: [0] },
        };
      return undefined;
    },
  },
}));
vi.doMock("./fixtures/hook-pnpmfile-age-1440.mjs", () => ({
  default: undefined,
  hooks: undefined,
  updateConfig: () => ({ catalog: { added: "^1" } }),
}));
vi.doMock("./fixtures/hook-pnpmfile-age-4320.mjs", () => ({
  hooks: undefined,
  updateConfig: undefined,
  default: { hooks: undefined, updateConfig: () => ({ catalogs: { named: { added: "^2" } } }) },
}));
vi.doMock("./fixtures/hook-pnpmfile-age-garbage.mjs", () => ({
  default: 1,
  hooks: undefined,
  updateConfig: undefined,
}));

const Hooks = await import("@beep/repo-workspaces/ConfigDependencyHooks");
const { ConfigDependencyHooks, NoPeerDependencyRules } = Hooks;

const replayLayer = ConfigDependencyHooks.layerFrom({
  "cfg@1.0.0": `${import.meta.dirname}/fixtures/hook-pnpmfile.mjs`,
}).pipe(Layer.provide(Path.layer));
const inject = (scenario: string, rules?: PeerDependencyRules) =>
  ConfigDependencyHooks.use((hooks) => hooks.inject("/repo", { cfg: "1.0.0" }, { default: { scenario } }, rules));

const rules: PeerDependencyRules = Hooks.PeerDependencyRules.make({
  allowedVersions: { seeded: "^2" },
  ignoreMissing: ["seeded"],
  allowAny: ["seeded"],
});

describe("ConfigDependencyHooks replay coverage, with the disk-reading resolution ladder mocked so replay runs without IO", () => {
  it.layer(replayLayer, { timeout: "30 seconds" })((it) => {
    it.effect("empty and malformed peer axes retain the prior rules", () =>
      Effect.gen(function* () {
        for (const scenario of ["empty", "malformed"]) {
          assert.deepStrictEqual((yield* inject(scenario)).peerDependencyRules, NoPeerDependencyRules);
          assert.deepStrictEqual((yield* inject(scenario, rules)).peerDependencyRules, rules);
        }
        assert.deepStrictEqual((yield* inject("undefined", rules)).peerDependencyRules, rules);
      })
    );
    it.effect("a throwing hook fails typed with the dependency name and originating error", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(inject("throw"));
        assert.strictEqual(failure.source, "hooks");
        assert.strictEqual(failure.path, "cfg");
        assert.instanceOf(failure.cause, Error);
        if (failure.cause instanceof Error) assert.strictEqual(failure.cause.message, "hook failed");
      })
    );
    it.effect("each independently valid peer axis contributes while absent axes default", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          (yield* inject("allowed")).peerDependencyRules,
          Hooks.PeerDependencyRules.make({
            allowedVersions: { peer: "^1" },
            ignoreMissing: [],
            allowAny: [],
          })
        );
        assert.deepStrictEqual(
          (yield* inject("missing")).peerDependencyRules,
          Hooks.PeerDependencyRules.make({
            allowedVersions: {},
            ignoreMissing: ["peer"],
            allowAny: [],
          })
        );
        assert.deepStrictEqual(
          (yield* inject("any")).peerDependencyRules,
          Hooks.PeerDependencyRules.make({
            allowedVersions: {},
            ignoreMissing: [],
            allowAny: ["peer"],
          })
        );
      })
    );
  });
  for (const [file, expected] of [
    ["hook-pnpmfile-age-1440.mjs", { default: { added: "^1" } }],
    ["hook-pnpmfile-age-4320.mjs", { named: { added: "^2" } }],
    ["hook-pnpmfile-age-garbage.mjs", {}],
  ] as const) {
    const replay = ConfigDependencyHooks.layerFrom({ "cfg@1.0.0": `${import.meta.dirname}/fixtures/${file}` }).pipe(
      Layer.provide(Path.layer)
    );
    it.layer(replay, { timeout: "30 seconds" })((it) => {
      it.effect(`replays the supported export shape in ${file}`, () =>
        Effect.gen(function* () {
          const hooks = yield* ConfigDependencyHooks;
          const result = yield* hooks.inject("/repo", { cfg: "1.0.0" }, {});
          assert.deepStrictEqual(result.catalogs, expected);
          assert.deepStrictEqual(result.replays, { cfg: HookReplay.make({ version: "1.0.0", source: "supplied" }) });
        })
      );
    });
  }
  const noHook = ConfigDependencyHooks.layerFrom({
    "cfg@1.0.0": `${import.meta.dirname}/fixtures/hook-pnpmfile-age-garbage.mjs`,
  }).pipe(Layer.provide(Path.layer));
  it.layer(noHook, { timeout: "30 seconds" })((it) => {
    it.effect("an absent default catalog preserves named catalogs", () =>
      Effect.gen(function* () {
        const hooks = yield* ConfigDependencyHooks;
        const result = yield* hooks.inject("/repo", { cfg: "1.0.0" }, { named: { effect: "^4" } });
        assert.deepStrictEqual(result.catalogs, { named: { effect: "^4" } });
      })
    );
  });
});

for (const payload of [{ ok: false }, { ok: false, name: "cfg", message: "bad hook", stack: "hook stack" }]) {
  const spawner = ScriptedSpawner.make(() => ({
    stdout: `${Result.getOrThrow(S.encodeResult(JsonValue)(payload))}\n`,
  }));
  const subprocess = ConfigDependencyHooks.layerSubprocess.pipe(
    Layer.provide(spawner.layer),
    Layer.provide(Layer.merge(MemoryFileSystem.layer, Path.layer))
  );
  it.layer(subprocess, { timeout: "30 seconds" })((it) => {
    it.effect(`reconstructs replay failure with ${payload.message ?? "default diagnostic"}`, () =>
      Effect.gen(function* () {
        const hooks = yield* ConfigDependencyHooks;
        const failure = yield* Effect.flip(hooks.inject("/repo", { cfg: "1.0.0" }, {}));
        assert.strictEqual(failure.source, "hooks");
        assert.strictEqual(failure.path, payload.name ?? "/repo");
        assert.instanceOf(failure.cause, Error);
        if (failure.cause instanceof Error) {
          assert.strictEqual(failure.cause.message, payload.message ?? "config dependency hook replay failed");
          if (payload.stack !== undefined) assert.strictEqual(failure.cause.stack, payload.stack);
        }
      })
    );
  });
}
