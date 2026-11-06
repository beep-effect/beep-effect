import * as NodeURL from "node:url";
import { Citation, CitationEditionRef, CitationShortCaseMetadata } from "@beep/law-practice-domain/values";
import { getCitationExtractionShortcut } from "@beep/law-practice-server/internal/Citation/ExtractionShortcut";
import { makeCitationSemanticProjection } from "@beep/law-practice-server/internal/Citation/SemanticProjection";
import { makeCitationSemanticVocabulary } from "@beep/law-practice-server/internal/Citation/SemanticVocabulary";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { readCitationOracleFixture, setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex, CitationTokenSeedHex } from "./CitationTokenSeed.fixtures.ts";

const Mapping = S.fromJsonString(
  S.Struct({
    publicArtifactVersion: S.String,
    editions: S.Array(
      S.Struct({
        kind: S.Literals(["case-reporter", "law-publication", "journal-publication"]),
        artifactSha256: CitationEditionRef,
        reporterId: S.optionalKey(S.String),
      })
    ),
  })
);
const SourceModels = S.fromJsonString(
  S.Struct({
    bindings: S.Array(S.Struct({ id: S.Natural, ref: CitationEditionRef })),
    cases: S.Array(
      S.Struct({
        before: S.Array(
          S.Struct({
            kind: S.String,
            index: S.Int,
            token: CitationTokenSeedHex,
            metadata: S.Record(S.String, S.Union([S.Null, CitationNativeUnicodeHex, S.Int])),
            span: S.Tuple([S.Int, S.Int]),
            fullSpanStart: S.NullOr(S.Int),
            fullSpanEnd: S.NullOr(S.Int),
            year: S.NullOr(S.Int),
            editionGuess: S.NullOr(CitationEditionRef),
          })
        ),
      })
    ),
  })
);
const fieldNames = R.fromEntries<readonly [string, string]>([
  ["pin_cite", "pinCite"],
  ["pin_cite_span_start", "pinCiteSpanStart"],
  ["pin_cite_span_end", "pinCiteSpanEnd"],
  ["antecedent_guess", "antecedentGuess"],
  ["resolved_case_name", "resolvedCaseName"],
  ["resolved_case_name_short", "resolvedCaseNameShort"],
]);
const semanticFields = R.fromEntries<readonly [string, string]>([
  ["pin_cite", "pinCite"],
  ["antecedent_guess", "antecedentGuess"],
  ["resolved_case_name", "caseName"],
  ["resolved_case_name_short", "shortCaseName"],
  ["extra", "additionalText"],
]);
const sourceTypes = R.fromEntries<readonly [string, string]>([
  ["FullCaseCitation", "case"],
  ["ShortCaseCitation", "shortFormCase"],
  ["FullLawCitation", "law"],
  ["FullJournalCitation", "journal"],
  ["IdCitation", "id"],
  ["SupraCitation", "supra"],
  ["ReferenceCitation", "reference"],
  ["UnknownCitation", "unknown"],
]);
const ascii = (value: CitationNativeUnicodeHex | null) => {
  if (value === null) return null;
  expect(value.width).toBe(1);
  expect(A.every(A.fromIterable(value.bytes), (byte) => byte < 128)).toBe(true);
  return new TextDecoder().decode(value.bytes);
};
const encodeCitation = S.encodeEffect(Citation);
const citationJson = S.fromJsonString(Citation);
const equivalent = S.toEquivalence(Citation);
const load = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(
    NodeURL.fileURLToPath(new URL("../assets/citation/semantic-editions.json", import.meta.url))
  );
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("semantic citation projection", (it) => {
  it.effect("resolves every reviewed edition and refuses corruption and family confusion", () =>
    Effect.gen(function* () {
      const raw = yield* load();
      const vocabulary = yield* makeCitationSemanticVocabulary(raw);
      const mapping = yield* readCitationOracleFixture(
        "vocabulary-mapping",
        "b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5"
      ).pipe(Effect.flatMap(S.decodeEffect(Mapping)));
      expect(vocabulary.vocabularyVersion).toBe(mapping.publicArtifactVersion);
      for (const row of mapping.editions) {
        const family = row.kind === "case-reporter" ? "case" : row.kind === "law-publication" ? "law" : "journal";
        const actual = yield* vocabulary.lookup(row.artifactSha256, family);
        expect(actual).toEqual(
          family === "case"
            ? { family, edition: row.artifactSha256, reporterId: row.reporterId }
            : { family, edition: row.artifactSha256 }
        );
      }
      expect(mapping.editions).toHaveLength(2533);
      const first = A.getUnsafe(mapping.editions, 0);
      const wrongFamily = first.kind === "case-reporter" ? "law" : "case";
      const wrong = yield* vocabulary.lookup(first.artifactSha256, wrongFamily).pipe(Effect.flip);
      expect(wrong).toMatchObject({ reason: "kind-mismatch" });
      const corrupt = yield* makeCitationSemanticVocabulary(`${raw} `).pipe(Effect.flip);
      expect(corrupt).toMatchObject({ reason: "artifact-mismatch" });
    })
  );

  it.effect(
    "projects original shortcut meaning through the public codec without inventing publication or occurrence data",
    () =>
      Effect.gen(function* () {
        const raw = yield* load();
        const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true, 8192);
        const stage = yield* makeCitationSemanticProjection(setup.limits, setup.runtime, {
          editions: [],
          vocabulary: raw,
        }).pipe(Effect.provideContext(setup.provided));
        const models = yield* Effect.fromOption(getCitationExtractionShortcut("eyecite"));
        const actual = yield* stage.project(A.getUnsafe(models, 0));
        const encoded = yield* encodeCitation(actual);
        expect(encoded).toEqual({
          type: "case",
          components: { volume: "1", reporter: "FLP", page: "1" },
          publication: { editions: [], selectedEdition: null, vocabularyVersion: "crv1:f353e51400a5:fad63b383b92" },
          metadata: {
            pinCite: null,
            parenthetical: null,
            year: "2021",
            month: null,
            day: null,
            court: null,
            plaintiff: null,
            defendant: null,
            additionalText: "Eyecite is a collaborative community effort.",
            antecedentGuess: null,
            shortCaseName: null,
            caseName: null,
          },
        });
        const serialized = yield* S.encodeEffect(citationJson)(actual);
        const decoded = yield* S.decodeEffect(citationJson)(serialized);
        expect(equivalent(actual, decoded)).toBe(true);
        const observed = yield* setup.observed.snapshot;
        expect(observed).toEqual({ spawned: 0, confirmed: 0 });
      })
  );

  it.effect(
    "retains legal fields and ordered publication occurrences in all 80 original models across eight families",
    () =>
      Effect.gen(function* () {
        const raw = yield* load();
        const corpus = yield* readCitationOracleFixture(
          "extraction-loop",
          "938316acc08880fd464a9e91b89e45ee802ed4ef08d6c08656baaa925fa97f3e"
        ).pipe(Effect.flatMap(S.decodeEffect(SourceModels)));
        const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true, 8192);
        const stage = yield* makeCitationSemanticProjection(setup.limits, setup.runtime, {
          editions: corpus.bindings,
          vocabulary: raw,
        }).pipe(Effect.provideContext(setup.provided));
        let count = 0;
        for (const document of corpus.cases)
          for (const row of document.before) {
            const metadata = R.mapKeys(row.metadata, (key) => O.getOrElse(R.get(fieldNames, key), () => key));
            const outcome = {
              _tag: row.kind,
              metadata,
              year: row.year,
              editionGuess: row.editionGuess,
              fullSpanStart: row.fullSpanStart,
              fullSpanEnd: row.fullSpanEnd,
              spanEnd: row.span[1],
              usedHtml: false,
              usedPlain: false,
              reservedUnits: 0,
            };
            // Occurrence fields only satisfy the existing private model contract. This
            // test projects captured models; it does not run the parser or verify spans.
            const model =
              row.kind === "ReferenceCitation"
                ? { ...outcome, token: row.token, index: 0, documentAttached: false, spanStart: row.span[0] }
                : { index: row.index, token: row.token, outcome, reservedUnits: 0 };
            const actual = yield* stage.project(model).pipe(Effect.flatMap(encodeCitation));
            expect(actual.type).toBe(O.getOrThrow(R.get(sourceTypes, row.kind)));
            expect(actual.components).toEqual(R.map(row.token.groups, ascii));
            for (const [key, value] of R.toEntries(row.metadata)) {
              if (key === "pin_cite_span_start" || key === "pin_cite_span_end") continue;
              if (typeof value === "number")
                return yield* Effect.die("Unexpected numeric legal metadata in sealed corpus");
              const text = ascii(value);
              const name = O.getOrElse(R.get(semanticFields, key), () => key);
              if (key === "court" && text !== null)
                expect(actual.metadata).toMatchObject({
                  court: { status: "known", id: text, vocabularyVersion: "crv1:f353e51400a5:fad63b383b92" },
                });
              else expect(actual.metadata).toMatchObject({ [name]: text });
            }
            if ("publication" in actual) {
              const expected = A.map(
                A.appendAll(row.token.exact, row.token.variation),
                (id) => O.getOrThrow(A.findFirst(corpus.bindings, (binding) => binding.id === id)).ref
              );
              const refs = A.map(actual.publication.editions, (edition) =>
                typeof edition === "string" ? edition : edition.edition
              );
              expect(refs).toEqual(expected);
              expect(actual.publication.selectedEdition).toBe(row.editionGuess);
            }
            count++;
          }
        expect(count).toBe(80);
        const observed = yield* setup.observed.snapshot;
        expect(observed).toEqual({ spawned: 0, confirmed: 0 });
      })
  );

  it.effect("preserves unmapped court text and rejects missing editions and insufficient output capacity", () =>
    Effect.gen(function* () {
      const vocabulary = yield* load();
      const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true, 8192);
      const stage = yield* makeCitationSemanticProjection(setup.limits, setup.runtime, {
        editions: [],
        vocabulary,
      }).pipe(Effect.provideContext(setup.provided));
      const models = yield* Effect.fromOption(getCitationExtractionShortcut("eyecite"));
      const original = A.getUnsafe(models, 0);
      const changed = {
        ...original,
        outcome: {
          ...original.outcome,
          metadata: {
            ...original.outcome.metadata,
            court: { width: 1, bytes: new TextEncoder().encode("unrecognized-court") },
          },
        },
      };
      const projected = yield* stage.project(changed).pipe(Effect.flatMap(encodeCitation));
      expect(projected.metadata).toMatchObject({ court: { status: "unmapped", value: "unrecognized-court" } });
      const missing = yield* stage
        .project({ ...original, token: { ...original.token, exact: [2532] } })
        .pipe(Effect.flip);
      expect(missing).toMatchObject({ reason: "missing-edition" });
      const constrained = yield* setupCitationMetadataRuntime("bun", undefined, true, true, 8192);
      const limited = yield* makeCitationSemanticProjection(constrained.limits, constrained.runtime, {
        editions: [],
        vocabulary,
      }).pipe(Effect.provideContext(constrained.provided));
      yield* constrained.budget.reserve(constrained.limits.producedTextUtf16 - 1);
      const refused = yield* limited.project(original).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
      const observed = yield* constrained.observed.snapshot;
      expect(observed).toEqual({ spawned: 0, confirmed: 0 });
    })
  );

  it.effect("keeps missing, explicit null, and source-created short-case plaintiff distinct", () =>
    Effect.gen(function* () {
      const common = {
        pinCite: null,
        parenthetical: null,
        court: null,
        year: null,
        month: null,
        day: null,
        antecedentGuess: null,
      };
      for (const raw of [common, { ...common, plaintiff: null }, { ...common, plaintiff: "Nobelman" }]) {
        const decoded = yield* S.decodeEffect(CitationShortCaseMetadata)(raw);
        const encoded = yield* S.encodeEffect(CitationShortCaseMetadata)(decoded);
        expect(encoded).toEqual(raw);
        expect(O.isSome(decoded.plaintiff)).toBe("plaintiff" in raw);
      }
    })
  );
});
