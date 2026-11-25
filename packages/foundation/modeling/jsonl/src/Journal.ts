/**
 * Typed journal services, subscriptions and schema-backed configuration.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $JsonlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Channel from "effect/Channel";
import * as Chunk from "effect/Chunk";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { dual, flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as PubSub from "effect/PubSub";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as Tuple from "effect/Tuple";
import { Envelope, EnvelopeFrame } from "./Envelope.ts";
import { AfterTerminalCheck } from "./internal/changesSeam.ts";
import { canMerge, isRecordLike, shallowMerge } from "./internal/merge.ts";
import {
  DEFAULT_WINDOW,
  handleBomBytes,
  probeBomBytes,
  readRangeWindow,
  readSampledWindow,
  readTailUntil,
  SampledRange,
} from "./internal/tail.ts";
import { utf8Length } from "./internal/utf8.ts";
import {
  InvalidJournalConfig,
  InvalidSlice,
  JournalClosed,
  JournalNotFound,
  JournalResync,
  JournalResyncReason,
  JournalUnterminated,
  JournalWriteConflict,
  TerminalViolation,
} from "./JsonlError.ts";
import { Line } from "./Line.ts";
import { LineSlice } from "./LineSlice.ts";
import { CursoredSlice, matchesFrame } from "./Slice.ts";
import type * as PlatformError from "effect/PlatformError";
import type * as Scope from "effect/Scope";
import type * as Take from "effect/Take";
import type { EnvelopeUnion, EnvelopeWithTag } from "./Envelope.ts";
import type { TailWindow } from "./internal/tail.ts";
import type {
  InvalidData,
  InvalidUtf8,
  JsonlError,
  MalformedLine,
  UnknownEvent,
  UnserializableData,
} from "./JsonlError.ts";
import type { JsonlEvent } from "./JsonlEvent.ts";

const $I = $JsonlId.create("Journal");

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
 * **Example** (Select an append partition)
 * ```ts import.meta.vitest name="Select an append partition"
 * import { AppendOptions } from "@beep/jsonl/Journal";
 * AppendOptions.make({ scope: "mail" }).scope // => "mail"
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
// decision: journal-opaque-config-structs
export class AppendOptions extends S.Opaque<AppendOptions, { readonly brand: unique symbol }>()(
  S.Struct({ scope: S.optionalKey(S.String) }).pipe(
    $I.annoteSchema("AppendOptions", { description: "Partition selection for one append." })
  )
) {}

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
    options?: typeof AppendOptions.Encoded | undefined
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
    options?: typeof AppendOptions.Encoded | undefined
  ) => Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;

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

  /** Create the journal file if it does not exist. Always explicit. */
  readonly create: Effect.Effect<void, PlatformError.PlatformError>;

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
   * Whether the journal is quiescent — its tail is an event marked `terminal`.
   *
   * **Details**
   *
   * Derived from {@link JournalShape.latest} rather than tracked separately, so
   * the two cannot disagree.
   */
  readonly quiescent: Effect.Effect<boolean>;

  /** Remove the journal file. Always explicit. */
  readonly remove: Effect.Effect<void, PlatformError.PlatformError>;
}

const DURATION_FROM_INPUT_GRAMMAR =
  /^(?:-?Infinity|-?\d+(?:\.\d+)?\s+(?:nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?))$/;

const DurationText = S.String.check(S.isPattern(DURATION_FROM_INPUT_GRAMMAR));
const isDurationText = S.is(DurationText);

type DurationString = Extract<Duration.Input, string>;

const DurationString = S.declare((input: unknown): input is DurationString => isDurationText(input)).pipe(
  $I.annoteSchema("DurationString", {
    description: "A duration string accepted by Duration.fromInput, including signed decimals and infinities.",
    toCodecArbitrary: () => S.link<DurationString>()(DurationText, SchemaTransformation.passthroughSupertype()),
  })
);

const DurationNumber = S.declare(P.isNumber).pipe(
  $I.annoteSchema("DurationNumber", {
    description:
      "Any JavaScript number, not a finite domain number: Duration.fromInput admits NaN and the infinities (Infinity milliseconds is an unbounded wait). Arbitraries draw finite numbers.",
    toCodecArbitrary: () => S.link<number>()(S.Finite, SchemaTransformation.passthrough()),
  })
);

