/**
 * Recoverable failures for JSONL decoding, encoding and journal lifecycles.
 * @packageDocumentation
 * @since 0.0.0
 */
// The `@effected/jsonl` error taxonomy.
//
// Every tag names a distinct recovery a caller would actually make, and every
// cause is carried structurally rather than stringified. Core's `PlatformError`
// passes through untranslated rather than being wrapped.
// Message fields initialize after schema fields: Bun may inspect Error.message
// during base construction, before a derived getter can safely read those fields.

import { $ScratchpadId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ByteCount, LineSlice } from "./LineSlice.ts";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $ScratchpadId.create("effected/jsonl/JsonlError");
const encodeString = S.encodeResult(S.fromJsonString(S.String));
// JSON encoding is total for strings, including isolated UTF-16 surrogates.
const quote = (value: string): string => Result.getOrThrow(encodeString(value));

/**
 * `S.SchemaError` as a schema of itself.
 *
 * **Details**
 *
 * A schema issue tree is a live object graph, not something with a wire form,
 * so it is declared by its type guard rather than given an encoding. That is
 * what lets {@link InvalidData} be an ordinary schema-backed tagged error while
 * still carrying the failure **structurally** — `error.issue` keeps its paths
 * and expected types — instead of flattening it to a string at the boundary.
 */
const SchemaErrorFromSelf = S.declare(S.isSchemaError).pipe(
  // An issue tree has no structural equality; two failures are the same
  // failure only when they are the same object, so equivalence is identity.
  S.overrideToEquivalence(() => (self, that) => self === that),
  $I.annoteSchema("SchemaErrorFromSelf", {
    description: "`S.SchemaError` as a schema of itself.",
    documentation:
      "A schema issue tree is a live object graph, not something with a wire form,\nso it is declared by its type guard rather than given an encoding. That is\nwhat lets {@link InvalidData} be an ordinary schema-backed tagged error while\nstill carrying the failure **structurally** — `error.issue` keeps its paths\nand expected types — instead of flattening it to a string at the boundary.",
  })
);

