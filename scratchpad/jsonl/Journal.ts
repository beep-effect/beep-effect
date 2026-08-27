/**
 * The `Journal` service: one append-only, schema-validated JSONL file.
 *
 * @since 0.1.0
 */
import type { Duration as DurationType, PlatformError, Scope, Take } from "effect";
import {
	Channel,
	Context,
	DateTime,
	Deferred,
	Duration,
	Effect,
	Exit,
	Fiber,
	FileSystem,
	Layer,
	Option,
	PubSub,
	Result,
	Semaphore,
	Stream,
	SubscriptionRef,
} from "effect";
import type { EnvelopeUnion, EnvelopeWithTag } from "./Envelope.ts";
import { Envelope } from "./Envelope.ts";
import { canMerge, shallowMerge } from "./internal/merge.ts";
import type { TailWindow } from "./internal/tail.ts";
import { DEFAULT_WINDOW, probeBomBytes, readRangeText, readTail, readTailUntil } from "./internal/tail.ts";
import type { InvalidData, JsonlError, MalformedLine, UnknownEvent, UnserializableData } from "./JsonlError.ts";
import { JournalClosed, JournalNotFound, JournalResync, TerminalViolation } from "./JsonlError.ts";
import type { JsonlEvent } from "./JsonlEvent.ts";
import { Line } from "./Line.ts";
import { LineSlice } from "./LineSlice.ts";
import type { CursoredSlice } from "./Slice.ts";
import { matchesFrame } from "./Slice.ts";

/**
 * The failure channel of a write operation.
 *
 * `PlatformError` rides through untranslated per the taxonomy's rule. **Any
 * `PlatformError` out of an append must be treated as a possibly-torn tail**:
 * `writeAll` reports no byte count, so a failure cannot be read as "nothing was
 * written". The next reader walks back over whatever fragment survived.
 *
 * @public
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
 */
export type JournalReadError = JournalNotFound | PlatformError.PlatformError;

/**
 * Options for one append.
 *
 * @public
 */
export interface AppendOptions {
	/** The partition key to stamp on the envelope. */
	readonly scope?: string | undefined;
}

/**
 * The shape of a `Journal`, typed by its registry.
 *
 * @public
 */
export interface JournalShape<R extends JsonlEvent.Registry> {
	/**
	 * Validate, encode and append one envelope.
	 *
	 * `at` is stamped here from the Effect `Clock` — never by the caller — so
	 * ordering does not depend on two writers agreeing about the time, and
	 * `TestClock` controls it exactly in tests.
	 */
	readonly append: <T extends JsonlEvent.Tag<R>>(
		event: T,
		data: JsonlEvent.Data<R, T>,
		options?: AppendOptions | undefined,
	) => Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;

	/**
	 * Inherit-and-patch: read the last valid envelope, shallow-merge `patch`
	 * over its `data`, validate the result and append it.
	 *
	 * This is the snapshot-journal primitive — each line is a complete state and
	 * most transitions change one field. The merge is **shallow** by decision: a
	 * nested object in the patch replaces the one beneath it.
	 */
	readonly appendPatch: <T extends JsonlEvent.Tag<R>>(
		event: T,
		patch: Partial<JsonlEvent.Data<R, T>>,
		options?: AppendOptions | undefined,
	) => Effect.Effect<EnvelopeWithTag<R, T>, JournalWriteError>;

	/**
	 * The current last valid **envelope**, as an observable `Option`.
	 *
	 * "Last valid" always means the last valid envelope, never merely the last
	 * valid JSON — a torn scalar tail parses as a different value and only the
	 * envelope contract detects it.
	 */
	readonly latest: SubscriptionRef.SubscriptionRef<Option.Option<EnvelopeUnion<R>>>;

	/**
	 * Whether the journal is quiescent — its tail is an event marked `terminal`.
	 *
	 * Derived from {@link JournalShape.latest} rather than tracked separately, so
	 * the two cannot disagree.
	 */
	readonly quiescent: Effect.Effect<boolean>;

