import {
  CacheCensusNode,
  CacheCensusReport,
  CacheCensusSource,
  CacheCensusWorkspace,
  CacheExecutablePin,
  CacheToolchainSnapshot,
} from "@beep/repo-cli/commands/Cache";
import { fingerprintCacheComputation, joinCacheCensusPlan, projectCacheActivation } from "@beep/repo-cli/test/Cache";
import {
  CacheActivationProjection,
  CacheEvidenceReference,
  CacheQualificationKey,
  CacheTaskConfiguration,
} from "@beep/repo-configs/cache";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const workspace = CacheCensusWorkspace.make({
  name: "@beep/fixture",
  directory: "packages/fixture",
  scripts: { lint: "biome check .", empty: " " },
});
const configuration = CacheTaskConfiguration.make({
  cache: true,
  inputs: ["$TURBO_DEFAULT$"],
  outputs: [],
  env: [],
  passThroughEnv: [],
  dependsOn: ["^lint"],
  persistent: false,
  interactive: false,
  interruptible: false,
  outputLogs: "full",
});
const node = (task: string, command: string) => ({
  taskId: `@beep/fixture#${task}`,
  task,
  package: "@beep/fixture",
  command,
  inputs: { "src/a.ts": "input-a", "src/b.ts": "input-b" },
  dependencies: [],
  resolvedTaskDefinition: { ...configuration, passThroughEnv: O.none<ReadonlyArray<string>>() },
});
const provideCrypto = Effect.provide(NodeCrypto.layer);
const digest = Sha256Hex.make(Str.padStart(64, "0")("1"));
const changedDigest = Sha256Hex.make(Str.padStart(64, "0")("2"));
const key = CacheQualificationKey.make({
  computation: "@beep/fixture#lint",
  layer: "turbo-task-result",
  profile: "local-linux-x64-bun1.4.1",
  epoch: "fixture-v1",
});
const tool = CacheExecutablePin.make({ version: "1.0.0", sha256: digest });
const toolchain = CacheToolchainSnapshot.make({
  profile: "local-linux-x64-bun1.4.1",
  kernel: "Linux fixture",
  libc: "glibc fixture",
  bun: tool,
  node: tool,
  turbo: tool,
  biome: tool,
  sources: [],
});
const fingerprintFixture = Effect.fn("CacheCensusTest.fingerprintFixture")(function* () {
  const lint = node("lint", "biome check .");
  const nodes = yield* joinCacheCensusPlan([workspace], {
    tasks: [{ ...lint, dependencies: ["@beep/fixture#transit"] }, node("transit", "<NONEXISTENT>")],
  });
  return CacheCensusReport.make({
    revision: "fixture-head",
    turboVersion: "1.0.0",
    rootScripts: {},
    globalConfiguration: {},
    workspaces: [workspace],
    nodes,
    sources: [
      CacheCensusSource.make({ path: "turbo.json", sha256: digest }),
      CacheCensusSource.make({ path: "packages/fixture/turbo.json", sha256: digest }),
    ],
    entrypointSources: [],
    unresolved: [],
  });
});

const activationFixture = Effect.fn("CacheCensusTest.activationFixture")(function* () {
  const before = '{"extends":["//"],"tasks":{"lint":{"cache":false,"outputs":[]}}}';
  const after = '{"extends":["//"],"tasks":{"lint":{"cache":true,"outputs":[]}}}';
  const beforeDigest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(before));
  const afterDigest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(after));
  const original = yield* fingerprintFixture();
  const census = CacheCensusReport.make({
    ...original,
    nodes: A.map(original.nodes, (row) =>
      row.id === key.computation
        ? CacheCensusNode.make({
            ...row,
            configuration: CacheTaskConfiguration.make({ ...row.configuration, cache: false }),
          })
        : row
    ),
    sources: A.map(original.sources, (row) =>
      row.path === "packages/fixture/turbo.json" ? CacheCensusSource.make({ ...row, sha256: beforeDigest }) : row
    ),
  });
  const source = yield* fingerprintCacheComputation(key, census, toolchain);
  const activation = CacheActivationProjection.make({
    path: "packages/fixture/turbo.json",
    before: CacheEvidenceReference.make({ path: "proof/before.json", sha256: beforeDigest }),
    after: CacheEvidenceReference.make({ path: "proof/after.json", sha256: afterDigest }),
    sourceConfiguration: source.configurationDigest,
  });
  return { before, after, census, source, activation };
});

