/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Client as AcpClient, Errors as AcpErrors } from "@beep/acp";
import { $AiProviderCliId } from "@beep/identity";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { codexArguments, negotiateCodex } from "./AiProviderCliSession.codex.service.ts";
import { cursorArguments, verifyCursor } from "./AiProviderCliSession.cursor.service.ts";
import { grokArguments, verifyGrok } from "./AiProviderCliSession.grok.service.ts";
import { ManagedSessionEvent, ManagedTurnResult } from "./AiProviderCliSession.models.ts";
import { failure, transportFailure } from "./AiProviderCliSession.profile.service.ts";
import {
  AcpText,
  CodexComplete,
  CodexItem,
  CodexStart,
  CodexTurn,
  MessagingToolName,
} from "./AiProviderCliSession.wire.models.ts";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type * as Scope from "effect/Scope";
import type { ManagedSessionError } from "./AiProviderCliSession.errors.ts";
import type {
  ManagedLaunchProfile,
  ManagedSessionMessage,
  ManagedSessionSteering,
} from "./AiProviderCliSession.models.ts";
import type { ManagedSession } from "./AiProviderCliSession.service.ts";

const $I = $AiProviderCliId.create("AiProviderCliSession.stdio.service");
const OfferedTool = S.Struct({ tool_name: S.String }).annotate(
  $I.annote("OfferedTool", { description: "Partial native permission request carrying the offered tool name." })
);
const SteeredTurn = S.Struct({ turnId: S.NonEmptyString }).annotate(
  $I.annote("SteeredTurn", { description: "Native steering receipt identifying the accepted active turn." })
);
const decodeOfferedTool = S.decodeUnknownOption(OfferedTool);
const decodeSteeredTurn = S.decodeUnknownEffect(SteeredTurn);

