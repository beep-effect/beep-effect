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

import { createHash } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";
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
 * One row of the checkout inbox.
 *
 * **Details**
 *
 * Every member carries `schemaVersion`, a discriminating `kind`, a
 * deterministic `id`, and a `severity`, so a consumer can decode line-by-line
 * without context and gate enforcement on the tier. `check-failed` is the only
 * member today; A2's additional writers (sibling collision, review thread,
 * base drift) extend the union without a version bump.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxRow = S.Union([YeetCheckFailedRow]).pipe(
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
export const yeetInboxRowId = (capsule: Pick<YeetFailureCapsule, "headSha" | "lane" | "prNumber">): string => {
  const digest = createHash("sha256")
    .update(`${capsule.prNumber}:${capsule.headSha}:${capsule.lane}`)
    .digest("hex")
    .slice(0, 12);
  return `${safeArtifactName(capsule.lane)}-${digest}`;
};

/**
 * The inbox file layout under one checkout.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetInboxPaths extends S.Class<YeetInboxPaths>($I`YeetInboxPaths`)(
  {
    acksDir: S.NonEmptyString,
    dir: S.NonEmptyString,
    failuresPath: S.NonEmptyString,
  },
  $I.annote("YeetInboxPaths", {
    description: "Resolved inbox locations for one checkout: the inbox dir, the failures file, and the acks dir.",
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
    acksDir: path.join(dir, "acks"),
    dir,
    failuresPath: path.join(dir, "failures.ndjson"),
  });
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
 * line. Appends are the only mutation the writer side performs — rows are
 * immutable once written, and acknowledgment happens through receipt files,
 * so concurrent writers interleave whole lines rather than contending on a
 * shared document.
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
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(repoRoot);
  const line = yield* renderYeetInboxRowLine(row).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode an inbox row."))
  );
  yield* fs
    .makeDirectory(paths.dir, { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create the inbox directory "${paths.dir}".`)));
  yield* fs
    .writeFileString(paths.failuresPath, `${line}\n`, { flag: "a" })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to append to the failure inbox "${paths.failuresPath}".`)));
});
