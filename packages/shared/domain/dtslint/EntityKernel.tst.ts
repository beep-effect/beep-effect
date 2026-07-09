import { $SharedDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import * as Model from "@beep/schema/Model";
import * as DomainBarrel from "@beep/shared-domain";
import * as EntityBarrel from "@beep/shared-domain/entity";
import * as BaseEntity from "@beep/shared-domain/entity/BaseEntity";
import * as EntityId from "@beep/shared-domain/entity/EntityId";
import * as EntityRef from "@beep/shared-domain/entity/EntityRef";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import type * as Shared from "@beep/shared-domain/identity/Shared";
import type * as O from "effect/Option";

const $I = $SharedDomainId.create("entity/dtslint/EntityKernel");
const makeSharedId = EntityId.factory("shared", $I);
const DocumentId = makeSharedId("document");
const CustomDocumentId = makeSharedId("document", {
  brand: "CustomDocumentId",
  entityType: "CustomDocument",
  resource: "custom.document",
  tableName: "custom_document",
});

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

class ConfidentialDocument extends BaseEntity.BaseEntity.Class<ConfidentialDocument>($I`ConfidentialDocument`)(
  CustomDocumentId,
  {
    fields: {
      optionalSecret: Model.FieldOption(S.String),
      secret: Model.Sensitive(S.String),
    },
    persisted: {
      optionalSecret: EntitySchema.persist.text(),
      secret: EntitySchema.persist.text(),
    },
  }
) {}

declare const documentIdValue: typeof DocumentId.Type;

describe("shared entity kernel types", () => {
  it("preserves EntityId literals and statics", () => {
    expect<typeof DocumentId.tableName>().type.toBe<"shared_document">();
    expect<typeof DocumentId.resource>().type.toBe<"shared.document">();
    expect<typeof DocumentId.entityType>().type.toBe<"SharedDocument">();
    expect<typeof DocumentId.brand>().type.toBe<"SharedDocumentId">();
    expect<typeof DocumentId.definition.name>().type.toBe<"document">();
    expect<typeof DocumentId.equivalence>().type.toBe<
      (self: typeof DocumentId.Type, that: typeof DocumentId.Type) => boolean
    >();
    expect<typeof CustomDocumentId.tableName>().type.toBe<"custom_document">();
    expect<typeof CustomDocumentId.resource>().type.toBe<"custom.document">();
    expect<typeof CustomDocumentId.entityType>().type.toBe<"CustomDocument">();
    expect<typeof CustomDocumentId.brand>().type.toBe<"CustomDocumentId">();
    expect<typeof DocumentId.Type>().type.toBe<EntityId.EntityIdValueFor<"SharedDocumentId">>();
  });

  it("preserves EntityRef and BaseEntity definition types", () => {
    const ref = EntityRef.make(DocumentId, documentIdValue);

    expect(ref).type.toBeAssignableTo<EntityRef.EntityRef>();
    expect<typeof BaseEntity.BaseEntity.definition.persisted.createdAt.storageKind>().type.toBe<"timestampMillis">();
    expect<typeof BaseEntity.BaseEntity.definition.persisted.orgId.storageKind>().type.toBe<"entityId">();
    expect<typeof Document.definition.entityId.tableName>().type.toBe<"shared_document">();
    expect<typeof Document.definition.persisted.id.storageKind>().type.toBe<"entityId">();
    expect<typeof Document.definition.persisted.id.valueStrategy>().type.toBe<"generatedOnInsert">();
    expect<typeof Document.definition.persisted.publicId.columnName>().type.toBe<"public_id">();
    expect<typeof Document.definition.persisted.publicId.valueStrategy>().type.toBe<"computedByServiceOnInsert">();
    expect<typeof Document.definition.persisted.note.columnName>().type.toBe<"note">();
    expect<typeof Document.definition.persisted.note.storageKind>().type.toBe<"text">();
    expect<typeof Document.definition.persisted.optionalNote.columnName>().type.toBe<"optional_note">();
    expect<(typeof Document.definition.persisted.optionalNote.indexHints)[0]["kind"]>().type.toBe<"lookup">();
    expect<EntityRef.EntityRefFor<typeof DocumentId>["id"]>().type.toBe<typeof DocumentId.Type>();
  });

  it("preserves decoded field types and generated variants", () => {
    expect<Document["id"]>().type.toBe<typeof DocumentId.Type>();
    expect<Document["publicId"]>().type.toBe<PublicEntityId.PublicEntityIdFor<typeof DocumentId>>();
    expect<Document["orgId"]>().type.toBe<Shared.OrganizationId>();
    expect<Document["optionalNote"]>().type.toBe<O.Option<string>>();
    expect<ConfidentialDocument["optionalSecret"]>().type.toBe<O.Option<string>>();
    expect<typeof Document.fields.optionalNote.Type>().type.toBe<O.Option<string>>();
    expect<"id">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof Document.insert>>();
    expect<"publicId">().type.toBeAssignableTo<keyof S.Schema.Type<typeof Document.insert>>();
    expect<"publicId">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof Document.update>>();
    expect<"publicId">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof Document.jsonCreate>>();
    expect<"entityType">().type.toBeAssignableTo<keyof S.Schema.Type<typeof Document.insert>>();
    expect<"note">().type.toBeAssignableTo<keyof S.Schema.Type<typeof Document.insert>>();
    expect<"secret">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof ConfidentialDocument.json>>();
  });

  it("keeps public barrel exports type-equivalent to module exports", () => {
    expect(EntityBarrel.BaseEntity.BaseEntity).type.toBe<typeof BaseEntity.BaseEntity>();
    expect(EntityBarrel.EntityId.EntityIdValue).type.toBe<typeof EntityId.EntityIdValue>();
    expect(EntityBarrel.EntityRef.EntityRef).type.toBe<typeof EntityRef.EntityRef>();
    expect(EntityBarrel.PublicEntityId.factory).type.toBe<typeof PublicEntityId.factory>();
    expect(DomainBarrel.Identity.Shared.OrganizationId).type.toBe<typeof Shared.OrganizationId>();
    expect(DomainBarrel.BaseEntity.BaseEntity).type.toBe<typeof BaseEntity.BaseEntity>();
  });
});
