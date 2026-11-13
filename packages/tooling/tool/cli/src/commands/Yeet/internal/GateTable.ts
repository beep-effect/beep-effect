/**
 * The orchestrator's gate table: one row per open pull request saying how far
 * it is from the merge gate, the CLI port of the `gate.sh` script.
 *
 * **Details**
 *
 * The table is a poll, not a merge: a `GATE-MET` row is a candidate that
 * `yeet merge-gate <pr> <sha>` re-verifies before it merges anything. Each row
 * is a pure decision ({@link decideGateTableRow}) over one read
 * ({@link GateTableRead}), so recorded payloads prove every column.
 *
 * Reads are REST first (operator ruling 2026-10-06): every page of open pull
 * requests, each base branch's ruleset once, then per pull request its detail
 * (`mergeable_state`), check runs, combined commit statuses and the review
 * window through the reader `yeet ready` and the merge gate share. Review
 * threads are read over GraphQL only for pull requests out of draft, with the
 * same outstanding rule the merge gate applies, every page of threads.
 *
 * Every unknown fails closed: an unreadable ruleset prints `ok=?/?`, an
 * unreadable thread list `threads=?`, an unknown window `window=?`, unreadable
 * statuses `PENDING:statuses=?`, and none of them is ever `GATE-MET`. A pull
 * request whose own reads fail is reported as unreadable and the rest of the
 * table is still printed.
 *
 * **Gotchas**
 *
 * Unlike `gate.sh`, a pending commit status (the legacy statuses API that
 * deploy previews report through) holds `GATE-MET`: a candidate is offered
 * only once nothing on the head is still reporting. A failing commit status is
 * printed in its own `STATUS-RED:` column and does not hold, because
 * `yeet merge-gate` reads check runs only and the table must not be stricter
 * than the gate it previews; on 2026-11-06 every open pull request carried
 * failing Vercel previews, the AGENTS.md "rate limited" exception being the
 * orchestrator's judgment call after reading the deployment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { outstanding, ReviewThread } from "@beep/github/ReviewThread";
import { $RepoCliId } from "@beep/identity/packages";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubCommitStatusRecord, GithubRest } from "../../../internal/github/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { provideYeetGhLogin, yeetGithubFailure } from "./GhOps.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import { provideYeetHeadMoveClassifier } from "./HeadMove.ts";
import { MergeGateCheckRun } from "./MergeGate.schemas.ts";
import { MERGE_GATE_OWNER_HOLD_LABEL, mergeGateGoodConclusion, mergeGateLatestRunPerName } from "./MergeGate.ts";
import { readYeetReviewWindow, YeetReviewWindow } from "./ReviewWindow.ts";
import { yeetStackRulesBranch } from "./Stack.ts";
import type { Git } from "@beep/git/Git";
import type { Repo } from "@beep/github/Repo";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubPullRequestRecord } from "../../../internal/github/index.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/GateTable");

/**
 * Review threads counted on a pull request out of draft.
 *
 * **Example** (No outstanding thread)
 *
 * ```ts
 * import { GateTableThreadsCounted } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GateTableThreadsCounted.make({ outstanding: 0, total: 3 }).total) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateTableThreadsCounted extends S.Opaque<GateTableThreadsCounted, { readonly brand: unique symbol }>()(
  S.TaggedStruct("counted", { outstanding: S.Finite, total: S.Finite }).pipe(
    $I.annoteSchema("GateTableThreadsCounted", {
      description: "Outstanding and total review threads, read on every page.",
    })
  )
) {}

/**
 * Review threads that could not be read; never counted as zero.
 *
 * **Example** (A refused GraphQL read)
 *
 * ```ts
 * import { GateTableThreadsUnknown } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GateTableThreadsUnknown.make({ reason: "rate limited" })._tag) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateTableThreadsUnknown extends S.Opaque<GateTableThreadsUnknown, { readonly brand: unique symbol }>()(
  S.TaggedStruct("unknown", { reason: S.NonEmptyString }).pipe(
    $I.annoteSchema("GateTableThreadsUnknown", {
      description: "The thread read failed; a missing count is never zero.",
    })
  )
) {}

/**
 * Review threads deliberately not read: the pull request is a draft, which
 * the gate never meets, so it spends no GraphQL.
 *
 * **Example** (A draft)
 *
 * ```ts
 * import { GateTableThreadsNotRead } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GateTableThreadsNotRead.make({})._tag) // "not-read"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateTableThreadsNotRead extends S.Opaque<GateTableThreadsNotRead, { readonly brand: unique symbol }>()(
  S.TaggedStruct("not-read", {}).pipe(
    $I.annoteSchema("GateTableThreadsNotRead", { description: "Threads not read because the pull request is a draft." })
  )
) {}

/**
 * The review-thread column of one gate table row.
 *
 * **Example** (Match a column)
 *
 * ```ts
 * import { GateTableThreads, GateTableThreadsCounted } from "@beep/repo-cli/test/Yeet"
 *
 * const cell = GateTableThreads.match(GateTableThreadsCounted.make({ outstanding: 1, total: 2 }), {
 *   counted: ({ outstanding, total }) => `${outstanding}/${total}`,
 *   unknown: () => "?",
 *   "not-read": () => "-",
 * })
 * console.log(cell) // "1/2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GateTableThreads = S.Union([
  GateTableThreadsCounted,
  GateTableThreadsUnknown,
  GateTableThreadsNotRead,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("GateTableThreads", { description: "Counted, unknown, or not-read review threads." })
);

/**
 * The review-thread column of one gate table row.
 *
 * @category models
 * @since 0.0.0
 */
