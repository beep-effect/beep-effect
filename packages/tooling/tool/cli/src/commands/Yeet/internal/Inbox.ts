/**
 * The checkout inbox: typed failure rows for the backpressure engine.
 *
 * **Details**
 *
 * This module is the durable contract between the writers that observe
 * failures (the `yeet monitor --watch` stream today; local lane runners and
 * collision detectors later) and the harness adapters that consume them
 * (ship-velocity A2: Claude hook deny/inject, Codex tool-boundary splice, Grok
 * tail). Writers append one self-describing NDJSON row per failure to
 * `<checkout>/.beep/inbox/failures.ndjson`; consumers acknowledge a row by
 * writing a receipt file at `<checkout>/.beep/inbox/acks/<id>`. The hot path on
 * the consumer side is stat+read of these git-ignored local files only —
 * GitHub never enters a hook.
 *
 * A failure capsule is derived from the failing check's *own* record — its
 * name, its job link, its workflow, its raw bucket/state strings — never from a
 * classifier pass over composite output. Misattributed repair hints from
 * composite-log scraping are a repeat-offender failure class in this repo's
 * ledger; the capsule shape makes the attribution structural.
 *
 * **Gotchas**
 *
 * Row ids are deterministic over (prNumber, headSha, lane), which is what
 * makes dedup and the ack protocol work across watch restarts: re-observing
 * the same red re-derives the same id, so an existing receipt keeps covering
 * it and a dispatcher can drop it as already queued. Do not add
 * observation-time entropy to the id.
 *
 * Rows are immutable first-observation evidence and the file is append-only,
 * so it accumulates rows from superseded waves and dead PRs. Liveness is not
 * a row property: a consumer decides it by joining the row's
 * `capsule.headSha`/`capsule.prNumber` against the wave record the dispatcher
 * maintains at `.beep/inbox/dispatch.json` — rows whose identity does not
 * match the current wave belong to a superseded push and must not gate
 * anything.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect, FileSystem, Match, Order, Path } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { appendContainedFileString, readContainedFileStringNoFollow } from "../../../internal/cli/FsGuards.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { safeArtifactName } from "./ArtifactPaths.ts";
import { ProofJobRowSeverity, YeetProofJobCapsule } from "./ProofJob.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Inbox");

/**
 * Schema version stamped on every inbox row.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { YEET_INBOX_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_INBOX_SCHEMA_VERSION) // "yeet-inbox/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_INBOX_SCHEMA_VERSION = "yeet-inbox/v1";

/**
 * Severity tiers the harness adapters gate their enforcement on.
 *
 * **Details**
 *
 * The A2 enforcement ladder: `P0` (required check red, sibling collision)
 * denies the next tool; `P1` (review thread) injects context only; `P2` (base
 * drift) surfaces at session start. The watch writer stamps every hosted check
 * red `P0` today — the required-versus-optional split that would demote an
 * optional lane's red is A6's deliverable, and until it lands a red is treated
 * as merge-blocking.
 *
 * **Example** (Check a severity)
 *
 * ```ts
 * import { YeetInboxSeverity } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetInboxSeverity.is.P0("P0")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxSeverity = LiteralKit(["P0", "P1", "P2"]).pipe(
  $I.annoteSchema("YeetInboxSeverity", {
    title: "Yeet Inbox Severity",
    description: "Enforcement tier of one inbox row: P0 denies, P1 injects, P2 surfaces at session start.",
  })
);

/**
 * Severity tiers the harness adapters gate their enforcement on.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetInboxSeverity = typeof YeetInboxSeverity.Type;

/**
 * One hosted check failure, described by the failing check's own record.
 *
 * **Details**
 *
 * Everything here comes from the failing check's `gh pr checks` row and the
 * watched PR's identity — nothing is inferred from logs. `lane` is the check's
 * display name (the dedup key half alongside `headSha`), `link` points at the
 * failing job run itself, and the raw `bucket`/`state` strings are preserved
 * because they distinguish a content failure from an infrastructure one: a
 * `CANCELLED` state on this repo's burst workers usually means a TTL reap, and
 * a repair session that knows that starts with a rerun instead of a bisect.
 *
 * **Example** (Build a capsule)
 *
 * ```ts
 * import { YeetFailureCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail",
 *   headSha: "abc123",
 *   lane: "Check / Coverage",
 *   link: "https://github.com/o/r/actions/runs/1/job/2",
 *   observedAt: "2026-08-17T00:00:00Z",
 *   prNumber: 751,
 *   state: "FAILURE",
 *   workflow: "Check"
 * })
 *
 * console.log(capsule.lane) // "Check / Coverage"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetFailureCapsule extends S.Class<YeetFailureCapsule>($I`YeetFailureCapsule`)(
  {
    bucket: S.String,
    headSha: S.NonEmptyString,
    lane: S.NonEmptyString,
    link: S.NullOr(S.String),
    observedAt: S.String,
    prNumber: S.Finite,
    state: S.String,
    workflow: S.NullOr(S.String),
  },
  $I.annote("YeetFailureCapsule", {
    description: "One hosted check failure, derived from the failing check's own gh record.",
  })
) {}

/**
 * One `check-failed` inbox row: a failure capsule plus routing metadata.
 *
 * **Details**
 *
 * `id` is deterministic over the capsule's (prNumber, headSha, lane) via
 * {@link yeetInboxRowId}; `checkout` names the repository root the failure
 * belongs to, so a machine-wide consumer can route rows written into a shared
 * location; `ts` is when the row was appended, while `capsule.observedAt` is
 * when the transition was observed — the watch stamps both from the same poll
 * tick.
 *
 * **Example** (Build a row)
 *
 * ```ts
 * import { YeetCheckFailedRow, YeetFailureCapsule, yeetInboxRowId } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail",
 *   headSha: "abc123",
 *   lane: "Check / Coverage",
 *   link: null,
 *   observedAt: "2026-08-17T00:00:00Z",
 *   prNumber: 754,
 *   state: "FAILURE",
 *   workflow: null
 * })
 * const program = yeetInboxRowId(capsule).pipe(
 *   Effect.map((id) =>
 *     YeetCheckFailedRow.make({
 *       capsule,
 *       checkout: "/repo",
 *       id,
 *       severity: "P0",
 *       ts: "2026-08-17T00:00:00Z"
 *     })
 *   )
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetCheckFailedRow extends S.Class<YeetCheckFailedRow>($I`YeetCheckFailedRow`)(
  {
    kind: S.tag("check-failed"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: YeetInboxSeverity,
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetFailureCapsule,
  },
  $I.annote("YeetCheckFailedRow", {
    description: "One check-failed inbox row: the failure capsule plus id, severity, checkout, and timestamp.",
  })
) {}

/**
 * Paths simultaneously claimed by this checkout and a sibling checkout.
 *
 * **Example** (Describe a collision)
 *
 * ```ts
 * import { YeetSiblingCollisionCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetSiblingCollisionCapsule.make({
 *   contendedPaths: ["goals/INDEX.md"],
 *   ownerCheckout: "/fleet/a",
 *   siblingCheckout: "/fleet/b"
 * })
 * console.log(capsule.contendedPaths.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetSiblingCollisionCapsule extends S.Class<YeetSiblingCollisionCapsule>($I`YeetSiblingCollisionCapsule`)(
  {
    contendedPaths: S.Array(S.NonEmptyString),
    ownerCheckout: S.NonEmptyString,
    siblingCheckout: S.NonEmptyString,
  },
  $I.annote("YeetSiblingCollisionCapsule", {
    description: "Paths simultaneously claimed by an owning checkout and one sibling checkout.",
  })
) {}

/**
 * One P0 sibling-checkout collision delivered to the owning checkout.
 *
 * **Example** (Build a collision row)
 *
 * ```ts
 * import { YeetSiblingCollisionCapsule, YeetSiblingCollisionRow } from "@beep/repo-cli/test/Yeet"
 *
 * const row = YeetSiblingCollisionRow.make({
 *   capsule: YeetSiblingCollisionCapsule.make({
 *     contendedPaths: ["goals/INDEX.md"], ownerCheckout: "/fleet/a", siblingCheckout: "/fleet/b"
 *   }),
 *   checkout: "/fleet/a",
 *   id: "sibling-collision-abc",
 *   severity: "P0",
 *   ts: "2026-08-27T00:00:00Z"
 * })
 * console.log(row.severity) // "P0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetSiblingCollisionRow extends S.Class<YeetSiblingCollisionRow>($I`YeetSiblingCollisionRow`)(
  {
    kind: S.tag("sibling-collision"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: S.Literal("P0"),
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetSiblingCollisionCapsule,
  },
  $I.annote("YeetSiblingCollisionRow", {
    description: "One P0 sibling-checkout collision delivered to the owning checkout.",
  })
) {}

/**
 * One unresolved review thread observed on the current pull request head.
 *
 * **Example** (Describe a review thread)
 *
 * ```ts
 * import { YeetReviewThreadCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetReviewThreadCapsule.make({
 *   headSha: "abc123", link: null, prNumber: 900, threadId: "PRRT_abc"
 * })
 * console.log(capsule.threadId) // "PRRT_abc"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewThreadCapsule extends S.Class<YeetReviewThreadCapsule>($I`YeetReviewThreadCapsule`)(
  {
    headSha: S.NonEmptyString,
    link: S.NullOr(S.String),
    prNumber: S.Finite,
    threadId: S.NonEmptyString,
  },
  $I.annote("YeetReviewThreadCapsule", {
    description: "One unresolved review thread observed on the current pull request head.",
  })
) {}

/**
 * One P1 review-thread row injected as repair context without denying tools.
 *
 * **Example** (Build a review-thread row)
 *
 * ```ts
 * import { YeetReviewThreadCapsule, YeetReviewThreadRow } from "@beep/repo-cli/test/Yeet"
 *
 * const row = YeetReviewThreadRow.make({
 *   capsule: YeetReviewThreadCapsule.make({ headSha: "abc123", link: null, prNumber: 900, threadId: "PRRT_abc" }),
 *   checkout: "/repo", id: "review-thread-abc", severity: "P1", ts: "2026-08-27T00:00:00Z"
 * })
 * console.log(row.kind) // "review-thread"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewThreadRow extends S.Class<YeetReviewThreadRow>($I`YeetReviewThreadRow`)(
  {
    kind: S.tag("review-thread"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: S.Literal("P1"),
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetReviewThreadCapsule,
  },
  $I.annote("YeetReviewThreadRow", {
    description: "One P1 review-thread row injected as repair context without denying tools.",
  })
) {}

/**
 * Base drift observed for the current pull request head.
 *
 * **Example** (Describe base drift)
 *
 * ```ts
 * import { YeetBaseDriftCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetBaseDriftCapsule.make({ base: "origin/main", headSha: "abc123", prNumber: 900 })
 * console.log(capsule.base) // "origin/main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetBaseDriftCapsule extends S.Class<YeetBaseDriftCapsule>($I`YeetBaseDriftCapsule`)(
  {
    base: S.NonEmptyString,
    headSha: S.NonEmptyString,
    prNumber: S.Finite,
  },
  $I.annote("YeetBaseDriftCapsule", {
    description: "Base drift observed for the current pull request head.",
  })
) {}

/**
 * One P2 base-drift row surfaced only at session start.
 *
 * **Example** (Build a base-drift row)
 *
 * ```ts
 * import { YeetBaseDriftCapsule, YeetBaseDriftRow } from "@beep/repo-cli/test/Yeet"
 *
 * const row = YeetBaseDriftRow.make({
 *   capsule: YeetBaseDriftCapsule.make({ base: "origin/main", headSha: "abc123", prNumber: 900 }),
 *   checkout: "/repo", id: "base-drift-abc", severity: "P2", ts: "2026-08-27T00:00:00Z"
 * })
 * console.log(row.severity) // "P2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetBaseDriftRow extends S.Class<YeetBaseDriftRow>($I`YeetBaseDriftRow`)(
  {
    kind: S.tag("base-drift"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: S.Literal("P2"),
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetBaseDriftCapsule,
  },
  $I.annote("YeetBaseDriftRow", {
    description: "One P2 base-drift row surfaced only at session start.",
  })
) {}

/**
 * A pull request head that no longer merges into its base.
 *
 * **Details**
 *
 * The merge loop reads the conflict with `yeetBaseConflictFor` from the pull
 * request view: `mergeable: CONFLICTING` or `mergeStateStatus: DIRTY`. The raw
 * `mergeable` and `mergeStateStatus` strings are kept as evidence, the same
 * way a failure capsule keeps its check's raw bucket and state. `base` names
 * the ref to merge, and `link` is the pull request URL, which the inbox hook
 * renders beside the row.
 *
 * `generation` counts the conflicts on this head that the merge loop already
 * acked `cleared`: 0 for the first conflict on (prNumber, headSha), 1 for a
 * conflict that came back on the same head after that clear, and so on. It is
 * part of the row id, so each returning conflict is a new row. A row written
 * before the field existed decodes as generation 0.
 *
 * **Example** (Describe a base conflict)
 *
 * ```ts
 * import { YeetBaseConflictCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetBaseConflictCapsule.make({
 *   base: "origin/main",
 *   headSha: "abc123",
 *   link: "https://github.com/o/r/pull/900",
 *   mergeable: "CONFLICTING",
 *   mergeStateStatus: "DIRTY",
 *   prNumber: 900
 * })
 * console.log(capsule.mergeStateStatus) // "DIRTY"
 * console.log(capsule.generation) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetBaseConflictCapsule extends S.Class<YeetBaseConflictCapsule>($I`YeetBaseConflictCapsule`)(
  {
    base: S.NonEmptyString,
    headSha: S.NonEmptyString,
    link: S.NullOr(S.String),
    mergeable: S.NullOr(S.String),
    mergeStateStatus: S.NullOr(S.String),
    prNumber: S.Finite,
    generation: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(SchemaUtils.withKeyDefaults(0)),
  },
  $I.annote("YeetBaseConflictCapsule", {
    description: "One pull request head that no longer merges into its base, with the raw merge fields observed.",
  })
) {}

/**
 * One P0 base-conflict row: the head needs the base merged in and a push.
 *
 * **Details**
 *
 * The `--until-ready` merge loop appends it once per conflict on a head, the
 * first poll that reads the conflict. The kind reuses the `base-conflict`
 * settle reason: the settle wait clears by re-reading the pull request, and
 * the row clears in one of two ways. A push supersedes it, because the loop
 * pins the wave record to the new head. If the same head reads mergeable
 * again (the other change was reverted), the loop writes a `cleared` ack
 * receipt for the row.
 *
 * **Gotchas**
 *
 * The id is keyed on (prNumber, headSha, generation). A conflict that comes
 * back on the same head after a `cleared` receipt is the next generation, so
 * it gets a fresh id, a new row, and a new wave; it never reuses the
 * acknowledged id. The next push starts again at generation 0.
 *
 * **Example** (Build a base-conflict row)
 *
 * ```ts
 * import { YeetBaseConflictCapsule, YeetBaseConflictRow } from "@beep/repo-cli/test/Yeet"
 *
 * const row = YeetBaseConflictRow.make({
 *   capsule: YeetBaseConflictCapsule.make({
 *     base: "origin/main", headSha: "abc123", link: null,
 *     mergeable: "CONFLICTING", mergeStateStatus: "DIRTY", prNumber: 900
 *   }),
 *   checkout: "/repo", id: "base-conflict-abc", severity: "P0", ts: "2026-09-25T00:00:00Z"
 * })
 * console.log(row.kind) // "base-conflict"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetBaseConflictRow extends S.Class<YeetBaseConflictRow>($I`YeetBaseConflictRow`)(
  {
    kind: S.tag("base-conflict"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: S.Literal("P0"),
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetBaseConflictCapsule,
  },
  $I.annote("YeetBaseConflictRow", {
    description: "One P0 base-conflict row: the pull request head no longer merges into its base.",
  })
) {}

/**
 * Which GitHub collection a pull request comment row came from.
 *
 * **Details**
 *
 * `issue` is a conversation comment and `review-body` is the prose a reviewer
 * submits with a review; both are top-level. Inline review comments are not a
 * source: they belong to review threads, which have their own row. The two
 * collections number their ids independently, so the source is part of the
 * row id.
 *
 * **Example** (Check a source)
 *
 * ```ts
 * import { YeetPrCommentSource } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPrCommentSource.is.issue("issue")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetPrCommentSource = LiteralKit(["issue", "review-body"]).pipe(
  $I.annoteSchema("YeetPrCommentSource", {
    title: "Yeet PR Comment Source",
    description: "The GitHub collection a top-level pull request comment row came from.",
  })
);

/**
 * Which GitHub collection a pull request comment row came from.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetPrCommentSource = typeof YeetPrCommentSource.Type;

/**
 * One top-level pull request comment from a person other than the acting login.
 *
 * **Details**
 *
 * `excerpt` is a bounded, whitespace-collapsed copy of the body (about 200
 * characters); the full comment is one read of `link` away. `headSha` is the
 * head the comment was observed on, kept as evidence; a push does not resolve
 * a comment, so the row is wave-exempt and its liveness never reads it.
 * `link` is the comment URL, under the field name the inbox hook renders.
 *
 * **Example** (Describe a comment)
 *
 * ```ts
 * import { YeetPrCommentCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetPrCommentCapsule.make({
 *   author: "reviewer",
 *   commentId: 44,
 *   createdAt: "2026-09-25T00:00:00Z",
 *   excerpt: "Please rebase onto main before the next push.",
 *   headSha: "abc123",
 *   link: "https://github.com/o/r/pull/900#issuecomment-44",
 *   prNumber: 900,
 *   source: "issue"
 * })
 * console.log(capsule.author) // "reviewer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrCommentCapsule extends S.Class<YeetPrCommentCapsule>($I`YeetPrCommentCapsule`)(
  {
    author: S.NonEmptyString,
    commentId: S.Finite,
    createdAt: S.String,
    excerpt: S.String,
    headSha: S.NonEmptyString,
    link: S.String,
    prNumber: S.Finite,
    source: YeetPrCommentSource,
  },
  $I.annote("YeetPrCommentCapsule", {
    description:
      "One top-level pull request comment from a person other than the acting login: URL, author and a bounded excerpt.",
  })
) {}

/**
 * One P1 pull request comment row, injected as context without denying tools.
 *
 * **Details**
 *
 * The `--until-ready` merge loop appends one per qualifying comment: a
 * conversation comment or review body, written by a person (not a bot) other
 * than the acting login, and created after the monitor job was submitted. A
 * comment is answered, not outdated, so the row is wave-exempt: it stays live
 * across a push and never joins the per-head wave record. It joins the
 * `yeet job wait` wave through its capsule's PR number, so a new comment wakes
 * a waiting orchestrator like a new red does. It closes with an attributed
 * ack, typically `--thread-url` with the reply.
 *
 * **Example** (Build a comment row)
 *
 * ```ts
 * import { YeetPrCommentCapsule, YeetPrCommentRow } from "@beep/repo-cli/test/Yeet"
 *
 * const row = YeetPrCommentRow.make({
 *   capsule: YeetPrCommentCapsule.make({
 *     author: "reviewer", commentId: 44, createdAt: "2026-09-25T00:00:00Z", excerpt: "Please rebase.",
 *     headSha: "abc123", link: "https://github.com/o/r/pull/900#issuecomment-44", prNumber: 900, source: "issue"
 *   }),
 *   checkout: "/repo", id: "pr-comment-abc", severity: "P1", ts: "2026-09-25T00:00:00Z"
 * })
 * console.log(row.kind) // "pr-comment"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrCommentRow extends S.Class<YeetPrCommentRow>($I`YeetPrCommentRow`)(
  {
    kind: S.tag("pr-comment"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: S.Literal("P1"),
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetPrCommentCapsule,
  },
  $I.annote("YeetPrCommentRow", {
    description: "One P1 top-level pull request comment row injected as context without denying tools.",
  })
) {}

/**
 * One named local proof shard that exited unsuccessfully.
 *
 * **Example** (Describe a local shard failure)
 *
 * ```ts
 * import { YeetLocalShardFailureCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetLocalShardFailureCapsule.make({
 *   command: "bun run beep ci lane check", exitCode: 1, headSha: "abc123", shard: "Check"
 * })
 * console.log(capsule.exitCode) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetLocalShardFailureCapsule extends S.Class<YeetLocalShardFailureCapsule>(
  $I`YeetLocalShardFailureCapsule`
)(
  {
    command: S.NonEmptyString,
    exitCode: S.Finite,
    headSha: S.NonEmptyString,
    shard: S.NonEmptyString,
  },
  $I.annote("YeetLocalShardFailureCapsule", {
    description: "One named local proof shard that exited unsuccessfully on a repository head.",
  })
) {}

/**
 * One P0 local-shard poison pill inherited by every session in the checkout.
 *
 * **Example** (Build a local poison row)
 *
 * ```ts
 * import { YeetLocalShardFailedRow, YeetLocalShardFailureCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const row = YeetLocalShardFailedRow.make({
 *   capsule: YeetLocalShardFailureCapsule.make({
 *     command: "bun run beep ci lane check", exitCode: 1, headSha: "abc123", shard: "Check"
 *   }),
 *   checkout: "/repo", id: "local-shard-abc", severity: "P0", ts: "2026-08-27T00:00:00Z"
 * })
 * console.log(row.kind) // "local-shard-failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetLocalShardFailedRow extends S.Class<YeetLocalShardFailedRow>($I`YeetLocalShardFailedRow`)(
  {
    kind: S.tag("local-shard-failed"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: S.Literal("P0"),
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetLocalShardFailureCapsule,
  },
  $I.annote("YeetLocalShardFailedRow", {
    description: "One P0 local-shard poison pill inherited by every session in the checkout.",
  })
) {}

/**
 * One merge-ready observation of a pull request head, as the merge loop
 * recorded it.
 *
 * **Details**
 *
 * `readyAt` is the poll that first saw `merge-ready: yes` for `headSha`. The
 * push, settle, and closeout instants and the push-to-ready wall clock are the
 * head timeline's measurements, carried so the row alone answers "how long did
 * certainty take" without the status artifact.
 *
 * **Example** (Construct a capsule)
 *
 * ```ts
 * import { YeetPrMergeReadyCapsule } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetPrMergeReadyCapsule.make({
 *   headSha: "abc123",
 *   prNumber: 1144,
 *   url: "https://github.com/o/r/pull/1144",
 *   readyAt: "2026-09-16T00:12:00.000Z",
 *   pushedAt: "2026-09-16T00:00:00.000Z",
 *   settledAt: "2026-09-16T00:10:00.000Z",
 *   closeoutAt: "2026-09-16T00:10:30.000Z",
 *   pushToReadyMs: 720000
 * })
 * console.log(capsule.prNumber) // 1144
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrMergeReadyCapsule extends S.Class<YeetPrMergeReadyCapsule>($I`YeetPrMergeReadyCapsule`)(
  {
    headSha: S.NonEmptyString,
    prNumber: S.Finite,
    url: S.NullOr(S.String),
    readyAt: S.String,
    pushedAt: S.NullOr(S.String),
    settledAt: S.NullOr(S.String),
    closeoutAt: S.NullOr(S.String),
    pushToReadyMs: S.NullOr(S.Finite),
  },
  $I.annote("YeetPrMergeReadyCapsule", {
    description: "One pull request head observed merge-ready, with its push-to-ready timeline.",
  })
) {}

/**
 * The P1 informational row the merge loop appends once per head when merge
 * readiness first reads `yes`.
 *
 * **Details**
 *
 * P1 means the hook injects it at the next tool boundary and never denies a
 * tool; it is good news, not incident work. A push moves the head, so the
 * loop supersedes the prior head's row with a `fix-sha` receipt naming the
 * new head and appends a fresh row when the new head is ready.
 *
 * **Example** (Construct a merge-ready row)
 *
 * ```ts
 * import { YeetPrMergeReadyCapsule, YeetPrMergeReadyRow, yeetPrMergeReadyRowId } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetPrMergeReadyCapsule.make({
 *   headSha: "abc123", prNumber: 1144, url: null, readyAt: "2026-09-16T00:12:00.000Z",
 *   pushedAt: null, settledAt: null, closeoutAt: null, pushToReadyMs: null
 * })
 * import { Effect } from "effect"
 *
 * const program = yeetPrMergeReadyRowId(capsule).pipe(
 *   Effect.map((id) =>
 *     YeetPrMergeReadyRow.make({
 *       capsule, checkout: "/repo", id, severity: "P1", ts: "2026-09-16T00:12:00.000Z"
 *     })
 *   )
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrMergeReadyRow extends S.Class<YeetPrMergeReadyRow>($I`YeetPrMergeReadyRow`)(
  {
    kind: S.tag("pr-merge-ready"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: S.Literal("P1"),
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetPrMergeReadyCapsule,
  },
  $I.annote("YeetPrMergeReadyRow", {
    description: "One P1 informational row: a pull request head is merge-ready for the operator.",
  })
) {}

/**
 * One informational result from a detached proof job.
 *
 * **Example** (Reference the row schema)
 * ```ts
 * import { YeetProofJobFinishedRow } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof YeetProofJobFinishedRow.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetProofJobFinishedRow extends S.Class<YeetProofJobFinishedRow>($I`YeetProofJobFinishedRow`)(
  {
    kind: S.tag("proof-job-finished"),
    schemaVersion: S.Literal(YEET_INBOX_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    severity: ProofJobRowSeverity,
    checkout: S.NonEmptyString,
    ts: S.String,
    capsule: YeetProofJobCapsule,
  },
  $I.annote("YeetProofJobFinishedRow", { description: "Informational completion or death of one detached proof job." })
) {}

/**
 * Derive the stable inbox id for a proof job.
 *
 * **Example** (Derive an id)
 * ```ts
 * import { yeetProofJobRowId } from "@beep/repo-cli/test/Yeet"
 * import { UUID } from "@beep/schema/String"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * const jobId = Effect.runSync(S.decodeEffect(UUID)("0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60"))
 * console.log(yeetProofJobRowId({ jobId }).startsWith("proof-job-")) // true
 * ```
 *
 * @param capsule - Job identity shared by the record and completion capsule.
 * @returns The deterministic inbox acknowledgment key.
 * @category utilities
 * @since 0.0.0
 */
