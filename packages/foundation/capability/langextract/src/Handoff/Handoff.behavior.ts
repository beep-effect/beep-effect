/**
 * Produce verified annotations without losing any model candidate.
 * @packageDocumentation
 * @since 0.0.0
 */

import { mintAnnotationId } from "@beep/annotation/Kind";
import { CorefCandidate, ExtractionKinds, Mention, RelationCandidate } from "@beep/annotation/Kinds";
import { IRI } from "@beep/identity/Iri";
import { iri } from "@beep/identity/Registry";
import { ActivityPin, ActivityStart, mintActivityId } from "@beep/jsonc/ActivityStart";
import { ContentHash } from "@beep/schema/ContentHash";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { mintCaptureId } from "@beep/text/Capture";
import { Anchored, mintOccurrenceId } from "@beep/text/Occurrence";
import { TextAnchor } from "@beep/text/TextAnchor";
import {
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/text/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as Model from "effect/ai/Model";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { AlignmentSource, alignCandidate } from "../Alignment/index.ts";
import { ExtractionCandidate } from "../Extraction/Extraction.model.ts";
import { TargetAnnotation } from "../Target/Target.model.ts";
import {
  ExtractionActivity,
  ExtractionHandoff,
  ExtractionReading,
  extractionDocumentCodec,
  ResidualCandidate,
} from "./Handoff.model.ts";
import type { AnnotationId } from "@beep/annotation/AnnotationId";
import type { Annotation } from "@beep/annotation/Kind";
import type { OccurrenceId } from "@beep/text/Occurrence";
import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import type { VerifiedSourceText } from "@beep/text/VerifiedTextAnchor";
import type { GroundedExtraction } from "../Extraction/Extraction.model.ts";
import type { ExtractionTarget } from "../Target/Target.model.ts";
import type { ResidualReason } from "./Handoff.model.ts";

const mintAnnotation = mintAnnotationId(ExtractionKinds);
const utf8 = new TextEncoder();

/**
 * Mint the extraction activity before calling the model.
 * **Example** (Inspect the start constructor)
 * ```ts
 * import { startExtraction } from "@beep/langextract/Handoff"
 * import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 *
 * const startFor = (source: SourceTextIdentity) =>
 *   startExtraction({ prompt: "Extract named people", source, started: 0 })
 * console.log(typeof startFor)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const startExtraction = Effect.fn("LangExtract.startExtraction")(function* (input: {
  readonly prompt: string;
  readonly source: SourceTextIdentity;
  readonly started: number;
}) {
  const engine = yield* Model.ProviderName;
  const edition = yield* Model.ModelName;
  const digest = yield* Digest.Digest;
  const capture = yield* mintCaptureId(input.source);
  const promptDigest = Sha256PrefixedDigest.make(
    `sha256:${yield* digest.digestHex(Digest.sha256, utf8.encode(input.prompt))}`
  );
  const start = ActivityStart.make({
    operation: IRI.make(iri("operation:Extract")),
    pin: ActivityPin.cases.Engine.make({ engine, edition }),
    promptDigest: O.some(promptDigest),
    used: HashSet.make(ContentHash.make(capture)),
    started: DateTime.makeUnsafe(input.started),
  });
  return ExtractionActivity.make({ id: yield* mintActivityId(start), start });
});

const verify = (verified: VerifiedSourceText, anchor: TextAnchor) =>
  verifyTextAnchorAgainstVerifiedSource(
    VerifyTextAnchorAgainstVerifiedSourceInput.make({ anchor, verifiedSource: verified })
  ).pipe(
    Effect.map((proof) => Anchored.make({ receipt: toTextAnchorVerificationReceipt(proof) })),
    Effect.option
  );

const endpointAnchor = (evidence: TextAnchor, surface: string): O.Option<TextAnchor> => {
  const candidate = ExtractionCandidate.makeOption({ label: "endpoint", text: surface });
  if (O.isNone(candidate)) return O.none();
  const extraction = alignCandidate(
    candidate.value,
    AlignmentSource.make({ sourceText: evidence.quote, fuzzyThreshold: UnitInterval.make(1) })
  );
  if (extraction.alignmentStatus === "unaligned" || extraction.alignmentStatus === "match_fuzzy") return O.none();
  return TextAnchor.makeOption({
    startChar: S.Natural.make(evidence.startChar + extraction.anchor.startChar),
    endChar: S.Natural.make(evidence.startChar + extraction.anchor.endChar),
    quote: extraction.anchor.quote,
  });
};

/**
 * Verify the aligner's anchors, mint typed candidates and retain every unrepresented reading.
 *
 * **Details**
 *
 * `candidates` holds attempted alignments. Optional `overCap` holds parsed candidates
 * skipped by the alignment cap; they become `over-extraction-cap` residuals without
 * an anchor. Both lists contribute to the lossless candidate count.
 * **Example** (Inspect the handoff producer)
 * ```ts
 * import { handoff } from "@beep/langextract/Handoff"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const annotate = (input: Parameters<typeof handoff>[0]) =>
 *   handoff(input).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof annotate)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const handoff = Effect.fn("LangExtract.handoff")(function* (input: {
  readonly targets: A.NonEmptyReadonlyArray<ExtractionTarget>;
  readonly verified: VerifiedSourceText;
  readonly candidates: ReadonlyArray<GroundedExtraction>;
  readonly overCap?: ReadonlyArray<ExtractionCandidate>;
  readonly activity: ExtractionActivity;
  readonly at: DateTime.Utc;
}) {
  const overCap = O.getOrElse(O.fromUndefinedOr(input.overCap), A.empty<ExtractionCandidate>);
  const candidateCount = S.Natural.make(input.candidates.length + overCap.length);
  let anchors = A.empty<Anchored>();
  let annotations = A.empty<Annotation<typeof ExtractionKinds>>();
  let annotationRows = HashMap.empty<AnnotationId, Annotation<typeof ExtractionKinds>>();
  let readings = HashMap.empty<AnnotationId, A.NonEmptyReadonlyArray<ExtractionReading>>();
  let residual = A.empty<ResidualCandidate>();
  let clusters = HashMap.empty<string, HashSet.HashSet<AnnotationId>>();
  const addAnnotation = Effect.fnUntraced(function* (annotation: Annotation<typeof ExtractionKinds>) {
    const id = yield* mintAnnotation(annotation).pipe(Effect.orDie);
    annotations = A.append(annotations, annotation);
    annotationRows = HashMap.set(annotationRows, id, annotation);
    return id;
  });
  const mention = Effect.fnUntraced(function* (
    anchored: Anchored,
    declaration: TargetAnnotation & { readonly _tag: "Mention" }
  ) {
    anchors = A.append(anchors, anchored);
    const target = yield* mintOccurrenceId(anchored).pipe(Effect.orDie);
    return yield* addAnnotation(
      ExtractionKinds.Mention.case.make({
        targets: HashSet.make(target),
        body: Mention.make({ class: declaration.class }),
      })
    );
  });
  const addReading = (
    id: AnnotationId,
    extraction: GroundedExtraction & { readonly alignmentStatus: ExtractionReading["alignment"] },
    candidate: number
  ) => {
    const reading = ExtractionReading.make({
      candidate: S.Natural.make(candidate),
      label: extraction.label,
      text: extraction.text,
      attributes: extraction.attributes,
      confidence: extraction.confidence,
      alignment: extraction.alignmentStatus,
    });
    readings = HashMap.set(
      readings,
      id,
      O.match(HashMap.get(readings, id), {
        onNone: () => A.of(reading),
        onSome: (existing) => A.append(existing, reading),
      })
    );
  };
  const refuse = (extraction: GroundedExtraction, candidate: number, reason: ResidualReason) => {
    residual = A.append(
      residual,
      ResidualCandidate.make({
        candidate: S.Natural.make(candidate),
        label: extraction.label,
        text: extraction.text,
        attributes: extraction.attributes,
        confidence: extraction.confidence,
        alignment: extraction.alignmentStatus,
        reason,
        anchor: extraction.alignmentStatus === "unaligned" ? O.none() : O.some(extraction.anchor),
      })
    );
  };
  let relations =
    A.empty<
      readonly [
        number,
        GroundedExtraction & { readonly alignmentStatus: ExtractionReading["alignment"] },
        Extract<TargetAnnotation, { readonly _tag: "Relation" }>,
        Anchored,
      ]
    >();
  const readCandidate = Effect.fnUntraced(function* (candidate: number, extraction: GroundedExtraction) {
    if (extraction.alignmentStatus === "unaligned") {
      refuse(extraction, candidate, "unaligned");
      return;
    }
    const target = A.findFirst(input.targets, (target) => target.name === extraction.label);
    if (O.isNone(target)) {
      refuse(extraction, candidate, "unmapped-label");
      return;
    }
    const anchored = yield* verify(input.verified, extraction.anchor);
    if (O.isNone(anchored)) {
      refuse(extraction, candidate, "verification-refused");
      return;
    }
    const declaration = target.value.annotates;
    if (declaration._tag === "Relation") {
      relations = A.append(relations, [candidate, extraction, declaration, anchored.value]);
      return;
    }
    const id = yield* mention(anchored.value, declaration);
    addReading(id, extraction, candidate);
    const cluster = O.flatMap(declaration.coreference, (attribute) =>
      O.flatMap(extraction.attributes, (attributes) => R.get(attributes, attribute))
    );
    if (O.isSome(cluster)) {
      const key = `${declaration.class}\u0000${cluster.value}`;
      clusters = HashMap.set(
        clusters,
        key,
        HashSet.add(O.getOrElse(HashMap.get(clusters, key), HashSet.empty<AnnotationId>), id)
      );
    }
  });
  for (const [candidate, extraction] of A.map(
    input.candidates,
    (extraction, candidate) => [candidate, extraction] as const
  )) {
    yield* readCandidate(candidate, extraction);
  }
  const readRelation = Effect.fnUntraced(function* ([
    candidate,
    extraction,
    declaration,
    evidence,
  ]: (typeof relations)[number]) {
    const attributes = O.flatMap(extraction.attributes, (attributes) =>
      O.all({
        subject: R.get(attributes, declaration.subject),
        object: R.get(attributes, declaration.object),
        predicate: R.get(attributes, declaration.predicate),
      })
    );
    if (O.isNone(attributes)) {
      refuse(extraction, candidate, "relation-attribute-missing");
      return;
    }
    const predicate = R.get(declaration.predicates, attributes.value.predicate);
    if (O.isNone(predicate)) {
      refuse(extraction, candidate, "unmapped-predicate");
      return;
    }
    const endpointAnchors = O.all({
      subject: endpointAnchor(extraction.anchor, attributes.value.subject),
      object: endpointAnchor(extraction.anchor, attributes.value.object),
    });
    if (O.isNone(endpointAnchors)) {
      refuse(extraction, candidate, "relation-endpoint-unresolved");
      return;
    }
    const subject = yield* verify(input.verified, endpointAnchors.value.subject);
    const object = yield* verify(input.verified, endpointAnchors.value.object);
    if (O.isNone(subject) || O.isNone(object)) {
      refuse(extraction, candidate, "relation-endpoint-unresolved");
      return;
    }
    const endpoint = TargetAnnotation.cases.Mention.make({ class: declaration.endpoint });
    const subjectId = yield* mention(subject.value, endpoint);
    const objectId = yield* mention(object.value, endpoint);
    anchors = A.append(anchors, evidence);
    const target = yield* mintOccurrenceId(evidence).pipe(Effect.orDie);
    const id = yield* addAnnotation(
      ExtractionKinds.RelationCandidate.case.make({
        targets: HashSet.make(target),
        body: RelationCandidate.make({ subject: subjectId, object: objectId, predicate: predicate.value }),
      })
    );
    addReading(id, extraction, candidate);
  });
  for (const relation of relations) {
    yield* readRelation(relation);
  }
  for (const members of HashMap.values(clusters)) {
    if (HashSet.size(members) < 2) continue;
    let memberTargets = HashSet.empty<OccurrenceId>();
    for (const member of members)
      memberTargets = HashSet.union(memberTargets, HashMap.getUnsafe(annotationRows, member).targets);
    yield* addAnnotation(
      ExtractionKinds.CorefCandidate.case.make({ targets: memberTargets, body: CorefCandidate.make({ members }) })
    );
  }
  for (const [index, candidate] of A.map(overCap, (candidate, index) => [index, candidate] as const)) {
    residual = A.append(
      residual,
      ResidualCandidate.make({
        ...candidate,
        candidate: S.Natural.make(input.candidates.length + index),
        alignment: "unaligned",
        reason: "over-extraction-cap",
      })
    );
  }
  const document = yield* extractionDocumentCodec
    .assemble({
      text: input.verified.source,
      anchors,
      annotations,
      generation: { activity: input.activity.id, at: O.some(input.at) },
    })
    .pipe(Effect.orDie);
  yield* Effect.annotateCurrentSpan({
    "langextract.activity_id": input.activity.id,
    "langextract.candidate_count": candidateCount,
    "langextract.annotation_count": HashMap.size(document.annotations),
    "langextract.residual_count": residual.length,
  });
  return ExtractionHandoff.make({
    document,
    activity: input.activity,
    candidateCount,
    readings,
    residual,
  });
});