export type GateTableThreads = typeof GateTableThreads.Type;

/**
 * Everything one gate table row is decided from.
 *
 * **Details**
 *
 * `requiredContexts` is `None` when the base branch's ruleset was unreadable
 * or declares no required check; `statuses` is `None` when the combined
 * status read failed; `window` is `None` for a draft, whose window starts at
 * the flip.
 *
 * **Example** (A draft read)
 *
 * ```ts
 * import { GateTableRead, GateTableThreadsNotRead } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const read = GateTableRead.make({
 *   prNumber: 7,
 *   draft: true,
 *   baseRef: "main",
 *   headRef: "feat/x",
 *   headSha: "abcdef1234567890",
 *   mergeableState: "clean",
 *   labels: [],
 *   requiredContexts: O.some(["Lint"]),
 *   checkRuns: [],
 *   statuses: O.some([]),
 *   window: O.none(),
 *   threads: GateTableThreadsNotRead.make({}),
 * })
 * console.log(read.draft) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateTableRead extends S.Opaque<GateTableRead, { readonly brand: unique symbol }>()(
  S.Struct({
    prNumber: S.Finite,
    draft: S.Boolean,
    baseRef: S.String,
    headRef: S.String,
    headSha: S.NonEmptyString,
    mergeableState: S.String,
    labels: S.Array(S.String),
    requiredContexts: S.NonEmptyString.pipe(S.Array, S.OptionFromNullOr),
    checkRuns: S.Array(MergeGateCheckRun),
    statuses: GithubCommitStatusRecord.pipe(S.Array, S.OptionFromNullOr),
    window: S.OptionFromNullOr(YeetReviewWindow),
    threads: GateTableThreads,
  }).pipe($I.annoteSchema("GateTableRead", { description: "The facts one gate table row is decided from." }))
) {}

/**
 * One decided gate table row.
 *
 * **Details**
 *
 * `requiredGreen` counts required contexts whose newest run is green;
 * `reds` names every completed check run that is not green; `pending` names
 * every required context still running or not yet registered and every
 * pending commit status (`status:<context>`); `statusReds` names every failing
 * commit status (`<context>=<state>`), which never holds; `holds` names the
 * hold labels on the pull request (`owner-merge-hold`), each of which holds.
 * `gateMet` is the `GATE-MET` column.
 *
 * **Example** (Read a decided row)
 *
 * ```ts
 * import { decideGateTableRow, GateTableRead, GateTableThreadsNotRead } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = decideGateTableRow(
 *   GateTableRead.make({
 *     prNumber: 7,
 *     draft: true,
 *     baseRef: "main",
 *     headRef: "feat/x",
 *     headSha: "abcdef1234567890",
 *     mergeableState: "clean",
 *     labels: [],
 *     requiredContexts: O.some(["Lint"]),
 *     checkRuns: [],
 *     statuses: O.some([]),
 *     window: O.none(),
 *     threads: GateTableThreadsNotRead.make({}),
 *   })
 * )
 * console.log(row.gateMet) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateTableRow extends S.Opaque<GateTableRow, { readonly brand: unique symbol }>()(
  S.TaggedStruct("row", {
    read: GateTableRead,
    requiredGreen: S.Finite,
    reds: S.Array(S.String),
    pending: S.Array(S.String),
    statusReds: S.Array(S.String),
    holds: S.Array(S.String),
    gateMet: S.Boolean,
  }).pipe($I.annoteSchema("GateTableRow", { description: "One open pull request's distance from the merge gate." }))
) {}

/**
 * A pull request whose own reads failed; it is listed so it is not silently
 * missing from the table, and it is never a merge candidate.
 *
 * **Example** (A refused read)
 *
 * ```ts
 * import { GateTableUnreadable } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GateTableUnreadable.make({ prNumber: 9, reason: "gh api pulls/9 failed" }).prNumber) // 9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateTableUnreadable extends S.Opaque<GateTableUnreadable, { readonly brand: unique symbol }>()(
  S.TaggedStruct("unreadable", { prNumber: S.Finite, reason: S.NonEmptyString }).pipe(
    $I.annoteSchema("GateTableUnreadable", { description: "An open pull request whose reads failed." })
  )
) {}

/**
 * One line of the gate table: a decided row or an unreadable pull request.
 *
 * @category models
 * @since 0.0.0
 */