describe("reviewed cache activation projection", () => {
  it("rejects arbitrary replacement task semantics despite a correctly rebound artifact digest", async () => {
    await fc.assert(
      fc.asyncProperty(S.toArbitrary(CacheTaskConfiguration)(fc), async (configuration) => {
        await Effect.runPromise(
          Effect.gen(function* () {
            const f = yield* activationFixture();
            const after = yield* S.encodeEffect(S.fromJsonString(S.JsonObject))({
              extends: ["//"],
              tasks: { lint: { ...configuration, cache: true } },
            });
            const sha256 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(after));
            const activation = CacheActivationProjection.make({
              ...f.activation,
              after: CacheEvidenceReference.make({ ...f.activation.after, sha256 }),
            });
            const result = yield* projectCacheActivation(key, f.census, toolchain, activation, f.before, after).pipe(
              Effect.result
            );
            expect(Result.isFailure(result)).toBe(true);
            if (Result.isFailure(result))
              expect(result.failure.message).toBe("Activation may change only the selected task's cache flag.");
          }).pipe(provideCrypto)
        );
      }),
      { numRuns: fcRuns(50) }
    );
  });

  it.effect(
    "keeps the observed root disabled while binding only the exact enabled projection",
    Effect.fnUntraced(function* () {
      const f = yield* activationFixture();
      const target = yield* projectCacheActivation(key, f.census, toolchain, f.activation, f.before, f.after);
      expect(target.configurationDigest).not.toBe(f.source.configurationDigest);
      expect(target.toolchainDigest).toBe(f.source.toolchainDigest);
      expect(O.getOrThrow(A.findFirst(f.census.nodes, (node) => node.id === key.computation)).configuration.cache).toBe(
        false
      );
      const projected = O.getOrThrow(A.findFirst(target.configuration.nodes, (node) => node.id === key.computation));
      expect(projected.configuration.cache).toBe(true);
      expect(target.configuration.nodes).toEqual(
        A.map(f.source.configuration.nodes, (node) => (node.id === key.computation ? projected : node))
      );
      expect(target.configuration.sources).toEqual(
        A.map(f.source.configuration.sources, (row) =>
          row.path === f.activation.path ? CacheCensusSource.make({ ...row, sha256: f.activation.after.sha256 }) : row
        )
      );
    }, provideCrypto)
  );

  it.effect(
    "rejects semantic changes even when the caller supplies the new artifact's correct digest",
    Effect.fnUntraced(function* () {
      const f = yield* activationFixture();
      for (const after of [
        Str.replace('"outputs":[]', '"outputs":["secret/**"]')(f.after),
        Str.replace('"cache":true', '"cache":true,"env":["UNREVIEWED"]')(f.after),
        Str.replace('"extends":["//"]', '"extends":["//","other"]')(f.after),
      ]) {
        const sha256 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(after));
        const activation = CacheActivationProjection.make({
          ...f.activation,
          after: CacheEvidenceReference.make({ ...f.activation.after, sha256 }),
        });
        const result = yield* projectCacheActivation(key, f.census, toolchain, activation, f.before, after).pipe(
          Effect.result
        );
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result))
          expect(result.failure.message).toBe("Activation may change only the selected task's cache flag.");
      }
    }, provideCrypto)
  );

  it.effect(
    "rejects stale identities, forged bytes, another workspace, and mutable artifact destinations",
    Effect.fnUntraced(function* () {
      const f = yield* activationFixture();
      for (const activation of [
        CacheActivationProjection.make({ ...f.activation, sourceConfiguration: changedDigest }),
        CacheActivationProjection.make({ ...f.activation, path: "packages/another/turbo.json" }),
        CacheActivationProjection.make({
          ...f.activation,
          before: CacheEvidenceReference.make({ ...f.activation.before, path: f.activation.path }),
        }),
        CacheActivationProjection.make({
          ...f.activation,
          after: CacheEvidenceReference.make({ ...f.activation.after, sha256: changedDigest }),
        }),
      ])
        expect(
          yield* projectCacheActivation(key, f.census, toolchain, activation, f.before, f.after).pipe(Effect.isFailure)
        ).toBe(true);
      const changed = CacheCensusReport.make({ ...f.census, globalConfiguration: { semantic: "changed" } });
      expect(
        yield* projectCacheActivation(key, changed, toolchain, f.activation, f.before, f.after).pipe(Effect.isFailure)
      ).toBe(true);
    }, provideCrypto)
  );
});

