/**
 * Schemas for the generated `effect/Schema` index: one entry per value export
 * of the installed `effect/Schema`, the named getters and transformations of
 * `effect/SchemaGetter` and `effect/SchemaTransformation`, and the Markdown
 * slices rendered from them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/SchemaIdioms/SchemaIdioms.model");

/**
 * **Example** (Classify a wire type)
 *
 * ```ts import.meta.vitest name="Classify a wire type"
 * import { SchemaWireType } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * SchemaWireType.is.number("number") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaWireType = LiteralKit(["string", "number", "bigint", "date", "other"]).pipe(
  $I.annoteSchema("SchemaWireType", {
    description:
      "Encoded (wire) type a shipped schema reads: a string, number, bigint or Date, or any other encoded shape.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SchemaWireType = typeof SchemaWireType.Type;

/**
 * **Example** (Describe a codec entry)
 *
 * ```ts import.meta.vitest name="Describe a codec entry"
 * import { SchemaIndexCodec } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * const entry = SchemaIndexCodec.make({
 *   kind: "codec",
 *   name: "DurationFromMillis",
 *   decoded: "Duration.Duration",
 *   encoded: "number",
 *   summary: O.some("Schema that decodes a number into a `Duration`."),
 *   category: O.some("schemas"),
 * })
 *
 * entry.encoded // => "number"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIndexCodec extends S.Opaque<SchemaIndexCodec, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("codec"),
    name: S.String,
    decoded: S.String,
    encoded: S.String,
    summary: S.Option(S.String),
    category: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("SchemaIndexCodec", {
      description:
        "A shipped schema value: its decoded and encoded type text, the first sentence of its JSDoc and its @category.",
    })
  )
) {}

/**
 * **Example** (Describe a check entry)
 *
 * ```ts import.meta.vitest name="Describe a check entry"
 * import { SchemaIndexCheck } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * const entry = SchemaIndexCheck.make({
 *   kind: "check",
 *   name: "isMinSize",
 *   input: "{ readonly size: number }",
 *   summary: O.none(),
 *   category: O.some("validation"),
 * })
 *
 * entry.input // => "{ readonly size: number }"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIndexCheck extends S.Opaque<SchemaIndexCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("check"),
    name: S.String,
    input: S.String,
    summary: S.Option(S.String),
    category: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("SchemaIndexCheck", {
      description:
        "A shipped check constructor: the input type its check accepts, the first sentence of its JSDoc and its @category.",
    })
  )
) {}

/**
 * **Example** (Describe a combinator entry)
 *
 * ```ts
 * import { SchemaIndexCombinator } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * const entry = SchemaIndexCombinator.make({
 *   kind: "combinator",
 *   name: "OptionFromNullOr",
 *   summary: O.some("Decodes a nullable, required value `T` to a required `Option<T>` value."),
 *   category: O.some("constructors"),
 * })
 *
 * entry.kind // => "combinator"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIndexCombinator extends S.Opaque<SchemaIndexCombinator, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("combinator"),
    name: S.String,
    summary: S.Option(S.String),
    category: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("SchemaIndexCombinator", {
      description:
        "A shipped constructor or combinator whose result depends on the schema it is given, so the type checker cannot resolve one decoded type for it.",
    })
  )
) {}

/**
 * **Example** (Narrow an index entry)
 *
 * ```ts import.meta.vitest name="Narrow an index entry"
 * import { SchemaIndexCombinator, SchemaIndexEntry } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * const entry: SchemaIndexEntry = SchemaIndexCombinator.make({
 *   kind: "combinator",
 *   name: "NullOr",
 *   summary: O.none(),
 *   category: O.none(),
 * })
 *
 * SchemaIndexEntry.guards.combinator(entry) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaIndexEntry = S.Union([SchemaIndexCodec, SchemaIndexCheck, SchemaIndexCombinator]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("SchemaIndexEntry", {
    description: "One value export of the installed effect/Schema: a codec, a check or a combinator.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SchemaIndexEntry = typeof SchemaIndexEntry.Type;

/**
 * **Example** (Name the module of a getter)
 *
 * ```ts import.meta.vitest name="Name the module of a getter"
 * import { SchemaGetterModule } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * SchemaGetterModule.Enum.SchemaGetter // => "SchemaGetter"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaGetterModule = LiteralKit(["SchemaGetter", "SchemaTransformation"]).pipe(
  $I.annoteSchema("SchemaGetterModule", {
    description: "Effect module a named getter or transformation is exported from.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SchemaGetterModule = typeof SchemaGetterModule.Type;

/**
 * **Example** (Describe a named transformation)
 *
 * ```ts import.meta.vitest name="Describe a named transformation"
 * import { SchemaGetterEntry } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * const entry = SchemaGetterEntry.make({
 *   module: "SchemaTransformation",
 *   name: "trim",
 *   summary: O.some("Trims whitespace from both ends of a string."),
 *   category: O.some("transforming"),
 * })
 *
 * entry.name // => "trim"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaGetterEntry extends S.Opaque<SchemaGetterEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    module: SchemaGetterModule,
    name: S.String,
    summary: S.Option(S.String),
    category: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("SchemaGetterEntry", {
      description:
        "A named value export of effect/SchemaGetter or effect/SchemaTransformation with the first sentence of its JSDoc.",
    })
  )
) {}

/**
 * **Example** (Hold an empty index)
 *
 * ```ts import.meta.vitest name="Hold an empty index"
 * import { SchemaIndex } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as SemVer from "effect/SemVer"
 *
 * const index = SchemaIndex.make({ effectVersion: SemVer.make({ major: 4, minor: 1, patch: 5 }), entries: [], getters: [] })
 * SemVer.format(index.effectVersion) // => "4.1.5"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIndex extends S.Opaque<SchemaIndex, { readonly brand: unique symbol }>()(
  S.Struct({
    effectVersion: S.SemVer,
    entries: S.Array(SchemaIndexEntry),
    getters: S.Array(SchemaGetterEntry),
  }).pipe(
    $I.annoteSchema("SchemaIndex", {
      description:
        "Everything the installed effect/Schema, effect/SchemaGetter and effect/SchemaTransformation ship as values, sorted by name, with the effect version they came from.",
    })
  )
) {}

/**
 * **Example** (List the slice files)
 *
 * ```ts import.meta.vitest name="List the slice files"
 * import { SchemaIndexSlice } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * SchemaIndexSlice.literals.length // => 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaIndexSlice = LiteralKit([
  "wire-string",
  "wire-number",
  "wire-bigint",
  "wire-date",
  "wire-other",
  "checks-collections",
  "takes-a-schema",
  "getters",
]).pipe(
  $I.annoteSchema("SchemaIndexSlice", {
    description:
      "One generated Markdown slice of the effect/Schema index, named after the wire type or role its entries share.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SchemaIndexSlice = typeof SchemaIndexSlice.Type;

/**
 * **Example** (Pick a lookup topic)
 *
 * ```ts import.meta.vitest name="Pick a lookup topic"
 * import { SchemaIdiomsLookupTopic } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * SchemaIdiomsLookupTopic.is.collections("collections") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaIdiomsLookupTopic = LiteralKit([
  "string",
  "number",
  "bigint",
  "date",
  "other",
  "collections",
  "constructors",
  "getters",
]).pipe(
  $I.annoteSchema("SchemaIdiomsLookupTopic", {
    description:
      "Argument of `beep schema-idioms lookup`: a wire type, or the collections, constructors or getters slice.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SchemaIdiomsLookupTopic = typeof SchemaIdiomsLookupTopic.Type;

/**
 * **Example** (Describe a rendered slice)
 *
 * ```ts import.meta.vitest name="Describe a rendered slice"
 * import { SchemaIndexFile } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * const file = SchemaIndexFile.make({ file: "wire-bigint.md", entries: 1, content: "# effect/Schema: bigint on the wire\n" })
 * file.file // => "wire-bigint.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIndexFile extends S.Opaque<SchemaIndexFile, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    entries: S.Natural,
    content: S.String,
  }).pipe(
    $I.annoteSchema("SchemaIndexFile", {
      description:
        "One generated file of the schema index directory: its name, how many index lines it holds and its full text.",
    })
  )
) {}

/**
 * **Example** (Name a drift kind)
 *
 * ```ts import.meta.vitest name="Name a drift kind"
 * import { SchemaIndexDriftChange } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * SchemaIndexDriftChange.Enum.changed // => "changed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaIndexDriftChange = LiteralKit(["missing", "changed", "extra"]).pipe(
  $I.annoteSchema("SchemaIndexDriftChange", {
    description:
      "How a committed schema index file differs from the generated one: missing, changed, or extra (committed but no longer generated).",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SchemaIndexDriftChange = typeof SchemaIndexDriftChange.Type;

/**
 * **Example** (Report a changed slice)
 *
 * ```ts import.meta.vitest name="Report a changed slice"
 * import { SchemaIndexDrift } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * const drift = SchemaIndexDrift.make({ file: "wire-number.md", change: "changed" })
 * const shown = `${drift.change}: ${drift.file}`
 * shown // => "changed: wire-number.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIndexDrift extends S.Opaque<SchemaIndexDrift, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    change: SchemaIndexDriftChange,
  }).pipe(
    $I.annoteSchema("SchemaIndexDrift", {
      description:
        "One difference between the committed schema index directory and what the installed effect generates.",
    })
  )
) {}
