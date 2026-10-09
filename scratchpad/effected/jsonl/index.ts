/**
 * Append-only, schema-validated JSONL journals as a definable Effect service.
 *
 * **Details**
 *
 * The subject is not the format — one JSON value per line needs no library.
 * The subject is the file as a live object: a journal that only ever grows,
 * whose current state is its last valid line, whose tail may be torn mid-append,
 * and which several processes read while one writes.
 *
 * The pure core is synchronous and `Result`-based so a hook script can read the
 * current state of a journal with no Effect runtime at all.
 *
 * **Example** (Read the last valid snapshot)
 * ```ts import.meta.vitest name="Read the last valid snapshot"
 * import { Line } from "@beep/scratchpad/effected/jsonl/index";
 * import * as O from "effect/Option";
 * const state = Line.lastValid('{"count":1}\n{');
 * state.pipe(O.map((parsed) => parsed.value)) // => O.some({ count: 1 })
 * ```
 *
 * @see {@link https://effect.website | Effect} for the runtime and schema library.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// `Envelope` and `JsonlEvent` each carry BOTH a value and a type declaration,
// so one export name covers the factory and the type it produces.
export type { EnvelopeInput, EnvelopeOf, EnvelopeUnion, EnvelopeWithTag } from "./Envelope.ts";
export { Envelope, EnvelopeFrame } from "./Envelope.ts";
export type {
  JournalClass,
  JournalReadError,
  JournalShape,
  JournalWriteError,
} from "./Journal.ts";
export { AppendOptions, Journal, JournalConfig } from "./Journal.ts";
export {
  InvalidData,
  InvalidJournalConfig,
  InvalidSlice,
  InvalidUtf8,
  JournalClosed,
  JournalNotFound,
  JournalResync,
  JournalResyncReason,
  JournalUnterminated,
  JournalWriteConflict,
  JsonlError,
  MalformedLine,
  TerminalViolation,
  UnknownEvent,
  UnserializableData,
} from "./JsonlError.ts";
export type { DataSchema } from "./JsonlEvent.ts";
export { JsonlEvent, JsonlEventTypeId } from "./JsonlEvent.ts";
export { Line, ParsedLine } from "./Line.ts";
export { ByteCount, LineSlice } from "./LineSlice.ts";
export { CursoredSlice, Slice } from "./Slice.ts";
