/**
 * Thin GovInfo and eCFR MCP handler layers.
 *
 * Each handler delegates directly to the corresponding public driver service
 * method. Transport, authentication, retry, cache, and rate limiting remain
 * owned by the drivers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Ecfr } from "@beep/ecfr";
import { Govinfo } from "@beep/govinfo";
import { sanitizeTracerAttributes } from "@beep/mcp-kit";
import { Effect } from "effect";
import {
  EcfrGetStructureTool,
  EcfrListTitlesTool,
  EcfrSearchResultsTool,
  EcfrToolkit,
  GovinfoSearchFailure,
  GovinfoSearchTool,
  GovinfoToolkit,
} from "./Tools.ts";
import type { EcfrDatedTitleParams, EcfrSearchParams } from "@beep/ecfr";
import type { GovinfoError, Search } from "@beep/govinfo";
import type * as Layer from "effect/Layer";
import type * as AiTool from "effect/unstable/ai/Tool";

const sensitiveHttpSpanAttributeKeys = ["url.full", "url.path", "url.query"];

const withSanitizedHttpTracing = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const tracer = yield* Effect.tracer;
  return yield* Effect.withTracer(effect, sanitizeTracerAttributes(tracer, sensitiveHttpSpanAttributeKeys));
});

const sanitizeGovinfoError = (error: GovinfoError): GovinfoSearchFailure =>
  GovinfoSearchFailure.make({ reason: error.reason });

const makeGovinfoToolkitHandlers = Effect.fn("GovLegalMcp.GovinfoToolkitHandlersLive")(function* () {
  const govinfo = yield* Govinfo;

  return GovinfoToolkit.of({
    govinfo_search: Effect.fn("GovLegalMcp.govinfo_search")(function* (request: Search.Payload) {
      return yield* govinfo
        .search(request)
        .pipe(Effect.mapError(sanitizeGovinfoError), withSanitizedHttpTracing, Effect.withSpan(GovinfoSearchTool.name));
    }),
  });
});

const makeEcfrToolkitHandlers = Effect.fn("GovLegalMcp.EcfrToolkitHandlersLive")(function* () {
  const ecfr = yield* Ecfr;

  return EcfrToolkit.of({
    ecfr_list_titles: Effect.fn("GovLegalMcp.ecfr_list_titles")(function* () {
      return yield* ecfr.listTitles.pipe(withSanitizedHttpTracing, Effect.withSpan(EcfrListTitlesTool.name));
    }),
    ecfr_search_results: Effect.fn("GovLegalMcp.ecfr_search_results")(function* (request: EcfrSearchParams) {
      return yield* ecfr
        .searchResults(request)
        .pipe(withSanitizedHttpTracing, Effect.withSpan(EcfrSearchResultsTool.name));
    }),
    ecfr_get_structure: Effect.fn("GovLegalMcp.ecfr_get_structure")(function* (request: EcfrDatedTitleParams) {
      return yield* ecfr
        .getStructure(request)
        .pipe(withSanitizedHttpTracing, Effect.withSpan(EcfrGetStructureTool.name));
    }),
  });
});

/**
 * Live handlers for the hard-gated GovInfo toolkit.
 *
 * **Example** (Verify Layer instance)
 *
 * ```ts
 * import { GovinfoToolkitHandlersLive } from "@beep/gov-legal-mcp/Handlers"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(GovinfoToolkitHandlersLive))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GovinfoToolkitHandlersLive: Layer.Layer<
  AiTool.HandlersFor<typeof GovinfoToolkit.tools>,
  never,
  Govinfo
> = GovinfoToolkit.toLayer(makeGovinfoToolkitHandlers());

/**
 * Live handlers for the three keyless eCFR tools.
 *
 * **Example** (Verify Layer instance)
 *
 * ```ts
 * import { EcfrToolkitHandlersLive } from "@beep/gov-legal-mcp/Handlers"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(EcfrToolkitHandlersLive))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EcfrToolkitHandlersLive: Layer.Layer<
  AiTool.HandlersFor<typeof EcfrToolkit.tools>,
  never,
  Ecfr
> = EcfrToolkit.toLayer(makeEcfrToolkitHandlers());
