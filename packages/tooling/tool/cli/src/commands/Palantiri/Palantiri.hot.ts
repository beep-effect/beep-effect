/**
 * The hot parcels `beep session open` prints (account headroom, lane reds,
 * host pressure), bounded in time, and the file it stages for the Claude
 * SessionStart hook.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Freshness } from "@beep/palantiri";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { parcelReadOptions, readParcel, renderFreshness } from "./Palantiri.runtime.ts";
import { HotParcelId, HotParcelLine, HotParcels, HotParcelsJson, MAX_HOT_LINE_CARRIES } from "./Palantiri.schemas.ts";
import { palantiriStateDir, writePrivateFile } from "./Palantiri.service.ts";
import type { PalantiriClient, ParcelEnvelope } from "@beep/palantiri";
import type * as Scope from "effect/Scope";

/**
 * The file the hot parcels are staged in, under the Palantiri state
 * directory.
 *
 * **Example** (Read the hot-file name)
 *
 * ```ts
 * import { HOT_PARCELS_FILE } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(HOT_PARCELS_FILE) // "hot.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HOT_PARCELS_FILE = "hot.json";

/**
 * How long `beep session open` waits for the hot parcels before printing
 * `Unknown`.
 *
 * **Example** (Read the session-open bound)
 *
 * ```ts
 * import { HOT_PARCELS_TIMEOUT } from "@beep/repo-cli/test/Palantiri"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMillis(HOT_PARCELS_TIMEOUT)) // 2000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HOT_PARCELS_TIMEOUT: Duration.Duration = Duration.seconds(2);

const seconds = (timeout: Duration.Duration): string => `${Duration.toSeconds(timeout)}s`;

const timedOutText = (timeout: Duration.Duration): string => `Unknown (timed out after ${seconds(timeout)})`;

const READ_FAILED_TEXT = "Unknown (read failed)";

/**
 * One parcel as one hot line: its summary, then its freshness.
 *
 * **Example** (Render an empty parcel)
 *
 * ```ts
 * import { Freshness, ParcelEnvelope, ParcelReceipt } from "@beep/palantiri"
 * import { renderHotText } from "@beep/repo-cli/test/Palantiri"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const text = renderHotText(
 *   ParcelEnvelope.make({
 *     schemaVersion: "palantiri-parcel/v1",
 *     parcel: "lane-reds",
 *     key: "lane",
 *     readAt: DateTime.makeUnsafe("2026-10-15T12:00:00Z"),
 *     freshness: Freshness.cases.Fresh.make({ asOf: DateTime.makeUnsafe("2026-10-15T12:00:00Z") }),
 *     summary: "0 reds",
 *     items: [],
 *     receipt: ParcelReceipt.make({ shown: 0, total: 0 })
 *   })
 * )
 * console.log(text) // "0 reds (fresh as of 2026-10-15T12:00:00.000Z)"
 * ```
 *
 * @param envelope - The parcel read.
 * @returns The summary and freshness.
 * @category formatting
 * @since 0.0.0
 */
export const renderHotText = (envelope: ParcelEnvelope): string =>
  `${envelope.summary} (${renderFreshness(envelope.freshness)})`;

/**
 * When the reading behind a parcel was taken: its freshness `asOf` (a
 * snapshot's own time, not the time it was served), else the read time.
 *
 * **Example** (A stale reading keeps its own time)
 *
 * ```ts
 * import { Freshness, ParcelEnvelope, ParcelReceipt } from "@beep/palantiri"
 * import { readingAsOf } from "@beep/repo-cli/test/Palantiri"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const asOf = readingAsOf(
 *   ParcelEnvelope.make({
 *     schemaVersion: "palantiri-parcel/v1",
 *     parcel: "account-headroom",
 *     key: "account",
 *     readAt: DateTime.makeUnsafe("2026-10-15T12:10:00Z"),
 *     freshness: Freshness.cases.Unknown.make({
 *       reason: "stale",
 *       asOf: O.some(DateTime.makeUnsafe("2026-10-15T12:00:00Z")),
 *       detail: O.none()
 *     }),
 *     summary: "0 accounts",
 *     items: [],
 *     receipt: ParcelReceipt.make({ shown: 0, total: 0 })
 *   })
 * )
 * console.log(DateTime.formatIso(asOf)) // "2026-10-15T12:00:00.000Z"
 * ```
 *
 * @param envelope - The parcel read.
 * @returns The reading's as-of time.
 * @category utilities
 * @since 0.0.0
 */
