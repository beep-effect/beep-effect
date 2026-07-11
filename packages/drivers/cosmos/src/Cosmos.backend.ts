/**
 * Runtime capability detection for the cosmos graph driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CosmosId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { P } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $CosmosId.create("Cosmos.backend");

/**
 * Graph viewport backend selected by the driver.
 *
 * @example
 * ```ts
 * import { CosmosBackend } from "@beep/cosmos"
 *
 * const backend: CosmosBackend = "cosmos"
 *
 * console.log(backend)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CosmosBackend = LiteralKit(["cosmos", "sigma"]).pipe(
  $I.annoteSchema("CosmosBackend", {
    description: "Graph viewport backend selected by the cosmos driver capability probe.",
  })
);

/**
 * Type for {@link CosmosBackend}.
 *
 * @example
 * ```ts
 * import { CosmosBackend } from "@beep/cosmos"
 *
 * const backend: CosmosBackend = "sigma"
 *
 * console.log(backend)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CosmosBackend = typeof CosmosBackend.Type;

/**
 * Runtime WebGL2 probe result.
 *
 * @example
 * ```ts
 * import { CosmosCapabilityProbe } from "@beep/cosmos"
 *
 * const probe = CosmosCapabilityProbe.make({
 *   webGl2: false,
 *   reason: "document unavailable"
 * })
 *
 * console.log(probe.webGl2)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class CosmosCapabilityProbe extends S.Class<CosmosCapabilityProbe>($I`CosmosCapabilityProbe`)(
  {
    webGl2: S.Boolean,
    reason: S.String,
  },
  $I.annote("CosmosCapabilityProbe", {
    description: "Runtime WebGL2 capability probe result for the ontology visualizer spike.",
  })
) {}

/**
 * Driver backend selection result.
 *
 * @example
 * ```ts
 * import { CosmosBackendSelection } from "@beep/cosmos"
 *
 * const selection = CosmosBackendSelection.make({
 *   backend: "sigma",
 *   webGl2: false,
 *   reason: "WebGL2 unavailable"
 * })
 *
 * console.log(selection.backend)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class CosmosBackendSelection extends S.Class<CosmosBackendSelection>($I`CosmosBackendSelection`)(
  {
    backend: CosmosBackend,
    webGl2: S.Boolean,
    reason: S.String,
  },
  $I.annote("CosmosBackendSelection", {
    description: "Backend chosen from a runtime WebGL2 capability probe.",
  })
) {}

const isHtmlCanvasElement = (value: unknown): value is HTMLCanvasElement => {
  const getContext = P.isObject(value) ? Reflect.get(value, "getContext") : undefined;
  return P.isFunction(getContext);
};

const HtmlCanvasElementLike = S.declare<HTMLCanvasElement>(isHtmlCanvasElement).pipe(
  $I.annoteSchema("HtmlCanvasElementLike", {
    description: "Canvas-like DOM element with a getContext method for WebGL capability probing.",
  })
);

/**
 * Input options for the runtime WebGL2 probe.
 *
 * @example
 * ```ts
 * import { ProbeWebGl2Options } from "@beep/cosmos"
 *
 * const options = ProbeWebGl2Options.make({})
 *
 * console.log(options.canvas)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class ProbeWebGl2Options extends S.Class<ProbeWebGl2Options>($I`ProbeWebGl2Options`)(
  {
    canvas: S.optionalKey(HtmlCanvasElementLike),
  },
  $I.annote("ProbeWebGl2Options", {
    description: "Optional canvas override for probing WebGL2 without creating a document element.",
  })
) {}

/**
 * Selects cosmos.gl when WebGL2 is available, otherwise sigma.js.
 *
 * @example
 * ```ts
 * import { CosmosCapabilityProbe, selectCosmosBackend } from "@beep/cosmos"
 *
 * const selection = selectCosmosBackend(
 *   CosmosCapabilityProbe.make({ webGl2: true, reason: "WebGL2 context created" })
 * )
 *
 * console.log(selection.backend)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const selectCosmosBackend = (probe: CosmosCapabilityProbe): CosmosBackendSelection =>
  CosmosBackendSelection.make({
    backend: probe.webGl2 ? "cosmos" : "sigma",
    webGl2: probe.webGl2,
    reason: probe.reason,
  });

/**
 * Probes WebGL2 at runtime without assuming a browser at import time.
 *
 * @example
 * ```ts
 * import { probeWebGl2 } from "@beep/cosmos"
 *
 * const probe = probeWebGl2()
 *
 * console.log(probe.reason)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const probeWebGl2 = (options: ProbeWebGl2Options = ProbeWebGl2Options.make({})): CosmosCapabilityProbe => {
  const runtimeDocument = globalThis.document;

  if (P.isUndefined(runtimeDocument) && P.isUndefined(options?.canvas)) {
    return CosmosCapabilityProbe.make({
      webGl2: false,
      reason: "document unavailable",
    });
  }

  const canvas = options?.canvas ?? runtimeDocument.createElement("canvas");
  const context = canvas.getContext("webgl2", {
    failIfMajorPerformanceCaveat: true,
  });

  return P.isNotNull(context)
    ? CosmosCapabilityProbe.make({
        webGl2: true,
        reason: "WebGL2 context created",
      })
    : CosmosCapabilityProbe.make({
        webGl2: false,
        reason: "WebGL2 context unavailable",
      });
};
