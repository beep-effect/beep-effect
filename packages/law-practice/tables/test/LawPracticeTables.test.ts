import { DbSchema } from "@beep/law-practice-tables";
import * as CandorDisposition from "@beep/law-practice-tables/entities/CandorDisposition";
import * as IdsSubmissionFact from "@beep/law-practice-tables/entities/IdsSubmissionFact";
import { KG_BUILD_TABLE_NAME, kgBuildTable } from "@beep/law-practice-tables/entities/KgBuild";
import { KG_EDGE_TABLE_NAME, kgEdgeTable } from "@beep/law-practice-tables/entities/KgEdge";
import { KG_NODE_TABLE_NAME, kgNodeTable } from "@beep/law-practice-tables/entities/KgNode";
import * as PatentCitationEvent from "@beep/law-practice-tables/entities/PatentCitationEvent";
import { describe, expect, it } from "@effect/vitest";
import { getColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Order, Result } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";

const columnNames = (columns: Readonly<Record<string, { readonly name: string }>>): ReadonlyArray<string> =>
  A.sort(
    A.map(R.values(columns), (column) => column.name),
    Order.String
  );

const baseEntityColumns = {
  createdAt: "created_at",
  createdByPrincipal: "created_by_principal",
  entityType: "entity_type",
  id: "id",
  orgId: "org_id",
  publicId: "public_id",
  rowVersion: "row_version",
  schemaVersion: "schema_version",
  source: "source",
  updatedAt: "updated_at",
  updatedByPrincipal: "updated_by_principal",
} as const;

describe("law-practice tables", () => {
  it("names the three kg read-model tables and composes every table in DbSchema", () => {
    expect(getTableName(kgNodeTable)).toBe(KG_NODE_TABLE_NAME);
    expect(getTableName(kgEdgeTable)).toBe(KG_EDGE_TABLE_NAME);
    expect(getTableName(kgBuildTable)).toBe(KG_BUILD_TABLE_NAME);
    expect(A.sort(R.keys(DbSchema), Order.String)).toStrictEqual([
      "actFrame",
      "candorDisposition",
      "correctionDelta",
      "idsSubmissionFact",
      "kgBuild",
      "kgEdge",
      "kgNode",
      "legalOppositionCandidate",
      "legalPositionRelator",
      "patentCitationEvent",
      "powerExercise",
    ]);
  });

  it("declares the projected column sets", () => {
    expect(columnNames(getColumns(kgNodeTable))).toStrictEqual([
      "client",
      "docket_family",
      "epistemic_status",
      "iri",
      "kind",
      "label",
      "natural_key",
      "payload",
      "provenance_kind",
      "provenance_ref",
    ]);
    expect(columnNames(getColumns(kgEdgeTable))).toStrictEqual([
      "epistemic_status",
      "object_iri",
      "predicate",
      "provenance_kind",
      "provenance_ref",
      "subject_iri",
    ]);
    expect(columnNames(getColumns(kgBuildTable))).toStrictEqual([
      "built_at",
      "built_from_runs",
      "bundle_version",
      "counts",
    ]);
  });

  it("keys edges by the (subject, predicate, object) triple referencing nodes", () => {
    const edgeConfig = getTableConfig(kgEdgeTable);
    const primary = A.head(edgeConfig.primaryKeys);
    expect(
      A.map(
        A.flatMap(A.fromOption(primary), (key) => key.columns),
        (column) => column.name
      )
    ).toStrictEqual(["subject_iri", "predicate", "object_iri"]);
    expect(A.map(edgeConfig.foreignKeys, (foreignKey) => foreignKey.reference().foreignTable)).toStrictEqual([
      kgNodeTable,
      kgNodeTable,
    ]);
  });
});

