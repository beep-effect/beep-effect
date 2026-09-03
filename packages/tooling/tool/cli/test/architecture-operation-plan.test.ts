import { fileURLToPath } from "node:url";
import {
  applyCanonicalSliceOperationPlan,
  architectureCommand,
  CanonicalSliceOperationPlan,
  checkCanonicalSliceOperationPlan,
  decodeCanonicalSliceOperationPlanJson,
  encodeCanonicalSliceOperationPlanJson,
  makeArchitectureOperationPlan,
  makeArchitecturePackageOperationPlan,
  makeCanonicalSliceOperationPlan,
  WriteFileOperation,
  WritePackageJsonOperation,
} from "@beep/repo-cli/commands/Architecture";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const makeTempDirectory = (prefix: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory({ prefix })).pipe(
    provideScopedLayer(NodeServices.layer)
  );

const repoRoot = fileURLToPath(new URL("../../../../..", import.meta.url));
const isString = (value: unknown): value is string => typeof value === "string";
const joinPath = (base: string, ...segments: ReadonlyArray<string>): string =>
  [Str.replace(/\/+$/u, "")(base), ...segments.map((segment) => Str.replace(/^\/+|\/+$/gu, "")(segment))]
    .filter((segment) => segment.length > 0)
    .join("/");
