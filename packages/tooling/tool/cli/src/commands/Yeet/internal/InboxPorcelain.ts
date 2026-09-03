/**
 * Command-layer engines and runners for the `yeet inbox` porcelain:
 * `yeet inbox list`, `yeet inbox ack`, and `yeet inbox append`.
 *
 * **Details**
 *
 * The engines — {@link ackYeetInboxRow}, {@link appendYeetInboxRowFromText},
 * {@link filterYeetInboxEntries} — take a repo root or plain data and know
 * nothing about flags, so tests drive them against temp checkouts directly.
 * The runners at the bottom are the flag seam `Yeet.command.ts` wires: they
 * resolve the repo root, delegate, and render, keeping the CLI surface a
 * declaration rather than a place behavior accumulates.
 *
 * **Gotchas**
 *
 * `append` guards row-id integrity: a row whose `id` does not equal the
 * deterministic id derived from its capsule is refused, because a
 * wrongly-minted id would fork the failure's identity away from its ack
 * receipt and its dedup history. External writers should not be trusted to
 * get this right silently.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { Console, DateTime, Effect, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readStdinDocument } from "../../../internal/cli/Stdin.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import {
  renderYeetAckResolution,
  writeYeetAckReceipt,
  YeetAckEnvironmentOnlyResolution,
  YeetAckFixResolution,
  YeetAckReceipt,
  YeetAckThreadResolution,
  YeetAckWaiveResolution,
  YeetAckWontfixResolution,
} from "./Ack.ts";
import { appendYeetInboxRow, describeYeetInboxRow, YeetInboxRowJson, yeetInboxExpectedRowId } from "./Inbox.ts";
import { loadYeetInboxView, YeetInboxView, YeetInboxViewJson } from "./InboxView.ts";
import type { FileSystem, Path } from "effect";
import type { YeetAckResolution, YeetAckState } from "./Ack.ts";
import type { YeetInboxRow, YeetInboxSeverity } from "./Inbox.ts";
import type { YeetInboxEntry } from "./InboxView.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/InboxPorcelain");

const isoNow = DateTime.now.pipe(Effect.map(DateTime.formatIso));

const locateRepoRoot = (): Effect.Effect<string, YeetCommandError, FileSystem.FileSystem> =>
  findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repo root.")));

/**
 * The parsed severity selection of `yeet inbox list`: a tier, or every tier.
 */
type YeetInboxSeverityFilter = "all" | YeetInboxSeverity;

/**
 * The list filter: which entries `yeet inbox list` shows.
 */
interface YeetInboxListFilter {
  readonly severity: YeetInboxSeverityFilter;
  readonly unacked: boolean;
}

/**
 * Parsed `yeet inbox list` flag values.
 */
interface YeetInboxListOptions extends YeetInboxListFilter {
  readonly json: boolean;
}

/**
 * The resolution-shaped subset of `yeet inbox ack` flags, before validation
 * proves exactly one resolution was requested.
 */
interface YeetAckResolutionFlags {
  readonly actor: string;
  readonly environmentOnly: boolean;
  readonly expiresAt: string;
  readonly fixSha: string;
  readonly reason: string;
  readonly shard: string;
  readonly threadUrl: string;
  readonly waive: boolean;
  readonly wontfix: boolean;
}

/**
 * Parsed `yeet inbox ack` flag values.
 */
interface YeetInboxAckOptions extends YeetAckResolutionFlags {
  readonly id: string;
}

/**
 * Parsed `yeet inbox append` flag values.
 */
interface YeetInboxAppendOptions {
  readonly fromStdin: boolean;
}

/**
 * Keep the entries a list filter selects.
 *
 * **Example** (An empty inbox stays empty)
 *
 * ```ts
 * import { filterYeetInboxEntries } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(filterYeetInboxEntries([], { severity: "all", unacked: false })) // []
 * ```
 *
 * @param entries - The joined inbox entries.
 * @param filter - Severity tier to keep (or every tier) and whether to keep only unacked rows.
 * @returns The entries the filter selects, in their original order.
 * @category utilities
 * @since 0.0.0
 */
export const filterYeetInboxEntries: {
  (filter: YeetInboxListFilter): (entries: ReadonlyArray<YeetInboxEntry>) => ReadonlyArray<YeetInboxEntry>;
  (entries: ReadonlyArray<YeetInboxEntry>, filter: YeetInboxListFilter): ReadonlyArray<YeetInboxEntry>;
} = dual(
  2,
  (entries: ReadonlyArray<YeetInboxEntry>, filter: YeetInboxListFilter): ReadonlyArray<YeetInboxEntry> =>
    A.filter(
      entries,
      (entry) =>
        (filter.severity === "all" || entry.row.severity === filter.severity) && (!filter.unacked || !entry.ack.acked)
    )
);

