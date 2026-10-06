/**
 * Process-entrypoint boundary of the mail-tagging executable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Logger } from "effect";

/**
 * Runs a finished program as the process main: the platform runner.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunMain = <A, E>(effect: Effect.Effect<A, E>) => void;

/**
 * Builds the entrypoint over a main runner.
 *
 * **Details**
 *
 * The program gets the Bun platform services, and the built-in logger is sent
 * to standard error so standard output carries reports only. Nothing runs
 * unless the module is the process entrypoint. The runner owns the exit code:
 * a `PracticeMailTaggingError` ends the process with its own code.
 *
 * **Example** (Skip a program that is not the entrypoint)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { makeRunEntrypoint } from "@/entrypoint"
 *
 * const started: Array<string> = []
 * makeRunEntrypoint(() => {
 *   started.push("main")
 * })({ isMain: false, program: Effect.void })
 * console.log(started.length) // 0
 * ```
 *
 * @param run - Runs the provided program as the process main.
 * @returns The entrypoint function.
 * @category constructors
 * @since 0.0.0
 */
export const makeRunEntrypoint =
  (run: RunMain) =>
  <A, E>(input: { readonly isMain: boolean; readonly program: Effect.Effect<A, E, BunServices.BunServices> }): void => {
    if (input.isMain) {
      run(
        Layer.effectDiscard(input.program).pipe(
          Layer.provide(BunServices.layer),
          Layer.provide(Layer.succeed(Logger.LogToStderr, true)),
          Layer.build,
          Effect.scoped
        )
      );
    }
  };

/**
 * Runs the mail-tagging executable through the Bun runtime when its module is
 * the process entrypoint.
 *
 * **Example** (Leave an imported module idle)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runEntrypoint } from "@/entrypoint"
 *
 * runEntrypoint({ isMain: false, program: Effect.void })
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runEntrypoint = makeRunEntrypoint(BunRuntime.runMain);
