/**
 * Struct helpers for typed paths, entries, keys, and reverse mappings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UtilsId } from "@beep/identity/packages";
import { Struct as EffectStruct, Match, pipe } from "effect";
import { cast, dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as A from "./Array.ts";
import { lookupAtPath, pathLookupToOption, unsafeDotGet } from "./internal/StructPath.ts";
import type { LazyArg } from "effect/Function";
import type { Get, Paths, Simplify } from "type-fest";
import type { PathLookup as InternalPathLookup, PathInput } from "./internal/StructPath.ts";

/**
 * Schema for dot-delimited paths or path segment arrays accepted by struct lookup helpers.
 *
 * **Example** (PathInput from segments)
 *
 * ```ts
 * import { PathInput } from "@beep/utils/Struct"
 *
 * const path = PathInput.make(["profile", "name"])
 * console.log(path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export { PathInput } from "./internal/StructPath.ts";

const $I = $UtilsId.create("Struct");

type NonEmptyStringKeyStruct<R extends object> = [keyof R & string] extends [never] ? never : R;

type EntryValue<E extends readonly [PropertyKey, unknown], P extends E[0]> = E extends readonly [
  infer K extends PropertyKey,
  infer V,
]
  ? P extends K
    ? V
    : never
  : never;

type FromEntries<E extends readonly [PropertyKey, unknown]> = Simplify<{
  [P in E[0]]: EntryValue<E, P>;
}>;

const NonEmptyStringKeys = S.NonEmptyArray(S.String);
// input is opaque unknown data: equivalence is declared diagnostic identity, input stays payload.

/**
 * Thrown when a struct expected to have at least one string key is empty.
 *
 * **Example** (EmptyStructError instance)
 *
 * ```ts
 * import { EmptyStructError } from "@beep/utils/Struct"
 *
 * const error = EmptyStructError
 * console.log(error)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class EmptyStructError extends S.TaggedError<EmptyStructError>($I`EmptyStructError`)(
  "EmptyStructError",
  {
    input: S.Unknown.annotate({ toEquivalence: () => () => true }),
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }).annotate({ toEquivalence: () => () => true })),
  },
  $I.annoteError<EmptyStructError>("EmptyStructError", {
    description: "Invariant violation thrown when a struct expected to have at least one string key is empty.",
  })
) {}

function assertStructHasStringKeys<T extends string>(
  input: Array<T>,
  source: object
): asserts input is A.NonEmptyArray<T> {
  return Match.value(S.is(NonEmptyStringKeys)(input)).pipe(
    Match.when(true, () => undefined),
    Match.orElse(() => {
      throw EmptyStructError.make({
        input: source,
        cause: O.none(),
      });
    })
  );
}

function assertStructHasStringEntries<T>(
  input: ReadonlyArray<T>,
  source: object
): asserts input is A.NonEmptyReadonlyArray<T> {
  return Match.value(A.isReadonlyArrayNonEmpty(input)).pipe(
    Match.when(true, () => undefined),
    Match.orElse(() => {
      throw EmptyStructError.make({
        input: source,
        cause: O.none(),
      });
    })
  );
}

const pathFromOptions = (options: { readonly path: PathInput }): PathInput =>
  P.isObject(options) && P.hasProperty(options, "path") ? cast(options.path) : cast(options);

const isBlockedObjectKey = (key: PropertyKey): boolean =>
  key === "__proto__" || key === "constructor" || key === "prototype";

/**
 * Result of a runtime struct path lookup.
 *
 * **Example** (Check PathLookup found)
 *
 * ```ts
 * import type { PathLookup } from "@beep/utils/Struct"
 *
 * const isFound = (lookup: PathLookup) => lookup.found
 * console.log(isFound)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PathLookup = InternalPathLookup;

/**
 * Retrieves a value from a struct by a dot-delimited or tuple path.
 *
 * **Details**
 *
 * Uses type-fest `Paths` for path validation and `Get` for value resolution.
 *
 * Supports a dual API:
 * - Data-last: `dotGet("attributes.name")(self)`
 * - Data-first: `dotGet(self, "attributes.name")`
 * - Tuple paths: `dotGet(["attributes", "name"](self)`
 *
 * **Example** (Data-first and data-last)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Struct } from "@beep/utils"
 *
 * const user = { profile: { name: "Alice", age: 30 } }
 *
 * // Data-first
 * const name = Struct.dotGet(user, "profile.name")
 *
 * // Data-last (pipeable)
 * const age = pipe(user, Struct.dotGet("profile.age"))
 *
 * console.log(name)
 * console.log(age)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const dotGet: {
  <const P extends string>(path: P): <S extends object>(self: P extends Paths<S> ? S : never) => Get<S, P>;
  <const P extends ReadonlyArray<string>>(path: P): <S extends object>(self: S) => Get<S, P>;
  <S extends object, const P extends string & Paths<S>>(path: P): (self: S) => Get<S, P>;
  <S extends object, const P extends ReadonlyArray<string>>(path: P): (self: S) => Get<S, P>;
  <S extends object, const P extends string & Paths<S>>(self: S, path: P): Get<S, P>;
  <S extends object, const P extends ReadonlyArray<string>>(self: S, path: P): Get<S, P>;
} = dual(2, <S extends object>(self: S, path: PathInput): unknown => unsafeDotGet(self, path)) as {
  <const P extends string>(path: P): <S extends object>(self: P extends Paths<S> ? S : never) => Get<S, P>;
  <const P extends ReadonlyArray<string>>(path: P): <S extends object>(self: S) => Get<S, P>;
  <S extends object, const P extends string & Paths<S>>(path: P): (self: S) => Get<S, P>;
  <S extends object, const P extends ReadonlyArray<string>>(path: P): (self: S) => Get<S, P>;
  <S extends object, const P extends string & Paths<S>>(self: S, path: P): Get<S, P>;
  <S extends object, const P extends ReadonlyArray<string>>(self: S, path: P): Get<S, P>;
};

/**
 * Retrieves a value as an `Option` by a dot-delimited or tuple path.
 *
 * **Details**
 *
 * Missing paths return `Option.none()`. Existing paths always return
 * `Option.some(value)`, including when `value === undefined`.
 *
 * **Example** (Found and missing paths)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Struct } from "@beep/utils"
 *
 * const user = { profile: { name: "Alice" } }
 *
 * // Data-first
 * const name = Struct.dotGetOption(user, "profile.name")
 * // Option.some("Alice")
 *
 * // Missing path
 * const missing = Struct.dotGetOption(user, ["profile", "age"])
 * // Option.none()
 *
 * console.log(name)
 * console.log(missing)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const dotGetOption: {
  <const P extends string>(path: P): <S extends object>(self: P extends Paths<S> ? S : never) => O.Option<Get<S, P>>;
  <const P extends ReadonlyArray<string>>(path: P): <S extends object>(self: S) => O.Option<Get<S, P>>;
  <S extends object, const P extends string & Paths<S>>(path: P): (self: S) => O.Option<Get<S, P>>;
  <S extends object, const P extends ReadonlyArray<string>>(path: P): (self: S) => O.Option<Get<S, P>>;
  <S extends object, const P extends string & Paths<S>>(self: S, path: P): O.Option<Get<S, P>>;
  <S extends object, const P extends ReadonlyArray<string>>(self: S, path: P): O.Option<Get<S, P>>;
} = dual(2, <S extends object>(self: S, path: PathInput): O.Option<unknown> => {
  const lookup = lookupAtPath(self, path);
  return pathLookupToOption(lookup);
}) as {
  <const P extends string>(path: P): <S extends object>(self: P extends Paths<S> ? S : never) => O.Option<Get<S, P>>;
  <const P extends ReadonlyArray<string>>(path: P): <S extends object>(self: S) => O.Option<Get<S, P>>;
  <S extends object, const P extends string & Paths<S>>(path: P): (self: S) => O.Option<Get<S, P>>;
  <S extends object, const P extends ReadonlyArray<string>>(path: P): (self: S) => O.Option<Get<S, P>>;
  <S extends object, const P extends string & Paths<S>>(self: S, path: P): O.Option<Get<S, P>>;
  <S extends object, const P extends ReadonlyArray<string>>(self: S, path: P): O.Option<Get<S, P>>;
};

/**
 * Selects the result of {@link mapPath}.
 *
 * **Details**
 *
 * Spelled as a deferred conditional alias so every data-first signature of
 * {@link mapPath} shares a named return type with its data-last counterpart.
 * Every concrete instantiation resolves back to `B`.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MapPathResult<B> = B extends unknown ? B : never;

/**
 * Applies a unary function to a value retrieved from a struct by path.
 *
 * **Details**
 *
 * Uses {@link dotGet} under the hood, so string paths are type-validated and
 * tuple paths resolve via `type-fest` `Get`.
 *
 * Supports a dual API:
 * - Data-last: `pipe(self, Struct.mapPath(renderName, { path: "profile.name" }))`
 * - Data-first: `Struct.mapPath(self, renderName, { path: "profile.name" })`
 * - Tuple paths: `Struct.mapPath(self, renderName, { path: ["profile", "name"] as const })`
 *
 * If the runtime value does not actually satisfy the statically-declared path,
 * `undefined` is forwarded to `f`, matching {@link dotGet}.
 *
 * **Example** (Uppercase path value)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Struct } from "@beep/utils"
 *
 * const user = { profile: { name: "alice" } }
 *
 * // Data-first
 * const upper = Struct.mapPath(user, (s: string) => s.toUpperCase(), { path: "profile.name" })
 * // "ALICE"
 *
 * console.log(upper)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mapPath: {
  <A, B, const P extends string>(
    f: (a: A) => B,
    options: { readonly path: P }
  ): <S extends object>(self: P extends Paths<S> ? (Get<S, P> extends A ? S : never) : never) => MapPathResult<B>;
  <A, B, const P extends ReadonlyArray<string>>(
    f: (a: A) => B,
    options: { readonly path: P }
  ): <S extends object>(self: Get<S, P> extends A ? S : never) => MapPathResult<B>;
  <S extends object, A, B, const P extends string>(
    self: P extends Paths<S> ? (Get<S, P> extends A ? S : never) : never,
    f: (a: A) => B,
    options: { readonly path: P }
  ): MapPathResult<B>;
  <S extends object, A, B, const P extends ReadonlyArray<string>>(
    self: Get<S, P> extends A ? S : never,
    f: (a: A) => B,
    options: { readonly path: P }
  ): MapPathResult<B>;
} = dual(
  3,
  <S extends object, B>(self: S, f: (a: unknown) => B, options: { readonly path: PathInput }): MapPathResult<B> =>
    cast(f(unsafeDotGet(self, pathFromOptions(options))))
) as {
  <A, B, const P extends string>(
    f: (a: A) => B,
    options: { readonly path: P }
  ): <S extends object>(self: P extends Paths<S> ? (Get<S, P> extends A ? S : never) : never) => MapPathResult<B>;
  <A, B, const P extends ReadonlyArray<string>>(
    f: (a: A) => B,
    options: { readonly path: P }
  ): <S extends object>(self: Get<S, P> extends A ? S : never) => MapPathResult<B>;
  <S extends object, A, B, const P extends string>(
    self: P extends Paths<S> ? (Get<S, P> extends A ? S : never) : never,
    f: (a: A) => B,
    options: { readonly path: P }
  ): MapPathResult<B>;
  <S extends object, A, B, const P extends ReadonlyArray<string>>(
    self: Get<S, P> extends A ? S : never,
    f: (a: A) => B,
    options: { readonly path: P }
  ): MapPathResult<B>;
};

/**
 * Returns a thunk that applies a unary function to a value retrieved from a
 * struct by path.
 *
 * **Details**
 *
 * Mirrors {@link mapPath}, but delays both the path lookup and the function
 * application until the returned zero-argument function is invoked.
 *
 * Supports a dual API:
 * - Data-last: `pipe(self, Struct.mapPathLazy(renderName, { path: "profile.name" }))()`
 * - Data-first: `Struct.mapPathLazy(self, renderName, { path: "profile.name" })()`
 * - Tuple paths: `Struct.mapPathLazy(self, renderName, { path: ["profile", "name"] as const })()`
 *
 * If the runtime value does not actually satisfy the statically-declared path,
 * `undefined` is forwarded to `f`, matching {@link dotGet}.
 *
 * **Example** (Lazy uppercase path value)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const user = { profile: { name: "alice" } }
 *
 * const lazy = Struct.mapPathLazy(user, (s: string) => s.toUpperCase(), { path: "profile.name" })
 * const value = lazy()
 * // "ALICE"
 *
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mapPathLazy: {
  <A, B, const P extends string>(
    f: (a: A) => B,
    options: { readonly path: P }
  ): <S extends object>(self: P extends Paths<S> ? (Get<S, P> extends A ? S : never) : never) => LazyArg<B>;
  <A, B, const P extends ReadonlyArray<string>>(
    f: (a: A) => B,
    options: { readonly path: P }
  ): <S extends object>(self: Get<S, P> extends A ? S : never) => LazyArg<B>;
  <S extends object, A, B, const P extends string>(
    self: P extends Paths<S> ? (Get<S, P> extends A ? S : never) : never,
    f: (a: A) => B,
    options: { readonly path: P }
  ): LazyArg<B>;
  <S extends object, A, B, const P extends ReadonlyArray<string>>(
    self: Get<S, P> extends A ? S : never,
    f: (a: A) => B,
    options: { readonly path: P }
  ): LazyArg<B>;
} = dual(
  3,
  <S extends object, B>(self: S, f: (a: unknown) => B, options: { readonly path: PathInput }): LazyArg<B> =>
    () =>
      f(unsafeDotGet(self, pathFromOptions(options)))
) as {
  <A, B, const P extends string>(
    f: (a: A) => B,
    options: { readonly path: P }
  ): <S extends object>(self: P extends Paths<S> ? (Get<S, P> extends A ? S : never) : never) => LazyArg<B>;
  <A, B, const P extends ReadonlyArray<string>>(
    f: (a: A) => B,
    options: { readonly path: P }
  ): <S extends object>(self: Get<S, P> extends A ? S : never) => LazyArg<B>;
  <S extends object, A, B, const P extends string>(
    self: P extends Paths<S> ? (Get<S, P> extends A ? S : never) : never,
    f: (a: A) => B,
    options: { readonly path: P }
  ): LazyArg<B>;
  <S extends object, A, B, const P extends ReadonlyArray<string>>(
    self: Get<S, P> extends A ? S : never,
    f: (a: A) => B,
    options: { readonly path: P }
  ): LazyArg<B>;
};

/**
 * Returns a thunk that reads a value from a struct by key.
 *
 * **Details**
 *
 * Mirrors `effect/Struct.get`, but delays the property access until the
 * returned zero-argument function is invoked.
 *
 * Supports a dual API:
 * - Data-last: `pipe(self, Struct.getLazy("name"))()`
 * - Data-first: `Struct.getLazy(self, "name")()`
 *
 * **Example** (Lazy key access dual API)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Struct } from "@beep/utils"
 *
 * const config = { host: "localhost", port: 3000 }
 *
 * // Data-first
 * const getHost = Struct.getLazy(config, "host")
 * const host = getHost()
 * // "localhost"
 *
 * // Data-last (pipeable)
 * const getPort = pipe(config, Struct.getLazy("port"))
 * const port = getPort()
 * // 3000
 *
 * console.log(host)
 * console.log(port)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getLazy: {
  <S extends object, const K extends keyof S>(key: K): (self: S) => LazyArg<S[K]>;
  <S extends object, const K extends keyof S>(self: S, key: K): LazyArg<S[K]>;
} = dual(
  2,
  <S extends object, const K extends keyof S>(self: S, key: K): LazyArg<S[K]> =>
    () =>
      self[key]
);

/**
 * Returns all type-level `Paths` of a struct as a `NonEmptyReadonlyArray` of
 * literal strings.
 *
 * **Details**
 *
 * Recursively walks the object at runtime, collecting every dot-delimited path
 * that `Paths<S>` would generate at the type level.
 *
 * **Example** (Collect nested struct paths)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const config = { db: { host: "localhost", port: 5432 }, debug: true }
 *
 * const paths = Struct.pathsOf(config)
 * // ["db", "db.host", "db.port", "debug"]
 *
 * console.log(paths)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const pathsOf = <const S extends Record<string, unknown>>(
  obj: S
): A.NonEmptyReadonlyArray<Extract<Paths<S>, string>> => {
  const result = A.empty<string>();
  const walk = (current: unknown, prefix: string): void => {
    if (P.isNullish(current) || !P.isObject(current)) return;
    for (const key of R.keys(current)) {
      const nextPath = Match.value(Str.isEmpty(prefix)).pipe(
        Match.when(true, () => key),
        Match.orElse(() => `${prefix}.${key}`)
      );
      A.appendInPlace(result, nextPath);
      walk(current[key], nextPath);
    }
  };
  walk(obj, "");
  return cast(result);
};

/**
 * A single `[key, value]` pair for a string key of `T`, preserving per-key correlation.
 *
 * **Example** (Correlated key-value entry)
 *
 * ```ts
 * import type { StringKeyEntry } from "@beep/utils/Struct"
 *
 * type Entry = StringKeyEntry<{ readonly host: string; readonly port: number }>
 * const useEntry = (entry: Entry) => entry[0]
 * console.log(useEntry)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StringKeyEntry<T> = { [K in keyof T & string]: [K, T[K]] }[keyof T & string];

/**
 * An array of `[key, value]` pairs for all string keys of `T`, preserving per-key correlation.
 *
 * **Details**
 *
 * Unlike type-fest's `Entries<T>`, this narrows each entry so that the value type
 * is correlated with its key — `["a", string] | ["b", number]` rather than
 * `["a" | "b", string | number]`.
 *
 * **Example** (Correlated string key entries)
 *
 * ```ts
 * import type { StringKeyEntries } from "@beep/utils/Struct"
 *
 * type Entries = StringKeyEntries<{ readonly host: string; readonly port: number }>
 * const entries: Entries = [["host", "localhost"], ["port", 3000]]
 * console.log(entries)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StringKeyEntries<T> = Array<StringKeyEntry<T>>;

/**
 * Retrieves the entries (key-value pairs) of an object, where keys are strings,
 * in a type-safe manner. Symbol keys are excluded from the result.
 *
 * **Details**
 *
 * Each entry preserves per-key correlation: for `{ a: string; b: number }`,
 * the return type is `Array<["a", string] | ["b", number]>` rather than
 * `Array<["a" | "b", string | number]>`.
 *
 * **Example** (Type-safe string key entries)
 *
 * ```ts
 * import * as Struct from "@beep/utils/Struct"
 *
 * const c = Symbol("c")
 * const value = { a: "foo", b: 1, [c]: true }
 *
 * const pairs: Array<["a", string] | ["b", number]> = Struct.entries(value)
 * const first = pairs[0]
 *
 * console.log(first)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const entries = <const R extends object>(obj: R): StringKeyEntries<R> =>
  cast<Array<readonly [keyof R & string, R[keyof R & string]]>, StringKeyEntries<R>>(
    pipe(
      EffectStruct.keys(obj),
      A.map((key): readonly [keyof R & string, R[keyof R & string]] => [key, obj[key]])
    )
  );

/**
 * Returns the string-key entries of a non-empty object in a type-safe manner.
 *
 * **Details**
 *
 * Empty struct types are rejected at compile time. A runtime empty value still
 * fails fast with {@link EmptyStructError} to protect the invariant.
 *
 * **Example** (Non-empty object entries)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const config = { host: "localhost", port: 3000 }
 *
 * const result = Struct.entriesNonEmpty(config)
 * // [["host", "localhost"], ["port", 3000]]
 *
 * console.log(result)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const entriesNonEmpty = <const R extends object>(
  obj: R & NonEmptyStringKeyStruct<R>
): A.NonEmptyReadonlyArray<readonly [keyof R & string, R[keyof R & string]]> => {
  const result: Array<readonly [keyof R & string, R[keyof R & string]]> = cast(entries(obj));
  assertStructHasStringEntries(result, obj);
  return result;
};

/**
 * Returns the string keys of an object in a type-safe manner.
 *
 * **Details**
 *
 * Symbol keys are excluded from the result.
 *
 * **Example** (Type-safe string keys)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const config = { host: "localhost", port: 3000 }
 *
 * const result = Struct.keys(config)
 * // ["host", "port"]
 *
 * console.log(result)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const keys = <const R extends object>(obj: R): Array<keyof R & string> => EffectStruct.keys(obj);

/**
 * Returns the string keys of a non-empty object in a type-safe manner.
 *
 * **Details**
 *
 * Empty struct types are rejected at compile time. A runtime empty value still
 * fails fast with {@link EmptyStructError} to protect the invariant.
 *
 * **Example** (Non-empty object keys)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const config = { host: "localhost", port: 3000 }
 *
 * const result = Struct.keysNonEmpty(config)
 * // ["host", "port"] narrowed to NonEmptyReadonlyArray
 *
 * console.log(result)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const keysNonEmpty = <const R extends object>(
  obj: R & NonEmptyStringKeyStruct<R>
): A.NonEmptyReadonlyArray<keyof R & string> => {
  const result: Array<keyof R & string> = cast(EffectStruct.keys(obj));
  assertStructHasStringKeys(result, obj);
  return cast<Array<keyof R & string>, A.NonEmptyReadonlyArray<keyof R & string>>(result);
};

/**
 * Type-safe `Object.fromEntries` that preserves per-key value types.
 *
 * **Details**
 *
 * Accepts an iterable of `[key, value]` pairs and produces an object
 * whose type is the simplified union of all entries.
 *
 * **Example** (Object from typed entries)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const entries: ReadonlyArray<readonly ["host", "localhost"] | readonly ["port", 3000]> = [
 *   ["host", "localhost"],
 *   ["port", 3000],
 * ]
 *
 * const obj = Struct.fromEntries(entries)
 * // { host: "localhost", port: 3000 }
 *
 * console.log(obj)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromEntries = <const E extends readonly [PropertyKey, unknown]>(entries: Iterable<E>): FromEntries<E> => {
  const out: Record<PropertyKey, unknown> = {};

  for (const [key, value] of entries) {
    Reflect.defineProperty(out, key, {
      configurable: true,
      enumerable: !isBlockedObjectKey(key),
      value,
      writable: true,
    });
  }

  return cast<Record<PropertyKey, unknown>, FromEntries<E>>(out);
};

/**
 * Re-export of all helpers from `effect/Struct`.
 *
 * **Example** (Import effect Struct helpers)
 *
 * ```ts
 * import * as Struct from "@beep/utils/Struct"
 *
 * console.log(Struct)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/Struct";

/**
 * Struct shape accepted by {@link reverse}.
 *
 * **Example** (Reverseable mapping shape)
 *
 * ```ts
 * import type { ReverseableStruct } from "@beep/utils/Struct"
 *
 * const mapping: ReverseableStruct = { active: "A", inactive: "I" }
 * console.log(mapping)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReverseableStruct = Readonly<{
  readonly [key: string]: PropertyKey;
  readonly [key: symbol]: PropertyKey;
}>;

/**
 * Type-level inversion of a struct where each value becomes a key.
 *
 * **Details**
 *
 * When multiple keys share the same value, the reversed key type is the union
 * of all matching original keys.
 *
 * **Example** (Inverted direction mapping)
 *
 * ```ts
 * import type { ReverseStruct } from "@beep/utils/Struct"
 *
 * type Direction = ReverseStruct<{ readonly up: "north"; readonly down: "south" }>
 * const getNorth = (direction: Direction) => direction.north
 * console.log(getNorth)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReverseStruct<T extends ReverseableStruct> = {
  readonly [P in T[keyof T]]: {
    readonly [K in keyof T]: T[K] extends P ? K : never;
  }[keyof T];
};

/**
 * Reverses a struct mapping, producing a new struct where original values
 * become keys and original keys become values.
 *
 * **Details**
 *
 * Supports a dual API:
 * - Data-last: `reverse()(self)`
 * - Data-first: `reverse(self)`
 *
 * When duplicate values exist, the last encountered key wins at runtime.
 *
 * **Example** (Reverse error code mapping)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const errorCode = {
 *   successfulCompletion: "00000",
 *   warning: "01000",
 * } satisfies Struct.ReverseableStruct
 *
 * const reversed = Struct.reverse(errorCode)
 *
 * console.log(reversed)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const reverse: {
  <S extends ReverseableStruct>(): (self: S) => ReverseStruct<S>;
  <S extends ReverseableStruct>(self: S): ReverseStruct<S>;
} = dual(
  (args) => args.length === 1,
  <S extends ReverseableStruct>(self: S): ReverseStruct<S> => {
    const stringEntries = pipe(
      entries(self),
      A.map(([key, value]) => [value, key] as const)
    );
    const symbolEntries = pipe(
      Reflect.ownKeys(self),
      A.filter(P.isSymbol),
      A.map((key) => [self[key], key] as const)
    );

    return cast(fromEntries(A.appendAll(stringEntries, symbolEntries)));
  }
);

/**
 * A utility type for constructing a recursive partial of a given object type.
 *
 * **Details**
 *
 * This type works by traversing the structure of the input type `T` and transforming
 * each property into an optional property. If the property is an array, the transformation
 * is applied recursively to the array's element type. If the property is an object, the
 * transformation is applied recursively to its properties.
 *
 * ## Use Cases
 *
 * - Useful for deeply nested optional configurations or updates in state management.
 * - Helps define inputs where only a part of the structure needs to be specified.
 *
 * ## Behavior
 *
 * - Arrays are transformed into arrays of their recursively partial element type.
 * - Objects are transformed into objects with optional recursively partial properties.
 * - Primitive types like string, number, and boolean aren't altered.
 *
 * **Example** (Partial nested user profile)
 *
 * ```ts
 * import type { DeepPartial } from "@beep/utils/Struct"
 *
 * // Define a nested structure
 * interface User {
 *   id: number
 *   name: string
 *   profile: {
 *     age: number
 *     hobbies: ReadonlyArray<string>
 *   }
 * }
 *
 * // A DeepPartial of User allows all fields to be optional and partial
 * const partialUser: DeepPartial<User> = {
 *   profile: {
 *     hobbies: ["reading"]
 *   }
 * }
 *
 * console.log(partialUser) // { profile: { hobbies: ["reading"] } }
 * ```
 *
 * @typeParam T - The original type for which a recursive partial should be constructed.
 * @category utilities
 * @since 0.0.0
 */
