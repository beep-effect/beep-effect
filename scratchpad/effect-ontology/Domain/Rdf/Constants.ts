/**
 * Experiment-owned RDF vocabulary constants.
 *
 * **Details**
 *
 * Standard RDF vocabularies are imported directly from `@beep/rdf/Vocab/*`
 * by consumers. This module owns only the terms introduced by the
 * effect-ontology experiment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { IRI, makeNamedNode } from "@beep/rdf";

const vocabularyTerm = (namespace: string, localName: string) => makeNamedNode(`${namespace}${localName}`);

const extractionNamespace = IRI.decodeUnknownSync("https://example.org/kg/");
const claimsNamespace = IRI.decodeUnknownSync("https://effect-ontology.dev/claims#");
const correctionsNamespace = IRI.decodeUnknownSync("https://effect-ontology.dev/corrections#");
const coreNamespace = IRI.decodeUnknownSync("https://effect-ontology.dev/core#");

/**
 * Legacy extraction-metadata vocabulary.
 *
 * **Gotchas**
 *
 * The `example.org` namespace is retained only for source compatibility and
 * must be replaced by an owned deployment namespace before publication.
 *
 * **Example** (Inspect extraction confidence term)
 *
 * ```ts
 * import { EXTR } from "@effect-ontology/Rdf/Constants"
 *
 * console.log(EXTR.confidence.value)
 * ```
 *
 * @experimental
 * @category constants
 * @since 0.0.0
 */
export const EXTR = {
  namespace: extractionNamespace,
  confidence: vocabularyTerm(extractionNamespace, "confidence"),
  usedModel: vocabularyTerm(extractionNamespace, "usedModel"),
  ontologyVersion: vocabularyTerm(extractionNamespace, "ontologyVersion"),
  sourceChunk: vocabularyTerm(extractionNamespace, "sourceChunk"),
  extractionMethod: vocabularyTerm(extractionNamespace, "extractionMethod"),
};

/**
 * Effect-ontology claims vocabulary.
 *
 * **Example** (Inspect claim class term)
 *
 * ```ts
 * import { CLAIMS } from "@effect-ontology/Rdf/Constants"
 *
 * console.log(CLAIMS.Claim.value)
 * ```
 *
 * @experimental
 * @category constants
 * @since 0.0.0
 */
export const CLAIMS = {
  namespace: claimsNamespace,
  Claim: vocabularyTerm(claimsNamespace, "Claim"),
  ClaimRank: vocabularyTerm(claimsNamespace, "ClaimRank"),
  Evidence: vocabularyTerm(claimsNamespace, "Evidence"),
  ArticleClaimSet: vocabularyTerm(claimsNamespace, "ArticleClaimSet"),
  ClaimSetStatus: vocabularyTerm(claimsNamespace, "ClaimSetStatus"),
  Preferred: vocabularyTerm(claimsNamespace, "Preferred"),
  Normal: vocabularyTerm(claimsNamespace, "Normal"),
  Deprecated: vocabularyTerm(claimsNamespace, "Deprecated"),
  Pending: vocabularyTerm(claimsNamespace, "Pending"),
  Accepted: vocabularyTerm(claimsNamespace, "Accepted"),
  Retracted: vocabularyTerm(claimsNamespace, "Retracted"),
  claimSubject: vocabularyTerm(claimsNamespace, "claimSubject"),
  claimPredicate: vocabularyTerm(claimsNamespace, "claimPredicate"),
  claimObject: vocabularyTerm(claimsNamespace, "claimObject"),
  claimLiteral: vocabularyTerm(claimsNamespace, "claimLiteral"),
  rank: vocabularyTerm(claimsNamespace, "rank"),
  confidence: vocabularyTerm(claimsNamespace, "confidence"),
  validFrom: vocabularyTerm(claimsNamespace, "validFrom"),
  validUntil: vocabularyTerm(claimsNamespace, "validUntil"),
  eventTime: vocabularyTerm(claimsNamespace, "eventTime"),
  statedIn: vocabularyTerm(claimsNamespace, "statedIn"),
  extractedAt: vocabularyTerm(claimsNamespace, "extractedAt"),
  extractedBy: vocabularyTerm(claimsNamespace, "extractedBy"),
  deprecatedAt: vocabularyTerm(claimsNamespace, "deprecatedAt"),
  deprecationReason: vocabularyTerm(claimsNamespace, "deprecationReason"),
  supersedes: vocabularyTerm(claimsNamespace, "supersedes"),
  supersededBy: vocabularyTerm(claimsNamespace, "supersededBy"),
  hasEvidence: vocabularyTerm(claimsNamespace, "hasEvidence"),
  evidenceText: vocabularyTerm(claimsNamespace, "evidenceText"),
  startOffset: vocabularyTerm(claimsNamespace, "startOffset"),
  endOffset: vocabularyTerm(claimsNamespace, "endOffset"),
  claimStatus: vocabularyTerm(claimsNamespace, "claimStatus"),
  containsClaim: vocabularyTerm(claimsNamespace, "containsClaim"),
  sourceArticle: vocabularyTerm(claimsNamespace, "sourceArticle"),
};

