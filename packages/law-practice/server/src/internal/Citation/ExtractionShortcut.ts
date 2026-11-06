/** Original primitive-string get_citations shortcut and helpers.joke_cite.
 * eyecite 2.7.6, Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCaseMetadataFields } from "./CaseMetadata.ts";
import {
  CitationFullExtractionOutcome,
  CitationFullExtractionResult,
  makeCitationEmptyCaseMetadata,
} from "./FullExtraction.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ExtractionShortcut");
const Keyword = LiteralKit(["eyecite"]).pipe(
  $I.annoteSchema("Keyword", {
    description: "Exact original primitive-string shortcut before Document construction or other argument evaluation.",
  })
);
const isKeyword = S.is(Keyword);
// Every literal below is ASCII in the authenticated upstream initializer. This
// is static data encoding, never conversion of arbitrary source Unicode.
const ascii = (literal: string) =>
  CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(literal) });
const joke: ReadonlyArray<CitationFullExtractionResult> = [
  CitationFullExtractionResult.make({
    index: 0,
    token: CitationTokenSeed.make({
      kind: "CitationToken",
      data: ascii("1 FLP 1"),
      start: 0,
      end: 99,
      groups: { volume: ascii("1"), reporter: ascii("FLP"), page: ascii("1") },
      exact: [],
      variation: [],
      short: false,
    }),
    outcome: CitationFullExtractionOutcome.cases.FullCaseCitation.make({
      metadata: CitationCaseMetadataFields.make({
        ...makeCitationEmptyCaseMetadata(),
        year: ascii("2021"),
        extra: ascii("Eyecite is a collaborative community effort."),
      }),
      year: null,
      editionGuess: null,
      fullSpanStart: null,
      fullSpanEnd: null,
      usedHtml: false,
      usedPlain: false,
      reservedUnits: 0,
    }),
  }),
];
/** Check the primitive plain argument before decoding or initializing remaining
 * arguments. A match returns the same module-level list/model on every call,
 * without metadata inference, Document attachment or native work. General
 * host equality overrides and mutable alias protocols remain separate duties.
 * @internal @category operations @since 0.0.0
 */
export const getCitationExtractionShortcut = (plain: unknown): O.Option<ReadonlyArray<CitationFullExtractionResult>> =>
  isKeyword(plain) ? O.some(joke) : O.none();
