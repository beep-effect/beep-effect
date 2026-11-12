/**
 * The decoded `bun run beep session open --json` report, as the cockpit reads it.
 *
 * **Details**
 *
 * The lab owns its own reader schema instead of importing `@beep/repo-cli`:
 * the session ledger has no public export, and the spike adds none. The
 * report is decoded in two steps so one corrupt row costs that row, not the
 * board: the envelope must decode, each row is decoded on its own, and rows
 * that fail are counted, never hidden silently.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LaneCockpitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";

const $I = $LaneCockpitId.create("Lanes");

/**
 * Where a lane's session stands, as the ledger records it.
 *
 * **Example** (Narrow a state)
 *
 * ```ts
 * import { LaneState } from "@/Lanes"
 *
 * console.log(LaneState.is.blocked("blocked")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LaneState = LiteralKit(["open", "blocked", "done"]).pipe(
  $I.annoteSchema("LaneState", { description: "Lifecycle of one session's work in a checkout." })
);

/**
 * The GitHub repository a report is about.
 *
 * **Example** (Make a repository)
 *
 * ```ts
 * import { LaneRepository } from "@/Lanes"
 *
 * console.log(LaneRepository.make({ host: "github.com", owner: "o", name: "r" }).name) // "r"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LaneRepository extends S.Opaque<LaneRepository, { readonly brand: unique symbol }>()(
  S.Struct({
    host: S.String,
    owner: S.String,
    name: S.String,
  }).pipe($I.annoteSchema("LaneRepository", { description: "Repository coordinates carried by the session report." }))
) {}

/**
 * One live lane: the newest non-done ledger row for a checkout.
 *
 * **Details**
 *
 * `harness` stays a plain string: a harness the cockpit has never heard of
 * is still a lane worth showing, not a corrupt row.
 *
 * **Example** (Decode a row)
 *
 * ```ts
 * import { LaneRow } from "@/Lanes"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownOption(LaneRow)({
 *   lane: "l", branch: "b", checkout: "/c", clone: "/r", state: "open", next: "n",
 *   summary: null, pr: null, harness: "codex", sessionId: null, recordedAt: "2026-11-10T00:00:00.000Z",
 * })
 * console.log(O.map(row, (lane) => lane.lane)) // Option.some("l")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LaneRow extends S.Opaque<LaneRow, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: S.String,
    branch: S.String,
    checkout: S.String,
    clone: S.String,
    state: LaneState,
    next: S.String,
    summary: S.OptionFromNullOr(S.String),
    pr: S.OptionFromNullOr(S.Int.check(S.isGreaterThan(0))),
    harness: S.String,
    sessionId: S.OptionFromNullOr(S.String),
    recordedAt: S.DateTimeUtcFromString,
  }).pipe($I.annoteSchema("LaneRow", { description: "The newest non-done ledger row for one checkout." }))
) {}

// The envelope keeps rows unknown so each one decodes, or fails, on its own.
const ReportEnvelope = S.Struct({
  schemaVersion: S.tag("session-open/v1"),
  repository: LaneRepository,
  rows: S.Array(S.Unknown),
});

const decodeEnvelope = S.decodeUnknownExit(S.fromJsonString(ReportEnvelope));
const decodeRow = S.decodeUnknownOption(LaneRow);

/**
 * A report that decoded: its lanes, and how many rows could not be read.
 *
 * **Example** (An empty board)
 *
 * ```ts
 * import { LaneRepository, LanesLoaded } from "@/Lanes"
 * import * as DateTime from "effect/DateTime"
 *
 * const loaded = LanesLoaded.make({
 *   repository: LaneRepository.make({ host: "github.com", owner: "o", name: "r" }),
 *   lanes: [],
 *   corrupt: 0,
 *   fetchedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(loaded._tag) // "LanesLoaded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LanesLoaded extends S.Opaque<LanesLoaded, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LanesLoaded", {
    repository: LaneRepository,
    lanes: S.Array(LaneRow),
    corrupt: S.Int,
    fetchedAt: S.DateTimeUtc,
  }).pipe($I.annoteSchema("LanesLoaded", { description: "A decoded session report with its unreadable-row count." }))
) {}

/**
 * A read that produced no board: the command failed or the report was malformed.
 *
 * **Example** (A failed read)
 *
 * ```ts
 * import { LanesFailed } from "@/Lanes"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(LanesFailed.make({ message: "boom", fetchedAt: DateTime.makeUnsafe(0) }).message) // "boom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LanesFailed extends S.Opaque<LanesFailed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LanesFailed", {
    message: S.String,
    fetchedAt: S.DateTimeUtc,
  }).pipe($I.annoteSchema("LanesFailed", { description: "A session report read that produced no board." }))
) {}

/**
 * The board's input before the first read finishes.
 *
 * **Example** (Waiting for the first read)
 *
 * ```ts
 * import { LanesPending } from "@/Lanes"
 *
 * console.log(LanesPending.make({})._tag) // "LanesPending"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LanesPending extends S.Opaque<LanesPending, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LanesPending", {}).pipe(
    $I.annoteSchema("LanesPending", { description: "No session report has been read yet." })
  )
) {}

/**
 * Everything the board can be asked to draw.
 *
 * **Example** (Match a snapshot)
 *
 * ```ts
 * import { LanesPending, LanesSnapshot } from "@/Lanes"
 *
 * console.log(LanesSnapshot.guards.LanesPending(LanesPending.make({}))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LanesSnapshot = S.Union([LanesLoaded, LanesFailed, LanesPending]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("LanesSnapshot", { description: "Loaded, failed or pending input for the lanes board." })
);

/**
 * Loaded, failed or pending input for the lanes board.
 *
 * @category models
 * @since 0.0.0
 */
export type LanesSnapshot = typeof LanesSnapshot.Type;

/**
 * Decode the stdout of `session open --json` into a snapshot.
 *
 * **Details**
 *
 * Never fails: a malformed report becomes {@link LanesFailed}, and rows that
 * do not decode are dropped and counted in {@link LanesLoaded.corrupt}.
 *
 * **Example** (A malformed report)
 *
 * ```ts
 * import { decodeReport } from "@/Lanes"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(decodeReport(DateTime.makeUnsafe(0))("not json")._tag) // "LanesFailed"
 * ```
 *
 * @param fetchedAt - When the report was read.
 * @returns A decoder from the command's stdout to the snapshot the board draws.
 * @category decoding
 * @since 0.0.0
 */
export const decodeReport =
  (fetchedAt: DateTime.Utc) =>
  (text: string): LanesSnapshot =>
    Exit.match(decodeEnvelope(text), {
      onFailure: () =>
        LanesFailed.make({ message: "The session report is not a session-open/v1 document.", fetchedAt }),
      onSuccess: (envelope) => {
        const lanes = A.getSomes(A.map(envelope.rows, (row) => decodeRow(row)));
        return LanesLoaded.make({
          repository: envelope.repository,
          lanes,
          corrupt: A.length(envelope.rows) - A.length(lanes),
          fetchedAt,
        });
      },
    });

/**
 * Decode a report read now.
 *
 * **Example** (Decode with the current clock)
 *
 * ```ts
 * import { decodeReportNow } from "@/Lanes"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(decodeReportNow("{}"))._tag) // "LanesFailed"
 * ```
 *
 * @param text - The command's stdout.
 * @returns The snapshot, stamped with the current time.
 * @category decoding
 * @since 0.0.0
 */
export const decodeReportNow = (text: string): Effect.Effect<LanesSnapshot> =>
  pipe(
    DateTime.now,
    Effect.map((now) => decodeReport(now)(text))
  );
