/**
 * The gate-neutral verification report model: gate, unit and item schemas,
 * the event union and its reducer, the shape and outcome classifiers, the
 * failure signature, the cause-folding table, and the dispatch table that
 * turns a report into a neutral console document with a plain-text
 * projection.
 *
 * **Details**
 *
 * Every module is also a leaf subpath (`@beep/gate-report/GateReport`,
 * `@beep/gate-report/Dispatch`, ...). The model names no command, path or
 * budget: callers supply them as data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "./CauseFold.ts";
export * from "./Classify.ts";
export * from "./ConsoleDocument.ts";
export * from "./Dispatch.ts";
export * from "./FailureSignature.ts";
export * from "./Format.ts";
export * from "./GateEvent.ts";
export * from "./GateRecord.ts";
export * from "./GateReport.ts";
export * from "./Interchange.ts";
export * from "./Item.ts";
export * from "./ItemKey.ts";
export * from "./PlainText.ts";
export * from "./Policy.ts";
export * from "./Reducer.ts";
export * from "./Scalars.ts";
export * from "./StrayOutput.ts";
export * from "./Vocabulary.ts";
export * from "./Widening.ts";