export const GateTableEntry = S.Union([GateTableRow, GateTableUnreadable]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("GateTableEntry", { description: "A decided gate table row or an unreadable pull request." })
);

/**
 * One line of the gate table.
 *
 * @category models
 * @since 0.0.0
 */
export type GateTableEntry = typeof GateTableEntry.Type;

/**
 * The whole table at one read, in pull request order.
 *
 * **Example** (An empty table)
 *
 * ```ts
 * import { GateTableReport } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 *
 * const report = GateTableReport.make({
 *   schemaVersion: "yeet-gate-table/v1",
 *   readAt: DateTime.makeUnsafe(0),
 *   entries: [],
 * })
 * console.log(report.entries.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateTableReport extends S.Opaque<GateTableReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("yeet-gate-table/v1"),
    readAt: S.DateTimeUtcFromString,
    entries: S.Array(GateTableEntry),
  }).pipe($I.annoteSchema("GateTableReport", { description: "Every open pull request's gate table line." }))
) {}

/**
 * JSON codec for the gate table report (`yeet gate-table --json`).
 *
 * **Example** (Encode a report)
 *
 * ```ts
 * import { GateTableReport, GateTableReportJson } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 *
 * const json = Effect.runSync(
 *   GateTableReportJson.encode(
 *     GateTableReport.make({ schemaVersion: "yeet-gate-table/v1", readAt: DateTime.makeUnsafe(0), entries: [] })
 *   )
 * )
 * console.log(json.includes("yeet-gate-table/v1")) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GateTableReportJson = JsonStringCodec(GateTableReport);

const STATUS_RED = ["failure", "error"];

const isPendingRun = (run: MergeGateCheckRun): boolean => run.status !== "completed";

const isRedRun = (run: MergeGateCheckRun): boolean => !isPendingRun(run) && !mergeGateGoodConclusion(run.conclusion);

const isGreenRun = (run: MergeGateCheckRun): boolean => !isPendingRun(run) && mergeGateGoodConclusion(run.conclusion);

const windowElapsed = (read: GateTableRead): boolean =>
  O.exists(read.window, (window) => YeetReviewWindow.guards.elapsed(window));

const threadsClear = (threads: GateTableThreads): boolean =>
  GateTableThreads.guards.counted(threads) && threads.outstanding === 0;

/**
 * Decide one gate table row. Pure, so recorded payloads prove every column.
 *
 * **Details**
 *
 * `GATE-MET` needs all of: out of draft; not conflicting
 * (`mergeable_state` other than `dirty`); a readable ruleset whose every
 * required context's newest run is green; no completed check run red, required
 * or not; readable commit statuses with none pending; an elapsed
 * review window; a counted thread list with nothing outstanding. A pending
 * non-required check run does not hold it, matching `gate.sh`: the merge gate
 * decides whether it may wait. A failing commit status is reported in
 * `statusReds` and does not hold: the merge gate reads check runs only. An
 * `owner-merge-hold` label holds it, as it holds the merge gate.
 *
 * **Example** (Every required check green, window and threads clear)
 *
 * ```ts
 * import {
 *   decideGateTableRow,
 *   GateTableRead,
 *   GateTableThreadsCounted,
 *   MergeGateCheckRun,
 *   YeetReviewWindowElapsed,
 * } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = decideGateTableRow(
 *   GateTableRead.make({
 *     prNumber: 7,
 *     draft: false,
 *     baseRef: "main",
 *     headRef: "feat/x",
 *     headSha: "abcdef1234567890",
 *     mergeableState: "clean",
 *     labels: [],
 *     requiredContexts: O.some(["Lint"]),
 *     checkRuns: [MergeGateCheckRun.make({ id: 1, name: "Lint", status: "completed", conclusion: "success" })],
 *     statuses: O.some([]),
 *     window: O.some(YeetReviewWindowElapsed.make({ anchor: "head-push", anchoredAt: "2026-11-06T00:00:00Z", windowMs: 1200000 })),
 *     threads: GateTableThreadsCounted.make({ outstanding: 0, total: 2 }),
 *   })
 * )
 * console.log(row.gateMet) // true
 * ```
 *
 * @param read - One pull request's facts.
 * @returns The decided row.
 * @category workflows
 * @since 0.0.0
 */
