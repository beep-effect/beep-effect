import { $RepoCliId } from "@beep/identity/packages";
import { FsUtils } from "@beep/repo-utils";
import { Context, Effect, FileSystem, Path } from "effect";
import { RegistrationGeometryError } from "./RegistrationGeometry.errors.ts";
import { planForwardForTarget, planInverseForTarget, surfacesForTarget } from "./RegistrationGeometry.plan.ts";
import { dependentsOfAtRoot, inspectTargetAtRoot } from "./RegistrationGeometry.probes.ts";
import type {
  DependentsReport,
  RegistrationObservation,
  RegistrationPlan,
  RegistrationSurface,
  RegistrationTarget,
} from "./RegistrationGeometry.schemas.ts";

const $I = $RepoCliId.create("internal/cli/RegistrationGeometry/service");

export type RegistrationGeometryServiceShape = {
  readonly surfacesFor: (
    target: RegistrationTarget
  ) => Effect.Effect<ReadonlyArray<RegistrationSurface>, RegistrationGeometryError>;
  readonly planForward: (target: RegistrationTarget) => Effect.Effect<RegistrationPlan, RegistrationGeometryError>;
  readonly planInverse: (target: RegistrationTarget) => Effect.Effect<RegistrationPlan, RegistrationGeometryError>;
  readonly inspect: (
    target: RegistrationTarget
  ) => Effect.Effect<ReadonlyArray<RegistrationObservation>, RegistrationGeometryError>;
  readonly apply: (
    plan: RegistrationPlan
  ) => Effect.Effect<ReadonlyArray<RegistrationObservation>, RegistrationGeometryError>;
  readonly dependentsOf: (target: RegistrationTarget) => Effect.Effect<DependentsReport, RegistrationGeometryError>;
};

/**
 * Private package-lifecycle service interpreting the shared registration declarations.
 *
 * @category services
 * @since 0.0.0
 */
export class RegistrationGeometryService extends Context.Service<
  RegistrationGeometryService,
  RegistrationGeometryServiceShape
>()($I`RegistrationGeometryService`) {}

/**
 * Build the registration-geometry service for a resolved repository root.
 *
 * **Details**
 *
 * The caller supplies the flag-aware plan executor. The service captures its
 * requirements, maps failures into the geometry error channel, and performs the
 * post-apply doctor from the same declarations.
 *
 * @category factories
 * @since 0.0.0
 */
export const makeRegistrationGeometryService = Effect.fn("RegistrationGeometry.makeService")(function* <E, R>(
  repoRoot: string,
  executePlan: (plan: RegistrationPlan) => Effect.Effect<void, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fsUtils = yield* FsUtils;
  const executorContext = yield* Effect.context<R>();
  const inspect = (target: RegistrationTarget) =>
    inspectTargetAtRoot(repoRoot, target).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError(
        RegistrationGeometryError.newCause(`Failed to inspect registration geometry for ${target.packageName}.`)
      )
    );
  return RegistrationGeometryService.of({
    surfacesFor: Effect.fn("RegistrationGeometryService.surfacesFor")((target) =>
      Effect.succeed(surfacesForTarget(target))
    ),
    planForward: Effect.fn("RegistrationGeometryService.planForward")((target) =>
      Effect.succeed(planForwardForTarget(target))
    ),
    planInverse: Effect.fn("RegistrationGeometryService.planInverse")((target) =>
      Effect.succeed(planInverseForTarget(target))
    ),
    inspect: Effect.fn("RegistrationGeometryService.inspect")(inspect),
    apply: Effect.fn("RegistrationGeometryService.apply")((plan) =>
      executePlan(plan).pipe(
        Effect.provide(executorContext),
        Effect.mapError(
          RegistrationGeometryError.newCause(`Failed to apply registration geometry for ${plan.target.packageName}.`)
        ),
        Effect.flatMap(() => inspect(plan.target))
      )
    ),
    dependentsOf: Effect.fn("RegistrationGeometryService.dependentsOf")((target) =>
      dependentsOfAtRoot(repoRoot, target).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.provideService(FsUtils, fsUtils),
        Effect.mapError(RegistrationGeometryError.newCause(`Failed to inspect dependents for ${target.packageName}.`))
      )
    ),
  });
});
