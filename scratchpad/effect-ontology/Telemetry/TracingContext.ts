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
 * Model identifier and provider name threaded into LLM span annotations.
 *
 * @see {@link TracingContext} for the service that provides this shape.
 * @category type-level
 * @since 0.0.0
 */
export interface TracingContextShape {
  readonly model: string;
  readonly provider: string;
}

const $I = $ScratchpadId.create("effect-ontology/Telemetry/TracingContext");
/**
 * Context service that supplies the current model and provider for LLM span
 * annotations.
 *
 * **Details**
 *
 * {@link TracingContext.Default} uses `"unknown"` / `"unknown"`.
 * {@link TracingContext.make} overrides both fields for a real provider.
 *
 * **Example** (Read default and constructed context)
 *
 * ```ts
 * import { TracingContext } from "@effect-ontology/Telemetry/TracingContext"
 * import { Effect } from "effect"
 *
 * const read = Effect.flatMap(TracingContext, (context) => Effect.succeed(context))
 * const unknown = Effect.runSync(Effect.provide(read, TracingContext.Default))
 * console.log(unknown.model) // "unknown"
 * const claude = Effect.runSync(
 *   Effect.provide(read, TracingContext.make("claude-sonnet-4-5", "anthropic"))
 * )
 * console.log(claude.provider) // "anthropic"
 * ```
 *
 * @category services
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
