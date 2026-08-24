import {
  BaselineOutputStamp,
  DeletePackageBaselineWriters,
  DeletePackagePolicy,
  DeletePackagePolicyEvaluation,
  DependentHit,
  DependentsReport,
  deletePackageCommand,
  dependentsOfAtRoot,
  inspectTargetAtRoot,
  planInverseForTarget,
  RegistrationTarget,
} from "@beep/repo-cli/test/DeletePackage";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { PosixPath } from "@beep/schema/PosixPath";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, ConfigProvider, Effect, FileSystem, Layer, Path, pipe, Sink, Stream } from "effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import { describe, expect, it } from "vitest";
import { expectReportedExit, withTempWorkingDirectory } from "./support/CommandTest.ts";
import type { DeletePackageRefusal } from "@beep/repo-cli/test/DeletePackage";

const provideNode = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
  );

const withTempDirectory = <A, E, R>(use: (directory: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (directory) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(directory, { recursive: true, force: true });
      })
  );

const target = RegistrationTarget.make({
  packageName: "@beep/courtlistener",
  packagePath: PosixPath.make("packages/drivers/courtlistener"),
  private: true,
});

const commandLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);
const nonCiCommandLayer = Layer.mergeAll(
  commandLayer,
  ConfigProvider.layer(ConfigProvider.fromUnknown({ CI: "false" }))
);
const runDeletePackage = Command.runWith(deletePackageCommand, { version: "0.0.0" });

