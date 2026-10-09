/**
 * Typed journal services, subscriptions and schema-backed configuration.
 * @packageDocumentation
 * @since 0.0.0
 */
// The `Journal` service: one append-only, schema-validated JSONL file.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
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
import * as O from "@beep/utils/Option";
import type * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as PubSub from "effect/PubSub";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import type * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as Tuple from "effect/Tuple";
import type * as Take from "effect/Take";
import { utf8Length } from "./internal/utf8.ts";
import type { EnvelopeUnion, EnvelopeWithTag } from "./Envelope.ts";
import { Envelope } from "./Envelope.ts";
import { canMerge, isRecordLike, shallowMerge } from "./internal/merge.ts";
import type { TailWindow } from "./internal/tail.ts";
import {
  DEFAULT_WINDOW,
  handleBomBytes,
  probeBomBytes,
  readRangeWindow,
  readSampledWindow,
  readTailUntil,
} from "./internal/tail.ts";
import type { InvalidData, JsonlError, MalformedLine, UnknownEvent, UnserializableData } from "./JsonlError.ts";
import {
  InvalidJournalConfig,
  InvalidUtf8,
  JournalUnterminated,
  InvalidSlice,
  JournalClosed,
  JournalNotFound,
  JournalResync,
  JournalResyncReason,
  JournalWriteConflict,
  TerminalViolation,
} from "./JsonlError.ts";
import type { JsonlEvent } from "./JsonlEvent.ts";
import { Line } from "./Line.ts";
import { LineSlice } from "./LineSlice.ts";
import { CursoredSlice, matchesFrame } from "./Slice.ts";
import { flow } from "effect/Function";

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
  | JournalResync
  | JournalWriteConflict
  | JournalUnterminated
  | InvalidUtf8
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
export type JournalReadError = JournalNotFound | InvalidSlice | InvalidUtf8 | PlatformError.PlatformError;

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
  $I.annote("AppendOptions", { description: "Partition selection for one append." })
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
   * Completed foreign records are reconciled before terminal validation.
   * An unterminated physical tail fails with `JournalUnterminated` without repairing bytes.
   * Committed invalid UTF-8 fails with `InvalidUtf8` without replacing source bytes.
   * Unexpected post-write growth fails with `JournalWriteConflict`: bytes may
   * already be present, so reconcile the file before deciding whether to retry.
   */
  readonly append: <T extends JsonlEvent.Tag<R>>(
    event: T,
    data: JsonlEvent.Data<R, NoInfer<T>>,
    options?: AppendOptions | undefined
  ) => Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;

  /**
   * Inherit-and-patch: read the last valid envelope, shallow-merge `patch`
   * over its `data`, validate the result and append it.
   *
   * **Details**
   *
   * This is the snapshot-journal primitive — each line is a complete state and
   * most transitions change one field. The merge is **shallow** by decision: a
   * nested object in the patch replaces the one beneath it. The base includes
   * completed foreign records observed before this local critical section.
   * Independent writers do not share this semaphore; their read-modify-write
   * transactions require a separate coordination mechanism.
   */
  readonly appendPatch: <T extends JsonlEvent.Tag<R>>(
    event: T,
    patch: Partial<JsonlEvent.Data<R, NoInfer<T>>>,
    options?: AppendOptions | undefined
  ) => Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;

  /**
   * The current last valid **terminated envelope**, as an observable `Option`.
   *
   * **Details**
   *
   * "Last valid" always means the last valid envelope, never merely the last
   * valid JSON — a torn scalar tail parses as a different value and only the
   * envelope contract detects it. Unterminated envelopes remain pending until
   * their writer supplies a line terminator, including terminal events.
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
   * Invalid slices fail with `InvalidSlice`. Unterminated suffixes remain
   * pending until their writer completes them; terminated corruption fails
   * the read. One end-of-file boundary is captured and the file is opened
   * once; complete records are then emitted in bounded pages read through
   * that one handle. A record larger than the default window widens its page
   * until that record fits; memory is bounded by a page or the largest record,
   * rather than the full journal. Invalid committed UTF-8 fails with
   * `InvalidUtf8` without altering source bytes.
   *
   * **Gotchas**
   *
   * Paging makes a change beneath an in-flight read observable, where a single
   * whole-region read would not be. A file renamed over the path after the
   * range was sampled cannot reach the pinned handle, so the read keeps
   * returning the sampled history. A file truncated beneath the read fails
   * with `JournalResync` (truncated) once a page finds fewer bytes than were
   * sampled, after the records of the earlier pages have been emitted.
   */
  readonly query: {
    <T extends JsonlEvent.Tag<R>>(
      slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> }
    ): Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;
    (
      slice?: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined
    ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError>;
  };

  /**
   * Live read: a `Stream` of matching envelopes as they are appended.
   *
   * **Details**
   *
   * With a `cursor`, replay-from-cursor and the live tail are **one seam**: the
   * replayed history and the live tail are the same stream, filtered the same
   * way, so a consumer cannot observe a gap or a duplicate at the join. Both
   * halves compare the cursor at-or-after against a line's start offset, so a
   * cursor beyond the current end delivers nothing until a line starts at or
   * after it.
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
      slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> }
    ): Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;
    (
      slice?: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined
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
      slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> }
    ): Stream.Stream<S, JournalReadError | JsonlError>;
    <S>(
      initial: S,
      fold: (state: S, envelope: EnvelopeUnion<R>) => S,
      slice?: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined
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
 * The duration strings `Duration.fromInput` parses: a signed decimal, whitespace
 * and a unit, or a signed `Infinity`. The grammar mirrors Effect's own parser,
 * so every string admitted here decodes into a `Duration`.
 */