const runFileCommandSync = (command: string, args: ReadonlyArray<string>) => {
  const result = Bun.spawnSync([command, ...args], {
    stderr: "ignore",
    stdout: "ignore",
  });
  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.exitCode}`);
  }
};
const pathExistsSync = (path: string): boolean =>
  Bun.spawnSync(["test", "-e", path], { stderr: "ignore", stdout: "ignore" }).exitCode === 0;
const makeDirectory = (path: string) => Effect.sync(() => runFileCommandSync("mkdir", ["-p", path]));
const removePath = (path: string) => Effect.sync(() => runFileCommandSync("rm", ["-rf", path]));
const readText = (path: string) => Effect.promise(() => Bun.file(path).text());
const writeText = (path: string, content: string) => Effect.promise(() => Bun.write(path, content)).pipe(Effect.asVoid);

const architectureFixtureManifestPath = joinPath(
  repoRoot,
  "packages/tooling/tool/cli/test/fixtures/architecture-operation-plan/accepted-work-item-manifest.json"
);
const architectureProofRoots = [
  "packages/architecture-lab",
  "apps/architecture-lab-proof",
  "packages/_internal/db-admin",
] as const;
const architectureGeneratedSurfaceSegments = ["/dist/", "/docs/", "/.turbo/", "/node_modules/"] as const;
const architectureManifestIncludedSurfaceEntries = [
  "packages/architecture-lab/*/AGENTS.md",
  "packages/architecture-lab/*/LICENSE",
  "packages/architecture-lab/*/README.md",
  "packages/architecture-lab/*/docgen.json",
  "packages/architecture-lab/*/package.json",
  "packages/architecture-lab/*/tsconfig.json",
  "packages/architecture-lab/*/vitest.config.ts",
  "packages/architecture-lab/*/src/**",
  "packages/architecture-lab/*/test/**",
  "apps/architecture-lab-proof/{AGENTS.md,LICENSE,README.md,docgen.json,package.json,tsconfig.json,vitest.config.ts,src/**,test/**}",
  "packages/_internal/db-admin/{AGENTS.md,LICENSE,README.md,docgen.json,drizzle.config.ts,package.json,tsconfig.json,tsconfig.drizzle.json,vitest.config.ts,src/**,test/**}",
  "packages/_internal/db-admin/drizzle/**",
] as const;
const architectureManifestExcludedSurfaceEntries = [
  "dist/**",
  "docs/**",
  ".turbo/**",
  "node_modules/**",
  "node_modules/.tmp/**",
  "JSDOC_ANALYSIS.md",
] as const;
const sliceTopLevelManifestFiles = [
  "AGENTS.md",
  "LICENSE",
  "README.md",
  "docgen.json",
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
] as const;
const dbAdminTopLevelManifestFiles = [
  "AGENTS.md",
  "LICENSE",
  "README.md",
  "docgen.json",
  "drizzle.config.ts",
  "package.json",
  "tsconfig.json",
  "tsconfig.drizzle.json",
  "vitest.config.ts",
] as const;
const CommandTestLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer))
);
const runArchitectureCommand = Command.runWith(architectureCommand, {
  version: "0.0.0",
});

const PackageJsonPublishConfig = S.Struct({
  exports: S.Record(S.String, S.NullOr(S.String)),
  publishConfig: S.Struct({
    exports: S.Record(S.String, S.NullOr(S.String)),
  }),
});
const decodePackageJsonPublishConfig = S.decodeUnknownEffect(S.fromJsonString(PackageJsonPublishConfig));
const ArchitectureFixtureManifest = S.Struct({
  schemaVersion: S.Literal("architecture-fixture-manifest/v1"),
  acceptedOracle: S.String,
  includedSurfaces: S.Array(S.String),
  excludedSurfaces: S.Array(S.String),
});
const decodeArchitectureFixtureManifest = S.decodeUnknownEffect(S.fromJsonString(ArchitectureFixtureManifest));
const readGeneratedComparison = Effect.fn("ArchitectureOperationPlan.readGeneratedComparison")(function* (
  tempRoot: string,
  acceptedPath: string
) {
  const accepted = yield* readText(joinPath(repoRoot, acceptedPath));
  const generated = yield* readText(joinPath(tempRoot, acceptedPath));
  return { accepted, acceptedPath, generated };
});

const isGeneratedArchitectureSurface = (repoPath: string): boolean =>
  pipe(
    architectureGeneratedSurfaceSegments,
    A.some((segment) => Str.includes(segment)(repoPath))
  ) || Str.endsWith("JSDOC_ANALYSIS.md")(repoPath);

const isManifestIncludedRelativeFile = (
  repoPath: string,
  topLevelFiles: ReadonlyArray<string>,
  includeDrizzle = false
): boolean =>
  pipe(topLevelFiles, A.contains(repoPath)) ||
  Str.startsWith("src/")(repoPath) ||
  Str.startsWith("test/")(repoPath) ||
  (includeDrizzle && Str.startsWith("drizzle/")(repoPath));

const isManifestIncludedArchitectureProofFile = (repoPath: string): boolean => {
  if (Str.startsWith("packages/architecture-lab/")(repoPath)) {
    const relativePath = pipe(
      Str.replace("packages/architecture-lab/", "")(repoPath),
      Str.split("/"),
      A.drop(1),
      A.join("/")
    );
    return isManifestIncludedRelativeFile(relativePath, sliceTopLevelManifestFiles);
  }
  if (Str.startsWith("apps/architecture-lab-proof/")(repoPath)) {
    return isManifestIncludedRelativeFile(
      Str.replace("apps/architecture-lab-proof/", "")(repoPath),
      sliceTopLevelManifestFiles
    );
  }
  if (Str.startsWith("packages/_internal/db-admin/")(repoPath)) {
    return isManifestIncludedRelativeFile(
      Str.replace("packages/_internal/db-admin/", "")(repoPath),
      dbAdminTopLevelManifestFiles,
      true
    );
  }
  return false;
};

const collectDotKeepFiles = (rootDir: string, repoPath: string): ReadonlyArray<string> => {
  const result = Bun.spawnSync(["find", joinPath(rootDir, repoPath), "-type", "f", "-name", ".gitkeep"], {
    stderr: "ignore",
  });
  if (result.exitCode !== 0) {
    return [];
  }
  return pipe(
    Str.split("\n")(String(result.stdout)),
    A.filter(Str.isNonEmpty),
    A.map(Str.replace(`${rootDir.replace(/\/$/u, "")}/`, ""))
  );
};

const collectFiles = (rootDir: string, repoPath: string): ReadonlyArray<string> => {
  const glob = new Bun.Glob(`${repoPath}/**/*`);
  return pipe(
    Array.from(glob.scanSync({ cwd: rootDir })),
    A.appendAll(collectDotKeepFiles(rootDir, repoPath)),
    A.dedupe,
    A.filter((childRepoPath) => !isGeneratedArchitectureSurface(childRepoPath)),
    A.filter(isManifestIncludedArchitectureProofFile)
  );
};

const collectAcceptedArchitectureProofFiles = Effect.fn(function* () {
  const manifest = yield* readText(architectureFixtureManifestPath).pipe(
    Effect.flatMap(decodeArchitectureFixtureManifest)
  );
  expect(manifest.acceptedOracle).toBe("live architecture-lab WorkItem proof");
  expect(manifest.includedSurfaces).toEqual([...architectureManifestIncludedSurfaceEntries]);
  expect(manifest.excludedSurfaces).toEqual([...architectureManifestExcludedSurfaceEntries]);
  return pipe(
    architectureProofRoots,
    A.flatMap((proofRoot) => collectFiles(repoRoot, proofRoot)),
    A.sort(Order.String)
  );
});

describe("architecture operation plan", () => {
  it.effect(
    "round-trips as schema-decoded JSON",
    Effect.fnUntraced(function* () {
      const plan = makeCanonicalSliceOperationPlan();
      const json = yield* encodeCanonicalSliceOperationPlanJson(plan);
      const decoded = yield* decodeCanonicalSliceOperationPlanJson(json);

      expect(decoded.slice).toEqual({
        boundedContext: "architecture-lab",
        aggregate: "WorkItem",
        aggregatePath: "aggregates/WorkItem",
      });
      expect(A.map(decoded.roles, (role) => role.path)).toContain("packages/architecture-lab/domain");
      expect(A.map(decoded.operations, (operation) => operation.path)).toContain(
        "packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.model.ts"
      );
      expect(decoded.operations[0]?.operationId).toContain(":");
      expect(decoded.operations[0]?.operationSource).toBe("accepted-proof");
    })
  );

  it.effect(
    "decodes older v1 operation JSON with metadata defaults",
    Effect.fnUntraced(function* () {
      const rootDir = yield* makeTempDirectory("beep-architecture-legacy-plan-");
      const operationPath = "packages/architecture-lab/domain/src/index.ts";
      const legacyJson = `{
  "schemaVersion": "architecture-operation-plan/v1",
  "target": {
    "boundedContext": "architecture-lab",
    "concept": "WorkItem",
    "domainKind": "aggregates",
    "conceptPath": "aggregates/WorkItem",
    "stage": "full"
  },
  "roles": [
    {
      "role": "domain",
      "packageName": "@beep/architecture-lab-domain",
      "path": "packages/architecture-lab/domain",
      "exports": ["."]
    }
  ],
  "operations": [
    {
      "kind": "write-file",
      "role": "domain",
      "path": "${operationPath}",
      "writer": "template",
      "content": "export {}\\n",
      "description": "Legacy v1 write."
    }
  ]
}`;
      yield* makeDirectory(joinPath(rootDir, "packages/architecture-lab/domain/src"));
      yield* writeText(joinPath(rootDir, operationPath), "export {}\n");

      const decoded = yield* decodeCanonicalSliceOperationPlanJson(legacyJson);
      const result = yield* checkCanonicalSliceOperationPlan(rootDir, decoded).pipe(
        provideScopedLayer(NodeServices.layer)
      );

      yield* removePath(rootDir);
      expect(decoded.operations[0]?.operationId).toBe("legacy-operation");
      expect(decoded.operations[0]?.operationSource).toBe("legacy-plan");
      expect(decoded.operations[0]?.writeMode).toBe("write-if-missing");
      expect(result.operationStatuses[0]).toMatchObject({
        operationId: `write-file:${operationPath}`,
        status: "matching",
      });
    })
  );

  it.effect(
    "reports idempotency from the decoded operation list",
    Effect.fnUntraced(function* () {
      const rootDir = yield* makeTempDirectory("beep-architecture-plan-");
      const requiredFile = "packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.model.ts";
      yield* makeDirectory(joinPath(rootDir, "packages/architecture-lab/domain/src/aggregates/WorkItem"));
      yield* writeText(joinPath(rootDir, requiredFile), "export {}\n");

      const plan = makeCanonicalSliceOperationPlan();
      const result = yield* checkCanonicalSliceOperationPlan(
        rootDir,
        CanonicalSliceOperationPlan.make({
          ...plan,
          operations: A.filter(plan.operations, (operation) => operation.path === requiredFile),
        })
      ).pipe(provideScopedLayer(NodeServices.layer));

      yield* removePath(rootDir);
      expect(result.idempotent).toBe(true);
    })
  );

  it.effect(
    "generates every manifest-included WorkItem proof file and second apply is a no-op",
    Effect.fnUntraced(function* () {
      const tempRoot = yield* makeTempDirectory("beep-architecture-generated-");
      const acceptedFiles = yield* collectAcceptedArchitectureProofFiles();

      const proof = yield* Effect.gen(function* () {
        const plan = yield* makeArchitectureOperationPlan(repoRoot).pipe(provideScopedLayer(NodeServices.layer));
        const firstApply = yield* applyCanonicalSliceOperationPlan(tempRoot, plan).pipe(
          provideScopedLayer(NodeServices.layer)
        );
        const check = yield* checkCanonicalSliceOperationPlan(tempRoot, plan).pipe(
          provideScopedLayer(NodeServices.layer)
        );
        const secondApply = yield* applyCanonicalSliceOperationPlan(tempRoot, plan).pipe(
          provideScopedLayer(NodeServices.layer)
        );
        const plannedWritePaths = pipe(
          plan.operations,
          A.filter((operation) => operation.kind === "write-file" || operation.kind === "write-package-json"),
          A.map((operation) => operation.path),
          A.sort(Order.String)
        );
        const generatedComparisons = yield* Effect.forEach(acceptedFiles, (acceptedPath) =>
          readGeneratedComparison(tempRoot, acceptedPath)
        );

        return {
          check,
          firstApply,
          generatedComparisons,
          plan,
          plannedWritePaths,
          secondApply,
        };
      }).pipe(Effect.ensuring(removePath(tempRoot)));

      for (const { accepted, acceptedPath, generated } of proof.generatedComparisons) {
        expect(generated, acceptedPath).toBe(accepted);
      }
      expect(proof.plannedWritePaths).toEqual(acceptedFiles);
      expect(pipe(proof.firstApply.writtenPaths, A.sort(Order.String))).toEqual(acceptedFiles);
      expect(proof.check.idempotent).toBe(true);
      expect(proof.check.operationStatuses.length).toBe(proof.plan.operations.length);
      expect(proof.secondApply.writtenPaths).toEqual([]);
      expect(proof.secondApply.skippedPaths.length).toBeGreaterThan(0);
    })
  );

  it.effect(
    "generates a complete non-default aggregate slice plan with package scaffolds",
    Effect.fnUntraced(function* () {
      const tempRoot = yield* makeTempDirectory("beep-architecture-demo-generated-");

      const plan = yield* makeArchitectureOperationPlan(repoRoot, {
        boundedContext: "research-lab",
        concept: "Ticket",
        domainKind: "aggregates",
        stage: "core",
      }).pipe(provideScopedLayer(NodeServices.layer));
      const firstApply = yield* applyCanonicalSliceOperationPlan(tempRoot, plan).pipe(
        provideScopedLayer(NodeServices.layer)
      );
      const check = yield* checkCanonicalSliceOperationPlan(tempRoot, plan).pipe(
        provideScopedLayer(NodeServices.layer)
      );

      yield* removePath(tempRoot);
      expect(firstApply.writtenPaths).toContain("packages/research-lab/domain/package.json");
      expect(firstApply.writtenPaths).toContain("packages/research-lab/domain/src/index.ts");
      expect(firstApply.writtenPaths).not.toContain("packages/research-lab/domain/src/identity/ResearchLab.ts");
      expect(firstApply.writtenPaths).toContain("packages/research-lab/domain/src/aggregates/Ticket/Ticket.model.ts");
      expect(check.idempotent).toBe(true);
    })
  );

  it.effect(
    "rejects operation paths that escape the repository root before writing files",
    Effect.fnUntraced(function* () {
      const tempParent = yield* makeTempDirectory("beep-architecture-escape-");
      const tempRoot = joinPath(tempParent, "root");
      const outsideFileName = "outside.txt";
      const outsidePath = joinPath(tempParent, outsideFileName);
      const plan = makeCanonicalSliceOperationPlan();
      const escapedPlan = CanonicalSliceOperationPlan.make({
        ...plan,
        operations: [
          WriteFileOperation.make({
            kind: "write-file",
            role: "domain",
            path: `../${outsideFileName}`,
            writer: "template",
            content: "escaped\n",
            description: "Escaping write must be rejected.",
          }),
        ],
      });

      const error = yield* applyCanonicalSliceOperationPlan(tempRoot, escapedPlan).pipe(
        provideScopedLayer(NodeServices.layer),
        Effect.flip
      );
      const outsideExists = pathExistsSync(outsidePath);

      yield* removePath(tempParent);
      expect(error.message).toContain("Architecture operation path escapes repository root");
      expect(outsideExists).toBe(false);
    })
  );

  it.effect(
    "keeps global db-admin state out of non-default persistence slice plans",
    Effect.fnUntraced(function* () {
      const tempRoot = yield* makeTempDirectory("beep-architecture-persistence-generated-");

      const plan = yield* makeArchitectureOperationPlan(repoRoot, {
        boundedContext: "research-lab",
        concept: "Ticket",
        domainKind: "aggregates",
        stage: "persistence",
      }).pipe(provideScopedLayer(NodeServices.layer));
      const checkAfterApply = yield* applyCanonicalSliceOperationPlan(tempRoot, plan).pipe(
        Effect.flatMap(() => checkCanonicalSliceOperationPlan(tempRoot, plan)),
        provideScopedLayer(NodeServices.layer)
      );
      const plannedPaths = A.map(plan.operations, (operation) => operation.path);

      yield* removePath(tempRoot);
      expect(
        A.every(plannedPaths, (operationPath) => !Str.startsWith("packages/_internal/db-admin/")(operationPath))
      ).toBe(true);
      expect(A.every(plannedPaths, (operationPath) => !Str.includes("architecture_lab_work_item")(operationPath))).toBe(
        true
      );
      expect(checkAfterApply.idempotent).toBe(true);
    })
  );

  it.effect(
    "generates the accepted Worker entity archetype without aggregate-only roles",
    Effect.fnUntraced(function* () {
      const tempRoot = yield* makeTempDirectory("beep-architecture-worker-generated-");
      const acceptedPath = "packages/architecture-lab/domain/src/entities/Worker/Worker.model.ts";

      const plan = yield* makeArchitectureOperationPlan(
        repoRoot,
        {
          boundedContext: "architecture-lab",
          concept: "Worker",
          domainKind: "entities",
          stage: "full",
        },
        O.none()
      ).pipe(provideScopedLayer(NodeServices.layer));
      const firstApply = yield* applyCanonicalSliceOperationPlan(tempRoot, plan).pipe(
        provideScopedLayer(NodeServices.layer)
      );

      const generated = yield* readText(joinPath(tempRoot, acceptedPath));
      const accepted = yield* readText(joinPath(repoRoot, acceptedPath));
      const plannedRoles = A.map(plan.roles, (role) => role.role);

      yield* removePath(tempRoot);
      expect(firstApply.writtenPaths).toContain(acceptedPath);
      expect(generated).toBe(accepted);
      expect(plannedRoles).toEqual(["domain", "use-cases", "server", "tables", "db-admin"]);
      expect(A.map(plan.operations, (operation) => operation.path)).not.toContain(
        "packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts"
      );
    })
  );

  it.effect(
    "keeps existing entity and value archetype plans idempotent against the accepted checkout",
    Effect.fnUntraced(function* () {
      const workerPlan = yield* makeArchitectureOperationPlan(repoRoot, {
        boundedContext: "architecture-lab",
        concept: "Worker",
        domainKind: "entities",
        stage: "full",
      }).pipe(provideScopedLayer(NodeServices.layer));
      const priorityPlan = yield* makeArchitectureOperationPlan(repoRoot, {
        boundedContext: "architecture-lab",
        concept: "WorkPriority",
        domainKind: "values",
        stage: "full",
      }).pipe(provideScopedLayer(NodeServices.layer));
      const workerCheck = yield* checkCanonicalSliceOperationPlan(repoRoot, workerPlan).pipe(
        provideScopedLayer(NodeServices.layer)
      );
      const priorityCheck = yield* checkCanonicalSliceOperationPlan(repoRoot, priorityPlan).pipe(
        provideScopedLayer(NodeServices.layer)
      );

      expect(workerCheck.idempotent).toBe(true);
      expect(priorityCheck.idempotent).toBe(true);
    })
  );

  it.effect(
    "generates the accepted WorkPriority value archetype as domain-only",
    Effect.fnUntraced(function* () {
      const tempRoot = yield* makeTempDirectory("beep-architecture-priority-generated-");
      const acceptedPath = "packages/architecture-lab/domain/src/values/WorkPriority/WorkPriority.model.ts";

      const plan = yield* makeArchitectureOperationPlan(repoRoot, {
        boundedContext: "architecture-lab",
        concept: "WorkPriority",
        domainKind: "values",
        stage: "full",
      }).pipe(provideScopedLayer(NodeServices.layer));
      const firstApply = yield* applyCanonicalSliceOperationPlan(tempRoot, plan).pipe(
        provideScopedLayer(NodeServices.layer)
      );

      const generated = yield* readText(joinPath(tempRoot, acceptedPath));
      const accepted = yield* readText(joinPath(repoRoot, acceptedPath));

      yield* removePath(tempRoot);
      expect(firstApply.writtenPaths).toContain(acceptedPath);
      expect(generated).toBe(accepted);
      expect(A.map(plan.roles, (role) => role.role)).toEqual(["domain"]);
      expect(
        A.every(plan.operations, (operation) => operation.kind !== "write-file" || operation.role === "domain")
      ).toBe(true);
    })
  );

  it.effect(
    "rejects roles that are outside the selected domain-kind archetype",
    Effect.fnUntraced(function* () {
      const error = yield* makeArchitectureOperationPlan(
        repoRoot,
        {
          boundedContext: "architecture-lab",
          concept: "WorkPriority",
          domainKind: "values",
          stage: "full",
        },
        O.some(["server"])
      ).pipe(provideScopedLayer(NodeServices.layer), Effect.flip);

      expect(error.message).toContain("values concepts do not support role(s): server");
    })
  );

  it.effect(
    "creates a shell-only slice role package operation plan",
    Effect.fnUntraced(function* () {
      const plan = yield* makeArchitecturePackageOperationPlan({
        boundedContext: "research-lab",
        role: "use-cases",
      });
      const json = yield* encodeCanonicalSliceOperationPlanJson(plan);
      const decoded = yield* decodeCanonicalSliceOperationPlanJson(json);
      const plannedPaths = A.map(decoded.operations, (operation) => operation.path);
      const packageJsonOperation = O.getOrUndefined(
        A.findFirst(decoded.operations, (operation): operation is WritePackageJsonOperation =>
          S.is(WritePackageJsonOperation)(operation)
        )
      );

      expect(A.map(decoded.roles, (role) => role.role)).toEqual(["use-cases"]);
      expect(decoded.roles[0]?.exports).toEqual([".", "./public", "./server"]);
      expect(packageJsonOperation?.dependencies).toMatchObject({
        "@beep/research-lab-domain": "workspace:^",
        "@beep/identity": "workspace:^",
        "@beep/schema": "workspace:^",
      });
      expect(packageJsonOperation?.exports).not.toContain("./aggregates/*/server");
      expect(plannedPaths).toContain("packages/research-lab/use-cases/package.json");
      expect(plannedPaths).toContain("packages/research-lab/use-cases/src/index.ts");
      expect(plannedPaths).toContain("packages/research-lab/use-cases/src/public.ts");
      expect(plannedPaths).toContain("packages/research-lab/use-cases/src/server.ts");
      expect(A.some(plannedPaths, (operationPath) => Str.includes("/WorkItem/")(operationPath))).toBe(false);
      expect(A.some(plannedPaths, (operationPath) => Str.includes("/PackageShell/")(operationPath))).toBe(false);
    })
  );

  it.effect(
    "emits TypeScript source specifiers for every package role with an extra export",
    Effect.fnUntraced(function* () {
      const roleExports = [
        ["domain", 'export * as Aggregates from "./aggregates/index.ts";'],
        ["use-cases", 'export * from "./public.ts";'],
        ["config", 'export * from "./public.ts";'],
        ["server", 'export * from "./Layer.ts";'],
        ["tables", 'export * from "./tables.ts";'],
      ] as const;

      yield* Effect.forEach(
        roleExports,
        Effect.fnUntraced(function* ([role, expectedExport]) {
          const plan = yield* makeArchitecturePackageOperationPlan({
            boundedContext: "research-lab",
            role,
          });
          const indexOperation = O.getOrThrow(
            A.findFirst(
              plan.operations,
              (operation): operation is WriteFileOperation =>
                S.is(WriteFileOperation)(operation) && Str.endsWith("/src/index.ts")(operation.path)
            )
          );

          expect(indexOperation.content).toContain(expectedExport);
          expect(indexOperation.content).not.toContain('.js";');

          if (role === "config" || role === "server") {
            const layerSuffix = role === "config" ? "/src/layer.ts" : "/src/Layer.ts";
            const layerOperation = O.getOrThrow(
              A.findFirst(
                plan.operations,
                (operation): operation is WriteFileOperation =>
                  S.is(WriteFileOperation)(operation) && Str.endsWith(layerSuffix)(operation.path)
              )
            );
            const testLayerOperation = O.getOrThrow(
              A.findFirst(
                plan.operations,
                (operation): operation is WriteFileOperation =>
                  S.is(WriteFileOperation)(operation) && Str.endsWith("/src/test.ts")(operation.path)
              )
            );

            expect(layerOperation.content).toContain('import * as Layer from "effect/Layer";');
            expect(layerOperation.content).not.toContain('from "effect"');
            expect(testLayerOperation.content).toContain('import * as Layer from "effect/Layer";');
            expect(testLayerOperation.content).not.toContain('from "effect"');
          }
        }),
        { discard: true }
      );
    })
  );

  it.effect(
    "applies a shell-only slice role package twice with a no-op second apply",
    Effect.fnUntraced(function* () {
      const tempRoot = yield* makeTempDirectory("beep-architecture-package-shell-");
      const plan = yield* makeArchitecturePackageOperationPlan({
        boundedContext: "research-lab",
        role: "domain",
      });

      const firstApply = yield* applyCanonicalSliceOperationPlan(tempRoot, plan).pipe(
        provideScopedLayer(NodeServices.layer)
      );
      const check = yield* checkCanonicalSliceOperationPlan(tempRoot, plan).pipe(
        provideScopedLayer(NodeServices.layer)
      );
      const secondApply = yield* applyCanonicalSliceOperationPlan(tempRoot, plan).pipe(
        provideScopedLayer(NodeServices.layer)
      );
      const packageJson = yield* readText(joinPath(tempRoot, "packages/research-lab/domain/package.json"));
      const parsedPackageJson = yield* decodePackageJsonPublishConfig(packageJson);
      const index = yield* readText(joinPath(tempRoot, "packages/research-lab/domain/src/index.ts"));

      yield* removePath(tempRoot);
      expect(firstApply.writtenPaths).toContain("packages/research-lab/domain/package.json");
      expect(firstApply.writtenPaths).toContain("packages/research-lab/domain/src/aggregates/index.ts");
      expect(firstApply.writtenPaths).not.toContain("packages/research-lab/domain/src/aggregates/WorkItem/index.ts");
      expect(packageJson).toContain('"name": "@beep/research-lab-domain"');
      expect(packageJson).toContain('"@beep/shared-domain": "workspace:^"');
      expect(packageJson).toContain('"./aggregates": "./src/aggregates/index.ts"');
      expect(parsedPackageJson.exports["./aggregates/*"]).toBeUndefined();
      expect(parsedPackageJson.publishConfig?.exports?.["."]).toBe("./dist/index.js");
      expect(parsedPackageJson.publishConfig?.exports?.["./aggregates/*"]).toBeUndefined();
      expect(index).toContain('export * as Aggregates from "./aggregates/index.ts";');
      expect(index).toContain('export * as Values from "./values/index.ts";');
      expect(check.idempotent).toBe(true);
      expect(secondApply.writtenPaths).toEqual([]);
      expect(secondApply.skippedPaths.length).toBeGreaterThan(0);
    })
  );

  it.effect(
    "architecture plan command emits decoded JSON with operation metadata",
    Effect.fnUntraced(function* () {
      yield* runArchitectureCommand(["plan", "--stage", "core"]).pipe(provideScopedLayer(CommandTestLayer));
      const output = pipe(yield* TestConsole.logLines, A.filter(isString), A.join("\n"));
      const decoded = yield* decodeCanonicalSliceOperationPlanJson(output);

      expect(decoded.target.stage).toBe("core");
      expect(decoded.operations[0]?.operationId).toContain(":");
      expect(decoded.operations[0]?.operationSource).toBe("accepted-proof");
    })
  );

  it.effect(
    "architecture create package dry-run prints a plan without writing files",
    Effect.fnUntraced(function* () {
      const uniqueDir = yield* makeTempDirectory("dry-run-lab-");
      const sliceName = Str.replace(/^.*\//u, "")(uniqueDir);
      const targetDir = joinPath(repoRoot, "packages", sliceName);
      yield* removePath(uniqueDir);
      expect(pathExistsSync(targetDir)).toBe(false);

      yield* runArchitectureCommand(["create", "package", sliceName, "domain", "--dry-run"]).pipe(
        provideScopedLayer(CommandTestLayer)
      );
      const output = pipe(yield* TestConsole.logLines, A.filter(isString), A.join("\n"));
      const decoded = yield* decodeCanonicalSliceOperationPlanJson(output);

      expect(decoded.target.boundedContext).toBe(sliceName);
      expect(decoded.operations[0]?.operationSource).toBe("package-shell");
      expect(A.map(decoded.operations, (operation) => operation.path)).toContain(
        `packages/${sliceName}/domain/src/index.ts`
      );
      expect(pathExistsSync(targetDir)).toBe(false);
    })
  );

  it.effect(
    "architecture check command validates an operation-plan file",
    Effect.fnUntraced(function* () {
      const tempRoot = yield* makeTempDirectory("beep-architecture-check-");
      const planPath = joinPath(tempRoot, "plan.json");
      const plan = makeCanonicalSliceOperationPlan();
      const json = yield* encodeCanonicalSliceOperationPlanJson(plan);
      yield* writeText(planPath, json);

      yield* runArchitectureCommand(["check", "--file", planPath]).pipe(provideScopedLayer(CommandTestLayer));
      const output = pipe(yield* TestConsole.logLines, A.filter(isString), A.join("\n"));

      yield* removePath(tempRoot);
      expect(output).toContain("idempotent=true");
      expect(output).toContain(`operations=${plan.operations.length}`);
    })
  );
});
