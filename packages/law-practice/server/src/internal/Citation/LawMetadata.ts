/** add_law_metadata composition from eyecite 2.7.6 helpers.py (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CitationOperationAdmission } from "./Admission.ts";
import { makeCitationContextMatcher } from "./ContextMatcher.ts";
import {
  CitationEditionInferenceInput,
  makeCitationEditionInference,
  prepareCitationEditionInferenceInput,
} from "./EditionInference.ts";
import { makeCitationMetadataStrings } from "./MetadataStrings.ts";
import { CitationMetadataYearBound, makeCitationMetadataYearFromBound } from "./MetadataYear.ts";
import { CitationNativeProcessAdmission, makeCitationNativeProcessAdmission } from "./NativeAdmission.ts";
import { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationRegexPatternDescriptor, copyCitationRegexDescriptor } from "./RegexDescriptors.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTextBudget, makeCitationTextBudget } from "./TextBudget.ts";
import { CitationTokenContextInput } from "./TokenContext.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationContextMatch } from "./ContextMatcher.ts";
import type { CitationPreparedRegexInput } from "./RegexInput.ts";

const $I = $LawPracticeServerId.create("internal/Citation/LawMetadata");
const max = CitationEngineAbsoluteMaxima;
const Position = S.Natural.check(S.isLessThanOrEqualTo(max.sourceUtf16)).pipe(
  $I.annoteSchema("Position", { description: "Unverified source point within the input ceiling." })
);
const Names = LiteralKit(["pin_cite", "publisher", "day", "month", "parenthetical", "year"]).pipe(
  $I.annoteSchema("Names", { description: "Exact source law metadata capture names." })
);
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "missing-capture"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed law metadata preparation failures without source text." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationLawMetadataFailure extends S.TaggedError<
  CitationLawMetadataFailure,
  { readonly brand: unique symbol }
>($I`CitationLawMetadataFailure`)(
  "CitationLawMetadataFailure",
  { reason: Reason },
  $I.annoteError<CitationLawMetadataFailure>("CitationLawMetadataFailure", {
    description: "Law metadata composition failed without source values or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationLawMetadataFailure.make({ reason });
/** Server installation data, including a previously captured calendar ceiling.
 * @internal @category models @since 0.0.0
 */
export class CitationLawMetadataConfiguration extends S.Opaque<
  CitationLawMetadataConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    lawPattern: CitationPythonUnicodeStorage,
    yearPattern: CitationPythonUnicodeStorage,
    lawBindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
    yearBindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
    highestValidYear: CitationMetadataYearBound,
  }).pipe(
    $I.annoteSchema("CitationLawMetadataConfiguration", {
      description: "Source-bound private law/year patterns, descriptors and captured calendar data.",
    })
  )
) {}
/** Source helper inputs, not the public raw-text request.
 * @internal @category models @since 0.0.0
 */
export class CitationLawMetadataInput extends S.Opaque<CitationLawMetadataInput, { readonly brand: unique symbol }>()(
  S.Struct({
    words: CitationTokenContextInput.fields.words,
    index: S.Int.check(S.isBetween({ minimum: -max.tokens, maximum: max.tokens })),
    spanEnd: Position,
    year: S.NullOr(S.Int),
  }).pipe(
    $I.annoteSchema("CitationLawMetadataInput", {
      description: "Built-in words and source citation state before add_law_metadata.",
    })
  )
) {}
const NativeValue = S.NullOr(CitationPythonUnicodeStorage).pipe(
  $I.annoteSchema("NativeValue", { description: "Source-native metadata string or Python None." })
);
/** Only the fields written by the source helper. Other citation fields are untouched.
 * Positions remain unverified Python points until document mapping.
 * @internal @category models @since 0.0.0
 */
