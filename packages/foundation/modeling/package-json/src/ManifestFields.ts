/**
 * Field schemas for the generic npm, Node, TypeScript, bundler, Yarn and Bun
 * package.json fields that `Package` models beyond its core identity,
 * dependency and entry-point fields: `files`, `imports`, `module`, `browser`,
 * `man`, `directories`, `config`, `bundleDependencies`, `overrides`, `os`,
 * `cpu`, `libc`, `workspaces`, `sideEffects`, `typesVersions`, `resolutions`,
 * `patchedDependencies`, `trustedDependencies` and `catalog`.
 *
 * **Details**
 *
 * Every schema here is its field's plain JSON shape, decoded and encoded
 * without rewriting it: maps stay plain records (so their source key order
 * survives a round trip, unlike the `HashMap`-backed dependency maps), and
 * open objects keep every key in source order, the `workspaces` object
 * included. Repo-specific refinements, such as a closed
 * key set or package-name keys in `catalog`, belong to a `.extend()`ed
 * subclass, not to these generic shapes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaParser from "effect/SchemaParser";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $PackageJsonId.create("ManifestFields");

/**
 * A list of strings: `files`, `os`, `cpu`, `libc` and `trustedDependencies`.
 *
 * **Example** (Decode a platform list)
 *
 * ```ts
 * import { StringListField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(StringListField)(["linux", "!win32"])); // [ 'linux', '!win32' ]
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const StringListField = S.Array(S.String).pipe(
  $I.annoteSchema("StringListField", {
    description: "A list of strings, such as file globs, platform names or trusted package names.",
  })
);

/**
 * Decoded value produced by {@link StringListField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type StringListField = typeof StringListField.Type;

/**
 * A string-to-string record kept as a plain object, so its source key order
 * survives a round trip: `directories`, `resolutions`, `patchedDependencies`
 * and `catalog`.
 *
 * **Example** (Decode a Bun catalog)
 *
 * ```ts
 * import { StringRecordField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(StringRecordField)({ effect: "4.0.4" }).effect); // 4.0.4
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const StringRecordField = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("StringRecordField", {
    description: "A string-to-string record kept as a plain object, preserving its source key order.",
  })
);

/**
 * Decoded value produced by {@link StringRecordField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type StringRecordField = typeof StringRecordField.Type;

/**
 * An open object whose values are any JSON: `imports` (Node subpath imports,
 * kept open like `exports`) and `config` (npm script configuration).
 *
 * **Example** (Keep subpath imports verbatim)
 *
 * ```ts
 * import { OpenRecordField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * const imports = S.decodeUnknownSync(OpenRecordField)({ "#internal/*": "./src/internal/*.js" });
 * console.log(imports["#internal/*"]); // ./src/internal/*.js
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const OpenRecordField = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("OpenRecordField", {
    description: "An open object whose values are any JSON, preserved verbatim.",
  })
);

/**
 * Decoded value produced by {@link OpenRecordField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OpenRecordField = typeof OpenRecordField.Type;

/**
 * **Example** (Block a Node module in the browser build)
 *
 * ```ts
 * import { BrowserField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(BrowserField)({ fs: false, "./node.js": "./browser.js" })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const BrowserField = S.Union([S.String, S.Record(S.String, S.Union([S.String, S.Literal(false)]))]).pipe(
  $I.annoteSchema("BrowserField", {
    description: "A browser entry-point path, or a map of module replacements where `false` blocks a module.",
  })
);

/**
 * Decoded value produced by {@link BrowserField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BrowserField = typeof BrowserField.Type;

/**
 * **Example** (Decode a single man page)
 *
 * ```ts
 * import { ManField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(ManField)("./man/doc.1")); // ./man/doc.1
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ManField = S.Union([S.String, S.Array(S.String)]).pipe(
  $I.annoteSchema("ManField", { description: "One man page path or a list of man page paths." })
);

/**
 * Decoded value produced by {@link ManField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ManField = typeof ManField.Type;

/**
 * A boolean or a list of strings: `sideEffects` (a flag or the side-effectful
 * file globs) and `bundleDependencies` / `bundledDependencies` (bundle every
 * dependency, or the names to bundle).
 *
 * **Example** (Declare side-effectful files)
 *
 * ```ts
 * import { BooleanOrStringListField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(BooleanOrStringListField)(["*.css"])); // true
 * console.log(S.is(BooleanOrStringListField)(false)); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const BooleanOrStringListField = S.Union([S.Boolean, S.Array(S.String)]).pipe(
  $I.annoteSchema("BooleanOrStringListField", {
    description: "A boolean flag or a list of strings, as `sideEffects` and `bundleDependencies` take.",
  })
);

/**
 * Decoded value produced by {@link BooleanOrStringListField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BooleanOrStringListField = typeof BooleanOrStringListField.Type;

/**
 * One npm `overrides` value: a replacement specifier, or a nested object of
 * overrides scoped under a dependency (where the `"."` key overrides the
 * dependency itself).
 *
 * **Example** (Guard a nested override value)
 *
 * ```ts
 * import { OverrideValue } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(OverrideValue)({ ".": "1.0.0", bar: "2.0.0" })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const OverrideValue = S.suspend(
  (): S.Codec<OverrideValue> => S.Union([S.String, S.Record(S.String, OverrideValue)])
).pipe(
  $I.annoteSchema("OverrideValue", {
    description: "An npm overrides value: a replacement specifier or a nested object of scoped overrides.",
  })
);

/**
 * Decoded value produced by {@link OverrideValue}: a replacement specifier or
 * a nested object of scoped overrides.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OverrideValue = string | { readonly [key: string]: OverrideValue };

/**
 * **Example** (Override a transitive dependency under a parent)
 *
 * ```ts
 * import { OverridesField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(OverridesField)({ foo: { ".": "1.0.0", bar: "2.0.0" }, baz: "3.0.0" })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const OverridesField = S.Record(S.String, OverrideValue).pipe(
  $I.annoteSchema("OverridesField", {
    description: "Dependency names mapped to a replacement specifier or a nested object of scoped overrides.",
  })
);

/**
 * Decoded value produced by {@link OverridesField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OverridesField = typeof OverridesField.Type;

/**
 * **Example** (Redirect declarations for older compilers)
 *
 * ```ts
 * import { TypesVersionsField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TypesVersionsField)({ "<4.0": { "*": ["ts3.9/*"] } })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TypesVersionsField = S.Record(S.String, S.Record(S.String, S.Array(S.String))).pipe(
  $I.annoteSchema("TypesVersionsField", {
    description: "TypeScript version ranges mapped to path patterns and their declaration redirect lists.",
  })
);

/**
 * Decoded value produced by {@link TypesVersionsField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TypesVersionsField = typeof TypesVersionsField.Type;

const WorkspacesConfigShape = S.StructWithRest(
  S.Struct({
    packages: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("WorkspacesConfig.packages", { description: "Workspace package globs." })
    ),
    nohoist: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("WorkspacesConfig.nohoist", {
        description: "Yarn patterns for dependencies that must not be hoisted.",
      })
    ),
  }),
  [S.Record(S.String, S.Unknown)]
);

const parseWorkspacesConfig = SchemaParser.decodeUnknownEffect(WorkspacesConfigShape);
const serializeWorkspacesConfig = SchemaParser.encodeUnknownEffect(WorkspacesConfigShape);

/**
 * The object form of `workspaces`: optional `packages` globs and Yarn
 * `nohoist` patterns, with every other key (such as Bun's `catalog` and
 * `catalogs`) kept verbatim.
 *
 * **Details**
 *
 * The source key order survives a round trip. A struct parse emits its
 * declared keys first, so a Bun root's `{ "catalog": …, "packages": … }`
 * would come back as `{ "packages": …, "catalog": … }`, and the formatter's
 * canonical sort orders top-level keys only. Instead the struct only
 * validates (keeping its issue paths) and the plain record is the value; every
 * member is an identity codec, so the validated object is the input.
 *
 * **Example** (Keep a Bun catalog inside the workspaces object)
 *
 * ```ts
 * import { WorkspacesConfig } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * const config = S.decodeUnknownSync(WorkspacesConfig)({ catalog: { effect: "4.0.4" }, packages: ["packages/*"] });
 * console.log(config.packages, Object.keys(config)); // [ 'packages/*' ] [ 'catalog', 'packages' ]
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorkspacesConfig extends S.Opaque<WorkspacesConfig, { readonly brand: unique symbol }>()(
  S.Record(S.String, S.Unknown).pipe(
    S.decodeTo(
      S.Record(S.String, S.Unknown).pipe(S.refine(S.is(WorkspacesConfigShape))),
      SchemaTransformation.transformEffect({
        decode: (raw, options) => Effect.as(parseWorkspacesConfig(raw, options), raw),
        encode: (config, options) => Effect.as(serializeWorkspacesConfig(config, options), config),
      })
    ),
    $I.annoteSchema("WorkspacesConfig", {
      description: "The object form of `workspaces`: package globs, nohoist patterns and any other key verbatim.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkspacesConfig {
  /**
   * The plain wire object a {@link WorkspacesConfig} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WorkspacesConfig.Encoded;
}

/**
 * **Example** (Decode workspace globs)
 *
 * ```ts
 * import { WorkspacesField } from "@beep/package-json/ManifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(WorkspacesField)(["packages/*", "apps/*"])); // [ 'packages/*', 'apps/*' ]
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const WorkspacesField = S.Union([S.Array(S.String), WorkspacesConfig]).pipe(
  $I.annoteSchema("WorkspacesField", {
    description: "Workspace package globs, as a list or as an object with packages, nohoist and other keys.",
  })
);

/**
 * Decoded value produced by {@link WorkspacesField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorkspacesField = typeof WorkspacesField.Type;
