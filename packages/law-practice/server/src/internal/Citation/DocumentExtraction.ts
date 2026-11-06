/** Original live Document initialization through tokenization and get_citations.
 * eyecite 2.7.6, Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCleanerRuntime } from "./CleanerPipeline.ts";
import { CitationCleanerValues, copyCitationCleanerUnicode } from "./CleanerValues.ts";
import { captureCitationExtractionChildren } from "./ExtractionChildren.ts";
import { CitationHtmlGeometryPreparationConfiguration } from "./HtmlGeometryPreparation.ts";
import {
  CitationDocumentInput,
  CitationDocumentInputProtocols,
  CitationInputDocument,
  makeCitationInputDocument,
} from "./InputDocument.ts";
import { detachCitationMetadataConfiguration, makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import {
  CitationTokenizedExtractionConfiguration,
  CitationTokenizedExtractionInput,
  CitationTokenizedExtractionResult,
  makeCitationTokenizedExtraction,
} from "./TokenizedExtraction.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationCleanerObject } from "./CleanerPipeline.ts";
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
const Input = S.toType(CitationDocumentExtractionInput);
const Configuration = S.toType(CitationDocumentExtractionConfiguration);
const ConfigurationJson = Configuration.pipe(S.toCodecJson);
const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
/** Snapshot configuration and capture existing live Document services.
 * @internal @category operations @since 0.0.0
 */
export const ownCitationDocumentExtraction = Effect.fn("Citation.ownDocumentExtraction")(function* (
  _limits: CitationEngineLimits,
  configuration: CitationDocumentExtractionConfiguration
) {
  const config = yield* detachCitationMetadataConfiguration(ConfigurationJson, configuration, () =>
    fail("invalid-configuration")
  );
  const values = yield* CitationCleanerValues;
  const protocols = yield* CitationDocumentInputProtocols;
  const runtime = yield* CitationCleanerRuntime;
  const children = (yield* captureCitationExtractionChildren()).pipe(
    Context.add(CitationCleanerValues, values),
    Context.add(CitationDocumentInputProtocols, protocols),
    Context.add(CitationCleanerRuntime, runtime)
  );
  return { config, values, children };
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
const extractDocument = Effect.fn("Citation.extractDecodedDocument")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof ownCitationDocumentExtraction>>,
  request: CitationDocumentExtractionInput
) {
  const initializer = yield* makeCitationInputDocument(limits, runtime, owned.config.document);
  const document = yield* initializer.initialize(request);
  const plain = yield* copyCitationCleanerUnicode(owned.values, document.plain, () => fail("non-unicode-document"));
  const markup = yield* markupValue(owned.values, document.markup);
  const stage = yield* makeCitationTokenizedExtraction(limits, runtime, owned.config.extraction);
  const extraction = yield* stage.extract({
    plain: plain.storage,
    markup,
    geometry: document.geometry,
    removeAmbiguous: request.removeAmbiguous,
  });
  return { document, extraction };
});
const prepare = Effect.fn("Citation.extractLiveDocument")(
  (
    limits: CitationEngineLimits,
    runtime: CitationNativeProcessRuntime,
    owned: Effect.Success<ReturnType<typeof ownCitationDocumentExtraction>>,
    raw: unknown
  ) =>
    S.decodeUnknownEffect(Input)(raw).pipe(
      Effect.mapError(() => fail("invalid-input")),
      Effect.flatMap((request) => extractDocument(limits, runtime, owned, request)),
      Effect.provideContext(owned.children)
    )
);
/** Connect issued Unicode/None Document inputs to real cleaning, geometry,
 * tokenization and construction. One existing operation owns the whole job.
 * General non-Unicode host tokenization and the joke shortcut remain open.
 * Returned extract requires R=never; failures publish no partial document/models.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDocumentExtraction = makeCitationMetadataStage({
  method: "extract",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own: ownCitationDocumentExtraction,
  prepare,
  project: (result, reservedUnits) => {
    const completed = CitationDocumentExtractionResult.make({ ...result, reservedUnits });
    const restored: CitationDocumentExtractionResult = { ...completed, extraction: result.extraction };
    return restored;
  },
});
