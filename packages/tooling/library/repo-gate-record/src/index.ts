/**
 * The gate record writer: the `gate-report/v1` record file codec, the
 * package and root record paths, time-sortable run ids, newest-twenty
 * retention, and the store that writes and reads records and raw logs.
 *
 * **Details**
 *
 * The package depends on the report model and Effect only; the caller
 * supplies `FileSystem` and `Path`. It loads under Node and Bun alike and
 * reaches no `bun:` module, so a Vitest reporter can write through it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "./GatePaths.ts";
export * from "./GateRecordFile.ts";
export * from "./GateRecordStore.ts";
export * from "./PackageLocation.ts";
export * from "./RunId.ts";
