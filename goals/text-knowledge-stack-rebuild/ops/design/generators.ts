/**
 * Composed `Arbitrary` prototypes for the annotation document family and the
 * claim log.
 *
 * Leaves come from `Arbitrary.schema` over the production schemas, with every
 * string leaf drawn well-formed (`WellFormedText`, `SourceTextLocator`, registry IRI
 * pools), so no root is discarded by canonicalization. Every dependent value
 * (capture text digest, occurrence, annotation, activity, run and claim ids)
 * is built with `map`/`flatMap`/`filterMap` through the layers' preimage
 * builders, so generated values satisfy the document checks and the log laws
 * by construction.
 *
 * Minting in the layers is effectful because the `Digest` service is the one
 * hash backend (decision 2026-11-19-p0-items4-6-9-annotation-document-shape). A generator cannot yield a service, so
 * these prototypes take a pure SHA-256 (`JsoncDigest`) from the test harness
 * and mint through `mintContentHashResult`, which hashes the same canonical
 * bytes as `mintContentHash`; occurrences go through the `@beep/text`
 * `OccurrencePreimage.mintResult`, the sync twin of `mintOccurrenceId`, whose
 * error is `PreimageMintError`. The package's own law generators live in
 * `packages/foundation/modeling/text/test/support/generators.ts`. Generated text is well-formed UTF-16 (astral
 * characters included), every range sits on code-point boundaries and the
 * capture's textDigest is the digest of the text, so a generated receipt also
 * passes re-verification (decision 2026-11-19-p0-law-generators-well-formed-text); split surrogates stay a negative fixture
 * for L1-2.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ValidTime } from "@beep/epistemics/Claim";
import { $RepoCliId } from "@beep/identity/packages";
import { TermIri } from "@beep/identity/Term";
import { ActivityPin, ActivityStart, mintActivityIdResult } from "@beep/jsonc/ActivityStart";
import { mintContentHashResult } from "@beep/jsonc/Mint";
import { WellFormedText } from "@beep/schema/WellFormedText";
import { Anchored, OccurrenceId, OccurrencePreimage } from "@beep/text/Occurrence";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Equal from "effect/Equal";
import * as Hex from "effect/encoding/Hex";
import { identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AnnotationContent,
  AnnotationDomainTag,
  AnnotationId,
  annotationPreimage,
  Chunk,
  CorefCandidate,
  DocumentKinds,
  encodeBody,
  Figure,
  Generation,
  GenerationDomainTag,
  Mention,
  Paragraph,
  RelationCandidate,
  RunEntityId,
  Section,
  Sentence,
  TextDocument,
  Title,
  Word,
} from "./L2.annotation.ts";
import { ChallengeKind, ClaimDomainTag, ClaimId, ClaimLogEntry, makeClaimCore } from "./L4.claims.ts";
import type { JsoncCanonicalizeError, JsoncDigest } from "@beep/jsonc/JsoncFingerprint";
import type { ActivityId } from "@beep/schema/ContentHash";
import type { AnyAnnotationKind } from "./L2.annotation.ts";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/generators");

type Annotation =
  (typeof TextDocument.fields.annotations)["Type"] extends HashMap.HashMap<AnnotationId, infer Value> ? Value : never;

type Row = { readonly id: AnnotationId; readonly annotation: Annotation };

const ExtractOperation = TermIri.make("https://beep-effect.com/ns/operation/Extract");
const RelatedTo = TermIri.make("https://beep-effect.com/ns/annotation/predicate/relatedTo");
const MentionClassNames: A.NonEmptyReadonlyArray<string> = ["Party", "Court", "Patent", "Claim"];
const MentionClasses = A.map(MentionClassNames, (name) =>
  TermIri.make(`https://beep-effect.com/ns/annotation/class/${name}`)
);

// Code points: printable BMP below the surrogate block, plus 64 astral emoji above 0x2fff.
const CodePointPick = S.Int.check(S.isBetween({ minimum: 0x20, maximum: 0x2fff + 64 }));
const Pick = S.Int.check(S.isBetween({ minimum: 0, maximum: 1_000 }));
const utf8 = new TextEncoder();
// Instants from a bounded epoch-millis leaf (1970 to 2100): drawn near the edge of the DateTime
// range, an Instant plus the generators' offsets would leave it and encode as NaN.
const EpochMillis = S.Int.check(S.isBetween({ minimum: 0, maximum: 4_102_444_800_000 }));
const instantArbitrary = Arbitrary.map(Arbitrary.schema(EpochMillis), (millis) => DateTime.makeUnsafe(millis));

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));
const picks = (options: { readonly minLength?: number; readonly maxLength: number }) =>
  Arbitrary.array(Arbitrary.schema(Pick), options);

const at = <A>(values: A.NonEmptyReadonlyArray<A>, pick: number): A =>
  O.getOrElse(A.get(values, pick % values.length), () => A.headNonEmpty(values));

const cyclic = (values: ReadonlyArray<number>, index: number): number =>
  O.getOrElse(A.get(values, index % Math.max(values.length, 1)), () => 0);

const nonEmpty = <A>(values: ReadonlyArray<A>): Result.Result<A.NonEmptyReadonlyArray<A>, "empty"> =>
  A.isReadonlyArrayNonEmpty(values) ? Result.succeed(values) : Result.fail("empty");

const toCodePoint = (pick: number): number => (pick > 0x2fff ? 0x1f600 + (pick - 0x3000) : pick);

// Well-formed text and its UTF-16 code-point boundaries (offset 0, then the end of each code point).
const wellFormedTextWith = (minLength: number) =>
  Arbitrary.map(Arbitrary.array(Arbitrary.schema(CodePointPick), { minLength, maxLength: 80 }), (raw) => {
    const codePoints = A.map(raw, toCodePoint);
    return {
      text: A.join(
        A.map(codePoints, (codePoint) => String.fromCodePoint(codePoint)),
        ""
      ),
      boundaries: A.scan(codePoints, 0, (offset, codePoint) => offset + (codePoint > 0xffff ? 2 : 1)),
    };
  });

const wellFormedText = wellFormedTextWith(1);

const rangeIn = (boundaries: A.NonEmptyReadonlyArray<number>) =>
  Arbitrary.flatMap(between(0, boundaries.length - 2), (first) =>
    Arbitrary.map(between(first + 1, boundaries.length - 1), (last) => ({
      start: at(boundaries, first),
      end: at(boundaries, last),
    }))
  );

const anchoredOn = (
  source: SourceTextIdentity,
  text: string,
  range: { readonly start: number; readonly end: number }
) =>
  Anchored.make({
    receipt: TextAnchorVerificationReceipt.make({
      anchor: TextAnchor.make({
        startChar: range.start,
        endChar: range.end,
        quote: Str.slice(range.start, range.end)(text),
      }),
      source,
    }),
  });

/** The pure minting functions over a caller-supplied SHA-256, one per domain. */
const minters = (digest: JsoncDigest) => {
  const mint = mintContentHashResult(digest);
  return {
    textDigest: (text: string) => SourceTextDigest.make(`sha256:${Hex.encode(digest(utf8.encode(text)))}`),
    occurrence: (anchored: Anchored) => Result.map(OccurrencePreimage.mintResult(digest)(anchored), OccurrenceId.make),
    activity: mintActivityIdResult(digest),
    annotation: (kind: AnyAnnotationKind, targets: A.NonEmptyReadonlyArray<OccurrenceId>, body: unknown) =>
      Result.flatMap(encodeBody(kind)(body), (encoded) =>
        Result.map(
          mint(
            AnnotationDomainTag,
            annotationPreimage(AnnotationContent.make({ kind: kind.iri, targets, body: encoded }))
          ),
          (hash) => AnnotationId.make(hash)
        )
      ),
    run: (content: AnnotationId, activity: ActivityId) =>
      Result.map(mint(GenerationDomainTag, [content, activity]), (hash) => RunEntityId.make(hash)),
    claim: (encodedCore: unknown) => Result.map(mint(ClaimDomainTag, [encodedCore]), (hash) => ClaimId.make(hash)),
  };
};

