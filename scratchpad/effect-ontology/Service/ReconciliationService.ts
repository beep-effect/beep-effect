/**
 * Service: Reconciliation Service
 *
 * Orchestrates entity reconciliation against Wikidata with automatic linking
 * for high-confidence matches and queueing for human review of uncertain matches.
 *
 * @since 2.0.0
 * @module Service/ReconciliationService
 */

import { Data, Effect, Option, Schema, Context, Layer } from "effect"
import { StorageService } from "./Storage.ts"
import {
  type WikidataApiError,
  type WikidataCandidate,
  WikidataClient,
  type WikidataRateLimitError
} from "./WikidataClient.ts"
import { $ScratchpadId } from "@beep/identity";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
const $I = $ScratchpadId.create("effect-ontology/Service/ReconciliationService");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when reconciliation fails
 */
export class ReconciliationError extends Data.TaggedError("ReconciliationError")<{
  readonly message: string
  readonly entityIri: string
  readonly cause?: unknown
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
  language: Schema.String.pipe(SchemaUtils.withKeyDefaults("en"))
}) {}

const DEFAULT_CONFIG = ReconciliationConfig.make({})

/**
 * Result of entity reconciliation
 */
export interface ReconciliationResult {
  /** Entity IRI being reconciled */
  readonly entityIri: string
  /** Original label used for search */
  readonly label: string
  /** Decision made */
  readonly decision: ReconciliationDecision
  /** Candidates considered */
  readonly candidates: ReadonlyArray<WikidataCandidate>
  /** Best match if any */
  readonly bestMatch?: WikidataCandidate
  /** Verification task ID if queued */
  readonly verificationTaskId?: string
}

export type ReconciliationDecision =
  | "auto_linked" // Score >= autoLinkThreshold, link created
  | "queued" // Score in queueThreshold..autoLinkThreshold, needs review
  | "no_match" // Score < queueThreshold or no candidates
  | "skipped" // Already linked or other reason to skip

/**
 * Verification task for human review
 */
export interface VerificationTask {
  readonly id: string
  readonly entityIri: string
  readonly label: string
  readonly candidates: ReadonlyArray<WikidataCandidate>
  readonly createdAt: Date
  readonly status: "pending" | "approved" | "rejected"
  readonly approvedQid?: string
}

// =============================================================================
// Service
// =============================================================================

