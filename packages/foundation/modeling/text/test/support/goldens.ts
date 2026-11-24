import { PosixPath } from "@beep/schema/PosixPath";
import { anchoredOn } from "@beep/text/Arbitrary";
import { OccurrenceId } from "@beep/text/Occurrence";
import { QuoteKey } from "@beep/text/QuoteKey";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import * as Str from "effect/String";

/** The source text of the existing `cm1` test: two occurrences of one citation after an astral character. */
export const citationText = "😀 1 U.S. 1; 1 U.S. 1";

/** The capture of {@link citationText}; its text digest is the SHA-256 of the text. */
export const citationSource = SourceTextIdentity.make({
  scopeRef: "matter:example",
  sourceRef: "source:example",
  locator: PosixPath.make("documents/source.txt"),
  sourceDigest: SourceTextDigest.make(`sha256:${Str.repeat(64)("a")}`),
  textDigest: SourceTextDigest.make("sha256:8de1c1a5a8abb0bdb1fc6c7b77a78338e87ab823115cb2dad18003f268e5515f"),
  extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
  normalizationVersion: "1",
});

/** The first and second occurrence of `1 U.S. 1`: UTF-16 3 to 11 and 13 to 21. */
export const firstCitation = anchoredOn(citationSource, citationText, { start: 3, end: 11 });
export const secondCitation = anchoredOn(citationSource, citationText, { start: 13, end: 21 });

/**
 * `["occurrence/v1","matter:example","source:example","documents/source.txt","sha256:aaaa…(64)",
 * "sha256:8de1…515f","utf8","1","1","utf16-code-unit",3,11,"1 U.S. 1"]`, and the same with 13, 21.
 *
 * Every golden hash of the P2 design (sections 1.4 and 6) in this module was recomputed by hand: a plain SHA-256
 * over the hand-written RFC 8785 JSON of `[domainTag, ...preimage]`, independently of the minting code.
 */
export const firstCitationId = OccurrenceId.make(
  "sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48"
);
export const secondCitationId = OccurrenceId.make(
  "sha256:2e5d4f58fb6a3f10d11c79aa2afe3f08960ee4a60b45df59830b5e977d3bd032"
);

/** `["quote-key/v1","nfkc-dehyphenate/v1","1 U.S. 1"]`. */
export const citationQuoteKey = QuoteKey.make(
  "sha256:4d35c407eaeb249dd409c6f6e33515178a35b09ce1bfc6f088dfdf459c69c7ab"
);

const emptyDigest = SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

/**
 * The receipt equivalent to the agent-memory node-event fixture (`fixtures.ts` of `@beep/agent-memory-store`):
 * `fact` at UTF-16 6 to 10 of a markdown note capture.
 */
export const memoryNote = anchoredOn(
  SourceTextIdentity.make({
    scopeRef: "memory",
    sourceRef: "notes",
    locator: PosixPath.make("notes/decisions.md"),
    sourceDigest: emptyDigest,
    textDigest: emptyDigest,
    extractor: SourceTextExtractor.make({ name: "markdown", version: "1" }),
    normalizationVersion: "1",
  }),
  "Note: fact.",
  { start: 6, end: 10 }
);

/** `["occurrence/v1","memory","notes","notes/decisions.md","sha256:e3b0…b855","sha256:e3b0…b855","markdown","1","1",
 * "utf16-code-unit",6,10,"fact"]`, the golden of section 6. */
export const memoryNoteId = OccurrenceId.make(
  "sha256:654d949fc9259fd7b3b3d90ef96c270b444cfece9feb03f15dfe29013001a06d"
);
