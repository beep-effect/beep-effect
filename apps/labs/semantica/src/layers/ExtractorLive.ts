import { Confidence } from "@beep/epistemic-domain";
import { LangExtractRequest } from "@beep/langextract/Extraction";
import {
  allowRemoteExtractionPolicyLayer,
  buildPrompt,
  LangExtractService,
  layer as LangExtractServiceLive,
} from "@beep/langextract/Service";
import { ExtractionExample, ExtractionExampleItem, ExtractionTarget } from "@beep/langextract/Target";
import { locateGroundedExtractions } from "@beep/langextract/VerifiedSpan";
import { DocumentId as NlpDocumentId } from "@beep/nlp/Core";
import { NLPService } from "@beep/nlp-processing/NLPService";
import { TextAnchor } from "@beep/provenance";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { Effect, HashMap, Layer, Number as N, Order, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { contentDigest, sha256CanonicalSync } from "@/schema/Digest";
import {
  ClaimBody,
  DegradedClaim,
  declaredLosses,
  EvidenceBatch,
  EvidenceClaim,
  ExtractOutcome,
  makeBatchId,
  makeClaimId,
  StructureRole,
} from "@/schema/Evidence";
import { DocumentId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";
import { ProviderCacheKey } from "@/schema/ProviderCache";
import { Canonicalizer } from "@/services/Canonicalizer";
import { HostedExtractor, PatternExtractor } from "@/services/Extractor";
import { ActiveModelIdentity } from "@/services/LanguageModel";
import type { GroundedExtraction, LangExtractError } from "@beep/langextract/Extraction";
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
    description: O.some("A grounded relation whose endpoints are exact entity surface strings."),
  }),
];

const HOSTED_EXAMPLES = [
  ExtractionExample.make({
    text: "Ada Lovelace developed the Analytical Engine method.",
    extractions: [
      ExtractionExampleItem.make({
        label: "person",
        text: "Ada Lovelace",
        attributes: O.some({ cluster: "person-ada-lovelace" }),
      }),
      ExtractionExampleItem.make({
        label: "method",
        text: "Analytical Engine",
        attributes: O.some({ cluster: "method-analytical-engine" }),
      }),
      ExtractionExampleItem.make({
        label: "relation",
        text: "Ada Lovelace developed the Analytical Engine method.",
        attributes: O.some({ object: "Analytical Engine", predicate: "developed", subject: "Ada Lovelace" }),
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

/**
 * Hash of the actual LangExtract prompt rendered from the pinned targets and examples.
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
  Effect.flatMap((prompt) => Sha256HexFromBytes.decodeEffect(utf8Encoder.encode(prompt))),
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

const requestFor = (canonical: CanonicalText): LangExtractRequest =>
  LangExtractRequest.make({
    documentId: NlpDocumentId.make(canonical.identity.sourceRef),
    examples: HOSTED_EXAMPLES,
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
    O.filter(S.is(NonNegativeInt)),
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
    Relation: () => O.none<TextAnchor>(),
    Structure: () => O.none<TextAnchor>(),
  });

const exactEntity = (claims: ReadonlyArray<EvidenceClaimValue>, quote: string): O.Option<EvidenceClaimValue> =>
  A.findFirst(claims, (claim) => entityAnchorOf(claim).pipe(O.exists((body) => Str.Equivalence(body.quote, quote))));

const nearestNfcEntity = (
  claims: ReadonlyArray<EvidenceClaimValue>,
  quote: string,
  before: number
): O.Option<EvidenceClaimValue> => {
  const folded = Str.normalize("NFC")(quote);
  return A.reduce(claims, O.none<EvidenceClaimValue>(), (nearest, claim) =>
    entityAnchorOf(claim).pipe(
      O.filter((body) => body.startChar <= before && Str.Equivalence(Str.normalize("NFC")(body.quote), folded)),
      O.flatMap((body) =>
        nearest.pipe(
          O.flatMap(entityAnchorOf),
          O.match({
            onNone: () => O.some(claim),
            onSome: (current) => O.some(body.startChar > current.startChar ? claim : O.getOrThrow(nearest)),
          })
        )
      ),
      O.orElse(() => nearest)
    )
  );
};

const resolveEndpoint = (
  claims: ReadonlyArray<EvidenceClaimValue>,
  quote: O.Option<string>,
  before: number
): O.Option<EvidenceClaimValue> =>
  quote.pipe(
    O.flatMap((surface) => exactEntity(claims, surface).pipe(O.orElse(() => nearestNfcEntity(claims, surface, before))))
  );

const makeHostedExtractor = Effect.gen(function* () {
  const canonicalizer = yield* Canonicalizer;
  const langExtract = yield* LangExtractService;
  const model = yield* ActiveModelIdentity;

  return HostedExtractor.of({
    extract: Effect.fn("HostedExtractor.extract")(function* (canonical, chunks) {
      const document = documentIdOf(canonical);
      const request = requestFor(canonical);
      const extracted = yield* langExtract.extract(request).pipe(Effect.result);
      if (Result.isFailure(extracted)) {
        return degradedOutcome(
          document,
          "hosted",
          langExtractDegradedKind(extracted.failure),
          "The hosted extraction boundary did not produce a valid grounded result."
        );
      }

      const located = yield* locateGroundedExtractions(extracted.success.extractions, canonical.text).pipe(
        Effect.result
      );
      if (Result.isFailure(located)) {
        return degradedOutcome(
          document,
          "hosted",
          "fabricated-span",
          "A hosted extraction could not be located in the exact canonical text."
        );
      }

      const cacheKey = O.some(yield* hostedCacheKey(request, model).pipe(Effect.orDie));
      const pairs = A.zip(extracted.success.extractions, located.success);
      const basePairs = A.filter(pairs, ([extraction]) => !Str.Equivalence(extraction.label, "relation"));
      const relationPairs = A.filter(pairs, ([extraction]) => Str.Equivalence(extraction.label, "relation"));
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
        relationPairs,
        Effect.fnUntraced(function* ([extraction, anchor]) {
          const chunk = containingChunk(chunks, anchor);
          const subject = resolveEndpoint(baseClaims, extractionAttribute(extraction, "subject"), anchor.startChar);
          const object = resolveEndpoint(baseClaims, extractionAttribute(extraction, "object"), anchor.startChar);
          const predicate = extractionAttribute(extraction, "predicate");
          if (O.isNone(subject) || O.isNone(object) || O.isNone(predicate)) {
            return Result.fail(
              DegradedClaim.make({
                chunk: chunk.id,
                detail: "A relation endpoint or predicate did not resolve to same-batch entity evidence.",
                kind: "relation-unresolved",
              })
            );
          }
          const claim = yield* makeClaim(
            canonicalizer,
            canonical,
            chunks,
            ClaimBody.cases.Relation.make({
              ...anchor,
              kind: "Relation",
              object: object.value.id,
              predicate: predicate.value,
              subject: subject.value.id,
            }),
            evidenceConfidence(extraction.confidence),
            "hosted-langextract",
            model,
            cacheKey
          );
          return Result.succeed(claim);
        }),
        { concurrency: 1 }
      );

      return makeBatch(
        document,
        chunks,
        "hosted-langextract",
        model,
        A.appendAll(baseClaims, A.getSuccesses(relations)),
        A.getFailures(relations)
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
  const validOffsets = S.is(NonNegativeInt)(start) && S.is(NonNegativeInt)(end) && start < end;
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
export const HostedLangExtractLive = HostedExtractorLive.pipe(
  Layer.provide(LangExtractServiceLive.pipe(Layer.provide(allowRemoteExtractionPolicyLayer)))
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