const DURATION_STRING =
  /^(?:-?Infinity|-?\d+(?:\.\d+)?\s+(?:nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?))$/;

/** Text in the duration-string grammar; also the generation source for its arbitrary. */
const DurationText = S.String.check(S.isPattern(DURATION_STRING));
const isDurationText = S.is(DurationText);

/** The string members of `Duration.Input`. */
type DurationString = Extract<Duration.Input, string>;

const DurationString = S.declare((input: unknown): input is DurationString => isDurationText(input))
  .annotate({
    toCodecArbitrary: () => S.link<DurationString>()(DurationText, SchemaTransformation.passthroughSupertype()),
  })
  .pipe(
    $I.annoteSchema("DurationString", {
      description: "A duration string accepted by Duration.fromInput, including signed decimals and infinities.",
    })
  );

/**
 * Any JavaScript number. `Duration.Input` deliberately admits `NaN` and the
 * infinities (`Infinity` milliseconds is an unbounded wait), so this is not a
 * finite domain number; generation draws from finite numbers.
 */
const DurationNumber = S.declare(P.isNumber)
  .annotate({ toCodecArbitrary: () => S.link<number>()(S.Finite, SchemaTransformation.passthrough()) })
  .pipe(
    $I.annoteSchema("DurationNumber", {
      description: "A JavaScript number, including the special values Duration.fromInput accepts.",
    })
  );

/** The object member of `Duration.Input`; every component is optional and additive. */
const DurationObject = S.Struct({
  weeks: S.optional(DurationNumber),
  days: S.optional(DurationNumber),
  hours: S.optional(DurationNumber),
  minutes: S.optional(DurationNumber),
  seconds: S.optional(DurationNumber),
  milliseconds: S.optional(DurationNumber),
  microseconds: S.optional(DurationNumber),
  nanoseconds: S.optional(DurationNumber),
}).annotate(
  $I.annote("DurationObject", { description: "Additive duration components accepted by Duration.fromInput." })
);

/**
 * Every `Duration.Input` shape: a `Duration`, milliseconds, bigint nanoseconds,
 * a `[seconds, nanos]` tuple, a duration string or a duration object.
 */
const DurationInput = S.Union([
  S.Duration,
  DurationNumber,
  S.BigInt,
  S.Tuple([DurationNumber, DurationNumber]),
  DurationString,
  DurationObject,
]).annotate($I.annote("DurationInput", { description: "Every input shape Duration.fromInput accepts." }));

/**
 * A `Duration.Input` decoded into a `Duration`.
 *
 * **Details**
 *
 * The union admits every input shape, but `Duration.fromInput` still refuses
 * some well-shaped values: a tuple or object whose nanosecond total overflows
 * to a non-finite number cannot become a bigint. Those fail the decode with an
 * issue rather than escaping as a `RangeError` defect.
 */
const DurationFromInput = DurationInput.pipe(
  S.decodeTo(
    S.Duration,
    SchemaTransformation.transformEffect<Duration.Duration, typeof DurationInput.Type>({
      decode: (input, options) =>
        Effect.fromOption(
          Duration.fromInput(input),
          () => new SchemaIssue.InvalidValue({ expected: "a Duration.Input that converts" }, input, options)
        ),
      encode: Effect.succeed,
    })
  )
);

