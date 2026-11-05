/** extract_pin_cite from eyecite 2.7.6 helpers.py, Free Law Project, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationLawMetadataResult } from "./LawMetadata.ts";
import { makeCitationPublicationMetadataOperation, matchCitationMetadataContext } from "./MetadataComposition.ts";
import { makeCitationMetadataStrings } from "./MetadataStrings.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationTokenContextInput } from "./TokenContext.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationPublicationMetadataConfiguration } from "./MetadataComposition.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/PinExtraction");
const Reason = LiteralKit([
  "invalid-input",
  "invalid-configuration",
  "missing-capture",
  "index-out-of-range",
  "invalid-token",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed source indexing, token and pin extraction failures without source text.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationPinExtractionFailure extends S.TaggedError<
  CitationPinExtractionFailure,
  { readonly brand: unique symbol }
>($I`CitationPinExtractionFailure`)(
  "CitationPinExtractionFailure",
  { reason: Reason },
  $I.annoteError<CitationPinExtractionFailure>("CitationPinExtractionFailure", {
    description: "Pin extraction failed without partial fields or nested source causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationPinExtractionFailure.make({ reason });
/** Built-in words plus the selected token's captured unverified end.
 * @internal @category models @since 0.0.0
 */
export class CitationPinExtractionInput extends S.Opaque<
  CitationPinExtractionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    words: CitationTokenContextInput.fields.words,
    index: S.Int,
    tokenEnd: CitationTokenSeed.fields.end,
    prefix: CitationPythonUnicodeStorage,
  }).pipe(
    $I.annoteSchema("CitationPinExtractionInput", {
      description: "Native source words, Python list index, selected built-in token end and prefix.",
    })
  )
) {}
/** Original helper tuple, with unverified source point end and allocation usage.
 * @internal @category models @since 0.0.0
 */
export class CitationPinExtractionResult extends S.Opaque<
  CitationPinExtractionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    pinCite: S.NullOr(CitationPythonUnicodeStorage),
    pinCiteSpanEnd: S.NullOr(S.Int),
    parenthetical: S.NullOr(CitationPythonUnicodeStorage),
    reservedUnits: CitationLawMetadataResult.fields.reservedUnits,
  }).pipe(
    $I.annoteSchema("CitationPinExtractionResult", {
      description:
        "Complete native pin/parenthetical and source end, including negative prefix-adjusted results; no verified span.",
    })
  )
) {}
const Input = S.toType(CitationPinExtractionInput);
const prepare = Effect.fn("Citation.preparePinExtraction")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationPublicationMetadataConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const index = request.index < 0 ? request.words.length + request.index : request.index;
  if (index < 0 || index >= request.words.length) return yield* fail("index-out-of-range");
  const selected = yield* Effect.fromOption(A.get(request.words, index), () => fail("index-out-of-range"));
  const prefixLength = request.prefix.bytes.length / request.prefix.width;
  const context = CitationTokenContextInput.make({
    words: request.words,
    prefix: request.prefix,
    startIndex: request.index + 1,
    forward: true,
    stringsOnly: true,
  });
  const matched = yield* matchCitationMetadataContext(limits, runtime, config, context, () => fail("missing-capture"));
  if (O.isNone(matched)) return { pinCite: null, pinCiteSpanEnd: null, parenthetical: null };
  const pin = yield* matched.value.capture("pin_cite");
  const capturedParenthetical = yield* matched.value.capture("parenthetical");
  const strings = yield* makeCitationMetadataStrings(limits, runtime, config.yearPattern, config.yearBindings);
  const details = yield* strings.inspectPinCite(pin);
  const parenthetical = yield* strings.parenthetical(capturedParenthetical);
  // Source reads from_token.end only after matching and parenthetical processing.
  if (selected.kind === "Text") return yield* fail("invalid-token");
  return {
    pinCite: details.pinCite,
    pinCiteSpanEnd: request.tokenEnd + details.trailingEnd - prefixLength,
    parenthetical,
  };
});
/** Capture exact source patterns and the existing metadata operation owners.
 * Python index lookup precedes native matching; token-end access follows string
 * processing. One admission/deadline and fresh or installed invocation budget
 * cover all stages. Returned methods have R = never and publish complete tuples.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPinExtraction = Effect.fn("Citation.makePinExtraction")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const installed = yield* makeCitationPublicationMetadataOperation(
    policy,
    runtimeInput,
    configurationInput,
    "3d1b06d98647ef244e02b08aee15ff80a0fb3971528a8a9c97854dd35916bb3d",
    prepare,
    () => fail("invalid-configuration")
  );
  const apply = Effect.fn("Citation.extractPinCite")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const [result, reservedUnits] = yield* installed.run(raw);
          return CitationPinExtractionResult.make({ ...result, reservedUnits });
        })
      ),
    installed.timing.timed
  );
  return { apply };
});
