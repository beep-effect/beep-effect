/**
 * Candidate task entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Workspace from "@beep/shared-domain/identity/Workspace";
import { CandidateLifecycle } from "@beep/workspace-domain/values";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/CandidateTask/CandidateTask.model");

/**
 * Candidate task proposed by an agent.
 *
 * @example
 * ```ts
 * import { CandidateTask } from "@beep/workspace-domain"
 *
 * console.log(CandidateTask.definition.entityId.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateTask extends BaseEntity.Class<CandidateTask>($I`CandidateTask`)(
  Workspace.CandidateTaskId,
  {
    fields: {
      fixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the candidate task.",
      }),
      lifecycle: CandidateLifecycle.annotateKey({
        description: "Lifecycle state for the candidate task.",
      }),
      snapshot: UnknownRecord.annotateKey({
        description: "Opaque runtime proof snapshot for the candidate task.",
      }),
    },
    persisted: {
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
  $I.annote("CandidateTask", {
    description: "Candidate task proposed by an agent.",
  })
) {}
