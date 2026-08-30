/**
 * Cache recovery and evidence schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.schemas");

/**
 * Cache posture inferred for one Turbo run.
 *
 * **Example** (Recognize a remote-eligible run)
 *
 * ```ts
 * import { CacheRunMode } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheRunMode.is["remote-eligible"]("remote-eligible")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheRunMode = LiteralKit(["remote-eligible", "local-only", "forced", "disabled"]).pipe(
  $I.annoteSchema("CacheRunMode", { description: "Cache posture inferred for one Turbo summary run." })
);

/**
 * Cache posture inferred for one Turbo run.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheRunMode = typeof CacheRunMode.Type;

/**
 * Wall-clock distribution for one cache posture.
 *
 * **Example** (Validate a wall-time row)
 *
 * ```ts
 * import { CacheWallTime } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CacheWallTime)({ mode: "local-only", runs: 2, p50Ms: 100, p95Ms: 150 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheWallTime extends S.Class<CacheWallTime>($I`CacheWallTime`)(
  {
    mode: CacheRunMode,
    runs: NonNegativeInt,
    p50Ms: NonNegativeInt,
    p95Ms: NonNegativeInt,
  },
  $I.annote("CacheWallTime", { description: "Turbo run wall-clock percentiles grouped by cache posture." })
) {}

/**
 * Lambda cache access counters imported from sanitized log rows.
 *
 * **Example** (Validate aggregate access counters)
 *
 * ```ts
 * import { CacheLambdaSummary } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CacheLambdaSummary)({ rows: 3, reads: 2, hits: 1, puts: 1 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheLambdaSummary extends S.Class<CacheLambdaSummary>($I`CacheLambdaSummary`)(
  {
    rows: NonNegativeInt,
    reads: NonNegativeInt,
    hits: NonNegativeInt,
    puts: NonNegativeInt,
  },
  $I.annote("CacheLambdaSummary", { description: "Aggregate remote-cache access counts without secret data." })
) {}

/**
 * Versioned remote-cache dashboard report.
 *
 * **Example** (Inspect the dashboard schema)
 *
 * ```ts
 * import { CacheDashboardReport } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheDashboardReport.ast._tag) // "Transformation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDashboardReport extends S.Class<CacheDashboardReport>($I`CacheDashboardReport`)(
  {
    schema: S.tag("cache-dashboard/v1"),
    generatedAt: S.String,
    runFiles: NonNegativeInt,
    eligibleFirstTouches: NonNegativeInt,
    remoteHits: NonNegativeInt,
    eligibleRemoteHitRate: S.Finite,
    excludedForcedOrDisabled: NonNegativeInt,
    correctnessViolations: S.Array(S.String),
    wallTimes: S.Array(CacheWallTime),
    lambda: CacheLambdaSummary,
  },
  $I.annote("CacheDashboardReport", {
    description: "First-touch remote-cache rate, timing distributions, and correctness tripwires.",
  })
) {}

/**
 * One lane executed by cache warming.
 *
 * **Example** (Validate a warm-lane receipt)
 *
 * ```ts
 * import { CacheWarmLane } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CacheWarmLane)({ command: ["bun", "x", "turbo"], durationMs: 42, exitCode: 0 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheWarmLane extends S.Class<CacheWarmLane>($I`CacheWarmLane`)(
  {
    command: S.Array(S.String),
    durationMs: NonNegativeInt,
    exitCode: S.Int,
  },
  $I.annote("CacheWarmLane", { description: "One cache-warm subprocess receipt." })
) {}

/**
 * Versioned receipt for an operator cache-warm run.
 *
 * **Example** (Inspect the warm-receipt schema)
 *
 * ```ts
 * import { CacheWarmReceipt } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheWarmReceipt.ast._tag) // "Transformation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheWarmReceipt extends S.Class<CacheWarmReceipt>($I`CacheWarmReceipt`)(
  {
    schema: S.tag("cache-warm/v1"),
    generatedAt: S.String,
    revision: S.String,
    bunVersion: S.String,
    lanes: S.Array(CacheWarmLane),
  },
  $I.annote("CacheWarmReceipt", {
    description: "Exact-main, pinned-toolchain cache recovery receipt.",
  })
) {}

/**
 * Cache command failure safe to render at the CLI boundary.
 *
 * **Example** (Create a typed command failure)
 *
 * ```ts
 * import { CacheCommandError } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheCommandError.make({ message: "cache probe failed" })._tag) // "CacheCommandError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CacheCommandError extends S.TaggedError<CacheCommandError>($I`CacheCommandError`)(
  "CacheCommandError",
  { message: S.String, cause: S.optionalKey(S.Defect()) },
  $I.annoteError<CacheCommandError>("CacheCommandError", {
    description: "A cache command precondition or subprocess failure.",
  })
) {
  /**
   * Map an unknown failure into a cache command error.
   *
   * @param message - Human-readable failure context.
   * @param cause - Optional underlying failure.
   * @returns A typed cache command error.
   */
  static readonly new = (message: string, cause?: unknown): CacheCommandError =>
    cause === undefined ? CacheCommandError.make({ message }) : CacheCommandError.make({ message, cause });

  /**
   * Map an Effect error into a cache command error with context.
   *
   * @param message - Human-readable failure context.
   * @returns A transform mapping an Effect error into a cache command error.
   */
  static readonly mapError =
    (message: string) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(Effect.mapError((cause) => CacheCommandError.new(message, cause)));
}

/**
 * JSON codec for dashboard reports.
 *
 * **Example** (Inspect the dashboard codec)
 *
 * ```ts
 * import { CacheDashboardReportJson } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(CacheDashboardReportJson.decode("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CacheDashboardReportJson = JsonStringCodec(CacheDashboardReport);

/**
 * JSON codec for warm receipts.
 *
 * **Example** (Inspect the warm-receipt codec)
 *
 * ```ts
 * import { CacheWarmReceiptJson } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(CacheWarmReceiptJson.decode("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CacheWarmReceiptJson = JsonStringCodec(CacheWarmReceipt);