/**
 * A textual line that is not valid JSON.
 *
 * **Details**
 *
 * A terminated malformed line is a permanent hole in history and fails through
 * this typed channel when read. An incomplete suffix is withheld during live
 * replay so its original writer can finish it. Local append reports
 * {@link JournalUnterminated} for every physical unterminated suffix until its
 * original writer completes it or an explicit recovery operation repairs it.
 *
 * **Example** (Construct a MalformedLine failure)
 * ```ts import.meta.vitest name="Construct a MalformedLine failure"
 * import { LineSlice } from "@beep/scratchpad/effected/jsonl/index";
 * const line = LineSlice.make({ offset: 0, end: 1, length: 1, text: "{", terminated: false });
 * import { MalformedLine } from "@beep/scratchpad/effected/jsonl/index";
 * MalformedLine.make({ line }).message // => "JSONL unterminated final line at byte offset 0"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class MalformedLine extends S.TaggedError<MalformedLine>($I`MalformedLine`)(
  "MalformedLine",
  {
    /** The offending line, with its byte offsets into the source. */
    line: LineSlice.pipe(
      $I.annoteKey("MalformedLine.line", {
        description: "The offending line, with its byte offsets into the source.",
      })
    ),
  },
  $I.annote("MalformedLine", {
    description: "A textual line that is not valid JSON.",
    documentation:
      "Terminated malformed records fail through this typed channel. Incomplete suffixes are withheld during live replay. Local append reports JournalUnterminated for every physical unterminated suffix until its original writer completes it or an explicit recovery operation repairs it.",
  })
) {
  /**
   * Human-readable context for this failure; structured fields retain its details.
   *
   * **Example** (Read the malformed-line message)
   * ```ts import.meta.vitest name="Read the malformed-line message"
   * import { LineSlice } from "@beep/scratchpad/effected/jsonl/index";
   * const line = LineSlice.make({ offset: 0, end: 1, length: 1, text: "{", terminated: false });
   * import { MalformedLine } from "@beep/scratchpad/effected/jsonl/index";
   * MalformedLine.make({ line }).message // => "JSONL unterminated final line at byte offset 0"
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message =
    `JSONL ${this.line.terminated ? "malformed line" : "unterminated final line"} at byte offset ${this.line.offset}`;
}

/**
 * A line whose `event` tag is not in the registry.
 *
 * **Details**
 *
 * Typed rather than a defect on purpose: a journal written by an older or newer
 * version of the same application is hostile input in the technical sense, and
 * a reader that crashed on an unrecognized tag would be unable to skip forward
 * past one. The known tags travel with the error so a caller can report the
 * mismatch without reaching back for the registry.
 *
 * **Example** (Report an unknown event tag)
 * ```ts import.meta.vitest name="Report an unknown event tag"
 * import { LineSlice } from "@beep/scratchpad/effected/jsonl/index";
 * const line = LineSlice.make({ offset: 0, end: 1, length: 1, text: "{", terminated: false });
 * import { UnknownEvent } from "@beep/scratchpad/effected/jsonl/index";
 * const error = UnknownEvent.make({ line, event: "foreign", known: ["started"] });
 * error.known // => ["started"]
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class UnknownEvent extends S.TaggedError<UnknownEvent>($I`UnknownEvent`)(
  "UnknownEvent",
  {
    /** The offending line, with its byte offsets into the source. */
    line: LineSlice.pipe(
      $I.annoteKey("UnknownEvent.line", {
        description: "The offending line, with its byte offsets into the source.",
      })
    ),
    /** The unrecognized tag as it appeared on the envelope. */
    event: S.String.pipe(
      $I.annoteKey("UnknownEvent.event", {
        description: "The unrecognized tag as it appeared on the envelope.",
      })
    ),
    /** The tags this journal's registry does define. */
    known: S.String.pipe(
      S.Array,
      $I.annoteKey("UnknownEvent.known", {
        description: "The tags this journal's registry does define.",
      })
    ),
  },
  $I.annote("UnknownEvent", {
    description: "A line whose `event` tag is not in the registry.",
    documentation:
      "Typed rather than a defect on purpose: a journal written by an older or newer\nversion of the same application is hostile input in the technical sense, and\na reader that crashed on an unrecognized tag would be unable to skip forward\npast one. The known tags travel with the error so a caller can report the\nmismatch without reaching back for the registry.",
  })
) {
  /**
   * Human-readable context for this failure; structured fields retain its details.
   *
   * **Example** (Read the unknown-event message)
   * ```ts import.meta.vitest name="Read the unknown-event message"
   * import { LineSlice } from "@beep/scratchpad/effected/jsonl/index";
   * const line = LineSlice.make({ offset: 0, end: 1, length: 1, text: "{", terminated: false });
   * import { UnknownEvent } from "@beep/scratchpad/effected/jsonl/index";
   * const error = UnknownEvent.make({ line, event: "foreign", known: ["started"] });
   * error.message // => 'unknown JSONL event "foreign" at byte offset 0'
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message = `unknown JSONL event ${quote(this.event)} at byte offset ${this.line.offset}`;
}

/**
 * A line whose envelope or payload failed schema validation.
 *
 * **Details**
 *
 * Covers both stages of the two-stage decode, distinguished by `event`: the
 * frame itself (`O.none()` — the line is JSON but not an envelope) and a
 * registered payload (`O.some(tag)` — the envelope is well-formed but its
 * `data` does not match the schema registered for that tag).
 *
 * The `SchemaError` is carried **whole**, so `error.issue` is the full issue
 * tree with its paths and expected types intact. The message is initialized
 * eagerly after those schema fields and formats the retained issue tree.
 *
 * **Example** (Inspect invalid payload details)
 * ```ts
 * import { pipe } from "effect/Function";
 * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/effected/jsonl/index";
 * import * as A from "effect/Array";
 * import * as O from "effect/Option";
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema";
 * const events = [JsonlEvent.make("started", { data: S.String })];
 * const failure = pipe(Line.split('42'), A.head, O.map(Envelope.decodeResult(events)));
 * O.isSome(failure) && Result.isFailure(failure.value) && failure.value.failure._tag // => "InvalidData"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidData extends S.TaggedError<InvalidData>($I`InvalidData`)(
  "InvalidData",
  {
    /** The offending line, with its byte offsets into the source. */
    line: LineSlice.pipe(
      $I.annoteKey("InvalidData.line", {
        description: "The offending line, with its byte offsets into the source.",
      })
    ),
    /**
     * The event tag whose payload schema rejected the data, or `none` when it
     * was the envelope frame itself that failed.
     */
    event: S.String.pipe(
      S.Option,
      $I.annoteKey("InvalidData.event", {
        description:
          "The event tag whose payload schema rejected the data, or `none` when it was the envelope frame itself that failed.",
      })
    ),
    /** The schema failure, carried structurally — `issue` is the full tree. */
    error: SchemaErrorFromSelf.pipe(
      $I.annoteKey("InvalidData.error", {
        description: "The schema failure, carried structurally — `issue` is the full tree.",
      })
    ),
  },
  $I.annote("InvalidData", {
    description: "A line whose envelope or payload failed schema validation.",
    documentation:
      "Covers both stages of the two-stage decode, distinguished by `event`: the\nframe itself (`O.none()` — the line is JSON but not an envelope) and a\nregistered payload (`O.some(tag)` — the envelope is well-formed but its\n`data` does not match the schema registered for that tag).\nThe `SchemaError` is carried **whole**, so `error.issue` is the full issue\ntree with its paths and expected types intact. The message initializes eagerly\nafter those fields and formats the retained issue tree.",
  })
) {
  /**
   * Human-readable context for this failure; structured fields retain its details.
   *
   * **Example** (Read the invalid-payload message)
   * ```ts
   * import { pipe } from "effect/Function";
   * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as O from "effect/Option";
   * import * as Result from "effect/Result";
   * import * as S from "effect/Schema";
   * import * as Str from "effect/String";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * const failure = pipe(Line.split('42'), A.head, O.map(Envelope.decodeResult(events)));
   * O.isSome(failure) && Result.isFailure(failure.value) && pipe(failure.value.failure.message, Str.startsWith("invalid JSONL envelope at byte offset 0:")) // => true
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message =
    `invalid JSONL ${O.match(this.event, { onNone: () => "envelope", onSome: (event) => `payload for event ${quote(event)}` })} at byte offset ${this.line.offset}: ${this.error.message}`;
}

/**
 * An append attempted after a terminal event, by an event not marked `reopen`.
 *
 * **Details**
 *
 * A journal whose tail is terminal is quiescent: it is finished, and appending
 * to it would silently resurrect a closed loop. Reopening is legal but must be
 * declared, which is what `reopen` marks.
 *
 * **Example** (Construct a TerminalViolation failure)
 * ```ts import.meta.vitest name="Construct a TerminalViolation failure"
 * import { TerminalViolation } from "@beep/scratchpad/effected/jsonl/index";
 * const error = TerminalViolation.make({ event: "updated", terminal: "closed" });
 * error.terminal // => "closed"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TerminalViolation extends S.TaggedError<TerminalViolation>($I`TerminalViolation`)(
  "TerminalViolation",
  {
    /** The tag of the event whose append was refused. */
    event: S.String.pipe(
      $I.annoteKey("TerminalViolation.event", {
        description: "The tag of the event whose append was refused.",
      })
    ),
    /** The terminal event currently at the tail of the journal. */
    terminal: S.String.pipe(
      $I.annoteKey("TerminalViolation.terminal", {
        description: "The terminal event currently at the tail of the journal.",
      })
    ),
  },
  $I.annote("TerminalViolation", {
    description: "An append operation was refused because the journal is terminal at the given event.",
  })
) {
  /**
   * Human-readable context for this failure; structured fields retain its details.
   *
   * **Example** (Read the terminal-journal message)
   * ```ts import.meta.vitest name="Read the terminal-journal message"
   * import { TerminalViolation } from "@beep/scratchpad/effected/jsonl/index";
   * const error = TerminalViolation.make({ event: "updated", terminal: "closed" });
   * error.message // => 'cannot append "updated": the journal is terminal at "closed"'
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message = `cannot append ${quote(this.event)}: the journal is terminal at ${quote(this.terminal)}`;
}

/**
 * An operation against a journal file that does not exist.
 *
 * **Details**
 *
 * A missing journal is a **legal state** — building the layer over a path that
 * does not exist yet succeeds, and the watcher activates once the file appears.
 * What is not legal is materializing it implicitly: `append`, `query` and
 * `latest` fail with this rather than creating the file, so a typo in a path
 * cannot quietly produce a second, empty journal that looks like a working
 * system with no history. Creation is always explicit, via `create`.
 *
 * **Example** (Construct a JournalNotFound failure)
 * ```ts import.meta.vitest name="Construct a JournalNotFound failure"
 * import { JournalNotFound } from "@beep/scratchpad/effected/jsonl/index";
 * JournalNotFound.make({ path: "events.jsonl" }).path // => "events.jsonl"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JournalNotFound extends S.TaggedError<JournalNotFound>($I`JournalNotFound`)(
  "JournalNotFound",
  {
    /** The path that does not exist. */
    path: S.String.pipe(
      $I.annoteKey("JournalNotFound.path", {
        description: "The path that does not exist.",
      })
    ),
  },
  $I.annote("JournalNotFound", {
    description: "A journal path was queried but does not exist yet.",
  })
) {
  /**
   * Human-readable context for this failure; structured fields retain its details.
   *
   * **Example** (Read the missing-journal message)
   * ```ts import.meta.vitest name="Read the missing-journal message"
   * import { JournalNotFound } from "@beep/scratchpad/effected/jsonl/index";
   * JournalNotFound.make({ path: "events.jsonl" }).message // => "journal not found: events.jsonl"
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message = `journal not found: ${this.path}`;
}

/**
 * A payload that validated against its schema but cannot be serialized to JSON.
 *
 * **Details**
 *
 * A payload codec can accept values that JSON cannot represent, such as a
 * bigint or a reference cycle. Encoding through the JSON schema catches that
 * separate failure and carries its SchemaError under cause.
 *
 * Fix InvalidData by satisfying the registered codec; fix UnserializableData
 * by choosing a representation that the JSON format can carry.
 *
 * **Example** (Report a nonserializable payload)
 * ```ts import.meta.vitest name="Report a nonserializable payload"
 * import { Envelope, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
 * import * as DateTime from "effect/DateTime";
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema";
 * const events = [JsonlEvent.make("snapshot", { data: S.Unknown })];
 * const result = Envelope.encodeResult({ at: DateTime.makeUnsafe(0), event: "snapshot", data: 1n }, events);
 * Result.isFailure(result) && result.failure._tag // => "UnserializableData"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class UnserializableData extends S.TaggedError<UnserializableData>($I`UnserializableData`)(
  "UnserializableData",
  {
    /** The event tag whose payload could not be serialized. */
    event: S.String.pipe(
      $I.annoteKey("UnserializableData.event", {
        description: "The event tag whose payload could not be serialized.",
      })
    ),
    /** The JSON codec failure, carried structurally. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("UnserializableData.cause", {
        description: "The JSON codec failure, carried structurally.",
      })
    ),
  },
  $I.annote("UnserializableData", {
    description: "A payload that validated against its schema but cannot be serialized to JSON.",
    documentation:
      "The registered payload codec succeeded, but the JSON codec rejected its encoded representation. The structured codec failure is retained in cause.",
  })
) {
  /**
   * Human-readable context for this failure; structured fields retain its details.
   *
   * **Example** (Read the serialization message)
   * ```ts
   * import { Envelope, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as DateTime from "effect/DateTime";
   * import * as Result from "effect/Result";
   * import * as S from "effect/Schema";
   * import * as Str from "effect/String";
   * import { pipe } from "effect/Function";
   * const events = [JsonlEvent.make("snapshot", { data: S.Unknown })];
   * const result = Envelope.encodeResult({ at: DateTime.makeUnsafe(0), event: "snapshot", data: 1n }, events);
   * Result.isFailure(result) && pipe(result.failure.message, Str.startsWith('cannot serialize payload for event "snapshot":')) // => true
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  // A non-Error cause may itself be cyclic; do not render it.
  override readonly message =
    `cannot serialize payload for event ${quote(this.event)}: ${P.isError(this.cause) ? this.cause.message : "value is not JSON-serializable"}`;
}

/**
 * An append refused because the journal's scope has closed.
 *
 * **Details**
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
 * **Example** (Construct a JournalClosed failure)
 * ```ts import.meta.vitest name="Construct a JournalClosed failure"
 * import { JournalClosed } from "@beep/scratchpad/effected/jsonl/index";
 * JournalClosed.make({ event: "updated" }).event // => "updated"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JournalClosed extends S.TaggedError<JournalClosed>($I`JournalClosed`)(
  "JournalClosed",
  {
    /** The tag of the event whose append was refused. */
    event: S.String.pipe(
      $I.annoteKey("JournalClosed.event", {
        description: "The tag of the event whose append was refused.",
      })
    ),
  },
  $I.annote("JournalClosed", {
    description: "An append refused because the journal's scope has closed.",
    documentation:
      'Its own tag rather than a flavour of {@link TerminalViolation}, because the\nrecoveries have nothing in common: a terminal journal is a *state* the\nconsumer can reason about and reopen from with a `reopen` event, while a\nclosed one is a *lifecycle* fact — this service is gone, and the only moves\nare to build a new layer or stop.\nRefusal is deliberately a typed failure rather than a wait. A `Latch` would\nsuspend the late append with no failure channel, turning "the journal is\nclosing" into a hang; failing fast is what lets a caller react.',
  })
) {
  /**
   * Human-readable context for this failure; structured fields retain its details.
   *
   * **Example** (Read the closed-journal message)
   * ```ts import.meta.vitest name="Read the closed-journal message"
   * import { JournalClosed } from "@beep/scratchpad/effected/jsonl/index";
   * JournalClosed.make({ event: "updated" }).message // => 'cannot append "updated": the journal is closed'
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message = `cannot append ${quote(this.event)}: the journal is closed`;
}

/**
 * The append-only contract breach that requires reader reconciliation.
 *
 * **Example** (Select a resync reason)
 * ```ts import.meta.vitest name="Select a resync reason"
 * import { JournalResyncReason } from "@beep/scratchpad/effected/jsonl/JsonlError";
 * JournalResyncReason.Enum.truncated // => "truncated"
 * JournalResyncReason.is.replaced("replaced") // => true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const JournalResyncReason = LiteralKit(["truncated", "replaced"]).pipe(
  $I.annoteSchema("JournalResyncReason", {
    description: "The append-only contract breach requiring reader reconciliation.",
  })
);

/**
 * The schema-derived reason for a journal resync.
 * @category type-level
 * @since 0.0.0
 */
export type JournalResyncReason = typeof JournalResyncReason.Type;

/**
 * The journal file was truncated or replaced beneath a reader.
 *
 * **Details**
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
 * Detection is as complete as the platform allows and no more. Truncation is
 * caught by size; replacement is caught by inode identity, which
 * `FileSystem.File.Info` exposes as an **`Option`** — on a platform that does
 * not report it, a replacement at equal or greater size is undetectable and
 * only truncation is caught.
 *
 * **Example** (Construct a JournalResync failure)
 * ```ts import.meta.vitest name="Construct a JournalResync failure"
 * import { JournalResync, JournalResyncReason } from "@beep/scratchpad/effected/jsonl/index";
 * const error = JournalResync.make({ path: "events.jsonl", reason: JournalResyncReason.Enum.truncated, expected: 100, actual: 0 });
 * error.reason // => "truncated"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JournalResync extends S.TaggedError<JournalResync>($I`JournalResync`)(
  "JournalResync",
  {
    /** The journal path whose file changed identity or shrank. */
    path: S.String.pipe(
      $I.annoteKey("JournalResync.path", {
        description: "The journal path whose file changed identity or shrank.",
      })
    ),
    /** Which contract breach was detected. Diagnostic; the recovery is the same. */
    reason: JournalResyncReason.pipe(
      $I.annoteKey("JournalResync.reason", {
        description: "Which contract breach was detected. Diagnostic; the recovery is the same.",
      })
    ),
    /** The logical offset the reader had consumed to. */
    expected: ByteCount.pipe(
      $I.annoteKey("JournalResync.expected", {
        description: "The logical offset the reader had consumed to.",
      })
    ),
    /** The file's logical size when the breach was noticed. */
    actual: ByteCount.pipe(
      $I.annoteKey("JournalResync.actual", {
        description: "The file's logical size when the breach was noticed.",
      })
    ),
  },
  $I.annote("JournalResync", {
    description: "The journal file was truncated or replaced beneath a reader.",
    documentation:
      "The cooperative-writer contract is append-only: a journal only ever grows,\nand every cursor this package hands out depends on that. When the file shrinks\nbelow a tracked offset, or the path comes to name a different file entirely,\nthe contract has been broken by something outside the package and every\noffset-derived belief is now meaningless.\nSurfaced rather than repaired, deliberately. Silently re-reading from zero\nwould paper over a real operational fault — a rotating log shipper, a\n`>` where `>>` was meant — and leave projections quietly inconsistent with\nthe file. The recovery is the consumer's: discard cursor-derived state,\nre-read, and tell somebody.\nOne tag rather than two, though `reason` distinguishes the causes: truncation\nand replacement have the **same** recovery, and a tag per cause would split\none recovery across two tags.\nDetection is as complete as the platform allows and no more. Truncation is\ncaught by size; replacement is caught by inode identity, which\n`FileSystem.File.Info` exposes as an **`Option`** — on a platform that does\nnot report it, a replacement at equal or greater size is undetectable and\nonly truncation is caught.",
  })
) {
  /**
   * Human-readable context for this failure; structured fields retain its details.
   *
   * **Example** (Read the resync message)
   * ```ts import.meta.vitest name="Read the resync message"
   * import { JournalResync, JournalResyncReason } from "@beep/scratchpad/effected/jsonl/index";
   * const error = JournalResync.make({ path: "events.jsonl", reason: JournalResyncReason.Enum.truncated, expected: 100, actual: 0 });
   * error.message // => "journal truncated beneath the reader at events.jsonl: consumed 100, file is now 0"
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message =
    `journal ${this.reason} beneath the reader at ${this.path}: consumed ${this.expected}, file is now ${this.actual}`;
}

/**
 * Public journal configuration failed its schema before resources were acquired.
 *
 * **Example** (Inspect invalid configuration)
 * ```ts import.meta.vitest name="Inspect invalid configuration"
 * import { InvalidJournalConfig } from "@beep/scratchpad/effected/jsonl/JsonlError";
 * import * as O from "effect/Option";
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema";
 * const issue = S.decodeUnknownResult(S.Int)(1.5).pipe(Result.getFailure, O.getOrThrow);
 * InvalidJournalConfig.make({ error: issue })._tag // => "InvalidJournalConfig"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class InvalidJournalConfig extends S.TaggedError<InvalidJournalConfig>($I`InvalidJournalConfig`)(
  "InvalidJournalConfig",
  {
    /** The schema issue tree explaining which public input fields failed validation. */
    error: SchemaErrorFromSelf.pipe(
      $I.annoteKey("InvalidJournalConfig.error", {
        description: "The schema issue tree explaining which public input fields failed validation.",
      })
    ),
  },
  $I.annote("InvalidJournalConfig", { description: "Public journal configuration failed schema validation." })
) {
  /**
   * Stable context; the schema issue tree remains available in `error`.
   *
   * **Example** (Read configuration failure context)
   * ```ts import.meta.vitest name="Read configuration failure context"
   * import { InvalidJournalConfig } from "@beep/scratchpad/effected/jsonl/JsonlError";
   * import * as O from "effect/Option";
   * import * as Result from "effect/Result";
   * import * as S from "effect/Schema";
   * const issue = S.decodeUnknownResult(S.Int)(1.5).pipe(Result.getFailure, O.getOrThrow);
   * InvalidJournalConfig.make({ error: issue }).message // => "invalid journal configuration"
   * ```
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message = "invalid journal configuration";
}

/**
 * Public selection options failed their schema before reading the journal.
 *
 * **Example** (Inspect an invalid selection)
 * ```ts import.meta.vitest name="Inspect an invalid selection"
 * import { InvalidSlice } from "@beep/scratchpad/effected/jsonl/JsonlError";
 * import * as O from "effect/Option";
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema";
 * const issue = S.decodeUnknownResult(S.Int)(1.5).pipe(Result.getFailure, O.getOrThrow);
 * InvalidSlice.make({ error: issue })._tag // => "InvalidSlice"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class InvalidSlice extends S.TaggedError<InvalidSlice>($I`InvalidSlice`)(
  "InvalidSlice",
  {
    /** The schema issue tree explaining which public input fields failed validation. */
    error: SchemaErrorFromSelf.pipe(
      $I.annoteKey("InvalidSlice.error", {
        description: "The schema issue tree explaining which public input fields failed validation.",
      })
    ),
  },
  $I.annote("InvalidSlice", { description: "Public journal selection options failed schema validation." })
) {
  /**
   * Stable context; the schema issue tree remains available in `error`.
   *
   * **Example** (Read selection failure context)
   * ```ts import.meta.vitest name="Read selection failure context"
   * import { InvalidSlice } from "@beep/scratchpad/effected/jsonl/JsonlError";
   * import * as O from "effect/Option";
   * import * as Result from "effect/Result";
   * import * as S from "effect/Schema";
   * const issue = S.decodeUnknownResult(S.Int)(1.5).pipe(Result.getFailure, O.getOrThrow);
   * InvalidSlice.make({ error: issue }).message // => "invalid journal selection"
   * ```
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message = "invalid journal selection";
}

/**
 * The file size changed unexpectedly during an append, so its placement is unknown.
 *
 * **Details**
 *
 * Bytes may already be persisted. Reconcile the journal before choosing whether to
 * retry; an automatic retry can duplicate the record. No inferred successful cursor
 * is published for the conflicting write. Sizes are physical UTF-8 byte counts.
 *
 * **Example** (Describe ambiguous write placement)
 * ```ts import.meta.vitest name="Describe ambiguous write placement"
 * import { JournalWriteConflict } from "@beep/scratchpad/effected/jsonl/JsonlError";
 * const error = JournalWriteConflict.make({ path: "events.jsonl", expected: 100, actual: 150 });
 * error._tag // => "JournalWriteConflict"
 * error.expected // => 100
 * ```
 * @category errors
 * @since 0.0.0
 */
export class JournalWriteConflict extends S.TaggedError<JournalWriteConflict>($I`JournalWriteConflict`)(
  "JournalWriteConflict",
  {
    /** The journal path whose append placement could not be established. */
    path: S.String.pipe(
      $I.annoteKey("JournalWriteConflict.path", {
        description: "The journal path whose append placement could not be established.",
      })
    ),
    /** Expected physical UTF-8 file size after the append, including any BOM. */
    expected: ByteCount.pipe(
      $I.annoteKey("JournalWriteConflict.expected", {
        description: "Expected physical UTF-8 file size after the append, including any BOM.",
      })
    ),
    /** Observed physical UTF-8 file size after the append, including any BOM. */
    actual: ByteCount.pipe(
      $I.annoteKey("JournalWriteConflict.actual", {
        description: "Observed physical UTF-8 file size after the append, including any BOM.",
      })
    ),
  },
  $I.annote("JournalWriteConflict", {
    description: "An append's placement cannot be established after unexpected file growth.",
    documentation:
      "Bytes may already be persisted. Reconcile the journal before deciding whether to retry; an automatic retry can duplicate the record. Sizes are physical UTF-8 byte counts.",
  })
) {
  /**
   * Describe the ambiguous write without suggesting an automatic retry.
   *
   * **Example** (Read write conflict context)
   * ```ts import.meta.vitest name="Read write conflict context"
   * import { JournalWriteConflict } from "@beep/scratchpad/effected/jsonl/JsonlError";
   * const error = JournalWriteConflict.make({ path: "events.jsonl", expected: 100, actual: 150 });
   * error.message // => "journal write placement conflict at events.jsonl: expected 100 bytes, found 150; reconcile before retrying"
   * ```
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message =
    `journal write placement conflict at ${this.path}: expected ${this.expected} bytes, found ${this.actual}; reconcile before retrying`;
}

/**
 * Bytes in a decoded file range are not valid UTF-8.
 *
 * **Details**
 *
 * The offset is the physical start of the range supplied to the decoder,
 * including any file BOM. It is not the exact position of an offending byte.
 * Cursor accounting never substitutes replacement characters for malformed bytes.
 *
 * **Example** (Describe invalid byte encoding)
 * ```ts import.meta.vitest name="Describe invalid byte encoding"
 * import { InvalidUtf8 } from "@beep/scratchpad/effected/jsonl/JsonlError";
 * const error = InvalidUtf8.make({ path: "events.jsonl", offset: 3, cause: new TypeError("invalid UTF-8") });
 * error.offset // => 3
 * error._tag // => "InvalidUtf8"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class InvalidUtf8 extends S.TaggedError<InvalidUtf8>($I`InvalidUtf8`)(
  "InvalidUtf8",
  {
    /** The journal path whose bytes could not be decoded. */
    path: S.String.pipe(
      $I.annoteKey("InvalidUtf8.path", { description: "The journal path whose bytes could not be decoded." })
    ),
    /** Physical byte offset of the supplied decoded range, including any BOM. */
    offset: ByteCount.pipe(
      $I.annoteKey("InvalidUtf8.offset", {
        description:
          "Physical byte offset of the supplied decoded range, including any BOM; not the exact offending byte.",
      })
    ),
    /** The decoder failure, retained without rendering raw journal bytes. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("InvalidUtf8.cause", {
        description: "The decoder failure, retained without rendering raw journal bytes.",
      })
    ),
  },
  $I.annote("InvalidUtf8", {
    description: "A decoded journal byte range is not valid UTF-8.",
    documentation:
      "The offset identifies the physical start of the supplied decoded range, not the exact offending byte.",
  })
) {
  /**
   * Identify the range without exposing or normalizing its bytes.
   *
   * **Example** (Read invalid encoding context)
   * ```ts import.meta.vitest name="Read invalid encoding context"
   * import { InvalidUtf8 } from "@beep/scratchpad/effected/jsonl/JsonlError";
   * InvalidUtf8.make({ path: "events.jsonl", offset: 3, cause: new TypeError("invalid UTF-8") }).message // => "invalid UTF-8 in journal events.jsonl at decoded range starting at physical byte 3"
   * ```
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message =
    `invalid UTF-8 in journal ${this.path} at decoded range starting at physical byte ${this.offset}`;
}

/**
 * A physical suffix has no final newline, so a local append must wait for repair.
 *
 * **Details**
 *
 * The span uses logical post-BOM byte offsets and never decodes the suffix.
 * Its original writer must finish it, or an explicit recovery operation must
 * repair it, before another local append can form an independent record.
 *
 * **Example** (Describe an unfinished suffix)
 * ```ts import.meta.vitest name="Describe an unfinished suffix"
 * import { JournalUnterminated } from "@beep/scratchpad/effected/jsonl/JsonlError";
 * const error = JournalUnterminated.make({ path: "events.jsonl", offset: 80, end: 83 });
 * error.offset // => 80
 * error.end // => 83
 * ```
 * @category errors
 * @since 0.0.0
 */
export class JournalUnterminated extends S.TaggedError<JournalUnterminated>($I`JournalUnterminated`)(
  "JournalUnterminated",
  {
    /** The journal path containing an unfinished physical suffix. */
    path: S.String.pipe(
      $I.annoteKey("JournalUnterminated.path", {
        description: "The journal path containing an unfinished physical suffix.",
      })
    ),
    /** Logical post-BOM byte offset where the unfinished suffix begins. */
    offset: ByteCount.pipe(
      $I.annoteKey("JournalUnterminated.offset", {
        description: "Logical post-BOM byte offset where the unfinished suffix begins.",
      })
    ),
    /** Logical post-BOM byte offset just past the unfinished suffix. */
    end: ByteCount.pipe(
      $I.annoteKey("JournalUnterminated.end", {
        description: "Logical post-BOM byte offset just past the unfinished suffix.",
      })
    ),
  },
  $I.annote("JournalUnterminated", {
    description: "An unterminated physical journal suffix blocks local append.",
    documentation:
      "The span uses logical post-BOM byte offsets without decoding the suffix. Its original writer must finish it or an explicit recovery operation must repair it before local append.",
  })
) {
  /**
   * Identify the unfinished span and the required recovery.
   *
   * **Example** (Read unfinished-tail context)
   * ```ts import.meta.vitest name="Read unfinished-tail context"
   * import { JournalUnterminated } from "@beep/scratchpad/effected/jsonl/JsonlError";
   * JournalUnterminated.make({ path: "events.jsonl", offset: 80, end: 83 }).message // => "unterminated journal suffix at events.jsonl: logical bytes 80 to 83; complete or repair before appending"
   * ```
   * @category error-handling
   * @since 0.0.0
   */
  override readonly message =
    `unterminated journal suffix at ${this.path}: logical bytes ${this.offset} to ${this.end}; complete or repair before appending`;
}

/**
 * Every error this package raises from the pure core and the journal service.
 *
 * **Details**
 *
 * Core's `PlatformError` is deliberately **not** a member: IO failures pass
 * through untranslated rather than being wrapped in a taxonomy that would add
 * no recovery information.
 *
 * **Example** (Recognize a journal domain failure)
 * ```ts import.meta.vitest name="Recognize a journal domain failure"
 * import { JsonlError, JournalClosed } from "@beep/scratchpad/effected/jsonl/index";
 * const error = JournalClosed.make({ event: "updated" });
 * JsonlError.guards.JournalClosed(error) // => true
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export const JsonlError = S.Union([
  MalformedLine,
  UnknownEvent,
  InvalidData,
  UnserializableData,
  TerminalViolation,
  JournalClosed,
  JournalNotFound,
  JournalResync,
  InvalidJournalConfig,
  InvalidSlice,
  JournalWriteConflict,
  InvalidUtf8,
  JournalUnterminated,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("JsonlError", { description: "Recoverable JSONL format, payload and journal lifecycle failures." })
);

/**
 * The schema-derived union of JSONL failures. Platform errors pass through separately.
 * @category type-level
 * @since 0.0.0
 */
export type JsonlError = typeof JsonlError.Type;
