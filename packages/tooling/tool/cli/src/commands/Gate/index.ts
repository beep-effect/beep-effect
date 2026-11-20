/**
 * `beep gate` facade: the gate command group and the package gate programs
 * the repo CLI task path shares with it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * The gate command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Gate.command.ts";
/**
 * The package `check` gate.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./GateCheck.ts";
/**
 * The gate history queries: a subject's runs and one item's series.
 *
 * @since 0.0.0
 */
export * from "./GateHistoryQuery.ts";
/**
 * Gate run history on the task path.
 *
 * @since 0.0.0
 */
export * from "./GateHistoryRuntime.ts";
/**
 * The gate query commands: a run's record and one item in full.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./GateQuery.ts";
/**
 * The root gate: package records folded into one workspace console.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./GateRoot.ts";
/**
 * What every gate shares: audience flags, console settings, capture and rendering.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./GateRuntime.ts";
/**
 * The package `test` gate.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./GateTest.ts";
