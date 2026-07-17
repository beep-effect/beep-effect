/**
 * Default HTTP transport policy for agents chat clients.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { O, pipe } from "@beep/utils";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { resolveBrowserHttpUrl } from "./internal/BrowserHttpUrl.js";

const LOOPBACK_CHAT_RPC_URL = "http://127.0.0.1:3939/rpc";

/**
 * Resolve the default chat RPC endpoint for a browser-like runtime.
 *
 * HTTP(S) pages use their same-origin `/rpc` route so development servers can
 * proxy the request. Missing, custom-scheme, or malformed origins fall back to
 * the local desktop sidecar.
 *
 * @example
 * ```ts
 * import { resolveChatRpcHttpUrl } from "@beep/agents-client/Chat.layer"
 *
 * const runtime = { location: { origin: "https://app.example" } }
 * console.log(resolveChatRpcHttpUrl(runtime)) // "https://app.example/rpc"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveChatRpcHttpUrl = (
  runtime: Readonly<{ location: Readonly<{ origin: string }> }> | undefined = globalThis.window
): string =>
  pipe(
    resolveBrowserHttpUrl(runtime, "/rpc"),
    O.getOrElse(() => LOOPBACK_CHAT_RPC_URL)
  );

/**
 * The default HTTP protocol used by browser and non-IPC desktop sessions.
 *
 * The URL is resolved at module load from the active browser origin: dev-server
 * sessions use a relative `/rpc`, while packaged non-IPC desktop sessions fall
 * back to the local sidecar server.
 *
 * @example
 * ```ts
 * import { HttpChatProtocolLive } from "@beep/agents-client/Chat.layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(HttpChatProtocolLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HttpChatProtocolLive: Layer.Layer<RpcClient.Protocol> = RpcClient.layerProtocolHttp({
  url: resolveChatRpcHttpUrl(),
}).pipe(Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer]));
