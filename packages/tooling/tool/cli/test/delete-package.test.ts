import {
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
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
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

            const observations = yield* inspectTargetAtRoot(repoRoot, target);
            const byId = (id: string) => A.findFirst(observations, (item) => item.surfaceId === id);

            expect(O.getOrThrow(byId("jsdoc-inventory")).status).toBe("residue");
            expect(O.getOrThrow(byId("pending-changesets")).status).toBe("residue");
            expect(O.getOrThrow(byId("identity-segment")).status).toBe("residue");
            expect(O.getOrThrow(byId("runtime-artifacts")).status).toBe("residue");
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
    expect(A.every(plan.operations, (operation) => operation.detail.length > 0)).toBe(true);
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
