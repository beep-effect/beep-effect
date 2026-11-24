/**
 * Schemas for the since-last-check parcel: the session ledger rows, inbox
 * rows and read cursor it reduces from, and the change item it serves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { Freshness } from "./Freshness.ts";
import { InboxRowInput, InboxRowKind, InboxSeverity } from "./LaneReds.models.ts";

const $I = $PalantiriId.create("SinceLastCheck.models");

/**
 * Lifecycle of one session's work in a checkout, the same spellings the
 * session ledger writes.
 *
 * **Example** (Narrow a ledger state)
 *
 * ```ts
 * import { LedgerState } from "@beep/palantiri/SinceLastCheck.models"
 *
 * console.log(LedgerState.is.blocked("blocked")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LedgerState = LiteralKit(["open", "blocked", "done"]).pipe(
  $I.annoteSchema("LedgerState", { description: "Lifecycle of one session's work in a checkout." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type LedgerState = typeof LedgerState.Type;

/**
 * One session ledger row as the parcel reads it.
 *
 * **Details**
 *
 * `ownSession` is `true` when the reading session wrote the row; those rows
 * are not news to it. `next` and `summary` are free text and are redacted
 * before they are served.
 *
 * **Example** (Make a ledger row input)
 *
 * ```ts
 * import { LedgerRowInput } from "@beep/palantiri/SinceLastCheck.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const row = LedgerRowInput.make({
 *   lane: "palantiri-parcels-p2",
 *   branch: "feat/palantiri-parcels-p2",
 *   state: "open",
 *   pr: O.some(1817),
 *   next: "run the gates",
 *   summary: O.none(),
 *   recordedAt: DateTime.makeUnsafe("2026-10-15T12:00:00Z"),
 *   ownSession: false
 * })
 * console.log(row.state) // "open"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerRowInput extends S.Opaque<LedgerRowInput, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: S.String,
    branch: S.String,
    state: LedgerState,
    pr: S.OptionFromNullOr(S.Int),
    next: S.String,
    summary: S.OptionFromNullOr(S.String),
    recordedAt: S.DateTimeUtcFromString,
    ownSession: S.Boolean,
  }).pipe(
    $I.annoteSchema("LedgerRowInput", {
      description: "One session ledger row: lane, branch, state, pull request, note, time, and whether it is ours.",
    })
  )
) {}

/**
 * What the since-last-check source port serves for one session.
 *
 * **Details**
 *
 * `cursor` is when the session last read this parcel (`None` before its
 * first read). `ledger` is every row of the repository's session ledger;
 * `inbox` is the current checkout's inbox, and `inboxReadable` is `false` when
 * that inbox exists but could not be read.
 *
 * **Example** (Make an empty input)
 *
 * ```ts
 * import { SinceLastCheckInput } from "@beep/palantiri/SinceLastCheck.models"
 * import * as O from "effect/Option"
 *
 * const input = SinceLastCheckInput.make({ cursor: O.none(), lane: "main", ledger: [], inbox: [], inboxReadable: true })
 * console.log(input.lane) // "main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SinceLastCheckInput extends S.Opaque<SinceLastCheckInput, { readonly brand: unique symbol }>()(
  S.Struct({
    cursor: S.OptionFromNullOr(S.DateTimeUtcFromString),
    lane: S.String,
    ledger: S.Array(LedgerRowInput),
    inbox: S.Array(InboxRowInput),
    inboxReadable: S.Boolean,
  }).pipe(
    $I.annoteSchema("SinceLastCheckInput", {
      description: "A session's read cursor, the repository's ledger rows and the current checkout's inbox rows.",
    })
  )
) {}

/**
 * A session's read cursor, as stored next to the session ledger.
 *
 * **Example** (Make a cursor)
 *
 * ```ts
 * import { SessionCursor } from "@beep/palantiri/SinceLastCheck.models"
 * import * as DateTime from "effect/DateTime"
 *
 * const cursor = SessionCursor.make({ schemaVersion: "palantiri-cursor/v1", checkedAt: DateTime.makeUnsafe(0) })
 * console.log(cursor.schemaVersion) // "palantiri-cursor/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionCursor extends S.Opaque<SessionCursor, { readonly brand: unique symbol }>()(
  S.Struct({ schemaVersion: S.tag("palantiri-cursor/v1"), checkedAt: S.DateTimeUtcFromString }).pipe(
    $I.annoteSchema("SessionCursor", { description: "When a session last read the since-last-check parcel." })
  )
) {}

/**
 * JSON-string codec for {@link SessionCursor}, for cursor files.
 *
 * **Example** (Decode a cursor file)
 *
 * ```ts
 * import { SessionCursorJson } from "@beep/palantiri/SinceLastCheck.models"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const cursor = await Effect.runPromise(
 *   S.decodeUnknownEffect(SessionCursorJson)('{"schemaVersion":"palantiri-cursor/v1","checkedAt":"2026-10-15T12:00:00.000Z"}')
 * )
 * console.log(cursor.schemaVersion) // "palantiri-cursor/v1"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SessionCursorJson = S.fromJsonString(SessionCursor).pipe(
  $I.annoteSchema("SessionCursorJson", { description: "A session read cursor decoded from JSON text." })
);

/**
 * Where a change came from: the session ledger, or the checkout's inbox.
 *
 * **Example** (Narrow a change source)
 *
 * ```ts
 * import { ChangeSource } from "@beep/palantiri/SinceLastCheck.models"
 *
 * console.log(ChangeSource.is.inbox("inbox")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ChangeSource = LiteralKit(["ledger", "inbox"]).pipe(
  $I.annoteSchema("ChangeSource", { description: "Whether a change came from the session ledger or the inbox." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ChangeSource = typeof ChangeSource.Type;

/**
 * Since-last-check parcel item: one ledger note or inbox row newer than the
 * session's last read.
 *
 * **Details**
 *
 * Ledger changes carry `state` and `branch`; inbox changes carry `kind` and
 * `severity`. `text` is the redacted note or row summary. The parcel is
 * event-sourced, so every change is `Fresh` as of its own time.
 *
 * **Example** (Make a ledger change)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { SessionChange } from "@beep/palantiri/SinceLastCheck.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const at = DateTime.makeUnsafe("2026-10-15T12:00:00Z")
 * const change = SessionChange.make({
 *   source: "ledger",
 *   lane: "palantiri-parcels-p2",
 *   branch: O.some("feat/palantiri-parcels-p2"),
 *   state: O.some("open"),
 *   kind: O.none(),
 *   severity: O.none(),
 *   prNumber: O.some(1817),
 *   text: "run the gates",
 *   at,
 *   freshness: Freshness.cases.Fresh.make({ asOf: at })
 * })
 * console.log(change._tag) // "SessionChange"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionChange extends S.Opaque<SessionChange, { readonly brand: unique symbol }>()(
  S.TaggedStruct("SessionChange", {
    source: ChangeSource,
    lane: S.String,
    branch: S.OptionFromNullOr(S.String),
    state: S.OptionFromNullOr(LedgerState),
    kind: S.OptionFromNullOr(InboxRowKind),
    severity: S.OptionFromNullOr(InboxSeverity),
    prNumber: S.OptionFromNullOr(S.Int),
    text: S.String,
    at: S.DateTimeUtcFromString,
    freshness: Freshness,
  }).pipe(
    $I.annoteSchema("SessionChange", {
      description: "One ledger note or inbox row newer than the session's last read.",
    })
  )
) {}
