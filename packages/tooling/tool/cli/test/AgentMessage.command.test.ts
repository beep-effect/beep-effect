import { JsonRpcMessage } from "@beep/mcp-kit/client";
import { agentMessageCommand } from "@beep/repo-cli/commands/AgentMessage";
import {
  AgentMessageStore,
  AmbiguityResolution,
  AttachedT3Profile,
  agentMessageStoreLayer,
  EndpointBinding,
  Envelope,
  LaunchGrant,
  Receipt,
} from "@beep/repo-cli/test/AgentMessage";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";

const Json = S.fromJsonString(S.Unknown);
const JsonRpcFrameJson = S.fromJsonString(JsonRpcMessage);
const ToolRequest = S.Struct({ name: S.String });
const BindingJson = S.fromJsonString(EndpointBinding);
const ReceiptJson = S.fromJsonString(Receipt);
const encodeJson = S.encodeEffect(Json);
const decodeJson = S.decodeEffect(Json);
const runCommand = Command.runWith(agentMessageCommand, { version: "test", renderErrors: false });

const run = Effect.fn("AgentMessageCommandTest.run")(function* (args: ReadonlyArray<string>) {
  const before = A.length(yield* TestConsole.logLines);
  yield* runCommand(args);
  return yield* Effect.forEach(A.filter(A.drop(yield* TestConsole.logLines, before), P.isString), (line) =>
    decodeJson(line)
  );
});

const setup = Effect.fn("AgentMessageCommandTest.setup")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-message-command-" }));
  yield* fs.chmod(directory, 0o700);
  const stateDir = path.join(directory, "state");
  const now = yield* Clock.currentTimeMillis;
  const write = Effect.fn("AgentMessageCommandTest.write")(function* (name: string, value: unknown) {
    const filename = path.join(directory, name);
    yield* fs.writeFileString(filename, yield* encodeJson(value), { mode: 0o600 });
    return filename;
  });
  const binding = (id: string) =>
    S.decodeEffect(EndpointBinding)({
      endpointId: id,
      participantId: id,
      sessionId: `${id}-session`,
      ownerId: `${id}-owner`,
      generation: 1,
      repositoryScope: "fixture-repository",
      capabilityFingerprint: "cap",
      policyFingerprint: "policy",
      supported: true,
      capabilityEvidence: [
        { capability: "send", disposition: "verified", source: "injected CLI fixture", observedAt: now },
      ],
      policy: {
        provider: "injected",
        modelId: "fixture",
        effort: "medium",
        sandbox: "no-tools",
        approvalPolicy: "never",
        fingerprint: "policy",
        policyEvidence: "launch-enforced",
      },
    });
  const a = yield* binding("a");
  const b = yield* binding("b");
  const aFile = yield* write("a.json", yield* S.encodeEffect(EndpointBinding)(a));
  const bFile = yield* write("b.json", yield* S.encodeEffect(EndpointBinding)(b));
  const execute = (args: ReadonlyArray<string>) => run([...args, "--state-dir", stateDir]);
  expect(yield* execute(["register", "--file", aFile])).toEqual([{ registered: "a", generation: 1 }]);
  expect(yield* execute(["register", "--file", bFile])).toEqual([{ registered: "b", generation: 1 }]);
  const context = yield* agentMessageStoreLayer(stateDir).pipe(Layer.build);
  const store = yield* AgentMessageStore.pipe(Effect.provide(context));
  const envelope = (id: string, from = "a", to = "b", replyTo = O.none<string>()) =>
    Envelope.make({
      messageId: id,
      idempotencyKey: id,
      conversationId: "conversation",
      from,
      to: { kind: "direct", endpointId: to },
      repositoryScope: "fixture-repository",
      body: `bounded ${id}`,
      createdAt: now,
      expiresAt: now + 60000,
      capabilityFingerprint: "cap",
      policyFingerprint: "policy",
      replyTo,
    });
  const grant = (id: string) =>
    LaunchGrant.make({
      grantId: `grant-${id}`,
      endpointId: id,
      generation: 1,
      ownerId: `${id}-owner`,
      repositoryScope: "fixture-repository",
      conversationScope: O.some("conversation"),
      allowedRecipients: [id === "a" ? "b" : "a"],
      expiresAt: now + 60000,
      maxMessages: 2,
    });
  return { fs, path, directory, stateDir, now, write, execute, store, envelope, grant, a, b };
});

