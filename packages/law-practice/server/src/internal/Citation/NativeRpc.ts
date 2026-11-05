/** Shared Effect RPC configuration for one already-encoded native request.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Headers from "effect/http/Headers";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Stream from "effect/Stream";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";
import type * as Rpc from "effect/rpc/Rpc";
import type * as RpcGroup from "effect/rpc/RpcGroup";

/** Configure the upstream client without a second encoding pass. The enclosing
 * physical owner handles interrupts; successful write acknowledgement is kept
 * separate from terminal response delivery.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeRpcTransport = Effect.fn("Citation.makeNativeRpcTransport")(function* <E>(
  child: Pick<ChildProcessHandle, "stdin">,
  frame: Uint8Array,
  failed: () => E
) {
  const sent = yield* Deferred.make<void>();
  const requestId = RpcMessage.RequestId(0);
  const options = {
    supportsAck: false,
    spanPrefix: "Citation.native",
    generateRequestId: () => requestId,
    onFromClient: ({ message }: { readonly message: { readonly _tag: string } }) =>
      message._tag === "Request"
        ? Stream.run(Stream.make(frame), child.stdin).pipe(
            Effect.tap(() => Deferred.succeed(sent, undefined)),
            Effect.mapError(failed)
          )
        : Effect.void,
  };
  return { sent: Deferred.await(sent), requestId, options };
});
/** One decoded upstream request envelope, with tracing and acknowledgements
 * disabled by the native conversation's server configuration.
 * @internal @category operations @since 0.0.0
 */
export const citationNativeRpcRequest: {
  <A extends Rpc.Any>(payload: Rpc.Payload<A>): (tag: Rpc.Tag<A>) => RpcMessage.Request<A>;
  <A extends Rpc.Any>(tag: Rpc.Tag<A>, payload: Rpc.Payload<A>): RpcMessage.Request<A>;
} = dual(
  2,
  <A extends Rpc.Any>(tag: Rpc.Tag<A>, payload: Rpc.Payload<A>): RpcMessage.Request<A> => ({
    _tag: "Request",
    id: RpcMessage.RequestId(0),
    tag,
    payload,
    headers: Headers.empty,
  })
);

/** Apply the same single-job server policy to upstream RPC. Framing and typed
 * response interpretation stay with each procedure.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeRpcServer = Effect.fn("Citation.makeNativeRpcServer")(
  <Rpcs extends Rpc.Any>(
    group: RpcGroup.RpcGroup<Rpcs>,
    onFromServer: (response: RpcMessage.FromServer<Rpcs>) => Effect.Effect<void>
  ) =>
    RpcServer.makeNoSerialization(group, {
      concurrency: 1,
      disableClientAcks: true,
      disableSpanPropagation: true,
      spanPrefix: "Citation.native",
      onFromServer,
    })
);