/**
 * Three annotation documents over one shared capture, with overlapping
 * content and one activity each, plus a fourth that conflicts with the first:
 * the inputs of merge's success path, the join laws (L2-1) and the
 * GenerationTimeConflict refusal.
 */
export class DocumentFamily extends S.Opaque<DocumentFamily, { readonly brand: unique symbol }>()(
  S.Struct({
    capture: SourceTextIdentity,
    documents: S.Array(TextDocument).annotateKey({
      description: "Three documents sharing the capture and the mention annotations, each from its own activity.",
    }),
    conflicting: TextDocument.annotateKey({
      description: "The second document with one shared (content, activity) pair at a different time.",
    }),
  }).pipe($I.annoteSchema("DocumentFamily", { description: "Generated documents over one capture for merge laws." }))
) {}

/**
 * Generated document families before filtering, as Results; a failure is a
 * discarded root, so a harness can measure and attribute the discard rate.
 */
export const documentFamilyResultArbitrary = (digest: JsoncDigest) => {
  const mint = minters(digest);
  const leaves = Arbitrary.all({
    text: wellFormedText,
    scopeRef: Arbitrary.schema(WellFormedText),
    sourceRef: Arbitrary.schema(WellFormedText),
    locator: Arbitrary.schema(SourceTextLocator),
    sourceDigest: Arbitrary.schema(SourceTextDigest),
    extractorName: Arbitrary.schema(WellFormedText),
    extractorVersion: Arbitrary.schema(WellFormedText),
    normalizationVersion: Arbitrary.schema(WellFormedText),
    pin: Arbitrary.schema(ActivityPin),
    started: instantArbitrary,
    bodies: Arbitrary.all({
      outerSection: Arbitrary.schema(Section),
      innerSection: Arbitrary.schema(Section),
      title: Arbitrary.schema(Title),
      figure: Arbitrary.schema(Figure),
      paragraph: Arbitrary.schema(Paragraph),
      sentence: Arbitrary.schema(Sentence),
      word: Arbitrary.schema(Word),
      chunk: Arbitrary.schema(Chunk),
    }),
  });
  const withPicks = Arbitrary.flatMap(leaves, (base) =>
    Arbitrary.all({
      base: Arbitrary.Constant(base),
      ranges: Arbitrary.array(rangeIn(base.text.boundaries), { minLength: 3, maxLength: 6 }),
      kindPicks: picks({ minLength: 1, maxLength: 6 }),
      mentionPicks: Arbitrary.array(picks({ minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 4 }),
      classPicks: picks({ minLength: 1, maxLength: 4 }),
      relationPicks: Arbitrary.array(Arbitrary.all([Arbitrary.schema(Pick), Arbitrary.schema(Pick)]), { maxLength: 3 }),
      corefPicks: Arbitrary.array(picks({ minLength: 2, maxLength: 3 }), { maxLength: 2 }),
      memberPicks: Arbitrary.array(between(1, 7), { minLength: 1, maxLength: 8 }),
    })
  );
  return Arbitrary.map(
    withPicks,
    ({ base, ranges, kindPicks, mentionPicks, classPicks, relationPicks, corefPicks, memberPicks }) =>
      Result.gen(function* () {
        const capture = SourceTextIdentity.make({
          scopeRef: base.scopeRef,
          sourceRef: base.sourceRef,
          locator: base.locator,
          sourceDigest: base.sourceDigest,
          textDigest: mint.textDigest(base.text.text),
          extractor: SourceTextExtractor.make({ name: base.extractorName, version: base.extractorVersion }),
          normalizationVersion: base.normalizationVersion,
        });

        // The first row spans the whole text, so structure kinds get nested and equal-span cases (L2-5).
        const wholeText = { start: 0, end: A.lastNonEmpty(base.text.boundaries) };
        const anchoredRows = A.map(A.prepend(ranges, wholeText), (range) => anchoredOn(capture, base.text.text, range));
        const occurrences = yield* Result.all(A.map(anchoredRows, mint.occurrence));
        const occurrenceIds = yield* nonEmpty(occurrences);
        const anchors = HashMap.fromIterable(A.zip(occurrences, anchoredRows));
        const whole = A.headNonEmpty(occurrenceIds);
        const inner = at(occurrenceIds, 1);
        const side = at(occurrenceIds, 2);

        const row = (
          kind: AnyAnnotationKind,
          targets: A.NonEmptyReadonlyArray<OccurrenceId>,
          body: unknown,
          annotation: Annotation
        ) => Result.map(mint.annotation(kind, targets, body), (id): Row => ({ id, annotation }));
        const K = DocumentKinds;
        const { bodies } = base;
        const randomStructure: A.NonEmptyReadonlyArray<(target: OccurrenceId) => ReturnType<typeof row>> = [
          (target: OccurrenceId) =>
            row(
              K.Section,
              [target],
              bodies.innerSection,
              K.Section.case.make({ targets: HashSet.make(target), body: bodies.innerSection })
            ),
          (target: OccurrenceId) =>
            row(
              K.Title,
              [target],
              bodies.title,
              K.Title.case.make({ targets: HashSet.make(target), body: bodies.title })
            ),
          (target: OccurrenceId) =>
            row(
              K.Figure,
              [target],
              bodies.figure,
              K.Figure.case.make({ targets: HashSet.make(target), body: bodies.figure })
            ),
          (target: OccurrenceId) =>
            row(
              K.Paragraph,
              [target],
              bodies.paragraph,
              K.Paragraph.case.make({ targets: HashSet.make(target), body: bodies.paragraph })
            ),
          (target: OccurrenceId) =>
            row(
              K.Sentence,
              [target],
              bodies.sentence,
              K.Sentence.case.make({ targets: HashSet.make(target), body: bodies.sentence })
            ),
          (target: OccurrenceId) =>
            row(K.Word, [target], bodies.word, K.Word.case.make({ targets: HashSet.make(target), body: bodies.word })),
        ];
        const structure = yield* Result.all([
          // Nested sections: one over the whole text, one over a span inside it.
          row(
            K.Section,
            [whole],
            bodies.outerSection,
            K.Section.case.make({ targets: HashSet.make(whole), body: bodies.outerSection })
          ),
          row(
            K.Section,
            [inner],
            bodies.innerSection,
            K.Section.case.make({ targets: HashSet.make(inner), body: bodies.innerSection })
          ),
          // Equal span, lower level contains: Section and Paragraph over the whole text.
          row(
            K.Paragraph,
            [whole],
            bodies.paragraph,
            K.Paragraph.case.make({ targets: HashSet.make(whole), body: bodies.paragraph })
          ),
          // A one-sentence paragraph.
          row(
            K.Paragraph,
            [inner],
            bodies.paragraph,
            K.Paragraph.case.make({ targets: HashSet.make(inner), body: bodies.paragraph })
          ),
          row(
            K.Sentence,
            [inner],
            bodies.sentence,
            K.Sentence.case.make({ targets: HashSet.make(inner), body: bodies.sentence })
          ),
          // Equal level, equal span: neither contains the other.
          row(K.Title, [side], bodies.title, K.Title.case.make({ targets: HashSet.make(side), body: bodies.title })),
          row(
            K.Figure,
            [side],
            bodies.figure,
            K.Figure.case.make({ targets: HashSet.make(side), body: bodies.figure })
          ),
          row(K.Chunk, [whole], bodies.chunk, K.Chunk.case.make({ targets: HashSet.make(whole), body: bodies.chunk })),
          ...A.map(A.drop(occurrenceIds, 3), (target, index) => at(randomStructure, cyclic(kindPicks, index))(target)),
        ]);

        const mentions = yield* Result.all(
          A.map(mentionPicks, (targetPicks, index) => {
            const targets = A.dedupe(A.map(targetPicks, (pick) => at(occurrenceIds, pick)));
            const body = Mention.make({ class: at(MentionClasses, cyclic(classPicks, index)) });
            return Result.flatMap(nonEmpty(targets), (nonEmptyTargets) =>
              row(
                K.Mention,
                nonEmptyTargets,
                body,
                K.Mention.case.make({ targets: HashSet.fromIterable(targets), body })
              )
            );
          })
        );
        const mentionList = yield* nonEmpty(mentions);
        const targetsOf = (ids: ReadonlyArray<AnnotationId>) =>
          A.dedupe(
            A.flatMap(mentionList, (mention) =>
              A.contains(ids, mention.id) ? A.fromIterable(mention.annotation.targets) : A.empty<OccurrenceId>()
            )
          );
        const relations = yield* Result.all(
          A.map(relationPicks, ([left, right]) => {
            const subject = at(mentionList, left);
            const object = at(mentionList, right);
            const body = RelationCandidate.make({ subject: subject.id, predicate: RelatedTo, object: object.id });
            return Result.flatMap(nonEmpty(targetsOf([subject.id, object.id])), (targets) =>
              row(
                K.RelationCandidate,
                targets,
                body,
                K.RelationCandidate.case.make({ targets: HashSet.fromIterable(targets), body })
              )
            );
          })
        );
        const corefs = yield* Result.all(
          A.filterMap(corefPicks, (memberIndexes) => {
            const members = HashSet.fromIterable(A.map(memberIndexes, (pick) => at(mentionList, pick).id));
            // Skip a pick with fewer than two distinct members; build the row of the others.
            return Result.map(
              Result.fromOption(CorefCandidate.makeOption({ members }), () => "fewer-than-two"),
              (body) =>
                Result.flatMap(members.pipe(A.fromIterable, targetsOf, nonEmpty), (targets) =>
                  row(
                    K.CorefCandidate,
                    targets,
                    body,
                    K.CorefCandidate.case.make({ targets: HashSet.fromIterable(targets), body })
                  )
                )
            );
          })
        );

        // Each document has its own activity; mentions are shared, the other rows are split by membership bits.
        const activities = yield* Result.all(
          A.makeBy(3, (index) => {
            const started = DateTime.add(base.started, { milliseconds: 1_000 * index });
            return Result.map(
              mint.activity(
                ActivityStart.make({
                  operation: ExtractOperation,
                  pin: base.pin,
                  promptDigest: O.none(),
                  used: HashSet.empty(),
                  started,
                })
              ),
              (id) => ({ id, at: started })
            );
          })
        );
        const activityList = yield* nonEmpty(activities);
        const optional = [...structure, ...relations, ...corefs];
        const rowsOf = (index: number) => [
          ...mentionList,
          ...A.filter(optional, (_, position) => (cyclic(memberPicks, position) & (1 << index)) !== 0),
        ];
        const generation = (content: AnnotationId, activity: { readonly id: ActivityId; readonly at: DateTime.Utc }) =>
          Result.map(mint.run(content, activity.id), (run) =>
            Generation.make({ run, content, activity: activity.id, at: activity.at })
          );
        const document = (rows: ReadonlyArray<Row>, generations: ReadonlyArray<Generation>) =>
          Result.fromOption(
            TextDocument.makeOption({
              text: capture,
              anchors,
              annotations: HashMap.fromIterable(A.map(rows, (entry) => [entry.id, entry.annotation])),
              attribution: A.reduce(
                generations,
                HashMap.empty<AnnotationId, HashSet.HashSet<Generation>>(),
                (acc, gen) =>
                  HashMap.set(
                    acc,
                    gen.content,
                    HashSet.add(O.getOrElse(HashMap.get(acc, gen.content), HashSet.empty<Generation>), gen)
                  )
              ),
            }),
            () => "document-check-failed"
          );
        const twice = A.headNonEmpty(mentionList).id;
        const second = at(activityList, 1);
        const documents = yield* Result.all(
          A.map(
            A.makeBy(3, (index) => index),
            (index) =>
              Result.flatMap(
                Result.all(A.map(rowsOf(index), (entry) => generation(entry.id, at(activityList, index)))),
                (generations) =>
                  Result.flatMap(
                    // The first document also carries the second activity's generation of one shared mention.
                    index === 0
                      ? Result.map(generation(twice, second), (extra) => A.append(generations, extra))
                      : Result.succeed(generations),
                    (all) => document(rowsOf(index), all)
                  )
              )
          )
        );
        const conflicting = yield* Result.flatMap(
          Result.all(
            A.map(rowsOf(1), (entry) =>
              generation(
                entry.id,
                Equal.equals(entry.id, twice)
                  ? { id: second.id, at: DateTime.add(second.at, { milliseconds: 1 }) }
                  : second
              )
            )
          ),
          (generations) => document(rowsOf(1), generations)
        );
        return DocumentFamily.make({ capture, documents, conflicting });
      })
  );
};

/** Generated document families; `digest` is a pure SHA-256 from the test harness. */
export const documentFamilyArbitrary = (digest: JsoncDigest): Arbitrary.Arbitrary<DocumentFamily> =>
  Arbitrary.filterMap(documentFamilyResultArbitrary(digest), identity);

/** Generated single documents: the first document of a family. */
export const textDocumentArbitrary = (digest: JsoncDigest): Arbitrary.Arbitrary<TextDocument> =>
  Arbitrary.filterMap(documentFamilyArbitrary(digest), (family) =>
    Result.fromOption(A.head(family.documents), () => "no-document")
  );

const Holds = S.TaggedStruct("Holds", { subject: S.NonEmptyString }).pipe(
  $I.annoteSchema("Holds", { description: "Sample proposition for the claim-log generator." })
);
const MatterId = S.NonEmptyString.pipe(S.brand("MatterId"));
const ProposeOperation = TermIri.make("https://beep-effect.com/ns/operation/Propose");
const ScopePool: A.NonEmptyReadonlyArray<string> = ["matter:a", "matter:b"];
const SubjectPool: A.NonEmptyReadonlyArray<string> = ["subject-0", "subject-1"];

/** A sample claim binding the claim-log generator builds through. */
export const SampleClaims = makeClaimCore({
  proposition: Holds,
  ids: {
    logicalKey: (proposition) => `Holds|${proposition.subject}`,
    scope: MatterId,
    principal: S.NonEmptyString.pipe(S.brand("PrincipalId")),
    action: S.NonEmptyString.pipe(S.brand("ActionId")),
    revision: S.NonEmptyString.pipe(S.brand("RevisionId")),
  },
});

/** One generated log record: its minted id, its core, the checker's projection and its chain. */
export class GeneratedClaimRecord extends S.Opaque<GeneratedClaimRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    id: ClaimId,
    core: SampleClaims.ClaimCore,
    entry: ClaimLogEntry,
    chain: S.NonEmptyString,
  }).pipe($I.annoteSchema("GeneratedClaimRecord", { description: "A generated claim log record." }))
) {}

