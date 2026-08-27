/**
 * The `@effected/jsonl` error taxonomy.
 *
 * Every tag names a distinct recovery a caller would actually make, and every
 * cause is carried structurally rather than stringified. Core's `PlatformError`
 * passes through untranslated rather than being wrapped.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect";
import { LineSlice } from "./LineSlice.ts";

/**
 * `Schema.SchemaError` as a schema of itself.
 *
 * A schema issue tree is a live object graph, not something with a wire form,
 * so it is declared by its type guard rather than given an encoding. That is
 * what lets {@link InvalidData} be an ordinary schema-backed tagged error while
 * still carrying the failure **structurally** — `error.issue` keeps its paths
 * and expected types — instead of flattening it to a string at the boundary.
 */
const SchemaErrorFromSelf = Schema.declare(Schema.isSchemaError);

/**
 * A journal line that is not valid JSON.
 *
 * **This is the expected steady state at the tail of a live journal**, not
 * necessarily corruption: a writer caught mid-`write` leaves a partial final
 * line, and `LineSlice.terminated` is what distinguishes the two cases. An
 * unterminated malformed line is a torn tail that the next append completes; a
 * *terminated* malformed line is a hole in the history that will never heal.
 *
 * Malformed input always fails through this typed channel — never as a defect,
 * and never by being silently dropped from a read.
 *
 * @example
 * ```ts
 * import { Line } from "@effected/jsonl";
 * import { Result } from "effect";
 *
 * const [line] = Line.split('{"a":');
 * const parsed = Line.parseResult(line!);
 * if (Result.isFailure(parsed)) {
 *   parsed.failure.line.terminated; // false — a torn tail, not a hole
 * }
 * ```
 *
 * @public
 */
export class MalformedLine extends Schema.TaggedError<MalformedLine>()("MalformedLine", {
	/** The offending line, with its byte offsets into the source. */
	line: LineSlice,
}) {
	override get message(): string {
		const kind = this.line.terminated ? "malformed line" : "unterminated final line";
		return `JSONL ${kind} at byte offset ${this.line.offset}`;
	}
}

/**
 * A line whose `event` tag is not in the registry.
 *
 * Typed rather than a defect on purpose: a journal written by an older or newer
 * version of the same application is hostile input in the technical sense, and
 * a reader that crashed on an unrecognized tag would be unable to skip forward
 * past one. The known tags travel with the error so a caller can report the
 * mismatch without reaching back for the registry.
 *
 * @public
 */
export class UnknownEvent extends Schema.TaggedError<UnknownEvent>()("UnknownEvent", {
	/** The offending line, with its byte offsets into the source. */
	line: LineSlice,
	/** The unrecognized tag as it appeared on the envelope. */
	event: Schema.String,
	/** The tags this journal's registry does define. */
	known: Schema.Array(Schema.String),
}) {
	override get message(): string {
		return `unknown JSONL event ${JSON.stringify(this.event)} at byte offset ${this.line.offset}`;
	}
}

/**
 * A line whose envelope or payload failed schema validation.
 *
 * Covers both stages of the two-stage decode, distinguished by `event`: the
 * frame itself (`Option.none()` — the line is JSON but not an envelope) and a
 * registered payload (`Option.some(tag)` — the envelope is well-formed but its
 * `data` does not match the schema registered for that tag).
 *
 * The `SchemaError` is carried **whole**, so `error.issue` is the full issue
 * tree with its paths and expected types intact. Nothing here is stringified;
 * `message` renders lazily and only when something asks for it.
 *
 * @public
 */
export class InvalidData extends Schema.TaggedError<InvalidData>()("InvalidData", {
	/** The offending line, with its byte offsets into the source. */
	line: LineSlice,
	/**
	 * The event tag whose payload schema rejected the data, or `none` when it
	 * was the envelope frame itself that failed.
	 */
	event: Schema.Option(Schema.String),
	/** The schema failure, carried structurally — `issue` is the full tree. */
	error: SchemaErrorFromSelf,
}) {
	override get message(): string {
		const where = Option.isSome(this.event) ? `payload for event ${JSON.stringify(this.event.value)}` : "envelope";
		return `invalid JSONL ${where} at byte offset ${this.line.offset}: ${this.error.message}`;
	}
}

/**
 * An append attempted after a terminal event, by an event not marked `reopen`.
 *
 * A journal whose tail is terminal is quiescent: it is finished, and appending
 * to it would silently resurrect a closed loop. Reopening is legal but must be
 * declared, which is what `reopen` marks.
 *
 * @public
 */
export class TerminalViolation extends Schema.TaggedError<TerminalViolation>()("TerminalViolation", {
	/** The tag of the event whose append was refused. */
	event: Schema.String,
	/** The terminal event currently at the tail of the journal. */
	terminal: Schema.String,
}) {
	override get message(): string {
		return `cannot append ${JSON.stringify(this.event)}: the journal is terminal at ${JSON.stringify(this.terminal)}`;
	}
}

/**
 * An operation against a journal file that does not exist.
 *
 * A missing journal is a **legal state** — building the layer over a path that
 * does not exist yet succeeds, and the watcher activates once the file appears.
 * What is not legal is materializing it implicitly: `append`, `query` and
 * `latest` fail with this rather than creating the file, so a typo in a path
 * cannot quietly produce a second, empty journal that looks like a working
 * system with no history. Creation is always explicit, via `create`.
 *
 * @public
 */
