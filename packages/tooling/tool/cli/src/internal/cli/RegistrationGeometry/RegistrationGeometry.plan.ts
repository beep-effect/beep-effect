import { Glob } from "@beep/schema/Glob";
import { PosixPath } from "@beep/schema/PosixPath";
import { A, Str } from "@beep/utils";
import * as O from "effect/Option";
import { isLabsWorkspacePath, LAB_MANIFEST_FILENAME } from "../Labs/index.ts";
import {
  AuthoredReferenceSurface,
  DataResourceSurface,
  DeletionNotePolicy,
  DerivedRebuildSurface,
  GeneratedInventorySurface,
  HistoricalRecordSurface,
  IdentitySegmentSurface,
  OwnedTreeSurface,
  PendingChangesetSurface,
  RegistrationOperation,
  RegistrationPlan,
  RegistrationSurface,
  RuntimeArtifactSurface,
  WorkspaceLiteralSurface,
} from "./RegistrationGeometry.schemas.ts";
import type { RegistrationTarget } from "./RegistrationGeometry.schemas.ts";

const slugOf = (packageName: string): string => Str.replace("@beep/", Str.empty)(packageName);

/**
 * Instantiate the closed P1 registration surface set for one package target.
 *
 * @category constructors
 * @since 0.0.0
 */
