import {
  DeletePackageDataResource,
  DeletePackagePolicy,
  DeletePackagePolicyEvaluation,
  DependentsReport,
  deletePackageCommand,
  inspectTargetAtRoot,
  LabTargetFacts,
  planInverseForTarget,
  RegistrationObservation,
  RegistrationSurface,
  RegistrationTarget,
  rewritePendingChangesets,
  surfacesForTarget,
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
import { withTempWorkingDirectory } from "./support/CommandTest.ts";
import type { DeletePackageRefusal } from "@beep/repo-cli/test/DeletePackage";

const provideNode = <A2, E, R>(effect: Effect.Effect<A2, E, R>) =>
  Effect.scoped(
    Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
  );

const withTempDirectory = <A2, E, R>(use: (directory: string) => Effect.Effect<A2, E, R>) =>
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

const labFacts = (postgresSchema: O.Option<string>): LabTargetFacts =>
  LabTargetFacts.make({
    manifestFile: PosixPath.make("apps/labs/probe/lab.manifest.json"),
    postgresSchema,
    localOnly: true,
  });

const labTarget = RegistrationTarget.make({
  packageName: "@beep/probe",
  packagePath: PosixPath.make("apps/labs/probe"),
  private: true,
  lab: O.some("lab_probe").pipe(labFacts, O.some),
});

const labTargetWithoutSchema = RegistrationTarget.make({
  packageName: "@beep/probe",
  packagePath: PosixPath.make("apps/labs/probe"),
  private: true,
  lab: O.none().pipe(labFacts, O.some),
});

const labTargetWithoutManifest = RegistrationTarget.make({
  packageName: "@beep/probe",
  packagePath: PosixPath.make("apps/labs/probe"),
  private: true,
});

const productTarget = RegistrationTarget.make({
  packageName: "@beep/courtlistener",
  packagePath: PosixPath.make("packages/drivers/courtlistener"),
  private: true,
});

const identitySurfaceOf = (target: RegistrationTarget) =>
  A.findFirst(surfacesForTarget(target), RegistrationSurface.guards["identity-segment"]);
const pendingSurfaceOf = (target: RegistrationTarget) =>
  A.findFirst(surfacesForTarget(target), RegistrationSurface.guards["pending-changeset"]);
const ownedTreeSurfaceOf = (target: RegistrationTarget) =>
  A.findFirst(surfacesForTarget(target), RegistrationSurface.guards["owned-tree"]);
const dataResourceSurfaceOf = (target: RegistrationTarget) =>
  A.findFirst(surfacesForTarget(target), RegistrationSurface.guards["data-resource"]);

const operationById = (target: RegistrationTarget, surfaceId: string) =>
  A.findFirst(planInverseForTarget(target).operations, (operation) => Str.equivalence(operation.surfaceId, surfaceId));

const commandLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);
const runDeletePackage = Command.runWith(deletePackageCommand, { version: "0.0.0" });