export const yeetProofJobRowId = (capsule: Pick<YeetProofJobCapsule, "jobId">): string => `proof-job-${capsule.jobId}`;

/**
 * One row of the checkout inbox.
 *
 * **Details**
 *
 * Every member carries `schemaVersion`, a discriminating `kind`, a
 * deterministic `id`, and a `severity`, so a consumer can decode line-by-line
 * without context and gate enforcement on the tier. Required-check failures,
 * sibling collisions, review threads, base drift, base conflicts, and pull
 * request comments share this contract.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxRow = S.Union([
  YeetCheckFailedRow,
  YeetSiblingCollisionRow,
  YeetReviewThreadRow,
  YeetBaseDriftRow,
  YeetBaseConflictRow,
  YeetPrCommentRow,
  YeetLocalShardFailedRow,
  YeetPrMergeReadyRow,
  YeetProofJobFinishedRow,
]).pipe(
  $I.annoteSchema("YeetInboxRow", {
    title: "Yeet Inbox Row",
    description: "One typed NDJSON row of the checkout failure inbox.",
  })
);

/**
 * One row of the checkout inbox.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetInboxRow = typeof YeetInboxRow.Type;

/**
 * The inbox row kinds acknowledged by observation instead of an attributed closing move.
 *
 * **Details**
 *
 * Proof-job results (ruling 37) and merge-ready announcements (ruling 46) are
 * informational. `yeet inbox ack --observed` admits exactly these kinds, and the
 * remediation wave never owns them, so `yeet inbox list` always treats them as
 * live. Both call sites read this one kit, so adding a kind here changes both.
 *
 * **Example** (Check a row kind)
 *
 * ```ts
 * import { YeetInboxObservedRowKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetInboxObservedRowKind.is["pr-merge-ready"]("pr-merge-ready")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxObservedRowKind = LiteralKit(["proof-job-finished", "pr-merge-ready"]).pipe(
  $I.annoteSchema("YeetInboxObservedRowKind", {
    title: "Yeet Inbox Observed Row Kind",
    description: "Inbox row kinds acknowledged by observation: proof-job results and merge-ready announcements.",
  })
);

/**
 * The inbox row kinds acknowledged by observation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetInboxObservedRowKind = typeof YeetInboxObservedRowKind.Type;

const isYeetInboxObservedRowKind = S.is(YeetInboxObservedRowKind);

/**
 * Whether an inbox row is acknowledged by observation rather than an attributed closing move.
 *
 * **Example** (A merge-ready row is observed; a check failure is not)
 *
 * ```ts
 * import {
 *   YeetCheckFailedRow,
 *   YeetFailureCapsule,
 *   yeetInboxRowId,
 *   yeetInboxRowIsObserved
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail",
 *   headSha: "abc123",
 *   lane: "Check",
 *   link: null,
 *   observedAt: "2026-08-17T00:00:00Z",
 *   prNumber: 754,
 *   state: "FAILURE",
 *   workflow: null
 * })
 * const row = YeetCheckFailedRow.make({
 *   capsule,
 *   checkout: "/repo",
 *   id: yeetInboxRowId(capsule),
 *   severity: "P0",
 *   ts: "2026-08-17T00:00:00Z"
 * })
 *
 * console.log(yeetInboxRowIsObserved(row)) // false
 * ```
 *
 * @param row - The inbox row to classify.
 * @returns Whether `--observed` acknowledges the row and the list treats it as always live, narrowing the row to those kinds.
 * @category predicates
 * @since 0.0.0
 */
