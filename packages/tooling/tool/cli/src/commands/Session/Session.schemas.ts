/**
 * Session ledger rows: where a harness session stopped in a checkout and what
 * it meant to do next.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { PrNumber, PrProvenanceHarness, PrRepository } from "../Yeet/internal/Provenance.ts";

const $I = $RepoCliId.create("commands/Session/Session.schemas");

/**
 * Where a session stands: still working, waiting on the operator, or finished.
 *
 * **Example** (Narrow a state)
 *
 * ```ts
 * import { SessionLedgerState } from "@beep/repo-cli/test/Session"
 *
 * console.log(SessionLedgerState.is.done("done")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SessionLedgerState = LiteralKit(["open", "blocked", "done"]).pipe(
  $I.annoteSchema("SessionLedgerState", { description: "Lifecycle of one session's work in a checkout." })
);

/**
 * Lifecycle of one session's work in a checkout.
 *
 * @category models
 * @since 0.0.0
 */
export type SessionLedgerState = typeof SessionLedgerState.Type;

/**
 * One append-only ledger row: a session's last known position in a checkout.
 *
 * **Details**
 *
 * Rows are keyed by `checkout` when read back: the newest row per checkout is
 * that checkout's current state, and a `done` row retires it from the open
 * list. `clone` names the owning clone so a reader can tell lanes of one clone
 * apart from sibling clones of the same repository.
 *
 * **Example** (Make a row)
 *
 * ```ts
 * import { PrRepository, SessionLedgerRow } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const row = SessionLedgerRow.make({
 *   schemaVersion: "session-ledger/v1",
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   clone: "/work/beep-effect",
 *   checkout: "/work/beep-effect-worktrees/lane",
 *   lane: "lane",
 *   branch: "feat/lane",
 *   state: "open",
 *   next: "publish the draft PR",
 *   summary: O.none(),
 *   pr: O.none(),
 *   harness: "claude-code",
 *   sessionId: O.none(),
 *   recordedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(row.lane) // "lane"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLedgerRow extends S.Class<SessionLedgerRow>($I`SessionLedgerRow`)(
  {
    schemaVersion: S.Literal("session-ledger/v1"),
    repository: PrRepository,
    clone: S.String,
    checkout: S.String,
    lane: S.String,
    branch: S.String,
    state: SessionLedgerState,
    next: S.String,
    summary: S.OptionFromNullOr(S.String),
    pr: S.OptionFromNullOr(PrNumber),
    harness: PrProvenanceHarness,
    sessionId: S.OptionFromNullOr(S.String),
    recordedAt: S.DateTimeUtcFromString,
  },
  $I.annote("SessionLedgerRow", {
    description: "Where one harness session stopped in a checkout and what it meant to do next.",
  })
) {}

/**
 * JSON-string codec for one ledger row (one JSON Lines entry).
 *
 * **Example** (Decode a line)
 *
 * ```ts
 * import { SessionLedgerRowJson } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(SessionLedgerRowJson.decodeOption("not-json"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SessionLedgerRowJson = JsonStringCodec(SessionLedgerRow);

/**
 * The `session open --json` document.
 *
 * **Example** (Encode an empty report)
 *
 * ```ts
 * import { SessionOpenReportJson } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof SessionOpenReportJson.encode) // function
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionOpenReport extends S.Class<SessionOpenReport>($I`SessionOpenReport`)(
  {
    schemaVersion: S.Literal("session-open/v1"),
    repository: PrRepository,
    rows: S.Array(SessionLedgerRow),
  },
  $I.annote("SessionOpenReport", { description: "The newest non-done ledger row per checkout, newest first." })
) {}

/**
 * JSON-string codec for {@link SessionOpenReport}.
 *
 * **Example** (Decode a report)
 *
 * ```ts
 * import { SessionOpenReportJson } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(SessionOpenReportJson.decodeOption("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SessionOpenReportJson = JsonStringCodec(SessionOpenReport);

// Newest first: negate the epoch so the installed Order module's plain
// Number order sorts descending without a reverse combinator.
const newestFirst = Order.mapInput(Order.Number, (row: SessionLedgerRow) => -DateTime.toEpochMillis(row.recordedAt));
const notBefore = (left: DateTime.DateTime, right: DateTime.DateTime): boolean =>
  DateTime.toEpochMillis(left) >= DateTime.toEpochMillis(right);

/**
 * Collapse a ledger into its live rows: the newest row per checkout, minus
 * the ones whose newest row is `done`, newest first.
 *
 * **Example** (Later rows supersede earlier ones)
 *
 * ```ts
 * import { openSessionRows } from "@beep/repo-cli/test/Session"
 *
 * console.log(openSessionRows([]).length) // 0
 * ```
 *
 * @param rows - Every row read from the ledger, in any order.
 * @returns The rows a resuming session should see.
 * @category utilities
 * @since 0.0.0
 */
export const openSessionRows = (rows: ReadonlyArray<SessionLedgerRow>): ReadonlyArray<SessionLedgerRow> => {
  const newest = MutableHashMap.empty<string, SessionLedgerRow>();
  for (const row of rows) {
    const current = MutableHashMap.get(newest, row.checkout);
    if (O.isNone(current) || notBefore(row.recordedAt, current.value.recordedAt)) {
      MutableHashMap.set(newest, row.checkout, row);
    }
  }
  return newest.pipe(
    MutableHashMap.values,
    A.fromIterable,
    A.filter((row) => !SessionLedgerState.is.done(row.state)),
    A.sort(newestFirst)
  );
};
