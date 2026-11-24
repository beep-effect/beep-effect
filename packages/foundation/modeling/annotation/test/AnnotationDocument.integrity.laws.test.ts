import {
  DocumentAssemblyRefused,
  DocumentKeyMismatch,
  DocumentKeyRepeated,
  referencesResolve,
} from "@beep/annotation/AnnotationDocument";
import { AnnotationId } from "@beep/annotation/AnnotationId";
import { DocumentKinds, StructureKinds, TextDocument } from "@beep/annotation/Kinds";
import { merge } from "@beep/annotation/Merge";
import { closure, RestrictionNotClosed, restrict } from "@beep/annotation/Restrict";
import { fcRuns } from "@beep/fc-runs";
import { ContentHash } from "@beep/schema/ContentHash";
import { it } from "@beep/test-runner";
import { anchoredOn } from "@beep/text/Arbitrary";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { expect } from "@effect/vitest";
import { assertEquals } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { codec, fixtureMentions, fixtureParts, fixtureRows, fixtureText } from "./support/fixtures.ts";
import { documentCase, kindSet, kindSetCase, mergeTripleCase, runOf } from "./support/generators.ts";

const runs = { arbitrary: fcRuns(100) };

const decodeBare = S.decodeUnknownEffect(S.toCodecJson(TextDocument));

const isTextDocument = S.is(TextDocument);

const resolves = referencesResolve(DocumentKinds);

const restrictTo = restrict(DocumentKinds);

const closed = closure(DocumentKinds);

const JsonText = S.fromJsonString(S.Unknown);

const json = (value: unknown): unknown => value;

const fake = ContentHash.make(`sha256:${Str.repeat(64)("f")}`);

const replaceEverywhere = (value: unknown, from: string, to: string): unknown =>
  S.encodeResult(JsonText)(value).pipe(
    Result.map(Str.replaceAll(from, to)),
    Result.flatMap(S.decodeResult(JsonText)),
    Result.getOrThrow
  );

const structureNames: ReadonlyArray<string> = R.keys(StructureKinds);

const expectIntegrity = Effect.fnUntraced(function* (document: TextDocument) {
  for (const annotation of HashMap.values(document.annotations)) {
    for (const target of annotation.targets) {
      expect(HashMap.has(document.anchors, target)).toBe(true);
    }
  }
  expect(resolves(document)).toBe(true);
  expect(isTextDocument(document)).toBe(true);
  const reread = yield* codec.encode(document).pipe(Effect.flatMap(codec.decode));
  assertEquals(reread, document);
});

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("@beep/annotation referential integrity", (it) => {
  it.effect.prop(
    "L2-4 targets and body references resolve after merge and restriction",
    [mergeTripleCase, kindSetCase],
    ([{ triple }, keep]) =>
      Effect.gen(function* () {
        const [a, b] = triple;
        const documents = Result.match(merge(a, b), {
          onFailure: () => triple,
          onSuccess: (merged) => A.append(triple, merged),
        });
        const closedKeep = closed(keep);
        for (const document of documents) {
          yield* expectIntegrity(document);
          const restricted = restrictTo(closedKeep)(document).pipe(Result.getOrThrow);
          yield* expectIntegrity(restricted);
          const missing = HashSet.difference(closedKeep, keep);
          assertEquals(
            restrictTo(keep)(document),
            HashSet.isEmpty(missing) ? Result.succeed(restricted) : Result.fail(RestrictionNotClosed.make({ missing }))
          );
        }
      }),
    runs
  );

  it.effect(
    "L2-4 restricting to relation candidates refuses with the missing Mention",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      assertEquals(
        restrictTo(kindSet("RelationCandidate"))(document),
        Result.fail(RestrictionNotClosed.make({ missing: HashSet.make("Mention") }))
      );
    })
  );

  it.effect.prop(
    "L2-4 a consistently forged annotation key passes the bare schema and fails the checked decode",
    [documentCase],
    ([{ document }]) =>
      Effect.gen(function* () {
        const encoded = yield* codec.encode(document);
        const leastUnreferencedStructureKey = document.annotations.pipe(
          HashMap.filter((annotation) => A.contains(structureNames, annotation._tag)),
          HashMap.keys,
          A.fromIterable,
          A.sort(Order.String),
          A.head,
          O.getOrThrow
        );
        const generations = document.attribution.pipe(
          HashMap.get(leastUnreferencedStructureKey),
          O.getOrThrow,
          A.fromIterable
        );
        const forged = replaceEverywhere(
          A.reduce(generations, json(encoded), (json, { run, activity }) =>
            replaceEverywhere(json, run, runOf({ content: AnnotationId.make(fake), activity }))
          ),
          leastUnreferencedStructureKey,
          fake
        );
        yield* decodeBare(forged);
        const refused = yield* Effect.flip(codec.decode(forged));
        expect(refused).toEqual(DocumentKeyMismatch.make({ table: "annotations", key: fake }));
        const head = O.getOrThrow(A.head(encoded.annotations));
        const repeated = { ...encoded, annotations: A.append(encoded.annotations, head) };
        const refusedRepeat = yield* Effect.flip(codec.decode(repeated));
        expect(refusedRepeat, "a repeated annotation key, which the bare schema would collapse, is refused").toEqual(
          DocumentKeyRepeated.make({ table: "annotations", key: head[0] })
        );
      }),
    runs
  );

  it.effect(
    "L2-4 assemble refuses an anchor off the capture, a target without an anchor and an unresolved reference",
    Effect.fnUntraced(function* () {
      const otherCapture = SourceTextIdentity.make({ ...fixtureParts.text, scopeRef: "matter:other" });
      const cases = [
        [
          { anchors: A.append(fixtureParts.anchors, anchoredOn(otherCapture, fixtureText, { start: 0, end: 3 })) },
          "anchor-off-capture",
        ],
        [{ anchors: A.filter(fixtureParts.anchors, (row) => row !== fixtureRows.examiner) }, "target-without-anchor"],
        [
          { annotations: A.filter(fixtureParts.annotations, (annotation) => annotation !== fixtureMentions.claim) },
          "reference-unresolved",
        ],
      ] as const;
      for (const [change, reason] of cases) {
        const refused = yield* Effect.flip(codec.assemble({ ...fixtureParts, ...change }));
        expect(refused).toEqual(DocumentAssemblyRefused.make({ reason }));
      }
    })
  );
});
