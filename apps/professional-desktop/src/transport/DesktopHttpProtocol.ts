/**
 * Desktop HTTP RPC protocol wiring.
 *
 * @packageDocumentation
 * @category transport
 * @since 0.0.0
 */

import { Layer } from "effect";
import * as Str from "effect/String";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

const SERVER_URL = ((): string => {
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (Str.startsWith("http://")(origin) || Str.startsWith("https://")(origin)) {
      return new URL("/rpc", origin).toString();
    }
  }
  return "http://127.0.0.1:3939/rpc";
})();

/**
 * Build the desktop HTTP RPC protocol, optionally carrying the shell-issued
 * per-launch bearer token required when HTTP exposes vault/document RPCs.
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDesktopHttpProtocolLive = (rpcSessionToken: string): Layer.Layer<RpcClient.Protocol> =>
  RpcClient.layerProtocolHttp({
    url: SERVER_URL,
    transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.bearerToken(rpcSessionToken)),
  }).pipe(Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer]));