	/**
	 * Historical read: a finite `Stream` of the envelopes matching `slice`.
	 *
	 * Every element carries its logical byte offsets on `line`, so iteration is
	 * resumable across process restarts by persisting `line.end` and passing it
	 * back as `cursor`.
	 *
	 * Filtering happens on the envelope **frame**, strictly before the payload
	 * schema runs, so a non-matching line's `data` is never decoded.
	 *
	 * @remarks
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
	readonly query: <T extends JsonlEvent.Tag<R> = JsonlEvent.Tag<R>>(
		slice?: CursoredSlice<R, T> | undefined,
	) => Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;

	/**
	 * Live read: a `Stream` of matching envelopes as they are appended.
	 *
	 * With a `cursor`, replay-from-cursor and the live tail are **one seam**: the
	 * replayed history and the live tail are the same stream, filtered the same
	 * way, so a consumer cannot observe a gap or a duplicate at the join.
	 *
	 * The stream **ends** — it never hangs — when the journal becomes quiescent
	 * (a `terminal` event reaches the tail) or its scope closes. Subscribing to
	 * an already-quiescent journal ends immediately.
	 *
	 * @remarks
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
	readonly changes: <T extends JsonlEvent.Tag<R> = JsonlEvent.Tag<R>>(
		slice?: CursoredSlice<R, T> | undefined,
	) => Stream.Stream<EnvelopeWithTag<R, T>, JournalReadError | JsonlError>;

	/**
	 * A running fold over a slice, emitted as it advances.
	 *
	 * The fold only ever sees its own slice, so a per-scope state machine over a
	 * shared journal is exhaustively checkable against just that scope's events.
	 */
	readonly projection: <S, T extends JsonlEvent.Tag<R> = JsonlEvent.Tag<R>>(
		initial: S,
		fold: (state: S, envelope: EnvelopeWithTag<R, T>) => S,
		slice?: CursoredSlice<R, T> | undefined,
	) => Stream.Stream<S, JournalReadError | JsonlError>;

	/** Create the journal file if it does not exist. Always explicit. */
	readonly create: Effect.Effect<void, PlatformError.PlatformError>;

	/** Remove the journal file. Always explicit. */
	readonly remove: Effect.Effect<void, PlatformError.PlatformError>;

	/**
	 * The internal hub, exposed for the read surfaces built over it.
	 *
	 * Elements are `Take` chunks and end-of-stream is a published `Exit`, which
	 * is what lets quiescence and graceful shutdown arrive at a subscriber as a
	 * normal stream end. Never shut this down to signal completion —
	 * `PubSub.shutdown` *interrupts* subscribers, which is the tear the design
	 * forbids.
	 *
	 * @internal
	 */
	readonly hub: PubSub.PubSub<Take.Take<EnvelopeUnion<R>, JsonlError>>;
}

/**
 * Configuration for one journal layer.
 *
 * @public
 */
export interface JournalConfig {
	/** Path to the journal file. It need not exist yet. */
	readonly path: string;
	/**
	 * The directory to watch while the journal does not exist yet.
	 *
	 * Defaults to `path`'s parent, derived by taking everything before its last
	 * `/` or `\`. That derivation is the one piece of path arithmetic this
	 * package performs, and it is here so the common case needs no second field;
	 * name the directory explicitly when your path convention does not survive
	 * it — a drive-relative Windows path, or a path whose parent is not a plain
	 * prefix of it.
	 *
	 * It is used for exactly one thing: `FileSystem.watch` on a journal that has
	 * not been created yet. Once the journal exists the watch moves to the file
	 * itself and this value is not consulted again.
	 */
	readonly directory?: string | undefined;
	/**
	 * Capacity of the internal subscriber hub. Bounded with backpressure: the
	 * journal never drops an envelope for a slow subscriber, so slowness shows
	 * up at the producer where it is visible rather than as a silent gap in
	 * somebody's subscription.
	 */
	readonly capacity?: number | undefined;
	/**
	 * How long scope close waits for the terminal `Exit` to be accepted.
	 *
	 * Defaults to five seconds. Bounded rather than indefinite because a
	 * subscriber that never consumes cannot observe completion by definition,
	 * and must not be able to hold shutdown hostage.
	 */
	readonly shutdownPublishTimeout?: DurationType.Input | undefined;
}

/**
 * How long scope close waits for the terminal `Exit` to be accepted by the hub.
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
 * See the arming comment in `supervise`: this orders arming ahead of catch-up
 * by scheduling rather than by synchronisation, because `fs.watch` offers no
 * registration signal.
 */
const ARM_YIELDS = 3;

/** The erased shape the engine actually builds, before the registry types go on. */
type ErasedShape = JournalShape<JsonlEvent.Registry>;

