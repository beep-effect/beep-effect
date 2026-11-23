import { DocumentKinds, OaDocument, OaKinds } from "@beep/annotation/Kinds";
import { closure, RestrictionNotClosed, restrict, restrictToOa } from "@beep/annotation/Restrict";
import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertEquals } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { codec, fixtureParts, fixtureRows } from "./support/fixtures.ts";
import { documentCase, kindSet, occurrenceOf } from "./support/generators.ts";

const runs = { arbitrary: fcRuns(60) };

const close = closure(DocumentKinds);

const restrictTo = restrict(DocumentKinds);

const isOaDocument = S.is(OaDocument);

const oaNames: ReadonlyArray<string> = R.keys(OaKinds);

const tagsOf = (document: { readonly annotations: HashMap.HashMap<unknown, { readonly _tag: string }> }) =>
  document.annotations.pipe(
    HashMap.values,
    A.fromIterable,
    A.map((annotation) => annotation._tag),
    A.sort(Order.String)
  );

it.layer(Digest.layerWebCrypto, { timeout: "20 seconds" })("@beep/annotation restriction", (it) => {
  it.effect(
    "closes a kind set under body references",
    Effect.fnUntraced(function* () {
      assertEquals(close(kindSet()), kindSet());
      assertEquals(close(kindSet("Section", "Word")), kindSet("Section", "Word"));
      assertEquals(close(kindSet("RelationCandidate")), kindSet("RelationCandidate", "Mention"));
      assertEquals(
        close(kindSet("CorefCandidate", "RelationCandidate", "Chunk")),
        kindSet("CorefCandidate", "RelationCandidate", "Chunk", "Mention")
      );
    })
  );

  it.effect(
    "keeps the kept kinds' annotations, the anchors their targets use and their attribution",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      const sentences = yield* Effect.fromResult(restrictTo(kindSet("Sentence"))(document));
      assertEquals(tagsOf(sentences), ["Sentence", "Sentence"]);
      assertEquals(
        sentences.anchors.pipe(HashMap.keys, HashSet.fromIterable),
        HashSet.make(occurrenceOf(fixtureRows.first), occurrenceOf(fixtureRows.second))
      );
      assertEquals(
        sentences.attribution.pipe(HashMap.keys, HashSet.fromIterable),
        sentences.annotations.pipe(HashMap.keys, HashSet.fromIterable)
      );
      assertEquals(sentences.text, document.text);
      const relations = yield* Effect.fromResult(restrictTo(kindSet("RelationCandidate", "Mention"))(document));
      assertEquals(tagsOf(relations), ["Mention", "Mention", "RelationCandidate"]);
    })
  );

  it.effect(
    "refuses an open kind set with what it must add",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      assertEquals(
        restrictTo(kindSet("CorefCandidate", "Word"))(document),
        Result.fail(RestrictionNotClosed.make({ missing: HashSet.make("Mention") }))
      );
    })
  );

  it.effect(
    "narrows the fixture to the OA kinds",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      const oa = restrictToOa(document);
      expect(isOaDocument(oa)).toBe(true);
      assertEquals(tagsOf(oa), ["Mention", "Mention", "Paragraph", "Sentence", "Sentence", "Title", "Word"]);
    })
  );

  it.prop(
    "narrows generated documents to an OA document holding the OA kinds only",
    [documentCase],
    ([{ document }]) => {
      const oa = restrictToOa(document);
      expect(isOaDocument(oa)).toBe(true);
      assertEquals(
        tagsOf(oa),
        A.filter(tagsOf(document), (tag) => A.contains(oaNames, tag))
      );
    },
    runs
  );
});
