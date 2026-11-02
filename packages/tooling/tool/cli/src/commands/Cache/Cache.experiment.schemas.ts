/**
 * Bounded local fixture evidence. These receipts confer no remote-cache authority.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.experiment.schemas");

/**
 * Local execution or artifact-replay origin observed in a Turbo summary.
 *
 * **Example** (Recognize a local hit)
 *
 * ```ts
 * import { CacheLocalOrigin } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheLocalOrigin.is["local-hit"]("local-hit"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheLocalOrigin = LiteralKit(["fresh", "local-hit"]).pipe(
  $I.annoteSchema("CacheLocalOrigin", { description: "Fresh execution or an observed local artifact replay." })
);
/**
 * Observed local execution or artifact-replay origin.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheLocalOrigin = typeof CacheLocalOrigin.Type;

/**
 * Capture failures that exclude a run from comparison evidence.
 *
 * **Example** (Recognize bounded-capture rejection)
 *
 * ```ts
 * import { CacheCaptureViolation } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheCaptureViolation.is.overflow("overflow"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheCaptureViolation = LiteralKit(["overflow", "synthetic-secret", "absolute-path"]).pipe(
  $I.annoteSchema("CacheCaptureViolation", { description: "Observed unsafe or incomplete local log capture." })
);
/**
 * Reason a captured local run cannot pass comparison.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheCaptureViolation = typeof CacheCaptureViolation.Type;

/**
 * One bounded run, retaining digests instead of raw diagnostic text.
 *
 * **Example** (Inspect the evidence boundary)
 *
 * ```ts
 * import { CacheSyntheticRun } from "@beep/repo-cli/commands/Cache"
 * console.assert("violations" in CacheSyntheticRun.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheSyntheticRun extends S.Opaque<CacheSyntheticRun, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    root: S.NonEmptyString,
    bunSha256: Sha256Hex,
    taskHash: S.String.check(S.isPattern(/^[a-f0-9]{16}$/)),
    origin: CacheLocalOrigin,
    exitCode: S.Int,
    outputSha256: Sha256Hex,
    logSha256: Sha256Hex,
    logBytes: S.Natural,
    violations: S.Array(CacheCaptureViolation),
  }).pipe(
    $I.annoteSchema("CacheSyntheticRun", {
      description: "Observed execution, output and bounded log facts for one local fixture run.",
    })
  )
) {}

/**
 * A named assertion derived from runtime facts, never supplied by the caller.
 *
 * **Example** (Build a failed comparison)
 *
 * ```ts
 * import { CacheSyntheticCheck } from "@beep/repo-cli/commands/Cache"
 * console.assert(!CacheSyntheticCheck.make({ name: "fresh-fresh", passed: false }).passed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheSyntheticCheck extends S.Opaque<CacheSyntheticCheck, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.NonEmptyString, passed: S.Boolean }).pipe(
    $I.annoteSchema("CacheSyntheticCheck", {
      description: "A local fixture assertion derived by the experiment runner.",
    })
  )
) {}
