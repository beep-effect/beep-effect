/** Primitive raw request entry to original get_citations behavior.
 * eyecite 2.7.6, Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationBuiltinCleanerName } from "./CleanerValues.ts";
import { CitationDocumentStepContainers } from "./DocumentCleanerProtocols.ts";
import {
  CitationDocumentExtractionConfiguration,
  CitationDocumentExtractionResult,
  makeCitationDocumentExtraction,
  ownCitationDocumentExtraction,
} from "./DocumentExtraction.ts";
import { getCitationExtractionShortcut } from "./ExtractionShortcut.ts";
import { CitationFullExtractionResult } from "./FullExtraction.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ExtractionEntry");
const Reason = LiteralKit(["invalid-input", "invalid-configuration"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed raw extraction-entry failures without text, source handles or partial output.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationExtractionEntryFailure extends S.TaggedError<
  CitationExtractionEntryFailure,
  { readonly brand: unique symbol }
>($I`CitationExtractionEntryFailure`)(
  "CitationExtractionEntryFailure",
  { reason: Reason },
  $I.annoteError<CitationExtractionEntryFailure>("CitationExtractionEntryFailure", {
    description: "Raw extraction entry failed without request values, schema issues or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationExtractionEntryFailure.make({ reason });
const Source = S.NullOr(S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16))).pipe(
  $I.annoteSchema("Source", { description: "Primitive raw Unicode or None before server-owned source issuance." })
);
/** @internal @category models @since 0.0.0 */
export class CitationExtractionEntryInput extends S.Opaque<
  CitationExtractionEntryInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: Source.pipe(S.withDecodingDefaultKey(Effect.succeed(""))),
    markup: Source.pipe(S.withDecodingDefaultKey(Effect.succeed(""))),
    cleanSteps: S.Array(CitationBuiltinCleanerName)
      .check(S.isMaxLength(CitationEngineAbsoluteMaxima.resolutionIterations))
      .pipe(S.NullOr, S.withDecodingDefaultKey(Effect.succeed(null))),
    container: S.Literals(["list", "tuple", "generator"]).pipe(
      S.withDecodingDefaultKey(Effect.succeed<"list">("list"))
    ),
    removeAmbiguous: S.Boolean.pipe(S.withDecodingDefaultKey(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("CitationExtractionEntryInput", {
      description:
        "Builtin primitive input profile with schema data modes and named cleaners; callable/custom behavior remains captured server ports.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export const CitationExtractionEntryOutcome = S.TaggedUnion({
  Shortcut: { citations: S.Array(CitationFullExtractionResult) },
  Document: { result: CitationDocumentExtractionResult },
}).pipe(
  $I.annoteSchema("CitationExtractionEntryOutcome", {
    description:
      "Original import-time singleton or completed live Document extraction; neither is a semantic citation wire model.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationExtractionEntryOutcome = typeof CitationExtractionEntryOutcome.Type;
/** @internal @category models @since 0.0.0 */
export class CitationExtractionEntryResult extends S.Opaque<
  CitationExtractionEntryResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({ outcome: CitationExtractionEntryOutcome, reservedUnits: S.Natural }).pipe(
    $I.annoteSchema("CitationExtractionEntryResult", {
      description: "One completed raw entry with enclosing reservation total and preserved internal identities.",
    })
  )
) {}
const Input = CitationExtractionEntryInput;
const Configuration = S.toType(CitationDocumentExtractionConfiguration);
const isShortcutRequest = S.is(S.Struct({ plain: S.Literals(["eyecite"]) }));
const shortcut = O.map(getCitationExtractionShortcut("eyecite"), (citations): CitationExtractionEntryOutcome => {
  const validated = CitationExtractionEntryOutcome.cases.Shortcut.make({ citations });
  return { ...validated, citations };
});
const own = Effect.fn("Citation.ownExtractionEntry")(function* (
  limits: CitationEngineLimits,
  configuration: CitationDocumentExtractionConfiguration
) {
  const document = yield* ownCitationDocumentExtraction(limits, configuration);
  const containers = yield* CitationDocumentStepContainers;
  return { ...document, containers };
});
const issue = Effect.fn("Citation.issueRawExtractionSource")(function* (
  limits: CitationEngineLimits,
  owned: Effect.Success<ReturnType<typeof own>>,
  text: string | null
) {
  if (text === null) return yield* owned.values.retainHost(null);
  const units = Str.length(text);
  if (units > limits.sourceUtf16)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "sourceUtf16" });
  const budget = yield* CitationTextBudget;
  yield* budget.reserve(units);
  return yield* owned.values.sourceText(text);
});
const prepare = Effect.fn("Citation.extractRawPrimitiveRequest")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof own>>,
  raw: unknown
) {
  // Other fields must remain untouched on this original early return.
  if (isShortcutRequest(raw)) {
    if (Str.length(raw.plain) > limits.sourceUtf16)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "sourceUtf16" });
    return yield* Effect.fromOption(shortcut, () => fail("invalid-configuration"));
  }
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  return yield* Effect.gen(function* () {
    const plain = yield* issue(limits, owned, request.plain);
    const markup = yield* issue(limits, owned, request.markup);
    const steps =
      request.cleanSteps === null
        ? yield* owned.values.retainHost(null)
        : yield* owned.containers.create({ kind: request.container, names: request.cleanSteps });
    const stage = yield* makeCitationDocumentExtraction(limits, runtime, owned.config);
    const result = yield* stage.extract({ plain, markup, steps, removeAmbiguous: request.removeAmbiguous });
    const validated = CitationExtractionEntryOutcome.cases.Document.make({ result });
    const outcome: CitationExtractionEntryOutcome = { ...validated, result };
    return outcome;
  }).pipe(Effect.provideContext(owned.children));
});
/** Invoke the primitive raw entry, checking the original shortcut before decoding
 * ignored arguments, otherwise issuing owned values before the existing Document
 * path. All dependencies are captured; request fields contain no callbacks.
 * General host equality and public semantic/service adaptation remain open.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationExtractionEntry = makeCitationMetadataStage({
  method: "extract",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own,
  prepare,
  project: (outcome, reservedUnits) => {
    const completed = CitationExtractionEntryResult.make({ outcome, reservedUnits });
    const restored: CitationExtractionEntryResult = { ...completed, outcome };
    return restored;
  },
});
