#!/usr/bin/env bun
/**
 * Disposable real-child proof using the existing synthetic Codex protocol peer.
 * No provider executable, authentication, model request or collector is used.
 * @packageDocumentation
 * @since 0.0.0
 */
import assert from "node:assert/strict";
import {
  AiProviderCliSession,
  ManagedLaunchProfile,
  ManagedSessionError,
  ManagedTerminalEvidence,
  ManagedTurnResult,
} from "@beep/ai-provider-cli";
import {
  makeObservationClaims,
  ObservationClaimAnchor,
  ObservationClaimPolicy,
  ObservationLaunchOutbox,
} from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchClientPolicy } from "@beep/repo-ai-metrics/observation-launch-client";
import { ObservationLaunchIdentity } from "@beep/repo-ai-metrics/observation-launch-facts";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  AgentObservationOwner,
  AgentObservationProvisioning,
  AgentObservationRequest,
  enrollAgentObservation,
  initializeAgentObservationClaims,
} from "../../../packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.observation.ts";
import {
  CliEnrollmentCanaryError,
  CliEnrollmentCanaryReport,
  runCliEnrollmentCanary,
} from "./cli-enrollment-canary.ts";

const salt = "synthetic-enrollment-canary-test-salt";
const id = (value: string) => Sha256Hex.make(Str.repeat(64)(value));
const encodeProvisioning = S.encodeEffect(S.fromJsonString(AgentObservationProvisioning));
const encodeReport = S.encodeEffect(S.fromJsonString(CliEnrollmentCanaryReport));
const encodeFailure = S.encodeEffect(S.fromJsonString(CliEnrollmentCanaryError));
const encodeOutbox = S.encodeEffect(S.fromJsonString(ObservationLaunchOutbox));

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "canary-proof-" });
  yield* fs.chmod(root, 0o700);
  for (const name of ["workspace", "home", "request", "collector"])
    yield* fs.makeDirectory(`${root}/${name}`, { mode: 0o700 });
  const namespaceId = yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt));
  const profile = ManagedLaunchProfile.make({
    provider: "codex",
    executable: process.execPath,
    prefixArgs: [
      path.resolve(
        import.meta.dirname,
        "../../../packages/drivers/ai-provider-cli/test/fixtures/managed-codex-peer.ts"
      ),
    ],
    workspace: `${root}/workspace`,
    profileRoot: `${root}/home`,
    env: { HOME: `${root}/home`, CODEX_HOME: `${root}/home/.codex`, PATH: "/usr/bin:/bin" },
    tools: [],
  });
  const owner = AgentObservationOwner.make({
    endpointId: "synthetic-canary",
    ownerId: "synthetic-owner",
    generation: 1,
    repositoryScope: "synthetic-scope",
    workspace: profile.workspace,
    provider: profile.provider,
  });
  const claims = ObservationClaimPolicy.make({
    directory: `${root}/claims`,
    journalDirectory: `${root}/collector`,
    anchor: ObservationClaimAnchor.make({ fenceId: id("e"), hostId: id("a"), namespaceId, maxClaims: 1 }),
  });
  const provisioning = AgentObservationProvisioning.make({
    owner,
    claims,
    destination: ObservationLaunchClientPolicy.make({
      directory: `${root}/collector`,
      hostId: id("a"),
      namespaceId,
      timeoutMillis: 100,
    }),
    evidenceEpoch: 0,
    identity: ObservationLaunchIdentity.make({
      routeId: id("c"),
      harness: "codex-cli",
      surface: "cli",
      root: { _tag: "Unknown" },
      repository: { _tag: "Unknown" },
      clone: { _tag: "Unknown" },
      worktree: { _tag: "Unknown" },
      task: { _tag: "Unknown" },
      attempt: { _tag: "Unknown" },
      evidenceId: id("d"),
    }),
  });
  yield* fs.writeFileString(`${root}/request/request.json`, yield* encodeProvisioning(provisioning), { mode: 0o600 });
  yield* initializeAgentObservationClaims(`${root}/request`);
  const receipt = yield* enrollAgentObservation(`${root}/request`, `${root}/enrollment`);
  return {
    request: AgentObservationRequest.make({ profile, owner, enrollmentDirectory: O.some(`${root}/enrollment`) }),
    launchId: receipt.launchId,
    claims: yield* makeObservationClaims(claims, process.geteuid?.() ?? -1),
    root,
  };
});

