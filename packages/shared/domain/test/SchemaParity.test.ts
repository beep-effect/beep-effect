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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe, expect } from "@effect/vitest";
import { assertNone, assertSuccess, assertTrue } from "@effect/vitest/utils";
import { Effect, Equal, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeLocalDateFromString = S.decodeEffect(LocalDateFromString);
const decodeUnknownEntityIdOptions = S.decodeUnknownEffect(EntityId.Options);
const encodeLocalDateFromString = S.encodeEffect(LocalDateFromString);
const encodeLocalDateModel = S.encodeEffect(LocalDateModel);
const encodeEntityIdDefinition = S.encodeEffect(EntityId.Definition);
const encodeEntityIdOptions = S.encodeEffect(EntityId.Options);
const encodePrincipalAgentPrincipal = S.encodeEffect(Principal.AgentPrincipal);
const encodePrincipalConnectorAccountPrincipal = S.encodeEffect(Principal.ConnectorAccountPrincipal);
const encodePrincipalServiceAccountPrincipal = S.encodeEffect(Principal.ServiceAccountPrincipal);

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

const testSchemaDecodesToSelf = <Schema extends S.Codec<unknown>>(name: string, schema: Schema, runs = 25) => {
  const decode = S.decodeUnknownEffect(schema);
  const equivalent = S.toEquivalence(schema);
  const isValue = S.is(schema);
  it.effect.prop(
    name,
    [schema],
    Effect.fnUntraced(function* ([value]) {
      const decoded = yield* decode(value);
      assertTrue(isValue(value) && equivalent(decoded, value));
    }),
    { arbitrary: fcRuns(runs) }
  );
};

const testCodecRoundTrip = <A, I>(name: string, schema: S.Codec<A, I, never, never>) => {
  const decode = S.decodeUnknownEffect(schema);
  const encode = S.encodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    name,
    [schema],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalent(decoded, value));
    }),
    { arbitrary: fcRuns(25) }
  );
};