describe("executable cache census", () => {
  it.effect(
    "keeps absent and blank scripts as graph-only nodes despite cache defaults",
    Effect.fnUntraced(function* () {
      const rows = yield* joinCacheCensusPlan([workspace], {
        tasks: [node("lint", "biome check ."), node("transit", "<NONEXISTENT>"), node("empty", " ")],
      }).pipe(provideCrypto);
      expect(A.length(rows)).toBe(3);
      expect(A.length(A.filter(rows, (row) => O.isSome(row.command)))).toBe(1);
      expect(A.every(rows, (row) => row.configuration.cache)).toBe(true);
    })
  );

  it.effect(
    "fails closed on phantom workspaces, duplicate identities and changed commands",
    Effect.fnUntraced(function* () {
      const lint = node("lint", "biome check .");
      const badCases = [
        { tasks: [{ ...lint, package: "@beep/absent" }] },
        { tasks: [lint, lint] },
        { tasks: [{ ...lint, taskId: "@beep/another#lint" }] },
        { tasks: [{ ...lint, command: "biome check . --write" }] },
      ];
      for (const plan of badCases) {
        expect(yield* joinCacheCensusPlan([workspace], plan).pipe(Effect.isFailure, provideCrypto)).toBe(true);
      }
    })
  );

  it.effect(
    "binds expanded input contents deterministically and preserves child config overrides",
    Effect.fnUntraced(function* () {
      const lint = node("lint", "biome check .");
      const baseline = yield* joinCacheCensusPlan([workspace], { tasks: [lint] }).pipe(provideCrypto);
      const permuted = yield* joinCacheCensusPlan([workspace], {
        tasks: [{ ...lint, inputs: { "src/b.ts": "input-b", "src/a.ts": "input-a" } }],
      }).pipe(provideCrypto);
      expect(permuted).toEqual(baseline);
      const changed = yield* joinCacheCensusPlan([workspace], {
        tasks: [
          {
            ...lint,
            inputs: { ...lint.inputs, "src/a.ts": "changed" },
            resolvedTaskDefinition: { ...lint.resolvedTaskDefinition, outputs: ["reports/**"], cache: false },
          },
        ],
      }).pipe(provideCrypto);
      expect(O.getOrThrow(A.head(changed)).inputsDigest).not.toBe(O.getOrThrow(A.head(baseline)).inputsDigest);
      expect(O.getOrThrow(A.head(changed)).configuration.outputs).toEqual(["reports/**"]);
      expect(O.getOrThrow(A.head(changed)).configuration.cache).toBe(false);
    })
  );
});

describe("computation configuration fingerprint", () => {
  it.effect(
    "retains graph-only dependencies and ignores discovery order and ordinary input values",
    Effect.fnUntraced(function* () {
      const census = yield* fingerprintFixture();
      const first = yield* fingerprintCacheComputation(key, census, toolchain);
      const reordered = CacheCensusReport.make({
        ...census,
        nodes: A.reverse(A.map(census.nodes, (row) => CacheCensusNode.make({ ...row, inputsDigest: changedDigest }))),
        sources: A.reverse(census.sources),
      });
      const second = yield* fingerprintCacheComputation(key, reordered, toolchain);
      expect(second.configurationDigest).toBe(first.configurationDigest);
      expect(first.configuration.nodes).toHaveLength(2);
      expect(
        O.getOrThrow(A.findFirst(first.configuration.nodes, (row) => row.id === "@beep/fixture#transit")).command
      ).toEqual(O.none());
    }, provideCrypto)
  );

  it.effect(
    "invalidates nested commands, dependencies, global settings and root or child configuration",
    Effect.fnUntraced(function* () {
      const census = yield* fingerprintFixture();
      const first = yield* fingerprintCacheComputation(key, census, toolchain);
      const cases = [
        CacheCensusReport.make({ ...census, globalConfiguration: { env: ["SEMANTIC_INPUT"] } }),
        ...A.map(census.sources, (changed) =>
          CacheCensusReport.make({
            ...census,
            sources: A.map(census.sources, (source) =>
              source.path === changed.path ? CacheCensusSource.make({ ...source, sha256: changedDigest }) : source
            ),
          })
        ),
        CacheCensusReport.make({
          ...census,
          nodes: A.map(census.nodes, (row) => CacheCensusNode.make({ ...row, commandDigest: changedDigest })),
        }),
        CacheCensusReport.make({
          ...census,
          nodes: A.map(census.nodes, (row) => CacheCensusNode.make({ ...row, dependencies: [] })),
        }),
      ];
      for (const changed of cases) {
        expect((yield* fingerprintCacheComputation(key, changed, toolchain)).configurationDigest).not.toBe(
          first.configurationDigest
        );
      }
      const runtime = yield* fingerprintCacheComputation(
        key,
        census,
        CacheToolchainSnapshot.make({
          ...toolchain,
          bun: CacheExecutablePin.make({ ...tool, sha256: changedDigest }),
        })
      );
      expect(runtime.configurationDigest).toBe(first.configurationDigest);
      expect(runtime.toolchainDigest).not.toBe(first.toolchainDigest);
    }, provideCrypto)
  );

  it.effect(
    "rejects missing dependencies, absent scripts and mismatched runtime profiles",
    Effect.fnUntraced(function* () {
      const census = yield* fingerprintFixture();
      const incomplete = CacheCensusReport.make({
        ...census,
        nodes: A.filter(census.nodes, (row) => row.id === key.computation),
      });
      expect(yield* fingerprintCacheComputation(key, incomplete, toolchain).pipe(Effect.isFailure)).toBe(true);
      for (const computation of ["@beep/fixture#transit", "@beep/absent#lint"]) {
        expect(
          yield* fingerprintCacheComputation(
            CacheQualificationKey.make({ ...key, computation }),
            census,
            toolchain
          ).pipe(Effect.isFailure)
        ).toBe(true);
      }
      expect(
        yield* fingerprintCacheComputation(
          CacheQualificationKey.make({ ...key, profile: "another-profile" }),
          census,
          toolchain
        ).pipe(Effect.isFailure)
      ).toBe(true);
    }, provideCrypto)
  );
});
