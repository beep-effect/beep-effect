import { $SharedDomainId } from "@beep/identity/packages";
import * as Membership from "@beep/shared-domain/entities/Membership";
import * as Organization from "@beep/shared-domain/entities/Organization";
import * as EntityId from "@beep/shared-domain/entity/EntityId";
import * as EntityRef from "@beep/shared-domain/entity/EntityRef";
import * as Principal from "@beep/shared-domain/entity/Principal";
import * as primitives from "@beep/shared-domain/entity/primitives";
import * as SourceKind from "@beep/shared-domain/entity/SourceKind";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as ClaimLifecycle from "@beep/shared-domain/values/ClaimLifecycle";
import { fromString, LocalDateFromString, Model as LocalDateModel } from "@beep/shared-domain/values/LocalDate";
import { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference";
import * as Rule from "@beep/shared-domain/values/Rule/Rule.model";
import { assertSchemaArbitraryDecodesToSelf, fcRuns } from "@beep/test-utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Equal } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeLocalDateFromString = S.decodeEffect(LocalDateFromString);
const decodeUnknownEntityIdOptionsSync = S.decodeUnknownSync(EntityId.Options);
const encodeLocalDateFromString = S.encodeEffect(LocalDateFromString);
const encodeLocalDateModel = S.encodeEffect(LocalDateModel);
const encodeEntityIdDefinitionSync = S.encodeSync(EntityId.Definition);
const encodeEntityIdOptionsSync = S.encodeSync(EntityId.Options);
const encodePrincipalAgentPrincipalSync = S.encodeSync(Principal.AgentPrincipal);
const encodePrincipalConnectorAccountPrincipalSync = S.encodeSync(Principal.ConnectorAccountPrincipal);
const encodePrincipalServiceAccountPrincipalSync = S.encodeSync(Principal.ServiceAccountPrincipal);

const $I = $SharedDomainId.create("test/SchemaParity");
const makeSharedId = EntityId.factory("shared", $I);
const DocumentId = makeSharedId("document");
const CustomDocumentId = makeSharedId("document", {
  brand: "CustomDocumentId",
  description: "Custom document id.",
  entityType: "CustomDocument",
  resource: "custom.document",
  tableName: "custom_document",
});

const assertCodecRoundTrip = <A, I>(schema: S.Codec<A, I, never, never>, options?: { readonly runs?: number }) => {
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equivalent = S.toEquivalence(schema);

  expect(
    Effect.runSync(
      Arbitrary.checkEffect(
        Arbitrary.schema(schema),
        (value) => equivalent(decode(encode(value)), value),
        fcRuns(options?.runs ?? 50)
      )
    )._tag
  ).toBe("Passed");
};

describe("shared-domain schema parity", () => {
  it("keeps EntityId option defaults encoded as optional keys", () => {
    const emptyOptions = EntityId.Options.make({});
    const explicitOptions = decodeUnknownEntityIdOptionsSync({
      brand: "CustomDocumentId",
      description: "Custom document id.",
      entityType: "CustomDocument",
      resource: "custom.document",
      tableName: "custom_document",
    });

    expect(O.isNone(emptyOptions.brand)).toBe(true);
    expect(encodeEntityIdOptionsSync(emptyOptions)).toEqual({});
    expect(encodeEntityIdOptionsSync(explicitOptions)).toEqual({
      brand: "CustomDocumentId",
      description: "Custom document id.",
      entityType: "CustomDocument",
      resource: "custom.document",
      tableName: "custom_document",
    });
    expect(encodeEntityIdDefinitionSync(CustomDocumentId.definition)).toEqual({
      brand: "CustomDocumentId",
      description: "Custom document id.",
      entityType: "CustomDocument",
      name: "document",
      overrides: {
        brand: "CustomDocumentId",
        description: "Custom document id.",
        entityType: "CustomDocument",
        resource: "custom.document",
        tableName: "custom_document",
      },
      resource: "custom.document",
      slice: "shared",
      tableName: "custom_document",
    });
  });

  it("keeps principal constructor defaults off the encoded wire shape", () => {
    const serviceAccount = Principal.ServiceAccountPrincipal.make({
      kind: "ServiceAccount",
      serviceAccountId: Shared.ServiceAccountId.make(1),
    });
    const agent = Principal.AgentPrincipal.make({
      agentId: Shared.AgentId.make(1),
      agentVersionId: Shared.AgentVersionId.make(1),
      kind: "Agent",
      onBehalfOfUserId: Shared.UserId.make(1),
    });
    const connector = Principal.ConnectorAccountPrincipal.make({
      connectorAccountId: Shared.ConnectorAccountId.make(1),
      kind: "ConnectorAccount",
    });

    expect(encodePrincipalServiceAccountPrincipalSync(serviceAccount)).toEqual({
      kind: "ServiceAccount",
      serviceAccountId: 1,
    });
    expect(encodePrincipalAgentPrincipalSync(agent)).toEqual({
      agentId: 1,
      agentVersionId: 1,
      kind: "Agent",
      onBehalfOfUserId: 1,
    });
    expect(encodePrincipalConnectorAccountPrincipalSync(connector)).toEqual({
      connectorAccountId: 1,
      kind: "ConnectorAccount",
    });
  });

  it.effect(
    "keeps fromString byte-identical with the LocalDateFromString codec",
    Effect.fnUntraced(function* () {
      const viaHelper = yield* fromString("2024-06-15");
      const viaSchema = yield* decodeLocalDateFromString("2024-06-15");

      assert.strictEqual(Equal.equals(viaHelper, viaSchema), true);
      assert.deepEqual(yield* encodeLocalDateFromString(viaHelper), "2024-06-15");
      assert.deepEqual(yield* encodeLocalDateModel(viaHelper), {
        day: 15,
        month: 6,
        year: 2024,
      });
    })
  );

  it("keeps literal-kit member guards while adding decode statics", () => {
    expect(Organization.LicenseTier.is.enterprise("enterprise")).toBe(true);
    expect(Organization.LicenseTier.fromUnknown("team")).toBe("team");
    expect(O.isSome(Organization.LicenseTier.decodeOption("solo"))).toBe(true);
    expect(Membership.Role.is.owner("owner")).toBe(true);
    expect(Membership.Role.fromUnknown("member")).toBe("member");
    expect(Membership.Status.is.active("active")).toBe(true);
    expect(SourceKind.SourceKind.is.Agent("Agent")).toBe(true);
    expect(SourceKind.SourceKind.fromUnknown("System")).toBe("System");
    expect(Principal.SystemComponent.is.Runtime("Runtime")).toBe(true);
    expect(Principal.SystemComponent.fromUnknown("Policy")).toBe("Policy");
    expect(ClaimLifecycle.ClaimLifecycle.is.admitted("admitted")).toBe(true);
    expect(ClaimLifecycle.ClaimLifecycle.fromUnknown("candidate")).toBe("candidate");
    expect(Rule.Effect.is.allow("allow")).toBe(true);
    expect(Rule.Effect.fromUnknown("deny")).toBe("deny");
  });

  it("round-trips schema-derived values through absorbed invariants", () => {
    assertSchemaArbitraryDecodesToSelf(EntityId.EntityIdValue, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(EntityRef.EntityType, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(EntityRef.EntityRef, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(primitives.Ed25519Signature, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(primitives.EncryptionKeyId, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(primitives.HybridLogicalClock, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(primitives.VectorClock, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(SourceKind.SourceKind, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(Organization.LicenseTier, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(Membership.Role, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(Membership.Status, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(Principal.SystemComponent, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(Rule.Effect, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(Rule.Rule, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(Rule.Ruleset, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(ClaimLifecycle.ClaimLifecycle, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(ClaimLifecycle.ClaimLifecycleTransition, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(OnePasswordReference, { runs: 10 });

    assertCodecRoundTrip(EntityId.Options, { runs: 25 });
    assertCodecRoundTrip(EntityId.Definition, { runs: 25 });
    assertCodecRoundTrip(Principal.ServiceAccountPrincipal, { runs: 25 });
    assertCodecRoundTrip(Principal.AgentPrincipal, { runs: 25 });
    assertCodecRoundTrip(Principal.ConnectorAccountPrincipal, { runs: 25 });
    assertCodecRoundTrip(Principal.Principal, { runs: 25 });
  });

  it("keeps entity-id value statics colocated on the schema", () => {
    expect(EntityId.EntityIdValue.is(EntityId.EntityIdValue.make(1))).toBe(true);
    expect(EntityId.EntityIdValue.decodeUnknownSync(1)).toBe(EntityId.EntityIdValue.make(1));
    expect(O.isSome(EntityId.EntityIdValue.decodeUnknownOption(1))).toBe(true);
    expect(DocumentId.equivalence(DocumentId.make(1), DocumentId.make(1))).toBe(true);
  });
});
