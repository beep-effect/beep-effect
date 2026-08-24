/**
 * Worker use-case errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $ArchitectureLabUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import * as S from "effect/Schema";

const $I = $ArchitectureLabUseCasesId.create("entities/Worker/Worker.errors");

/**
 * Generic public reason used when internal Worker repository details are redacted.
 *
 * **Example** (Create error with redacted reason)
 *
 * ```ts
 * import {
 *   WORKER_ACTION_UNAVAILABLE_REASON,
 *   WorkerActionFailed
 * } from "@beep/architecture-lab-use-cases/entities/Worker"
 *
 * const error = WorkerActionFailed.make({ reason: WORKER_ACTION_UNAVAILABLE_REASON })
 *
 * console.log(error.reason) // "Worker service is unavailable."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WORKER_ACTION_UNAVAILABLE_REASON = "Worker service is unavailable." as const;

const WorkerNotFoundFields = {
  workerId: ArchitectureLabIdentity.WorkerId,
} satisfies S.Struct.Fields;
const sameWorkerNotFoundFields = S.toEquivalence(S.TaggedStruct("WorkerNotFound", WorkerNotFoundFields));
const sameWorkerNotFound = (self: WorkerNotFound, that: WorkerNotFound): boolean =>
  sameWorkerNotFoundFields(self, that);

/**
 * Public failure raised when a requested Worker is absent.
 *
 * **Example** (Create WorkerNotFound with id)
 *
 * ```ts
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerNotFound } from "@beep/architecture-lab-use-cases/entities/Worker"
 * import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab"
 * import * as S from "effect/Schema"
 *
 * const error = WorkerNotFound.make({
 *   workerId: S.decodeUnknownSync(ArchitectureLabIdentity.WorkerId)(1)
 * })
 *
 * console.log(error._tag) // "WorkerNotFound"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkerNotFound extends S.TaggedError<WorkerNotFound>($I`WorkerNotFound`)(
  "WorkerNotFound",
  WorkerNotFoundFields,
  $I.annoteClass<S.declare<WorkerNotFound>, readonly [S.TaggedStruct<"WorkerNotFound", typeof WorkerNotFoundFields>]>(
    "WorkerNotFound",
    {
      title: "Worker not found",
      description: "The requested architecture lab Worker does not exist.",
      toEquivalence: () => sameWorkerNotFound,
    }
  )
) {}

const WorkerConflictFields = {
  workerId: ArchitectureLabIdentity.WorkerId.annotateKey({
    description: "Worker identity whose command conflicted with persisted state.",
  }),
  reason: S.NonEmptyString.annotateKey({
    description: "Non-empty public conflict reason.",
  }),
} satisfies S.Struct.Fields;
const sameWorkerConflictFields = S.toEquivalence(S.TaggedStruct("WorkerConflict", WorkerConflictFields));
const sameWorkerConflict = (self: WorkerConflict, that: WorkerConflict): boolean =>
  sameWorkerConflictFields(self, that);

/**
 * Public failure raised when a Worker command conflicts with persisted state.
 *
 * **Example** (Create conflict with reason)
 *
 * ```ts
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerConflict } from "@beep/architecture-lab-use-cases/entities/Worker"
 * import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab"
 * import * as S from "effect/Schema"
 *
 * const error = WorkerConflict.make({
 *   workerId: S.decodeUnknownSync(ArchitectureLabIdentity.WorkerId)(1),
 *   reason: "Worker already exists"
 * })
 *
 * console.log(error.reason) // "Worker already exists"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkerConflict extends S.TaggedError<WorkerConflict>($I`WorkerConflict`)(
  "WorkerConflict",
  WorkerConflictFields,
  $I.annoteClass<S.declare<WorkerConflict>, readonly [S.TaggedStruct<"WorkerConflict", typeof WorkerConflictFields>]>(
    "WorkerConflict",
    {
      title: "Worker conflict",
      description: "The requested Worker command conflicts with persisted state.",
      toEquivalence: () => sameWorkerConflict,
    }
  )
) {}

const WorkerActionFailedFields = {
  reason: S.NonEmptyString.annotateKey({
    description: "Non-empty public failure reason with internal repository details redacted.",
  }),
} satisfies S.Struct.Fields;
const sameWorkerActionFailedFields = S.toEquivalence(S.TaggedStruct("WorkerActionFailed", WorkerActionFailedFields));
const sameWorkerActionFailed = (self: WorkerActionFailed, that: WorkerActionFailed): boolean =>
  sameWorkerActionFailedFields(self, that);

/**
 * Public failure raised when a Worker action cannot be completed.
 *
 * **Example** (Create failed action error)
 *
 * ```ts
 * import { WorkerActionFailed } from "@beep/architecture-lab-use-cases/entities/Worker"
 *
 * const error = WorkerActionFailed.make({ reason: "Repository timeout" })
 *
 * console.log(error._tag) // "WorkerActionFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkerActionFailed extends S.TaggedError<WorkerActionFailed>($I`WorkerActionFailed`)(
  "WorkerActionFailed",
  WorkerActionFailedFields,
  $I.annoteClass<
    S.declare<WorkerActionFailed>,
    readonly [S.TaggedStruct<"WorkerActionFailed", typeof WorkerActionFailedFields>]
  >("WorkerActionFailed", {
    title: "Worker action failed",
    description: "The Worker use-case action could not be completed.",
    toEquivalence: () => sameWorkerActionFailed,
  })
) {}

/**
 * Public Worker use-case failure schema.
 *
 * **Example** (Check error with is)
 *
 * ```ts
 * import {
 *   WorkerActionError,
 *   WorkerActionFailed,
 * } from "@beep/architecture-lab-use-cases/entities/Worker"
 *
 * const isActionError = WorkerActionError.is
 *
 * console.log(isActionError(WorkerActionFailed.make({ reason: "Repository unavailable" }))) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WorkerActionError = S.Union([WorkerNotFound, WorkerConflict, WorkerActionFailed]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("WorkerActionError", {
    title: "Worker action error",
    description: "Tagged union of public Worker use-case failures.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link WorkerActionError}.
 *
 * **Example** (Annotate error variable type)
 *
 * ```ts
 * import {
 *   WorkerActionFailed,
 *   type WorkerActionError
 * } from "@beep/architecture-lab-use-cases/entities/Worker"
 *
 * const error: WorkerActionError = WorkerActionFailed.make({ reason: "Repository unavailable" })
 *
 * console.log(error._tag) // "WorkerActionFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type WorkerActionError = typeof WorkerActionError.Type;
