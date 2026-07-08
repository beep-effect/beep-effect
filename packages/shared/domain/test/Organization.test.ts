import * as EntitySchema from "@beep/schema/EntitySchema";
import * as Organization from "@beep/shared-domain/entities/Organization";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeOrganization = S.decodeUnknownEffect(Organization.Model);
const decodeOrganizationId = S.decodeUnknownEffect(Shared.OrganizationId);
const LicenseTierArbitrary = S.toArbitrary(Organization.LicenseTier);
const SettingsArbitrary = S.toArbitrary(Organization.Settings);
const expectFailure = Effect.fn("expectFailure")(function* <A, E>(effect: Effect.Effect<A, E, never>) {
  const exit = yield* Effect.exit(effect);
  assert.strictEqual(Exit.isFailure(exit), true);
});

const systemPrincipal = {
  component: "Runtime",
  kind: "System",
} as const;

const organizationInput = {
  createdAt: 1,
  createdByPrincipal: systemPrincipal,
  entityType: "SharedOrganization",
  id: 1,
  legalName: "Acme Legal LLC",
  licenseTier: "enterprise",
  name: "Acme",
  orgId: 1,
  parentOrgId: null,
  rowVersion: 1,
  schemaVersion: "0.0.0",
  settings: {
    allowAgentActions: true,
    defaultRetentionDays: 90,
  },
  slug: "acme",
  source: "Application",
  updatedAt: 2,
  updatedByPrincipal: systemPrincipal,
} as const;

