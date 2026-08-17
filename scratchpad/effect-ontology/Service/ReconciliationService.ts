/**
 * Service: Reconciliation Service
 *
 * **Details**
 *
 * Orchestrates entity reconciliation against Wikidata with automatic linking
 * for high-confidence matches and queueing for human review of uncertain matches.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { PosInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Context, DateTime, Effect, Layer, Order, Random } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import { StorageService } from "./Storage.ts";
import type { WikidataApiError, WikidataRateLimitError } from "./WikidataClient.ts";
import { WikidataCandidate, WikidataClient } from "./WikidataClient.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ReconciliationService");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when reconciliation fails
 *
 * **Example** (Inspect reconciliation error)
 *
 * ```ts
 * import { ReconciliationError } from "@effect-ontology/Service/ReconciliationService"
 *
 * console.log(ReconciliationError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReconciliationError extends S.TaggedError<ReconciliationError>($I`ReconciliationError`)(
  "ReconciliationError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable entity reconciliation failure diagnostic.",
    }),
    entityIri: S.String.annotateKey({
      description: "Entity IRI associated with the failure, or an empty string for queue-wide operations.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying Wikidata, storage, or decoding defect.",
    }),
  },
  $I.annote("ReconciliationError", {
    description: "Failure while reconciling a local entity with Wikidata.",
  })
) {
  static readonly is = S.is(this);
}

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for entity reconciliation
 *
 * **Example** (Inspect reconciliation config)
 *
 * ```ts
 * import { ReconciliationConfig } from "@effect-ontology/Service/ReconciliationService"
 *
 * console.log(ReconciliationConfig)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReconciliationConfig extends S.Class<ReconciliationConfig>("ReconciliationConfig")({
  /** Minimum score for automatic linking (default: 90) */
  autoLinkThreshold: Percentage.pipe(SchemaUtils.withKeyDefaults(Percentage.make(90))),

  /** Minimum score for queueing for review (default: 50) */
  queueThreshold: Percentage.pipe(SchemaUtils.withKeyDefaults(Percentage.make(50))),

  /** Maximum candidates to consider (default: 5) */
  maxCandidates: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(5))),

  /** Language for Wikidata search (default: "en") */
  language: S.String.pipe(SchemaUtils.withKeyDefaults("en")),
}) {}

const DEFAULT_CONFIG = ReconciliationConfig.make({});

