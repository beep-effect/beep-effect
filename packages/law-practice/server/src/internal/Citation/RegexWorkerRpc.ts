import { $LawPracticeServerId } from "@beep/identity/packages";
/** Typed regex procedure and closed native conversation; no process authority.
 * @internal @packageDocumentation @since 0.0.0
 */

import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationRegexDescriptorFailure } from "./RegexDescriptors.ts";
import { CitationRegexTranslationFailure } from "./RegexTranslator.ts";
import { CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexWorkerRpc");
const Reason = LiteralKit(["unsupported-profile", "native-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Native evaluation failures without source or engine diagnostics." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationRegexEvaluationFailure extends S.TaggedError<
  CitationRegexEvaluationFailure,
  { readonly brand: unique symbol }
>($I`CitationRegexEvaluationFailure`)(
  "CitationRegexEvaluationFailure",
  { reason: Reason },
  $I.annoteError<CitationRegexEvaluationFailure>("CitationRegexEvaluationFailure", {
    description: "Closed isolated evaluator failure with no native cause retained.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export const CitationRegexExecutionFailure = S.Union([
  CitationRegexWorkerFailure,
  CitationRegexDescriptorFailure,
  CitationRegexTranslationFailure,
  CitationRegexEvaluationFailure,
  CitationSafetyLimitExceeded,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CitationRegexExecutionFailure", {
    description: "Closed failures crossing the private regex boundary.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationRegexExecutionFailure = typeof CitationRegexExecutionFailure.Type;
