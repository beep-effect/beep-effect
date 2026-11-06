/** Receiver-owned scoped Linux bridge; no hook installation or native invocation. */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { NativeLifecycleMetadata } from "../native-lifecycle.ts";
import { NativeTraceBatch } from "../native-trace.ts";
import { hashPrivateIdentifier } from "../privacy.ts";
import {
  CursorLifecycleCodecs,
  failure,
  isCursorReportedEffort,
  isLifecycleError,
} from "./cursor-lifecycle-schemas.ts";
import { cursorPeerSource } from "./cursor-peer-source.ts";
import { makeLifecycleBridge } from "./lifecycle-bridge.ts";
import { makeLifecyclePoint } from "./lifecycle-point.ts";
import type { makeNativeIntakeJournal } from "../native-intake.ts";
import type { ObservationControl } from "../observation-control.ts";
import type {
  CursorLifecycleObserved,
  CursorLifecyclePolicy,
  CursorLifecycleSourceContract,
} from "./cursor-lifecycle-schemas.ts";

const { decodeObserved } = CursorLifecycleCodecs;
const projectOccurrence = Effect.fnUntraced(function* (
  policy: CursorLifecyclePolicy,
  observed: CursorLifecycleObserved
) {
  const { peer, callback: native } = observed;
  const salt = policy.hashSalt.pipe(Redacted.value);
  const hash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
  if (peer.cwd !== policy.workspace || peer.runtimeSha256 !== policy.runtimeSha256)
    return yield* failure("kernel-binding");
  const runtime = yield* hash(
    `cursor-runtime/v1:${peer.runtimePid}:${peer.runtimeStartTicks}:${peer.runtimeSha256}:${peer.cwd}:${policy.rootId}:${policy.routeId}`
  );
  const session = yield* hash(`cursor-session/v1:${native.session_id}`);
  const generationValue =
    native.generation_id === undefined ? undefined : yield* hash(`cursor-generation/v1:${native.generation_id}`);
  const generation = O.fromUndefinedOr(generationValue);
  const eventId = yield* hash(
    `cursor-lifecycle/v1:${runtime}:${session}:${O.getOrElse(generation, () => "Unknown")}:${native.hook_event_name}`
  );
  const reportedModel = native.model_id ?? native.model;
  const effort = O.getOrUndefined(
    O.map(
      A.findFirst(native.model_params ?? [], (entry) => entry.id === "effort"),
      (entry) => entry.value
    )
  );
  const lifecycle = NativeLifecycleMetadata.make({
    kind: native.hook_event_name,
    sessionHash: session,
    generationHash: generation,
    runtimeInstanceId: runtime,
    rootId: policy.rootId,
    hostId: policy.hostId,
    reportedDurationMillis: O.fromUndefinedOr(native.duration_ms),
    reportedReason: O.fromUndefinedOr(native.reason),
    reportedStatus: O.fromUndefinedOr(native.final_status),
    reportedModelId: O.fromUndefinedOr(reportedModel).pipe(
      O.filter((model) => A.contains(policy.approvedModels, model))
    ),
    reportedEffort: O.fromUndefinedOr(effort).pipe(O.filter(isCursorReportedEffort)),
  });
  const namespaceId = yield* hash("ai-metrics-hash-salt-namespace/v1");
  const trace = yield* hash(`cursor-trace/v1:${session}`);
  const span = makeLifecyclePoint({
    eventId,
    namespaceId,
    routeId: policy.routeId,
    traceId: Str.slice(0, 32)(trace),
    spanId: Str.slice(0, 16)(eventId),
    sessionHash: O.some(session),
    nativeLifecycle: O.some(lifecycle),
  });
  const batch = NativeTraceBatch.make({
    requestId: yield* hash(`cursor-request/v1:${eventId}`),
    namespaceId,
    routeId: policy.routeId,
    spans: [span],
    rejections: [],
  });

  return batch;
});
/** Server-owned journal and pause gate; these resources are not callback data.
 * @category services
 * @since 0.0.0
 */
export class CursorLifecycleRuntime extends Context.Service<
  CursorLifecycleRuntime,
  {
    readonly journal: Effect.Success<ReturnType<typeof makeNativeIntakeJournal>>;
    readonly control: ObservationControl;
  }
>()($RepoAiMetricsId.create("cursor-lifecycle")`CursorLifecycleRuntime`) {}
export const makeCursorLifecycleCore = Effect.fn("AiMetrics.cursorLifecycle.make")(function* (
  policy: CursorLifecyclePolicy,
  sourceContract: CursorLifecycleSourceContract
) {
  const runtime = yield* CursorLifecycleRuntime;
  return yield* makeLifecycleBridge(
    policy,
    sourceContract,
    runtime,
    cursorPeerSource,
    {
      workspace: policy.workspace,
      runtimeExecutable: policy.runtimeExecutable,
      runtimeSha256: policy.runtimeSha256,
      sourcePins: policy.sourcePins,
    },
    Effect.fnUntraced(
      function* (message: string) {
        const observed = yield* decodeObserved(message).pipe(Effect.mapError(() => failure("callback")));
        return yield* projectOccurrence(policy, observed);
      },
      Effect.mapError((error) => (isLifecycleError(error) ? error : failure("transport")))
    )
  );
});
