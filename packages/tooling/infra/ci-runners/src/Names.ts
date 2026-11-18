/**
 * Physical names of the `CiRunners` stack, derived from the stage, and the
 * fence that keeps them clear of the live Pulumi fleet's objects.
 *
 * @packageDocumentation
 * @category constants
 * @since 0.0.0
 */

import { $InfraCiRunnersId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual, flow } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PoolName } from "./Config.ts";

const $I = $InfraCiRunnersId.create("Names");

/**
 * Every name the stack pins, for one stage.
 *
 * **Details**
 *
 * `fleet` is the `RunnerFleet` name: each pool's `ghr:environment` is
 * `<fleet>-<pool>` and the termination watcher acts on instances whose
 * environment starts with `<fleet>`. The composite derives the KMS alias
 * (`alias/<fleet>-github-app`) and the SSM paths under `ssmRoot` from these;
 * in `prod` the composite pins every other name it chooses under `<fleet>-`
 * (`RunnerFleetProps.namePrefix`), and personal stages take Alchemy-generated
 * names (`CiRunners-<logical id>-<stage>-<suffix>`). Lambda execution roles
 * are generated in every stage; the stack-name prefix keeps them clear of
 * live names.
 *
 * **Example** (Production names)
 *
 * ```ts
 * import { physicalNames } from "@beep/infra-ci-runners/Names"
 *
 * console.log(physicalNames("prod").fleet) // "beep-fleet-prod"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhysicalNames extends S.Opaque<PhysicalNames, { readonly brand: unique symbol }>()(
  S.Struct({
    fleet: S.String,
    slug: S.String,
    ssmRoot: S.String,
    vpc: S.String,
    internetGateway: S.String,
    routeTable: S.String,
    subnetPrefix: S.String,
    runnerSecurityGroup: S.String,
    defaultSecurityGroup: S.String,
    flowLogGroup: S.String,
    flowLog: S.String,
    flowLogRole: S.String,
    reaperFunction: S.String,
    reaperSchedule: S.String,
    imdsDisablePolicy: S.String,
    iamPath: S.String,
    kmsAlias: S.String,
  }).pipe($I.annoteSchema("PhysicalNames", { description: "Every physical name the stack pins for one stage." }))
) {}

/**
 * The stage as it appears in names: lower case, `_` replaced by `-`.
 *
 * **Example** (Slug a personal stage)
 *
 * ```ts
 * import { stageSlug } from "@beep/infra-ci-runners/Names"
 *
 * console.log(stageSlug("dev_Alice")) // "dev-alice"
 * ```
 *
 * @param stage - The Alchemy stage.
 * @returns Its name-safe slug.
 * @category constants
 * @since 0.0.0
 */
export const stageSlug: (stage: string) => string = flow(
  Str.toLowerCase,
  Str.replace(/[^a-z0-9-]/gu, "-"),
  Str.replace(/^-+|-+$/gu, "")
);

/**
 * The pinned names of a stage. `prod` is `beep-fleet-prod`; a personal stage
 * `dev-alice` is `beep-fleet-dev-alice`. The stage is always part of the
 * name, so no stage's fleet name is a prefix of another stage's environment
 * except where one personal slug prefixes another.
 *
 * **Example** (Name a personal stage)
 *
 * ```ts
 * import { physicalNames } from "@beep/infra-ci-runners/Names"
 *
 * console.log(physicalNames("dev-alice").ssmRoot) // "/beep-fleet/dev-alice"
 * ```
 *
 * @param stage - The Alchemy stage.
 * @returns The stage's physical names.
 * @category constants
 * @since 0.0.0
 */