export const decideGateTableRow = (read: GateTableRead): GateTableRow => {
  const latestByName = mergeGateLatestRunPerName(read.checkRuns);
  const latest = latestByName.pipe(HashMap.values, A.fromIterable);
  const latestOf = (context: string): O.Option<MergeGateCheckRun> => HashMap.get(latestByName, context);
  const required = O.getOrElse(read.requiredContexts, A.empty<string>);
  const requiredGreen = A.length(A.filter(required, (context) => O.exists(latestOf(context), isGreenRun)));
  const requiredPending = A.filter(required, (context) =>
    O.match(latestOf(context), { onNone: () => true, onSome: isPendingRun })
  );
  const statuses = O.getOrElse(read.statuses, A.empty<GithubCommitStatusRecord>);
  const reds = A.map(A.filter(latest, isRedRun), (run) => `${run.name}=${run.conclusion ?? "none"}`);
  const statusReds = A.map(
    A.filter(statuses, (status) => A.contains(STATUS_RED, status.state)),
    (status) => `${status.context}=${status.state}`
  );
  const pending = A.appendAll(
    requiredPending,
    O.match(read.statuses, {
      onNone: () => ["statuses=?"],
      onSome: (read) =>
        A.map(
          A.filter(read, (status) => status.state === "pending"),
          (status) => `status:${status.context}`
        ),
    })
  );
  const holds = A.filter(read.labels, (label) => label === MERGE_GATE_OWNER_HOLD_LABEL);
  const gateMet =
    !read.draft &&
    A.isReadonlyArrayEmpty(holds) &&
    read.mergeableState !== "dirty" &&
    O.exists(read.requiredContexts, (contexts) => requiredGreen === A.length(contexts)) &&
    A.isReadonlyArrayEmpty(reds) &&
    A.isReadonlyArrayEmpty(pending) &&
    windowElapsed(read) &&
    threadsClear(read.threads);
  return GateTableRow.make({
    read,
    requiredGreen,
    reds: A.sort(reds, Str.Order),
    pending: A.sort(pending, Str.Order),
    statusReds: A.sort(statusReds, Str.Order),
    holds,
    gateMet,
  });
};

