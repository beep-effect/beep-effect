/** Source-bound native regex supervisor using Effect RPC/process APIs.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { acquireCitationNativeLease, captureCitationNativeAdmission } from "./NativeAdmission.ts";
import {
  citationNativeProcessCommand,
  makeCitationNativeProcessOwner,
  prepareCitationNativeRuntime,
  withCitationNativeProcess,
} from "./NativeProcess.ts";
import { makeCitationRegexDescriptorRegistry } from "./RegexDescriptors.ts";
import { makeCitationRegexTiming } from "./RegexPolicy.ts";
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

const failure = (reason: CitationRegexWorkerFailure["reason"]) => CitationRegexWorkerFailure.make({ reason });
const invalidRuntime = () => failure("invalid-runtime");
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
/** Capture trusted descriptors, runtime, policy, Digest, Clock, admission and
 * Scope. Calls have R = never. Full job preflight precedes payload/map allocation
 * and native acquisition. A native timer includes spawn/startup/traffic/matching;
 * confirmed retirement alone releases the shared total/regex lease. This private
 * component supplies no public engine Layer or family approval.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexWorker = Effect.fn("Citation.makeRegexWorker")(function* (
  policy: unknown,
  runtimeInput: unknown,
  bindings: unknown,
  engineInput: unknown = "python-re"
) {
  const { limits, runtime } = yield* prepareCitationNativeRuntime(policy, runtimeInput, invalidRuntime);
  const admission = yield* captureCitationNativeAdmission(limits, invalidRuntime);
  const owner = yield* makeCitationNativeProcessOwner(limits, "extract", failure);
  const registry = yield* makeCitationRegexDescriptorRegistry(limits, bindings, engineInput);
  const preparation = yield* makeCitationRegexJobPreparation(limits);
  const { timed } = yield* makeCitationRegexTiming(limits, false);
  const regexDeadline = limits.regexDeadline.pipe(Duration.toMillis, Duration.millis);
  yield* preflightCitationRegexControlFrames(limits.processMessageBytes);
  const evaluate = Effect.fn("Citation.evaluateRegexProcess")(
    (
      pattern: unknown,
      source: unknown,
      flags: unknown,
      maximumMatches: unknown = limits.patternMatches,
      mode: unknown = "finditer"
    ) =>
      withCitationNativeProcess(
        owner,
        acquireCitationNativeLease(admission, "extract", true, failure),
        () => failure("invalid-runtime"),
        (operation) =>
          Effect.gen(function* () {
            const quota = yield* S.decodeUnknownEffect(CitationRegexWorkerJob.fields.maxMatches)(maximumMatches).pipe(
              Effect.mapError(() => failure("invalid-runtime"))
            );
            if (quota > limits.patternMatches) return yield* safety("patternMatches");
            const prepared = yield* preparation.prepare(pattern, source, flags, quota, () => operation.acquire, mode);
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
              const body = yield* callCitationRegexRpc(child, prepared.job, prepared.frame, limits.processMessageBytes);
              return {
                result: yield* result.decode(body, quota),
                source: prepared.source,
                descriptor: bound.descriptor,
              };
            }).pipe(
              Effect.timeoutOrElse({ duration: regexDeadline, orElse: () => Effect.fail(safety("regexDeadline")) })
            );
          })
      ).pipe(timed)
  );
  return { evaluate, snapshot: owner.snapshot, reap: owner.reap };
});
