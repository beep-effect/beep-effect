/**
 * Service: Reconciliation Service
 *
 * Orchestrates entity reconciliation against Wikidata with automatic linking
 * for high-confidence matches and queueing for human review of uncertain matches.
 *
 * @since 2.0.0
 * @module Service/ReconciliationService
 */

import { $ScratchpadId } from "@beep/identity";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Context, Data, Effect, Layer, Option, Schema } from "effect";
import * as DateTime from "effect/DateTime";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import { StorageService } from "./Storage.ts";
import type { WikidataApiError, WikidataRateLimitError } from "./WikidataClient.ts";
import { WikidataCandidate, WikidataClient } from "./WikidataClient.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ReconciliationService");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when reconciliation fails
 */
export class ReconciliationError extends Data.TaggedError("ReconciliationError")<{
  readonly message: string;
  readonly entityIri: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for entity reconciliation
 */
export class ReconciliationConfig extends Schema.Class<ReconciliationConfig>("ReconciliationConfig")({
  /** Minimum score for automatic linking (default: 90) */
  autoLinkThreshold: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 100 })).pipe(
    SchemaUtils.withKeyDefaults(90)
  ),

  /** Minimum score for queueing for review (default: 50) */
  queueThreshold: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 100 })).pipe(
    SchemaUtils.withKeyDefaults(50)
  ),

  /** Maximum candidates to consider (default: 5) */
  maxCandidates: Schema.Int.check(Schema.isGreaterThan(0)).pipe(SchemaUtils.withKeyDefaults(5)),

  /** Language for Wikidata search (default: "en") */
  language: Schema.String.pipe(SchemaUtils.withKeyDefaults("en")),
}) {}

const DEFAULT_CONFIG = ReconciliationConfig.make({});

/**
 * Result of entity reconciliation
 */
export interface ReconciliationResult {
  /** Entity IRI being reconciled */
  readonly entityIri: string;
  /** Original label used for search */
  readonly label: string;
  /** Decision made */
  readonly decision: ReconciliationDecision;
  /** Candidates considered */
  readonly candidates: ReadonlyArray<WikidataCandidate>;
  /** Best match if any */
  readonly bestMatch?: WikidataCandidate;
  /** Verification task ID if queued */
  readonly verificationTaskId?: string;
}

export type ReconciliationDecision =
  | "auto_linked" // Score >= autoLinkThreshold, link created
  | "queued" // Score in queueThreshold..autoLinkThreshold, needs review
  | "no_match" // Score < queueThreshold or no candidates
  | "skipped"; // Already linked or other reason to skip

/**
 * Verification task for human review
 */
export const VerificationTask = Schema.Struct({
  id: Schema.String,
  entityIri: Schema.String,
  label: Schema.String,
  candidates: Schema.Array(WikidataCandidate),
  createdAt: Schema.DateFromString,
  status: Schema.Literals(["pending", "approved", "rejected"]),
  approvedQid: Schema.optionalKey(Schema.String),
});
export type VerificationTask = typeof VerificationTask.Type;

const WikidataLink = Schema.Struct({
  entityIri: Schema.String,
  qid: Schema.String,
  wikidataUri: Schema.String,
  linkedAt: Schema.String,
});

const VerificationTaskJson = Schema.fromJsonString(VerificationTask, { space: 2 });
const WikidataLinkJson = Schema.fromJsonString(WikidataLink, { space: 2 });
const decodeVerificationTask = Schema.decodeUnknownEffect(VerificationTaskJson);
const decodeVerificationTaskOption = Schema.decodeUnknownOption(VerificationTaskJson);
const encodeVerificationTask = Schema.encodeEffect(VerificationTaskJson);
const decodeWikidataLinkOption = Schema.decodeUnknownOption(WikidataLinkJson);
const encodeWikidataLink = Schema.encodeEffect(WikidataLinkJson);

// =============================================================================
// Service
// =============================================================================

