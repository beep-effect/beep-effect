/**
 * Feasibility spike for the id-parameterized entity kit (design session 2026-08-26).
 * All assertions below PASS (tsgo-green except scratchpad-tolerated console lints).
 *
 * FINDINGS (proven here):
 * 1. Branded ids AND entityType literals survive a GENERIC `Entity(EntityId)`
 *    factory: the instance `id` is exactly `EntityIdValueFor<"ScratchProbeId">`
 *    (strict identity) and `entityType` is the `"ScratchProbe"` literal, in the
 *    instance type and the json variant. The fusion design is feasible.
 * 2. HOW matters — two dead ends and the working shape:
 *    - Inference-typed generic builders widen: `S.Literal(id.entityType)` with
 *      `id: Id` infers `L = string` (the constraint), losing the literal.
 *    - Explicit type args (`S.Literal<Id["entityType"]>(...)`) fix the literal
 *      but then validated combinators (`pg.text()`'s ValidateEncoded) become
 *      deferred conditionals over the symbolic literal and refuse the pipe.
 *    - WORKING SHAPE (the kit law): a runtime closure (widened types, fine at
 *      runtime) + a hand-declared type lambda (`IdentityColumns<Id>`) as the
 *      authoritative public type, joined by a cast at one internal seam.
 * 3. Today's ProductEntity models ALREADY have `entityType: string` at the type
 *    level (checked against @beep/epistemic-domain CandidateClaim) — the same
 *    widening, unnoticed. The redesign is strictly better than the status quo.
 * 4. API shape: `Entity<Self, Id>` in ONE call collapses `Id` to its default
 *    when `Self` is given explicitly (TS uses defaults, not partial inference).
 *    The Id needs its own inference position: `Entity<Self>()(id)(fields)`.
 *    (Corollary: today's `Entity<Self>(tableName)` never type-validates the
 *    identifier either — `Identifier` collapses to `string`.)
 * 5. Runtime: table name derives from `id.tableName` ("scratch_probe"), the
 *    entityType literal is enforced on decode, and the serial id stays out of
 *    the insert variant.
 */
import * as EffectDrizzle from "@beep/effect-drizzle";
import * as Pg from "@beep/effect-drizzle/pg";
import { $ScratchpadId } from "@beep/identity";
import * as EntityId from "@beep/shared-domain/entity/EntityId";
import { Effect } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Model as M, VariantSchema } from "effect/unstable/schema";

const $I = $ScratchpadId.create("identity-kit-probe");

// --- type-level truth: the IdentityLambda output (finding 2, working shape) --
// The production kit declares wrapper-typed fields here so `sql.columns` stays
// rich; for variant/brand typing the schema layer is what matters.
type IdentityColumns<Id extends EntityId.Any> = {
  readonly id: VariantSchema.Field<{
    readonly select: Id;
    readonly update: Id;
    readonly json: Id;
  }>;
  readonly entityType: M.GeneratedByApp<S.Literal<Id["entityType"]>>;
};

// --- runtime closure: widened types are irrelevant at runtime ----------------
const identityColumns = (id: EntityId.Any) => ({
  id: EffectDrizzle.VariantField({ select: id, update: id, json: id }).pipe(Pg.primaryKey(), Pg.serial()),
  entityType: M.GeneratedByApp(S.Literal(id.entityType)).pipe(Pg.text(), Pg.columnName("entity_type")),
});

type Merged<Id extends EntityId.Any, Own extends EffectDrizzle.FieldsInput> = IdentityColumns<Id> & Own;

// --- the generic Entity factory (finding 4: Id gets its own inference call) --
const Entity =
  <Self = never>() =>
  <Id extends EntityId.Any>(id: Id) =>
  <const Own extends EffectDrizzle.FieldsInput>(own: Own): EffectDrizzle.ModelClass<Self, Merged<Id, Own>> =>
    // internal seam: the closure/lambda agreement lives behind this cast; the
    // production kit pins it with a satisfies check at the kit call site.
    (EffectDrizzle.Model as any)(id.tableName)({ ...identityColumns(id), ...own }) as EffectDrizzle.ModelClass<
      Self,
      Merged<Id, Own>
    >;

// --- concrete instantiation --------------------------------------------------
const ProbeId = EntityId.factory("scratch", $I)("probe");
// statics: tableName "scratch_probe", entityType "ScratchProbe", brand "ScratchProbeId"

class Probe extends Entity<Probe>()(ProbeId)({
  label: S.NonEmptyString.pipe(Pg.text()),
}) {}

// --- type-level assertions (all hold) ----------------------------------------
type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type ExpectFalse<T extends false> = T;

export type BrandKept = Expect<IsEqual<InstanceType<typeof Probe>["id"], EntityId.EntityIdValueFor<"ScratchProbeId">>>;
export type LiteralKept = Expect<IsEqual<InstanceType<typeof Probe>["entityType"], "ScratchProbe">>;
export type BrandRejectsNumber = ExpectFalse<[number] extends [InstanceType<typeof Probe>["id"]] ? true : false>;
export type JsonLiteralKept = Expect<IsEqual<(typeof Probe)["json"]["Type"]["entityType"], "ScratchProbe">>;

// --- runtime assertions ------------------------------------------------------
const decoded = S.decodeSync(Probe)({
  id: 7,
  entityType: "ScratchProbe",
  label: "brand survives",
});
Effect.runSync(Effect.log("decoded id:", decoded.id, "entityType:", decoded.entityType));
Effect.runSync(Effect.log("tableName static:", Probe.sql.tableName));
Effect.runSync(Effect.log("insert fields:", R.keys(Probe.insert.fields)));

// wrong entityType literal must fail at runtime:
try {
  S.decodeUnknownSync(Probe)({ id: 8, entityType: "WrongType", label: "x" });
  Effect.runSync(Effect.log("ERROR: wrong entityType decoded"));
} catch {
  Effect.runSync(Effect.log("wrong entityType rejected (literal enforced)"));
}