describe("delete-package registration geometry", () => {
  it("reports every synthetic PR #680 residue class without relying on ambient state", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;

            yield* fs.makeDirectory(path.join(repoRoot, "packages", "drivers", "courtlistener", "node_modules"), {
              recursive: true,
            });
            yield* fs.writeFileString(
              path.join(repoRoot, "packages", "drivers", "courtlistener", "node_modules", ".artifact"),
              "local\n"
            );
            yield* fs.makeDirectory(path.join(repoRoot, "packages", "foundation", "modeling", "identity", "src"), {
              recursive: true,
            });
            yield* fs.writeFileString(
              path.join(repoRoot, "packages", "foundation", "modeling", "identity", "src", "packages.ts"),
              'const composers = $I.compose("courtlistener")\nexport const $CourtlistenerId = composers.$CourtlistenerId\n'
            );
            yield* fs.makeDirectory(path.join(repoRoot, "standards"), { recursive: true });
            yield* fs.writeFileString(
              path.join(repoRoot, "standards", "jsdoc-documentation.inventory.jsonc"),
              '{ "package": "@beep/courtlistener" }\n'
            );
            yield* fs.makeDirectory(path.join(repoRoot, ".changeset"), { recursive: true });
            yield* fs.writeFileString(
              path.join(repoRoot, ".changeset", "orphan-courtlistener.md"),
              '---\n"@beep/courtlistener": patch\n---\n\nStale pending bump.\n'
            );
            yield* fs.writeFileString(
              path.join(repoRoot, ".changeset", "delete-courtlistener.md"),
              "---\n{}\n---\n\nNo release: remove `@beep/courtlistener` from the workspace.\n"
            );

            const observations = yield* inspectTargetAtRoot(repoRoot, target);
            const byId = (id: string) => A.findFirst(observations, (item) => item.surfaceId === id);

            expect(O.getOrThrow(byId("jsdoc-inventory")).status).toBe("residue");
            const pendingChangesets = O.getOrThrow(byId("pending-changesets"));
            expect(pendingChangesets.status).toBe("residue");
            expect(pendingChangesets.evidence).toContain(".changeset/orphan-courtlistener.md");
            expect(pendingChangesets.evidence).not.toContain(".changeset/delete-courtlistener.md");
            expect(O.getOrThrow(byId("identity-segment")).status).toBe("residue");
            expect(O.getOrThrow(byId("runtime-artifacts")).status).toBe("residue");
          })
        )
      )
    ));

  it("rejects tampered and mismatched deletion notes that reuse the canonical basename", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const deletionNote = path.join(repoRoot, ".changeset", "delete-courtlistener.md");
            yield* fs.makeDirectory(path.join(repoRoot, ".changeset"), { recursive: true });

            for (const content of [
              "---\n{}\n---\n\nNo release: remove `@beep/courtlistener` from the workspace. Tampered.\n",
              "---\n{}\n---\n\nNo release: remove `@beep/other` from the workspace.\n",
              '---\n"@beep/courtlistener": patch\n---\n\nNo release: remove `@beep/courtlistener` from the workspace.\n',
            ]) {
              yield* fs.writeFileString(deletionNote, content);
              const observations = yield* inspectTargetAtRoot(repoRoot, target);
              const pendingChangesets = O.getOrThrow(
                A.findFirst(observations, (item) => item.surfaceId === "pending-changesets")
              );
              expect(pendingChangesets.status).toBe("residue");
              expect(pendingChangesets.evidence).toContain(".changeset/delete-courtlistener.md");
            }
          })
        )
      )
    ));

  it("delete-package --check prints every synthetic residue class and exits nonzero", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString("package.json", '{ "name": "fixture", "private": true, "workspaces": [] }\n');
          yield* fs.makeDirectory(path.join("packages", "drivers", "courtlistener", "node_modules"), {
            recursive: true,
          });
          yield* fs.writeFileString(
            path.join("packages", "drivers", "courtlistener", "node_modules", ".artifact"),
            "local\n"
          );
          yield* fs.makeDirectory(path.join("packages", "foundation", "modeling", "identity", "src"), {
            recursive: true,
          });
          yield* fs.writeFileString(
            path.join("packages", "foundation", "modeling", "identity", "src", "packages.ts"),
            'const composers = $I.compose("courtlistener")\nexport const $CourtlistenerId = composers.$CourtlistenerId\n'
          );
          yield* fs.makeDirectory("standards", { recursive: true });
          yield* fs.writeFileString(
            "standards/jsdoc-documentation.inventory.jsonc",
            '{ "package": "@beep/courtlistener" }\n'
          );
          yield* fs.makeDirectory(".changeset", { recursive: true });
          yield* fs.writeFileString(
            ".changeset/orphan-courtlistener.md",
            '---\n"@beep/courtlistener": patch\n---\n\nStale pending bump.\n'
          );

          const exit = yield* Effect.exit(runDeletePackage(["courtlistener", "--check"]));
          expectReportedExit(exit);
          const lines = yield* TestConsole.logLines;
          for (const surfaceId of ["jsdoc-inventory", "pending-changesets", "identity-segment", "runtime-artifacts"]) {
            expect(
              A.some(lines, (line) => P.isString(line) && Str.includes(`[check] ${surfaceId}: residue`)(line))
            ).toBe(true);
          }
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("classifies identity-accessor importers outside the target tree as hard import dependents", () =>
    Effect.runPromise(
      withTempDirectory((repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString(
            path.join(repoRoot, "package.json"),
            '{ "name": "fixture", "private": true, "workspaces": ["packages/consumer"] }\n'
          );
          yield* fs.writeFileString(path.join(repoRoot, "bun.lock"), "");
          yield* fs.makeDirectory(path.join(repoRoot, "packages", "consumer", "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "packages", "consumer", "package.json"),
            '{ "name": "@beep/consumer", "private": true }\n'
          );
          yield* fs.writeFileString(
            path.join(repoRoot, "packages", "consumer", "src", "index.ts"),
            'import { $CourtlistenerId } from "@beep/identity/packages"\n\nexport const id = $CourtlistenerId\n'
          );

          const report = yield* dependentsOfAtRoot(repoRoot, target);
          expect(A.some(report.hits, (hit) => hit.kind === "import-prod" && hit.owner === "@beep/consumer")).toBe(true);
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("classifies a nested resolved workspace as a hard path dependent of its ancestor", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* fs.realPath(".");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/container", "packages/container/child"] }\n'
          );
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.makeDirectory(path.join("packages", "container", "child"), { recursive: true });
          yield* fs.writeFileString(
            path.join("packages", "container", "package.json"),
            '{ "name": "@beep/container", "private": true }\n'
          );
          yield* fs.writeFileString(
            path.join("packages", "container", "child", "package.json"),
            '{ "name": "@beep/container-child", "private": true }\n'
          );
          const ancestor = RegistrationTarget.make({
            packageName: "@beep/container",
            packagePath: PosixPath.make("packages/container"),
            private: true,
          });

          const report = yield* dependentsOfAtRoot(repoRoot, ancestor);
          expect(A.map(report.hits, (hit) => `${hit.kind}|${hit.owner}|${hit.file}`)).toContain(
            "file-path|@beep/container-child|packages/container/child/package.json"
          );
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("classifies packet history and ledger references as historical, not live packet claims", () =>
    Effect.runPromise(
      withTempDirectory((repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString(
            path.join(repoRoot, "package.json"),
            '{ "name": "fixture", "private": true, "workspaces": [] }\n'
          );
          yield* fs.writeFileString(path.join(repoRoot, "bun.lock"), "");
          yield* fs.makeDirectory(path.join(repoRoot, "goals", "lab-x", "history"), { recursive: true });
          yield* fs.makeDirectory(path.join(repoRoot, "goals", "lab-x", "research"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "goals", "lab-x", "PLAN.md"),
            "# Plan\n\nShip @beep/courtlistener next.\n"
          );
          yield* fs.writeFileString(
            path.join(repoRoot, "goals", "lab-x", "history", "p4-evidence.md"),
            "# Evidence\n\nDeleted @beep/courtlistener during the slice.\n"
          );
          yield* fs.writeFileString(
            path.join(repoRoot, "goals", "lab-x", "research", "OPPORTUNITIES.md"),
            "# Ledger\n\nReceipt: @beep/courtlistener delete cost too much.\n"
          );

          const report = yield* dependentsOfAtRoot(repoRoot, target);
          const kindOf = (file: string) =>
            pipe(
              A.findFirst(report.hits, (hit) => Str.equivalence(hit.file, file)),
              O.map((hit) => hit.kind)
            );
          expect(kindOf("goals/lab-x/PLAN.md")).toStrictEqual(O.some("packet"));
          expect(kindOf("goals/lab-x/history/p4-evidence.md")).toStrictEqual(O.some("historical-doc"));
          expect(kindOf("goals/lab-x/research/OPPORTUNITIES.md")).toStrictEqual(O.some("historical-doc"));
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("ignores machine-local .beep artifacts in the authored-reference probe", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory(path.join(repoRoot, ".beep", "yeet", "runs", "20260817"), { recursive: true });
            yield* fs.writeFileString(
              path.join(repoRoot, ".beep", "yeet", "runs", "20260817", "pr-body.md"),
              "Deletes @beep/courtlistener from the workspace.\n"
            );

            const clean = yield* inspectTargetAtRoot(repoRoot, target);
            const authoredClean = O.getOrThrow(A.findFirst(clean, (item) => item.surfaceId === "authored-references"));
            expect(authoredClean.status).toBe("clean");

            yield* fs.makeDirectory(path.join(repoRoot, "infra"), { recursive: true });
            yield* fs.writeFileString(
              path.join(repoRoot, "infra", "deploy.yml"),
              "packages:\n  - '@beep/courtlistener'\n"
            );
            const dirty = yield* inspectTargetAtRoot(repoRoot, target);
            const authoredDirty = O.getOrThrow(A.findFirst(dirty, (item) => item.surfaceId === "authored-references"));
            expect(authoredDirty.status).toBe("residue");
            expect(authoredDirty.evidence).toContain("infra/deploy.yml");
            expect(A.some(authoredDirty.evidence, Str.startsWith(".beep/"))).toBe(false);
          })
        )
      )
    ));

  it("refuses deleting a live package whose README carries a promotion record", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/drivers/courtlistener"] }\n'
          );
          yield* fs.makeDirectory(path.join("packages", "drivers", "courtlistener"), { recursive: true });
          yield* fs.writeFileString(
            path.join("packages", "drivers", "courtlistener", "package.json"),
            '{ "name": "@beep/courtlistener", "private": true }\n'
          );
          yield* fs.writeFileString(
            path.join("packages", "drivers", "courtlistener", "README.md"),
            "# Courtlistener\n\n## Promotion Record\n\n- promoted export: none\n"
          );

          const exit = yield* Effect.exit(runDeletePackage(["courtlistener", "--dry-run"]));
          expectReportedExit(exit);
          const errors = yield* TestConsole.errorLines;
          expect(A.some(errors, (line) => P.isString(line) && Str.includes("promotion-record")(line))).toBe(true);
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("refuses a repository-root workspace target before planning recursive removal", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "@beep/root-target", "private": true, "workspaces": ["root-link"] }\n'
          );
          yield* fs.symlink(".", "root-link");

          const exit = yield* Effect.exit(runDeletePackage(["root-target", "--dry-run"]));
          expectReportedExit(exit);
          const errors = yield* TestConsole.errorLines;
          expect(A.some(errors, (line) => P.isString(line) && Str.includes("repository root")(line))).toBe(true);
          const lines = yield* TestConsole.logLines;
          expect(A.some(lines, (line) => P.isString(line) && Str.includes("Inverse plan")(line))).toBe(false);
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("refuses a workspace target that contains another resolved workspace", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/container", "packages/container/child"] }\n'
          );
          yield* fs.makeDirectory(path.join("packages", "container", "child"), { recursive: true });
          yield* fs.writeFileString(
            path.join("packages", "container", "package.json"),
            '{ "name": "@beep/container", "private": true }\n'
          );
          yield* fs.writeFileString(
            path.join("packages", "container", "child", "package.json"),
            '{ "name": "@beep/container-child", "private": true }\n'
          );

          const exit = yield* Effect.exit(runDeletePackage(["container", "--dry-run"]));
          expectReportedExit(exit);
          const errors = yield* TestConsole.errorLines;
          expect(
            A.some(
              errors,
              (line) => P.isString(line) && Str.includes("contains registered workspace packages/container/child")(line)
            )
          ).toBe(true);
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("revalidates the owned tree before applying a leaf deletion", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/drivers/courtlistener"] }\n'
          );
          yield* fs.writeFileString(
            "tsconfig.json",
            '{ "compilerOptions": { "paths": { "@beep/courtlistener": ["./packages/drivers/courtlistener/src/index.ts"] } } }\n'
          );
          yield* fs.writeFileString(
            "tsconfig.packages.json",
            '{ "references": [{ "path": "packages/drivers/courtlistener" }] }\n'
          );
          yield* fs.writeFileString(
            "syncpack.config.ts",
            [
              'import type { RcFile } from "syncpack";',
              "",
              "const config = {",
              "  source: [",
              '    "package.json",',
              '    "packages/drivers/courtlistener/package.json",',
              "  ],",
              "  customTypes: {},",
              "  versionGroups: [],",
              "} satisfies RcFile;",
              "",
              "export default config;",
              "",
            ].join("\n")
          );

          const packageDir = path.join("packages", "drivers", "courtlistener");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            '{ "name": "@beep/courtlistener", "private": true }\n'
          );
          yield* fs.writeFileString(path.join(packageDir, "src", "index.ts"), "export const alive = true;\n");

          const identityDir = path.join("packages", "foundation", "modeling", "identity", "src");
          yield* fs.makeDirectory(identityDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(identityDir, "packages.ts"),
            [
              'const composers = $I.compose("courtlistener");',
              "export const $CourtlistenerId = composers.$CourtlistenerId;",
              "",
            ].join("\n")
          );

          const exit = yield* Effect.exit(
            runDeletePackage([
              "courtlistener",
              "--force",
              "--allow-stale-packets",
              "--skip-lockfile",
              "--skip-baselines",
            ])
          );
          expect(Exit.isSuccess(exit), Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined).toBe(true);

          expect(yield* fs.exists(packageDir)).toBe(false);
          expect(yield* fs.readFileString("package.json")).not.toContain("packages/drivers/courtlistener");
          const lines = yield* TestConsole.logLines;
          expect(
            A.some(lines, (line) => P.isString(line) && Str.includes("removed with zero declared residue")(line))
          ).toBe(true);
        })
      ).pipe(provideScopedLayer(nonCiCommandLayer))
    ));

  it("emits a schema-versioned inverse plan containing every destructive surface before apply", () => {
    const plan = planInverseForTarget(target);
    expect(plan.version).toBe("registration-plan/v1");
    expect(A.map(plan.operations, (operation) => operation.surfaceId)).toEqual(
      expect.arrayContaining([
        "owned-tree",
        "workspace-literal",
        "identity-segment",
        "pending-changesets",
        "runtime-artifacts",
        "tsconfig-sync",
        "lockfile",
        "jsdoc-inventory",
        "coverage-baseline",
      ])
    );
    // The data-resource surface is conditional on decoded lab facts; a
    // non-lab target must never declare it.
    expect(A.map(plan.operations, (operation) => operation.surfaceId)).not.toContain("lab-postgres-schema");
    expect(A.every(plan.operations, (operation) => operation.detail.length > 0)).toBe(true);
  });
});

