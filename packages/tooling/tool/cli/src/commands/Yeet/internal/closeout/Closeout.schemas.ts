/**
 * Durable PR closeout schemas for Yeet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { QualityIssue } from "../../Yeet.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/closeout/Closeout.schemas");

/**
 * Runtime closeout gates accepted by Yeet.
 *
 * @category models
 * @since 0.0.0
 */
export class PrCloseoutOptions extends S.Opaque<PrCloseoutOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    bots: S.String,
    requireGreptileIssues: S.Finite,
    requireGreptileScore: S.String,
    requireReviewComments: S.Finite,
    retriggerGreptile: S.Boolean,
    replyBody: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    replyThread: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    resolveThreads: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
  }).pipe(
    $I.annoteSchema("PrCloseoutOptions", {
      description: "Runtime closeout gates accepted by Yeet.",
    })
  )
) {}

/**
 * Summary of Greptile signal extracted from PR comments.
 *
 * @category models
 * @since 0.0.0
 */
export class GreptileSummary extends S.Opaque<GreptileSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    issueCount: S.optionalKey(S.Finite),
    score: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("GreptileSummary", {
      description: "Greptile score and issue count parsed from PR comments.",
    })
  )
) {}

const PrCloseoutGateName = LiteralKit([
  "hosted-checks",
  "review-threads",
  "review-follow-ups",
  "review-advisories",
  "greptile",
  "coderabbit",
  "chatgpt",
]).pipe(
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
export class PrCloseoutGateState extends S.Opaque<PrCloseoutGateState, { readonly brand: unique symbol }>()(
  S.Struct({
    name: PrCloseoutGateName,
    status: PrCloseoutGateStatus,
    detail: S.String,
    count: S.optionalKey(S.Finite),
    url: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("PrCloseoutGateState", {
      description: "Durable state for one PR closeout gate.",
    })
  )
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
export class PrCloseoutWriteAction extends S.Opaque<PrCloseoutWriteAction, { readonly brand: unique symbol }>()(
  S.Struct({
    detail: S.String,
    kind: LiteralKit(["reply", "resolve"]),
    ok: S.Boolean,
    threadId: S.String,
    url: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("PrCloseoutWriteAction", {
      description: "One explicit review-thread write action performed during Yeet closeout.",
    })
  )
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
 * `followUpThreadCount`, `acknowledgedThreadCount` and `advisoryCount` default
 * to zero on both construction and decoding rather than bumping the schema
 * version: a report written before thread states were classified simply
 * reports none of them, which is what it knew.
 *
 * @category models
 * @since 0.0.0
 */
export class PrCloseoutReport extends S.Opaque<PrCloseoutReport, { readonly brand: unique symbol }>()(
  S.Struct({
    acknowledgedThreadCount: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    actionableReviewThreadCount: S.Finite,
    advisoryCount: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    botCommentCount: S.Finite,
    followUpThreadCount: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    greptile: GreptileSummary,
    issueCount: S.Finite,
    issues: S.Array(QualityIssue),
    prNumber: S.Finite,
    prUrl: S.String,
    reviewedHeadSha: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    retriggeredGreptile: S.Boolean,
    schemaVersion: S.tag("yeet-pr-closeout/v1"),
    states: ArrayKeyDefaultEmpty(PrCloseoutGateState),
    writeActions: ArrayKeyDefaultEmpty(PrCloseoutWriteAction),
  }).pipe(
    $I.annoteSchema("PrCloseoutReport", {
      description: "Structured PR closeout result bound to the reviewed pull request head.",
    })
  )
) {}

/**
 * JSON-string codec for the durable `pr-closeout.json` artifact.
 *
 * **Details**
 *
 * The artifact writer and the `yeet status` reader must share one schema
 * boundary: encoding through anything schema-blind leaks `Option` fields such
 * as `reviewedHeadSha` as raw `{ _id: "Option" }` objects, which the reader
 * then rejects as undecodable and merge readiness treats as a stale closeout.
 *
 * **Example** (Round-trip a closeout report)
 *
 * ```ts
 * import { PrCloseoutReportJson } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof PrCloseoutReportJson.encode)
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const PrCloseoutReportJson = JsonStringCodec(PrCloseoutReport);
