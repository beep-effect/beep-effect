/**
 * Candidate draft entity model.
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

const $I = $WorkspaceDomainId.create("entities/CandidateDraft/CandidateDraft.model");

/**
 * Candidate draft artifact proposed by an agent.
 *
 * @example
 * ```ts
 * import { CandidateDraft } from "@beep/workspace-domain"
 *
 * console.log(CandidateDraft.definition.entityId.resource)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateDraft extends BaseEntity.Class<CandidateDraft>($I`CandidateDraft`)(
  Workspace.CandidateDraftId,
  {
    fields: {
      fixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the candidate draft.",
      }),
      lifecycle: CandidateLifecycle.annotateKey({
        description: "Lifecycle state for the candidate draft.",
      }),
      snapshot: UnknownRecord.annotateKey({
        description: "Opaque runtime proof snapshot for the candidate draft.",
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
  $I.annote("CandidateDraft", {
    description: "Candidate draft artifact proposed by an agent.",
  })
) {}
