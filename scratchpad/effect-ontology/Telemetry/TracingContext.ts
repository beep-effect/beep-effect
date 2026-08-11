/**
 * Tracing Context Service
 *
 * Provides model and provider information for span annotations.
 * Thread this through your layer composition to enable LLM tracing.
 *
 * @module Telemetry/TracingContext
 * @since 2.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";

/**
 * Tracing context interface
 *
 * @since 2.0.0
 * @category models
 */
export interface TracingContextShape {
  readonly model: string;
  readonly provider: string;
}

const $I = $ScratchpadId.create("effect-ontology/Telemetry/TracingContext");
/**
 * TracingContext tag and utilities
 *
 * Provides model/provider info for LLM span annotations.
 *
 * @since 2.0.0
 * @category services
 */
export class TracingContext extends Context.Service<TracingContext, TracingContextShape>()($I`TracingContext`) {
  /**
   * Default layer with unknown model/provider
   *
   * @since 2.0.0
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
   * @since 2.0.0
   * @category constructors
   */
  static readonly make = (model: string, provider: string) =>
    Layer.succeed(TracingContext, {
      model,
      provider,
    });
}
