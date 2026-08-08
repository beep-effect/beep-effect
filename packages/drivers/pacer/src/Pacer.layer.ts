/**
 * Composition of the PACER service layers over a chosen `HttpClient` layer.
 *
 * The only difference between the mock and live runs is which `HttpClient` layer
 * is passed in here (the deterministic mock vs `FetchHttpClient.layer`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Layer } from "effect";
import { dual } from "effect/Function";
import { PacerAuth, PacerSession } from "./PacerAuth.service.ts";
import { PclClient } from "./PclClient.service.ts";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type { PacerConfig } from "./Pacer.config.ts";
import type { PacerAuthError } from "./Pacer.errors.ts";

interface PacerLayerSet {
  readonly auth: Layer.Layer<PacerAuth>;
  readonly full: Layer.Layer<PacerAuth | PacerSession | PclClient, PacerAuthError>;
  readonly pcl: Layer.Layer<PclClient, PacerAuthError>;
  readonly session: Layer.Layer<PacerSession, PacerAuthError>;
}

/**
 * Compose `PacerAuth`, `PacerSession`, and `PclClient` over the given transport.
 *
 * **Example** (Compose with mock config)
 *
 * ```ts
 * import { makePacerLayer, makePacerMockHttpClient, mockPacerConfig } from "@beep/pacer"
 *
 * const layers = makePacerLayer(mockPacerConfig(), makePacerMockHttpClient())
 * console.log(Boolean(layers.pcl))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makePacerLayer: {
  (cfg: PacerConfig, httpClient: Layer.Layer<HttpClient.HttpClient>): PacerLayerSet;
  (httpClient: Layer.Layer<HttpClient.HttpClient>): (cfg: PacerConfig) => PacerLayerSet;
} = dual(2, (cfg: PacerConfig, httpClient: Layer.Layer<HttpClient.HttpClient>): PacerLayerSet => {
  const auth = PacerAuth.makeLayer(cfg).pipe(Layer.provide(httpClient));
  const session = PacerSession.layer.pipe(Layer.provide(auth));
  const pcl = PclClient.makeLayer(cfg).pipe(Layer.provide(Layer.merge(httpClient, session)));
  const full = Layer.mergeAll(pcl, session, auth);
  return { auth, session, pcl, full };
});