/**
 * Result of entity reconciliation
 *
 *
 * **Example** (Use the ReconciliationResult contract)
 *
 * ```ts
 * import type { ReconciliationResult } from "@effect-ontology/Service/ReconciliationService"
 *
 * const acceptsReconciliationResult = (_value: ReconciliationResult): void => undefined
 *
 * console.log(acceptsReconciliationResult)
 * ```
 *
 * @category type-level
 * @since 0.0.0
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

/**
 * Describes the reconciliation decision data exposed by this module.
 *
 *
 * **Example** (Use the ReconciliationDecision contract)
 *
 * ```ts
 * import type { ReconciliationDecision } from "@effect-ontology/Service/ReconciliationService"
 *
 * const acceptsReconciliationDecision = (_value: ReconciliationDecision): void => undefined
 *
 * console.log(acceptsReconciliationDecision)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReconciliationDecision =
  | "auto_linked" // Score >= autoLinkThreshold, link created
  | "queued" // Score in queueThreshold..autoLinkThreshold, needs review
  | "no_match" // Score < queueThreshold or no candidates
  | "skipped"; // Already linked or other reason to skip

/**
 * Verification task for human review
 *
 * **Example** (Validate verification task)
 *
 * ```ts
 * import { VerificationTask } from "@effect-ontology/Service/ReconciliationService"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(VerificationTask)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VerificationTask = S.Struct({
  id: S.String,
  entityIri: S.String,
  label: S.String,
  candidates: S.Array(WikidataCandidate),
  createdAt: S.DateFromString,
  status: S.Literals(["pending", "approved", "rejected"]),
  approvedQid: S.optionalKey(S.String),
});
/**
 * Describes the verification task data exposed by this module.
 *
 *
 * **Example** (Use the VerificationTask contract)
 *
 * ```ts
 * import type { VerificationTask } from "@effect-ontology/Service/ReconciliationService"
 *
 * const acceptsVerificationTask = (_value: VerificationTask): void => undefined
 *
 * console.log(acceptsVerificationTask)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type VerificationTask = typeof VerificationTask.Type;

const WikidataLink = S.Struct({
  entityIri: S.String,
  qid: S.String,
  wikidataUri: S.String,
  linkedAt: S.String,
});

const VerificationTaskJson = S.fromJsonString(VerificationTask, { space: 2 });
const WikidataLinkJson = S.fromJsonString(WikidataLink, { space: 2 });
const decodeVerificationTask = S.decodeUnknownEffect(VerificationTaskJson);
const decodeVerificationTaskOption = S.decodeUnknownOption(VerificationTaskJson);
const encodeVerificationTask = S.encodeEffect(VerificationTaskJson);
const decodeWikidataLinkOption = S.decodeUnknownOption(WikidataLinkJson);
const encodeWikidataLink = S.encodeEffect(WikidataLinkJson);

// =============================================================================
// Service
// =============================================================================

/**
 * Provides the reconciliation service service capability.
 *
 * **Example** (Inspect reconciliation service)
 *
 * ```ts
 * import { ReconciliationService } from "@effect-ontology/Service/ReconciliationService"
 *
 * console.log(ReconciliationService)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
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
    const reconcileEntity = Effect.fn("ReconciliationService.reconcileEntity")(function* (
      entityIri: string,
      label: string,
      types: ReadonlyArray<string> = [],
      config: ReconciliationConfig = DEFAULT_CONFIG
    ): Effect.fn.Return<ReconciliationResult, ReconciliationError | WikidataApiError | WikidataRateLimitError> {
      yield* Effect.logDebug("Reconciling entity", { entityIri, label, types });

      // Check if already linked
      const existingLinkOpt = yield* storage.getOption(`${LINKS_PREFIX}${encodeURIComponent(entityIri)}`).pipe(
        Effect.mapError((e) =>
          ReconciliationError.make({
            message: `Failed to check existing link: ${e}`,
            entityIri,
            cause: O.some(e),
          })
        )
      );

      if (O.isSome(existingLinkOpt)) {
        yield* Effect.logDebug("Entity already linked", { entityIri });
        return {
          entityIri,
          label,
          decision: "skipped",
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
          decision: "no_match",
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
          decision: "auto_linked",
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
          decision: "queued",
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
          decision: "no_match",
          candidates,
          bestMatch,
        };
      }
    });

    /**
     * Store a Wikidata link (owl:sameAs)
     */
    const storeWikidataLink = Effect.fn("storeWikidataLink")(function* (entityIri: string, qid: string) {
      const wikidataUri = `https://www.wikidata.org/entity/${qid}`;
      const linkData = yield* encodeWikidataLink({
        entityIri,
        qid,
        wikidataUri,
        linkedAt: DateTime.toDateUtc(yield* DateTime.now).toISOString(),
      }).pipe(
        Effect.mapError((cause) =>
          ReconciliationError.make({
            message: `Failed to encode Wikidata link: ${cause}`,
            entityIri,
            cause: O.some(cause),
          })
        )
      );
      yield* storage.set(`${LINKS_PREFIX}${encodeURIComponent(entityIri)}`, linkData).pipe(
        Effect.mapError((e) =>
          ReconciliationError.make({
            message: `Failed to store link: ${e}`,
            entityIri,
            cause: O.some(e),
          })
        )
      );
      yield* Effect.logDebug("Stored Wikidata link", { entityIri, qid });
    });

    /**
     * Queue an entity for human verification
     */
    const queueForVerification = Effect.fn("ReconciliationService.queueForVerification")(function* (
      entityIri: string,
      label: string,
      candidates: ReadonlyArray<WikidataCandidate>
    ) {
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
        Effect.mapError((cause) =>
          ReconciliationError.make({
            message: `Failed to encode verification task: ${cause}`,
            entityIri,
            cause: O.some(cause),
          })
        )
      );
      yield* storage.set(`${QUEUE_PREFIX}${taskId}`, taskJson).pipe(
        Effect.mapError((e) =>
          ReconciliationError.make({
            message: `Failed to queue verification: ${e}`,
            entityIri,
            cause: O.some(e),
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
          Effect.mapError((e) =>
            ReconciliationError.make({
              message: `Failed to list tasks: ${e}`,
              entityIri: "",
              cause: O.some(e),
            })
          )
        );

        const tasks: Array<VerificationTask> = [];

        for (const key of taskKeys) {
          const contentOpt = yield* storage.getOption(key).pipe(
            Effect.mapError((e) =>
              ReconciliationError.make({
                message: `Failed to read task: ${e}`,
                entityIri: "",
                cause: O.some(e),
              })
            )
          );

          if (O.isSome(contentOpt)) {
            const task = decodeVerificationTaskOption(contentOpt.value);
            if (O.isSome(task) && task.value.status === "pending") {
              tasks.push(task.value);
            }
          }
        }

        // Sort by creation date
        return A.sort(
          tasks,
          Order.mapInput(Order.Number, (task: VerificationTask) => task.createdAt.getTime())
        );
      }
    );

    /**
     * Approve a verification task
     */
    const approveTask = Effect.fn("ReconciliationService.approveTask")(function* (
      taskId: string,
      qid: string
    ): Effect.fn.Return<void, ReconciliationError> {
      const taskKey = `${QUEUE_PREFIX}${taskId}`;
      const contentOpt = yield* storage.getOption(taskKey).pipe(
        Effect.mapError((e) =>
          ReconciliationError.make({
            message: `Failed to read task: ${e}`,
            entityIri: "",
            cause: O.some(e),
          })
        )
      );
      if (O.isNone(contentOpt)) {
        return yield* ReconciliationError.make({
          message: `Task not found: ${taskId}`,
          entityIri: "",
        });
      }
      const task = yield* decodeVerificationTask(contentOpt.value).pipe(
        Effect.mapError((cause) =>
          ReconciliationError.make({
            message: `Failed to decode verification task: ${cause}`,
            entityIri: "",
            cause: O.some(cause),
          })
        )
      );
      yield* storeWikidataLink(task.entityIri, qid);
      const updatedTask: VerificationTask = {
        ...task,
        status: "approved",
        approvedQid: qid,
      };
      const updatedTaskJson = yield* encodeVerificationTask(updatedTask).pipe(
        Effect.mapError((cause) =>
          ReconciliationError.make({
            message: `Failed to encode verification task: ${cause}`,
            entityIri: task.entityIri,
            cause: O.some(cause),
          })
        )
      );
      yield* storage.set(taskKey, updatedTaskJson).pipe(
        Effect.mapError((e) =>
          ReconciliationError.make({
            message: `Failed to update task: ${e}`,
            entityIri: task.entityIri,
            cause: O.some(e),
          })
        )
      );
      yield* Effect.logInfo("Approved verification task", { taskId, qid });
    });

    /**
     * Reject a verification task
     */
    const rejectTask = Effect.fn("ReconciliationService.rejectTask")(function* (
      taskId: string
    ): Effect.fn.Return<void, ReconciliationError> {
      const taskKey = `${QUEUE_PREFIX}${taskId}`;
      const contentOpt = yield* storage.getOption(taskKey).pipe(
        Effect.mapError((e) =>
          ReconciliationError.make({
            message: `Failed to read task: ${e}`,
            entityIri: "",
            cause: O.some(e),
          })
        )
      );

      if (O.isNone(contentOpt)) {
        return yield* ReconciliationError.make({
          message: `Task not found: ${taskId}`,
          entityIri: "",
        });
      }

      const task = yield* decodeVerificationTask(contentOpt.value).pipe(
        Effect.mapError((cause) =>
          ReconciliationError.make({
            message: `Failed to decode verification task: ${cause}`,
            entityIri: "",
            cause: O.some(cause),
          })
        )
      );

      // Update task status
      const updatedTask: VerificationTask = {
        ...task,
        status: "rejected",
      };

      const updatedTaskJson = yield* encodeVerificationTask(updatedTask).pipe(
        Effect.mapError((cause) =>
          ReconciliationError.make({
            message: `Failed to encode verification task: ${cause}`,
            entityIri: task.entityIri,
            cause: O.some(cause),
          })
        )
      );

      yield* storage.set(taskKey, updatedTaskJson).pipe(
        Effect.mapError((e) =>
          ReconciliationError.make({
            message: `Failed to update task: ${e}`,
            entityIri: task.entityIri,
            cause: O.some(e),
          })
        )
      );

      yield* Effect.logInfo("Rejected verification task", { taskId });
    });

    /**
     * Get link for an entity if it exists
     */
    const getLink = Effect.fn("ReconciliationService.getLink")(function* (entityIri: string): Effect.fn.Return<
      O.Option<{
        qid: string;
        wikidataUri: string;
      }>,
      ReconciliationError
    > {
      const contentOpt = yield* storage.getOption(`${LINKS_PREFIX}${encodeURIComponent(entityIri)}`).pipe(
        Effect.mapError((e) =>
          ReconciliationError.make({
            message: `Failed to get link: ${e}`,
            entityIri,
            cause: O.some(e),
          })
        )
      );

      if (O.isNone(contentOpt)) {
        return O.none();
      }

      return O.map(decodeWikidataLinkOption(contentOpt.value), (data) => ({
        qid: data.qid,
        wikidataUri: data.wikidataUri,
      }));
    });

    /**
     * Batch reconcile multiple entities
     */
    const reconcileBatch = (
      entities: ReadonlyArray<{
        iri: string;
        label: string;
        types?: ReadonlyArray<string>;
      }>,
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
