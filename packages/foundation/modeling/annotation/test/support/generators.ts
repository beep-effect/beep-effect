import { AnnotationId, AnnotationPreimage, GenerationPreimage, RunEntityId } from "@beep/annotation/AnnotationId";
import { Generation } from "@beep/annotation/Generation";
import {
  Chunk,
  CorefCandidate,
  DocumentKinds,
  Figure,
  Mention,
  OaDocument,
  Paragraph,
  RelationCandidate,
  Section,
  Sentence,
  TextDocument,
  Title,
  Word,
} from "@beep/annotation/Kinds";
import { restrictToOa } from "@beep/annotation/Restrict";
import { ImportActivityPreimage, ImportedActivity, ImportedActivityPreimage } from "@beep/annotation/rdf/OaCodec";
import { IRI } from "@beep/identity/Iri";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { DatasetDigest } from "@beep/rdf/Canonical";
import { instanceIri } from "@beep/rdf/InstanceIri";
import * as Rdf from "@beep/rdf/Rdf";
import { ActivityId, ContentHash } from "@beep/schema/ContentHash";
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
import * as Str from "effect/String";
import type { Annotation, KindName, KindRegistry } from "@beep/annotation/Kind";
import type { JsoncDigest } from "@beep/jsonc/JsoncFingerprint";
import type { Anchored } from "@beep/text/Occurrence";
import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity";

const { createHash } = process.getBuiltinModule("node:crypto");

/** The platform SHA-256 the synchronous minting twins take. */
export const sha256: JsoncDigest = (bytes) => new Uint8Array(createHash("sha256").update(bytes).digest());

/** An annotation of any declared kind. */
export type AnyAnnotation = Annotation<typeof DocumentKinds>;

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

const at = <Value>(values: A.NonEmptyReadonlyArray<Value>, pick: number): Value =>
  A.getUnsafe(values, pick % values.length);

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

const dateTimeMinimum = -8_640_000_000_000_000;
const firstInstantOfYearMinusOne = -62_198_755_200_000;
const lastInstantOfYearMinusOne = -62_167_219_200_001;
const firstInstantOfYearZero = -62_167_219_200_000;
const epoch = 0;
const lastInstantOfYear9999 = 253_402_300_799_999;
const firstInstantOfYear10000 = 253_402_300_800_000;
const dateTimeMaximum = 8_640_000_000_000_000;

const xsdDateTimeEdgeInstants: A.NonEmptyReadonlyArray<number> = [
  dateTimeMinimum,
  firstInstantOfYearMinusOne,
  lastInstantOfYearMinusOne,
  firstInstantOfYearZero,
  epoch,
  lastInstantOfYear9999,
  firstInstantOfYear10000,
  dateTimeMaximum,
];

const instantHalfAtEdges = Arbitrary.map(
  Arbitrary.all({
    edge: between(0, 2 * xsdDateTimeEdgeInstants.length - 1),
    millis: between(dateTimeMinimum, dateTimeMaximum),
  }),
  ({ edge, millis }) =>
    DateTime.makeUnsafe(edge < xsdDateTimeEdgeInstants.length ? A.getUnsafe(xsdDateTimeEdgeInstants, edge) : millis)
);

