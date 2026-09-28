// @vitest-environment node

import { DOC_TEXT_ENGINE_VERSION } from "@beep/doc-text";
import { isUtf16Boundary, SourceTextExtractor, TextAnchor } from "@beep/provenance";
import { NonNegativeInt } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { ConfigProvider, Effect, Layer, Number as N, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { F1Catalog, F1CatalogLive } from "@/fixtures/F1";
import { GOLD_PROMPT_ARTIFACT_HASH } from "@/gold/Prompts";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { DocumentSourceLive } from "@/layers/DocumentSourceLive";
import { AnthropicExtractionLanguageModelLive, XAiGoldLanguageModelLive } from "@/layers/LanguageModelLive";
import { ParserLive, ParserRetryLive } from "@/layers/ParserLive";
import { extractHtmlText } from "@/parse/Html";
import { LabConfigLive } from "@/runtime/Config";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { makeChunkId, ParseOutcome } from "@/schema/Text";
import { Canonicalizer } from "@/services/Canonicalizer";
import { Chunker } from "@/services/Chunker";
import { DocumentSource } from "@/services/DocumentSource";
import { Parser } from "@/services/Parser";
import type { F1Fixture } from "@/fixtures/F1";

const runtime = Layer.mergeAll(
  F1CatalogLive,
  CanonicalizerLive,
  ChunkerLive.pipe(Layer.provide(CanonicalizerLive)),
  DocumentSourceLive,
  ParserLive
).pipe(
  Layer.provideMerge(Layer.mergeAll(BunServices.layer, LabConfigLive)),
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} })))
);
const fixtureDocument = (fixture: F1Fixture): SourceDocument => {
  const id = DocumentId.make(fixture.sha256);
  return SourceDocument.make({
    acquired: ProvenanceEventId.make(fixture.sha256),
    bytes: fixture.bytes,
    id,
    mediaType: fixture.mediaType,
    origin: Origin.cases.Fixture.make({
      declared: FixtureDeclaration.make({
        degradedKind: fixture.degradedKind,
        expectation: fixture.expectation,
      }),
      fixtureId: fixture.id,
      relativePath: fixture.relativePath,
    }),
    sha256: fixture.sha256,
  });
};

const textArbitrary = Arbitrary.schema(
  S.Array(S.Literals(["word", " ", ". ", "\r\n", "\n\n", "🧑🏽‍🔬", "Cafe\u0301", "# Heading\r\n\r\n"])).check(
    S.isMinLength(1),
    S.isMaxLength(20)
  )
).pipe(
  Arbitrary.map((parts) => A.join(parts, "")),
  Arbitrary.filter((text) => Str.isNonEmpty(Str.trim(text)))
);

describe("C0 HTML extractor", () => {
  it("ends a raw-text element at its first closing tag even when the content mentions an opener", () => {
    const html = '<p>A</p><script>const s = "<script>";</script><p>B</p>';
    expect(extractHtmlText(html)).toMatchObject({ _tag: "Success", success: "\nA\n\nB\n" });
    const style = "<div>C</div><style>.x::before { content: '<style>' }</style><span>D</span>";
    expect(extractHtmlText(style)).toMatchObject({ _tag: "Success", success: "\nC\nD" });
  });

  it("is deterministic, documents its entity behavior, and drops hidden text", () => {
    const html = "<head>hidden</head><p>A&amp;B&#33;</p><script>leak</script><div>C&mdash;D&nbsp;E</div>";
    const first = extractHtmlText(html);
    const second = extractHtmlText(html);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      _tag: "Success",
      success: "\nA&B!\n\nC—D E\n",
    });
  });

  it("treats script bodies containing less-than signs as opaque raw text", () => {
    expect(extractHtmlText("<script>if (a < b) {}</script><p>visible</p>")).toMatchObject({
      _tag: "Success",
      success: "\nvisible\n",
    });
  });

  it("keeps nested head content hidden and ends raw-text elements at their first close", () => {
    expect(extractHtmlText("<head>outer<head>inner</head>still hidden</head><p>visible</p>")).toMatchObject({
      _tag: "Success",
      success: "\nvisible\n",
    });
    // script and style are HTML5 raw-text elements: they never nest, so the FIRST
    // closing tag ends the element and the trailing text is visible content.
    expect(extractHtmlText("<script>outer<script>inner</script>still hidden</script><p>visible</p>")).toMatchObject({
      _tag: "Success",
      success: "still hidden\nvisible\n",
    });
    expect(extractHtmlText("<style>outer<style>inner</style>still hidden</style><p>visible</p>")).toMatchObject({
      _tag: "Success",
      success: "still hidden\nvisible\n",
    });
  });

  it.each(['<p title="unfinished', "<p title='unfinished", "<!-- unfinished", "<section"])(
    "reports truncated for EOF inside markup: %s",
    (html) => {
      expect(extractHtmlText(html)).toMatchObject({
        _tag: "Failure",
        failure: "truncated",
      });
    }
  );
});