const DurationObject = S.Struct({
  weeks: DurationNumber.pipe(S.UndefinedOr, S.optionalKey),
  days: DurationNumber.pipe(S.UndefinedOr, S.optionalKey),
  hours: DurationNumber.pipe(S.UndefinedOr, S.optionalKey),
  minutes: DurationNumber.pipe(S.UndefinedOr, S.optionalKey),
  seconds: DurationNumber.pipe(S.UndefinedOr, S.optionalKey),
  milliseconds: DurationNumber.pipe(S.UndefinedOr, S.optionalKey),
  microseconds: DurationNumber.pipe(S.UndefinedOr, S.optionalKey),
  nanoseconds: DurationNumber.pipe(S.UndefinedOr, S.optionalKey),
}).pipe(
  $I.annoteSchema("DurationObject", {
    description:
      "Optional, additive duration components accepted by Duration.fromInput. Mirrors Duration.DurationObject, whose members are declared `weeks?: number | undefined`, so each key admits an explicit undefined (EF-40 exception).",
  })
);

const DurationInput = S.Union([
  S.Duration,
  DurationNumber,
  S.BigInt,
  S.Tuple([DurationNumber, DurationNumber]),
  DurationString,
  DurationObject,
]).pipe($I.annoteSchema("DurationInput", { description: "Every input shape Duration.fromInput accepts." }));

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

const Capacity = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("JournalCapacity", { description: "A positive integer subscriber hub capacity." })
);

/**
 * **Details**
 *
 * Optional keys are exact (EF-40, kept deviation 24): omit a key rather than
 * passing `undefined`. `shutdownPublishTimeout` accepts any
 * `Duration.Input` (a `Duration`, milliseconds or a string such as
 * `"100 millis"`); the layer decodes it into a `Duration`, and an input
 * Effect cannot convert fails construction with `InvalidJournalConfig`.
 *
 * **Example** (Bound journal shutdown)
 * ```ts import.meta.vitest name="Bound journal shutdown"
 * import { JournalConfig } from "@beep/jsonl/Journal";
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
export class JournalConfig extends S.Opaque<JournalConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Journal path; construction permits a missing file. */
    path: S.String,
    /** Directory to watch until creation; defaults to the parent of path. */
    directory: S.optionalKey(S.String),
    /** Backpressured subscriber capacity; defaults to 64. */
    capacity: S.optionalKey(Capacity),
    /** Bound on graceful shutdown publication, as any Duration.Input; defaults to five seconds. */
    shutdownPublishTimeout: S.optionalKey(DurationInput),
  }).pipe($I.annoteSchema("JournalConfig", { description: "File and subscription settings for one journal layer." }))
) {}

// decision: journal-publish-outside-write-permit
const SHUTDOWN_PUBLISH_TIMEOUT = Duration.seconds(5);

const JournalSettings = S.Struct({
  ...JournalConfig.fields,
  capacity: Capacity.pipe(S.withDecodingDefaultKey(Effect.succeed(64))),
  shutdownPublishTimeout: DurationFromInput.pipe(S.withDecodingDefaultType(Effect.succeed(SHUTDOWN_PUBLISH_TIMEOUT))),
}).pipe(
  $I.annoteSchema("JournalSettings", {
    description: "Validated journal settings with buffering and shutdown defaults.",
  })
);
const decodeSettings = S.decodeEffect(JournalSettings);

// decision: journal-arm-before-catch-up
const MAX_IMMEDIATE_REARMS = 8;

// decision: journal-directory-activation-watch
const lastSeparator = (path: string): number =>
  Math.max(
    O.getOrElse(Str.lastIndexOf("/")(path), () => -1),
    O.getOrElse(Str.lastIndexOf("\\")(path), () => -1)
  );

const basenameOf = (path: string): string => Str.slice(lastSeparator(path) + 1)(path);

const parentOf = (path: string): string => {
  const separator = lastSeparator(path);
  if (separator < 0) return ".";
  const rootIsTheSeparatorItself = separator === 0;
  return rootIsTheSeparatorItself ? Str.slice(0, 1)(path) : Str.slice(0, separator)(path);
};

const textEncoder = new TextEncoder();

