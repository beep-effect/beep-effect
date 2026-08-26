/**
 * Candidate project entity model.
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

const $I = $WorkspaceDomainId.create("entities/CandidateProject/CandidateProject.model");
const pg = ProductEntity.pg;

/**
 * Candidate project proposed by an agent.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import { CandidateProject } from "@beep/workspace-domain"
 *
 * console.log(CandidateProject.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateProject extends ProductEntity.Entity<CandidateProject>()(Workspace.CandidateProjectId)(
  {
    fixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the candidate project.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    lifecycle: CandidateLifecycle.annotateKey({
      description: "Lifecycle state for the candidate project.",
    }).pipe(pg.text()),
    snapshot: UnknownRecord.annotateKey({
      description: "Opaque runtime proof snapshot for the candidate project.",
    }).pipe(pg.jsonb()),
  },
  $I.annote("CandidateProject", {
    description: "Candidate project proposed by an agent.",
  })
) {}
