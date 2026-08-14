import { toPgTable } from "@beep/effect-drizzle/pg";
import { $SharedDomainId } from "@beep/identity/packages";
import { Cuid, CuidState } from "@beep/schema/Cuid";
import * as DomainBarrel from "@beep/shared-domain";
import { Membership, Organization } from "@beep/shared-domain/entities";
import * as EntityBarrel from "@beep/shared-domain/entity";
import * as EntityId from "@beep/shared-domain/entity/EntityId";
import * as EntityRef from "@beep/shared-domain/entity/EntityRef";
import * as Principal from "@beep/shared-domain/entity/Principal";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as primitives from "@beep/shared-domain/entity/primitives";
import * as SourceKind from "@beep/shared-domain/entity/SourceKind";
import { fcRuns } from "@beep/test-utils";
import { Str } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Crypto, Effect, Exit, Layer } from "effect";
import { cast } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { makeEffect } from "effect/SchemaParser";
import { FastCheck as fc } from "effect/testing";

const $I = $SharedDomainId.create("entity/test/EntityKernel");
const makeSharedId = EntityId.factory("shared", $I);
const DocumentId = makeSharedId("document");
const DocumentPublicId = PublicEntityId.factory(DocumentId);
const ProductDocumentEntity = ProductEntity.make(DocumentId);
const CustomDocumentId = makeSharedId("document", {
  brand: "CustomDocumentId",
  description: "Custom document id.",
  entityType: "CustomDocument",
  resource: "custom.document",
  tableName: "custom_document",
});

const decodeEffect = <Schema extends S.Top>(schema: Schema) => S.decodeUnknownEffect(schema);
const TestCryptoLayer = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (_algorithm, data) => Effect.succeed(data),
    randomBytes: (size) => new Uint8Array(size).fill(1),
  })
);
const CuidTestLayer = CuidState.Default.pipe(Layer.provideMerge(TestCryptoLayer));
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));
const expectFailure = Effect.fn("expectFailure")(function* <A, E>(effect: Effect.Effect<A, E, never>) {
  const exit = yield* Effect.exit(effect);
  assert.strictEqual(Exit.isFailure(exit), true);
});

const systemPrincipal = {
  component: "Runtime",
  kind: "System",
} as const;

class ProductDocument extends ProductDocumentEntity.Entity<ProductDocument>(ProductDocumentEntity.tableName)(
  {
    note: S.String.pipe(ProductDocumentEntity.pg.text()),
    ...ProductDocumentEntity.identityFields,
  },
  $I.annote("ProductDocument", {
    description: "Product-entity kit test model.",
  }),
  ProductDocumentEntity.entityExtras
) {}

describe("EntityId", () => {
  it.effect(
    "decodes generated entity ids and rejects invalid ids",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(EntityId.EntityIdValue);

      expect(yield* decode(1)).toBe(1);
      expect(yield* decode(2_147_483_647)).toBe(2_147_483_647);
      yield* expectFailure(decode(0));
      yield* expectFailure(decode(2_147_483_648));
      yield* expectFailure(decode(1.5));
    })
  );

  it.effect(
    "derives default metadata and schema statics",
    Effect.fnUntraced(function* () {
      expect(DocumentId.slice).toBe("shared");
      expect(DocumentId.tableName).toBe("shared_document");
      expect(DocumentId.resource).toBe("shared.document");
      expect(DocumentId.entityType).toBe("SharedDocument");
      expect(DocumentId.brand).toBe("SharedDocumentId");
      expect(DocumentId.definition.description).toBe("SharedDocument entity identifier.");
      expect(DocumentId.equivalence(cast(1), cast(1))).toBe(true);
      expect(DocumentId.equivalence(cast(1), cast(2))).toBe(false);
      expect(yield* decodeEffect(DocumentId)(1)).toBe(1);
    })
  );

  it("preserves explicit metadata overrides", () => {
    expect(CustomDocumentId.tableName).toBe("custom_document");
    expect(CustomDocumentId.resource).toBe("custom.document");
    expect(CustomDocumentId.entityType).toBe("CustomDocument");
    expect(CustomDocumentId.brand).toBe("CustomDocumentId");
    expect(O.getOrThrow(CustomDocumentId.definition.overrides.description)).toBe("Custom document id.");
  });

  it("supports data-first and data-last factories", () => {
    const dataFirst = EntityId.factory("shared", $I)("task");
    const dataLast = EntityId.factory($I)("shared")("task");

    expect(dataFirst.tableName).toBe("shared_task");
    expect(dataLast.tableName).toBe("shared_task");
  });
});

