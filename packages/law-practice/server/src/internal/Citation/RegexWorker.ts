/** Source-bound native regex supervisor using Effect RPC/process APIs.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as SynchronizedRef from "effect/SynchronizedRef";
import * as Tuple from "effect/Tuple";
import { CitationInvocation, reserveCitationInvocationText } from "./Invocation.ts";
import { citationNativeJobReservation } from "./NativeLane.ts";
import { citationNativeProcessCommand, withCitationNativeProcess } from "./NativeProcess.ts";
import { makeCitationRegexDescriptorRegistry } from "./RegexDescriptors.ts";
import { CitationRegexOperation, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { makeCitationRegexResult } from "./RegexResult.ts";
import { callCitationRegexRpc } from "./RegexWorkerClient.ts";
import {
  CitationRegexWorkerFailure,
  CitationRegexWorkerJob,
  makeCitationRegexJobPreparation,
} from "./RegexWorkerProtocol.ts";
import {
  CitationRegexWorkerStartup,
  encodeCitationRegexStartup,
  preflightCitationRegexControlFrames,
} from "./RegexWorkerRpc.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import type { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import type { CitationRegexEngine } from "./RegexEngine.ts";

const failure = (reason: CitationRegexWorkerFailure["reason"]) => CitationRegexWorkerFailure.make({ reason });
/** Install the engine-constant half of the regex supervisor once per call site
 * and operation: snapshot limits and runtime, the descriptor registry, job
 * preparation, control-frame preflight, Clock, spawner and the shared native
 * admission. Each evaluation reads CitationInvocation at call time, reserves its
 * source text on the invocation budget, and uses the invocation's one physical
 * owner, created in the invocation Scope on its first evaluation with that
 * evaluator's Clock, spawner and limits. Every evaluator of one engine shares
 * them; an evaluator with a different spawner or Clock is refused with
 * `invalid-runtime` rather than spawning through the first one's. The owner's
 * open/quarantine check runs before job preparation (protocol v2: one child
 * per job). Full job preflight precedes
 * payload/map allocation and native acquisition. A native timer includes
 * spawn/startup/traffic/matching; confirmed retirement alone releases the shared
 * total/regex lease. This private component supplies no public engine Layer.
 * @internal @category operations @since 0.0.0
 */
