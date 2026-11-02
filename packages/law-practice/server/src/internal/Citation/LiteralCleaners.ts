/**
 * Literal cleaning scans adapted from eyecite 2.7.6 clean.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableList from "effect/MutableList";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationCleanerProduced } from "./CleanerPipeline.ts";
import { CitationCleanerTextAllocation, CitationCleanerTextOutput } from "./CleanerTextIdentity.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import type { CitationCleanerTextCharge, CitationCleanerWork } from "./CleanerPipeline.ts";

const CitationEngineLimitsType = S.toType(CitationEngineLimits);

const $I = $LawPracticeServerId.create("internal/Citation/LiteralCleaners");
/**
 * The four regex-free primitive cleaner implementations. HTML and the public
 * named/custom cleaner pipeline remain separate integration work.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationLiteralCleaner = LiteralKit(["inline_whitespace", "all_whitespace", "underscores", "xml"]).pipe(
  $I.annoteSchema("CitationLiteralCleaner", {
    description: "Implemented literal clean.py primitives, not the complete clean_text step domain.",
  })
);
/**
 * Schema-derived literal cleaner name.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationLiteralCleaner = typeof CitationLiteralCleaner.Type;
const Input = S.Struct({
  cleaner: CitationLiteralCleaner,
  text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16)),
}).pipe(
  $I.annoteSchema("Input", {
    description: "One bounded literal primitive request; no callable or source-proof fields.",
  })
);
const StageInput = S.Struct({
  ...Input.fields,
  text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)),
}).pipe(
  $I.annoteSchema("StageInput", {
    description: "Already-owned intermediate text; its original source allowance was checked at the outer boundary.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationLiteralCleanerStage extends S.Opaque<
  CitationLiteralCleanerStage,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)),
    charges: CitationCleanerProduced.fields.charges,
    allocation: CitationCleanerTextAllocation,
  }).pipe(
    $I.annoteSchema("CitationLiteralCleanerStage", {
      description:
        "Complete primitive output and the original live reservations issued before its slices/replacements.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-input", "limit-exceeded", "deadline-exceeded"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed primitive input/count/deadline failures without text or causes." })
);
/**
 * Private redacted primitive failure; the public safety translator is not wired.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationLiteralCleanerFailure extends S.TaggedError<
  CitationLiteralCleanerFailure,
  { readonly brand: unique symbol }
>($I`CitationLiteralCleanerFailure`)(
  "CitationLiteralCleanerFailure",
  { reason: Reason },
  $I.annoteError<CitationLiteralCleanerFailure>("CitationLiteralCleanerFailure", {
    description: "Literal cleaner evaluation failed without source content or nested causes.",
  })
) {}
const failure = (reason: typeof Reason.Type) => CitationLiteralCleanerFailure.make({ reason });
const whitespace = HashSet.fromIterable(citationPythonTextData.whitespace);
const at = (text: string, index: number) => O.getOrElse(Str.charAt(text, index), () => "");
/**
 * Capture count ceilings, deadline and Clock. Each apply owns its output budget
 * and returns R = never. Scans yield at most every 4096 input UTF-16 units;
 * no native regex runs and no partial result escapes a failed evaluation.
 * The stage method also accepts already-owned intermediate text and reserves
 * each positive slice/replacement against the caller's shared text budget.
 * Neither method mints source mappings or supplies a public cleaner service.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationLiteralCleaners = Effect.fn("Citation.makeLiteralCleaners")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(CitationEngineLimitsType)(input).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const sourceCeiling = limits.sourceUtf16;
  const outputCeiling = limits.producedTextUtf16;
  const deadline = limits.cleanDeadline.pipe(Duration.toMillis, Duration.millis);
  const clock = yield* Clock.Clock;
  const makeApply = <E>(
    schema: typeof Input,
    maximumInput: number,
    reserve: (units: number) => Effect.Effect<void, E>
  ) =>
    Effect.fn("Citation.applyLiteralCleaner")(
      function* (input: unknown) {
        const { cleaner, text } = yield* S.decodeUnknownEffect(schema)(input).pipe(
          Effect.mapError(() => failure("invalid-input"))
        );
        const length = Str.length(text);
        if (length > maximumInput) return yield* failure("limit-exceeded");
        return yield* Effect.gen(function* () {
          const output = MutableList.make<string>();
          let produced = 0;
          let matches = 0;
          let wholeWhitespace = false;
          const append = Effect.fn("Citation.appendCleanedText")((size: number, render: () => string) =>
            Effect.gen(function* () {
              if (size > outputCeiling - produced) return yield* failure("limit-exceeded");
              if (size > 0) yield* reserve(size);
              produced += size;
              if (size > 0) MutableList.append(output, render());
            })
          );
          const appendRange = Effect.fn("Citation.appendCleanedRange")((start: number, end: number) =>
            append(end - start, () => Str.slice(start, end)(text))
          );
          if (cleaner === "xml") {
            let end = 0;
            if (Str.startsWith("<?xml")(text)) {
              for (let index = 5; index < length; index++) {
                if (index % 4096 === 5) yield* Effect.yieldNow;
                const char = at(text, index);
                // Python dot excludes LF, while CR and Unicode separators match.
                if (char === "\n") break;
                if (char === "?" && at(text, index + 1) === ">") {
                  end = index + 2;
                  break;
                }
              }
            }
            if (end > 0) matches++;
            yield* appendRange(end, length);
          } else {
            let unchanged = 0;
            let run = -1;
            for (let index = 0; index <= length; index++) {
              if (index % 4096 === 0) yield* Effect.yieldNow;
              const char = at(text, index);
              const isMatch =
                cleaner === "underscores"
                  ? char === "_"
                  : cleaner === "inline_whitespace"
                    ? char === " " || char === "\t"
                    : char === "\u200b" || HashSet.has(whitespace, char);
              if (isMatch && run < 0) {
                run = index;
              } else if (!isMatch && run >= 0) {
                if (cleaner !== "underscores" || index - run >= 2) {
                  yield* appendRange(unchanged, run);
                  if (cleaner !== "underscores") yield* append(1, () => " ");
                  matches++;
                  wholeWhitespace = cleaner !== "underscores" && run === 0 && index === length;
                  unchanged = index;
                }
                run = -1;
              }
            }
            yield* appendRange(unchanged, length);
          }
          const result = pipe(output, MutableList.takeAll, A.join(""));
          return CitationCleanerTextOutput.make({
            text: result,
            allocation:
              Str.length(result) === 0 ? "empty" : matches === 0 ? "unchanged" : wholeWhitespace ? "space" : "fresh",
          });
        }).pipe(Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(failure("deadline-exceeded")) }));
      },
      Effect.provideService(Clock.Clock, clock)
    );
  const applyOutput = makeApply(Input, sourceCeiling, () => Effect.void);
  return {
    applyOutput,
    apply: Effect.fn("Citation.applyLiteralText")((input: unknown) =>
      applyOutput(input).pipe(Effect.map((result) => result.text))
    ),
    stage: Effect.fn("Citation.applyLiteralCleanerStage")(
      function* (input: unknown, work: CitationCleanerWork) {
        const charges: Array<CitationCleanerTextCharge> = [];
        const reserve = Effect.fn("Citation.reserveLiteralSlice")((units: number) =>
          work.reserveText(units).pipe(
            Effect.tap((charge) =>
              Effect.sync(() => {
                charges.push(charge);
              })
            ),
            Effect.asVoid
          )
        );
        const result = yield* makeApply(
          StageInput,
          CitationEngineAbsoluteMaxima.producedTextUtf16,
          reserve
        )(input).pipe(
          Effect.catchTag(
            "CitationLiteralCleanerFailure",
            (error): Effect.Effect<never, CitationLiteralCleanerFailure | CitationSafetyLimitExceeded> => {
              if (error.reason === "limit-exceeded")
                return Effect.fail(
                  CitationSafetyLimitExceeded.make({ operation: "clean", limit: "producedTextUtf16" })
                );
              if (error.reason === "deadline-exceeded")
                return Effect.fail(CitationSafetyLimitExceeded.make({ operation: "clean", limit: "cleanDeadline" }));
              return Effect.fail(error);
            }
          )
        );
        return CitationLiteralCleanerStage.make({ ...result, charges });
      },
      Effect.provideService(Clock.Clock, clock)
    ),
  };
});
