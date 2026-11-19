/**
 * `@beep/csv`: CSV as an Effect Schema codec. Any dialect is read, leniently by default or strictly on request, into
 * one table model (`CsvTable`) and written back canonically; the same through streaming channels.
 *
 * **Details**
 *
 * A lenient read goes past misplaced quotes and ragged records and reports each as a warning with its position; a
 * strict read stops at the first one, as RFC 4180 and Effect's `effect/encoding/Csv` do. Bytes are decoded by their
 * byte-order mark, else as UTF-8 when valid, else as Windows-1252.
 *
 * **Example** (Read and write back)
 *
 * ```ts import.meta.vitest name="Read and write back"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import * as Result from "effect/Result"
 *
 * const read = Result.getOrThrow(Csv.parseResult("SKU,Qty\nBRK-040,12\n"))
 * Csv.stringify(read.table) // => "SKU,Qty\r\nBRK-040,12\r\n"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
export * from "./Csv.codec.ts";
export * from "./CsvDiagnostic.schema.ts";
export * from "./CsvError.errors.ts";
export * from "./CsvOptions.schema.ts";
export * from "./CsvPosition.schema.ts";
export * from "./CsvRead.schema.ts";
export * from "./CsvTable.schema.ts";
