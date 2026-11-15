/** Shared publication metadata ownership; source helpers derive from eyecite 2.7.6.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Tuple from "effect/Tuple";
import { makeCitationContextMatcher } from "./ContextMatcher.ts";
import { CitationInvocation, reserveCitationInvocationText } from "./Invocation.ts";
import { makeCitationMetadataStrings } from "./MetadataStrings.ts";
import { CitationMetadataYearBound, makeCitationMetadataYearFromBound } from "./MetadataYear.ts";
import { CitationNativeProcessAdmission, makeCitationNativeProcessAdmission } from "./NativeAdmission.ts";
import { concatCitationPythonRanges } from "./PythonUnicode.ts";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { citationUnaccountedText, makeCitationRegexInput } from "./RegexInput.ts";
import { CitationRegexOperation } from "./RegexPolicy.ts";
import { CitationTokenContextInput } from "./TokenContext.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationOwned } from "./ConfigurationOwnership.ts";
import type { CitationContextMatch } from "./ContextMatcher.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import type { CitationPreparedRegexInput } from "./RegexInput.ts";
import type { installCitationRegexEvaluator } from "./RegexWorker.ts";

type RegexEvaluation = Effect.Success<
  ReturnType<Effect.Success<ReturnType<typeof installCitationRegexEvaluator>>["evaluate"]>
>;
/** Replace complete nonempty matches with a literal native value under the
 * enclosing budget. Nullable substitution and replacement templates are separate.
 * @internal @category operations @since 0.0.0
 */
export const substituteCitationMetadataMatches = Effect.fn("Citation.substituteMetadataMatches")(function* <E>(
  evaluated: RegexEvaluation,
  replacement: O.Option<CitationPythonUnicodeStorage>,
  invalid: () => E
) {
  if (evaluated.result.matches === 0) return evaluated.source.value.storage;
  const budget = yield* CitationTextBudget;
  const ranges = A.empty<{
    readonly source: CitationPythonUnicodeStorage;
    readonly start: number;
    readonly end: number;
  }>();
  let cursor = 0;
  for (let index = 0; index < evaluated.result.matches; index++) {
    const capture = yield* evaluated.result.capture(index, 0);
    if (capture._tag === "Unmatched" || capture.start < cursor || capture.start === capture.end)
      return yield* Effect.fail(invalid());
    ranges.push({ source: evaluated.source.value.storage, start: cursor, end: capture.start });
    if (O.isSome(replacement))
      ranges.push({
        source: replacement.value,
        start: 0,
        end: replacement.value.bytes.length / replacement.value.width,
      });
    cursor = capture.end;
  }
  ranges.push({ source: evaluated.source.value.storage, start: cursor, end: evaluated.source.value.pythonLength });
  return yield* concatCitationPythonRanges(ranges, (layout) => budget.reserve(layout.utf16Units));
});

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
/** Own and authenticate fixed native patterns before retaining configuration.
 * @internal @category operations @since 0.0.0
 */
export const copyCitationMetadataPatterns = Effect.fn("Citation.copyMetadataPatterns")(function* <K extends string, E>(
  limits: CitationEngineLimits,
  raw: R.ReadonlyRecord<K, CitationPythonUnicodeStorage>,
  fingerprints: R.ReadonlyRecord<NoInfer<K>, string>,
  invalid: () => E
) {
  const input = yield* makeCitationRegexInput(limits, citationUnaccountedText, "pattern");
  const prepared: Record<K, CitationPythonUnicodeStorage> = R.map(raw, identity);
  yield* Effect.forEach(
    R.toEntries(raw),
    Effect.fn("Citation.ownMetadataPattern")(function* ([name, value]) {
      const pattern = (yield* input.prepareUnicode(value, () => Effect.void)).value.storage;
      const hash = yield* fingerprintCitationMetadataPattern(pattern, invalid);
      if (hash !== fingerprints[name]) return yield* Effect.fail(invalid());
      prepared[name] = pattern;
    })
  );
  return prepared;
});
/** Prepare and authenticate the fixed patterns of an owned metadata
 * configuration. The configuration is already owned, so its descriptors are
 * retained as they are and nothing is decoded or detached.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationMetadataPatternConfiguration = Effect.fn("Citation.prepareMetadataPatternConfiguration")(
  function* <K extends string, B, E>(
    limits: CitationEngineLimits,
    raw: R.ReadonlyRecord<K, CitationPythonUnicodeStorage>,
    bindings: B,
    fingerprints: R.ReadonlyRecord<NoInfer<K>, string>,
    invalid: () => E
  ) {
    const patterns = yield* copyCitationMetadataPatterns(limits, raw, fingerprints, invalid);
    return { patterns, bindings };
  }
);
type Dependencies =
  | Digest.Digest
  | Path.Path
  | ChildProcessSpawner
  | CitationNativeProcessAdmission
  | CitationTextBudget
  | Scope.Scope
  | CitationInvocation;
/** Decode a built-in word request before enforcing its captured token ceiling.
 * Schema errors retain the caller's closed family error; oversize input uses
 * the shared extraction safety failure before word preparation.
 * @internal @category operations @since 0.0.0
 */
