/**
 * Append-only, schema-validated JSONL journals as a definable Effect service.
 *
 * The subject is not the format — one JSON value per line needs no library.
 * The subject is the file as a live object: a journal that only ever grows,
 * whose current state is its last valid line, whose tail may be torn mid-append,
 * and which several processes read while one writes.
 *
 * The pure core is synchronous and `Result`-based so a hook script can read the
 * current state of a journal with no Effect runtime at all.
 *
 * **Example** (Read last valid line without a runtime)
 *
 * ```ts
 * import { Line } from "@beep/scratchpad/jsonl"
 * import * as O from "effect/Option"
 *
 * const sourceText = '{"round":1}\n{"round":2}\n{"round":'
 * const state = Line.lastValid(sourceText)
 * console.log(O.isSome(state)) // true
 * if (O.isSome(state)) {
 *   console.log(state.value.value) // { round: 2 }
 *   console.log(state.value.line.offset) // 12
 * }
 * ```
 *
 * @see {@link Line} for the synchronous, runtime-free snapshot read path.
 * @see {@link Journal} for the Effect service that appends and tails a file.
 * @packageDocumentation
 * @since 0.0.0
 */

// `Envelope` and `JsonlEvent` each carry BOTH a value and a type declaration,
// so one export name covers the factory and the type it produces.
export type { EnvelopeOf, EnvelopeUnion, EnvelopeWithTag } from "./Envelope.ts";
export { Envelope, EnvelopeFrame } from "./Envelope.ts";
export type {
  JournalClass,
  JournalReadError,
  JournalShape,
  JournalWriteError,
} from "./Journal.ts";
export { AppendOptions, Journal, JournalConfig } from "./Journal.ts";
export type { JsonlError } from "./JsonlError.ts";
export {
  InvalidData,
  JournalClosed,
  JournalNotFound,
  JournalResync,
  MalformedLine,
  TerminalViolation,
  UnknownEvent,
  UnserializableData,
} from "./JsonlError.ts";
export type { DataSchema } from "./JsonlEvent.ts";
export { JsonlEvent, JsonlEventTypeId } from "./JsonlEvent.ts";
export { Line, ParsedLine } from "./Line.ts";
export { LineSlice } from "./LineSlice.ts";
export type { CursoredSlice, Slice } from "./Slice.ts";
