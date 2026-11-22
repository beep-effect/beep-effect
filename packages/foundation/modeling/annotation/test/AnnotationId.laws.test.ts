import { AnnotationId, AnnotationPreimage } from "@beep/annotation/AnnotationId";
import { mintAnnotationId } from "@beep/annotation/Kind";
import { DocumentKinds, Mention, Section } from "@beep/annotation/Kinds";
import { fcRuns } from "@beep/fc-runs";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { it } from "@beep/test-runner";
import { OccurrenceId } from "@beep/text/Occurrence";
import { expect } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { annotationIdOf, occurrenceIdOf, sha256, targetArrayCase } from "./support/generators.ts";

const runs = { arbitrary: fcRuns(100) };

const mint = mintAnnotationId(DocumentKinds);

const distinction = TermIri.make(iri("office-action:distinction"));
const claim = TermIri.make(iri("office-action:claim"));

const decodeMention = S.decodeUnknownEffect(DocumentKinds.Mention.case);

const encodeMention = S.encodeEffect(DocumentKinds.Mention.case);

// Six occurrence ids whose HashSet iteration order is not their ascending order, and the annotation/v1 id of a claim
// Mention over them: the SHA-256 of the RFC 8785 JSON of
// ["annotation/v1",["sha256:1…1",…,"sha256:6…6"],"https://beep-effect.com/ns/annotation/Mention",
// {"class":"https://beep-effect.com/ns/office-action/claim"}], computed outside the repo by sha256sum.
const ascendingOccurrences = A.map(["1", "2", "3", "4", "5", "6"], (digit) =>
  OccurrenceId.make(`sha256:${Str.repeat(64)(digit)}`)
);

const sixTargetMention = AnnotationId.make("sha256:40fb3e7ec0a27bb173f8b18fc6721db2d285549d559ce405702e2fd93587db7b");

const goldenOccurrence = OccurrenceId.make("sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48");

const goldenMention = DocumentKinds.Mention.case.make({
  targets: HashSet.make(goldenOccurrence),
  body: Mention.make({ class: distinction }),
});

it.layer(Digest.layerWebCrypto, { timeout: "10 seconds" })("@beep/annotation annotation ids", (it) => {
  it.effect.prop(
    "L2-2 the annotation id ignores target order and duplication",
    [targetArrayCase],
    ([{ set, array }]) =>
      Effect.gen(function* () {
        const fromSet = yield* mint(
          DocumentKinds.Mention.case.make({ targets: set, body: Mention.make({ class: claim }) })
        );
        // The array arrives in a drawn order with repeats, through the wire codec of the case.
        const decoded = yield* decodeMention({ _tag: "Mention", targets: array, body: { class: claim } });
        const fromArray = yield* mint(decoded);
        expect(fromArray).toBe(fromSet);
        expect(HashSet.size(decoded.targets)).toBe(HashSet.size(set));
        // The set codec the preimage hashes writes the targets ascending, never in iteration order.
        const encoded = yield* encodeMention(decoded);
        expect(encoded.targets).toStrictEqual(A.sort(A.fromIterable(set), Order.String));
      }),
    runs
  );

  it.effect.prop(
    "L2-2 changing one target, the kind or the body changes the id",
    [targetArrayCase],
    ([{ set }]) =>
      Effect.gen(function* () {
        const base = DocumentKinds.Mention.case.make({ targets: set, body: Mention.make({ class: claim }) });
        const id = yield* mint(base);
        const added = DocumentKinds.Mention.case.make({
          targets: HashSet.add(set, occurrenceIdOf("outside")),
          body: base.body,
        });
        const otherBody = DocumentKinds.Mention.case.make({ targets: set, body: Mention.make({ class: distinction }) });
        const otherKind = DocumentKinds.Sentence.case.make({ targets: set, body: {} });
        const ids = yield* Effect.forEach([added, otherBody, otherKind], mint, { concurrency: 1 });
        expect(HashSet.size(HashSet.fromIterable(A.append(ids, id)))).toBe(4);
      }),
    runs
  );

  it.effect.prop(
    "L2-2 the Digest mint and the sync twin agree",
    [targetArrayCase],
    ([{ set }]) =>
      Effect.gen(function* () {
        const section = DocumentKinds.Section.case.make({ targets: set, body: Section.make({ depth: 2 }) });
        const id = yield* mint(section);
        expect(annotationIdOf(section)).toBe(id);
        assertSuccess(AnnotationPreimage.mintResult(sha256)([set, DocumentKinds.Section.iri, { depth: 2 }]), id);
      }),
    runs
  );

  it.effect(
    "L2-2 the annotation/v1 golden: a distinction Mention on the occurrence golden",
    Effect.fnUntraced(function* () {
      const id = yield* mint(goldenMention);
      expect(id).toBe(AnnotationId.make(AnnotationPreimage.golden.hash));
      expect(annotationIdOf(goldenMention)).toBe(id);
    })
  );

  it.effect(
    "L2-2 a six-target vector hashes its targets ascending, not in iteration order",
    Effect.fnUntraced(function* () {
      const targets = HashSet.fromIterable(A.reverse(ascendingOccurrences));
      expect(A.fromIterable(targets)).not.toStrictEqual(ascendingOccurrences);
      const mention = DocumentKinds.Mention.case.make({ targets, body: Mention.make({ class: claim }) });
      const id = yield* mint(mention);
      expect(id).toBe(sixTargetMention);
      expect(annotationIdOf(mention)).toBe(sixTargetMention);
    })
  );

  it.effect(
    "fails with the preimage's schema error when a kind cannot encode the body",
    Effect.fnUntraced(function* () {
      const refused = yield* Effect.flip(
        mint({ _tag: "Section", targets: HashSet.make(goldenOccurrence), body: { depth: 9 } })
      );
      expect(S.isSchemaError(refused)).toBe(true);
    })
  );

  it.effect(
    "dies on a tag outside the registry",
    Effect.fnUntraced(function* () {
      const cause = yield* Effect.sandbox(
        mint({ _tag: "Unknown", targets: HashSet.make(goldenOccurrence), body: {} })
      ).pipe(Effect.flip);
      expect(Cause.hasDies(cause)).toBe(true);
    })
  );
});
