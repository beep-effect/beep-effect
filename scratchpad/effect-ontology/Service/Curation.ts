/**
 * Curation Service
 *
 * **Details**
 *
 * Service for applying curation actions to claims and entities.
 * Handles corrections, deprecations, alias additions, and rank promotions.
 * Publishes events via EventBusService and queues background jobs for async processing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import type { Stream } from "effect";
import { Context, DateTime, Effect, Layer, Match } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type { EventBusError } from "../Domain/Error/EventBus.ts";
import { ContentHash } from "../Domain/Identity.ts";
import type {
  AddAliasAction,
  CorrectTripleAction,
  CurationAction,
  LinkToWikidataAction,
  MarkAsWrongAction,
  PromoteToPreferredAction,
} from "../Domain/Schema/CurationAction.ts";
import { BackgroundJobId, EmbeddingJob, PromptCacheJob } from "../Domain/Schema/JobSchema.ts";
import { ClaimId } from "../Domain/Schema/KnowledgeModel.ts";
import { ClaimRepository } from "../Repository/Claim.ts";
import { CanonicalEntityId, EntityRegistryRepository, normalizeEntityMention } from "../Repository/EntityRegistry.ts";
import { ExamplesRepository } from "../Repository/Examples.ts";
import { sha256SyncFull } from "../Utils/Hash.ts";
import { EmbeddingService } from "./Embedding.ts";
import type { EventEntry } from "./EventBus.ts";
import { EventBusService } from "./EventBus.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Curation");

// =============================================================================
// Types
// =============================================================================

/**
 * Combined error type for curation service operations
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurationServiceError = DrizzleError | S.SchemaError | AnyEmbeddingError | EventBusError;

/**
 * Outcome of applying one curation action to a claim or entity.
 *
 * **Example** (Record a successful correction)
 *
 * ```ts
 * import type { CurationResult } from "@effect-ontology/Service/Curation"
 *
 * const result: CurationResult = {
 *   action: "CorrectTripleAction",
 *   success: true,
 *   details: { claimId: "claim-ada-founded" }
 * }
 * console.log(result.success) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface CurationResult {
  readonly action: CurationAction["_tag"];
  readonly success: boolean;
  readonly details?: Record<string, unknown>;
}

// =============================================================================
// Service
// =============================================================================

/**
 * Applies curation actions to claims and entities and publishes follow-up jobs.
 *
 * **Example** (Compose a curation action)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { CurationService } from "@effect-ontology/Service/Curation"
 *
 * const program = Effect.gen(function* () {
 *   const curation = yield* CurationService
 *   return curation
 * }).pipe(Effect.provide(CurationService.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CurationService extends Context.Service<CurationService>()($I`CurationService`, {
  make: Effect.gen(function* () {
    const claimRepo = yield* ClaimRepository;
    const entityRegistry = yield* EntityRegistryRepository;
    const examplesRepo = yield* ExamplesRepository;
    const embeddingService = yield* EmbeddingService;
    const eventBus = yield* EventBusService;

    // -------------------------------------------------------------------------
    // Action Handlers
    // -------------------------------------------------------------------------

    const curationActionHandler = Match.type<CurationAction>().pipe(
      Match.tagsExhaustive({
        CorrectTripleAction: (value) => (now: DateTime.Utc) => handleCorrectTriple(value, now),
        MarkAsWrongAction: (value) => (now: DateTime.Utc) => handleMarkAsWrong(value, now),
        AddAliasAction: (value) => (now: DateTime.Utc) => handleAddAlias(value, now),
        PromoteToPreferredAction: (value) => (now: DateTime.Utc) => handlePromoteToPreferred(value, now),
        LinkToWikidataAction: (value) => (now: DateTime.Utc) => handleLinkToWikidata(value, now),
      })
    );

    /**
     * Apply a curation action and publish resulting events
     */
    const applyAction = Effect.fn("CurationService.applyAction")(function* (
      action: CurationAction
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
      const now = yield* DateTime.now;

      return yield* curationActionHandler(action)(now);
    });

    /**
     * Handle CorrectTripleAction
     */
    const handleCorrectTriple = Effect.fn("Curation.handleCorrectTriple")(function* (
      action: CorrectTripleAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
      // Get original claim
      const originalOpt = yield* claimRepo.getClaim(action.originalClaimId, action.ontologyId);
      if (O.isNone(originalOpt)) {
        yield* Effect.logWarning("Claim not found for correction", {
          claimId: action.originalClaimId,
        });
        return {
          action: "CorrectTripleAction",
          success: false,
          details: { reason: "claim_not_found" },
        };
      }

      const original = originalOpt.value;

      // Create correction record
      const correction = yield* claimRepo.insertCorrection({
        correctionType: "update",
        correctionDate: DateTime.toDate(now),
        reason: O.getOrElse(
          O.orElse(action.reason, () => action.note),
          () => "Manual correction"
        ),
      });

      // Deprecate original claim
      yield* claimRepo.deprecateClaim(action.originalClaimId, correction.id, action.ontologyId);

      // Create corrected claim
      const replacementObject = P.isString(action.replacement.object)
        ? action.replacement.object
        : action.replacement.object.value;
      const newClaim = yield* claimRepo.insertClaim({
        ontologyId: action.ontologyId,
        subjectIri: action.replacement.subject.value,
        predicateIri: action.replacement.predicate.value,
        objectValue: replacementObject,
        rank: "normal",
        articleId: original.articleId,
        confidenceScore: original.confidenceScore,
        validFrom: original.validFrom,
        validTo: original.validTo,
      });

      // Link claims to correction
      yield* claimRepo.linkClaimsToCorrection(correction.id, action.originalClaimId, newClaim.id);

      // Store as example if requested
      if (action.storeAsExample) {
        const example = yield* createExampleFromClaim(action.ontologyId, newClaim, original, false);

        // Queue prompt cache update job via EventBusService
        yield* eventBus.enqueueJob(
          PromptCacheJob.make({
            id: BackgroundJobId.fromContentHash(
              ContentHash.make(sha256SyncFull(`${action.ontologyId}:${example.id}:${DateTime.toEpochMillis(now)}`))
            ),
            ontologyId: action.ontologyId,
            exampleId: example.id,
            isNegative: false,
            createdAt: now,
          })
        );
      }

      // Publish event via EventBusService
      yield* eventBus.publishCurationEvent("ClaimCorrected", {
        ontologyId: action.ontologyId,
        originalClaimId: action.originalClaimId,
        newClaimId: ClaimId.make(newClaim.id),
        correctionId: correction.id,
        curatorId: action.curatorId,
        timestamp: now,
      });

      return {
        action: "CorrectTripleAction",
        success: true,
        details: { newClaimId: newClaim.id, correctionId: correction.id },
      };
    });

    /**
     * Handle MarkAsWrongAction
     */
    const handleMarkAsWrong = Effect.fn("Curation.handleMarkAsWrong")(function* (
      action: MarkAsWrongAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
      // Get claim
      const claimOpt = yield* claimRepo.getClaim(action.claimId, action.ontologyId);
      if (O.isNone(claimOpt)) {
        yield* Effect.logWarning("Claim not found for deprecation", {
          claimId: action.claimId,
        });
        return {
          action: "MarkAsWrongAction",
          success: false,
          details: { reason: "claim_not_found" },
        };
      }

      const claim = claimOpt.value;

      // Create correction record for deprecation
      const correction = yield* claimRepo.insertCorrection({
        correctionType: "retraction",
        correctionDate: DateTime.toDate(now),
        reason: O.getOrElse(
          O.orElse(action.note, () => action.errorCategory),
          () => "Marked as wrong"
        ),
      });

      // Deprecate the claim
      yield* claimRepo.deprecateClaim(action.claimId, correction.id, action.ontologyId);

      // Link claim to correction (no new claim)
      yield* claimRepo.linkClaimsToCorrection(correction.id, action.claimId);

      // Store as negative example if requested
      let negativeExampleId: string | undefined;
      if (action.storeAsNegativeExample !== false) {
        const example = yield* createNegativeExample(action.ontologyId, claim, action);
        negativeExampleId = example.id;

        // Queue prompt cache update job via EventBusService
        yield* eventBus.enqueueJob(
          PromptCacheJob.make({
            id: BackgroundJobId.fromContentHash(
              ContentHash.make(sha256SyncFull(`${action.ontologyId}:${example.id}:${DateTime.toEpochMillis(now)}`))
            ),
            ontologyId: action.ontologyId,
            exampleId: example.id,
            isNegative: true,
            createdAt: now,
          })
        );
      }

      // Publish event via EventBusService
      yield* eventBus.publishCurationEvent("ClaimDeprecated", {
        ontologyId: action.ontologyId,
        claimId: action.claimId,
        reason: O.orElse(action.errorCategory, () => action.note),
        negativeExampleId: O.fromNullishOr(negativeExampleId),
        curatorId: action.curatorId,
        timestamp: now,
      });

      return {
        action: "MarkAsWrongAction",
        success: true,
        details: { negativeExampleId },
      };
    });

    /**
     * Handle AddAliasAction
     */
    const handleAddAlias = Effect.fn("Curation.handleAddAlias")(function* (
      action: AddAliasAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
      // Find canonical entity by IRI
      const canonicalOpt = yield* entityRegistry.getCanonicalEntityByIri(
        action.ontologyId,
        action.canonicalEntity.value
      );
      if (O.isNone(canonicalOpt)) {
        yield* Effect.logWarning("Canonical entity not found for alias", {
          iri: action.canonicalEntity,
        });
        return {
          action: "AddAliasAction",
          success: false,
          details: { reason: "entity_not_found" },
        };
      }

      const canonical = canonicalOpt.value;
      const canonicalEntityId = yield* CanonicalEntityId.decodeEffect(canonical.id);

      // Embed the alias
      const prefixedMention = `${action.ontologyId}: ${action.aliasMention}`;
      const embedding = yield* embeddingService.embed(prefixedMention);

      // Insert alias
      const alias = yield* entityRegistry.insertAlias({
        ontologyId: action.ontologyId,
        canonicalEntityId,
        mention: action.aliasMention,
        mentionNormalized: normalizeEntityMention(action.aliasMention),
        embedding: embedding,
        resolutionMethod: action.resolutionMethod,
        resolutionConfidence: String(action.confidence),
      });

      // Rebuild blocking tokens
      yield* entityRegistry.rebuildBlockingTokens(
        action.ontologyId,
        canonicalEntityId,
        `${canonical.canonicalMention} ${action.aliasMention}`
      );

      // Queue embedding job to update canonical entity embedding via EventBusService
      yield* eventBus.enqueueJob(
        EmbeddingJob.make({
          id: BackgroundJobId.fromContentHash(
            ContentHash.make(sha256SyncFull(`${action.ontologyId}:${canonical.id}:${DateTime.toEpochMillis(now)}`))
          ),
          ontologyId: action.ontologyId,
          canonicalEntityId,
          reason: "alias_added",
          createdAt: now,
        })
      );

      // Publish event via EventBusService
      yield* eventBus.publishCurationEvent("AliasAdded", {
        ontologyId: action.ontologyId,
        canonicalEntity: action.canonicalEntity,
        aliasMention: action.aliasMention,
        aliasId: alias.id,
        curatorId: action.curatorId,
        timestamp: now,
      });

      return {
        action: "AddAliasAction",
        success: true,
        details: { aliasId: alias.id },
      };
    });

    /**
     * Handle PromoteToPreferredAction
     */
    const handlePromoteToPreferred = Effect.fn("Curation.handlePromoteToPreferred")(function* (
      action: PromoteToPreferredAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
      yield* claimRepo.promoteToPreferred(action.claimId, action.ontologyId);

      // Publish event via EventBusService
      yield* eventBus.publishCurationEvent("ClaimPromoted", {
        ontologyId: action.ontologyId,
        claimId: action.claimId,
        curatorId: action.curatorId,
        timestamp: now,
      });

      return {
        action: "PromoteToPreferredAction",
        success: true,
        details: { claimId: action.claimId },
      };
    });

    /**
     * Handle LinkToWikidataAction
     */
    const handleLinkToWikidata = Effect.fn("CurationService.handleLinkToWikidata")(function* (
      action: LinkToWikidataAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
      // Log the link - actual linking would involve updating the RDF store
      yield* Effect.logInfo("Wikidata link recorded", {
        entity: action.canonicalEntity,
        qid: action.wikidataQid,
        score: action.reconciliationScore,
      });

      // Publish event via EventBusService
      yield* eventBus.publishCurationEvent("EntityLinked", {
        ontologyId: action.ontologyId,
        canonicalEntity: action.canonicalEntity,
        wikidataQid: action.wikidataQid,
        reconciliationScore: action.reconciliationScore,
        curatorId: action.curatorId,
        timestamp: now,
      });

      return {
        action: "LinkToWikidataAction",
        success: true,
        details: { wikidataQid: action.wikidataQid },
      };
    });

    // -------------------------------------------------------------------------
    // Helper Functions
    // -------------------------------------------------------------------------

    /**
     * Create a positive example from a corrected claim
     */
    const createExampleFromClaim = Effect.fn("Curation.createExampleFromClaim")(function* (
      ontologyId: string,
      newClaim: {
        id: string;
        subjectIri: string;
        predicateIri: string;
        objectValue: string;
      },
      originalClaim: {
        subjectIri: string;
        predicateIri: string;
        objectValue: string;
      },
      isNegative: boolean
    ) {
      // Build input text from original claim
      const inputText = `Subject: ${originalClaim.subjectIri}, Predicate: ${originalClaim.predicateIri}, Object: ${originalClaim.objectValue}`;

      // Build expected output
      const expectedOutput = {
        subject: newClaim.subjectIri,
        predicate: newClaim.predicateIri,
        object: newClaim.objectValue,
      };

      const prefixedInput = `${ontologyId}: ${inputText}`;
      const embedding = yield* embeddingService.embed(prefixedInput);

      return yield* examplesRepo.create({
        ontologyId,
        exampleType: "entity_extraction",
        source: "validated",
        inputText,
        expectedOutput,
        embedding,
        isNegative,
        explanation: "Corrected claim - use as positive example",
      });
    });

    /**
     * Create a negative example from a wrong claim
     */
    const createNegativeExample = Effect.fn("Curation.createNegativeExample")(function* (
      ontologyId: string,
      claim: { subjectIri: string; predicateIri: string; objectValue: string },
      action: MarkAsWrongAction
    ) {
      const inputText = `Subject: ${claim.subjectIri}, Predicate: ${claim.predicateIri}, Object: ${claim.objectValue}`;

      const expectedOutput = {
        shouldNotExtract: true,
        errorCategory: O.getOrNull(action.errorCategory),
        pattern: O.getOrNull(action.negativePattern),
      };

      const prefixedInput = `${ontologyId}: ${inputText}`;
      const embedding = yield* embeddingService.embed(prefixedInput);

      return yield* examplesRepo.create({
        ontologyId,
        exampleType: "negative",
        source: "validated",
        inputText,
        expectedOutput,
        embedding,
        isNegative: true,
        ...O.getOrElse(
          O.map(action.negativePattern, (negativePattern) => ({ negativePattern })),
          () => ({})
        ),
        explanation: O.getOrElse(
          action.note,
          () => `Error category: ${O.getOrElse(action.errorCategory, () => "unknown")}`
        ),
      });
    });

    // -------------------------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------------------------

    /**
     * Subscribe to curation events (scoped - requires Effect.scoped)
     */
    const subscribe: Effect.Effect<Stream.Stream<EventEntry, EventBusError>, EventBusError> = eventBus.subscribeEvents;

    return {
      applyAction,
      subscribe,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
