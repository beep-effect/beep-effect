/** Source-bound native regex supervisor using Effect RPC/process APIs.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationNativeProcessAdmission, makeCitationNativeProcessAdmission } from "./NativeAdmission.ts";
import {
  CitationNativeProcessRuntime,
  citationNativeProcessCommand,
  makeCitationNativeProcessOwner,
} from "./NativeProcess.ts";
import { makeCitationRegexDescriptorRegistry } from "./RegexDescriptors.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
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
import type { CitationNativeProcessLease } from "./NativeAdmission.ts";
import type { CitationOwnedNativeProcess } from "./NativeProcess.ts";

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
  const decoded = yield* decodeCitationRegexPolicy(policy, invalidRuntime);
  const limits = yield* S.encodeEffect(CitationEngineLimits)(decoded).pipe(
    Effect.flatMap(S.decodeEffect(CitationEngineLimits)),
    Effect.mapError(invalidRuntime)
  );
  const runtime = yield* S.decodeUnknownEffect(CitationNativeProcessRuntime)(runtimeInput).pipe(
    Effect.mapError(invalidRuntime)
  );
  const supplied = yield* Effect.serviceOption(CitationNativeProcessAdmission);
  const admission = O.isSome(supplied)
    ? supplied.value
    : yield* makeCitationNativeProcessAdmission(limits).pipe(Effect.mapError(invalidRuntime));
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
      Effect.uninterruptibleMask(
        Effect.fnUntraced(function* (restore) {
          yield* owner.ensureOpen;
          let permit = O.none<CitationNativeProcessLease>();
          let process = O.none<CitationOwnedNativeProcess<CitationRegexWorkerFailure>>();
          const release = Effect.suspend(() => (O.isSome(permit) ? permit.value.release : Effect.void));
          const outcome = yield* Effect.exit(
            restore(
              Effect.gen(function* () {
                const quota = yield* S.decodeUnknownEffect(CitationRegexWorkerJob.fields.maxMatches)(
                  maximumMatches
                ).pipe(Effect.mapError(invalidRuntime));
                if (quota > limits.patternMatches) return yield* safety("patternMatches");
                const prepared = yield* preparation.prepare(
                  pattern,
                  source,
                  flags,
                  quota,
                  () =>
                    admission.acquireRegex("extract").pipe(
                      Effect.mapError((error) =>
                        error._tag === "CitationSafetyLimitExceeded"
                          ? error
                          : failure(error.reason === "quarantined" ? "quarantined" : "closed")
                      ),
                      Effect.tap((lease) =>
                        Effect.sync(() => {
                          permit = O.some(lease);
                        })
                      ),
                      Effect.uninterruptible
                    ),
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
                  const lease = yield* Effect.fromOption(permit).pipe(Effect.mapError(invalidRuntime));
                  const started = yield* owner.start(citationNativeProcessCommand(runtime, argument), lease).pipe(
                    Effect.tap((started) =>
                      Effect.sync(() => {
                        process = O.some(started.process);
                      })
                    ),
                    Effect.uninterruptible
                  );
                  const child = yield* started.child;
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
          );
          if (O.isSome(process)) yield* process.value.retire(false);
          else yield* release;
          return yield* outcome;
        })
      ).pipe(timed)
  );
  return { evaluate, snapshot: owner.snapshot, reap: owner.reap };
});