describe("delete-package baseline writers", () => {
  const stamp = (mtimeMillis: number, size: number) => BaselineOutputStamp.make({ mtimeMillis, size });
  const outcome = DeletePackageBaselineWriters.baselineStepOutcome;

  it("classifies writer exits: zero is ok, exit >= 2 always fails", () => {
    expect(outcome(0, "zero-only", O.none(), O.none())).toBe("ok");
    expect(outcome(0, "tolerate-finding-exit", O.none(), O.some(stamp(1, 1)))).toBe("ok");
    expect(outcome(2, "tolerate-finding-exit", O.none(), O.some(stamp(1, 1)))).toBe("failed");
    expect(outcome(3, "zero-only", O.none(), O.none())).toBe("failed");
  });

  it("never tolerates a finding exit under zero-only", () => {
    expect(outcome(1, "zero-only", O.none(), O.some(stamp(1, 1)))).toBe("failed");
  });

  it("tolerates exit 1 only when the verified output was provably written", () => {
    expect(outcome(1, "tolerate-finding-exit", O.none(), O.some(stamp(1_000, 10)))).toBe("tolerated");
    expect(outcome(1, "tolerate-finding-exit", O.some(stamp(1_000, 10)), O.some(stamp(2_000, 10)))).toBe("tolerated");
    expect(outcome(1, "tolerate-finding-exit", O.some(stamp(1_000, 10)), O.some(stamp(1_000, 12)))).toBe("tolerated");
    expect(outcome(1, "tolerate-finding-exit", O.some(stamp(1_000, 10)), O.some(stamp(1_000, 10)))).toBe("failed");
    expect(outcome(1, "tolerate-finding-exit", O.some(stamp(1_000, 10)), O.none())).toBe("failed");
    expect(outcome(1, "tolerate-finding-exit", O.none(), O.none())).toBe("failed");
  });

  it("keeps the fallow health baseline as the only tolerant step in the writer table", () => {
    const tolerant = A.filter(
      DeletePackageBaselineWriters.steps,
      (step) => step.exitPolicy === "tolerate-finding-exit"
    );
    const tolerantStep = O.getOrThrow(A.head(tolerant));
    expect(A.length(tolerant)).toBe(1);
    expect(tolerantStep.label).toBe("fallow health baseline");
    expect(O.getOrThrow(tolerantStep.verifiedOutput)).toBe("standards/fallow.health.regression-baseline.jsonc");
    for (const step of DeletePackageBaselineWriters.steps) {
      if (!Str.equivalence(step.label, "fallow health baseline")) {
        expect(step.exitPolicy).toBe("zero-only");
        expect(O.isNone(step.verifiedOutput)).toBe(true);
      }
    }
  });
});

