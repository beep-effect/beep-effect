/**
 * Compile-time proof fixtures for the BSL experiment.
 *
 * Positive cases assert exact `$inferSelect` / `$inferInsert` shapes; negative
 * cases are `@ts-expect-error` sites proving invariants fail at the right
 * place. This file must stay in the bsl tsconfig so the proofs run on every
 * typecheck — the v3 archive's lesson is that deleted type proofs rot silently.
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { Model } from "./factory.ts";
import * as pg from "./pg.ts";
import { toPgTable } from "./table.ts";

const $I = $ScratchpadId.create("bsl/fixtures");

// ---------------------------------------------------------------------------
// EntityId stand-ins (structural EntityIdLike: number codec + statics)
// ---------------------------------------------------------------------------

export const UserId = S.Finite.pipe(S.brand("UserId"));

export const OrganizationId = Object.assign(S.Finite.pipe(S.brand("OrganizationId")), {
  tableName: "organization",
  entityType: "Organization",
});

// ---------------------------------------------------------------------------
// The showcase model
// ---------------------------------------------------------------------------

export class User extends Model<User>($I`User`)({
  id: UserId.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  orgId: OrganizationId, // bare EntityId: derives integer + auto FK reference
  email: S.String.pipe(pg.varchar(320), pg.unique()),
  name: S.String, // bare: derives text NOT NULL
  bio: S.NullOr(S.String), // bare: derives text, nullable
  settings: S.Struct({ theme: S.String }), // bare: derives jsonb
  active: S.Boolean, // bare: derives boolean
  createdAt: S.String.pipe(pg.timestamp(), pg.defaultSql("now()")),
}) {}

export const userTable = toPgTable(User);


// ---------------------------------------------------------------------------
// Positive type proofs
// ---------------------------------------------------------------------------

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type MutualExtends<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<_T extends true> = never;

type SelectRow = typeof userTable.$inferSelect;
type InsertRow = typeof userTable.$inferInsert;

export type _selectId = Expect<Equal<SelectRow["id"], number>>;
export type _selectEmail = Expect<Equal<SelectRow["email"], string>>;
export type _selectBio = Expect<Equal<SelectRow["bio"], string | null>>;
export type _selectSettings = Expect<MutualExtends<SelectRow["settings"], { readonly theme: string }>>;
export type _selectActive = Expect<Equal<SelectRow["active"], boolean>>;

// identity "always" columns are excluded from inserts entirely
export type _insertIdAbsent = Expect<Equal<"id" extends keyof InsertRow ? true : false, false>>;
// hasDefault columns become optional insert keys
export type _insertCreatedAtOptional = Expect<
  Equal<undefined extends InsertRow["createdAt"] ? true : false, true>
>;
// required, non-defaulted columns stay required
export type _insertEmailRequired = Expect<Equal<InsertRow["email"], string>>;

// the model exposes the six variant statics
export type _hasInsertVariant = Expect<Equal<typeof User.insert extends { readonly ast: unknown } ? true : false, true>>;

// bsl statics carry resolved metadata
export type _emailIsVarchar = Expect<
  Equal<(typeof User)["bsl"]["columns"]["email"]["column"]["kind"], "varchar">
>;
export type _orgIdDerivedInteger = Expect<
  Equal<(typeof User)["bsl"]["columns"]["orgId"]["column"]["kind"], "integer">
>;

// ---------------------------------------------------------------------------
// Negative proofs — each line MUST fail to compile
// ---------------------------------------------------------------------------

// @ts-expect-error varchar requires a string-encoded schema; S.Int encodes number
export const _badVarchar = S.Int.pipe(pg.varchar(80));

// @ts-expect-error a nullable schema cannot be a primary key
export const _badNullablePk = S.NullOr(S.String).pipe(pg.text(), pg.primaryKey());

// @ts-expect-error identity requires an explicit integer-family column first
export const _badIdentity = S.Finite.pipe(pg.identity());

// @ts-expect-error boolean-encoded schemas cannot claim jsonb
export const _badJsonb = S.Boolean.pipe(pg.jsonb());

// @ts-expect-error bigint('bigint') requires a bigint-encoded schema
export const _badBigint = S.Finite.pipe(pg.bigint("bigint"));

// Model-level negatives are thunked: the compile proof runs on every
// typecheck, while the runtime mirror (the factory throwing the same
// invariant as a tagged error) is asserted by bsl.test.ts calling the thunk.
S.isLength
export const _needsExplicitColumn = () => {
  // @ts-expect-error Date-encoded declarations do not derive a column — explicit pg.timestamp required
  class NeedsExplicitColumn extends Model<NeedsExplicitColumn>($I`NeedsExplicitColumn`)({ at: S.Date }) {}
  return NeedsExplicitColumn;
};

export const _twoPrimaryKeys = () => {
  // @ts-expect-error multiple primary keys are rejected at the model boundary
  class TwoPrimaryKeys extends Model<TwoPrimaryKeys>($I`TwoPrimaryKeys`)({ one: S.Finite.pipe(pg.integer(), pg.primaryKey()), two: S.Finite.pipe(pg.integer(), pg.primaryKey()) }) {}
  return TwoPrimaryKeys;
};
