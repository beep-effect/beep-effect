/**
 * Typed journal services, subscriptions and schema-backed configuration.
 * @packageDocumentation
 * @since 0.0.0
 */
// The `Journal` service: one append-only, schema-validated JSONL file.

import { $ScratchpadId } from "@beep/identity/packages";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Channel from "effect/Channel";
import * as Chunk from "effect/Chunk";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as PubSub from "effect/PubSub";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import type * as Take from "effect/Take";
import type { EnvelopeUnion, EnvelopeWithTag } from "./Envelope.js";
import { Envelope } from "./Envelope.js";
import { canMerge, isRecordLike, shallowMerge } from "./internal/merge.js";
import type { TailWindow } from "./internal/tail.js";
import { DEFAULT_WINDOW, probeBomBytes, readRangeText, readTail, readTailUntil } from "./internal/tail.js";
import type { InvalidData, JsonlError, MalformedLine, UnknownEvent, UnserializableData } from "./JsonlError.js";
import { JournalClosed, JournalNotFound, JournalResync, TerminalViolation } from "./JsonlError.js";
import type { JsonlEvent } from "./JsonlEvent.js";
import { Line } from "./Line.js";
import { LineSlice } from "./LineSlice.js";
import type { CursoredSlice } from "./Slice.js";
import { matchesFrame } from "./Slice.js";

const $I = $ScratchpadId.create("effected/jsonl/Journal");

/**
 * The failure channel of a write operation.
 *
 * **Details**
 *
 * `PlatformError` rides through untranslated per the taxonomy's rule. **Any
 * `PlatformError` out of an append must be treated as a possibly-torn tail**:
 * `writeAll` reports no byte count, so a failure cannot be read as "nothing was
 * written". The next reader walks back over whatever fragment survived.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type JournalWriteError =
  | JournalClosed
  | JournalNotFound
  | TerminalViolation
  | UnknownEvent
  | MalformedLine
  | InvalidData
  | UnserializableData
  | PlatformError.PlatformError;

/**
 * The failure channel of a read operation.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type JournalReadError = JournalNotFound | PlatformError.PlatformError;

/**
 * Options for one append.
 *
 * **Example** (Select an append partition)
 * ```ts import.meta.vitest name="Select an append partition"
 * import { AppendOptions } from "@beep/scratchpad/effected/jsonl/index";
 * AppendOptions.make({ scope: "mail" }).scope // => "mail"
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
// Structs keep configuration as plain data at the service-construction boundary.
export const AppendOptions = S.Struct({ scope: S.optionalKey(S.String) }).annotate(
  $I.annote("AppendOptions", { description: "Partition selection for one append." }),
);

/**
 * Options accepted by a journal append.
 * @category type-level
 * @since 0.0.0
 */
export type AppendOptions = typeof AppendOptions.Type;

/**
 * The shape of a `Journal`, typed by its registry.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface JournalShape<R extends JsonlEvent.Registry> {
  /**
   * Validate, encode and append one envelope.
   *
   * **Details**
   *
   * `at` is stamped here from the Effect `Clock` — never by the caller — so
   * ordering does not depend on two writers agreeing about the time, and
   * `TestClock` controls it exactly in tests.
   */
  readonly append: <T extends JsonlEvent.Tag<R>>(
    event: T,
    data: JsonlEvent.Data<R, NoInfer<T>>,
    options?: AppendOptions | undefined,
  ) => Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;

  /**
   * Inherit-and-patch: read the last valid envelope, shallow-merge `patch`
   * over its `data`, validate the result and append it.
   *
   * **Details**
   *
   * This is the snapshot-journal primitive — each line is a complete state and
   * most transitions change one field. The merge is **shallow** by decision: a
   * nested object in the patch replaces the one beneath it.
   */
  readonly appendPatch: <T extends JsonlEvent.Tag<R>>(
    event: T,
    patch: Partial<JsonlEvent.Data<R, NoInfer<T>>>,
    options?: AppendOptions | undefined,
  ) => Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;

  /**
   * The current last valid **envelope**, as an observable `Option`.
   *
   * **Details**
   *
   * "Last valid" always means the last valid envelope, never merely the last
   * valid JSON — a torn scalar tail parses as a different value and only the
   * envelope contract detects it.
   */
  readonly latest: SubscriptionRef.SubscriptionRef<O.Option<EnvelopeUnion<R>>>;

  /**
   * Whether the journal is quiescent — its tail is an event marked `terminal`.
   *
   * **Details**
   *
   * Derived from {@link JournalShape.latest} rather than tracked separately, so
   * the two cannot disagree.
   */
  readonly quiescent: Effect.Effect<boolean>;

  /**
   * Historical read: a finite `Stream` of the envelopes matching `slice`.
   *
   * **Details**
   *
   * Every element carries its logical byte offsets on `line`, so iteration is
   * resumable across process restarts by persisting `line.end` and passing it
   * back as `cursor`.
   *
   * Filtering happens on the envelope **frame**, strictly before the payload
   * schema runs, so a non-matching line's `data` is never decoded.
   *
   * **Cost, stated rather than implied.** As built, the requested region —
   * `cursor` to the end of the file — is read in ONE allocation bounded by the
   * file's size, and the matching envelopes are buffered before the first is
   * emitted. An unsliced `query()` over a large journal therefore does hold
   * that journal in memory; a `cursor` is what bounds the read, which is
   * precisely what a resuming consumer already persists. The window-bounded
   * reads are `latest` and the `lastValid`-backed paths. Emitting per window,
   * so an unsliced query costs a window rather than a file, is tracked as
   * spencerbeggs/effected#233.
   */
  readonly query: {
    <T extends JsonlEvent.Tag<R>>(
      slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> },
    ): Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;
    (
      slice?: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined,
    ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError>;
  };

  /**
   * Live read: a `Stream` of matching envelopes as they are appended.
   *
   * **Details**
   *
   * With a `cursor`, replay-from-cursor and the live tail are **one seam**: the
   * replayed history and the live tail are the same stream, filtered the same
   * way, so a consumer cannot observe a gap or a duplicate at the join.
   *
   * The stream **ends** — it never hangs — when the journal becomes quiescent
   * (a `terminal` event reaches the tail) or its scope closes. Subscribing to
   * an already-quiescent journal ends immediately.
   *
   * Two properties are worth knowing before relying on them.
   *
   * The **delivered-before-end guarantee is scoped to consuming subscribers**:
   * every append that completed is delivered before the stream ends, provided
   * the subscriber keeps taking. One that stops taking cannot observe
   * completion by definition, and shutdown will not wait on it past its bound.
   *
   * The **filter-before-decode guarantee is structural on the historical half
   * only**. Replayed lines are filtered on the frame before their payload is
   * decoded. Live envelopes arrive already decoded — the appender decoded its
   * own payload in order to return it — so a filtered-out live envelope was
   * decoded once, by the writer, not by each subscriber.
   */
  readonly changes: {
    <T extends JsonlEvent.Tag<R>>(
      slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> },
    ): Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;
    (
      slice?: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined,
    ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError>;
  };

  /**
   * A running fold over a slice, emitted as it advances.
   *
   * **Details**
   *
   * The fold only ever sees its own slice, so a per-scope state machine over a
   * shared journal is exhaustively checkable against just that scope's events.
   */
  readonly projection: {
    <S, T extends JsonlEvent.Tag<R>>(
      initial: S,
      fold: (state: S, envelope: EnvelopeWithTag<R, NoInfer<T>>) => S,
      slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> },
    ): Stream.Stream<S, JournalReadError | JsonlError>;
    <S>(
      initial: S,
      fold: (state: S, envelope: EnvelopeUnion<R>) => S,
      slice?: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined,
    ): Stream.Stream<S, JournalReadError | JsonlError>;
  };

  /** Create the journal file if it does not exist. Always explicit. */
  readonly create: Effect.Effect<void, PlatformError.PlatformError>;

  /** Remove the journal file. Always explicit. */
  readonly remove: Effect.Effect<void, PlatformError.PlatformError>;

  /**
   * The internal hub, exposed for the read surfaces built over it.
   *
   * **Details**
   *
   * Elements are `Take` chunks and end-of-stream is a published `Exit`, which
   * is what lets quiescence and graceful shutdown arrive at a subscriber as a
   * normal stream end. Never shut this down to signal completion —
   * `PubSub.shutdown` *interrupts* subscribers, which tears an in-flight
   * stream instead of ending it.
   *
   * @internal
   */
  readonly hub: PubSub.PubSub<Take.Take<EnvelopeUnion<R>, JsonlError>>;
}

