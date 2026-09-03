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
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { makeEffect } from "effect/SchemaParser";
import { FastCheck as fc } from "effect/testing";
import { hasFunctionStatic, invokeStatic } from "./StaticProbes.ts";

const $I = $SharedDomainId.create("entity/test/EntityKernel");
const makeSharedId = EntityId.factory("shared", $I);
const DocumentId = makeSharedId("document");
const DocumentPublicId = PublicEntityId.factory(DocumentId);
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

class ProductDocument extends ProductEntity.Entity<ProductDocument>()(DocumentId)(
  {
    note: S.String.pipe(ProductEntity.pg.text()),
  },
  $I.annote("ProductDocument", {
    description: "Product-entity kit test model.",
  })
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

      expect(DocumentId.is(1)).toBe(true);
      expect(DocumentId.is(0)).toBe(false);
      expect(DocumentId.decodeSync(1)).toBe(1);
      expect(DocumentId.decodeUnknownSync(1)).toBe(1);
      expect(O.isSome(DocumentId.decodeUnknownOption(1))).toBe(true);
      expect(O.isNone(DocumentId.decodeUnknownOption(0))).toBe(true);
      const decoded = yield* DocumentId.decodeUnknownEffect(1);
      expect(decoded).toBe(1);
      expect(yield* DocumentId.encodeEffect(decoded)).toBe(1);
      expect(DocumentId.equivalence(decoded, decoded)).toBe(true);
      expect(DocumentId.equivalence(decoded, cast(2))).toBe(false);
      // The canonical static is the schema's own (per-AST memoized) equivalence, not the
      // codec groups' `dual(2, ...)` wrapper: the wrapper curries below its arity, while the
      // plain form always answers with a boolean.
      expect(DocumentId.equivalence).toBe(S.toEquivalence(DocumentId));
      expect(P.isFunction(O.getOrThrow(invokeStatic(DocumentId, "equivalence")))).toBe(false);

      const Annotated = DocumentId.annotate({ description: "proof" });
      expect(Annotated).not.toBe(DocumentId);
      expect(hasFunctionStatic(Annotated, "is")).toBe(true);
      expect(hasFunctionStatic(Annotated, "decodeSync")).toBe(true);
      expect(hasFunctionStatic(Annotated, "decodeUnknownSync")).toBe(true);
      expect(hasFunctionStatic(Annotated, "decodeUnknownEffect")).toBe(true);
      expect(hasFunctionStatic(Annotated, "fromUnknown")).toBe(false);
      expect(O.getOrThrow(invokeStatic(Annotated, "decodeSync", 1))).toBe(1);
      expect(O.getOrThrow(invokeStatic(Annotated, "decodeUnknownSync", 1))).toBe(1);
      expect(O.getOrThrow(invokeStatic(Annotated, "equivalence", decoded, decoded))).toBe(true);
      expect(O.getOrThrow(invokeStatic(Annotated, "equivalence", decoded, 2))).toBe(false);
      expect(P.isFunction(O.getOrThrow(invokeStatic(Annotated, "equivalence")))).toBe(false);
      const annotatedEquivalence: unknown = Reflect.get(Annotated, "equivalence");
      expect(annotatedEquivalence).toBe(DocumentId.equivalence);
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

type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

class BaseDocument extends EntityBarrel.BaseEntity.Entity<BaseDocument>()(DocumentId)(
  {
    note: S.String.pipe(EntityBarrel.BaseEntity.pg.text()),
  },
  $I.annote("BaseDocument", { description: "Base-tier test model." })
) {}

class OrgDocument extends EntityBarrel.OrgEntity.Entity<OrgDocument>()(DocumentId)(
  {
    note: S.String.pipe(EntityBarrel.OrgEntity.pg.text()),
  },
  $I.annote("OrgDocument", { description: "Org-tier test model." })
) {}

// Brand and literal preservation through the generic tier factory (spike law).
export type _IdBrandKept = Expect<
  IsEqual<InstanceType<typeof ProductDocument>["id"], EntityId.EntityIdValueFor<"SharedDocumentId">>
>;
export type _EntityTypeLiteralKept = Expect<
  IsEqual<InstanceType<typeof ProductDocument>["entityType"], "SharedDocument">
>;

describe("entity tier family", () => {
  it("scales column sets down the tier ladder", () => {
    expect(Object.keys(BaseDocument.fields)).toEqual(
      expect.arrayContaining(["createdAt", "rowVersion", "updatedAt", "note", "entityType", "id"])
    );
    expect(Object.keys(BaseDocument.fields)).not.toContain("orgId");
    expect(Object.keys(BaseDocument.fields)).not.toContain("publicId");
    expect(Object.keys(OrgDocument.fields)).toEqual(
      expect.arrayContaining(["createdByPrincipal", "orgId", "source", "schemaVersion"])
    );
    expect(Object.keys(OrgDocument.fields)).not.toContain("publicId");
  });

  it("derives colocated default indexes per tier", () => {
    const orgConfig = OrgDocument.pipe(toPgTable, getTableConfig);
    const names = orgConfig.indexes.map((index) => index.config.name);
    expect(names).toEqual(
      expect.arrayContaining(["shared_document_org_id_btree_idx", "shared_document_source_btree_idx"])
    );
    expect(names).not.toContain("shared_document_public_id_unique_idx");
  });

  it("rejects extensions that shadow inherited kit columns", () => {
    expect(() => EntityBarrel.BaseEntity.kit.extend(() => ({ columns: { createdAt: S.String } }) as never)).toThrow(
      "already a kit default column"
    );
  });

  it("rejects own fields that shadow identity columns", () => {
    expect(() =>
      ProductEntity.Entity<never>()(DocumentId)(
        { publicId: S.String } as never,
        $I.annote("ShadowedDocument", { description: "Shadowed identity test model." })
      )
    ).toThrow("identity column");
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
      expect(EntityBarrel.ProductEntity.Entity).toBe(ProductEntity.Entity);
      expect(EntityBarrel.EntityId.EntityIdValue).toBe(EntityId.EntityIdValue);
      expect(EntityBarrel.EntityRef.EntityRef).toBe(EntityRef.EntityRef);
      expect(EntityBarrel.PublicEntityId.factory).toBe(PublicEntityId.factory);
      expect(EntityBarrel.Principal.Principal).toBe(Principal.Principal);
      expect(EntityBarrel.primitives.VectorClock).toBe(primitives.VectorClock);
      expect(EntityBarrel.SourceKind.SourceKind).toBe(SourceKind.SourceKind);
      expect(DomainBarrel.ProductEntity.Entity).toBe(ProductEntity.Entity);
      expect(DomainBarrel.PublicEntityId.factory).toBe(PublicEntityId.factory);
    })
  );
});
