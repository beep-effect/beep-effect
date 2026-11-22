// The `@beep/annotation` law generators. Text, scalar ranges, captures and anchors rows come from
// `@beep/text/Arbitrary` (decision p3-text-arbitraries-in-src); this file builds annotations and documents over them.
// Every dependent value (occurrence, annotation and run ids) is minted through the preimages' synchronous twins
// while the value is built, so a generated document passes the schema checks and the checked decode by
// construction; nothing is filtered. A relation's one target is its own evidence occurrence, drawn independently
// of its endpoints' occurrences, and a coreference cluster targets the union of its members' targets (decision
// p3-target-annotation-vocabulary). Time is drawn once per activity, so each (content, activity) pair has one time.
import { AnnotationId, AnnotationPreimage, GenerationPreimage, RunEntityId } from "@beep/annotation/AnnotationId";
import { Generation } from "@beep/annotation/Generation";
import {
  Chunk,
  CorefCandidate,
  DocumentKinds,
  Figure,
  Mention,
  Paragraph,
  RelationCandidate,
  Section,
  Sentence,
  TextDocument,
  Title,
  Word,
} from "@beep/annotation/Kinds";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { ActivityId } from "@beep/schema/ContentHash";
import { anchoredOn, rangeIn, scalarRangeIn, sourceFor, wellFormedTextWith } from "@beep/text/Arbitrary";
import { OccurrenceId, OccurrencePreimage } from "@beep/text/Occurrence";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Hex from "effect/encoding/Hex";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { Annotation } from "@beep/annotation/Kind";
import type { JsoncDigest } from "@beep/jsonc/JsoncFingerprint";
import type { Anchored } from "@beep/text/Occurrence";

// A synchronous SHA-256 from the platform, the digest the preimages' Result twins take.
const { createHash } = process.getBuiltinModule("node:crypto");

/** The platform SHA-256 the synchronous minting twins take. */
export const sha256: JsoncDigest = (bytes) => new Uint8Array(createHash("sha256").update(bytes).digest());

/** An annotation of any declared kind. */
export type AnyAnnotation = Annotation<typeof DocumentKinds>;

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

const at = <Value>(values: A.NonEmptyReadonlyArray<Value>, pick: number): Value =>
  A.getUnsafe(values, pick % values.length);

// A non-empty array arbitrary whose type says so: a head and a tail.
const nonEmptyArray = <Value>(item: Arbitrary.Arbitrary<Value>, maxLength: number) =>
  Arbitrary.map(
    Arbitrary.all([item, Arbitrary.array(item, { maxLength: maxLength - 1 })]),
    ([head, tail]): A.NonEmptyReadonlyArray<Value> => A.prepend(tail, head)
  );

const utf8 = new TextEncoder();

const hashOf = (seed: string): `sha256:${string}` => `sha256:${Hex.encode(sha256(utf8.encode(seed)))}`;

/** A distinct occurrence id per seed, for laws that need ids but no anchors rows. */
export const occurrenceIdOf = (seed: string): OccurrenceId => OccurrenceId.make(hashOf(`occurrence:${seed}`));

/** A distinct activity id per seed. */
export const activityIdOf = (seed: string): ActivityId => ActivityId.make(hashOf(`activity:${seed}`));

/** The occurrence id of an anchors row, through the `occurrence/v1` twin. */
export const occurrenceOf = (row: Anchored): OccurrenceId =>
  OccurrenceId.make(Result.getOrThrow(OccurrencePreimage.mintResult(sha256)(row)));

const bodyEncoders = R.map(DocumentKinds, (kind) => ({
  iri: kind.iri,
  encode: S.encodeUnknownResult(S.toCodecJson(kind.body)),
}));

/** The content id of an annotation, through the `annotation/v1` twin. */
export const annotationIdOf = (annotation: AnyAnnotation): AnnotationId => {
  const kind = bodyEncoders[annotation._tag];
  const body = Result.getOrThrow(kind.encode(annotation.body));
  return AnnotationId.make(
    Result.getOrThrow(AnnotationPreimage.mintResult(sha256)([annotation.targets, kind.iri, body]))
  );
};

/** One (content, activity) pair and the time its generation states. */
export type GenerationPair = {
  readonly content: AnnotationId;
  readonly activity: ActivityId;
  readonly at: O.Option<DateTime.Utc>;
};

