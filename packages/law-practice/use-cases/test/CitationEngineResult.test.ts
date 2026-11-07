import { fixtureSource, TestCrypto } from "@beep/law-practice-domain/test";
import { Citation, CitationDocument } from "@beep/law-practice-domain/values";
import {
  CitationCleanerObject,
  CitationEngineAnnotationResult,
  CitationEngineCleanResult,
  CitationEngineExtractionResult,
  CitationEngineReport,
  CitationEngineResolutionResult,
  CitationEngineSourceEvidence,
  CitationExtractionDiagnostics,
  CitationExtractionMeasurements,
  CitationPythonUnicodeStorage,
  CitationTokenSeed,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CitationEngineOperation } from "@beep/law-practice-use-cases/server";

const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const otherArtifact = Sha256Hex.make(Str.repeat(64)("b"));
const zero = { semanticCitations: 0, verifiedMentions: 0, unverifiedCitations: 0, unverifiedComponents: 0 };
const counts = (overrides: Partial<CitationExtractionMeasurements> = {}) =>
  CitationExtractionMeasurements.make({ tokenizer: null, ...zero, unboundWarnings: 0, ...overrides });
const storage = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([0x61]) });
const diagnostics = CitationExtractionDiagnostics.make({
  unverified: [],
  unverifiedComponents: [],
  unboundWarnings: [],
});

const fixture = Effect.gen(function* () {
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const { source, verifiedSource } = yield* fixtureSource("1 U.S. 1");
  const other = yield* fixtureSource("2 U.S. 2");
  const citation = yield* S.decodeEffect(Citation)({
    type: "unknown",
    components: {},
    metadata: { pinCite: null, parenthetical: null },
  });
  const report = (
    operation: CitationEngineOperation,
    extraction: CitationExtractionMeasurements | null = null,
    engineArtifact = artifact
  ) =>
    CitationEngineReport.make({
      operation,
      engineArtifact,
      limits,
      workDuration: Duration.zero,
      producedTextUtf16: 0,
      extraction,
    });
  const document = (identity = source) =>
    CitationDocument.make({
      source: identity,
      engineArtifact: artifact,
      mentions: [],
      authorities: [],
      resolutions: [],
      groups: [],
      memberLists: [],
      detachedCitations: [],
    });
  return { limits, source, verifiedSource, other, citation, report, document };
});

const refuses = <A, I>(schema: S.Codec<A, I>) => {
  const decode = S.decodeUnknownEffect(S.toType(schema));
  return Effect.fnUntraced(function* (value: unknown) {
    const refused = yield* decode(value).pipe(Effect.flip);
    expect(refused._tag).toBe("SchemaError");
  });
};
const accepts = <A, I>(schema: S.Codec<A, I>) => {
  const decode = S.decodeUnknownEffect(S.toType(schema));
  return Effect.fnUntraced(function* (value: unknown) {
    yield* decode(value);
  });
};

it.layer(TestCrypto)("citation engine results", (it) => {
  it.effect("binds extraction results to one source, engine and exact report accounting", () =>
    Effect.gen(function* () {
      const { source, verifiedSource, other, citation, report, document } = yield* fixture;
      const valid = {
        source: CitationEngineSourceEvidence.cases.Unchanged.make({ source: verifiedSource, parent: source }),
        inputs: { plain: source, markup: null },
        citations: [],
        document: document(),
        diagnostics,
        report: report("extract", counts()),
      };
      yield* accepts(CitationEngineExtractionResult)(valid);
      const reject = refuses(CitationEngineExtractionResult);
      yield* reject({ ...valid, document: document(other.source) });
      yield* reject({ ...valid, report: report("extract", counts(), otherArtifact) });
      yield* reject({ ...valid, report: report("resolve") });
      yield* reject({ ...valid, report: report("extract", counts({ semanticCitations: 1, unverifiedCitations: 1 })) });
      const one = [citation];
      yield* reject({
        ...valid,
        citations: one,
        report: report("extract", counts({ semanticCitations: 1, verifiedMentions: 1 })),
      });
      yield* reject({
        ...valid,
        citations: one,
        report: report("extract", counts({ semanticCitations: 1, unverifiedCitations: 1 })),
      });
      yield* reject({ ...valid, report: report("extract", counts({ unverifiedComponents: 1 })) });
      yield* reject({ ...valid, report: report("extract", counts({ unboundWarnings: 1 })) });
    })
  );

  it.effect("accepts annotation, resolution and clean results only with their own operation reports", () =>
    Effect.gen(function* () {
      const { verifiedSource, other, report, document } = yield* fixture;
      const annotation = { source: verifiedSource, companion: null, text: storage, report: report("annotate") };
      yield* accepts(CitationEngineAnnotationResult)(annotation);
      yield* refuses(CitationEngineAnnotationResult)({ ...annotation, report: report("clean") });

      const resolution = { source: verifiedSource, document: document(), report: report("resolve") };
      yield* accepts(CitationEngineResolutionResult)(resolution);
      const rejectResolution = refuses(CitationEngineResolutionResult);
      yield* rejectResolution({ ...resolution, report: report("clean") });
      yield* rejectResolution({ ...resolution, source: other.verifiedSource });
      yield* rejectResolution({ ...resolution, report: report("resolve", null, otherArtifact) });

      const clean = {
        source: verifiedSource,
        value: CitationCleanerObject.make({ slot: 0 }),
        text: O.some(storage),
        report: report("clean"),
      };
      yield* accepts(CitationEngineCleanResult)(clean);
      yield* refuses(CitationEngineCleanResult)({ ...clean, report: report("resolve") });
    })
  );
});

it.effect("compares native token data by width and exact bytes", () =>
  Effect.sync(() => {
    const equivalent = S.toEquivalence(CitationTokenSeed);
    const seed = (bytes: ReadonlyArray<number>) =>
      CitationTokenSeed.make({
        kind: "CitationToken",
        data: CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array(bytes) }),
        start: 0,
        end: 1,
        groups: {},
        exact: [],
        variation: [],
        short: false,
      });
    expect(equivalent(seed([0x61]), seed([0x61]))).toBe(true);
    expect(equivalent(seed([0x61]), seed([0x62]))).toBe(false);
  })
);

const SeedType = S.toType(CitationTokenSeed);
const seedEquivalent = S.toEquivalence(SeedType);
it.effect.prop(
  "treats every native token seed as equivalent to its own exact-byte copy",
  { value: Arbitrary.schema(SeedType) },
  ({ value }) =>
    Effect.sync(() => {
      const copy = CitationTokenSeed.make({
        ...value,
        data:
          value.data === null
            ? null
            : CitationPythonUnicodeStorage.make({ ...value.data, bytes: value.data.bytes.slice() }),
      });
      assertTrue(seedEquivalent(value, copy));
    }),
  { arbitrary: fcRuns(50) }
);
