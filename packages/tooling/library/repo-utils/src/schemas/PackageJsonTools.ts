/**
 * Canonicalization, artifact export, diff/patch, and diagnostics helpers for package.json schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { ArrayOfStrings } from "@beep/schema";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, flow, identity, JsonPointer, Order, pipe, SchemaIssue, Tuple } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { DomainError } from "../errors/index.ts";
import { jsonStringifyPretty } from "../JsonUtils.ts";
import {
  Browser,
  decodePackageJsonEffect,
  encodePackageJsonEffect,
  NpmPackageJson,
  PackageExports,
  PackageImports,
  PackageJson,
  PeerDependenciesMeta,
  PublishConfig,
  TypesVersions,
} from "./PackageJson.ts";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { JsonPatch } from "effect";

const $I = $RepoUtilsId.create("schemas/PackageJsonTools");

const packageJsonDiffer = S.toDifferJsonPatch(PackageJson);

const publishConfigKeyOrder = A.make("access", "tag", "registry", "provenance", "bin", "exports");

const isStringRecord = (value: unknown): value is Readonly<Record<string, unknown>> => P.isObject(value);

type IssuePathSegment = NonNullable<StandardSchemaV1.Issue["path"]>[number];

const JsonPointerText = S.String.check(S.isPattern(/^$|^\//u)).pipe(
  $I.annoteSchema("JsonPointerText", {
    title: "JSON Pointer Text",
    description: "A JSON Pointer string, including the empty root pointer.",
  })
);

const isIssuePathSegmentObject = (value: IssuePathSegment): value is StandardSchemaV1.PathSegment =>
  P.isObject(value) &&
  P.hasProperty(value, "key") &&
  (P.isString(value.key) || P.isNumber(value.key) || P.isSymbol(value.key));

const toIssuePathPropertyKey = (segment: IssuePathSegment): PropertyKey =>
  isIssuePathSegmentObject(segment) ? segment.key : segment;

const toPathSegment = (value: PropertyKey): string => {
  if (P.isString(value)) {
    return value;
  }
  if (P.isNumber(value)) {
    return `${value}`;
  }
  return value.description === undefined ? "Symbol()" : `Symbol(${value.description})`;
};

const renderIssuePathSegment = (segment: IssuePathSegment): string => toPathSegment(toIssuePathPropertyKey(segment));

const sortStringRecord = <Value>(
  record: Readonly<Record<string, Value>>,
  normalizeValue: (value: Value) => Value
): Record<string, Value> =>
  pipe(
    R.toEntries(record),
    A.map(([key, value]) => Tuple.make(key, normalizeValue(value))),
    A.sort(Order.mapInput(Order.String, ([key]: [string, Value]) => key)),
    R.fromEntries
  );

const canonicalizeUnknownValue = (value: unknown): unknown => {
  if (A.isArray(value)) {
    return A.map(value, canonicalizeUnknownValue);
  }
  if (isStringRecord(value)) {
    return sortStringRecord(value, canonicalizeUnknownValue);
  }
  return value;
};

const isKnownPublishConfigKey = (key: string): boolean =>
  key === "access" || key === "tag" || key === "registry" || key === "provenance" || key === "bin" || key === "exports";

const canonicalizePublishConfigValue = (key: string, value: unknown): unknown => {
  if (key === "bin" && isStringRecord(value)) {
    return sortStringRecord(value, identity);
  }
  if (key === "exports") {
    return canonicalizeUnknownValue(value);
  }
  return value;
};

const canonicalizePublishConfig = (
  value: NonNullable<PackageJson.Encoded["publishConfig"]>
): NonNullable<PackageJson.Encoded["publishConfig"]> => {
  if (!isStringRecord(value)) {
    return value;
  }

  let out = R.empty<string, unknown>();
  for (const key of publishConfigKeyOrder) {
    if (R.has(key)(value)) {
      out = R.set(out, key, canonicalizePublishConfigValue(key, O.getOrUndefined(R.get(value, key))));
    }
  }

  const remaining = pipe(
    R.toEntries(value),
    A.filter(([key]) => !isKnownPublishConfigKey(key)),
    A.sort(Order.mapInput(Order.String, ([key]: [string, unknown]) => key))
  );

  for (const [key, entryValue] of remaining) {
    out = R.set(out, key, canonicalizeUnknownValue(entryValue));
  }

  return PublishConfig.fromUnknown(out);
};

const canonicalizePackageJsonEncoded = (encoded: PackageJson.Encoded): PackageJson.Encoded =>
  ({
    name: encoded.name,
    ...O.getSomesStruct({ version: O.fromUndefinedOr(encoded.version) }),
    ...O.getSomesStruct({ description: O.fromUndefinedOr(encoded.description) }),
    ...O.getSomesStruct({ keywords: O.fromUndefinedOr(encoded.keywords) }),
    ...O.getSomesStruct({ license: O.fromUndefinedOr(encoded.license) }),
    ...O.getSomesStruct({ private: O.fromUndefinedOr(encoded.private) }),
    ...O.getSomesStruct({ type: O.fromUndefinedOr(encoded.type) }),
    ...O.getSomesStruct({ packageManager: O.fromUndefinedOr(encoded.packageManager) }),
    ...O.getSomesStruct({ workspaces: O.fromUndefinedOr(encoded.workspaces) }),
    ...O.getSomesStruct({ homepage: O.fromUndefinedOr(encoded.homepage) }),
    ...O.getSomesStruct({ repository: O.fromUndefinedOr(encoded.repository) }),
    ...O.getSomesStruct({ beep: O.fromUndefinedOr(encoded.beep) }),
    ...O.getSomesStruct({ bugs: O.fromUndefinedOr(encoded.bugs) }),
    ...O.getSomesStruct({ author: O.fromUndefinedOr(encoded.author) }),
    ...O.getSomesStruct({ contributors: O.fromUndefinedOr(encoded.contributors) }),
    ...O.getSomesStruct({ maintainers: O.fromUndefinedOr(encoded.maintainers) }),
    ...O.getSomesStruct({ funding: O.fromUndefinedOr(encoded.funding) }),
    ...O.getSomesStruct({
      scripts: O.map(O.fromUndefinedOr(encoded.scripts), (scripts) => sortStringRecord(scripts, identity)),
    }),
    ...O.getSomesStruct({ main: O.fromUndefinedOr(encoded.main) }),
    ...O.getSomesStruct({ module: O.fromUndefinedOr(encoded.module) }),
    ...O.getSomesStruct({ types: O.fromUndefinedOr(encoded.types) }),
    ...O.getSomesStruct({ typings: O.fromUndefinedOr(encoded.typings) }),
    ...O.getSomesStruct({
      exports: O.map(O.fromUndefinedOr(encoded.exports), (exports) =>
        PackageExports.fromUnknown(canonicalizeUnknownValue(exports))
      ),
    }),
    ...O.getSomesStruct({
      imports: O.map(O.fromUndefinedOr(encoded.imports), (imports) =>
        PackageImports.fromUnknown(canonicalizeUnknownValue(imports))
      ),
    }),
    ...O.getSomesStruct({
      browser: O.map(O.fromUndefinedOr(encoded.browser), (browser) =>
        P.isString(browser) ? browser : Browser.fromUnknown(canonicalizeUnknownValue(browser))
      ),
    }),
    ...O.getSomesStruct({ bin: O.fromUndefinedOr(encoded.bin) }),
    ...O.getSomesStruct({ man: O.fromUndefinedOr(encoded.man) }),
    ...O.getSomesStruct({ directories: O.fromUndefinedOr(encoded.directories) }),
    ...O.getSomesStruct({ files: O.fromUndefinedOr(encoded.files) }),
    ...O.getSomesStruct({ sideEffects: O.fromUndefinedOr(encoded.sideEffects) }),
    ...O.getSomesStruct({
      publishConfig: O.map(O.fromUndefinedOr(encoded.publishConfig), (publishConfig) =>
        canonicalizePublishConfig(publishConfig)
      ),
    }),
    ...O.getSomesStruct({ config: O.fromUndefinedOr(encoded.config) }),
    ...O.getSomesStruct({
      dependencies: O.map(O.fromUndefinedOr(encoded.dependencies), (dependencies) =>
        sortStringRecord(dependencies, identity)
      ),
    }),
    ...O.getSomesStruct({
      devDependencies: O.map(O.fromUndefinedOr(encoded.devDependencies), (devDependencies) =>
        sortStringRecord(devDependencies, identity)
      ),
    }),
    ...O.getSomesStruct({
      peerDependencies: O.map(O.fromUndefinedOr(encoded.peerDependencies), (peerDependencies) =>
        sortStringRecord(peerDependencies, identity)
      ),
    }),
    ...O.getSomesStruct({
      peerDependenciesMeta: O.map(O.fromUndefinedOr(encoded.peerDependenciesMeta), (peerDependenciesMeta) =>
        PeerDependenciesMeta.fromUnknown(canonicalizeUnknownValue(peerDependenciesMeta))
      ),
    }),
    ...O.getSomesStruct({
      optionalDependencies: O.map(O.fromUndefinedOr(encoded.optionalDependencies), (optionalDependencies) =>
        sortStringRecord(optionalDependencies, identity)
      ),
    }),
    ...O.getSomesStruct({ bundleDependencies: O.fromUndefinedOr(encoded.bundleDependencies) }),
    ...O.getSomesStruct({ bundledDependencies: O.fromUndefinedOr(encoded.bundledDependencies) }),
    ...O.getSomesStruct({ overrides: O.fromUndefinedOr(encoded.overrides) }),
    ...O.getSomesStruct({
      resolutions: O.map(O.fromUndefinedOr(encoded.resolutions), (resolutions) =>
        sortStringRecord(resolutions, identity)
      ),
    }),
    ...O.getSomesStruct({
      catalog: O.map(O.fromUndefinedOr(encoded.catalog), (catalog) => sortStringRecord(catalog, identity)),
    }),
    ...O.getSomesStruct({
      "resolutions#": O.map(O.fromUndefinedOr(encoded["resolutions#"]), (value) => sortStringRecord(value, identity)),
    }),
    ...O.getSomesStruct({
      engines: O.map(O.fromUndefinedOr(encoded.engines), (engines) => sortStringRecord(engines, identity)),
    }),
    ...O.getSomesStruct({ engineStrict: O.fromUndefinedOr(encoded.engineStrict) }),
    ...O.getSomesStruct({ os: O.fromUndefinedOr(encoded.os) }),
    ...O.getSomesStruct({ cpu: O.fromUndefinedOr(encoded.cpu) }),
    ...O.getSomesStruct({ libc: O.fromUndefinedOr(encoded.libc) }),
    ...O.getSomesStruct({ devEngines: O.fromUndefinedOr(encoded.devEngines) }),
    ...O.getSomesStruct({ preferGlobal: O.fromUndefinedOr(encoded.preferGlobal) }),
    ...O.getSomesStruct({ readme: O.fromUndefinedOr(encoded.readme) }),
    ...O.getSomesStruct({
      typesVersions: O.map(O.fromUndefinedOr(encoded.typesVersions), (typesVersions) =>
        TypesVersions.fromUnknown(canonicalizeUnknownValue(typesVersions))
      ),
    }),
  }) satisfies PackageJson.Encoded;

const toPointer = (path: ReadonlyArray<string>): string =>
  A.isReadonlyArrayEmpty(path) ? "" : `/${pipe(path, A.map(JsonPointer.escapeToken), A.join("/"))}`;

const renderIssuePath = (path: StandardSchemaV1.Issue["path"]): ReadonlyArray<string> =>
  pipe(O.fromNullishOr(path), O.map(flow(A.map(renderIssuePathSegment))), O.getOrElse(A.empty<string>));

/**
 * Structured package.json validation issue.
 *
 * @example
 * ```ts
 * import { PackageJsonValidationIssue } from "@beep/repo-utils/schemas/PackageJsonTools"
 * const issue = PackageJsonValidationIssue.make({
 *   message: "Expected string",
 *   path: ["name"],
 *   pointer: "/name"
 * })
 * console.log(issue.pointer)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageJsonValidationIssue extends S.Class<PackageJsonValidationIssue>($I`PackageJsonValidationIssue`)(
  {
    path: ArrayOfStrings.annotateKey({
      description: "Path segments identifying the invalid package.json location.",
    }),
    pointer: JsonPointerText.annotateKey({
      description: "JSON Pointer for the invalid package.json location; the empty string points at the root.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Human-readable validation message returned by Effect Schema.",
    }),
  },
  $I.annote("PackageJsonValidationIssue", {
    description: "A formatted package.json validation issue with both path segments and a JSON Pointer.",
  })
) {}

/**
 * Draft 2020-12 JSON Schema document for the repo-aware package.json schema.
 *
 * @example
 * ```ts
 * import { packageJsonJsonSchema } from "@beep/repo-utils/schemas/PackageJsonTools"
 * const schema = packageJsonJsonSchema
 * console.log(schema)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const packageJsonJsonSchema = S.toJsonSchemaDocument(PackageJson);

/**
 * Draft 2020-12 JSON Schema document for the npm-only package.json schema.
 *
 * @example
 * ```ts
 * import { npmPackageJsonJsonSchema } from "@beep/repo-utils/schemas/PackageJsonTools"
 * const schema = npmPackageJsonJsonSchema
 * console.log(schema)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const npmPackageJsonJsonSchema = S.toJsonSchemaDocument(NpmPackageJson);

/**
 * Normalize an unknown package.json value into a canonical encoded object.
 *
 * @remarks
 * Known record fields such as scripts and dependencies are sorted by key, while
 * unsupported package.json shapes still fail through {@link decodePackageJsonEffect}.
 * Unknown-but-schema-supported nested JSON is canonicalized recursively.
 * @effects
 * Validates the package manifest through {@link encodePackageJsonEffect}, then
 * canonicalizes key ordering in memory; failures are reported as
 * `S.SchemaError`.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { normalizePackageJsonEffect } from "@beep/repo-utils/schemas/PackageJsonTools"
 * const normalized = Effect.runSync(normalizePackageJsonEffect({
 *   name: "@beep/example",
 *   dependencies: { zod: "^4.0.0", effect: "catalog:" }
 * }))
 * console.log(Object.keys(normalized.dependencies ?? {})) // ["effect", "zod"]
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const normalizePackageJsonEffect: (input: unknown) => Effect.Effect<PackageJson.Encoded, S.SchemaError> =
  Effect.fn("RepoUtils.PackageJsonTools.normalizePackageJson")(function* (input) {
    const encoded = yield* encodePackageJsonEffect(input);
    return canonicalizePackageJsonEncoded(encoded);
  });

/**
 * Encode an unknown package.json value to a canonical pretty JSON string.
 *
 * @example
 * ```ts
 * import { encodePackageJsonCanonicalPrettyEffect } from "@beep/repo-utils/schemas/PackageJsonTools"
 * const program = encodePackageJsonCanonicalPrettyEffect({
 *   name: "@beep/example",
 *   version: "0.0.0"
 * })
 * console.log(program)
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const encodePackageJsonCanonicalPrettyEffect: (
  input: unknown
) => Effect.Effect<string, S.SchemaError | DomainError> = Effect.fn(
  "RepoUtils.PackageJsonTools.encodePackageJsonCanonicalPretty"
)(function* (input) {
  const normalized = yield* normalizePackageJsonEffect(input);
  return yield* jsonStringifyPretty(normalized);
});

/**
 * Compute a typed JSON Patch diff between two package.json values.
 *
 * @example
 * ```ts
 * import { diffPackageJsonEffect } from "@beep/repo-utils/schemas/PackageJsonTools"
 * const program = diffPackageJsonEffect(
 *   { name: "@beep/example", version: "0.0.0" },
 *   { name: "@beep/example", version: "0.0.1" }
 * )
 * console.log(program)
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const diffPackageJsonEffect: {
  (after: unknown): (before: unknown) => Effect.Effect<JsonPatch.JsonPatch, S.SchemaError>;
  (before: unknown, after: unknown): Effect.Effect<JsonPatch.JsonPatch, S.SchemaError>;
} = dual(
  2,
  Effect.fn("RepoUtils.PackageJsonTools.diffPackageJson")(function* (before, after) {
    const decodedBefore = yield* decodePackageJsonEffect(before);
    const decodedAfter = yield* decodePackageJsonEffect(after);
    return packageJsonDiffer.diff(decodedBefore, decodedAfter);
  })
);

/**
 * Apply a typed JSON Patch document to a package.json value.
 *
 * @example
 * ```ts
 * import { applyPackageJsonPatchEffect } from "@beep/repo-utils/schemas/PackageJsonTools"
 * const program = applyPackageJsonPatchEffect(
 *   { name: "@beep/example", version: "0.0.0" },
 *   []
 * )
 * console.log(program)
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const applyPackageJsonPatchEffect: {
  (patch: JsonPatch.JsonPatch): (base: unknown) => Effect.Effect<PackageJson.Type, S.SchemaError | DomainError>;
  (base: unknown, patch: JsonPatch.JsonPatch): Effect.Effect<PackageJson.Type, S.SchemaError | DomainError>;
} = dual(
  2,
  Effect.fn("RepoUtils.PackageJsonTools.applyPackageJsonPatch")(function* (base, patch) {
    const decodedBase = yield* decodePackageJsonEffect(base);
    return yield* Effect.try({
      try: () => packageJsonDiffer.patch(decodedBase, patch),
      catch: (cause) => DomainError.make({ cause, message: "Failed to apply package.json JSON Patch" }),
    });
  })
);

/**
 * Format a SchemaError into package.json validation issues with JSON Pointers.
 *
 * @param error - Schema decoding or encoding error to render as structured validation issues.
 * @returns Structured validation issues derived from the schema error.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { getPackageJsonSchemaIssues } from "@beep/repo-utils/schemas/PackageJsonTools"
 * const program = S.decodeUnknownEffect(S.String)(1).pipe(
 *   Effect.mapError(getPackageJsonSchemaIssues)
 * )
 * console.log(program)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const getPackageJsonSchemaIssues = (error: S.SchemaError): ReadonlyArray<PackageJsonValidationIssue> =>
  pipe(
    SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues,
    A.map(({ path, message }) => {
      const renderedPath = renderIssuePath(path);
      return PackageJsonValidationIssue.make({
        path: renderedPath,
        pointer: toPointer(renderedPath),
        message,
      });
    })
  );
