/** FullCaseCitation.add_metadata from eyecite 2.7.6, Free Law Project, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CitationCaseNameSelectionConfiguration,
  CitationCaseNameSelectionInput,
  copyCitationCaseNameSelectionConfiguration,
  selectCitationCaseName,
} from "./CaseNameSelection.ts";
import { makeCitationCourtLookup } from "./CourtLookup.ts";
import {
  CitationEditionInferenceInput,
  makeCitationEditionInference,
  prepareCitationEditionInferenceInput,
} from "./EditionInference.ts";
import { CitationFrozenEditions, readCitationFrozenEdition } from "./FrozenEditions.ts";
import {
  CitationPublicationMetadataConfiguration,
  decodeCitationMetadataRuntimeConfiguration,
  decodeCitationMetadataWordRequest,
  makeCitationMetadataOperation,
  prepareCitationPublicationMetadata,
} from "./MetadataComposition.ts";
import {
  CitationPostCaseMetadataConfiguration,
  CitationPostCaseMetadataInput,
  extractCitationPostCaseMetadata,
} from "./PostCaseMetadata.ts";
import { extractCitationPreCaseMetadata } from "./PreCaseMetadata.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationCaseNameProcessPatch } from "./CaseNameProcess.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CaseMetadata");
const Value = S.NullOr(CitationPythonUnicodeStorage);
const Reason = LiteralKit(["invalid-input", "invalid-configuration"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed full-case composition boundary failures without source text." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationCaseMetadataFailure extends S.TaggedError<
  CitationCaseMetadataFailure,
  { readonly brand: unique symbol }
>($I`CitationCaseMetadataFailure`)(
  "CitationCaseMetadataFailure",
  { reason: Reason },
  $I.annoteError<CitationCaseMetadataFailure>("CitationCaseMetadataFailure", {
    description: "Full-case metadata failed without exposing a partial model or source cause.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseMetadataConfiguration extends S.Opaque<
  CitationCaseMetadataConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    post: CitationPostCaseMetadataConfiguration,
    names: CitationCaseNameSelectionConfiguration,
    pre: CitationPublicationMetadataConfiguration,
  }).pipe(
    $I.annoteSchema("CitationCaseMetadataConfiguration", {
      description: "Source-bound post/name/pre configurations; frozen edition services are captured separately.",
    })
  )
) {}
/** Complete built-in metadata, preserving unassigned fields and original native text.
 * @internal @category models @since 0.0.0
 */
