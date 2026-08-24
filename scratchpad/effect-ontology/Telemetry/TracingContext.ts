/**
 * Tracing Context Service
 *
 * **Details**
 *
 * Provides model and provider information for span annotations.
 * Thread this through your layer composition to enable LLM tracing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";

/**
 * Tracing context interface
 *
 * **Example** (Reference TracingContextShape fields)
 *
 * ```ts
 * import type { TracingContextShape } from "@effect-ontology/Telemetry/TracingContext"
 *
 * const tracingContextShapeFields: ReadonlyArray<keyof TracingContextShape> = ["model", "provider"]
 *
 * console.log(tracingContextShapeFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface TracingContextShape {
  readonly model: string;
  readonly provider: string;
}

const $I = $ScratchpadId.create("effect-ontology/Telemetry/TracingContext");
/**
 * TracingContext tag and utilities
 *
 * **Details**
 *
 * Provides model/provider info for LLM span annotations.
 *
 * **Example** (Inspect tracing context)
 *
 * ```ts
 * import { TracingContext } from "@effect-ontology/Telemetry/TracingContext"
 *
 * console.log(TracingContext)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class TracingContext extends Context.Service<TracingContext, TracingContextShape>()($I`TracingContext`) {
  /**
   * Default layer with unknown model/provider
   *
   * @since 0.0.0
   * @category layers
   */
  static readonly Default = Layer.succeed(TracingContext, {
    model: "unknown",
    provider: "unknown",
  });

  /**
   * Create a TracingContext layer with specific model/provider
   *
   * @param model - Model identifier
   * @param provider - Provider name
   * @returns Layer providing TracingContext
   *
   * @since 0.0.0
   * @category constructors
   */
  static readonly make = (model: string, provider: string) =>
    Layer.succeed(TracingContext, {
      model,
      provider,
    });
}
