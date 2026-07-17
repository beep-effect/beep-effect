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

const SIDECAR_RPC_URL = "http://127.0.0.1:3939/rpc" as const;
const WINDOWS_TAURI_HTTP_ORIGIN = "http://tauri.localhost" as const;
const WINDOWS_TAURI_HTTPS_ORIGIN = "https://tauri.localhost" as const;

/**
 * Resolve the desktop RPC endpoint for a browser origin.
 *
 * Packaged Tauri origins use the loopback sidecar, including Windows' HTTP(S)
 * `tauri.localhost` origins. Other HTTP(S) origins are development servers and
 * keep their origin-relative `/rpc` route.
 *
 * @example
 * ```ts
 * import { resolveDesktopRpcServerUrl } from "@/transport/DesktopHttpProtocol"
 *
 * console.log(resolveDesktopRpcServerUrl("http://tauri.localhost"))
 * // "http://127.0.0.1:3939/rpc"
 * ```
 *
 * @category transport
 * @since 0.0.0
 */
export const resolveDesktopRpcServerUrl = (origin: string | undefined): string => {
  if (
    origin !== undefined &&
    origin !== WINDOWS_TAURI_HTTP_ORIGIN &&
    origin !== WINDOWS_TAURI_HTTPS_ORIGIN &&
    (Str.startsWith("http://")(origin) || Str.startsWith("https://")(origin))
  ) {
    return new URL("/rpc", origin).toString();
  }
  return SIDECAR_RPC_URL;
};

const SERVER_URL = resolveDesktopRpcServerUrl(typeof window === "undefined" ? undefined : window.location.origin);

/**
 * Build the desktop HTTP RPC protocol, optionally carrying the shell-issued
 * per-launch bearer token required when HTTP exposes vault/document RPCs.
 *
 * @example
 * ```ts
 * import { makeDesktopHttpProtocolLive } from "@/transport/DesktopHttpProtocol"
 *
 * const layer = makeDesktopHttpProtocolLive("session-token")
 * console.log(layer)
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
