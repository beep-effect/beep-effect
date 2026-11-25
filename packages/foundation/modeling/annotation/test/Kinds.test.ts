import { makeAnnotationDocument, makeDocumentCodec, referencesResolve } from "@beep/annotation/AnnotationDocument";
import { AnnotationTargets } from "@beep/annotation/AnnotationId";
import {
  Chunk,
  CorefCandidate,
  DocumentKinds,
  ExtractionDocument,
  ExtractionKinds,
  Figure,
  OaKinds,
  Section,
  StructureKinds,
  TextDocument,
} from "@beep/annotation/Kinds";
import { fcRuns } from "@beep/fc-runs";
import { expand } from "@beep/identity/Registry";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { fixtureAnnotations, fixtureMentions, fixtureParts } from "./support/fixtures.ts";
import { annotationIdOf } from "./support/generators.ts";
import type { ClosedKindRegistry, KindRegistry } from "@beep/annotation/Kind";

const closedAtTypeLevel: ReadonlyArray<ClosedKindRegistry<KindRegistry>> = [
  ExtractionKinds satisfies ClosedKindRegistry<typeof ExtractionKinds>,
  StructureKinds satisfies ClosedKindRegistry<typeof StructureKinds>,
  DocumentKinds satisfies ClosedKindRegistry<typeof DocumentKinds>,
  OaKinds satisfies ClosedKindRegistry<typeof OaKinds>,
];

const extractionCodec = makeDocumentCodec({ schema: ExtractionDocument, kinds: ExtractionKinds });

const AnyCase = makeAnnotationDocument(DocumentKinds).Annotation;

const ExtractionCase = makeAnnotationDocument(ExtractionKinds).Annotation;

const EncodedCase = S.Struct({ _tag: S.String, body: S.Unknown });

const widen = S.decodeUnknownEffect(S.toType(TextDocument));

const BodiesJson = S.toCodecJson(S.Struct({ section: Section, chunk: Chunk, figure: Figure }));

const bodiesCase = Arbitrary.all({
  section: Arbitrary.schema(Section),
  chunk: Arbitrary.schema(Chunk),
  figure: Arbitrary.schema(Figure),
});

const encodeCase = flow(
  S.encodeResult(S.toCodecJson(AnyCase)),
  Result.flatMap(S.decodeUnknownResult(EncodedCase)),
  Result.getOrThrow
);

describe("@beep/annotation kinds", () => {
  it("keeps every registry closed: each name is its key and every reference is registered", () => {
    expect(closedAtTypeLevel).toHaveLength(4);
    const registries: ReadonlyArray<KindRegistry> = [ExtractionKinds, StructureKinds, DocumentKinds, OaKinds];
    for (const kinds of registries) {
      for (const [key, kind] of R.toEntries(kinds)) {
        expect(kind.name).toBe(key);
        expect(A.every(kind.references, (reference) => R.has(kinds, reference))).toBe(true);
      }
    }
  });

  it("reads every kind IRI from the annotation namespace of the registry", () => {
    for (const [name, kind] of R.toEntries(DocumentKinds)) {
      assertSome(expand(`annotation:${name}`), kind.iri);
    }
  });

  it("gives levels to the structure and segmentation kinds only", () => {
    expect(R.map(StructureKinds, (kind) => O.getOrThrow(kind.level))).toEqual({
      Section: 0,
      Title: 1,
      Figure: 1,
      Paragraph: 1,
      Sentence: 2,
      Word: 3,
    });
    assertTrue(A.every(R.values(ExtractionKinds), (kind) => O.isNone(kind.level)));
  });

  it("holds the five OA kinds as the document kinds themselves", () => {
    expect(R.keys(OaKinds)).toEqual(["Mention", "Title", "Paragraph", "Sentence", "Word"]);
    for (const [name, kind] of R.toEntries(OaKinds)) {
      expect(kind).toBe(DocumentKinds[name]);
    }
    expect(R.keys(DocumentKinds)).toHaveLength(10);
  });

  it("encodes each body to its JSON form", () => {
    const encoded = A.map(fixtureAnnotations, (annotation) => {
      const { _tag, body } = encodeCase(annotation);
      return [_tag, body] as const;
    });
    const examiner = annotationIdOf(fixtureMentions.examiner);
    const claim = annotationIdOf(fixtureMentions.claim);
    expect(encoded).toEqual([
      ["Section", { depth: 1 }],
      ["Paragraph", {}],
      ["Title", {}],
      ["Sentence", {}],
      ["Sentence", {}],
      ["Word", {}],
      ["Figure", { label: "Figure 2" }],
      ["Chunk", { ordinal: 0 }],
      ["Mention", { class: "https://beep-effect.com/ns/semantica/person" }],
      ["Mention", { class: "https://beep-effect.com/ns/office-action/claim" }],
      [
        "RelationCandidate",
        { subject: examiner, predicate: "https://beep-effect.com/ns/semantica/selected", object: claim },
      ],
      ["CorefCandidate", { members: A.sort([examiner, claim], Order.String) }],
    ]);
    assertSuccess(S.encodeResult(Figure)(Figure.make({ label: O.none() })), {});
  });

  it.prop(
    "round-trips generated bodies through their kinds' JSON codecs",
    [bodiesCase],
    ([bodies]) => {
      const reread = S.encodeResult(BodiesJson)(bodies).pipe(Result.flatMap(S.decodeUnknownResult(BodiesJson)));
      expect(
        Result.getOrThrow(reread),
        "Arbitrary.schema draws null-prototype objects, so compare structurally"
      ).toEqual(bodies);
    },
    { arbitrary: fcRuns(100) }
  );

  it("refuses an empty target set, a one-member cluster and a heading depth outside 1 to 6", () => {
    assertNone(S.decodeOption(AnnotationTargets)([]));
    const member = annotationIdOf(fixtureMentions.claim);
    assertNone(S.decodeOption(CorefCandidate)({ members: [member, member] }));
    expect(A.map([0, 1, 6, 7], (depth) => S.is(Section)({ depth }))).toEqual([false, true, true, false]);
  });

  it("does not resolve the references of an annotation whose kind is not registered", () => {
    const [first] = fixtureAnnotations;
    const view = {
      text: fixtureParts.text,
      anchors: HashMap.empty(),
      annotations: HashMap.make([annotationIdOf(first), { _tag: "Unknown", targets: first.targets, body: {} }]),
      attribution: HashMap.empty(),
    };
    expect(referencesResolve(DocumentKinds)(view)).toBe(false);
    expect(referencesResolve(DocumentKinds)({ ...view, annotations: HashMap.empty() })).toBe(true);
  });
});

it.layer(Digest.layerWebCrypto)("@beep/annotation documents over the kinds", (it) => {
  it.effect(
    "widens an extraction document to a text document by decoding its type side",
    Effect.fnUntraced(function* () {
      const extraction = A.filter(fixtureAnnotations, S.is(ExtractionCase));
      const document = yield* extractionCodec.assemble({ ...fixtureParts, annotations: extraction });
      const widened = yield* widen(document);
      expect(HashMap.size(widened.annotations)).toBe(5);
      expect(widened.annotations.pipe(HashMap.keys, HashSet.fromIterable)).toEqual(
        document.annotations.pipe(HashMap.keys, HashSet.fromIterable)
      );
    })
  );
});