/**
 * Configuration for one journal layer.
 *
 * **Example** (Bound journal shutdown)
 * ```ts import.meta.vitest name="Bound journal shutdown"
 * import { JournalConfig } from "@beep/scratchpad/effected/jsonl/index";
 * import * as Duration from "effect/Duration";
 * const config = JournalConfig.make({ path: "events.jsonl", shutdownPublishTimeout: Duration.seconds(2) });
 * config.path // => "events.jsonl"
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export const JournalConfig = S.Struct({
  /** Journal path; construction permits a missing file. */
  path: S.String,
  /** Directory to watch until creation; defaults to the parent of path. */
  directory: S.optionalKey(S.String),
  /** Backpressured subscriber capacity; defaults to 64. */
  capacity: S.optionalKey(S.Int.check(S.isGreaterThan(0))),
  /** Bound on graceful shutdown publication; defaults to five seconds. */
  shutdownPublishTimeout: S.optionalKey(S.Duration),
}).annotate($I.annote("JournalConfig", { description: "File and subscription settings for one journal layer." }));

/**
 * Configuration accepted by a journal layer.
 * @category type-level
 * @since 0.0.0
 */
export type JournalConfig = typeof JournalConfig.Type;

/**
 * How long scope close waits for the terminal `Exit` to be accepted by the hub.
 *
 * **Details**
 *
 * Bounded rather than indefinite: a subscriber that never consumes cannot
 * observe completion, so waiting on it forever only converts "one stuck
 * subscriber" into "the process cannot shut down".
 */
const SHUTDOWN_PUBLISH_TIMEOUT = Duration.seconds(5);

/**
 * How many times the watcher re-arms a watch that ends without observing
 * anything before it gives up.
 *
 * **Details**
 *
 * A watch that completes instantly — an unsupported backend, a path that keeps
 * vanishing — would otherwise spin the supervisor at full speed, and no timer
 * is permitted here to back it off. Giving up is the honest failure: local
 * appends keep working, live observation does not.
 */
const MAX_IMMEDIATE_REARMS = 8;

/**
 * Scheduler turns yielded to a freshly-forked watch consumer before the
 * catch-up read runs.
 *
 * **Details**
 *
 * See the arming comment in `supervise`: this orders arming ahead of catch-up
 * by scheduling rather than by synchronisation, because `fs.watch` offers no
 * registration signal.
 */
const ARM_YIELDS = 3;

/**
 * Index of the last path separator, on either convention.
 *
 * **Details**
 *
 * Both are checked because a Windows path contains no `/` at all: matching only
 * on `/` returns `-1` there, which makes the whole path its own basename and
 * points the activation watch at the process working directory — a journal
 * created after its layer was built is then never observed.
 */
const lastSeparator = (path: string): number =>
  Math.max(
    O.getOrElse(Str.lastIndexOf("/")(path), () => -1),
    O.getOrElse(Str.lastIndexOf("\\")(path), () => -1),
  );

/**
 * The last segment of a path.
 *
 * **Details**
 *
 * Used for **comparison only** — matching a watch event's basename against the
 * journal's filename. `event.path` is never opened or read, on any watch.
 */
const basenameOf = (path: string): string => Str.slice(lastSeparator(path) + 1)(path);

/**
 * The directory a path sits in — the single derived path this package ever
 * hands to the filesystem, and only as {@link JournalConfig.directory}'s
 * default.
 *
 * **Details**
 *
 * Path arithmetic is otherwise forbidden here: paths are opaque strings handed
 * straight to `FileSystem`. This one derivation exists because the activation
 * watch has to name a directory and the layer takes only a file path; a caller
 * whose path convention this does not fit (a drive-relative Windows path, say)
 * names the directory explicitly instead.
 */