export const readingAsOf = (envelope: ParcelEnvelope): DateTime.Utc =>
  pipe(
    envelope.freshness,
    Freshness.match({
      Fresh: (fresh) => fresh.asOf,
      Unknown: (unknown) => O.getOrElse(unknown.asOf, () => envelope.readAt),
    })
  );

// Every hot parcel read concurrently, each given `wait`; a parcel that times
// out or fails is an `Unknown` line naming the block's bound.
const readHotLines = Effect.fnUntraced(function* (wait: Duration.Duration, timeout: Duration.Duration) {
  return yield* Effect.forEach(
    HotParcelId.literals,
    (parcel) =>
      readParcel(parcel, parcelReadOptions(O.none(), O.none())).pipe(
        Effect.map((envelope) =>
          HotParcelLine.make({
            parcel,
            state: "read",
            text: renderHotText(envelope),
            summary: O.some(envelope.summary),
            asOf: O.some(readingAsOf(envelope)),
          })
        ),
        Effect.timeoutOption(wait),
        Effect.map(O.getOrElse(() => HotParcelLine.make({ parcel, state: "timed-out", text: timedOutText(timeout) }))),
        Effect.catchCause(() => Effect.succeed(HotParcelLine.make({ parcel, state: "failed", text: READ_FAILED_TEXT })))
      ),
    { concurrency: "unbounded" }
  );
});

/**
 * The hot parcels over a client runtime, all within `timeout`: building the
 * runtime counts against it, and each read gets what is left.
 *
 * **Details**
 *
 * Succeeds with one line per parcel when the block finishes in time (a slow
 * parcel is its own `Unknown` line); fails with one `Unknown` text when the
 * runtime cannot be built or the block as a whole overruns.
 *
 * **Example** (Build the bounded read)
 *
 * ```ts
 * import { HOT_PARCELS_TIMEOUT, hotParcels, layerPalantiriRuntime, layerPalantiriSourcesLive } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const runtime = layerPalantiriRuntime(layerPalantiriSourcesLive, Layer.empty)
 * console.log(Effect.isEffect(hotParcels(runtime, HOT_PARCELS_TIMEOUT))) // true
 * ```
 *
 * @param runtime - The in-process client with its sources and telemetry.
 * @param timeout - The most the whole block may take.
 * @returns The lines, or the one `Unknown` text that replaces them.
 * @category utilities
 * @since 0.0.0
 */
export const hotParcels: {
  (
    timeout: Duration.Duration
  ): <E, R>(
    runtime: Layer.Layer<PalantiriClient, E, R>
  ) => Effect.Effect<Result.Result<ReadonlyArray<HotParcelLine>, string>, never, Exclude<R, Scope.Scope>>;
  <E, R>(
    runtime: Layer.Layer<PalantiriClient, E, R>,
    timeout: Duration.Duration
  ): Effect.Effect<Result.Result<ReadonlyArray<HotParcelLine>, string>, never, Exclude<R, Scope.Scope>>;
} = dual(
  2,
  <E, R>(
    runtime: Layer.Layer<PalantiriClient, E, R>,
    timeout: Duration.Duration
  ): Effect.Effect<Result.Result<ReadonlyArray<HotParcelLine>, string>, never, Exclude<R, Scope.Scope>> =>
    Effect.gen(function* () {
      const deadline = (yield* Clock.currentTimeMillis) + Duration.toMillis(timeout);
      const context = yield* Layer.build(runtime);
      const left = Num.max(0, deadline - (yield* Clock.currentTimeMillis));
      return yield* readHotLines(Duration.millis(left), timeout).pipe(Effect.provideContext(context));
    }).pipe(
      Effect.scoped,
      // A little grace over the per-read bound, so a parcel's own timeout wins
      // when the runtime built quickly.
      Effect.timeoutOption(timeout.pipe(Duration.sum(Duration.millis(250)))),
      Effect.map(
        O.match({
          onNone: () => timeout.pipe(timedOutText, Result.fail),
          onSome: (lines): Result.Result<ReadonlyArray<HotParcelLine>, string> => Result.succeed(lines),
        })
      ),
      Effect.catchCause(() => Effect.succeed(Result.fail(READ_FAILED_TEXT)))
    )
);