export const yeetInboxRowIsObserved = (
  row: YeetInboxRow
): row is Extract<YeetInboxRow, { readonly kind: YeetInboxObservedRowKind }> => isYeetInboxObservedRowKind(row.kind);

/**
 * The inbox row kinds whose liveness survives a push.
 *
 * **Details**
 *
 * GitHub resolves a review thread or answers a comment in the conversation,
 * not by a push, so rows of these kinds stay live when the wave record moves
 * to a new head. Every other wave-joined kind (`check-failed`, `base-drift`,
 * `base-conflict`) is superseded by the push, since the push is its fix and the
 * next poll re-emits it if not.
 *
 * `yeetInboxRowLiveness` reads this kit. The inbox hook carries this kit plus
 * {@link YeetInboxObservedRowKind} as one marked jq literal line, and a
 * repo-cli test fails when that line and the two kits disagree: jq cannot
 * import a TypeScript kit, so parity is tested rather than generated.
 *
 * **Example** (Check a row kind)
 *
 * ```ts
 * import { YeetInboxWaveExemptRowKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetInboxWaveExemptRowKind.is["review-thread"]("review-thread")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxWaveExemptRowKind = LiteralKit(["review-thread", "pr-comment"]).pipe(
  $I.annoteSchema("YeetInboxWaveExemptRowKind", {
    title: "Yeet Inbox Wave Exempt Row Kind",
    description: "Inbox row kinds that stay live across a push: review threads and pull request comments.",
  })
);

/**
 * The inbox row kinds whose liveness survives a push.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetInboxWaveExemptRowKind = typeof YeetInboxWaveExemptRowKind.Type;

const isYeetInboxWaveExemptRowKind = S.is(YeetInboxWaveExemptRowKind);

/**
 * Whether an inbox row stays live across a push instead of joining the wave record.
 *
 * **Example** (A review thread is wave-exempt; base drift is not)
 *
 * ```ts
 * import {
 *   YeetBaseDriftCapsule,
 *   YeetBaseDriftRow,
 *   YeetReviewThreadCapsule,
 *   YeetReviewThreadRow,
 *   yeetInboxRowIsWaveExempt
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const thread = YeetReviewThreadRow.make({
 *   capsule: YeetReviewThreadCapsule.make({ headSha: "abc123", link: null, prNumber: 900, threadId: "PRRT_abc" }),
 *   checkout: "/repo", id: "review-thread-abc", severity: "P1", ts: "2026-09-25T00:00:00Z"
 * })
 * const drift = YeetBaseDriftRow.make({
 *   capsule: YeetBaseDriftCapsule.make({ base: "origin/main", headSha: "abc123", prNumber: 900 }),
 *   checkout: "/repo", id: "base-drift-abc", severity: "P2", ts: "2026-09-25T00:00:00Z"
 * })
 *
 * console.log(yeetInboxRowIsWaveExempt(thread)) // true
 * console.log(yeetInboxRowIsWaveExempt(drift)) // false
 * ```
 *
 * @param row - The inbox row to classify.
 * @returns Whether the row's kind is in {@link YeetInboxWaveExemptRowKind}, narrowing the row to those kinds.
 * @category predicates
 * @since 0.0.0
 */
