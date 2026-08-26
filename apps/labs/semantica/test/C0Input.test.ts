// @vitest-environment node

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
          model: "grok-4",
        })
      )
    ).toBe(true);
  });

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