export const physicalNames = (stage: string): PhysicalNames => {
  const slug = stageSlug(stage);
  const fleet = `beep-fleet-${slug}`;
  return PhysicalNames.make({
    fleet,
    slug,
    ssmRoot: `/beep-fleet/${slug}`,
    vpc: `${fleet}-vpc`,
    internetGateway: `${fleet}-igw`,
    routeTable: `${fleet}-public`,
    subnetPrefix: `${fleet}-public`,
    runnerSecurityGroup: `${fleet}-runner`,
    defaultSecurityGroup: `${fleet}-default-DO-NOT-USE`,
    flowLogGroup: `/beep-fleet/${slug}/vpc-flow-logs`,
    flowLog: `${fleet}-flow-log`,
    flowLogRole: `${fleet}-flow-logs`,
    reaperFunction: `${fleet}-reaper`,
    reaperSchedule: `${fleet}-reaper`,
    imdsDisablePolicy: `${fleet}-runner-imds-disable`,
    iamPath: `/beep-fleet/${slug}/`,
    kmsAlias: `alias/${fleet}-github-app`,
  });
};

/**
 * The `ghr:environment` of a pool in a stage.
 *
 * **Example** (Production heavy environment)
 *
 * ```ts
 * import { poolEnvironment } from "@beep/infra-ci-runners/Names"
 *
 * console.log(poolEnvironment("prod", "heavy")) // "beep-fleet-prod-heavy"
 * ```
 *
 * @param stage - The Alchemy stage that owns the fleet.
 * @param pool - `heavy` or `overflow`.
 * @returns The pool's runner environment tag value.
 * @category constants
 * @since 0.0.0
 */
export const poolEnvironment: {
  (pool: PoolName): (stage: string) => string;
  (stage: string, pool: PoolName): string;
} = dual(2, (stage: string, pool: PoolName): string => `${physicalNames(stage).fleet}-${pool}`);

/**
 * Name prefixes of the live Pulumi fleet (`beep-ci-runners/production`):
 * its terraform-module prefixes `beep-ci` and `beep-ovf` (also its
 * `ghr:environment` values, SSM roots, KMS alias, IAM paths and Lambda
 * names), the module's `/github-action-runners` SSM root, and the
 * groundwork stack's `beep-ci-runners` names.
 *
 * **Example** (List the live prefixes)
 *
 * ```ts
 * import { liveFleetPrefixes } from "@beep/infra-ci-runners/Names"
 *
 * console.log(liveFleetPrefixes.length) // 6
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const liveFleetPrefixes: ReadonlyArray<string> = [
  "beep-ci",
  "beep-ovf",
  "/beep-ci",
  "/beep-ovf",
  "/github-action-runners",
  "alias/beep-ci",
];

/**
 * Whether a name could address a live fleet object: it starts with a live
 * prefix, or a live prefix starts with it (a filter on it would match live
 * objects).
 *
 * **Example** (Check a name)
 *
 * ```ts
 * import { touchesLiveFleet } from "@beep/infra-ci-runners/Names"
 *
 * console.log(touchesLiveFleet("beep-ci-heavy")) // true
 * console.log(touchesLiveFleet("beep-fleet-prod")) // false
 * ```
 *
 * @param name - A physical name or name prefix.
 * @returns `true` when it overlaps a live fleet name.
 * @category constants
 * @since 0.0.0
 */
export const touchesLiveFleet = (name: string): boolean =>
  A.some(liveFleetPrefixes, (prefix) => Str.startsWith(prefix)(name) || Str.startsWith(name)(prefix));

/**
 * The names of a stage that overlap a live fleet name; empty when the stage
 * is fenced.
 *
 * **Example** (Production is fenced)
 *
 * ```ts
 * import { liveFleetOverlaps, physicalNames } from "@beep/infra-ci-runners/Names"
 *
 * console.log(liveFleetOverlaps(physicalNames("prod"))) // []
 * ```
 *
 * @param names - The stage's physical names.
 * @returns Each overlapping name.
 * @category constants
 * @since 0.0.0
 */
export const liveFleetOverlaps = (names: PhysicalNames): ReadonlyArray<string> =>
  A.filter(
    [
      names.fleet,
      names.ssmRoot,
      names.vpc,
      names.internetGateway,
      names.routeTable,
      names.subnetPrefix,
      names.runnerSecurityGroup,
      names.defaultSecurityGroup,
      names.flowLogGroup,
      names.flowLog,
      names.flowLogRole,
      names.reaperFunction,
      names.reaperSchedule,
      names.imdsDisablePolicy,
      names.iamPath,
      names.kmsAlias,
    ],
    touchesLiveFleet
  );
