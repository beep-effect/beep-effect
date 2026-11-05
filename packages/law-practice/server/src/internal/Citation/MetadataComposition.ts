/** Shared publication metadata ownership; source helpers derive from eyecite 2.7.6.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
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
import * as Tuple from "effect/Tuple";
import { CitationOperationAdmission } from "./Admission.ts";
import { makeCitationContextMatcher } from "./ContextMatcher.ts";
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
import type * as Scope from "effect/Scope";
import type { CitationContextMatch } from "./ContextMatcher.ts";
import type { CitationPreparedRegexInput } from "./RegexInput.ts";

/** Read one native source capture through its existing prepared context owner.
 * @internal @category operations @since 0.0.0
 */
const captureCitationMetadataValue = Effect.fn("Citation.captureMetadataValue")(function* <E>(
  matched: CitationContextMatch,
  source: CitationPreparedRegexInput,
  name: string,
  missing: () => E
) {
  const match = yield* Effect.fromNullishOr(matched.match).pipe(Effect.mapError(missing));
  const ordinal = yield* Effect.fromOption(R.get(match.names, name), missing);
  const span = yield* Effect.fromOption(A.get(match.captures, ordinal), missing);
  return span._tag === "Unmatched" ? null : yield* source.slice(span, () => Effect.void);
});
/** Authenticate raw width-prefixed native pattern bytes without changing identity.
 * @internal @category operations @since 0.0.0
 */
export const fingerprintCitationMetadataPattern = Effect.fn("Citation.fingerprintMetadataPattern")(
  <E>(pattern: CitationPythonUnicodeStorage, invalid: () => E) =>
    S.decodeEffect(Sha256HexFromBytes)(Bytes.concat([new Uint8Array([pattern.width]), pattern.bytes])).pipe(
      Effect.mapError(invalid),
      Effect.catchDefect(() => Effect.fail(invalid()))
    )
);
type Dependencies =
  | Digest.Digest
  | ChildProcessSpawner
  | CitationNativeProcessAdmission
  | CitationTextBudget
  | Scope.Scope;
const captureDependencies = Effect.fn("Citation.captureMetadataDependencies")(function* (limits: CitationEngineLimits) {
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
/** Install shared admission/timing with an explicit trusted stage callback.
 * The callback is server composition, never request data. Each run owns a fresh
 * Scope and retains the installed or fresh invocation budget. No outer Scope is
 * captured in the dependency Context. The returned run requires no services.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationMetadataOperation = Effect.fn("Citation.makeMetadataOperation")(function* <
  Request,
  Patch,
  E,
  Invalid,
>(
  limits: CitationEngineLimits,
  prepare: (request: Request) => Effect.Effect<Patch, E, Dependencies>,
  invalid: () => Invalid
) {
  const operation = yield* CitationOperationAdmission;
  const dependencies = yield* captureDependencies(limits);
  const enclosing = yield* Effect.serviceOption(CitationTextBudget);
  if (O.isSome(enclosing) && enclosing.value.maximum > limits.producedTextUtf16) return yield* Effect.fail(invalid());
  const timing = yield* makeCitationRegexTiming(limits, true);
  const run = Effect.fn("Citation.runMetadataStage")(function* (request: Request) {
    const budget = O.isSome(enclosing) ? enclosing.value : yield* makeCitationTextBudget(limits);
    const patch = yield* Effect.scoped(prepare(request)).pipe(Effect.provideService(CitationTextBudget, budget));
    const reserved = yield* budget.snapshot;
    return Tuple.make(patch, reserved);
  }, Effect.provideContext(dependencies));
  return { operation, timing, run };
});

const $I = $LawPracticeServerId.create("internal/Citation/MetadataComposition");
/** Decode one captured policy/configuration pair with a source-free boundary.
 * @internal @category operations @since 0.0.0
 */
export const decodeCitationMetadataConfiguration = Effect.fn("Citation.decodeMetadataConfiguration")(function* <
  A,
  I,
  E,
>(policy: unknown, input: unknown, schema: S.Codec<A, I>, invalid: () => E) {
  const limits = yield* decodeCitationRegexPolicy(policy, invalid);
  const configuration = yield* S.decodeUnknownEffect(schema)(input).pipe(Effect.mapError(invalid));
  return { limits, configuration };
});
/** Shared captured source year pattern and import-time calendar bound.
 * @internal @category models @since 0.0.0
 */
export class CitationMetadataStringConfiguration extends S.Opaque<
  CitationMetadataStringConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    yearPattern: CitationPythonUnicodeStorage,
    yearBindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
    highestValidYear: CitationMetadataYearBound,
  }).pipe(
    $I.annoteSchema("CitationMetadataStringConfiguration", {
      description: "Source-authenticated year bindings and captured calendar ceiling for publication metadata.",
    })
  )
) {}
/** Native fields shared by the original law and journal helpers.
 * @internal @category models @since 0.0.0
 */