describe("Organization", () => {
  it.effect(
    "reuses the shared OrganizationId metadata",
    Effect.fnUntraced(function* () {
      const id1 = yield* decodeOrganizationId(1);
      const id1Again = yield* decodeOrganizationId(1);
      const id2 = yield* decodeOrganizationId(2);

      expect(Shared.OrganizationId.tableName).toBe("shared_organization");
      expect(Shared.OrganizationId.entityType).toBe("SharedOrganization");
      expect(Shared.OrganizationId.resource).toBe("shared.organization");
      expect(Shared.OrganizationId.equivalence(id1, id1Again)).toBe(true);
      expect(Shared.OrganizationId.equivalence(id1, id2)).toBe(false);
      expect(id1).toBe(1);
    })
  );

  it.effect(
    "defines license-tier literals and settings decoding",
    Effect.fnUntraced(function* () {
      const decodeSettings = S.decodeUnknownEffect(Organization.Settings);

      expect(Organization.LicenseTier.is.solo("solo")).toBe(true);
      expect(Organization.LicenseTier.is.team("team")).toBe(true);
      expect(Organization.LicenseTier.is.enterprise("enterprise")).toBe(true);
      expect((yield* decodeSettings({ allowAgentActions: false, defaultRetentionDays: 30 })).defaultRetentionDays).toBe(
        30
      );
      yield* expectFailure(decodeSettings({ allowAgentActions: true, defaultRetentionDays: 0 }));
    })
  );

  it("round-trips schema-derived license tiers and settings", () =>
    fc.assert(
      fc.property(LicenseTierArbitrary, SettingsArbitrary, (licenseTier, settings) => {
        const decodedTier = S.decodeUnknownSync(Organization.LicenseTier)(licenseTier);
        const encodedSettings = S.encodeSync(Organization.Settings)(settings);
        const decodedSettings = S.decodeUnknownSync(Organization.Settings)(encodedSettings);

        expect(decodedTier).toBe(licenseTier);
        expect(
          Organization.LicenseTier.is.solo(decodedTier) ||
            Organization.LicenseTier.is.team(decodedTier) ||
            Organization.LicenseTier.is.enterprise(decodedTier)
        ).toBe(true);
        assert.instanceOf(decodedSettings, Organization.Settings);
        assert.strictEqual(decodedSettings.allowAgentActions, settings.allowAgentActions);
        assert.strictEqual(decodedSettings.defaultRetentionDays, settings.defaultRetentionDays);
      }),
      fcRuns(50)
    ));

  it.effect(
    "decodes nullable parent organization ids to Option values",
    Effect.fnUntraced(function* () {
      expect(O.isNone((yield* decodeOrganization(organizationInput)).parentOrgId)).toBe(true);
      expect(O.isNone((yield* decodeOrganization({ ...organizationInput, parentOrgId: null })).parentOrgId)).toBe(true);
      expect(O.getOrThrow((yield* decodeOrganization({ ...organizationInput, parentOrgId: 1 })).parentOrgId)).toBe(1);
      yield* expectFailure(decodeOrganization({ ...organizationInput, parentOrgId: 0 }));
    })
  );

  it("materializes schema-first descriptors for the entity and table layers", () => {
    const definition = Organization.Model.definition;

    expect(A.filter(Object.keys(definition.fields), (key) => key in definition.persisted)).toEqual([
      "createdAt",
      "createdByPrincipal",
      "orgId",
      "rowVersion",
      "schemaVersion",
      "source",
      "updatedAt",
      "updatedByPrincipal",
      "legalName",
      "licenseTier",
      "name",
      "parentOrgId",
      "settings",
      "slug",
      "entityType",
      "id",
    ]);
    expect(definition.persisted.slug.indexHints?.[0]?.kind).toBe("unique");
    expect(definition.persisted.licenseTier.storageKind).toBe("literal");
    expect(definition.persisted.licenseTier.indexHints?.[0]?.kind).toBe("lookup");
    expect(definition.persisted.settings.storageKind).toBe("jsonb");
    expect(EntitySchema.selectedRowFieldShape("parentOrgId", definition.fields.parentOrgId).allowsNull).toBe(true);
  });

  it.effect(
    "extends BaseEntity through the Organization schema definition",
    Effect.fnUntraced(function* () {
      const organization = yield* decodeOrganization(organizationInput);

      expect(Organization.Model.definition.entityId).toBe(Shared.OrganizationId);
      expect(Organization.Model.definition.persisted.id.valueStrategy).toBe("generatedOnInsert");
      expect(Organization.Model.definition.persisted.orgId.storageKind).toBe("entityId");
      expect(EntitySchema.columnNameFor("slug", Organization.Model.definition.persisted.slug)).toBe("slug");
      expect(Organization.Model.fields.slug).toBeDefined();
      expect(organization.name).toBe("Acme");
      expect(O.isNone(organization.parentOrgId)).toBe(true);
    })
  );

  it.effect(
    "checks tenant-root and parent organization invariants",
    Effect.fnUntraced(function* () {
      const rootId = yield* decodeOrganizationId(1);
      const parentId = yield* decodeOrganizationId(2);
      const child = yield* decodeOrganization({
        ...organizationInput,
        id: 3,
        orgId: 2,
        parentOrgId: 2,
        slug: "child-acme",
      });

      expect(Organization.isTenantRoot({ id: rootId, orgId: rootId })).toBe(true);
      expect(Organization.isTenantRoot({ id: rootId, orgId: parentId })).toBe(false);
      expect(Organization.hasParentOrganization({ parentOrgId: O.none() })).toBe(false);
      expect(Organization.hasParentOrganization(child)).toBe(true);
      expect(Organization.hasValidTenantPlacement({ id: rootId, orgId: rootId, parentOrgId: O.none() })).toBe(true);
      expect(Organization.hasValidTenantPlacement(child)).toBe(true);
      expect(
        Organization.hasValidTenantPlacement({
          id: rootId,
          orgId: rootId,
          parentOrgId: O.some(parentId),
        })
      ).toBe(false);
      expect(
        Organization.hasValidTenantPlacement({
          id: rootId,
          orgId: parentId,
          parentOrgId: O.none(),
        })
      ).toBe(false);
    })
  );
});