const emptyReport = (forTarget: RegistrationTarget): DependentsReport =>
  DependentsReport.make({
    target: forTarget,
    directWorkspaceDependents: [],
    transitiveWorkspaceDependents: [],
    hits: [],
  });

const dependentReport = (forTarget: RegistrationTarget, kind: DependentHit["kind"]): DependentsReport =>
  DependentsReport.make({
    target: forTarget,
    directWorkspaceDependents: ["@beep/consumer"],
    transitiveWorkspaceDependents: ["@beep/consumer", "@beep/app"],
    hits: [
      DependentHit.make({
        kind,
        owner: "@beep/consumer",
        file: PosixPath.make("packages/consumer/src/index.ts"),
        line: O.some(1),
        direct: true,
      }),
    ],
  });

const policy = (overrides: Partial<DeletePackagePolicy> = {}): DeletePackagePolicy =>
  DeletePackagePolicy.make({
    allowPublished: false,
    allowStalePackets: true,
    cascade: false,
    force: true,
    pruneCatalog: false,
    rewritePackets: false,
    skipBaselines: false,
    inCi: false,
    retiredNameCollision: false,
    livePromotionRecord: false,
    cascadeClosureAllowed: true,
    catalogUniquenessProven: true,
    dropData: false,
    allowNonLocalData: false,
    dataResourceDeclared: false,
    dataConnectionNonLocal: false,
    dataOwnershipProven: false,
    ...overrides,
  });

