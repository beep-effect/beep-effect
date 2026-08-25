import { makeResult } from "@beep/shared-domain/entity/EntityRef";
import { OrganizationId } from "@beep/shared-domain/identity/Shared";
import { describe, expect, it } from "@effect/vitest";
import { identity } from "effect";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const unstableEntityType = (mismatchedEntityType: string): typeof OrganizationId => {
  let entityTypeReads = 0;

  return new Proxy(OrganizationId, {
    get(target, property, receiver) {
      if (property !== "entityType") {
        return Reflect.get(target, property, receiver);
      }

      entityTypeReads += 1;
      return entityTypeReads === 1 ? target.entityType : mismatchedEntityType;
    },
  });
};

const captureInvariant = (mismatchedEntityType: string, id: OrganizationId): unknown =>
  Result.match(
    Result.try(() => makeResult(unstableEntityType(mismatchedEntityType), id)),
    {
      onFailure: identity,
      onSuccess: identity,
    }
  );

describe("shared-domain tagged-error declared equivalence", () => {
  it("excludes EntityRefInvariantError actualId while comparing stable diagnostics", () => {
    const organizationId = OrganizationId.make(1);
    const otherOrganizationId = OrganizationId.make(2);
    const a = captureInvariant("MismatchedEntity", organizationId);
    const b = captureInvariant("MismatchedEntity", otherOrganizationId);
    const c = captureInvariant("OtherMismatchedEntity", organizationId);

    expect(P.isObject(a)).toBe(true);
    const schema = P.isObject(a) ? Reflect.get(a, "constructor") : a;
    expect(S.isSchema(schema)).toBe(true);

    if (S.isSchema(schema)) {
      const sameInvariant = S.toEquivalence(schema);

      expect(sameInvariant(a, b)).toBe(true);
      expect(sameInvariant(a, c)).toBe(false);
    }
  });
});
