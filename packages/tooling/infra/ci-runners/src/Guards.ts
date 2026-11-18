/**
 * Guards the `CiRunners` stack runs before it declares any resource.
 *
 * @packageDocumentation
 * @category guards
 * @since 0.0.0
 */

import { DeployTarget, requireDeployTarget } from "@beep/alchemy-aws-extras/DeployTarget";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { productionStage } from "./Config.ts";
import { liveFleetOverlaps, stageSlug } from "./Names.ts";
import type { CiRunnersConfig } from "./Config.ts";
import type { PhysicalNames } from "./Names.ts";

/**
 * Fail a `prod` plan or deploy that does not run in CI (`CI=true`).
 *
 * **Details**
 *
 * `prod` deploys only from the `ci-runners-prod` GitHub environment under
 * its concurrency group; the S3 state lease is the second guard. Every other
 * stage passes.
 *
 * **Example** (A personal stage passes)
 *
 * ```ts
 * import { requireCiForProduction } from "@beep/infra-ci-runners/Guards"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runSync(requireCiForProduction("dev_alice"))
 * ```
 *
 * @param stage - The Alchemy stage being planned or deployed.
 * @returns An effect that fails with a `ConfigError` when `prod` runs outside CI.
 * @category guards
 * @since 0.0.0
 */
export const requireCiForProduction = Effect.fn("CiRunners.requireCiForProduction")(function* (stage: string) {
  if (stage === productionStage) {
    yield* Config.Literal("true", "CI");
  }
});

/**
 * Fail unless the deploying identity is in the configured account and
 * region (the shared `requireDeployTarget` of `@beep/alchemy-aws-extras`).
 *
 * **Example** (Guard a stage)
 *
 * ```ts
 * import { resolveStageConfig } from "@beep/infra-ci-runners/Config"
 * import { requireConfiguredTarget } from "@beep/infra-ci-runners/Guards"
 * import * as Effect from "effect/Effect"
 *
 * const guard = Effect.flatMap(resolveStageConfig("dev_alice"), requireConfiguredTarget)
 * console.log(typeof guard) // "object"
 * ```
 *
 * @param config - The stage configuration naming the account and region.
 * @returns The verified account id, or a `ConfigError`.
 * @category guards
 * @since 0.0.0
 */
export const requireConfiguredTarget = (config: CiRunnersConfig) =>
  requireDeployTarget(
    DeployTarget.make({ stack: "CiRunners", accountId: config.expectedAccountId, region: config.region })
  );

/**
 * Fail when any pinned name of the stage overlaps a live Pulumi fleet name,
 * so no stage can address, filter on or adopt a live object.
 *
 * **Example** (Production is fenced)
 *
 * ```ts
 * import { requireFencedNames } from "@beep/infra-ci-runners/Guards"
 * import { physicalNames } from "@beep/infra-ci-runners/Names"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runSync(requireFencedNames(physicalNames("prod")))
 * ```
 *
 * @param names - The stage's physical names.
 * @returns An effect that fails with a `ConfigError` naming the overlaps.
 * @category guards
 * @since 0.0.0
 */
export const requireFencedNames = Effect.fn("CiRunners.requireFencedNames")(function* (names: PhysicalNames) {
  const overlaps = liveFleetOverlaps(names);
  if (A.isReadonlyArrayNonEmpty(overlaps)) {
    return yield* Effect.fail(
      new Config.ConfigError(
        new ConfigProvider.SourceError({ message: `Names overlap the live fleet: ${A.join(overlaps, ", ")}` })
      )
    );
  }
});

/**
 * The longest stage slug a personal stage may use, so every
 * `beep-fleet-<slug>-…` name stays inside its AWS limit.
 *
 * **Example** (Read the limit)
 *
 * ```ts
 * import { maxStageSlugLength } from "@beep/infra-ci-runners/Guards"
 *
 * console.log(maxStageSlugLength) // 40
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const maxStageSlugLength = 40;

const stageRefusal = (stage: string, slug: string): ReadonlyArray<string> =>
  stage === productionStage
    ? []
    : [
        ...(Str.isEmpty(slug) ? ["its name slug is empty"] : []),
        ...(slug.length > maxStageSlugLength ? [`its name slug is longer than ${maxStageSlugLength} characters`] : []),
        ...(slug === productionStage || Str.startsWith(`${productionStage}-`)(slug)
          ? [`its name slug "${slug}" claims the ${productionStage} names`]
          : []),
      ];

/**
 * Fail a stage other than `prod` whose name slug would take, or nest under,
 * the `prod` stage's names, is empty, or is too long.
 *
 * **Details**
 *
 * `physicalNames` lowercases the stage and maps every other character to
 * `-`, so `Prod`, `prod_` and `PROD-x` would otherwise share or prefix the
 * production names, and the termination watcher matches `ghr:environment`
 * by prefix. Two personal stages can still share a slug (`dev_alice` and
 * `dev-alice`); the state store keys them apart, and personal stages launch
 * nothing without a rehearsal repository.
 *
 * **Example** (A personal stage passes)
 *
 * ```ts
 * import { requireDistinctStage } from "@beep/infra-ci-runners/Guards"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runSync(requireDistinctStage("dev_alice"))
 * ```
 *
 * @param stage - The Alchemy stage being planned or deployed.
 * @returns An effect that fails with a `ConfigError` naming each reason.
 * @category guards
 * @since 0.0.0
 */
export const requireDistinctStage = Effect.fn("CiRunners.requireDistinctStage")(function* (stage: string) {
  const reasons = stageRefusal(stage, stageSlug(stage));
  if (A.isReadonlyArrayNonEmpty(reasons)) {
    return yield* Effect.fail(
      new Config.ConfigError(
        new ConfigProvider.SourceError({ message: `Stage "${stage}" is refused: ${A.join(reasons, "; ")}` })
      )
    );
  }
});
