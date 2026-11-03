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
  const logLines1 = yield* TestConsole.logLines;
  const before = A.length(logLines1);
  yield* runCommand(args);
  const logLines2 = yield* TestConsole.logLines;
  return yield* Effect.forEach(A.filter(A.drop(logLines2, before), P.isString), (line) => decodeJson(line));
});

const setup = Effect.fn("AgentMessageCommandTest.setup")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "beep-message-command-" });
  const directory = yield* fs.realPath(madeTempDirectoryScoped);
  yield* fs.chmod(directory, 0o700);
  const stateDir = path.join(directory, "state");
  const now = yield* Clock.currentTimeMillis;
  const write = Effect.fn("AgentMessageCommandTest.write")(function* (name: string, value: unknown) {
    const filename = path.join(directory, name);
    const encodedJson = yield* encodeJson(value);
    yield* fs.writeFileString(filename, encodedJson, { mode: 0o600 });
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
  const value3 = yield* S.encodeEffect(EndpointBinding)(a);
  const aFile = yield* write("a.json", value3);
  const value4 = yield* S.encodeEffect(EndpointBinding)(b);
  const bFile = yield* write("b.json", value4);
  const execute = (args: ReadonlyArray<string>) => run([...args, "--state-dir", stateDir]);
  const execute5 = yield* execute(["register", "--file", aFile]);
  expect(execute5).toEqual([{ registered: "a", generation: 1 }]);
  const execute6 = yield* execute(["register", "--file", bFile]);
  expect(execute6).toEqual([{ registered: "b", generation: 1 }]);
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
  const value7 = yield* S.encodeEffect(LaunchGrant)(grant);
  const grantFile = yield* f.write("attached-grant.json", value7);
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
  const value8 = yield* S.encodeEffect(AttachedT3Profile)(profile);
  const filename = yield* f.write("profile.json", value8);
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
      const encodedJson9 = yield* encodeJson({ jsonrpc: "2.0", id: frame.id, result });
      return HttpClientResponse.fromWeb(
        request,
        new Response(encodedJson9, {
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
      const claimNext10 = yield* f.store.claimNext("b", "b-owner", f.now, f.now + 1000);
      const claim = O.getOrThrow(claimNext10);
      yield* f.store.complete(claim, "ambiguous", f.now + 1);
      const before = yield* f.store.receipts(claim.envelope.messageId);
      const execute11 = yield* f.execute(["settlement", "--message-id", claim.envelope.messageId]);
      expect(execute11).toEqual([
        { evidence: null, recovery: "No original terminal proof is recorded; retain this hold." },
      ]);
      const receipts12 = yield* f.store.receipts(claim.envelope.messageId);
      expect(receipts12).toEqual(before);
      const resolution = AmbiguityResolution.make({
        resolutionId: "fixture-resolution",
        messageId: "operator-resolution",
        endpointId: "b",
        endpointGeneration: 1,
        attemptGeneration: claim.generation,
        attemptOwnerId: claim.ownerId,
        operatorId: "fixture-operator",
        disposition: "delivered",
        runtimeEvidence: {
          adapter: "injected",
          sessionId: "b-session",
          terminalId: "fixture-terminal",
          outcome: "delivered",
          source: "Synthetic original runtime terminal record",
        },
        evidence: "Fixture-only original attempt terminal receipt",
        reason: "The fixture operator confirmed the original attempt finished",
      });
      yield* f.store.recordSettlement(claim, resolution.runtimeEvidence, f.now + 2);
      const execute13 = yield* f.execute(["settlement", "--message-id", resolution.messageId]);
      expect(execute13).toEqual([{ evidence: resolution.runtimeEvidence }]);
      const value14 = yield* S.encodeEffect(AmbiguityResolution)(resolution);
      const filename = yield* f.write("resolution.json", value14);
      const invoke = () => f.execute(["resolve-ambiguity", "--file", filename]);
      const invoke15 = yield* invoke();
      const first = yield* A.head(invoke15).pipe(O.getOrThrow, S.decodeUnknownEffect(Receipt));
      const invoke16 = yield* invoke();
      const repeated = yield* A.head(invoke16).pipe(O.getOrThrow, S.decodeUnknownEffect(Receipt));
      expect(first.status).toBe("delivered");
      expect(repeated.sequence).toBe(first.sequence);
      const receipts17 = yield* f.store.receipts("operator-resolution");
      expect(receipts17).toHaveLength(4);
    })
  );

  it.effect(
    "resolve-ambiguity refuses shared evidence files and stale endpoint evidence without changing the hold",
    () =>
      Effect.gen(function* () {
        const f = yield* setup();
        yield* f.store.accept(f.envelope("retained-hold"), f.now);
        const claimNext18 = yield* f.store.claimNext("b", "b-owner", f.now, f.now + 1000);
        const claim = O.getOrThrow(claimNext18);
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
          runtimeEvidence: {
            adapter: "injected",
            sessionId: "b-session",
            terminalId: "fixture-terminal",
            outcome: "failed",
            source: "Synthetic original runtime terminal record",
          },
          evidence: "Fixture-only evidence with a wrong enrollment generation",
          reason: "Reject stale evidence",
        });
        const value19 = yield* S.encodeEffect(AmbiguityResolution)(resolution);
        const filename = yield* f.write("stale-resolution.json", value19);
        yield* f.fs.chmod(filename, 0o644);
        const shared = yield* f.execute(["resolve-ambiguity", "--file", filename]).pipe(Effect.flip);
        expect(shared).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
        yield* f.fs.chmod(filename, 0o600);
        const stale = yield* f.execute(["resolve-ambiguity", "--file", filename]).pipe(Effect.flip);
        expect(stale).toMatchObject({ _tag: "RouterError", code: "staleClaim" });
        const receipts20 = yield* f.store.receipts("retained-hold");
        expect(receipts20).toHaveLength(3);
        const receipts21 = yield* f.store.receipts("retained-hold");
        expect(O.getOrThrow(A.last(receipts21)).status).toBe("ambiguous");
      })
  );

  it.effect("watch emits durable acceptance without acknowledging and stops on cancellation", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const value22 = yield* S.encodeEffect(Envelope)(f.envelope("watched"));
      const envelopeFile = yield* f.write("watched.json", value22);
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
      const await23 = yield* Deferred.await(printed);
      expect(await23).toMatchObject({ messageId: "watched", status: "accepted", sequence: 1 });
      yield* Fiber.interrupt(fiber);
      const receipts24 = yield* f.store.receipts("watched");
      expect(receipts24).toHaveLength(1);
    }).pipe(TestClock.withLive)
  );

  it.effect("tools rejects exposed and malformed private grants before starting transport", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const value25 = yield* S.encodeEffect(LaunchGrant)(f.grant("a"));
      const grantFile = yield* f.write("mcp-grant.json", value25);
      yield* f.fs.chmod(grantFile, 0o644);
      const pipe26 = yield* runCommand(["tools", "--state-dir", f.stateDir, "--grant-file", grantFile]).pipe(
        Effect.flip
      );
      expect(pipe26).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      yield* f.fs.chmod(grantFile, 0o600);
      yield* f.write("mcp-grant.json", { grantId: "incomplete" });
      const pipe27 = yield* runCommand(["tools", "--state-dir", f.stateDir, "--grant-file", grantFile]).pipe(
        Effect.flip
      );
      expect(pipe27).toMatchObject({ _tag: "SchemaError" });
      const pipe28 = yield* f.store.validateGrant("grant-a", f.now).pipe(Effect.isFailure);
      expect(pipe28).toBe(true);
    })
  );

  it.effect("operator commands persist enrollment and messages and render the corresponding receipts", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const execute29 = yield* f.execute(["list"]);
      expect(execute29).toEqual([
        [yield* S.encodeEffect(EndpointBinding)(f.a), yield* S.encodeEffect(EndpointBinding)(f.b)],
      ]);
      const grant = f.grant("a");
      const value30 = yield* S.encodeEffect(LaunchGrant)(grant);
      const grantFile = yield* f.write("grant.json", value30);
      const execute31 = yield* f.execute(["grant", "--file", grantFile]);
      expect(execute31).toEqual([{ granted: "grant-a", endpoint: "a" }]);
      const outgoing = f.envelope("original");
      const value32 = yield* S.encodeEffect(Envelope)(outgoing);
      const file = yield* f.write("message.json", value32);
      const sent = yield* f.execute(["send", "--file", file]);
      expect(sent).toMatchObject([
        { messageId: "original", body: "bounded original" },
        { messageId: "original", status: "accepted" },
      ]);
      expect((yield* f.store.message("original")).body).toBe("bounded original");
      const execute33 = yield* f.execute(["inbox", "--endpoint", "b"]);
      expect(execute33).toMatchObject([[{ messageId: "original" }]]);
      const execute34 = yield* f.execute(["inspect", "--message-id", "original"]);
      expect(execute34).toMatchObject([[{ status: "accepted", sequence: 1 }]]);
      const claimNext35 = yield* f.store.claimNext("b", "b-owner", f.now + 1, f.now + 30000);
      const claim = O.getOrThrow(claimNext35);
      expect(claim.envelope.messageId).toBe("original");
      const execute36 = yield* f.execute(["acknowledge", "--message-id", "original", "--endpoint", "b"]);
      expect(execute36).toMatchObject([{ status: "acknowledged", sequence: 3 }]);
      const reply = f.envelope("reply", "b", "a", O.some("original"));
      const value37 = yield* S.encodeEffect(Envelope)(reply);
      const replyFile = yield* f.write("reply.json", value37);
      const execute38 = yield* f.execute(["reply", "--file", replyFile]);
      expect(execute38).toMatchObject([{ messageId: "reply", replyTo: "original" }, { status: "accepted" }]);
      assertSome((yield* f.store.message("reply")).replyTo, "original");
      const execute39 = yield* f.execute(["recover"]);
      expect(execute39).toEqual([{ recovered: 0 }]);
    })
  );

  it.effect("operator failures reject an uncorrelated reply and an exposed grant without accepting them", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const value40 = yield* S.encodeEffect(Envelope)(f.envelope("unrelated"));
      const file = yield* f.write("reply.json", value40);
      const replyError = yield* f.execute(["reply", "--file", file]).pipe(Effect.flip);
      expect(replyError).toMatchObject({ _tag: "RouterError", code: "conflict" });
      const inbox41 = yield* f.store.inbox("b");
      expect(inbox41).toEqual([]);
      const value42 = yield* S.encodeEffect(LaunchGrant)(f.grant("a"));
      const grantFile = yield* f.write("exposed.json", value42);
      yield* f.fs.chmod(grantFile, 0o644);
      const grantError = yield* f.execute(["grant", "--file", grantFile]).pipe(Effect.flip);
      expect(grantError).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      const pipe43 = yield* f.store.validateGrant("grant-a", f.now).pipe(Effect.isFailure);
      expect(pipe43).toBe(true);
    })
  );

  it.effect("peer commands enforce the persisted grant while sending, acknowledging and replying", () =>
    Effect.gen(function* () {
      const f = yield* setup();
      const value44 = yield* S.encodeEffect(LaunchGrant)(f.grant("a"));
      const aFile = yield* f.write("grant-a.json", value44);
      const value45 = yield* S.encodeEffect(LaunchGrant)(f.grant("b"));
      const bFile = yield* f.write("grant-b.json", value45);
      yield* f.execute(["grant", "--file", aFile]);
      yield* f.execute(["grant", "--file", bFile]);
      const peer = (file: string, args: ReadonlyArray<string>) => f.execute(["peer", ...args, "--grant-file", file]);
      const peer46 = yield* peer(aFile, ["discover"]);
      expect(peer46).toMatchObject([[{ endpointId: "b" }]]);
      const peer47 = yield* peer(aFile, [
        "send",
        "--message-id",
        "peer-original",
        "--body",
        "peer body",
        "--conversation-id",
        "conversation",
        "--recipient",
        "b",
      ]);
      expect(peer47).toMatchObject([{ messageId: "peer-original", status: "accepted" }]);
      const peer48 = yield* peer(bFile, ["inbox"]);
      expect(peer48).toMatchObject([[{ messageId: "peer-original", body: "peer body" }]]);
      const peer49 = yield* peer(bFile, ["inspect", "--message-id", "peer-original"]);
      expect(peer49).toMatchObject([[{ messageId: "peer-original", status: "accepted" }]]);
      const claimNext50 = yield* f.store.claimNext("b", "b-owner", f.now + 1, f.now + 30000);
      const claim = O.getOrThrow(claimNext50);
      expect(claim.envelope.messageId).toBe("peer-original");
      const peer51 = yield* peer(bFile, ["acknowledge", "--message-id", "peer-original"]);
      expect(peer51).toMatchObject([{ messageId: "peer-original", status: "acknowledged" }]);
      const peer52 = yield* peer(bFile, [
        "reply",
        "--message-id",
        "peer-reply",
        "--body",
        "peer reply",
        "--reply-to",
        "peer-original",
      ]);
      expect(peer52).toMatchObject([{ messageId: "peer-reply", status: "accepted" }]);
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
      const inbox53 = yield* f.store.inbox("b");
      expect(A.map(inbox53, (message) => message.messageId)).toEqual([]);
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
          const got = yield* Ref.get(attached.requests);
          expect(got).toEqual(["t3_thread_configuration", "t3_thread_read", "t3_project_read"]);
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
      const value54 = yield* S.encodeEffect(AttachedT3Profile)(invalid);
      const invalidFile = yield* f.write("invalid-profile.json", value54);
      const wrongModel = yield* f
        .execute(["attach-t3", "--profile-file", invalidFile])
        .pipe(Effect.provideService(HttpClient.HttpClient, attached.client), Effect.flip);
      expect(wrongModel).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      const got55 = yield* Ref.get(attached.httpRequests);
      expect(got55).toBe(0);
      yield* f.fs.chmod(attached.profile.oauthCredentialFile, 0o644);
      const sharedCredential = yield* f
        .execute(["attach-t3", "--profile-file", attached.filename])
        .pipe(Effect.provideService(HttpClient.HttpClient, attached.client), Effect.flip);
      expect(sharedCredential).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      const got56 = yield* Ref.get(attached.httpRequests);
      expect(got56).toBe(0);
      const got57 = yield* Ref.get(attached.requests);
      expect(got57).toEqual([]);
      const pipe58 = yield* f.store.endpoint("attached").pipe(Effect.isFailure);
      expect(pipe58).toBe(true);
    })
  );
});
