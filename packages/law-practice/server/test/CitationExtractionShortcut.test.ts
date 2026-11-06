import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationExtractionLoopEntry } from "@beep/law-practice-server/internal/Citation/ExtractionLoop";
import { projectCitationExtractionSelection } from "@beep/law-practice-server/internal/Citation/ExtractionSelection";
import { getCitationExtractionShortcut } from "@beep/law-practice-server/internal/Citation/ExtractionShortcut";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { assertCitationExtractionLoopModel } from "./CitationExtractionLoop.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex, CitationTokenSeedHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationExtractionShortcut");
const Corpus = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({ plain: S.NullOr(S.String), shortcut: S.Boolean, sameCitation: S.Boolean, events: S.Array(S.String) })
    ),
    snapshot: S.Struct({
      kind: S.String,
      index: S.Int,
      token: CitationTokenSeedHex,
      metadata: S.Record(S.String, S.Union([S.Null, CitationNativeUnicodeHex, S.Int])),
      span: S.Tuple([S.Int, S.Int]),
      fullSpan: S.Tuple([S.Int, S.Int]),
      fullSpanStart: S.NullOr(S.Int),
      fullSpanEnd: S.NullOr(S.Int),
      year: S.NullOr(S.Int),
      editionGuess: S.Null,
      documentAttached: S.Boolean,
    }),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual original shortcut fields, bypass order and shared-list identity observations.",
  })
);

it.layer(citationTokenizerTestLayer)("original extraction shortcut", (it) => {
  it.effect("retains the original primitive guard, complete model and module singleton", () =>
    Effect.gen(function* () {
      const corpus = yield* readCitationOracleFixture(
        "extraction-shortcut",
        "1e676df2e8da2fae7831d9b93223b88d0f46a9a26587d5fc82833835fed12328"
      ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
      const first = yield* Effect.fromOption(getCitationExtractionShortcut("eyecite"));
      for (const row of corpus.cases) {
        const found = getCitationExtractionShortcut(row.plain);
        expect(O.isSome(found)).toBe(row.shortcut);
        if (O.isNone(found)) continue;
        expect(found.value).toBe(first);
        expect(found.value).toHaveLength(1);
        const model = A.getUnsafe(found.value, 0);
        expect(model).toBe(A.getUnsafe(first, 0));
        expect(row.sameCitation).toBe(true);
        expect(row.events).toEqual([]);
        yield* assertCitationExtractionLoopModel(
          CitationExtractionLoopEntry.make({ model, documentAttached: false }),
          corpus.snapshot,
          0
        );
        const projection = yield* projectCitationExtractionSelection(0, model);
        expect(projection.hasEdition).toBe(false);
      }
      expect(corpus.cases).toHaveLength(16);
    })
  );
});