/**
 * Effect-ontology correction and conflict vocabulary.
 *
 * **Example** (Inspect retraction class term)
 *
 * ```ts
 * import { CORRECTIONS } from "@effect-ontology/Rdf/Constants"
 *
 * console.log(CORRECTIONS.Retraction.value)
 * ```
 *
 * @experimental
 * @category constants
 * @since 0.0.0
 */
export const CORRECTIONS = {
  namespace: correctionsNamespace,
  Correction: vocabularyTerm(correctionsNamespace, "Correction"),
  CorrectionType: vocabularyTerm(correctionsNamespace, "CorrectionType"),
  CorrectionChain: vocabularyTerm(correctionsNamespace, "CorrectionChain"),
  Conflict: vocabularyTerm(correctionsNamespace, "Conflict"),
  ConflictType: vocabularyTerm(correctionsNamespace, "ConflictType"),
  ResolutionStrategy: vocabularyTerm(correctionsNamespace, "ResolutionStrategy"),
  Retraction: vocabularyTerm(correctionsNamespace, "Retraction"),
  Clarification: vocabularyTerm(correctionsNamespace, "Clarification"),
  Update: vocabularyTerm(correctionsNamespace, "Update"),
  Amendment: vocabularyTerm(correctionsNamespace, "Amendment"),
  PositionConflict: vocabularyTerm(correctionsNamespace, "PositionConflict"),
  TemporalConflict: vocabularyTerm(correctionsNamespace, "TemporalConflict"),
  ContradictoryConflict: vocabularyTerm(correctionsNamespace, "ContradictoryConflict"),
  TemporalPrecedence: vocabularyTerm(correctionsNamespace, "TemporalPrecedence"),
  SourceAuthority: vocabularyTerm(correctionsNamespace, "SourceAuthority"),
  ManualReview: vocabularyTerm(correctionsNamespace, "ManualReview"),
  correctionType: vocabularyTerm(correctionsNamespace, "correctionType"),
  correctionDate: vocabularyTerm(correctionsNamespace, "correctionDate"),
  correctionReason: vocabularyTerm(correctionsNamespace, "correctionReason"),
  sourceDocument: vocabularyTerm(correctionsNamespace, "sourceDocument"),
  invalidates: vocabularyTerm(correctionsNamespace, "invalidates"),
  invalidatedBy: vocabularyTerm(correctionsNamespace, "invalidatedBy"),
  refines: vocabularyTerm(correctionsNamespace, "refines"),
  introduces: vocabularyTerm(correctionsNamespace, "introduces"),
  conflictType: vocabularyTerm(correctionsNamespace, "conflictType"),
  involvesClaim: vocabularyTerm(correctionsNamespace, "involvesClaim"),
  detectedAt: vocabularyTerm(correctionsNamespace, "detectedAt"),
  resolvedBy: vocabularyTerm(correctionsNamespace, "resolvedBy"),
  resolutionStrategy: vocabularyTerm(correctionsNamespace, "resolutionStrategy"),
  CurationActivity: vocabularyTerm(correctionsNamespace, "CurationActivity"),
  curatedBy: vocabularyTerm(correctionsNamespace, "curatedBy"),
  curationConfidence: vocabularyTerm(correctionsNamespace, "curationConfidence"),
  usedAsExample: vocabularyTerm(correctionsNamespace, "usedAsExample"),
  curationNote: vocabularyTerm(correctionsNamespace, "curationNote"),
};

/**
 * Effect-ontology core extraction vocabulary.
 *
 * **Example** (Inspect mention class term)
 *
 * ```ts
 * import { CORE } from "@effect-ontology/Rdf/Constants"
 *
 * console.log(CORE.Mention.value)
 * ```
 *
 * @experimental
 * @category constants
 * @since 0.0.0
 */
export const CORE = {
  namespace: coreNamespace,
  TrackedEntity: vocabularyTerm(coreNamespace, "TrackedEntity"),
  TrackedEvent: vocabularyTerm(coreNamespace, "TrackedEvent"),
  Mention: vocabularyTerm(coreNamespace, "Mention"),
  hasEvidentialMention: vocabularyTerm(coreNamespace, "hasEvidentialMention"),
  mentions: vocabularyTerm(coreNamespace, "mentions"),
  hasParticipant: vocabularyTerm(coreNamespace, "hasParticipant"),
  isParticipantIn: vocabularyTerm(coreNamespace, "isParticipantIn"),
  sameEntityAs: vocabularyTerm(coreNamespace, "sameEntityAs"),
  mergedFrom: vocabularyTerm(coreNamespace, "mergedFrom"),
  hasLocation: vocabularyTerm(coreNamespace, "hasLocation"),
  name: vocabularyTerm(coreNamespace, "name"),
  description: vocabularyTerm(coreNamespace, "description"),
  occurrenceTime: vocabularyTerm(coreNamespace, "occurrenceTime"),
  groundingConfidence: vocabularyTerm(coreNamespace, "groundingConfidence"),
  resolutionConfidence: vocabularyTerm(coreNamespace, "resolutionConfidence"),
};