/**
 * Index of the last path separator, on either convention.
 *
 * Both are checked because a Windows path contains no `/` at all: matching only
 * on `/` returns `-1` there, which makes the whole path its own basename and
 * points the activation watch at the process working directory — a journal
 * created after its layer was built is then never observed.
 */
const lastSeparator = (path: string): number => Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

/**
 * The last segment of a path.
 *
 * Used for **comparison only** — matching a watch event's basename against the
 * journal's filename. `event.path` is never opened or read, on any watch.
 */
const basenameOf = (path: string): string => path.slice(lastSeparator(path) + 1);

/**
 * The directory a path sits in — the single derived path this package ever
 * hands to the filesystem, and only as {@link JournalConfig.directory}'s
 * default.
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
	return separator === 0 ? path.slice(0, 1) : path.slice(0, separator);
};

/**
 * The last valid envelope in a tail window, with its offsets rebased onto the
 * journal.
 *
 * The walk-back itself is **not** reimplemented here: `Envelope.lastValidResult`
 * is the binding definition of "the journal's current state" — which lines
 * count as blank, which failures are walked over, where it stops — and a second
 * copy of those rules would only be a place for them to drift apart. All this
 * adds is the one thing the pure core cannot know: the window's text begins at
 * `window.start`, so every offset inside it is relative to that.
 */
const decodeWindow = <R extends JsonlEvent.Registry>(events: R, window: TailWindow): Option.Option<EnvelopeUnion<R>> =>
	Option.map(
		Envelope.lastValidResult(events, window.text),
		(envelope) =>
			({
				...envelope,
				line: new LineSlice({
					offset: envelope.line.offset + window.start,
					end: envelope.line.end + window.start,
					length: envelope.line.length,
					text: envelope.line.text,
					terminated: envelope.line.terminated,
				}),
			}) as EnvelopeUnion<R>,
	);

