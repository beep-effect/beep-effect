import { EntityRefError, EntityRefInvariantError } from "@beep/shared-domain/entity/EntityRef";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import { fields } from "@beep/shared-domain/entity/ProductEntity";
import { UserId } from "@beep/shared-domain/identity/Shared";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

// Boundary projection: exercise the exact select codecs inherited by every audited kit.
const DeletionRow = S.Struct({
  deletedAt: fields.deletedAt.schema.schemas.select,
  deletedByPrincipal: fields.deletedByPrincipal.schema.schemas.select,
});
const decode = S.decodeUnknownEffect(DeletionRow);
const encode = S.encodeEffect(DeletionRow);
const equivalent = S.toEquivalence(DeletionRow);

describe("canonical audit soft-delete codecs", () => {
  it.effect(
    "decodes SQL nulls and omitted legacy fields to none and encodes explicit nulls",
    Effect.fnUntraced(function* () {
      const row = yield* decode({ deletedAt: null, deletedByPrincipal: null });
      assertNone(row.deletedAt);
      assertNone(row.deletedByPrincipal);
      expect(yield* encode(row)).toEqual({ deletedAt: null, deletedByPrincipal: null });
      const legacy = yield* decode({});
      assertNone(legacy.deletedAt);
      assertNone(legacy.deletedByPrincipal);
      const constructed = DeletionRow.make({});
      assertNone(constructed.deletedAt);
      assertNone(constructed.deletedByPrincipal);
    })
  );

  it.effect(
    "round-trips an epoch-millis deletion with its typed user principal",
    Effect.fnUntraced(function* () {
      const principal = UserPrincipal.make({ userId: UserId.make(7) });
      const row = yield* decode({ deletedAt: 1_700_000_000_000, deletedByPrincipal: { kind: "User", userId: 7 } });
      assertSome(row.deletedAt, DateTime.makeUnsafe(1_700_000_000_000));
      assertSome(row.deletedByPrincipal, principal);
      expect(yield* encode(row)).toEqual({
        deletedAt: 1_700_000_000_000,
        deletedByPrincipal: { kind: "User", userId: 7 },
      });
      expect(yield* encode(DeletionRow.make({ deletedAt: O.none(), deletedByPrincipal: O.none() }))).toEqual({
        deletedAt: null,
        deletedByPrincipal: null,
      });
    })
  );

  it.effect.prop(
    "round-trips schema-derived nullable deletion values",
    [DeletionRow],
    Effect.fnUntraced(function* ([row]) {
      assertTrue(equivalent(row, yield* decode(yield* encode(row))));
    }),
    { arbitrary: fcRuns(50) }
  );

  it("preserves opaque-id error equivalence through the public error union", () => {
    const first = EntityRefInvariantError.mismatch("SharedOrganization", "OtherEntity", 1);
    const second = EntityRefInvariantError.mismatch("SharedOrganization", "OtherEntity", 2);
    pipe(first, S.is(EntityRefError), assertTrue);
    assertTrue(S.toEquivalence(EntityRefError)(first, second));
  });
});
