/**
 * Approved nontruncating native HTML completion boundary.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlCompletion");
const Diagnostics = S.Struct({
  diagnostics: S.Array(
    S.Struct({
      domain: S.NonEmptyString,
      type: S.NonEmptyString,
      level: S.Literals(["WARNING", "ERROR", "FATAL"]),
      depthLimit: S.Boolean,
    })
  ).check(S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)),
}).pipe(
  $I.annoteSchema("Diagnostics", {
    description: "Trusted native adapter classifications; source-bearing messages do not cross this boundary.",
  })
);
const Result = S.Struct({ text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)) }).pipe(
  $I.annoteSchema("Result", { description: "Native returned text read only after checking resource exhaustion." })
);
/**
 * Malformed private adapter completion, with source-bearing data discarded.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationHtmlCompletionFailure extends S.TaggedError<
  CitationHtmlCompletionFailure,
  { readonly brand: unique symbol }
>($I`CitationHtmlCompletionFailure`)(
  "CitationHtmlCompletionFailure",
  {},
  $I.annoteError<CitationHtmlCompletionFailure>("CitationHtmlCompletionFailure", {
    description: "HTML adapter completion did not satisfy the private boundary contract.",
  })
) {}
/**
 * Reject observed native depth exhaustion before accessing any partial text.
 * Ordinary recoverable parse diagnostics retain their source behavior. This
 * R = never guard does not implement or qualify an HTML parser or its worker.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const completeCitationHtml = Effect.fn("Citation.completeHtml")(function* (input: unknown) {
  const { diagnostics } = yield* S.decodeUnknownEffect(Diagnostics)(input).pipe(
    Effect.mapError(() => CitationHtmlCompletionFailure.make({}))
  );
  if (A.some(diagnostics, (diagnostic) => diagnostic.depthLimit))
    return yield* CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" });
  const { text } = yield* S.decodeUnknownEffect(Result)(input).pipe(
    Effect.mapError(() => CitationHtmlCompletionFailure.make({}))
  );
  return text;
});
