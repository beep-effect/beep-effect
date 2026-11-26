import { Confidence, ReportedConfidence } from "@beep/epistemics/Confidence";
import { ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { AlignmentSource, alignCandidate } from "@beep/langextract/Alignment";
import { ExtractionCandidate, LangExtractOptions, LangExtractRequest } from "@beep/langextract/Extraction";
import {
  allowRemoteExtractionPolicyLayer,
  buildPrompt,
  LangExtractGenerationTimeout,
  LangExtractService,
  layer as LangExtractServiceLive,
} from "@beep/langextract/Service";
import { ExtractionExample, ExtractionExampleItem, ExtractionTarget, TargetAnnotation } from "@beep/langextract/Target";
import { NLPService } from "@beep/nlp-processing/NLPService";
import { Sha256HexFromBytes } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { TextAnchor } from "@beep/text";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LabConfig } from "@/runtime/Config";
import { contentDigest, sha256CanonicalSync } from "@/schema/Digest";
import {
  ClaimBody,
  DegradedClaim,
  declaredLosses,
  EvidenceBatch,
  EvidenceClaim,
  ExtractOutcome,
  FrozenRelationPredicate,
  makeBatchId,
  makeClaimId,
  RelationExtractionCandidate,
  StructureRole,
} from "@/schema/Evidence";
import { DocumentId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";
import { ProviderCacheKey } from "@/schema/ProviderCache";
import { Canonicalizer } from "@/services/Canonicalizer";
import { HostedExtractor, PatternExtractor } from "@/services/Extractor";
import { ActiveModelIdentity } from "@/services/LanguageModel";
import type { LangExtractError } from "@beep/langextract/Extraction";
import type { ExtractionHandoff, ExtractionReading, ResidualCandidate } from "@beep/langextract/Handoff";
import type { EntityNode } from "@beep/nlp-processing/Graph/Schema";
import type { Sha256Hex } from "@beep/schema";
import type {
  EvidenceClaim as EvidenceClaimValue,
  ExtractionMethod,
  ExtractOutcome as ExtractOutcomeValue,
  LossDeclaration,
} from "@/schema/Evidence";
import type { CanonicalText, Chunk } from "@/schema/Text";
import type { CanonicalizerShape } from "@/services/Canonicalizer";

const decodeUnknownRelationExtractionCandidateResult = S.decodeUnknownResult(RelationExtractionCandidate);

const isNatural = S.is(S.Natural);

const utf8Encoder = new TextEncoder();

const RELATION_CONTRACT_SCHEMA = "semantica-relation-evidence/v1";
const RELATION_ENDPOINT_POLICY = "evidence-scoped-unique/v1";
const RELATION_ALIGNMENT_TIERS = ["match_exact", "match_lesser", "match_minimal_fold"] as const;

const relationTerms = {
  "affiliated with": TermIri.make(iri("semantica:affiliatedWith")),
  "authored by": TermIri.make(iri("semantica:authoredBy")),
  "located in": TermIri.make(iri("semantica:locatedIn")),
  "re-evaluates claim due to": TermIri.make(iri("semantica:reEvaluatesClaimDueTo")),
  selected: TermIri.make(iri("semantica:selected")),
  shows: TermIri.make(iri("semantica:shows")),
};
const mentionTerms = {
  person: TermIri.make(iri("semantica:person")),
  organization: TermIri.make(iri("semantica:organization")),
  method: TermIri.make(iri("semantica:method")),
  title: TermIri.make(iri("semantica:title")),
  abstract: TermIri.make(iri("semantica:abstract")),
  section: TermIri.make(iri("semantica:section")),
  reference: TermIri.make(iri("semantica:reference")),
};
const HOSTED_TARGETS: A.NonEmptyReadonlyArray<ExtractionTarget> = [
  ExtractionTarget.make({
    kind: "entity",
    name: "person",
    annotates: TargetAnnotation.cases.Mention.make({ class: mentionTerms.person, coreference: O.some("cluster") }),
    attributes: ["cluster"],
    description: O.some("A named person. Reuse cluster for coreferring mentions; use a distinct cluster otherwise."),
  }),
  ExtractionTarget.make({
    kind: "entity",
    name: "organization",
    annotates: TargetAnnotation.cases.Mention.make({
      class: mentionTerms.organization,
      coreference: O.some("cluster"),
    }),
    attributes: ["cluster"],
    description: O.some(
      "A named organization. Reuse cluster for coreferring mentions; use a distinct cluster otherwise."
    ),
  }),
  ExtractionTarget.make({
    kind: "entity",
    name: "method",
    annotates: TargetAnnotation.cases.Mention.make({ class: mentionTerms.method, coreference: O.some("cluster") }),
    attributes: ["cluster"],
    description: O.some(
      "A named research method or system. Reuse cluster for coreferring mentions; use a distinct cluster otherwise."
    ),
  }),
  ExtractionTarget.make({
    annotates: TargetAnnotation.cases.Mention.make({ class: mentionTerms.title }),
    kind: "custom",
    name: "title",
    attributes: ["depth"],
  }),
  ExtractionTarget.make({
    annotates: TargetAnnotation.cases.Mention.make({ class: mentionTerms.abstract }),
    kind: "custom",
    name: "abstract",
    attributes: ["depth"],
  }),
  ExtractionTarget.make({
    annotates: TargetAnnotation.cases.Mention.make({ class: mentionTerms.section }),
    kind: "custom",
    name: "section",
    attributes: ["depth"],
  }),
  ExtractionTarget.make({
    annotates: TargetAnnotation.cases.Mention.make({ class: mentionTerms.reference }),
    kind: "custom",
    name: "reference",
    attributes: ["depth"],
  }),
  ExtractionTarget.make({
    kind: "relation",
    name: "relation",
    annotates: TargetAnnotation.cases.Relation.make({
      subject: "subject",
      object: "object",
      predicate: "predicate",
      predicates: relationTerms,
      endpoint: TermIri.make(iri("semantica:relation-endpoint")),
    }),
    attributes: ["predicate", "subject", "object"],
    description: O.some(
      `A relation explicitly stated in the source. Copy one verbatim contiguous source span as the extraction text; never paraphrase or synthesize it. Copy subject and object as exact entity surface strings from that span. Predicate must be exactly one of: ${A.join(FrozenRelationPredicate.literals, ", ")}.`
    ),
  }),
];

const HOSTED_EXAMPLES = [
  ExtractionExample.make({
    text: "Ada Lovelace is affiliated with the Analytical Engine group.",
    extractions: [
      ExtractionExampleItem.make({
        label: "person",
        text: "Ada Lovelace",
        attributes: O.some({ cluster: "person-ada-lovelace" }),
      }),
      ExtractionExampleItem.make({
        label: "organization",
        text: "Analytical Engine group",
        attributes: O.some({ cluster: "organization-analytical-engine" }),
      }),
      ExtractionExampleItem.make({
        label: "relation",
        text: "Ada Lovelace is affiliated with the Analytical Engine group.",
        attributes: O.some({
          object: "Analytical Engine group",
          predicate: "affiliated with",
          subject: "Ada Lovelace",
        }),
      }),
    ],
  }),
  ExtractionExample.make({
    text: "Abstract\nThis study evaluates grounded extraction.",
    extractions: [
      ExtractionExampleItem.make({ label: "abstract", text: "Abstract", attributes: O.some({ depth: "0" }) }),
    ],
  }),
];

const HOSTED_ARTIFACT_REQUEST = LangExtractRequest.make({
  source: SourceTextIdentity.make({
    scopeRef: "semantica-hosted-artifact",
    sourceRef: "semantica-hosted-artifact",
    locator: SourceTextLocator.make("artifact.txt"),
    sourceDigest: SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
    textDigest: SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "raw/1",
  }),
  examples: HOSTED_EXAMPLES,
  targets: HOSTED_TARGETS,
  text: Str.empty,
});

const HostedExtractionCandidateDescriptor = S.Struct({
  alignmentTiers: S.Tuple([S.Literal("match_exact"), S.Literal("match_lesser"), S.Literal("match_minimal_fold")]),
  endpointPolicy: S.tag(RELATION_ENDPOINT_POLICY),
  relationContract: S.tag(RELATION_CONTRACT_SCHEMA),
  renderedPrompt: S.String,
  schemaVersion: S.tag("semantica-hosted-extraction-candidate/v1"),
});

/**
 * Hash of the versioned hosted extraction candidate descriptor.
 *
 * **Details**
 *
 * The descriptor binds the rendered prompt, relation-contract identifier,
 * accepted relation alignment tiers, and endpoint policy so a semantic
 * candidate revision cannot reuse an earlier model identity.
 *
 * **Example** (Inspect the artifact digest)
 *
 * ```ts
 * import { HOSTED_EXTRACTION_ARTIFACT_HASH } from "@/layers/ExtractorLive"
 * import * as Effect from "effect/Effect";
 * Effect.runPromise(HOSTED_EXTRACTION_ARTIFACT_HASH).then((hash) => console.log(hash.length)) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HOSTED_EXTRACTION_ARTIFACT_HASH = buildPrompt(HOSTED_ARTIFACT_REQUEST).pipe(
  Effect.flatMap((renderedPrompt) =>
    contentDigest(HostedExtractionCandidateDescriptor)({
      alignmentTiers: RELATION_ALIGNMENT_TIERS,
      endpointPolicy: RELATION_ENDPOINT_POLICY,
      relationContract: RELATION_CONTRACT_SCHEMA,
      renderedPrompt,
      schemaVersion: "semantica-hosted-extraction-candidate/v1",
    })
  ),
  Effect.orDie
);

/**
 * Pinned local pattern identity and method table.
 *
 * **Example** (Inspect the provider)
 *
 * ```ts
 * import { PATTERN_MODEL_IDENTITY } from "@/layers/ExtractorLive"
 *
 * console.log(PATTERN_MODEL_IDENTITY.provider) // "wink"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PATTERN_MODEL_IDENTITY = ModelIdentity.make({
  artifactHash: sha256CanonicalSync({
    backend: "wink-nlp",
    losses: A.sort(
      A.fromIterable(HashMap.get(declaredLosses, "pattern-wink").pipe(O.getOrElse(A.empty))),
      Order.String
    ),
    schemaVersion: "semantica-pattern-extraction/v1",
  }),
  name: "wink-nlp",
  provider: "wink",
  revision: "0.0.0",
  taskType: "extraction",
});

const documentIdOf = (canonical: CanonicalText): DocumentId => DocumentId.make(canonical.identity.sourceRef);

const containingChunk = (chunks: A.NonEmptyReadonlyArray<Chunk>, anchor: TextAnchor): Chunk =>
  A.findFirst(
    chunks,
    (chunk) => chunk.anchor.startChar <= anchor.startChar && chunk.anchor.endChar >= anchor.endChar
  ).pipe(
    O.orElse(() =>
      A.findFirst(
        chunks,
        (chunk) => chunk.anchor.startChar <= anchor.startChar && chunk.anchor.endChar > anchor.startChar
      )
    ),
    O.getOrElse(() => A.headNonEmpty(chunks))
  );

const hostedProducer = (model: ModelIdentity): ActivityPin =>
  ActivityPin.cases.Model.make({ model: model.name, version: model.revision });

const patternProducer = (model: ModelIdentity): ActivityPin =>
  ActivityPin.cases.Engine.make({ engine: model.name, edition: model.revision });

const evidenceConfidence =
  (method: ExtractionMethod, producer: ActivityPin) =>
  (confidence: O.Option<number>): ExtractorConfidence =>
    O.match(confidence, {
      onNone: () => ExtractorConfidence.cases.Absent.make({ reason: "not-assessed" }),
      onSome: (value) =>
        ExtractorConfidence.cases.Present.make({
          value: ReportedConfidence.make({ value: Confidence.make(value), method, producer: O.some(producer) }),
        }),
    });

const hostedConfidence = (model: ModelIdentity) => evidenceConfidence("hosted-langextract", hostedProducer(model));

const makeClaim = Effect.fn("Extractor.makeClaim")(function* (
  canonicalizer: CanonicalizerShape,
  canonical: CanonicalText,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  body: ClaimBody,
  confidence: ExtractorConfidence,
  method: "hosted-langextract" | "pattern-wink",
  model: ModelIdentity,
  cacheKey: O.Option<Sha256Hex>
) {
  const anchor = TextAnchor.make(body);
  const receipt = yield* canonicalizer.verify(canonical, anchor);
  const chunk = containingChunk(chunks, anchor);
  const source = {
    body,
    chunk: chunk.id,
    document: documentIdOf(canonical),
    method,
    model,
  };
  const id = yield* Effect.fromResult(makeClaimId(source)).pipe(Effect.orDie);
  return EvidenceClaim.make({ ...source, cacheKey, confidence, id, receipt });
});

const makeBatch = (
  document: DocumentId,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  method: "hosted-langextract" | "pattern-wink",
  model: ModelIdentity,
  claims: ReadonlyArray<EvidenceClaimValue>,
  degraded: ReadonlyArray<DegradedClaim>
): ExtractOutcomeValue => {
  const inputs = A.map(chunks, (chunk) => chunk.id);
  const source = { document, inputs, method, model };
  const id = Result.getOrThrow(makeBatchId(source));
  return ExtractOutcome.cases.Extracted.make({
    batch: EvidenceBatch.make({
      ...source,
      claims: A.dedupeWith(claims, (left, right) => Str.Equivalence(left.id, right.id)),
      degraded,
      id,
      lossy: A.sort(
        A.fromIterable(HashMap.get(declaredLosses, method).pipe(O.getOrElse(A.empty<LossDeclaration>))),
        Order.String
      ),
    }),
    outcome: "Extracted",
  });
};

const degradedOutcome = (
  document: DocumentId,
  lane: "hosted" | "pattern",
  kind: "extraction-failed" | "provider-unavailable" | "model-output-invalid" | "fabricated-span",
  detail: string
): ExtractOutcomeValue => ExtractOutcome.cases.Degraded.make({ detail, document, kind, lane, outcome: "Degraded" });

const langExtractDegradedKind = (error: LangExtractError): "provider-unavailable" | "model-output-invalid" =>
  error.reason === "model-generation-failed" ||
  error.reason === "model-generation-timeout" ||
  error.reason === "remote-policy-denied"
    ? "provider-unavailable"
    : "model-output-invalid";

/**
 * Builds the exact hosted LangExtract request for one canonical document.
 *
 * **Example** (Inspect the request builder)
 *
 * ```ts
 * import { makeHostedExtractionRequest } from "@/layers/ExtractorLive"
 *
 * console.log(typeof makeHostedExtractionRequest) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeHostedExtractionRequest = (canonical: CanonicalText): LangExtractRequest =>
  LangExtractRequest.make({
    source: canonical.identity,
    examples: HOSTED_EXAMPLES,
    options: LangExtractOptions.make({ fuzzyThreshold: UnitInterval.makeOption(1) }),
    targets: HOSTED_TARGETS,
    text: canonical.text,
  });

const hostedCacheKey = Effect.fn("Extractor.hostedCacheKey")(function* (
  request: LangExtractRequest,
  model: ModelIdentity
) {
  const prompt = yield* buildPrompt(request);
  const inputDigest = yield* S.decodeEffect(Sha256HexFromBytes)(utf8Encoder.encode(prompt));
  return yield* contentDigest(ProviderCacheKey)(
    ProviderCacheKey.make({ inputDigest, model, requestKind: "generate-text", schemaVersion: "provider-cache/v1" })
  );
});

const isStructureRole = S.is(StructureRole);

const structureDepth = (extraction: ExtractionReading | ResidualCandidate): number =>
  extraction.attributes.pipe(
    O.flatMap((attributes) => R.get(attributes, "depth")),
    O.flatMap(N.parse),
    O.filter(isNatural),
    O.map(S.Natural.make),
    O.getOrElse(() => S.Natural.make(0))
  );

const extractionAttribute = (extraction: ExtractionReading | ResidualCandidate, name: string): O.Option<string> =>
  extraction.attributes.pipe(
    O.flatMap((attributes) => R.get(attributes, name)),
    O.filter(Str.isNonEmpty)
  );

const nonRelationBody = (extraction: ExtractionReading | ResidualCandidate, anchor: TextAnchor): ClaimBody =>
  isStructureRole(extraction.label)
    ? ClaimBody.cases.Structure.make({
        ...anchor,
        depth: structureDepth(extraction),
        kind: "Structure",
        role: extraction.label,
      })
    : ClaimBody.cases.Entity.make({
        ...anchor,
        cluster: extractionAttribute(extraction, "cluster"),
        entityType: extraction.label,
        kind: "Entity",
        label: anchor.quote,
      });

const entityAnchorOf = (claim: EvidenceClaimValue): O.Option<TextAnchor> =>
  ClaimBody.match(claim.body, {
    Entity: (body) => TextAnchor.makeOption(body),
    Relation: O.none<TextAnchor>,
    Structure: O.none<TextAnchor>,
  });

const decodeRelationCandidate = (
  extraction: ExtractionReading | ResidualCandidate
): Result.Result<RelationExtractionCandidate, S.SchemaError> =>
  decodeUnknownRelationExtractionCandidateResult({
    evidenceQuote: extraction.text,
    object: O.getOrUndefined(extractionAttribute(extraction, "object")),
    predicate: O.getOrUndefined(extractionAttribute(extraction, "predicate")),
    subject: O.getOrUndefined(extractionAttribute(extraction, "subject")),
  });

const replayPreVocabularyE5RelationEndpoints = (
  candidate: ResidualCandidate
): O.Option<readonly [TextAnchor, TextAnchor, string]> => {
  if (candidate.reason !== "unmapped-predicate" || O.isNone(candidate.anchor)) return O.none();
  const decoded = decodeRelationCandidate(candidate);
  if (Result.isFailure(decoded)) return O.none();
  const evidence = candidate.anchor.value;
  const locate = (surface: string): O.Option<TextAnchor> => {
    const endpoint = ExtractionCandidate.make({ label: "relation-endpoint", text: surface });
    const aligned = alignCandidate(
      endpoint,
      AlignmentSource.make({ fuzzyThreshold: UnitInterval.make(1), sourceText: evidence.quote })
    );
    if (aligned.alignmentStatus === "unaligned" || aligned.alignmentStatus === "match_fuzzy") return O.none();
    return TextAnchor.makeOption({
      startChar: S.Natural.make(evidence.startChar + aligned.anchor.startChar),
      endChar: S.Natural.make(evidence.startChar + aligned.anchor.endChar),
      quote: aligned.anchor.quote,
    });
  };
  return O.map(
    O.all([locate(decoded.success.subject), locate(decoded.success.object)]),
    ([subject, object]) => [subject, object, decoded.success.predicate] as const
  );
};

const exactAnchoredEntity = (
  claims: ReadonlyArray<EvidenceClaimValue>,
  anchor: TextAnchor
): O.Option<EvidenceClaimValue> =>
  A.findFirst(claims, (claim) =>
    entityAnchorOf(claim).pipe(O.exists((body) => S.toEquivalence(TextAnchor)(body, anchor)))
  );

const relationDegradation = (
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  anchor: O.Option<TextAnchor>,
  kind: "fabricated-span" | "model-output-invalid" | "relation-unresolved",
  detail: string
): DegradedClaim =>
  DegradedClaim.make({
    chunk: anchor.pipe(
      O.map((value) => containingChunk(chunks, value).id),
      O.getOrElse(() => A.headNonEmpty(chunks).id)
    ),
    detail,
    kind,
  });

const endpointClaim = Effect.fn("Extractor.endpointClaim")(function* (
  canonicalizer: CanonicalizerShape,
  canonical: CanonicalText,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  baseClaims: ReadonlyArray<EvidenceClaimValue>,
  anchor: TextAnchor,
  confidence: ExtractorConfidence,
  model: ModelIdentity,
  cacheKey: O.Option<Sha256Hex>
) {
  const existing = exactAnchoredEntity(baseClaims, anchor);
  if (O.isSome(existing)) {
    return existing.value;
  }
  return yield* makeClaim(
    canonicalizer,
    canonical,
    chunks,
    ClaimBody.cases.Entity.make({
      ...anchor,
      cluster: O.none(),
      entityType: "relation-endpoint",
      kind: "Entity",
      label: anchor.quote,
    }),
    confidence,
    "hosted-langextract",
    model,
    cacheKey
  );
});

const groundRelation = Effect.fn("Extractor.groundRelation")(function* (
  canonicalizer: CanonicalizerShape,
  canonical: CanonicalText,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  baseClaims: ReadonlyArray<EvidenceClaimValue>,
  extraction: ExtractionReading | ResidualCandidate,
  evidence: O.Option<TextAnchor>,
  endpoints: O.Option<readonly [TextAnchor, TextAnchor, string]>,
  model: ModelIdentity,
  cacheKey: O.Option<Sha256Hex>
) {
  const decoded = decodeRelationCandidate(extraction);
  if (Result.isFailure(decoded)) {
    return Result.fail(
      relationDegradation(
        chunks,
        O.none(),
        "model-output-invalid",
        "A relation candidate did not decode subject, object, predicate, and evidence quote."
      )
    );
  }
  if (extraction.alignment === "unaligned" || extraction.alignment === "match_fuzzy" || O.isNone(evidence)) {
    return Result.fail(
      relationDegradation(
        chunks,
        O.none(),
        "fabricated-span",
        "Relation evidence did not align uniquely through the exact, lesser, or minimal-fold tiers."
      )
    );
  }
  if (O.isNone(endpoints)) {
    return Result.fail(
      relationDegradation(
        chunks,
        evidence,
        "relation-unresolved",
        "A relation endpoint did not align uniquely inside its evidence quote."
      )
    );
  }
  const confidence = hostedConfidence(model)(extraction.confidence);
  const subject = yield* endpointClaim(
    canonicalizer,
    canonical,
    chunks,
    baseClaims,
    endpoints.value[0],
    confidence,
    model,
    cacheKey
  );
  const object = yield* endpointClaim(
    canonicalizer,
    canonical,
    chunks,
    baseClaims,
    endpoints.value[1],
    confidence,
    model,
    cacheKey
  );
  const relation = yield* makeClaim(
    canonicalizer,
    canonical,
    chunks,
    ClaimBody.cases.Relation.make({
      ...evidence.value,
      kind: "Relation",
      object: object.id,
      predicate: endpoints.value[2],
      subject: subject.id,
    }),
    confidence,
    "hosted-langextract",
    model,
    cacheKey
  );
  return Result.succeed([subject, object, relation] as const);
});

const unalignedExtraction = (chunks: A.NonEmptyReadonlyArray<Chunk>): DegradedClaim =>
  DegradedClaim.make({
    chunk: A.headNonEmpty(chunks).id,
    detail: "LangExtract did not align this candidate to the canonical text.",
    kind: "fabricated-span",
  });

/**
 * Grounds already-aligned hosted candidates through the production evidence
 * contract.
 *
 * **Details**
 *
 * The live extractor and E5 cache preview both call this function. Sharing the
 * boundary prevents the preview from passing through a second implementation
 * of relation-contract decoding or evidence-scoped endpoint grounding.
 *
 * **Example** (Inspect the grounding boundary)
 *
 * ```ts
 * import { groundHostedHandoff } from "@/layers/ExtractorLive"
 *
 * console.log(typeof groundHostedHandoff) // "function"
 * ```
 *
 * @internal
 * @category mapping
 * @since 0.0.0
 */
export const groundHostedHandoff = Effect.fn("Extractor.groundHostedHandoff")(function* (
  canonicalizer: CanonicalizerShape,
  canonical: CanonicalText,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  handoff: ExtractionHandoff,
  model: ModelIdentity,
  cacheKey: O.Option<Sha256Hex>
) {
  const anchorOf = (
    annotation: ExtractionHandoff["document"]["annotations"] extends HashMap.HashMap<infer _K, infer V> ? V : never
  ) =>
    HashMap.getUnsafe(handoff.document.anchors, annotation.targets.pipe(A.fromIterable, A.head, O.getOrThrow)).receipt
      .anchor;
  const entries = A.sort(
    A.flatMap(HashMap.toEntries(handoff.readings), ([id, readings]) =>
      A.map(readings, (reading) => ({ reading, annotation: HashMap.getUnsafe(handoff.document.annotations, id) }))
    ),
    Order.mapInput(
      Order.Number,
      (row: { readonly reading: ExtractionReading | ResidualCandidate }) => row.reading.candidate
    )
  );
  const nonRelations = A.sort(
    A.appendAll(
      A.filterMap(entries, (entry) => {
        if (entry.annotation._tag !== "Mention") return Result.failVoid;
        const mentionClass = entry.annotation.body.class;
        const term = O.getOrThrow(A.findFirst(R.toEntries(mentionTerms), (pair) => pair[1] === mentionClass));
        return Result.succeed({
          reading: { ...entry.reading, label: term[0] },
          anchor: O.some(anchorOf(entry.annotation)),
        });
      }),
      A.map(
        A.filter(handoff.residual, (candidate) => candidate.label !== "relation"),
        (candidate) => ({
          reading: candidate,
          anchor: candidate.reason === "unmapped-label" ? candidate.anchor : O.none<TextAnchor>(),
        })
      )
    ),
    Order.mapInput(
      Order.Number,
      (row: { readonly reading: ExtractionReading | ResidualCandidate }) => row.reading.candidate
    )
  );
  const baseClaims = yield* Effect.forEach(
    A.filterMap(nonRelations, (row) =>
      O.match(row.anchor, {
        onNone: () => Result.failVoid,
        onSome: (anchor) => Result.succeed({ reading: row.reading, anchor }),
      })
    ),
    (row) =>
      makeClaim(
        canonicalizer,
        canonical,
        chunks,
        nonRelationBody(row.reading, row.anchor),
        hostedConfidence(model)(row.reading.confidence),
        "hosted-langextract",
        model,
        cacheKey
      ),
    { concurrency: 1 }
  );
  const unaligned = A.map(
    A.filter(nonRelations, (row) => O.isNone(row.anchor)),
    () => unalignedExtraction(chunks)
  );
  const relationRows = A.sort(
    A.appendAll(
      A.filterMap(entries, (entry) => {
        if (entry.annotation._tag !== "RelationCandidate") return Result.failVoid;
        const body = entry.annotation.body;
        const subject = HashMap.getUnsafe(handoff.document.annotations, body.subject);
        const object = HashMap.getUnsafe(handoff.document.annotations, body.object);
        const predicate = A.findFirst(R.toEntries(relationTerms), (pair) => pair[1] === body.predicate);
        const endpoints = O.map(predicate, (pair) => [anchorOf(subject), anchorOf(object), pair[0]] as const);
        return Result.succeed({ reading: entry.reading, anchor: O.some(anchorOf(entry.annotation)), endpoints });
      }),
      A.map(
        A.filter(handoff.residual, (candidate) => candidate.label === "relation"),
        (candidate) => ({
          reading: candidate,
          anchor: candidate.anchor,
          endpoints: replayPreVocabularyE5RelationEndpoints(candidate),
        })
      )
    ),
    Order.mapInput(
      Order.Number,
      (row: { readonly reading: ExtractionReading | ResidualCandidate }) => row.reading.candidate
    )
  );
  const relations = yield* Effect.forEach(
    relationRows,
    (row) =>
      groundRelation(
        canonicalizer,
        canonical,
        chunks,
        baseClaims,
        row.reading,
        row.anchor,
        row.endpoints,
        model,
        cacheKey
      ),
    { concurrency: 1 }
  );
  return makeBatch(
    documentIdOf(canonical),
    chunks,
    "hosted-langextract",
    model,
    A.appendAll(baseClaims, A.flatten(A.getSuccesses(relations))),
    A.appendAll(unaligned, A.getFailures(relations))
  );
});

const makeHostedExtractor = Effect.gen(function* () {
  const canonicalizer = yield* Canonicalizer;
  const langExtract = yield* LangExtractService;
  const model = yield* ActiveModelIdentity;

  return HostedExtractor.of({
    extract: Effect.fn("HostedExtractor.extract")(function* (canonical, chunks) {
      const document = documentIdOf(canonical);
      const request = makeHostedExtractionRequest(canonical);
      const extracted = yield* langExtract.extract(request).pipe(Effect.result);
      if (Result.isFailure(extracted)) {
        return degradedOutcome(
          document,
          "hosted",
          langExtractDegradedKind(extracted.failure),
          "The hosted extraction boundary did not produce a valid grounded result."
        );
      }

      const pipe1 = yield* hostedCacheKey(request, model).pipe(Effect.orDie);
      const cacheKey = O.some(pipe1);
      return yield* groundHostedHandoff(canonicalizer, canonical, chunks, extracted.success.handoff, model, cacheKey);
    }),
  });
});

const fabricatedSpan = (chunks: A.NonEmptyReadonlyArray<Chunk>): DegradedClaim =>
  DegradedClaim.make({
    chunk: A.headNonEmpty(chunks).id,
    detail: "Wink returned an absent, empty, non-UTF-16, or width-mismatched entity span.",
    kind: "fabricated-span",
  });

const patternQuoteMatches = (start: number, end: number, quote: string, entity: EntityNode): boolean =>
  Str.isNonEmpty(entity.text) &&
  N.Equivalence(N.subtract(end, start), Str.length(entity.text)) &&
  Str.Equivalence(quote, entity.text);

const verifiedPatternSpan = (canonical: CanonicalText, entity: EntityNode) => {
  if (O.isNone(entity.span) || entity.span.value.unit !== "utf16-code-unit") {
    return O.none();
  }
  const start = entity.span.value.start;
  const end = entity.span.value.end;
  const quote = Str.slice(start, end)(canonical.text);
  if (!patternQuoteMatches(start, end, quote, entity)) {
    return O.none();
  }
  return O.some({ start, end, quote });
};

const patternClaim = Effect.fn("PatternExtractor.patternClaim")(function* (
  canonicalizer: CanonicalizerShape,
  canonical: CanonicalText,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  entity: EntityNode
) {
  const span = verifiedPatternSpan(canonical, entity);
  if (O.isNone(span)) return Result.fail(fabricatedSpan(chunks));
  const { start, end, quote } = span.value;
  const body = ClaimBody.cases.Entity.make({
    cluster: O.none(),
    endChar: S.Natural.make(end),
    entityType: Str.isNonEmpty(entity.entityType) ? entity.entityType : "UNKNOWN",
    kind: "Entity",
    label: quote,
    quote,
    startChar: S.Natural.make(start),
  });
  const madeClaim = yield* makeClaim(
    canonicalizer,
    canonical,
    chunks,
    body,
    evidenceConfidence("pattern-wink", patternProducer(PATTERN_MODEL_IDENTITY))(O.fromUndefinedOr(entity.confidence)),
    "pattern-wink",
    PATTERN_MODEL_IDENTITY,
    O.none()
  );
  return Result.succeed(madeClaim);
});

const makePatternExtractor = Effect.gen(function* () {
  const canonicalizer = yield* Canonicalizer;
  const nlp = yield* NLPService;

  return PatternExtractor.of({
    extract: Effect.fn("PatternExtractor.extract")(function* (canonical, chunks) {
      const document = documentIdOf(canonical);
      const extracted = yield* nlp.extractEntities(canonical.text).pipe(Effect.result);
      if (Result.isFailure(extracted)) {
        return degradedOutcome(document, "pattern", "extraction-failed", "The Wink entity extraction boundary failed.");
      }
      const claims = yield* Effect.forEach(
        extracted.success,
        (entity) => patternClaim(canonicalizer, canonical, chunks, entity),
        {
          concurrency: 1,
        }
      );
      return makeBatch(
        document,
        chunks,
        "pattern-wink",
        PATTERN_MODEL_IDENTITY,
        A.getSuccesses(claims),
        A.getFailures(claims)
      );
    }),
  });
});

/**
 * Hosted extractor implementation over an injected LangExtract service and
 * active model identity.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { HostedExtractorLive } from "@/layers/ExtractorLive"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(HostedExtractorLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HostedExtractorLive = Layer.effect(HostedExtractor, makeHostedExtractor);

/**
 * Hosted extractor plus the real LangExtract service and explicit remote
 * policy. The language model remains injected at the outer boundary.
 *
 * **Example** (Inspect the composed layer)
 *
 * ```ts
 * import { HostedLangExtractLive } from "@/layers/ExtractorLive"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(HostedLangExtractLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
const extractionTimeoutLayer = Layer.effect(
  LangExtractGenerationTimeout,
  LabConfig.pipe(Effect.map((config) => config.extractionTimeout))
);

export const HostedLangExtractLive = HostedExtractorLive.pipe(
  Layer.provide(
    LangExtractServiceLive.pipe(Layer.provide(Layer.merge(allowRemoteExtractionPolicyLayer, extractionTimeoutLayer)))
  )
);

/**
 * Pattern extractor implementation over an injected NLP service.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { PatternExtractorLive } from "@/layers/ExtractorLive"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(PatternExtractorLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PatternExtractorLive = Layer.effect(PatternExtractor, makePatternExtractor);