export class CitationCaseMetadataFields extends S.Opaque<
  CitationCaseMetadataFields,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plaintiff: Value,
    defendant: Value,
    antecedentGuess: Value,
    court: Value,
    pinCite: Value,
    pinCiteSpanStart: S.NullOr(S.Int),
    pinCiteSpanEnd: S.NullOr(S.Int),
    extra: Value,
    parenthetical: Value,
    year: Value,
    month: Value,
    day: Value,
    resolvedCaseName: Value,
    resolvedCaseNameShort: Value,
  }).pipe(
    $I.annoteSchema("CitationCaseMetadataFields", {
      description: "All original FullCaseCitation metadata slots; no source field silently disappears.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseMetadataInput extends S.Opaque<CitationCaseMetadataInput, { readonly brand: unique symbol }>()(
  S.Struct({
    words: CitationCaseNameSelectionInput.fields.words,
    index: CitationCaseNameSelectionInput.fields.index,
    spanStart: CitationCaseNameSelectionInput.fields.spanStart,
    spanEnd: CitationPostCaseMetadataInput.fields.spanEnd,
    fullSpanStart: S.NullOr(S.Int),
    fullSpanEnd: S.NullOr(S.Int),
    metadata: CitationCaseMetadataFields,
    year: S.NullOr(S.Int),
    exact: CitationEditionInferenceInput.fields.exact,
    variation: CitationEditionInferenceInput.fields.variation,
    prior: CitationEditionInferenceInput.fields.prior,
    geometry: CitationCaseNameSelectionInput.fields.geometry,
  }).pipe(
    $I.annoteSchema("CitationCaseMetadataInput", {
      description: "Owned built-in model/document state before full-case metadata; no executable request values.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseMetadataResult extends S.Opaque<
  CitationCaseMetadataResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    metadata: CitationCaseMetadataFields,
    year: CitationEditionInferenceInput.fields.year,
    fullSpanStart: S.NullOr(S.Int),
    fullSpanEnd: S.NullOr(S.Int),
    editionGuess: CitationEditionInferenceInput.fields.prior,
    usedHtml: S.Boolean,
    usedPlain: S.Boolean,
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationCaseMetadataResult", {
      description:
        "Atomic final built-in case metadata after post/name/pre/court/edition order, with shared text accounting.",
    })
  )
) {}
const invalid = () => CitationCaseMetadataFailure.make({ reason: "invalid-configuration" });
const applyNames = (metadata: CitationCaseMetadataFields, patch: CitationCaseNameProcessPatch) =>
  CitationCaseMetadataFields.make({
    ...metadata,
    plaintiff: O.getOrElse(patch.plaintiff, () => metadata.plaintiff),
    defendant: O.getOrElse(patch.defendant, () => metadata.defendant),
    antecedentGuess: O.getOrElse(patch.antecedentGuess, () => metadata.antecedentGuess),
    year: O.getOrElse(patch.year, () => metadata.year),
  });
const postMetadata = Effect.fn("Citation.applyFullCasePostMetadata")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationPostCaseMetadataConfiguration,
  request: CitationCaseMetadataInput
) {
  const post = yield* extractCitationPostCaseMetadata(
    limits,
    runtime,
    CitationPublicationMetadataConfiguration.make(config),
    config.courtTable,
    request
  );
  if (O.isNone(post)) return request;
  const next = post.value;
  const court = O.getOrNull(next.metadata.court);
  const strings = yield* makeCitationRegexInput(limits);
  const projected = court === null ? null : (yield* strings.prepareText(court, () => Effect.void)).value.storage;
  return CitationCaseMetadataInput.make({
    ...request,
    year: next.year,
    fullSpanEnd: next.fullSpanEnd,
    metadata: CitationCaseMetadataFields.make({
      ...request.metadata,
      ...next.metadata,
      court: O.isSome(next.metadata.court) ? projected : request.metadata.court,
      pinCiteSpanEnd: O.getOrElse(next.metadata.pinCiteSpanEnd, () => request.metadata.pinCiteSpanEnd),
    }),
  });
});
const guessCourt = Effect.fn("Citation.guessFullCaseCourt")(function* (
  limits: CitationEngineLimits,
  owner: CitationFrozenEditions["Service"],
  candidates: CitationEditionInferenceInput,
  metadata: CitationCaseMetadataFields
) {
  if (metadata.court !== null && metadata.court.bytes.length !== 0) return metadata;
  for (const ref of A.appendAll(candidates.exact, candidates.variation)) {
    const edition = yield* readCitationFrozenEdition(owner, ref);
    if (!edition.value.reporter.is_scotus) continue;
    const strings = yield* makeCitationRegexInput(limits);
    const court = yield* strings.prepareText("scotus", () => Effect.void);
    return CitationCaseMetadataFields.make({ ...metadata, court: court.value.storage });
  }
  return metadata;
});
const prepare = Effect.fn("Citation.prepareFullCaseMetadata")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationCaseMetadataConfiguration,
  owner: CitationFrozenEditions["Service"],
  editions: Effect.Success<ReturnType<typeof makeCitationEditionInference>>,
  raw: unknown
) {
  const request = yield* decodeCitationMetadataWordRequest(limits, S.toType(CitationCaseMetadataInput), raw, () =>
    CitationCaseMetadataFailure.make({ reason: "invalid-input" })
  );
  const candidates = yield* prepareCitationEditionInferenceInput(limits, request);
  const posted = yield* postMetadata(limits, runtime, config.post, request);
  let metadata = posted.metadata;
  let year: typeof CitationEditionInferenceInput.Type.year = posted.year;
  let fullSpanStart = posted.fullSpanStart;
  const fullSpanEnd = posted.fullSpanEnd;
  const names = yield* selectCitationCaseName(limits, runtime, config.names, {
    ...request,
    mode: "Full",
    currentName: metadata.defendant,
  });
  metadata = applyNames(metadata, names.patch);
  year = O.isSome(names.patch.numericYear) ? names.patch.numericYear.value : year;
  fullSpanStart = O.getOrElse(names.patch.fullSpanStart, () => fullSpanStart);
  const pre = yield* extractCitationPreCaseMetadata(limits, runtime, config.pre, {
    ...request,
    plaintiff: metadata.plaintiff,
    defendant: metadata.defendant,
    pinCiteSpanStart: metadata.pinCiteSpanStart,
  });
  if (O.isSome(pre)) {
    metadata = CitationCaseMetadataFields.make({ ...metadata, ...pre.value.metadata });
    fullSpanStart = pre.value.fullSpanStart;
  }
  metadata = yield* guessCourt(limits, owner, candidates, metadata);
  const editionGuess = yield* editions.guess({ ...candidates, year });
  return {
    metadata,
    year,
    fullSpanStart,
    fullSpanEnd,
    editionGuess,
    usedHtml: names.usedHtml,
    usedPlain: names.usedPlain,
  };
});
/** Run the complete original full-case metadata order under one captured operation,
 * Scope, text authority and deadline. Frozen edition inference requires no ambient
 * services after construction; the returned extract method has R=never.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationCaseMetadata = Effect.fn("Citation.makeFullCaseMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const {
    limits,
    runtime,
    configuration: decoded,
  } = yield* decodeCitationMetadataRuntimeConfiguration(
    policy,
    runtimeInput,
    configurationInput,
    S.toType(CitationCaseMetadataConfiguration),
    invalid
  );
  yield* makeCitationCourtLookup(limits, decoded.post.courtTable);
  const post = yield* prepareCitationPublicationMetadata(
    limits,
    runtime,
    decoded.post,
    "173f538b2d3f8f2522eeb298388114e59bca173d00e03ac7f7b844f02c1be040",
    invalid
  );
  const pre = yield* prepareCitationPublicationMetadata(
    limits,
    runtime,
    decoded.pre,
    "d151b7a02a061593bb44bd881eee2dc174fff7f1b5449512f25cc2b98fb315b0",
    invalid
  );
  const names = yield* copyCitationCaseNameSelectionConfiguration(limits, decoded.names);
  const config = CitationCaseMetadataConfiguration.make({
    post: { ...post.config, courtTable: decoded.post.courtTable },
    pre: pre.config,
    names,
  });
  const owner = yield* CitationFrozenEditions;
  const editions = yield* makeCitationEditionInference(limits);
  const installed = yield* makeCitationMetadataOperation(
    limits,
    (raw: unknown) => prepare(limits, runtime, config, owner, editions, raw),
    invalid
  );
  const extract = Effect.fn("Citation.addFullCaseMetadata")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const [result, reservedUnits] = yield* installed.run(raw);
          return CitationCaseMetadataResult.make({ ...result, reservedUnits });
        })
      ),
    installed.timing.timed
  );
  return { extract };
});