const program = Effect.gen(function* () {
  const native = yield* AiProviderCliSession;
  for (const mode of ["success", "wrong-constant", "foreign-terminal", "close-failure"]) {
    const f = yield* fixture;
    const opens = yield* Ref.make(0);
    const prompts = yield* Ref.make(0);
    const stopped = yield* Ref.make(false);
    const provider = {
      open: Effect.fnUntraced(function* (...args: Parameters<typeof native.open>) {
        yield* Ref.update(opens, (n) => n + 1);
        const session = yield* native.open(...args);
        return {
          ...session,
          // Subscribing to native events would fail this test instead of exporting them.
          events: Stream.die("SYNTHETIC_PRIVATE_EVENT_BODY"),
          prompt: Effect.fnUntraced(function* (...messages: Parameters<typeof session.prompt>) {
            yield* Ref.update(prompts, (n) => n + 1);
            const result = yield* session.prompt(...messages);
            return ManagedTurnResult.make({
              ...result,
              text: mode === "wrong-constant" ? "SYNTHETIC_PRIVATE_RESULT_BODY" : "ENROLLMENT_CANARY_OK",
              terminalEvidence:
                mode === "foreign-terminal"
                  ? O.some(
                      ManagedTerminalEvidence.make({
                        adapter: "codex",
                        sessionId: "foreign-session",
                        messageId: result.messageId,
                        turnId: "foreign-turn",
                        outcome: "delivered",
                        stopReason: "completed",
                      })
                    )
                  : result.terminalEvidence,
            });
          }),
          close: session.close.pipe(
            Effect.andThen(Ref.set(stopped, true)),
            Effect.andThen(
              mode === "close-failure"
                ? Effect.fail(
                    ManagedSessionError.make({
                      operation: "close",
                      reason: "transport",
                      message: "SYNTHETIC_PRIVATE_CLOSE_BODY",
                    })
                  )
                : Effect.void
            )
          ),
        };
      }),
    };
    const result = yield* runCliEnrollmentCanary(f.request).pipe(
      Effect.provideService(AiProviderCliSession, provider),
      Effect.result
    );
    let serialized = "";
    if (result._tag === "Success") {
      assert.equal(mode, "success");
      serialized = yield* encodeReport(result.success);
      assert.equal(result.success.usage, "Unknown");
      assert.equal(result.success.backendVisibility, "Unknown");
    } else {
      assert.equal(
        result.failure.phase,
        mode === "close-failure" ? "close" : mode === "wrong-constant" ? "response" : "terminal"
      );
      serialized = yield* encodeFailure(result.failure);
    }
    for (const secret of ["SYNTHETIC_PRIVATE", "ENROLLMENT_CANARY_OK", "owned-thread", "foreign-session", f.root, salt])
      assert.equal(Str.includes(secret)(serialized), false);
    assert.equal(yield* Ref.get(stopped), true);
    assert.equal(yield* Ref.get(opens), 1);
    assert.equal(yield* Ref.get(prompts), 1);
    const outbox = yield* f.claims.readOutbox(f.launchId);
    const durable = yield* encodeOutbox(outbox);
    for (const secret of ["SYNTHETIC_PRIVATE", "ENROLLMENT_CANARY_OK", "owned-thread", "foreign-session", f.root, salt])
      assert.equal(Str.includes(secret)(durable), false);
    assert.deepEqual(
      A.map(outbox.submissions, (s) => s.fact._tag),
      ["Prepared", "Started", "SessionBound", "Finished"]
    );
    assert.deepEqual(outbox.receipts, []); // No worker/backend exists in this fixture.
    const again = yield* runCliEnrollmentCanary(f.request).pipe(
      Effect.provideService(AiProviderCliSession, provider),
      Effect.flip
    );
    assert.equal(again.phase, "open");
    assert.equal(yield* Ref.get(opens), 1);
  }
  yield* Console.log(
    "PASS: synthetic child terminal/close, exact response scalar, metadata privacy, foreign receipt refusal, safe close failure and no duplicate spawn."
  );
});

NodeRuntime.runMain(
  program.pipe(
    Effect.provide(
      Layer.mergeAll(
        NodeServices.layer,
        NodeCrypto.layer,
        AiProviderCliSession.layer,
        Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_AI_METRICS_HASH_SALT: salt }))
      )
    ),
    Effect.scoped,
    Effect.timeout("30 seconds")
  )
);
