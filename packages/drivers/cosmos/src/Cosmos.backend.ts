/**
 * Runtime capability detection for the cosmos graph driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CosmosId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { P } from "@beep/utils";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $CosmosId.create("Cosmos.backend");

/**
 * Graph viewport backend selected by the driver.
 *
 * **Example** (Assign cosmos backend value)
 *
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
export const CosmosBackend = LiteralKit(["cosmos", "sigma"]).annotate(
  $I.annote("CosmosBackend", {
    description: "Graph viewport backend selected by the cosmos driver capability probe.",
  })
);

/**
 * Type for {@link CosmosBackend}.
 *
 * **Example** (Assign sigma backend type)
 *
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
 * **Example** (Create failed WebGL2 probe)
 *
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
 * **Example** (Create sigma selection result)
 *
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
 * **Example** (Create empty probe options)
 *
 * ```ts
 * import { ProbeWebGl2Options } from "@beep/cosmos"
 *
 * const options = ProbeWebGl2Options.make({})
 *
 * console.log(options.canvas._tag)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class ProbeWebGl2Options extends S.Class<ProbeWebGl2Options>($I`ProbeWebGl2Options`)(
  {
    canvas: S.OptionFromOptionalKey(HtmlCanvasElementLike).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ProbeWebGl2Options", {
    description: "Optional canvas override for probing WebGL2 without creating a document element.",
  })
) {}

/**
 * Selects cosmos.gl when WebGL2 is available, otherwise sigma.js.
 *
 * **Example** (Select cosmos with WebGL2)
 *
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
    backend: probe.webGl2 ? CosmosBackend.Enum.cosmos : CosmosBackend.Enum.sigma,
    webGl2: probe.webGl2,
    reason: probe.reason,
  });

/**
 * Probes WebGL2 at runtime without assuming a browser at import time.
 *
 * **Example** (Run runtime WebGL2 probe)
 *
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
  const canvas = options.canvas.pipe(
    O.orElse(() =>
      O.fromUndefinedOr(globalThis.document).pipe(O.map((runtimeDocument) => runtimeDocument.createElement("canvas")))
    )
  );

  return O.match(canvas, {
    onNone: () =>
      CosmosCapabilityProbe.make({
        webGl2: false,
        reason: "document unavailable",
      }),
    onSome: (runtimeCanvas) => {
      const context = runtimeCanvas.getContext("webgl2", {
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
    },
  });
};