describe("C0 F1 input services", () => {
  it("keeps breaker and hosted-provider Layers available without default acquisition", () => {
    pipe(Layer.isLayer(ParserRetryLive), assertTrue);
    pipe(Layer.isLayer(AnthropicExtractionLanguageModelLive(GOLD_PROMPT_ARTIFACT_HASH)), assertTrue);
    pipe(
      Layer.isLayer(
        XAiGoldLanguageModelLive({
          artifactHash: GOLD_PROMPT_ARTIFACT_HASH,
          model: "grok-4-20260826",
        })
      ),
      assertTrue
    );
  });

  it.layer(Layer.merge(runtime, ParserRetryLive), { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("acquires ParserRetryLive and preserves both F1 PDF outcomes", () =>
      Effect.gen(function* () {
        const catalog = yield* F1Catalog;
        const source = yield* DocumentSource;
        const retryParser = yield* Parser;
        const index = yield* catalog.load;
        const twoColumn = A.getUnsafe(
          A.filter(index.fixtures, (fixture) => Str.Equivalence(fixture.id, "pdf-two-column")),
          0
        );
        const truncated = A.getUnsafe(
          A.filter(index.fixtures, (fixture) => Str.Equivalence(fixture.id, "pdf-truncated")),
          0
        );

        const twoColumnDocument = fixtureDocument(twoColumn);
        const twoColumnOutcome = yield* source
          .read(twoColumnDocument)
          .pipe(Effect.flatMap((bytes) => retryParser.parse(twoColumnDocument, bytes)));
        expect(twoColumnOutcome.outcome).toBe("Parsed");
        if (twoColumnOutcome.outcome === "Parsed") {
          pipe(Str.isNonEmpty(Str.trim(twoColumnOutcome.text)), assertTrue);
          expect(twoColumnOutcome.extractor.name).toBe("unpdf-raw");
        }

        const truncatedDocument = fixtureDocument(truncated);
        const truncatedOutcome = yield* source
          .read(truncatedDocument)
          .pipe(Effect.flatMap((bytes) => retryParser.parse(truncatedDocument, bytes)));
        expect(truncatedOutcome.outcome).toBe("Degraded");
        if (truncatedOutcome.outcome === "Degraded") {
          expect(O.some(truncatedOutcome.kind)).toEqual(truncated.degradedKind);
        }
      })
    );
  });

  it.layer(runtime, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("matches all nine declared parse outcomes and verifies every parsed anchor", () =>
      Effect.gen(function* () {
        const catalog = yield* F1Catalog;
        const canonicalizer = yield* Canonicalizer;
        const source = yield* DocumentSource;
        const parser = yield* Parser;
        const index = yield* catalog.load;

        const outcomes = yield* Effect.forEach(
          index.fixtures,
          Effect.fnUntraced(function* (fixture) {
            const document = fixtureDocument(fixture);
            const bytes = yield* source.read(document);
            const outcome = yield* parser.parse(document, bytes);

            if (fixture.expectation === "degraded") {
              expect(outcome.outcome).toBe("Degraded");
              if (outcome.outcome === "Degraded") {
                expect(O.some(outcome.kind)).toEqual(fixture.degradedKind);
              }
              return { fixture: fixture.id, outcome: outcome.outcome };
            }

            expect(outcome.outcome).toBe("Parsed");
            if (outcome.outcome === "Degraded") {
              return yield* Effect.die(new Error(`Expected ${fixture.id} to parse, got ${outcome.kind}.`));
            }
            const canonical = yield* canonicalizer.identify(document, outcome);
            if (Str.Equivalence(fixture.mediaType, "application/pdf")) {
              expect(outcome.extractor.version).toBe(DOC_TEXT_ENGINE_VERSION);
            }
            const width = N.min(20, Str.length(canonical.text));
            const quote = Str.slice(0, width)(canonical.text);
            pipe(Str.isNonEmpty(quote), assertTrue);
            const receipt = yield* canonicalizer.verify(
              canonical,
              TextAnchor.make({
                endChar: NonNegativeInt.make(width),
                quote,
                startChar: NonNegativeInt.make(0),
              })
            );
            expect(receipt.anchor.quote).toBe(quote);
            expect(receipt.source).toEqual(canonical.identity);
            return { fixture: fixture.id, outcome: outcome.outcome };
          }),
          { concurrency: 1 }
        );

        expect(A.length(outcomes)).toBe(9);
        expect(A.length(A.filter(outcomes, ({ outcome }) => outcome === "Parsed"))).toBe(6);
        expect(A.length(A.filter(outcomes, ({ outcome }) => outcome === "Degraded"))).toBe(3);
      })
    );
  });

  it.layer(runtime, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("chunks every parsed F1 text with exact global UTF-16 anchors", () =>
      Effect.gen(function* () {
        const catalog = yield* F1Catalog;
        const canonicalizer = yield* Canonicalizer;
        const chunker = yield* Chunker;
        const source = yield* DocumentSource;
        const parser = yield* Parser;
        const index = yield* catalog.load;

        const parsedCounts = yield* Effect.forEach(
          index.fixtures,
          Effect.fnUntraced(function* (fixture) {
            const document = fixtureDocument(fixture);
            const bytes = yield* source.read(document);
            const outcome = yield* parser.parse(document, bytes);
            if (outcome.outcome === "Degraded") {
              return 0;
            }
            const canonical = yield* canonicalizer.identify(document, outcome);
            const chunks = yield* chunker.chunk(canonical);
            for (const chunk of chunks) {
              expect(Str.slice(chunk.anchor.startChar, chunk.anchor.endChar)(canonical.text)).toBe(chunk.anchor.quote);
              pipe(isUtf16Boundary(canonical.text, chunk.anchor.startChar), assertTrue);
              pipe(isUtf16Boundary(canonical.text, chunk.anchor.endChar), assertTrue);
              expect(makeChunkId(chunk)).toMatchObject({ _tag: "Success", success: chunk.id });
            }
            if (fixture.id === "md-unicode") {
              expect(canonical.text).toContain("\r\n");
              pipe(
                A.some(chunks, (chunk) => chunk.anchor.quote.includes("🧑🏽‍🔬")),
                assertTrue
              );
            }
            return A.length(chunks);
          }),
          { concurrency: 1 }
        );

        pipe(
          A.every(parsedCounts, (count) => count >= 0),
          assertTrue
        );
        expect(A.length(A.filter(parsedCounts, (count) => count > 0))).toBe(6);
      })
    );
  });

  it.layer(runtime, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect(
      "preserves slice-back and UTF-16 boundaries across generated Unicode layouts (fixed heading and sentence cases)",
      () =>
        Effect.gen(function* () {
          const catalog = yield* F1Catalog;
          const canonicalizer = yield* Canonicalizer;
          const chunker = yield* Chunker;
          const fixture = A.headNonEmpty((yield* catalog.load).fixtures);
          const document = fixtureDocument(fixture);
          const headingText = "# Heading\r\nBody sentence.";
          const headingParsed = ParseOutcome.cases.Parsed.make({
            document: document.id,
            extractor: SourceTextExtractor.make({ name: "chunker-heading", version: "0.0.0" }),
            outcome: "Parsed",
            text: headingText,
          });
          const headingCanonical = yield* canonicalizer.identify(document, headingParsed);
          const headingChunks = yield* chunker.chunk(headingCanonical);
          expect(A.headNonEmpty(headingChunks)).toMatchObject({
            anchor: { endChar: 9, quote: "# Heading", startChar: 0 },
            kind: "heading",
          });

          const sentenceCases = [
            {
              expected: [{ kind: "paragraph", quote: "One sentence." }],
              text: "One sentence.",
            },
            {
              expected: [
                { kind: "sentence", quote: "First." },
                { kind: "sentence", quote: "Second!" },
              ],
              text: "First. Second!",
            },
            {
              expected: [
                { kind: "sentence", quote: "Wait!" },
                { kind: "sentence", quote: "Why?" },
                { kind: "sentence", quote: "Fine" },
              ],
              text: "Wait!  Why? Fine",
            },
            {
              expected: [
                { kind: "sentence", quote: "Version 1.2 works." },
                { kind: "sentence", quote: "Next" },
              ],
              text: "Version 1.2 works. Next",
            },
            {
              expected: [{ kind: "paragraph", quote: "Question?Trailing" }],
              text: "Question?Trailing",
            },
          ];
          for (const sentenceCase of sentenceCases) {
            const parsed = ParseOutcome.cases.Parsed.make({
              document: document.id,
              extractor: SourceTextExtractor.make({ name: "chunker-sentence-branches", version: "0.0.0" }),
              outcome: "Parsed",
              text: sentenceCase.text,
            });
            const canonical = yield* canonicalizer.identify(document, parsed);
            const chunks = yield* chunker.chunk(canonical);
            expect(A.map(chunks, (chunk) => ({ kind: chunk.kind, quote: chunk.anchor.quote }))).toEqual(
              sentenceCase.expected
            );
          }
        })
    );
    it.effect.prop(
      "preserves slice-back and UTF-16 boundaries across generated Unicode layouts",
      [textArbitrary],
      ([text]) =>
        Effect.gen(function* () {
          const catalog = yield* F1Catalog;
          const canonicalizer = yield* Canonicalizer;
          const chunker = yield* Chunker;
          const fixture = A.headNonEmpty((yield* catalog.load).fixtures);
          const document = fixtureDocument(fixture);
          const parsed = ParseOutcome.cases.Parsed.make({
            document: document.id,
            extractor: SourceTextExtractor.make({ name: "chunker-property", version: "0.0.0" }),
            outcome: "Parsed",
            text,
          });
          const canonical = yield* canonicalizer.identify(document, parsed);
          const chunks = yield* chunker.chunk(canonical);
          assertTrue(
            A.every(
              chunks,
              (chunk) =>
                Str.slice(chunk.anchor.startChar, chunk.anchor.endChar)(canonical.text) === chunk.anchor.quote &&
                isUtf16Boundary(canonical.text, chunk.anchor.startChar) &&
                isUtf16Boundary(canonical.text, chunk.anchor.endChar)
            )
          );
        }),
      { arbitrary: fcRuns(30) }
    );
  });
});