/**
 * The hot block as `beep session open` prints it: a header and one line per
 * parcel, or a single `Unknown` line.
 *
 * **Example** (A block that timed out)
 *
 * ```ts
 * import { renderHotBlock } from "@beep/repo-cli/test/Palantiri"
 * import * as Result from "effect/Result"
 *
 * console.log(renderHotBlock(Result.fail("Unknown (timed out after 2s)")))
 * // ["[palantiri] hot parcels: Unknown (timed out after 2s)"]
 * ```
 *
 * @param result - The lines, or the text that replaces them.
 * @returns The lines to print.
 * @category formatting
 * @since 0.0.0
 */
export const renderHotBlock = (result: Result.Result<ReadonlyArray<HotParcelLine>, string>): ReadonlyArray<string> =>
  Result.match(result, {
    onFailure: (text) => [`[palantiri] hot parcels: ${text}`],
    onSuccess: (lines) => [
      "[palantiri] hot parcels (bun run beep palantiri parcel <id>):",
      ...A.map(lines, (line) => `- ${line.parcel}: ${line.text}`),
    ],
  });

// A previous line that can be carried once more: a read line, or a carried
// one under the cap, with the summary and read time to say what it was.
const carryOf = (current: HotParcelLine) => (previous: HotParcelLine) =>
  (previous.state === "read" || (previous.state === "carried" && previous.carries < MAX_HOT_LINE_CARRIES)) &&
  O.isSome(previous.summary) &&
  O.isSome(previous.asOf)
    ? O.some(
        HotParcelLine.make({
          parcel: current.parcel,
          state: "carried",
          text: `${previous.summary.value} (stale since ${DateTime.formatIso(previous.asOf.value)}; this read: ${current.text})`,
          summary: previous.summary,
          asOf: previous.asOf,
          carries: previous.carries + 1,
        })
      )
    : O.none();

/**
 * Merge this read's hot lines with the previously staged ones: a parcel that
 * timed out or failed carries its last read line, marked `carried` and
 * `stale since` its reading's as-of time, for at most
 * {@link MAX_HOT_LINE_CARRIES} reads in a row; past that, or with nothing to
 * carry, the parcel's `Unknown` line stands.
 *
 * **Details**
 *
 * A carried line never says `fresh`: its text is the old summary, the time it
 * was read, and why this read has no newer one. A read line resets the count.
 *
 * **Example** (A timed-out read carries the last read line)
 *
 * ```ts
 * import { carryHotLines, HotParcelLine } from "@beep/repo-cli/test/Palantiri"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const read = HotParcelLine.make({
 *   parcel: "lane-reds",
 *   state: "read",
 *   text: "0 reds (fresh as of 2026-10-15T12:00:00.000Z)",
 *   summary: O.some("0 reds"),
 *   asOf: O.some(DateTime.makeUnsafe("2026-10-15T12:00:00Z"))
 * })
 * const timedOut = HotParcelLine.make({ parcel: "lane-reds", state: "timed-out", text: "Unknown (timed out after 2s)" })
 * const [line] = carryHotLines([timedOut], [read])
 * console.log(line?.text) // "0 reds (stale since 2026-10-15T12:00:00.000Z; this read: Unknown (timed out after 2s))"
 * ```
 *
 * @param lines - This read's lines.
 * @param previous - The lines staged by the previous read.
 * @returns One line per parcel of this read, carried where allowed.
 * @category utilities
 * @since 0.0.0
 */