/** Subscriber hub capacity: a positive integer. */
const Capacity = S.Int.check(S.isGreaterThan(0)).annotate(
  $I.annote("JournalCapacity", { description: "A positive integer subscriber hub capacity." })
);

/**
 * Configuration for one journal layer.
 *
 * **Details**
 *
 * Optional keys follow upstream omission semantics: an explicitly `undefined`
 * key behaves exactly like an omitted one. `shutdownPublishTimeout` accepts any
 * `Duration.Input` (a `Duration`, milliseconds or a string such as
 * `"100 millis"`); the layer decodes it into a `Duration`, and an input
 * Effect cannot convert fails construction with `InvalidJournalConfig`.
 *
 * **Example** (Bound journal shutdown)
 * ```ts import.meta.vitest name="Bound journal shutdown"
 * import { JournalConfig } from "@beep/scratchpad/effected/jsonl/index";
 * import * as Duration from "effect/Duration";
 * const config = JournalConfig.make({ path: "events.jsonl", shutdownPublishTimeout: Duration.seconds(2) });
 * config.path // => "events.jsonl"
 * const input = JournalConfig.make({ path: "events.jsonl", shutdownPublishTimeout: "2 seconds" });
 * input.shutdownPublishTimeout // => "2 seconds"
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
  directory: S.optional(S.String),
  /** Backpressured subscriber capacity; defaults to 64. */
  capacity: S.optional(Capacity),
  /** Bound on graceful shutdown publication, as any Duration.Input; defaults to five seconds. */
  shutdownPublishTimeout: S.optional(DurationInput),
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

// Decoding a JournalConfig: a missing or undefined optional key takes its
// default, and the shutdown bound becomes a Duration.
const JournalSettings = S.Struct({
  ...JournalConfig.fields,
  capacity: Capacity.pipe(S.withDecodingDefault(Effect.succeed(64))),
  shutdownPublishTimeout: DurationFromInput.pipe(S.withDecodingDefaultType(Effect.succeed(SHUTDOWN_PUBLISH_TIMEOUT))),
}).annotate(
  $I.annote("JournalSettings", { description: "Validated journal settings with buffering and shutdown defaults." })
);
const decodeSettings = S.decodeEffect(JournalSettings);

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
    O.getOrElse(Str.lastIndexOf("\\")(path), () => -1)
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

const textEncoder = new TextEncoder();

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
    line: LineSlice.rebase(envelope.line, window.start),
  }));

