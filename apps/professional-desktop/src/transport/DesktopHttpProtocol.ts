/**
 * Desktop HTTP RPC protocol wiring.
 *
 * @packageDocumentation
 * @category protocols
 * @since 0.0.0
 */

import { resolveChatRpcHttpUrl } from "@beep/agents-client/Chat.layer";
import * as Layer from "effect/Layer";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

// Packaged-origin detection (Windows `tauri.localhost` included) lives in
// @beep/agents-client's resolver — one source of truth for the routing rule
// whose divergence across copies caused the original Windows packaged-RPC bug.
const SERVER_URL = resolveChatRpcHttpUrl();

/**
 * Build the desktop HTTP RPC protocol, optionally carrying the shell-issued
 * per-launch bearer token required when HTTP exposes vault/document RPCs.
 *
 * **Example** (Build protocol layer)
 *
 * ```ts
 * import { makeDesktopHttpProtocolLive } from "@/transport/DesktopHttpProtocol"
 * import * as Layer from "effect/Layer";
 * const layer = makeDesktopHttpProtocolLive("session-token")
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDesktopHttpProtocolLive = (rpcSessionToken: string): Layer.Layer<RpcClient.Protocol> =>
  RpcClient.layerProtocolHttp({
    url: SERVER_URL,
    transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.bearerToken(rpcSessionToken)),
  }).pipe(Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer]));
