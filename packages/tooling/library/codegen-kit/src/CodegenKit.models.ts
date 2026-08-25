/**
 * Schema-backed configuration and reports for shared code generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CodegenKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { JsonPatchDocument } from "@effect/openapi-generator/OpenApiPatch";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $CodegenKitId.create("CodegenKit.models");

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
    cachePath: S.NonEmptyString,
  },
  file: {
    path: S.NonEmptyString,
  },
}).pipe(
  $I.annoteSchema("SpecSource", {
    description: "Pinned source document, with remote sources backed by a committed local cache.",
  })
);

/**
 * Runtime source configuration represented by {@link SpecSource}.
 *
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
export const SpecDialect = LiteralKit(["json-schema-2020-12", "openapi-3.0", "openapi-3.1", "swagger-2.0"]).annotate(
  $I.annote("SpecDialect", {
    description: "Document dialect supplied to the shared code generator.",
  })
);

/**
 * Runtime dialect represented by {@link SpecDialect}.
 *
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
export const OutputFormat = LiteralKit(["schemas", "httpclient", "httpapi", "type-only"]).annotate(
  $I.annote("OutputFormat", {
    description: "TypeScript module format produced by the generation pipeline.",
  })
);

/**
 * Runtime output format represented by {@link OutputFormat}.
 *
 * @see {@link OutputFormat} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type OutputFormat = typeof OutputFormat.Type;

/**
 * Registered JSON Schema transforms available to consumers.
 *
 * **Example** (Select the ACP transform set)
 *
 * ```ts
 * import { NamedTransform } from "@beep/codegen-kit"
 *
 * console.log(NamedTransform.is.flattenAllOfRefVariants("flattenAllOfRefVariants"))
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
]).annotate(
  $I.annote("NamedTransform", {
    description: "Opt-in JSON Schema transforms composed into the generator onEnter hook.",
  })
);

/**
 * Runtime transform name represented by {@link NamedTransform}.
 *
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
export const NumberPolicy = LiteralKit(["finite", "number"]).annotate(
  $I.annote("NumberPolicy", {
    description: "Policy deciding whether generated JSON numbers use S.Finite or S.Number.",
  })
);

/**
 * Runtime number policy represented by {@link NumberPolicy}.
 *
 * @see {@link NumberPolicy} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type NumberPolicy = typeof NumberPolicy.Type;

/**
 * Rendering styles for generated object schemas.
 *
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
export const SchemaStyle = LiteralKit(["struct", "class"]).annotate(
  $I.annote("SchemaStyle", {
    description: "Rendering style for generated object schemas.",
  })
);

/**
 * Runtime schema rendering style represented by {@link SchemaStyle}.
 *
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
export const WarningPolicy = LiteralKit(["fail", "log"]).annotate(
  $I.annote("WarningPolicy", {
    description: "Policy deciding whether OpenAPI generator warnings fail or are logged.",
  })
);

/**
 * Runtime warning policy represented by {@link WarningPolicy}.
 *
 * @see {@link WarningPolicy} for the supported values.
 * @category configuration
 * @since 0.0.0
 */
export type WarningPolicy = typeof WarningPolicy.Type;

class GenerateIdentity extends S.Class<GenerateIdentity>($I`GenerateIdentity`)(
  {
    composer: S.NonEmptyString,
    moduleId: S.NonEmptyString,
  },
  $I.annote("GenerateIdentity", {
    description: "Identity composer symbol and module segment emitted into generated schemas.",
  })
) {}

class GeneratePatch extends S.Class<GeneratePatch>($I`GeneratePatch`)(
  {
    source: S.NonEmptyString,
    patch: JsonPatchDocument,
  },
  $I.annote("GeneratePatch", {
    description: "Named RFC 6902 patch document applied before generation.",
  })
) {}

class GenerateOutput extends S.Class<GenerateOutput>($I`GenerateOutput`)(
  {
    path: S.NonEmptyString,
    header: S.optionalKey(S.String),
  },
  $I.annote("GenerateOutput", {
    description: "Primary generated module path and optional package-specific header.",
  })
) {}

class ExtraModule extends S.Class<ExtraModule>($I`ExtraModule`)(
  {
    renderer: S.NonEmptyString,
    path: S.NonEmptyString,
  },
  $I.annote("ExtraModule", {
    description: "Registered renderer name and destination for a package-specific generated module.",
  })
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
 * import { GenerateConfig } from "@beep/codegen-kit"
 *
 * const config = GenerateConfig.make({
 *   packageName: "@beep/example",
 *   identity: { composer: "$ExampleId", moduleId: "_generated/schema.gen" },
 *   source: { _tag: "file", path: "spec/schema.json" },
 *   dialect: "json-schema-2020-12",
 *   format: "schemas",
 *   output: { path: "src/_generated/schema.gen.ts" }
 * })
 * console.log(config.numberPolicy)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class GenerateConfig extends S.Class<GenerateConfig>($I`GenerateConfig`)(
  {
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
  },
  $I.annote("GenerateConfig", {
    description: "Deterministic fetch, patch, generate, post-process, format, and output configuration.",
  })
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
export class GeneratedModule extends S.Class<GeneratedModule>($I`GeneratedModule`)(
  {
    path: S.NonEmptyString,
    content: S.String,
  },
  $I.annote("GeneratedModule", {
    description: "Formatted generated source content paired with its destination path.",
  })
) {}

/**
 * Drift status for one generated destination.
 *
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
export const DriftStatus = LiteralKit(["clean", "changed", "missing"]).annotate(
  $I.annote("DriftStatus", {
    description: "Comparison result for a generated destination.",
  })
);

/**
 * Runtime drift status represented by {@link DriftStatus}.
 *
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
export class DriftReport extends S.Class<DriftReport>($I`DriftReport`)(
  {
    path: S.NonEmptyString,
    status: DriftStatus,
    diffLines: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("DriftReport", {
    description: "Generated-module drift status and changed-line count.",
  })
) {}