/** A generated claim log with its retractions and challenges. */
export class GeneratedClaimLog extends S.Opaque<GeneratedClaimLog, { readonly brand: unique symbol }>()(
  S.Struct({
    records: S.Array(GeneratedClaimRecord),
    retracted: S.HashSet(ClaimId),
    challenges: S.Array(SampleClaims.Challenge),
  }).pipe($I.annoteSchema("GeneratedClaimLog", { description: "A generated claim log for L4-1, L4-3 and L4-4." }))
) {}

type ClaimLogBuildError = S.SchemaError | JsoncCanonicalizeError | "invalid-core" | "invalid-log";

/**
 * Generated claim logs for L4-1, L4-3 and L4-4, built through the claim
 * minting preimage: partitions drawn from small scope and subject pools (so
 * one logicalKey appears under two scopes), supersession chains with
 * Unknown, closed and open-ended valid times inside disjoint per-chain slots,
 * derivedFrom drawn as 0-3 earlier ids (roots and diamonds, acyclic by
 * construction), partial and full retraction, and challenges that may cycle.
 * `checkClaimLog` reports nothing on every generated log.
 */
export const claimLogResultArbitrary = (digest: JsoncDigest) => {
  const mint = minters(digest);
  const encodeCore = S.encodeUnknownResult(S.toCodecJson(SampleClaims.ClaimCore));
  const leaves = Arbitrary.all({
    base: instantArbitrary,
    pin: Arbitrary.schema(ActivityPin),
    partitions: Arbitrary.array(
      Arbitrary.all({
        scope: between(0, 1),
        subject: between(0, 1),
        chains: Arbitrary.array(between(1, 3), { minLength: 1, maxLength: 3 }),
      }),
      { minLength: 2, maxLength: 4 }
    ),
    derivePicks: Arbitrary.array(picks({ maxLength: 3 }), { minLength: 1, maxLength: 12 }),
    validPicks: picks({ minLength: 1, maxLength: 12 }),
    retractPicks: picks({ minLength: 1, maxLength: 12 }),
    challengePicks: Arbitrary.array(
      Arbitrary.all({
        fromPick: Arbitrary.schema(Pick),
        toPick: Arbitrary.schema(Pick),
        kind: Arbitrary.schema(ChallengeKind),
      }),
      { maxLength: 3 }
    ),
  });
  return Arbitrary.map(leaves, ({ base, pin, partitions, derivePicks, validPicks, retractPicks, challengePicks }) => {
    const distinct = A.dedupeWith(
      partitions,
      (left, right) => left.scope === right.scope && left.subject === right.subject
    );
    const specs = A.flatMap(distinct, (partition, partitionIndex) =>
      A.flatMap(partition.chains, (length, chain) =>
        A.makeBy(length, (step) => ({
          partition,
          partitionIndex,
          chain,
          step,
          lastChain: chain === partition.chains.length - 1,
        }))
      )
    );
    const build = (
      records: ReadonlyArray<GeneratedClaimRecord>,
      spec: (typeof specs)[number],
      index: number
    ): Result.Result<GeneratedClaimRecord, ClaimLogBuildError> =>
      Result.gen(function* () {
        const chain = `${spec.partitionIndex}/${spec.chain}`;
        // knowledgeStart follows the append index, so the log is in knowledge-time order and every
        // parent (drawn from earlier records) starts no later than its child; valid-time slots are per chain.
        const knowledgeStart = DateTime.add(base, { milliseconds: 10_000 + index });
        const slot = DateTime.add(base, { milliseconds: 1_000 * spec.chain });
        const validPick = cyclic(validPicks, index);
        const valid =
          validPick % 3 === 0
            ? ValidTime.cases.Unknown.make({})
            : ValidTime.cases.Interval.make({
                validFrom: DateTime.add(slot, { milliseconds: validPick % 400 }),
                validTo:
                  validPick % 3 === 2 && spec.lastChain ? O.none() : O.some(DateTime.add(slot, { milliseconds: 999 })),
              });
        const supersedes = O.map(
          A.findLast(records, (record) => record.chain === chain),
          (record) => record.id
        );
        const parents = O.getOrElse(A.get(derivePicks, index % derivePicks.length), A.empty<number>);
        const derivedFrom = HashSet.fromIterable(
          A.isReadonlyArrayNonEmpty(records) ? A.map(parents, (pick) => at(records, pick).id) : A.empty<ClaimId>()
        );
        const generatedBy = yield* mint.activity(
          ActivityStart.make({
            operation: ProposeOperation,
            pin,
            promptDigest: O.none(),
            used: HashSet.empty(),
            started: knowledgeStart,
          })
        );
        const scope = MatterId.make(at(ScopePool, spec.partition.scope));
        const proposition = Holds.make({ subject: at(SubjectPool, spec.partition.subject) });
        const logicalKey = `Holds|${proposition.subject}`;
        const core = yield* Result.fromOption(
          SampleClaims.ClaimCore.makeOption({
            proposition,
            logicalKey,
            supportAtCreation: HashSet.empty(),
            derivedFrom,
            supersedes,
            generatedBy,
            assertedBy: SampleClaims.AgentRef.cases.SoftwareAgent.make({ name: "claim-log-generator", pin }),
            valid,
            knowledgeStart,
            scope,
          }),
          (): ClaimLogBuildError => "invalid-core"
        );
        const encoded = yield* encodeCore(core);
        const id = yield* mint.claim(encoded);
        return GeneratedClaimRecord.make({
          id,
          core,
          chain,
          entry: ClaimLogEntry.make({
            claim: id,
            scope,
            logicalKey,
            supersedes,
            derivedFrom,
            knowledgeStart,
            generatedAt: knowledgeStart,
            valid,
          }),
        });
      });
    const initial: Result.Result<ReadonlyArray<GeneratedClaimRecord>, ClaimLogBuildError> = Result.succeed(A.empty());
    const built = A.reduce(specs, initial, (accumulated, spec, index) =>
      Result.flatMap(accumulated, (records) =>
        Result.map(build(records, spec, index), (record) => A.append(records, record))
      )
    );
    return Result.flatMap(built, (records) =>
      Result.flatMap(nonEmpty(records), (nonEmptyRecords) => {
        const retracted = HashSet.fromIterable(
          A.filterMap(records, (record, index) =>
            cyclic(retractPicks, index) % 3 === 0 ? Result.succeed(record.id) : Result.fail(index)
          )
        );
        const challenges = A.flatMap(challengePicks, ({ fromPick, toPick, kind }, index) => {
          const from = at(nonEmptyRecords, fromPick);
          const to = at(nonEmptyRecords, toPick);
          const forward = SampleClaims.Challenge.cases.ByActivity.make({
            from: from.id,
            to: to.id,
            kind,
            generatedBy: to.core.generatedBy,
          });
          // The first challenge is answered back when its pick is even: a challenge cycle (L4-3 allows it).
          return index === 0 && fromPick % 2 === 0
            ? [
                forward,
                SampleClaims.Challenge.cases.ByActivity.make({
                  from: to.id,
                  to: from.id,
                  kind,
                  generatedBy: from.core.generatedBy,
                }),
              ]
            : [forward];
        });
        return Result.fromOption(
          GeneratedClaimLog.makeOption({ records, retracted, challenges }),
          (): ClaimLogBuildError => "invalid-log"
        );
      })
    );
  });
};