export const decodeCitationMetadataWordRequest = Effect.fn("Citation.decodeMetadataWordRequest")(function* <
  C extends { readonly words: ReadonlyArray<unknown> },
  I,
  E,
>(limits: CitationEngineLimits, schema: S.Codec<C, I>, raw: unknown, invalid: () => E) {
  const request = yield* S.decodeUnknownEffect(schema)(raw).pipe(Effect.mapError(invalid));
  if (request.words.length > limits.tokens)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
  return request;
});
/** Provide one native process admission to a whole stage install: the host's
 * when one is supplied, otherwise one fallback owned by this stage. Helpers and
 * child stages installed inside share it, as they did when they were built
 * inside the stage's run.
 * @internal @category operations @since 0.0.0
 */
export const provideCitationStageAdmission = Effect.fn("Citation.provideStageAdmission")(function* <A, E, R>(
  limits: CitationEngineLimits,
  install: Effect.Effect<A, E, R>
) {
  const supplied = yield* Effect.serviceOption(CitationNativeProcessAdmission);
  const admission = O.isSome(supplied) ? supplied.value : yield* makeCitationNativeProcessAdmission(limits);
  return yield* install.pipe(Effect.provideService(CitationNativeProcessAdmission, admission));
});
const captureDependencies = Effect.fn("Citation.captureMetadataDependencies")(function* () {
  const admission = yield* CitationNativeProcessAdmission;
  const clock = yield* Clock.Clock;
  const selectedOperation = yield* CitationRegexOperation;
  const digest = yield* Digest.Digest;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner;
  return Context.make(Clock.Clock, clock).pipe(
    Context.add(CitationRegexOperation, selectedOperation),
    Context.add(Digest.Digest, digest),
    Context.add(Path.Path, path),
    Context.add(ChildProcessSpawner, spawner),
    Context.add(CitationNativeProcessAdmission, admission)
  );
});
/** Install engine constants with an explicit trusted stage callback.
 * The callback is server composition, never request data. Each run reads the
 * invocation budget and Scope without admitting again or opening another Scope.
 * The dependency Context contains only installation constants, including the
 * native admission the enclosing stage install provides
 * (provideCitationStageAdmission).
 * @internal @category operations @since 0.0.0
 */
export const makeCitationMetadataOperation = Effect.fn("Citation.makeMetadataOperation")(function* <Request, Patch, E>(
  prepare: (request: Request) => Effect.Effect<Patch, E, Dependencies>
) {
  const dependencies = yield* captureDependencies();
  const run = Effect.fn("Citation.runMetadataStage")(function* (request: Request) {
    const { budget, scope } = yield* CitationInvocation;
    const patch = yield* prepare(request).pipe(
      Effect.provideService(CitationTextBudget, budget),
      Effect.provideService(Scope.Scope, scope)
    );
    const reserved = yield* budget.snapshot;
    return Tuple.make(patch, reserved);
  }, Effect.provideContext(dependencies));
  return { run };
});

const $I = $LawPracticeServerId.create("internal/Citation/MetadataComposition");
/** Run a stage install with one native admission for the whole install
 * (provideCitationStageAdmission). The configuration is already owned; the
 * install neither decodes nor detaches it.
 * @internal @category operations @since 0.0.0
 */
