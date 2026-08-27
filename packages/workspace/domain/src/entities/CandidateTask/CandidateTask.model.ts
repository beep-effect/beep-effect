/**
 * Candidate task entity model.
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

const $I = $WorkspaceDomainId.create("entities/CandidateTask/CandidateTask.model");
const pg = ProductEntity.pg;

/**
 * Candidate task proposed by an agent.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { CandidateTask } from "@beep/workspace-domain"
 *
 * console.log(CandidateTask.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateTask extends ProductEntity.Entity<CandidateTask>()(Workspace.CandidateTaskId)(
  {
    fixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the candidate task.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    lifecycle: CandidateLifecycle.annotateKey({
      description: "Lifecycle state for the candidate task.",
    }).pipe(pg.text()),
    snapshot: UnknownRecord.annotateKey({
      description: "Opaque runtime proof snapshot for the candidate task.",
    }).pipe(pg.jsonb()),
  },
  $I.annote("CandidateTask", {
    description: "Candidate task proposed by an agent.",
  })
) {}
