/**
 * Shared process-entrypoint boundary for the practice KG executables.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Runtime from "effect/Runtime";

const reportFailure = (cause: Cause.Cause<unknown>): Effect.Effect<void> =>
  Cause.hasInterruptsOnly(cause) || !cause.pipe(Cause.squash, Runtime.getErrorReported)
    ? Effect.void
    : Effect.logError(cause);

const scopedMain = <A, E>(
  program: Effect.Effect<A, E, BunServices.BunServices>,
  services: Layer.Layer<BunServices.BunServices>
) => program.pipe(Layer.effectDiscard, Layer.provide(services), Layer.build, Effect.scoped);

/**
 * Run a practice KG executable through the shared Bun service boundary when its module is the process entrypoint.
 *
 * **Details**
 *
 * With `logger`, the program runs under that logger layer and an unreported
 * failure is logged through it instead of through the runtime's default
 * report, which writes to stdout.
 *
 * **Example** (Run a program when the module is the entrypoint)
 *
 * ```ts
 * import { runEntrypoint } from "../../src/entrypoint.ts"
 * import * as Effect from "effect/Effect";
 * runEntrypoint({ isMain: false, program: Effect.void })
 * ```
 *
 * **Gotchas**
 *
 * The runtime’s default failure reporter runs outside program-provided logger layers; scopedMain reports inside the program logger before handing control back.
 *
 * @param input - Entrypoint status, Effect program and optional logger layer.
 * @category utilities
 * @since 0.0.0
 */
export const runEntrypoint = <A, E>(input: {
  readonly isMain: boolean;
  readonly program: Effect.Effect<A, E, BunServices.BunServices>;
  readonly logger?: Layer.Layer<never> | undefined;
}): void => {
  if (input.isMain) {
    O.match(O.fromUndefinedOr(input.logger), {
      onNone: () => BunRuntime.runMain(scopedMain(input.program, BunServices.layer)),
      onSome: (logger) =>
        BunRuntime.runMain(
          scopedMain(input.program.pipe(Effect.tapCause(reportFailure)), Layer.merge(BunServices.layer, logger)),
          { disableErrorReporting: true }
        ),
    });
  }
};
