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

import { createHash, randomUUID } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, FileSystem, Match, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { appendContainedFileString } from "../../../internal/cli/FsGuards.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { safeArtifactName } from "./ArtifactPaths.ts";

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
 * const row = YeetCheckFailedRow.make({
 *   capsule,
 *   checkout: "/repo",
 *   id: yeetInboxRowId(capsule),
 *   severity: "P0",
 *   ts: "2026-08-17T00:00:00Z"
 * })
 *
 * console.log(row.kind) // "check-failed"
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
 * One row of the checkout inbox.
 *
 * **Details**
 *
 * Every member carries `schemaVersion`, a discriminating `kind`, a
 * deterministic `id`, and a `severity`, so a consumer can decode line-by-line
 * without context and gate enforcement on the tier. Required-check failures,
 * sibling collisions, review threads, and base drift share this contract.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxRow = S.Union([
  YeetCheckFailedRow,
  YeetSiblingCollisionRow,
  YeetReviewThreadRow,
  YeetBaseDriftRow,
  YeetLocalShardFailedRow,
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

const yeetInboxIdentityId = (label: string, parts: ReadonlyArray<string>): string => {
  const digest = createHash("sha256").update(A.join(parts, ":")).digest("hex").slice(0, 12);
  return `${safeArtifactName(label)}-${digest}`;
};

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
 *
 * const a = yeetInboxRowId({ headSha: "abc123", lane: "Check / Coverage", prNumber: 751 })
 * const b = yeetInboxRowId({ headSha: "abc123", lane: "Check / Coverage", prNumber: 751 })
 *
 * console.log(a === b) // true
 * ```
 *
 * @param capsule - The failure's PR number, head SHA, and lane name.
 * @returns A path-safe id, stable across observations of the same failure.
 * @category utilities
 * @since 0.0.0
 */
export const yeetInboxRowId = (capsule: Pick<YeetFailureCapsule, "headSha" | "lane" | "prNumber">): string =>
  yeetInboxIdentityId(capsule.lane, [`${capsule.prNumber}`, capsule.headSha, capsule.lane]);

/**
 * Derive a stable receipt id for one sibling-checkout collision.
 *
 * **Example** (Ignore path observation order)
 *
 * ```ts
 * import { yeetSiblingCollisionRowId } from "@beep/repo-cli/test/Yeet"
 *
 * const a = yeetSiblingCollisionRowId({
 *   contendedPaths: ["b.ts", "a.ts"], ownerCheckout: "/fleet/a", siblingCheckout: "/fleet/b"
 * })
 * const b = yeetSiblingCollisionRowId({
 *   contendedPaths: ["a.ts", "b.ts"], ownerCheckout: "/fleet/a", siblingCheckout: "/fleet/b"
 * })
 * console.log(a === b) // true
 * ```
 *
 * @param capsule - Sibling-collision coordinates used for stable identity.
 * @returns A stable collision receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetSiblingCollisionRowId = (capsule: YeetSiblingCollisionCapsule): string =>
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
 * console.log(yeetReviewThreadRowId({ headSha: "abc123", prNumber: 900, threadId: "PRRT_abc" }))
 * ```
 *
 * @param capsule - Review-thread coordinates used for stable identity.
 * @returns A stable review-thread receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetReviewThreadRowId = (
  capsule: Pick<YeetReviewThreadCapsule, "headSha" | "prNumber" | "threadId">
): string => yeetInboxIdentityId("review-thread", [`${capsule.prNumber}`, capsule.headSha, capsule.threadId]);

/**
 * Derive a stable receipt id for base drift on one pull request head.
 *
 * **Example** (Build a drift id)
 *
 * ```ts
 * import { yeetBaseDriftRowId } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetBaseDriftRowId({ base: "origin/main", headSha: "abc123", prNumber: 900 }))
 * ```
 *
 * @param capsule - Base-drift coordinates used for stable identity.
 * @returns A stable base-drift receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetBaseDriftRowId = (capsule: Pick<YeetBaseDriftCapsule, "base" | "headSha" | "prNumber">): string =>
  yeetInboxIdentityId("base-drift", [`${capsule.prNumber}`, capsule.headSha, capsule.base]);

/**
 * Derive a stable poison-pill id for one local shard on one head.
 *
 * **Example** (Build a local shard id)
 *
 * ```ts
 * import { yeetLocalShardFailedRowId } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetLocalShardFailedRowId({ command: "bun run check", headSha: "abc123", shard: "Check" }))
 * ```
 *
 * @param capsule - Local-shard failure coordinates used for stable identity.
 * @returns A stable local-shard receipt id.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetLocalShardFailedRowId = (
  capsule: Pick<YeetLocalShardFailureCapsule, "command" | "headSha" | "shard">
): string => yeetInboxIdentityId("local-shard", [capsule.headSha, capsule.shard, capsule.command]);

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
 * const row = YeetCheckFailedRow.make({
 *   capsule, checkout: "/repo", id: yeetInboxRowId(capsule), severity: "P0", ts: "2026-08-27T00:00:00Z"
 * })
 * console.log(yeetInboxExpectedRowId(row) === row.id) // true
 * ```
 *
 * @param row - Inbox row whose deterministic id should be recomputed.
 * @returns The stable expected id for the row variant.
 * @category identifiers
 * @since 0.0.0
 */
export const yeetInboxExpectedRowId = (row: YeetInboxRow): string =>
  Match.value(row).pipe(
    Match.discriminators("kind")({
      "check-failed": (subject) => yeetInboxRowId(subject.capsule),
      "sibling-collision": (subject) => yeetSiblingCollisionRowId(subject.capsule),
      "review-thread": (subject) => yeetReviewThreadRowId(subject.capsule),
      "base-drift": (subject) => yeetBaseDriftRowId(subject.capsule),
      "local-shard-failed": (subject) => yeetLocalShardFailedRowId(subject.capsule),
    }),
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
    Match.discriminators("kind")({
      "check-failed": ({ capsule }) =>
        `${capsule.lane} (pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)})`,
      "sibling-collision": ({ capsule }) =>
        `sibling collision with ${capsule.siblingCheckout} (${capsule.contendedPaths.length} path(s))`,
      "review-thread": ({ capsule }) =>
        `review thread ${capsule.threadId} (pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)})`,
      "base-drift": ({ capsule }) =>
        `base drift from ${capsule.base} (pr #${capsule.prNumber} @ ${Str.slice(0, 7)(capsule.headSha)})`,
      "local-shard-failed": ({ capsule }) =>
        `local shard ${capsule.shard} exited ${capsule.exitCode} @ ${Str.slice(0, 7)(capsule.headSha)}`,
    }),
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
  const inputPath = path.join(inboxDir, `.active-row-${randomUUID()}.tmp`);
  const outputPath = path.join(inboxDir, `.active-index-${randomUUID()}.tmp`);
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
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
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
): Effect.fn.Return<boolean, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const paths = yield* yeetInboxPaths(repoRoot);
  const activeVersionPath = path.join(paths.dir, "active-p0-safe-v2");
  const activeIndexCurrent = yield* fs.exists(activeVersionPath).pipe(Effect.orElseSucceed(() => false));
  const sourcePath = activeIndexCurrent ? paths.activePath : paths.failuresPath;
  const text = yield* fs.readFileString(sourcePath).pipe(Effect.orElseSucceed(() => ""));
  const present = A.some(Str.split(text, "\n"), (line) =>
    O.exists(YeetInboxRowJson.decodeOption(line), (decoded) => decoded.id === row.id)
  );
  if (present) {
    return false;
  }
  yield* appendYeetInboxRow(repoRoot, row);
  return true;
});