/** The run-entity id of a (content, activity) pair, through the `generation/v1` twin. */
export const runOf = ({ content, activity }: Omit<GenerationPair, "at">): RunEntityId =>
  RunEntityId.make(Result.getOrThrow(GenerationPreimage.mintResult(sha256)([content, activity])));

/** The generation of one (content, activity) pair at a stated time. */
export const generationOf = (pair: GenerationPair): Generation => Generation.make({ ...pair, run: runOf(pair) });

const mentionClasses: A.NonEmptyReadonlyArray<TermIri> = [
  TermIri.make(iri("office-action:claim")),
  TermIri.make(iri("office-action:distinction")),
  TermIri.make(iri("semantica:person")),
  TermIri.make(iri("semantica:organization")),
];

const predicates: A.NonEmptyReadonlyArray<TermIri> = [
  TermIri.make(iri("semantica:affiliatedWith")),
  TermIri.make(iri("semantica:authoredBy")),
];

// Instants from 1970 to 2100, so a stated time always encodes as finite epoch milliseconds.
const instant = Arbitrary.map(between(0, 4_102_444_800_000), (millis) => DateTime.makeUnsafe(millis));

const statedTime = Arbitrary.map(
  Arbitrary.all({ stated: Arbitrary.schema(S.Boolean), instant }),
  ({ stated, instant }) => (stated ? O.some(instant) : O.none<DateTime.Utc>())
);

const label = Arbitrary.map(wellFormedTextWith({ minLength: 1, maxLength: 8 }), ({ text }) => text);

const pick = between(0, 1_000);

/** One generated document over every declared kind, with the text its anchors slice. */
export type GeneratedDocument = {
  readonly text: string;
  readonly document: TextDocument;
};

type StructureBodies = {
  readonly depth: number;
  readonly label: O.Option<string>;
};

const K = DocumentKinds;

// One builder per structure and segmentation kind, picked by index.
const structureBuilders: A.NonEmptyReadonlyArray<
  (targets: HashSet.HashSet<OccurrenceId>, bodies: StructureBodies) => AnyAnnotation
> = [
  (targets, { depth }) => K.Section.case.make({ targets, body: Section.make({ depth }) }),
  (targets, { label }) => K.Figure.case.make({ targets, body: Figure.make({ label }) }),
  (targets) => K.Title.case.make({ targets, body: Title.make({}) }),
  (targets) => K.Paragraph.case.make({ targets, body: Paragraph.make({}) }),
  (targets) => K.Sentence.case.make({ targets, body: Sentence.make({}) }),
  (targets) => K.Word.case.make({ targets, body: Word.make({}) }),
];

// Which of the two activities generate an annotation: the first, the second or both.
const activitySets: A.NonEmptyReadonlyArray<ReadonlyArray<0 | 1>> = [[0], [1], [0, 1]];

/**
 * Generated text documents: one capture, one to five anchors rows, at least one structure annotation and any
 * extraction annotations over
 * them, relations and coreference clusters over the generated Mentions, and every annotation generated by one or
 * both of two activities.
 */