export class ReconciliationService extends Context.Service<ReconciliationService>()(
  $I`ReconciliationService`,
  {
    make: Effect.gen(function*() {
      const wikidata = yield* WikidataClient
      const storage = yield* StorageService

      // Storage keys
      const LINKS_PREFIX = "reconciliation/links/"
      const QUEUE_PREFIX = "reconciliation/queue/"

      /**
       * Generate a unique task ID
       */
      const generateTaskId = (): string => {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 8)
        return `task-${timestamp}-${random}`
      }

      /**
       * Reconcile an entity against Wikidata
       */
      const reconcileEntity = (
        entityIri: string,
        label: string,
        types: ReadonlyArray<string> = [],
        config: ReconciliationConfig = DEFAULT_CONFIG
      ): Effect.Effect<
        ReconciliationResult,
        ReconciliationError | WikidataApiError | WikidataRateLimitError
      > =>
        Effect.gen(function*() {
          yield* Effect.logDebug("Reconciling entity", { entityIri, label, types })

          // Check if already linked
          const existingLinkOpt = yield* storage.get(`${LINKS_PREFIX}${encodeURIComponent(entityIri)}`).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to check existing link: ${e}`,
                entityIri,
                cause: e
              })
            )
          )

          if ((existingLinkOpt !== undefined)) {
            yield* Effect.logDebug("Entity already linked", { entityIri })
            return {
              entityIri,
              label,
              decision: "skipped" as const,
              candidates: []
            }
          }

          // Search Wikidata
          const candidates = yield* wikidata.searchEntities(label, {
            language: config.language,
            limit: config.maxCandidates
          })

          if (candidates.length === 0) {
            yield* Effect.logDebug("No candidates found", { entityIri, label })
            return {
              entityIri,
              label,
              decision: "no_match" as const,
              candidates: []
            }
          }

          const bestMatch = candidates[0]

          // Decision based on score
          if (bestMatch.score >= config.autoLinkThreshold) {
            // Auto-link
            yield* storeWikidataLink(entityIri, bestMatch.qid)
            yield* Effect.logInfo("Auto-linked entity", {
              entityIri,
              qid: bestMatch.qid,
              score: bestMatch.score
            })

            return {
              entityIri,
              label,
              decision: "auto_linked" as const,
              candidates,
              bestMatch
            }
          } else if (bestMatch.score >= config.queueThreshold) {
            // Queue for review
            const taskId = yield* queueForVerification(entityIri, label, candidates)
            yield* Effect.logInfo("Queued entity for verification", {
              entityIri,
              taskId,
              score: bestMatch.score
            })

            return {
              entityIri,
              label,
              decision: "queued" as const,
              candidates,
              bestMatch,
              verificationTaskId: taskId
            }
          } else {
            // No match
            yield* Effect.logDebug("No confident match", {
              entityIri,
              bestScore: bestMatch.score
            })

            return {
              entityIri,
              label,
              decision: "no_match" as const,
              candidates,
              bestMatch
            }
          }
        })

      /**
       * Store a Wikidata link (owl:sameAs)
       */
      const storeWikidataLink = (
        entityIri: string,
        qid: string
      ): Effect.Effect<void, ReconciliationError> =>
        Effect.gen(function*() {
          const wikidataUri = `http://www.wikidata.org/entity/${qid}`

          // Store the link mapping
          const linkData = JSON.stringify({
            entityIri,
            qid,
            wikidataUri,
            linkedAt: new Date().toISOString()
          })

          yield* storage.set(
            `${LINKS_PREFIX}${encodeURIComponent(entityIri)}`,
            linkData
          ).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to store link: ${e}`,
                entityIri,
                cause: e
              })
            )
          )

          yield* Effect.logDebug("Stored Wikidata link", { entityIri, qid })
        })

      /**
       * Queue an entity for human verification
       */
      const queueForVerification = (
        entityIri: string,
        label: string,
        candidates: ReadonlyArray<WikidataCandidate>
      ): Effect.Effect<string, ReconciliationError> =>
        Effect.gen(function*() {
          const taskId = generateTaskId()

          const task: VerificationTask = {
            id: taskId,
            entityIri,
            label,
            candidates,
            createdAt: new Date(),
            status: "pending"
          }

          yield* storage.set(
            `${QUEUE_PREFIX}${taskId}`,
            JSON.stringify(task)
          ).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to queue verification: ${e}`,
                entityIri,
                cause: e
              })
            )
          )

          return taskId
        })

      /**
       * Get pending verification tasks
       */
      const getPendingTasks = (): Effect.Effect<
        ReadonlyArray<VerificationTask>,
        ReconciliationError
      > =>
        Effect.gen(function*() {
          const taskKeys = yield* storage.list(QUEUE_PREFIX).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to list tasks: ${e}`,
                entityIri: "",
                cause: e
              })
            )
          )

          const tasks: Array<VerificationTask> = []

          for (const key of taskKeys) {
            const contentOpt = yield* storage.get(key).pipe(
              Effect.mapError((e) =>
                new ReconciliationError({
                  message: `Failed to read task: ${e}`,
                  entityIri: "",
                  cause: e
                })
              )
            )

            if ((contentOpt !== undefined)) {
              try {
                const task = JSON.parse(contentOpt) as VerificationTask
                if (task.status === "pending") {
                  tasks.push(task)
                }
              } catch {
                // Skip malformed tasks
              }
            }
          }

          // Sort by creation date
          tasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

          return tasks
        })

      /**
       * Approve a verification task
       */
      const approveTask = (
        taskId: string,
        qid: string
      ): Effect.Effect<void, ReconciliationError> =>
        Effect.gen(function*() {
          const taskKey = `${QUEUE_PREFIX}${taskId}`
          const contentOpt = yield* storage.get(taskKey).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to read task: ${e}`,
                entityIri: "",
                cause: e
              })
            )
          )

          if ((contentOpt === undefined)) {
            return yield* Effect.fail(
              new ReconciliationError({
                message: `Task not found: ${taskId}`,
                entityIri: ""
              })
            )
          }

          const task = JSON.parse(contentOpt) as VerificationTask

          // Store the link
          yield* storeWikidataLink(task.entityIri, qid)

          // Update task status
          const updatedTask: VerificationTask = {
            ...task,
            status: "approved",
            approvedQid: qid
          }

          yield* storage.set(taskKey, JSON.stringify(updatedTask)).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to update task: ${e}`,
                entityIri: task.entityIri,
                cause: e
              })
            )
          )

          yield* Effect.logInfo("Approved verification task", { taskId, qid })
        })

      /**
       * Reject a verification task
       */
      const rejectTask = (
        taskId: string
      ): Effect.Effect<void, ReconciliationError> =>
        Effect.gen(function*() {
          const taskKey = `${QUEUE_PREFIX}${taskId}`
          const contentOpt = yield* storage.get(taskKey).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to read task: ${e}`,
                entityIri: "",
                cause: e
              })
            )
          )

          if ((contentOpt === undefined)) {
            return yield* Effect.fail(
              new ReconciliationError({
                message: `Task not found: ${taskId}`,
                entityIri: ""
              })
            )
          }

          const task = JSON.parse(contentOpt) as VerificationTask

          // Update task status
          const updatedTask: VerificationTask = {
            ...task,
            status: "rejected"
          }

          yield* storage.set(taskKey, JSON.stringify(updatedTask)).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to update task: ${e}`,
                entityIri: task.entityIri,
                cause: e
              })
            )
          )

          yield* Effect.logInfo("Rejected verification task", { taskId })
        })

      /**
       * Get link for an entity if it exists
       */
      const getLink = (
        entityIri: string
      ): Effect.Effect<Option.Option<{ qid: string; wikidataUri: string }>, ReconciliationError> =>
        Effect.gen(function*() {
          const contentOpt = yield* storage.get(
            `${LINKS_PREFIX}${encodeURIComponent(entityIri)}`
          ).pipe(
            Effect.mapError((e) =>
              new ReconciliationError({
                message: `Failed to get link: ${e}`,
                entityIri,
                cause: e
              })
            )
          )

          if ((contentOpt === undefined)) {
            return Option.none()
          }

          try {
            const data = JSON.parse(contentOpt) as {
              qid: string
              wikidataUri: string
            }
            return Option.some({ qid: data.qid, wikidataUri: data.wikidataUri })
          } catch {
            return Option.none()
          }
        })

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
        )

      return {
        reconcileEntity,
        storeWikidataLink,
        queueForVerification,
        getPendingTasks,
        approveTask,
        rejectTask,
        getLink,
        reconcileBatch
      }
    })
  }
) {
    static readonly Default = Layer.effect(this, this.make);
}
