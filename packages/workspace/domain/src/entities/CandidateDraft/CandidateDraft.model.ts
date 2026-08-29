/**
 * Candidate draft entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Workspace from "@beep/shared-domain/identity/Workspace";
import { CandidateLifecycle } from "@beep/workspace-domain/values";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/CandidateDraft/CandidateDraft.model");
const pg = ProductEntity.pg;

/**
 * Candidate draft artifact proposed by an agent.
 *
 * **Example** (Log entity resource)
 *
 * ```ts
 * import { CandidateDraft } from "@beep/workspace-domain"
 *
 * console.log(CandidateDraft.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateDraft extends ProductEntity.Entity<CandidateDraft>()(Workspace.CandidateDraftId)(
  {
    fixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the candidate draft.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    lifecycle: CandidateLifecycle.annotateKey({
      description: "Lifecycle state for the candidate draft.",
    }).pipe(pg.text()),
    snapshot: UnknownRecord.annotateKey({
      description: "Opaque runtime proof snapshot for the candidate draft.",
    }).pipe(pg.jsonb()),
  },
  $I.annote("CandidateDraft", {
    description: "Candidate draft artifact proposed by an agent.",
  })
) {}
