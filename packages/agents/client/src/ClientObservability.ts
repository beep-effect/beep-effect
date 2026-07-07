/**
 * Client-side observability for the desktop chat webview.
 *
 * The webview exports logs, traces, and metrics over OTLP via effect's native
 * exporter (`effect/unstable/observability`, no OpenTelemetry SDK dependency),
 * as `professional-desktop-web`. Critically, the effect tracer puts the active
 * client span context (traceId/spanId) onto the outgoing rpc request envelope,
 * so the webview's spans and the sidecar's `RpcServer.*` spans join into ONE
 * distributed trace — the SPEC "joined traces" criterion. This module is the
 * client half the POC carried in `src/observability.ts`; the sidecar half lives
 * in the app's `src/runtime/Observability.ts`.
 *
 * Env-gated, browser-safe, NodeNext-safe: this module deliberately avoids
 * `import.meta.env` (vite-only, untyped under NodeNext — the same reason
 * {@link Chat.atoms} keys off `window.location.origin` rather than vite env).
 * The OTLP base URL is resolved from the live runtime:
 *
 * - An explicit `globalThis.__BEEP_OTLP_URL__` override wins when set (allows a
 *   packaged build to point at a collector directly).
 * - Otherwise, on a real http(s) origin (the vite dev server) the exporter posts
 *   to the same-origin `/otlp` path, which vite proxies to the collector (see
 *   the app's vite.config.ts) — no CORS setup needed.
 * - Otherwise (packaged `tauri://` origin, or jsdom/SSR with no http origin) the
 *   base URL is empty and the layer collapses to {@link Layer.empty}, so
 *   tests/dev without a collector are unaffected and packaged builds default to
 *   telemetry-off.
 *
 * @packageDocumentation
 * @category observability
 * @since 0.0.0
 */

import { O, P, Str } from "@beep/utils";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { Otlp, OtlpSerialization } from "effect/unstable/observability";

// browser/runtime-derived config boundary — no vite env, no node `process`.
const otlpBaseUrl = ((): O.Option<string> => {
  const runtime: unknown = globalThis;
  const override = P.hasProperty(runtime, "__BEEP_OTLP_URL__") ? runtime.__BEEP_OTLP_URL__ : undefined;
  if (P.isString(override)) {
    return O.some(override);
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (Str.startsWith(origin, "http://") || Str.startsWith(origin, "https://")) {
      return O.some(new URL("/otlp", origin).toString());
    }
  }
  return O.none();
})();

/**
 * Env-gated client OTLP layer. Present base URL ⇒ the effect-native OTLP
 * exporter (traces/logs/metrics over JSON) whose tracer threads client span
 * context onto rpc envelopes; absent ⇒ {@link Layer.empty}, so the exporter is
 * opt-in and dev/tests without a collector are unaffected.
 *
 * @example
 * ```ts
 * import { ClientObservabilityLive } from "@beep/agents-client"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ClientObservabilityLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClientObservabilityLive: Layer.Layer<never> = O.match(otlpBaseUrl, {
  onNone: () => Layer.empty,
  onSome: (baseUrl) =>
    Otlp.layer({
      baseUrl,
      resource: {
        serviceName: "professional-desktop-web",
        serviceVersion: "0.0.3",
      },
    }).pipe(Layer.provide([FetchHttpClient.layer, OtlpSerialization.layerJson])),
});