export const yeetInboxRowIsWaveExempt = (
  row: YeetInboxRow
): row is Extract<YeetInboxRow, { readonly kind: YeetInboxWaveExemptRowKind }> =>
  isYeetInboxWaveExemptRowKind(row.kind);

/**
 * The P1 inbox row kinds that wake a waiter.
 *
 * **Details**
 *
 * A waiter is `yeet job wait` on a monitor job, or an attached
 * `--until-ready` loop. It returns with exit 2 on a new wave, and only rows in
 * the wake set count toward one: every P0 row, plus P1 rows of these kinds.
 * The P0 rows are a required red (`check-failed`), a `base-conflict`, and the
 * checkout-scoped `sibling-collision` and `local-shard-failed` rows. The
 * checkout-scoped rows carry no pull request, so they never reach a waiter
 * on one. Any other P1 row is still written and still injected by the inbox
 * hook, but it never wakes a waiter. That covers an optional red (a P1
 * `check-failed` row, a rate-limited Vercel deployment among them), because
 * optional checks never affect an exit code in any mode (ttc ruling 42). The
 * observed kinds ({@link YeetInboxObservedRowKind}) never wake one either.
 *
 * **Example** (A review thread wakes at P1)
 *
 * ```ts
 * import { YeetInboxP1WakeRowKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetInboxP1WakeRowKind.is["review-thread"]("review-thread")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxP1WakeRowKind = LiteralKit(["review-thread", "pr-comment"]).pipe(
  $I.annoteSchema("YeetInboxP1WakeRowKind", {
    title: "Yeet Inbox P1 Wake Row Kind",
    description:
      "P1 inbox row kinds that wake a job wait or an attached until-ready loop: review threads and pull request comments.",
  })
);

/**
 * The P1 inbox row kinds that wake a waiter.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetInboxP1WakeRowKind = typeof YeetInboxP1WakeRowKind.Type;

const isYeetInboxP1WakeRowKind = S.is(YeetInboxP1WakeRowKind);

/**
 * Whether an inbox row can wake a waiter with a new wave.
 *
 * **Details**
 *
 * The wake set is every P0 row plus the P1 rows whose kind is in
 * {@link YeetInboxP1WakeRowKind}, minus the observed kinds. Both waiters,
 * `yeet job wait` and an attached `--until-ready` loop, read it through the
 * same wave loader, so an optional red never returns either one.
 *
 * **Example** (An optional red never wakes; a required red does)
 *
 * ```ts
 * import { YeetCheckFailedRow, YeetFailureCapsule, yeetInboxRowWakes } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail", headSha: "abc123", lane: "Vercel", link: null,
 *   observedAt: "2026-09-25T00:00:00Z", prNumber: 900, state: "FAILURE", workflow: null
 * })
 * const red = (severity: "P0" | "P1") =>
 *   YeetCheckFailedRow.make({ capsule, checkout: "/repo", id: "Vercel-abc", severity, ts: "2026-09-25T00:00:00Z" })
 *
 * console.log(yeetInboxRowWakes(red("P1"))) // false
 * console.log(yeetInboxRowWakes(red("P0"))) // true
 * ```
 *
 * @param row - The inbox row to classify.
 * @returns Whether the row counts toward a wave that returns a waiter.
 * @category predicates
 * @since 0.0.0
 */
