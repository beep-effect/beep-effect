/**
 * Field path formatting, reading, writing, and dirty-path predicates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HashSet, Match, Number as N, Struct } from "effect";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";

const BRACKET_NOTATION_REGEX = /\[(\d+)]/g;

type PrimitivePathLeaf = string | number | boolean | bigint | symbol | null | undefined;

type BuildTuple<N extends number, Acc extends ReadonlyArray<unknown> = readonly []> = Acc["length"] extends N
  ? Acc
  : BuildTuple<N, readonly [...Acc, unknown]>;

type Prev<N extends number> = BuildTuple<N> extends readonly [unknown, ...infer Rest] ? Rest["length"] : 0;

type AppendDotPath<Path extends string, Segment extends string | number> = Path extends ""
  ? `${Segment}`
  : `${Path}.${Segment}`;

type AppendBracketPath<Path extends string, Segment extends string | number> = Path extends ""
  ? `${Segment}`
  : `${Path}[${Segment}]`;

type DepthExceededPath<Path extends string> = Path extends ""
  ? string
  : Path | `${Path}.${string}` | `${Path}[${number}]${string}`;

type ArrayPathVariants<Element, Path extends string, Depth extends number> =
  | AppendDotPath<Path, number>
  | AppendBracketPath<Path, number>
  | PathsLimited<Element, AppendDotPath<Path, number>, Prev<Depth>>
  | PathsLimited<Element, AppendBracketPath<Path, number>, Prev<Depth>>;

type ObjectPathVariants<Data, Path extends string, Depth extends number> = {
  [Key in Extract<keyof Data, string | number>]-?:
    | AppendDotPath<Path, Key>
    | PathsLimited<Data[Key], AppendDotPath<Path, Key>, Prev<Depth>>;
}[Extract<keyof Data, string | number>];

type PathsLimited<Data, Path extends string = "", Depth extends number = 3> = Depth extends 0
  ? DepthExceededPath<Path>
  : Data extends PrimitivePathLeaf
    ? Path
    : Data extends ReadonlyArray<infer Element>
      ? ArrayPathVariants<Element, Path, Depth>
      : Data extends object
        ? ObjectPathVariants<Data, Path, Depth>
        : Path;

/**
 * Dot/bracket field paths available for a form value shape.
 *
 * **Details**
 *
 * Object keys use dot notation (`user.name`). Array entries accept both the
 * TanStack-friendly dot form (`items.0.name`) and the schema formatter's
 * bracket form (`items[0].name`).
 *
 * **Example** (Satisfies nested array path)
 *
 * ```ts
 * import type { Paths } from "@beep/form/core/Path"
 *
 * type ProfileForm = {
 *   readonly user: {
 *     readonly addresses: ReadonlyArray<{ readonly city: string }>
 *   }
 * }
 *
 * const cityPath = "user.addresses[0].city" satisfies Paths<ProfileForm>
 * console.log(cityPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Paths<Data> = PathsLimited<Data, "", 5>;

/**
 * Error map keyed by typed form paths, plus the empty-string root error key.
 *
 * **Example** (Root and field errors)
 *
 * ```ts
 * import type { PathErrorMap } from "@beep/form/core/Path"
 *
 * type LoginForm = { readonly email: string }
 *
 * const errors = {
 *   "": "Fix the highlighted fields.",
 *   email: "Enter an email address.",
 * } satisfies PathErrorMap<LoginForm>
 *
 * console.log(errors.email)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PathErrorMap<Data> = Partial<Record<Paths<Data> | "", string>>;

/**
 * Validator result shape used by path-keyed form validation helpers.
 *
 * **Example** (Field validation result)
 *
 * ```ts
 * import type { PathValidationResult } from "@beep/form/core/Path"
 *
 * type LoginForm = { readonly email: string }
 *
 * const result = {
 *   email: "Required",
 * } satisfies NonNullable<PathValidationResult<LoginForm>>
 *
 * console.log(result.email)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PathValidationResult<Data> = PathErrorMap<Data> | null;

/**
 * Rejects prototype-sensitive path segments so dynamic paths can never read or
 * write through `__proto__`, `constructor`, or `prototype`. Mirrors the repo
 * convention in `@beep/utils/Struct`.
 */
const isBlockedPathSegment = (segment: string): boolean =>
  segment === "__proto__" || segment === "constructor" || segment === "prototype";

const hasOwnSegment = (obj: object, segment: string): boolean => A.contains(Struct.keys(obj), segment);

interface StandardPathSegment {
  readonly key: PropertyKey;
}

const isStandardPathSegment = (segment: PropertyKey | StandardPathSegment): segment is StandardPathSegment =>
  P.isObject(segment) && P.hasProperty(segment, "key") && P.isPropertyKey(segment.key);

const getPathSegmentKey = (segment: PropertyKey | StandardPathSegment): PropertyKey =>
  isStandardPathSegment(segment) ? segment.key : segment;

const propertyKeyToPathSegment = (key: PropertyKey): string =>
  Match.value(key).pipe(
    Match.when(P.isString, (value) => value),
    Match.when(P.isNumber, (value) => `${value}`),
    Match.orElse((value) => value.description ?? "")
  );

