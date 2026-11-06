/** Cowork-only occurrence projection over the shared durable local bridge. */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { ClaudeCoworkLifecycleMetadata } from "../native-lifecycle.ts";
import { NativeTraceBatch } from "../native-trace.ts";
import { hashPrivateIdentifier } from "../privacy.ts";
import { CoworkLifecycleCodecs } from "./cowork-lifecycle-schemas.ts";
import { coworkPeerSource } from "./cowork-peer-source.ts";
import { CursorLifecyclePolicy, failure } from "./cursor-lifecycle-schemas.ts";
import { makeLifecycleBridge } from "./lifecycle-bridge.ts";
import { makeLifecyclePoint } from "./lifecycle-point.ts";
import type { CoworkLifecyclePolicy } from "./cowork-lifecycle-schemas.ts";
import type { CursorLifecycleRuntime } from "./cursor-lifecycle-core.ts";
import type { CursorLifecycleSourceContract } from "./cursor-lifecycle-schemas.ts";

/** Receiver-owned journal and control resources, separate from callback data.
 * @category services
 * @since 0.0.0
 */
export class CoworkLifecycleRuntime extends Context.Service<
  CoworkLifecycleRuntime,
  Context.Service.Shape<typeof CursorLifecycleRuntime>
>()($RepoAiMetricsId.create("claude-cowork-lifecycle")`CoworkLifecycleRuntime`) {}
const project = Effect.fnUntraced(function* (policy: CoworkLifecyclePolicy, message: string) {
  const { peer, callback: envelope } = yield* CoworkLifecycleCodecs.decodeObserved(message).pipe(
    Effect.mapError(() => failure("callback"))
  );
  if (
    peer.cwd !== policy.workspace ||
    peer.runtimeSha256 !== policy.runtimeSha256 ||
    peer.appPid !== policy.appPid ||
    peer.appStartTicks !== policy.appStartTicks
  )
    return yield* failure("kernel-binding");
  const salt = policy.hashSalt.pipe(Redacted.value);
  const hash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
  const native = envelope.callback;
  const runtime = yield* hash(
    `cowork-runtime/v1:${policy.enrollmentId}:${peer.runtimePid}:${peer.runtimeStartTicks}:${peer.runtimeSha256}:${peer.appPid}:${peer.appStartTicks}:${policy.rootId}`
  );
  const session = yield* hash(`cowork-session/v1:${native.session_id}`);
  const occurrence = yield* hash(`cowork-occurrence/v1:${policy.enrollmentId}:${envelope.occurrenceId}`);
  // Same occurrence ID keeps one event identity, so conflicting payloads cannot become another event.
  const eventId = yield* hash(`cowork-event/v1:${runtime}:${occurrence}`);
  const lifecycle = ClaudeCoworkLifecycleMetadata.make({
    kind: native.hook_event_name === "SessionStart" ? "sessionStart" : "sessionEnd",
    occurrenceHash: occurrence,
    enrollmentId: policy.enrollmentId,
    sessionHash: session,
    generationHash: O.none(),
    runtimeInstanceId: runtime,
    rootId: policy.rootId,
    hostId: policy.hostId,
    reportedSource: O.fromUndefinedOr(native.source),
    reportedReason: O.fromUndefinedOr(native.reason),
    reportedDurationMillis: O.none(),
    reportedStatus: O.none(),
    reportedModelId: O.none(),
    reportedEffort: O.none(),
  });
  const namespaceId = yield* hash("ai-metrics-hash-salt-namespace/v1");
  const traceId = yield* hash(`cowork-trace/v1:${session}`);
  return NativeTraceBatch.make({
    requestId: yield* hash(`cowork-request/v1:${eventId}`),
    namespaceId,
    routeId: policy.routeId,
    spans: [
      makeLifecyclePoint({
        eventId,
        namespaceId,
        routeId: policy.routeId,
        traceId: Str.slice(0, 32)(traceId),
        spanId: Str.slice(0, 16)(eventId),
        sessionHash: O.some(session),
        nativeLifecycle: O.some(lifecycle),
      }),
    ],
    rejections: [],
  });
});
/** Private constructor used by the fixed production contract and synthetic test port. */
export const makeCoworkLifecycleCore = Effect.fn("AiMetrics.coworkLifecycle.make")(function* (
  policy: CoworkLifecyclePolicy,
  contract: CursorLifecycleSourceContract
) {
  const runtime = yield* CoworkLifecycleRuntime;
  return yield* makeLifecycleBridge(
    CursorLifecyclePolicy.make(policy),
    contract,
    runtime,
    coworkPeerSource,
    {
      workspace: policy.workspace,
      runtimeExecutable: policy.runtimeExecutable,
      runtimeSha256: policy.runtimeSha256,
      sourcePins: policy.sourcePins,
      appExecutable: policy.appExecutable,
      appSha256: policy.appSha256,
      appPid: policy.appPid,
      appStartTicks: policy.appStartTicks,
      listenMillis: policy.listenMillis,
    },
    (message) => project(policy, message).pipe(Effect.mapError(() => failure("callback"))),
    1000,
    policy.socketPath,
    policy.listenMillis + 2000
  );
});
