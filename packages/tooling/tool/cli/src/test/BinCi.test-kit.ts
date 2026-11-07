/**
 * Source-only test kit that evaluates the slim CI entry point.
 *
 * **Details**
 *
 * `src/bin-ci.ts` exports nothing and runs `BunRuntime.runMain` at its top
 * level; a suite that replaces the runner imports this kit to evaluate it.
 *
 * @internal
 * @since 0.0.0
 */

export * from "../bin-ci.ts";