/**
 * Converts a schema issue path into dot-and-bracket form field notation.
 *
 * **Example** (Schema path to field)
 *
 * ```ts
 * import { schemaPathToFieldPath } from "@beep/form/core/Path"
 *
 * console.log(schemaPathToFieldPath(["items", 0, "name"])) // "items[0].name"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const schemaPathToFieldPath = (path: ReadonlyArray<PropertyKey | StandardPathSegment> | undefined): string => {
  if (path === undefined) return "";
  if (A.length(path) === 0) return "";

  const first = path[0];
  if (first === undefined) return "";

  let result = propertyKeyToPathSegment(getPathSegmentKey(first));
  for (let i = 1; i < A.length(path); i++) {
    const segment = path[i];
    if (segment === undefined) continue;
    const segmentKey = getPathSegmentKey(segment);
    if (P.isNumber(segmentKey)) {
      result += `[${segmentKey}]`;
    } else {
      result += `.${propertyKeyToPathSegment(segmentKey)}`;
    }
  }
  return result;
};

/**
 * Tests whether a path is equal to or nested below a root path.
 *
 * **Example** (Nested path under root)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { isPathUnderRoot } from "@beep/form/core/Path"
 *
 * console.log(isPathUnderRoot("items[0].name", "items")) // true
 * console.log(pipe("items[0].name", isPathUnderRoot("items"))) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPathUnderRoot: {
  (rootPath: string): (path: string) => boolean;
  (path: string, rootPath: string): boolean;
} = dual(
  2,
  (path: string, rootPath: string): boolean =>
    path === rootPath || pipe(path, Str.startsWith(`${rootPath}.`)) || pipe(path, Str.startsWith(`${rootPath}[`))
);

/**
 * Tests whether a path or one of its parents is marked dirty.
 *
 * **Example** (Parent dirty check)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { isPathOrParentDirty } from "@beep/form/core/Path"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(isPathOrParentDirty(HashSet.make("user"), "user.name")) // true
 * console.log(pipe(HashSet.make("user"), isPathOrParentDirty("user.name"))) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPathOrParentDirty: {
  (path: string): (dirtyFields: HashSet.HashSet<string>) => boolean;
  (dirtyFields: HashSet.HashSet<string>, path: string): boolean;
} = dual(2, (dirtyFields: HashSet.HashSet<string>, path: string): boolean => {
  if (HashSet.has(dirtyFields, path)) return true;

  let parent = path;
  while (true) {
    const lastDot = pipe(
      Str.lastIndexOf(".")(parent),
      O.getOrElse(() => -1)
    );
    const lastBracket = pipe(
      Str.lastIndexOf("[")(parent),
      O.getOrElse(() => -1)
    );
    const splitIndex = N.max(lastDot, lastBracket);

    if (splitIndex === -1) break;

    parent = pipe(parent, Str.substring(0, splitIndex));
    if (HashSet.has(dirtyFields, parent)) return true;
  }

  return false;
});

/**
 * Reads a value from a dot-and-bracket path.
 *
 * **Example** (Read nested path value)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { getNestedValue } from "@beep/form/core/Path"
 *
 * console.log(getNestedValue({ items: [{ name: "A" }] }, "items[0].name")) // "A"
 * console.log(pipe({ items: [{ name: "A" }] }, getNestedValue("items[0].name"))) // "A"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getNestedValue: {
  (path: string): (obj: unknown) => unknown;
  <T>(obj: T, path: Paths<NoInfer<T>>): unknown;
} = dual(2, <T>(obj: T, path: string): unknown => {
  if (path === "") return obj;
  const parts = pipe(path, Str.replace(BRACKET_NOTATION_REGEX, ".$1"), Str.split("."));
  let current: unknown = obj;
  for (const part of parts) {
    if (!P.isObjectOrArray(current)) return undefined;
    if (isBlockedPathSegment(part) || !hasOwnSegment(current, part)) return undefined;
    current = (current as unknown as Readonly<Record<string, unknown>>)[part];
  }
  return current;
});

/**
 * Sets a value at a dot-and-bracket path while copying touched containers.
 *
 * **Example** (Set nested path value)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { setNestedValue } from "@beep/form/core/Path"
 *
 * const result = setNestedValue({ user: { name: "Ada" } }, { path: "user.name", value: "Grace" })
 * const piped = pipe({ user: { name: "Ada" } }, setNestedValue({ path: "user.name", value: "Grace" }))
 * console.log(result.user.name) // "Grace"
 * console.log(piped.user.name) // "Grace"
 * ```
 *
 * @category setters
 * @since 0.0.0
 */
export const setNestedValue: {
  (options: { readonly path: string; readonly value: unknown }): <T>(obj: T) => T;
  <T>(obj: T, options: { readonly path: Paths<NoInfer<T>>; readonly value: unknown }): T;
} = dual(2, <T>(obj: T, options: { readonly path: string; readonly value: unknown }): T => {
  const { path, value } = options;
  if (path === "") return value as T;
  const parts = pipe(path, Str.replace(BRACKET_NOTATION_REGEX, ".$1"), Str.split("."));
  const result = { ...(obj as unknown as Record<string, unknown>) } as Record<string, unknown>;

  // Reject prototype-sensitive paths outright; they are never valid form field
  // paths and assigning through them would poison the returned object.
  if (A.some(parts, isBlockedPathSegment)) return result as T;

  let current = result;
  for (let i = 0; i < A.length(parts) - 1; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    const existing = hasOwnSegment(current, part) ? current[part] : undefined;
    if (A.isArray(existing)) {
      current[part] = A.copy(existing);
    } else {
      current[part] = { ...(existing as unknown as Record<string, unknown>) };
    }
    current = current[part] as unknown as Record<string, unknown>;
  }

  const lastPart = parts[A.length(parts) - 1];
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
  return result as T;
});
