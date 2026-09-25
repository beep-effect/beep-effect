/**
 * Ack receipts: the work-log side of the checkout failure inbox.
 *
 * **Details**
 *
 * An inbox row keeps re-presenting until a receipt file exists at
 * `<checkout>/.beep/inbox/acks/<id>` — the ship-velocity A2 contract that the
 * harness adapters (Claude deny, Codex inject, Grok tail) all enforce from.
 * The receipt is not a bare tombstone: it records what was actually done about
 * the failure — the SHA of the fix commit, a reasoned environment-only
 * attribution, a wontfix decision with its reason, or the review-thread URL
 * where the discussion continues — so `yeet monitor` and the operator can
 * audit an acknowledgment instead of trusting it.
 *
 * **Gotchas**
 *
 * The receipt file's *existence* is the acknowledgment; its decodability is
 * not. A receipt that fails to decode still acks its row — un-acking on
 * corruption would re-arm a P0 denial over a bookkeeping defect, and the A2
 * mutex must never manufacture the interruption it exists to relieve. The
 * typed state ({@link YeetAckState}) therefore separates `acked` (the file
 * exists) from `receipt` (its decoded content, when readable).
 *
 * Re-acking overwrites: a wrong receipt (a typo'd SHA, a premature wontfix)
 * must never dead-end the fix path, so the last resolution wins and the CLI
 * reports that a prior receipt was replaced.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { DateTime, Effect, Match } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readContainedFileStringNoFollow, writeContainedFileString } from "../../../internal/cli/FsGuards.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { yeetInboxAckPath } from "./Inbox.ts";
import { ProofJobObservedVia } from "./ProofJob.ts";
import type { FileSystem, Path } from "effect";

const $I = $RepoCliId.create("commands/Yeet/internal/Ack");

/**
 * The resolution kinds an ack receipt can record.
 *
 * **Details**
 *
 * Four permanent closing moves an operator or agent writes (`fix-sha`,
 * `environment-only`, `wontfix`, `thread-url`), the expiring `waive`, the
 * `observed` acknowledgment of informational rows, and `cleared`, which only
 * the merge loop writes, when a conflicted head turns mergeable again. Every
 * site that decides by kind matches exhaustively on the resolution union built
 * from these literals. The inbox hook and the active-index script special-case
 * only `waive` (expiry), so any other kind acknowledges its row.
 *
 * **Example** (Check a resolution kind)
 *
 * ```ts
 * import { YeetAckResolutionKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetAckResolutionKind.is.cleared("cleared")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetAckResolutionKind = LiteralKit([
  "fix-sha",
  "environment-only",
  "wontfix",
  "thread-url",
  "waive",
  "observed",
  "cleared",
]).pipe(
  $I.annoteSchema("YeetAckResolutionKind", {
    title: "Yeet Ack Resolution Kind",
    description: "What an ack receipt records: a closing move, a waiver, an observation, or a monitor-written clear.",
  })
);

/**
 * The resolution kinds an ack receipt can record.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetAckResolutionKind = typeof YeetAckResolutionKind.Type;

/**
 * Schema version stamped on every ack receipt.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { YEET_ACK_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_ACK_SCHEMA_VERSION) // "yeet-ack/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_ACK_SCHEMA_VERSION = "yeet-ack/v1";

/**
 * The failure was fixed; the receipt names the commit that did it.
 *
 * **Example** (Build a fix resolution)
 *
 * ```ts
 * import { YeetAckFixResolution } from "@beep/repo-cli/test/Yeet"
 *
 * const resolution = YeetAckFixResolution.make({ sha: "2817f286d3" })
 * console.log(resolution.kind) // "fix-sha"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckFixResolution extends S.Class<YeetAckFixResolution>($I`YeetAckFixResolution`)(
  {
    kind: S.tag(YeetAckResolutionKind.Enum["fix-sha"]),
    sha: S.NonEmptyString,
  },
  $I.annote("YeetAckFixResolution", {
    description: "Acknowledgment that the failure was fixed, naming the fix commit.",
  })
) {}

/**
 * The failure came from the execution environment rather than repository code.
 *
 * **Example** (Record an environment-only resolution)
 *
 * ```ts
 * import { YeetAckEnvironmentOnlyResolution } from "@beep/repo-cli/test/Yeet"
 *
 * const resolution = YeetAckEnvironmentOnlyResolution.make({
 *   reason: "stale upstream dist rebuilt; package audit rerun green"
 * })
 * console.log(resolution.kind) // "environment-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckEnvironmentOnlyResolution extends S.Class<YeetAckEnvironmentOnlyResolution>(
  $I`YeetAckEnvironmentOnlyResolution`
)(
  {
    kind: S.tag(YeetAckResolutionKind.Enum["environment-only"]),
    reason: S.NonEmptyString,
  },
  $I.annote("YeetAckEnvironmentOnlyResolution", {
    description: "Acknowledgment that the failure was environmental rather than a repository-code defect.",
  })
) {}

/**
 * The failure will not be fixed; the receipt carries the reason.
 *
 * **Example** (Build a wontfix resolution)
 *
 * ```ts
 * import { YeetAckWontfixResolution } from "@beep/repo-cli/test/Yeet"
 *
 * const resolution = YeetAckWontfixResolution.make({ reason: "flaky infra lane, rerun queued" })
 * console.log(resolution.kind) // "wontfix"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckWontfixResolution extends S.Class<YeetAckWontfixResolution>($I`YeetAckWontfixResolution`)(
  {
    kind: S.tag(YeetAckResolutionKind.Enum.wontfix),
    reason: S.NonEmptyString,
  },
  $I.annote("YeetAckWontfixResolution", {
    description: "Acknowledgment that the failure is deliberately not being fixed, with the reason.",
  })
) {}

/**
 * The failure moved to a review conversation; the receipt links the thread.
 *
 * **Example** (Build a thread resolution)
 *
 * ```ts
 * import { YeetAckThreadResolution } from "@beep/repo-cli/test/Yeet"
 *
 * const resolution = YeetAckThreadResolution.make({ url: "https://github.com/o/r/pull/1#discussion_r2" })
 * console.log(resolution.kind) // "thread-url"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckThreadResolution extends S.Class<YeetAckThreadResolution>($I`YeetAckThreadResolution`)(
  {
    kind: S.tag(YeetAckResolutionKind.Enum["thread-url"]),
    url: S.NonEmptyString,
  },
  $I.annote("YeetAckThreadResolution", {
    description: "Acknowledgment that the failure's follow-up lives in a linked review thread.",
  })
) {}

/**
 * A temporary, attributed waiver for one named shard.
 *
 * **Example** (Build a one-hour waiver)
 *
 * ```ts
 * import { YeetAckWaiveResolution } from "@beep/repo-cli/test/Yeet"
 *
 * const resolution = YeetAckWaiveResolution.make({
 *   actor: "operator", expiresAt: "2026-08-27T01:00:00Z",
 *   reason: "hosted dependency service is unavailable", shard: "Security"
 * })
 * console.log(resolution.kind) // "waive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckWaiveResolution extends S.Class<YeetAckWaiveResolution>($I`YeetAckWaiveResolution`)(
  {
    kind: S.tag(YeetAckResolutionKind.Enum.waive),
    actor: S.NonEmptyString,
    expiresAt: S.NonEmptyString,
    reason: S.NonEmptyString,
    shard: S.NonEmptyString,
  },
  $I.annote("YeetAckWaiveResolution", {
    description: "A temporary, attributed waiver for one named local or hosted shard.",
  })
) {}

/**
 * Acknowledge an informational row by observation: a proof-job result or a merge-ready announcement.
 *
 * **Details**
 *
 * `yeet inbox ack --observed` accepts only the kinds in `YeetInboxObservedRowKind`
 * (`proof-job-finished`, `pr-merge-ready`); every other row needs a fix SHA, a
 * reason, a thread URL, or a waiver.
 *
 * **Example** (Observe a job)
 * ```ts
 * import { YeetAckObservedResolution } from "@beep/repo-cli/test/Yeet"
 * console.log(YeetAckObservedResolution.make({ via: "job-wait" }).kind) // "observed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckObservedResolution extends S.Class<YeetAckObservedResolution>($I`YeetAckObservedResolution`)(
  { kind: S.tag("observed"), via: ProofJobObservedVia },
  $I.annote("YeetAckObservedResolution", {
    description: "Observation of an informational row: a proof-job result or a merge-ready announcement.",
  })
) {}

/**
 * The merge loop saw a conflicted head turn mergeable again, without a push.
 *
 * **Details**
 *
 * Only `yeet monitor --until-ready` writes it, for the `base-conflict` row of
 * the head it is watching, when that same head reads `mergeable: MERGEABLE`
 * with no conflict signal (for example, after the change that caused the
 * conflict was reverted on the base). A push never needs it: the new head
 * supersedes the row through the wave record. `headSha` and the raw merge
 * fields are the evidence. `jobId` and `unit` name the detached monitor job
 * that wrote the receipt, and both are absent when an attached monitor wrote
 * it.
 *
 * **Example** (Build a cleared resolution)
 *
 * ```ts
 * import { YeetAckClearedResolution } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const resolution = YeetAckClearedResolution.make({
 *   headSha: "abc123",
 *   mergeable: "MERGEABLE",
 *   mergeStateStatus: "CLEAN",
 *   jobId: O.none(),
 *   unit: O.none()
 * })
 * console.log(resolution.kind) // "cleared"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckClearedResolution extends S.Class<YeetAckClearedResolution>($I`YeetAckClearedResolution`)(
  {
    kind: S.tag(YeetAckResolutionKind.Enum.cleared),
    headSha: S.NonEmptyString,
    mergeable: S.NonEmptyString,
    mergeStateStatus: S.NullOr(S.String),
    jobId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    unit: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetAckClearedResolution", {
    description:
      "The merge loop saw a conflicted head turn mergeable again; carries the head, the merge fields, and the monitor job.",
  })
) {}

/**
 * What was done about an inbox row: four permanent closing moves, a temporary
 * waiver, an observation, or a monitor-written clear.
 *
 * **Details**
 *
 * The original SPEC A2 members remain unchanged — fix SHA, wontfix plus reason,
 * or thread URL — while `environment-only` adds a reasoned attribution without
 * changing the `yeet-ack/v1` wire shape. The observed member applies only to the informational
 * `proof-job-finished` and `pr-merge-ready` rows; gate rows still require a resolution or an
 * attributed waiver. The cleared member applies only to `base-conflict` rows and only the
 * merge loop writes it.
 *
 * **Example** (Decode an environment-only resolution)
 *
 * ```ts
 * import { YeetAckResolution } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const resolution = S.decodeUnknownSync(YeetAckResolution)({
 *   kind: "environment-only",
 *   reason: "the runner image does not provide systemd"
 * })
 * console.log(resolution.kind) // "environment-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetAckResolution = S.Union([
  YeetAckFixResolution,
  YeetAckEnvironmentOnlyResolution,
  YeetAckWontfixResolution,
  YeetAckThreadResolution,
  YeetAckWaiveResolution,
  YeetAckObservedResolution,
  YeetAckClearedResolution,
]).pipe(
  $I.annoteSchema("YeetAckResolution", {
    title: "Yeet Ack Resolution",
    description:
      "What was done about one inbox row: a fix, environment-only attribution, wontfix, review thread, expiring waiver, observation, or monitor clear.",
  })
);

/**
 * What was done about an inbox row: the ack protocol's four permanent closing moves or temporary waiver.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetAckResolution = typeof YeetAckResolution.Type;

/**
 * Render one resolution as its operator-facing phrase.
 *
 * **Example** (Render a fix)
 *
 * ```ts
 * import { renderYeetAckResolution, YeetAckFixResolution } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetAckResolution(YeetAckFixResolution.make({ sha: "2817f28" }))) // "fix-sha 2817f28"
 * ```
 *
 * @param resolution - The resolution to render.
 * @returns The one-phrase rendering used by list lines and ack confirmations.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetAckResolution = (resolution: YeetAckResolution): string =>
  Match.value(resolution).pipe(
    Match.discriminator("kind")("observed", (observed) => `observed via ${observed.via}`),
    Match.discriminator("kind")("environment-only", (environmentOnly) => `environment-only: ${environmentOnly.reason}`),
    Match.discriminator("kind")("fix-sha", (fix) => `fix-sha ${fix.sha}`),
    Match.discriminator("kind")("thread-url", (thread) => `thread ${thread.url}`),
    Match.discriminator("kind")(
      "waive",
      (waive) => `waive ${waive.shard} by ${waive.actor} until ${waive.expiresAt}: ${waive.reason}`
    ),
    Match.discriminator("kind")("wontfix", (wontfix) => `wontfix: ${wontfix.reason}`),
    Match.discriminator("kind")(
      "cleared",
      (cleared) =>
        `cleared at ${Str.slice(0, 7)(cleared.headSha)} (${cleared.mergeable}${O.match(
          O.fromNullOr(cleared.mergeStateStatus),
          { onNone: () => Str.empty, onSome: (status) => `/${status}` }
        )}) by ${O.match(cleared.jobId, {
          onNone: () => "an attached monitor",
          onSome: (jobId) => `monitor job ${jobId}`,
        })}`
    ),
    Match.exhaustive
  );

/**
 * One ack receipt: the row it closes, what was done, and when.
 *
 * **Example** (Build a receipt)
 *
 * ```ts
 * import { YeetAckFixResolution, YeetAckReceipt } from "@beep/repo-cli/test/Yeet"
 *
 * const receipt = YeetAckReceipt.make({
 *   ackedAt: "2026-08-17T00:00:00Z",
 *   id: "coverage-abc123def456",
 *   resolution: YeetAckFixResolution.make({ sha: "2817f286d3" })
 * })
 *
 * console.log(receipt.schemaVersion) // "yeet-ack/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckReceipt extends S.Class<YeetAckReceipt>($I`YeetAckReceipt`)(
  {
    schemaVersion: S.Literal(YEET_ACK_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_ACK_SCHEMA_VERSION))
    ),
    id: S.NonEmptyString,
    resolution: YeetAckResolution,
    ackedAt: S.String,
  },
  $I.annote("YeetAckReceipt", {
    description: "One ack receipt: the inbox row id it closes, the resolution, and the acknowledgment time.",
  })
) {}

/**
 * JSON string codec for one ack receipt.
 *
 * **Example** (Reject garbage)
 *
 * ```ts
 * import { YeetAckReceiptJson } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(YeetAckReceiptJson.decodeOption("not json"))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const YeetAckReceiptJson = JsonStringCodec(YeetAckReceipt);

/**
 * The typed ack state of one inbox row.
 *
 * **Details**
 *
 * `acked` reports whether the receipt file exists — the enforcement question —
 * while `receipt` carries its decoded content when readable — the audit
 * question. The two are separate fields because they fail separately: a
 * corrupt receipt file still acks its row, it just cannot say what was done.
 *
 * **Example** (An unacked state)
 *
 * ```ts
 * import { YeetAckState } from "@beep/repo-cli/test/Yeet"
 *
 * const state = YeetAckState.make({ acked: false, receipt: null })
 * console.log(state.acked) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAckState extends S.Class<YeetAckState>($I`YeetAckState`)(
  {
    acked: S.Boolean,
    receipt: S.NullOr(YeetAckReceipt),
  },
  $I.annote("YeetAckState", {
    description: "Whether one inbox row's receipt file exists, and its decoded content when readable.",
  })
) {}

/**
 * Read the ack state of one inbox row.
 *
 * **Details**
 *
 * Every failure mode folds into the state rather than the error channel: a
 * missing file or a rejected symlink path is `acked: false`, while an
 * unreadable or undecodable regular entry is `acked: true, receipt: null`.
 * Consumers on the hook hot path get one total read with no failure cases to
 * mishandle into a stuck denial.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readYeetAckState } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readYeetAckState("/repo", "coverage-abc"))) // true
 * ```
 *
 * @param repoRoot - The checkout the inbox belongs to.
 * @param id - The inbox row id whose receipt is read.
 * @returns The row's ack state; never fails.
 * @category services
 * @since 0.0.0
 */
