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

/** Assemble an owned value from owned parts through a schema constructor.
 *
 * **Details**
 *
 * Every field passed in is already owned, and the constructor builds a fresh
 * container from them (a schema constructor may copy them as well), so the
 * result is owned as a whole. Stages use it to hand a child the configuration
 * they assemble from projections of their own. It cannot mint an owned value
 * from parts that are not already owned.
 *
 * **Example** (Assemble child configuration)
 * ```ts
 * import { ownedStruct } from "./ConfigurationOwnership.ts";
 * import type { CitationOwned } from "./ConfigurationOwnership.ts";
 * declare const size: CitationOwned<number>;
 * const child = ownedStruct((fields: { readonly size: number }) => ({ ...fields }), { size });
 * ```
 *
 * @internal @category constructors @since 0.0.0
 */
export const ownedStruct: {
  <F>(fields: { readonly [K in keyof F]: CitationOwned<F[K]> }): <A>(make: (fields: F) => A) => CitationOwned<A>;
  <F, A>(make: (fields: F) => A, fields: { readonly [K in keyof F]: CitationOwned<F[K]> }): CitationOwned<A>;
} = dual(
  2,
  <F, A>(make: (fields: F) => A, fields: { readonly [K in keyof F]: CitationOwned<F[K]> }): CitationOwned<A> =>
    mint(make(fields))
);
