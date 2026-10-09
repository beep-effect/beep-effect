/**
 * Owned-thread T3 legacy MCP transport.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $T3CodeId } from "@beep/identity/packages";
import { decodeHttpMessages, JsonRpcMessage } from "@beep/mcp-kit/client";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { T3CodeError } from "./T3Code.errors.ts";
import {
  T3CodeConfiguration,
  T3CodeInterrupt,
  T3CodeProject,
  T3CodeRead,
  T3CodeSend,
  T3CodeWait,
} from "./T3Code.models.ts";

const $I = $T3CodeId.create("T3Code.service");
const LoopbackUrl = S.String.check(S.isPattern(/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/mcp$/));
const Identifier = S.NonEmptyString.check(S.isMaxLength(512));
const RequestKey = S.NonEmptyString.check(S.isMaxLength(256));
const Prompt = S.NonEmptyString.check(S.isMaxLength(120000));
const Timeout = S.Int.check(S.isBetween({ minimum: 1, maximum: 120000 }));
const decodeIdentifier = S.decodeUnknownEffect(Identifier);
const decodePrompt = S.decodeUnknownEffect(Prompt);
const decodeRequestKey = S.decodeUnknownEffect(RequestKey);
const decodeTimeout = S.decodeUnknownEffect(Timeout);
const PROTOCOL = "2025-06-18";
const BODY_LIMIT = 2 * 1024 * 1024;

/**
 * Explicit loopback transport configuration with a redacted approved credential.
 * **Example** (Create a local transport configuration)
 * ```ts
 * import { T3CodeConfig } from "@beep/t3-code"
 * import * as Redacted from "effect/Redacted"
 * console.log(T3CodeConfig.make({ url: "http://127.0.0.1:3773/mcp", bearer: Redacted.make("fixture"), timeoutMs: 30000 }).url)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export class T3CodeConfig extends S.Class<T3CodeConfig>($I`T3CodeConfig`)(
  { url: LoopbackUrl, bearer: S.Redacted(S.NonEmptyString), timeoutMs: Timeout },
  $I.annote("T3CodeConfig", { description: "Approved loopback T3 credential and bounded transport deadline." })
) {}
const decodeConfig = S.decodeUnknownEffect(T3CodeConfig);

class InitializeResult extends S.Class<InitializeResult>($I`InitializeResult`)(
  { protocolVersion: S.Literal(PROTOCOL) },
  $I.annote("InitializeResult", { description: "Required installed T3 MCP revision." })
) {}
class TextContent extends S.Class<TextContent>($I`TextContent`)(
  { type: S.Literal("text"), text: S.String },
  $I.annote("TextContent", { description: "Tool JSON fallback content." })
) {}
class ToolResult extends S.Class<ToolResult>($I`ToolResult`)(
  {
    isError: S.optionalKey(S.Boolean),
    structuredContent: S.optionalKey(S.Unknown),
    content: TextContent.pipe(S.Array, S.optionalKey),
  },
  $I.annote("ToolResult", { description: "Minimal MCP tool response envelope." })
) {}
const isT3CodeError = S.is(T3CodeError);
const decodeToolResult = S.decodeUnknownEffect(ToolResult);
const decodeJson = S.decodeEffect(S.fromJsonString(S.Unknown));
const decodeInitialize = S.decodeUnknownEffect(InitializeResult);

interface Operations {
  readonly interruptExactRun: (
    threadId: string,
    runId: string,
    clientRequestId: string
  ) => Effect.Effect<T3CodeInterrupt, T3CodeError>;
  readonly read: (threadId: string) => Effect.Effect<T3CodeRead, T3CodeError>;
  readonly readConfiguration: (threadId: string) => Effect.Effect<T3CodeConfiguration, T3CodeError>;
  readonly readProject: (projectId: string) => Effect.Effect<T3CodeProject, T3CodeError>;
  readonly sendQueued: (
    threadId: string,
    message: string,
    clientRequestId: string
  ) => Effect.Effect<T3CodeSend, T3CodeError>;
  readonly waitExactRun: (threadId: string, runId: string, timeoutMs: number) => Effect.Effect<T3CodeWait, T3CodeError>;
}
const failure = (operation: string, reason: T3CodeError["reason"], mutating = false) =>
  T3CodeError.make({ operation, reason, submission: mutating ? "possibly-submitted" : "not-submitted" });
const invalid = (operation: string) => failure(operation, "invalid-input");

const make = Effect.fn("T3Code.make")(function* (input: T3CodeConfig) {
  const config = yield* decodeConfig(input).pipe(Effect.mapError(() => invalid("initialize")));
  const client = yield* HttpClient.HttpClient;
  const nextId = yield* Ref.make(0);
  const session = yield* Ref.make<O.Option<string>>(O.none());
  const exchange = Effect.fn("T3Code.exchange")(
    function* (frame: JsonRpcMessage, operation: string, mutating: boolean, _deadlineMs: number) {
      const sessionId = yield* Ref.get(session);
      const headers = {
        authorization: `Bearer ${Redacted.value(config.bearer)}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": PROTOCOL,
        ...O.getSomesStruct({ "mcp-session-id": sessionId }),
      };
      const response = yield* client
        .execute(
          HttpClientRequest.post(config.url).pipe(
            HttpClientRequest.setHeaders(headers),
            HttpClientRequest.bodyJsonUnsafe(frame)
          )
        )
        .pipe(Effect.mapError(() => failure(operation, "transport", mutating)));
      if (response.status < 200 || response.status >= 300) return yield* failure(operation, "http", mutating);
      if (response.status === 202 || response.status === 204)
        return { messages: [], sessionId: response.headers["mcp-session-id"] };
      const body = yield* response.stream.pipe(
        Stream.mapAccumEffect(
          () => 0,
          (count, chunk) => {
            const total = count + chunk.byteLength;
            return total > BODY_LIMIT
              ? Effect.fail(failure(operation, "body-limit", mutating))
              : Effect.succeed<readonly [number, ReadonlyArray<Uint8Array>]>([total, [chunk]]);
          }
        ),
        Stream.decodeText,
        Stream.runFold(
          () => "",
          (text, chunk) => text + chunk
        ),
        Effect.mapError((error) => (isT3CodeError(error) ? error : failure(operation, "transport", mutating)))
      );
      const messages = yield* decodeHttpMessages(body, response.headers["content-type"] ?? "").pipe(
        Effect.mapError(() => failure(operation, "protocol", mutating))
      );
      return { messages, sessionId: response.headers["mcp-session-id"] };
    },
    (effect, _frame, operation, mutating, deadlineMs) =>
      effect.pipe(
        Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
        Effect.timeoutOrElse({
          duration: Duration.millis(deadlineMs),
          orElse: () => Effect.fail(failure(operation, "timeout", mutating)),
        }),
        Effect.scoped
      )
  );
  const rpc = Effect.fn("T3Code.rpc")(function* (
    method: string,
    params: unknown,
    operation: string,
    mutating = false,
    deadlineMs = config.timeoutMs
  ) {
    const id = yield* Ref.updateAndGet(nextId, (value) => value + 1);
    const received = yield* exchange(JsonRpcMessage.make({ id, method, params }), operation, mutating, deadlineMs);
    const replies = A.filter(received.messages, (message) => message.id === id && message.method === undefined);
    if (replies.length !== 1) return yield* failure(operation, "protocol", mutating);
    const matched = A.head(replies);
    if (O.isNone(matched)) return yield* failure(operation, "protocol", mutating);
    const reply = matched.value;
    if (reply.error !== undefined) return yield* failure(operation, "remote-error", mutating);
    if (reply.result === undefined) return yield* failure(operation, "protocol", mutating);
    return { value: reply.result, sessionId: received.sessionId };
  });
  const initialized = yield* rpc(
    "initialize",
    { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "beep-t3-code", version: "0.0.0" } },
    "initialize"
  );
  yield* decodeInitialize(initialized.value).pipe(Effect.mapError(() => failure("initialize", "protocol")));
  if (initialized.sessionId === undefined || initialized.sessionId === "")
    return yield* failure("initialize", "protocol");
  yield* Ref.set(session, O.some(initialized.sessionId));
  const notification = yield* exchange(
    JsonRpcMessage.make({ method: "notifications/initialized" }),
    "initialize",
    false,
    config.timeoutMs
  );
  if (notification.messages.length !== 0) return yield* failure("initialize", "protocol");

  const call = Effect.fn("T3Code.call")(function* <Value>(
    name: string,
    args: unknown,
    schema: S.Codec<Value, unknown>,
    operation: string,
    mutating = false,
    deadlineMs = config.timeoutMs
  ) {
    const response = yield* rpc("tools/call", { name, arguments: args }, operation, mutating, deadlineMs);
    const envelope = yield* decodeToolResult(response.value).pipe(
      Effect.mapError(() => failure(operation, "protocol", mutating))
    );
    if (envelope.isError === true) return yield* failure(operation, "tool-error", mutating);
    const first = A.head(envelope.content ?? []);
    if (envelope.structuredContent === undefined && O.isNone(first))
      return yield* failure(operation, "protocol", mutating);
    const raw =
      envelope.structuredContent !== undefined
        ? envelope.structuredContent
        : yield* O.match(first, {
            onNone: () => Effect.fail(failure(operation, "protocol", mutating)),
            onSome: (content) =>
              decodeJson(content.text).pipe(Effect.mapError(() => failure(operation, "protocol", mutating))),
          });
    return yield* S.decodeUnknownEffect(schema)(raw).pipe(
      Effect.mapError(() => failure(operation, "protocol", mutating))
    );
  });
  const threadInput = (id: string, operation: string) =>
    decodeIdentifier(id).pipe(Effect.mapError(() => invalid(operation)));
  const correlated = <Value extends { readonly threadId: string }>(
    value: Value,
    threadId: string,
    operation: string,
    mutating = false
  ) =>
    value.threadId === threadId
      ? Effect.succeed(value)
      : Effect.fail(failure(operation, "identity-mismatch", mutating));
  return {
    readConfiguration: Effect.fn("T3Code.readConfiguration")(function* (threadId: string) {
      yield* threadInput(threadId, "configuration");
      return yield* correlated(
        yield* call("t3_thread_configuration", { threadId }, T3CodeConfiguration, "configuration"),
        threadId,
        "configuration"
      );
    }),
    readProject: Effect.fn("T3Code.readProject")(function* (projectId: string) {
      yield* threadInput(projectId, "project");
      const value = yield* call("t3_project_read", { projectId }, T3CodeProject, "project");
      return value.id === projectId ? value : yield* failure("project", "identity-mismatch");
    }),
    read: Effect.fn("T3Code.read")(function* (threadId: string) {
      yield* threadInput(threadId, "read");
      const value = yield* call(
        "t3_thread_read",
        { threadId, view: "messages", limit: 100, runLimit: 50, maxCharsPerItem: 20000 },
        T3CodeRead,
        "read"
      );
      yield* correlated(value.thread, threadId, "read");
      return value;
    }),
    sendQueued: Effect.fn("T3Code.sendQueued")(function* (threadId: string, message: string, clientRequestId: string) {
      yield* threadInput(threadId, "send");
      yield* decodePrompt(message).pipe(Effect.mapError(() => invalid("send")));
      yield* decodeRequestKey(clientRequestId).pipe(Effect.mapError(() => invalid("send")));
      return yield* correlated(
        yield* call("t3_thread_send", { threadId, message, clientRequestId, mode: "queue" }, T3CodeSend, "send", true),
        threadId,
        "send",
        true
      );
    }),
    waitExactRun: Effect.fn("T3Code.waitExactRun")(function* (threadId: string, runId: string, timeoutMs: number) {
      yield* threadInput(threadId, "wait");
      yield* threadInput(runId, "wait");
      yield* decodeTimeout(timeoutMs).pipe(Effect.mapError(() => invalid("wait")));
      const value = yield* correlated(
        yield* call(
          "t3_thread_wait",
          { threadId, runId, timeoutMs },
          T3CodeWait,
          "wait",
          false,
          timeoutMs + config.timeoutMs
        ),
        threadId,
        "wait"
      );
      return value.runId === runId ? value : yield* failure("wait", "identity-mismatch");
    }),
    interruptExactRun: Effect.fn("T3Code.interruptExactRun")(function* (
      threadId: string,
      runId: string,
      clientRequestId: string
    ) {
      yield* threadInput(threadId, "interrupt");
      yield* threadInput(runId, "interrupt");
      yield* decodeRequestKey(clientRequestId).pipe(Effect.mapError(() => invalid("interrupt")));
      const value = yield* correlated(
        yield* call("t3_thread_interrupt", { threadId, runId, clientRequestId }, T3CodeInterrupt, "interrupt", true),
        threadId,
        "interrupt",
        true
      );
      return value.runId === runId ? value : yield* failure("interrupt", "identity-mismatch", true);
    }),
  } satisfies Operations;
});

/**
 * Narrow external T3 connection for exact owned threads; sends never retry.
 * **Gotchas**
 * Host configuration readback is not native policy attestation or an atomic
 * compare-and-send fence. The caller owns enrollment and drift reconciliation.
 * Supply a nonredirecting HTTP client; the Fetch client is forced to manual redirects.
 * **Example** (Describe an isolated connection)
 * ```ts
 * import { T3Code, T3CodeConfig } from "@beep/t3-code"
 * import * as Layer from "effect/Layer"
 * import * as Redacted from "effect/Redacted"
 * const config = T3CodeConfig.make({ url: "http://127.0.0.1:3773/mcp", bearer: Redacted.make("fixture"), timeoutMs: 30000 })
 * console.log(Layer.isLayer(T3Code.layer(config)))
 * ```
 * @category services
 * @since 0.0.0
 */
export class T3Code extends Context.Service<T3Code, Operations>()($I`T3Code`) {
  static readonly layer = (config: T3CodeConfig) => Layer.effect(T3Code, make(config));
}
