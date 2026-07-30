/**
 * Witness script bundling service.
 *
 * Bundles `src/witness/witness.iife.ts` into a minified browser IIFE via
 * `Bun.build` on first request and caches the result for the lifetime of the
 * layer, so `GET /witness.js` never pays the bundling cost twice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $QaCaptureId } from "@beep/identity/packages";
import { A, O } from "@beep/utils";
import { Context, Effect, Layer } from "effect";
import { QaCaptureError } from "./QaCapture.errors.ts";

const $I = $QaCaptureId.create("Witness.service");

const witnessEntrypoint = (): string => Bun.fileURLToPath(new URL("./witness/witness.iife.ts", import.meta.url));

const bundleWitness: Effect.Effect<string, QaCaptureError> = Effect.tryPromise({
  try: () =>
    Bun.build({
      entrypoints: [witnessEntrypoint()],
      format: "iife",
      minify: true,
      target: "browser",
    }),
  catch: (cause) =>
    QaCaptureError.fromUnknown("witnessBundle", "Bun.build threw while bundling the witness script", { cause }),
}).pipe(
  Effect.flatMap((output) =>
    O.match(A.head(output.outputs), {
      onNone: () =>
        Effect.fail(
          QaCaptureError.make({
            message: "Bun.build produced no outputs for the witness script",
            operation: "witnessBundle",
            path: O.some(witnessEntrypoint()),
          })
        ),
      onSome: (artifact) =>
        Effect.tryPromise({
          try: () => artifact.text(),
          catch: (cause) =>
            QaCaptureError.fromUnknown("witnessBundle", "could not read the bundled witness output", { cause }),
        }),
    })
  ),
  Effect.withSpan("Witness.bundle")
);

/**
 * Runtime shape exposed by the {@link Witness} service.
 *
 * @example
 * ```ts
 * import type { WitnessShape } from "@beep/qa-capture"
 * import { Effect } from "effect"
 *
 * const service: WitnessShape = { script: Effect.succeed("(()=>{})();") }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface WitnessShape {
  readonly script: Effect.Effect<string, QaCaptureError>;
}

/**
 * Effect service that serves the bundled in-page witness script.
 *
 * @example
 * ```ts
 * import { Witness } from "@beep/qa-capture"
 *
 * const layer = Witness.layer
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Witness extends Context.Service<Witness, WitnessShape>()($I`Witness`) {
  /**
   * Live witness layer bundling the checked-in source on first request.
   *
   * @example
   * ```ts
   * import { Witness } from "@beep/qa-capture"
   *
   * const layer = Witness.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Witness> = Layer.effect(
    Witness,
    Effect.map(Effect.cached(bundleWitness), (script) => Witness.of({ script }))
  );

  /**
   * Fixed-script witness layer for tests and offline fallbacks.
   *
   * @example
   * ```ts
   * import { Witness } from "@beep/qa-capture"
   *
   * const layer = Witness.layerScript("(()=>{})();")
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerScript = (script: string): Layer.Layer<Witness> =>
    Layer.succeed(Witness)(Witness.of({ script: Effect.succeed(script) }));
}