export class CitationMetadataStringFields extends S.Opaque<
  CitationMetadataStringFields,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    pinCite: S.NullOr(CitationPythonUnicodeStorage),
    parenthetical: S.NullOr(CitationPythonUnicodeStorage),
    year: S.NullOr(CitationPythonUnicodeStorage),
  }).pipe(
    $I.annoteSchema("CitationMetadataStringFields", {
      description: "Owned native captures before shared source string/year processing.",
    })
  )
) {}
/** Complete shared field updates, preserving the prior numeric year when absent.
 * @internal @category models @since 0.0.0
 */
export class CitationMetadataStringPatch extends S.Opaque<
  CitationMetadataStringPatch,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationMetadataStringFields.fields, numericYear: S.NullOr(S.Int) }).pipe(
    $I.annoteSchema("CitationMetadataStringPatch", {
      description: "Processed native metadata fields and resulting source numeric year.",
    })
  )
) {}
/** Preserve source helper ordering using the existing string and year stages.
 * @internal @category operations @since 0.0.0
 */
export const processCitationMetadataStrings = Effect.fn("Citation.processMetadataStrings")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationMetadataStringConfiguration,
  fields: CitationMetadataStringFields,
  priorYear: number | null
) {
  const strings = yield* makeCitationMetadataStrings(limits, runtime, config.yearPattern, config.yearBindings);
  const cleaned = yield* strings.cleanPinCite(fields.pinCite);
  const parenthetical = yield* strings.parenthetical(fields.parenthetical);
  const years = yield* makeCitationMetadataYearFromBound(limits, config.highestValidYear);
  let numericYear = priorYear;
  if (fields.year !== null && fields.year.bytes.length > 0) {
    const parsed = yield* years.getYear(fields.year);
    numericYear = O.getOrNull(parsed);
  }
  return CitationMetadataStringPatch.make({
    pinCite: cleaned !== null && cleaned.bytes.length > 0 ? cleaned : null,
    parenthetical,
    year: fields.year,
    numericYear,
  });
});

/** Owned publication pattern with the shared captured calendar configuration.
 * @internal @category models @since 0.0.0
 */
