#!/usr/bin/env bun
/**
 * One actual managed canary and immutable controller metadata delivery.
 * Existing event files retry metadata only; uncertain source attempts never relaunch.
 * @packageDocumentation
 * @since 0.0.0
 */
import { AiProviderCliSession } from "@beep/ai-provider-cli";
import { $RepoCliId } from "@beep/identity/packages";
import {
  encodeManagedControllerObservation,
  ManagedControllerObservation,
} from "@beep/repo-ai-metrics/managed-controller";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { ObservationLaunchOutbox } from "@beep/repo-ai-metrics/observation-launch-claims";
import {
  makeObservationLaunchClient,
  ObservationLaunchClientPolicy,
} from "@beep/repo-ai-metrics/observation-launch-client";
import { ObservationLaunchFact } from "@beep/repo-ai-metrics/observation-launch-facts";
import { hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { requirePrivateAgentPath } from "../../../packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.layer.ts";
import {
  AgentObservationRequest,
  recoverAgentObservation,
} from "../../../packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.observation.ts";
import { CliEnrollmentCanaryReport, runCliEnrollmentCanary } from "./cli-enrollment-canary.ts";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/managed-controller-canary");

/**
 * Existing private enrollment plus an explicitly admitted local destination and new outbox.
 * **Example** (Inspect the request constructor)
 * ```ts
 * console.log(typeof ManagedControllerCanaryInput.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ManagedControllerCanaryInput extends S.Opaque<
  ManagedControllerCanaryInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("managed-controller-canary-input/v1"),
    request: AgentObservationRequest,
    destination: ObservationLaunchClientPolicy,
    ingressRouteId: Sha256Hex,
    directory: S.NonEmptyString.check(S.isMaxLength(4096)),
  }).pipe(
    $I.annoteSchema("ManagedControllerCanaryInput", {
      description: "Explicit enrollment, private pinned worker and immutable metadata outbox; no raw prompt flags.",
    })
  )
) {}

const proof = S.Struct({
  report: CliEnrollmentCanaryReport,
  outbox: ObservationLaunchOutbox,
  start: S.String,
  end: S.String,
  elapsed: S.String,
}).pipe(
  $I.annoteSchema("ManagedControllerProof", {
    description: "Exact safe report joined to its original lifecycle evidence and observed interval.",
  })
);

class ManagedControllerEnvelope extends S.Opaque<ManagedControllerEnvelope, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("managed-controller-envelope/v1"),
    binding: Sha256Hex,
    payloadDigest: Sha256Hex,
    proof,
    observation: ManagedControllerObservation,
    routeId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
  }).pipe(
    $I.annoteSchema("ManagedControllerEnvelope", {
      description: "Immutable source evidence and payload digest; replay never performs source activity.",
    })
  )
) {}
class ManagedControllerProducerError extends S.TaggedError<
  ManagedControllerProducerError,
  { readonly brand: unique symbol }
>($I`ManagedControllerProducerError`)(
  "ManagedControllerProducerError",
  { reason: S.Literals(["input", "uncertain-source", "identity", "delivery", "unresolved"]) },
  $I.annote("ManagedControllerProducerError", {
    description: "Fixed producer refusal without source text, response or secret values.",
  })
) {}

const digestPayload = Effect.fn("HarnessEnrollment.controllerPayloadDigest")(function* (body: Uint8Array) {
  const digest = yield* Digest.Digest;
  return yield* digest
    .digest(Digest.sha256, body)
    .pipe(Effect.map(Hex.encode), Effect.flatMap(S.decodeUnknownEffect(Sha256Hex)));
});
const encodeInput = S.encodeEffect(S.fromJsonString(ManagedControllerCanaryInput));
const encodeEnvelope = S.encodeEffect(S.fromJsonString(ManagedControllerEnvelope));
const decodeEnvelope = S.decodeEffect(S.fromJsonString(ManagedControllerEnvelope), { onExcessProperty: "error" });
const fail = (reason: ManagedControllerProducerError["reason"]) => ManagedControllerProducerError.make({ reason });

/**
 * Run at most once, durably capture the observed controller event, then submit one immutable payload.
 *
 * An existing event only resends metadata; a pending marker without an event is
 * unknown and requires owner reconciliation. Native event/readback machinery is
 * reused. The result is local acceptance only, never backend visibility.
 *
 * **Example** (Build the producer effect)
 * ```ts
 * console.log(typeof runManagedControllerCanary)
 * ```
 * @param input - Explicit existing enrollment and private worker/outbox policy.
 * @returns Exact safe event identity and the original local intake receipt.
 * @category verification
 * @since 0.0.0
 */
export const runManagedControllerCanary = Effect.fn("HarnessEnrollment.managedControllerCanary")(
  function* (input: ManagedControllerCanaryInput) {
    if (O.isNone(input.request.enrollmentDirectory)) return yield* fail("input");
    const fs = yield* FileSystem.FileSystem;
    const uid = process.geteuid?.() ?? -1;
    yield* requirePrivateAgentPath(input.directory, "Directory");
    if (!O.contains((yield* fs.lstat(input.directory)).uid, uid)) return yield* fail("input");
    const binding = yield* hashPublicTextSha256(yield* encodeInput(input));
    const eventFile = `${input.directory}/event.json`;
    const attemptFile = `${input.directory}/attempt`;
    const client = yield* makeObservationLaunchClient(input.destination, uid);
    const context = yield* client.context;
    if (!context.accepting) return yield* fail("delivery");
    let event: ManagedControllerEnvelope;
    if (yield* fs.exists(eventFile)) {
      yield* requirePrivateAgentPath(eventFile, "File");
      const info = yield* fs.lstat(eventFile);
      if (!O.contains(info.uid, uid) || info.size > 32768n || !(yield* fs.exists(attemptFile)))
        return yield* fail("input");
      event = yield* decodeEnvelope(yield* fs.readFileString(eventFile));
      if (event.binding !== binding) return yield* fail("identity");
    } else {
      // Create-only marker precedes the only source call. A crash cannot authorize another call.
      yield* fs
        .writeFileString(attemptFile, binding, { flag: "wx", mode: 0o600 })
        .pipe(Effect.mapError(() => fail("uncertain-source")));
      const start = yield* Clock.currentTimeNanos;
      const monoStart = yield* Clock.monotonicTimeNanos;
      const report = yield* runCliEnrollmentCanary(input.request);
      const elapsed = (yield* Clock.monotonicTimeNanos) - monoStart;
      const end = yield* Clock.currentTimeNanos;
      const local = yield* recoverAgentObservation(input.request.enrollmentDirectory.value, "status");
      const facts = A.map(local.outbox.submissions, (entry) => entry.fact);
      const prepared = A.findFirst(facts, ObservationLaunchFact.guards.Prepared);
      const started = A.findFirst(facts, ObservationLaunchFact.guards.Started);
      const session = A.findFirst(facts, ObservationLaunchFact.guards.SessionBound);
      if (O.isNone(prepared) || O.isNone(started) || O.isNone(session)) return yield* fail("identity");
      const claim = local.outbox.claim.submission;
      if (
        claim.hostId !== input.destination.hostId ||
        claim.namespaceId !== input.destination.namespaceId ||
        claim.evidenceEpoch !== context.evidenceEpoch
      )
        return yield* fail("identity");
      const sourceProof = { report, outbox: local.outbox, start: `${start}`, end: `${end}`, elapsed: `${elapsed}` };
      const evidenceId = yield* hashPublicTextSha256(yield* S.encodeEffect(S.fromJsonString(proof))(sourceProof));
      const observation = yield* S.decodeUnknownEffect(ManagedControllerObservation)({
        version: "managed-controller-observation/v1",
        outcome: "completed",
        response: "exact-constant-matched",
        launchId: prepared.value.launchId,
        launchRouteId: prepared.value.identity.routeId,
        processInstanceId: started.value.processInstanceId,
        sourceSessionId: session.value.sourceSessionId,
        evidenceId,
        startTimeUnixNano: `${start}`,
        endTimeUnixNano: `${end}`,
        elapsedNanos: `${elapsed}`,
      });
      const body = yield* encodeManagedControllerObservation(observation);
      // Native ingress route is explicit separately from the harness-specific launch route.
      const routeId = input.ingressRouteId;
      event = ManagedControllerEnvelope.make({
        binding,
        proof: sourceProof,
        observation,
        routeId,
        namespaceId: context.namespaceId,
        evidenceEpoch: context.evidenceEpoch,
        payloadDigest: yield* digestPayload(body),
      });
      yield* Effect.scoped(
        Effect.gen(function* () {
          const file = yield* fs.open(eventFile, { flag: "wx", mode: 0o600 });
          yield* file.writeAll(new TextEncoder().encode(yield* encodeEnvelope(event)));
          yield* file.sync;
          const directory = yield* fs.open(input.directory, { flag: "r" });
          yield* directory.sync;
        })
      );
    }
    if (
      event.routeId !== input.ingressRouteId ||
      (yield* hashPublicTextSha256(yield* S.encodeEffect(S.fromJsonString(proof))(event.proof))) !==
        event.observation.evidenceId
    )
      return yield* fail("identity");
    if (event.namespaceId !== context.namespaceId || event.evidenceEpoch !== context.evidenceEpoch)
      return yield* fail("identity");
    const body = yield* encodeManagedControllerObservation(event.observation);
    if ((yield* digestPayload(body)) !== event.payloadDigest) return yield* fail("identity");
    // Reconcile source lifecycle metadata first. Missing/uncertain acknowledgments never relaunch.
    const accepted = yield* recoverAgentObservation(input.request.enrollmentDirectory.value, "reconcile");
    if (
      accepted.outbox.receipts.length !== 4 ||
      accepted.outbox.claim.submission.fact.launchId !== event.observation.launchId
    )
      return yield* fail("delivery");
    const salt = yield* Config.Redacted("BEEP_AI_METRICS_HASH_SALT");
    const projected = yield* projectNativeTraceRequest(
      NativeTraceRequest.make({
        routeId: event.routeId,
        hashSalt: salt,
        producer: O.some("managed-controller"),
        body,
        contentType: "application/x-protobuf",
        approvedModels: [],
        usageConvention: "unknown",
      })
    );
    if (
      projected.namespaceId !== context.namespaceId ||
      projected.spans.length !== 1 ||
      projected.rejections.length !== 0
    )
      return yield* fail("identity");
    const expected = O.getOrThrow(A.head(projected.spans));
    // The existing client pins directory/socket inodes; recheck immediately before this exchange.
    yield* client.context;
    const transport = Context.get(
      yield* Layer.build(
        NodeHttpClient.layerNodeHttpOptions({
          socketPath: `${input.destination.directory}/worker.sock`,
          keepAlive: false,
          maxSockets: 1,
        })
      ),
      HttpClient.HttpClient
    );
    const receiptId = yield* Effect.gen(function* () {
      const response = yield* transport.execute(
        HttpClientRequest.post("http://localhost/v1/traces").pipe(
          HttpClientRequest.bodyUint8Array(body),
          HttpClientRequest.setHeader("content-type", "application/x-protobuf")
        )
      );
      // Full protobuf success is empty. Partial/refusal bodies are never retained or printed.
      const responseBytes = yield* response.stream.pipe(
        Stream.runFold(
          () => 0,
          (count, chunk) => count + chunk.byteLength
        )
      );
      if (response.status !== 200 || responseBytes !== 0) return yield* fail("delivery");
      return yield* S.decodeUnknownEffect(Sha256Hex)(response.headers["x-observation-receipt"]);
    }).pipe(
      Effect.timeoutOrElse({ duration: input.destination.timeoutMillis, orElse: () => Effect.fail(fail("delivery")) })
    );
    return ManagedControllerLocalReport.make({
      eventId: expected.eventId,
      traceId: expected.traceId,
      spanId: expected.spanId,
      receiptId,
    });
  },
  (effect) =>
    effect.pipe(
      Effect.timeoutOrElse({ duration: "180 seconds", orElse: () => Effect.fail(fail("unresolved")) }),
      Effect.scoped,
      Effect.provide(Logger.layer([]))
    )
);

/**
 * Local durable acceptance and exact expected identity, without a backend assertion.
 * **Example** (Inspect the report constructor)
 * ```ts
 * console.log(typeof ManagedControllerLocalReport.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ManagedControllerLocalReport extends S.Opaque<
  ManagedControllerLocalReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    eventId: Sha256Hex,
    traceId: S.String.check(S.isPattern(/^[0-9a-f]{32}$/)),
    spanId: S.String.check(S.isPattern(/^[0-9a-f]{16}$/)),
    receiptId: Sha256Hex,
    backendVisibility: S.tag("Unknown"),
  }).pipe(
    $I.annoteSchema("ManagedControllerLocalReport", {
      description: "Exact local event/receipt metadata; no backend visibility inference.",
    })
  )
) {}
const program = Effect.gen(function* () {
  const [filename] = yield* S.decodeUnknownEffect(S.Tuple([S.String]))(A.drop(process.argv, 2));
  yield* requirePrivateAgentPath(filename, "File");
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.lstat(filename);
  if (!O.contains(info.uid, process.geteuid?.() ?? -1) || info.size > 65536n) return yield* fail("input");
  const input = yield* S.decodeEffect(S.fromJsonString(ManagedControllerCanaryInput), { onExcessProperty: "error" })(
    yield* fs.readFileString(filename)
  );
  const report = yield* runManagedControllerCanary(input);
  yield* Console.log(yield* S.encodeEffect(S.fromJsonString(ManagedControllerLocalReport))(report));
});
if (import.meta.main)
  NodeRuntime.runMain(
    program.pipe(
      Effect.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, AiProviderCliSession.layer)),
      Effect.catchCause(() => Effect.fail(fail("unresolved"))),
      Effect.tapError(() =>
        Console.error("Managed controller observation unresolved; retain the source attempt and immutable metadata.")
      )
    ),
    { disableErrorReporting: true }
  );