// decision: journal-one-decode-loop
const decodeWindow: {
  <R extends JsonlEvent.Registry>(
    window: TailWindow,
    events: ReturnType<typeof Envelope.registry<R>>
  ): O.Option<EnvelopeUnion<R>>;
  <R extends JsonlEvent.Registry>(
    events: ReturnType<typeof Envelope.registry<R>>
  ): (window: TailWindow) => O.Option<EnvelopeUnion<R>>;
} = dual(
  2,
  <R extends JsonlEvent.Registry>(
    window: TailWindow,
    events: ReturnType<typeof Envelope.registry<R>>
  ): O.Option<EnvelopeUnion<R>> =>
    O.map(Envelope.lastValidResult(window.text, events), (envelope) => ({
      ...envelope,
      line: LineSlice.rebase(envelope.line, window.start),
    }))
);

const makeEngine: {
  <R extends JsonlEvent.Registry>(
    events: ReturnType<typeof Envelope.registry<R>>,
    config: typeof JournalSettings.Type,
    fs: FileSystem.FileSystem
  ): Effect.Effect<JournalShape<R>, PlatformError.PlatformError | InvalidUtf8, Scope.Scope>;
  (
    config: typeof JournalSettings.Type,
    fs: FileSystem.FileSystem
  ): <R extends JsonlEvent.Registry>(
    events: ReturnType<typeof Envelope.registry<R>>
  ) => Effect.Effect<JournalShape<R>, PlatformError.PlatformError | InvalidUtf8, Scope.Scope>;
} = dual(
  3,
  Effect.fn("Journal.makeEngine")(function* <R extends JsonlEvent.Registry>(
    events: ReturnType<typeof Envelope.registry<R>>,
    config: typeof JournalSettings.Type,
    fs: FileSystem.FileSystem
  ): Effect.fn.Return<JournalShape<R>, PlatformError.PlatformError | InvalidUtf8, Scope.Scope> {
    const terminalTags = HashSet.fromIterable(
      A.map(
        A.filter(events.events, (event) => event.terminal),
        (event) => event.tag
      )
    );
    const reopenTags = HashSet.fromIterable(
      A.map(
        A.filter(events.events, (event) => event.reopen),
        (event) => event.tag
      )
    );

    // decision: journal-publish-outside-write-permit
    const writePermit = Semaphore.makeUnsafe(1);
    let publishBaton: Deferred.Deferred<void> = Deferred.makeUnsafe<void>();
    Deferred.doneUnsafe(publishBaton, Exit.void);
    // decision: journal-one-handle-sampling
    let bomBytes = 0;
    let identity: O.Option<string> = O.none();
    const hub = yield* PubSub.bounded<Take.Take<EnvelopeUnion<R>, JsonlError>>(config.capacity);
    const latest = yield* SubscriptionRef.make(O.none<EnvelopeUnion<R>>());
    let closed = false;
    // decision: journal-one-decode-loop
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
      return yield* readTailUntil(fs, config.path, bomBytes, decodeWindow(events), DEFAULT_WINDOW, true);
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

    // decision: journal-one-decode-loop
    type DecodedRange = {
      readonly decoded: Array<EnvelopeUnion<R>>;
      readonly advanced: number;
      readonly torn: O.Option<JournalUnterminated>;
    };
    const decodeRange: {
      (from: number, to: number): Effect.Effect<DecodedRange, PlatformError.PlatformError | InvalidUtf8>;
      (to: number): (from: number) => Effect.Effect<DecodedRange, PlatformError.PlatformError | InvalidUtf8>;
    } = dual(
      2,
      Effect.fn("Journal.decodeRange")(function* (from: number, to: number) {
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
              ? JournalUnterminated.makeOption({ path: config.path, offset: advanced, end: window.size })
              : O.none<JournalUnterminated>(),
        };
      })
    );

    const identityOf = (info: FileSystem.File.Info): O.Option<string> => O.map(info.ino, (ino) => `${info.dev}:${ino}`);

    const sampleBomAndInfoThroughOneHandle = Effect.scoped(
      Effect.gen(function* () {
        const sample = yield* fs.open(config.path, { flag: "r" });
        const handleBomBytes1 = yield* handleBomBytes(sample);
        const stat2 = yield* sample.stat;
        return Tuple.make(handleBomBytes1, stat2);
      })
    );

    const failureOnlyBatch = (failure: JournalResync | InvalidUtf8, size: number) => {
      const entries: ReadonlyArray<Take.Take<EnvelopeUnion<R>, JsonlError>> = [Exit.fail(failure)];
      return {
        entries,
        failure: O.some<JournalResync | InvalidUtf8>(failure),
        torn: O.none<JournalUnterminated>(),
        size,
      };
    };

    const isReplacedBy = (currentIdentity: O.Option<string>): boolean =>
      O.isSome(identity) && O.isSome(currentIdentity) && identity.value !== currentIdentity.value;

    const resync = Effect.fnUntraced(function* (
      replaced: boolean,
      currentIdentity: O.Option<string>,
      bom: number,
      size: number
    ) {
      const failure = JournalResync.make({
        path: config.path,
        reason: replaced ? JournalResyncReason.Enum.replaced : JournalResyncReason.Enum.truncated,
        expected: consumed,
        actual: size - bom,
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
      return failureOnlyBatch(failure, size);
    });

    const acceptRange = Effect.fnUntraced(function* (
      range: DecodedRange,
      currentIdentity: O.Option<string>,
      size: number
    ) {
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

    // decision: journal-publish-outside-write-permit
    const reconcileUnderWritePermit = Effect.fn("Journal.reconcile")(function* (
      restore: <AX, EX, RX>(effect: Effect.Effect<AX, EX, RX>) => Effect.Effect<AX, EX, RX>
    ) {
      yield* restore(requireFile);
      const info = yield* restore(fs.stat(config.path));
      const currentIdentity = identityOf(info);
      const size = ByteSize.toNumberUnsafe(info.size);
      const replaced = isReplacedBy(currentIdentity);
      const shrank = size < consumed + bomBytes;
      const unstable = replaced || shrank;
      const bom = unstable || O.isNone(identity) ? yield* restore(probeBomBytes(fs, config.path)) : bomBytes;
      if (unstable) return yield* resync(replaced, currentIdentity, bom, size);
      bomBytes = bom;
      const reading = yield* restore(decodeRange(consumed, size - bom)).pipe(
        Effect.map(Result.succeed),
        Effect.catchTag("InvalidUtf8", flow(Result.fail, Effect.succeed))
      );
      return Result.isFailure(reading)
        ? failureOnlyBatch(reading.failure, size)
        : yield* acceptRange(reading.success, currentIdentity, size);
    });

    const publish: {
      (
        entries: ReadonlyArray<Take.Take<EnvelopeUnion<R>, JsonlError>>,
        predecessor: Deferred.Deferred<void>
      ): Effect.Effect<void>;
      (
        predecessor: Deferred.Deferred<void>
      ): (entries: ReadonlyArray<Take.Take<EnvelopeUnion<R>, JsonlError>>) => Effect.Effect<void>;
    } = dual(
      2,
      Effect.fn("Journal.publish")(function* (
        entries: ReadonlyArray<Take.Take<EnvelopeUnion<R>, JsonlError>>,
        predecessor: Deferred.Deferred<void>
      ) {
        yield* Deferred.await(predecessor);
        for (const entry of entries) yield* PubSub.publish(hub, entry);
      })
    );

    const appendWith: {
      (
        event: string,
        build: (current: O.Option<EnvelopeUnion<R>>) => { readonly data: unknown; readonly patch: boolean },
        scope: string | undefined
      ): Effect.Effect<EnvelopeUnion<R>, JournalWriteError>;
      (
        build: (current: O.Option<EnvelopeUnion<R>>) => { readonly data: unknown; readonly patch: boolean },
        scope: string | undefined
      ): (event: string) => Effect.Effect<EnvelopeUnion<R>, JournalWriteError>;
    } = dual(
      3,
      Effect.fn("Journal.appendWith")(function* (
        event: string,
        build: (current: O.Option<EnvelopeUnion<R>>) => { readonly data: unknown; readonly patch: boolean },
        scope: string | undefined
      ): Effect.fn.Return<EnvelopeUnion<R>, JournalWriteError> {
        if (closed) return yield* JournalClosed.make({ event });
        const mine = Deferred.makeUnsafe<void>();
        // decision: journal-publish-outside-write-permit
        return yield* Effect.gen(function* () {
          const staged = yield* writePermit.withPermits(1)(
            Effect.uninterruptibleMask(
              Effect.fn("Journal.stageAppend")(function* (restore) {
                if (closed) return yield* JournalClosed.make({ event });
                const state = yield* reconcileUnderWritePermit(restore);
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
                        const { data, patch } = build(current);
                        const encode = patch ? Envelope.encodePatchResult : Envelope.encodeResult;
                        const encoded = encode<JsonlEvent.Registry>(
                          { event, data, at, ...O.getSomesStruct({ scope: O.fromUndefinedOr(scope) }) },
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
                        // decision: journal-one-decode-loop
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
      })
    );

    const decodeSelection = S.decodeUnknownEffect(S.UndefinedOr(CursoredSlice(S.String)));
    const validateSelection = Effect.fn("Journal.validateSelection")((slice: unknown) =>
      decodeSelection(slice).pipe(Effect.mapError((error) => InvalidSlice.make({ error })))
    );

    // decision: journal-one-handle-sampling
    const readFrom = (
      input: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined
    ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> =>
      Stream.unwrap(
        Effect.gen(function* () {
          const slice = yield* validateSelection(input);
          yield* requireFile;
          const from = slice?.cursor ?? 0;
          const [bom, info] = yield* sampleBomAndInfoThroughOneHandle;
          const logicalSize = ByteSize.toNumberUnsafe(info.size) - bom;
          if (from >= logicalSize) {
            return Stream.empty;
          }
          const file = yield* fs.open(config.path, { flag: "r" });
          const pinned = yield* file.stat;
          const sampledIdentity = identityOf(info);
          const pinnedIdentity = identityOf(pinned);
          if (O.isSome(sampledIdentity) && O.isSome(pinnedIdentity) && sampledIdentity.value !== pinnedIdentity.value) {
            return yield* JournalResync.make({
              path: config.path,
              reason: JournalResyncReason.Enum.replaced,
              expected: logicalSize,
              actual: Math.max(0, ByteSize.toNumberUnsafe(pinned.size) - (yield* handleBomBytes(file))),
            });
          }
          const start = Math.max(0, from - 1);
          const readPage: {
            (
              position: number,
              length: number
            ): Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8 | JournalResync>;
            (
              length: number
            ): (
              position: number
            ) => Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8 | JournalResync>;
          } = dual(
            2,
            (
              position: number,
              length: number
            ): Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8 | JournalResync> =>
              readSampledWindow(
                file,
                SampledRange.make({
                  path: config.path,
                  from: position + bom,
                  length,
                  bomBytes: bom,
                  sampledEnd: logicalSize,
                  skipPartialLine: position === start && start > 0,
                })
              )
          );
          const widenUntilCompleteLine = Effect.fnUntraced(function* (position: number) {
            let length = Math.min(DEFAULT_WINDOW, logicalSize - position);
            let window = yield* readPage(position, length);
            while (Str.isEmpty(window.text) && position + length < logicalSize) {
              length = Math.min(length * 2, logicalSize - position);
              window = yield* readPage(position, length);
            }
            return window;
          });
          const selectFrame = (frame: EnvelopeFrame): boolean => matchesFrame(frame, slice);
          const selectLine = (
            line: LineSlice,
            windowStart: number
          ): O.Option<Result.Result<EnvelopeUnion<R>, JsonlError>> => {
            if (Line.isBlank(line)) return O.none();
            const rebased = LineSlice.rebase(line, windowStart);
            return rebased.offset < from ? O.none() : Envelope.decodeSelectedResult(rebased, events, selectFrame);
          };
          const selectPage = (window: TailWindow, next: O.Option<number>) => {
            let selected = Chunk.empty<Result.Result<EnvelopeUnion<R>, JsonlError>>();
            for (const line of Line.split(window.text)) {
              const decoded = selectLine(line, window.start);
              if (O.isNone(decoded)) continue;
              selected = Chunk.append(selected, decoded.value);
              if (Result.isFailure(decoded.value)) return Tuple.make(Chunk.toReadonlyArray(selected), O.none<number>());
            }
            return Tuple.make(Chunk.toReadonlyArray(selected), next);
          };
          return Stream.paginate(
            start,
            Effect.fn("Journal.readPage")(function* (position) {
              const window = yield* widenUntilCompleteLine(position);
              const advanced = window.start + utf8Length(window.text);
              const next = advanced > position && advanced < logicalSize ? O.some(advanced) : O.none<number>();
              return selectPage(window, next);
            })
          ).pipe(Stream.mapEffect(Effect.fromResult));
        })
      );

    const matchesEnvelope: {
      <T extends JsonlEvent.Tag<R>>(
        envelope: EnvelopeUnion<R>,
        slice: CursoredSlice<R, T> | undefined
      ): envelope is EnvelopeWithTag<R, T>;
      <T extends JsonlEvent.Tag<R>>(
        slice: CursoredSlice<R, T> | undefined
      ): (envelope: EnvelopeUnion<R>) => envelope is EnvelopeWithTag<R, T>;
    } = dual(
      2,
      <T extends JsonlEvent.Tag<R>>(
        envelope: EnvelopeUnion<R>,
        slice: CursoredSlice<R, T> | undefined
      ): envelope is EnvelopeWithTag<R, T> =>
        matchesFrame(
          EnvelopeFrame.make({
            at: envelope.at,
            event: envelope.event,
            ...O.getSomesStruct({ scope: O.fromUndefinedOr(envelope.scope) }),
            data: envelope.data,
          }),
          slice
        )
    );

    const isTerminalEnvelope = (envelope: EnvelopeUnion<R>): boolean => HashSet.has(terminalTags, envelope.event);

    const changesStream = (
      input: CursoredSlice<R, JsonlEvent.Tag<R>> | undefined
    ): Stream.Stream<EnvelopeUnion<R>, JournalReadError | JsonlError> =>
      Stream.unwrap(
        Effect.gen(function* () {
          yield* validateSelection(input);
          const slice = input;
          // decision: journal-subscribe-before-replay
          const subscription = yield* PubSub.subscribe(hub);
          const alreadyQuiescent = yield* isTerminalTail;
          const alreadyClosed = closed;
          yield* Effect.flatten(AfterTerminalCheck);
          const replay = slice?.cursor === undefined ? Stream.empty : readFrom(slice);
          if (alreadyQuiescent || alreadyClosed) {
            return replay;
          }
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
            Stream.takeUntil(isTerminalEnvelope),
            Stream.filter((envelope) => envelope.line.offset >= replayedThrough)
          );
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
              const state = yield* reconcileUnderWritePermit(restore);
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
      options?: typeof AppendOptions.Encoded
    ): Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;
    function append(
      event: JsonlEvent.Tag<R>,
      data: unknown,
      options?: typeof AppendOptions.Encoded
    ): Effect.Effect<EnvelopeUnion<R>, JournalWriteError> {
      return appendWith(event, () => ({ data, patch: false }), options?.scope);
    }

    function appendPatch<T extends JsonlEvent.Tag<R>>(
      event: T,
      patch: Partial<JsonlEvent.Data<R, NoInfer<T>>>,
      options?: typeof AppendOptions.Encoded
    ): Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;
    function appendPatch(
      event: JsonlEvent.Tag<R>,
      patch: unknown,
      options?: typeof AppendOptions.Encoded
    ): Effect.Effect<EnvelopeUnion<R>, JournalWriteError> {
      return appendWith(
        event,
        (current) => {
          const base = O.isSome(current) ? current.value.data : undefined;
          const mergeIntoPlainRecord = isRecordLike(base) && isRecordLike(patch) && canMerge(base, patch);
          return { data: mergeIntoPlainRecord ? shallowMerge(base, patch) : patch, patch: mergeIntoPlainRecord };
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
      return readFrom(slice).pipe(Stream.filter(matchesEnvelope(slice)));
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
      return changesStream(slice).pipe(Stream.filter(matchesEnvelope(slice)));
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
        Stream.filter(matchesEnvelope(slice)),
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
          // decision: journal-missing-file-contract
          yield* Effect.scoped(fs.open(config.path, { flag: "a" }));
        }
      }),
      remove: fs.remove(config.path, { force: true }),
      hub,
    };

    // decision: journal-missing-file-contract
    const present = yield* exists;
    if (present) {
      const resetAfterVanishedSeed = Effect.sync(() => {
        bomBytes = 0;
      });
      yield* Effect.gen(function* () {
        // decision: journal-one-handle-sampling
        const [bom, info] = yield* sampleBomAndInfoThroughOneHandle;
        bomBytes = bom;
        const seed = yield* refresh;
        // decision: journal-one-decode-loop
        consumed = O.getOrElse(
          O.map(seed, (row) => row.line.end),
          () => 0
        );
        identity = identityOf(info);
      }).pipe(
        Effect.catchTag("JournalNotFound", () => resetAfterVanishedSeed),
        Effect.catchReason("PlatformError", "NotFound", (_reason, error) =>
          Effect.flatMap(exists, (stillPresent) => (stillPresent ? Effect.fail(error) : resetAfterVanishedSeed))
        )
      );
    }

    // decision: journal-directory-activation-watch
    const basename = basenameOf(config.path);
    const directory = config.directory ?? parentOf(config.path);

    const watchForCreation = Effect.gen(function* () {
      const ready = yield* Deferred.make<void>();
      const stop = yield* Deferred.make<void>();
      const armed = yield* Effect.forkChild(
        fs.watch(directory, { onReady: () => Deferred.doneUnsafe(ready, Effect.void) }).pipe(
          Stream.interruptWhen(Deferred.await(stop)),
          Stream.filter((event) => basenameOf(event.path) === basename),
          Stream.takeUntilEffect(() => exists),
          Stream.runForEach(() => ingest),
          Effect.ignore,
          Effect.ensuring(Deferred.succeed(ready, undefined))
        )
      );
      yield* Deferred.await(ready);
      if (yield* exists) {
        yield* ingest;
        yield* Deferred.succeed(stop, undefined);
        yield* Fiber.join(armed);
      } else {
        yield* Fiber.join(armed);
      }
    });

    const followJournal = Effect.gen(function* () {
      // decision: journal-arm-before-catch-up
      const ready = yield* Deferred.make<void>();
      const armed = yield* Effect.forkChild(
        fs.watch(config.path, { onReady: () => Deferred.doneUnsafe(ready, Effect.void) }).pipe(
          Stream.runForEach(() => ingest),
          Effect.ignore,
          Effect.ensuring(Deferred.succeed(ready, undefined))
        )
      );
      yield* Deferred.await(ready);
      yield* ingest;
      yield* Fiber.join(armed);
      yield* ingest;
    });

    const supervise = Effect.gen(function* () {
      // decision: journal-directory-activation-watch
      // decision: journal-arm-before-catch-up
      let immediateCompletions = 0;
      for (;;) {
        const startedAt = consumed;
        yield* (yield* exists) ? followJournal : watchForCreation;
        immediateCompletions = consumed === startedAt ? immediateCompletions + 1 : 0;
        if (immediateCompletions > MAX_IMMEDIATE_REARMS) {
          return yield* Effect.logWarning("Journal watcher stopped after immediate completions").pipe(
            Effect.annotateLogs({ path: config.path, rearms: immediateCompletions })
          );
        }
      }
    });

    // decision: journal-arm-before-catch-up
    yield* Effect.forkScoped(supervise.pipe(Effect.annotateLogs({ path: config.path }), Effect.ignore));

    // decision: journal-publish-outside-write-permit
    yield* Effect.addFinalizer(
      Effect.fn("Journal.close")(function* () {
        closed = true;
        const pending = yield* writePermit.withPermits(1)(Effect.sync(() => publishBaton));

        yield* Effect.interruptible(
          Effect.gen(function* () {
            yield* Deferred.await(pending);
            yield* PubSub.publish(hub, Exit.void);
          })
        ).pipe(Effect.timeout(config.shutdownPublishTimeout), Effect.ignore);
      })
    );

    return shape;
  })
);

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
   * import { $JsonlId } from "@beep/identity/packages";
   * import { Journal } from "@beep/jsonl/Journal";
   * import { JsonlEvent } from "@beep/jsonl/JsonlEvent";
   * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
   * import * as Effect from "effect/Effect";
   * import * as Layer from "effect/Layer";
   * import * as S from "effect/Schema";
   * const $I = $JsonlId.create("examples/jsonl/layer");
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
    config: typeof JournalConfig.Encoded
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
 * import { $JsonlId } from "@beep/identity/packages";
 * import { Journal } from "@beep/jsonl/Journal";
 * import { JsonlEvent } from "@beep/jsonl/JsonlEvent";
 * import * as S from "effect/Schema";
 * const $I = $JsonlId.create("examples/jsonl");
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
      const events = Envelope.registry(options.events);
      const key = Context.Service<Self, JournalShape<R>>()(id);
      return class extends key {
        static readonly events = options.events;
        static readonly layer = (
          config: typeof JournalConfig.Encoded
        ): Layer.Layer<Self, PlatformError.PlatformError | InvalidJournalConfig | InvalidUtf8, FileSystem.FileSystem> =>
          Layer.effect(
            key,
            Effect.gen(function* () {
              const settings = yield* decodeSettings(config).pipe(
                Effect.mapError((error) => InvalidJournalConfig.make({ error }))
              );
              const fs = yield* FileSystem.FileSystem;
              return yield* makeEngine(events, settings, fs);
            })
          );
      };
    },
};
