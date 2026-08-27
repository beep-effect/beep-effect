/**
 * The JSONL error taxonomy.
 *
 * Every tag names a distinct recovery a caller would actually make, and every
 * cause is carried structurally rather than stringified. Core's `PlatformError`
 * passes through untranslated rather than being wrapped.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Option, Schema } from "effect";
import { LineSlice } from "./LineSlice.ts";

const $I = $ScratchpadId.create("jsonl/JsonlError");

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
 * This is the expected steady state at the tail of a live journal, not
 * necessarily corruption: a writer caught mid-`write` leaves a partial final
 * line, and `LineSlice.terminated` is what distinguishes the two cases.
 *
 * Malformed input always fails through this typed channel — never as a defect,
 * and never by being silently dropped from a read.
 *
 * **Gotchas**
 *
 * An unterminated malformed line is a torn tail that the next append completes;
 * a *terminated* malformed line is a hole in the history that will never heal.
 *
 * **Example** (Torn tail vs terminated hole)
 *
 * ```ts
 * import { Line } from "@beep/scratchpad/jsonl"
 * import { Result } from "effect"
 *
 * const torn = Line.split('{"a":')[0]
 * const hole = Line.split('{"a":\n')[0]
 * if (torn !== undefined && hole !== undefined) {
 *   const tornParsed = Line.parseResult(torn)
 *   const holeParsed = Line.parseResult(hole)
 *   console.log(Result.isFailure(tornParsed) && torn.terminated === false) // true
 *   console.log(Result.isFailure(holeParsed) && hole.terminated === true) // true
 * }
 * ```
 *
 * @see {@link JournalWriteError} for why an append `PlatformError` is a possibly-torn tail.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class MalformedLine extends Schema.TaggedError<MalformedLine>($I`MalformedLine`)(
  "MalformedLine",
  {
    /** The offending line, with its byte offsets into the source. */
    line: LineSlice,
  },
  $I.annote("MalformedLine", {
    description: "A journal line that is not valid JSON, torn at the tail or a terminated hole.",
  })
) {
  /** @internal */
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
 * **Example** (Unknown tag carries the known set)
 *
 * ```ts
 * import { Line, UnknownEvent } from "@beep/scratchpad/jsonl"
 *
 * const line = Line.split('{"at":"2026-01-15T12:00:00.000Z","event":"mystery","data":null}\n')[0]
 * if (line !== undefined) {
 *   const error = new UnknownEvent({ line, event: "mystery", known: ["mail-received"] })
 *   console.log(error._tag) // "UnknownEvent"
 *   console.log(error.event) // "mystery"
 *   console.log(error.known) // ["mail-received"]
 * }
 * ```
 *
 * @see {@link InvalidData} for a known tag whose payload failed its schema.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class UnknownEvent extends Schema.TaggedError<UnknownEvent>($I`UnknownEvent`)(
  "UnknownEvent",
  {
    /** The offending line, with its byte offsets into the source. */
    line: LineSlice,
    /** The unrecognized tag as it appeared on the envelope. */
    event: Schema.String,
    /** The tags this journal's registry does define. */
    known: Schema.Array(Schema.String),
  },
  $I.annote("UnknownEvent", {
    description: "A line whose event tag is not in the journal registry.",
  })
) {
  /** @internal */
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
 * **Gotchas**
 *
 * Recovery is "fix the value". {@link UnserializableData} is the sibling for a
 * value that validated but cannot be JSON — that recovery is "change the
 * shape", not the instance.
 *
 * **Example** (Payload schema rejects a known tag)
 *
 * ```ts
 * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/jsonl"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const MailReceived = JsonlEvent.make("mail-received", {
 *   data: S.Struct({ round: S.Number }),
 * })
 * const line = Line.split(
 *   '{"at":"2026-01-15T12:00:00.000Z","event":"mail-received","data":{"round":"nope"}}\n',
 * )[0]
 * if (line !== undefined) {
 *   const decoded = Envelope.decodeResult([MailReceived], line)
 *   console.log(Result.isFailure(decoded)) // true
 *   if (Result.isFailure(decoded)) {
 *     console.log(decoded.failure._tag) // "InvalidData"
 *   }
 * }
 * ```
 *
 * @see {@link UnserializableData} for a valid value that cannot be serialized.
 * @see {@link UnknownEvent} for a tag the registry does not define.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidData extends Schema.TaggedError<InvalidData>($I`InvalidData`)(
  "InvalidData",
  {
    /** The offending line, with its byte offsets into the source. */
    line: LineSlice,
    /**
     * The event tag whose payload schema rejected the data, or `none` when it
     * was the envelope frame itself that failed.
     */
    event: Schema.Option(Schema.String),
    /** The schema failure, carried structurally — `issue` is the full tree. */
    error: SchemaErrorFromSelf,
  },
  $I.annote("InvalidData", {
    description: "A line whose envelope frame or registered payload failed schema validation.",
  })
) {
  /** @internal */
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
 * **Gotchas**
 *
 * Recovery is "append a `reopen` event or stop". {@link JournalClosed} is a
 * lifecycle fact — this service is gone — and sharing a recovery with this tag
 * would mix a reopenable state with a dead layer.
 *
 * **Example** (Match a refused non-reopen append)
 *
 * ```ts
 * import { TerminalViolation } from "@beep/scratchpad/jsonl"
 *
 * const error = new TerminalViolation({ event: "mail-received", terminal: "unlinked" })
 * console.log(error._tag) // "TerminalViolation"
 * console.log(error.terminal) // "unlinked"
 * ```
 *
 * @see {@link JournalClosed} for an append refused because the service closed.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TerminalViolation extends Schema.TaggedError<TerminalViolation>($I`TerminalViolation`)(
  "TerminalViolation",
  {
    /** The tag of the event whose append was refused. */
    event: Schema.String,
    /** The terminal event currently at the tail of the journal. */
    terminal: Schema.String,
  },
  $I.annote("TerminalViolation", {
    description: "An append refused because the journal tail is terminal and the event is not reopen.",
  })
) {
  /** @internal */
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
 * **Example** (Path that must be created first)
 *
 * ```ts
 * import { JournalNotFound } from "@beep/scratchpad/jsonl"
 *
 * const error = new JournalNotFound({ path: "/tmp/mail.jsonl" })
 * console.log(error._tag) // "JournalNotFound"
 * console.log(error.path) // "/tmp/mail.jsonl"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JournalNotFound extends Schema.TaggedError<JournalNotFound>($I`JournalNotFound`)(
  "JournalNotFound",
  {
    /** The path that does not exist. */
    path: Schema.String,
  },
  $I.annote("JournalNotFound", {
    description: "An operation against a journal file that does not exist yet.",
  })
) {
  /** @internal */
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
 * **Gotchas**
 *
 * `message` must not render a cyclic `cause` — that is the value that could not
 * be serialized in the first place. A raw `TypeError` escaping the encode path
 * is worse: `Effect.fromResult` evaluates its argument eagerly, so an unguarded
 * throw happens at **construction** of the `Effect`, before any fiber exists.
 *
 * **Example** (Cause is carried, not stringified)
 *
 * ```ts
 * import { UnserializableData } from "@beep/scratchpad/jsonl"
 *
 * const error = new UnserializableData({
 *   event: "mail-received",
 *   cause: new TypeError("Do not know how to serialize a BigInt"),
 * })
 * console.log(error._tag) // "UnserializableData"
 * console.log(error.message.includes("Do not know how to serialize a BigInt")) // true
 * ```
 *
 * @see {@link InvalidData} for a value that failed its payload schema.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class UnserializableData extends Schema.TaggedError<UnserializableData>($I`UnserializableData`)(
  "UnserializableData",
  {
    /** The event tag whose payload could not be serialized. */
    event: Schema.String,
    /** The value `JSON.stringify` threw, carried structurally. */
    cause: Schema.Unknown,
  },
  $I.annote("UnserializableData", {
    description: "A payload that validated against its schema but cannot be serialized to JSON.",
  })
) {
  /** @internal */
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
 * **Example** (Closed is not terminal)
 *
 * ```ts
 * import { JournalClosed } from "@beep/scratchpad/jsonl"
 *
 * const error = new JournalClosed({ event: "mail-received" })
 * console.log(error._tag) // "JournalClosed"
 * console.log(error.event) // "mail-received"
 * ```
 *
 * @see {@link TerminalViolation} for an append refused by a quiescent tail.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JournalClosed extends Schema.TaggedError<JournalClosed>($I`JournalClosed`)(
  "JournalClosed",
  {
    /** The tag of the event whose append was refused. */
    event: Schema.String,
  },
  $I.annote("JournalClosed", {
    description: "An append refused because the journal service scope has closed.",
  })
) {
  /** @internal */
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
 * **Gotchas**
 *
 * Detection is as complete as the platform allows and no more. Truncation is
 * caught by size; replacement is caught by inode identity, which
 * `FileSystem.File.Info` exposes as an **`Option`** — on a platform that does
 * not report it, a replacement at equal or greater size is undetectable and
 * only truncation is caught.
 *
 * **Example** (Truncated vs replaced, same recovery)
 *
 * ```ts
 * import { JournalResync } from "@beep/scratchpad/jsonl"
 *
 * const truncated = new JournalResync({
 *   path: "/tmp/mail.jsonl",
 *   reason: "truncated",
 *   expected: 120,
 *   actual: 40,
 * })
 * const replaced = new JournalResync({
 *   path: "/tmp/mail.jsonl",
 *   reason: "replaced",
 *   expected: 120,
 *   actual: 200,
 * })
 * console.log(truncated.reason) // "truncated"
 * console.log(replaced.reason) // "replaced"
 * console.log(truncated._tag === replaced._tag) // true
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JournalResync extends Schema.TaggedError<JournalResync>($I`JournalResync`)(
  "JournalResync",
  {
    /** The journal path whose file changed identity or shrank. */
    path: Schema.String,
    /** Which contract breach was detected. Diagnostic; the recovery is the same. */
    reason: Schema.Literals(["truncated", "replaced"]),
    /** The logical offset the reader had consumed to. */
    expected: Schema.Finite,
    /** The file's logical size when the breach was noticed. */
    actual: Schema.Finite,
  },
  $I.annote("JournalResync", {
    description: "The journal file was truncated or replaced beneath a reader.",
  })
) {
  /** @internal */
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
 * @see {@link MalformedLine} for JSON that is not a line.
 * @see {@link UnknownEvent} for a tag the registry does not define.
 * @see {@link InvalidData} for a known tag whose payload failed its schema.
 * @see {@link UnserializableData} for a valid value that cannot be JSON.
 * @see {@link TerminalViolation} for a quiescent tail refusing a non-reopen append.
 * @see {@link JournalClosed} for an append refused because the service closed.
 * @see {@link JournalNotFound} for a missing file that must be created explicitly.
 * @see {@link JournalResync} for truncation or replacement beneath a reader.
 * @public
 * @category errors
 * @since 0.0.0
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