const makeEngine = Effect.fn("makeEngine")(function* (
	events: JsonlEvent.Registry,
	config: JournalConfig,
	fs: FileSystem.FileSystem,
): Effect.fn.Return<ErasedShape, PlatformError.PlatformError, Scope.Scope> {
		const terminalTags = new Set(events.filter((event) => event.terminal).map((event) => event.tag));
		const reopenTags = new Set(events.filter((event) => event.reopen).map((event) => event.tag));

		/** Guards the WRITE critical section only: file write plus ref updates. */
		const writePermit = Semaphore.makeUnsafe(1);
		/**
		 * The publish baton.
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
		 * Size alone cannot see a same-size replace; inode identity can. `ino` is
		 * an `Option` in core's `File.Info`, so on a platform that does not report
		 * it this degrades to truncation-only detection — stated rather than
		 * pretended away.
		 */
		let identity: Option.Option<string> = Option.none();
		const hub = yield* PubSub.bounded<Take.Take<EnvelopeUnion<JsonlEvent.Registry>, JsonlError>>(config.capacity ?? 64);
		const latest = yield* SubscriptionRef.make(Option.none<EnvelopeUnion<JsonlEvent.Registry>>());
		/** Refusal state. Read before the permit so a late append fails fast. */
		let closed = false;
		/** Logical bytes decoded so far — the resume cursor the watcher (P5) advances. */
		let consumed = 0;

		// Called per use rather than hoisted into a const: a hoisted Effect would
		// be correct only if every backend built a lazy one, and that is not a
		// property this service should depend on.
		const exists = () => fs.exists(config.path);

		const requireFile = Effect.gen(function* () {
			const present = yield* exists();
			if (!present) {
				return yield* new JournalNotFound({ path: config.path });
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
			return Option.isSome(current) && terminalTags.has(current.value.event);
		});

		/**
		 * Read `[from, to)` and decode the complete lines in it, in file order.
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
		const decodeRange =
			Effect.fn("decodeRange")(function*  (
			from: number,
			to: number,
		): Effect.fn.Return<
			{ readonly decoded: ReadonlyArray<EnvelopeUnion<JsonlEvent.Registry>>; readonly advanced: number },
			PlatformError.PlatformError
		> {
				const text = yield* readRangeText(fs, config.path, from + bomBytes, to - from);
				const lines = Line.split(text);
				const decoded: Array<EnvelopeUnion<JsonlEvent.Registry>> = [];
				let advanced = from;
				for (const line of lines) {
					if (!line.terminated) {
						break;
					}
					advanced = line.end + from;
					if (line.text.trim() === "") {
						continue;
					}
					const rebased = new LineSlice({
						offset: line.offset + from,
						end: line.end + from,
						length: line.length,
						text: line.text,
						terminated: true,
					});
					const envelope = Envelope.decodeResult(events, rebased);
					if (Result.isSuccess(envelope)) {
						decoded.push(envelope.success);
					}
				}
				return { decoded, advanced };
			});

		/**
		 * The one write path.
		 *
		 * `build` runs **inside the write permit**, so an inherit-and-patch reads
		 * the current state under the same lock that serializes the write. Reading
		 * outside it was a lost-update race: two concurrent patches to different
		 * fields both read the same base and the second silently reverted the
		 * first.
		 */
		const appendWith =
			Effect.fn("appendWith")(function* (
			event: string,
			build: (current: Option.Option<EnvelopeUnion<JsonlEvent.Registry>>) => unknown,
			scope: string | undefined,
		): Effect.fn.Return<EnvelopeUnion<JsonlEvent.Registry>, JournalWriteError> {
				// Refusal is checked BEFORE the permit: a late append must not queue
				// behind a draining flush only to be refused after waiting.
				if (closed) {
					return yield* new JournalClosed({ event });
				}

				const { envelope, external, predecessor, baton } = yield* writePermit.withPermits(1)(
					Effect.gen(function* () {
						if (closed) {
							return yield* new JournalClosed({ event });
						}
						yield* requireFile;

						const current = yield* SubscriptionRef.get(latest);
						if (Option.isSome(current) && terminalTags.has(current.value.event) && !reopenTags.has(event)) {
							return yield* new TerminalViolation({ event, terminal: current.value.event });
						}

						// Read-and-derive happens HERE, under the lock.
						const data = build(current);

						const at = yield* DateTime.now;
						const encoded = Envelope.encodeResult(events, {
							event: event as never,
							data: data as never,
							at,
							...(scope === undefined ? {} : { scope }),
						});
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
								return Number(info.size) - bomBytes;
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

						const line = new LineSlice({
							offset,
							end,
							length: bytes.length - 1,
							text: encoded.success.slice(0, -1),
							terminated: true,
						});
						const decoded = Envelope.decodeResult(events, line);
						if (Result.isFailure(decoded)) {
							return yield* decoded.failure;
						}
						yield* SubscriptionRef.set(latest, Option.some(decoded.success));

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

		const appendEncoded = (
			event: string,
			data: unknown,
			scope: string | undefined,
		): Effect.Effect<EnvelopeUnion<JsonlEvent.Registry>, JournalWriteError> => appendWith(event, () => data, scope);

		/**
		 * Read the file from `cursor`, frame-filtered before payload decode.
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
			slice: CursoredSlice<JsonlEvent.Registry, never> | undefined,
		): Stream.Stream<EnvelopeUnion<JsonlEvent.Registry>, JournalReadError | JsonlError> =>
			Stream.unwrap(
				Effect.gen(function* () {
					yield* requireFile;
					const from = slice?.cursor ?? 0;
					const info = yield* fs.stat(config.path);
					const logicalSize = Number(info.size) - bomBytes;
					if (from >= logicalSize) {
						return Stream.empty as Stream.Stream<EnvelopeUnion<JsonlEvent.Registry>, JournalReadError | JsonlError>;
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
					const selected: Array<EnvelopeUnion<JsonlEvent.Registry>> = [];
					for (const line of lines) {
						if (line.text.trim() === "") continue;
						const rebased = new LineSlice({
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
						const decoded = Envelope.decodeSelectedResult(events, rebased, (frame) =>
							matchesFrame(frame, slice as never),
						);
						if (Option.isNone(decoded)) continue;
						if (Result.isFailure(decoded.value)) {
							// A hole in the history is reported, never silently skipped.
							return Stream.concat(Stream.fromIterable(selected), Stream.fail(decoded.value.failure)) as Stream.Stream<
								EnvelopeUnion<JsonlEvent.Registry>,
								JournalReadError | JsonlError
							>;
						}
						selected.push(decoded.value.success);
					}
					return Stream.fromIterable(selected) as Stream.Stream<
						EnvelopeUnion<JsonlEvent.Registry>,
						JournalReadError | JsonlError
					>;
				}),
			);

		/**
		 * Envelope-level matching, for the live path.
		 *
		 * The frame-level {@link matchesFrame} is the one that carries the
		 * filter-before-decode guarantee; this is its counterpart for envelopes
		 * that arrived already decoded from the hub, where there is no decode left
		 * to avoid.
		 */
		const matchesEnvelope = (
			envelope: EnvelopeUnion<JsonlEvent.Registry>,
			slice: CursoredSlice<JsonlEvent.Registry, never> | undefined,
		): boolean =>
			matchesFrame(
				{
					at: envelope.at,
					event: envelope.event,
					...(envelope.scope === undefined ? {} : { scope: envelope.scope }),
					data: envelope.data,
				},
				slice as never,
			);

		const isTerminalEnvelope = (envelope: EnvelopeUnion<JsonlEvent.Registry>): boolean =>
			terminalTags.has(envelope.event);

		const changesStream = (
			slice: CursoredSlice<JsonlEvent.Registry, never> | undefined,
		): Stream.Stream<EnvelopeUnion<JsonlEvent.Registry>, JournalReadError | JsonlError> =>
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
						return replay as Stream.Stream<EnvelopeUnion<JsonlEvent.Registry>, JournalReadError | JsonlError>;
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
					const live = Stream.fromChannel(Channel.fromEffectTake(PubSub.take(subscription))).pipe(
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
					return Stream.concat(history, live) as Stream.Stream<
						EnvelopeUnion<JsonlEvent.Registry>,
						JournalReadError | JsonlError
					>;
				}),
			);

		const identityOf = (info: FileSystem.File.Info): Option.Option<string> =>
			Option.map(info.ino, (ino) => `${info.dev}:${ino}`);

		/**
		 * Ingest whatever has been appended since `consumed`, publishing it into
		 * the SAME hub, `latest` and projections as a local append.
		 *
		 * Runs under the write permit and links the publish baton exactly as
		 * `appendWith` does, so external and local envelopes enter the hub in FILE
		 * order as one interleaved sequence — a subscriber cannot tell them apart,
		 * including by ordering.
		 */
		/**
		 * Serializes ingests against each other.
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
				const logicalSize = Number(info.size) - bomBytes;

				// Contract breach: the file shrank below what we read, or the path now
				// names a different file. Surfaced, never silently reconciled.
				const replaced =
					Option.isSome(identity) && Option.isSome(currentIdentity) && identity.value !== currentIdentity.value;
				if (replaced || logicalSize < consumed) {
					const failure = new JournalResync({
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
					yield* SubscriptionRef.set(latest, Option.none());
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
						if (decoded.length > 0) {
							yield* SubscriptionRef.set(latest, Option.some(decoded[decoded.length - 1] as never));
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

		const shape: ErasedShape = {
			append: (event, data, options) => appendEncoded(event, data, options?.scope) as never,
			appendPatch: (event, patch, options) =>
				appendWith(
					event,
					// Runs under the write permit, so the base cannot change between the
					// read and the write.
					(current) => {
						const base = Option.isSome(current) ? current.value.data : undefined;
						// Nothing inheritable — an empty journal, a void/scalar/array
						// payload, or a patch from a different class — means the patch IS
						// the data. A partial patch then fails its schema as
						// `InvalidData`, naming the missing fields.
						//
						// A decoded `Schema.Class` base DOES merge: excluding it would
						// silently drop state whenever the omitted fields happened to be
						// optional, which validates cleanly and looks like success.
						if (!canMerge(base, patch)) {
							return patch;
						}
						return shallowMerge(base as Record<string, unknown>, patch as Record<string, unknown>);
					},
					options?.scope,
				) as never,
			latest,
			quiescent: isTerminalTail,
			query: ((slice: CursoredSlice<JsonlEvent.Registry, never> | undefined) =>
				readFrom(slice).pipe(Stream.filter((envelope) => matchesEnvelope(envelope, slice)))) as never,
			changes: ((slice: CursoredSlice<JsonlEvent.Registry, never> | undefined) =>
				changesStream(slice).pipe(Stream.filter((envelope) => matchesEnvelope(envelope, slice)))) as never,
			projection: (<S>(
				initial: S,
				fold: (state: S, envelope: EnvelopeUnion<JsonlEvent.Registry>) => S,
				slice?: CursoredSlice<JsonlEvent.Registry, never>,
			) =>
				changesStream(slice).pipe(
					Stream.filter((envelope) => matchesEnvelope(envelope, slice)),
					Stream.scan(initial, fold),
				)) as never,
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
			yield* refresh.pipe(Effect.catchTag("JournalNotFound", () => Effect.succeed(Option.none())));
			const info = yield* fs.stat(config.path);
			// LOGICAL, post-BOM — the same space every offset this package emits
			// lives in. Seeding it physically put every subsequent append's offset
			// three bytes out on a BOM'd journal.
			consumed = Number(info.size) - bomBytes;
		}

		/**
		 * Watch for the life of the layer scope.
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
					// `WatchBackend` in this layer's `R`. Flagged for a ruling.
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
		yield* Effect.addFinalizer(
			Effect.fnUntraced(function* () {
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
 */
export interface JournalClass<Self, Id extends string, R extends JsonlEvent.Registry>
	extends Context.ServiceClass<Self, Id, JournalShape<R>> {
	/** The registry this journal was defined over. */
	readonly events: R;
	/**
	 * Build the layer for this journal.
	 *
	 * @remarks
	 * **Construction can fail with a `PlatformError`, and that is deliberate.** A
	 * journal file that does not exist yet is a legal state and constructs
	 * cleanly — but a file that exists and cannot be read (`EACCES`, a bad
	 * handle) is a real failure, and typing this channel `never` would have made
	 * it arrive as an untypeable defect that no caller could catch.
	 *
	 * **Bind the result to a const and provide that const.** Layers are memoized
	 * by reference, so calling this twice mints **two independent journals over
	 * one file** — two semaphores, two hubs, two `latest` refs — and their
	 * appends are not serialized against each other. That is the in-process form
	 * of exactly the interleaving the cooperative-writer rules exist to prevent,
	 * and it typechecks perfectly.
	 *
	 * ```ts
	 * // correct
	 * export const layer = MailJournal.layer({ path });
	 *
	 * // WRONG — a second, unserialized journal over the same file
	 * Effect.provide(program, MailJournal.layer({ path }));
	 * ```
	 */
	readonly layer: (config: JournalConfig) => Layer.Layer<Self, PlatformError.PlatformError, FileSystem.FileSystem>;
}

/**
 * Define a `Journal` service class over a registry.
 *
 * A `Context.Service` cannot itself be generic over the registry — the shape
 * binds at declaration and a Key cannot be parameterized at retrieval — so each
 * registry gets its own uniquely-keyed class, and several journals coexist in
 * one layer graph with each one's operations typed by *its* registry. This
 * mirrors `ConfigFile.Service<Self, A>()(id)`.
 *
 * @example
 * ```ts
 * import { Journal, JsonlEvent } from "@effected/jsonl";
 * import { Schema } from "effect";
 *
 * const events = [JsonlEvent.make("started", { data: Schema.Void })] as const;
 *
 * class MailJournal extends Journal.Service<MailJournal>()("dogfood/MailJournal", { events }) {}
 *
 * export const layer = MailJournal.layer({ path: ".claude/dogfood/silk.jsonl" });
 * ```
 *
 * @public
 */
export const Journal = {
	Service:
		<Self>() =>
		<const Id extends string, const R extends JsonlEvent.Registry>(
			id: Id,
			options: { readonly events: R },
		): JournalClass<Self, Id, R> => {
			class JournalService extends Context.Service<Self, JournalShape<R>>()(id) {
				static readonly events = options.events;
				static readonly layer = (
					config: JournalConfig,
				): Layer.Layer<Self, PlatformError.PlatformError, FileSystem.FileSystem> =>
					Layer.effect(
						JournalService,
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							return yield* makeEngine(options.events, config, fs);
							// Cast two: the engine is built type-erased and typed once here.
							// It narrows the SHAPE and nothing else — the error channel is
							// `makeEngine`'s own, so an unreadable journal stays catchable
							// instead of becoming a defect the caller cannot name.
						}) as unknown as Effect.Effect<
							JournalShape<R>,
							PlatformError.PlatformError,
							FileSystem.FileSystem | Scope.Scope
						>,
					);
			}
			// Cast one: the class's static side carries `events`/`layer`, which the
			// Context.Service base does not know about.
			return JournalService as unknown as JournalClass<Self, Id, R>;
		},
} as const;