export class CitationPublicationMetadataConfiguration extends S.Opaque<
  CitationPublicationMetadataConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...CitationMetadataStringConfiguration.fields,
    pattern: CitationPythonUnicodeStorage,
    bindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
  }).pipe(
    $I.annoteSchema("CitationPublicationMetadataConfiguration", {
      description: "Private source-bound publication/year patterns and descriptor snapshots.",
    })
  )
) {}
const PublicationConfig = S.toType(CitationPublicationMetadataConfiguration);
/** Snapshot and authenticate existing source patterns through shared owners.
 * Expected fingerprint is trusted installation code, never raw request data.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationPublicationMetadata = Effect.fn("Citation.preparePublicationMetadata")(function* <E>(
  limits: CitationEngineLimits,
  runtimeInput: unknown,
  input: unknown,
  expectedPatternSha256: string,
  invalid: () => E
) {
  const decoded = yield* S.decodeUnknownEffect(PublicationConfig)(input).pipe(Effect.mapError(invalid));
  const highestValidYear = decoded.highestValidYear;
  const bindings = A.map(decoded.bindings, copyCitationRegexDescriptor);
  const yearBindings = A.map(decoded.yearBindings, copyCitationRegexDescriptor);
  const decodedRuntime = yield* S.decodeUnknownEffect(CitationNativeProcessRuntime)(runtimeInput).pipe(
    Effect.mapError(invalid)
  );
  const runtime = CitationNativeProcessRuntime.make({ ...decodedRuntime });
  const patterns = yield* makeCitationRegexInput(limits, "pattern");
  const pattern = (yield* patterns.prepareUnicode(decoded.pattern, () => Effect.void)).value.storage;
  const yearPattern = (yield* patterns.prepareUnicode(decoded.yearPattern, () => Effect.void)).value.storage;
  const hash = yield* fingerprintCitationMetadataPattern(pattern, invalid);
  const yearHash = yield* fingerprintCitationMetadataPattern(yearPattern, invalid);
  if (hash !== expectedPatternSha256 || yearHash !== "82554a3e0f705f6f6a95a3920c1c93da975dee85e28a60956fdd0c70a8220fa9")
    return yield* Effect.fail(invalid());
  return {
    runtime,
    config: CitationPublicationMetadataConfiguration.make({
      pattern,
      bindings,
      yearPattern,
      yearBindings,
      highestValidYear,
    }),
  };
});

/** Authenticate shared publication patterns and capture one existing metadata
 * operation. The stage callback is trusted server composition, never request
 * data; all invocation ownership remains with makeCitationMetadataOperation.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPublicationMetadataOperation = Effect.fn("Citation.makePublicationMetadataOperation")(
  function* <Patch, E, Invalid>(
    policy: unknown,
    runtimeInput: unknown,
    configurationInput: unknown,
    expectedPatternSha256: string,
    prepare: (
      limits: CitationEngineLimits,
      runtime: CitationNativeProcessRuntime,
      config: CitationPublicationMetadataConfiguration,
      raw: unknown
    ) => Effect.Effect<Patch, E, Dependencies>,
    invalid: () => Invalid
  ) {
    const limits = yield* decodeCitationRegexPolicy(policy, invalid);
    const { runtime, config } = yield* prepareCitationPublicationMetadata(
      limits,
      runtimeInput,
      configurationInput,
      expectedPatternSha256,
      invalid
    );
    return yield* makeCitationMetadataOperation(
      limits,
      (raw: unknown) => prepare(limits, runtime, config, raw),
      invalid
    );
  }
);

const ContextOrigin = S.Struct({
  words: CitationTokenContextInput.fields.words,
  index: S.Int,
  forward: S.Boolean,
}).pipe(
  $I.annoteSchema("ContextOrigin", {
    description: "Trusted source metadata scan origin and direction before context construction.",
  })
);
const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
/** Construct the source helper's data-only scan request with an empty prefix.
 * @internal @category operations @since 0.0.0
 */
export const citationMetadataContext = (origin: typeof ContextOrigin.Type) =>
  CitationTokenContextInput.make({
    words: origin.words,
    prefix: empty,
    startIndex: origin.index + (origin.forward ? 1 : -1),
    forward: origin.forward,
    stringsOnly: true,
  });
/** Match and prepare one owned context for source law/journal field capture.
 * @internal @category operations @since 0.0.0
 */
export const matchCitationMetadataContext = Effect.fn("Citation.matchMetadataContext")(function* <E>(
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: Pick<CitationPublicationMetadataConfiguration, "pattern" | "bindings">,
  request: CitationTokenContextInput,
  missing: () => E
) {
  const matcher = yield* makeCitationContextMatcher(limits, runtime, config.pattern, 64, config.bindings);
  const matched = yield* matcher.search(request);
  if (matched.match === null) return O.none();
  const whole = yield* Effect.fromOption(A.head(matched.match.captures), missing);
  if (whole._tag === "Unmatched") return yield* Effect.fail(missing());
  const input = yield* makeCitationRegexInput(limits);
  const source = yield* input.prepareUnicode(matched.context, () => Effect.void);
  return O.some({
    start: whole.start,
    end: whole.end,
    capture: Effect.fn("Citation.captureOwnedMetadata")((name: string) =>
      captureCitationMetadataValue(matched, source, name, missing)
    ),
  });
});