export const installCitationOwnedStage = Effect.fn("Citation.installOwnedStage")(function* <
  C,
  B,
  Eff extends Effect.Effect<unknown, unknown, unknown>,
>(
  limits: CitationEngineLimits,
  configuration: CitationOwned<C>,
  install: (limits: CitationEngineLimits, configuration: CitationOwned<C>) => Generator<Eff, B, never>
) {
  return yield* provideCitationStageAdmission(
    limits,
    Effect.gen(() => install(limits, configuration))
  );
});
/** Compose typed server callbacks with the existing captured metadata owner.
 * Callbacks are installation-time composition, never request fields; `own`
 * installs child stages and helpers once, so `prepare` only closes over them. The
 * configuration arrives owned from the engine boundary and is neither decoded
 * nor detached here. The returned invocation requires CitationInvocation and
 * shares its budget and resource lifetime.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationMetadataStage = <
  C,
  Owned,
  Patch,
  Output,
  OwnError,
  WorkError,
  Env,
  K extends string,
>(definition: {
  readonly method: K;
  readonly own: (
    limits: CitationEngineLimits,
    configuration: CitationOwned<C>,
    runtime: CitationNativeProcessRuntime
  ) => Effect.Effect<Owned, OwnError, Env>;
  readonly prepare: (
    limits: CitationEngineLimits,
    runtime: CitationNativeProcessRuntime,
    configuration: Owned,
    raw: unknown
  ) => Effect.Effect<Patch, WorkError, Dependencies>;
  readonly project: (patch: Patch, reservedUnits: number) => Output;
}) =>
  Effect.fn("Citation.installMetadataStage")(function* (
    limits: CitationEngineLimits,
    runtime: CitationNativeProcessRuntime,
    configuration: CitationOwned<C>
  ) {
    return yield* provideCitationStageAdmission(
      limits,
      Effect.gen(function* () {
        const config = yield* definition.own(limits, configuration, runtime);
        const installed = yield* makeCitationMetadataOperation((raw: unknown) =>
          definition.prepare(limits, runtime, config, raw)
        );
        const invoke = Effect.fn("Citation.invokeMetadataStage")((raw: unknown) =>
          Effect.gen(function* () {
            const [patch, units] = yield* installed.run(raw);
            return definition.project(patch, units);
          })
        );
        return R.singleton(definition.method, invoke);
      })
    );
  });
/** Authenticate an owned stage configuration, then install its per-request call once.
 * @internal @category constructors @since 0.0.0
 */
export const ownCitationStageCall =
  <C, Verified, Call, VerifyError, VerifyEnv, InstallError, InstallEnv>(steps: {
    readonly verify: (
      limits: CitationEngineLimits,
      configuration: CitationOwned<C>
    ) => Effect.Effect<Verified, VerifyError, VerifyEnv>;
    readonly install: (
      limits: CitationEngineLimits,
      runtime: CitationNativeProcessRuntime,
      verified: Verified
    ) => Effect.Effect<Call, InstallError, InstallEnv>;
  }) =>
  (limits: CitationEngineLimits, configuration: CitationOwned<C>, runtime: CitationNativeProcessRuntime) =>
    Effect.flatMap(steps.verify(limits, configuration), (verified) => steps.install(limits, runtime, verified));
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
/** Install the existing string and year stages once and preserve source helper ordering per call.
 * @internal @category operations @since 0.0.0
 */