const windowCell = (window: O.Option<YeetReviewWindow>): string =>
  O.match(window, {
    onNone: () => "-",
    onSome: (read) =>
      YeetReviewWindow.match(read, {
        open: ({ remainingMs }) => `${Math.ceil(remainingMs / 60_000)}m`,
        elapsed: () => "ok",
        unknown: () => "?",
      }),
  });

const threadsCell = (threads: GateTableThreads): string =>
  GateTableThreads.match(threads, {
    counted: ({ outstanding, total }) => `${outstanding}/${total}`,
    unknown: () => "?",
    "not-read": () => "-",
  });

const listCell = (label: string, items: ReadonlyArray<string>): string =>
  A.isReadonlyArrayEmpty(items) ? "" : `${label}:${A.join(items, ",")}`;

/**
 * Render one gate table line, tab-separated in the column order of `gate.sh`.
 *
 * **Details**
 *
 * Columns: `#PR`, `ready` or `DRAFT`, base, head (10 characters),
 * `mergeable_state`, `ok=<green>/<required>`, `threads=<outstanding>/<total>`,
 * `window=ok|<n>m|?|-`, `RED:...`, `PENDING:...`, `STATUS-RED:...`,
 * `GATE-MET`, then `HOLD:...` and `branch=<head ref>`, appended so the
 * `gate.sh` positions never shift. An unreadable
 * pull request prints `#PR`, `UNREADABLE` and the reason. Empty columns stay
 * empty so the column positions never shift.
 *
 * **Example** (Render an unreadable pull request)
 *
 * ```ts
 * import { GateTableUnreadable, renderGateTableEntry } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderGateTableEntry(GateTableUnreadable.make({ prNumber: 9, reason: "pulls/9 failed" })))
 * // "#9\tUNREADABLE\tpulls/9 failed"
 * ```
 *
 * @param entry - One decided row or unreadable pull request.
 * @returns One tab-separated line.
 * @category formatting
 * @since 0.0.0
 */
export const renderGateTableEntry = (entry: GateTableEntry): string =>
  GateTableEntry.match(entry, {
    unreadable: ({ prNumber, reason }) => A.join([`#${prNumber}`, "UNREADABLE", reason], "\t"),
    row: ({ read, requiredGreen, reds, pending, statusReds, holds, gateMet }) =>
      A.join(
        [
          `#${read.prNumber}`,
          read.draft ? "DRAFT" : "ready",
          read.baseRef,
          Str.slice(0, 10)(read.headSha),
          read.mergeableState,
          O.match(read.requiredContexts, {
            onNone: () => "ok=?/?",
            onSome: (contexts) => `ok=${requiredGreen}/${A.length(contexts)}`,
          }),
          `threads=${threadsCell(read.threads)}`,
          `window=${windowCell(read.window)}`,
          listCell("RED", reds),
          listCell("PENDING", pending),
          listCell("STATUS-RED", statusReds),
          gateMet ? "GATE-MET" : "",
          listCell("HOLD", holds),
          `branch=${read.headRef}`,
        ],
        "\t"
      ),
  });