const parentOf = (path: string): string => {
  const separator = lastSeparator(path);
  if (separator < 0) return ".";
  // A separator at index 0 means the file sits in the root directory, which is
  // that separator itself — slicing to an empty string would name nothing.
  return separator === 0 ? Str.slice(0, 1)(path) : Str.slice(0, separator)(path);
};

/**
 * The last valid envelope in a tail window, with its offsets rebased onto the
 * journal.
 *
 * **Details**
 *
 * The walk-back itself is **not** reimplemented here: `Envelope.lastValidResult`
 * is the binding definition of "the journal's current state" — which lines
 * count as blank, which failures are walked over, where it stops — and a second
 * copy of those rules would only be a place for them to drift apart. All this
 * adds is the one thing the pure core cannot know: the window's text begins at
 * `window.start`, so every offset inside it is relative to that.
 */
const decodeWindow = <R extends JsonlEvent.Registry>(events: R, window: TailWindow): O.Option<EnvelopeUnion<R>> =>
  O.map(Envelope.lastValidResult(window.text, events), (envelope) => ({
    ...envelope,
    line: LineSlice.make({
      offset: envelope.line.offset + window.start,
      end: envelope.line.end + window.start,
      length: envelope.line.length,
      text: envelope.line.text,
      terminated: envelope.line.terminated,
    }),
  }));

