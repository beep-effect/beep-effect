/** Document.__post_init__ control flow from eyecite 2.7.6 models.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md. Live server
 * protocols retain original object/iterator behavior, including source failures.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CitationCleanerRun,
  CitationCleanerRuntime,
  CitationLiveCleanerObject,
  makeCitationCleanerPipeline,
} from "./CleanerPipeline.ts";
import { CitationCleanerValues, copyCitationCleanerUnicode } from "./CleanerValues.ts";
import {
  CitationHtmlGeometryPreparationConfiguration,
  copyCitationHtmlGeometryConfiguration,
  prepareCitationHtmlGeometry,
} from "./HtmlGeometryPreparation.ts";
import { CitationHtmlTagGeometryInput } from "./HtmlTagGeometry.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import type { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { CitationCleanerFailure, CitationCleanerObject } from "./CleanerPipeline.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/InputDocument");
const Reason = LiteralKit([
  "invalid-input",
  "empty-input",
  "ambiguous-cleaning",
  "source-protocol",
  "geometry-input-type",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed constructor/protocol failures without source data or nested exceptions.",
  })
);
const SourceError = LiteralKit(["ValueError", "TypeError", "AttributeError", "RuntimeError"]).pipe(
  $I.annoteSchema("SourceError", {
    description: "Observed source failure classes; arbitrary host errors remain sanitized by the adapter.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationDocumentInputFailure extends S.TaggedError<
  CitationDocumentInputFailure,
  { readonly brand: unique symbol }
>($I`CitationDocumentInputFailure`)(
  "CitationDocumentInputFailure",
  { reason: Reason, sourceError: SourceError },
  $I.annoteError<CitationDocumentInputFailure>("CitationDocumentInputFailure", {
    description: "Original constructor or captured protocol failure without partial output.",
  })
) {}
type Failure = CitationDocumentInputFailure | CitationCleanerFailure | CitationSafetyLimitExceeded;
/** Installation-time object protocols, never raw request callbacks. Insertion
 * must call the original receiver with ("html", 0), including the reversed list
 * arguments. The plan selector opens that same live iterable through the existing
 * cleaner runtime; selecting it must not iterate or normalize it.
 * @internal @category services @since 0.0.0
 */
export class CitationDocumentInputProtocols extends Context.Service<
  CitationDocumentInputProtocols,
  {
    readonly truth: (value: CitationCleanerObject) => Effect.Effect<boolean, Failure>;
    readonly containsHtml: (steps: CitationCleanerObject) => Effect.Effect<boolean, Failure>;
    readonly insertSourceHtml: (steps: CitationCleanerObject) => Effect.Effect<void, Failure>;
    readonly plan: (steps: CitationCleanerObject) => Effect.Effect<string, Failure>;
    readonly warnHtmlAdded: Effect.Effect<void, Failure>;
  }
>()($I`CitationDocumentInputProtocols`) {}
/** Live owned inputs supplied by the enclosing adapter, never a public wire request.
 * @internal @category models @since 0.0.0
 */
export class CitationDocumentInput extends S.Opaque<CitationDocumentInput, { readonly brand: unique symbol }>()(
  S.Struct({
    plain: CitationLiveCleanerObject,
    markup: CitationLiveCleanerObject,
    steps: CitationLiveCleanerObject,
  }).pipe(
    $I.annoteSchema("CitationDocumentInput", {
      description: "Original input handles and step-container identity; decoding grants no ownership.",
    })
  )
) {}
const Units = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)).pipe(
  $I.annoteSchema("Units", { description: "One bounded operation's logical native text reservation count." })
);
/** @internal @category models @since 0.0.0 */
export class CitationInputDocument extends S.Opaque<CitationInputDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    plain: CitationLiveCleanerObject,
    markup: CitationLiveCleanerObject,
    source: CitationLiveCleanerObject,
    steps: CitationLiveCleanerObject,
    geometry: S.Option(CitationHtmlTagGeometryInput),
    cleanerTextUtf16: Units,
    reservedUnits: Units,
  }).pipe(
    $I.annoteSchema("CitationInputDocument", {
      description:
        "Complete live input-document state, original identities and optional source geometry; no persisted citation data.",
    })
  )
) {}
const fail = (reason: typeof Reason.Type, sourceError: typeof SourceError.Type) =>
  CitationDocumentInputFailure.make({ reason, sourceError });
