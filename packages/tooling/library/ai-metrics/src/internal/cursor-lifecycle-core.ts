/** Receiver-owned scoped Linux bridge; no hook installation or native invocation. */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { NativeLifecycleMetadata } from "../native-lifecycle.ts";
import { NativeTraceBatch, NativeTraceMetadata } from "../native-trace.ts";
import { hashPrivateIdentifier } from "../privacy.ts";
import {
  CursorLifecycleCodecs,
  failure,
  isCursorReportedEffort,
  isLifecycleError,
} from "./cursor-lifecycle-schemas.ts";
import { cursorPeerSource } from "./cursor-peer-source.ts";
import { qualifyInterpreterAncestors } from "./interpreter-path.ts";
import { hashObservationPayload } from "./native-trace-wire.ts";
import type { makeNativeIntakeJournal } from "../native-intake.ts";
import type { ObservationControl } from "../observation-control.ts";
import type {
  CursorLifecycleError,
  CursorLifecycleObserved,
  CursorLifecyclePolicy,
  CursorLifecycleSourceContract,
} from "./cursor-lifecycle-schemas.ts";

const { encodeJsonValue, decodeReady, decodeObserved } = CursorLifecycleCodecs;
const readBoundedInterpreter = Effect.fnUntraced(function* (file: FileSystem.File) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = yield* file.readAlloc(65536);
    if (O.isNone(chunk)) break;
    size += chunk.value.byteLength;
    if (size > 33554432) return yield* failure("enrollment");
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
});
const qualifySource = Effect.fnUntraced(function* (
  policy: CursorLifecyclePolicy,
  contract: CursorLifecycleSourceContract
) {
  if (
    policy.sourcePins.length !== 2 ||
    !A.every(contract.pins, (expected) =>
      A.some(policy.sourcePins, (pin) => pin.sha256 === expected.sha256 && Str.endsWith(expected.suffix)(pin.path))
    )
  )
    return yield* failure("enrollment");
  if ((yield* hashObservationPayload(new TextEncoder().encode(cursorPeerSource))) !== policy.helperSha256)
    return yield* failure("enrollment");
});
const qualifyInterpreter = Effect.fnUntraced(function* (policy: CursorLifecyclePolicy) {
  const fs = yield* FileSystem.FileSystem;
  // The fixed Python interpreter is root-owned and not writable by this UID.
  // Canonicality and a root-owned nonwritable parent chain prevent same-UID replacement.
  if ((yield* fs.realPath(policy.pythonExecutable)) !== policy.pythonExecutable) return yield* failure("enrollment");
  yield* qualifyInterpreterAncestors(policy.pythonExecutable);
  const python = yield* fs.open(policy.pythonExecutable, { noFollow: true });
  const before = yield* python.stat;
  if (
    before.type !== "File" ||
    !O.contains(before.uid, 0) ||
    (before.mode & 0o022) !== 0 ||
    before.size > BigInt(33554432)
  )
    return yield* failure("enrollment");
  const bytes = yield* readBoundedInterpreter(python);
  const after = yield* python.stat;
  if (
    O.getOrUndefined(before.ino) !== O.getOrUndefined(after.ino) ||
    before.size !== after.size ||
    (yield* hashObservationPayload(bytes)) !== policy.pythonSha256
  )
    return yield* failure("enrollment");
});
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
  const span = NativeTraceMetadata.make({
    eventId,
    namespaceId,
    routeId: policy.routeId,
    traceId: Str.slice(0, 32)(trace),
    spanId: Str.slice(0, 16)(eventId),
    parentSpanId: O.none(),
    nameHash: O.none(),
    kind: "CHAIN",
    startTimeUnixNano: O.none(),
    endTimeUnixNano: O.none(),
    durationKnown: false,
    status: "unset",
    sessionHash: O.some(session),
    modelHash: O.none(),
    modelName: O.none(),
    nativeLifecycle: O.some(lifecycle),
    usage: {
      convention: "unknown",
      input: O.none(),
      output: O.none(),
      cacheRead: O.none(),
      cacheWrite: O.none(),
    },
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
  const { journal, control } = yield* CursorLifecycleRuntime;
  const open = Effect.fn("AiMetrics.cursorLifecycle.open")(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cursor-lifecycle-" });
    const socketPath = `${directory}/s`;
    const ready = yield* Deferred.make<void, CursorLifecycleError>();
    const work = Effect.scoped(
      Effect.gen(function* () {
        const { child, next, input } = yield* Effect.gen(function* () {
          yield* qualifySource(policy, sourceContract);
          yield* qualifyInterpreter(policy);
          const input = yield* Queue.unbounded<Uint8Array>();
          const publicPolicy = yield* encodeJsonValue({
            workspace: policy.workspace,
            runtimeExecutable: policy.runtimeExecutable,
            runtimeSha256: policy.runtimeSha256,
            sourcePins: policy.sourcePins,
          });
          yield* Queue.offer(input, new TextEncoder().encode(`${publicPolicy}\n`));
          const child = yield* ChildProcess.make(
            policy.pythonExecutable,
            ["-I", "-B", "-c", cursorPeerSource, socketPath],
            {
              extendEnv: false,
              stdin: Stream.fromQueue(input),
              stderr: "ignore",
              killSignal: "SIGKILL",
            }
          );
          let outputBytes = 0;
          const next = yield* child.stdout.pipe(
            Stream.mapEffect((chunk) => {
              outputBytes += chunk.byteLength;
              return outputBytes > 16384 ? Effect.fail(failure("kernel-binding")) : Effect.succeed(chunk);
            }),
            Stream.decodeText(),
            Stream.splitLines,
            Stream.rechunk(1),
            Stream.toPull
          );
          const readiness = yield* next;
          yield* decodeReady(readiness[0]).pipe(Effect.mapError(() => failure("kernel-binding")));
          return { child, next, input };
        }).pipe(Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.fail(failure("transport")) }));
        // Startup has its own bound; readiness starts the full receive and commit window.
        return yield* Effect.gen(function* () {
          yield* Deferred.succeed(ready, undefined);
          const message = yield* next;
          const observed = yield* decodeObserved(message[0]).pipe(Effect.mapError(() => failure("callback")));
          const batch = yield* projectOccurrence(policy, observed);
          const receipt = yield* journal.acceptBatch(batch);
          const acknowledgement = yield* encodeJsonValue({
            receiptId: receipt.page.receiptId,
            accepted: receipt.accepted,
            rejected: receipt.rejected,
          });
          yield* Queue.offer(input, new TextEncoder().encode(`${acknowledgement}\n`));
          if ((yield* child.exitCode) !== 0) return yield* failure("transport");
          return receipt;
        }).pipe(Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.fail(failure("transport")) }));
      })
    );
    const running = yield* Effect.forkChild(
      control.run(work).pipe(
        Effect.mapError((error) => (isLifecycleError(error) ? error : failure("transport"))),
        Effect.tapError((error) => Deferred.fail(ready, error)),
        Effect.tapCause(() => Deferred.fail(ready, failure("transport")))
      )
    );
    yield* Deferred.await(ready);
    return { socketPath, accept: Fiber.join(running) };
  });
  return { open };
});
