import { Membership, User } from "@beep/shared-tables/entities";
import * as Organization from "@beep/shared-tables/entities/Organization";
import { DbSchema } from "@beep/shared-tables/Schema";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { pipe } from "effect/Function";
import * as O from "effect/Option";

const indexConfigNamed = (name: string) =>
  pipe(
    getTableConfig(Organization.Table).indexes,
    A.findFirst((indexConfig) => indexConfig.config.name === name)
  );

describe("OrganizationTable", () => {
  it("aggregates every shared table under its stable schema key", () => {
    expect(DbSchema.organization).toBe(Organization.Table);
    expect(DbSchema.membership).toBe(Membership.Table);
    expect(DbSchema.user).toBe(User.Table);
    expect(getTableConfig(Membership.Table).name).toBe("shared_membership");
    expect(getTableConfig(User.Table).name).toBe("shared_user");
  });

  it("materializes shared Organization metadata without executing a live database", () => {
    const columns = getColumns(Organization.Table);
    const config = getTableConfig(Organization.Table);

    expect(Organization.Table.definition.tableName).toBe("shared_organization");
    expect(config.name).toBe("shared_organization");
    expect(columns.id.name).toBe("id");
    expect(columns.id.primary).toBe(true);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.entityType.name).toBe("entity_type");
    expect(columns.entityType.notNull).toBe(true);
  });

  it("maps Organization profile fields to the expected Postgres column metadata", () => {
    const columns = getColumns(Organization.Table);

    expect(columns.name.name).toBe("name");
    expect(columns.name.columnType).toBe("PgText");
    expect(columns.name.notNull).toBe(true);
    expect(columns.slug.name).toBe("slug");
    expect(columns.slug.columnType).toBe("PgText");
    expect(columns.legalName.name).toBe("legal_name");
    expect(columns.licenseTier.name).toBe("license_tier");
    expect(columns.licenseTier.columnType).toBe("PgText");
    expect(columns.parentOrgId.name).toBe("parent_org_id");
    expect(columns.parentOrgId.columnType).toBe("PgInteger");
    expect(columns.parentOrgId.notNull).toBe(false);
    expect(columns.settings.name).toBe("settings");
    expect(columns.settings.columnType).toBe("PgJsonb");
    expect(columns.settings.notNull).toBe(true);
  });

  it("builds slug uniqueness and license-tier lookup indexes", () => {
    const slugUnique = indexConfigNamed("shared_organization_slug_unique_idx");
    const licenseTierLookup = indexConfigNamed("shared_organization_license_tier_lookup_idx");
    const entityTypeLookup = indexConfigNamed("shared_organization_entity_type_lookup_idx");
    const orgIdLookup = indexConfigNamed("shared_organization_org_id_lookup_idx");
    const sourceLookup = indexConfigNamed("shared_organization_source_lookup_idx");

    expect(O.getOrThrow(slugUnique).config.unique).toBe(true);
    expect(O.getOrThrow(slugUnique).config.columns[0]).toMatchObject({ name: "slug" });
    expect(O.getOrThrow(licenseTierLookup).config.method).toBe("btree");
    expect(O.getOrThrow(licenseTierLookup).config.columns[0]).toMatchObject({ name: "license_tier" });
    expect(O.isNone(entityTypeLookup)).toBe(true);
    expect(O.isNone(orgIdLookup)).toBe(true);
    expect(O.isNone(sourceLookup)).toBe(true);
  });
});