export const yeetInboxRowWakes = (row: YeetInboxRow): boolean =>
  !yeetInboxRowIsObserved(row) &&
  (YeetInboxSeverity.is.P0(row.severity) ||
    (YeetInboxSeverity.is.P1(row.severity) && isYeetInboxP1WakeRowKind(row.kind)));

const yeetInboxIdentityId = Effect.fnUntraced(function* (label: string, parts: ReadonlyArray<string>) {
  const crypto = yield* Crypto.Crypto;
  const bytes = yield* crypto
    .digest("SHA-256", new TextEncoder().encode(A.join(parts, ":")))
    .pipe(Effect.mapError(YeetCommandError.new("Failed to hash inbox receipt identity.")));
  return `${safeArtifactName(label)}-${Str.takeLeft(12)(Hex.encode(bytes))}`;
});

/**
 * Derive the deterministic inbox row id for one failure.
 *
 * **Details**
 *
 * The id is the dedup key (headSha + lane, scoped by PR) rendered path-safe:
 * a sanitized lane segment for the operator's eyes plus a short digest for
 * uniqueness, because two distinct lane names can sanitize to the same
 * segment. It doubles as the ack receipt filename under `.beep/inbox/acks/`,
 * which is why it must never carry observation-time entropy.
 *
 * **Gotchas**
 *
 * Two checks that share a display name on one head share an identity — that
 * is the dedup contract (headSha + lane), not an accident. The capsule keeps
 * the first observed record's link and raw signal; a repair session works the
 * lane by name and sees every same-named job on the PR checks page anyway.
 *
 * **Example** (Same failure, same id)
 *
 * ```ts
 * import { yeetInboxRowId } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.all([
 *   yeetInboxRowId({ headSha: "abc123", lane: "Check / Coverage", prNumber: 751 }),
 *   yeetInboxRowId({ headSha: "abc123", lane: "Check / Coverage", prNumber: 751 }),
 * ]).pipe(Effect.map(([a, b]) => a === b))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param capsule - The failure's PR number, head SHA, and lane name.
 * @returns A path-safe id, stable across observations of the same failure.
 * @category utilities
 * @since 0.0.0
 */
export const yeetInboxRowId = (capsule: Pick<YeetFailureCapsule, "headSha" | "lane" | "prNumber">) =>
  yeetInboxIdentityId(capsule.lane, [`${capsule.prNumber}`, capsule.headSha, capsule.lane]);

