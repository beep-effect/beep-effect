/** Isolated native evaluator. Never import into the responsive parent.
 * @internal @packageDocumentation @since 0.0.0
 */

import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as RegExp from "effect/RegExp";
import { makeCitationRegexAlphabet } from "./RegexAlphabet.ts";
import { makeCitationRegexDescriptorRegistry } from "./RegexDescriptors.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexProgram } from "./RegexProgram.ts";
import { makeCitationRegexResult } from "./RegexResult.ts";
import { CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";
import { CitationRegexEvaluationFailure } from "./RegexWorkerRpc.ts";
import type { CitationRegexCapturePlan } from "./RegexProgram.ts";
import type { CitationRegexWorkerJob } from "./RegexWorkerProtocol.ts";
import type { CitationRegexWorkerStartup } from "./RegexWorkerRpc.ts";

const nativeFailure = () => CitationRegexEvaluationFailure.make({ reason: "native-failed" });
const projectNativeCaptures = Effect.fn("Citation.projectNativeCaptures")(function* (
  plan: CitationRegexCapturePlan,
  indices: ReadonlyArray<readonly [number, number] | undefined>
) {
  if (indices.length !== plan.physicalGroups + 1) return yield* nativeFailure();
  const projected = A.replicate<readonly [number, number] | undefined>(undefined, plan.logicalGroups + 1);
  projected[0] = indices[0];
  for (const [physical, logical] of plan.closingOrder) {
    const span = indices[physical];
    if (span !== undefined) projected[logical] = span;
  }
  return projected;
});
/** Rebind exact native words/profile and collect a complete bounded result.
 * Parent process ownership supplies the hard deadline for synchronous RegExp.
 * This profile admits non-repeated captures; nullable programs are restricted
 * to single search/match operations until Python iterator advancement is qualified.
 * unsupported profiles fail explicitly and acquire no public family approval.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexEvaluation = Effect.fn("Citation.makeRegexEvaluation")(function* (
  startup: CitationRegexWorkerStartup
) {
  const { limits, descriptor, engine } = startup;
  const registry = yield* makeCitationRegexDescriptorRegistry(limits, [descriptor], engine);
  const alphabet = yield* makeCitationRegexAlphabet(limits);
  const compiler = yield* makeCitationRegexProgram(limits, engine);
  const sourceInput = yield* makeCitationRegexInput(limits);
  const evaluate = Effect.fn("Citation.evaluateNativeRegex")(
    function* (job: CitationRegexWorkerJob) {
      if (job.maxMatches > limits.patternMatches)
        return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternMatches" });
      const bound = yield* registry.bind({ width: job.patternWidth, bytes: job.patternBytes }, job.flags);
      const program = bound.program;
      if (
        program.groups > 10 ||
        (program.minimumWidthFloor === 0 && job.mode === "finditer") ||
        program.repeatedCaptures ||
        program.nullableMultiRepeat
      )
        return yield* CitationRegexEvaluationFailure.make({ reason: "unsupported-profile" });
      const source = yield* sourceInput
        .prepareUnicode({ width: job.sourceWidth, bytes: job.sourceBytes }, () => Effect.void)
        .pipe(
          Effect.catchTag("CitationRegexInputFailure", () =>
            Effect.fail(CitationRegexWorkerFailure.make({ reason: "invalid-frame" }))
          )
        );
      const encoded = yield* alphabet.prepare(program.sets, source.value.storage);
      const pattern = yield* compiler.render(program, encoded);
      const captures = yield* compiler.capturePlan(program);
      const result = yield* makeCitationRegexResult(limits, program.groups, source.layout.pythonLength);
      const native = yield* Effect.try({
        try: () => new RegExp.RegExp(pattern, job.mode === "match" ? `${encoded.flags}y` : encoded.flags),
        catch: nativeFailure,
      });
      let finished = false;
      const pull = Effect.gen(function* () {
        if (finished) return O.none();
        const match = yield* Effect.try({ try: () => native.exec(encoded.source), catch: nativeFailure });
        if (job.mode !== "finditer") finished = true;
        const next = O.fromNullishOr(match);
        if (O.isNone(next)) return O.none();
        const indices = yield* Effect.fromOption(O.fromUndefinedOr(next.value.indices)).pipe(
          Effect.mapError(nativeFailure)
        );
        const whole = yield* Effect.fromOption(O.fromUndefinedOr(indices[0])).pipe(Effect.mapError(nativeFailure));
        if (whole[0] > whole[1] || (whole[0] === whole[1] && job.mode === "finditer")) return yield* nativeFailure();
        const projected = yield* projectNativeCaptures(captures, indices);
        return O.some(projected);
      });
      const frame = yield* result.collect(pull, job.maxMatches);
      return frame.subarray(0, -1);
    },
    Effect.catchTag("CitationRegexInputFailure", () =>
      Effect.fail(CitationRegexWorkerFailure.make({ reason: "invalid-frame" }))
    )
  );
  return { evaluate };
});
