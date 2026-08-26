import { Confidence } from "@beep/epistemic-domain";
import { $SemanticaId } from "@beep/identity/packages";
import { TextAnchor, TextAnchorFields, TextAnchorVerificationReceipt, TextAnchorWidthCheck } from "@beep/provenance";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { Equal, HashMap, HashSet, identity, Option, Order, Result, Tuple } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DegradedKind } from "@/schema/Degraded";
import { sha256CanonicalSync } from "@/schema/Digest";
import { BatchId, ChunkId, ClaimId, DocumentId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";

const $I = $SemanticaId.create("schema/Evidence");

/**
 * Hosted and local-pattern extraction lanes.
 *
 * **Example** (Check the hosted lane)
 *
 * ```ts
 * import { ExtractionLane } from "@/schema/Evidence"
 *
 * console.log(ExtractionLane.is.hosted("hosted")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionLane = LiteralKit(["hosted", "pattern"]).pipe(
  $I.annoteSchema("ExtractionLane", {
    description: "Hosted LangExtract and local Wink extraction lanes.",
  })
);

/**
 * Decoded extraction lane.
 *
 * **Example** (Annotate an extraction lane)
 *
 * ```ts
 * import type { ExtractionLane } from "@/schema/Evidence"
 *
 * const lane: ExtractionLane = "hosted"
 * console.log(lane) // "hosted"
 * ```
 *
 * @see {@link ExtractionLane} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionLane = typeof ExtractionLane.Type;

/**
 * Concrete extraction implementations represented in evidence batches.
 *
 * **Example** (Check the pattern method)
 *
 * ```ts
 * import { ExtractionMethod } from "@/schema/Evidence"
 *
 * console.log(ExtractionMethod.is["pattern-wink"]("pattern-wink")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionMethod = LiteralKit(["hosted-langextract", "pattern-wink"]).pipe(
  $I.annoteSchema("ExtractionMethod", {
    description: "Pinned hosted LangExtract and local Wink extraction methods.",
  })
);

/**
 * Decoded extraction method.
 *
 * **Example** (Annotate an extraction method)
 *
 * ```ts
 * import type { ExtractionMethod } from "@/schema/Evidence"
 *
 * const method: ExtractionMethod = "pattern-wink"
 * console.log(method) // "pattern-wink"
 * ```
 *
 * @see {@link ExtractionMethod} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionMethod = typeof ExtractionMethod.Type;

/**
 * Structural roles extracted from canonical paper text.
 *
 * **Example** (Check an abstract role)
 *
 * ```ts
 * import { StructureRole } from "@/schema/Evidence"
 *
 * console.log(StructureRole.is.abstract("abstract")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StructureRole = LiteralKit(["title", "abstract", "section", "reference"]).pipe(
  $I.annoteSchema("StructureRole", {
    description: "Title, abstract, section, and reference roles in a paper's structure.",
  })
);

/**
 * Decoded structure role.
 *
 * **Example** (Annotate a structure role)
 *
 * ```ts
 * import type { StructureRole } from "@/schema/Evidence"
 *
 * const role: StructureRole = "abstract"
 * console.log(role) // "abstract"
 * ```
 *
 * @see {@link StructureRole} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type StructureRole = typeof StructureRole.Type;

/**
 * Capability losses explicitly declared by an extraction lane.
 *
 * **Example** (Declare unsupported relations)
 *
 * ```ts
 * import { LossDeclaration } from "@/schema/Evidence"
 *
 * console.log(LossDeclaration.is["relations-not-supported"]("relations-not-supported")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LossDeclaration = LiteralKit(["relations-not-supported", "structure-not-supported"]).pipe(
  $I.annoteSchema("LossDeclaration", {
    description: "Relation or structure capability absent from an extraction lane by design.",
  })
);

/**
 * Decoded extraction loss declaration.
 *
 * **Example** (Annotate a loss declaration)
 *
 * ```ts
 * import type { LossDeclaration } from "@/schema/Evidence"
 *
 * const loss: LossDeclaration = "relations-not-supported"
 * console.log(loss) // "relations-not-supported"
 * ```
 *
 * @see {@link LossDeclaration} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type LossDeclaration = typeof LossDeclaration.Type;

/**
 * Exact capability losses declared by each extraction implementation.
 *
 * **Example** (Inspect the pattern losses)
 *
 * ```ts
 * import { declaredLosses } from "@/schema/Evidence"
 * import { HashMap, HashSet, Option } from "effect"
 *
 * const losses = Option.getOrThrow(HashMap.get(declaredLosses, "pattern-wink"))
 * console.log(HashSet.size(losses)) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
const DeclaredLossEntries: ReadonlyArray<readonly [ExtractionMethod, HashSet.HashSet<LossDeclaration>]> = [
  ["hosted-langextract", HashSet.empty<LossDeclaration>()],
  ["pattern-wink", HashSet.fromIterable<LossDeclaration>(["relations-not-supported", "structure-not-supported"])],
];

export const declaredLosses: HashMap.HashMap<ExtractionMethod, HashSet.HashSet<LossDeclaration>> = HashMap.fromIterable(
  DeclaredLossEntries
);

const EntityBodyFields = S.Struct({
  kind: S.tag("Entity"),
  label: S.NonEmptyString,
  entityType: S.NonEmptyString,
  ...TextAnchorFields,
});

class EntityClaimBody extends S.Class<EntityClaimBody>($I`EntityClaimBody`)(
  EntityBodyFields.mapFields(identity).check(TextAnchorWidthCheck),
  $I.annote("EntityClaimBody", {
    description: "Grounded entity label and type with an exact UTF-16 text anchor.",
  })
) {}

const RelationBodyFields = S.Struct({
  kind: S.tag("Relation"),
  predicate: S.NonEmptyString,
  subject: ClaimId,
  object: ClaimId,
  ...TextAnchorFields,
});

class RelationClaimBody extends S.Class<RelationClaimBody>($I`RelationClaimBody`)(
  RelationBodyFields.mapFields(identity).check(TextAnchorWidthCheck),
  $I.annote("RelationClaimBody", {
    description: "Grounded relation predicate and entity-claim endpoints with an exact text anchor.",
  })
) {}

const StructureBodyFields = S.Struct({
  kind: S.tag("Structure"),
  role: StructureRole,
  depth: NonNegativeInt,
  ...TextAnchorFields,
});

class StructureClaimBody extends S.Class<StructureClaimBody>($I`StructureClaimBody`)(
  StructureBodyFields.mapFields(identity).check(TextAnchorWidthCheck),
  $I.annote("StructureClaimBody", {
    description: "Grounded structural role and depth with an exact UTF-16 text anchor.",
  })
) {}

const ClaimBodyKind = LiteralKit(["Entity", "Relation", "Structure"]);

/**
 * Grounded entity, relation, or structural evidence body.
 *
 * **Example** (Create an entity body)
 *
 * ```ts
 * import { ClaimBody } from "@/schema/Evidence"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const body = ClaimBody.cases.Entity.make({
 *   kind: "Entity",
 *   label: "Effect",
 *   entityType: "software",
 *   startChar: NonNegativeInt.make(0),
 *   endChar: NonNegativeInt.make(6),
 *   quote: "Effect"
 * })
 * console.log(body.kind) // "Entity"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimBody = ClaimBodyKind.mapMembers(
  Tuple.evolve([() => EntityClaimBody, () => RelationClaimBody, () => StructureClaimBody])
)
  .annotate(
    $I.annote("ClaimBody", {
      description: "Exhaustive anchored entity, relation, and structure evidence bodies.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Decoded evidence claim body.
 *
 * **Example** (Inspect a claim body type)
 *
 * ```ts
 * import type { ClaimBody } from "@/schema/Evidence"
 *
 * const inspect = (body: ClaimBody) => body.kind
 * console.log(typeof inspect) // "function"
 * ```
 *
 * @see {@link ClaimBody} for variants.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimBody = typeof ClaimBody.Type;

const EvidenceClaimFields = S.Struct({
  id: ClaimId,
  document: DocumentId,
  chunk: ChunkId,
  body: ClaimBody,
  confidence: Confidence,
  method: ExtractionMethod,
  model: ModelIdentity,
  cacheKey: S.OptionFromNullOr(Sha256Hex),
  receipt: TextAnchorVerificationReceipt,
});

const ClaimIdPreimage = S.Struct({
  document: DocumentId,
  chunk: ChunkId,
  body: ClaimBody,
  method: ExtractionMethod,
  model: ModelIdentity,
});

type ClaimIdSource = Pick<typeof EvidenceClaimFields.Type, "body" | "chunk" | "document" | "method" | "model">;

/**
 * Schema-encodes the canonical content preimage for an evidence claim id.
 *
 * **Example** (Inspect the preimage builder)
 *
 * ```ts
 * import { claimIdPreimage } from "@/schema/Evidence"
 *
 * console.log(typeof claimIdPreimage) // "function"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const claimIdPreimage = (claim: ClaimIdSource): Result.Result<typeof ClaimIdPreimage.Encoded, S.SchemaError> =>
  S.encodeResult(ClaimIdPreimage)({
    document: claim.document,
    chunk: claim.chunk,
    body: claim.body,
    method: claim.method,
    model: claim.model,
  });

/**
 * Builds the content-addressed id for a grounded evidence claim.
 *
 * **Example** (Inspect the claim id builder)
 *
 * ```ts
 * import { makeClaimId } from "@/schema/Evidence"
 *
 * console.log(typeof makeClaimId) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClaimId = (claim: ClaimIdSource): Result.Result<ClaimId, S.SchemaError> =>
  Result.map(claimIdPreimage(claim), (preimage) => ClaimId.make(sha256CanonicalSync(preimage)));

const EvidenceClaimReceiptCheck = S.makeFilter(
  (claim: typeof EvidenceClaimFields.Type) =>
    S.toEquivalence(TextAnchor)(claim.receipt.anchor, TextAnchor.make(claim.body)),
  {
    identifier: $I`EvidenceClaimReceiptCheck`,
    title: "Evidence claim anchor receipt",
    description: "Requires the verification receipt to contain the evidence body's exact anchor.",
    message: "EvidenceClaim receipt.anchor must equal the anchor carried by body.",
  }
);

const EvidenceClaimIdentityCheck = S.makeFilter(
  (claim: typeof EvidenceClaimFields.Type) =>
    makeClaimId(claim).pipe(
      Result.match({
        onFailure: () => false,
        onSuccess: (id) => Str.Equivalence(id, claim.id),
      })
    ),
  {
    identifier: $I`EvidenceClaimIdentityCheck`,
    title: "Evidence claim content identity",
    description: "Requires id to hash the canonical encoded document, chunk, body, method, and model.",
    message: "EvidenceClaim id must match the canonical claim preimage digest.",
  }
);

const EvidenceClaimChecks = S.makeFilterGroup([EvidenceClaimReceiptCheck, EvidenceClaimIdentityCheck], {
  identifier: $I`EvidenceClaimChecks`,
  title: "Evidence claim",
  description: "Checks the anchor receipt and canonical content identity of an evidence claim.",
  message: "EvidenceClaim must have a matching receipt and content id.",
});

/**
 * Content-addressed grounded evidence claim and its verification receipt.
 *
 * **Example** (Inspect the body field)
 *
 * ```ts
 * import { EvidenceClaim } from "@/schema/Evidence"
 *
 * console.log(EvidenceClaim.fields.body !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceClaim extends S.Class<EvidenceClaim>($I`EvidenceClaim`)(
  EvidenceClaimFields.mapFields(identity).check(EvidenceClaimChecks),
  $I.annote("EvidenceClaim", {
    description: "Grounded claim with model, method, confidence, cache provenance, and verified anchor receipt.",
  })
) {}

/**
 * Chunk-scoped extraction that could not become an evidence claim.
 *
 * **Example** (Create a fabricated-span degradation)
 *
 * ```ts
 * import { DegradedClaim } from "@/schema/Evidence"
 * import { ChunkId } from "@/schema/Ids"
 *
 * const degraded = DegradedClaim.make({
 *   kind: "fabricated-span",
 *   detail: "The returned quote was absent.",
 *   chunk: ChunkId.make("0".repeat(64))
 * })
 * console.log(degraded.kind) // "fabricated-span"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DegradedClaim extends S.Class<DegradedClaim>($I`DegradedClaim`)(
  {
    kind: DegradedKind,
    detail: S.NonEmptyString,
    chunk: ChunkId,
  },
  $I.annote("DegradedClaim", {
    description: "Typed chunk-scoped extraction degradation that never silently becomes a claim.",
  })
) {}

const EvidenceBatchFields = S.Struct({
  id: BatchId,
  document: DocumentId,
  method: ExtractionMethod,
  model: ModelIdentity,
  inputs: S.NonEmptyArray(ChunkId),
  claims: S.Array(EvidenceClaim),
  degraded: S.Array(DegradedClaim),
  lossy: S.Array(LossDeclaration),
});

type EvidenceBatchFields = typeof EvidenceBatchFields.Type;

const BatchIdPreimage = S.Struct({
  document: DocumentId,
  method: ExtractionMethod,
  model: ModelIdentity,
  inputs: S.NonEmptyArray(ChunkId),
});

type BatchIdSource = Pick<EvidenceBatchFields, "document" | "inputs" | "method" | "model">;

/**
 * Schema-encodes the canonical content preimage for an evidence batch id.
 *
 * **Example** (Inspect the preimage builder)
 *
 * ```ts
 * import { batchIdPreimage } from "@/schema/Evidence"
 *
 * console.log(typeof batchIdPreimage) // "function"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const batchIdPreimage = (batch: BatchIdSource): Result.Result<typeof BatchIdPreimage.Encoded, S.SchemaError> =>
  S.encodeResult(BatchIdPreimage)({
    document: batch.document,
    method: batch.method,
    model: batch.model,
    inputs: batch.inputs,
  });

/**
 * Builds the content-addressed id for one document-and-lane extraction batch.
 *
 * **Example** (Inspect the batch id builder)
 *
 * ```ts
 * import { makeBatchId } from "@/schema/Evidence"
 *
 * console.log(typeof makeBatchId) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeBatchId = (batch: BatchIdSource): Result.Result<BatchId, S.SchemaError> =>
  Result.map(batchIdPreimage(batch), (preimage) => BatchId.make(sha256CanonicalSync(preimage)));

const claimIdsAreUnique = (batch: EvidenceBatchFields): boolean =>
  Equal.equals(HashSet.size(HashSet.fromIterable(A.map(batch.claims, (claim) => claim.id))), A.length(batch.claims));

const claimsMatchBatch = (batch: EvidenceBatchFields): boolean => {
  const sameModel = S.toEquivalence(ModelIdentity);
  return A.every(
    batch.claims,
    (claim) =>
      Str.Equivalence(claim.document, batch.document) &&
      Str.Equivalence(claim.method, batch.method) &&
      sameModel(claim.model, batch.model)
  );
};

const outputsReferenceInputs = (batch: EvidenceBatchFields): boolean => {
  const inputIds = HashSet.fromIterable(batch.inputs);
  return (
    A.every(batch.claims, (claim) => HashSet.has(inputIds, claim.chunk)) &&
    A.every(batch.degraded, (degraded) => HashSet.has(inputIds, degraded.chunk))
  );
};

const relationEndpointsAreEntityClaims = (batch: EvidenceBatchFields): boolean => {
  const entityClaimIds = HashSet.fromIterable(
    A.getSomes(
      A.map(batch.claims, (claim) =>
        ClaimBody.match(claim.body, {
          Entity: () => Option.some(claim.id),
          Relation: () => Option.none<ClaimId>(),
          Structure: () => Option.none<ClaimId>(),
        })
      )
    )
  );

  return A.every(batch.claims, (claim) =>
    ClaimBody.match(claim.body, {
      Entity: () => true,
      Relation: (relation) =>
        HashSet.has(entityClaimIds, relation.subject) && HashSet.has(entityClaimIds, relation.object),
      Structure: () => true,
    })
  );
};

const lossesMatchMethod = (batch: EvidenceBatchFields): boolean =>
  HashMap.get(declaredLosses, batch.method).pipe(
    Option.match({
      onNone: () => false,
      onSome: (expected) => {
        const actual = HashSet.fromIterable(batch.lossy);
        return Equal.equals(HashSet.size(actual), A.length(batch.lossy)) && Equal.equals(actual, expected);
      },
    })
  );

const batchIdMatchesPreimage = (batch: EvidenceBatchFields): boolean =>
  makeBatchId(batch).pipe(
    Result.match({
      onFailure: () => false,
      onSuccess: (id) => Str.Equivalence(id, batch.id),
    })
  );

const EvidenceBatchChecks = S.makeFilterGroup(
  [
    S.makeFilter(claimIdsAreUnique, {
      identifier: $I`EvidenceBatchClaimIdsUnique`,
      title: "Evidence batch claim identity uniqueness",
      description: "Requires every evidence claim in a batch to have a unique content-addressed id.",
      message: "EvidenceBatch claims must have unique ids.",
    }),
    S.makeFilter(claimsMatchBatch, {
      identifier: $I`EvidenceBatchClaimCoherence`,
      title: "Evidence batch claim coherence",
      description: "Requires each claim's document, extraction method, and model to equal its batch.",
      message: "EvidenceBatch claims must match the batch document, method, and model.",
    }),
    S.makeFilter(outputsReferenceInputs, {
      identifier: $I`EvidenceBatchOutputInputBinding`,
      title: "Evidence batch output input binding",
      description: "Requires every claim and degraded claim to reference a chunk listed in batch inputs.",
      message: "EvidenceBatch claim and degraded chunk ids must belong to inputs.",
    }),
    S.makeFilter(relationEndpointsAreEntityClaims, {
      identifier: $I`EvidenceBatchRelationEndpoints`,
      title: "Evidence batch relation endpoints",
      description: "Requires each relation endpoint to identify an entity claim in the same batch.",
      message: "EvidenceBatch relation subject and object must identify same-batch entity claims.",
    }),
    S.makeFilter(lossesMatchMethod, {
      identifier: $I`EvidenceBatchDeclaredLosses`,
      title: "Evidence batch declared losses",
      description: "Requires lossy to equal the method's declared capability-loss set without duplicates.",
      message: "EvidenceBatch lossy must exactly match declaredLosses for method.",
    }),
    S.makeFilter(batchIdMatchesPreimage, {
      identifier: $I`EvidenceBatchIdentity`,
      title: "Evidence batch content identity",
      description: "Requires id to hash the canonical encoded document, method, model, and ordered inputs.",
      message: "EvidenceBatch id must match the canonical batch preimage digest.",
    }),
  ],
  {
    identifier: $I`EvidenceBatchChecks`,
    title: "Evidence batch",
    description: "Checks evidence-batch coherence, provenance, declared losses, endpoints, and content identity.",
    message: "EvidenceBatch must satisfy every batch coherence and identity check.",
  }
);

/**
 * One document-and-lane extraction batch with claims, degradations, and declared loss.
 *
 * **Example** (Inspect the loss declarations)
 *
 * ```ts
 * import { EvidenceBatch } from "@/schema/Evidence"
 *
 * console.log(EvidenceBatch.fields.lossy !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceBatch extends S.Class<EvidenceBatch>($I`EvidenceBatch`)(
  EvidenceBatchFields.mapFields(identity).check(EvidenceBatchChecks),
  $I.annote("EvidenceBatch", {
    description: "Coherent extraction batch with unique claims and explicit unsupported-capability declarations.",
  })
) {}

class ExtractedOutcome extends S.Class<ExtractedOutcome>($I`ExtractedOutcome`)(
  {
    outcome: S.tag("Extracted"),
    batch: EvidenceBatch,
  },
  $I.annote("ExtractedOutcome", {
    description: "Successful extraction represented by a validated evidence batch.",
  })
) {}

class DegradedExtractOutcome extends S.Class<DegradedExtractOutcome>($I`DegradedExtractOutcome`)(
  {
    outcome: S.tag("Degraded"),
    document: DocumentId,
    lane: ExtractionLane,
    kind: DegradedKind,
    detail: S.NonEmptyString,
  },
  $I.annote("DegradedExtractOutcome", {
    description: "Typed document-and-lane extraction degradation retained as a value.",
  })
) {}

const ExtractOutcomeKind = LiteralKit(["Extracted", "Degraded"]);

/**
 * Successful or explicitly degraded extraction result.
 *
 * **Example** (Create a degraded extraction result)
 *
 * ```ts
 * import { ExtractOutcome } from "@/schema/Evidence"
 * import { DocumentId } from "@/schema/Ids"
 *
 * const result = ExtractOutcome.cases.Degraded.make({
 *   outcome: "Degraded",
 *   document: DocumentId.make("0".repeat(64)),
 *   lane: "hosted",
 *   kind: "provider-unavailable",
 *   detail: "Provider cache miss."
 * })
 * console.log(result.outcome) // "Degraded"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractOutcome = ExtractOutcomeKind.mapMembers(
  Tuple.evolve([() => ExtractedOutcome, () => DegradedExtractOutcome])
)
  .annotate(
    $I.annote("ExtractOutcome", {
      description: "Extraction result preserving either a validated batch or a typed degraded state.",
    })
  )
  .pipe(S.toTaggedUnion("outcome"));

/**
 * Decoded extraction outcome.
 *
 * **Example** (Inspect an extraction outcome type)
 *
 * ```ts
 * import type { ExtractOutcome } from "@/schema/Evidence"
 *
 * const inspect = (outcome: ExtractOutcome) => outcome.outcome
 * console.log(typeof inspect) // "function"
 * ```
 *
 * @see {@link ExtractOutcome} for variants.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractOutcome = typeof ExtractOutcome.Type;

/**
 * Reasons two claims form an explicit conflict witness.
 *
 * **Example** (Check an anchor conflict)
 *
 * ```ts
 * import { ConflictBasis } from "@/schema/Evidence"
 *
 * console.log(ConflictBasis.is["same-anchor-different-label"]("same-anchor-different-label")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictBasis = LiteralKit(["same-anchor-different-label", "same-pair-different-predicate"]).pipe(
  $I.annoteSchema("ConflictBasis", {
    description: "Same-anchor label disagreement or same-endpoint predicate disagreement.",
  })
);

/**
 * Decoded conflict basis.
 *
 * **Example** (Annotate a conflict basis)
 *
 * ```ts
 * import type { ConflictBasis } from "@/schema/Evidence"
 *
 * const basis: ConflictBasis = "same-anchor-different-label"
 * console.log(basis) // "same-anchor-different-label"
 * ```
 *
 * @see {@link ConflictBasis} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type ConflictBasis = typeof ConflictBasis.Type;

const ConflictWitnessFields = S.Struct({
  id: Sha256Hex,
  left: ClaimId,
  right: ClaimId,
  basis: ConflictBasis,
});

const ConflictWitnessPreimage = S.Struct({
  left: ClaimId,
  right: ClaimId,
  basis: ConflictBasis,
});

const ConflictWitnessChecks = S.makeFilterGroup(
  [
    S.makeFilter((witness: typeof ConflictWitnessFields.Type) => !Str.Equivalence(witness.left, witness.right), {
      identifier: $I`ConflictWitnessDistinctEndpoints`,
      title: "Conflict witness distinct endpoints",
      description: "Requires a conflict witness to connect two different evidence claims.",
      message: "ConflictWitness left and right must differ.",
    }),
    S.makeFilter(
      (witness: typeof ConflictWitnessFields.Type) => Order.isLessThan(Order.String)(witness.left, witness.right),
      {
        identifier: $I`ConflictWitnessCanonicalOrder`,
        title: "Conflict witness canonical order",
        description: "Requires conflict endpoints to use ascending string order for one canonical preimage.",
        message: "ConflictWitness left must sort before right.",
      }
    ),
    S.makeFilter(
      (witness: typeof ConflictWitnessFields.Type) =>
        S.encodeResult(ConflictWitnessPreimage)({
          left: witness.left,
          right: witness.right,
          basis: witness.basis,
        }).pipe(
          Result.map(sha256CanonicalSync),
          Result.match({
            onFailure: () => false,
            onSuccess: (id) => Str.Equivalence(id, witness.id),
          })
        ),
      {
        identifier: $I`ConflictWitnessIdentity`,
        title: "Conflict witness content identity",
        description: "Requires id to hash the canonical encoded left, right, and conflict basis.",
        message: "ConflictWitness id must match the canonical conflict preimage digest.",
      }
    ),
  ],
  {
    identifier: $I`ConflictWitnessChecks`,
    title: "Conflict witness",
    description: "Checks distinct ordered endpoints and the canonical conflict-witness content id.",
    message: "ConflictWitness must have distinct ordered endpoints and a matching content id.",
  }
);

/**
 * Persisted witness connecting two conflicting claims without merging them.
 *
 * **Example** (Inspect the endpoint fields)
 *
 * ```ts
 * import { ConflictWitness } from "@/schema/Evidence"
 *
 * console.log(ConflictWitness.fields.left !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConflictWitness extends S.Class<ConflictWitness>($I`ConflictWitness`)(
  ConflictWitnessFields.check(ConflictWitnessChecks),
  $I.annote("ConflictWitness", {
    description: "Content-addressed record that keeps two conflicting evidence claims as separate nodes.",
  })
) {}