/** Generated claim logs; `digest` is a pure SHA-256 from the test harness. */
export const claimLogArbitrary = (digest: JsoncDigest): Arbitrary.Arbitrary<GeneratedClaimLog> =>
  Arbitrary.filterMap(claimLogResultArbitrary(digest), identity);

/** An ordered pair of annotation ids in one document. */
export class AnnotationPair extends S.Opaque<AnnotationPair, { readonly brand: unique symbol }>()(
  S.Struct({
    first: AnnotationId.annotateKey({ description: "The annotation the law expects to contain, or the left one." }),
    second: AnnotationId.annotateKey({
      description: "The annotation the law expects to be contained, or the right one.",
    }),
  }).pipe($I.annoteSchema("AnnotationPair", { description: "Two annotation ids of one generated document." }))
) {}

/**
 * One document with the three L2-5 containment cases present by
 * construction: `strict` (first contains second on a strict subrange),
 * `tieBreak` (equal span, first has the lower level and contains second) and
 * `equalLevel` (equal span, equal level, neither contains the other).
 */
export class ContainmentCase extends S.Opaque<ContainmentCase, { readonly brand: unique symbol }>()(
  S.Struct({
    document: TextDocument,
    strict: AnnotationPair,
    tieBreak: AnnotationPair,
    equalLevel: AnnotationPair,
  }).pipe($I.annoteSchema("ContainmentCase", { description: "A document carrying every L2-5 case." }))
) {}