export const carryHotLines: {
  (previous: ReadonlyArray<HotParcelLine>): (lines: ReadonlyArray<HotParcelLine>) => ReadonlyArray<HotParcelLine>;
  (lines: ReadonlyArray<HotParcelLine>, previous: ReadonlyArray<HotParcelLine>): ReadonlyArray<HotParcelLine>;
} = dual(2, (lines: ReadonlyArray<HotParcelLine>, previous: ReadonlyArray<HotParcelLine>) => {
  const byParcel = HashMap.fromIterable(A.map(previous, (line) => [line.parcel, line] as const));
  return A.map(lines, (line) =>
    line.state === "read" ? line : O.getOrElse(O.flatMap(HashMap.get(byParcel, line.parcel), carryOf(line)), () => line)
  );
});

/**
 * Stage the hot lines in `hot.json` under the Palantiri state directory,
 * owner-only (directory `0700`, file `0600`, unique temporary file then
 * rename), for the SessionStart hook to print without running the CLI.
 *
 * **Details**
 *
 * The lines are first merged with the previously staged ones through
 * {@link carryHotLines}; a previous file that does not decode (missing,
 * corrupt, or version 1) carries nothing.
 *
 * **Example** (Build the stage effect)
 *
 * ```ts
 * import { stageHotParcels } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(stageHotParcels([]))) // true
 * ```
 *
 * @param lines - This read's lines.
 * @returns The lines as staged, carried lines included.
 * @category utilities
 * @since 0.0.0
 */
export const stageHotParcels = Effect.fn("Palantiri.stageHotParcels")(function* (lines: ReadonlyArray<HotParcelLine>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const palantiriStateDir1 = yield* palantiriStateDir;
  const file = path.join(palantiriStateDir1, HOT_PARCELS_FILE);
  const previous = yield* fs.readFileString(file).pipe(
    Effect.flatMap(S.decodeEffect(HotParcelsJson)),
    Effect.map((hot) => hot.lines),
    Effect.orElseSucceed(A.empty<HotParcelLine>)
  );
  const merged = carryHotLines(lines, previous);
  const text = yield* S.encodeEffect(HotParcelsJson)(
    HotParcels.make({ schemaVersion: "palantiri-hot/v2", writtenAt: yield* DateTime.now, lines: merged })
  );
  yield* writePrivateFile(file, text);
  return merged;
});

/**
 * Stage the hot block for the SessionStart hook when it finished in time,
 * then print it as staged (carried lines included). Never fails and never takes much more than `timeout`
 * reading; a failed staging write is logged at debug level only.
 *
 * **Example** (Build the print effect)
 *
 * ```ts
 * import { HOT_PARCELS_TIMEOUT, layerPalantiriRuntime, layerPalantiriSourcesLive, printHotParcels } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const runtime = layerPalantiriRuntime(layerPalantiriSourcesLive, Layer.empty)
 * console.log(Effect.isEffect(printHotParcels(runtime, HOT_PARCELS_TIMEOUT))) // true
 * ```
 *
 * @param runtime - The in-process client with its sources and telemetry.
 * @param timeout - The most the read may take.
 * @returns An effect that prints the block.
 * @category utilities
 * @since 0.0.0
 */
export const printHotParcels: {
  (
    timeout: Duration.Duration
  ): <E, R>(
    runtime: Layer.Layer<PalantiriClient, E, R>
  ) => Effect.Effect<void, never, Exclude<R, Scope.Scope> | FileSystem.FileSystem | Path.Path>;
  <E, R>(
    runtime: Layer.Layer<PalantiriClient, E, R>,
    timeout: Duration.Duration
  ): Effect.Effect<void, never, Exclude<R, Scope.Scope> | FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fnUntraced(function* <E, R>(runtime: Layer.Layer<PalantiriClient, E, R>, timeout: Duration.Duration) {
    const result = yield* hotParcels(runtime, timeout);
    // A finished block is staged first, so a timed-out parcel prints the
    // carried line the hook will show; a failed write prints this read as is.
    const printed = yield* Result.match(result, {
      onFailure: () => Effect.succeed(result),
      onSuccess: (lines) =>
        stageHotParcels(lines).pipe(
          Effect.map(Result.succeed),
          Effect.catchCause((cause) =>
            Effect.logDebug("[palantiri] could not stage the hot parcels", cause).pipe(Effect.as(result))
          )
        ),
    });
    yield* Effect.forEach(renderHotBlock(printed), (line) => Console.log(line), { discard: true });
  })
);
