#!/usr/bin/env bun
/**
 * Synthetic peer plus real private Unix intake and durable journals only.
 * No provider executable, existing credentials or external backend is contacted.
 * @packageDocumentation
 * @since 0.0.0
 */
import assert from "node:assert/strict";
import { AiProviderCliSession, ManagedLaunchProfile, ManagedTurnResult } from "@beep/ai-provider-cli";
import { makeNativeHttpIntake, NativeHttpPolicy } from "@beep/repo-ai-metrics/native-http";
import { ObservationClaimAnchor, ObservationClaimPolicy } from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchClientPolicy } from "@beep/repo-ai-metrics/observation-launch-client";
import { ObservationLaunchIdentity } from "@beep/repo-ai-metrics/observation-launch-facts";
import { makeObservationLaunchHttp, ObservationLaunchHttpPolicy } from "@beep/repo-ai-metrics/observation-launch-http";
import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Str from "effect/String";
import {
  AgentObservationOwner, AgentObservationProvisioning, AgentObservationRequest,
  initializeAgentObservationClaims, enrollAgentObservation,
} from "../../../packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.observation.ts";
import { ManagedControllerCanaryInput, runManagedControllerCanary } from "./managed-controller-canary.ts";

const salt = "synthetic-managed-producer-private-salt";
const id = (c: string) => Sha256Hex.make(Str.repeat(64)(c));
const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "managed-proof-" });
  yield* fs.chmod(root, 0o700);
  for (const dir of ["collector", "workspace", "home", "request", "producer"])
    yield* fs.makeDirectory(`${root}/${dir}`, { mode: 0o700 });
  const namespaceId = yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt));
  const config = TranscriptIntakeConfig.make({ hostId: id("a"), namespaceId, maxPages: 16, maxPayloadBytes: 1048576, maxDatabasePages: 256 });
  const sql = yield* SqliteClient.make({ filename: `${root}/journal.sqlite` });
  const control = yield* makeObservationControl(ObservationControlPolicy.make({ maxActive: 2, drainTimeoutMillis: 1000 }));
  yield* control.resume;
  const routes = ObservationLaunchHttpPolicy.make({ routes: [{ routeId: id("c"), harness: "codex-cli", surface: "cli" }], bodyTimeoutMillis: 1000 });
  const launch = yield* makeObservationLaunchHttp(config, routes, control).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const intake = yield* makeNativeHttpIntake(config, NativeHttpPolicy.make({ routeId: id("b"), producer: O.some("managed-controller"),
    hashSalt: Redacted.make(salt), approvedModels: [], usageConvention: "unknown", bodyTimeoutMillis: 1000 }), control, routes)
    .pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const posts = yield* Ref.make(0);
  const socket = `${root}/collector/worker.sock`;
  const server = Context.get(yield* Layer.build(BunHttpServer.layer({ unix: socket })), HttpServer.HttpServer);
  yield* fs.chmod(socket, 0o600);
  yield* server.serve(Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.url !== "/v1/traces") return yield* launch.handler;
    const n = yield* Ref.updateAndGet(posts, (value) => value + 1);
    const response = yield* intake.handler;
    // Simulate the acknowledgment lost after the actual durable intake commit.
    return n === 1 ? HttpServerResponse.empty({ status: 503 }) : response;
  }));
  const profile = ManagedLaunchProfile.make({ provider: "codex", executable: process.execPath,
    prefixArgs: [path.resolve(import.meta.dirname, "../../../packages/drivers/ai-provider-cli/test/fixtures/managed-codex-peer.ts")],
    workspace: `${root}/workspace`, profileRoot: `${root}/home`, tools: [],
    env: { HOME: `${root}/home`, CODEX_HOME: `${root}/home/.codex`, PATH: "/usr/bin:/bin" } });
  const owner = AgentObservationOwner.make({ endpointId: "synthetic-controller-canary", ownerId: "synthetic-owner", generation: 1,
    repositoryScope: "synthetic-scope", workspace: profile.workspace, provider: profile.provider });
  const destination = ObservationLaunchClientPolicy.make({ directory: `${root}/collector`, hostId: config.hostId, namespaceId, timeoutMillis: 2000 });
  const provisioning = AgentObservationProvisioning.make({ owner, destination, evidenceEpoch: 0,
    claims: ObservationClaimPolicy.make({ directory: `${root}/claims`, journalDirectory: destination.directory,
      anchor: ObservationClaimAnchor.make({ fenceId: id("e"), hostId: config.hostId, namespaceId, maxClaims: 1 }) }),
    identity: ObservationLaunchIdentity.make({ routeId: id("c"), harness: "codex-cli", surface: "cli",
      root: { _tag: "Unknown" }, repository: { _tag: "Unknown" }, clone: { _tag: "Unknown" }, worktree: { _tag: "Unknown" },
      task: { _tag: "Unknown" }, attempt: { _tag: "Unknown" }, evidenceId: id("f") }) });
  yield* fs.writeFileString(`${root}/request/request.json`, yield* S.encodeEffect(S.fromJsonString(AgentObservationProvisioning))(provisioning), { mode: 0o600 });
  yield* initializeAgentObservationClaims(`${root}/request`);
  yield* enrollAgentObservation(`${root}/request`, `${root}/enrollment`);
  const input = ManagedControllerCanaryInput.make({ request: AgentObservationRequest.make({ profile, owner, enrollmentDirectory: O.some(`${root}/enrollment`) }),
    destination, ingressRouteId: id("b"), directory: `${root}/producer` });
  const native = yield* AiProviderCliSession;
  const opens = yield* Ref.make(0);
  const prompts = yield* Ref.make(0);
  const synthetic = { open: Effect.fnUntraced(function* (...args: Parameters<typeof native.open>) {
    yield* Ref.update(opens, (n) => n + 1);
    const session = yield* native.open(...args);
    return { ...session, prompt: Effect.fnUntraced(function* (...messages: Parameters<typeof session.prompt>) {
      yield* Ref.update(prompts, (n) => n + 1);
      return ManagedTurnResult.make({ ...yield* session.prompt(...messages), text: "ENROLLMENT_CANARY_OK" });
    }) };
  }) };
  yield* runManagedControllerCanary(input).pipe(Effect.provideService(AiProviderCliSession, synthetic), Effect.flip);
  const original = yield* fs.readFileString(`${root}/producer/event.json`);
  for (const privateValue of ["ENROLLMENT_CANARY_OK", "owned-thread", root, salt]) assert.equal(Str.includes(privateValue)(original), false);
  const result = yield* runManagedControllerCanary(input).pipe(Effect.provideService(AiProviderCliSession, synthetic));
  assert.equal(result.backendVisibility, "Unknown");
  assert.equal(yield* Ref.get(opens), 1);
  assert.equal(yield* Ref.get(prompts), 1);
  assert.equal(yield* Ref.get(posts), 2);
  assert.equal(yield* fs.readFileString(`${root}/producer/event.json`), original);
  const batch = O.getOrThrow(yield* intake.journal.readBatch(result.receiptId));
  assert.equal(batch.spans.length, 1);
  assert.equal(batch.spans[0]?.eventId, result.eventId);
  assert.equal(O.getOrThrow(O.getOrThrow(A.head(batch.spans)).managedController).launchRouteId, id("c"));
  assert.equal(O.getOrThrow(A.head(batch.spans)).routeId, id("b"));
  yield* Console.log("PASS: actual synthetic child to Unix intake/journal; lost acknowledgment retries immutable metadata with one source launch/turn and no private content.");
});
NodeRuntime.runMain(program.pipe(
  Effect.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, AiProviderCliSession.layer, Reactivity.layer,
    Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_AI_METRICS_HASH_SALT: salt })))),
  Effect.scoped, Effect.timeout("30 seconds")
));