const statedTime = Arbitrary.map(
  Arbitrary.all({ stated: Arbitrary.schema(S.Boolean), instant: instantHalfAtEdges }),
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

// decision: law-generators-mint-by-construction
const activitySets: A.NonEmptyReadonlyArray<ReadonlyArray<0 | 1>> = [[0], [1], [0, 1]];

/**
 * Generated text documents: one capture, one to five anchors rows, at least one structure annotation and any
 * extraction annotations over
 * them, relations and coreference clusters over the generated Mentions, and every annotation generated by one or
 * both of two activities. Each activity's seed carries its index, so two equal drawn labels still name two
 * activities.
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
              generationOf({
                content,
                activity: activityIdOf(`${activity}:${drawn.activities[activity]}`),
                at: drawn.times[activity],
              })
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

const registry: KindRegistry = DocumentKinds;

const referencesOf = (annotation: AnyAnnotation): ReadonlyArray<AnnotationId> =>
  R.get(registry, annotation._tag).pipe(
    O.map((kind) => A.fromIterable(kind.referencedIds(annotation.body))),
    O.getOrElse(A.empty<AnnotationId>)
  );

const byActivity = Order.mapInput(Order.String, (generation: Generation) => generation.activity);

const byKey = Order.mapInput(Order.String, ([key]: readonly [AnnotationId, AnyAnnotation]) => key);

const partDraw = Arbitrary.all({
  membership: nonEmptyArray(Arbitrary.schema(S.Boolean), 8),
  generations: nonEmptyArray(between(0, activitySets.length - 1), 8),
  retime: between(0, 7),
  at: statedTime,
});

type PartDraw = typeof partDraw extends Arbitrary.Arbitrary<infer Draw> ? Draw : never;

const partOf = (pool: TextDocument, draw: PartDraw): TextDocument => {
  const entries = A.sort(HashMap.toEntries(pool.annotations), byKey);
  const chosen = A.filter(entries, (_, index) => at(draw.membership, index));
  const kept = HashSet.fromIterable(A.flatMap(chosen, ([id, annotation]) => A.prepend(referencesOf(annotation), id)));
  const annotations = HashMap.filter(pool.annotations, (_, id) => HashSet.has(kept, id));
  const used = HashSet.fromIterable(
    A.flatMap(annotations.pipe(HashMap.values, A.fromIterable), (annotation) => A.fromIterable(annotation.targets))
  );
  const activities = A.map(
    A.flatMap(pool.attribution.pipe(HashMap.values, A.fromIterable), A.fromIterable),
    ({ activity }) => activity
  );
  const restated = O.filter(A.head(A.sort(activities, Order.String)), () => draw.retime === 0);
  const attribution = HashMap.map(
    HashMap.filter(pool.attribution, (_, id) => HashSet.has(kept, id)),
    (generations, content) => {
      const sorted = A.sort(A.fromIterable(generations), byActivity);
      const index = A.findFirstIndex(entries, ([key]) => key === content).pipe(O.getOrElse(() => 0));
      const part = A.map(at(activitySets, at(draw.generations, index)), (pick) =>
        A.getUnsafe(sorted, pick % sorted.length)
      );
      return HashSet.fromIterable(
        A.map(part, (generation) =>
          O.contains(restated, generation.activity)
            ? generationOf({ content, activity: generation.activity, at: draw.at })
            : generation
        )
      );
    }
  );
  return TextDocument.make({
    text: pool.text,
    anchors: HashMap.filter(pool.anchors, (_, id) => HashSet.has(used, id)),
    annotations,
    attribution,
  });
};

/** Three documents for the merge laws, and the text their anchors slice. */
export type MergeTriple = {
  readonly text: string;
  readonly triple: readonly [TextDocument, TextDocument, TextDocument];
};

// decision: law-generators-mint-by-construction
const isForeign = (draw: number): boolean => draw >= 48 && draw < 52;

/**
 * Generated merge triples: three parts of one generated pool document, so they share one capture, contents and
 * activities, with drawn time restatements that conflict. In about four draws of a hundred the first document is
 * replaced by an independently generated document, which is on another capture.
 *
 * **Details**
 *
 * Each part keeps the drawn annotations of the pool closed over their body references, the anchors their targets
 * use, and for each a drawn non-empty part of its pool generations. One draw in eight restates the time of the
 * pool's least activity, which conflicts with any other part that keeps one of those generations at its pool time.
 */
export const mergeTripleCase: Arbitrary.Arbitrary<MergeTriple> = Arbitrary.flatMap(documentCase, ({ text, document }) =>
  Arbitrary.map(
    Arbitrary.all({
      parts: Arbitrary.all([partDraw, partDraw, partDraw]),
      foreign: between(0, 99),
      other: documentCase,
    }),
    ({ parts: [first, second, third], foreign, other }) => ({
      text,
      triple: [
        isForeign(foreign) ? other.document : partOf(document, first),
        partOf(document, second),
        partOf(document, third),
      ],
    })
  )
);

/** The annotations of one containment case, by the role each plays in the L2-5 fixtures. */
export type ContainmentRoles = {
  readonly section: AnnotationId;
  readonly title: AnnotationId;
  readonly figure: AnnotationId;
  readonly wordOverWhole: AnnotationId;
  readonly paragraph: AnnotationId;
  readonly sentence: AnnotationId;
  readonly word: AnnotationId;
  readonly mention: AnnotationId;
  readonly twoTargets: AnnotationId;
};

/** One containment case: a document over a whole range and a strict inner range, and its roles. */
export type ContainmentCase = {
  readonly document: TextDocument;
  readonly roles: ContainmentRoles;
};

/**
 * Generated containment cases over text of two or more scalars. A Section, a Title, a Figure and a Word span the
 * whole text; a Paragraph, a Sentence, a Word and a Mention span one strict inner range, so the Paragraph is a
 * one-sentence paragraph; a Sentence targets both ranges. A drawn inner range equal to the whole text is narrowed by
 * its last scalar, so it stays non-empty and becomes strict; nothing is filtered.
 */
export const containmentCase: Arbitrary.Arbitrary<ContainmentCase> = Arbitrary.flatMap(
  wellFormedTextWith({ minLength: 2, maxLength: 24 }),
  (generated) =>
    Arbitrary.map(
      Arbitrary.all({
        source: sourceFor(sha256)(generated.text),
        inner: scalarRangeIn(generated.codePoints.length),
        activity: label,
        at: instantHalfAtEdges,
        klass: pick,
      }),
      (drawn) => {
        const scalars = generated.codePoints.length;
        const strict =
          drawn.inner.first === 0 && drawn.inner.last === scalars ? { first: 0, last: scalars - 1 } : drawn.inner;
        const range = rangeIn(generated.boundaries["utf16-code-unit"]);
        const wholeRow = anchoredOn(drawn.source, generated.text, range({ first: 0, last: scalars }));
        const innerRow = anchoredOn(drawn.source, generated.text, range(strict));
        const whole = HashSet.make(occurrenceOf(wholeRow));
        const inner = HashSet.make(occurrenceOf(innerRow));
        const annotations = {
          section: K.Section.case.make({ targets: whole, body: Section.make({ depth: 1 }) }),
          title: K.Title.case.make({ targets: whole, body: Title.make({}) }),
          figure: K.Figure.case.make({ targets: whole, body: Figure.make({ label: O.none() }) }),
          wordOverWhole: K.Word.case.make({ targets: whole, body: Word.make({}) }),
          paragraph: K.Paragraph.case.make({ targets: inner, body: Paragraph.make({}) }),
          sentence: K.Sentence.case.make({ targets: inner, body: Sentence.make({}) }),
          word: K.Word.case.make({ targets: inner, body: Word.make({}) }),
          mention: K.Mention.case.make({
            targets: inner,
            body: Mention.make({ class: at(mentionClasses, drawn.klass) }),
          }),
          twoTargets: K.Sentence.case.make({ targets: HashSet.union(whole, inner), body: Sentence.make({}) }),
        };
        const roles: ContainmentRoles = R.map(annotations, annotationIdOf);
        const activity = activityIdOf(drawn.activity);
        return {
          roles,
          document: TextDocument.make({
            text: drawn.source,
            anchors: HashMap.make([occurrenceOf(wholeRow), wholeRow], [occurrenceOf(innerRow), innerRow]),
            annotations: HashMap.fromIterable(
              A.map(R.values(annotations), (annotation) => [annotationIdOf(annotation), annotation] as const)
            ),
            attribution: HashMap.fromIterable(
              A.map(
                R.values(roles),
                (content) => [content, HashSet.make(generationOf({ content, activity, at: O.some(drawn.at) }))] as const
              )
            ),
          }),
        };
      }
    )
);

/** A kind name of the text document. */
export type DocumentKindName = KindName<typeof DocumentKinds>;

/** Generated kind sets over every declared kind, open or closed under body references. */
export const kindSetCase: Arbitrary.Arbitrary<HashSet.HashSet<DocumentKindName>> = Arbitrary.map(
  Arbitrary.all(R.map(DocumentKinds, () => Arbitrary.schema(S.Boolean))),
  (drawn) => HashSet.fromIterable(A.filter(R.keys(drawn), (name) => drawn[name]))
);

/** A kind set of the text document from its names. */
export const kindSet = (...names: ReadonlyArray<DocumentKindName>): HashSet.HashSet<DocumentKindName> =>
  HashSet.fromIterable(names);

/** One generated OA document with its imported activities and the text its anchors slice. */
export type GeneratedOaDocument = {
  readonly text: string;
  readonly document: OaDocument;
  readonly importedActivities: HashMap.HashMap<ActivityId, ImportedActivity>;
};

const activityHex = (activity: ActivityId): string => Str.slice(7, 23)(activity);

const importedForms: A.NonEmptyReadonlyArray<(activity: ActivityId) => O.Option<ImportedActivity>> = [
  () => O.none(),
  (activity) =>
    ImportedActivity.cases.Activity.makeOption({
      iri: IRI.make(`https://example.org/activity/${activityHex(activity)}`),
    }),
  (activity) =>
    ImportedActivity.cases.Creator.makeOption({
      agent: IRI.make(`https://example.org/agent/${activityHex(activity)}`),
    }),
  (activity) =>
    ImportedActivity.cases.Generator.makeOption({
      agent: IRI.make(`https://example.org/software/${activityHex(activity)}`),
    }),
];

/** The id of an imported activity, through the `imported-activity/v1` twin. */
export const importedActivityIdOf = (activity: ImportedActivity): ActivityId =>
  ActivityId.make(Result.getOrThrow(ImportedActivityPreimage.mintResult(sha256)([activity])));

/** The id of the import activity of a dataset digest, through the `import-activity/v2` twin. */
export const importActivityIdOf = (datasetDigest: DatasetDigest): ActivityId =>
  ActivityId.make(Result.getOrThrow(ImportActivityPreimage.mintResult(sha256)([datasetDigest])));

/**
 * Generated OA documents: a generated text document narrowed by `restrictToOa`, so every anchors row is a target,
 * its activities rewritten to drawn native or imported forms, and drawn annotations given an import generation beside
 * their others. Each imported activity is keyed by its `imported-activity/v1` id and named from the activity it
 * replaces, so two activities stay two; time stays one per (content, activity).
 */
export const oaDocumentCase: Arbitrary.Arbitrary<GeneratedOaDocument> = Arbitrary.flatMap(
  documentCase,
  ({ text, document }) =>
    Arbitrary.map(
      Arbitrary.all({
        forms: nonEmptyArray(between(0, importedForms.length - 1), 3),
        withImport: nonEmptyArray(Arbitrary.schema(S.Boolean), 8),
        importAt: statedTime,
        digestSeed: label,
      }),
      (drawn) => {
        const restricted = restrictToOa(document);
        const importActivity = importActivityIdOf(
          DatasetDigest.make(ContentHash.make(hashOf(`import:${drawn.digestSeed}`)))
        );
        const activities = A.sort(
          A.dedupe(
            A.flatMap(restricted.attribution.pipe(HashMap.values, A.fromIterable), (generations) =>
              A.map(A.fromIterable(generations), ({ activity }) => activity)
            )
          ),
          Order.String
        );
        const replaced = A.map(activities, (activity, index) => {
          const imported = at(importedForms, at(drawn.forms, index))(activity);
          return {
            from: activity,
            to: O.match(imported, { onNone: () => activity, onSome: importedActivityIdOf }),
            imported,
          };
        });
        const renamed = (activity: ActivityId): ActivityId =>
          A.findFirst(replaced, ({ from }) => from === activity).pipe(
            O.map(({ to }) => to),
            O.getOrElse(() => activity)
          );
        const contents = A.sort(restricted.attribution.pipe(HashMap.keys, A.fromIterable), Order.String);
        const attribution = HashMap.map(restricted.attribution, (generations, content) => {
          const index = A.findFirstIndex(contents, (key) => key === content).pipe(O.getOrElse(() => 0));
          const rewritten = A.map(A.fromIterable(generations), (generation) =>
            generationOf({ content, activity: renamed(generation.activity), at: generation.at })
          );
          return HashSet.fromIterable(
            at(drawn.withImport, index)
              ? A.append(rewritten, generationOf({ content, activity: importActivity, at: drawn.importAt }))
              : rewritten
          );
        });
        return {
          text,
          importedActivities: HashMap.fromIterable(
            A.flatMap(replaced, ({ to, imported }) =>
              A.map(A.fromOption(imported), (activity) => [to, activity] as const)
            )
          ),
          document: OaDocument.make({ ...restricted, attribution }),
        };
      }
    )
);

/** The source IRI the generated and fixture OA input is over. */
export const oaSource = IRI.make("https://example.org/source");

const otherSource = "https://example.org/other";

const rdfType = iri("rdf:type");

const rdfNode = (value: string): Rdf.NamedNode => Rdf.makeNamedNode(value);

const xsd = { integer: iri("xsd:integer"), string: iri("xsd:string"), dateTime: iri("xsd:dateTime") };

/** The quad builders of the generated and fixture OA input. */
export const oaQuads = {
  named: rdfNode,
  blank: (label: string): Rdf.BlankNode => Rdf.makeBlankNode(label),
  quad: (subject: Rdf.Subject, predicate: string, object: Rdf.ObjectTerm): Rdf.Quad =>
    Rdf.makeQuad(subject, rdfNode(predicate), object),
  type: (subject: Rdf.Subject, klass: string): Rdf.Quad => Rdf.makeQuad(subject, rdfNode(rdfType), rdfNode(klass)),
  integer: (value: number): Rdf.Literal => Rdf.Literal.typed(`${value}`, xsd.integer),
  string: (value: string): Rdf.Literal => Rdf.makeLiteral(value),
  time: (millis: number): Rdf.Literal =>
    Rdf.Literal.typed(DateTime.formatIso(DateTime.makeUnsafe(millis)), xsd.dateTime),
  lexicalTime: (lexical: string): Rdf.Literal => Rdf.Literal.typed(lexical, xsd.dateTime),
};

const Q = oaQuads;

type InputTarget = {
  readonly node: Rdf.Subject;
  readonly label: string;
  readonly points: { readonly start: number; readonly end: number };
  readonly units: { readonly start: number; readonly end: number };
  readonly prefixFrom: number;
  readonly style: number;
  readonly source: string;
};

const targetQuads = (text: string, target: InputTarget): ReadonlyArray<Rdf.Quad> => {
  const position = Q.blank(`${target.label}p`);
  const quote = Q.blank(`${target.label}q`);
  const exact = Str.slice(target.units.start, target.units.end)(text);
  const positionQuads = [
    Q.quad(target.node, iri("oa:hasSelector"), position),
    Q.type(position, iri("oa:TextPositionSelector")),
    Q.quad(position, iri("oa:start"), Q.integer(target.points.start)),
    Q.quad(position, iri("oa:end"), Q.integer(target.points.end)),
  ];
  const quoteQuads = [
    Q.quad(target.node, iri("oa:hasSelector"), quote),
    Q.type(quote, iri("oa:TextQuoteSelector")),
    Q.quad(quote, iri("oa:exact"), Q.string(exact)),
  ];
  const prefix = Str.slice(target.prefixFrom, target.units.start)(text);
  const bothPositionOnlyQuoteOnlyOrPrefixed: A.NonEmptyReadonlyArray<ReadonlyArray<Rdf.Quad>> = [
    [...positionQuads, ...quoteQuads],
    positionQuads,
    quoteQuads,
    Str.isEmpty(prefix) ? quoteQuads : [...quoteQuads, Q.quad(quote, iri("oa:prefix"), Q.string(prefix))],
  ];
  return [
    Q.type(target.node, iri("oa:SpecificResource")),
    Q.quad(target.node, iri("oa:hasSource"), Q.named(target.source)),
    ...at(bothPositionOnlyQuoteOnlyOrPrefixed, target.style),
  ];
};

const kindIris: A.NonEmptyReadonlyArray<O.Option<string>> = [
  O.some(iri("annotation:Mention")),
  O.some(iri("annotation:Title")),
  O.some(iri("annotation:Paragraph")),
  O.some(iri("annotation:Sentence")),
  O.some(iri("annotation:Word")),
  O.some(iri("annotation:Section")),
  O.none(),
];

const lexicalTimePairs: A.NonEmptyReadonlyArray<readonly [string, string]> = [
  ["2025-11-19T00:00:00Z", "2025-11-19T00:00:01.000Z"],
  ["9999-12-31T23:59:59-14:00", "10000-01-01T13:59:59.000Z"],
  ["-0001-12-31T23:59:59.99999Z", "0000-01-01T00:00:00+00:00"],
];

/** One generated third-party OA dataset over one generated text and its capture. */
export type GeneratedOaInput = {
  readonly text: string;
  readonly source: SourceTextIdentity;
  readonly dataset: Rdf.Dataset;
};

const inputAnnotation = Arbitrary.all({
  blank: Arbitrary.schema(S.Boolean),
  kind: between(0, kindIris.length - 1),
  klass: pick,
  body: between(0, 9),
  targets: nonEmptyArray(
    Arbitrary.all({ blank: Arbitrary.schema(S.Boolean), style: between(0, 3), other: between(0, 19), range: pick }),
    2
  ),
  attribution: between(0, 6),
  agent: between(0, 2),
  ownTime: between(0, 3),
  runTime: between(0, 2),
  era: between(0, lexicalTimePairs.length - 1),
  copy: between(0, 3),
  share: between(0, 3),
  extra: between(0, 3),
});

type InputAnnotation = typeof inputAnnotation extends Arbitrary.Arbitrary<infer Draw> ? Draw : never;

/**
 * Generated third-party OA input over a generated text: zero to four annotations with blank or IRI subjects and
 * targets, every kind and an unknown or missing one, spurious and missing bodies, position-only, quote-only and
 * prefixed selectors, targets on another source, every attribution form (none, annotation-level and run-level
 * activities, creators and generators, two creators on two runs at two times, an instance-form native activity),
 * stated and conflicting times written on both sides of the four-digit year and around year 0, annotations that
 * repeat an earlier one's content, annotations that share an earlier one's target node, NIF triples, a triple
 * outside the profile and a quad in a named graph. Every draw is a dataset the law covers; nothing is filtered.
 */
export const oaInputCase: Arbitrary.Arbitrary<GeneratedOaInput> = Arbitrary.flatMap(
  wellFormedTextWith({ minLength: 1, maxLength: 24 }),
  (generated) =>
    Arbitrary.map(
      Arbitrary.all({
        source: sourceFor(sha256)(generated.text),
        ranges: nonEmptyArray(scalarRangeIn(generated.codePoints.length), 4),
        annotations: Arbitrary.array(inputAnnotation, { maxLength: 4 }),
      }),
      (drawn) => {
        const points = generated.boundaries["unicode-code-point"];
        const units = generated.boundaries["utf16-code-unit"];
        const shapeOf = (annotation: InputAnnotation, index: number): InputAnnotation =>
          annotation.copy === 0 && index > 0 ? A.getUnsafe(drawn.annotations, index - 1) : annotation;
        const ownTargets = A.map(drawn.annotations, (annotation, index) =>
          A.map(shapeOf(annotation, index).targets, (target, position): InputTarget => {
            const range = at(drawn.ranges, target.range);
            return {
              node: target.blank
                ? Q.blank(`t${index}x${position}`)
                : Q.named(`https://example.org/target/${index}/${position}`),
              label: `s${index}x${position}`,
              points: rangeIn(points)(range),
              units: rangeIn(units)(range),
              prefixFrom: A.getUnsafe(units, Math.max(0, range.first - 2)),
              style: target.style,
              source: target.other === 0 ? otherSource : oaSource,
            };
          })
        );
        const quadsOf = (annotation: InputAnnotation, index: number): ReadonlyArray<Rdf.Quad> => {
          const shape = shapeOf(annotation, index);
          const subject = annotation.blank ? Q.blank(`a${index}`) : Q.named(`https://example.org/annotation/${index}`);
          const kind = at(kindIris, shape.kind);
          const own = A.getUnsafe(ownTargets, index);
          const targets: A.NonEmptyReadonlyArray<InputTarget> =
            annotation.share === 0 && index > 0
              ? A.prepend(A.drop(own, 1), A.headNonEmpty(A.getUnsafe(ownTargets, index - 1)))
              : own;
          const [firstTime, lastTime] = at(lexicalTimePairs, annotation.era);
          const isMention = O.contains(kind, iri("annotation:Mention"));
          const body = isMention
            ? shape.body === 0
              ? [Q.quad(subject, iri("oa:hasBody"), Q.string("not a class"))]
              : [Q.quad(subject, iri("oa:hasBody"), Q.named(at(mentionClasses, shape.klass)))]
            : shape.body === 0
              ? [Q.quad(subject, iri("oa:hasBody"), Q.named(at(mentionClasses, shape.klass)))]
              : [];
          const activity = Q.named(`https://example.org/activity/${annotation.agent}`);
          const run = Q.blank(`r${index}`);
          const second = Q.blank(`r${index}b`);
          const runTime = A.map(A.take([firstTime, lastTime], annotation.runTime), (lexical) =>
            Q.quad(run, iri("prov:generatedAtTime"), Q.lexicalTime(lexical))
          );
          const attributions: A.NonEmptyReadonlyArray<ReadonlyArray<Rdf.Quad>> = [
            [],
            [Q.quad(subject, iri("prov:wasGeneratedBy"), activity), Q.type(activity, iri("prov:Activity"))],
            [Q.quad(subject, iri("dcterms:creator"), Q.named(`https://example.org/agent/${annotation.agent}`))],
            [Q.quad(subject, iri("as:generator"), Q.named(`https://example.org/software/${annotation.agent}`))],
            [
              Q.quad(run, iri("prov:specializationOf"), subject),
              Q.quad(run, iri("prov:wasGeneratedBy"), activity),
              ...runTime,
            ],
            [
              Q.quad(run, iri("prov:specializationOf"), subject),
              Q.quad(run, iri("dcterms:creator"), Q.named("https://example.org/agent/0")),
              Q.quad(run, iri("prov:generatedAtTime"), Q.lexicalTime(firstTime)),
              Q.quad(second, iri("prov:specializationOf"), subject),
              Q.quad(second, iri("dcterms:creator"), Q.named("https://example.org/agent/1")),
              Q.quad(second, iri("prov:generatedAtTime"), Q.lexicalTime(lastTime)),
            ],
            [Q.quad(subject, iri("prov:wasGeneratedBy"), Q.named(instanceIri(activityIdOf(`${annotation.agent}`))))],
          ];
          const ownTimes: A.NonEmptyReadonlyArray<ReadonlyArray<Rdf.Quad>> = [
            [],
            [Q.quad(subject, iri("prov:generatedAtTime"), Q.lexicalTime(firstTime))],
            [Q.quad(subject, iri("dcterms:created"), Q.lexicalTime(lastTime))],
            A.map([firstTime, lastTime], (lexical) =>
              Q.quad(subject, iri("prov:generatedAtTime"), Q.lexicalTime(lexical))
            ),
          ];
          const first = A.headNonEmpty(targets);
          const extras: A.NonEmptyReadonlyArray<ReadonlyArray<Rdf.Quad>> = [
            [],
            [
              Q.type(first.node, iri("nif:Sentence")),
              Q.quad(first.node, iri("nif:beginIndex"), Q.integer(first.points.start)),
            ],
            [Q.quad(subject, "https://example.org/vocab/note", Q.string("outside the profile"))],
            [
              Rdf.makeQuad(
                subject,
                rdfNode(rdfType),
                Rdf.MakeQuadOptionsInput.make({
                  object: rdfNode(iri("oa:Annotation")),
                  graph: Q.named("https://example.org/graph"),
                })
              ),
            ],
          ];
          return [
            Q.type(subject, iri("oa:Annotation")),
            ...A.map(A.fromOption(kind), (klass) => Q.type(subject, klass)),
            ...body,
            ...A.flatMap(targets, (target) => [
              Q.quad(subject, iri("oa:hasTarget"), target.node),
              ...targetQuads(generated.text, target),
            ]),
            ...at(attributions, annotation.attribution),
            ...at(ownTimes, annotation.ownTime),
            ...at(extras, annotation.extra),
          ];
        };
        const quads = A.flatMap(drawn.annotations, quadsOf);
        return { text: generated.text, source: drawn.source, dataset: Rdf.makeDataset(quads) };
      }
    )
);
