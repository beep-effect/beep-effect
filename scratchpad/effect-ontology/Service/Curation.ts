/**
 * Curation Service
 *
 * Service for applying curation actions to claims and entities.
 * Handles corrections, deprecations, alias additions, and rank promotions.
 * Publishes events via EventBusService and queues background jobs for async processing.
 *
 * @since 2.0.0
 * @module Service/Curation
 */

import type {EffectDrizzleQueryError} from "drizzle-orm/effect-core/errors";
import type {SqlError} from "effect/unstable/sql";
import type {Stream} from "effect";
import {DateTime, Effect, Option, Context, Layer, Predicate, String as Str} from "effect";
import type {DrizzleError} from "@beep/drizzle";
import type {AnyEmbeddingError} from "../Domain/Error/Embedding.ts";
import type {EventBusError} from "../Domain/Error/EventBus.ts";
import type {
  AddAliasAction,
  CorrectTripleAction,
  CurationAction,
  LinkToWikidataAction,
  MarkAsWrongAction,
  PromoteToPreferredAction
} from "../Domain/Schema/CurationAction.ts";
import {BackgroundJobId, EmbeddingJob, PromptCacheJob} from "../Domain/Schema/JobSchema.ts";
import {ClaimId} from "../Domain/Schema/KnowledgeModel.ts";
import {EntityId} from "../Domain/Model/shared.ts";
import {ContentHash} from "../Domain/Identity.ts";
import {ClaimRepository} from "../Repository/Claim.ts";
import {EntityRegistryRepository} from "../Repository/EntityRegistry.ts";
import {ExamplesRepository} from "../Repository/Examples.ts";
import {EmbeddingService} from "./Embedding.ts";
import {EventBusService, type EventEntry} from "./EventBus.ts";
import {$ScratchpadId} from "@beep/identity";
import {sha256SyncFull} from "../Utils/Hash.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Curation");

// =============================================================================
// Types
// =============================================================================

/**
 * Combined error type for curation service operations
 */
export type CurationServiceError =
  DrizzleError
  | EffectDrizzleQueryError
  | SqlError.SqlError
  | AnyEmbeddingError
  | EventBusError

/**
 * Result of applying a curation action
 */
export interface CurationResult {
  readonly action: CurationAction["_tag"];
  readonly success: boolean;
  readonly details?: Record<string, unknown>;
}