export const readYeetAckState = Effect.fn("Yeet.readYeetAckState")(function* (
  repoRoot: string,
  id: string
): Effect.fn.Return<YeetAckState, never, FileSystem.FileSystem | Path.Path> {
  const ackPath = yield* yeetInboxAckPath(repoRoot, id);
  const guardedRead = yield* Effect.option(readContainedFileStringNoFollow(repoRoot, ackPath));
  if (O.isNone(guardedRead) || !guardedRead.value.exists) {
    return YeetAckState.make({ acked: false, receipt: null });
  }
  const receipt = O.flatMap(guardedRead.value.contents, YeetAckReceiptJson.decodeOption);
  if (O.isSome(receipt) && receipt.value.resolution.kind === "waive") {
    const expiresAt = DateTime.make(receipt.value.resolution.expiresAt);
    const now = yield* DateTime.now;
    if (O.isNone(expiresAt) || DateTime.toEpochMillis(expiresAt.value) <= DateTime.toEpochMillis(now)) {
      return YeetAckState.make({ acked: false, receipt: receipt.value });
    }
  }
  return YeetAckState.make({ acked: true, receipt: O.getOrNull(receipt) });
});

/**
 * Write one ack receipt, overwriting any prior receipt for the row.
 *
 * **Details**
 *
 * Creates the acks directory on first use. Overwriting is the contract, not a
 * hazard: receipts are keyed by deterministic row id, so "again" always means
 * "the same failure, re-resolved", and the last resolution is the one that
 * should stand. Callers that want to report a replacement read the state
 * first via {@link readYeetAckState}.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { writeYeetAckReceipt, YeetAckFixResolution, YeetAckReceipt } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const receipt = YeetAckReceipt.make({
 *   ackedAt: "2026-08-17T00:00:00Z",
 *   id: "coverage-abc",
 *   resolution: YeetAckFixResolution.make({ sha: "2817f28" })
 * })
 *
 * console.log(Effect.isEffect(writeYeetAckReceipt("/repo", receipt))) // true
 * ```
 *
 * @param repoRoot - The checkout the inbox belongs to.
 * @param receipt - The receipt to persist under `acks/<receipt.id>`.
 * @returns The path the receipt was written to.
 * @category services
 * @since 0.0.0
 */
export const writeYeetAckReceipt = Effect.fn("Yeet.writeYeetAckReceipt")(function* (
  repoRoot: string,
  receipt: YeetAckReceipt
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const ackPath = yield* yeetInboxAckPath(repoRoot, receipt.id);
  const json = yield* YeetAckReceiptJson.encode(receipt).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode an ack receipt."))
  );
  yield* writeContainedFileString(repoRoot, ackPath, `${json}\n`).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to write the ack receipt "${ackPath}".`))
  );
  return ackPath;
});