describe("PublicEntityId", () => {
  it.effect(
    "derives URL-safe public ids from entity metadata",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(DocumentPublicId);
      const publicId = yield* decode("shared_document_a123");

      expect(DocumentPublicId.prefix).toBe("shared_document");
      expect(DocumentPublicId.brand).toBe("SharedDocumentPublicId");
      expect(DocumentPublicId.sourceEntityId).toBe(DocumentId);
      expect(PublicEntityId.fromCuid(DocumentId, Cuid.make("a123"))).toBe(publicId);
      expect(DocumentPublicId.equivalence(publicId, publicId)).toBe(true);
      yield* expectFailure(decode("shared_user_a123"));
      yield* expectFailure(decode("shared_document_123"));
    })
  );

  it.effect(
    "generates public ids with the entity prefix",
    Effect.fnUntraced(function* () {
      const publicId = yield* PublicEntityId.generate(DocumentId);

      expect(DocumentPublicId.is(publicId)).toBe(true);
      expect(publicId.startsWith(`${DocumentId.tableName}_`)).toBe(true);
    }, provideScopedLayer(CuidTestLayer))
  );
});

describe("ProductEntity", () => {
  it("preserves the six product variant memberships", () => {
    expect(Object.keys(ProductDocument.fields)).toContain("id");
    expect(Object.keys(ProductDocument.insert.fields)).toEqual(
      expect.arrayContaining([
        "createdAt",
        "createdByPrincipal",
        "entityType",
        "note",
        "orgId",
        "publicId",
        "schemaVersion",
        "source",
        "updatedAt",
        "updatedByPrincipal",
      ])
    );
    expect(Object.keys(ProductDocument.insert.fields)).not.toContain("id");
    expect(Object.keys(ProductDocument.insert.fields)).not.toContain("rowVersion");
    expect(Object.keys(ProductDocument.update.fields)).toEqual(
      expect.arrayContaining(["id", "note", "rowVersion", "updatedAt"])
    );
    expect(Object.keys(ProductDocument.update.fields)).not.toContain("createdAt");
    expect(Object.keys(ProductDocument.update.fields)).not.toContain("publicId");
    expect(Object.keys(ProductDocument.json.fields)).toEqual(expect.arrayContaining(["id", "publicId", "rowVersion"]));
    expect(Object.keys(ProductDocument.jsonCreate.fields)).toEqual(["note"]);
    expect(Object.keys(ProductDocument.jsonUpdate.fields)).toEqual(["note"]);
  });

  it("applies insert-time audit defaults without inventing row identity", () => {
    const inserted = Effect.runSync(
      makeEffect(ProductDocument.insert)({
        createdByPrincipal: systemPrincipal,
        entityType: DocumentId.entityType,
        note: "hello",
        orgId: 1,
        publicId: "shared_document_a123",
        schemaVersion: "0.0.0",
        source: "Application",
        updatedByPrincipal: systemPrincipal,
      })
    );

    expect(inserted.createdAt).toBeDefined();
    expect(inserted.updatedAt).toBeDefined();
    expect("id" in inserted).toBe(false);
    expect("rowVersion" in inserted).toBe(false);
  });

  it("materializes model extras into kit-provided table indexes", () => {
    const membership = Membership.Model.pipe(toPgTable, getTableConfig);
    const organization = Organization.Model.pipe(toPgTable, getTableConfig);
    const indexNames = (config: { indexes: ReadonlyArray<{ config: { name?: string } }> }) =>
      config.indexes.map((index) => index.config.name);

    expect(indexNames(membership)).toEqual(
      expect.arrayContaining(["shared_membership_user_id_btree_idx", "shared_membership_public_id_unique_idx"])
    );
    expect(indexNames(organization)).toEqual(
      expect.arrayContaining([
        "shared_organization_license_tier_lookup_idx",
        "shared_organization_slug_unique_idx",
        "shared_organization_public_id_unique_idx",
      ])
    );
  });
});