export const installCitationMetadataStringProcessing = Effect.fn("Citation.installMetadataStringProcessing")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationMetadataStringConfiguration
) {
  const installedStrings = yield* Effect.exit(
    makeCitationMetadataStrings(limits, runtime, config.yearPattern, config.yearBindings)
  );
  const installedYears = yield* Effect.exit(makeCitationMetadataYearFromBound(limits, config.highestValidYear));
  return Effect.fn("Citation.processMetadataStrings")(function* (
    fields: CitationMetadataStringFields,
    priorYear: number | null
  ) {
    const strings = yield* installedStrings;
    const cleaned = yield* strings.cleanPinCite(fields.pinCite);
    const parenthetical = yield* strings.parenthetical(fields.parenthetical);
    const years = yield* installedYears;
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
type PublicationFields = Pick<
  CitationPublicationMetadataConfiguration,
  "pattern" | "bindings" | "yearPattern" | "yearBindings" | "highestValidYear"
>;
/** Prepare and authenticate owned source patterns through shared owners.
 * Expected fingerprint is trusted installation code, never raw request data.
 * The fields are a view of owned configuration, so nothing is decoded or detached.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationPublicationMetadata = Effect.fn("Citation.preparePublicationMetadata")(function* <E>(
  limits: CitationEngineLimits,
  owned: PublicationFields,
  expectedPatternSha256: string,
  invalid: () => E
) {
  const patterns = yield* makeCitationRegexInput(limits, citationUnaccountedText, "pattern");
  const pattern = (yield* patterns.prepareUnicode(owned.pattern, () => Effect.void)).value.storage;
  const yearPattern = (yield* patterns.prepareUnicode(owned.yearPattern, () => Effect.void)).value.storage;
  const hash = yield* fingerprintCitationMetadataPattern(pattern, invalid);
  const yearHash = yield* fingerprintCitationMetadataPattern(yearPattern, invalid);
  if (hash !== expectedPatternSha256 || yearHash !== "82554a3e0f705f6f6a95a3920c1c93da975dee85e28a60956fdd0c70a8220fa9")
    return yield* Effect.fail(invalid());
  return CitationPublicationMetadataConfiguration.make({
    pattern,
    bindings: owned.bindings,
    yearPattern,
    yearBindings: owned.yearBindings,
    highestValidYear: owned.highestValidYear,
  });
});

/** Authenticate shared publication patterns and capture one existing metadata
 * operation. The install callback is trusted server composition, never request
 * data; it runs once and returns the per-request stage body. All invocation
 * ownership remains with makeCitationMetadataOperation.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPublicationMetadataOperation = Effect.fn("Citation.makePublicationMetadataOperation")(
  function* <Patch, E, Invalid, IE, IR>(
    limits: CitationEngineLimits,
    runtime: CitationNativeProcessRuntime,
    configuration: CitationOwned<PublicationFields>,
    expectedPatternSha256: string,
    install: (
      limits: CitationEngineLimits,
      runtime: CitationNativeProcessRuntime,
      config: CitationPublicationMetadataConfiguration
    ) => Effect.Effect<(raw: unknown) => Effect.Effect<Patch, E, Dependencies>, IE, IR>,
    invalid: () => Invalid
  ) {
    return yield* provideCitationStageAdmission(
      limits,
      Effect.gen(function* () {
        const config = yield* prepareCitationPublicationMetadata(limits, configuration, expectedPatternSha256, invalid);
        const prepare = yield* install(limits, runtime, config);
        return yield* makeCitationMetadataOperation(prepare);
      })
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
/** Install the context matcher once; each call matches and prepares one owned
 * context for source law/journal field capture.
 * @internal @category operations @since 0.0.0
 */
export const installCitationMetadataContextMatch = Effect.fn("Citation.installMetadataContextMatch")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: Pick<CitationPublicationMetadataConfiguration, "pattern" | "bindings">
) {
  const installedMatcher = yield* Effect.exit(
    makeCitationContextMatcher(limits, runtime, config.pattern, 64, config.bindings)
  );
  const installedInput = yield* Effect.exit(makeCitationRegexInput(limits, reserveCitationInvocationText));
  return Effect.fn("Citation.matchMetadataContext")(function* <E>(
    request: CitationTokenContextInput,
    missing: () => E
  ) {
    const matcher = yield* installedMatcher;
    const matched = yield* matcher.search(request);
    if (matched.match === null) return O.none();
    const whole = yield* Effect.fromOption(A.head(matched.match.captures), missing);
    if (whole._tag === "Unmatched") return yield* Effect.fail(missing());
    const input = yield* installedInput;
    const source = yield* input.prepareUnicode(matched.context, () => Effect.void);
    return O.some({
      start: whole.start,
      end: whole.end,
      capture: Effect.fn("Citation.captureOwnedMetadata")((name: string) =>
        captureCitationMetadataValue(matched, source, name, missing)
      ),
    });
  });
});
