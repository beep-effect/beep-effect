/**
 * Literal cleaning scans adapted from eyecite 2.7.6 clean.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationEngineLimits } from "@beep/law-practice-use-cases/server";
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
import { citationPythonTextData } from "./PythonTextData.ts";

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
 * This stage does not mint source mappings or run a multi-step cleaner request.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationLiteralCleaners = Effect.fn("Citation.makeLiteralCleaners")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(S.toType(CitationEngineLimits))(input).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const sourceCeiling = limits.sourceUtf16;
  const outputCeiling = limits.producedTextUtf16;
  const deadline = limits.cleanDeadline.pipe(Duration.toMillis, Duration.millis);
  const clock = yield* Clock.Clock;
  return {
    apply: Effect.fn("Citation.applyLiteralCleaner")(
      function* (input: unknown) {
        const { cleaner, text } = yield* S.decodeUnknownEffect(Input)(input).pipe(
          Effect.mapError(() => failure("invalid-input"))
        );
        const length = Str.length(text);
        if (length > sourceCeiling) return yield* failure("limit-exceeded");
        return yield* Effect.gen(function* () {
          const output = MutableList.make<string>();
          let produced = 0;
          const append = Effect.fn("Citation.appendCleanedText")((size: number, render: () => string) =>
            Effect.suspend(() => {
              if (size > outputCeiling - produced) return Effect.fail(failure("limit-exceeded"));
              produced += size;
              if (size > 0) MutableList.append(output, render());
              return Effect.void;
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
            yield* appendRange(end, length);
          } else {
            let unchanged = 0;
            let run = -1;
            for (let index = 0; index <= length; index++) {
              if (index % 4096 === 0) yield* Effect.yieldNow;
              const char = at(text, index);
              const matches =
                cleaner === "underscores"
                  ? char === "_"
                  : cleaner === "inline_whitespace"
                    ? char === " " || char === "\t"
                    : char === "\u200b" || HashSet.has(whitespace, char);
              if (matches && run < 0) {
                yield* appendRange(unchanged, index);
                run = index;
              } else if (!matches && run >= 0) {
                if (cleaner !== "underscores") yield* append(1, () => " ");
                else if (index - run === 1) yield* append(1, () => "_");
                unchanged = index;
                run = -1;
              }
            }
            yield* appendRange(unchanged, length);
          }
          return pipe(output, MutableList.takeAll, A.join(""));
        }).pipe(Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(failure("deadline-exceeded")) }));
      },
      Effect.provideService(Clock.Clock, clock)
    ),
  };
});
