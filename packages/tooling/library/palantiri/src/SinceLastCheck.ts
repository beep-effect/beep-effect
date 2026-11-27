/**
 * The since-last-check parcel: its spec and the pure reducer from a session's
 * read cursor, the session ledger and the checkout inbox to what changed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { dual } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import { Freshness } from "./Freshness.ts";
import { plural } from "./internal/Plural.ts";
import { ParcelSpec } from "./Parcel.models.ts";
import { makeParcelEnvelope, ParcelDraft } from "./ParcelEnvelope.models.ts";
import { redactText } from "./Redaction.ts";
import { SessionChange } from "./SinceLastCheck.models.ts";
import type { InboxRowInput } from "./LaneReds.models.ts";
import type { ParcelBudget } from "./Parcel.models.ts";
import type { ParcelEnvelope } from "./ParcelEnvelope.models.ts";
import type { LedgerRowInput, SinceLastCheckInput } from "./SinceLastCheck.models.ts";

/**
 * Spec of the since-last-check parcel: keyed by session and event-sourced,
 * so it has no time bound (`Duration.infinity`).
 *
 * **Example** (The bound is infinite)
 *
 * ```ts
 * import { SinceLastCheckSpec } from "@beep/palantiri/SinceLastCheck"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.isFinite(SinceLastCheckSpec.freshnessBound)) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SinceLastCheckSpec = ParcelSpec.make({
  id: "since-last-check",
  key: "session",
  freshnessBound: Duration.infinity,
  sources: ["session-ledger", "yeet-inbox", "session-cursor"],
});

/**
 * The moment changes are counted from: the session's cursor, else the
 * newest ledger row the session wrote itself, else `None` (everything).
 *
 * **Example** (No cursor and no own rows)
 *
 * ```ts
 * import { sinceLastCheckBaseline } from "@beep/palantiri/SinceLastCheck"
 * import { SinceLastCheckInput } from "@beep/palantiri/SinceLastCheck.models"
 * import * as O from "effect/Option"
 *
 * const input = SinceLastCheckInput.make({ cursor: O.none(), lane: "main", ledger: [], inbox: [], inboxReadable: true })
 * console.log(O.isNone(sinceLastCheckBaseline(input))) // true
 * ```
 *
 * @param input - The session's cursor and ledger rows.
 * @returns The baseline, if any.
 * @category utilities
 * @since 0.0.0
 */
export const sinceLastCheckBaseline = (input: SinceLastCheckInput): O.Option<DateTime.Utc> =>
  O.orElse(input.cursor, () =>
    A.match(
      A.map(
        A.filter(input.ledger, (row) => row.ownSession),
        (row) => row.recordedAt
      ),
      { onEmpty: O.none, onNonEmpty: (times) => O.some(A.max(times, DateTime.Order)) }
    )
  );

const isAfter =
  (baseline: O.Option<DateTime.Utc>) =>
  (at: DateTime.Utc): boolean =>
    O.match(baseline, { onNone: () => true, onSome: (since) => DateTime.isGreaterThan(at, since) });

const ledgerChange = (row: LedgerRowInput): SessionChange =>
  SessionChange.make({
    source: "ledger",
    lane: row.lane,
    branch: O.some(row.branch),
    state: O.some(row.state),
    kind: O.none(),
    severity: O.none(),
    prNumber: row.pr,
    text: redactText(O.getOrElse(row.summary, () => row.next)),
    at: row.recordedAt,
    freshness: Freshness.cases.Fresh.make({ asOf: row.recordedAt }),
  });

const inboxChange =
  (lane: string) =>
  (row: InboxRowInput, at: DateTime.Utc): SessionChange =>
    SessionChange.make({
      source: "inbox",
      lane,
      branch: O.none(),
      state: O.none(),
      kind: O.some(row.kind),
      severity: O.some(row.severity),
      prNumber: row.prNumber,
      text: redactText(row.summary),
      at,
      freshness: Freshness.cases.Fresh.make({ asOf: at }),
    });

const newestFirst: Order.Order<SessionChange> = Order.flip(
  Order.mapInput(DateTime.Order, (change: SessionChange) => change.at)
);