const renderAckPhrase = (ack: YeetAckState): string =>
  ack.acked
    ? O.match(O.fromNullOr(ack.receipt), {
        onNone: () => "acked (unreadable receipt)",
        onSome: (receipt) => `acked ${renderYeetAckResolution(receipt.resolution)}`,
      })
    : "unacked";

/**
 * Render one joined inbox entry as its list line.
 *
 * **Example** (Render an unacked entry)
 *
 * ```ts
 * import {
 *   renderYeetInboxEntryLine,
 *   YeetAckState,
 *   YeetCheckFailedRow,
 *   YeetFailureCapsule,
 *   YeetInboxEntry,
 *   yeetInboxRowId
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail",
 *   headSha: "abc123def456",
 *   lane: "Check / Coverage",
 *   link: null,
 *   observedAt: "2026-08-17T00:00:00Z",
 *   prNumber: 754,
 *   state: "FAILURE",
 *   workflow: null
 * })
 * const entry = YeetInboxEntry.make({
 *   ack: YeetAckState.make({ acked: false, receipt: null }),
 *   liveness: "live",
 *   row: YeetCheckFailedRow.make({
 *     capsule,
 *     checkout: "/repo",
 *     id: yeetInboxRowId(capsule),
 *     severity: "P0",
 *     ts: "2026-08-17T00:00:00Z"
 *   })
 * })
 *
 * console.log(renderYeetInboxEntryLine(entry).includes("P0 live unacked")) // true
 * ```
 *
 * @param entry - The entry to render.
 * @returns One indented list line: severity, liveness, ack phrase, lane, id, and PR coordinates.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetInboxEntryLine = (entry: YeetInboxEntry): string =>
  `  ${entry.row.severity} ${entry.liveness} ${renderAckPhrase(entry.ack)} — ${describeYeetInboxRow(entry.row)} [${entry.row.id}]`;

/**
 * Render one inbox view as the operator listing.
 *
 * **Example** (Render an empty view)
 *
 * ```ts
 * import { renderYeetInboxView, YeetInboxView } from "@beep/repo-cli/test/Yeet"
 *
 * const view = YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: false })
 * console.log(renderYeetInboxView(view)) // "[yeet] inbox: 0 row(s), 0 unacked, 0 skipped line(s)"
 * ```
 *
 * @param view - The view to render, already filtered to what should be shown.
 * @returns The header line plus one line per entry.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetInboxView = (view: YeetInboxView): string => {
  const unacked = A.length(A.filter(view.entries, (entry) => !entry.ack.acked));
  const suffix = view.unreadable ? " — failures file exists but is unreadable; inbox state unknown, not empty" : "";
  const header = `[yeet] inbox: ${A.length(view.entries)} row(s), ${unacked} unacked, ${view.skippedLines} skipped line(s)${suffix}`;
  return A.join([header, ...A.map(view.entries, renderYeetInboxEntryLine)], "\n");
};

/**
 * Prove that the ack flags request exactly one resolution, and build it.
 *
 * **Details**
 *
 * The permanent resolution flags are mutually exclusive because a receipt
 * records one closing move — fix SHA, environment-only plus reason, wontfix
 * plus reason, or thread URL.
 * `--environment-only` or `--wontfix` without `--reason` is refused rather
 * than defaulted: an unexplained attribution is exactly the dismissal-button
 * failure mode the resolution union exists to prevent.
 *
 * **Example** (A fix SHA parses)
 *
 * ```ts
 * import { parseYeetAckResolution } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const resolution = Effect.runSync(
 *   parseYeetAckResolution({
 *     actor: "", environmentOnly: false, expiresAt: "", fixSha: "2817f28",
 *     reason: "", shard: "", threadUrl: "", waive: false, wontfix: false
 *   })
 * )
 * console.log(resolution.kind) // "fix-sha"
 * ```
 *
 * @param flags - The resolution-shaped `yeet inbox ack` flag values.
 * @returns The single requested resolution, or a typed refusal naming the rule broken.
 * @category utilities
 * @since 0.0.0
 */