/**
 * Render the whole table: a `#` comment line with the read instant and the
 * count, then one line per pull request.
 *
 * **Example** (An empty table)
 *
 * ```ts
 * import { GateTableReport, renderGateTableReport } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 *
 * const text = renderGateTableReport(
 *   GateTableReport.make({ schemaVersion: "yeet-gate-table/v1", readAt: DateTime.makeUnsafe(0), entries: [] })
 * )
 * console.log(text) // "# gate-table 1970-01-01T00:00:00.000Z: 0 open PR(s), 0 GATE-MET"
 * ```
 *
 * @param report - The table at one read.
 * @returns The printed table.
 * @category formatting
 * @since 0.0.0
 */
export const renderGateTableReport = (report: GateTableReport): string => {
  const met = A.length(A.filter(report.entries, (entry) => GateTableEntry.guards.row(entry) && entry.gateMet));
  return A.join(
    [
      `# gate-table ${DateTime.formatIso(report.readAt)}: ${A.length(report.entries)} open PR(s), ${met} GATE-MET`,
      ...A.map(report.entries, renderGateTableEntry),
    ],
    "\n"
  );
};

const byNumber = Order.mapInput(Order.Number, (pull: GithubPullRequestRecord) => pull.number);

const toCheckRun = (run: {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion: O.Option<string>;
}) =>
  MergeGateCheckRun.make({ id: run.id, name: run.name, status: run.status, conclusion: O.getOrNull(run.conclusion) });

const readThreads = Effect.fnUntraced(function* (
  prNumber: number,
  draft: boolean
): Effect.fn.Return<GateTableThreads, never, ReviewThread | Repo> {
  if (draft) return GateTableThreadsNotRead.make({});
  const reviewThreads = yield* ReviewThread;
  return yield* reviewThreads.list(prNumber).pipe(
    Effect.map(
      (read): GateTableThreads =>
        GateTableThreadsCounted.make({ outstanding: outstanding(read), total: A.length(read.threads) })
    ),
    Effect.catch((error) =>
      Effect.succeed(GateTableThreadsUnknown.make({ reason: `thread read failed: ${error.message}` }))
    )
  );
});

const readRow = Effect.fnUntraced(function* (
  listed: GithubPullRequestRecord,
  rules: HashMap.HashMap<string, O.Option<ReadonlyArray<string>>>
): Effect.fn.Return<GateTableEntry, never, GithubRest | ReviewThread | Repo> {
  const rest = yield* GithubRest;
  const read = Effect.gen(function* () {
    // The list endpoint carries no mergeable_state; the detail read also pins the head.
    const pull = yield* rest
      .pullRequest(listed.number)
      .pipe(Effect.mapError(yeetGithubFailure(`gh api pulls/${listed.number}`)));
    const checkRuns = yield* rest
      .checkRuns(pull.headSha)
      .pipe(Effect.mapError(yeetGithubFailure(`gh api check-runs #${pull.number}`)));
    const statuses = yield* rest.commitStatuses(pull.headSha).pipe(Effect.option);
    const window = yield* pull.draft
      ? Effect.succeed(O.none<YeetReviewWindow>())
      : readYeetReviewWindow({ prNumber: pull.number, headSha: pull.headSha, pull }).pipe(Effect.asSome);
    const threads = yield* readThreads(pull.number, pull.draft);
    return decideGateTableRow(
      GateTableRead.make({
        prNumber: pull.number,
        draft: pull.draft,
        baseRef: pull.baseRef,
        headRef: pull.headRef,
        headSha: pull.headSha,
        mergeableState: O.getOrElse(pull.mergeableState, () => "unknown"),
        labels: pull.labels,
        requiredContexts: O.flatten(HashMap.get(rules, yeetStackRulesBranch(pull))).pipe(
          O.filter(A.isReadonlyArrayNonEmpty),
          O.map(A.filter(Str.isNonEmpty))
        ),
        checkRuns: A.map(checkRuns, toCheckRun),
        statuses,
        window,
        threads,
      })
    );
  });
  return yield* read.pipe(
    Effect.catch((error: YeetCommandError) =>
      Effect.succeed(GateTableUnreadable.make({ prNumber: listed.number, reason: error.message }))
    )
  );
});

