/**
 * The check gate every generated package `check` script runs, kept in a
 * module of its own so the gate entry loads it without the package-script
 * schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * The command every generated package `check` script runs: the check gate.
 * It probes for unbuilt referenced declarations first (one folded line and
 * exit 1, before any compiler), otherwise runs the package's `beep:check`,
 * writes the `check` record under `.beep/gates/check/` and prints the
 * console from it.
 *
 * **Example** (Read the check gate command)
 *
 * ```ts
 * import { PACKAGE_CHECK_GATE_COMMAND } from "@beep/repo-cli-kit/package-scripts/CheckGate"
 *
 * console.log(PACKAGE_CHECK_GATE_COMMAND) // "beep-cli gate run check"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACKAGE_CHECK_GATE_COMMAND = "beep-cli gate run check";

/**
 * The package script the check gate runs once every referenced project is
 * built: the package's own type check.
 *
 * **Example** (Read the script the gate runs)
 *
 * ```ts
 * import { PACKAGE_CHECK_GATE_SCRIPT } from "@beep/repo-cli-kit/package-scripts/CheckGate"
 *
 * console.log(PACKAGE_CHECK_GATE_SCRIPT) // "beep:check"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACKAGE_CHECK_GATE_SCRIPT = "beep:check";
