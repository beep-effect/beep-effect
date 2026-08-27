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
 * @example
 * ```ts
 * import { Line } from "@effected/jsonl";
 * import { Option } from "effect";
 *
 * declare const sourceText: string;
 *
 * // The whole read path for a snapshot journal, with no runtime.
 * const state = Line.lastValid(sourceText);
 * if (Option.isSome(state)) {
 *   state.value.value; // the decoded JSON of the last valid line
 *   state.value.line.offset; // its byte offset, for a resumable cursor
 * }
 * ```
 *
 * @see {@link https://effect.website | Effect}
 *
 * @packageDocumentation
 */

// `Envelope` and `JsonlEvent` each carry BOTH a value and a type declaration,
// so one export name covers the factory and the type it produces.
export type { EnvelopeOf, EnvelopeUnion, EnvelopeWithTag } from "./Envelope.ts";
export { Envelope, EnvelopeFrame } from "./Envelope.ts";
export type {
	AppendOptions,
	JournalClass,
	JournalConfig,
	JournalReadError,
	JournalShape,
	JournalWriteError,
} from "./Journal.ts";
export { Journal } from "./Journal.ts";
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
