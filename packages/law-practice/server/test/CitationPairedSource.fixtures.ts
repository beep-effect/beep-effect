/** Paired-source proof integration; original Both branch is independently
 * observed in the sealed 112-case document-input-mode corpus.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { makeCitationSemanticExtraction } from "@beep/law-practice-server/internal/Citation/SemanticExtraction";
import { makeCitationSourcePairExtraction } from "@beep/law-practice-server/internal/Citation/SourceExtraction";
import { makeCitationVerifiedExtraction } from "@beep/law-practice-server/internal/Citation/VerifiedExtraction";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { makeCitationTestInvocationBinding } from "./CitationInvocation.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import type { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";

const sameSource = S.toEquivalence(SourceTextIdentity);
type Installed = Effect.Success<ReturnType<typeof installCitationDefaultConfigurationFixture>>;
const installPair = Effect.fnUntraced(function* (
  installed: Installed,
  plain: VerifiedSourceText,
  markup: VerifiedSourceText
) {
  const { setup, defaultConfiguration, engineArtifact, provided } = installed;
  let resolutions = 0;
  const paired = yield* makeCitationSourcePairExtraction(setup.limits, setup.runtime, {
    engineArtifact,
    extraction: defaultConfiguration,
  }).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestInvocationBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
      )
    ),
    Effect.provideContext(provided),
    Effect.provideService(
      SourceTextResolver,
      SourceTextResolver.of({
        resolve: Effect.fn("PairedSourceTest.resolve")((request) =>
          Effect.gen(function* () {
            const admitted = yield* setup.operation.snapshot;
            expect(admitted).toMatchObject({ active: 1, queued: 0 });
            resolutions++;
            if (sameSource(request.identity, plain.source))
              return ResolvedSourceText.make({ identity: plain.source, text: plain.sourceText });
            if (sameSource(request.identity, markup.source))
              return ResolvedSourceText.make({ identity: markup.source, text: markup.sourceText });
            return yield* SourceTextResolverError.new("source-unavailable", "unknown fixture source");
          })
        ),
      })
    ),
    DateTime.withCurrentZoneOffset(0)
  );
  return { paired, resolutions: Effect.sync(() => resolutions) };
});
type VerifiedResult = Pick<
  Effect.Success<ReturnType<Effect.Success<ReturnType<typeof makeCitationVerifiedExtraction>>["extract"]>>,
  "source" | "semantic" | "occurrences" | "reservedUnits" | "inputs"
>;
type SemanticResult = Effect.Success<
  ReturnType<Effect.Success<ReturnType<typeof makeCitationSemanticExtraction>>["extract"]>
>;
const assertPairResult = Effect.fnUntraced(function* (
  actual: VerifiedResult,
  expected: SemanticResult,
  plain: VerifiedSourceText,
  markup: VerifiedSourceText
) {
  if (expected.raw.outcome._tag !== "Document") return yield* Effect.die("expected original Both branch");
  const expectedModels = A.map(expected.raw.outcome.result.extraction.extraction.citations, (entry) => entry.model);
  expect(actual.inputs).toEqual({ plain: plain.source, markup: markup.source });
  expect(actual.source.parent).toEqual(markup.source);
  expect(actual.source._tag).toBe("Derived");
  expect(actual.source.source.sourceText).toBe(plain.sourceText);
  expect(actual.source.source.source.sourceDigest).toBe(markup.source.sourceDigest);
  expect(actual.semantic.citations).toEqual(expected.citations);
  if (actual.semantic.raw.outcome._tag !== "Document") return yield* Effect.die("expected verified Both branch");
  const actualModels = A.map(
    actual.semantic.raw.outcome.result.extraction.extraction.citations,
    (entry) => entry.model
  );
  expect(actualModels).toEqual(expectedModels);
  expect(actual.occurrences.unverified).toEqual([]);
  expect(actual.occurrences.mentions.length).toBeGreaterThan(0);
  for (const mention of actual.occurrences.mentions) {
    const anchor = mention.anchor.anchor;
    expect(Str.slice(anchor.startChar, anchor.endChar)(plain.sourceText)).toBe(anchor.quote);
    expect(mention.anchor.source).toEqual(actual.source.source.source);
  }
});
/** Compare the verified adapter with unchanged primitive execution; this is
 * composition proof, not a new exhaustive upstream-model parity claim.
 */
export const replayCitationPairedSource = Effect.fn("PairedSourceTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  const { setup, defaultConfiguration, engineArtifact, provided } = installed;
  const verified = yield* makeCitationVerifiedExtraction(setup.limits, setup.runtime, {
    engineArtifact,
    extraction: defaultConfiguration,
  }).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestInvocationBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
      )
    ),
    Effect.provideContext(provided),
    DateTime.withCurrentZoneOffset(0)
  );
  const semantic = yield* makeCitationSemanticExtraction(setup.limits, setup.runtime, defaultConfiguration).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestInvocationBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
      )
    ),
    Effect.provideContext(provided),
    DateTime.withCurrentZoneOffset(0)
  );
  const plain = yield* citationFixtureSourceProof("Foo v. Bar, 1 U.S. 1 (2000). Id. at 2.");
  const markup = yield* citationFixtureSourceProof("<p>Independently supplied markup 😀</p>");
  const expected = yield* semantic.extract({ plain: plain.sourceText, markup: markup.sourceText, cleanSteps: [] });
  const pair = yield* installPair(installed, plain, markup);
  const paired = pair.paired;
  for (const role of ["plain", "markup", "raw"]) {
    const source = role === "plain" ? plain : markup;
    const companion = role === "plain" ? markup : plain;
    const invocation =
      role === "raw"
        ? paired.extract({
            plain: { source: plain.source, sourceText: plain.sourceText },
            markup: { source: markup.source, sourceText: markup.sourceText },
            cleanSteps: [],
          })
        : verified.extract({ source, companion, role, cleanSteps: [] });
    const closed: Effect.Effect<
      Effect.Success<typeof invocation>,
      Effect.Error<typeof invocation>,
      CitationInvocation
    > = invocation;
    const actual = yield* closed;
    yield* assertPairResult(actual, expected, plain, markup);
  }
  const resolutions = yield* pair.resolutions;
  expect(resolutions).toBe(2);
  const before = yield* setup.observed.snapshot;
  const forged = yield* verified
    .extract({
      source: plain,
      role: "plain",
      companion: { source: markup.source, sourceText: markup.sourceText },
      cleanSteps: [],
    })
    .pipe(Effect.flip);
  expect(forged).toMatchObject({ _tag: "CitationVerifiedExtractionFailure", reason: "invalid-input" });
  const after = yield* setup.observed.snapshot;
  expect(after).toEqual(before);
  const ambiguous = yield* verified
    .extract({ source: plain, role: "plain", companion: markup, cleanSteps: ["html"] })
    .pipe(Effect.flip);
  expect(ambiguous).toMatchObject({ _tag: "CitationDocumentInputFailure", reason: "ambiguous-cleaning" });
  const joke = yield* citationFixtureSourceProof("eyecite");
  let reads = 0;
  const shortcut = yield* verified.extract({
    source: joke,
    role: "plain",
    get companion() {
      reads++;
      return Symbol("ignored");
    },
  });
  expect(reads).toBe(0);
  expect(shortcut.inputs).toEqual({ plain: joke.source, markup: null });
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
