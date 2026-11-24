/** Source-bound native regex supervisor using Effect RPC/process APIs.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import { CitationInvocation, reserveCitationInvocationText } from "./Invocation.ts";
import { makeCitationRegexDescriptorRegistry } from "./RegexDescriptors.ts";
import { CitationRegexOperation, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { makeCitationRegexResult } from "./RegexResult.ts";
import { makeCitationRegexSessionPreparation } from "./RegexSessionProtocol.ts";
import { preflightCitationRegexSessionControls } from "./RegexSessionRpc.ts";
import { CitationRegexPayload, CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import type { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import type { CitationRegexEngine } from "./RegexEngine.ts";

const decodeQuota = S.decodeUnknownEffect(CitationRegexPayload.fields.maxMatches);
const failure = (reason: CitationRegexWorkerFailure["reason"]) => CitationRegexWorkerFailure.make({ reason });
/** Install descriptor binding and job preparation once per call site. Each
 * evaluation reads the invocation's regex session and verifies its Clock/spawner
 * identity against the lane on every evaluation, including the first. A closed
 * installation refuses with closed before runtime comparison. Descriptor selection precedes the exact full-frame
 * preflight; payload/map allocation and compilation follow it. The immutable
 * prepared pattern is fingerprinted again before execution. The session owns separate startup
 * and job timers, reuses the child across jobs, and confirms retirement on every
 * unsuccessful job wait. Successful bounded results are consumed while idle.
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
  let closed = false;
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      closed = true;
    })
  );
  const selected = yield* CitationRegexOperation;
  const makeRegistry = (descriptors: ReadonlyArray<CitationRegexPatternDescriptor>) =>
    makeCitationRegexDescriptorRegistry(limits, descriptors, engine).pipe(
      Effect.provideService(Clock.Clock, clock),
      Effect.provideService(Digest.Digest, digest),
      Effect.provideService(CitationRegexOperation, selected)
    );
  const registry = yield* makeRegistry(bindings);
  yield* preflightCitationRegexSessionControls(limits.processMessageBytes);
  const preparation = yield* makeCitationRegexSessionPreparation(limits, reserveCitationInvocationText);
  const evaluateWith = (registry: Effect.Success<ReturnType<typeof makeRegistry>>) =>
    Effect.fn("Citation.evaluateRegexProcess")(
      function* (
        pattern: unknown,
        source: unknown,
        flags: unknown,
        maximumMatches: unknown = limits.patternMatches,
        mode: unknown = "finditer"
      ) {
        const { regex, lane } = yield* CitationInvocation;
        if (closed) return yield* failure("closed");
        if (!lane.matchesRuntime(spawner, clock)) return yield* failure("invalid-runtime");
        yield* lane.ensureOpen.pipe(Effect.mapError((error) => failure(error.reason)));
        const quota = yield* decodeQuota(maximumMatches).pipe(Effect.mapError(() => failure("invalid-runtime")));
        if (quota > limits.patternMatches) return yield* safety("patternMatches");
        return yield* regex.evaluate(
          runtime,
          Effect.fnUntraced(function* (sequence, evaluate, reserve) {
            const descriptor = yield* registry.select(pattern, flags);
            const prepared = yield* preparation.prepare(
              registry.engine,
              descriptor,
              sequence,
              pattern,
              source,
              flags,
              quota,
              () => reserve,
              mode
            );
            const bound = yield* registry.verify(descriptor, prepared.pattern);
            const result = yield* makeCitationRegexResult(
              limits,
              bound.program.groups,
              prepared.source.layout.pythonLength
            );
            const body = yield* evaluate(prepared.job, prepared.frame);
            return { result: yield* result.decode(body, quota), source: prepared.source, descriptor: bound.descriptor };
          })
        );
      },
      timed,
      Effect.catchTag("CitationSafetyLimitExceeded", (error) =>
        error.limit === "regexDeadline" || error.limit === "cleanupDeadline"
          ? Effect.flatMap(CitationInvocation, ({ policy }) =>
              Effect.fail(CitationSafetyLimitExceeded.make({ operation: policy.operation, limit: error.limit }))
            )
          : failSafety(error)
      )
    );
  const bindDescriptors = Effect.fn("Citation.bindRegexDescriptors")(function* (
    descriptors: ReadonlyArray<CitationRegexPatternDescriptor>
  ) {
    const perCallRequestStateRegistry = yield* makeRegistry(descriptors);
    return { evaluate: evaluateWith(perCallRequestStateRegistry) };
  });
  return { evaluate: evaluateWith(registry), bindDescriptors };
});
