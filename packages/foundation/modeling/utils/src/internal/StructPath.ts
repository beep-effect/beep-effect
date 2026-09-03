/**
 * Internal runtime path lookup helpers for struct utilities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UtilsId } from "@beep/identity/packages";
import { Match } from "effect";
import { cast, dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as A from "../Array.ts";

const $I = $UtilsId.create("StructPath");

/**
 * Schema for dot-delimited paths or path segment arrays.
 *
 * **Example** (Import PathInput schema)
 *
 * ```ts
 * import { PathInput } from "@beep/utils/Struct"
 *
 * const schema = PathInput
 * console.log(schema)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PathInput = S.Union([S.String, S.Array(S.String)]).pipe(
  $I.annoteSchema("PathInput", {
    description: "Dot-delimited or segment-array path accepted by struct lookup helpers.",
  })
);

/**
 * Runtime path input accepted by struct lookup helpers.
 *
 * **Example** (Typed path segment array)
 *
 * ```ts
 * import type { PathInput } from "@beep/utils/Struct"
 *
 * const path: PathInput = ["profile", "name"]
 * console.log(path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PathInput = typeof PathInput.Type;

const PathLookupSchema = S.TaggedUnion({
  notFound: { found: S.tag(false) },
  found: {
    found: S.tag(true),
    value: S.Unknown,
  },
});

/**
 * Tagged result returned by a runtime path lookup.
 *
 * **Example** (Access found property)
 *
 * ```ts
 * import type { PathLookup } from "@beep/utils/internal/StructPath"
 *
 * const describe = (lookup: PathLookup) => lookup.found
 * console.log(describe)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PathLookup = typeof PathLookupSchema.Type;

const makeNotFound = (): PathLookup => PathLookupSchema.cases.notFound.make({ found: false });

const makeFound = (value: unknown): PathLookup =>
  PathLookupSchema.cases.found.make({
    found: true,
    value,
  });

/**
 * Converts a path lookup result into its `Option` value channel.
 *
 * **Example** (Convert lookup to Option)
 *
 * ```ts
 * import { lookupAtPath, pathLookupToOption } from "@beep/utils/internal/StructPath"
 *
 * const lookup = lookupAtPath({ profile: { name: "Ada" } }, "profile.name")
 * const value = pathLookupToOption(lookup)
 * console.log(value)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const pathLookupToOption = (lookup: PathLookup): O.Option<unknown> =>
  PathLookupSchema.match(lookup, {
    found: ({ value }) => O.some(value),
    notFound: O.none,
  });

const isRecordLookupTarget = (input: unknown): input is Record<string, unknown> =>
  P.or(P.or(P.isObject, A.isArray), P.isFunction)(input);

const normalizePath = (path: PathInput): ReadonlyArray<string> =>
  Match.value(path).pipe(
    Match.when(Str.isString, Str.split(".")),
    Match.orElse((parts) => parts)
  );

const toRecordOption = (input: unknown): O.Option<Record<string, unknown>> =>
  Match.value(P.isNullish(input) || !isRecordLookupTarget(input)).pipe(
    Match.when(true, O.none<Record<string, unknown>>),
    Match.orElse(() => O.some(cast<unknown, Record<string, unknown>>(input)))
  );

const lookupRecordPart = (part: string) =>
  flow(
    toRecordOption,
    O.filter((record) => R.has(record, part)),
    O.map((record) => record[part])
  );

const lookupPart =
  (part: string) =>
  (current: unknown): O.Option<unknown> =>
    Match.value(part.length === 0).pipe(
      Match.when(true, O.none),
      Match.orElse(() => lookupRecordPart(part)(current))
    );

const toPathLookup = (result: O.Option<unknown>): PathLookup =>
  O.match(result, {
    onNone: makeNotFound,
    onSome: makeFound,
  });

const lookupParts = (self: unknown, parts: A.NonEmptyReadonlyArray<string>): PathLookup => {
  const result = A.reduce(parts, O.some(self) as O.Option<unknown>, (current, part) =>
    O.flatMap(current, lookupPart(part))
  );

  return toPathLookup(result);
};

/**
 * Looks up a value at a dot-delimited path or path segment array.
 *
 * **Example** (Lookup nested path value)
 *
 * ```ts
 * import { lookupAtPath } from "@beep/utils/internal/StructPath"
 *
 * const lookup = lookupAtPath({ profile: { name: "Ada" } }, "profile.name")
 * console.log(lookup)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const lookupAtPath: {
  <const P extends PathInput>(path: P): <S extends object>(self: S) => PathLookup;
  <S extends object>(path: PathInput): (self: S) => PathLookup;
  <S extends object>(self: S, path: PathInput): PathLookup;
} = dual(
  2,
  <S extends object>(self: S, path: PathInput): PathLookup =>
    A.match(normalizePath(path), {
      onEmpty: makeNotFound,
      onNonEmpty: (parts) => lookupParts(self, parts),
    })
);

/**
 * Unsafely returns a value at a path, or `undefined` when absent.
 *
 * **Example** (Unsafe nested path get)
 *
 * ```ts
 * import { unsafeDotGet } from "@beep/utils/internal/StructPath"
 *
 * const value = unsafeDotGet({ profile: { name: "Ada" } }, "profile.name")
 * console.log(value)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const unsafeDotGet: {
  <const P extends PathInput>(path: P): <S extends object>(self: S) => unknown;
  <S extends object>(path: PathInput): (self: S) => unknown;
  <S extends object>(self: S, path: PathInput): unknown;
} = dual(2, (self: object, path: PathInput): unknown => {
  const lookup = lookupAtPath(self, path);

  return O.match(pathLookupToOption(lookup), {
    onNone: () => undefined,
    onSome: (value) => value,
  });
});