/**
 * Derive a stable receipt id for one sibling-checkout collision.
 *
 * **Example** (Ignore path observation order)
 *
 * ```ts
 * import { yeetSiblingCollisionRowId } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.all([
 *   yeetSiblingCollisionRowId({
 *     contendedPaths: ["b.ts", "a.ts"], ownerCheckout: "/fleet/a", siblingCheckout: "/fleet/b"
 *   }),
 *   yeetSiblingCollisionRowId({
 *     contendedPaths: ["a.ts", "b.ts"], ownerCheckout: "/fleet/a", siblingCheckout: "/fleet/b"
 *   }),
 * ]).pipe(Effect.map(([a, b]) => a === b))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param capsule - Sibling-collision coordinates used for stable identity.
 * @returns A stable collision receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetSiblingCollisionRowId = (capsule: YeetSiblingCollisionCapsule) =>
  yeetInboxIdentityId("sibling-collision", [
    capsule.ownerCheckout,
    capsule.siblingCheckout,
    ...A.sort(capsule.contendedPaths, Order.String),
  ]);

/**
 * Derive a stable receipt id for one review thread on one pull request head.
 *
 * **Example** (Build a thread id)
 *
 * ```ts
 * import { yeetReviewThreadRowId } from "@beep/repo-cli/test/Yeet"
 *
 * import { Effect } from "effect"
 *
 * const program = yeetReviewThreadRowId({ headSha: "abc123", prNumber: 900, threadId: "PRRT_abc" })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param capsule - Review-thread coordinates used for stable identity.
 * @returns A stable review-thread receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetReviewThreadRowId = (capsule: Pick<YeetReviewThreadCapsule, "headSha" | "prNumber" | "threadId">) =>
  yeetInboxIdentityId("review-thread", [`${capsule.prNumber}`, capsule.headSha, capsule.threadId]);

/**
 * Derive a stable receipt id for base drift on one pull request head.
 *
 * **Example** (Build a drift id)
 *
 * ```ts
 * import { yeetBaseDriftRowId } from "@beep/repo-cli/test/Yeet"
 *
 * import { Effect } from "effect"
 *
 * const program = yeetBaseDriftRowId({ base: "origin/main", headSha: "abc123", prNumber: 900 })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param capsule - Base-drift coordinates used for stable identity.
 * @returns A stable base-drift receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetBaseDriftRowId = (capsule: Pick<YeetBaseDriftCapsule, "base" | "headSha" | "prNumber">) =>
  yeetInboxIdentityId("base-drift", [`${capsule.prNumber}`, capsule.headSha, capsule.base]);

/**
 * Derive the stable base-conflict row id for one conflict generation on a pull request head.
 *
 * **Details**
 *
 * PR number, head SHA and conflict generation: one row per conflict on a
 * head, so every poll that re-reads the same conflict derives the same id and
 * appends nothing, a conflict that returns on the same head after a `cleared`
 * receipt (the next generation) gets a new id, and a push gets a new id. The
 * `cleared` receipt the merge loop writes is keyed on this id. Generation 0
 * hashes only the PR number and head SHA, so rows and receipts written before
 * generations existed keep their ids.
 *
 * **Example** (Build a conflict id)
 *
 * ```ts
 * import { yeetBaseConflictRowId } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const program = yeetBaseConflictRowId({ generation: 0, headSha: "abc123", prNumber: 900 }).pipe(
 *   Effect.map((id) => id.startsWith("base-conflict-"))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param capsule - Pull request number, head SHA and conflict generation.
 * @returns A stable base-conflict receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetBaseConflictRowId = (capsule: Pick<YeetBaseConflictCapsule, "generation" | "headSha" | "prNumber">) =>
  yeetInboxIdentityId(
    "base-conflict",
    capsule.generation === 0
      ? [`${capsule.prNumber}`, capsule.headSha]
      : [`${capsule.prNumber}`, capsule.headSha, `${capsule.generation}`]
  );

/**
 * Derive the stable pull request comment row id for one GitHub comment.
 *
 * **Details**
 *
 * PR number, source collection and GitHub comment id; never the head or the
 * observation time. Every poll that sees the same comment derives the same id
 * and appends nothing, a push keeps it, and the ack receipt stays keyed on it.
 * The source is part of the key because conversation comments and review
 * bodies number their ids independently.
 *
 * **Example** (Same comment, same id)
 *
 * ```ts
 * import { yeetPrCommentRowId } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const program = yeetPrCommentRowId({ commentId: 44, prNumber: 900, source: "issue" }).pipe(
 *   Effect.map((id) => id.startsWith("pr-comment-"))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param capsule - Pull request number, source collection and GitHub comment id.
 * @returns A stable pull request comment receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetPrCommentRowId = (capsule: Pick<YeetPrCommentCapsule, "commentId" | "prNumber" | "source">) =>
  yeetInboxIdentityId("pr-comment", [`${capsule.prNumber}`, capsule.source, `${capsule.commentId}`]);

/**
 * Derive a stable poison-pill id for one local shard on one head.
 *
 * **Example** (Build a local shard id)
 *
 * ```ts
 * import { yeetLocalShardFailedRowId } from "@beep/repo-cli/test/Yeet"
 *
 * import { Effect } from "effect"
 *
 * const program = yeetLocalShardFailedRowId({ command: "bun run check", headSha: "abc123", shard: "Check" })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param capsule - Local-shard failure coordinates used for stable identity.
 * @returns A stable local-shard receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetLocalShardFailedRowId = (
  capsule: Pick<YeetLocalShardFailureCapsule, "command" | "headSha" | "shard">
) => yeetInboxIdentityId("local-shard", [capsule.headSha, capsule.shard, capsule.command]);

/**
 * Derive the stable merge-ready row id for one pull request head.
 *
 * **Details**
 *
 * PR number plus head SHA: one row per head, so re-observing readiness on the
 * same head appends nothing, and a push (new head) gets a new id.
 *
 * **Example** (Build a merge-ready id)
 *
 * ```ts
 * import { yeetPrMergeReadyRowId } from "@beep/repo-cli/test/Yeet"
 *
 * import { Effect } from "effect"
 *
 * const program = yeetPrMergeReadyRowId({ headSha: "abc123", prNumber: 1144 }).pipe(
 *   Effect.map((id) => id.startsWith("pr-merge-ready-"))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param capsule - Pull request number and head SHA.
 * @returns A stable merge-ready receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetPrMergeReadyRowId = (capsule: Pick<YeetPrMergeReadyCapsule, "headSha" | "prNumber">) =>
  yeetInboxIdentityId("pr-merge-ready", [`${capsule.prNumber}`, capsule.headSha]);

/**
 * The pull request an inbox row belongs to, when it belongs to one.
 *
 * **Details**
 *
 * Rows produced from a pull-request observation (`check-failed`,
 * `review-thread`, `base-drift`, `base-conflict`, `pr-comment`,
 * `pr-merge-ready`) carry the number in their capsule. Checkout-scoped rows (`sibling-collision`, `local-shard-failed`,
 * `proof-job-finished`) belong to no pull request. `yeet job wait` scopes its
 * wave return with this, so a row on another pull request in the same
 * checkout never wakes the waiter.
 *
 * **Example** (A check row names its pull request)
 *
 * ```ts
 * import { YeetCheckFailedRow, YeetFailureCapsule, yeetInboxRowPrNumber } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = YeetCheckFailedRow.make({
 *   capsule: YeetFailureCapsule.make({
 *     bucket: "fail", headSha: "abc123", lane: "Check", link: null,
 *     observedAt: "2026-09-25T00:00:00Z", prNumber: 900, state: "FAILURE", workflow: null
 *   }),
 *   checkout: "/repo", id: "Check-abc", severity: "P0", ts: "2026-09-25T00:00:00Z"
 * })
 * console.log(O.getOrNull(yeetInboxRowPrNumber(row))) // 900
 * ```
 *
 * @param row - Any inbox row variant, from a pull-request observation or scoped to the checkout.
 * @returns The row's pull request number, or `None` for a checkout-scoped row.
 * @category getters
 * @since 0.0.0
 */
export const yeetInboxRowPrNumber = (row: YeetInboxRow): O.Option<number> =>
  Match.value(row).pipe(
    Match.discriminator("kind")(
      "check-failed",
      "review-thread",
      "base-drift",
      "base-conflict",
      "pr-comment",
      "pr-merge-ready",
      ({ capsule }) => O.some(capsule.prNumber)
    ),
    Match.discriminator("kind")("sibling-collision", "local-shard-failed", "proof-job-finished", O.none<number>),
    Match.exhaustive
  );

/**
 * Recompute the deterministic receipt id for any inbox row variant.
 *
 * **Example** (Validate a check row id)
 *
 * ```ts
 * import { yeetInboxExpectedRowId, YeetCheckFailedRow, YeetFailureCapsule, yeetInboxRowId } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail", headSha: "abc123", lane: "Check", link: null,
 *   observedAt: "2026-08-27T00:00:00Z", prNumber: 900, state: "FAILURE", workflow: null
 * })
 * import { Effect } from "effect"
 *
 * const program = yeetInboxRowId(capsule).pipe(
 *   Effect.flatMap((id) => {
 *     const row = YeetCheckFailedRow.make({
 *       capsule, checkout: "/repo", id, severity: "P0", ts: "2026-08-27T00:00:00Z"
 *     })
 *     return yeetInboxExpectedRowId(row).pipe(Effect.map((expected) => expected === row.id))
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param row - Inbox row whose deterministic id should be recomputed.
 * @returns The stable expected id for the row variant.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetInboxExpectedRowId = (row: YeetInboxRow) =>
  Match.value(row).pipe(
    Match.discriminator("kind")("proof-job-finished", ({ capsule }) => Effect.succeed(yeetProofJobRowId(capsule))),
    Match.discriminator("kind")("check-failed", (subject) => yeetInboxRowId(subject.capsule)),
    Match.discriminator("kind")("sibling-collision", (subject) => yeetSiblingCollisionRowId(subject.capsule)),
    Match.discriminator("kind")("review-thread", (subject) => yeetReviewThreadRowId(subject.capsule)),
    Match.discriminator("kind")("base-drift", (subject) => yeetBaseDriftRowId(subject.capsule)),
    Match.discriminator("kind")("base-conflict", (subject) => yeetBaseConflictRowId(subject.capsule)),
    Match.discriminator("kind")("pr-comment", (subject) => yeetPrCommentRowId(subject.capsule)),
    Match.discriminator("kind")("local-shard-failed", (subject) => yeetLocalShardFailedRowId(subject.capsule)),
    Match.discriminator("kind")("pr-merge-ready", (subject) => yeetPrMergeReadyRowId(subject.capsule)),
    Match.exhaustive
  );

/**
 * Render the stable operator label and coordinates of any inbox row.
 *
 * **Example** (Describe a check failure)
 *
 * ```ts
 * import { describeYeetInboxRow, YeetCheckFailedRow, YeetFailureCapsule, yeetInboxRowId } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail", headSha: "abc123", lane: "Check", link: null,
 *   observedAt: "2026-08-27T00:00:00Z", prNumber: 900, state: "FAILURE", workflow: null
 * })
 * const row = YeetCheckFailedRow.make({
 *   capsule, checkout: "/repo", id: yeetInboxRowId(capsule), severity: "P0", ts: "2026-08-27T00:00:00Z"
 * })
 * console.log(describeYeetInboxRow(row).includes("Check")) // true
 * ```
 *
 * @param row - Inbox row to describe.
 * @returns A stable operator-facing label for the row.
 * @category formatting
 * @since 0.0.0
 */
