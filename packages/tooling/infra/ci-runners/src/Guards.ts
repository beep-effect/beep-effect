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
 * Effect.runSync(requireCiForProduction("dev-alice"))
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
 * const guard = Effect.flatMap(resolveStageConfig("dev-alice"), requireConfiguredTarget)
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
 * The longest stage slug a personal stage may use, so every name Alchemy
 * generates for it keeps the whole slug.
 *
 * **Details**
 *
 * A personal stage's unpinned names are `CiRunners-<logical id>-<slug>-<suffix>`
 * with a 16-character suffix, and Alchemy truncates a name past its service's limit,
 * cutting the slug that the stage's permissions boundary matches
 * (`CiRunners-*-<slug>-*`). The longest boundary-scoped logical id is the
 * `RunnerBinariesSyncer` function (20 characters), whose function and
 * execution-role names allow 64 characters: 9 + 1 + 20 + 1 + slug + 1 + 16 is
 * at most 64, so the slug is at most 16. The binaries bucket (`RunnerBinaries`, 63) allows 21 and the
 * queues (80) more.
 *
 * **Example** (Read the limit)
 *
 * ```ts
 * import { maxStageSlugLength } from "@beep/infra-ci-runners/Guards"
 *
 * console.log(maxStageSlugLength) // 16
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const maxStageSlugLength = 16;

// Each rule: when it refuses a stage, and the reason it gives. `stage` is the stage name, `slug` its name slug.
const stageRules: ReadonlyArray<{
  readonly refuses: (stage: string, slug: string) => boolean;
  readonly reason: (slug: string) => string;
}> = [
  { refuses: (_stage, slug) => Str.isEmpty(slug), reason: () => "its name slug is empty" },
  {
    refuses: (_stage, slug) => slug.length > maxStageSlugLength,
    reason: () => `its name slug is longer than ${maxStageSlugLength} characters`,
  },
  {
    refuses: (stage, slug) => stage !== slug,
    reason: (slug) => `it is not canonical: use "${slug}", lower case letters, digits and "-" only`,
  },
  // The termination watcher matches `ghr:environment` exactly; this keeps the fleet names apart by prefix, so no
  // `beep-fleet-<slug>-*` name pattern of one stage (grants, the boundary, the live-fleet fence) reaches the other.
  {
    refuses: (_stage, slug) => Str.startsWith(productionStage)(slug) || Str.startsWith(slug)(productionStage),
    reason: (slug) => `its fleet name beep-fleet-${slug} and the ${productionStage} fleet name prefix one another`,
  },
  // The prod boundary matches Alchemy's generated names by `CiRunners-*-prod-*`, which a personal slug with a `prod`
  // segment (`alice-prod`) would also produce.
  {
    refuses: (_stage, slug) => /(?:^|-)prod(?:-|$)/u.test(slug),
    reason: () => "stage slug contains a 'prod' segment, reserved for production",
  },
];

const stageRefusal = (stage: string, slug: string): ReadonlyArray<string> =>
  stage === productionStage
    ? []
    : A.map(
        A.filter(stageRules, (rule) => rule.refuses(stage, slug)),
        (rule) => rule.reason(slug)
      );

/**
 * Fail a stage other than `prod` that is not canonical, whose fleet name
 * and the `prod` fleet name prefix one another, whose slug has a `prod`
 * segment, or whose slug is empty or too long.
 *
 * **Details**
 *
 * `physicalNames` lowercases the stage and maps every other character to
 * `-`. A stage must equal its slug (`[a-z0-9-]`, no leading or trailing
 * `-`), so two distinct stages never derive the same AWS names
 * (`dev_alice` and `dev-alice` would; only `dev-alice` is accepted). The
 * termination watcher matches `ghr:environment` exactly; the prefix check
 * runs both ways against `prod` so no name pattern of one fleet reaches the
 * other: `prodfoo` (whose fleet name starts with `beep-fleet-prod`) and
 * `pro` (whose fleet name prefixes it) are refused. A slug longer than
 * {@link maxStageSlugLength} is refused because Alchemy would truncate it out
 * of the generated names the boundary matches.
 * A slug with `prod` as a `-`-delimited segment (`alice-prod`, `dev-prod-x`)
 * is refused too: the prod boundary's `CiRunners-*-prod-*` patterns would
 * match the names Alchemy generates for it.
 *
 * **Example** (A personal stage passes)
 *
 * ```ts
 * import { requireDistinctStage } from "@beep/infra-ci-runners/Guards"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runSync(requireDistinctStage("dev-alice"))
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
