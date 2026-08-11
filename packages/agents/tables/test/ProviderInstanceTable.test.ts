import * as DomainProviderInstance from "@beep/agents-domain/entities/ProviderInstance";
import { DbSchema, Entities } from "@beep/agents-tables";
import {
  fromProviderInstanceRow,
  PROVIDER_INSTANCE_TABLE_NAME,
  providerInstanceTable,
  toProviderInstanceInsert,
} from "@beep/agents-tables/entities/ProviderInstance";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ProviderInstanceArbitrary = S.toArbitrary(DomainProviderInstance.ProviderInstance)(fc);
const ProviderInstanceEquivalence = S.toEquivalence(DomainProviderInstance.ProviderInstance);

const providerInstanceRow = {
  ...baseEntityFixtureInput(DomainProviderInstance.ProviderInstance.definition.entityId.entityType, 10),
  binaryPath: "/usr/local/bin/codex",
  envVars: {},
  homePath: null,
  kind: "codex",
  label: "Work Codex",
  lastProbe: null,
};

describe("ProviderInstance table", () => {
  it("materializes ProviderInstance metadata without executing a live database", () => {
    const columns = getColumns(providerInstanceTable);

    expect(getTableConfig(providerInstanceTable).name).toBe("agents_provider_instance");
    expect(PROVIDER_INSTANCE_TABLE_NAME).toBe("agents_provider_instance");
    expect(providerInstanceTable.definition).toBe(DomainProviderInstance.ProviderInstance.definition);
    expect(providerInstanceTable.definition.entityId.entityType).toBe("AgentsProviderInstance");
    expect(providerInstanceTable.entitySchema).toBe(DomainProviderInstance.ProviderInstance);
    expect(columns.id.primary).toBe(true);
    expect(columns.id.hasDefault).toBe(true);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.publicId.name).toBe("public_id");
    expect(columns.binaryPath.name).toBe("binary_path");
    expect(columns.binaryPath.columnType).toBe("PgText");
    expect(columns.binaryPath.notNull).toBe(true);
    expect(columns.envVars.name).toBe("env_vars");
    expect(columns.envVars.columnType).toBe("PgJsonb");
    expect(columns.homePath.name).toBe("home_path");
    expect(columns.homePath.notNull).toBe(false);
    expect(columns.kind.name).toBe("kind");
    expect(columns.label.name).toBe("label");
    expect(columns.lastProbe.name).toBe("last_probe");
    expect(columns.lastProbe.notNull).toBe(false);
  });

  it("persists only the exact token-free ProviderInstance column set", () => {
    const columnNames = A.map(getTableConfig(providerInstanceTable).columns, (column) => column.name);
    const expectedColumnNames = [
      "id",
      "public_id",
      "entity_type",
      "schema_version",
      "created_at",
      "created_by_principal",
      "updated_at",
      "updated_by_principal",
      "source",
      "row_version",
      "org_id",
      "binary_path",
      "env_vars",
      "home_path",
      "kind",
      "label",
      "last_probe",
    ];

    expect(columnNames).toHaveLength(expectedColumnNames.length);
    expect(columnNames).toEqual(expect.arrayContaining(expectedColumnNames));
    A.forEach(columnNames, (columnName) => {
      expect(columnName).not.toMatch(/token|secret|credential|api_key|refresh|oauth/i);
    });
  });

  it("exports the metadata aggregate and entity namespaces", () => {
    expect(DbSchema.providerInstance).toBe(providerInstanceTable);
    expect(Entities.ProviderInstance.providerInstanceTable).toBe(providerInstanceTable);
  });

  it("round-trips ProviderInstance rows through the converters", () => {
    const providerInstance = S.decodeUnknownSync(DomainProviderInstance.ProviderInstance)(providerInstanceRow);
    const insert = toProviderInstanceInsert(providerInstance);

    expect("id" in insert).toBe(false);
    expect(insert.binaryPath).toBe("/usr/local/bin/codex");
    expect(insert.kind).toBe("codex");
    expect(insert.entityType).toBe("AgentsProviderInstance");

    const roundTripped = fromProviderInstanceRow({
      ...insert,
      id: 10,
      homePath: insert.homePath ?? null,
      lastProbe: insert.lastProbe ?? null,
    });

    expect(ProviderInstanceEquivalence(roundTripped, providerInstance)).toBe(true);
  });

  it("round-trips schema-derived ProviderInstances through the row converters", () =>
    fc.assert(
      fc.property(ProviderInstanceArbitrary, (providerInstance) => {
        const insert = toProviderInstanceInsert(providerInstance);
        const decoded = fromProviderInstanceRow({
          ...insert,
          id: providerInstance.id,
          homePath: insert.homePath ?? null,
          lastProbe: insert.lastProbe ?? null,
        });

        expect(ProviderInstanceEquivalence(decoded, providerInstance)).toBe(true);
      }),
      fcRuns(50)
    ));
});
