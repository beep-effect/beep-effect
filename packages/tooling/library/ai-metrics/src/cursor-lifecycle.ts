/** Passive Cursor CLI observations. This module does not install hooks.
 * @packageDocumentation
 * @since 0.0.0
 */

import { createConnection } from "node:net";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { cursorPeerSource } from "./internal/cursor-peer-source.ts";
import { hashObservationPayload } from "./internal/native-trace-wire.ts";
import { NativeLifecycleMetadata } from "./native-lifecycle.ts";
import { NativeTraceBatch, NativeTraceMetadata } from "./native-trace.ts";
import { hashPrivateIdentifier } from "./privacy.ts";
import type { makeNativeIntakeJournal } from "./native-intake.ts";
import type { ObservationControl } from "./observation-control.ts";

const $I = $RepoAiMetricsId.create("cursor-lifecycle");
const Path = S.String.check(S.isPattern(/^\/[\x20-\x7e]{1,1023}$/));
const Id = S.String.check(S.isMinLength(1), S.isMaxLength(256));
const PublicId = S.String.check(S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/));
const Reason = S.Literals(["completed", "aborted", "error", "window_close", "user_close"]);
const Callback = S.Struct({
  hook_event_name: S.Literals(["sessionStart", "sessionEnd"]),
  cursor_version: S.tag("2026.11.05-86047df"),
  session_id: Id,
  conversation_id: Id,
  generation_id: S.optionalKey(Id),
  is_background_agent: S.tag(false),
  reason: S.optionalKey(Reason),
  final_status: S.optionalKey(Reason),
  duration_ms: S.optionalKey(S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))),
  model: S.optionalKey(PublicId),
  model_id: S.optionalKey(PublicId),
  model_params: S.optionalKey(S.Array(S.Struct({ id: PublicId, value: PublicId })).check(S.isMaxLength(16))),
}).check(
  S.makeFilter(
    (v) =>
      v.session_id === v.conversation_id &&
      (v.hook_event_name === "sessionEnd"
        ? v.reason !== undefined && v.duration_ms !== undefined
        : v.reason === undefined && v.duration_ms === undefined && v.final_status === undefined),
    { identifier: "CursorLifecycleShape", message: "Native lifecycle identity and kind must agree" }
  )
);
const decodeCallback = S.decodeUnknownEffect(S.fromJsonString(Callback));
const encodeCallback = S.encodeEffect(S.fromJsonString(Callback));
const Acknowledgement = S.Struct({ receiptId: Sha256Hex, accepted: S.Natural, rejected: S.Natural });
const decodeAcknowledgement = S.decodeUnknownEffect(S.fromJsonString(Acknowledgement));
const Kernel = S.Struct({
  peerPid: S.Int,
  peerStartTicks: Id,
  runtimePid: S.Int,
  runtimeStartTicks: Id,
  runtimeSha256: Sha256Hex,
  cwd: Path,
  uid: S.Natural,
});
const JsonValue = S.fromJsonString(S.Unknown);
const encodeJsonValue = S.encodeUnknownEffect(JsonValue);
const decodeReady = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ ready: S.tag(true) })));
const decodeObserved = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ peer: Kernel, callback: Callback })));

