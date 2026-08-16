/**
 * Approval gate entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Workspace from "@beep/shared-domain/identity/Workspace";
import { ApprovalDecision, CandidateLifecycle } from "@beep/workspace-domain/values";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/ApprovalGate/ApprovalGate.model");
const ApprovalGateEntity = ProductEntity.make(Workspace.ApprovalGateId);

/**
 * Human approval gate for candidate work.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import { ApprovalGate } from "@beep/workspace-domain"
 *
 * console.log(ApprovalGate.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApprovalGate extends ApprovalGateEntity.Entity<ApprovalGate>(ApprovalGateEntity.tableName)(
  {
    decision: ApprovalDecision.annotateKey({
      description: "Current human approval decision for the candidate work.",
    }).pipe(ApprovalGateEntity.pg.text()),
    fixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the approval gate.",
    }).pipe(ApprovalGateEntity.pg.text(), ApprovalGateEntity.pg.columnName("fixture_key")),
    lifecycle: CandidateLifecycle.annotateKey({
      description: "Candidate lifecycle state when the gate was recorded.",
    }).pipe(ApprovalGateEntity.pg.text()),
    snapshot: UnknownRecord.annotateKey({
      description: "Opaque runtime proof snapshot captured for the approval gate.",
    }).pipe(ApprovalGateEntity.pg.jsonb()),
    ...ApprovalGateEntity.identityFields,
  },
  $I.annote("ApprovalGate", {
    description: "Human approval gate for candidate work.",
  }),
  ApprovalGateEntity.entityExtras
) {}
