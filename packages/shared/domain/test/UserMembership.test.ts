import * as EntitySchema from "@beep/schema/EntitySchema";
import * as Membership from "@beep/shared-domain/entities/Membership";
import * as User from "@beep/shared-domain/entities/User";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const systemPrincipal = {
  component: "Runtime",
  kind: "System",
} as const;

const publicIdFor = (entityType: string, id: number) =>
  `${entityType.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}_a${id}`;

const baseEntityInput = (entityType: string, id: number) => ({
  createdAt: id,
  createdByPrincipal: systemPrincipal,
  entityType,
  id,
  orgId: 1,
  publicId: publicIdFor(entityType, id),
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "Application",
  updatedAt: id + 1,
  updatedByPrincipal: systemPrincipal,
});

describe("User and Membership", () => {
  it.effect(
    "decodes shared User rows",
    Effect.fnUntraced(function* () {
      const user = yield* S.decodeUnknownEffect(User.Model)({
        ...baseEntityInput("SharedUser", 2),
        displayName: "Jordan Miles",
      });

      expect(User.Model.definition.entityId).toBe(Shared.UserId);
      expect(User.Model.definition.entityId.tableName).toBe("shared_user");
      expect(EntitySchema.columnNameFor("displayName", User.Model.definition.persisted.displayName)).toBe(
        "display_name"
      );
      expect(user.displayName).toBe("Jordan Miles");
    })
  );

  it.effect(
    "decodes shared Membership rows",
    Effect.fnUntraced(function* () {
      const membership = yield* S.decodeUnknownEffect(Membership.Model)({
        ...baseEntityInput("SharedMembership", 10),
        role: "owner",
        status: "active",
        userId: 2,
      });

      expect(Membership.Model.definition.entityId).toBe(Shared.MembershipId);
      expect(Membership.Model.definition.entityId.tableName).toBe("shared_membership");
      expect(Membership.Role.is.owner(membership.role)).toBe(true);
      expect(Membership.Status.is.active(membership.status)).toBe(true);
      expect(Membership.Model.definition.persisted.userId.storageKind).toBe("entityId");
      expect(EntitySchema.columnNameFor("userId", Membership.Model.definition.persisted.userId)).toBe("user_id");
      expect(membership.orgId).toBe(1);
      expect(membership.userId).toBe(2);
    })
  );
});
