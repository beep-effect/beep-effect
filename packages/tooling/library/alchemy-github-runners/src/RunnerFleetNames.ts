/**
 * Pinned physical names of a `RunnerFleet`, derived from one name prefix.
 *
 * **Details**
 *
 * Without a prefix the composite's resources take Alchemy's generated names,
 * which derive from the stack state's instance ids: a lost or moved state
 * would mint a second fleet beside the first. A prefix pins every name the
 * composite chooses. Lambda execution roles stay generated because
 * `Lambda.Function` takes no role name; their functions are pinned, so a
 * recreated function collides with the existing one instead of duplicating it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $AlchemyGithubRunnersId.create("RunnerFleetNames");

// S3 refuses bucket names that start with these.
const reservedBucketPrefixes = ["xn--", "sthree-", "amzn-s3-demo-"];

/**
 * A fleet name prefix: lower case (S3 bucket names allow nothing else), not
 * one of the S3 reserved bucket prefixes (`xn--`, `sthree-`,
 * `amzn-s3-demo-`), at most 28 characters so the longest pinned name fits each AWS limit (Lambda
 * function and EventBridge rule 64, IAM role 64, SQS queue 80, S3 bucket 63)
 * with a 24-character pool name.
 *
 * **Example** (A production prefix)
 *
 * ```ts
 * import { FleetNamePrefix } from "@beep/alchemy-github-runners/RunnerFleetNames"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FleetNamePrefix)("beep-fleet-prod")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetNamePrefix = S.String.check(
  S.isPattern(/^[a-z][a-z0-9-]{0,27}$/u),
  S.makeFilter((prefix: string) => !A.some(reservedBucketPrefixes, (reserved) => Str.startsWith(reserved)(prefix)), {
    message: "A fleet name prefix may not start with an S3 reserved bucket prefix",
  })
).pipe(
  $I.annoteSchema("FleetNamePrefix", {
    description: "Lower-case prefix of every pinned fleet name, at most 28 characters.",
  })
);

/**
 * Pinned names of one pool's resources.
 *
 * **Example** (The heavy pool of beep-fleet-prod)
 *
 * ```ts
 * import { poolResourceNames } from "@beep/alchemy-github-runners/RunnerFleetNames"
 *
 * console.log(poolResourceNames("beep-fleet-prod", "heavy").scaleUp) // "beep-fleet-prod-heavy-scale-up"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PoolResourceNames extends S.Opaque<PoolResourceNames, { readonly brand: unique symbol }>()(
  S.Struct({
    scaleUp: S.String,
    jobRetry: S.String,
    scaleDown: S.String,
    scaleDownRule: S.String,
    buildQueue: S.String,
    buildDlq: S.String,
    jobRetryQueue: S.String,
    jobRetryDlq: S.String,
    runnerRole: S.String,
    instanceProfile: S.String,
    launchTemplate: S.String,
  }).pipe($I.annoteSchema("PoolResourceNames", { description: "Pinned physical names of one pool." }))
) {}

/**
 * Pinned names of the fleet-wide resources.
 *
 * **Example** (The webhook of beep-fleet-prod)
 *
 * ```ts
 * import { fleetResourceNames } from "@beep/alchemy-github-runners/RunnerFleetNames"
 *
 * console.log(fleetResourceNames("beep-fleet-prod").webhook) // "beep-fleet-prod-webhook"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetResourceNames extends S.Opaque<FleetResourceNames, { readonly brand: unique symbol }>()(
  S.Struct({
    webhook: S.String,
    housekeeper: S.String,
    housekeeperRule: S.String,
    syncer: S.String,
    syncerRule: S.String,
    terminationWatcher: S.String,
    spotInterruptionRule: S.String,
    instanceStateChangeRule: S.String,
    deregisterQueue: S.String,
    deregisterDlq: S.String,
    binariesBucketPrefix: S.String,
  }).pipe($I.annoteSchema("FleetResourceNames", { description: "Pinned physical names of the fleet-wide resources." }))
) {}

/**
 * The pinned names of one pool under a prefix.
 *
 * **Example** (The overflow launch template)
 *
 * ```ts
 * import { poolResourceNames } from "@beep/alchemy-github-runners/RunnerFleetNames"
 *
 * console.log(poolResourceNames("beep-fleet-prod", "overflow").launchTemplate) // "beep-fleet-prod-overflow"
 * ```
 *
 * @param prefix - The fleet's name prefix.
 * @param pool - The pool's name (`RunnerPool.name`).
 * @returns Every pinned name of that pool.
 * @category constructors
 * @since 0.0.0
 */
export const poolResourceNames: {
  (pool: string): (prefix: string) => PoolResourceNames;
  (prefix: string, pool: string): PoolResourceNames;
} = dual(2, (prefix: string, pool: string): PoolResourceNames => {
  const base = `${prefix}-${pool}`;
  return PoolResourceNames.make({
    scaleUp: `${base}-scale-up`,
    jobRetry: `${base}-job-retry`,
    scaleDown: `${base}-scale-down`,
    scaleDownRule: `${base}-scale-down`,
    buildQueue: `${base}-build`,
    buildDlq: `${base}-build-dlq`,
    jobRetryQueue: `${base}-job-retry`,
    jobRetryDlq: `${base}-job-retry-dlq`,
    runnerRole: `${base}-runner`,
    instanceProfile: `${base}-runner`,
    launchTemplate: base,
  });
});

/**
 * The pinned names of the fleet-wide resources under a prefix. The binaries
 * bucket name is `<binariesBucketPrefix>-<account id>`, since S3 names are
 * global.
 *
 * **Example** (The termination watcher)
 *
 * ```ts
 * import { fleetResourceNames } from "@beep/alchemy-github-runners/RunnerFleetNames"
 *
 * console.log(fleetResourceNames("beep-fleet-prod").terminationWatcher) // "beep-fleet-prod-termination-watcher"
 * ```
 *
 * @param prefix - The fleet's name prefix.
 * @returns Every pinned fleet-wide name.
 * @category constructors
 * @since 0.0.0
 */
export const fleetResourceNames = (prefix: string): FleetResourceNames =>
  FleetResourceNames.make({
    webhook: `${prefix}-webhook`,
    housekeeper: `${prefix}-ssm-housekeeper`,
    housekeeperRule: `${prefix}-ssm-housekeeper`,
    syncer: `${prefix}-binaries-syncer`,
    syncerRule: `${prefix}-binaries-syncer`,
    terminationWatcher: `${prefix}-termination-watcher`,
    spotInterruptionRule: `${prefix}-spot-interruption`,
    instanceStateChangeRule: `${prefix}-instance-state-change`,
    deregisterQueue: `${prefix}-deregister-retry`,
    deregisterDlq: `${prefix}-deregister-retry-dlq`,
    binariesBucketPrefix: `${prefix}-binaries`,
  });