const attachedFixture = Effect.fn("AgentMessageCommandTest.attachedFixture")(function* (
  f: Effect.Success<ReturnType<typeof setup>>,
  provider: AttachedT3Profile["provider"] = "codex"
) {
  const configuration = yield* S.decodeEffect(AttachedT3Profile.fields.expectedConfiguration)({
    threadId: "owned-thread",
    modelSelection: {
      instanceId: provider,
      model: provider === "codex" ? "gpt-6.1-sol" : "claude-opus-5-5",
      options: [{ id: provider === "codex" ? "reasoningEffort" : "effort", value: "medium" }],
    },
    runtimeMode: "full-access",
    interactionMode: "default",
  });
  const grant = LaunchGrant.make({
    ...f.grant("b"),
    grantId: "attached-grant",
    endpointId: "attached",
    ownerId: "attached-owner",
  });
  const grantFile = yield* f.write("attached-grant.json", yield* S.encodeEffect(LaunchGrant)(grant));
  const credentialFile = f.path.join(f.directory, "credential.txt");
  yield* f.fs.writeFileString(credentialFile, "synthetic-fixture", { mode: 0o600 });
  const peerExecutable = f.path.join(f.directory, "peer-fixture");
  yield* f.fs.writeFileString(peerExecutable, "fixture-only", { mode: 0o600 });
  const profile = yield* S.decodeEffect(AttachedT3Profile)({
    ownershipConfirmed: true,
    threadId: "owned-thread",
    projectId: "project",
    workspace: f.directory,
    endpointId: "attached",
    participantId: "attached",
    ownerId: "attached-owner",
    generation: 1,
    repositoryScope: "fixture-repository",
    provider,
    expectedConfiguration: configuration,
    nativeBaseline: {
      sessionId: "dated-native",
      policy: "never/full-access",
      observedAt: 1,
      source: "separate fixture observation",
    },
    serverVersion: "fixture",
    sourceCommit: "fixture",
    artifactDigest: "fixture",
    url: "http://127.0.0.1:3773/mcp",
    oauthCredentialFile: credentialFile,
    grantFile,
    peerExecutable,
    waitTimeoutMs: 1000,
    conversationId: "conversation",
  });
  const filename = yield* f.write("profile.json", yield* S.encodeEffect(AttachedT3Profile)(profile));
  const requests = yield* Ref.make(A.empty<string>());
  const httpRequests = yield* Ref.make(0);
  const readTool = Effect.fn("AgentMessageCommandTest.readTool")(function* (params: unknown) {
    const { name } = yield* S.decodeUnknownEffect(ToolRequest)(params);
    yield* Ref.update(requests, A.append(name));
    const structuredContent = Match.value(name).pipe(
      Match.when("t3_thread_configuration", () => configuration),
      Match.when("t3_project_read", () => ({ id: "project", workspaceRoot: f.directory })),
      Match.when("t3_thread_read", () => ({
        thread: {
          threadId: "owned-thread",
          projectId: "project",
          status: "idle",
          latestRunId: null,
          activeRunId: null,
          providerInstanceId: provider,
          model: configuration.modelSelection.model,
          runtimeMode: "full-access",
          interactionMode: "default",
          worktreePath: null,
        },
        recentRuns: [],
        items: [],
        nextPosition: null,
        hasMore: false,
      })),
      Match.orElse(() => undefined)
    );
    expect(structuredContent).toBeDefined();
    return { structuredContent, content: [] };
  });
  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      yield* Ref.update(httpRequests, (count) => count + 1);
      expect(request.url).toBe(profile.url);
      expect(request.headers.authorization).toBe("Bearer synthetic-fixture");
      if (request.body._tag !== "Uint8Array") return yield* Effect.die("Expected an encoded JSON-RPC fixture request.");
      const frame = yield* S.decodeEffect(JsonRpcFrameJson)(new TextDecoder().decode(request.body.body));
      if (frame.method === "notifications/initialized")
        return HttpClientResponse.fromWeb(request, new Response(null, { status: 202 }));
      const result = frame.method === "initialize" ? { protocolVersion: "2025-06-18" } : yield* readTool(frame.params);
      return HttpClientResponse.fromWeb(
        request,
        new Response(yield* encodeJson({ jsonrpc: "2.0", id: frame.id, result }), {
          status: 200,
          headers: { "content-type": "application/json", "mcp-session-id": "owned-session" },
        })
      );
    }).pipe(Effect.orDie)
  );
  return { profile, filename, client, requests, httpRequests };
});

