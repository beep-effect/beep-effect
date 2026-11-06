/** Native strip_stop_words from eyecite 2.7.6 helpers.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  copyCitationMetadataPatterns,
  decodeCitationMetadataRuntimeConfiguration,
  makeCitationMetadataOperation,
  substituteCitationMetadataMatches,
} from "./MetadataComposition.ts";
import { citationMetadataWhitespaceBoundary, trimCitationMetadataBoundary } from "./MetadataStrings.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import { CitationRegexPatternDescriptor, copyCitationRegexDescriptor } from "./RegexDescriptors.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexWorker } from "./RegexWorker.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/StopWords");
const Patterns = S.Struct({ stopWords: CitationPythonUnicodeStorage, leadingIn: CitationPythonUnicodeStorage });
const fingerprints = {
  stopWords: "73533a3c332db44e595c510a7b4362d8214a6e6a4d3bc8077f064e547124a258",
  leadingIn: "79c1a5ca5ef8fc6e01f761dd1714aba5121d3256242bdedc74fb6b3f513e570e",
};
const Reason = LiteralKit(["invalid-configuration", "invalid-input", "invalid-match"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed stop-word cleanup failures without native source or captures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationStopWordsFailure extends S.TaggedError<
  CitationStopWordsFailure,
  { readonly brand: unique symbol }
>($I`CitationStopWordsFailure`)(
  "CitationStopWordsFailure",
  { reason: Reason },
  $I.annoteError<CitationStopWordsFailure>("CitationStopWordsFailure", {
    description: "Stop-word cleanup failed without source text or partial output.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationStopWordsFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationStopWordsConfiguration extends S.Opaque<
  CitationStopWordsConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patterns: Patterns,
    bindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(3, 3)),
  }).pipe(
    $I.annoteSchema("CitationStopWordsConfiguration", {
      description: "Fixed source cleanup patterns and three independently observed V0 profiles, not request data.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationStopWordsResult extends S.Opaque<CitationStopWordsResult, { readonly brand: unique symbol }>()(
  S.Struct({
    text: CitationPythonUnicodeStorage,
    reservedUnits: S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationStopWordsResult", {
      description: "Atomic cleaned native text and cumulative invocation reservations.",
    })
  )
) {}
const Config = S.toType(CitationStopWordsConfiguration);
const Native = S.toType(CitationPythonUnicodeStorage);
const space = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([32]) });
const commaSpace = (point: number) => point === 44 || point === 32;
/** Run under an enclosing admitted operation, native Scope and text budget.
 * @internal @category operations @since 0.0.0
 */
export const cleanCitationStopWords = Effect.fn("Citation.runStopWordCleanup")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationStopWordsConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Native)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const input = yield* makeCitationRegexInput(limits);
  const worker = yield* makeCitationRegexWorker(limits, runtime, config.bindings, "python-regex-v0");
  const substitute = Effect.fn("Citation.substituteStopWordPattern")(function* (
    name: keyof typeof fingerprints,
    source: CitationPythonUnicodeStorage,
    flags: number,
    withSpace: boolean
  ) {
    const evaluated = yield* worker.evaluate(config.patterns[name], source, flags);
    return yield* substituteCitationMetadataMatches(evaluated, withSpace ? O.some(space) : O.none(), () =>
      fail("invalid-match")
    );
  });
  const trim = Effect.fn("Citation.trimStopWordText")(function* (
    source: CitationPythonUnicodeStorage,
    left: (point: number) => boolean,
    right = left
  ) {
    const prepared = yield* input.prepareUnicode(source, () => Effect.void);
    const length = prepared.value.pythonLength;
    const start = yield* trimCitationMetadataBoundary(prepared.value, 0, length, 1, left);
    const end = 1 + (yield* trimCitationMetadataBoundary(prepared.value, length - 1, start - 1, -1, right));
    return yield* prepared.slice({ start, end }, () => Effect.void);
  });
  const secondSemicolonPart = Effect.fn("Citation.selectSecondCaseNamePart")(function* (
    source: CitationPythonUnicodeStorage
  ) {
    const prepared = yield* input.prepareUnicode(source, () => Effect.void);
    let start = 0;
    for (let index = 0; index < prepared.value.pythonLength; index++) {
      if (index % 256 === 0) yield* Effect.yieldNow;
      if (citationPythonPointAt(prepared.value.storage, index) !== 59) continue;
      if (start > 0) return yield* prepared.slice({ start, end: index }, () => Effect.void);
      start = index + 1;
    }
    return start === 0
      ? prepared.value.storage
      : yield* prepared.slice({ start, end: prepared.value.pythonLength }, () => Effect.void);
  });
  const cleaned = yield* substitute("stopWords", request, 0, true);
  const withoutIn = yield* substitute("leadingIn", cleaned, 0, false);
  const stripped = yield* trim(withoutIn, citationMetadataWhitespaceBoundary);
  const unparenthesized = yield* trim(
    stripped,
    (point) => point === 40,
    (point: number) => point === 41
  );
  const selected = yield* secondSemicolonPart(unparenthesized);
  const unpunctuated = yield* trim(selected, commaSpace);
  const final = yield* substitute("stopWords", unpunctuated, 2, false);
  const withoutCommas = yield* trim(final, commaSpace);
  return yield* trim(withoutCommas, citationMetadataWhitespaceBoundary);
});
/** Capture trusted patterns, Clock, admission, process services and optional
 * cumulative text budget. Each call owns fresh scoped workers; methods are R=never.
 * @internal @category operations @since 0.0.0
 */
export const copyCitationStopWordsConfiguration = Effect.fn("Citation.copyStopWordsConfiguration")(function* (
  limits: CitationEngineLimits,
  decoded: CitationStopWordsConfiguration
) {
  const patterns = yield* copyCitationMetadataPatterns(limits, decoded.patterns, fingerprints, () =>
    fail("invalid-configuration")
  );
  const owned = yield* S.decodeUnknownEffect(Patterns)(patterns).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  return CitationStopWordsConfiguration.make({
    patterns: owned,
    bindings: A.map(decoded.bindings, copyCitationRegexDescriptor),
  });
});
/** Install the standalone admitted cleaner with captured services and timing.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationStopWords = Effect.fn("Citation.makeStopWords")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const {
    limits,
    configuration: decoded,
    runtime,
  } = yield* decodeCitationMetadataRuntimeConfiguration(policy, runtimeInput, configurationInput, Config, () =>
    fail("invalid-configuration")
  );
  const config = yield* copyCitationStopWordsConfiguration(limits, decoded);
  const installed = yield* makeCitationMetadataOperation(
    limits,
    (raw: unknown) => cleanCitationStopWords(limits, runtime, config, raw),
    () => fail("invalid-configuration")
  );
  const clean = Effect.fn("Citation.stripStopWords")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const [text, reservedUnits] = yield* installed.run(raw);
          return CitationStopWordsResult.make({ text, reservedUnits });
        })
      ),
    installed.timing.timed
  );
  return { clean };
});