/**
 * Generated containment cases over well-formed text of at least two code
 * points. The outer Section spans the whole text, the inner Sentence a strict
 * subrange on code-point boundaries; Paragraph (level 1) and Word (level 3)
 * share the inner span for the tie-break; Title and Figure (both level 1)
 * share the whole span. No root is discarded.
 */
export const containmentCaseResultArbitrary = (digest: JsoncDigest) => {
  const mint = minters(digest);
  const leaves = Arbitrary.all({
    text: wellFormedTextWith(2),
    scopeRef: Arbitrary.schema(WellFormedText),
    sourceRef: Arbitrary.schema(WellFormedText),
    locator: Arbitrary.schema(SourceTextLocator),
    sourceDigest: Arbitrary.schema(SourceTextDigest),
    extractorName: Arbitrary.schema(WellFormedText),
    extractorVersion: Arbitrary.schema(WellFormedText),
    normalizationVersion: Arbitrary.schema(WellFormedText),
    pin: Arbitrary.schema(ActivityPin),
    started: instantArbitrary,
    section: Arbitrary.schema(Section),
    sentence: Arbitrary.schema(Sentence),
    paragraph: Arbitrary.schema(Paragraph),
    word: Arbitrary.schema(Word),
    title: Arbitrary.schema(Title),
    figure: Arbitrary.schema(Figure),
  });
  const withInner = Arbitrary.flatMap(leaves, (base) =>
    Arbitrary.all({ base: Arbitrary.Constant(base), inner: rangeIn(base.text.boundaries) })
  );
  return Arbitrary.map(withInner, ({ base, inner: drawn }) =>
    Result.gen(function* () {
      const end = A.lastNonEmpty(base.text.boundaries);
      // A drawn range equal to the whole text is narrowed to end one code point early: still non-empty, now strict.
      const inner =
        drawn.start === 0 && drawn.end === end
          ? { start: 0, end: at(base.text.boundaries, base.text.boundaries.length - 2) }
          : drawn;
      const capture = SourceTextIdentity.make({
        scopeRef: base.scopeRef,
        sourceRef: base.sourceRef,
        locator: base.locator,
        sourceDigest: base.sourceDigest,
        textDigest: mint.textDigest(base.text.text),
        extractor: SourceTextExtractor.make({ name: base.extractorName, version: base.extractorVersion }),
        normalizationVersion: base.normalizationVersion,
      });
      const wholeRow = anchoredOn(capture, base.text.text, { start: 0, end });
      const innerRow = anchoredOn(capture, base.text.text, inner);
      const whole = yield* mint.occurrence(wholeRow);
      const span = yield* mint.occurrence(innerRow);
      const K = DocumentKinds;
      const row = (kind: AnyAnnotationKind, target: OccurrenceId, body: unknown, annotation: Annotation) =>
        Result.map(mint.annotation(kind, [target], body), (id): Row => ({ id, annotation }));
      const outer = yield* row(
        K.Section,
        whole,
        base.section,
        K.Section.case.make({ targets: HashSet.make(whole), body: base.section })
      );
      const contained = yield* row(
        K.Sentence,
        span,
        base.sentence,
        K.Sentence.case.make({ targets: HashSet.make(span), body: base.sentence })
      );
      const lower = yield* row(
        K.Paragraph,
        span,
        base.paragraph,
        K.Paragraph.case.make({ targets: HashSet.make(span), body: base.paragraph })
      );
      const higher = yield* row(
        K.Word,
        span,
        base.word,
        K.Word.case.make({ targets: HashSet.make(span), body: base.word })
      );
      const left = yield* row(
        K.Title,
        whole,
        base.title,
        K.Title.case.make({ targets: HashSet.make(whole), body: base.title })
      );
      const right = yield* row(
        K.Figure,
        whole,
        base.figure,
        K.Figure.case.make({ targets: HashSet.make(whole), body: base.figure })
      );
      const rows = [outer, contained, lower, higher, left, right];
      const activity = yield* mint.activity(
        ActivityStart.make({
          operation: ExtractOperation,
          pin: base.pin,
          promptDigest: O.none(),
          used: HashSet.empty(),
          started: base.started,
        })
      );
      const generations = yield* Result.all(
        A.map(rows, (entry) =>
          Result.map(mint.run(entry.id, activity), (run) =>
            Generation.make({ run, content: entry.id, activity, at: base.started })
          )
        )
      );
      const document = yield* Result.fromOption(
        TextDocument.makeOption({
          text: capture,
          anchors: HashMap.make([whole, wholeRow], [span, innerRow]),
          annotations: HashMap.fromIterable(A.map(rows, (entry) => [entry.id, entry.annotation])),
          attribution: HashMap.fromIterable(
            A.map(generations, (generation) => [generation.content, HashSet.make(generation)])
          ),
        }),
        () => "document-check-failed"
      );
      return ContainmentCase.make({
        document,
        strict: AnnotationPair.make({ first: outer.id, second: contained.id }),
        tieBreak: AnnotationPair.make({ first: lower.id, second: higher.id }),
        equalLevel: AnnotationPair.make({ first: left.id, second: right.id }),
      });
    })
  );
};

/** Generated containment cases; `digest` is a pure SHA-256 from the test harness. */
export const containmentCaseArbitrary = (digest: JsoncDigest): Arbitrary.Arbitrary<ContainmentCase> =>
  Arbitrary.filterMap(containmentCaseResultArbitrary(digest), identity);
