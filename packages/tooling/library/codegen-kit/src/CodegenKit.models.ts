/**
 * Schema-backed configuration and reports for shared code generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CodegenKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { JsonPatchDocument } from "@effect/openapi-generator/OpenApiPatch";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $CodegenKitId.create("CodegenKit.models");

/**
 * **Example** (Require an OpenAPI version pin)
 *
 * ```ts
 * import { SpecPinPolicy } from "@beep/codegen-kit"
 *
 * console.log(SpecPinPolicy.Enum["info-version"])
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SpecPinPolicy = LiteralKit(["url-embedded", "info-version"]).pipe(
  $I.annoteSchema("SpecPinPolicy", {
    description: "Policy used to verify a remote source pin before its committed cache is replaced.",
  })
);

/**
 * @see {@link SpecPinPolicy} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type SpecPinPolicy = typeof SpecPinPolicy.Type;

/**
 * Pinned local or remote source for one generator document.
 *
 * **Example** (Describe a cached release asset)
 *
 * ```ts
 * import { SpecSource } from "@beep/codegen-kit"
 *
 * const source: SpecSource = {
 *   _tag: "url",
 *   url: "https://example.com/schema.json",
 *   pin: "v1.0.0",
 *   pinPolicy: "info-version",
 *   cachePath: "spec/schema.json"
 * }
 * console.log(source._tag)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SpecSource = S.TaggedUnion({
  url: {
    url: S.NonEmptyString,
    pin: S.NonEmptyString,
    pinPolicy: SpecPinPolicy.pipe(S.optionalKey),
    cachePath: S.NonEmptyString,
  },
  file: {
    path: S.NonEmptyString,
  },
}).pipe(
  $I.annoteSchema("SpecSource", {
    description:
      "Pinned source document, with remote sources backed by a committed local cache and an optional explicit pin policy.",
  })
);

/**
 * @see {@link SpecSource} for the runtime schema and source variants.
 * @category configuration
 * @since 0.0.0
 */
export type SpecSource = typeof SpecSource.Type;

/**
 * Input dialects accepted by the generation pipeline.
 *
 * **Example** (Inspect supported dialects)
 *
 * ```ts
 * import { SpecDialect } from "@beep/codegen-kit"
 *
 * console.log(SpecDialect.is["openapi-3.1"]("openapi-3.1"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SpecDialect = LiteralKit(["json-schema-2020-12", "openapi-3.0", "openapi-3.1", "swagger-2.0"]).pipe(
  $I.annoteSchema("SpecDialect", {
    description: "Document dialect supplied to the shared code generator.",
  })
);

/**
 * @see {@link SpecDialect} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type SpecDialect = typeof SpecDialect.Type;

/**
 * Source module formats emitted by the generator.
 *
 * **Example** (Choose schema output)
 *
 * ```ts
 * import { OutputFormat } from "@beep/codegen-kit"
 *
 * console.log(OutputFormat.Enum.schemas)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OutputFormat = LiteralKit(["schemas", "httpclient", "httpapi", "type-only"]).pipe(
  $I.annoteSchema("OutputFormat", {
    description: "TypeScript module format produced by the generation pipeline.",
  })
);

/**
 * @see {@link OutputFormat} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type OutputFormat = typeof OutputFormat.Type;

/**
 * Registered JSON Schema transforms available to consumers.
 *
 * **Details**
 *
 * Every transform is opt-in and pure. `notDiscriminatorPattern` rewrites a forward-compatible
 * `not.anyOf[const]` exclusion into a negative-lookahead `pattern` on the discriminator property.
 * `unevaluatedPropertiesOpen` lowers `unevaluatedProperties: true` to `additionalProperties: true`.
 * `uniqueDiscriminatorOneOfAsAnyOf` turns a `oneOf` whose branches carry distinct string
 * discriminators into the equivalent `anyOf`. `intersectSiblingProperties` pushes a base property
 * that `anyOf` / `oneOf` branches redeclare down into every branch, intersected with each branch's
 * declaration. `distributeAllOf` merges `allOf` parts and distributes
 * object intersections over `anyOf` unions, inlining `$ref` targets after applying the other selected
 * transforms to them. A `$ref` names a definition only by its full pointer, `#/$defs/<name>` or
 * `#/components/schemas/<name>`. Unsupported shapes fail with a `CodegenTransformError`.
 *
 * **Gotchas**
 *
 * `distributeAllOf` ranks annotations by scope, not by member order alone. The node's own
 * annotations win over every member, and annotations beside a member's `$ref` override the
 * referenced definition's as that member's own. A union member's annotations (`default`,
 * `examples` and `discriminator` included) stay on the resulting `anyOf` in either member order,
 * while an object member's only add the keys the union lacks; between two objects, or two unions,
 * the later member wins. A `$ref` beside annotation-only siblings is kept rather than inlined.
 * Only a bare `allOf` wrapper is flattened into its parent; one with sibling keywords keeps
 * their annotation or constraint scope and is reduced as a member first.
 *
 * **Example** (Select the ACP transform set)
 *
 * ```ts
 * import { NamedTransform } from "@beep/codegen-kit"
 *
 * console.log(NamedTransform.is.flattenAllOfRefVariants("flattenAllOfRefVariants"))
 * console.log(NamedTransform.is.distributeAllOf("distributeAllOf"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const NamedTransform = LiteralKit([
  "nullableTypeArray",
  "flattenAllOfRefVariants",
  "distributeUnionSiblings",
  "openObjects",
  "stripExamples",
  "notDiscriminatorPattern",
  "unevaluatedPropertiesOpen",
  "uniqueDiscriminatorOneOfAsAnyOf",
  "intersectSiblingProperties",
  "distributeAllOf",
]).pipe(
  $I.annoteSchema("NamedTransform", {
    description: "Opt-in JSON Schema transforms composed into the generator onEnter hook.",
  })
);

/**
 * @see {@link NamedTransform} for the registered transform names.
 * @category configuration
 * @since 0.0.0
 */
