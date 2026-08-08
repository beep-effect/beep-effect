/**
 * Transport selection for epistemic desktop RPC clients.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicClientId } from "@beep/identity/packages";
import { O, pipe, Str } from "@beep/utils";
import { Layer, Result } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import { Atom } from "effect/unstable/reactivity";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

const $I = $EpistemicClientId.create("Protocol");
const LOOPBACK_EPISTEMIC_RPC_URL = "http://127.0.0.1:3939/rpc";
const WINDOWS_TAURI_HTTP_ORIGIN = "http://tauri.localhost";
const WINDOWS_TAURI_HTTPS_ORIGIN = "https://tauri.localhost";

class BrowserHttpLocation extends S.Class<BrowserHttpLocation>($I`BrowserHttpLocation`)(
  {
    origin: S.String,
  },
  $I.annote("BrowserHttpLocation", {
    description: "Browser location fields required to resolve an epistemic RPC endpoint.",
  })
) {}

class BrowserHttpRuntime extends S.Class<BrowserHttpRuntime>($I`BrowserHttpRuntime`)(
  {
    location: BrowserHttpLocation,
  },
  $I.annote("BrowserHttpRuntime", {
    description: "Browser runtime fields required to resolve an epistemic RPC endpoint.",
  })
) {}

/**
 * Resolve the default epistemic RPC endpoint for a browser-like runtime.
 *
 * **Details**
 *
 * HTTP(S) pages use their same-origin `/rpc` route. Missing, custom-scheme,
 * malformed, and packaged Windows Tauri origins use the local desktop sidecar.
 *
 * **Example** (Resolve same-origin RPC URL)
 *
 * ```ts
 * import { resolveEpistemicRpcHttpUrl } from "@beep/epistemic-client"
 *
 * const runtime = { location: { origin: "https://app.example" } }
 * console.log(resolveEpistemicRpcHttpUrl(runtime)) // "https://app.example/rpc"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveEpistemicRpcHttpUrl = (runtime: BrowserHttpRuntime | undefined = globalThis.window): string => {
  const origin = runtime?.location.origin;
  if (origin === WINDOWS_TAURI_HTTP_ORIGIN || origin === WINDOWS_TAURI_HTTPS_ORIGIN) {
    return LOOPBACK_EPISTEMIC_RPC_URL;
  }

  return pipe(
    O.fromUndefinedOr(origin),
    O.filter((value) => Str.startsWith(value, "http://") || Str.startsWith(value, "https://")),
    O.flatMap((value) =>
      pipe(
        Result.try(() => new URL("/rpc", value).href),
        Result.getSuccess
      )
    ),
    O.getOrElse(() => LOOPBACK_EPISTEMIC_RPC_URL)
  );
};

/**
 * Default HTTP protocol for browser and non-IPC epistemic clients.
 *
 * **Details**
 *
 * Professional Desktop replaces this layer with its authenticated protocol
 * before mounting contradiction query atoms.
 *
 * **Example** (Verify protocol Layer)
 *
 * ```ts
 * import { HttpEpistemicProtocolLive } from "@beep/epistemic-client"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(HttpEpistemicProtocolLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HttpEpistemicProtocolLive: Layer.Layer<RpcClient.Protocol> = RpcClient.layerProtocolHttp({
  url: resolveEpistemicRpcHttpUrl(),
}).pipe(Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer]));

/**
 * Writable transport selector for epistemic RPC clients.
 *
 * **Example** (Set HTTP protocol atom)
 *
 * ```ts
 * import {
 *   epistemicProtocolLayerAtom,
 *   HttpEpistemicProtocolLive,
 * } from "@beep/epistemic-client"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const registry = AtomRegistry.make()
 * registry.set(epistemicProtocolLayerAtom, HttpEpistemicProtocolLive)
 * console.log(registry.get(epistemicProtocolLayerAtom))
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const epistemicProtocolLayerAtom: Atom.Writable<Layer.Layer<RpcClient.Protocol>> =
  Atom.make(HttpEpistemicProtocolLive);