const makeEngine = Effect.fn("Journal.makeEngine")(function* <R extends JsonlEvent.Registry>(
  events: R,
  config: JournalConfig,
  fs: FileSystem.FileSystem,
): Effect.fn.Return<JournalShape<R>, PlatformError.PlatformError, Scope.Scope> {
  const terminalTags = HashSet.fromIterable(
    A.map(
      A.filter(events, (event) => event.terminal),
      (event) => event.tag,
    ),
  );
  const reopenTags = HashSet.fromIterable(
    A.map(
      A.filter(events, (event) => event.reopen),
      (event) => event.tag,
    ),
  );

  /** Guards the WRITE critical section only: file write plus ref updates. */
  const writePermit = Semaphore.makeUnsafe(1);
  /**
   * The publish baton.
   *
   * **Details**
   *
   * Each append links a fresh Deferred onto this chain **while holding the
   * write permit**, so publish order is fixed to write order; it then awaits
   * its predecessor and publishes OUTSIDE the write permit. That is what lets
   * a stalled subscriber block publishers without wedging writers or
   * deadlocking scope close, while still making an append complete only once
   * the hub has accepted its envelope.
   */
  let publishBaton: Deferred.Deferred<void> = Deferred.makeUnsafe<void>();
  Deferred.doneUnsafe(publishBaton, Exit.void);
  /** Bytes of leading BOM, probed from the file — never inferred from a window. */
  let bomBytes = 0;
  /**
   * The watched file's identity, for detecting replacement.
   *
   * **Details**
   *
   * Size alone cannot see a same-size replace; inode identity can. `ino` is
   * an `Option` in core's `File.Info`, so on a platform that does not report
   * it this degrades to truncation-only detection — stated rather than
   * pretended away.
   */
  let identity: O.Option<string> = O.none();
  const hub = yield* PubSub.bounded<Take.Take<EnvelopeUnion<R>, JsonlError>>(config.capacity ?? 64);
  const latest = yield* SubscriptionRef.make(O.none<EnvelopeUnion<R>>());
  /** Refusal state. Read before the permit so a late append fails fast. */
  let closed = false;
  /** Logical bytes decoded so far — the resume cursor the watcher advances. */
  let consumed = 0;

  // Called per use rather than hoisted into a const: a hoisted Effect would
  // be correct only if every backend built a lazy one, and that is not a
  // property this service should depend on.
  const exists = () => fs.exists(config.path);

  const requireFile = Effect.gen(function* () {
    const present = yield* exists();
    if (!present) {
      return yield* JournalNotFound.make({ path: config.path });
    }
  });

  const readLatest = Effect.gen(function* () {
    yield* requireFile;
    return yield* readTailUntil(fs, config.path, bomBytes, (window) => decodeWindow(events, window), DEFAULT_WINDOW);
  });

  const refresh = Effect.gen(function* () {
    const found = yield* readLatest;
    yield* SubscriptionRef.set(latest, found);
    return found;
  });

  const isTerminalTail = Effect.gen(function* () {
    const current = yield* SubscriptionRef.get(latest);
    return O.isSome(current) && HashSet.has(terminalTags, current.value.event);
  });

  /**
   * Read `[from, to)` and decode the complete lines in it, in file order.
   *
   * **Details**
   *
   * The one decode loop the external-growth paths share. Both the watcher's
   * catch-up ingest and an append whose bytes landed past another writer's
   * need the same thing — "decode this gap" — and two copies of a loop that
   * rebases offsets and tolerates a torn tail is exactly the drift that
   * produces a cursor bug on one path only.
   *
   * `advanced` is where the last COMPLETE line ended: an unterminated final
   * line is not consumed, so a torn tail holds the offset until its writer
   * finishes it. A line that fails to decode is skipped rather than fatal —
   * a foreign writer's unknown tag must not blind this reader to the lines
   * after it.
   */
  const decodeRange = Effect.fn("Journal.decodeRange")(function* (
    from: number,
    to: number,
  ): Effect.fn.Return<
    { readonly decoded: ReadonlyArray<EnvelopeUnion<R>>; readonly advanced: number },
    PlatformError.PlatformError
  > {
    const text = yield* readRangeText(fs, config.path, from + bomBytes, to - from);
    const lines = Line.split(text);
    let decoded = Chunk.empty<EnvelopeUnion<R>>();
    let advanced = from;
    for (const line of lines) {
      if (!line.terminated) {
        break;
      }
      advanced = line.end + from;
      if (Str.trim(line.text) === "") {
        continue;
      }
      const rebased = LineSlice.make({
        offset: line.offset + from,
        end: line.end + from,
        length: line.length,
        text: line.text,
        terminated: true,
      });
      const envelope = Envelope.decodeResult(rebased, events);
      if (Result.isSuccess(envelope)) {
        decoded = Chunk.append(decoded, envelope.success);
      }
    }
    return { decoded: A.fromIterable(decoded), advanced };
  });

  /**
   * The one write path.
   *
   * **Details**
   *
   * `build` runs **inside the write permit**, so an inherit-and-patch reads
   * the current state under the same lock that serializes the write. Reading
   * outside it was a lost-update race: two concurrent patches to different
   * fields both read the same base and the second silently reverted the
   * first.
   */
  const appendWith = Effect.fn("Journal.appendWith")(function* (
    event: string,
    build: (current: O.Option<EnvelopeUnion<R>>) => unknown,
    scope: string | undefined,
  ): Effect.fn.Return<EnvelopeUnion<R>, JournalWriteError> {
    // Refusal is checked BEFORE the permit: a late append must not queue
    // behind a draining flush only to be refused after waiting.
    if (closed) {
      return yield* JournalClosed.make({ event });
    }

    const { envelope, external, predecessor, baton } = yield* writePermit.withPermits(1)(
      Effect.gen(function* () {
        if (closed) {
          return yield* JournalClosed.make({ event });
        }
        yield* requireFile;

        const current = yield* SubscriptionRef.get(latest);
        if (O.isSome(current) && HashSet.has(terminalTags, current.value.event) && !HashSet.has(reopenTags, event)) {
          return yield* TerminalViolation.make({ event, terminal: current.value.event });
        }

        // Read-and-derive happens HERE, under the lock.
        const data = build(current);

        const at = yield* DateTime.now;
        const encoded = Envelope.encodeResult<JsonlEvent.Registry>(
          {
            event,
            data,
            at,
            ...(scope === undefined ? {} : { scope }),
          },
          events,
        );
        if (Result.isFailure(encoded)) {
          return yield* encoded.failure;
        }
        const bytes = new TextEncoder().encode(encoded.success);

        // ONE `writeAll` of the complete line to an O_APPEND handle. This
        // is a write LOOP, not a single syscall — atomicity is an OS
        // property of O_APPEND at reasonable line sizes, not an API
        // guarantee, and a short write can still tear a large line. There
        // is no byte count to inspect: `writeAll` either wrote everything
        // or failed, and any failure here means POSSIBLY TORN, never
        // "nothing was written".
        const end = yield* Effect.scoped(
          Effect.gen(function* () {
            const file = yield* fs.open(config.path, { flag: "a" });
            yield* file.writeAll(bytes);
            // The offsets come from the FILE, never from `consumed`.
            // O_APPEND lands at the real end, which is past `consumed`
            // whenever a cooperating writer's bytes have not been
            // ingested yet — and stamping `consumed` on the line then
            // describes a position the line is not at, re-publishes this
            // line on the next ingest, and skips the external bytes in
            // between. An `fstat` on our own handle right after the write
            // is the cheapest true answer.
            const info = yield* file.stat;
            return ByteSize.toNumberUnsafe(info.size) - bomBytes;
          }),
        );
        const offset = end - bytes.length;

        // Whatever sits between our last ingest and where this line
        // actually landed belongs to another writer and PRECEDES ours in
        // the file, so it is decoded here and published first: the hub
        // carries one file-ordered sequence either way. A torn fragment at
        // the end of that gap is skipped rather than held, because our own
        // line has already been written after it and the offset cannot
        // wait for a writer that lost the race.
        //
        // Reading inside the write permit is legal under pin 1 and a hub
        // publish is not: the prohibition is on SUSPENDING ON A SUBSCRIBER
        // while holding the lock. A read completes on its own. It also
        // costs nothing in the common case, where the gap is empty and no
        // read is issued at all.
        const external = offset > consumed ? (yield* decodeRange(consumed, offset)).decoded : [];
        // Trust the file: on the (contract-breaching) shrink case this
        // moves backwards rather than pretending the line is somewhere it
        // is not. The watcher's own resync check is what names the breach.
        consumed = end;

        const line = LineSlice.make({
          offset,
          end,
          length: bytes.length - 1,
          text: Str.slice(0, -1)(encoded.success),
          terminated: true,
        });
        const decoded = Envelope.decodeResult(line, events);
        if (Result.isFailure(decoded)) {
          return yield* decoded.failure;
        }
        yield* SubscriptionRef.set(latest, O.some(decoded.success));

        // Link onto the publish chain while still holding the write
        // permit: that — and only that — is what fixes publish order to
        // write order. Nothing here suspends on the hub.
        const previous = publishBaton;
        const mine = Deferred.makeUnsafe<void>();
        publishBaton = mine;
        return { envelope: decoded.success, external, predecessor: previous, baton: mine };
      }),
    );

    // OUTSIDE the write permit. A full hub suspends here, which blocks this
    // appender (backpressure, by design) and every later publisher — but
    // not other writers, and not scope close.
    //
    // `uninterruptibleMask` closes the strand window: the `ensuring` is
    // installed before any interrupt can land, while `restore` keeps the
    // await-and-publish itself interruptible. Without it, an interrupt
    // arriving between the baton link and the handler's installation
    // would leave every later append waiting on a baton nobody passes.
    yield* Effect.uninterruptibleMask((restore) =>
      restore(
        Effect.gen(function* () {
          yield* Deferred.await(predecessor);
          // Anything that landed in the file ahead of this line goes into
          // the hub ahead of it too, so the sequence a subscriber sees is
          // the file's order however the bytes got there.
          for (const preceding of external) {
            yield* PubSub.publish(hub, [preceding]);
          }
          yield* PubSub.publish(hub, [envelope]);
        }),
      ).pipe(
        // The baton MUST be passed even on failure or interruption, or
        // every later append waits forever on a predecessor that will
        // never finish.
        Effect.ensuring(Deferred.done(baton, Exit.void)),
      ),
    );
    return envelope;
  });

  /**
   * Read the file from `cursor`, frame-filtered before payload decode.
   *
   * **Details**
   *
   * **What this actually does, as built**: ONE read of the requested region
   * — `cursor` to the end of the file, bounded by the file's size — whose
   * matching envelopes are buffered and then emitted. It is bounded by the
   * cursor, not by a window, so an unsliced read over a large journal holds
   * that journal in memory. The frame filter still runs per line before any
   * payload schema, so the filter-before-decode guarantee is untouched;
   * what is not true here is the "never held in memory" half.
   *
   * Paging this — read one window, emit its envelopes, carry the
   * unterminated tail into the next read — is spencerbeggs/effected#233,
   * rather than something attempted alongside the correctness fixes around
   * it.
   */
  const readFrom = (
    slice: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined,
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> =>
    Stream.unwrap(
      Effect.gen(function* () {
        yield* requireFile;
        const from = slice?.cursor ?? 0;
        const info = yield* fs.stat(config.path);
        const logicalSize = ByteSize.toNumberUnsafe(info.size) - bomBytes;
        if (from >= logicalSize) {
          return Stream.empty;
        }
        // One bounded read of the requested region, starting ONE BYTE
        // EARLIER than the cursor. That off-by-one is deliberate and
        // load-bearing: `readTail` discards through the first newline to
        // land on a line boundary, so a window beginning exactly AT a line
        // start would discard that whole line. Beginning one byte earlier
        // hands the discard rule the previous line's terminator instead, so
        // it consumes exactly that byte and lands on the cursor. A cursor
        // that is not at a line boundary degrades sanely: the partial line
        // it points into is skipped rather than half-decoded.
        const window = yield* readTail(fs, config.path, logicalSize - from + 1, bomBytes);
        const lines = Line.split(window.text);
        let selected = Chunk.empty<EnvelopeUnion<R>>();
        for (const line of lines) {
          if (Str.isEmpty(Str.trim(line.text))) continue;
          const rebased = LineSlice.make({
            offset: line.offset + window.start,
            end: line.end + window.start,
            length: line.length,
            text: line.text,
            terminated: line.terminated,
          });
          if (rebased.offset < from) continue;
          // FILTER BEFORE DECODE: `decodeSelectedResult` returns none
          // without ever reaching the payload schema when the frame does
          // not match.
          const decoded = Envelope.decodeSelectedResult(rebased, events, (frame) => matchesFrame(frame, slice));
          if (O.isNone(decoded)) continue;
          if (Result.isFailure(decoded.value)) {
            // A hole in the history is reported, never silently skipped.
            return Stream.concat(Stream.fromIterable(selected), Stream.fail(decoded.value.failure));
          }
          selected = Chunk.append(selected, decoded.value.success);
        }
        return Stream.fromIterable(selected);
      }),
    );

  /**
   * Envelope-level matching, for the live path.
   *
   * **Details**
   *
   * The frame-level {@link matchesFrame} is the one that carries the
   * filter-before-decode guarantee; this is its counterpart for envelopes
   * that arrived already decoded from the hub, where there is no decode left
   * to avoid.
   * The public read overloads require an events filter when T is narrower
   * than the registry. Without that filter they expose the complete union.
   */
  const matchesEnvelope = <T extends JsonlEvent.Tag<R>>(
    envelope: EnvelopeUnion<R>,
    slice: CursoredSlice<R, T> | undefined,
  ): envelope is EnvelopeWithTag<R, T> =>
    matchesFrame(
      {
        at: envelope.at,
        event: envelope.event,
        ...(envelope.scope === undefined ? {} : { scope: envelope.scope }),
        data: envelope.data,
      },
      slice,
    );

  const isTerminalEnvelope = (envelope: EnvelopeUnion<R>): boolean => HashSet.has(terminalTags, envelope.event);

  const changesStream = (
    slice: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined,
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> =>
    Stream.unwrap(
      Effect.gen(function* () {
        // Quiescent already? A terminal Exit published before this
        // subscriber attached is invisible to it — a hub has no replay — so
        // without this check the stream would wait for an event that has
        // already happened. Ending here is what makes "terminates rather
        // than hangs" true.
        const alreadyQuiescent = yield* isTerminalTail;
        const replay = slice?.cursor === undefined ? Stream.empty : readFrom(slice);
        if (alreadyQuiescent || closed) {
          return replay;
        }
        // SUBSCRIBE BEFORE REPLAYING, and do it here rather than through
        // `Stream.fromPubSubTake`. That constructor subscribes on its first
        // pull, which `Stream.concat` does not reach until the replay has
        // finished — and a hub has no replay of its own, so every append
        // published while the history was being read was dropped on the
        // floor. Subscribing in the effect the stream is unwrapped from puts
        // the subscription strictly before the first byte is read; the scope
        // is the stream's own, so it is released with the stream.
        const subscription = yield* PubSub.subscribe(hub);
        // The overlap that early subscription creates, and the reason the
        // join still cannot duplicate: a line can be on disk when the replay
        // reads it AND still in flight to the hub, so it arrives twice.
        // Offsets are monotonic in file order, so the last replayed `end` is
        // exactly the boundary between "already delivered" and "new".
        let replayedThrough = slice?.cursor ?? 0;
        const history = replay.pipe(
          Stream.tap((envelope) =>
            Effect.sync(() => {
              replayedThrough = Math.max(replayedThrough, envelope.line.end);
            }),
          ),
        );
        const live = subscription.pipe(
          PubSub.take,
          Channel.fromEffectTake,
          Stream.fromChannel,
          // The terminal envelope ends THIS subscription, whatever the
          // slice says: the journal is finished, so there is nothing more
          // to wait for. `takeUntil` runs before the slice filter so a
          // terminal event that the slice excludes still ends the stream —
          // but is not delivered. It also runs before the de-duplication
          // filter, so a terminal envelope that the replay already
          // delivered still ends the stream rather than being dropped and
          // leaving the subscriber waiting on a journal that is over.
          Stream.takeUntil(isTerminalEnvelope),
          Stream.filter((envelope) => envelope.line.offset >= replayedThrough),
        );
        // ONE seam: history and tail are the same stream, filtered the same
        // way downstream, so a consumer cannot see a gap or a duplicate at
        // the join.
        return Stream.concat(history, live);
      }),
    );

  const identityOf = (info: FileSystem.File.Info): O.Option<string> => O.map(info.ino, (ino) => `${info.dev}:${ino}`);

  /**
   * Ingest whatever has been appended since `consumed`, publishing it into
   * the SAME hub, `latest` and projections as a local append.
   *
   * **Details**
   *
   * Runs under the write permit and links the publish baton exactly as
   * `appendWith` does, so external and local envelopes enter the hub in FILE
   * order as one interleaved sequence — a subscriber cannot tell them apart,
   * including by ordering.
   */
  /**
   * Serializes ingests against each other.
   *
   * **Details**
   *
   * Once the catch-up read stopped being the only ingest, a catch-up can run
   * concurrently with an event-driven one — and `ingest` reads `consumed`,
   * then writes it only after publishing, so two overlapping runs can read
   * the same offset and publish the same lines twice. Its own lock rather
   * than the write permit: an append must not be blocked behind a slow
   * catch-up read of a large file.
   */
  const ingestPermit = Semaphore.makeUnsafe(1);

  const ingest = ingestPermit.withPermits(1)(
    Effect.gen(function* () {
      const present = yield* exists();
      if (!present) {
        return;
      }
      const info = yield* fs.stat(config.path);
      const currentIdentity = identityOf(info);
      const logicalSize = ByteSize.toNumberUnsafe(info.size) - bomBytes;

      // Contract breach: the file shrank below what we read, or the path now
      // names a different file. Surfaced, never silently reconciled.
      const replaced = O.isSome(identity) && O.isSome(currentIdentity) && identity.value !== currentIdentity.value;
      if (replaced || logicalSize < consumed) {
        const failure = JournalResync.make({
          path: config.path,
          reason: replaced ? "replaced" : "truncated",
          expected: consumed,
          actual: logicalSize,
        });
        // Re-arm against the NEW file before surfacing: a node watcher follows
        // the inode, so after a replace the old watch is attached to a file
        // nobody writes to and is silently dead. Raising the error without
        // this leaves the journal permanently blind.
        identity = currentIdentity;
        bomBytes = yield* probeBomBytes(fs, config.path);
        consumed = 0;
        yield* SubscriptionRef.set(latest, O.none());
        yield* PubSub.publish(hub, Exit.fail(failure));
        return;
      }
      identity = currentIdentity;
      if (logicalSize <= consumed) {
        return;
      }

      const { envelopes, predecessor, baton } = yield* writePermit.withPermits(1)(
        Effect.gen(function* () {
          // Re-read under the permit: a local append may have advanced
          // `consumed` while we were waiting for it, and may have taken the
          // pending bytes with it.
          // An empty range decodes to nothing rather than needing a guard.
          const from = consumed;
          const { decoded, advanced } = yield* decodeRange(from, logicalSize);
          consumed = advanced;
          const last = A.last(decoded);
          if (O.isSome(last)) {
            yield* SubscriptionRef.set(latest, last);
          }
          const previous = publishBaton;
          const mine = Deferred.makeUnsafe<void>();
          publishBaton = mine;
          return { envelopes: decoded, predecessor: previous, baton: mine };
        }),
      );

      yield* Effect.uninterruptibleMask((restore) =>
        restore(
          Effect.gen(function* () {
            yield* Deferred.await(predecessor);
            for (const envelope of envelopes) {
              yield* PubSub.publish(hub, [envelope]);
            }
          }),
        ).pipe(Effect.ensuring(Deferred.done(baton, Exit.void))),
      );
    }),
  );

  function append<T extends JsonlEvent.Tag<R>>(
    event: T,
    data: JsonlEvent.Data<R, NoInfer<T>>,
    options?: AppendOptions,
  ): Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;
  function append(
    event: JsonlEvent.Tag<R>,
    data: unknown,
    options?: AppendOptions,
  ): Effect.Effect<EnvelopeUnion<R>, JournalWriteError> {
    return appendWith(event, () => data, options?.scope);
  }

  function appendPatch<T extends JsonlEvent.Tag<R>>(
    event: T,
    patch: Partial<JsonlEvent.Data<R, NoInfer<T>>>,
    options?: AppendOptions,
  ): Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;
  function appendPatch(
    event: JsonlEvent.Tag<R>,
    patch: unknown,
    options?: AppendOptions,
  ): Effect.Effect<EnvelopeUnion<R>, JournalWriteError> {
    return appendWith(
      event,
      (current) => {
        const base = O.isSome(current) ? current.value.data : undefined;
        // The record guards establish the merge inputs; canMerge checks the
        // prototype compatibility of the patch. Encoding validates the result.
        return isRecordLike(base) && isRecordLike(patch) && canMerge(base, patch) ? shallowMerge(base, patch) : patch;
      },
      options?.scope,
    );
  }

  function query<T extends JsonlEvent.Tag<R>>(
    slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> },
  ): Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;
  function query(
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>,
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError>;
  function query(
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>,
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> {
    return readFrom(slice).pipe(Stream.filter((envelope) => matchesEnvelope(envelope, slice)));
  }

  function changes<T extends JsonlEvent.Tag<R>>(
    slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> },
  ): Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;
  function changes(
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>,
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError>;
  function changes(
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>,
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> {
    return changesStream(slice).pipe(Stream.filter((envelope) => matchesEnvelope(envelope, slice)));
  }

  function projection<State, T extends JsonlEvent.Tag<R>>(
    initial: State,
    fold: (state: State, envelope: EnvelopeWithTag<R, NoInfer<T>>) => State,
    slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> },
  ): Stream.Stream<State, JournalReadError | JsonlError>;
  function projection<State>(
    initial: State,
    fold: (state: State, envelope: EnvelopeUnion<R>) => State,
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>,
  ): Stream.Stream<State, JournalReadError | JsonlError>;
  function projection<State, T extends JsonlEvent.Tag<R>>(
    initial: State,
    fold: (state: State, envelope: EnvelopeWithTag<R, T>) => State,
    slice?: CursoredSlice<R, T>,
  ): Stream.Stream<State, JournalReadError | JsonlError> {
    return changesStream(slice).pipe(
      Stream.filter((envelope): envelope is EnvelopeWithTag<R, T> => matchesEnvelope(envelope, slice)),
      Stream.scan(() => initial, fold),
    );
  }

  const shape: JournalShape<R> = {
    append,
    appendPatch,
    latest,
    quiescent: isTerminalTail,
    query,
    changes,
    projection,
    create: Effect.gen(function* () {
      const present = yield* exists();
      if (!present) {
        // Opening with `O_APPEND` creates the file; nothing is written.
        // Do NOT `writeAll(new Uint8Array(0))` to "touch" it — a zero-byte
        // write returns 0 bytes, which `writeAll`'s loop reports as a
        // stalled write (`WriteZero`), so the create fails on a file it
        // just successfully created.
        yield* Effect.scoped(fs.open(config.path, { flag: "a" }));
      }
    }),
    remove: fs.remove(config.path, { force: true }),
    hub,
  };

  // Seed `latest` from whatever is already on disk, and set the append
  // cursor past it. A missing file is legal here: layer construction must
  // never fail on one.
  const present = yield* exists();
  if (present) {
    bomBytes = yield* probeBomBytes(fs, config.path);
    // Narrowed to JournalNotFound only: a permissions error or a bad handle
    // must NOT present as an empty journal. Anything other than "the file
    // vanished between the check and the read" is a real failure.
    yield* refresh.pipe(Effect.catchTag("JournalNotFound", () => Effect.succeedNone));
    const info = yield* fs.stat(config.path);
    // LOGICAL, post-BOM — the same space every offset this package emits
    // lives in. Seeding it physically put every subsequent append's offset
    // three bytes out on a BOM'd journal.
    consumed = ByteSize.toNumberUnsafe(info.size) - bomBytes;
    // Detect replacement even before the supervisor's first catch-up read.
    identity = identityOf(info);
  }

  /**
   * Watch for the life of the layer scope.
   *
   * **Details**
   *
   * Two watches, and the distinction matters:
   *
   * - **The journal itself**, once it exists. Steady state, one `Update` per
   *   append, and the tags are trustworthy here.
   * - **The parent directory**, while the journal does not exist yet. The
   *   tags are NOT trustworthy at this edge — on the installed node backend a
   *   creation and an append both arrive as `Remove`, with a bare relative
   *   `path` — so this watch **never branches on `WatchEvent._tag`**. Any
   *   event whose path BASENAME matches the journal filename is an untyped
   *   poke meaning "re-stat the journal yourself".
   *
   * The directory watch is an **activation** watch and nothing more: it ends
   * as soon as the journal exists, and the supervisor then arms the file
   * watch. Staying on it would be silently wrong rather than merely
   * redundant — a non-recursive directory watch reports creation, not a
   * child's later content appends, so a journal that never handed off would
   * observe its own appends and no external ones.
   *
   * `event.path` is **never** used to open or read anything, on either watch.
   * It can be a bare basename that resolves against the process CWD; the
   * journal's own configured path is the only path this service touches. The
   * symptom of violating that is a phantom `JournalNotFound` on a healthy
   * journal.
   *
   * No timer anywhere. Activation is event-driven.
   */
  const basename = basenameOf(config.path);
  const directory = config.directory ?? parentOf(config.path);

  const watchJournal = fs.watch(config.path).pipe(
    // The event is a poke, never a source of paths. Re-stat and ingest.
    Stream.runForEach(() => ingest),
    Effect.ignore,
  );

  const watchForCreation = fs.watch(directory).pipe(
    Stream.filter((event) => basenameOf(event.path) === basename),
    // END once the journal exists. A directory watch reports creation, not a
    // child's later content appends, so staying on it after activation
    // leaves the journal silently blind to external growth. Ending here is
    // what returns control to the supervisor loop, which then arms the FILE
    // watch. `takeUntilEffect` runs before the ingest below, and the element
    // that satisfies it is still emitted, so the creation event that ends
    // this watch is also the one that catches the journal up.
    Stream.takeUntilEffect(() => exists()),
    Stream.runForEach(() => ingest),
    Effect.ignore,
  );

  const supervise = Effect.gen(function* () {
    // Activate over a missing file without a rebuild and without polling:
    // watch the directory until the journal appears, then watch the journal.
    // `fs.watch` stats first and fails on a missing path, which is exactly
    // why the two cases are separate rather than one call.
    //
    // The re-arm loop is BOUNDED against a watch that ends or fails
    // immediately. Looping unconditionally on such a watch is a hot spin —
    // and since no timer is permitted here, backing off is not an option, so
    // the honest behaviour is to stop re-arming and let local appends carry
    // on without live observation rather than burn a core forever.
    let immediateCompletions = 0;
    for (;;) {
      const startedAt = consumed;
      const present = yield* exists();
      if (present) {
        // ARM FIRST, THEN CATCH UP. The reverse order — catch up, then arm —
        // leaves a window in which the file can grow while nothing is
        // watching and nothing will re-read, so the write stays invisible
        // until some LATER event happens to trigger another ingest. In a
        // quiet journal that is hours, and it presents as a stale `latest`
        // and a silently idle subscription. Real consumer-visible staleness,
        // not a test artifact.
        //
        // `fs.watch` exposes no "registered" signal — `Stream.onStart` fires
        // before acquisition and `Stream.toQueue` does not register eagerly
        // (both measured) — so establishment is ordered by forking the
        // consumer and yielding to it before the catch-up runs. Registration
        // happens on the consumer's first pull, which the yield guarantees
        // has been scheduled.
        const armed = yield* Effect.forkChild(watchJournal);
        // Yield to the forked consumer so it reaches its first pull, which is
        // when registration happens.
        //
        // HONEST LIMITATION, do not read this as a guarantee: `fs.watch`
        // exposes no "registered" signal, so this ORDERS by scheduling
        // rather than by synchronisation. Measured: `Stream.toQueue` does not
        // register eagerly, and `Stream.onStart` fires BEFORE acquisition —
        // neither is a hook. One yield was not enough and the arming-window
        // test caught it; this many is empirically sufficient here, which
        // makes it a heuristic, not a proof.
        //
        // The one primitive that would make this airtight is
        // `FileSystem.WatchBackend.register(path, stat)`, which registers
        // synchronously and returns the stream — at the cost of putting
        // `WatchBackend` in this layer's `R`.
        for (let turn = 0; turn < ARM_YIELDS; turn++) {
          yield* Effect.yieldNow;
        }
        // Redundant when nothing changed: `ingest` early-returns on
        // `logicalSize <= consumed`, so paying for it here is free.
        yield* ingest;
        yield* Fiber.join(armed);
        // The journal watch ended — the file was replaced or removed. Loop
        // back and re-arm, because a node watcher follows the inode and the
        // old registration is now attached to a file nobody writes to.
        yield* ingest;
      } else {
        yield* watchForCreation;
      }
      immediateCompletions = consumed === startedAt ? immediateCompletions + 1 : 0;
      if (immediateCompletions > MAX_IMMEDIATE_REARMS) {
        return;
      }
    }
  });

  // Ignored deliberately, and the cost is stated: if the watch cannot be
  // established the journal keeps working for local appends and simply stops
  // observing external ones. Failing the layer instead would violate the
  // missing-journal contract, which requires construction to succeed.
  yield* Effect.forkScoped(supervise.pipe(Effect.ignore));

  // Graceful shutdown, as TWO mechanisms. Refusal is the flag above, checked
  // before the permit and failing typed. Drain is here: taking the permit
  // waits for the in-flight append to finish, and only then is the terminal
  // Exit published — so the last accepted append is on disk and visible to
  // subscribers before their streams end.
  yield* Effect.addFinalizer(() =>
    Effect.gen(function* () {
      closed = true;
      // Drain the write half AND capture the tail of the publish chain under
      // the same permit. Reading `publishBaton` here is a consistent
      // snapshot precisely because it is only ever mutated while holding
      // this permit.
      //
      // Capturing it is the whole point: once publishing moved out of the
      // write critical section, "writes drained" stopped implying
      // "publishes drained" — and the terminal Exit, which is NOT on the
      // baton chain, could overtake an envelope whose append had already
      // completed. A subscriber would see the stream end before the last
      // line it was promised.
      const pending = yield* writePermit.withPermits(1)(Effect.sync(() => publishBaton));

      // Await the outstanding publishes, THEN end the stream. Both halves
      // share one bound: a subscriber that never consumes cannot observe
      // completion by definition and must not hold scope close hostage, so
      // the ordering guarantee is offered to consuming subscribers only.
      // An interruptible region inside an otherwise-uninterruptible
      // finalizer is what lets the timeout fire at all.
      yield* Effect.interruptible(
        Effect.gen(function* () {
          yield* Deferred.await(pending);
          yield* PubSub.publish(hub, Exit.void);
        }),
      ).pipe(Effect.timeout(config.shutdownPublishTimeout ?? SHUTDOWN_PUBLISH_TIMEOUT), Effect.ignore);
    }),
  );

  return shape;
});

/**
 * A per-registry `Journal` service class.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface JournalClass<Self, Id extends string, R extends JsonlEvent.Registry>
  extends Context.ServiceClass<Self, Id, JournalShape<R>> {
  /** The registry this journal was defined over. */
  readonly events: R;
  /**
   * Build the layer for this journal.
   *
   * **Construction can fail with a `PlatformError`, and that is deliberate.** A
   * journal file that does not exist yet is a legal state and constructs
   * cleanly — but a file that exists and cannot be read (`EACCES`, a bad
   * handle) is a real failure, and typing this channel `never` would have made
   * it arrive as an untypeable defect that no caller could catch.
   *
   * **Bind the result to a const and provide that const.** Layers are memoized
   * **Details**
   *
   * by reference, so calling this twice mints **two independent journals over
   * one file** — two semaphores, two hubs, two `latest` refs — and their
   * appends are not serialized against each other. That is the in-process form
   * of exactly the interleaving the cooperative-writer rules exist to prevent,
   * and it typechecks perfectly.
   *
   * **Example** (Share one journal layer across consumers)
   *
   * ```ts
   * import { $ScratchpadId } from "@beep/identity/packages";
   * import { Journal, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
   * import { Effect } from "effect";
   * import * as Layer from "effect/Layer";
   * import * as S from "effect/Schema";
   * const $I = $ScratchpadId.create("examples/jsonl/layer");
   * class MailJournal extends Journal.Service<MailJournal>()($I`MailJournal`, {
   *   events: [JsonlEvent.make("started", { data: S.String })],
   * }) {}
   * const layer = MailJournal.layer({ path: "/mail.jsonl" }).pipe(Layer.provide(MemoryFileSystem.layer));
   * const program = Effect.gen(function* () {
   *   const journal = yield* MailJournal;
   *   yield* journal.create;
   *   const envelope = yield* journal.append("started", "ready");
   *   envelope.data // => "ready"
   * });
   * await Effect.runPromise(Effect.provide(program, layer));
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  readonly layer: (config: JournalConfig) => Layer.Layer<Self, PlatformError.PlatformError, FileSystem.FileSystem>;
}

/**
 * Define a `Journal` service class over a registry.
 *
 * **Details**
 *
 * A `Context.Service` cannot itself be generic over the registry — the shape
 * binds at declaration and a Key cannot be parameterized at retrieval — so each
 * registry gets its own uniquely-keyed class, and several journals coexist in
 * one layer graph with each one's operations typed by *its* registry. This
 * preserves the caller-provided Self identity in the same way as Effect RPC
 * service classes and Schema.Class.
 *
 * Pass the registry as `options.events`; the returned class exposes it as
 * `events` and builds the scoped layer with `.layer(config)`.
 *
 * **Example** (Define a registry-specific service)
 * ```ts
 * import { $ScratchpadId } from "@beep/identity/packages";
 * import { Journal, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
 * import * as S from "effect/Schema";
 * const $I = $ScratchpadId.create("examples/jsonl");
 * class MailJournal extends Journal.Service<MailJournal>()($I`MailJournal`, {
 *   events: [JsonlEvent.make("started", { data: S.Void })],
 * }) {}
 * export const layer = MailJournal.layer({ path: "mail.jsonl" });
 * MailJournal.events[0].tag // => "started"
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export const Journal = {
  Service:
    <Self>() =>
    <const Id extends string, const R extends JsonlEvent.Registry>(
      id: Id,
      options: { readonly events: R },
    ): JournalClass<Self, Id, R> => {
      const key = Context.Service<Self, JournalShape<R>>()(id);
      // Augment the constructor itself: a spread would lose Context's
      // inherited service protocol, while an intermediate subclass would
      // introduce a different Self from the caller's class.
      return Object.assign(key, {
        events: options.events,
        layer: (config: JournalConfig): Layer.Layer<Self, PlatformError.PlatformError, FileSystem.FileSystem> =>
          Layer.effect(
            key,
            Effect.flatMap(FileSystem.FileSystem, (fs) => makeEngine(options.events, config, fs)),
          ),
      });
    },
};