export const documentCase: Arbitrary.Arbitrary<GeneratedDocument> = Arbitrary.flatMap(
  wellFormedTextWith({ minLength: 1, maxLength: 40 }),
  (generated) =>
    Arbitrary.map(
      Arbitrary.all({
        source: sourceFor(sha256)(generated.text),
        ranges: nonEmptyArray(scalarRangeIn(generated.codePoints.length), 5),
        structure: nonEmptyArray(Arbitrary.all([pick, pick]), 6),
        depth: between(1, 6),
        label: Arbitrary.map(Arbitrary.all({ labelled: Arbitrary.schema(S.Boolean), label }), ({ labelled, label }) =>
          labelled ? O.some(label) : O.none<string>()
        ),
        mentions: Arbitrary.array(Arbitrary.all([pick, nonEmptyArray(pick, 2)]), { maxLength: 5 }),
        chunks: Arbitrary.array(Arbitrary.all([pick, between(0, 20)]), { maxLength: 2 }),
        relations: Arbitrary.array(Arbitrary.all([pick, pick, pick, pick]), { maxLength: 3 }),
        corefs: Arbitrary.array(nonEmptyArray(pick, 3), { maxLength: 2 }),
        activities: Arbitrary.all([label, label]),
        times: Arbitrary.all([statedTime, statedTime]),
        membership: nonEmptyArray(pick, 8),
      }),
      (drawn) => {
        const boundaries = generated.boundaries["utf16-code-unit"];
        const rows = A.map(drawn.ranges, (range) =>
          anchoredOn(drawn.source, generated.text, rangeIn(boundaries)(range))
        );
        const occurrences = A.map(rows, occurrenceOf);
        const occurrence = (target: number) => HashSet.make(at(occurrences, target));
        const structure = A.map(drawn.structure, ([kind, target]) =>
          at(structureBuilders, kind)(occurrence(target), drawn)
        );
        const chunks = A.map(drawn.chunks, ([target, ordinal]) =>
          K.Chunk.case.make({ targets: occurrence(target), body: Chunk.make({ ordinal }) })
        );
        const mentions = A.map(drawn.mentions, ([klass, targets]) => {
          const mention = K.Mention.case.make({
            targets: HashSet.fromIterable(A.map(targets, (target) => at(occurrences, target))),
            body: Mention.make({ class: at(mentionClasses, klass) }),
          });
          return { id: annotationIdOf(mention), mention };
        });
        const candidates = A.match(mentions, {
          onEmpty: () => A.empty<AnyAnnotation>(),
          onNonEmpty: (endpoints) => {
            const relations = A.map(drawn.relations, ([subject, object, predicate, evidence]) =>
              K.RelationCandidate.case.make({
                targets: occurrence(evidence),
                body: RelationCandidate.make({
                  subject: at(endpoints, subject).id,
                  predicate: at(predicates, predicate),
                  object: at(endpoints, object).id,
                }),
              })
            );
            const corefs = A.flatMap(drawn.corefs, (members) => {
              const chosen = A.dedupe(A.map(members, (member) => at(endpoints, member)));
              return A.match(A.drop(chosen, 1), {
                onEmpty: () => A.empty<AnyAnnotation>(),
                onNonEmpty: () => [
                  K.CorefCandidate.case.make({
                    targets: HashSet.fromIterable(A.flatMap(chosen, ({ mention }) => A.fromIterable(mention.targets))),
                    body: CorefCandidate.make({ members: HashSet.fromIterable(A.map(chosen, ({ id }) => id)) }),
                  }),
                ],
              });
            });
            return A.appendAll(relations, corefs);
          },
        });
        const annotations = HashMap.fromIterable(
          A.map(
            [...structure, ...chunks, ...A.map(mentions, ({ mention }) => mention), ...candidates],
            (annotation) => [annotationIdOf(annotation), annotation] as const
          )
        );
        const attribution = HashMap.fromIterable(
          A.map(annotations.pipe(HashMap.keys, A.fromIterable), (content, index) => {
            const activities = at(activitySets, at(drawn.membership, index));
            const generations = A.map(activities, (activity) =>
              generationOf({ content, activity: activityIdOf(drawn.activities[activity]), at: drawn.times[activity] })
            );
            return [content, HashSet.fromIterable(generations)] as const;
          })
        );
        return {
          text: generated.text,
          document: TextDocument.make({
            text: drawn.source,
            anchors: HashMap.fromIterable(A.zip(occurrences, rows)),
            annotations,
            attribution,
          }),
        };
      }
    )
);

const byKeyThenIndex = Order.combine(
  Order.mapInput(Order.Number, ([key]: readonly [number, number]) => key),
  Order.mapInput(Order.Number, ([, index]: readonly [number, number]) => index)
);

/**
 * Generated target arrays: one to six distinct occurrence ids, and an array holding every one of them at least once
 * in a drawn order, followed by drawn repeats.
 */
export const targetArrayCase = Arbitrary.flatMap(between(1, 6), (count) =>
  Arbitrary.map(
    Arbitrary.all({
      seed: label,
      order: Arbitrary.array(pick, { minLength: count, maxLength: count }),
      repeats: Arbitrary.array(between(0, count - 1), { maxLength: 6 }),
    }),
    ({ seed, order, repeats }) => {
      const ids = A.makeBy(count, (index) => occurrenceIdOf(`${seed}:${index}`));
      const permuted = A.map(
        A.sort(
          A.map(order, (key, index) => [key, index] as const),
          byKeyThenIndex
        ),
        ([, index]) => A.getUnsafe(ids, index)
      );
      return {
        set: HashSet.fromIterable(ids),
        array: A.appendAll(
          permuted,
          A.map(repeats, (index) => A.getUnsafe(ids, index))
        ),
      };
    }
  )
);
