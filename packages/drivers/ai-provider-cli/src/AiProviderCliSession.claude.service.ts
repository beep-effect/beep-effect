/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Queue from "effect/Queue";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ManagedSessionEvent, ManagedSessionIdentity, ManagedTurnResult } from "./AiProviderCliSession.models.ts";
import { encodeJson, failure, transportFailure } from "./AiProviderCliSession.profile.service.ts";
import {
  ClaudeControl,
  ClaudeEnvelope,
  ClaudeHandshake,
  ClaudeInit,
  ClaudeResult,
  MessagingToolName,
} from "./AiProviderCliSession.wire.models.ts";
import type { ManagedSessionError } from "./AiProviderCliSession.errors.ts";
import type { ManagedLaunchProfile, ManagedSessionMessage } from "./AiProviderCliSession.models.ts";
import type { ManagedSession } from "./AiProviderCliSession.service.ts";

/**
 * Opens a scoped Claude stream with isolated settings and explicit messaging tools.
 *
 * **Example** (Compose an owned Claude launch)
 * ```ts
 * import { openClaude } from "../../src/AiProviderCliSession.claude.service.ts"
 * import * as Effect from "effect/Effect"
 * import { ManagedLaunchProfile } from "@beep/ai-provider-cli"
 * const profile = ManagedLaunchProfile.make({
 *   provider: "claude", executable: "claude", prefixArgs: [],
 *   workspace: "/owned/workspace", profileRoot: "/owned/profile",
 *   env: { HOME: "/owned/profile" }, authLane: "existing-subscription", tools: []
 * })
 * const operation = openClaude(profile)
 * console.log(Effect.isEffect(operation)) // true; no process or filesystem effect runs
 * ```
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const openClaude = Effect.fn("AiProviderCliSession.openClaude")(function* (profile: ManagedLaunchProfile) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;
  const sessionId = yield* crypto.randomUUIDv4.pipe(transportFailure("session-id"));
  const tools = R.fromEntries(
    A.map(profile.tools, (tool) => [tool.name, { command: tool.command, args: tool.args, env: tool.env }])
  );
  const mcpConfig = yield* encodeJson({ mcpServers: tools }).pipe(transportFailure("tool-config"));
  const settings = yield* encodeJson({ claudeMdExcludes: ["**"], autoMemoryEnabled: false }).pipe(
    transportFailure("tool-config")
  );
  yield* fs.makeDirectory(profile.profileRoot, { recursive: true }).pipe(transportFailure("prepare-profile"));
  const mcpConfigPath = path.join(profile.profileRoot, "managed-mcp.json");
  if (yield* fs.exists(mcpConfigPath).pipe(transportFailure("prepare-profile")))
    return yield* failure.make("open", "invalid-profile", "Owned Claude MCP config already exists");
  yield* fs
    .writeFileString(mcpConfigPath, mcpConfig, { mode: 0o600, flag: "wx" })
    .pipe(
      Effect.mapError(() =>
        failure.make(
          "tool-config",
          "invalid-profile",
          "Owned Claude MCP configuration could not be created exclusively"
        )
      )
    );
  const handle = yield* ChildProcess.make(
    profile.executable,
    [
      ...profile.prefixArgs,
      "--restricted",
      "--setting-sources",
      "",
      "--settings",
      settings,
      "--strict-mcp-config",
      "--mcp-config",
      mcpConfigPath,
      "--session-id",
      sessionId,
      ...A.flatMap(profile.tools, (server) => [
        "--allowedTools",
        pipe(
          A.map(MessagingToolName.literals, (name) => `mcp__${server.name}__${name}`),
          A.join(",")
        ),
      ]),
      "--disable-slash-commands",
      "--tools",
      "",
      "--permission-mode",
      "dontAsk",
      "--permission-prompts",
      "none",
      "--no-session-persistence",
      "--no-chrome",
      "--model",
      "claude-opus-5-5",
      "--effort",
      "medium",
      "--print",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--replay-user-messages",
    ],
    {
      cwd: profile.workspace,
      env: profile.env,
      extendEnv: false,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      forceKillAfter: Duration.seconds(3),
    }
  ).pipe(transportFailure("spawn"));
  const outbound = yield* Queue.bounded<string>(16);
  const events = yield* PubSub.sliding<ManagedSessionEvent>(128);
  const ready = yield* Deferred.make<void, ManagedSessionError>();
  const active = yield* Ref.make(O.none<Deferred.Deferred<ManagedTurnResult, ManagedSessionError>>());
  const messageId = yield* Ref.make("");
  const verified = yield* Ref.make(false);
  const closed = yield* Ref.make(false);
  const lock = yield* Semaphore.make(1);
  const publish = (kind: ManagedSessionEvent["kind"]) =>
    PubSub.publish(events, ManagedSessionEvent.make({ kind, payload: {} })).pipe(Effect.asVoid);
  const send = (value: unknown) =>
    encodeJson(value).pipe(
      transportFailure("encode"),
      Effect.flatMap((line) => Queue.offer(outbound, Str.concat("\n")(line))),
      Effect.asVoid
    );
  const failPending = Effect.fn("ManagedClaude.failPending")(function* (error: ManagedSessionError) {
    yield* Deferred.fail(ready, error);
    const pending = yield* Ref.get(active);
    if (O.isSome(pending)) yield* Deferred.fail(pending.value, error);
  });
  yield* Stream.fromQueue(outbound).pipe(
    Stream.encodeText,
    Stream.run(handle.stdin),
    transportFailure("write"),
    Effect.onError(() => failPending(failure.make("write", "transport", "Claude input transport failed"))),
    Effect.forkChild
  );
  yield* handle.stderr.pipe(Stream.runDrain, Effect.forkChild);
  const decoder = yield* Effect.sync(() => RpcSerialization.makeNdjson({ maxBufferSize: 1048576 }).makeUnsafe());
  const verifyInitialization = Effect.fn("ManagedClaude.verifyInitialization")(function* (payload: unknown) {
    const init = S.decodeUnknownOption(ClaudeInit)(payload);
    if (O.isSome(init) && init.value.session_id === sessionId) return yield* Ref.set(verified, true);
    if (S.is(S.Struct({ subtype: S.Literal("init") }))(payload))
      yield* failPending(
        failure.make("prompt", "policy-mismatch", "Claude runtime model or permission readback failed")
      );
  });
  const completeResult = Effect.fn("ManagedClaude.completeResult")(function* (result: ClaudeResult) {
    const pending = yield* Ref.get(active);
    if (O.isNone(pending)) return;
    if (!(yield* Ref.get(verified)) || result.session_id !== sessionId)
      return yield* Deferred.fail(
        pending.value,
        failure.make("prompt", "policy-mismatch", "Claude response arrived without verified runtime initialization")
      ).pipe(Effect.asVoid);
    if (result.is_error || result.subtype !== "success")
      return yield* Deferred.fail(
        pending.value,
        failure.make("prompt", "provider-failure", "Claude turn returned a non-success terminal receipt")
      ).pipe(Effect.asVoid);
    yield* Deferred.succeed(
      pending.value,
      ManagedTurnResult.make({
        messageId: yield* Ref.get(messageId),
        text: result.result ?? "",
        stopReason: "completed",
      })
    );
  });
  const receive = Effect.fn("ManagedClaude.receive")(function* (payload: unknown) {
    if (O.isSome(S.decodeUnknownOption(ClaudeHandshake)(payload)))
      return yield* Deferred.succeed(ready, undefined).pipe(Effect.asVoid);
    const envelope = S.decodeUnknownOption(ClaudeEnvelope)(payload);
    if (O.isNone(envelope)) return;
    if (envelope.value.type === "system") yield* verifyInitialization(payload);
    const control = S.decodeUnknownOption(ClaudeControl)(payload);
    if (O.isSome(control)) {
      yield* send({
        type: "control_response",
        response: {
          subtype: "error",
          request_id: control.value.request_id,
          error: "Operation not granted by managed runtime",
        },
      });
      yield* publish("permission-refused");
    }
    const result = S.decodeUnknownOption(ClaudeResult)(payload);
    if (O.isSome(result)) yield* completeResult(result.value);
    yield* publish("update");
  });
  yield* handle.stdout.pipe(
    Stream.mapEffect((bytes) =>
      Effect.try({
        try: () => decoder.decode(bytes),
        catch: () => failure.make("read", "provider-failure", "Claude frame exceeded the bounded NDJSON decoder limit"),
      })
    ),
    Stream.flatMap(Stream.fromIterable),
    Stream.runForEach(receive),
    transportFailure("read"),
    Effect.catch(failPending),
    Effect.ensuring(failPending(failure.make("read", "closed", "Claude stream closed before terminal receipt"))),
    Effect.forkChild
  );
  const close = Effect.gen(function* () {
    if (!(yield* Ref.getAndSet(closed, true))) {
      yield* failPending(failure.make("close", "closed", "Owned Claude runtime closed"));
      yield* handle.kill({ forceKillAfter: Duration.seconds(3) }).pipe(transportFailure("close"));
      yield* publish("closed");
    }
  });
  yield* Effect.addFinalizer(() => close.pipe(Effect.ignore));
  yield* send({ type: "control_request", request_id: "beep-initialize", request: { subtype: "initialize" } });
  yield* Deferred.await(ready).pipe(
    Effect.timeoutOrElse({
      duration: Duration.seconds(30),
      orElse: () => Effect.fail(failure.make("open", "timeout", "Claude initialization deadline elapsed")),
    })
  );
  const prompt = Effect.fn("ManagedClaude.prompt")(function* (message: ManagedSessionMessage) {
    if (yield* Ref.get(closed)) return yield* failure.make("prompt", "closed", "Owned runtime is closed");
    const pending = yield* Deferred.make<ManagedTurnResult, ManagedSessionError>();
    yield* Ref.set(active, O.some(pending));
    yield* Ref.set(messageId, message.messageId);
    yield* send({ type: "user", message: { role: "user", content: message.text } });
    return yield* Deferred.await(pending).pipe(
      Effect.timeoutOrElse({
        duration: Duration.minutes(2),
        orElse: () =>
          Effect.fail(failure.make("prompt", "timeout", "Claude terminal receipt deadline elapsed; reconcile outcome")),
      }),
      Effect.onError(() => close.pipe(Effect.ignore)),
      Effect.ensuring(Ref.set(active, O.none()))
    );
  });
  return {
    identity: ManagedSessionIdentity.make({
      provider: "claude",
      sessionId,
      model: "claude-opus-5-5",
      effort: "medium",
      policy: "dontAsk/restricted/context-excluded/scoped-mcp-allowlist/builtins-denied",
      policyEvidence: "launch-enforced",
    }),
    events: Stream.fromPubSub(events),
    prompt: Effect.fn("ManagedClaude.submit")(function* (message: ManagedSessionMessage) {
      if (O.isSome(yield* Ref.get(active))) yield* publish("deferred");
      return yield* prompt(message).pipe(Semaphore.withPermits(lock, 1));
    }),
    cancel: send({ type: "control_request", request_id: "beep-interrupt", request: { subtype: "interrupt" } }),
    steer: () =>
      Effect.fail(failure.make("steer", "unsupported", "Claude active steering is not qualified on this route")),
    close,
  } satisfies ManagedSession;
});