describe("EntityRef and shared entity primitives", () => {
  it.effect(
    "builds entity references and validates primitive schemas",
    Effect.fnUntraced(function* () {
      const id = yield* S.decodeEffect(DocumentId)(1);
      const ref = EntityRef.make(DocumentId, id);
      const dataLastRef = EntityRef.make(id)(DocumentId);
      const resultRef = EntityRef.makeResult(DocumentId, id);

      expect(ref.entityType).toBe("SharedDocument");
      expect(dataLastRef.id).toBe(1);
      expect(Result.isSuccess(resultRef)).toBe(true);
      if (Result.isSuccess(resultRef)) {
        expect(resultRef.success.id).toBe(1);
      }
      expect(yield* S.decodeEffect(EntityRef.EntityType)("SharedDocument")).toBe("SharedDocument");
      const sha256Fixture = Str.repeat("a", 64);
      expect(yield* S.decodeEffect(primitives.Sha256)(sha256Fixture)).toBe(sha256Fixture);
      expect(yield* S.decodeEffect(primitives.Ed25519Signature)("signature")).toBe("signature");
      expect(yield* S.decodeEffect(primitives.EncryptionKeyId)("key")).toBe("key");
      expect(yield* S.decodeEffect(primitives.HybridLogicalClock)("clock")).toBe("clock");
      expect(yield* S.decodeEffect(primitives.VectorClock)({ replica: 1 })).toEqual({ replica: 1 });
    })
  );

  it("round-trips schema-derived document ids through entity references", () =>
    fc.assert(
      fc.property(S.toArbitrary(DocumentId)(fc), (id) => {
        const ref = EntityRef.make(DocumentId, id);
        const encodedRef = S.encodeSync(EntityRef.EntityRef)(ref);
        const decodedRef = S.decodeSync(EntityRef.EntityRef)(encodedRef);

        expect(encodedRef).toEqual({
          entityType: DocumentId.entityType,
          id,
        });
        expect(decodedRef.entityType).toBe(DocumentId.entityType);
        expect(DocumentId.equivalence(cast(decodedRef.id), cast(id))).toBe(true);
        expect(Result.isSuccess(EntityRef.makeResult(DocumentId, id))).toBe(true);
      }),
      fcRuns(50)
    ));

  it.effect(
    "decodes principals, source kinds, and barrel exports",
    Effect.fnUntraced(function* () {
      const user = yield* decodeEffect(Principal.UserPrincipal)({
        kind: "User",
        userId: 1,
      });
      const serviceAccount = yield* decodeEffect(Principal.ServiceAccountPrincipal)({
        kind: "ServiceAccount",
        serviceAccountId: 1,
      });
      const agent = yield* decodeEffect(Principal.AgentPrincipal)({
        agentId: 1,
        agentVersionId: 1,
        kind: "Agent",
        onBehalfOfUserId: 1,
      });
      const connector = yield* decodeEffect(Principal.ConnectorAccountPrincipal)({
        connectorAccountId: 1,
        kind: "ConnectorAccount",
      });
      const system = yield* decodeEffect(Principal.SystemPrincipal)({
        component: "Runtime",
        kind: "System",
      });
      const principal = yield* decodeEffect(Principal.Principal)({
        component: "Runtime",
        kind: "System",
      });

      expect(user.kind).toBe("User");
      expect(O.isNone(serviceAccount.onBehalfOfUserId)).toBe(true);
      expect(O.isNone(agent.onBehalfOfTeamId)).toBe(true);
      expect(O.isNone(connector.onBehalfOfUserId)).toBe(true);
      expect(system.component).toBe("Runtime");
      expect(S.is(Principal.SystemPrincipal)(principal)).toBe(true);
      expect(SourceKind.SourceKind.is.Agent("Agent")).toBe(true);
      expect(EntityBarrel.ProductEntity.make).toBe(ProductEntity.make);
      expect(EntityBarrel.EntityId.EntityIdValue).toBe(EntityId.EntityIdValue);
      expect(EntityBarrel.EntityRef.EntityRef).toBe(EntityRef.EntityRef);
      expect(EntityBarrel.PublicEntityId.factory).toBe(PublicEntityId.factory);
      expect(EntityBarrel.Principal.Principal).toBe(Principal.Principal);
      expect(EntityBarrel.primitives.VectorClock).toBe(primitives.VectorClock);
      expect(EntityBarrel.SourceKind.SourceKind).toBe(SourceKind.SourceKind);
      expect(DomainBarrel.ProductEntity.make).toBe(ProductEntity.make);
      expect(DomainBarrel.PublicEntityId.factory).toBe(PublicEntityId.factory);
    })
  );
});
