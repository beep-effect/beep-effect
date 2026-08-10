import { Effect, HashMap, Ref, SchemaIssue } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as AcpSchema from "../_generated/schema.gen.ts";
import * as AcpError from "../Acp.errors.ts";
import type { RpcClientError } from "effect/unstable/rpc";
import type {
  AcpExtensionRegistrars,
  AcpUnknownExtNotificationHandler,
  AcpUnknownExtRequestHandler,
} from "../AcpProtocol.service.ts";

const isAcpProtocolError = S.is(AcpSchema.Error);
const formatSchemaIssue = SchemaIssue.makeFormatterDefault();

export const callRpc = <A>(
  effect: Effect.Effect<A, RpcClientError.RpcClientError | AcpSchema.Error>
): Effect.Effect<A, AcpError.AcpError> =>
  effect.pipe(
    Effect.catchTag("RpcClientError", (error) =>
      Effect.fail(
        AcpError.AcpTransportError.make({
          detail: error.message,
          cause: O.some(error),
        })
      )
    ),
    Effect.catchIf(isAcpProtocolError, (error) => Effect.fail(AcpError.AcpRequestError.fromProtocolError(error)))
  );

interface RunHandlerOptions<A, B> {
  readonly handler: ((payload: A) => Effect.Effect<B, AcpError.AcpError>) | undefined;
  readonly method: string;
  readonly payload: A;
}

interface DecodeExtRequestRegistrationOptions<A, I> {
  readonly handler: (payload: A) => Effect.Effect<unknown, AcpError.AcpError>;
  readonly method: string;
  readonly payload: S.Codec<A, I>;
}

interface DecodeExtNotificationRegistrationOptions<A, I> {
  readonly handler: (payload: A) => Effect.Effect<void, AcpError.AcpError>;
  readonly method: string;
  readonly payload: S.Codec<A, I>;
}

type ExtRequestHandler = (params: unknown) => Effect.Effect<unknown, AcpError.AcpError>;
type ExtNotificationHandler = (params: unknown) => Effect.Effect<void, AcpError.AcpError>;

interface MakeExtensionRegistrarsOptions {
  readonly extNotificationHandlers: Ref.Ref<HashMap.HashMap<string, ExtNotificationHandler>>;
  readonly extRequestHandlers: Ref.Ref<HashMap.HashMap<string, ExtRequestHandler>>;
  readonly namePrefix: string;
  readonly unknownExtNotificationHandler: Ref.Ref<O.Option<AcpUnknownExtNotificationHandler>>;
  readonly unknownExtRequestHandler: Ref.Ref<O.Option<AcpUnknownExtRequestHandler>>;
}

export const runHandler = Effect.fnUntraced(function* <A, B>({ handler, method, payload }: RunHandlerOptions<A, B>) {
  if (handler === undefined) {
    return yield* Effect.fail(AcpError.AcpRequestError.methodNotFound(method).toProtocolError());
  }
  return yield* handler(payload).pipe(
    Effect.mapError((error) =>
      AcpError.AcpRequestError.is(error)
        ? error.toProtocolError()
        : AcpError.AcpRequestError.internalError(error.message).toProtocolError()
    )
  );
});

function decodeExtRequestRegistration<A, I>({ handler, method, payload }: DecodeExtRequestRegistrationOptions<A, I>) {
  return (params: unknown): Effect.Effect<unknown, AcpError.AcpError> =>
    S.decodeUnknownEffect(payload)(params).pipe(
      Effect.mapError((error) => {
        // The JSON-RPC error `data` field is wire JSON (the generated Error
        // schema validates it as S.Json), so carry the rendered issue rather
        // than the live SchemaIssue object, which is not a JSON value.
        const rendered = formatSchemaIssue(error.issue);
        return AcpError.AcpRequestError.invalidParams(`Invalid ${method} payload: ${rendered}`, {
          issue: rendered,
        });
      }),
      Effect.flatMap(handler)
    );
}

function decodeExtNotificationRegistration<A, I>({
  handler,
  method,
  payload,
}: DecodeExtNotificationRegistrationOptions<A, I>) {
  return (params: unknown): Effect.Effect<void, AcpError.AcpError> =>
    S.decodeUnknownEffect(payload)(params).pipe(
      Effect.mapError((error) =>
        AcpError.AcpProtocolParseError.make({
          detail: `Invalid ${method} notification payload: ${formatSchemaIssue(error.issue)}`,
          cause: O.some(error),
        })
      ),
      Effect.flatMap(handler)
    );
}

export const makeExtensionRegistrars = ({
  extNotificationHandlers,
  extRequestHandlers,
  namePrefix,
  unknownExtNotificationHandler,
  unknownExtRequestHandler,
}: MakeExtensionRegistrarsOptions): AcpExtensionRegistrars => ({
  handleExtNotification: Effect.fn(`${namePrefix}_handleExtNotification`)(
    <A, I>(method: string, payload: S.Codec<A, I>, handler: (payload: A) => Effect.Effect<void, AcpError.AcpError>) =>
      Ref.update(extNotificationHandlers, (handlers) =>
        HashMap.set(handlers, method, decodeExtNotificationRegistration({ handler, method, payload }))
      )
  ),
  handleExtRequest: Effect.fn(`${namePrefix}_handleExtRequest`)(
    <A, I>(
      method: string,
      payload: S.Codec<A, I>,
      handler: (payload: A) => Effect.Effect<unknown, AcpError.AcpError>
    ) =>
      Ref.update(extRequestHandlers, (handlers) =>
        HashMap.set(handlers, method, decodeExtRequestRegistration({ handler, method, payload }))
      )
  ),
  handleUnknownExtNotification: Effect.fn(`${namePrefix}_handleUnknownExtNotification`)(
    (handler: AcpUnknownExtNotificationHandler) => Ref.set(unknownExtNotificationHandler, O.some(handler))
  ),
  handleUnknownExtRequest: Effect.fn(`${namePrefix}_handleUnknownExtRequest`)((handler: AcpUnknownExtRequestHandler) =>
    Ref.set(unknownExtRequestHandler, O.some(handler))
  ),
});