export const describeYeetInboxRow = (row: YeetInboxRow): string =>
  Match.value(row).pipe(
    Match.discriminator("kind")(
      "proof-job-finished",
      ({ capsule }) => `proof job ${capsule.jobId}: ${capsule.phase}; log ${capsule.logPath}`
    ),
    Match.discriminator("kind")(
      "check-failed",
      ({ capsule }) => `${capsule.lane} (pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)})`
    ),
    Match.discriminator("kind")(
      "sibling-collision",
      ({ capsule }) => `sibling collision with ${capsule.siblingCheckout} (${capsule.contendedPaths.length} path(s))`
    ),
    Match.discriminator("kind")(
      "review-thread",
      ({ capsule }) =>
        `review thread ${capsule.threadId} (pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)})`
    ),
    Match.discriminator("kind")(
      "base-drift",
      ({ capsule }) => `base drift from ${capsule.base} (pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)})`
    ),
    Match.discriminator("kind")(
      "base-conflict",
      ({ capsule }) =>
        `base conflict with ${capsule.base} (pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)})`
    ),
    Match.discriminator("kind")(
      "pr-comment",
      ({ capsule }) =>
        `comment by @${capsule.author} (pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)}): ${capsule.excerpt} ${capsule.link}`
    ),
    Match.discriminator("kind")(
      "local-shard-failed",
      ({ capsule }) => `local shard ${capsule.shard} exited ${capsule.exitCode} @ ${Str.slice(0, 7)(capsule.headSha)}`
    ),
    Match.discriminator("kind")(
      "pr-merge-ready",
      ({ capsule }) =>
        `merge-ready pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)}${O.match(
          O.fromNullishOr(capsule.pushToReadyMs),
          { onNone: () => Str.empty, onSome: (millis) => ` (push→ready ${Math.round(millis / 1000)}s)` }
        )}`
    ),
    Match.exhaustive
  );

/**
 * The inbox file layout under one checkout.
 *
 * **Example** (Build the layout)
 *
 * ```ts
 * import { YeetInboxPaths } from "@beep/repo-cli/test/Yeet"
 *
 * const paths = YeetInboxPaths.make({
 *   activePath: "/repo/.beep/inbox/active.ndjson",
 *   acksDir: "/repo/.beep/inbox/acks",
 *   dir: "/repo/.beep/inbox",
 *   failuresPath: "/repo/.beep/inbox/failures.ndjson"
 * })
 *
 * console.log(paths.failuresPath) // "/repo/.beep/inbox/failures.ndjson"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetInboxPaths extends S.Class<YeetInboxPaths>($I`YeetInboxPaths`)(
  {
    activePath: S.NonEmptyString,
    acksDir: S.NonEmptyString,
    dir: S.NonEmptyString,
    failuresPath: S.NonEmptyString,
  },
  $I.annote("YeetInboxPaths", {
    description: "Resolved inbox locations for one checkout: bounded active index, history, acknowledgments, and root.",
  })
) {}

/**
 * Resolve the inbox layout for one checkout.
 *
 * **Example** (Build the resolution effect)
 *
 * ```ts
 * import { yeetInboxPaths } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(yeetInboxPaths("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout the inbox belongs to.
 * @returns The resolved inbox layout.
 * @category services
 * @since 0.0.0
 */
export const yeetInboxPaths = Effect.fn("Yeet.yeetInboxPaths")(function* (
  repoRoot: string
): Effect.fn.Return<YeetInboxPaths, never, Path.Path> {
  const path = yield* Path.Path;
  const dir = path.join(repoRoot, ".beep", "inbox");
  return YeetInboxPaths.make({
    activePath: path.join(dir, "active.ndjson"),
    acksDir: path.join(dir, "acks"),
    dir,
    failuresPath: path.join(dir, "failures.ndjson"),
  });
});

const YEET_INBOX_ACTIVE_ROW_LIMIT = 2_048;

const updateYeetInboxActiveIndex = Effect.fn("Yeet.updateInboxActiveIndex")(function* (
  repoRoot: string,
  paths: YeetInboxPaths,
  line: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const inboxDir = path.dirname(paths.activePath);
  const crypto = yield* Crypto.Crypto;
  const inputPath = path.join(inboxDir, `.active-row-${yield* crypto.randomUUIDv4}.tmp`);
  const outputPath = path.join(inboxDir, `.active-index-${yield* crypto.randomUUIDv4}.tmp`);
  const versionPath = path.join(inboxDir, "active-p0-safe-v2");
  yield* fs.writeFileString(inputPath, `${line}\n`, { flag: "wx", mode: 0o600 });
  const script = `
set -eu
active="$1"
history="$2"
incoming="$3"
output="$4"
acks="$5"
limit="$6"
version="$7"
if [ -L "$active" ]; then exit 70; fi
source="$active"
if [ ! -f "$active" ] || [ ! -f "$version" ]; then source="$history"; fi
rm -f -- "$version"
ack_ids='[]'
if [ -d "$acks" ]; then
  for ack_path in "$acks"/*; do
    [ -e "$ack_path" ] || continue
    [ -f "$ack_path" ] && [ ! -L "$ack_path" ] || continue
    ack_kind="$(jq -r '.resolution.kind // empty' "$ack_path" 2>/dev/null || true)"
    # A waiver hides a row only until its expiry. Keep waived evidence in the
    # bounded active projection so hook-time expiry can re-arm it without
    # relying on a duplicate hosted observation.
    [ "$ack_kind" = "waive" ] && continue
    ack_id="\${ack_path##*/}"
    ack_ids="$(printf '%s' "$ack_ids" | jq -c --arg id "$ack_id" '. + [$id]')"
  done
fi
{
  if [ -f "$source" ]; then cat "$source"; fi
  cat "$incoming"
} | jq -Rrsc --argjson acks "$ack_ids" --argjson limit "$limit" '
  split("\\n")
  | map(select(length > 0) | fromjson)
  | unique_by(.id)
  | map(. as $row | select(($acks | index($row.id)) == null))
  | [ .[] | select(.severity == "P0") ] as $p0
  | [ .[] | select(.severity != "P0") ] as $lower
  | ($limit - ($p0 | length)) as $remaining
  | ($p0 + (if $remaining > 0 then $lower[(-$remaining):] else [] end))
  | .[]
  | tojson
' >"$output"
chmod 600 "$output"
mv -f -- "$output" "$active"
printf 'yeet-inbox-active-p0-safe/v2\n' >"$version"
chmod 600 "$version"
rm -f -- "$incoming"
`;
  const result = Bun.spawnSync(
    [
      "flock",
      "-w",
      "2",
      path.join(inboxDir, "active-mutex.lock"),
      "sh",
      "-c",
      script,
      "yeet-inbox-active",
      paths.activePath,
      paths.failuresPath,
      inputPath,
      outputPath,
      paths.acksDir,
      String(YEET_INBOX_ACTIVE_ROW_LIMIT),
      versionPath,
    ],
    { cwd: repoRoot, stderr: "pipe", stdout: "ignore" }
  );
  if (result.exitCode !== 0) {
    yield* Effect.all(
      [
        fs.remove(inputPath).pipe(Effect.ignore),
        fs.remove(outputPath).pipe(Effect.ignore),
        fs.remove(versionPath).pipe(Effect.ignore),
      ],
      { discard: true }
    );
    return yield* YeetCommandError.make({
      message: `Failed to update the bounded active inbox index "${paths.activePath}": ${Str.trim(result.stderr.toString())}`,
      exitCode: result.exitCode,
    });
  }
});

/**
 * Resolve the ack receipt path for one inbox row.
 *
 * **Details**
 *
 * The receipt file's existence is the acknowledgment: A2's consumers write it
 * with the fix SHA, a wontfix reason, or a thread URL, and until it exists the
 * harness keeps re-presenting the row. The writer side never creates it.
 *
 * **Example** (Build the resolution effect)
 *
 * ```ts
 * import { yeetInboxAckPath } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(yeetInboxAckPath("/repo", "lane-abc"))) // true
 * ```
 *
 * @param repoRoot - The checkout the inbox belongs to.
 * @param id - The inbox row id the receipt acknowledges.
 * @returns The receipt file path for that row.
 * @category services
 * @since 0.0.0
 */
export const yeetInboxAckPath = Effect.fn("Yeet.yeetInboxAckPath")(function* (
  repoRoot: string,
  id: string
): Effect.fn.Return<string, never, Path.Path> {
  const paths = yield* yeetInboxPaths(repoRoot);
  const path = yield* Path.Path;
  return path.join(paths.acksDir, id);
});