export class CitationLawMetadataPatch extends S.Opaque<CitationLawMetadataPatch, { readonly brand: unique symbol }>()(
  S.Struct({
    fullSpanEnd: S.Natural.check(S.isLessThanOrEqualTo(max.sourceUtf16 + 300)),
    year: S.NullOr(S.Int),
    metadata: S.Struct({
      pinCite: NativeValue,
      publisher: NativeValue,
      day: NativeValue,
      month: NativeValue,
      parenthetical: NativeValue,
      year: NativeValue,
    }),
  }).pipe(
    $I.annoteSchema("CitationLawMetadataPatch", {
      description:
        "Complete owned source-native law metadata field updates, without edition inference or document authority.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationLawMetadataResult extends S.Opaque<CitationLawMetadataResult, { readonly brand: unique symbol }>()(
  S.Struct({
    patch: S.Option(CitationLawMetadataPatch),
    reservedUnits: S.Natural.check(S.isLessThanOrEqualTo(max.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationLawMetadataResult", {
      description: "Complete source patch or no match, with source-free invocation reservation accounting.",
    })
  )
) {}
const LawDigest = S.tag("bcfd81892211f7373d1a515cebf32c58ad43da653d5f20dab85df00dbcc6edef");
const YearDigest = S.tag("82554a3e0f705f6f6a95a3920c1c93da975dee85e28a60956fdd0c70a8220fa9");
const Config = S.toType(CitationLawMetadataConfiguration);
const Input = S.toType(CitationLawMetadataInput);
const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
const nonempty = (value: CitationPythonUnicodeStorage | null) => value !== null && value.bytes.length > 0;
const captured = Effect.fn("Citation.captureLawMetadataValue")(function* (
  matched: CitationContextMatch,
  source: CitationPreparedRegexInput,
  name: typeof Names.Type
) {
  const match = yield* Effect.fromNullishOr(matched.match).pipe(Effect.mapError(() => fail("missing-capture")));
  const ordinal = yield* Effect.fromOption(R.get(match.names, name), () => fail("missing-capture"));
  const span = yield* Effect.fromOption(A.get(match.captures, ordinal), () => fail("missing-capture"));
  if (span._tag === "Unmatched") return null;
  return yield* source.slice(span, () => Effect.void);
});
const fingerprint = Effect.fn("Citation.fingerprintLawMetadataPattern")((pattern: CitationPythonUnicodeStorage) =>
  S.decodeEffect(Sha256HexFromBytes)(Bytes.concat([new Uint8Array([pattern.width]), pattern.bytes])).pipe(
    Effect.mapError(() => fail("invalid-configuration")),
    Effect.catchDefect(() => Effect.fail(fail("invalid-configuration")))
  )
);
const prepareConfiguration = Effect.fn("Citation.prepareLawMetadataConfiguration")(function* (
  limits: CitationEngineLimits,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const decoded = yield* S.decodeUnknownEffect(Config)(configurationInput).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  const highestValidYear = decoded.highestValidYear;
  const lawBindings = A.map(decoded.lawBindings, copyCitationRegexDescriptor);
  const yearBindings = A.map(decoded.yearBindings, copyCitationRegexDescriptor);
  const decodedRuntime = yield* S.decodeUnknownEffect(CitationNativeProcessRuntime)(runtimeInput).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  const runtime = CitationNativeProcessRuntime.make({ ...decodedRuntime });
  const patterns = yield* makeCitationRegexInput(limits, "pattern");
  const lawPattern = (yield* patterns.prepareUnicode(decoded.lawPattern, () => Effect.void)).value.storage;
  const yearPattern = (yield* patterns.prepareUnicode(decoded.yearPattern, () => Effect.void)).value.storage;
  const lawHash = yield* fingerprint(lawPattern);
  const yearHash = yield* fingerprint(yearPattern);
  yield* S.decodeUnknownEffect(LawDigest)(lawHash).pipe(Effect.mapError(() => fail("invalid-configuration")));
  yield* S.decodeUnknownEffect(YearDigest)(yearHash).pipe(Effect.mapError(() => fail("invalid-configuration")));
  const config = CitationLawMetadataConfiguration.make({
    lawPattern,
    yearPattern,
    lawBindings,
    yearBindings,
    highestValidYear,
  });
  return { runtime, config };
});
const captureDependencies = Effect.fn("Citation.captureLawMetadataDependencies")(function* (
  limits: CitationEngineLimits
) {
  const supplied = yield* Effect.serviceOption(CitationNativeProcessAdmission);
  const admission = O.isSome(supplied) ? supplied.value : yield* makeCitationNativeProcessAdmission(limits);
  const clock = yield* Clock.Clock;
  const digest = yield* Digest.Digest;
  const spawner = yield* ChildProcessSpawner;
  return Context.make(Clock.Clock, clock).pipe(
    Context.add(Digest.Digest, digest),
    Context.add(ChildProcessSpawner, spawner),
    Context.add(CitationNativeProcessAdmission, admission)
  );
});
const preparePatch = Effect.fn("Citation.prepareLawMetadataPatch")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationLawMetadataConfiguration,
  request: CitationLawMetadataInput
) {
  const matcher = yield* makeCitationContextMatcher(limits, runtime, config.lawPattern, 64, config.lawBindings);
  const matched = yield* matcher.search({
    words: request.words,
    prefix: empty,
    startIndex: request.index + 1,
    forward: true,
    stringsOnly: true,
  });
  if (matched.match === null) return O.none<CitationLawMetadataPatch>();
  const whole = yield* Effect.fromOption(A.head(matched.match.captures), () => fail("missing-capture"));
  if (whole._tag === "Unmatched") return yield* fail("missing-capture");
  const input = yield* makeCitationRegexInput(limits);
  const source = yield* input.prepareUnicode(matched.context, () => Effect.void);
  const value = (name: typeof Names.Type) => captured(matched, source, name);
  const pin = yield* value("pin_cite");
  const publisher = yield* value("publisher");
  const day = yield* value("day");
  const month = yield* value("month");
  const parenthetical = yield* value("parenthetical");
  const rawYear = yield* value("year");
  const strings = yield* makeCitationMetadataStrings(limits, runtime, config.yearPattern, config.yearBindings);
  const cleanedPin = yield* strings.cleanPinCite(pin);
  const processedParenthetical = yield* strings.parenthetical(parenthetical);
  const years = yield* makeCitationMetadataYearFromBound(limits, config.highestValidYear);
  let year = request.year;
  if (nonempty(rawYear)) {
    const parsedYear = yield* years.getYear(rawYear);
    year = O.getOrNull(parsedYear);
  }
  const patch = CitationLawMetadataPatch.make({
    fullSpanEnd: request.spanEnd + whole.end,
    year,
    metadata: {
      pinCite: nonempty(cleanedPin) ? cleanedPin : null,
      publisher,
      day,
      month,
      parenthetical: processedParenthetical,
      year: rawYear,
    },
  });
  return O.some(patch);
});
const installLawMetadata = Effect.fn("Citation.installLawMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-configuration"));
  const { runtime, config } = yield* prepareConfiguration(limits, runtimeInput, configurationInput);
  const operation = yield* CitationOperationAdmission;
  const dependencies = yield* captureDependencies(limits);
  const enclosing = yield* Effect.serviceOption(CitationTextBudget);
  if (O.isSome(enclosing) && enclosing.value.maximum > limits.producedTextUtf16)
    return yield* fail("invalid-configuration");
  const timing = yield* makeCitationRegexTiming(limits, true);
  const run = Effect.fn("Citation.runLawMetadata")(function* (request: CitationLawMetadataInput) {
    const budget = O.isSome(enclosing) ? enclosing.value : yield* makeCitationTextBudget(limits);
    const patch = yield* Effect.scoped(preparePatch(limits, runtime, config, request)).pipe(
      Effect.provideContext(dependencies),
      Effect.provideService(CitationTextBudget, budget)
    );
    const reservedUnits = yield* budget.snapshot;
    return CitationLawMetadataResult.make({ patch, reservedUnits });
  });
  return { limits, operation, timing, run };
});
/** Install immutable source configuration and shared admission. Each call uses
 * a fresh Scope and captures no outer Scope in its dependency Context. An
 * enclosing installed budget is retained, otherwise calls get fresh owners.
 * Methods have R = never and never return partially assigned metadata.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationLawMetadata = Effect.fn("Citation.makeLawMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const installed = yield* installLawMetadata(policy, runtimeInput, configurationInput);
  const apply = Effect.fn("Citation.addLawMetadata")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
          return yield* installed.run(request);
        })
      ),
    installed.timing.timed
  );
  return { apply };
});
/** Built-in full-law state before metadata and superclass edition selection.
 * @internal @category models @since 0.0.0
 */