export class JournalNotFound extends Schema.TaggedError<JournalNotFound>()("JournalNotFound", {
	/** The path that does not exist. */
	path: Schema.String,
}) {
	override get message(): string {
		return `journal not found: ${this.path}`;
	}
}

/**
 * A payload that validated against its schema but cannot be serialized to JSON.
 *
 * The two reachable causes are a `bigint` anywhere in the encoded value and a
 * reference cycle; `JSON.stringify` throws a `TypeError` for both. A payload
 * schema is free to permit either — `Schema.Unknown` permits everything — so
 * schema validity does not imply serializability and the encode path has to
 * treat them as separate questions.
 *
 * This is its own tag rather than a flavour of {@link InvalidData} because the
 * recovery differs: `InvalidData` means the value is wrong and the caller
 * should fix the value, while this means the value is fine but unrepresentable
 * in this format and the caller must change the *shape* they are journaling.
 *
 * The thrown value is carried as-is under `cause` — never stringified, and
 * never re-thrown. A raw `TypeError` escaping the encode path would be
 * especially bad here: `Effect.fromResult` evaluates its argument eagerly, so
 * an unguarded throw happens at **construction** of the `Effect`, before any
 * fiber exists, where not even `Effect.runSyncExit` can catch it.
 *
 * @public
 */
export class UnserializableData extends Schema.TaggedError<UnserializableData>()("UnserializableData", {
	/** The event tag whose payload could not be serialized. */
	event: Schema.String,
	/** The value `JSON.stringify` threw, carried structurally. */
	cause: Schema.Unknown,
}) {
	override get message(): string {
		// Deliberately does not render `cause`: it may be the very cyclic value
		// that could not be serialized in the first place.
		const detail = this.cause instanceof Error ? this.cause.message : "value is not JSON-serializable";
		return `cannot serialize payload for event ${JSON.stringify(this.event)}: ${detail}`;
	}
}

/**
 * An append refused because the journal's scope has closed.
 *
 * Its own tag rather than a flavour of {@link TerminalViolation}, because the
 * recoveries have nothing in common: a terminal journal is a *state* the
 * consumer can reason about and reopen from with a `reopen` event, while a
 * closed one is a *lifecycle* fact — this service is gone, and the only moves
 * are to build a new layer or stop.
 *
 * Refusal is deliberately a typed failure rather than a wait. A `Latch` would
 * suspend the late append with no failure channel, turning "the journal is
 * closing" into a hang; failing fast is what lets a caller react.
 *
 * @public
 */
export class JournalClosed extends Schema.TaggedError<JournalClosed>()("JournalClosed", {
	/** The tag of the event whose append was refused. */
	event: Schema.String,
}) {
	override get message(): string {
		return `cannot append ${JSON.stringify(this.event)}: the journal is closed`;
	}
}

/**
 * The journal file was truncated or replaced beneath a reader.
 *
 * The cooperative-writer contract is append-only: a journal only ever grows,
 * and every cursor this package hands out depends on that. When the file shrinks
 * below a tracked offset, or the path comes to name a different file entirely,
 * the contract has been broken by something outside the package and every
 * offset-derived belief is now meaningless.
 *
 * Surfaced rather than repaired, deliberately. Silently re-reading from zero
 * would paper over a real operational fault — a rotating log shipper, a
 * `>` where `>>` was meant — and leave projections quietly inconsistent with
 * the file. The recovery is the consumer's: discard cursor-derived state,
 * re-read, and tell somebody.
 *
 * One tag rather than two, though `reason` distinguishes the causes: truncation
 * and replacement have the **same** recovery, and a tag per cause would split
 * one recovery across two tags.
 *
 * @remarks
 * Detection is as complete as the platform allows and no more. Truncation is
 * caught by size; replacement is caught by inode identity, which
 * `FileSystem.File.Info` exposes as an **`Option`** — on a platform that does
 * not report it, a replacement at equal or greater size is undetectable and
 * only truncation is caught.
 *
 * @public
 */
export class JournalResync extends Schema.TaggedError<JournalResync>()("JournalResync", {
	/** The journal path whose file changed identity or shrank. */
	path: Schema.String,
	/** Which contract breach was detected. Diagnostic; the recovery is the same. */
	reason: Schema.Literals(["truncated", "replaced"]),
	/** The logical offset the reader had consumed to. */
	expected: Schema.Number,
	/** The file's logical size when the breach was noticed. */
	actual: Schema.Number,
}) {
	override get message(): string {
		return `journal ${this.reason} beneath the reader at ${this.path}: consumed ${this.expected}, file is now ${this.actual}`;
	}
}

/**
 * Every error this package raises from the pure core and the journal service.
 *
 * Core's `PlatformError` is deliberately **not** a member: IO failures pass
 * through untranslated rather than being wrapped in a taxonomy that would add
 * no recovery information.
 *
 * @public
 */
export type JsonlError =
	| MalformedLine
	| UnknownEvent
	| InvalidData
	| UnserializableData
	| TerminalViolation
	| JournalClosed
	| JournalNotFound
	| JournalResync;
