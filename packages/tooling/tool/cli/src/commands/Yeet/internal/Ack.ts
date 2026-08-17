/**
 * Ack receipts: the work-log side of the checkout failure inbox.
 *
 * **Details**
 *
 * An inbox row keeps re-presenting until a receipt file exists at
 * `<checkout>/.beep/inbox/acks/<id>` — the ship-velocity A2 contract that the
 * harness adapters (Claude deny, Codex inject, Grok tail) all enforce from.
 * The receipt is not a bare tombstone: it records what was actually done about
 * the failure — the SHA of the fix commit, a wontfix decision with its reason,
 * or the review-thread URL where the discussion continues — so `yeet monitor`
 * and the operator can audit an acknowledgment instead of trusting it.
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
import { thunkFalse } from "@beep/utils";
import { Effect, FileSystem, Match } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { yeetInboxAckPath, yeetInboxPaths } from "./Inbox.ts";
import type { Path } from "effect";

const $I = $RepoCliId.create("commands/Yeet/internal/Ack");

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
    kind: S.tag("fix-sha"),
    sha: S.NonEmptyString,
  },
  $I.annote("YeetAckFixResolution", {
    description: "Acknowledgment that the failure was fixed, naming the fix commit.",
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
    kind: S.tag("wontfix"),
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
    kind: S.tag("thread-url"),
    url: S.NonEmptyString,
  },
  $I.annote("YeetAckThreadResolution", {
    description: "Acknowledgment that the failure's follow-up lives in a linked review thread.",
  })
) {}

/**
 * What was done about an inbox row: the ack protocol's three closing moves.
 *
 * **Details**
 *
 * The members mirror the SPEC A2 receipt contract verbatim — fix SHA, wontfix
 * plus reason, or thread URL. There is deliberately no bare "seen" member: a
 * receipt with no work log would turn the ack protocol into a dismissal
 * button, and dismissals are A3's *waive* concept with attribution and expiry,
 * not an acknowledgment.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetAckResolution = S.Union([
  YeetAckFixResolution,
  YeetAckWontfixResolution,
  YeetAckThreadResolution,
]).pipe(
  $I.annoteSchema("YeetAckResolution", {
    title: "Yeet Ack Resolution",
    description: "What was done about one inbox row: a fix commit, a reasoned wontfix, or a review thread.",
  })
);

/**
 * What was done about an inbox row: the ack protocol's three closing moves.
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
    Match.discriminatorsExhaustive("kind")({
      "fix-sha": (fix) => `fix-sha ${fix.sha}`,
      "thread-url": (thread) => `thread ${thread.url}`,
      wontfix: (wontfix) => `wontfix: ${wontfix.reason}`,
    })
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
 * missing file is `acked: false`, an unreadable or undecodable file is
 * `acked: true, receipt: null`. Consumers on the hook hot path get one total
 * read with no failure cases to mishandle into a stuck denial.
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
  const fs = yield* FileSystem.FileSystem;
  const ackPath = yield* yeetInboxAckPath(repoRoot, id);
  // Existence and readability are decided separately: a receipt that exists
  // but cannot be read (permissions, a directory squatting on the path, EIO)
  // still acks its row — folding those read failures into "unacked" would
  // re-arm enforcement over a bookkeeping defect.
  const acked = yield* fs.exists(ackPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!acked) {
    return YeetAckState.make({ acked: false, receipt: null });
  }
  const text = yield* Effect.option(fs.readFileString(ackPath));
  return YeetAckState.make({
    acked: true,
    receipt: O.getOrNull(O.flatMap(text, YeetAckReceiptJson.decodeOption)),
  });
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
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(repoRoot);
  const ackPath = yield* yeetInboxAckPath(repoRoot, receipt.id);
  const json = yield* YeetAckReceiptJson.encode(receipt).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode an ack receipt."))
  );
  yield* fs
    .makeDirectory(paths.acksDir, { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create the acks directory "${paths.acksDir}".`)));
  yield* fs
    .writeFileString(ackPath, `${json}\n`)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to write the ack receipt "${ackPath}".`)));
  return ackPath;
});
