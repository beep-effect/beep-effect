/**
 * Approval gate entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Workspace from "@beep/shared-domain/identity/Workspace";
import { ApprovalDecision, CandidateLifecycle } from "@beep/workspace-domain/values";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/ApprovalGate/ApprovalGate.model");

/**
 * Human approval gate for candidate work.
 *
 * @example
 * ```ts
 * import { ApprovalGate } from "@beep/workspace-domain"
 *
 * console.log(ApprovalGate.definition.entityId.entityType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApprovalGate extends BaseEntity.Class<ApprovalGate>($I`ApprovalGate`)(
  Workspace.ApprovalGateId,
  {
    fields: {
      decision: ApprovalDecision.annotateKey({
        description: "Current human approval decision for the candidate work.",
      }),
      fixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the approval gate.",
      }),
      lifecycle: CandidateLifecycle.annotateKey({
        description: "Candidate lifecycle state when the gate was recorded.",
      }),
      snapshot: UnknownRecord.annotateKey({
        description: "Opaque runtime proof snapshot captured for the approval gate.",
      }),
    },
    persisted: {
      decision: EntitySchema.persist.literal({
        columnName: "decision",
      }),
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      lifecycle: EntitySchema.persist.literal({
        columnName: "lifecycle",
      }),
      snapshot: EntitySchema.persist.jsonb({
        columnName: "snapshot",
      }),
    },
  },
  $I.annote("ApprovalGate", {
    description: "Human approval gate for candidate work.",
  })
) {}