// =============================================================================
// Service
// =============================================================================

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

    /**
     * Apply a curation action and publish resulting events
     */
    const applyAction = Effect.fn("CurationService.applyAction")(function* (
      action: CurationAction
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
        const now = yield* DateTime.now;

        const result: CurationResult = yield* (() => {
          switch (action._tag) {
            case "CorrectTripleAction":
              return handleCorrectTriple(action, now);
            case "MarkAsWrongAction":
              return handleMarkAsWrong(action, now);
            case "AddAliasAction":
              return handleAddAlias(action, now);
            case "PromoteToPreferredAction":
              return handlePromoteToPreferred(action, now);
            case "LinkToWikidataAction":
              return handleLinkToWikidata(action, now);
          }
        })();

        return result;
      });

    /**
     * Handle CorrectTripleAction
     */
    const handleCorrectTriple =
      Effect.fn(function* (
        action: CorrectTripleAction,
        now: DateTime.Utc
      ): Effect.fn.Return<CurationResult, CurationServiceError> {
        // Get original claim
        const originalOpt = yield* claimRepo.getClaim(action.originalClaimId);
        if (Option.isNone(originalOpt)) {
          yield* Effect.logWarning("Claim not found for correction", {
            claimId: action.originalClaimId
          });
          return {
            action: "CorrectTripleAction",
            success: false,
            details: {reason: "claim_not_found"}
          };
        }

        const original = originalOpt.value;

        // Create correction record
        const correction = yield* claimRepo.insertCorrection({
          correctionType: "update",
          correctionDate: DateTime.toDate(now),
          reason: Option.getOrElse(Option.orElse(action.reason, () => action.note), () => "Manual correction")
        });

        // Deprecate original claim
        yield* claimRepo.deprecateClaim(action.originalClaimId, correction.id);

        // Create corrected claim
        const replacementObject = Predicate.isString(action.replacement.object)
          ? action.replacement.object
          : action.replacement.object.value;
        const newClaim = yield* claimRepo.insertClaim({
          ontologyId: action.ontologyId,
          subjectIri: action.replacement.subject,
          predicateIri: action.replacement.predicate,
          objectValue: replacementObject,
          rank: "normal",
          articleId: original.articleId,
          confidenceScore: original.confidenceScore,
          validFrom: original.validFrom,
          validTo: original.validTo
        });

        // Link claims to correction
        yield* claimRepo.linkClaimsToCorrection(
          correction.id,
          action.originalClaimId,
          newClaim.id
        );

        // Store as example if requested
        if (action.storeAsExample) {
          const example = yield* createExampleFromClaim(
            action.ontologyId,
            newClaim,
            original,
            false
          );

          // Queue prompt cache update job via EventBusService
          yield* eventBus.enqueueJob(
            PromptCacheJob.make({
              id: BackgroundJobId.fromContentHash(
                ContentHash.make(sha256SyncFull(`${action.ontologyId}:${example.id}:${DateTime.toEpochMillis(now)}`))
              ),
              ontologyId: action.ontologyId,
              exampleId: example.id,
              isNegative: false,
              createdAt: now
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
          timestamp: now
        });

        return {
          action: "CorrectTripleAction",
          success: true,
          details: {newClaimId: newClaim.id, correctionId: correction.id}
        };
      });

    /**
     * Handle MarkAsWrongAction
     */
    const handleMarkAsWrong =
      Effect.fn(function* (
      action: MarkAsWrongAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
        // Get claim
        const claimOpt = yield* claimRepo.getClaim(action.claimId);
        if (Option.isNone(claimOpt)) {
          yield* Effect.logWarning("Claim not found for deprecation", {
            claimId: action.claimId
          });
          return {
            action: "MarkAsWrongAction",
            success: false,
            details: {reason: "claim_not_found"}
          };
        }

        const claim = claimOpt.value;

        // Create correction record for deprecation
        const correction = yield* claimRepo.insertCorrection({
          correctionType: "retraction",
          correctionDate: DateTime.toDate(now),
          reason: Option.getOrElse(Option.orElse(action.note, () => action.errorCategory), () => "Marked as wrong")
        });

        // Deprecate the claim
        yield* claimRepo.deprecateClaim(action.claimId, correction.id);

        // Link claim to correction (no new claim)
        yield* claimRepo.linkClaimsToCorrection(
          correction.id,
          action.claimId
        );

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
              createdAt: now
            })
          );
        }

        // Publish event via EventBusService
        yield* eventBus.publishCurationEvent("ClaimDeprecated", {
          ontologyId: action.ontologyId,
          claimId: action.claimId,
          reason: Option.orElse(action.errorCategory, () => action.note),
          negativeExampleId: Option.fromNullishOr(negativeExampleId),
          curatorId: action.curatorId,
          timestamp: now
        });

        return {
          action: "MarkAsWrongAction",
          success: true,
          details: {negativeExampleId}
        };
      });

    /**
     * Handle AddAliasAction
     */
    const handleAddAlias =
      Effect.fn(function* (
      action: AddAliasAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
        // Find canonical entity by IRI
        const canonicalOpt = yield* entityRegistry.getCanonicalEntityByIri(action.canonicalEntity);
        if (Option.isNone(canonicalOpt)) {
          yield* Effect.logWarning("Canonical entity not found for alias", {
            iri: action.canonicalEntity
          });
          return {
            action: "AddAliasAction",
            success: false,
            details: {reason: "entity_not_found"}
          };
        }

        const canonical = canonicalOpt.value;

        // Embed the alias
        const prefixedMention = `${action.ontologyId}: ${action.aliasMention}`;
        const embedding = yield* embeddingService.embed(prefixedMention);

        // Insert alias
        const alias = yield* entityRegistry.insertAlias({
          ontologyId: action.ontologyId,
          canonicalEntityId: canonical.id,
          mention: action.aliasMention,
          mentionNormalized: Str.trim(Str.toLowerCase(action.aliasMention)),
          embedding: embedding as Array<number>,
          resolutionMethod: action.resolutionMethod,
          resolutionConfidence: String(action.confidence)
        });

        // Rebuild blocking tokens
        yield* entityRegistry.rebuildBlockingTokens(
          action.ontologyId,
          canonical.id,
          `${canonical.canonicalMention} ${action.aliasMention}`
        );

        // Queue embedding job to update canonical entity embedding via EventBusService
        yield* eventBus.enqueueJob(
          EmbeddingJob.make({
            id: BackgroundJobId.fromContentHash(
              ContentHash.make(sha256SyncFull(`${action.ontologyId}:${canonical.id}:${DateTime.toEpochMillis(now)}`))
            ),
            ontologyId: action.ontologyId,
            canonicalEntityId: EntityId.make(canonical.id),
            reason: "alias_added",
            createdAt: now
          })
        );

        // Publish event via EventBusService
        yield* eventBus.publishCurationEvent("AliasAdded", {
          ontologyId: action.ontologyId,
          canonicalEntity: action.canonicalEntity,
          aliasMention: action.aliasMention,
          aliasId: alias.id,
          curatorId: action.curatorId,
          timestamp: now
        });

        return {
          action: "AddAliasAction",
          success: true,
          details: {aliasId: alias.id}
        };
      });

    /**
     * Handle PromoteToPreferredAction
     */
    const handlePromoteToPreferred =
      Effect.fn(function* (
      action: PromoteToPreferredAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
        yield* claimRepo.promoteToPreferred(action.claimId);

        // Publish event via EventBusService
        yield* eventBus.publishCurationEvent("ClaimPromoted", {
          ontologyId: action.ontologyId,
          claimId: action.claimId,
          curatorId: action.curatorId,
          timestamp: now
        });

        return {
          action: "PromoteToPreferredAction",
          success: true,
          details: {claimId: action.claimId}
        };
      });

    /**
     * Handle LinkToWikidataAction
     */
    const handleLinkToWikidata =
      Effect.fn("CurationService.handleLinkToWikidata")(function* (
      action: LinkToWikidataAction,
      now: DateTime.Utc
    ): Effect.fn.Return<CurationResult, CurationServiceError> {
        // Log the link - actual linking would involve updating the RDF store
        yield* Effect.logInfo("Wikidata link recorded", {
          entity: action.canonicalEntity,
          qid: action.wikidataQid,
          score: action.reconciliationScore
        });

        // Publish event via EventBusService
        yield* eventBus.publishCurationEvent("EntityLinked", {
          ontologyId: action.ontologyId,
          canonicalEntity: action.canonicalEntity,
          wikidataQid: action.wikidataQid,
          reconciliationScore: action.reconciliationScore,
          curatorId: action.curatorId,
          timestamp: now
        });

        return {
          action: "LinkToWikidataAction",
          success: true,
          details: {wikidataQid: action.wikidataQid}
        };
      });

    // -------------------------------------------------------------------------
    // Helper Functions
    // -------------------------------------------------------------------------

    /**
     * Create a positive example from a corrected claim
     */
    const createExampleFromClaim =
      Effect.fn(function* (
      ontologyId: string,
      newClaim: {
        id: string;
        subjectIri: string;
        predicateIri: string;
        objectValue: string
      },
      originalClaim: {
        subjectIri: string;
        predicateIri: string;
        objectValue: string
      },
      isNegative: boolean
    ) {
        // Build input text from original claim
        const inputText =
          `Subject: ${originalClaim.subjectIri}, Predicate: ${originalClaim.predicateIri}, Object: ${originalClaim.objectValue}`;

        // Build expected output
        const expectedOutput = {
          subject: newClaim.subjectIri,
          predicate: newClaim.predicateIri,
          object: newClaim.objectValue
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
          explanation: "Corrected claim - use as positive example"
        });
      });

    /**
     * Create a negative example from a wrong claim
     */
    const createNegativeExample =
      Effect.fn(function* (
      ontologyId: string,
      claim: { subjectIri: string; predicateIri: string; objectValue: string },
      action: MarkAsWrongAction
    ) {
        const inputText = `Subject: ${claim.subjectIri}, Predicate: ${claim.predicateIri}, Object: ${claim.objectValue}`;

        const expectedOutput = {
          shouldNotExtract: true,
          errorCategory: Option.getOrNull(action.errorCategory),
          pattern: Option.getOrNull(action.negativePattern)
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
          ...Option.getOrElse(
            Option.map(action.negativePattern, (negativePattern) => ({ negativePattern })),
            () => ({})
          ),
          explanation: Option.getOrElse(
            action.note,
            () => `Error category: ${Option.getOrElse(action.errorCategory, () => "unknown")}`
          )
        });
      });

    // -------------------------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------------------------

    /**
     * Subscribe to curation events (scoped - requires Effect.scoped)
     */
    const subscribe = (): Effect.Effect<Stream.Stream<EventEntry, EventBusError>, EventBusError> =>
      eventBus.subscribeEvents();

    return {
      applyAction,
      subscribe
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
