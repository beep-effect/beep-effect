import * as O from "@beep/utils/Option";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as AcpSchema from "../_generated/schema.gen.ts";
import * as AcpError from "../Acp.errors.ts";
import type * as RpcClientError from "effect/rpc/RpcClientError";
import type {
  AcpExtensionRegistrars,
  AcpRequestContext,
  AcpRequestHandler,
  AcpUnknownExtNotificationHandler,
  AcpUnknownExtRequestHandler,
} from "../AcpProtocol.service.ts";

const isAcpProtocolError = S.is(AcpSchema.Error);
const isAcpError = S.is(AcpError.AcpError);

/**
 * Lifts a typed RPC call into the ACP error channel (`callRpc(effect, method)` or
 * `effect.pipe(callRpc(method))`).
 *
 * A protocol error becomes an `AcpRequestError` correlated with `method`. An `RpcClientError`
 * whose `RpcClientDefect` carries an `AcpError` (the protocol terminated, for example with an
 * `AcpProcessExitedError`) fails with that original error; any other client error becomes an
 * `AcpTransportError` for the `call-rpc` operation that keeps the client error as its cause.
 */
export const callRpc: {
  (
    method: string
  ): <A>(
    effect: Effect.Effect<A, RpcClientError.RpcClientError | AcpSchema.Error>
  ) => Effect.Effect<A, AcpError.AcpError>;
  <A>(
    effect: Effect.Effect<A, RpcClientError.RpcClientError | AcpSchema.Error>,
    method: string
  ): Effect.Effect<A, AcpError.AcpError>;
} = dual(
  2,
  <A>(
    effect: Effect.Effect<A, RpcClientError.RpcClientError | AcpSchema.Error>,
    method: string
  ): Effect.Effect<A, AcpError.AcpError> =>
    effect.pipe(
      Effect.catchIf(isAcpProtocolError, (error) =>
        Effect.fail(
          AcpError.AcpRequestError.fromProtocolError(
            error,
            AcpError.AcpRequestDiagnostics.make({ method: O.some(method) })
          )
        )
      ),
      Effect.catchTag("RpcClientError", (error) =>
        Effect.fail(
          error.reason._tag === "RpcClientDefect" && isAcpError(error.reason.cause)
            ? error.reason.cause
            : AcpError.AcpTransportError.make({
                cause: O.some(error),
                method: O.some(method),
                operation: O.some("call-rpc"),
              })
        )
      )
    )
);

/**
 * Runs a notification handler so that neither a typed failure nor a defect stops the caller.
 *
 * A notification has no reply to fail, so a typed failure is dropped. A defect is logged at
 * error level and then dropped.
 */
export const isolateNotificationHandler = <E, R>(effect: Effect.Effect<void, E, R>): Effect.Effect<void, never, R> =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Cause.hasDies(cause) ? Effect.logError("ACP notification handler failed", cause) : Effect.void
    )
  );

interface RunHandlerOptions<A, B> {
  readonly context: AcpRequestContext;
  readonly handler: AcpRequestHandler<A, B> | undefined;
  readonly method: string;
  readonly payload: A;
}

/**
 * Runs a registered core request handler and maps its failure to the JSON-RPC error object.
 *
 * A missing handler answers `methodNotFound`. A typed failure goes through
 * `AcpRequestError.fromCoreHandlerError`, so non-request errors never leak their message. A defect
 * wins over a typed failure: it is logged with the method and answered as a generic internal error
 * (`-32603`), like a dying extension request handler, so the defect text never reaches the peer.
 */
export const runHandler = Effect.fnUntraced(function* <A, B>({
  context,
  handler,
  method,
  payload,
}: RunHandlerOptions<A, B>) {
  if (handler === undefined) {
    return yield* Effect.fail(AcpError.AcpRequestError.methodNotFound(method).toProtocolError());
  }
  return yield* handler(payload, context).pipe(
    Effect.mapError((error) => AcpError.AcpRequestError.fromCoreHandlerError(error, method).toProtocolError()),
    Effect.catchDefect((defect) =>
      Effect.logError(`ACP request handler failed for '${method}'`, defect).pipe(
        Effect.andThen(
          Effect.fail(
            AcpError.AcpRequestError.internalError(
              `ACP request handler failed for method '${method}'`
            ).toProtocolError()
          )
        )
      )
    )
  );
});

export type ExtRequestHandler = (
  params: unknown,
  context: AcpRequestContext
) => Effect.Effect<unknown, AcpError.AcpError>;
export type ExtNotificationHandler = (params: unknown) => Effect.Effect<void, AcpError.AcpError>;