describe("delete-package labs surface declarations", () => {
  it("routes the labs identity segment through the generatedLabComposers group", () => {
    const identity = O.getOrThrow(identitySurfaceOf(labTarget));
    expect(identity.generatedGroup).toEqual(O.some("generatedLabComposers"));
    const inverse = O.getOrThrow(operationById(labTarget, "identity-segment"));
    expect(inverse.detail).toContain("generatedLabComposers");
  });

  it("marks the labs pending-changeset surface ceremony-exempt", () => {
    const pending = O.getOrThrow(pendingSurfaceOf(labTarget));
    expect(pending.deletionNotePolicy).toBe("labs-exempt");
    const inverse = O.getOrThrow(operationById(labTarget, "pending-changesets"));
    expect(inverse.detail).toContain("labs deletion emits no changeset");
  });

  it("declares the lab manifest inside the owned tree", () => {
    const ownedTree = O.getOrThrow(ownedTreeSurfaceOf(labTarget));
    expect(ownedTree.artifacts).toContain("apps/labs/probe/lab.manifest.json");
  });

  it("declares a consent-gated data resource from decoded lab facts", () => {
    const dataResource = O.getOrThrow(dataResourceSurfaceOf(labTarget));
    expect(dataResource.id).toBe("lab-postgres-schema");
    expect(dataResource.owner).toBe("@beep/probe");
    expect(dataResource.resourceName).toBe("lab_probe");
    expect(dataResource.destructiveConsentFlag).toBe("--drop-data");
    expect(dataResource.localOnly).toBe(true);
    const inverse = O.getOrThrow(operationById(labTarget, "lab-postgres-schema"));
    expect(inverse.operation).toBe("require-consent");
  });

  it("declares no data resource without a manifest or without a postgres schema", () => {
    expect(O.isNone(dataResourceSurfaceOf(labTargetWithoutManifest))).toBe(true);
    expect(O.isNone(dataResourceSurfaceOf(labTargetWithoutSchema))).toBe(true);
  });

  it("keeps non-labs targets on the flat identity segment and the empty deletion note", () => {
    const identity = O.getOrThrow(identitySurfaceOf(productTarget));
    expect(O.isNone(identity.generatedGroup)).toBe(true);
    const pending = O.getOrThrow(pendingSurfaceOf(productTarget));
    expect(pending.deletionNotePolicy).toBe("emit-empty-note");
    expect(O.isNone(dataResourceSurfaceOf(productTarget))).toBe(true);
  });
});

describe("delete-package labs changeset rewrite", () => {
  const seedChangesets = Effect.fn(function* (repoRoot: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(path.join(repoRoot, ".changeset"), { recursive: true });
    yield* fs.writeFileString(
      path.join(repoRoot, ".changeset", "orphan-probe.md"),
      '---\n"@beep/probe": patch\n---\n\nStale pending bump.\n'
    );
    yield* fs.writeFileString(
      path.join(repoRoot, ".changeset", "multi.md"),
      '---\n"@beep/probe": patch\n"@beep/other": patch\n---\n\nTwo packages.\n'
    );
  });

  it("labs-exempt prunes pending changesets without emitting a deletion note", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* seedChangesets(repoRoot);
            yield* rewritePendingChangesets(repoRoot, "@beep/probe", "labs-exempt");
            expect(yield* fs.exists(path.join(repoRoot, ".changeset", "delete-probe.md"))).toBe(false);
            expect(yield* fs.exists(path.join(repoRoot, ".changeset", "orphan-probe.md"))).toBe(false);
            const multi = yield* fs.readFileString(path.join(repoRoot, ".changeset", "multi.md"));
            expect(multi).not.toContain("@beep/probe");
            expect(multi).toContain("@beep/other");
          })
        )
      )
    ));

  it("emit-empty-note still writes the canonical deletion note byte-identically", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* seedChangesets(repoRoot);
            yield* rewritePendingChangesets(repoRoot, "@beep/probe", "emit-empty-note");
            const note = yield* fs.readFileString(path.join(repoRoot, ".changeset", "delete-probe.md"));
            expect(note).toBe("---\n{}\n---\n\nNo release: remove `@beep/probe` from the workspace.\n");
            expect(yield* fs.exists(path.join(repoRoot, ".changeset", "orphan-probe.md"))).toBe(false);
          })
        )
      )
    ));
});

const emptyReport = (forTarget: RegistrationTarget): DependentsReport =>
  DependentsReport.make({
    target: forTarget,
    directWorkspaceDependents: [],
    transitiveWorkspaceDependents: [],
    hits: [],
  });