const Mode = LiteralKit(["Plain", "Markup", "Empty", "Both", "Unchanged"]).pipe(
  $I.annoteSchema("Mode", { description: "Original first matching branch after repeated live truth evaluations." })
);
const DocumentInputValue = S.toType(CitationDocumentInput).pipe(
  $I.annoteSchema("DocumentInputValue", {
    description: "Captured static boundary codec for bounded citation processing.",
  })
);
const selectMode = Effect.fn("Citation.selectInputDocumentMode")(function* (
  protocols: CitationDocumentInputProtocols["Service"],
  input: CitationDocumentInput
): Effect.fn.Return<typeof Mode.Type, Failure> {
  if ((yield* protocols.truth(input.plain)) && !(yield* protocols.truth(input.markup))) return "Plain";
  if ((yield* protocols.truth(input.markup)) && !(yield* protocols.truth(input.plain))) return "Markup";
  if (!(yield* protocols.truth(input.markup)) && !(yield* protocols.truth(input.plain))) return "Empty";
  if ((yield* protocols.truth(input.plain)) && (yield* protocols.truth(input.markup))) return "Both";
  return "Unchanged";
});
const own = Effect.fn("Citation.captureInputDocument")(function* (
  limits: CitationEngineLimits,
  config: CitationHtmlGeometryPreparationConfiguration
) {
  const configuration = yield* copyCitationHtmlGeometryConfiguration(limits, config);
  const values = yield* CitationCleanerValues;
  const protocols = yield* CitationDocumentInputProtocols;
  const cleanerRuntime = yield* CitationCleanerRuntime;
  const empty = yield* values.text("");
  return { configuration, values, protocols, cleanerRuntime, limits, empty };
});
type Owned = Effect.Success<ReturnType<typeof own>>;
const Patch = S.Struct({
  plain: CitationInputDocument.fields.plain,
  source: CitationInputDocument.fields.source,
  geometry: CitationInputDocument.fields.geometry,
  cleanerTextUtf16: CitationInputDocument.fields.cleanerTextUtf16,
}).pipe(
  $I.annoteSchema("Patch", { description: "Complete source branch state before captured invocation accounting." })
);
const nativeValue = Effect.fn("Citation.documentNativeValue")(function* (owned: Owned, value: CitationCleanerObject) {
  const found = yield* copyCitationCleanerUnicode(owned.values, value, () => fail("geometry-input-type", "TypeError"));
  return found.storage;
});
const cleanValue = Effect.fn("Citation.cleanDocumentInput")(function* (
  owned: Owned,
  input: CitationDocumentInput,
  value: CitationCleanerObject
) {
  const plan = yield* owned.protocols.plan(input.steps);
  const pipeline = yield* makeCitationCleanerPipeline(owned.limits).pipe(
    Effect.provideService(CitationCleanerRuntime, owned.cleanerRuntime)
  );
  return yield* pipeline.runOwned({ value, plan });
});
const plainBranch = Effect.fn("Citation.initializePlainDocument")(function* (
  owned: Owned,
  input: CitationDocumentInput
) {
  const result = (yield* owned.protocols.truth(input.steps))
    ? yield* cleanValue(owned, input, input.plain)
    : CitationCleanerRun.make({ value: input.plain, producedTextUtf16: 0 });
  return Patch.make({
    plain: result.value,
    source: input.plain,
    geometry: O.none(),
    cleanerTextUtf16: result.producedTextUtf16,
  });
});
const markupBranch = Effect.fn("Citation.initializeMarkupDocument")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Owned,
  input: CitationDocumentInput
) {
  if (!(yield* owned.protocols.containsHtml(input.steps))) {
    yield* owned.protocols.insertSourceHtml(input.steps);
    yield* owned.protocols.warnHtmlAdded;
  }
  const result = yield* cleanValue(owned, input, input.markup);
  const markup = yield* nativeValue(owned, input.markup);
  const budget = yield* CitationTextBudget;
  const geometry = yield* prepareCitationHtmlGeometry(
    limits,
    runtime,
    owned.configuration,
    markup,
    nativeValue(owned, result.value).pipe(Effect.provideService(CitationTextBudget, budget))
  );
  return Patch.make({
    plain: result.value,
    source: input.markup,
    geometry: O.some(geometry),
    cleanerTextUtf16: result.producedTextUtf16,
  });
});
const bothBranch = Effect.fn("Citation.initializeSuppliedDocument")(function* (
  owned: Owned,
  input: CitationDocumentInput
) {
  if (yield* owned.protocols.truth(input.steps)) return yield* fail("ambiguous-cleaning", "ValueError");
  return Patch.make({ plain: input.plain, source: input.markup, geometry: O.none(), cleanerTextUtf16: 0 });
});
const prepare = Effect.fn("Citation.initializeInputDocument")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Owned,
  raw: unknown
) {
  const input = yield* S.decodeUnknownEffect(DocumentInputValue)(raw).pipe(
    Effect.mapError(() => fail("invalid-input", "TypeError"))
  );
  yield* owned.values.assertOwned(input.plain);
  yield* owned.values.assertOwned(input.markup);
  yield* owned.values.assertOwned(input.steps);
  const mode = yield* selectMode(owned.protocols, input);
  const patch = yield* Match.value(mode).pipe(
    Match.when("Plain", () => plainBranch(owned, input)),
    Match.when("Markup", () => markupBranch(limits, runtime, owned, input)),
    Match.when("Empty", () => Effect.fail(fail("empty-input", "ValueError"))),
    Match.when("Both", () => bothBranch(owned, input)),
    Match.when("Unchanged", () =>
      Effect.succeed(Patch.make({ plain: input.plain, source: owned.empty, geometry: O.none(), cleanerTextUtf16: 0 }))
    ),
    Match.exhaustive
  );
  return { ...patch, markup: input.markup, steps: input.steps };
});
/** Capture server protocols and the existing owned cleaner/native phases under
 * one admitted operation. Repeated truth tests and mutation order follow source.
 * The method has R=never; failures publish no partial Document.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationInputDocument = makeCitationMetadataStage({
  method: "initialize",
  schema: S.toType(CitationHtmlGeometryPreparationConfiguration),
  invalid: () => fail("invalid-input", "TypeError"),
  own,
  prepare,
  project: (patch, reservedUnits) => CitationInputDocument.make({ ...patch, reservedUnits }),
});