export type NamedTransform = typeof NamedTransform.Type;

/**
 * Number schema policy applied during TypeScript post-processing.
 *
 * **Example** (Inspect the safe default)
 *
 * ```ts
 * import { NumberPolicy } from "@beep/codegen-kit"
 *
 * console.log(NumberPolicy.Enum.finite)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const NumberPolicy = LiteralKit(["finite", "number"]).pipe(
  $I.annoteSchema("NumberPolicy", {
    description: "Policy deciding whether generated JSON numbers use S.Finite or S.Number.",
  })
);

/**
 * @see {@link NumberPolicy} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type NumberPolicy = typeof NumberPolicy.Type;

/**
 * **Example** (Choose class models)
 *
 * ```ts
 * import { SchemaStyle } from "@beep/codegen-kit"
 *
 * console.log(SchemaStyle.Enum.class)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SchemaStyle = LiteralKit(["struct", "class"]).pipe(
  $I.annoteSchema("SchemaStyle", {
    description: "Rendering style for generated object schemas.",
  })
);

/**
 * @see {@link SchemaStyle} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type SchemaStyle = typeof SchemaStyle.Type;

/**
 * Policies for non-fatal warnings reported by the upstream generator.
 *
 * **Example** (Inspect the strict policy)
 *
 * ```ts
 * import { WarningPolicy } from "@beep/codegen-kit"
 *
 * console.log(WarningPolicy.Enum.fail)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const WarningPolicy = LiteralKit(["fail", "log"]).pipe(
  $I.annoteSchema("WarningPolicy", {
    description: "Policy deciding whether OpenAPI generator warnings fail or are logged.",
  })
);

/**
 * @see {@link WarningPolicy} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type WarningPolicy = typeof WarningPolicy.Type;

/**
 * **Example** (Name the identity composer for generated schemas)
 *
 * ```ts
 * import { GenerateIdentity } from "@beep/codegen-kit/CodegenKit.models"
 *
 * const identity = GenerateIdentity.make({ composer: "$RunpodId", moduleId: "_generated/Runpod.models.gen" })
 *
 * console.log(`${identity.composer}.create("${identity.moduleId}")`) // => "$RunpodId.create(\"_generated/Runpod.models.gen\")"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GenerateIdentity extends S.Opaque<GenerateIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    composer: S.NonEmptyString,
    moduleId: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("GenerateIdentity", {
      description: "Identity composer symbol and module segment emitted into generated schemas.",
    })
  )
) {}

/**
 * **Example** (Drop an internal path before generation)
 *
 * ```ts
 * import { GeneratePatch } from "@beep/codegen-kit/CodegenKit.models"
 *
 * const patch = GeneratePatch.make({
 *   source: "spec/patches/remove-internal.json",
 *   patch: [{ op: "remove", path: "/paths/~1internal~1health" }]
 * })
 *
 * console.log(patch.patch.length) // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GeneratePatch extends S.Opaque<GeneratePatch, { readonly brand: unique symbol }>()(
  S.Struct({
    source: S.NonEmptyString,
    patch: JsonPatchDocument,
  }).pipe(
    $I.annoteSchema("GeneratePatch", {
      description: "Named RFC 6902 patch document applied before generation.",
    })
  )
) {}

/**
 * **Details**
 *
 * `exampleImport` replaces the module specifier used by generated `**Example**` blocks in every output
 * format. When omitted, struct-style schemas import from `<packageName>/schema`, and class-style schemas
 * and the exports of `httpclient`, `httpapi` and `type-only` modules import from `<packageName>`.
 *
 * **Example** (Prefix the generated module with a do-not-edit banner)
 *
 * ```ts
 * import { GenerateOutput } from "@beep/codegen-kit/CodegenKit.models"
 *
 * const output = GenerateOutput.make({
 *   path: "src/_generated/Runpod.models.gen.ts",
 *   header: "// Generated by @beep/codegen-kit. Do not edit."
 * })
 *
 * console.log(output.path.endsWith(".gen.ts")) // => true
 * ```
 *
 * **Example** (Point generated examples at a secondary schema subpath)
 *
 * ```ts
 * import { GenerateOutput } from "@beep/codegen-kit/CodegenKit.models"
 *
 * const output = GenerateOutput.make({
 *   path: "src/_generated/schema-v1.gen.ts",
 *   exampleImport: "@beep/acp/schema-v1"
 * })
 *
 * console.log(output.exampleImport) // => "@beep/acp/schema-v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GenerateOutput extends S.Opaque<GenerateOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    header: S.optionalKey(S.String),
    exampleImport: S.optionalKey(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("GenerateOutput", {
      description:
        "Primary generated module path, optional package-specific header, and optional module specifier for generated Example imports.",
    })
  )
) {}

/**
 * **Example** (Register an operations module beside the models)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { ExtraModule, GenerateConfig, GenerateIdentity, GenerateOutput } from "@beep/codegen-kit/CodegenKit.models"
 *
 * const config = GenerateConfig.make({
 *   packageName: "@beep/runpod",
 *   identity: GenerateIdentity.make({ composer: "$RunpodId", moduleId: "_generated/Runpod.models.gen" }),
 *   source: { _tag: "file", path: "spec/openapi.json" },
 *   dialect: "openapi-3.1",
 *   format: "schemas",
 *   output: GenerateOutput.make({ path: "src/_generated/Runpod.models.gen.ts" }),
 *   extraModules: [ExtraModule.make({ renderer: "operations", path: "src/_generated/Runpod.operations.gen.ts" })]
 * })
 *
 * console.log(A.map(config.extraModules, (module) => module.renderer)) // => ["operations"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtraModule extends S.Opaque<ExtraModule, { readonly brand: unique symbol }>()(
  S.Struct({
    renderer: S.NonEmptyString,
    path: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ExtraModule", {
      description: "Registered renderer name and destination for a package-specific generated module.",
    })
  )
) {}

const emptyPatches = Effect.succeed(A.empty<GeneratePatch>());
const emptyTransforms = Effect.succeed(A.empty<NamedTransform>());
const emptyModules = Effect.succeed(A.empty<ExtraModule>());
const defaultSchemaStyle = Effect.succeed(SchemaStyle.Enum.struct);
const defaultWarningPolicy = Effect.succeed(WarningPolicy.Enum.fail);

/**
 * Complete configuration for one deterministic code-generation pipeline.
 *
 * **Example** (Configure a local schema run)
 *
 * ```ts
 * import { GenerateConfig, GenerateIdentity, GenerateOutput } from "@beep/codegen-kit"
 *
 * const config = GenerateConfig.make({
 *   packageName: "@beep/example",
 *   identity: GenerateIdentity.make({ composer: "$ExampleId", moduleId: "_generated/schema.gen" }),
 *   source: { _tag: "file", path: "spec/schema.json" },
 *   dialect: "json-schema-2020-12",
 *   format: "schemas",
 *   output: GenerateOutput.make({ path: "src/_generated/schema.gen.ts" })
 * })
 * console.log(config.numberPolicy)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class GenerateConfig extends S.Opaque<GenerateConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    packageName: S.NonEmptyString,
    name: S.optionalKey(S.NonEmptyString),
    identity: GenerateIdentity,
    source: SpecSource,
    dialect: SpecDialect,
    patches: S.Array(GeneratePatch).pipe(
      S.withConstructorDefault(emptyPatches),
      S.withDecodingDefaultKey(emptyPatches)
    ),
    transforms: S.Array(NamedTransform).pipe(
      S.withConstructorDefault(emptyTransforms),
      S.withDecodingDefaultKey(emptyTransforms)
    ),
    format: OutputFormat,
    roots: S.Array(S.NonEmptyString).pipe(S.optionalKey),
    numberPolicy: NumberPolicy.pipe(
      S.withConstructorDefault(Effect.succeed(NumberPolicy.Enum.finite)),
      S.withDecodingDefaultKey(Effect.succeed(NumberPolicy.Enum.finite))
    ),
    schemaStyle: SchemaStyle.pipe(
      S.withConstructorDefault(defaultSchemaStyle),
      S.withDecodingDefaultKey(defaultSchemaStyle)
    ),
    onWarning: WarningPolicy.pipe(
      S.withConstructorDefault(defaultWarningPolicy),
      S.withDecodingDefaultKey(defaultWarningPolicy)
    ),
    output: GenerateOutput,
    extraModules: S.Array(ExtraModule).pipe(
      S.withConstructorDefault(emptyModules),
      S.withDecodingDefaultKey(emptyModules)
    ),
  }).pipe(
    $I.annoteSchema("GenerateConfig", {
      description: "Deterministic fetch, patch, generate, post-process, format, and output configuration.",
    })
  )
) {}

/**
 * Formatted source content destined for one generated path.
 *
 * **Example** (Create an in-memory module)
 *
 * ```ts
 * import { GeneratedModule } from "@beep/codegen-kit"
 *
 * const module = GeneratedModule.make({ path: "schema.gen.ts", content: "export {}\n" })
 * console.log(module.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GeneratedModule extends S.Opaque<GeneratedModule, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    content: S.String,
  }).pipe(
    $I.annoteSchema("GeneratedModule", {
      description: "Formatted generated source content paired with its destination path.",
    })
  )
) {}

/**
 * **Example** (Inspect a changed status)
 *
 * ```ts
 * import { DriftStatus } from "@beep/codegen-kit"
 *
 * console.log(DriftStatus.is.changed("changed"))
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const DriftStatus = LiteralKit(["clean", "changed", "missing"]).pipe(
  $I.annoteSchema("DriftStatus", {
    description: "Comparison result for a generated destination.",
  })
);

/**
 * @see {@link DriftStatus} for the supported values.
 * @category diagnostics
 * @since 0.0.0
 */
export type DriftStatus = typeof DriftStatus.Type;

/**
 * Deterministic comparison result for one generated module.
 *
 * **Example** (Create a clean report)
 *
 * ```ts
 * import { DriftReport } from "@beep/codegen-kit"
 *
 * const report = DriftReport.make({ path: "schema.gen.ts", status: "clean", diffLines: 0 })
 * console.log(report.status)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class DriftReport extends S.Opaque<DriftReport, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    status: DriftStatus,
    diffLines: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  }).pipe(
    $I.annoteSchema("DriftReport", {
      description: "Generated-module drift status and changed-line count.",
    })
  )
) {}