/**
 * Every ledger note and inbox row newer than the session's baseline, newest
 * first.
 *
 * **Details**
 *
 * Ledger rows the session wrote itself are left out. Acknowledged inbox
 * rows, and rows with no observation time, are left out. Every change is
 * `Fresh` as of its own time.
 *
 * **Example** (Nothing new)
 *
 * ```ts
 * import { sinceLastCheckItems } from "@beep/palantiri/SinceLastCheck"
 * import { SinceLastCheckInput } from "@beep/palantiri/SinceLastCheck.models"
 * import * as O from "effect/Option"
 *
 * const input = SinceLastCheckInput.make({ cursor: O.none(), lane: "main", ledger: [], inbox: [], inboxReadable: true })
 * console.log(sinceLastCheckItems(input).length) // 0
 * ```
 *
 * @param input - The session's cursor, the ledger rows and the inbox rows.
 * @returns The changes.
 * @category mapping
 * @since 0.0.0
 */
export const sinceLastCheckItems = (input: SinceLastCheckInput): ReadonlyArray<SessionChange> => {
  const after = isAfter(sinceLastCheckBaseline(input));
  return A.sort(
    A.appendAll(
      A.map(
        A.filter(input.ledger, (row) => !row.ownSession && after(row.recordedAt)),
        ledgerChange
      ),
      A.flatMap(input.inbox, (row) =>
        row.acked
          ? A.empty()
          : A.fromOption(O.map(O.filter(row.observedAt, after), (at) => inboxChange(input.lane)(row, at)))
      )
    ),
    newestFirst
  );
};

const sameAt =
  (at: DateTime.Utc) =>
  (change: SessionChange): boolean =>
    DateTime.Equivalence(change.at, at);

const pageOf = (
  items: ReadonlyArray<SessionChange>,
  budget: ParcelBudget
): { readonly page: ReadonlyArray<SessionChange>; readonly pending: ReadonlyArray<SessionChange> } => {
  const candidate = A.takeRight(items, budget);
  const boundary = O.map(A.head(candidate), (newest) => newest.at);
  const splits = O.exists(boundary, (at) => A.some(A.dropRight(items, budget), sameAt(at)));
  return items.length <= budget || !splits
    ? { page: candidate, pending: A.dropRight(items, candidate.length) }
    : O.match(boundary, {
        onNone: () => ({ page: candidate, pending: A.dropRight(items, candidate.length) }),
        onSome: (at) => {
          const before = A.filter(candidate, (change) => !sameAt(at)(change));
          const page = A.isReadonlyArrayNonEmpty(before) ? before : A.filter(items, sameAt(at));
          return { page, pending: A.dropRight(items, page.length) };
        },
      });
};

const summarize = (input: SinceLastCheckInput, items: ReadonlyArray<SessionChange>, pending: number): string => {
  const since = O.match(sinceLastCheckBaseline(input), {
    onNone: () => "the first check",
    onSome: DateTime.formatIso,
  });
  const notes = A.filter(items, (item) => item.source === "ledger");
  const lanes = A.dedupe(A.map(notes, (item) => item.lane));
  const unreadable = input.inboxReadable ? "" : "; inbox unreadable";
  const more = pending > 0 ? `; ${plural(pending, "newer change")} pending, read again` : "";
  return A.match(items, {
    onEmpty: () => `nothing new since ${since}${unreadable}`,
    onNonEmpty: (changes) =>
      `${plural(changes.length, "change")} since ${since}: ${plural(notes.length, "session note")}${
        A.isReadonlyArrayNonEmpty(lanes) ? ` (${A.join(lanes, ", ")})` : ""
      }, ${plural(changes.length - notes.length, "inbox row")}${unreadable}${more}`,
  });
};