it.layer(
  Layer.mergeAll(
    NodeCommandTestLayer,
    TestConsole.layer,
    Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make(() => Effect.die("Unexpected HTTP request outside attached fixture."))
    )
  ),
  { timeout: "30 seconds" }
)("AgentMessage CLI boundaries", (it) => {
  it.effect("resolve-ambiguity records an operator decision once without contacting a provider", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      yield* f.store.accept(f.envelope("operator-resolution"), f.now);
      const claim = O.getOrThrow(yield* f.store.claimNext("b", "b-owner", f.now, f.now + 1000));
      yield* f.store.complete(claim, "ambiguous", f.now + 1);
      const resolution = AmbiguityResolution.make({
        resolutionId: "fixture-resolution",
        messageId: "operator-resolution",
        endpointId: "b",
        endpointGeneration: 1,
        attemptGeneration: claim.generation,
        attemptOwnerId: claim.ownerId,
        operatorId: "fixture-operator",
        disposition: "delivered",
        evidence: "Fixture-only original attempt terminal receipt",
        reason: "The fixture operator confirmed the original attempt finished",
      });
      const filename = yield* f.write("resolution.json", yield* S.encodeEffect(AmbiguityResolution)(resolution));
      const invoke = () => f.execute(["resolve-ambiguity", "--file", filename]);
      const first = yield* A.head(yield* invoke()).pipe(O.getOrThrow, S.decodeUnknownEffect(Receipt));
      const repeated = yield* A.head(yield* invoke()).pipe(O.getOrThrow, S.decodeUnknownEffect(Receipt));
      expect(first.status).toBe("delivered");
      expect(repeated.sequence).toBe(first.sequence);
      expect(yield* f.store.receipts("operator-resolution")).toHaveLength(4);
    })
  );

  it.effect(
    "resolve-ambiguity refuses shared evidence files and stale endpoint evidence without changing the hold",
    () =>
      Effect.gen(function* () {
        const f = yield* setup();
        yield* f.store.accept(f.envelope("retained-hold"), f.now);
        const claim = O.getOrThrow(yield* f.store.claimNext("b", "b-owner", f.now, f.now + 1000));
        yield* f.store.complete(claim, "ambiguous", f.now + 1);
        const resolution = AmbiguityResolution.make({
          resolutionId: "rejected-resolution",
          messageId: "retained-hold",
          endpointId: "b",
          endpointGeneration: 2,
          attemptGeneration: claim.generation,
          attemptOwnerId: claim.ownerId,
          operatorId: "fixture-operator",
          disposition: "failed",
          evidence: "Fixture-only evidence with a wrong enrollment generation",
          reason: "Reject stale evidence",
        });
        const filename = yield* f.write(
          "stale-resolution.json",
          yield* S.encodeEffect(AmbiguityResolution)(resolution)
        );
        yield* f.fs.chmod(filename, 0o644);
        const shared = yield* f.execute(["resolve-ambiguity", "--file", filename]).pipe(Effect.flip);
        expect(shared).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
        yield* f.fs.chmod(filename, 0o600);
        const stale = yield* f.execute(["resolve-ambiguity", "--file", filename]).pipe(Effect.flip);
        expect(stale).toMatchObject({ _tag: "RouterError", code: "staleClaim" });
        expect(yield* f.store.receipts("retained-hold")).toHaveLength(3);
        expect(O.getOrThrow(A.last(yield* f.store.receipts("retained-hold"))).status).toBe("ambiguous");
      })
  );

  it.effect("watch emits durable acceptance without acknowledging and stops on cancellation", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const envelopeFile = yield* f.write("watched.json", yield* S.encodeEffect(Envelope)(f.envelope("watched")));
      yield* f.execute(["send", "--file", envelopeFile]);
      const printed = yield* Deferred.make<Receipt, S.SchemaError>();
      const original = yield* Console.Console;
      const observed = Console.Console.of({
        ...original,
        log: (...args) => {
          original.log(...args);
          Deferred.doneUnsafe(printed, S.decodeUnknownEffect(ReceiptJson)(args[0]));
        },
      });
      const fiber = yield* runCommand(["watch", "--message-id", "watched", "--state-dir", f.stateDir]).pipe(
        Effect.provideService(Console.Console, observed),
        Effect.forkChild
      );
      expect(yield* Deferred.await(printed)).toMatchObject({ messageId: "watched", status: "accepted", sequence: 1 });
      yield* Fiber.interrupt(fiber);
      expect(yield* f.store.receipts("watched")).toHaveLength(1);
    }).pipe(TestClock.withLive)
  );

  it.effect("tools rejects exposed and malformed private grants before starting transport", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const grantFile = yield* f.write("mcp-grant.json", yield* S.encodeEffect(LaunchGrant)(f.grant("a")));
      yield* f.fs.chmod(grantFile, 0o644);
      expect(
        yield* runCommand(["tools", "--state-dir", f.stateDir, "--grant-file", grantFile]).pipe(Effect.flip)
      ).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      yield* f.fs.chmod(grantFile, 0o600);
      yield* f.write("mcp-grant.json", { grantId: "incomplete" });
      expect(
        yield* runCommand(["tools", "--state-dir", f.stateDir, "--grant-file", grantFile]).pipe(Effect.flip)
      ).toMatchObject({ _tag: "SchemaError" });
      expect(yield* f.store.validateGrant("grant-a", f.now).pipe(Effect.isFailure)).toBe(true);
    })
  );

  it.effect("operator commands persist enrollment and messages and render the corresponding receipts", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      expect(yield* f.execute(["list"])).toEqual([
        [yield* S.encodeEffect(EndpointBinding)(f.a), yield* S.encodeEffect(EndpointBinding)(f.b)],
      ]);
      const grant = f.grant("a");
      const grantFile = yield* f.write("grant.json", yield* S.encodeEffect(LaunchGrant)(grant));
      expect(yield* f.execute(["grant", "--file", grantFile])).toEqual([{ granted: "grant-a", endpoint: "a" }]);
      const outgoing = f.envelope("original");
      const file = yield* f.write("message.json", yield* S.encodeEffect(Envelope)(outgoing));
      const sent = yield* f.execute(["send", "--file", file]);
      expect(sent).toMatchObject([
        { messageId: "original", body: "bounded original" },
        { messageId: "original", status: "accepted" },
      ]);
      expect((yield* f.store.message("original")).body).toBe("bounded original");
      expect(yield* f.execute(["inbox", "--endpoint", "b"])).toMatchObject([[{ messageId: "original" }]]);
      expect(yield* f.execute(["inspect", "--message-id", "original"])).toMatchObject([
        [{ status: "accepted", sequence: 1 }],
      ]);
      const claim = O.getOrThrow(yield* f.store.claimNext("b", "b-owner", f.now + 1, f.now + 30000));
      expect(claim.envelope.messageId).toBe("original");
      expect(yield* f.execute(["acknowledge", "--message-id", "original", "--endpoint", "b"])).toMatchObject([
        { status: "acknowledged", sequence: 3 },
      ]);
      const reply = f.envelope("reply", "b", "a", O.some("original"));
      const replyFile = yield* f.write("reply.json", yield* S.encodeEffect(Envelope)(reply));
      expect(yield* f.execute(["reply", "--file", replyFile])).toMatchObject([
        { messageId: "reply", replyTo: "original" },
        { status: "accepted" },
      ]);
      assertSome((yield* f.store.message("reply")).replyTo, "original");
      expect(yield* f.execute(["recover"])).toEqual([{ recovered: 0 }]);
    })
  );

  it.effect("operator failures reject an uncorrelated reply and an exposed grant without accepting them", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const file = yield* f.write("reply.json", yield* S.encodeEffect(Envelope)(f.envelope("unrelated")));
      const replyError = yield* f.execute(["reply", "--file", file]).pipe(Effect.flip);
      expect(replyError).toMatchObject({ _tag: "RouterError", code: "conflict" });
      expect(yield* f.store.inbox("b")).toEqual([]);
      const grantFile = yield* f.write("exposed.json", yield* S.encodeEffect(LaunchGrant)(f.grant("a")));
      yield* f.fs.chmod(grantFile, 0o644);
      const grantError = yield* f.execute(["grant", "--file", grantFile]).pipe(Effect.flip);
      expect(grantError).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      expect(yield* f.store.validateGrant("grant-a", f.now).pipe(Effect.isFailure)).toBe(true);
    })
  );

  it.effect("peer commands enforce the persisted grant while sending, acknowledging and replying", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const aFile = yield* f.write("grant-a.json", yield* S.encodeEffect(LaunchGrant)(f.grant("a")));
      const bFile = yield* f.write("grant-b.json", yield* S.encodeEffect(LaunchGrant)(f.grant("b")));
      yield* f.execute(["grant", "--file", aFile]);
      yield* f.execute(["grant", "--file", bFile]);
      const peer = (file: string, args: ReadonlyArray<string>) => f.execute(["peer", ...args, "--grant-file", file]);
      expect(yield* peer(aFile, ["discover"])).toMatchObject([[{ endpointId: "b" }]]);
      expect(
        yield* peer(aFile, [
          "send",
          "--message-id",
          "peer-original",
          "--body",
          "peer body",
          "--conversation-id",
          "conversation",
          "--recipient",
          "b",
        ])
      ).toMatchObject([{ messageId: "peer-original", status: "accepted" }]);
      expect(yield* peer(bFile, ["inbox"])).toMatchObject([[{ messageId: "peer-original", body: "peer body" }]]);
      expect(yield* peer(bFile, ["inspect", "--message-id", "peer-original"])).toMatchObject([
        [{ messageId: "peer-original", status: "accepted" }],
      ]);
      const claim = O.getOrThrow(yield* f.store.claimNext("b", "b-owner", f.now + 1, f.now + 30000));
      expect(claim.envelope.messageId).toBe("peer-original");
      expect(yield* peer(bFile, ["acknowledge", "--message-id", "peer-original"])).toMatchObject([
        { messageId: "peer-original", status: "acknowledged" },
      ]);
      expect(
        yield* peer(bFile, [
          "reply",
          "--message-id",
          "peer-reply",
          "--body",
          "peer reply",
          "--reply-to",
          "peer-original",
        ])
      ).toMatchObject([{ messageId: "peer-reply", status: "accepted" }]);
      assertSome((yield* f.store.message("peer-reply")).replyTo, "peer-original");
      const error = yield* peer(aFile, [
        "send",
        "--message-id",
        "denied",
        "--body",
        "bounded",
        "--conversation-id",
        "outside",
        "--recipient",
        "b",
      ]).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "RouterError", code: "invalidGrant" });
      expect(A.map(yield* f.store.inbox("b"), (message) => message.messageId)).toEqual([]);
    })
  );

  for (const provider of AttachedT3Profile.fields.provider.literals) {
    it.effect(
      `attach-t3 enrolls an owned ${provider} thread and renders its policy binding before scoped cancellation`,
      () =>
        Effect.gen(function* () {
          const f = yield* setup();
          const attached = yield* attachedFixture(f, provider);
          const printed = yield* Deferred.make<EndpointBinding, S.SchemaError>();
          const console = yield* Console.Console;
          const observedConsole: Console.Console = {
            ...console,
            log: (...args: ReadonlyArray<unknown>) => {
              console.log(...args);
              // Bridge the synchronous console boundary to a deterministic enrollment witness.
              Deferred.doneUnsafe(printed, S.decodeUnknownEffect(BindingJson)(args[0]));
            },
          };
          const fiber = yield* f
            .execute(["attach-t3", "--profile-file", attached.filename])
            .pipe(
              Effect.provideService(HttpClient.HttpClient, attached.client),
              Effect.provideService(Console.Console, observedConsole),
              Effect.forkChild
            );
          const emitted = yield* Deferred.await(printed);
          yield* Fiber.interrupt(fiber);
          const enrolled = yield* f.store.endpoint("attached");
          expect(enrolled.sessionId).toBe("owned-thread");
          expect(enrolled.policy.modelId).toBe(attached.profile.expectedConfiguration.modelSelection.model);
          expect(enrolled.policy.effort).toBe("medium");
          expect(enrolled.policyFingerprint).toBe(enrolled.policy.fingerprint);
          assertSome(
            O.map(enrolled.execution, (execution) => execution.workspace),
            f.directory
          );
          expect(O.getOrThrow(enrolled.host)).toMatchObject({
            mode: "native-app",
            backend: "t3-legacy-mcp-attached",
          });
          expect(yield* Ref.get(attached.requests)).toEqual([
            "t3_thread_configuration",
            "t3_thread_read",
            "t3_project_read",
          ]);
          expect(emitted).toMatchObject({
            endpointId: "attached",
            sessionId: "owned-thread",
          });
        })
    );
  }

  it.effect("attach-t3 rejects declared model drift and shared credential files before any HTTP request", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const attached = yield* attachedFixture(f);
      const configuration = attached.profile.expectedConfiguration;
      const invalid = AttachedT3Profile.make({
        ...attached.profile,
        expectedConfiguration: {
          ...configuration,
          modelSelection: { ...configuration.modelSelection, model: "wrong-model" },
        },
      });
      const invalidFile = yield* f.write("invalid-profile.json", yield* S.encodeEffect(AttachedT3Profile)(invalid));
      const wrongModel = yield* f
        .execute(["attach-t3", "--profile-file", invalidFile])
        .pipe(Effect.provideService(HttpClient.HttpClient, attached.client), Effect.flip);
      expect(wrongModel).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      expect(yield* Ref.get(attached.httpRequests)).toBe(0);
      yield* f.fs.chmod(attached.profile.oauthCredentialFile, 0o644);
      const sharedCredential = yield* f
        .execute(["attach-t3", "--profile-file", attached.filename])
        .pipe(Effect.provideService(HttpClient.HttpClient, attached.client), Effect.flip);
      expect(sharedCredential).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      expect(yield* Ref.get(attached.httpRequests)).toBe(0);
      expect(yield* Ref.get(attached.requests)).toEqual([]);
      expect(yield* f.store.endpoint("attached").pipe(Effect.isFailure)).toBe(true);
    })
  );
});
