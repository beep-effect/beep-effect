/** Shared Effect RPC configuration for one already-encoded native request.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as Headers from "effect/http/Headers";
import * as O from "effect/Option";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Stream from "effect/Stream";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";
import type * as Rpc from "effect/rpc/Rpc";
import type * as RpcGroup from "effect/rpc/RpcGroup";

/** Trusted server callbacks for the existing one-job conversation. No callback
 * crosses the wire, and the frame reader owns exact count and EOF validation.
 * @internal @category services @since 0.0.0
 */
export interface CitationNativeConversation<Message, A, NativeError, E> {
  readonly decode: (body: Uint8Array) => Effect.Effect<Message, E>;
  readonly invalid: () => E;
  readonly isReady: (message: Message) => boolean;
  readonly isStarted: (message: Message) => boolean;
  readonly isTerminal: (message: Message) => boolean;
  readonly read: (onFrame: (body: Uint8Array) => Effect.Effect<void, E>) => Effect.Effect<void, E>;
  readonly terminal: (message: Message, body: Uint8Array) => Effect.Effect<Exit.Exit<A, NativeError>, E>;
}
/** Share the existing Ready/Started/terminal ordering and delayed publication.
 * The terminal Exit is returned only after the bounded reader validates EOF.
 * RPC registration/write acknowledgement and physical retirement remain separate.
 * @internal @category operations @since 0.0.0
 */
export const receiveCitationNativeConversation = Effect.fn("Citation.receiveNativeConversation")(function* <
  Message,
  A,
  NativeError,
  E,
>(definition: CitationNativeConversation<Message, A, NativeError, E>) {
  let step = 0;
  let candidate = O.none<Exit.Exit<A, NativeError>>();
  yield* definition.read(
    Effect.fnUntraced(function* (body) {
      const message = yield* definition.decode(body);
      if (
        (step === 0 && !definition.isReady(message)) ||
        (step === 1 && !definition.isStarted(message)) ||
        (step === 2 && !definition.isTerminal(message))
      )
        return yield* Effect.fail(definition.invalid());
      if (step === 2) {
        const terminal = yield* definition.terminal(message, body);
        candidate = O.some(terminal);
      }
      step++;
    })
  );
  return yield* Effect.fromOption(candidate).pipe(Effect.mapError(definition.invalid));
});
/** Deliver a validated terminal Exit only after the registered request write.
 * @internal @category operations @since 0.0.0
 */
const deliverCitationNativeRpcExit = Effect.fn("Citation.deliverNativeRpcExit")(
  <Rpcs extends Rpc.Any>(
    sent: Effect.Effect<void>,
    write: (message: RpcMessage.FromServer<Rpcs>) => Effect.Effect<void>,
    requestId: RpcMessage.RequestId,
    exit: Rpc.Exit<Rpcs>
  ) => sent.pipe(Effect.andThen(write({ _tag: "Exit", clientId: 0, requestId, exit })))
);
/** Registered upstream delivery capability, never wire data.
 * @internal @category services @since 0.0.0
 */
export interface CitationNativeRpcDelivery<Rpcs extends Rpc.Any> {
  readonly requestId: RpcMessage.RequestId;
  readonly sent: Effect.Effect<void>;
  readonly write: (message: RpcMessage.FromServer<Rpcs>) => Effect.Effect<void>;
}
/** Bind upstream terminal delivery once for a registered single-job client.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeRpcDelivery = <Rpcs extends Rpc.Any>(delivery: CitationNativeRpcDelivery<Rpcs>) =>
  Effect.fn("Citation.deliverRegisteredNativeRpc")((exit: Rpc.Exit<Rpcs>) =>
    deliverCitationNativeRpcExit(delivery.sent, delivery.write, delivery.requestId, exit)
  );

/** Convert schema-selected terminal data into the upstream Exit without sharing
 * wire-specific field names or accepting a nonterminal as a result.
 * @internal @category operations @since 0.0.0
 */
export const citationNativeRpcExit = Effect.fn("Citation.nativeRpcExit")(function* <A, NativeError, E>(
  success: O.Option<A>,
  failure: O.Option<NativeError>,
  invalid: () => E
) {
  if (O.isSome(success)) return Exit.succeed(success.value);
  if (O.isSome(failure)) return Exit.fail(failure.value);
  return yield* Effect.fail(invalid());
});
/** Reuse a schema's Failure guard to select its typed native error field.
 * @internal @category operations @since 0.0.0
 */
export const citationNativeRpcFailure =
  <Message, Failure extends Message & { readonly failure: unknown }>(guard: (message: Message) => message is Failure) =>
  (message: Message): O.Option<Failure["failure"]> =>
    O.map(O.liftPredicate(guard)(message), (value) => value.failure);

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
/** Execute one decoded request with upstream server handlers. Completion waits
 * for the terminal reply writer; the caller provides its captured handler context.
 * @internal @category operations @since 0.0.0
 */
export const runCitationNativeRpcJob = Effect.fn("Citation.runNativeRpcJob")(function* <Rpcs extends Rpc.Any, E>(
  group: RpcGroup.RpcGroup<Rpcs>,
  request: RpcMessage.Request<Rpcs>,
  terminal: (exit: Rpc.Exit<Rpcs>) => Effect.Effect<void, E>
) {
  const completed = yield* Deferred.make<void, E>();
  const server = yield* makeCitationNativeRpcServer(group, (response) =>
    response._tag === "Exit" ? Deferred.complete(completed, terminal(response.exit)).pipe(Effect.asVoid) : Effect.void
  );
  yield* server.write(0, request);
  yield* Deferred.await(completed);
});
