import { GlobString } from "@beep/glob/GlobString";
import { PosixPath } from "@beep/schema/PosixPath";
import { A, Str } from "@beep/utils";
import * as O from "effect/Option";
import { isLabsWorkspacePath, LAB_MANIFEST_FILENAME } from "../../../../internal/cli/Labs/index.ts";
import {
  AuthoredReferenceSurface,
  DataResourceSurface,
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
import type {
  DeletionNotePolicy,
  RegistrationOperationKind,
  RegistrationTarget,
} from "./RegistrationGeometry.schemas.ts";

const slugOf = (packageName: string): string => Str.replace("@beep/", Str.empty)(packageName);

/**
 * Instantiate the closed P1 registration surface set for one package target.
 *
 * **Details**
 *
 * The result is pure and deterministic. Lab targets with decoded lab facts also
 * receive a data-resource surface for their Postgres schema.
 *
 * **Example** (List surface ids for a package)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { RegistrationTarget, surfacesForTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 *
 * console.log(A.map(surfacesForTarget(target), (surface) => surface.id))
 * ```
 *
 * @param target - Package whose registration surfaces are declared.
 * @returns Every surface the package occupies, in a stable declaration order.
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
          (artifact) => GlobString.make(`${target.packagePath}/${artifact}/**`)
        ),
        isLab ? [GlobString.make(`${target.packagePath}/${LAB_MANIFEST_FILENAME}`)] : A.empty<GlobString>()
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
      outputs: [PosixPath.make(`standards/schema-catalog/${target.packageName}.generated.jsonc`)],
      membershipKey: target.packagePath,
    }),
    GeneratedInventorySurface.make({
      id: "instrumentation-catalog",
      writer: "instrumentation-catalog",
      outputs: [PosixPath.make(`standards/instrumentation-catalog/${target.packageName}.generated.jsonc`)],
      membershipKey: target.packageName,
    }),
    GeneratedInventorySurface.make({
      id: "test-typecheck-baseline",
      writer: "test-typecheck-baseline",
      outputs: [PosixPath.make("standards/test-typecheck.blindspot-baseline.jsonc")],
      membershipKey: target.packageName,
    }),
    AuthoredReferenceSurface.make({
      id: "authored-references",
      files: A.map(
        [
          "package.json",
          "turbo.json",
          "lefthook.yml",
          "biome.jsonc",
          ".github/**/*.yml",
          "apps/storybook/**/*",
          "infra/**/*",
          "goals/**/ops/manifest.json",
          "standards/**/*.jsonc",
        ],
        (value) => GlobString.make(value)
      ),
      needles: packageNeedles,
    }),
    PendingChangesetSurface.make({
      id: "pending-changesets",
      changesetGlob: GlobString.make(".changeset/*.md"),
      retiredRegistry: PosixPath.make("standards/changesets.retired-packages.json"),
      packageName: target.packageName,
      deletionNotePolicy: isLab ? "labs-exempt" : target.private ? "private-exempt" : "emit-empty-note",
    }),
    RuntimeArtifactSurface.make({
      id: "runtime-artifacts",
      globs: A.map([`${target.packagePath}/**`, `.beep/ci/**/*${slug}*`, `.beep/ci/**`], (value) =>
        GlobString.make(value)
      ),
    }),
    HistoricalRecordSurface.make({
      id: "historical-records",
      files: A.map(["research/**", "goals/**/research/**", "goals/**/history/**", ".changeset/**/*.md"], (value) =>
        GlobString.make(value)
      ),
      needles: packageNeedles,
    }),
    ...dataResourceSurfaces,
  ];
};

type PendingChangesetDetails = { readonly [Policy in DeletionNotePolicy]: (packageName: string) => string };

const pendingChangesetWriteDetails: PendingChangesetDetails = {
  "emit-empty-note": (packageName) => `preserve pending policy for ${packageName}`,
  "private-exempt": (packageName) =>
    `preserve pending policy for ${packageName}; private packages are changeset-exempt`,
  "labs-exempt": (packageName) => `preserve pending policy for ${packageName}; labs are changeset-exempt`,
};

const pendingChangesetRemoveDetails: PendingChangesetDetails = {
  "emit-empty-note": (packageName) =>
    `delete dedicated pending files, strip multi-package key ${packageName}, and emit an empty deletion changeset`,
  "private-exempt": (packageName) =>
    `delete dedicated pending files and strip multi-package key ${packageName}; private deletion emits no changeset`,
  "labs-exempt": (packageName) =>
    `delete dedicated pending files and strip multi-package key ${packageName}; labs deletion emits no changeset (ceremony-exempt)`,
};

// The forward and inverse plans word the pending-changeset step per deletion
// note policy; only the operation kind and the wording differ between them.
const pendingChangesetOperation =
  (operation: RegistrationOperationKind, details: PendingChangesetDetails) =>
  (surface: PendingChangesetSurface): RegistrationOperation =>
    RegistrationOperation.make({
      surfaceId: surface.id,
      operation,
      detail: details[surface.deletionNotePolicy](surface.packageName),
    });

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
  "pending-changeset": pendingChangesetOperation("write", pendingChangesetWriteDetails),
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
  "pending-changeset": pendingChangesetOperation("remove", pendingChangesetRemoveDetails),
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

/**
 * Builds the create-direction plan for a target: one operation per surface
 * that registers the package where its geometry says it belongs.
 *
 * **Example** (Plan package registration)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { planForwardForTarget, RegistrationTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const plan = planForwardForTarget(target)
 *
 * console.log(A.map(plan.operations, (step) => step.operation))
 * ```
 *
 * @param target - Package whose surfaces are instantiated.
 * @returns A plan with one forward operation per declared surface, in surface order.
 * @category constructors
 * @since 0.0.0
 */
export const planForwardForTarget = (target: RegistrationTarget): RegistrationPlan =>
  RegistrationPlan.make({
    version: "registration-plan/v1",
    target,
    operations: A.map(surfacesForTarget(target), forwardOperation),
  });

/**
 * Builds the delete-direction plan for a target: removals, rebuilds,
 * preservation steps, and consent gates derived from the same surfaces.
 *
 * **Example** (Plan package deletion)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { planInverseForTarget, RegistrationTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const plan = planInverseForTarget(target)
 *
 * console.log(A.map(plan.operations, (step) => step.detail))
 * ```
 *
 * @param target - Package whose surfaces are instantiated.
 * @returns A plan with one inverse operation per declared surface, in surface order.
 * @category constructors
 * @since 0.0.0
 */
export const planInverseForTarget = (target: RegistrationTarget): RegistrationPlan =>
  RegistrationPlan.make({
    version: "registration-plan/v1",
    target,
    operations: A.map(surfacesForTarget(target), inverseOperation),
  });