export const surfacesForTarget = (target: RegistrationTarget): ReadonlyArray<RegistrationSurface> => {
  const slug = slugOf(target.packageName);
  const packagePath = PosixPath.make(target.packagePath);
  const packageNeedles = [target.packageName, target.packagePath, `$${Str.pascalCase(slug)}Id`];
  const isLab = isLabsWorkspacePath(target.packagePath);
  const dataResourceSurfaces = O.toArray(
    O.flatMap(target.lab, (facts) =>
      O.map(facts.postgresSchema, (resourceName) =>
        DataResourceSurface.make({
          id: "lab-postgres-schema",
          owner: target.packageName,
          resourceName,
          localOnly: facts.localOnly,
          destructiveConsentFlag: "--drop-data",
        })
      )
    )
  );

  return [
    OwnedTreeSurface.make({
      id: "owned-tree",
      root: packagePath,
      artifacts: A.appendAll(
        A.map(
          [".beep", ".turbo", "dist", "coverage", "node_modules", "docs", ".next", "src-tauri/target"],
          (artifact) => Glob.make(`${target.packagePath}/${artifact}/**`)
        ),
        isLab ? [Glob.make(`${target.packagePath}/${LAB_MANIFEST_FILENAME}`)] : A.empty<Glob>()
      ),
    }),
    WorkspaceLiteralSurface.make({
      id: "workspace-literal",
      file: PosixPath.make("package.json"),
      workspacePath: packagePath,
    }),
    IdentitySegmentSurface.make({
      id: "identity-segment",
      registryFile: PosixPath.make("packages/foundation/modeling/identity/src/packages.ts"),
      packageName: target.packageName,
      slug,
      accessor: `$${Str.pascalCase(slug)}Id`,
      generatedGroup: isLab ? O.some("generatedLabComposers") : O.none(),
    }),
    DerivedRebuildSurface.make({
      id: "tsconfig-sync",
      writer: "tsconfig-sync",
      outputs: A.map(["tsconfig.json", "tsconfig.packages.json", "syncpack.config.ts"], (value) =>
        PosixPath.make(value)
      ),
    }),
    DerivedRebuildSurface.make({
      id: "lockfile",
      writer: "install",
      outputs: [PosixPath.make("bun.lock")],
    }),
    DerivedRebuildSurface.make({
      id: "fallow-boundaries",
      writer: "fallow-boundaries",
      outputs: A.map(
        ["standards/fallow.boundaries.generated.jsonc", "standards/fallow.boundaries.provenance.jsonc"],
        (value) => PosixPath.make(value)
      ),
    }),
    GeneratedInventorySurface.make({
      id: "jsdoc-inventory",
      writer: "jsdoc-inventory",
      outputs: A.map(
        ["standards/jsdoc-documentation.inventory.jsonc", "standards/jsdoc-documentation.inventory.md"],
        (value) => PosixPath.make(value)
      ),
      membershipKey: target.packageName,
    }),
    GeneratedInventorySurface.make({
      id: "coverage-baseline",
      writer: "coverage-baseline-replacement",
      outputs: [PosixPath.make("standards/coverage.regression-baseline.jsonc")],
      membershipKey: target.packageName,
    }),
    GeneratedInventorySurface.make({
      id: "fallow-health-baseline",
      writer: "fallow-boundaries",
      outputs: [PosixPath.make("standards/fallow.health.regression-baseline.jsonc")],
      membershipKey: target.packagePath,
    }),
    GeneratedInventorySurface.make({
      id: "fallow-dead-code-baseline",
      writer: "fallow-boundaries",
      outputs: [PosixPath.make("standards/fallow.dead-code.regression-baseline.jsonc")],
      membershipKey: target.packagePath,
    }),
    GeneratedInventorySurface.make({
      id: "schema-first-inventory",
      writer: "schema-first-inventory",
      outputs: [PosixPath.make("standards/schema-first.inventory.jsonc")],
      membershipKey: target.packagePath,
    }),
    GeneratedInventorySurface.make({
      id: "schema-catalog",
      writer: "schema-catalog",
      outputs: [PosixPath.make("standards/schema-catalog.generated.jsonc")],
      membershipKey: target.packagePath,
    }),
    GeneratedInventorySurface.make({
      id: "test-typecheck-baseline",
      writer: "test-typecheck-baseline",
      outputs: [PosixPath.make("standards/test-typecheck.blindspot-baseline.jsonc")],
      membershipKey: target.packageName,
    }),
    GeneratedInventorySurface.make({
      id: "knip-baseline",
      writer: "knip-baseline",
      outputs: [PosixPath.make("standards/knip.regression-baseline.jsonc")],
      membershipKey: target.packagePath,
    }),
    AuthoredReferenceSurface.make({
      id: "authored-references",
      files: A.map(
        [
          "package.json",
          "turbo.json",
          "lefthook.yml",
          "knip.jsonc",
          "biome.jsonc",
          ".github/**/*.yml",
          "apps/storybook/**/*",
          "infra/**/*",
          "goals/**/ops/manifest.json",
          "standards/**/*.jsonc",
        ],
        (value) => Glob.make(value)
      ),
      needles: packageNeedles,
    }),
    PendingChangesetSurface.make({
      id: "pending-changesets",
      changesetGlob: Glob.make(".changeset/*.md"),
      retiredRegistry: PosixPath.make("standards/changesets.retired-packages.json"),
      packageName: target.packageName,
      deletionNotePolicy: isLab ? "labs-exempt" : "emit-empty-note",
    }),
    RuntimeArtifactSurface.make({
      id: "runtime-artifacts",
      globs: A.map([`${target.packagePath}/**`, `.beep/ci/**/*${slug}*`, `.beep/ci/**`], (value) => Glob.make(value)),
    }),
    HistoricalRecordSurface.make({
      id: "historical-records",
      files: A.map(["research/**", "goals/**/research/**", "goals/**/history/**", ".changeset/**/*.md"], (value) =>
        Glob.make(value)
      ),
      needles: packageNeedles,
    }),
    ...dataResourceSurfaces,
  ];
};

