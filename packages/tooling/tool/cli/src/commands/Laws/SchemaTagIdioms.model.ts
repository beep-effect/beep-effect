/**
 * Schemas for the schema tag idiom law.
 *
 * **Details**
 *
 * The scanner in `SchemaTagIdioms.ts` reports the non-idiomatic Effect v4 tag
 * forms that PR #1943 migrated away from: a struct or class that spells its
 * fixed `_tag` by hand, and a required field fixed to one `S.Literal`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/SchemaTagIdioms.model");

/**
 * Rule that detected a non-idiomatic schema tag form.
 *
 * **Details**
 *
 * `struct-tag` matches `S.Struct({ _tag: <fixed tag>, ... })`, which must be
 * `S.TaggedStruct`. `class-tag` matches `S.Class` or `S.Error` whose fields
 * (inline or through `S.Struct`) fix `_tag`, which must be `S.TaggedClass` or
 * `S.TaggedError`. `single-literal-field` matches a required schema field
 * fixed to one `S.Literal(v)`, inline or through a private const used only as
 * field values, which must be `S.tag(v)`. `unreadable-markdown` marks a
 * Markdown file or JSDoc block that may bind `effect/Schema` but whose fences
 * the CommonMark parser refused (a nesting or inline guard tripped), so the
 * law could not check them.
 *
 * **Example** (Identify a struct-tag finding)
 *
 * ```ts
 * import { SchemaTagIdiomRule } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms.model"
 *
 * console.log(SchemaTagIdiomRule.is["struct-tag"]("struct-tag")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaTagIdiomRule = LiteralKit([
  "struct-tag",
  "class-tag",
  "single-literal-field",
  "unreadable-markdown",
]).pipe(
  $I.annoteSchema("SchemaTagIdiomRule", {
    description:
      "Rule that detected a non-idiomatic Effect v4 schema tag form, or a text whose fences could not be read.",
  })
);

/**
 * Type-level member of {@link SchemaTagIdiomRule}.
 *
 * @category models
 * @since 0.0.0
 */
export type SchemaTagIdiomRule = typeof SchemaTagIdiomRule.Type;

/**
 * One non-idiomatic schema tag form found in a repository file.
 *
 * **Example** (Describe a single-literal field finding)
 *
 * ```ts
 * import { SchemaTagIdiomFinding } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms.model"
 *
 * const finding = SchemaTagIdiomFinding.make({
 *   file: "packages/demo/src/Demo.ts",
 *   line: 4,
 *   column: 9,
 *   rule: "single-literal-field",
 *   match: 'kind: S.Literal("demo")',
 *   suggestion: 'kind: S.tag("demo")',
 * })
 *
 * console.log(finding.suggestion) // 'kind: S.tag("demo")'
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaTagIdiomFinding extends S.Opaque<SchemaTagIdiomFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    line: S.Int,
    column: S.Int,
    rule: SchemaTagIdiomRule,
    match: S.String,
    suggestion: S.String,
  }).pipe(
    $I.annoteSchema("SchemaTagIdiomFinding", {
      description:
        "One non-idiomatic Effect v4 schema tag form found in a repository file, with its 1-based position and the idiomatic replacement.",
    })
  )
) {}

/**
 * Runtime options for the schema tag idiom law.
 *
 * **Example** (Configure a strict scan)
 *
 * ```ts
 * import { SchemaTagIdiomsOptions } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms.model"
 *
 * const options = SchemaTagIdiomsOptions.make({ cwd: process.cwd(), strictCheck: true })
 *
 * console.log(options.strictCheck) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaTagIdiomsOptions extends S.Opaque<SchemaTagIdiomsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String,
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("SchemaTagIdiomsOptions", {
      description: "Runtime options for the schema tag idiom law.",
    })
  )
) {}

/**
 * Result of one schema tag idiom law run.
 *
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { SchemaTagIdiomsSummary } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms.model"
 *
 * const summary = SchemaTagIdiomsSummary.make({
 *   scannedFiles: 10,
 *   scannedFences: 3,
 *   strictFailure: false,
 * })
 *
 * console.log(summary.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaTagIdiomsSummary extends S.Opaque<SchemaTagIdiomsSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    scannedFiles: S.Int,
    scannedFences: S.Int,
    strictFailure: S.Boolean,
    findings: ArrayKeyDefaultEmpty(SchemaTagIdiomFinding),
  }).pipe(
    $I.annoteSchema("SchemaTagIdiomsSummary", {
      description:
        "Result of one schema tag idiom law run over the git-tracked TypeScript and Markdown files; scannedFences counts the TypeScript fences that import Effect Schema.",
    })
  )
) {}