describe("PatentCitationEventTable", () => {
  it("projects the recorded observation column shape", () => {
    expect(PatentCitationEvent.Table.definition.tableName).toBe("law_practice_patent_citation_event");
    expect(getTableConfig(PatentCitationEvent.Table).name).toBe("law_practice_patent_citation_event");
    expect(R.map(getColumns(PatentCitationEvent.Table), (column) => column.name)).toStrictEqual({
      ...baseEntityColumns,
      actor: "actor",
      citingApplication: "citing_application",
      discovery: "discovery",
      grounding: "grounding",
      observedAt: "observed_at",
      possibleDuplicateOf: "possible_duplicate_of",
      quarantine: "quarantine",
      reference: "reference",
      supersedes: "supersedes",
    });

    const columns = getColumns(PatentCitationEvent.Table);
    expect(columns.actor.columnType).toBe("PgText");
    expect(columns.actor.notNull).toBe(true);
    expect(columns.grounding.columnType).toBe("PgJsonb");
    expect(columns.grounding.notNull).toBe(true);
    expect(columns.possibleDuplicateOf.columnType).toBe("PgInteger");
    expect(columns.observedAt.notNull).toBe(true);
  });

  it("publishes the table through the slice aggregate", () => {
    expect(DbSchema.patentCitationEvent).toBe(PatentCitationEvent.Table);
  });

  it("rejects a row carrying no recorded observation", () => {
    expect(Result.isFailure(PatentCitationEvent.fromPatentCitationEventRow({}))).toBe(true);
    expect(
      Result.isFailure(
        Result.flatMap(
          PatentCitationEvent.fromPatentCitationEventRow({}),
          PatentCitationEvent.toPatentCitationEventInsert
        )
      )
    ).toBe(true);
  });
});

describe("CandorDispositionTable", () => {
  it("projects the recorded judgment column shape", () => {
    expect(CandorDisposition.Table.definition.tableName).toBe("law_practice_candor_disposition");
    expect(getTableConfig(CandorDisposition.Table).name).toBe("law_practice_candor_disposition");
    expect(R.map(getColumns(CandorDisposition.Table), (column) => column.name)).toStrictEqual({
      ...baseEntityColumns,
      citingApplication: "citing_application",
      decidedAt: "decided_at",
      disposes: "disposes",
      lifecycle: "lifecycle",
      litigationFrameJudgment: "litigation_frame_judgment",
      rule56Judgment: "rule56_judgment",
      supersedes: "supersedes",
    });

    const columns = getColumns(CandorDisposition.Table);
    expect(columns.disposes.columnType).toBe("PgJsonb");
    expect(columns.disposes.notNull).toBe(true);
    expect(columns.lifecycle.columnType).toBe("PgText");
    expect(columns.lifecycle.notNull).toBe(true);
    expect(columns.rule56Judgment.columnType).toBe("PgText");
    expect(columns.supersedes.columnType).toBe("PgInteger");
  });

  it("publishes the table through the slice aggregate", () => {
    expect(DbSchema.candorDisposition).toBe(CandorDisposition.Table);
  });

  it("rejects a row carrying no recorded judgment", () => {
    expect(Result.isFailure(CandorDisposition.fromCandorDispositionRow({}))).toBe(true);
    expect(
      Result.isFailure(
        Result.flatMap(CandorDisposition.fromCandorDispositionRow({}), CandorDisposition.toCandorDispositionInsert)
      )
    ).toBe(true);
  });
});

describe("IdsSubmissionFactTable", () => {
  it("projects the recorded submission-fact column shape", () => {
    expect(IdsSubmissionFact.Table.definition.tableName).toBe("law_practice_ids_submission_fact");
    expect(getTableConfig(IdsSubmissionFact.Table).name).toBe("law_practice_ids_submission_fact");
    expect(R.map(getColumns(IdsSubmissionFact.Table), (column) => column.name)).toStrictEqual({
      ...baseEntityColumns,
      candidateWindow: "candidate_window",
      citingApplication: "citing_application",
      content: "content",
      fees: "fees",
      modeledFrom: "modeled_from",
      officeTreatment: "office_treatment",
      operativeDate: "operative_date",
      statement: "statement",
      submissionKind: "submission_kind",
    });

    const columns = getColumns(IdsSubmissionFact.Table);
    expect(columns.candidateWindow.columnType).toBe("PgJsonb");
    expect(columns.candidateWindow.notNull).toBe(true);
    expect(columns.submissionKind.columnType).toBe("PgText");
    expect(columns.submissionKind.notNull).toBe(true);
    expect(columns.officeTreatment.columnType).toBe("PgJsonb");
    expect(columns.operativeDate.notNull).toBe(true);
  });

  it("publishes the table through the slice aggregate", () => {
    expect(DbSchema.idsSubmissionFact).toBe(IdsSubmissionFact.Table);
  });

  it("rejects a row carrying no recorded submission facts", () => {
    expect(Result.isFailure(IdsSubmissionFact.fromIdsSubmissionFactRow({}))).toBe(true);
    expect(
      Result.isFailure(
        Result.flatMap(IdsSubmissionFact.fromIdsSubmissionFactRow({}), IdsSubmissionFact.toIdsSubmissionFactInsert)
      )
    ).toBe(true);
  });
});
