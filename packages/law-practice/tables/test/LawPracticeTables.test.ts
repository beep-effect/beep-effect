import { DbSchema } from "@beep/law-practice-tables";
import { KG_BUILD_TABLE_NAME, kgBuildTable } from "@beep/law-practice-tables/entities/KgBuild";
import { KG_EDGE_TABLE_NAME, kgEdgeTable } from "@beep/law-practice-tables/entities/KgEdge";
import { KG_NODE_TABLE_NAME, kgNodeTable } from "@beep/law-practice-tables/entities/KgNode";
import { describe, expect, it } from "@effect/vitest";
import { getColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Order } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";

const columnNames = (columns: Readonly<Record<string, { readonly name: string }>>): ReadonlyArray<string> =>
  A.sort(
    A.map(R.values(columns), (column) => column.name),
    Order.String
  );

describe("law-practice tables", () => {
  it("names the three kg read-model tables and composes them in DbSchema", () => {
    expect(getTableName(kgNodeTable)).toBe(KG_NODE_TABLE_NAME);
    expect(getTableName(kgEdgeTable)).toBe(KG_EDGE_TABLE_NAME);
    expect(getTableName(kgBuildTable)).toBe(KG_BUILD_TABLE_NAME);
    expect(A.sort(R.keys(DbSchema), Order.String)).toStrictEqual(["kgBuild", "kgEdge", "kgNode"]);
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