export const parseYeetAckResolution = Effect.fn("Yeet.parseYeetAckResolution")(function* (
  flags: YeetAckResolutionFlags
): Effect.fn.Return<YeetAckResolution, YeetCommandError> {
  const reasonRule = yeetAckReasonRuleViolation(flags);
  if (O.isSome(reasonRule)) {
    return yield* YeetCommandError.make({ message: reasonRule.value });
  }
  if (flags.waive) {
    const expiresAt = DateTime.make(flags.expiresAt);
    if (O.isNone(expiresAt)) {
      return yield* YeetCommandError.make({
        message: "yeet inbox ack --waive requires a valid --expires-at timestamp.",
      });
    }
    const now = yield* DateTime.now;
    if (DateTime.toEpochMillis(expiresAt.value) <= DateTime.toEpochMillis(now)) {
      return yield* YeetCommandError.make({
        message: "yeet inbox ack --waive requires a future --expires-at timestamp.",
      });
    }
  }
  const candidates = yeetAckResolutionCandidates(flags);
  if (!A.isReadonlyArrayNonEmpty(candidates) || A.length(candidates) !== 1) {
    return yield* YeetCommandError.make({
      message:
        "yeet inbox ack requires exactly one of --fix-sha <sha>, --environment-only --reason <text>, --wontfix --reason <text>, --thread-url <url>, or --waive with attribution and expiry.",
    });
  }
  return A.headNonEmpty(candidates);
});

const yeetAckReasonFlagViolation = (flags: YeetAckResolutionFlags): O.Option<string> => {
  if ((flags.environmentOnly || flags.wontfix || flags.waive) && Str.isEmpty(flags.reason)) {
    return O.some("yeet inbox ack --environment-only/--wontfix/--waive requires --reason.");
  }
  if (!flags.environmentOnly && !flags.wontfix && !flags.waive && Str.isNonEmpty(flags.reason)) {
    return O.some("yeet inbox ack --reason only applies with --environment-only, --wontfix, or --waive.");
  }
  return O.none();
};

const yeetAckWaiverAttributionViolation = (flags: YeetAckResolutionFlags): O.Option<string> => {
  const attribution = [flags.actor, flags.expiresAt, flags.shard];
  if (flags.waive && A.some(attribution, Str.isEmpty)) {
    return O.some("yeet inbox ack --waive requires --actor, --expires-at, and --shard.");
  }
  if (!flags.waive && A.some(attribution, Str.isNonEmpty)) {
    return O.some("yeet inbox ack --actor, --expires-at, and --shard only apply with --waive.");
  }
  return O.none();
};

const yeetAckReasonRuleViolation = (flags: YeetAckResolutionFlags): O.Option<string> =>
  pipe(
    yeetAckReasonFlagViolation(flags),
    O.orElse(() => yeetAckWaiverAttributionViolation(flags))
  );

// Callers run the reason rule first, so a wontfix candidate never sees an
// empty reason here.
const yeetAckResolutionCandidates = (flags: YeetAckResolutionFlags): ReadonlyArray<YeetAckResolution> =>
  A.getSomes([
    Str.isNonEmpty(flags.fixSha) ? O.some(YeetAckFixResolution.make({ sha: flags.fixSha })) : O.none(),
    flags.environmentOnly ? O.some(YeetAckEnvironmentOnlyResolution.make({ reason: flags.reason })) : O.none(),
    flags.wontfix ? O.some(YeetAckWontfixResolution.make({ reason: flags.reason })) : O.none(),
    Str.isNonEmpty(flags.threadUrl) ? O.some(YeetAckThreadResolution.make({ url: flags.threadUrl })) : O.none(),
    flags.waive
      ? O.some(
          YeetAckWaiveResolution.make({
            actor: flags.actor,
            expiresAt: flags.expiresAt,
            reason: flags.reason,
            shard: flags.shard,
          })
        )
      : O.none(),
  ]);