const makeEngine = Effect.fn("Journal.makeEngine")(function* <R extends JsonlEvent.Registry>(
  events: R,
  config: typeof JournalSettings.Type,
  fs: FileSystem.FileSystem
): Effect.fn.Return<JournalShape<R>, PlatformError.PlatformError | InvalidUtf8, Scope.Scope> {
  const terminalTags = HashSet.fromIterable(
    A.map(
      A.filter(events, (event) => event.terminal),
      (event) => event.tag
    )
  );
  const reopenTags = HashSet.fromIterable(
    A.map(
      A.filter(events, (event) => event.reopen),
      (event) => event.tag
    )
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
  const hub = yield* PubSub.bounded<Take.Take<EnvelopeUnion<R>, JsonlError>>(config.capacity);
  const latest = yield* SubscriptionRef.make(O.none<EnvelopeUnion<R>>());
  /** Refusal state. Read before the permit so a late append fails fast. */
  let closed = false;
  /** Logical bytes decoded so far — the resume cursor the watcher advances. */
  let consumed = 0;

  const exists = fs.exists(config.path);

  const requireFile = Effect.gen(function* () {
    const present = yield* exists;
    if (!present) {
      return yield* JournalNotFound.make({ path: config.path });
    }
  });

  const readLatest = Effect.gen(function* () {
    yield* requireFile;
    return yield* readTailUntil(
      fs,
      config.path,
      bomBytes,
      (window) => decodeWindow(events, window),
      DEFAULT_WINDOW,
      true
    );
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
  const decodeRange = Effect.fn("Journal.decodeRange")(function* (from: number, to: number) {
    const window = yield* readRangeWindow(fs, config.path, from + bomBytes, to - from, bomBytes);
    const advanced = window.start + utf8Length(window.text);
    let decoded = Chunk.empty<EnvelopeUnion<R>>();
    for (const line of Line.split(window.text)) {
      if (Line.isBlank(line)) continue;
      const rebased = LineSlice.rebase(line, window.start);
      const envelope = Envelope.decodeResult(rebased, events);
      if (Result.isSuccess(envelope)) decoded = Chunk.append(decoded, envelope.success);
    }
    return {
      decoded: A.fromIterable(decoded),
      advanced,
      torn:
        advanced < window.size
          ? O.some(JournalUnterminated.make({ path: config.path, offset: advanced, end: window.size }))
          : O.none<JournalUnterminated>(),
    };
  });

  const identityOf = (info: FileSystem.File.Info): O.Option<string> => O.map(info.ino, (ino) => `${info.dev}:${ino}`);

  /**
   * The journal's BOM width and metadata, sampled through ONE handle.
   *
   * **Details**
   *
   * The width, the size and the identity then describe the same file. Probing
   * the path once for the BOM and again for the metadata can straddle a
   * rename-over: the old file's BOM width is paired with the replacement's
   * identity, so nothing looks replaced while every offset is three bytes off.
   */
  const sampleFile = Effect.scoped(
    Effect.gen(function* () {
      const sample = yield* fs.open(config.path, { flag: "r" });
      return Tuple.make(yield* handleBomBytes(sample), yield* sample.stat);
    })
  );

  // Caller owns writePermit. This stage changes state but never waits on a
  // subscriber. Both local writes and watch pokes reconcile through it.
  const reconcile = Effect.fn("Journal.reconcile")(function* (
    restore: <AX, EX, RX>(effect: Effect.Effect<AX, EX, RX>) => Effect.Effect<AX, EX, RX>
  ) {
    yield* restore(requireFile);
    const info = yield* restore(fs.stat(config.path));
    const currentIdentity = identityOf(info);
    const size = ByteSize.toNumberUnsafe(info.size);
    const replaced = O.isSome(identity) && O.isSome(currentIdentity) && identity.value !== currentIdentity.value;
    const shrank = size < consumed + bomBytes;
    const bom = replaced || shrank || O.isNone(identity) ? yield* restore(probeBomBytes(fs, config.path)) : bomBytes;
    const logicalSize = size - bom;
    if (replaced || shrank) {
      const failure = JournalResync.make({
        path: config.path,
        reason: replaced ? JournalResyncReason.Enum.replaced : JournalResyncReason.Enum.truncated,
        expected: consumed,
        actual: logicalSize,
      });
      yield* Effect.logWarning("Journal source requires resynchronization").pipe(
        Effect.annotateLogs({
          path: config.path,
          reason: failure.reason,
          expected: failure.expected,
          actual: failure.actual,
        })
      );
      identity = currentIdentity;
      bomBytes = bom;
      consumed = 0;
      yield* SubscriptionRef.set(latest, O.none());
      const entries: ReadonlyArray<Take.Take<EnvelopeUnion<R>, JsonlError>> = [Exit.fail(failure)];
      return {
        entries,
        failure: O.some<JournalResync | InvalidUtf8>(failure),
        torn: O.none<JournalUnterminated>(),
        size,
      };
    }
    bomBytes = bom;
    const reading = yield* restore(decodeRange(consumed, logicalSize)).pipe(
      Effect.map(Result.succeed),
      Effect.catchTag("InvalidUtf8", flow(Result.fail, Effect.succeed))
    );
    if (Result.isFailure(reading)) {
      const failure = reading.failure;
      const entries: ReadonlyArray<Take.Take<EnvelopeUnion<R>, JsonlError>> = [Exit.fail(failure)];
      return {
        entries,
        failure: O.some<JournalResync | InvalidUtf8>(failure),
        torn: O.none<JournalUnterminated>(),
        size,
      };
    }
    const range = reading.success;
    identity = currentIdentity;
    consumed = range.advanced;
    const last = A.last(range.decoded);
    if (O.isSome(last)) yield* SubscriptionRef.set(latest, last);
    const entries: ReadonlyArray<Take.Take<EnvelopeUnion<R>, JsonlError>> = A.map(range.decoded, (row) => [row]);
    return {
      entries,
      failure: O.none<JournalResync | InvalidUtf8>(),
      torn: range.torn,
      size,
    };
  });

  const publish = Effect.fn("Journal.publish")(function* (
    entries: ReadonlyArray<Take.Take<EnvelopeUnion<R>, JsonlError>>,
    predecessor: Deferred.Deferred<void>
  ) {
    yield* Deferred.await(predecessor);
    for (const entry of entries) yield* PubSub.publish(hub, entry);
  });

  /** Reconcile the actual tail before deriving or validating a local write. */
  const appendWith = Effect.fn("Journal.appendWith")(function* (
    event: string,
    build: (current: O.Option<EnvelopeUnion<R>>) => unknown,
    scope: string | undefined
  ): Effect.fn.Return<EnvelopeUnion<R>, JournalWriteError> {
    if (closed) return yield* JournalClosed.make({ event });
    const mine = Deferred.makeUnsafe<void>();
    // Install cleanup BEFORE the permit can link this deferred. This covers
    // interruption during permit release as well as suspended publication.
    return yield* Effect.gen(function* () {
      const staged = yield* writePermit.withPermits(1)(
        Effect.uninterruptibleMask(
          Effect.fn("Journal.stageAppend")(function* (restore) {
            if (closed) return yield* JournalClosed.make({ event });
            const state = yield* reconcile(restore);
            const outcome: Exit.Exit<EnvelopeUnion<R>, JournalWriteError> = O.isSome(state.failure)
              ? Exit.fail(state.failure.value)
              : yield* Effect.exit(
                  Effect.gen(function* () {
                    const current = yield* SubscriptionRef.get(latest);
                    if (
                      O.isSome(current) &&
                      HashSet.has(terminalTags, current.value.event) &&
                      !HashSet.has(reopenTags, event)
                    ) {
                      return yield* TerminalViolation.make({ event, terminal: current.value.event });
                    }
                    if (O.isSome(state.torn)) return yield* state.torn.value;
                    const at = yield* DateTime.now;
                    const encoded = Envelope.encodeResult<JsonlEvent.Registry>(
                      { event, data: build(current), at, ...O.getSomesStruct({ scope: O.fromUndefinedOr(scope) }) },
                      events
                    );
                    if (Result.isFailure(encoded)) return yield* encoded.failure;
                    const bytes = textEncoder.encode(encoded.success);
                    const decoded = Envelope.decodeResult(
                      LineSlice.make({
                        offset: 0,
                        end: bytes.length,
                        length: bytes.length - 1,
                        text: Str.slice(0, -1)(encoded.success),
                        terminated: true,
                      }),
                      events
                    );
                    if (Result.isFailure(decoded)) return yield* decoded.failure;
                    const actual = yield* restore(
                      Effect.scoped(
                        Effect.gen(function* () {
                          const file = yield* fs.open(config.path, { flag: "a" });
                          yield* file.writeAll(bytes);
                          return ByteSize.toNumberUnsafe((yield* file.stat).size);
                        })
                      )
                    );
                    const expected = state.size + bytes.length;
                    // EOF is shared by cooperating writers. Unexpected growth cannot
                    // prove our line's position; leave consumed at the known boundary
                    // so the next reconciliation reads the real file in its own order.
                    if (actual !== expected)
                      return yield* JournalWriteConflict.make({ path: config.path, expected, actual });
                    const line = LineSlice.make({
                      ...decoded.success.line,
                      offset: state.size - bomBytes,
                      end: actual - bomBytes,
                    });
                    const envelope = { ...decoded.success, line };
                    consumed = line.end;
                    yield* SubscriptionRef.set(latest, O.some(envelope));
                    return envelope;
                  })
                );
            const entries = Exit.isSuccess(outcome)
              ? A.append(state.entries, [outcome.value] satisfies Take.Take<EnvelopeUnion<R>, JsonlError>)
              : state.entries;
            const predecessor = publishBaton;
            publishBaton = mine;
            return { entries, predecessor, outcome };
          })
        )
      );
      yield* publish(staged.entries, staged.predecessor);
      return yield* staged.outcome;
    }).pipe(Effect.ensuring(Deferred.done(mine, Exit.void)));
  });

  const decodeSelection = S.decodeUnknownEffect(S.UndefinedOr(CursoredSlice(S.String)));
  const validateSelection = Effect.fn("Journal.validateSelection")((slice: unknown) =>
    decodeSelection(slice).pipe(Effect.mapError((error) => InvalidSlice.make({ error })))
  );

  /**
   * Read the file from `cursor`, frame-filtered before payload decode.
   *
   * **Details**
   *
   * Samples the BOM width, the file end and the identity through one handle,
   * then pins the file with a second handle whose identity must match the
   * sample, and reads bounded complete-record pages through it. A page widens
   * only when no complete record fits, including a cursor fragment. Frame
   * filtering still precedes payload decoding; a failed record follows all
   * earlier selected records in the stream.
   *
   * Upstream reads the whole sampled region in one allocation, which is a
   * snapshot by construction and holds the entire history in memory
   * (spencerbeggs/effected#233). Paging keeps memory bounded, so the snapshot
   * has to be kept explicitly: the handle pins the sampled file against a
   * replacement, and a page shorter than the sample fails `JournalResync`.
   */
  const readFrom = (
    input: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const slice = yield* validateSelection(input);
        yield* requireFile;
        const from = slice?.cursor ?? 0;
        // One handle supplies the BOM width, the size and the identity. With a
        // width from one file and a size from its replacement, a healthy first
        // record read as malformed.
        const [bom, info] = yield* sampleFile;
        const logicalSize = ByteSize.toNumberUnsafe(info.size) - bom;
        if (from >= logicalSize) {
          return Stream.empty;
        }
        // Pin the sampled file. Every page is read through this one handle, so
        // a file renamed over the path later cannot leak into the range, and
        // a truncation surfaces as a short page instead of an early end. A
        // replacement between the sample above and this open is caught here.
        const file = yield* fs.open(config.path, { flag: "r" });
        const pinned = yield* file.stat;
        const sampledIdentity = identityOf(info);
        const pinnedIdentity = identityOf(pinned);
        if (
          O.isSome(sampledIdentity) &&
          O.isSome(pinnedIdentity) &&
          sampledIdentity.value !== pinnedIdentity.value
        ) {
          // The replacement's logical size is measured with its own BOM width,
          // read through the handle that names it.
          return yield* JournalResync.make({
            path: config.path,
            reason: JournalResyncReason.Enum.replaced,
            expected: logicalSize,
            actual: Math.max(0, ByteSize.toNumberUnsafe(pinned.size) - (yield* handleBomBytes(file))),
          });
        }
        // Capture one absolute range. Growth after this snapshot must not
        // move its start or extend its end. The preceding byte establishes
        // whether the cursor is at a boundary or inside a partial line.
        const start = Math.max(0, from - 1);
        const readPage = (position: number, length: number) =>
          readSampledWindow(file, {
            path: config.path,
            from: position + bom,
            length,
            bomBytes: bom,
            sampledEnd: logicalSize,
            skipPartialLine: position === start && start > 0,
          });
        return Stream.paginate(
          start,
          Effect.fn("Journal.readPage")(function* (position) {
            let length = Math.min(DEFAULT_WINDOW, logicalSize - position);
            let window = yield* readPage(position, length);
            while (Str.isEmpty(window.text) && position + length < logicalSize) {
              length = Math.min(length * 2, logicalSize - position);
              window = yield* readPage(position, length);
            }
            const advanced = window.start + utf8Length(window.text);
            const next = advanced > position && advanced < logicalSize ? O.some(advanced) : O.none<number>();
            let selected = Chunk.empty<Result.Result<EnvelopeUnion<R>, JsonlError>>();
            for (const line of Line.split(window.text)) {
              if (Line.isBlank(line)) continue;
              const rebased = LineSlice.rebase(line, window.start);
              if (rebased.offset < from) continue;
              // Frame filtering precedes payload decoding on every page.
              const decoded = Envelope.decodeSelectedResult(rebased, events, (frame) => matchesFrame(frame, slice));
              if (O.isNone(decoded)) continue;
              selected = Chunk.append(selected, decoded.value);
              if (Result.isFailure(decoded.value)) return Tuple.make(Chunk.toReadonlyArray(selected), O.none<number>());
            }
            return Tuple.make(Chunk.toReadonlyArray(selected), next);
          })
        ).pipe(Stream.mapEffect(Effect.fromResult));
      })
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
    slice: CursoredSlice<R, T> | undefined
  ): envelope is EnvelopeWithTag<R, T> =>
    matchesFrame(
      {
        at: envelope.at,
        event: envelope.event,
        ...O.getSomesStruct({ scope: O.fromUndefinedOr(envelope.scope) }),
        data: envelope.data,
      },
      slice
    );

  const isTerminalEnvelope = (envelope: EnvelopeUnion<R>): boolean => HashSet.has(terminalTags, envelope.event);

  const changesStream = (
    input: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> =>
    Stream.unwrap(
      Effect.gen(function* () {
        yield* validateSelection(input);
        const slice = input;
        // Validation precedes subscription acquisition, including no-replay reads.
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
        // exactly the boundary between "already delivered" and "new". The
        // requested cursor is the starting boundary, so a live line starting
        // below it is filtered exactly as the replay filters it.
        let replayedThrough = slice?.cursor ?? 0;
        const history = replay.pipe(
          Stream.tap((envelope) =>
            Effect.sync(() => {
              replayedThrough = Math.max(replayedThrough, envelope.line.end);
            })
          )
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
          Stream.filter((envelope) => envelope.line.offset >= replayedThrough)
        );
        // ONE seam: history and tail are the same stream, filtered the same
        // way downstream, so a consumer cannot see a gap or a duplicate at
        // the join.
        return Stream.concat(history, live);
      })
    );

  const ingest = Effect.suspend(() => {
    const mine = Deferred.makeUnsafe<void>();
    return Effect.gen(function* () {
      const staged = yield* writePermit.withPermits(1)(
        Effect.uninterruptibleMask(
          Effect.fn("Journal.stageIngest")(function* (restore) {
            if (!(yield* restore(exists))) return O.none();
            const state = yield* reconcile(restore);
            const predecessor = publishBaton;
            publishBaton = mine;
            return O.some({ entries: state.entries, predecessor });
          })
        )
      );
      if (O.isSome(staged)) yield* publish(staged.value.entries, staged.value.predecessor);
    }).pipe(Effect.ensuring(Deferred.done(mine, Exit.void)));
  });

  function append<T extends JsonlEvent.Tag<R>>(
    event: T,
    data: JsonlEvent.Data<R, NoInfer<T>>,
    options?: AppendOptions
  ): Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;
  function append(
    event: JsonlEvent.Tag<R>,
    data: unknown,
    options?: AppendOptions
  ): Effect.Effect<EnvelopeUnion<R>, JournalWriteError> {
    return appendWith(event, () => data, options?.scope);
  }

  function appendPatch<T extends JsonlEvent.Tag<R>>(
    event: T,
    patch: Partial<JsonlEvent.Data<R, NoInfer<T>>>,
    options?: AppendOptions
  ): Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;
  function appendPatch(
    event: JsonlEvent.Tag<R>,
    patch: unknown,
    options?: AppendOptions
  ): Effect.Effect<EnvelopeUnion<R>, JournalWriteError> {
    return appendWith(
      event,
      (current) => {
        const base = O.isSome(current) ? current.value.data : undefined;
        // The record guards establish the merge inputs; canMerge checks the
        // prototype compatibility of the patch. Encoding validates the result.
        return isRecordLike(base) && isRecordLike(patch) && canMerge(base, patch) ? shallowMerge(base, patch) : patch;
      },
      options?.scope
    );
  }

  function query<T extends JsonlEvent.Tag<R>>(
    slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> }
  ): Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;
  function query(
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError>;
  function query(
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> {
    return readFrom(slice).pipe(Stream.filter((envelope) => matchesEnvelope(envelope, slice)));
  }

  function changes<T extends JsonlEvent.Tag<R>>(
    slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> }
  ): Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;
  function changes(
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError>;
  function changes(
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>
  ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> {
    return changesStream(slice).pipe(Stream.filter((envelope) => matchesEnvelope(envelope, slice)));
  }

  function projection<State, T extends JsonlEvent.Tag<R>>(
    initial: State,
    fold: (state: State, envelope: EnvelopeWithTag<R, NoInfer<T>>) => State,
    slice: CursoredSlice<R, T> & { readonly events: ReadonlyArray<T> }
  ): Stream.Stream<State, JournalReadError | JsonlError>;
  function projection<State>(
    initial: State,
    fold: (state: State, envelope: EnvelopeUnion<R>) => State,
    slice?: CursoredSlice<R, JsonlEvent.Tag<R>>
  ): Stream.Stream<State, JournalReadError | JsonlError>;
  function projection<State, T extends JsonlEvent.Tag<R>>(
    initial: State,
    fold: (state: State, envelope: EnvelopeWithTag<R, T>) => State,
    slice?: CursoredSlice<R, T>
  ): Stream.Stream<State, JournalReadError | JsonlError> {
    return changesStream(slice).pipe(
      Stream.filter((envelope): envelope is EnvelopeWithTag<R, T> => matchesEnvelope(envelope, slice)),
      Stream.scan(() => initial, fold)
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
      const present = yield* exists;
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
  const present = yield* exists;
  if (present) {
    // What a journal that vanished during the seed leaves behind: no BOM
    // width, and the cursor, identity and `latest` still at their empty start.
    const missing = Effect.sync(() => {
      bomBytes = 0;
    });
    yield* Effect.gen(function* () {
      // Narrowed to the vanished file only: a permissions error or a bad
      // handle must NOT present as an empty journal. Anything other than "the
      // file vanished between the check and the read" is a real failure.
      // Sample identity before the seed read: a replacement during that
      // read must not attach its old cursor to the replacement's inode. The
      // BOM width comes from the same handle as that identity, so a
      // replacement cannot inherit the old file's width either: the first
      // reconciliation sees a different identity and resynchronizes.
      const [bom, info] = yield* sampleFile;
      bomBytes = bom;
      const seed = yield* refresh;
      // Resume at the same completed seed record, never at a later stat EOF:
      // a torn suffix or unread growth must remain pending for reconciliation.
      consumed = O.getOrElse(
        O.map(seed, (row) => row.line.end),
        () => 0
      );
      // Detect replacement even before the supervisor's first catch-up read.
      identity = identityOf(info);
    }).pipe(
      // The seed read's own existence check saw the file gone.
      Effect.catchTag("JournalNotFound", () => missing),
      // The same disappearance, reported by the step that met it instead: the
      // sample and the tail read each fail with a platform `NotFound`. It is a
      // missing journal only when the file is in fact gone; a `NotFound` for a
      // journal that still exists is a real failure and propagates untranslated.
      Effect.catchReason("PlatformError", "NotFound", (_reason, error) =>
        Effect.flatMap(exists, (stillPresent) => (stillPresent ? Effect.fail(error) : missing))
      )
    );
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
    Effect.ignore
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
    Stream.takeUntilEffect(() => exists),
    Stream.runForEach(() => ingest),
    Effect.ignore
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
      const present = yield* exists;
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
        // Reconcile after arming to include any growth during registration.
        // A stable file contributes no envelopes to the publication batch.
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
        yield* Effect.logWarning("Journal watcher stopped after immediate completions").pipe(
          Effect.annotateLogs({ path: config.path, rearms: immediateCompletions })
        );
        return;
      }
    }
  });

  // Ignored deliberately, and the cost is stated: if the watch cannot be
  // established the journal keeps working for local appends and simply stops
  // observing external ones. Failing the layer instead would violate the
  // missing-journal contract, which requires construction to succeed.
  yield* Effect.forkScoped(supervise.pipe(Effect.annotateLogs({ path: config.path }), Effect.ignore));

  // Graceful shutdown, as TWO mechanisms. Refusal is the flag above, checked
  // before the permit and failing typed. Drain is here: taking the permit
  // waits for the in-flight append to finish, and only then is the terminal
  // Exit published — so the last accepted append is on disk and visible to
  // subscribers before their streams end.
  yield* Effect.addFinalizer(
    Effect.fn("Journal.close")(function* () {
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
        })
      ).pipe(Effect.timeout(config.shutdownPublishTimeout), Effect.ignore);
    })
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
   * **Details**
   *
   * Configuration is decoded before acquisition; invalid input fails with
   * `InvalidJournalConfig`, preserving its schema issue tree.
   * Layers are memoized by reference, so calling this twice mints
   * **two independent journals over one file** — two semaphores, two hubs, two `latest` refs — and their
   * appends are not serialized against each other. That is the in-process form
   * of exactly the interleaving the cooperative-writer rules exist to prevent,
   * and it typechecks perfectly.
   *
   * **Gotchas**
   *
   * Construction can fail with a `PlatformError`, and that is deliberate. A
   * journal file that does not exist yet is a legal state and constructs
   * cleanly — but a file that exists and cannot be read (`EACCES`, a bad
   * handle) is a real failure, and typing this channel `never` would have made
   * it arrive as an untypeable defect that no caller could catch.
   *
   * Bind the result to a const and provide that const.
   *
   * **Example** (Share one journal layer across consumers)
   *
   * ```ts
   * import { $ScratchpadId } from "@beep/identity/packages";
   * import { Journal, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
   * import * as Effect from "effect/Effect";
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
  readonly layer: (
    config: JournalConfig
  ) => Layer.Layer<Self, PlatformError.PlatformError | InvalidJournalConfig | InvalidUtf8, FileSystem.FileSystem>;
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
      options: { readonly events: R }
    ): JournalClass<Self, Id, R> => {
      const key = Context.Service<Self, JournalShape<R>>()(id);
      // Augment the constructor itself: a spread would lose Context's
      // inherited service protocol, while an intermediate subclass would
      // introduce a different Self from the caller's class.
      return Object.assign(key, {
        events: options.events,
        layer: (
          config: JournalConfig
        ): Layer.Layer<Self, PlatformError.PlatformError | InvalidJournalConfig | InvalidUtf8, FileSystem.FileSystem> =>
          Layer.effect(
            key,
            Effect.gen(function* () {
              const settings = yield* decodeSettings(config).pipe(
                Effect.mapError((error) => InvalidJournalConfig.make({ error }))
              );
              const fs = yield* FileSystem.FileSystem;
              return yield* makeEngine(options.events, settings, fs);
            })
          ),
      });
    },
};