describe("delete-package hard-refuse table", () => {
  const published = RegistrationTarget.make({ ...target, private: false });
  const protectedTarget = RegistrationTarget.make({
    packageName: "@beep/schema",
    packagePath: PosixPath.make("packages/foundation/modeling/schema"),
    private: true,
  });
  const cases: ReadonlyArray<
    readonly [string, RegistrationTarget, DependentsReport, DeletePackagePolicy, DeletePackageRefusal["kind"]]
  > = [
    ["production dependent", target, dependentReport(target, "manifest-prod"), policy(), "dependent"],
    ["test-only dependent", target, dependentReport(target, "import-test"), policy(), "dependent"],
    ["identity composer importer", target, dependentReport(target, "import-prod"), policy(), "dependent"],
    ["published package", published, emptyReport(published), policy(), "published"],
    ["live promotion record", target, emptyReport(target), policy({ livePromotionRecord: true }), "promotion-record"],
    ["protected slug", protectedTarget, emptyReport(protectedTarget), policy(), "protected-slug"],
    [
      "retired name collision",
      target,
      emptyReport(target),
      policy({ retiredNameCollision: true }),
      "retired-name-collision",
    ],
    [
      "cascade boundary",
      target,
      emptyReport(target),
      policy({ cascade: true, cascadeClosureAllowed: false }),
      "cascade-boundary",
    ],
    [
      "skip baselines in CI",
      target,
      emptyReport(target),
      policy({ skipBaselines: true, inCi: true }),
      "ci-skip-baselines",
    ],
    [
      "catalog prune without uniqueness",
      target,
      emptyReport(target),
      policy({ pruneCatalog: true, catalogUniquenessProven: false }),
      "catalog-uniqueness",
    ],
  ];

  it.each(cases)(
    "refuses %s and retains printable cascade evidence",
    (_label, caseTarget, report, casePolicy, expectedKind) => {
      const refusals = DeletePackagePolicyEvaluation.refusalReasons(caseTarget, report, casePolicy);
      expect(A.some(refusals, (refusal) => refusal.kind === expectedKind && refusal.severity === "hard")).toBe(true);
      const cascade = DeletePackagePolicyEvaluation.dependentsCascadeLines(report);
      expect(cascade[0]).toContain("direct:");
      expect(cascade[1]).toContain("transitive:");
    }
  );
});

