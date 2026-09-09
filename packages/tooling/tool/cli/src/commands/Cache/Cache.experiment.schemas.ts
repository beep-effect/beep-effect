/**
 * Bounded local fixture evidence. These receipts confer no remote-cache authority.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientChannel, CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CacheExecutablePin } from "./Cache.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.experiment.schemas");

/**
 * Native Bun binary and its independently observed version/content pin.
 *
 * **Example** (Inspect the runtime identity)
 *
 * ```ts
 * import { CacheFixtureRuntime } from "@beep/repo-cli/commands/Cache"
 * console.assert("pin" in CacheFixtureRuntime.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheFixtureRuntime extends S.Class<CacheFixtureRuntime>($I`CacheFixtureRuntime`)(
  { executable: S.NonEmptyString, pin: CacheExecutablePin },
  $I.annote("CacheFixtureRuntime", { description: "Explicit native runtime used by a disposable fixture." })
) {}

/**
 * Exact native client selected for a disposable local experiment.
 *
 * **Example** (Inspect the request fields)
 *
 * ```ts
 * import { CacheSyntheticRequest } from "@beep/repo-cli/commands/Cache"
 * console.assert("client" in CacheSyntheticRequest.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheSyntheticRequest extends S.Class<CacheSyntheticRequest>($I`CacheSyntheticRequest`)(
  {
    channel: CacheClientChannel,
    client: CacheClientPin,
    executable: S.NonEmptyString,
    bun: CacheFixtureRuntime,
    alternateBun: CacheFixtureRuntime,
  },
  $I.annote("CacheSyntheticRequest", {
    description: "Pinned native Turbo client for a network-isolated local fixture.",
  })
) {}

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
export class CacheSyntheticRun extends S.Class<CacheSyntheticRun>($I`CacheSyntheticRun`)(
  {
    id: S.NonEmptyString,
    root: S.NonEmptyString,
    bunSha256: Sha256Hex,
    taskHash: S.String.check(S.isPattern(/^[a-f0-9]{16}$/)),
    origin: CacheLocalOrigin,
    exitCode: S.Int,
    outputSha256: Sha256Hex,
    logSha256: Sha256Hex,
    logBytes: NonNegativeInt,
    violations: S.Array(CacheCaptureViolation),
  },
  $I.annote("CacheSyntheticRun", {
    description: "Observed execution, output and bounded log facts for one local fixture run.",
  })
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
export class CacheSyntheticCheck extends S.Class<CacheSyntheticCheck>($I`CacheSyntheticCheck`)(
  { name: S.NonEmptyString, passed: S.Boolean },
  $I.annote("CacheSyntheticCheck", { description: "A local fixture assertion derived by the experiment runner." })
) {}

/**
 * Bounded observations for a configured node whose script is absent.
 *
 * **Details**
 * Summary nodes and execution metadata are counted separately. This record
 * cannot enter the successful-run comparison population.
 *
 * **Example** (Inspect non-execution evidence)
 *
 * ```ts
 * import { CacheSyntheticNonExecution } from "@beep/repo-cli/commands/Cache"
 * console.assert("executionRecordCount" in CacheSyntheticNonExecution.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheSyntheticNonExecution extends S.Class<CacheSyntheticNonExecution>($I`CacheSyntheticNonExecution`)(
  {
    id: S.NonEmptyString,
    processExitCode: S.Int,
    summaryTaskCount: NonNegativeInt,
    selectedTaskCount: NonNegativeInt,
    executionRecordCount: NonNegativeInt,
    commands: S.Array(S.String),
    outputPresent: S.Boolean,
    replayLogPresent: S.Boolean,
    summarySha256: Sha256Hex,
    processCaptureSha256: Sha256Hex,
    violations: S.Array(CacheCaptureViolation),
  },
  $I.annote("CacheSyntheticNonExecution", {
    description: "Observed graph, process and absent-output facts that confer no execution credit.",
  })
) {}

/**
 * Sanitized local experiment receipt; a local hit is never signed-remote proof.
 *
 * **Example** (Inspect the local receipt discriminator)
 *
 * ```ts
 * import { CacheSyntheticReceipt } from "@beep/repo-cli/commands/Cache"
 * console.assert("schema" in CacheSyntheticReceipt.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheSyntheticReceipt extends S.Class<CacheSyntheticReceipt>($I`CacheSyntheticReceipt`)(
  {
    schema: S.tag("cache-synthetic-local/v3"),
    channel: CacheClientChannel,
    client: CacheClientPin,
    bun: CacheExecutablePin,
    alternateBun: CacheExecutablePin,
    fixtureSha256: Sha256Hex,
    runs: S.NonEmptyArray(CacheSyntheticRun),
    nonExecutions: S.Array(CacheSyntheticNonExecution),
    checks: S.NonEmptyArray(CacheSyntheticCheck),
  },
  $I.annote("CacheSyntheticReceipt", {
    description: "Versioned, bounded local fixture evidence without promotion authority.",
  })
) {}