/**
 * What one ack pass did: the receipt, where it lives, and whether it replaced
 * a prior one.
 *
 * **Example** (Build a report)
 *
 * ```ts
 * import { YeetAckFixResolution, YeetAckReceipt, YeetInboxAckReport } from "@beep/repo-cli/test/Yeet"
 *
 * const report = YeetInboxAckReport.make({
 *   receipt: YeetAckReceipt.make({
 *     ackedAt: "2026-08-17T00:00:00Z",
 *     id: "coverage-abc",
 *     resolution: YeetAckFixResolution.make({ sha: "2817f28" })
 *   }),
 *   receiptPath: "/repo/.beep/inbox/acks/coverage-abc",
 *   replacedPrior: false
 * })
 *
 * console.log(report.replacedPrior) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetInboxAckReport extends S.Class<YeetInboxAckReport>($I`YeetInboxAckReport`)(
  {
    receipt: YeetAckReceipt,
    receiptPath: S.NonEmptyString,
    replacedPrior: S.Boolean,
  },
  $I.annote("YeetInboxAckReport", {
    description: "The written receipt, its path, and whether a prior receipt for the row was replaced.",
  })
) {}

/**
 * Acknowledge one inbox row with a resolution.
 *
 * **Details**
 *
 * The id must name a row the inbox actually contains — a receipt for a
 * mistyped id would ack nothing while looking like progress. Re-acking an
 * already-acked row is allowed and reported: overwriting is how a wrong
 * receipt gets corrected, and the fix path must never dead-end.
 *
 * **Example** (Build the ack effect)
 *
 * ```ts
 * import { ackYeetInboxRow, YeetAckFixResolution } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const resolution = YeetAckFixResolution.make({ sha: "2817f28" })
 * console.log(Effect.isEffect(ackYeetInboxRow("/repo", "coverage-abc", resolution, "2026-08-17T00:00:00Z"))) // true
 * ```
 *
 * @param repoRoot - The checkout the inbox belongs to.
 * @param id - The inbox row id to acknowledge.
 * @param resolution - What was done about the failure.
 * @param ackedAt - The acknowledgment timestamp stamped on the receipt.
 * @returns The written receipt and whether it replaced a prior one.
 * @category services
 * @since 0.0.0
 */
export const ackYeetInboxRow = Effect.fn("Yeet.ackYeetInboxRow")(function* (
  repoRoot: string,
  id: string,
  resolution: YeetAckResolution,
  ackedAt: string
): Effect.fn.Return<YeetInboxAckReport, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const view = yield* loadYeetInboxView(repoRoot);
  const entry = A.findFirst(view.entries, (candidate) => candidate.row.id === id);
  if (O.isNone(entry)) {
    return yield* YeetCommandError.make({
      message: `No inbox row with id "${id}". Run "bun run beep yeet inbox list" to see the known rows.`,
    });
  }
  const receipt = YeetAckReceipt.make({ ackedAt, id, resolution });
  const receiptPath = yield* writeYeetAckReceipt(repoRoot, receipt);
  return YeetInboxAckReport.make({ receipt, receiptPath, replacedPrior: entry.value.ack.acked });
});

/**
 * Decode, id-check, and append one inbox row from its NDJSON text.
 *
 * **Details**
 *
 * This is the shared-writer seam behind `yeet inbox append`: external writers
 * (local lane runners, sibling-checkout collision detectors) hand a full row
 * document to the CLI instead of reimplementing the append contract. The row
 * must already carry the deterministic id its capsule derives — a mismatch is
 * refused, because the id is the join key for dedup and ack receipts.
 *
 * **Example** (Build the append effect)
 *
 * ```ts
 * import { appendYeetInboxRowFromText } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(appendYeetInboxRowFromText("/repo", "{}"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox receives the row.
 * @param text - The row as a JSON document.
 * @returns The decoded row after it was appended.
 * @category services
 * @since 0.0.0
 */
export const appendYeetInboxRowFromText = Effect.fn("Yeet.appendYeetInboxRowFromText")(function* (
  repoRoot: string,
  text: string
): Effect.fn.Return<YeetInboxRow, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const row = yield* YeetInboxRowJson.decode(Str.trim(text)).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode the inbox row document."))
  );
  const expected = yeetInboxExpectedRowId(row);
  if (row.id !== expected) {
    return yield* YeetCommandError.make({
      message: `Inbox row id "${row.id}" does not match the deterministic id "${expected}" for ${describeYeetInboxRow(row)}. Row ids are the dedup and ack join key; derive them with the row variant's id helper.`,
    });
  }
  yield* appendYeetInboxRow(repoRoot, row);
  return row;
});

const readYeetInboxStdin = (fromStdin: boolean): Effect.Effect<string, YeetCommandError> =>
  readStdinDocument(fromStdin, {
    missingFlag: "yeet inbox append requires --from-stdin.",
    noStdin: "yeet inbox append --from-stdin received no stdin.",
    readFailurePrefix: "Failed to read the inbox row from stdin",
  }).pipe(Effect.mapError((error) => YeetCommandError.make({ message: error.message })));