export type DeepPartial<T> = T extends readonly (infer U)[]
  ? readonly DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * Selects the result of {@link deepMerge}.
 *
 * **Details**
 *
 * Spelled as a deferred conditional alias so the data-first and data-last
 * signatures of {@link deepMerge} share a single named return type. Every
 * concrete instantiation resolves back to `T`.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeepMerged<T> = T extends unknown ? T : never;

/**
 * Recursively merges a `DeepPartial` patch into a base struct, producing a new
 * struct of the same shape. Nested plain objects are merged key-by-key,
 * `undefined` patch values are skipped, and non-object values overwrite.
 *
 * **Details**
 *
 * Supports a dual API:
 * - Data-first: `deepMerge(current, patch)`
 * - Data-last: `pipe(current, deepMerge(patch))`
 *
 * **Example** (Merge nested server config)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const defaults = {
 *   server: { host: "localhost", port: 3000 },
 *   debug: false,
 * }
 *
 * const merged = Struct.deepMerge(defaults, { server: { port: 8080 } })
 * // { server: { host: "localhost", port: 8080 }, debug: false }
 *
 * console.log(merged)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const deepMerge: {
  <T extends Record<string, unknown>>(current: T, patch: DeepPartial<T>): DeepMerged<T>;
  <T extends Record<string, unknown>>(patch: DeepPartial<T>): (current: T) => DeepMerged<T>;
} = dual(2, <T extends Record<string, unknown>>(current: T, patch: DeepPartial<T>): DeepMerged<T> => {
  if (!P.isObject(current) || !P.isObject(patch)) {
    return cast(patch);
  }

  const next = { ...current } as Record<string, unknown>;
  for (const [key, value] of entries(patch)) {
    if (isBlockedObjectKey(key)) continue;
    if (value === undefined) continue;

    const existing = next[key];
    next[key] = P.isObject(existing) && P.isObject(value) ? deepMerge(existing, value) : value;
  }

  return cast(next);
});