const forwardOperation = RegistrationSurface.match({
  "owned-tree": (surface) =>
    RegistrationOperation.make({ surfaceId: surface.id, operation: "write", detail: `materialize ${surface.root}` }),
  "workspace-literal": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "write",
      detail: `ensure exact workspace member ${surface.workspacePath} only when uncovered`,
    }),
  "identity-segment": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "write",
      detail: O.match(surface.generatedGroup, {
        onNone: () => `register ${surface.slug} and ${surface.accessor}`,
        onSome: (group) => `sync ${surface.slug} and ${surface.accessor} into the generated ${group} group`,
      }),
    }),
  "derived-rebuild": (surface) =>
    RegistrationOperation.make({ surfaceId: surface.id, operation: "rebuild", detail: `run ${surface.writer}` }),
  "generated-inventory": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "rebuild",
      detail: `run ${surface.writer} for ${surface.membershipKey}`,
    }),
  "authored-reference": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "write",
      detail: `apply only modeled insertions for ${A.join(surface.needles, ", ")}`,
    }),
  "pending-changeset": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "write",
      detail: DeletionNotePolicy.$match(surface.deletionNotePolicy, {
        "emit-empty-note": () => `preserve pending policy for ${surface.packageName}`,
        "labs-exempt": () => `preserve pending policy for ${surface.packageName}; labs are changeset-exempt`,
      }),
    }),
  "runtime-artifact": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "preserve",
      detail: `runtime owns ${A.length(surface.globs)} artifact glob(s)`,
    }),
  "data-resource": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "require-consent",
      detail: `provision ${surface.resourceName} only from decoded ownership metadata`,
    }),
  "historical-record": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "preserve",
      detail: `preserve ${A.length(surface.files)} historical glob(s)`,
    }),
});

const inverseOperation = RegistrationSurface.match({
  "owned-tree": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "remove",
      detail: `remove contained tree ${surface.root} recursively, including ignored artifacts`,
    }),
  "workspace-literal": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "remove",
      detail: `remove exact workspace literal ${surface.workspacePath}; preserve covering globs`,
    }),
  "identity-segment": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "remove",
      detail: O.match(surface.generatedGroup, {
        onNone: () => `remove compose slug ${surface.slug}, export ${surface.accessor}, aliases, and shape row`,
        onSome: (group) => `remove ${surface.slug} and ${surface.accessor} from the generated ${group} composer group`,
      }),
    }),
  "derived-rebuild": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "rebuild",
      detail: `run reconstructive writer ${surface.writer}`,
    }),
  "generated-inventory": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "rebuild",
      detail: `regenerate every ${surface.writer} output and remove ${surface.membershipKey}`,
    }),
  "authored-reference": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "remove",
      detail: `remove only modeled exact references; refuse unknown hits for ${A.join(surface.needles, ", ")}`,
    }),
  "pending-changeset": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "remove",
      detail: DeletionNotePolicy.$match(surface.deletionNotePolicy, {
        "emit-empty-note": () =>
          `delete dedicated pending files, strip multi-package key ${surface.packageName}, and emit an empty deletion changeset`,
        "labs-exempt": () =>
          `delete dedicated pending files and strip multi-package key ${surface.packageName}; labs deletion emits no changeset (ceremony-exempt)`,
      }),
    }),
  "runtime-artifact": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "remove",
      detail: `purge ${A.length(surface.globs)} runtime artifact glob(s) and invalidate mirrors`,
    }),
  "data-resource": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "require-consent",
      detail: `require ${surface.destructiveConsentFlag}, ownership proof, and local connection before dropping ${surface.resourceName}`,
    }),
  "historical-record": (surface) =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation: "preserve",
      detail: `classify and preserve historical evidence in ${A.length(surface.files)} glob(s)`,
    }),
});

export const planForwardForTarget = (target: RegistrationTarget): RegistrationPlan =>
  RegistrationPlan.make({
    version: "registration-plan/v1",
    target,
    operations: A.map(surfacesForTarget(target), forwardOperation),
  });

export const planInverseForTarget = (target: RegistrationTarget): RegistrationPlan =>
  RegistrationPlan.make({
    version: "registration-plan/v1",
    target,
    operations: A.map(surfacesForTarget(target), inverseOperation),
  });
