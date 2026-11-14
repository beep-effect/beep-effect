/**
 * Captured isolated recognition using supplied RPC and existing physical owners.
 * @internal @packageDocumentation @since 0.0.0
 */
import { EyeciteFailure, EyeciteRecognizeInput } from "@beep/eyecite";
import { EyeciteRpcs } from "@beep/eyecite/protocol";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Socket from "effect/socket/Socket";
import { acquireCitationNativeLease, captureCitationNativeAdmission } from "./NativeAdmission.ts";
import {
  CitationNativeProcessFailureReason,
  citationNativeProcessCommand,
  makeCitationNativeProcessOwner,
  withCitationNativeProcess,
} from "./NativeProcess.ts";
import { makeCitationNativeSocket } from "./NativeSocket.ts";
import { makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RecognizerWorker");
const Reason = LiteralKit([
  ...CitationNativeProcessFailureReason.literals,
  "invalid-input",
  "worker-diagnostic",
  "parser-failed",
  "invalid-result",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Finite recognizer transport failures without source, runtime paths or nested causes.",
  })
);
/** Closed private process failure. @internal @category errors @since 0.0.0 */
export class CitationRecognizerFailure extends S.TaggedError<
  CitationRecognizerFailure,
  { readonly brand: unique symbol }
>($I`CitationRecognizerFailure`)(
  "CitationRecognizerFailure",
  { reason: Reason },
  $I.annoteError<CitationRecognizerFailure>("CitationRecognizerFailure", {
    description: "Source-free isolated recognition refusal.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationRecognizerFailure.make({ reason });
const invalid = () => fail("invalid-runtime");
const isFailure = S.is(CitationRecognizerFailure);
const isSafety = S.is(CitationSafetyLimitExceeded);
const isDriverFailure = S.is(EyeciteFailure);
/** Capture policy, Clock, runtime, shared admission and physical owner. Returned
 * recognition has R=never. Only confirmed retirement releases native capacity;
 * unexpected stderr refuses the complete result instead of hiding SDK skips.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationRecognizerWorker = Effect.fn("Citation.makeRecognizerWorker")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime
) {
  const timing = yield* makeCitationRegexTiming(limits, false);
  const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
    CitationSafetyLimitExceeded.make({ operation: timing.operation, limit });
  const admission = yield* captureCitationNativeAdmission(limits);
  const owner = yield* makeCitationNativeProcessOwner<CitationRecognizerFailure | CitationSafetyLimitExceeded>(
    limits,
    timing.operation,
    fail
  );
  const serialization = RpcSerialization.layerSchemaBinary({
    maxFrameSize: limits.processMessageBytes,
    fingerprintPayloads: true,
  });
  const driverFailure = (error: EyeciteFailure) =>
    Match.value(error.reason).pipe(
      Match.when("source-limit", () => safety("sourceUtf16")),
      Match.when("candidate-limit", () => safety("candidates")),
      Match.orElse(fail)
    );
  const normalize = Effect.fnUntraced(function* (cause: Cause.Cause<unknown>) {
    if (Cause.hasInterrupts(cause)) return yield* Effect.interrupt;
    const error = Cause.findErrorOption(cause);
    if (O.isNone(error)) return yield* fail("channel-failed");
    if (isSafety(error.value) || isFailure(error.value)) return yield* error.value;
    if (isDriverFailure(error.value)) return yield* driverFailure(error.value);
    return yield* fail("channel-failed");
  });
  const recognize = Effect.fn("Citation.recognizeProcess")((raw: unknown) =>
    Effect.scoped(
      Effect.gen(function* () {
        const invocationScope = yield* Effect.scope;
        const source = yield* S.decodeUnknownEffect(S.String)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
        if (Str.length(source) > limits.sourceUtf16) return yield* safety("sourceUtf16");
        const request = EyeciteRecognizeInput.make({
          source,
          sourceUtf16: limits.sourceUtf16,
          candidates: limits.candidates,
        });
        const base = citationNativeProcessCommand(runtime, `${limits.processMessageBytes}`);
        const command = ChildProcess.make(base.command, base.args, { ...base.options, stderr: "pipe" });
        return yield* withCitationNativeProcess(
          owner,
          acquireCitationNativeLease(admission, timing.operation, true, fail),
          invalid,
          Effect.fnUntraced(function* (operation) {
            yield* operation.acquire;
            const child = yield* operation.start(command);
            const diagnostics = yield* child.stderr.pipe(
              Stream.runForEach(() => Effect.fail(fail("worker-diagnostic"))),
              Effect.forkIn(invocationScope)
            );
            const output = yield* Effect.scoped(
              Effect.gen(function* () {
                const socket = yield* makeCitationNativeSocket(child, limits.processMessageBytes);
                const context = yield* Layer.build(serialization);
                const protocol = yield* RpcClient.makeProtocolSocket({
                  retryPolicy: Schedule.recurs(0),
                  retryTransientErrors: false,
                  pingInterval: Duration.times(timing.deadline, 2),
                  pingTimeout: timing.deadline,
                }).pipe(Effect.provideService(Socket.Socket, socket), Effect.provideContext(context));
                const rpc = yield* RpcClient.make(EyeciteRpcs, { disableTracing: true }).pipe(
                  Effect.provideService(RpcClient.Protocol, protocol)
                );
                yield* Effect.yieldNow;
                return yield* rpc.Recognize(request);
              })
            ).pipe(Effect.raceFirst(Fiber.join(diagnostics).pipe(Effect.andThen(Effect.never))));
            const exitCode = yield* child.exitCode;
            // The supplied stdio protocol interrupts its root after flushing EOF.
            // Runtime.defaultTeardown uses130 for that interruption-only exit.
            if (exitCode !== 0 && exitCode !== 130) return yield* fail("channel-failed");
            yield* Fiber.join(diagnostics);
            return output;
          })
        );
      })
    ).pipe(timing.timed, Effect.catchCause(normalize))
  );
  return { recognize, snapshot: owner.snapshot, reap: owner.reap };
});