interface DecodeExtRequestRegistrationOptions<A, I> {
  readonly handler: (payload: A, context: AcpRequestContext) => Effect.Effect<unknown, AcpError.AcpError>;
  readonly method: string;
  readonly payload: S.Codec<A, I>;
}

interface DecodeExtNotificationRegistrationOptions<A, I> {
  readonly handler: (payload: A) => Effect.Effect<void, AcpError.AcpError>;
  readonly method: string;
  readonly payload: S.Codec<A, I>;
}

const decodeExtRequestRegistration =
  <A, I>({ handler, method, payload }: DecodeExtRequestRegistrationOptions<A, I>): ExtRequestHandler =>
  (params, context) =>
    S.decodeUnknownEffect(payload)(params).pipe(
      Effect.mapError((error) => AcpError.AcpRequestError.invalidExtensionPayload(method, error)),
      Effect.flatMap((decoded) => handler(decoded, context))
    );

const decodeExtNotificationRegistration =
  <A, I>({ handler, method, payload }: DecodeExtNotificationRegistrationOptions<A, I>): ExtNotificationHandler =>
  (params) =>
    S.decodeUnknownEffect(payload)(params).pipe(
      Effect.mapError((error) =>
        AcpError.AcpProtocolParseError.fromSchemaError("decode-notification-payload", method, error)
      ),
      Effect.flatMap(handler)
    );

interface MakeExtensionRegistrarsOptions {
  readonly extNotificationHandlers: Ref.Ref<HashMap.HashMap<string, ExtNotificationHandler>>;
  readonly extRequestHandlers: Ref.Ref<HashMap.HashMap<string, ExtRequestHandler>>;
  readonly namePrefix: string;
  readonly unknownExtNotificationHandler: Ref.Ref<O.Option<AcpUnknownExtNotificationHandler>>;
  readonly unknownExtRequestHandler: Ref.Ref<O.Option<AcpUnknownExtRequestHandler>>;
}

/**
 * Looks up the extension request handler registered for `method`, falling back to the unknown
 * handler and then to `methodNotFound`.
 */
export const dispatchExtRequest = ({
  extRequestHandlers,
  unknownExtRequestHandler,
}: Pick<MakeExtensionRegistrarsOptions, "extRequestHandlers" | "unknownExtRequestHandler">) => {
  const runUnknown = (method: string, params: unknown, context: AcpRequestContext) =>
    Ref.get(unknownExtRequestHandler).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.fail(AcpError.AcpRequestError.methodNotFound(method)),
          onSome: (handler) => handler(method, params, context),
        })
      )
    );
  return (method: string, params: unknown, context: AcpRequestContext): Effect.Effect<unknown, AcpError.AcpError> =>
    Ref.get(extRequestHandlers).pipe(
      Effect.map((handlers) => HashMap.get(handlers, method)),
      Effect.flatMap(
        O.match({
          onNone: () => runUnknown(method, params, context),
          onSome: (handler) => handler(params, context),
        })
      )
    );
};

export const makeExtensionRegistrars = ({
  extNotificationHandlers,
  extRequestHandlers,
  namePrefix,
  unknownExtNotificationHandler,
  unknownExtRequestHandler,
}: MakeExtensionRegistrarsOptions): AcpExtensionRegistrars => ({
  handleExtNotification: Effect.fn("AcpExtensions.handleExtNotification", { attributes: { "acp.role": namePrefix } })(
    <A, I>(method: string, payload: S.Codec<A, I>, handler: (payload: A) => Effect.Effect<void, AcpError.AcpError>) =>
      Ref.update(extNotificationHandlers, (handlers) =>
        HashMap.set(handlers, method, decodeExtNotificationRegistration({ handler, method, payload }))
      )
  ),
  handleExtRequest: Effect.fn("AcpExtensions.handleExtRequest", { attributes: { "acp.role": namePrefix } })(
    <A, I>(
      method: string,
      payload: S.Codec<A, I>,
      handler: (payload: A, context: AcpRequestContext) => Effect.Effect<unknown, AcpError.AcpError>
    ) =>
      Ref.update(extRequestHandlers, (handlers) =>
        HashMap.set(handlers, method, decodeExtRequestRegistration({ handler, method, payload }))
      )
  ),
  handleUnknownExtNotification: Effect.fn("AcpExtensions.handleUnknownExtNotification", {
    attributes: { "acp.role": namePrefix },
  })((handler: AcpUnknownExtNotificationHandler) => Ref.set(unknownExtNotificationHandler, O.some(handler))),
  handleUnknownExtRequest: Effect.fn("AcpExtensions.handleUnknownExtRequest", {
    attributes: { "acp.role": namePrefix },
  })((handler: AcpUnknownExtRequestHandler) => Ref.set(unknownExtRequestHandler, O.some(handler))),
});