/**
 * Reduce a session's cursor, the session ledger and the checkout inbox to the
 * since-last-check parcel.
 *
 * **Details**
 *
 * The parcel is event-sourced: it has no time bound, and every change is
 * `Fresh`. The envelope is `Fresh` as of `now`, or
 * `Unknown{attribution-incomplete}` when the checkout's inbox could not be
 * read. Changes are newest first. With more than `budget` changes, the oldest
 * `budget` are served and the summary says how many newer ones are pending,
 * so the cursor can advance past exactly what was served (see
 * {@link sinceLastCheckCursor}); the receipt still counts every change.
 * Advancing the cursor is the service's job, not the reducer's.
 *
 * **Gotchas**
 *
 * A page never splits changes that share a timestamp: the cursor keeps only
 * changes strictly after it, so a split group would lose its unserved half.
 * When the boundary timestamp continues into the pending changes, the page
 * stops just before it; when the whole page shares it, the page takes the
 * whole group, past the budget. The envelope's budget is the page's size, and
 * the pending changes follow the page in `items`.
 *
 * **Example** (First check with nothing recorded)
 *
 * ```ts
 * import { reduceSinceLastCheck } from "@beep/palantiri/SinceLastCheck"
 * import { SinceLastCheckInput } from "@beep/palantiri/SinceLastCheck.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const input = SinceLastCheckInput.make({ cursor: O.none(), lane: "main", ledger: [], inbox: [], inboxReadable: true })
 * const parcel = reduceSinceLastCheck(input, DateTime.makeUnsafe("2026-10-15T12:00:00Z"), 20)
 * console.log(parcel.summary) // "nothing new since the first check"
 * ```
 *
 * @param input - The session's cursor, the ledger rows and the inbox rows.
 * @param now - The read time.
 * @param budget - The most changes to keep.
 * @returns The parcel envelope.
 * @category mapping
 * @since 0.0.0
 */
export const reduceSinceLastCheck: {
  (now: DateTime.Utc, budget: ParcelBudget): (input: SinceLastCheckInput) => ParcelEnvelope;
  (input: SinceLastCheckInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope;
} = dual(3, (input: SinceLastCheckInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope => {
  const { page, pending } = pageOf(sinceLastCheckItems(input), budget);
  return makeParcelEnvelope(
    ParcelDraft.make({
      spec: SinceLastCheckSpec,
      readAt: now,
      freshness: input.inboxReadable
        ? Freshness.cases.Fresh.make({ asOf: now })
        : Freshness.cases.Unknown.make({
            reason: "attribution-incomplete",
            asOf: O.some(now),
            detail: O.some("the checkout inbox could not be read"),
          }),
      summary: summarize(input, page, pending.length),
      items: A.appendAll(page, pending),
      budget: Num.max(1, page.length),
    })
  );
});

/**
 * Where a session's read cursor may move after a since-last-check read.
 *
 * **Details**
 *
 * `None` when the checkout's inbox could not be read, so its rows are not
 * skipped. When every change fit in the budget, the read time `now`. When
 * changes were held back, the newest served change's time, so the pending
 * newer changes come back on the next read.
 *
 * **Example** (A read with nothing pending moves to the read time)
 *
 * ```ts
 * import { SinceLastCheckInput } from "@beep/palantiri/SinceLastCheck.models"
 * import { sinceLastCheckCursor } from "@beep/palantiri/SinceLastCheck"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const input = SinceLastCheckInput.make({ cursor: O.none(), lane: "main", ledger: [], inbox: [], inboxReadable: true })
 * console.log(O.isSome(sinceLastCheckCursor(input, DateTime.makeUnsafe(0), 20))) // true
 * ```
 *
 * @param input - The cursor, ledger and inbox the read reduced.
 * @param now - The read time, taken before the sources were read.
 * @param budget - The most changes one read serves.
 * @returns The new cursor position, or `None` to keep the cursor where it is.
 * @category mapping
 * @since 0.0.0
 */
export const sinceLastCheckCursor: {
  (now: DateTime.Utc, budget: ParcelBudget): (input: SinceLastCheckInput) => O.Option<DateTime.Utc>;
  (input: SinceLastCheckInput, now: DateTime.Utc, budget: ParcelBudget): O.Option<DateTime.Utc>;
} = dual(3, (input: SinceLastCheckInput, now: DateTime.Utc, budget: ParcelBudget): O.Option<DateTime.Utc> => {
  const { page, pending } = pageOf(sinceLastCheckItems(input), budget);
  return input.inboxReadable
    ? A.match(pending, {
        onEmpty: () => O.some(now),
        onNonEmpty: () => O.map(A.head(page), (newest) => newest.at),
      })
    : O.none();
});
