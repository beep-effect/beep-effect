import { DocumentAssemblyRefused } from "@beep/annotation/AnnotationDocument";
import { it } from "@beep/test-runner";
import { anchoredOn } from "@beep/text/Arbitrary";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import {
  codec,
  fixtureAnnotations,
  fixtureGeneration,
  fixtureMentions,
  fixtureParts,
  fixtureRows,
  fixtureText,
} from "./support/fixtures.ts";
import { annotationIdOf, generationOf, occurrenceOf } from "./support/generators.ts";

const otherCapture = SourceTextIdentity.make({ ...fixtureParts.text, scopeRef: "matter:other" });

it.layer(Digest.layerWebCrypto, { timeout: "10 seconds" })("@beep/annotation assemble", (it) => {
  it.effect(
    "mints every key and gives every annotation one generation of the activity",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      expect(document.anchors.pipe(HashMap.keys, HashSet.fromIterable)).toEqual(
        HashSet.fromIterable(A.map(R.values(fixtureRows), occurrenceOf))
      );
      expect(document.annotations.pipe(HashMap.keys, HashSet.fromIterable)).toEqual(
        HashSet.fromIterable(A.map(fixtureAnnotations, annotationIdOf))
      );
      for (const [content, generations] of HashMap.toEntries(document.attribution)) {
        expect(A.fromIterable(generations)).toEqual([generationOf({ ...fixtureGeneration, content })]);
      }
      const reread = yield* codec.encode(document).pipe(Effect.flatMap(codec.decode));
      expect(reread).toEqual(document);
    })
  );

  it.effect(
    "collapses repeated parts into one row each",
    Effect.fnUntraced(function* () {
      const once = yield* codec.assemble(fixtureParts);
      const twice = yield* codec.assemble({
        ...fixtureParts,
        anchors: A.appendAll(fixtureParts.anchors, fixtureParts.anchors),
        annotations: A.appendAll(fixtureParts.annotations, fixtureParts.annotations),
      });
      expect(twice).toEqual(once);
    })
  );

  it.effect(
    "writes no time when the generation states none",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble({
        ...fixtureParts,
        generation: { activity: fixtureGeneration.activity, at: O.none() },
      });
      const encoded = yield* codec.encode(document);
      for (const [, generations] of encoded.attribution) {
        expect(A.every(generations, (generation) => !("at" in generation))).toBe(true);
      }
    })
  );

  it.effect(
    "refuses an anchor on another capture, a target without an anchor and an unresolved body reference",
    Effect.fnUntraced(function* () {
      const offCapture = {
        ...fixtureParts,
        anchors: A.append(fixtureParts.anchors, anchoredOn(otherCapture, fixtureText, { start: 0, end: 3 })),
      };
      const withoutClaimRow = {
        ...fixtureParts,
        anchors: A.filter(fixtureParts.anchors, (row) => row !== fixtureRows.claim),
      };
      // The relation and the cluster stay, but the examiner Mention they reference is left out.
      const withoutExaminer = {
        ...fixtureParts,
        annotations: A.filter(fixtureParts.annotations, (annotation) => annotation !== fixtureMentions.examiner),
      };
      const cases = [
        [offCapture, "anchor-off-capture"],
        [withoutClaimRow, "target-without-anchor"],
        [withoutExaminer, "reference-unresolved"],
      ] as const;
      for (const [parts, reason] of cases) {
        const refused = yield* Effect.flip(codec.assemble(parts));
        expect(refused).toEqual(DocumentAssemblyRefused.make({ reason }));
      }
    })
  );
});