export const installCitationRegexEvaluator = Effect.fn("Citation.installRegexEvaluator")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  bindings: ReadonlyArray<CitationRegexPatternDescriptor>,
  engine: typeof CitationRegexEngine.Type = "python-re"
) {
  const { operation: engineOperation, timed, failSafety } = yield* makeCitationRegexTiming(limits, false);
  const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
    CitationSafetyLimitExceeded.make({ operation: engineOperation, limit });
  const clock = yield* Clock.Clock;
  const spawner = yield* ChildProcessSpawner;
  const digest = yield* Digest.Digest;
  const selected = yield* CitationRegexOperation;
  const makeRegistry = (descriptors: ReadonlyArray<CitationRegexPatternDescriptor>) =>
    makeCitationRegexDescriptorRegistry(limits, descriptors, engine).pipe(
      Effect.provideService(Clock.Clock, clock),
      Effect.provideService(Digest.Digest, digest),
      Effect.provideService(CitationRegexOperation, selected)
    );
  const registry = yield* makeRegistry(bindings);
  const preparation = yield* makeCitationRegexJobPreparation(limits, reserveCitationInvocationText);
  const regexDeadline = limits.regexDeadline.pipe(Duration.toMillis, Duration.millis);
  yield* preflightCitationRegexControlFrames(limits.processMessageBytes);
  // The physical owner captures a Scope, so it belongs to the invocation, never the
  // engine: the request's first evaluation creates it and later ones reuse it.
  const ownerFor = Effect.flatMap(CitationInvocation, (invocation) => {
    const { scope, regexOwner } = invocation;
    return SynchronizedRef.modifyEffect(regexOwner, (current) => {
      if (O.isNone(current))
        return Effect.succeed({
          ensureOpen: invocation.lane.ensureOpen.pipe(Effect.mapError((error) => failure(error.reason))),
          start: (command: import("effect/process/ChildProcess").Command) =>
            invocation.lane.start("regex", command).pipe(
              Effect.mapBoth({
                onFailure: (error) => (error._tag === "CitationNativeLaneFailure" ? failure(error.reason) : error),
                onSuccess: (record) => ({
                  ...record,
                  process: {
                    retire: (retry: boolean) =>
                      record.process
                        .retire(retry)
                        .pipe(
                          Effect.mapError((error) =>
                            error._tag === "CitationNativeLaneFailure" ? failure(error.reason) : error
                          )
                        ),
                  },
                  child: record.child.pipe(Exit.mapError((error) => failure(error.reason))),
                }),
              })
            ),
        }).pipe(
          Effect.provideService(Scope.Scope, scope),
          Effect.provideService(Clock.Clock, clock),
          Effect.provideService(ChildProcessSpawner, spawner),
          Effect.map((owner) => Tuple.make(owner, O.some({ owner, spawner, clock })))
        );
      // Fail closed: never spawn through another evaluator's spawner or Clock.
      return current.value.spawner === spawner && current.value.clock === clock
        ? Effect.succeed(Tuple.make(current.value.owner, current))
        : Effect.fail(failure("invalid-runtime"));
    });
  });
  const evaluateWith = (registry: Effect.Success<ReturnType<typeof makeRegistry>>) =>
    Effect.fn("Citation.evaluateRegexProcess")(
      (
        pattern: unknown,
        source: unknown,
        flags: unknown,
        maximumMatches: unknown = limits.patternMatches,
        mode: unknown = "finditer"
      ) =>
        Effect.flatMap(CitationInvocation, ({ lane }) =>
          Effect.flatMap(ownerFor, (owner) =>
            withCitationNativeProcess(
              owner,
              lane.reserve.pipe(citationNativeJobReservation(failure)),
              () => failure("invalid-runtime"),
              Effect.fnUntraced(function* (operation) {
                const quota = yield* S.decodeUnknownEffect(CitationRegexWorkerJob.fields.maxMatches)(
                  maximumMatches
                ).pipe(Effect.mapError(() => failure("invalid-runtime")));
                if (quota > limits.patternMatches) return yield* safety("patternMatches");
                const prepared = yield* preparation.prepare(
                  pattern,
                  source,
                  flags,
                  quota,
                  () => operation.acquire,
                  mode
                );
                const bound = yield* registry.bind(prepared.pattern.value.storage, flags);
                const argument = yield* encodeCitationRegexStartup(
                  CitationRegexWorkerStartup.make({ limits, descriptor: bound.descriptor, engine: registry.engine })
                );
                const result = yield* makeCitationRegexResult(
                  limits,
                  bound.program.groups,
                  prepared.source.layout.pythonLength
                );
                return yield* Effect.gen(function* () {
                  const child = yield* operation.start(citationNativeProcessCommand(runtime, argument));
                  const body = yield* callCitationRegexRpc(
                    child,
                    prepared.job,
                    prepared.frame,
                    limits.processMessageBytes
                  );
                  return {
                    result: yield* result.decode(body, quota),
                    source: prepared.source,
                    descriptor: bound.descriptor,
                  };
                }).pipe(
                  Effect.timeoutOrElse({ duration: regexDeadline, orElse: () => Effect.fail(safety("regexDeadline")) })
                );
              })
            )
          )
        ).pipe(timed, Effect.catchTag("CitationSafetyLimitExceeded", failSafety))
    );
  // Request-generated patterns (generated references) bind their own descriptors
  // per call; the registry is request state, every other constant is shared.
  const bindDescriptors = Effect.fn("Citation.bindRegexDescriptors")(function* (
    descriptors: ReadonlyArray<CitationRegexPatternDescriptor>
  ) {
    const generated = yield* makeRegistry(descriptors);
    return { evaluate: evaluateWith(generated) };
  });
  return { evaluate: evaluateWith(registry), bindDescriptors };
});
