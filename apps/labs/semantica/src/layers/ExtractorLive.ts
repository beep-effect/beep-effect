import { Confidence } from "@beep/epistemic-domain";
import { AlignmentSource, alignCandidate } from "@beep/langextract/Alignment";
import {
  ExtractionCandidate,
  GroundedExtraction,
  LangExtractOptions,
  LangExtractRequest,
} from "@beep/langextract/Extraction";
import {
  allowRemoteExtractionPolicyLayer,
  buildPrompt,
  LangExtractGenerationTimeout,
  LangExtractService,
  layer as LangExtractServiceLive,
} from "@beep/langextract/Service";
import { ExtractionExample, ExtractionExampleItem, ExtractionTarget } from "@beep/langextract/Target";
import { DocumentId as NlpDocumentId } from "@beep/nlp/Core";
import { UnitInterval } from "@beep/nlp/Handoff";
import { NLPService } from "@beep/nlp-processing/NLPService";
import { TextAnchor } from "@beep/provenance";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { Effect, HashMap, Layer, Number as N, Order, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
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
import type { EntityNode } from "@beep/nlp/Graph/Schema";
import type { Sha256Hex } from "@beep/schema";
import type {
  EvidenceClaim as EvidenceClaimValue,
  ExtractOutcome as ExtractOutcomeValue,
  LossDeclaration,
} from "@/schema/Evidence";
import type { CanonicalText, Chunk } from "@/schema/Text";
import type { CanonicalizerShape } from "@/services/Canonicalizer";

const utf8Encoder = new TextEncoder();

const RELATION_CONTRACT_SCHEMA = "semantica-relation-evidence/v1";
const RELATION_ENDPOINT_POLICY = "evidence-scoped-unique/v1";
const RELATION_ALIGNMENT_TIERS = ["match_exact", "match_lesser", "match_minimal_fold"] as const;

const HOSTED_TARGETS: A.NonEmptyReadonlyArray<ExtractionTarget> = [
  ExtractionTarget.make({
    kind: "entity",
    name: "person",
    attributes: ["cluster"],
    description: O.some("A named person. Reuse cluster for coreferring mentions; use a distinct cluster otherwise."),
  }),
  ExtractionTarget.make({
    kind: "entity",
    name: "organization",
    attributes: ["cluster"],
    description: O.some(
      "A named organization. Reuse cluster for coreferring mentions; use a distinct cluster otherwise."
    ),
  }),
  ExtractionTarget.make({
    kind: "entity",
    name: "method",
    attributes: ["cluster"],
    description: O.some(
      "A named research method or system. Reuse cluster for coreferring mentions; use a distinct cluster otherwise."
    ),
  }),
  ExtractionTarget.make({ kind: "custom", name: "title", attributes: ["depth"] }),
  ExtractionTarget.make({ kind: "custom", name: "abstract", attributes: ["depth"] }),
  ExtractionTarget.make({ kind: "custom", name: "section", attributes: ["depth"] }),
  ExtractionTarget.make({ kind: "custom", name: "reference", attributes: ["depth"] }),
  ExtractionTarget.make({
    kind: "relation",
    name: "relation",
    attributes: ["predicate", "subject", "object"],
    description: O.some(
      `A relation explicitly stated in the source. Copy one verbatim contiguous source span as the extraction text; never paraphrase or synthesize it. Copy subject and object as exact entity surface strings from that span. Predicate must be exactly one of: ${A.join(FrozenRelationPredicate.Options, ", ")}.`
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
  documentId: NlpDocumentId.make("semantica-hosted-artifact"),
  examples: HOSTED_EXAMPLES,
  targets: HOSTED_TARGETS,
  text: Str.empty,
});

const HostedExtractionCandidateDescriptor = S.Struct({
  alignmentTiers: S.Tuple([S.Literal("match_exact"), S.Literal("match_lesser"), S.Literal("match_minimal_fold")]),
  endpointPolicy: S.Literal(RELATION_ENDPOINT_POLICY),
  relationContract: S.Literal(RELATION_CONTRACT_SCHEMA),
  renderedPrompt: S.String,
  schemaVersion: S.Literal("semantica-hosted-extraction-candidate/v1"),
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
 * import { Effect } from "effect"
 *
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
      A.fromIterable(HashMap.get(declaredLosses, "pattern-wink").pipe(O.getOrElse(() => []))),
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

const evidenceConfidence = (confidence: O.Option<number>): Confidence =>
  Confidence.make(confidence.pipe(O.getOrElse(() => 1)));

const makeClaim = Effect.fn("Extractor.makeClaim")(function* (
  canonicalizer: CanonicalizerShape,
  canonical: CanonicalText,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  body: ClaimBody,
  confidence: Confidence,
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
        A.fromIterable(
          HashMap.get(declaredLosses, method).pipe(O.getOrElse(() => [] as ReadonlyArray<LossDeclaration>))
        ),
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
    documentId: NlpDocumentId.make(canonical.identity.sourceRef),
    examples: HOSTED_EXAMPLES,
    options: LangExtractOptions.make({ fuzzyThreshold: O.some(UnitInterval.make(1)) }),
    targets: HOSTED_TARGETS,
    text: canonical.text,
  });

const hostedCacheKey = Effect.fn("Extractor.hostedCacheKey")(function* (
  request: LangExtractRequest,
  model: ModelIdentity
) {
  const prompt = yield* buildPrompt(request);
  const inputDigest = yield* Sha256HexFromBytes.decodeEffect(utf8Encoder.encode(prompt));
  return yield* contentDigest(ProviderCacheKey)(
    ProviderCacheKey.make({ inputDigest, model, requestKind: "generate-text", schemaVersion: "provider-cache/v1" })
  );
});

const isStructureRole = S.is(StructureRole);

const structureDepth = (extraction: GroundedExtraction): NonNegativeInt =>
  extraction.attributes.pipe(
    O.flatMap((attributes) => R.get(attributes, "depth")),
    O.flatMap(N.parse),
    O.filter(NonNegativeInt.is),
    O.map(NonNegativeInt.make),
    O.getOrElse(() => NonNegativeInt.make(0))
  );

const extractionAttribute = (extraction: GroundedExtraction, name: string): O.Option<string> =>
  extraction.attributes.pipe(
    O.flatMap((attributes) => R.get(attributes, name)),
    O.filter(Str.isNonEmpty)
  );

const nonRelationBody = (extraction: GroundedExtraction, anchor: TextAnchor): ClaimBody =>
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
    Entity: (body) => O.some(TextAnchor.make(body)),
    Relation: O.none<TextAnchor>,
    Structure: O.none<TextAnchor>,
  });

type AlignedGroundedExtraction = Exclude<GroundedExtraction, { readonly alignmentStatus: "unaligned" }>;
type LocatedExtraction = readonly [extraction: GroundedExtraction, anchor: TextAnchor];

const alignedExtraction = (extraction: AlignedGroundedExtraction): Result.Result<LocatedExtraction, void> =>
  Result.succeed([
    extraction,
    TextAnchor.make({
      endChar: extraction.span.end,
      quote: extraction.matchedText,
      startChar: extraction.span.start,
    }),
  ]);

const locateExtraction = (extraction: GroundedExtraction): Result.Result<LocatedExtraction, void> =>
  GroundedExtraction.match(extraction, {
    match_exact: alignedExtraction,
    match_fuzzy: alignedExtraction,
    match_lesser: alignedExtraction,
    match_minimal_fold: alignedExtraction,
    unaligned: () => Result.failVoid,
  });

const locateRelationEvidence = (extraction: GroundedExtraction): Result.Result<LocatedExtraction, void> =>
  GroundedExtraction.match(extraction, {
    match_exact: alignedExtraction,
    match_fuzzy: () => Result.failVoid,
    match_lesser: alignedExtraction,
    match_minimal_fold: alignedExtraction,
    unaligned: () => Result.failVoid,
  });

const decodeRelationCandidate = (
  extraction: GroundedExtraction
): Result.Result<RelationExtractionCandidate, S.SchemaError> =>
  S.decodeUnknownResult(RelationExtractionCandidate)({
    evidenceQuote: extraction.text,
    object: O.getOrUndefined(extractionAttribute(extraction, "object")),
    predicate: O.getOrUndefined(extractionAttribute(extraction, "predicate")),
    subject: O.getOrUndefined(extractionAttribute(extraction, "subject")),
  });

const scopedEndpointAnchor = (evidence: TextAnchor, surface: string): Result.Result<TextAnchor, void> => {
  const aligned = alignCandidate(
    ExtractionCandidate.make({ label: "relation-endpoint", text: surface }),
    AlignmentSource.make({ fuzzyThreshold: UnitInterval.make(1), sourceText: evidence.quote })
  );
  return locateRelationEvidence(aligned).pipe(
    Result.map(([, anchor]) =>
      TextAnchor.make({
        endChar: NonNegativeInt.make(N.sum(evidence.startChar, anchor.endChar)),
        quote: anchor.quote,
        startChar: NonNegativeInt.make(N.sum(evidence.startChar, anchor.startChar)),
      })
    )
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
  confidence: Confidence,
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
  extraction: GroundedExtraction,
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
  const located = locateRelationEvidence(extraction);
  if (Result.isFailure(located)) {
    return Result.fail(
      relationDegradation(
        chunks,
        O.none(),
        "fabricated-span",
        "Relation evidence did not align uniquely through the exact, lesser, or minimal-fold tiers."
      )
    );
  }
  const [, evidence] = located.success;
  const subjectAnchor = scopedEndpointAnchor(evidence, decoded.success.subject);
  const objectAnchor = scopedEndpointAnchor(evidence, decoded.success.object);
  if (Result.isFailure(subjectAnchor) || Result.isFailure(objectAnchor)) {
    return Result.fail(
      relationDegradation(
        chunks,
        O.some(evidence),
        "relation-unresolved",
        "A relation endpoint did not align uniquely inside its evidence quote."
      )
    );
  }
  const confidence = evidenceConfidence(extraction.confidence);
  const subject = yield* endpointClaim(
    canonicalizer,
    canonical,
    chunks,
    baseClaims,
    subjectAnchor.success,
    confidence,
    model,
    cacheKey
  );
  const object = yield* endpointClaim(
    canonicalizer,
    canonical,
    chunks,
    baseClaims,
    objectAnchor.success,
    confidence,
    model,
    cacheKey
  );
  const relation = yield* makeClaim(
    canonicalizer,
    canonical,
    chunks,
    ClaimBody.cases.Relation.make({
      ...evidence,
      kind: "Relation",
      object: object.id,
      predicate: decoded.success.predicate,
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
 * import { groundHostedExtractions } from "@/layers/ExtractorLive"
 *
 * console.log(typeof groundHostedExtractions) // "function"
 * ```
 *
 * @internal
 * @category mapping
 * @since 0.0.0
 */
export const groundHostedExtractions = Effect.fn("Extractor.groundHostedExtractions")(function* (
  canonicalizer: CanonicalizerShape,
  canonical: CanonicalText,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  extractions: ReadonlyArray<GroundedExtraction>,
  model: ModelIdentity,
  cacheKey: O.Option<Sha256Hex>
) {
  const relationExtractions = A.filter(extractions, (extraction) => Str.Equivalence(extraction.label, "relation"));
  const nonRelationExtractions = A.filter(extractions, (extraction) => !Str.Equivalence(extraction.label, "relation"));
  const basePairs = A.filterMap(nonRelationExtractions, locateExtraction);
  const unaligned = A.map(A.filter(nonRelationExtractions, GroundedExtraction.guards.unaligned), () =>
    unalignedExtraction(chunks)
  );
  const baseClaims = yield* Effect.forEach(
    basePairs,
    ([extraction, anchor]) =>
      makeClaim(
        canonicalizer,
        canonical,
        chunks,
        nonRelationBody(extraction, anchor),
        evidenceConfidence(extraction.confidence),
        "hosted-langextract",
        model,
        cacheKey
      ),
    { concurrency: 1 }
  );
  const relations = yield* Effect.forEach(
    relationExtractions,
    (extraction) => groundRelation(canonicalizer, canonical, chunks, baseClaims, extraction, model, cacheKey),
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

      const cacheKey = O.some(yield* hostedCacheKey(request, model).pipe(Effect.orDie));
      return yield* groundHostedExtractions(
        canonicalizer,
        canonical,
        chunks,
        extracted.success.extractions,
        model,
        cacheKey
      );
    }),
  });
});

const fabricatedSpan = (chunks: A.NonEmptyReadonlyArray<Chunk>): DegradedClaim =>
  DegradedClaim.make({
    chunk: A.headNonEmpty(chunks).id,
    detail: "Wink returned an absent, empty, non-UTF-16, or width-mismatched entity span.",
    kind: "fabricated-span",
  });

const patternClaim = Effect.fn("PatternExtractor.patternClaim")(function* (
  canonicalizer: CanonicalizerShape,
  canonical: CanonicalText,
  chunks: A.NonEmptyReadonlyArray<Chunk>,
  entity: EntityNode
) {
  const start = entity.span.start;
  const end = entity.span.end;
  const validOffsets = NonNegativeInt.is(start) && NonNegativeInt.is(end) && start < end;
  const quote = validOffsets ? Str.slice(start, end)(canonical.text) : Str.empty;
  if (
    !validOffsets ||
    !Str.isNonEmpty(entity.text) ||
    !N.Equivalence(N.subtract(end, start), Str.length(entity.text)) ||
    !Str.Equivalence(quote, entity.text)
  ) {
    return Result.fail(fabricatedSpan(chunks));
  }
  const body = ClaimBody.cases.Entity.make({
    cluster: O.none(),
    endChar: NonNegativeInt.make(end),
    entityType: Str.isNonEmpty(entity.entityType) ? entity.entityType : "UNKNOWN",
    kind: "Entity",
    label: quote,
    quote,
    startChar: NonNegativeInt.make(start),
  });
  return Result.succeed(
    yield* makeClaim(
      canonicalizer,
      canonical,
      chunks,
      body,
      Confidence.make(O.fromUndefinedOr(entity.confidence).pipe(O.getOrElse(() => 1))),
      "pattern-wink",
      PATTERN_MODEL_IDENTITY,
      O.none()
    )
  );
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
 * import { Layer } from "effect"
 *
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
 * import { Layer } from "effect"
 *
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
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(PatternExtractorLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PatternExtractorLive = Layer.effect(PatternExtractor, makePatternExtractor);
