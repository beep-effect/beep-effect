// @vitest-environment node

import { DOC_TEXT_ENGINE_VERSION } from "@beep/doc-text";
import { TextAnchor } from "@beep/provenance";
import { NonNegativeInt } from "@beep/schema";
import { ConfigProvider, Effect, Layer, Number as N } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { describe, expect, it } from "vitest";
import { F1Catalog } from "@/fixtures/F1";
import { GOLD_PROMPT_ARTIFACT_HASH } from "@/gold/Prompts";
import { AnthropicExtractionLanguageModelLive, XAiGoldLanguageModelLive } from "@/layers/LanguageModelLive";
import { ParserRetryLive } from "@/layers/ParserLive";
import { extractHtmlText } from "@/parse/Html";
import { RuntimeLayer } from "@/runtime/Layer";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { Canonicalizer } from "@/services/Canonicalizer";
import { DocumentSource } from "@/services/DocumentSource";
import { Parser } from "@/services/Parser";
import type { F1Fixture } from "@/fixtures/F1";

const runtime = RuntimeLayer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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
    expect(Layer.isLayer(ParserRetryLive)).toBe(true);
    expect(Layer.isLayer(AnthropicExtractionLanguageModelLive(GOLD_PROMPT_ARTIFACT_HASH))).toBe(true);
    expect(
      Layer.isLayer(
        XAiGoldLanguageModelLive({
          artifactHash: GOLD_PROMPT_ARTIFACT_HASH,
          model: "grok-4-20260826",
        })
      )
    ).toBe(true);
  });

  it("acquires ParserRetryLive and preserves both F1 PDF outcomes", () =>
    Effect.runPromise(
      provideScopedLayer(runtime)(
        Effect.gen(function* () {
          const catalog = yield* F1Catalog;
          const source = yield* DocumentSource;
          const retryParser = yield* provideScopedLayer(ParserRetryLive)(Parser);
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
            expect(Str.isNonEmpty(Str.trim(twoColumnOutcome.text))).toBe(true);
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
      )
    ));

  it("matches all nine declared parse outcomes and verifies every parsed anchor", () =>
    Effect.runPromise(
      provideScopedLayer(runtime)(
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
              expect(Str.isNonEmpty(quote)).toBe(true);
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
      )
    ));
});