const dataPolicy = (overrides: Partial<DeletePackagePolicy> = {}): DeletePackagePolicy =>
  DeletePackagePolicy.make({
    allowPublished: false,
    allowStalePackets: true,
    cascade: false,
    force: false,
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

const refusalKinds = (policy: DeletePackagePolicy): ReadonlyArray<DeletePackageRefusal["kind"]> =>
  A.map(DeletePackagePolicyEvaluation.refusalReasons(labTarget, emptyReport(labTarget), policy), (item) => item.kind);

describe("delete-package labs data-phase policy", () => {
  it("hard-refuses --drop-data against a non-local connection without --allow-non-local-data", () => {
    expect(refusalKinds(dataPolicy({ dropData: true, dataConnectionNonLocal: true }))).toContain("data-non-local");
    expect(
      refusalKinds(dataPolicy({ dropData: true, dataConnectionNonLocal: true, allowNonLocalData: true }))
    ).not.toContain("data-non-local");
  });

  it("hard-refuses --drop-data when the declared schema is not derived from the lab slug", () => {
    expect(refusalKinds(dataPolicy({ dropData: true, dataResourceDeclared: true }))).toContain("data-ownership");
    expect(
      refusalKinds(dataPolicy({ dropData: true, dataResourceDeclared: true, dataOwnershipProven: true }))
    ).not.toContain("data-ownership");
  });

  it("treats --drop-data without a declared resource as a no-op, not a refusal", () => {
    expect(refusalKinds(dataPolicy({ dropData: true }))).toEqual([]);
  });

  it("derives the expected lab schema name mechanically from the slug", () => {
    expect(DeletePackageDataResource.expectedLabSchemaName("trustgraph-workbench")).toBe("lab_trustgraph_workbench");
    expect(DeletePackageDataResource.labSchemaOwnershipProven("probe", "lab_probe")).toBe(true);
    expect(DeletePackageDataResource.labSchemaOwnershipProven("probe", "lab_other")).toBe(false);
    expect(DeletePackageDataResource.renderManualDropStep("lab_probe")).toBe(
      'DROP SCHEMA IF EXISTS "lab_probe" CASCADE;'
    );
  });

  it("classifies DATABASE_URL locality by loopback and .localhost hosts only", () => {
    const isLocal = DeletePackageDataResource.isLocalDatabaseUrl;
    expect(isLocal("postgres://beep@localhost:5432/beep")).toBe(true);
    expect(isLocal("postgres://beep@127.0.0.1:5432/beep")).toBe(true);
    expect(isLocal("postgres://beep@[::1]:5432/beep")).toBe(true);
    expect(isLocal("postgres://beep@db.beep.localhost:5432/beep")).toBe(true);
    expect(isLocal("postgres://beep@db.prod.example.com:5432/beep")).toBe(false);
    expect(isLocal("not a database url")).toBe(false);
  });
});

describe("delete-package labs doctor semantics", () => {
  it("accepts the consent-required lab data-resource observation with actionable DROP evidence", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const observations = yield* inspectTargetAtRoot(repoRoot, labTarget);
            const dataResource = O.getOrThrow(
              A.findFirst(observations, (item) => Str.equivalence(item.surfaceId, "lab-postgres-schema"))
            );
            expect(dataResource.status).toBe("consent-required");
            expect(A.some(dataResource.evidence, Str.includes('DROP SCHEMA IF EXISTS "lab_probe" CASCADE;'))).toBe(
              true
            );
            expect(DeletePackagePolicyEvaluation.doctorIsClean(labTarget, observations)).toBe(true);
          })
        )
      )
    ));

  it("keeps consent-required acceptance scoped to the lab surface id and labs paths", () => {
    const consentObservation = (surfaceId: string) =>
      RegistrationObservation.make({ surfaceId, status: "consent-required", evidence: ["manual"] });
    expect(DeletePackagePolicyEvaluation.doctorIsClean(labTarget, [consentObservation("lab-postgres-schema")])).toBe(
      true
    );
    expect(DeletePackagePolicyEvaluation.doctorIsClean(labTarget, [consentObservation("other-surface")])).toBe(false);
    expect(
      DeletePackagePolicyEvaluation.doctorIsClean(productTarget, [consentObservation("lab-postgres-schema")])
    ).toBe(false);
    expect(
      DeletePackagePolicyEvaluation.doctorIsClean(labTarget, [
        RegistrationObservation.make({ surfaceId: "owned-tree", status: "residue", evidence: ["apps/labs/probe"] }),
      ])
    ).toBe(false);
  });

  it("reports labs identity residue from a generatedLabComposers fixture", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory(path.join(repoRoot, "packages", "foundation", "modeling", "identity", "src"), {
              recursive: true,
            });
            yield* fs.writeFileString(
              path.join(repoRoot, "packages", "foundation", "modeling", "identity", "src", "packages.ts"),
              'const generatedLabComposers = $I.compose("probe");\nexport const $ProbeId = composers.$ProbeId;\n'
            );
            const observations = yield* inspectTargetAtRoot(repoRoot, labTarget);
            const identity = O.getOrThrow(
              A.findFirst(observations, (item) => Str.equivalence(item.surfaceId, "identity-segment"))
            );
            expect(identity.status).toBe("residue");
          })
        )
      )
    ));

  it("upgrades a labs root TS solution reference from drift to residue", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.writeFileString(
              path.join(repoRoot, "tsconfig.packages.json"),
              '{ "references": [{ "path": "apps/labs/probe" }, { "path": "packages/drivers/courtlistener" }] }\n'
            );
            const labObservations = yield* inspectTargetAtRoot(repoRoot, labTarget);
            const labTsconfig = O.getOrThrow(
              A.findFirst(labObservations, (item) => Str.equivalence(item.surfaceId, "tsconfig-sync"))
            );
            expect(labTsconfig.status).toBe("residue");
            const productObservations = yield* inspectTargetAtRoot(repoRoot, productTarget);
            const productTsconfig = O.getOrThrow(
              A.findFirst(productObservations, (item) => Str.equivalence(item.surfaceId, "tsconfig-sync"))
            );
            expect(productTsconfig.status).toBe("drift");
          })
        )
      )
    ));
});

