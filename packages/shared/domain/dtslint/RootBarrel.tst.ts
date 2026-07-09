import * as Domain from "@beep/shared-domain";
import { describe, expect, it } from "tstyche";
import type * as Organization from "@beep/shared-domain/entities/Organization";
import type * as BaseEntity from "@beep/shared-domain/entity/BaseEntity";
import type * as EntityId from "@beep/shared-domain/entity/EntityId";
import type * as EntityRef from "@beep/shared-domain/entity/EntityRef";
import type * as Principal from "@beep/shared-domain/entity/Principal";
import type * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import type * as SourceKind from "@beep/shared-domain/entity/SourceKind";
import type * as LocalDate from "@beep/shared-domain/values/LocalDate";

describe("@beep/shared-domain root barrel", () => {
  it("keeps root namespaces wired to their public modules", () => {
    expect(Domain.VERSION).type.toBe<"0.0.0">();
    expect(Domain.Entities.Organization.Model).type.toBe<typeof Organization.Model>();
    expect(Domain.Values.LocalDate.Model).type.toBe<typeof LocalDate.Model>();
    expect(Domain.BaseEntity.BaseEntity).type.toBe<typeof BaseEntity.BaseEntity>();
    expect(Domain.EntityId.EntityIdValue).type.toBe<typeof EntityId.EntityIdValue>();
    expect(Domain.EntityRef.EntityRef).type.toBe<typeof EntityRef.EntityRef>();
    expect(Domain.PublicEntityId.factory).type.toBe<typeof PublicEntityId.factory>();
    expect(Domain.Principal.Principal).type.toBe<typeof Principal.Principal>();
    expect(Domain.SourceKind.SourceKind).type.toBe<typeof SourceKind.SourceKind>();
  });
});