/**
 * JSON string codec for one inbox row.
 *
 * **Details**
 *
 * The writer side encodes through it; consumers (A2's hook adapters, tests)
 * get the matching `decode`/`decodeOption` without re-deriving the codec, so
 * both directions provably speak the same shape.
 *
 * **Example** (Decode a row line)
 *
 * ```ts
 * import { YeetInboxRowJson } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(YeetInboxRowJson.decodeOption("not json"))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const YeetInboxRowJson = JsonStringCodec(YeetInboxRow);

/**
 * Render one inbox row as its NDJSON line.
 *
 * **Example** (Build the render effect)
 *
 * ```ts
 * import { renderYeetInboxRowLine, YeetCheckFailedRow, YeetFailureCapsule } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const row = YeetCheckFailedRow.make({
 *   capsule: YeetFailureCapsule.make({
 *     bucket: "fail",
 *     headSha: "abc123",
 *     lane: "Check",
 *     link: null,
 *     observedAt: "2026-08-17T00:00:00Z",
 *     prNumber: 751,
 *     state: "FAILURE",
 *     workflow: null
 *   }),
 *   checkout: "/repo",
 *   id: "check-abc",
 *   severity: "P0",
 *   ts: "2026-08-17T00:00:00Z"
 * })
 *
 * console.log(Effect.isEffect(renderYeetInboxRowLine(row))) // true
 * ```
 *
 * @param row - The row to render.
 * @returns The row as a single-line JSON string.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetInboxRowLine = (row: YeetInboxRow): Effect.Effect<string, S.SchemaError> =>
  YeetInboxRowJson.encode(row);

/**
 * Append one row to a checkout's failure inbox.
 *
 * **Details**
 *
 * Creates the inbox directory on first use and appends exactly one NDJSON
 * line. The contained append rejects symlinked targets and parents, then
 * appends through a verified private hard-link alias so the predictable target
 * pathname is never opened for writing. Rows remain immutable once written,
 * and acknowledgment happens through receipt files, so concurrent writers
 * retain whole-line append semantics.
 *
 * **Example** (Build the append effect)
 *
 * ```ts
 * import { appendYeetInboxRow, YeetCheckFailedRow, YeetFailureCapsule } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const row = YeetCheckFailedRow.make({
 *   capsule: YeetFailureCapsule.make({
 *     bucket: "fail",
 *     headSha: "abc123",
 *     lane: "Check",
 *     link: null,
 *     observedAt: "2026-08-17T00:00:00Z",
 *     prNumber: 751,
 *     state: "FAILURE",
 *     workflow: null
 *   }),
 *   checkout: "/repo",
 *   id: "check-abc",
 *   severity: "P0",
 *   ts: "2026-08-17T00:00:00Z"
 * })
 *
 * console.log(Effect.isEffect(appendYeetInboxRow("/repo", row))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox receives the row.
 * @param row - The row to append.
 * @returns Nothing on success.
 * @category services
 * @since 0.0.0
 */
export const appendYeetInboxRow = Effect.fn("Yeet.appendYeetInboxRow")(function* (
  repoRoot: string,
  row: YeetInboxRow
): Effect.fn.Return<void, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const paths = yield* yeetInboxPaths(repoRoot);
  const line = yield* renderYeetInboxRowLine(row).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode an inbox row."))
  );
  yield* appendContainedFileString(repoRoot, paths.failuresPath, `${line}\n`).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to append to the failure inbox "${paths.failuresPath}".`))
  );
  yield* updateYeetInboxActiveIndex(repoRoot, paths, line).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to update the active inbox index "${paths.activePath}".`))
  );
});

/**
 * Append a row only when its deterministic id is not already in the inbox.
 *
 * **Details**
 *
 * Snapshot-converging writers call this on every poll for state that remains
 * true, such as an unresolved thread. The check is an optimization rather than
 * the identity boundary: concurrent writers can still race, and consumers
 * continue to deduplicate by id.
 *
 * An ack receipt under `acks/<id>` also counts as held. Receipts are only
 * written for rows that were appended, and an ack drops its row from the
 * rebuilt active index, so without the receipt check a row that is acked but
 * still outstanding (a thread acked with its reply URL and not yet resolved, a
 * base still `BEHIND`, a red still failing) would be appended again on every
 * poll after the next unrelated append rebuilt the index.
 *
 * **Example** (Build an idempotent append effect)
 *
 * ```ts
 * import { appendYeetInboxRowOnce, YeetBaseDriftCapsule, YeetBaseDriftRow, yeetBaseDriftRowId } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const capsule = YeetBaseDriftCapsule.make({ base: "origin/main", headSha: "abc123", prNumber: 900 })
 * const row = YeetBaseDriftRow.make({
 *   capsule, checkout: "/repo", id: yeetBaseDriftRowId(capsule), severity: "P2", ts: "2026-08-27T00:00:00Z"
 * })
 * console.log(Effect.isEffect(appendYeetInboxRowOnce("/repo", row))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const appendYeetInboxRowOnce = Effect.fn("Yeet.appendYeetInboxRowOnce")(function* (
  repoRoot: string,
  row: YeetInboxRow
): Effect.fn.Return<boolean, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  if ((yield* yeetInboxAckReceiptExists(repoRoot, row.id)) || (yield* yeetInboxHoldsRow(repoRoot, row.id))) {
    return false;
  }
  yield* appendYeetInboxRow(repoRoot, row);
  return true;
});

// Whether an ack receipt entry exists for the id: one no-follow read of
// `acks/<id>`, like the ack reader's. A symlinked or unreadable path reads as
// no receipt, so the append goes ahead rather than trusting it.
const yeetInboxAckReceiptExists = Effect.fnUntraced(function* (
  repoRoot: string,
  id: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const ackPath = yield* yeetInboxAckPath(repoRoot, id);
  const read = yield* Effect.option(readContainedFileStringNoFollow(repoRoot, ackPath));
  return O.exists(read, (entry) => entry.exists);
});

// The lines the dedup reads: the bounded active index when it is current,
// otherwise the full failures file. Every read failure reads as no lines.
const readYeetInboxHeldLines = Effect.fnUntraced(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const paths = yield* yeetInboxPaths(repoRoot);
  const activeVersionPath = path.join(paths.dir, "active-p0-safe-v2");
  const activeIndexCurrent = yield* fs.exists(activeVersionPath).pipe(Effect.orElseSucceed(() => false));
  const sourcePath = activeIndexCurrent ? paths.activePath : paths.failuresPath;
  const text = yield* fs.readFileString(sourcePath).pipe(Effect.orElseSucceed(() => ""));
  return Str.split(text, "\n");
});

/**
 * Whether the checkout's inbox currently holds a row with this id.
 *
 * **Details**
 *
 * Reads the bounded active index when it is current, otherwise the full
 * failures file, the same source {@link appendYeetInboxRowOnce} dedups
 * against. A row that an ack removed from a rebuilt active index therefore
 * reads as absent here; the append also consults the ack receipt, so such a
 * row is still not appended twice. Every read failure reads as absent.
 *
 * **Example** (Build the presence check)
 *
 * ```ts
 * import { yeetInboxHoldsRow } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(yeetInboxHoldsRow("/repo", "base-conflict-abc"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox is read.
 * @param id - The row id to look for.
 * @returns Whether a decodable row with that id is present; never fails.
 * @category services
 * @since 0.0.0
 */
export const yeetInboxHoldsRow = Effect.fn("Yeet.yeetInboxHoldsRow")(function* (
  repoRoot: string,
  id: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  return A.some(yield* readYeetInboxHeldLines(repoRoot), (line) =>
    O.exists(YeetInboxRowJson.decodeOption(line), (decoded) => decoded.id === id)
  );
});

/**
 * The ids of the review-thread rows the checkout's inbox holds for one thread, on any head.
 *
 * **Details**
 *
 * Reads the same source as {@link yeetInboxHoldsRow}. A review-thread row id
 * is keyed on the head, but the row is wave-exempt and stays live across a
 * push, so inbox convergence uses this to find a thread's earlier rows before
 * it writes one for a new head. Every read failure reads as no rows.
 *
 * **Example** (Build the lookup)
 *
 * ```ts
 * import { yeetInboxReviewThreadRowIds } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(yeetInboxReviewThreadRowIds("/repo", 900, "PRRT_abc"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox is read.
 * @param prNumber - The pull request the thread belongs to.
 * @param threadId - The review thread's GitHub node id.
 * @returns The ids of the held rows for that thread, in inbox order; never fails.
 * @category services
 * @since 0.0.0
 */
export const yeetInboxReviewThreadRowIds = Effect.fn("Yeet.yeetInboxReviewThreadRowIds")(function* (
  repoRoot: string,
  prNumber: number,
  threadId: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  return A.flatMap(yield* readYeetInboxHeldLines(repoRoot), (line) =>
    YeetInboxRowJson.decodeOption(line).pipe(
      O.filter((row): row is YeetReviewThreadRow => row.kind === "review-thread"),
      O.filter((row) => row.capsule.prNumber === prNumber && row.capsule.threadId === threadId),
      O.map((row) => row.id),
      O.toArray
    )
  );
});