/**
 * Filter one loaded view and produce the exact text `yeet inbox list` prints.
 *
 * **Details**
 *
 * This is the whole list pass minus IO: apply the filter, rebuild the view so
 * the JSON document carries only the shown entries, then either encode it or
 * render the operator text. Extracted so the composition — including the
 * `--json` path — is provable without a real checkout.
 *
 * **Example** (An empty view renders its header)
 *
 * ```ts
 * import { renderYeetInboxListOutput, YeetInboxView } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const view = YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: false })
 * const output = renderYeetInboxListOutput(view, { json: false, severity: "all", unacked: false })
 * console.log(Effect.runSync(output)) // "[yeet] inbox: 0 row(s), 0 unacked, 0 skipped line(s)"
 * ```
 *
 * @param view - The loaded inbox view before filtering.
 * @param options - Parsed `yeet inbox list` flag values.
 * @returns The JSON document or operator text the list pass prints.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetInboxListOutput = Effect.fn("Yeet.renderYeetInboxListOutput")(function* (
  view: YeetInboxView,
  options: YeetInboxListOptions
): Effect.fn.Return<string, YeetCommandError> {
  const filtered = YeetInboxView.make({
    entries: filterYeetInboxEntries(view.entries, options),
    skippedLines: view.skippedLines,
    unreadable: view.unreadable,
  });
  if (options.json) {
    return yield* YeetInboxViewJson.encode(filtered).pipe(
      Effect.mapError(YeetCommandError.new("Failed to encode the inbox view."))
    );
  }
  return renderYeetInboxView(filtered);
});

/**
 * Run one `yeet inbox list` pass: load, filter, render or encode.
 *
 * **Example** (Build the list runner effect)
 *
 * ```ts
 * import { runYeetInboxList } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = runYeetInboxList({ json: false, severity: "all", unacked: false })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Parsed `yeet inbox list` flag values.
 * @returns Void once the filtered view was printed.
 * @category commands
 * @since 0.0.0
 */
export const runYeetInboxList = Effect.fn("Yeet.runInboxListCommand")(function* (
  options: YeetInboxListOptions
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const repoRoot = yield* locateRepoRoot();
  const view = yield* loadYeetInboxView(repoRoot);
  yield* Console.log(yield* renderYeetInboxListOutput(view, options));
});

/**
 * Run one `yeet inbox ack` pass: parse the resolution, write the receipt.
 *
 * **Example** (Build the ack runner effect)
 *
 * ```ts
 * import { runYeetInboxAck } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = runYeetInboxAck({
 *   actor: "", expiresAt: "", fixSha: "2817f28", id: "coverage-abc", reason: "", shard: "",
 *   threadUrl: "", waive: false, wontfix: false
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Parsed `yeet inbox ack` flag values.
 * @returns Void once the receipt was written and reported.
 * @category commands
 * @since 0.0.0
 */
export const runYeetInboxAck = Effect.fn("Yeet.runInboxAckCommand")(function* (
  options: YeetInboxAckOptions
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const resolution = yield* parseYeetAckResolution(options);
  const repoRoot = yield* locateRepoRoot();
  const ackedAt = yield* isoNow;
  const report = yield* ackYeetInboxRow(repoRoot, options.id, resolution, ackedAt);
  yield* Console.log(`[yeet] acked ${options.id} (${renderYeetAckResolution(resolution)}) -> ${report.receiptPath}`);
  if (report.replacedPrior) {
    yield* Console.log("[yeet] replaced an existing receipt; the last resolution stands.");
  }
});

/**
 * Run one `yeet inbox append` pass: read stdin, decode, id-check, append.
 *
 * **Example** (Build the append runner effect)
 *
 * ```ts
 * import { runYeetInboxAppend } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = runYeetInboxAppend({ fromStdin: false })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Parsed `yeet inbox append` flag values.
 * @returns Void once the row was appended and reported.
 * @category commands
 * @since 0.0.0
 */
export const runYeetInboxAppend = Effect.fn("Yeet.runInboxAppendCommand")(function* (
  options: YeetInboxAppendOptions
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const text = yield* readYeetInboxStdin(options.fromStdin);
  const repoRoot = yield* locateRepoRoot();
  const row = yield* appendYeetInboxRowFromText(repoRoot, text);
  yield* Console.log(`[yeet] appended ${row.id} (${row.severity} ${describeYeetInboxRow(row)})`);
});