describe("delete-package baseline writer stage", () => {
  const fakeSpawnerLayer = (exitCode: number, spawned: Array<string>) =>
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
      ChildProcessSpawner.make((command) =>
        Effect.sync(() => {
          if (command._tag === "StandardCommand") {
            spawned.push(A.join([command.command, ...command.args], " "));
          }
          return ChildProcessSpawner.makeHandle({
            pid: ChildProcessSpawner.ProcessId(1),
            exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
            isRunning: Effect.succeed(false),
            kill: () => Effect.void,
            stdin: Sink.drain,
            stdout: Stream.empty,
            stderr: Stream.empty,
            all: Stream.empty,
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
            unref: Effect.succeed(Effect.void),
          });
        })
      )
    );

  const coverageBaselineFixture = `{
  "schema_version": 2,
  "generated_at": "2026-08-17T00:00:00.000Z",
  "git_sha": "0123456789abcdef0123456789abcdef01234567",
  "command": "bun run coverage:baseline:write",
  "epsilon": 0.001,
  "minimum": { "lines": 70, "statements": 70, "branches": 50, "functions": 60 },
  "exemptions": {},
  "follow_ups": {},
  "packages": {
    "@beep/courtlistener": {
      "path": "packages/drivers/courtlistener",
      "lines": 100, "statements": 100, "branches": 100, "functions": 100,
      "uncovered": { "lines": 0, "statements": 0, "branches": 0, "functions": 0 },
      "files": {
        "packages/drivers/courtlistener/src/index.ts": {
          "lines": 100, "statements": 100, "branches": 100, "functions": 100,
          "uncovered": { "lines": 0, "statements": 0, "branches": 0, "functions": 0 }
        }
      }
    }
  }
}
`;

  it("subtracts the coverage baseline then runs every shell step in table order", () => {
    const spawned: Array<string> = [];
    return Effect.runPromise(
      withTempDirectory((repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.makeDirectory(path.join(repoRoot, "standards"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "standards", "coverage.regression-baseline.jsonc"),
            coverageBaselineFixture
          );

          yield* DeletePackageBaselineWriters.run(repoRoot, "@beep/courtlistener");

          const baseline = yield* fs.readFileString(
            path.join(repoRoot, "standards", "coverage.regression-baseline.jsonc")
          );
          expect(Str.includes("@beep/courtlistener")(baseline)).toBe(false);
          expect(spawned).toStrictEqual(
            A.map(DeletePackageBaselineWriters.steps, (step) => A.join(["bun", ...step.args], " "))
          );
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(commandLayer, fakeSpawnerLayer(0, spawned))))
    );
  });

  it("fails the stage on the first zero-only step that exits nonzero", () => {
    const spawned: Array<string> = [];
    return Effect.runPromise(
      withTempDirectory((repoRoot) =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(DeletePackageBaselineWriters.run(repoRoot, "@beep/courtlistener"));
          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            expect(Str.includes("fallow boundaries failed with exit code 1")(Cause.pretty(exit.cause))).toBe(true);
          }
          expect(A.length(spawned)).toBe(1);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(commandLayer, fakeSpawnerLayer(1, spawned))))
    );
  });
});

describe("delete-package packet-claim refusal", () => {
  const claimReport = (kind: DependentHit["kind"], file: string): DependentsReport =>
    DependentsReport.make({
      target,
      directWorkspaceDependents: [],
      transitiveWorkspaceDependents: [],
      hits: [DependentHit.make({ kind, owner: "goals", file: PosixPath.make(file), line: O.some(1), direct: false })],
    });

  it("soft-refuses a live packet claim when stale packets are not allowed", () => {
    const refusals = DeletePackagePolicyEvaluation.refusalReasons(
      target,
      claimReport("packet", "goals/lab-x/PLAN.md"),
      policy({ allowStalePackets: false })
    );
    expect(A.some(refusals, (refusal) => refusal.kind === "packet-claim" && refusal.severity === "soft")).toBe(true);
  });

  it("does not refuse on historical-doc hits from packet history or ledgers", () => {
    const refusals = DeletePackagePolicyEvaluation.refusalReasons(
      target,
      claimReport("historical-doc", "goals/lab-x/history/p4-evidence.md"),
      policy({ allowStalePackets: false })
    );
    expect(refusals).toStrictEqual([]);
  });
});