/**
 * Opens a scoped native stdio session with bounded requests and turn correlation.
 *
 * **Example** (Compose an owned stdio launch)
 * ```ts
 * import { openStdio } from "../../src/AiProviderCliSession.stdio.service.ts"
 * import * as Effect from "effect/Effect"
 * import { ManagedLaunchProfile } from "@beep/ai-provider-cli"
 * const profile = ManagedLaunchProfile.make({
 *   provider: "codex", executable: "codex", prefixArgs: [],
 *   workspace: "/owned/workspace", profileRoot: "/owned/profile",
 *   env: { HOME: "/owned/profile" }, authLane: "existing-subscription", tools: []
 * })
 * const operation = openStdio(profile, "synthetic-policy-hash")
 * console.log(Effect.isEffect(operation)) // true; no process or filesystem effect runs
 * ```
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const openStdio = Effect.fn("AiProviderCliSession.openStdio")(function* (
  profile: ManagedLaunchProfile,
  sandboxHash: string
): Effect.fn.Return<
  ManagedSession,
  ManagedSessionError,
  Scope.Scope | Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const args =
    profile.provider === "codex"
      ? codexArguments
      : profile.provider === "cursor"
        ? cursorArguments(profile.workspace)
        : grokArguments;
  const handle = yield* ChildProcess.make(profile.executable, [...profile.prefixArgs, ...args], {
    cwd: profile.workspace,
    env: R.map(profile.env, (value) => value),
    extendEnv: false,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    forceKillAfter: Duration.seconds(3),
  }).pipe(transportFailure("spawn"));
  yield* handle.stderr.pipe(Stream.runDrain, Effect.forkChild);
  const context = yield* Layer.build(AcpClient.layerChildProcess({ handle }));
  const client = Context.get(context, AcpClient.AcpClient);
  const events = yield* PubSub.sliding<ManagedSessionEvent>(128);
  const chunks = yield* Ref.make("");
  const overflow = yield* Ref.make(false);
  const appendText = Effect.fn("ManagedSession.appendText")(function* (text: string) {
    const previous = yield* Ref.get(chunks);
    if (Str.length(previous) + Str.length(text) > 1048576) yield* Ref.set(overflow, true);
    else yield* Ref.set(chunks, Str.concat(text)(previous));
  });
  const closed = yield* Ref.make(false);
  const active = yield* Ref.make(O.none<Deferred.Deferred<string, ManagedSessionError>>());
  const lock = yield* Semaphore.make(1);
  const activeTurnId = yield* Ref.make(O.none<string>());
  const hasCompletedTurn = yield* Ref.make(false);
  const earlyItems = yield* Ref.make<ReadonlyArray<CodexItem>>([]);
  const earlyComplete = yield* Ref.make<ReadonlyArray<CodexComplete>>([]);
  const publish = (kind: ManagedSessionEvent["kind"], payload: unknown) =>
    PubSub.publish(events, ManagedSessionEvent.make({ kind, payload })).pipe(Effect.asVoid);
  yield* client.handleUnknownExtRequest(() => Effect.fail(AcpClientError()));
  yield* client.handleRequestPermission(
    Effect.fnUntraced(function* (request) {
      const tool = decodeOfferedTool(request.toolCall.rawInput);
      const allowedNames = MessagingToolName.literals;
      const offered = A.findFirst(request.options, (option) => option.kind === "allow_once");
      if (
        profile.provider === "grok" &&
        request.sessionId === sessionId &&
        O.isSome(tool) &&
        O.isSome(offered) &&
        A.some(profile.tools, (server) =>
          A.some(allowedNames, (name) => tool.value.tool_name === `${server.name}__${name}`)
        )
      )
        return { outcome: { outcome: "selected", optionId: offered.value.optionId } };
      yield* publish("permission-refused", {});
      return { outcome: { outcome: "cancelled" } };
    })
  );
  let sessionId = "";
  yield* client.handleSessionUpdate(
    Effect.fnUntraced(function* (payload) {
      const text = S.decodeUnknownOption(AcpText)(payload);
      if (O.isSome(text) && text.value.sessionId === sessionId) yield* appendText(text.value.update.content.text);
      yield* publish("update", { sessionId });
    })
  );
  const bufferItem = Effect.fn("ManagedSession.bufferItem")(function* (item: CodexItem) {
    const buffered = yield* Ref.get(earlyItems);
    if (A.length(buffered) >= 128) yield* Ref.set(overflow, true);
    else yield* Ref.set(earlyItems, A.append(buffered, item));
  });
  const receiveItem = Effect.fn("ManagedSession.receiveItem")(function* (item: CodexItem) {
    if (item.threadId !== sessionId || O.isNone(yield* Ref.get(active))) return;
    const turn = yield* Ref.get(activeTurnId);
    if (O.isNone(turn)) return yield* bufferItem(item);
    if (turn.value === item.turnId) yield* appendText(item.item.text);
  });
  const bufferCompletion = Effect.fn("ManagedSession.bufferCompletion")(function* (
    complete: CodexComplete,
    pending: Deferred.Deferred<string, ManagedSessionError>
  ) {
    const buffered = yield* Ref.get(earlyComplete);
    if (A.length(buffered) >= 128)
      yield* Deferred.fail(
        pending,
        failure.make("prompt", "provider-failure", "Early completion buffer exceeded its bounded limit")
      );
    else yield* Ref.set(earlyComplete, A.append(buffered, complete));
  });
  const receiveCompletion = Effect.fn("ManagedSession.receiveCompletion")(function* (complete: CodexComplete) {
    if (complete.threadId !== sessionId) return;
    const pending = yield* Ref.get(active);
    if (O.isNone(pending)) return;
    const turn = yield* Ref.get(activeTurnId);
    if (O.isNone(turn)) return yield* bufferCompletion(complete, pending.value);
    if (turn.value === complete.turn.id) yield* Deferred.succeed(pending.value, complete.turn.status);
  });
  yield* client.handleExtNotification(
    "item/completed",
    S.Unknown,
    Effect.fnUntraced(function* (payload) {
      const item = S.decodeUnknownOption(CodexItem)(payload);
      if (O.isSome(item)) yield* receiveItem(item.value);
      yield* publish("update", { sessionId });
    })
  );
  yield* client.handleExtNotification(
    "turn/completed",
    S.Unknown,
    Effect.fnUntraced(function* (payload) {
      const complete = S.decodeUnknownOption(CodexComplete)(payload);
      if (O.isSome(complete)) yield* receiveCompletion(complete.value);
      yield* publish("update", { sessionId });
    })
  );
  const deadline = (operation: string) =>
    Effect.timeoutOrElse({
      duration: Duration.seconds(30),
      orElse: () =>
        Effect.fail(failure.make(operation, "timeout", "Native request deadline elapsed; reconcile before retry")),
    });
  const request = (method: string, payload: unknown) =>
    client.raw.request(method, payload).pipe(transportFailure(method), deadline(method));
  const negotiation = Effect.gen(function* () {
    if (profile.provider === "codex") {
      const identity = yield* negotiateCodex(
        profile,
        request,
        client.raw.notify("initialized", {}).pipe(transportFailure("initialized"))
      );
      sessionId = identity.sessionId;
      return identity;
    }
    yield* client.agent
      .initialize({
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        clientInfo: { name: "beep-managed-session", version: "1" },
      })
      .pipe(transportFailure("initialize"), deadline("initialize"));
    if (profile.provider === "grok")
      yield* client.agent
        .authenticate({ methodId: "cached_token", _meta: { headless: true } })
        .pipe(transportFailure("authenticate"), deadline("authenticate"));
    const started = yield* client.agent
      .createSession({
        cwd: profile.workspace,
        mcpServers: A.map(profile.tools, (tool) => ({
          name: tool.name,
          command: tool.command,
          args: A.fromIterable(tool.args),
          env: A.map(R.toEntries(tool.env), ([name, value]) => ({ name, value })),
        })),
      })
      .pipe(transportFailure("session/new"), deadline("session/new"));
    if (profile.provider === "cursor") {
      const identity = yield* verifyCursor(started);
      sessionId = identity.sessionId;
      yield* client.agent
        .setSessionMode({ sessionId, modeId: "ask" })
        .pipe(transportFailure("session/set_mode"), deadline("session/set_mode"));
      return identity;
    }
    const identity = yield* verifyGrok(started, sandboxHash);
    sessionId = identity.sessionId;
    return identity;
  });
  const identity = yield* negotiation.pipe(
    Effect.onError(() => handle.kill({ forceKillAfter: Duration.seconds(3) }).pipe(Effect.ignore))
  );
  const prompt = Effect.fn("ManagedSession.prompt")(function* (message: ManagedSessionMessage) {
    if (yield* Ref.get(closed)) return yield* failure.make("prompt", "closed", "Owned runtime is closed");
    yield* Ref.set(chunks, "");
    yield* Ref.set(overflow, false);
    yield* Ref.set(earlyItems, []);
    yield* Ref.set(earlyComplete, []);
    const pending = yield* Deferred.make<string, ManagedSessionError>();
    yield* Ref.set(active, O.some(pending));
    const executeTurn = Effect.gen(function* () {
      if (profile.provider !== "codex")
        return (yield* client.agent
          .prompt({ sessionId, prompt: [{ type: "text", text: message.text }] })
          .pipe(transportFailure("prompt"))).stopReason;
      if (yield* Ref.get(hasCompletedTurn)) {
        const resumed = yield* request("thread/resume", {
          threadId: sessionId,
          model: "gpt-6.1-sol",
          allowProviderModelFallback: false,
          sandbox: "read-only",
          approvalPolicy: "never",
          config: { model_reasoning_effort: "medium" },
          excludeTurns: true,
        }).pipe(
          Effect.flatMap(S.decodeUnknownEffect(CodexStart)),
          Effect.mapError(() =>
            failure.make("prompt", "policy-mismatch", "Codex policy readback failed before turn dispatch")
          )
        );
        if (resumed.thread.id !== sessionId)
          return yield* failure.make("prompt", "policy-mismatch", "Codex resumed a different session identity");
      }
      const started = yield* request("turn/start", {
        threadId: sessionId,
        input: [{ type: "text", text: message.text, text_elements: [] }],
        model: "gpt-6.1-sol",
        effort: "medium",
        approvalPolicy: "never",
        sandboxPolicy: { type: "readOnly", networkAccess: false },
        environments: [],
      }).pipe(
        Effect.flatMap(S.decodeUnknownEffect(CodexTurn)),
        Effect.mapError(() => failure.make("prompt", "provider-failure", "Codex turn start failed"))
      );
      yield* Ref.set(activeTurnId, O.some(started.turn.id));
      yield* publish("update", { sessionId, turnId: started.turn.id });
      for (const item of yield* Ref.getAndSet(earlyItems, [])) {
        if (item.turnId === started.turn.id) yield* appendText(item.item.text);
      }
      const completed = A.findFirst(
        yield* Ref.getAndSet(earlyComplete, []),
        (completion) => completion.turn.id === started.turn.id
      );
      if (O.isSome(completed)) yield* Deferred.succeed(pending, completed.value.turn.status);
      return yield* Deferred.await(pending);
    }).pipe(
      Effect.ensuring(Effect.all([Ref.set(active, O.none()), Ref.set(activeTurnId, O.none())], { discard: true })),
      Effect.timeoutOrElse({
        duration: Duration.minutes(2),
        orElse: () =>
          Effect.fail(
            failure.make("prompt", "timeout", "Native turn deadline elapsed; outcome requires reconciliation")
          ),
      })
    );
    const stopReason = yield* executeTurn.pipe(Effect.onError(() => close.pipe(Effect.ignore)));
    if (stopReason === "failed") {
      yield* close.pipe(Effect.ignore);
      return yield* failure.make("prompt", "provider-failure", "Codex turn reported failure");
    }
    yield* Ref.set(hasCompletedTurn, true);
    const text = yield* Ref.get(chunks);
    if (yield* Ref.get(overflow))
      return yield* failure.make("prompt", "provider-failure", "Model response exceeded the 1 MiB collection bound");
    if (Str.includes("Upgrade your plan to continue")(text)) {
      yield* close.pipe(Effect.ignore);
      return yield* failure.make("prompt", "access-blocked", "Existing subscription denied model access");
    }
    return ManagedTurnResult.make({ messageId: message.messageId, text, stopReason });
  });
  const cancel = Effect.gen(function* () {
    if (profile.provider !== "codex")
      return yield* client.agent.cancel({ sessionId }).pipe(transportFailure("cancel"), deadline("cancel"));
    const turn = yield* Ref.get(activeTurnId);
    if (O.isNone(turn)) return;
    yield* request("turn/interrupt", { threadId: sessionId, turnId: turn.value });
  });
  const close = Effect.gen(function* () {
    if (!(yield* Ref.getAndSet(closed, true))) {
      yield* handle.kill({ forceKillAfter: Duration.seconds(3) }).pipe(transportFailure("close"));
      yield* publish("closed", {});
      const pending = yield* Ref.get(active);
      if (O.isSome(pending))
        yield* Deferred.fail(
          pending.value,
          failure.make("prompt", "closed", "Owned runtime closed before terminal receipt")
        );
    }
  });
  yield* Effect.addFinalizer(() => close.pipe(Effect.ignore));
  return {
    identity,
    events: Stream.fromPubSub(events),
    prompt: Effect.fn("ManagedSession.submit")(function* (message: ManagedSessionMessage) {
      if (O.isSome(yield* Ref.get(active))) yield* publish("deferred", { messageId: message.messageId });
      return yield* prompt(message).pipe(Semaphore.withPermits(lock, 1));
    }),
    cancel,
    steer: Effect.fn("ManagedSession.steer")(function* (steering: ManagedSessionSteering) {
      if (yield* Ref.get(closed)) return yield* failure.make("steer", "closed", "Owned runtime is closed");
      if (profile.provider !== "codex")
        return yield* failure.make("steer", "unsupported", "Active steering is not qualified for this provider");
      const turn = yield* Ref.get(activeTurnId);
      if (O.isNone(turn) || turn.value !== steering.expectedTurnId)
        return yield* failure.make("steer", "policy-mismatch", "Steering target is not the owned active turn");
      const response = yield* request("turn/steer", {
        threadId: sessionId,
        expectedTurnId: steering.expectedTurnId,
        input: [{ type: "text", text: steering.message.text, text_elements: [] }],
      }).pipe(Effect.flatMap(decodeSteeredTurn), transportFailure("steer"));
      if (response.turnId !== steering.expectedTurnId)
        return yield* failure.make("steer", "policy-mismatch", "Provider steering response changed turn identity");
    }),
    close,
  };
});

const AcpClientError = () => AcpErrors.AcpRequestError.methodNotFound("ungranted-operation");
