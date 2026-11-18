/** Original live Document initialization through tokenization and get_citations.
 * eyecite 2.7.6, Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationCleaner, CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCleanerValues, copyCitationCleanerUnicode } from "./CleanerValues.ts";
import { ownedField } from "./ConfigurationOwnership.ts";
import { captureCitationExtractionChildren } from "./ExtractionChildren.ts";
import { CitationHtmlGeometryPreparationConfiguration } from "./HtmlGeometryPreparation.ts";
import {
  CitationDocumentInput,
  CitationDocumentInputProtocols,
  CitationInputDocument,
  makeCitationInputDocument,
} from "./InputDocument.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import {
  CitationTokenizedExtractionConfiguration,
  CitationTokenizedExtractionInput,
  CitationTokenizedExtractionResult,
  makeCitationTokenizedExtraction,
} from "./TokenizedExtraction.ts";
import type { CitationCleanerObject, CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationOwned } from "./ConfigurationOwnership.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DocumentExtraction");
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "non-unicode-document"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed live Document extraction failures without handles, input text or partial models.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationDocumentExtractionFailure extends S.TaggedError<
  CitationDocumentExtractionFailure,
  { readonly brand: unique symbol }
>($I`CitationDocumentExtractionFailure`)(
  "CitationDocumentExtractionFailure",
  { reason: Reason },
  $I.annoteError<CitationDocumentExtractionFailure>("CitationDocumentExtractionFailure", {
    description: "Document extraction refused without source, native data or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationDocumentExtractionFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationDocumentExtractionConfiguration extends S.Opaque<
  CitationDocumentExtractionConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    document: CitationHtmlGeometryPreparationConfiguration,
    extraction: CitationTokenizedExtractionConfiguration,
  }).pipe(
    $I.annoteSchema("CitationDocumentExtractionConfiguration", {
      description:
        "Existing Document geometry/runtime and full tokenizer/loop installation; live protocols are captured services.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationDocumentExtractionInput extends S.Opaque<
  CitationDocumentExtractionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...CitationDocumentInput.fields,
    removeAmbiguous: CitationTokenizedExtractionInput.fields.removeAmbiguous,
  }).pipe(
    $I.annoteSchema("CitationDocumentExtractionInput", {
      description:
        "Original issued plain/markup/step-container handles and ambiguity mode; no request callbacks or execution configuration.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationDocumentExtractionResult extends S.Opaque<
  CitationDocumentExtractionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    document: CitationInputDocument,
    extraction: CitationTokenizedExtractionResult,
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationDocumentExtractionResult", {
      description:
        "Completed live Document and builtin extraction with original owned handles and one cumulative text total.",
    })
  )
) {}
const RetainedDocument = CitationInputDocument.pipe(
  S.is,
  S.declare,
  $I.annoteSchema("RetainedDocument", {
    description: "Validate an existing Document without cloning it; handle ownership is checked separately.",
  })
);
const RetainedInput = S.Struct({
  document: RetainedDocument,
  removeAmbiguous: CitationTokenizedExtractionInput.fields.removeAmbiguous,
}).pipe(
  $I.annoteSchema("RetainedInput", {
    description: "An initialized private Document and ambiguity mode; no raw request or re-cleaning program.",
  })
);
const Input = S.toType(CitationDocumentExtractionInput);
const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
/** Take owned configuration and capture existing live Document services.
 * @internal @category operations @since 0.0.0
 */
export const ownCitationDocumentExtraction = Effect.fn("Citation.ownDocumentExtraction")(function* (
  _limits: CitationEngineLimits,
  config: CitationOwned<CitationDocumentExtractionConfiguration>
) {
  const values = yield* CitationCleanerValues;
  const protocols = yield* CitationDocumentInputProtocols;
  const runtime = yield* CitationCleaner;
  const children = (yield* captureCitationExtractionChildren()).pipe(
    Context.add(CitationCleanerValues, values),
    Context.add(CitationDocumentInputProtocols, protocols),
    Context.add(CitationCleaner, runtime)
  );
  return { config, values, children };
});
/** Own the configuration and install the tokenized extraction and input document stages once.
 * @internal @category operations @since 0.0.0
 */
