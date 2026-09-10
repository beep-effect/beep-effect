import {
  CacheCensusNode,
  CacheCensusReport,
  CacheCensusSource,
  CacheCensusWorkspace,
  CacheDependencyTree,
  CacheExecutablePin,
  CacheLinkedFile,
  CacheLinkerResolution,
  CacheRuntimeLinkerSnapshot,
  CacheToolchainSnapshot,
} from "@beep/repo-cli/commands/Cache";
import { fingerprintCacheComputation, joinCacheCensusPlan, projectCacheActivation } from "@beep/repo-cli/test/Cache";
import {
  CacheActivationProjection,
  CacheEvidenceReference,
  CacheQualificationKey,
  CacheTaskConfiguration,
} from "@beep/repo-configs/cache";
import { NonNegativeInt, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

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
const provideCrypto = provideScopedLayer(NodeCrypto.layer);
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
  bun: CacheExecutablePin.make({ ...tool, version: "1.4.1" }),
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
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

const activationFixture = Effect.fn("CacheCensusTest.activationFixture")(function* () {
  const before = '{"extends":["//"],"tasks":{"lint":{"cache":false,"outputs":[]}}}';
  const after = '{"extends":["//"],"tasks":{"lint":{"cache":true,"outputs":[]}}}';
  const beforeDigest = yield* hashBytes(new TextEncoder().encode(before));
  const afterDigest = yield* hashBytes(new TextEncoder().encode(after));
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
const encodeJsonObjectJson = S.encodeEffect(S.fromJsonString(S.JsonObject));

describe("reviewed cache activation projection", () => {
  it.effect("rejects arbitrary replacement task semantics despite a correctly rebound artifact digest", () =>
    Arbitrary.checkEffect(
      Arbitrary.schema(CacheTaskConfiguration),
      (configuration) =>
        Effect.gen(function* () {
          const f = yield* activationFixture();
          const after = yield* encodeJsonObjectJson({
            extends: ["//"],
            tasks: { lint: { ...configuration, cache: true } },
          });
          const sha256 = yield* hashBytes(new TextEncoder().encode(after));
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
          return true;
        }).pipe(provideCrypto),
      fcRuns(50)
    ).pipe(Effect.map((result) => expect(result._tag).toBe("Passed")))
  );

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
        const sha256 = yield* hashBytes(new TextEncoder().encode(after));
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
    "joins root tasks only against the explicit root manifest and preserves their dependencies",
    Effect.fnUntraced(function* () {
      const rootWorkspace = CacheCensusWorkspace.make({
        name: "//",
        directory: ".",
        scripts: { "lint:policy-fingerprint": "bun run beep lint policy-fingerprint --check" },
      });
      const rootTask = {
        ...node("lint:policy-fingerprint", rootWorkspace.scripts["lint:policy-fingerprint"]),
        taskId: "//#lint:policy-fingerprint",
        package: "//",
      };
      const lint = { ...node("lint", "biome check ."), dependencies: [rootTask.taskId] };
      const rows = yield* joinCacheCensusPlan([rootWorkspace, workspace], { tasks: [rootTask, lint] });
      expect(rows[0]?.workspace).toBe("//");
      expect(rows[0]?.command).toEqual(O.some(rootTask.command));
      expect(rows[1]?.dependencies).toEqual([rootTask.taskId]);
      expect(yield* joinCacheCensusPlan([workspace], { tasks: [rootTask, lint] }).pipe(Effect.isFailure)).toBe(true);
      expect(
        yield* joinCacheCensusPlan([rootWorkspace], {
          tasks: [{ ...rootTask, command: "unreviewed root script" }],
        }).pipe(Effect.isFailure)
      ).toBe(true);
    }, provideCrypto)
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
    "invalidates runtime identity for library bytes, alias targets, loader and selected client linkage",
    Effect.fnUntraced(function* () {
      const census = yield* fingerprintFixture();
      const file = CacheLinkedFile.make({ path: "/usr/lib/lib.so", target: "/usr/lib/lib-v1.so", sha256: digest });
      const dynamic = CacheLinkerResolution.cases.Dynamic.make({ files: [file] });
      const linker = CacheRuntimeLinkerSnapshot.make({
        format: "glibc-ldd/v1",
        detector: CacheLinkedFile.make({ ...file, path: "/usr/bin/ldd", target: "/usr/bin/ldd" }),
        loader: CacheLinkedFile.make({ ...file, path: "/lib64/ld.so", target: "/usr/lib/ld.so" }),
        executables: {
          bun: dynamic,
          node: dynamic,
          biome: dynamic,
          bash: dynamic,
          sh: dynamic,
          turbo: CacheLinkerResolution.cases.Static.make({}),
        },
      });
      const observe = Effect.fn("CacheCensusTest.observeLinker")((runtimeLinker: CacheRuntimeLinkerSnapshot) =>
        fingerprintCacheComputation(
          key,
          census,
          CacheToolchainSnapshot.make({ ...toolchain, runtimeLinker: O.some(runtimeLinker) })
        )
      );
      const before = yield* observe(linker);
      const changedFiles = [
        CacheLinkedFile.make({ ...file, sha256: changedDigest }),
        CacheLinkedFile.make({ ...file, target: "/usr/lib/lib-v2.so" }),
      ];
      const changes = [
        ...A.map(changedFiles, (changed) =>
          CacheRuntimeLinkerSnapshot.make({
            ...linker,
            executables: {
              ...linker.executables,
              node: CacheLinkerResolution.cases.Dynamic.make({ files: [changed] }),
            },
          })
        ),
        CacheRuntimeLinkerSnapshot.make({
          ...linker,
          loader: CacheLinkedFile.make({ ...linker.loader, sha256: changedDigest }),
        }),
        CacheRuntimeLinkerSnapshot.make({ ...linker, executables: { ...linker.executables, turbo: dynamic } }),
      ];
      for (const changed of changes) {
        const after = yield* observe(changed);
        expect(after.configurationDigest).toBe(before.configurationDigest);
        expect(after.toolchainDigest).not.toBe(before.toolchainDigest);
      }
      expect((yield* fingerprintCacheComputation(key, census, toolchain)).toolchainDigest).not.toBe(
        before.toolchainDigest
      );
    }, provideCrypto)
  );

  it.effect(
    "invalidates runtime identity when dependency, helper or client bytes change",
    Effect.fnUntraced(function* () {
      const census = yield* fingerprintFixture();
      const tree = CacheDependencyTree.make({
        format: "canonical-gnu-tar/v1",
        sha256: digest,
        regularFiles: NonNegativeInt.make(1),
        entries: NonNegativeInt.make(2),
        bytes: NonNegativeInt.make(1),
        links: [],
      });
      const first = yield* fingerprintCacheComputation(
        key,
        census,
        CacheToolchainSnapshot.make({
          ...toolchain,
          installedDependencies: O.some(tree),
        })
      );
      const second = yield* fingerprintCacheComputation(
        key,
        census,
        CacheToolchainSnapshot.make({
          ...toolchain,
          installedDependencies: O.some(CacheDependencyTree.make({ ...tree, sha256: changedDigest })),
        })
      );
      expect(first.configurationDigest).toBe(second.configurationDigest);
      expect(first.toolchainDigest).not.toBe(second.toolchainDigest);
      const absent = yield* fingerprintCacheComputation(key, census, toolchain);
      expect(first.toolchainDigest).not.toBe(absent.toolchainDigest);
      const helperBefore = yield* fingerprintCacheComputation(
        key,
        census,
        CacheToolchainSnapshot.make({
          ...toolchain,
          sources: [CacheCensusSource.make({ path: "/usr/bin/ldd", sha256: digest })],
        })
      );
      const helperAfter = yield* fingerprintCacheComputation(
        key,
        census,
        CacheToolchainSnapshot.make({
          ...toolchain,
          sources: [CacheCensusSource.make({ path: "/usr/bin/ldd", sha256: changedDigest })],
        })
      );
      expect(helperBefore.configurationDigest).toBe(helperAfter.configurationDigest);
      expect(helperBefore.toolchainDigest).not.toBe(helperAfter.toolchainDigest);
      const client = yield* fingerprintCacheComputation(
        key,
        census,
        CacheToolchainSnapshot.make({
          ...toolchain,
          turbo: CacheExecutablePin.make({ ...toolchain.turbo, sha256: changedDigest }),
        })
      );
      expect(absent.configurationDigest).toBe(client.configurationDigest);
      expect(absent.toolchainDigest).not.toBe(client.toolchainDigest);
    }, provideCrypto)
  );

  it.effect(
    "isolates Bun profiles and rejects a relabeled runtime",
    Effect.fnUntraced(function* () {
      const census = yield* fingerprintFixture();
      const updatedKey = CacheQualificationKey.make({ ...key, profile: "local-linux-x64-bun1.4.2" });
      const updated = CacheToolchainSnapshot.make({
        ...toolchain,
        profile: "local-linux-x64-bun1.4.2",
        bun: CacheExecutablePin.make({ version: "1.4.2", sha256: changedDigest }),
      });
      const before = yield* fingerprintCacheComputation(key, census, toolchain);
      const after = yield* fingerprintCacheComputation(updatedKey, census, updated);
      expect(after.configurationDigest).toBe(before.configurationDigest);
      expect(after.toolchainDigest).not.toBe(before.toolchainDigest);
      expect(yield* fingerprintCacheComputation(key, census, updated).pipe(Effect.isFailure)).toBe(true);
      expect(
        yield* fingerprintCacheComputation(
          updatedKey,
          census,
          CacheToolchainSnapshot.make({ ...updated, bun: toolchain.bun })
        ).pipe(Effect.isFailure)
      ).toBe(true);
    }, provideCrypto)
  );

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
          bun: CacheExecutablePin.make({ ...toolchain.bun, sha256: changedDigest }),
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