describe("delete-package labs manifest resolution", () => {
  const seedLabWorkspace = Effect.fn(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.writeFileString("bun.lock", "");
    yield* fs.writeFileString(
      "package.json",
      '{ "name": "fixture", "private": true, "workspaces": ["apps/labs/probe"] }\n'
    );
    yield* fs.makeDirectory(path.join("apps", "labs", "probe"), { recursive: true });
    yield* fs.writeFileString(
      path.join("apps", "labs", "probe", "package.json"),
      '{ "name": "@beep/probe", "private": true }\n'
    );
  });

  const warnedAboutManifest = Effect.gen(function* () {
    const errors = yield* TestConsole.errorLines;
    return A.some(errors, (line) => P.isString(line) && Str.includes("lab.manifest.json is missing or invalid")(line));
  });

  it("warns and proceeds when the lab manifest is missing (P2-D18)", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* seedLabWorkspace();
          yield* runDeletePackage(["probe", "--dry-run"]);
          expect(yield* warnedAboutManifest).toBe(true);
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("warns and proceeds when the lab manifest is corrupt (P2-D18)", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* seedLabWorkspace();
          yield* fs.writeFileString(path.join("apps", "labs", "probe", "lab.manifest.json"), "not json\n");
          yield* runDeletePackage(["probe", "--dry-run"]);
          expect(yield* warnedAboutManifest).toBe(true);
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));

  it("plans the consent-gated data resource from a decoded manifest", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* seedLabWorkspace();
          yield* fs.writeFileString(
            path.join("apps", "labs", "probe", "lab.manifest.json"),
            [
              "{",
              '  "schemaVersion": "lab-manifest/v1",',
              '  "purpose": "Probe lab",',
              '  "created": "2026-08-16",',
              '  "disposition": "active",',
              '  "postgresSchema": "lab_probe"',
              "}",
              "",
            ].join("\n")
          );
          yield* runDeletePackage(["probe", "--dry-run"]);
          const lines = yield* TestConsole.logLines;
          expect(
            A.some(lines, (line) => P.isString(line) && Str.includes("[require-consent] lab-postgres-schema")(line))
          ).toBe(true);
          expect(yield* warnedAboutManifest).toBe(false);
        })
      ).pipe(provideScopedLayer(commandLayer))
    ));
});