/** Receiver-owned enrollment; never decoded from the callback or OTLP attributes.
 * **Example** (Inspect receiver configuration)
 * ```ts
 * import { CursorLifecyclePolicy } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(typeof CursorLifecyclePolicy.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CursorLifecyclePolicy extends S.Opaque<CursorLifecyclePolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    workspace: Path,
    runtimeExecutable: Path,
    runtimeSha256: Sha256Hex,
    sourcePins: S.Array(S.Struct({ path: Path, sha256: Sha256Hex })).check(S.isMinLength(2), S.isMaxLength(8)),
    helperSha256: Sha256Hex,
    pythonExecutable: Path,
    pythonSha256: Sha256Hex,
    rootId: Sha256Hex,
    hostId: Sha256Hex,
    routeId: Sha256Hex,
    hashSalt: S.Redacted(S.String.check(S.isMinLength(16))),
    approvedModels: S.Array(PublicId).check(S.isMaxLength(32)),
  }).pipe(
    $I.annoteSchema("CursorLifecyclePolicy", {
      description: "Private receiver enrollment of public source pins, canonical runtime/root and salted namespace.",
    })
  )
) {}

/** Finite content-free refusal; native auth and inference remain unknown.
 * **Example** (Inspect a refusal)
 * ```ts
 * import { CursorLifecycleError } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(CursorLifecycleError.make({ reason: "callback" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CursorLifecycleError extends S.TaggedError<CursorLifecycleError, { readonly brand: unique symbol }>(
  $I`CursorLifecycleError`
)(
  "CursorLifecycleError",
  { reason: S.Literals(["enrollment", "kernel-binding", "callback", "transport"]) },
  $I.annote("CursorLifecycleError", { description: "Payload-free passive lifecycle refusal." })
) {}
const isLifecycleError = S.is(CursorLifecycleError);
const failure = (reason: CursorLifecycleError["reason"]) => CursorLifecycleError.make({ reason });

/** Build an inert socket handler over an existing durable journal and pause gate.
 * **Details** The host owns the Unix listener, enrollment and journal. The bounded
 * helper owns its Unix listener and observes SO_PEERCRED plus /proc ancestry.
 * Callback text cannot mint root/runtime/assurance fields. The result becomes an
 * ACK only after the existing journal transaction commits. The scoped open method serves one callback at a private ephemeral socket; it never installs hooks. Same-UID peers are nonexclusive source evidence.
 * **Example** (Inspect the bridge factory)
 * ```ts
 * import { makeCursorLifecycleReceiver } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(typeof makeCursorLifecycleReceiver)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeCursorLifecycleReceiver = (options: {
  readonly policy: CursorLifecyclePolicy;
  readonly journal: Effect.Success<ReturnType<typeof makeNativeIntakeJournal>>;
  readonly control: ObservationControl;
}) => {
  const { policy, journal, control } = options;
  const salt = policy.hashSalt.pipe(Redacted.value);
  const hash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
  const open = Effect.fn("AiMetrics.cursorLifecycle.open")(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cursor-lifecycle-" });
    const socketPath = `${directory}/s`;
    const ready = yield* Deferred.make<void, CursorLifecycleError>();
    const work = Effect.scoped(
      Effect.gen(function* () {
        const expectedPins = [
          { name: "1212.index.js", sha256: "15b18cb92aa4093acc886d1ef6f6f308bc97a9abca69b89cde805f91e9760042" },
          { name: "5504.index.js", sha256: "02ddf6e240a6f229fcf6e2b414479b26dfd4ad64199fd33ce7a872a391d6fe9c" },
        ];
        if (
          policy.sourcePins.length !== 2 ||
          !A.every(expectedPins, (expected) =>
            A.some(
              policy.sourcePins,
              (pin) => pin.sha256 === expected.sha256 && Str.endsWith(`/2026.11.05-86047df/${expected.name}`)(pin.path)
            )
          )
        )
          return yield* failure("enrollment");
        if ((yield* hashObservationPayload(new TextEncoder().encode(cursorPeerSource))) !== policy.helperSha256)
          return yield* failure("enrollment");
        // The fixed Python interpreter is root-owned and not writable by this UID.
        // Parent canonicality plus noFollow closes the final-component path gap.
        if ((yield* fs.realPath(policy.pythonExecutable)) !== policy.pythonExecutable)
          return yield* failure("enrollment");
        const python = yield* fs.open(policy.pythonExecutable, { noFollow: true });
        const before = yield* python.stat;
        if (
          before.type !== "File" ||
          !O.contains(before.uid, 0) ||
          (before.mode & 0o022) !== 0 ||
          before.size > BigInt(33554432)
        )
          return yield* failure("enrollment");
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const chunk = yield* python.readAlloc(65536);
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
        const after = yield* python.stat;
        if (
          O.getOrUndefined(before.ino) !== O.getOrUndefined(after.ino) ||
          before.size !== after.size ||
          (yield* hashObservationPayload(bytes)) !== policy.pythonSha256
        )
          return yield* failure("enrollment");
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
        yield* Deferred.succeed(ready, undefined);
        const message = yield* next;
        const observed = yield* decodeObserved(message[0]).pipe(Effect.mapError(() => failure("callback")));
        const { peer, callback: native } = observed;
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
          reportedEffort:
            effort === "low" || effort === "medium" || effort === "high" || effort === "xhigh"
              ? O.some(effort)
              : O.none(),
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
        const receipt = yield* journal.acceptBatch(batch);
        const acknowledgement = yield* encodeJsonValue({
          receiptId: receipt.page.receiptId,
          accepted: receipt.accepted,
          rejected: receipt.rejected,
        });
        yield* Queue.offer(input, new TextEncoder().encode(`${acknowledgement}\n`));
        if ((yield* child.exitCode) !== 0) return yield* failure("transport");
        return receipt;
      })
    ).pipe(Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.fail(failure("transport")) }));
    const running = yield* Effect.forkChild(
      control.run(work).pipe(
        Effect.mapError((error) => (isLifecycleError(error) ? error : failure("transport"))),
        Effect.tapCause(() => Deferred.fail(ready, failure("transport")))
      )
    );
    yield* Deferred.await(ready);
    return { socketPath, accept: Fiber.join(running) };
  });
  return { open };
};

/** Project and forward one callback; this function never prints hook output.
 * **Details** Only the positive native envelope reaches the private socket. An
 * uncertain transport response is not replayed here. Cursor fire-and-forget loss
 * remains unknown, and a local receipt is not backend delivery. The caller owns
 * the installed callback command and passes bounded stdin once; no hook is installed.
 * **Example** (Inspect the inert callback bridge)
 * ```ts
 * import { forwardCursorLifecycleHook } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(typeof forwardCursorLifecycleHook)
 * ```
 * @category services
 * @since 0.0.0
 */
export const forwardCursorLifecycleHook = Effect.fn("AiMetrics.cursorLifecycle.forward")(function* (
  socketPath: string,
  body: string
) {
  if (
    new TextEncoder().encode(body).byteLength > 8192 ||
    !Str.startsWith("/")(socketPath) ||
    new TextEncoder().encode(socketPath).byteLength > 107
  )
    return yield* failure("callback");
  const native = yield* decodeCallback(body).pipe(Effect.mapError(() => failure("callback")));
  const projected = yield* encodeCallback(native).pipe(Effect.mapError(() => failure("callback")));
  const reply = yield* Effect.callback<string, CursorLifecycleError>((resume) => {
    const socket = createConnection({ path: socketPath, allowHalfOpen: true });
    let output = "";
    let size = 0;
    socket.once("connect", () => socket.end(projected));
    socket.on("data", (chunk: Uint8Array) => {
      size += chunk.byteLength;
      if (size > 1024) {
        socket.destroy();
        resume(Effect.fail(failure("transport")));
      } else output += new TextDecoder().decode(chunk);
    });
    socket.once("error", () => resume(Effect.fail(failure("transport"))));
    socket.once("end", () => resume(Effect.succeed(output)));
    return Effect.sync(() => socket.destroy());
  }).pipe(Effect.timeoutOrElse({ duration: "5 seconds", orElse: () => Effect.fail(failure("transport")) }));
  return yield* decodeAcknowledgement(reply).pipe(Effect.mapError(() => failure("transport")));
});