/**
 * Read the gate table for every open pull request of the repository.
 *
 * **Details**
 *
 * The open pull request list failing fails the read; anything narrower is a
 * row-level unknown. Each base branch's ruleset is read once, and an
 * unreadable or empty one leaves its rows with `ok=?/?`. Rows are read four
 * at a time and returned in pull request order.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readGateTable } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readGateTable) // "function"
 * ```
 *
 * @returns The table at one read.
 * @category workflows
 * @since 0.0.0
 */
export const readGateTable = Effect.fn("Yeet.readGateTable")(function* (): Effect.fn.Return<
  GateTableReport,
  YeetCommandError,
  GithubRest | ReviewThread | Repo
> {
  const rest = yield* GithubRest;
  const open = yield* rest.openPullRequests.pipe(Effect.mapError(yeetGithubFailure("gh api open pulls")));
  // A stack layer is gated on its trunk's rules, which GitHub evaluates at merge.
  const bases = A.dedupe(A.map(open, yeetStackRulesBranch));
  const rules = yield* Effect.forEach(bases, (base) =>
    rest.requiredStatusContexts(base).pipe(
      Effect.option,
      Effect.map((contexts) => [base, contexts] as const)
    )
  ).pipe(Effect.map(HashMap.fromIterable));
  const entries = yield* Effect.forEach(A.sort(open, byNumber), (pull) => readRow(pull, rules), { concurrency: 4 });
  return GateTableReport.make({ schemaVersion: "yeet-gate-table/v1", readAt: yield* DateTime.now, entries });
});

/**
 * Read the table under the checkout's gh login and rewrite classifier.
 *
 * **Example** (Reference the table boundary)
 * ```ts
 * import { readYeetGateTableAsGhLogin } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof readYeetGateTableAsGhLogin) // "function"
 * ```
 * @category workflows
 * @since 0.0.0
 */
export const readYeetGateTableAsGhLogin = Effect.fn("Yeet.readGateTableAsGhLogin")((context: RepoRunContext) =>
  readGateTable().pipe(provideYeetHeadMoveClassifier(context.repoRoot), provideYeetGhLogin(context.repoRoot))
);

/**
 * The `yeet gate-table` flags as the CLI parses them.
 *
 * **Example** (Describe an invocation)
 *
 * ```ts
 * import { GateTableCommandOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const options = GateTableCommandOptions.make({ base: "origin/main", head: "HEAD", packetDir: ".beep/yeet", json: false })
 * console.log(options.json) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateTableCommandOptions extends S.Opaque<GateTableCommandOptions, { readonly brand: unique symbol }>()(
  S.Struct({ base: S.String, head: S.String, packetDir: S.String, json: S.Boolean }).pipe(
    $I.annoteSchema("GateTableCommandOptions", { description: "Parsed yeet gate-table flags." })
  )
) {}

/**
 * Run `yeet gate-table`: read the table under the operator's gh login and print it.
 *
 * **Example** (Build the command effect)
 *
 * ```ts
 * import { runYeetGateTable } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runYeetGateTable) // "function"
 * ```
 *
 * @param options - The parsed command flags.
 * @returns Nothing; the table is printed.
 * @category workflows
 * @since 0.0.0
 */
export const runYeetGateTable = Effect.fn("Yeet.runGateTableCommand")(function* (
  options: GateTableCommandOptions
): Effect.fn.Return<
  void,
  YeetCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const context = yield* hydrateYeetReadOnlyContext(options);
  const report = yield* readYeetGateTableAsGhLogin(context);
  if (options.json) {
    const encoded = yield* GateTableReportJson.encode(report).pipe(
      Effect.mapError(YeetCommandError.new("Failed to encode the gate table."))
    );
    yield* Console.log(encoded);
    return;
  }
  yield* Console.log(renderGateTableReport(report));
});