describe("shared-domain schema parity", () => {
  it.effect(
    "keeps EntityId option defaults encoded as optional keys",
    Effect.fnUntraced(function* () {
      const emptyOptions = EntityId.Options.make({});
      const explicitOptions = yield* decodeUnknownEntityIdOptions({
        brand: "CustomDocumentId",
        description: "Custom document id.",
        entityType: "CustomDocument",
        resource: "custom.document",
        tableName: "custom_document",
      });

      assertNone(emptyOptions.brand);
      expect(yield* encodeEntityIdOptions(emptyOptions)).toEqual({});
      expect(yield* encodeEntityIdOptions(explicitOptions)).toEqual({
        brand: "CustomDocumentId",
        description: "Custom document id.",
        entityType: "CustomDocument",
        resource: "custom.document",
        tableName: "custom_document",
      });
      expect(yield* encodeEntityIdDefinition(CustomDocumentId.definition)).toEqual({
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
    })
  );

  it.effect(
    "keeps principal constructor defaults off the encoded wire shape",
    Effect.fnUntraced(function* () {
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

      expect(yield* encodePrincipalServiceAccountPrincipal(serviceAccount)).toEqual({
        kind: "ServiceAccount",
        serviceAccountId: 1,
      });
      expect(yield* encodePrincipalAgentPrincipal(agent)).toEqual({
        agentId: 1,
        agentVersionId: 1,
        kind: "Agent",
        onBehalfOfUserId: 1,
      });
      expect(yield* encodePrincipalConnectorAccountPrincipal(connector)).toEqual({
        connectorAccountId: 1,
        kind: "ConnectorAccount",
      });
    })
  );

  it.effect(
    "keeps fromString byte-identical with the LocalDateFromString codec",
    Effect.fnUntraced(function* () {
      const viaHelper = yield* fromString("2024-06-15");
      const viaSchema = yield* decodeLocalDateFromString("2024-06-15");

      assertTrue(Equal.equals(viaHelper, viaSchema));
      assert.deepEqual(yield* encodeLocalDateFromString(viaHelper), "2024-06-15");
      assert.deepEqual(yield* encodeLocalDateModel(viaHelper), {
        day: 15,
        month: 6,
        year: 2024,
      });
    })
  );

  it("keeps literal-kit member guards while adding decode statics", () => {
    assertTrue(Organization.LicenseTier.is.enterprise("enterprise"));
    assertSuccess(S.decodeResult(Organization.LicenseTier)("team"), "team");
    S.decodeOption(Organization.LicenseTier)("solo").pipe(O.isSome, assertTrue);
    assertTrue(Membership.Role.is.owner("owner"));
    assertSuccess(S.decodeResult(Membership.Role)("member"), "member");
    assertTrue(Membership.Status.is.active("active"));
    assertSuccess(S.decodeResult(Membership.Status)("active"), "active");
    assertTrue(SourceKind.SourceKind.is.Agent("Agent"));
    assertSuccess(S.decodeResult(SourceKind.SourceKind)("System"), "System");
    assertTrue(Principal.SystemComponent.is.Runtime("Runtime"));
    assertSuccess(S.decodeResult(Principal.SystemComponent)("Policy"), "Policy");
    assertTrue(ClaimLifecycle.ClaimLifecycle.is.admitted("admitted"));
    assertSuccess(S.decodeResult(ClaimLifecycle.ClaimLifecycle)("candidate"), "candidate");
    assertTrue(Rule.Effect.is.allow("allow"));
    assertSuccess(S.decodeResult(Rule.Effect)("deny"), "deny");
  });

  describe("round-trips schema-derived values through absorbed invariants", () => {
    testSchemaDecodesToSelf("EntityId.EntityIdValue decodes to self", EntityId.EntityIdValue);
    testSchemaDecodesToSelf("EntityRef.EntityType decodes to self", EntityRef.EntityType);
    testSchemaDecodesToSelf("EntityRef.EntityRef decodes to self", EntityRef.EntityRef);
    testSchemaDecodesToSelf("primitives.Ed25519Signature decodes to self", primitives.Ed25519Signature);
    testSchemaDecodesToSelf("primitives.EncryptionKeyId decodes to self", primitives.EncryptionKeyId);
    testSchemaDecodesToSelf("primitives.HybridLogicalClock decodes to self", primitives.HybridLogicalClock);
    testSchemaDecodesToSelf("primitives.VectorClock decodes to self", primitives.VectorClock);
    testSchemaDecodesToSelf("SourceKind.SourceKind decodes to self", SourceKind.SourceKind);
    testSchemaDecodesToSelf("Organization.LicenseTier decodes to self", Organization.LicenseTier);
    testSchemaDecodesToSelf("Membership.Role decodes to self", Membership.Role);
    testSchemaDecodesToSelf("Membership.Status decodes to self", Membership.Status);
    testSchemaDecodesToSelf("Principal.SystemComponent decodes to self", Principal.SystemComponent);
    testSchemaDecodesToSelf("Rule.Effect decodes to self", Rule.Effect);
    testSchemaDecodesToSelf("Rule.Rule decodes to self", Rule.Rule);
    testSchemaDecodesToSelf("Rule.Ruleset decodes to self", Rule.Ruleset);
    testSchemaDecodesToSelf("ClaimLifecycle.ClaimLifecycle decodes to self", ClaimLifecycle.ClaimLifecycle);
    testSchemaDecodesToSelf(
      "ClaimLifecycle.ClaimLifecycleTransition decodes to self",
      ClaimLifecycle.ClaimLifecycleTransition
    );
    testSchemaDecodesToSelf("OnePasswordReference decodes to self", OnePasswordReference, 10);
    testCodecRoundTrip("EntityId.Options codec round trip", EntityId.Options);
    testCodecRoundTrip("EntityId.Definition codec round trip", EntityId.Definition);
    testCodecRoundTrip("Principal.ServiceAccountPrincipal codec round trip", Principal.ServiceAccountPrincipal);
    testCodecRoundTrip("Principal.AgentPrincipal codec round trip", Principal.AgentPrincipal);
    testCodecRoundTrip("Principal.ConnectorAccountPrincipal codec round trip", Principal.ConnectorAccountPrincipal);
    testCodecRoundTrip("Principal.Principal codec round trip", Principal.Principal);
  });

  it("keeps entity-id value statics colocated on the schema", () => {
    assertTrue(S.is(EntityId.EntityIdValue)(EntityId.EntityIdValue.make(1)));
    expect(Result.getOrThrow(S.decodeResult(EntityId.EntityIdValue)(1))).toBe(EntityId.EntityIdValue.make(1));
    S.decodeOption(EntityId.EntityIdValue)(1).pipe(O.isSome, assertTrue);
    assertTrue(DocumentId.equivalence(DocumentId.make(1), DocumentId.make(1)));
  });
});
