/**
 * Durable PR closeout schemas for Yeet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { QualityIssue } from "../../Yeet.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/closeout/Closeout.schemas");

/**
 * Runtime closeout gates accepted by Yeet.
 *
 * @category models
 * @since 0.0.0
 */
export class PrCloseoutOptions extends S.Class<PrCloseoutOptions>($I`PrCloseoutOptions`)(
  {
    bots: S.String,
    requireGreptileIssues: S.Finite,
    requireGreptileScore: S.String,
    requireReviewComments: S.Finite,
    retriggerGreptile: S.Boolean,
    replyBody: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
    replyThread: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
    resolveThreads: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
  },
  $I.annote("PrCloseoutOptions", {
    description: "Runtime closeout gates accepted by Yeet.",
  })
) {}

/**
 * Summary of Greptile signal extracted from PR comments.
 *
 * @category models
 * @since 0.0.0
 */
export class GreptileSummary extends S.Class<GreptileSummary>($I`GreptileSummary`)(
  {
    issueCount: S.optionalKey(S.Finite),
    score: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
  },
  $I.annote("GreptileSummary", {
    description: "Greptile score and issue count parsed from PR comments.",
  })
) {}

const PrCloseoutGateName = LiteralKit(["hosted-checks", "review-threads", "greptile", "coderabbit", "chatgpt"]).pipe(
  $I.annoteSchema("PrCloseoutGateName", {
    description: "Named PR closeout gate represented in durable Yeet state.",
  })
);

const PrCloseoutGateStatus = LiteralKit(["passed", "blocked", "unknown", "written"]).pipe(
  $I.annoteSchema("PrCloseoutGateStatus", {
    description: "Durable status for one PR closeout gate.",
  })
);

/**
 * Durable PR closeout gate state.
 *
 * **Example** (Create passed gate state)
 *
 * ```ts
 * import { PrCloseoutGateState } from "@beep/repo-cli/commands/Yeet"
 *
 * const state = PrCloseoutGateState.make({
 *   name: "greptile",
 *   status: "passed",
 *   detail: "Greptile score=5/5 issues=0.",
 *   count: 0
 * })
 * console.log(state.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrCloseoutGateState extends S.Class<PrCloseoutGateState>($I`PrCloseoutGateState`)(
  {
    name: PrCloseoutGateName,
    status: PrCloseoutGateStatus,
    detail: S.String,
    count: S.optional(S.Finite),
    url: S.optional(S.String),
  },
  $I.annote("PrCloseoutGateState", {
    description: "Durable state for one PR closeout gate.",
  })
) {}

/**
 * Yeet PR closeout report.
 *
 * @category models
 * @since 0.0.0
 */
/**
 * One review-thread write action performed during closeout.
 *
 * **Example** (Create reply write action)
 *
 * ```ts
 * import { PrCloseoutWriteAction } from "@beep/repo-cli/test/Yeet"
 *
 * const action = PrCloseoutWriteAction.make({
 *   detail: "replied",
 *   kind: "reply",
 *   ok: true,
 *   threadId: "PRRT_example",
 * })
 * console.log(action.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrCloseoutWriteAction extends S.Class<PrCloseoutWriteAction>($I`PrCloseoutWriteAction`)(
  {
    detail: S.String,
    kind: LiteralKit(["reply", "resolve"]),
    ok: S.Boolean,
    threadId: S.String,
    url: S.optionalKey(S.String),
  },
  $I.annote("PrCloseoutWriteAction", {
    description: "One explicit review-thread write action performed during Yeet closeout.",
  })
) {}

/**
 * Structured PR closeout result emitted by Yeet.
 *
 * **Details**
 *
 * `reviewedHeadSha` binds the inspection to the pull request head that was
 * reviewed. It is optional only so legacy reports still decode; an absent head
 * is stale and cannot satisfy merge readiness.
 *
 * @category models
 * @since 0.0.0
 */
export class PrCloseoutReport extends S.Class<PrCloseoutReport>($I`PrCloseoutReport`)(
  {
    actionableReviewThreadCount: S.Finite,
    botCommentCount: S.Finite,
    greptile: GreptileSummary,
    issueCount: S.Finite,
    issues: S.Array(QualityIssue),
    prNumber: S.Finite,
    prUrl: S.String,
    reviewedHeadSha: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    retriggeredGreptile: S.Boolean,
    schemaVersion: S.Literal("yeet-pr-closeout/v1"),
    states: S.Array(PrCloseoutGateState).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<PrCloseoutGateState>())),
      S.withDecodingDefault(Effect.succeed(A.empty<PrCloseoutGateState>()))
    ),
    writeActions: S.Array(PrCloseoutWriteAction).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<PrCloseoutWriteAction>())),
      S.withDecodingDefault(Effect.succeed(A.empty<PrCloseoutWriteAction>()))
    ),
  },
  $I.annote("PrCloseoutReport", {
    description: "Structured PR closeout result bound to the reviewed pull request head.",
  })
) {}