export class CitationFullLawMetadataInput extends S.Opaque<
  CitationFullLawMetadataInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationLawMetadataInput.fields, ...CitationEditionInferenceInput.fields }).pipe(
    $I.annoteSchema("CitationFullLawMetadataInput", {
      description: "One source year shared by law metadata and edition selection.",
    })
  )
) {}
/** Complete helper patch and resulting superclass guess, published together.
 * @internal @category models @since 0.0.0
 */
export class CitationFullLawMetadataResult extends S.Opaque<
  CitationFullLawMetadataResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationLawMetadataResult.fields, editionGuess: S.NullOr(CitationEditionRef) }).pipe(
    $I.annoteSchema("CitationFullLawMetadataResult", {
      description: "Atomic observable full-law metadata and superclass selection result.",
    })
  )
) {}
/** Preserve FullLawCitation.add_metadata order inside one captured admission
 * and deadline. The helper's updated year drives superclass inference; a late
 * failure publishes no patch or guess. Existing owners perform all work.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationFullLawMetadata = Effect.fn("Citation.makeFullLawMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const installed = yield* installLawMetadata(policy, runtimeInput, configurationInput);
  const inference = yield* makeCitationEditionInference(installed.limits);
  const apply = Effect.fn("Citation.addFullLawMetadata")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const selection = yield* prepareCitationEditionInferenceInput(installed.limits, raw);
          const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
          const result = yield* installed.run(request);
          const year = O.match(result.patch, { onNone: () => request.year, onSome: (patch) => patch.year });
          const editionGuess = yield* inference.guess({ ...selection, year });
          return CitationFullLawMetadataResult.make({ ...result, editionGuess });
        })
      ),
    installed.timing.timed
  );
  return { apply };
});
