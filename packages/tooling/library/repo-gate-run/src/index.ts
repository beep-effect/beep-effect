/**
 * The gate run services: the recorder, the console with its agent and
 * terminal projections, audience selection, the history slot contract, the
 * type checker's adapter, the gate run entry and the query services behind
 * the planned `gate` command family.
 *
 * **Details**
 *
 * Every module is also a leaf subpath (`@beep/repo-gate-run/GateRun`,
 * `@beep/repo-gate-run/GateConsole`, ...). A caller that cares about cold
 * start imports the leaf it needs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "./ConsoleDefaults.ts";
export * from "./Excerpt.ts";
export * from "./GateAudience.ts";
export * from "./GateConsole.ts";
export * from "./GateHistory.ts";
export * from "./GateQueries.ts";
export * from "./GateRecorder.ts";
export * from "./GateRun.ts";
export * from "./Omission.ts";
export * from "./RepoPointers.ts";
export * from "./TsDiagnostic.ts";
export * from "./TypeCheckAdapter.ts";
