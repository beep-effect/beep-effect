/** Captured native annotation callback boundary; original eyecite annotate.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  captureCitationAnnotationReservation,
  citationAnnotationSafety,
  failCitationAnnotationUnicode,
} from "./AnnotationBudget.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import type { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/AnnotationCallback");
/** @internal @category errors @since 0.0.0 */
export class CitationAnnotationCallbackFailure extends S.TaggedError<
  CitationAnnotationCallbackFailure,
  { readonly brand: unique symbol }
>($I`CitationAnnotationCallbackFailure`)(
  "CitationAnnotationCallbackFailure",
  { reason: S.Literals(["callback-failed", "invalid-result"]) },
  $I.annoteError<CitationAnnotationCallbackFailure>("CitationAnnotationCallbackFailure", {
    description: "Closed callback invocation or final join refusal without source values or host diagnostics.",
  })
) {}
/** NonText is retained until final join, allowing subsequent callbacks to run.
 * It never coerces or serializes an arbitrary returned host object.
 * @internal @category models @since 0.0.0
 */
export const CitationAnnotationCallbackResult = S.TaggedUnion({
  Text: { text: CitationPythonUnicodeStorage },
  NonText: {},
}).pipe(
  $I.annoteSchema("CitationAnnotationCallbackResult", {
    description: "Native callback string or non-string classification; no host object is serialized.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationAnnotationCallbackResult = typeof CitationAnnotationCallbackResult.Type;
/** Trusted native-string callback profile. Inputs are borrowed immutable words;
 * adapters must reserve through the supplied invocation budget before producing
 * new text. The receiver separately admits and snapshots returned text. This
 * does not implement arbitrary before/after host-object ordering or coercion.
 * The budget must not escape its invocation Scope. No callable is request data
 * and annotate requires R=never.
 * @internal @category services @since 0.0.0
 */
export class CitationAnnotationAnnotator extends Context.Service<
  CitationAnnotationAnnotator,
  {
    readonly annotate: (
      before: CitationPythonUnicodeStorage,
      span: CitationPythonUnicodeStorage,
      after: CitationPythonUnicodeStorage,
      work: CitationTextBudget["Service"]
    ) => Effect.Effect<
      CitationAnnotationCallbackResult,
      CitationAnnotationCallbackFailure | CitationSafetyLimitExceeded
    >;
  }
>()($I`CitationAnnotationAnnotator`) {}
const invalid = () => CitationAnnotationCallbackFailure.make({ reason: "invalid-result" });
const ResultType = S.toType(CitationAnnotationCallbackResult);
/** Capture the optional callback and existing Unicode/budget capabilities once.
 * There is no new value arena, ticket issuer, registry or execution framework.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationAnnotationCallback = Effect.fn("Citation.captureAnnotationCallback")(function* (
  limits: CitationEngineLimits
) {
  const port = yield* Effect.serviceOption(CitationAnnotationAnnotator);
  if (O.isNone(port)) return O.none();
  const budget = yield* CitationTextBudget;
  const reserve = yield* captureCitationAnnotationReservation;
  const unicode = yield* makeCitationPythonUnicode(limits, "annotate").pipe(Effect.mapError(invalid));
  const render = Effect.fn("Citation.renderAnnotationCallback")(function* (
    before: CitationPythonUnicodeStorage,
    span: CitationPythonUnicodeStorage,
    after: CitationPythonUnicodeStorage
  ) {
    const result = yield* port.value.annotate(before, span, after, budget).pipe(
      Effect.catchTag("CitationSafetyLimitExceeded", flow(citationAnnotationSafety, Effect.fail)),
      Effect.flatMap(S.decodeEffect(ResultType, { onExcessProperty: "error" })),
      Effect.catchTag("SchemaError", () => Effect.fail(invalid()))
    );
    if (CitationAnnotationCallbackResult.guards.NonText(result)) return result;
    const snapshot = yield* unicode
      .fromStorageReserved(result.text, reserve)
      .pipe(
        Effect.catchTag("CitationPythonUnicodeFailure", (error) =>
          failCitationAnnotationUnicode(limits, invalid, error)
        )
      );
    return CitationAnnotationCallbackResult.cases.Text.make({ text: snapshot.storage });
  });
  return O.some({ render });
});
