/** Configuration ownership at the citation engine boundary.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as Brand from "effect/Brand";

/** Configuration the engine owns.
 *
 * **Details**
 *
 * The brand asserts that no reference to the value, or to any part of it, is
 * held outside the engine. It does not assert immutability. Only
 * `ownCitationConfiguration` mints it, by one detach where configuration
 * crosses from a caller into the engine; installers below the boundary accept
 * it and neither decode nor detach.
 *
 * @internal @category models @since 0.0.0
 */
export type CitationOwned<A> = A & Brand.Brand<"CitationOwned">;

// Module-private: a value becomes owned only through the boundary detach or a
// projection of an already owned value.
// The brand is type-level only (as `Brand.nominal` is), so minting is a type assertion.
const mint = <A>(value: A) => value as CitationOwned<A>;

/** Decode caller configuration and detach it once through its JSON codec.
 *
 * **Details**
 *
 * The detach goes through `S.toCodecJson(schema)`. A type-side round trip would
 * keep the caller's `Uint8Array` buffers, because `S.Uint8Array` is an instance
 * check. Every failure maps to the caller's closed, source-free error.
 *
 * **Gotchas**
 *
 * Precondition: every leaf of `schema` must have a JSON codec that copies. A
 * leaf whose JSON codec passes the value through (`S.Unknown`, `S.Any` or a
 * declaration without a copying codec) would be kept by reference, and the
 * result would then alias the caller's value despite the brand.
 *
 * **Example** (Own engine limits once)
 * ```ts
 * import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
 * import { ownCitationConfiguration } from "./ConfigurationOwnership.ts";
 * const owned = ownCitationConfiguration(CitationEngineLimits, {}, () => "invalid" as const);
 * ```
 *
 * @internal @category operations @since 0.0.0
 */
export const ownCitationConfiguration = Effect.fn("Citation.ownConfiguration")(function* <
  Schema extends S.Codec<unknown, unknown>,
  E,
>(schema: Schema, raw: unknown, invalid: () => E) {
  const decoded = yield* S.decodeUnknownEffect(S.toType(schema))(raw).pipe(Effect.mapError(invalid));
  const json = S.toCodecJson(schema);
  const encoded = yield* S.encodeEffect(json)(decoded).pipe(Effect.mapError(invalid));
  const detached: Schema["Type"] = yield* S.decodeEffect(json)(encoded).pipe(Effect.mapError(invalid));
  return mint(detached);
});

/** Project one field of an owned value; the field is owned with its parent.
 *
 * **Example** (Project child configuration)
 * ```ts
 * import { ownedField } from "./ConfigurationOwnership.ts";
 * import type { CitationOwned } from "./ConfigurationOwnership.ts";
 * declare const owned: CitationOwned<{ readonly child: { readonly size: number } }>;
 * const child = ownedField(owned, "child");
 * ```
 *
 * @internal @category operations @since 0.0.0
 */
export const ownedField: {
  <T, K extends keyof T>(key: K): (owned: CitationOwned<T>) => CitationOwned<T[K]>;
  <T, K extends keyof T>(owned: CitationOwned<T>, key: K): CitationOwned<T[K]>;
} = dual(2, <T, K extends keyof T>(owned: CitationOwned<T>, key: K): CitationOwned<T[K]> => mint(owned[key]));

/** Project the items of an owned array; each item is owned with the array.
 *
 * **Example** (Project owned items)
 * ```ts
 * import { ownedItems } from "./ConfigurationOwnership.ts";
 * import type { CitationOwned } from "./ConfigurationOwnership.ts";
 * declare const owned: CitationOwned<ReadonlyArray<number>>;
 * const items = ownedItems(owned);
 * ```
 *
 * @internal @category operations @since 0.0.0
 */
export const ownedItems = <T>(owned: CitationOwned<ReadonlyArray<T>>): ReadonlyArray<CitationOwned<T>> =>
  A.map(owned, mint);

/** Assemble an owned value from owned parts with a schema's constructor.
 *
 * **Details**
 *
 * `schema` is an `S.Struct` or `S.Opaque` class; its `make` builds a fresh
 * container from the fields (and may copy them). Every field passed in must
 * already be owned and the field record must not be empty, so the result is owned
 * as a whole. It cannot mint from parts that are not owned. Stages use it to hand
 * a child the configuration they assemble from projections of their own.
 *
 * **Example** (Assemble child configuration)
 * ```ts
 * import * as S from "effect/Schema";
 * import { ownedStruct } from "./ConfigurationOwnership.ts";
 * import type { CitationOwned } from "./ConfigurationOwnership.ts";
 * declare const size: CitationOwned<number>;
 * const Child = S.Struct({ size: S.Number });
 * const child = ownedStruct(Child, { size });
 * ```
 *
 * @internal @category constructors @since 0.0.0
 */
export const ownedStruct: {
  <F, A>(fields: OwnedFields<F>): (schema: OwnedConstructor<F, A>) => CitationOwned<A>;
  <F, A>(schema: OwnedConstructor<F, A>, fields: OwnedFields<F>): CitationOwned<A>;
} = dual(
  2,
  <F, A>(schema: OwnedConstructor<F, A>, fields: OwnedFields<F>): CitationOwned<A> => mint(schema.make(fields))
);
// A schema constructor (`S.Struct` or `S.Opaque` class), never a free function.
type OwnedConstructor<F, A> = { readonly fields: S.Struct.Fields; readonly make: (fields: F) => A };
// Owned fields only, and at least one: an empty record would mint from nothing.
type OwnedFields<F> = [keyof F] extends [never] ? never : { readonly [K in keyof F]: CitationOwned<F[K]> };

/** Derive an owned value from an owned input by engine computation.
 *
 * **Details**
 *
 * The result is owned because the engine computes it from an already owned
 * input and from values the engine itself creates or reads (sealed asset files,
 * the clock). Its soundness rests entirely on `derive` not closing over a
 * caller-held value: the types cannot check that. It needs an owned witness, so
 * it cannot mint from caller input; it is the same discipline as `ownedStruct`,
 * not a public mint, and the brand constructor stays private. It has exactly one
 * production call site: the default engine derives its installed configuration
 * from the caller's configuration it owned with the engine's one detach.
 *
 * **Example** (Derive configuration from owned input)
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { ownedDerive } from "./ConfigurationOwnership.ts";
 * import type { CitationOwned } from "./ConfigurationOwnership.ts";
 * declare const owned: CitationOwned<{ readonly size: number }>;
 * const doubled = ownedDerive(owned, (input) => Effect.succeed({ size: input.size * 2 }));
 * ```
 *
 * @internal @category constructors @since 0.0.0
 */
export const ownedDerive: {
  <T, B, E, R>(
    derive: (input: T) => Effect.Effect<B, E, R>
  ): (owned: CitationOwned<T>) => Effect.Effect<CitationOwned<B>, E, R>;
  <T, B, E, R>(
    owned: CitationOwned<T>,
    derive: (input: T) => Effect.Effect<B, E, R>
  ): Effect.Effect<CitationOwned<B>, E, R>;
} = dual(
  2,
  <T, B, E, R>(
    owned: CitationOwned<T>,
    derive: (input: T) => Effect.Effect<B, E, R>
  ): Effect.Effect<CitationOwned<B>, E, R> => Effect.map(derive(owned), mint)
);
