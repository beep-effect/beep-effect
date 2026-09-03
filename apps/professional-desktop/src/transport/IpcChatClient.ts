/**
 * App-local IPC rpc protocol for the desktop chat surface (transport spike).
 *
 * Wires {@link RpcClient.layerProtocolSocket} over the ndjson serialization and
 * the {@link TauriIpcSocketLive} socket, yielding a `Protocol` that drives the
 * {@link ChatRpcs} contract entirely over Tauri IPC. Consumers build a client
 * with `RpcClient.make(ChatRpcs)` and provide this layer (plus a `Scope`); see
 * {@link IpcSpikePanel}.
 *
 * @packageDocumentation
 * @category protocols
 * @since 0.0.0
 */
import * as Layer from "effect/Layer";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { TauriIpcSocketLive } from "./TauriIpcSocket.ts";

/**
 * The client rpc `Protocol`, bound to the Tauri-IPC socket and ndjson framing.
 *
 * **Example** (Verify as Effect Layer)
 *
 * ```ts
 * import { IpcChatProtocolLive } from "@/transport/IpcChatClient"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(IpcChatProtocolLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const IpcChatProtocolLive: Layer.Layer<RpcClient.Protocol> = RpcClient.layerProtocolSocket().pipe(
  Layer.provide([RpcSerialization.layerNdjson, TauriIpcSocketLive])
);