export class ReconciliationService extends Context.Service<ReconciliationService>()($I`ReconciliationService`, {
  make: Effect.gen(function* () {
    const wikidata = yield* WikidataClient;
    const storage = yield* StorageService;

    // Storage keys
    const LINKS_PREFIX = "reconciliation/links/";
    const QUEUE_PREFIX = "reconciliation/queue/";

    /**
     * Generate a unique task ID
     */
    const generateTaskId = Effect.fn("ReconciliationService.generateTaskId")(function* () {
      const timestamp = (yield* DateTime.now).epochMilliseconds.toString(36);
      const random = (yield* Random.nextIntBetween(0, 2_176_782_336)).toString(36).padStart(6, "0");
      return `task-${timestamp}-${random}`;
    });

    /**
     * Reconcile an entity against Wikidata
     */
    const reconcileEntity = (
      entityIri: string,
      label: string,
      types: ReadonlyArray<string> = [],
      config: ReconciliationConfig = DEFAULT_CONFIG
    ): Effect.Effect<ReconciliationResult, ReconciliationError | WikidataApiError | WikidataRateLimitError> =>
      Effect.gen(function* () {
        yield* Effect.logDebug("Reconciling entity", { entityIri, label, types });

        // Check if already linked
        const existingLinkOpt = yield* storage.get(`${LINKS_PREFIX}${encodeURIComponent(entityIri)}`).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to check existing link: ${e}`,
                entityIri,
                cause: e,
              })
          )
        );

        if (existingLinkOpt !== undefined) {
          yield* Effect.logDebug("Entity already linked", { entityIri });
          return {
            entityIri,
            label,
            decision: "skipped" as const,
            candidates: [],
          };
        }

        // Search Wikidata
        const candidates = yield* wikidata.searchEntities(label, {
          language: config.language,
          limit: config.maxCandidates,
        });

        if (candidates.length === 0) {
          yield* Effect.logDebug("No candidates found", { entityIri, label });
          return {
            entityIri,
            label,
            decision: "no_match" as const,
            candidates: [],
          };
        }

        const bestMatch = candidates[0];

        // Decision based on score
        if (bestMatch.score >= config.autoLinkThreshold) {
          // Auto-link
          yield* storeWikidataLink(entityIri, bestMatch.qid);
          yield* Effect.logInfo("Auto-linked entity", {
            entityIri,
            qid: bestMatch.qid,
            score: bestMatch.score,
          });

          return {
            entityIri,
            label,
            decision: "auto_linked" as const,
            candidates,
            bestMatch,
          };
        } else if (bestMatch.score >= config.queueThreshold) {
          // Queue for review
          const taskId = yield* queueForVerification(entityIri, label, candidates);
          yield* Effect.logInfo("Queued entity for verification", {
            entityIri,
            taskId,
            score: bestMatch.score,
          });

          return {
            entityIri,
            label,
            decision: "queued" as const,
            candidates,
            bestMatch,
            verificationTaskId: taskId,
          };
        } else {
          // No match
          yield* Effect.logDebug("No confident match", {
            entityIri,
            bestScore: bestMatch.score,
          });

          return {
            entityIri,
            label,
            decision: "no_match" as const,
            candidates,
            bestMatch,
          };
        }
      });

    /**
     * Store a Wikidata link (owl:sameAs)
     */
    const storeWikidataLink = (entityIri: string, qid: string): Effect.Effect<void, ReconciliationError> =>
      Effect.gen(function* () {
        const wikidataUri = `http://www.wikidata.org/entity/${qid}`;

        // Store the link mapping
        const linkData = yield* encodeWikidataLink({
          entityIri,
          qid,
          wikidataUri,
          linkedAt: DateTime.toDateUtc(yield* DateTime.now).toISOString(),
        }).pipe(
          Effect.mapError(
            (cause) =>
              new ReconciliationError({
                message: `Failed to encode Wikidata link: ${cause}`,
                entityIri,
                cause,
              })
          )
        );

        yield* storage.set(`${LINKS_PREFIX}${encodeURIComponent(entityIri)}`, linkData).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to store link: ${e}`,
                entityIri,
                cause: e,
              })
          )
        );

        yield* Effect.logDebug("Stored Wikidata link", { entityIri, qid });
      });

    /**
     * Queue an entity for human verification
     */
    const queueForVerification = (
      entityIri: string,
      label: string,
      candidates: ReadonlyArray<WikidataCandidate>
    ): Effect.Effect<string, ReconciliationError> =>
      Effect.gen(function* () {
        const taskId = yield* generateTaskId();

        const task: VerificationTask = {
          id: taskId,
          entityIri,
          label,
          candidates,
          createdAt: DateTime.toDateUtc(yield* DateTime.now),
          status: "pending",
        };

        const taskJson = yield* encodeVerificationTask(task).pipe(
          Effect.mapError(
            (cause) =>
              new ReconciliationError({
                message: `Failed to encode verification task: ${cause}`,
                entityIri,
                cause,
              })
          )
        );

        yield* storage.set(`${QUEUE_PREFIX}${taskId}`, taskJson).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to queue verification: ${e}`,
                entityIri,
                cause: e,
              })
          )
        );

        return taskId;
      });

    /**
     * Get pending verification tasks
     */
    const getPendingTasks: Effect.Effect<ReadonlyArray<VerificationTask>, ReconciliationError> = Effect.gen(
      function* () {
        const taskKeys = yield* storage.list(QUEUE_PREFIX).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to list tasks: ${e}`,
                entityIri: "",
                cause: e,
              })
          )
        );

        const tasks: Array<VerificationTask> = [];

        for (const key of taskKeys) {
          const contentOpt = yield* storage.get(key).pipe(
            Effect.mapError(
              (e) =>
                new ReconciliationError({
                  message: `Failed to read task: ${e}`,
                  entityIri: "",
                  cause: e,
                })
            )
          );

          if (P.isNotUndefined(contentOpt)) {
            const task = decodeVerificationTaskOption(contentOpt);
            if (Option.isSome(task) && task.value.status === "pending") {
              tasks.push(task.value);
            }
          }
        }

        // Sort by creation date
        tasks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        return tasks;
      }
    );

    /**
     * Approve a verification task
     */
    const approveTask = (taskId: string, qid: string): Effect.Effect<void, ReconciliationError> =>
      Effect.gen(function* () {
        const taskKey = `${QUEUE_PREFIX}${taskId}`;
        const contentOpt = yield* storage.get(taskKey).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to read task: ${e}`,
                entityIri: "",
                cause: e,
              })
          )
        );

        if (P.isUndefined(contentOpt)) {
          return yield* new ReconciliationError({
            message: `Task not found: ${taskId}`,
            entityIri: "",
          });
        }

        const task = yield* decodeVerificationTask(contentOpt).pipe(
          Effect.mapError(
            (cause) =>
              new ReconciliationError({
                message: `Failed to decode verification task: ${cause}`,
                entityIri: "",
                cause,
              })
          )
        );

        // Store the link
        yield* storeWikidataLink(task.entityIri, qid);

        // Update task status
        const updatedTask: VerificationTask = {
          ...task,
          status: "approved",
          approvedQid: qid,
        };

        const updatedTaskJson = yield* encodeVerificationTask(updatedTask).pipe(
          Effect.mapError(
            (cause) =>
              new ReconciliationError({
                message: `Failed to encode verification task: ${cause}`,
                entityIri: task.entityIri,
                cause,
              })
          )
        );

        yield* storage.set(taskKey, updatedTaskJson).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to update task: ${e}`,
                entityIri: task.entityIri,
                cause: e,
              })
          )
        );

        yield* Effect.logInfo("Approved verification task", { taskId, qid });
      });

    /**
     * Reject a verification task
     */
    const rejectTask = (taskId: string): Effect.Effect<void, ReconciliationError> =>
      Effect.gen(function* () {
        const taskKey = `${QUEUE_PREFIX}${taskId}`;
        const contentOpt = yield* storage.get(taskKey).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to read task: ${e}`,
                entityIri: "",
                cause: e,
              })
          )
        );

        if (P.isUndefined(contentOpt)) {
          return yield* new ReconciliationError({
            message: `Task not found: ${taskId}`,
            entityIri: "",
          });
        }

        const task = yield* decodeVerificationTask(contentOpt).pipe(
          Effect.mapError(
            (cause) =>
              new ReconciliationError({
                message: `Failed to decode verification task: ${cause}`,
                entityIri: "",
                cause,
              })
          )
        );

        // Update task status
        const updatedTask: VerificationTask = {
          ...task,
          status: "rejected",
        };

        const updatedTaskJson = yield* encodeVerificationTask(updatedTask).pipe(
          Effect.mapError(
            (cause) =>
              new ReconciliationError({
                message: `Failed to encode verification task: ${cause}`,
                entityIri: task.entityIri,
                cause,
              })
          )
        );

        yield* storage.set(taskKey, updatedTaskJson).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to update task: ${e}`,
                entityIri: task.entityIri,
                cause: e,
              })
          )
        );

        yield* Effect.logInfo("Rejected verification task", { taskId });
      });

    /**
     * Get link for an entity if it exists
     */
    const getLink = (
      entityIri: string
    ): Effect.Effect<Option.Option<{ qid: string; wikidataUri: string }>, ReconciliationError> =>
      Effect.gen(function* () {
        const contentOpt = yield* storage.get(`${LINKS_PREFIX}${encodeURIComponent(entityIri)}`).pipe(
          Effect.mapError(
            (e) =>
              new ReconciliationError({
                message: `Failed to get link: ${e}`,
                entityIri,
                cause: e,
              })
          )
        );

        if (P.isUndefined(contentOpt)) {
          return Option.none();
        }

        return Option.map(decodeWikidataLinkOption(contentOpt), (data) => ({
          qid: data.qid,
          wikidataUri: data.wikidataUri,
        }));
      });

    /**
     * Batch reconcile multiple entities
     */
    const reconcileBatch = (
      entities: ReadonlyArray<{ iri: string; label: string; types?: ReadonlyArray<string> }>,
      config: ReconciliationConfig = DEFAULT_CONFIG
    ): Effect.Effect<
      ReadonlyArray<ReconciliationResult>,
      ReconciliationError | WikidataApiError | WikidataRateLimitError
    > =>
      Effect.forEach(
        entities,
        (entity) => reconcileEntity(entity.iri, entity.label, entity.types ?? [], config),
        { concurrency: 1 } // Sequential to respect rate limits
      );

    return {
      reconcileEntity,
      storeWikidataLink,
      queueForVerification,
      getPendingTasks,
      approveTask,
      rejectTask,
      getLink,
      reconcileBatch,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