const ownStages = Effect.fn("Citation.ownDocumentExtractionStages")(function* (
  limits: CitationEngineLimits,
  configuration: CitationOwned<CitationDocumentExtractionConfiguration>,
  runtime: CitationNativeProcessRuntime
) {
  const owned = yield* ownCitationDocumentExtraction(limits, configuration);
  return yield* Effect.gen(function* () {
    // Installed once; an install failure surfaces where each request used to install it.
    const tokenized = yield* Effect.exit(
      makeCitationTokenizedExtraction(limits, runtime, ownedField(owned.config, "extraction"))
    );
    const initializer = yield* Effect.exit(
      makeCitationInputDocument(limits, runtime, ownedField(owned.config, "document"))
    );
    return { ...owned, tokenized, initializer };
  }).pipe(Effect.provideContext(owned.children));
});
const markupValue = Effect.fn("Citation.extractDocumentMarkup")(function* (
  values: CitationCleanerValues["Service"],
  value: CitationCleanerObject
) {
  const host = yield* values.getHost(value);
  if (O.isSome(host) && host.value === null) return empty;
  const text = yield* copyCitationCleanerUnicode(values, value, () => fail("non-unicode-document"));
  return text.storage;
});
const extractInitialized = Effect.fn("Citation.extractInitializedDocument")(function* (
  owned: Effect.Success<ReturnType<typeof ownStages>>,
  document: CitationInputDocument,
  removeAmbiguous: boolean
) {
  yield* owned.values.assertOwned(document.plain);
  yield* owned.values.assertOwned(document.markup);
  yield* owned.values.assertOwned(document.source);
  yield* owned.values.assertOwned(document.steps);
  const plain = yield* copyCitationCleanerUnicode(owned.values, document.plain, () => fail("non-unicode-document"));
  const markup = yield* markupValue(owned.values, document.markup);
  const tokenized = yield* owned.tokenized;
  const extraction = yield* tokenized.extract({
    plain: plain.storage,
    markup,
    geometry: document.geometry,
    removeAmbiguous,
  });
  return { document, extraction };
});
const extractDocument = Effect.fn("Citation.extractDecodedDocument")(function* (
  owned: Effect.Success<ReturnType<typeof ownStages>>,
  request: CitationDocumentExtractionInput
) {
  const initializer = yield* owned.initializer;
  const document = yield* initializer.initialize(request);
  return yield* extractInitialized(owned, document, request.removeAmbiguous);
});
const prepareRetained = Effect.fn("Citation.extractRetainedDocument")(function* (
  _limits: CitationEngineLimits,
  _runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof ownStages>>,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(RetainedInput)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  return yield* extractInitialized(owned, request.document, request.removeAmbiguous).pipe(
    Effect.provideContext(owned.children)
  );
});
const prepare = Effect.fn("Citation.extractLiveDocument")(
  (
    _limits: CitationEngineLimits,
    _runtime: CitationNativeProcessRuntime,
    owned: Effect.Success<ReturnType<typeof ownStages>>,
    raw: unknown
  ) =>
    S.decodeUnknownEffect(Input)(raw).pipe(
      Effect.mapError(() => fail("invalid-input")),
      Effect.flatMap((request) => extractDocument(owned, request)),
      Effect.provideContext(owned.children)
    )
);
/** Connect issued Unicode/None Document inputs to real cleaning, geometry,
 * tokenization and construction. One existing operation owns the whole job.
 * General non-Unicode host tokenization and the joke shortcut remain open.
 * Returned extract requires R=never; failures publish no partial document/models.
 * @internal @category operations @since 0.0.0
 */
const definition = {
  own: ownStages,
  project: (
    result: Effect.Success<ReturnType<typeof extractInitialized>>,
    reservedUnits: number
  ): CitationDocumentExtractionResult => {
    const completed = CitationDocumentExtractionResult.make({ ...result, reservedUnits });
    const restored: CitationDocumentExtractionResult = {
      ...completed,
      document: result.document,
      extraction: result.extraction,
    };
    return restored;
  },
};
/** Initialize original input handles before builtin tokenization/extraction.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationDocumentExtraction = makeCitationMetadataStage({
  ...definition,
  method: "extract",
  prepare,
});
/** Reuse an initialized private Document without executing __post_init__ again.
 * All source/step handles must still belong to the captured live owner. This is
 * a model-stage composition boundary, not a new get_citations wire-input mode.
 * Mutable tokenizer/Document aliases remain separate compatibility work.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationRetainedDocumentExtraction = makeCitationMetadataStage({
  ...definition,
  method: "extract",
  prepare: prepareRetained,
});
