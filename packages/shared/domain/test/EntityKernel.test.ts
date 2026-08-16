import { $SharedDomainId } from "@beep/identity/packages";
import { Cuid, CuidState } from "@beep/schema/Cuid";
import * as EntitySchema from "@beep/schema/EntitySchema";
import * as DomainBarrel from "@beep/shared-domain";
import * as EntityBarrel from "@beep/shared-domain/entity";
import * as BaseEntity from "@beep/shared-domain/entity/BaseEntity";
import * as EntityId from "@beep/shared-domain/entity/EntityId";
import * as EntityRef from "@beep/shared-domain/entity/EntityRef";
import * as Principal from "@beep/shared-domain/entity/Principal";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as primitives from "@beep/shared-domain/entity/primitives";
import * as SourceKind from "@beep/shared-domain/entity/SourceKind";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Crypto, Effect, Exit, Layer, Order } from "effect";
import { cast } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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

class Document extends BaseEntity.BaseEntity.Class<Document>($I`Document`)(
  DocumentId,
  {
    fields: {
      note: S.String,
      optionalNote: S.String.pipe(S.OptionFromNullOr),
      payload: S.Record(S.String, S.Unknown),
    },
    persisted: {
      note: EntitySchema.persist.text({
        columnName: "note",
      }),
      optionalNote: EntitySchema.persist.text({
        columnName: "optional_note",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      payload: EntitySchema.persist.jsonb(),
    },
  },
  $I.annote("Document", {
    description: "Document entity.",
  })
) {}

const documentInput = {
  createdAt: 1,
  createdByPrincipal: systemPrincipal,
  entityType: "SharedDocument",
  id: 1,
  note: "hello",
  optionalNote: null,
  orgId: 1,
  payload: {
    fixture: true,
  },
  publicId: "shared_document_a123",
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "Application",
  updatedAt: 2,
  updatedByPrincipal: systemPrincipal,
} as const;

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
      const decoded = DocumentId.decodeUnknownSync(1);
      expect(DocumentId.encodeSync(decoded)).toBe(1);
      expect(DocumentId.is(decoded)).toBe(true);
      const asAny: EntityId.Any = DocumentId;
      expect(asAny.tableName).toBe("shared_document");
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

describe("BaseEntity", () => {
  it("exports invariant fields and persistence descriptors", () => {
    const orgIdIndexHints = BaseEntity.BaseEntity.definition.persisted.orgId.indexHints;

    expect(BaseEntity.BaseEntity.definition.persisted.createdAt.valueStrategy).toBe("defaultedOnInsert");
    expect(BaseEntity.BaseEntity.definition.persisted.createdByPrincipal.storageKind).toBe("jsonb");
    expect(orgIdIndexHints === undefined ? undefined : A.map(orgIdIndexHints, (hint) => hint.kind)).toEqual([
      "btree",
      "lookup",
    ]);
    expect(BaseEntity.BaseEntity.definition.persisted.rowVersion.valueStrategy).toBe("incrementedOnWrite");
    expect(BaseEntity.BaseEntity.definition.fields.source).toBe(SourceKind.SourceKind);
  });

  it.effect(
    "extends with entity-specific schema fields and attached persistence metadata",
    Effect.fnUntraced(function* () {
      const document = yield* decodeEffect(Document)(documentInput);

      expect(EntitySchema.getDefinition(Document)).toBe(Document.definition);
      expect(Document.definition.entityId).toBe(DocumentId);
      expect(Document.definition.tableName).toBe("shared_document");
      expect(Document.definition.persisted.id.valueStrategy).toBe("generatedOnInsert");
      expect(Document.definition.persisted.entityType.columnName).toBe("entity_type");
      expect(Document.definition.persisted.publicId.columnName).toBe("public_id");
      expect(Document.definition.persisted.publicId.valueStrategy).toBe("computedByServiceOnInsert");
      expect(Document.definition.persisted.note.storageKind).toBe("text");
      expect(Document.definition.persisted.optionalNote.indexHints?.[0]?.kind).toBe("lookup");
      expect(Document.definition.persisted.payload.storageKind).toBe("jsonb");
      expect(
        EntitySchema.selectedRowFieldShape("optionalNote", Document.definition.fields.optionalNote).allowsNull
      ).toBe(true);
      expect(O.isNone(document.optionalNote)).toBe(true);
      expect(document.payload).toEqual({ fixture: true });
    })
  );

  it("derives variant field presence from persistence strategies", () => {
    expect(A.sort(Object.keys(Document.fields), Order.String)).toContain("id");
    expect(Object.keys(Document.insert.fields)).not.toContain("id");
    expect(Object.keys(Document.insert.fields)).toContain("entityType");
    expect(Object.keys(Document.insert.fields)).toContain("publicId");
    expect(Object.keys(Document.update.fields)).not.toContain("publicId");
    expect(Object.keys(Document.insert.fields)).toContain("note");
    expect(Object.keys(Document.jsonCreate.fields)).not.toContain("createdAt");
    expect(Object.keys(Document.jsonCreate.fields)).not.toContain("publicId");
    expect(Object.keys(Document.jsonCreate.fields)).toContain("note");
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
      expect(EntityBarrel.BaseEntity.BaseEntity).toBe(BaseEntity.BaseEntity);
      expect(EntityBarrel.EntityId.EntityIdValue).toBe(EntityId.EntityIdValue);
      expect(EntityBarrel.EntityRef.EntityRef).toBe(EntityRef.EntityRef);
      expect(EntityBarrel.PublicEntityId.factory).toBe(PublicEntityId.factory);
      expect(EntityBarrel.Principal.Principal).toBe(Principal.Principal);
      expect(EntityBarrel.primitives.VectorClock).toBe(primitives.VectorClock);
      expect(EntityBarrel.SourceKind.SourceKind).toBe(SourceKind.SourceKind);
      expect(DomainBarrel.BaseEntity.BaseEntity).toBe(BaseEntity.BaseEntity);
      expect(DomainBarrel.PublicEntityId.factory).toBe(PublicEntityId.factory);
    })
  );
});
