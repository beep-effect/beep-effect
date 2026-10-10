import {
  EndpointBinding,
  EndpointExecutionRef,
  EndpointHostRef,
  Envelope,
  EvidenceDisposition,
  LaunchGrant,
  MessageTarget,
  Receipt,
  RouterError,
} from "@beep/repo-cli/test/AgentMessage";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Utils from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const envelope: typeof Envelope.Encoded = {
  conversationId: "conversation-1",
  messageId: "m1",
  idempotencyKey: "request-1",
  from: "sender",
  to: { kind: "direct", endpointId: "recipient" },
  repositoryScope: "repo:beep-effect",
  body: "reply with the same nonce",
  createdAt: 100,
  expiresAt: 200,
  capabilityFingerprint: "cap-v1",
  policyFingerprint: "policy-v1",
};

const grant: typeof LaunchGrant.Encoded = {
  grantId: "grant-1",
  endpointId: "sender",
  generation: 1,
  ownerId: "owned-process",
  repositoryScope: "repo:beep-effect",
  allowedRecipients: ["recipient"],
  expiresAt: 200,
  maxMessages: 5,
};

describe("AgentMessage bounded contracts", () => {
  it.effect.prop(
    "preserves bounded message identity, task correlation and optional reply identity through JSON transport",
    [Arbitrary.schema(Envelope)],
    Effect.fnUntraced(function* ([message]) {
      const codec = Envelope.pipe(S.fromJsonString);
      const wire = yield* S.encodeEffect(codec)(message);
      const decoded = yield* S.decodeEffect(codec)(wire);
      expect(yield* S.encodeEffect(codec)(decoded)).toBe(wire);
      expect(decoded.messageId).toBe(message.messageId);
      expect(decoded.conversationId).toBe(message.conversationId);
      expect(decoded.to).toEqual(message.to);
      expect(decoded.replyTo).toEqual(message.replyTo);
      expect(decoded.body).toBe(message.body);
    }),
    { arbitrary: fcRuns(50) }
  );
  it.effect.prop(
    "preserves independently observed execution and host references through JSON transport",
    [Arbitrary.schema(EndpointExecutionRef), Arbitrary.schema(EndpointHostRef)],
    Effect.fnUntraced(function* ([execution, host]) {
      const executionCodec = EndpointExecutionRef.pipe(S.fromJsonString);
      const hostCodec = EndpointHostRef.pipe(S.fromJsonString);
      const decodedExecution = yield* S.decodeEffect(executionCodec)(yield* S.encodeEffect(executionCodec)(execution));
      const decodedHost = yield* S.decodeEffect(hostCodec)(yield* S.encodeEffect(hostCodec)(host));
      expect(decodedExecution).toEqual(execution);
      expect(decodedHost).toEqual(host);
    }),
    { arbitrary: fcRuns(50) }
  );
  it.effect("keeps execution and host identity separate with absent observations defaulting to none", () =>
    Effect.gen(function* () {
      const binding: typeof EndpointBinding.Encoded = {
        endpointId: "endpoint",
        participantId: "participant",
        sessionId: "session",
        ownerId: "owner",
        generation: 1,
        repositoryScope: "repo",
        capabilityFingerprint: "cap",
        policyFingerprint: "policy",
        supported: true,
        capabilityEvidence: [],
        policy: {
          provider: "codex",
          modelId: "gpt-6.1-sol",
          effort: "medium",
          sandbox: "read-only",
          approvalPolicy: "never",
          fingerprint: "policy",
          policyEvidence: "effective-reported",
        },
      };
      const legacy = yield* S.decodeEffect(EndpointBinding)(binding);
      Utils.assertNone(legacy.execution);
      Utils.assertNone(legacy.host);
      const execution = EndpointExecutionRef.make({
        workspace: "/workspace/repository",
        lane: O.some("lane"),
        runId: O.some("run"),
        turnId: O.some("turn"),
      });
      const host = EndpointHostRef.make({
        mode: "managed-process",
        provider: "codex",
        backend: "codex-app-server-stdio",
      });
      Utils.assertNone(host.hostId);
      Utils.assertNone(host.appId);
      const enriched = EndpointBinding.make({ ...legacy, execution: O.some(execution), host: O.some(host) });
      const encoded = yield* S.encodeEffect(EndpointBinding)(enriched);
      const decoded = yield* S.decodeEffect(EndpointBinding)(encoded);
      Utils.assertSome(O.getOrThrow(decoded.execution).runId, "run");
      Utils.assertSome(O.getOrThrow(decoded.execution).turnId, "turn");
      Utils.assertSome(O.getOrThrow(decoded.execution).lane, "lane");
      expect(O.getOrThrow(decoded.host).mode).toBe("managed-process");
      expect(decoded.sessionId).toBe("session");
      const listCodec = EndpointBinding.pipe(S.Array, S.fromJsonString);
      const wire = yield* S.encodeEffect(listCodec)([legacy, enriched]);
      const listed = yield* S.decodeEffect(listCodec)(wire);
      expect(listed).toHaveLength(2);
      Utils.assertNone(O.getOrThrow(A.head(listed)).execution);
      O.getOrThrow(A.last(listed)).execution.pipe(O.isSome, Utils.assertTrue);
      O.getOrThrow(A.last(listed)).host.pipe(O.isSome, Utils.assertTrue);
      const appHost = yield* S.decodeEffect(EndpointHostRef)({
        mode: "native-app",
        provider: "codex",
        backend: "observed-app-backend",
        hostId: "host-reference",
        appId: "app-reference",
      });
      Utils.assertSome(appHost.hostId, "host-reference");
      Utils.assertSome(appHost.appId, "app-reference");
      const partialExecution = yield* S.decodeEffect(EndpointExecutionRef)({
        workspace: "/workspace/repository",
        runId: "observed-run",
      });
      Utils.assertNone(partialExecution.turnId);
      Utils.assertNone(partialExecution.lane);
      const oversized = yield* Effect.exit(S.decodeEffect(EndpointExecutionRef)({ workspace: Str.repeat(513)("a") }));
      oversized.pipe(Exit.isFailure, Utils.assertTrue);
    })
  );

  it.effect("decodes absent replyTo and receipt diagnostics as Option.none", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(Envelope)(envelope);
      Utils.assertNone(decoded.replyTo);
      const receipt = yield* S.decodeEffect(Receipt)({
        sequence: 0,
        messageId: "m1",
        status: "ambiguous",
        at: 150,
        attemptGeneration: 1,
      });
      Utils.assertNone(receipt.owner);
      Utils.assertNone(receipt.detail);
    })
  );

  it.effect("preserves reply correlation through the encoded boundary", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(Envelope)({ ...envelope, replyTo: "parent-message" });
      expect(O.getOrNull(decoded.replyTo)).toBe("parent-message");
      const encoded = yield* S.encodeEffect(Envelope)(decoded);
      expect(encoded.replyTo).toBe("parent-message");
    })
  );

  it.effect("rejects oversized messages and unsafe epoch integers", () =>
    Effect.gen(function* () {
      const oversized = yield* Effect.exit(
        S.decodeEffect(Envelope)({
          ...envelope,
          body: Str.repeat(16385)("a"),
        })
      );
      oversized.pipe(Exit.isFailure, Utils.assertTrue);
      const unsafe = yield* Effect.exit(
        S.decodeEffect(Envelope)({
          ...envelope,
          createdAt: 9007199254740992,
        })
      );
      unsafe.pipe(Exit.isFailure, Utils.assertTrue);
    })
  );

  it.effect("rejects empty recipient authority and unbounded message budgets", () =>
    Effect.gen(function* () {
      const empty = yield* Effect.exit(S.decodeEffect(LaunchGrant)({ ...grant, allowedRecipients: [] }));
      empty.pipe(Exit.isFailure, Utils.assertTrue);
      const overflow = yield* Effect.exit(S.decodeEffect(LaunchGrant)({ ...grant, maxMessages: 1001 }));
      overflow.pipe(Exit.isFailure, Utils.assertTrue);
      const valid = yield* S.decodeEffect(LaunchGrant)(grant);
      expect(valid.maxMessages).toBe(5);
      Utils.assertNone(valid.conversationScope);
      const scoped = yield* S.decodeEffect(LaunchGrant)({ ...grant, conversationScope: "owned-conversation" });
      Utils.assertSome(scoped.conversationScope, "owned-conversation");
      const encoded = yield* S.encodeEffect(LaunchGrant)(scoped);
      expect(encoded.conversationScope).toBe("owned-conversation");
      const emptyScope = yield* Effect.exit(S.decodeEffect(LaunchGrant)({ ...grant, conversationScope: "" }));
      emptyScope.pipe(Exit.isFailure, Utils.assertTrue);
    })
  );

  it.effect("keeps direct and role targets distinct and rejects unknown statuses", () =>
    Effect.gen(function* () {
      expect(S.is(EvidenceDisposition)("advertised")).toBe(true);
      expect(S.is(MessageTarget)({ kind: "role", roleId: "reviewer" })).toBe(true);
      expect(S.is(MessageTarget)({ kind: "direct", roleId: "reviewer" })).toBe(false);
      const invalid = yield* Effect.exit(
        S.decodeUnknownEffect(Receipt)({
          sequence: 0,
          messageId: "m1",
          status: "submitted",
          at: 150,
          attemptGeneration: 1,
        })
      );
      invalid.pipe(Exit.isFailure, Utils.assertTrue);
      expect(RouterError.make({ code: "policyMismatch", message: "effective policy changed" }).code).toBe(
        "policyMismatch"
      );
    })
  );
});
