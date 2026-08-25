/**
 * Effect service implementing the shared code-generation pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CodegenKitId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { make as makeJsonSchemaGenerator } from "@effect/openapi-generator/JsonSchemaGenerator";
import * as OpenApiGenerator from "@effect/openapi-generator/OpenApiGenerator";
import * as OpenApiPatch from "@effect/openapi-generator/OpenApiPatch";
import { Context, Effect, Layer, Match, pipe } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import {
  CodegenDriftError,
  CodegenFetchError,
  CodegenGenerateError,
  CodegenPatchError,
  CodegenPostProcessError,
} from "./CodegenKit.errors.ts";
import { DriftReport, GeneratedModule, SpecSource } from "./CodegenKit.models.ts";
import { makeFormatter } from "./internal/format.ts";
import { postProcess as postProcessSource } from "./internal/postProcess.ts";
import { composeTransforms } from "./internal/transforms.ts";
import type * as JsonSchema from "effect/JsonSchema";
import type { OpenAPISpec } from "effect/unstable/httpapi/OpenApi";
import type * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import type { CodegenFormatError } from "./CodegenKit.errors.ts";
import type { GenerateConfig } from "./CodegenKit.models.ts";

const $I = $CodegenKitId.create("CodegenKit.service");

const JsonSchemaNode = S.Record(S.String, S.Json).pipe(
  $I.annoteSchema("JsonSchemaNode", {
    description: "Open JSON object accepted as one JSON Schema node by the upstream generator.",
  })
);
const JsonSchemaDefinitions = S.Record(S.String, JsonSchemaNode).pipe(
  $I.annoteSchema("JsonSchemaDefinitions", {
    description: "Named JSON Schema definitions extracted from a source document.",
  })
);

class OpenApiComponents extends S.Class<OpenApiComponents>($I`OpenApiComponents`)(
  { schemas: S.optionalKey(JsonSchemaDefinitions) },
  $I.annote("OpenApiComponents", {
    description: "OpenAPI components subset used to locate shared schemas.",
  })
) {}

class DefinitionDocument extends S.Class<DefinitionDocument>($I`DefinitionDocument`)(
  {
    $defs: S.optionalKey(JsonSchemaDefinitions),
    definitions: S.optionalKey(JsonSchemaDefinitions),
    components: S.optionalKey(OpenApiComponents),
  },
  $I.annote("DefinitionDocument", {
    description: "Supported definition containers across JSON Schema, OpenAPI, and Swagger documents.",
  })
) {}

const OpenApiDocument = S.declare<OpenAPISpec>((input): input is OpenAPISpec => P.isObject(input), {
  identifier: $I`OpenApiDocument`,
  title: "OpenAPI generator document",
  description: "Open object passed to the upstream OpenAPI and Swagger parser.",
});

const decodeJsonText = S.decodeUnknownEffect(S.fromJsonString(S.Json));
const encodePrettyJson = S.encodeUnknownEffect(S.fromJsonString(S.Json, { space: 2 }));
const decodeDefinitionDocument = S.decodeUnknownEffect(DefinitionDocument);
const decodeOpenApiDocument = S.decodeUnknownEffect(OpenApiDocument);

const fetchError = (message: string, cause: unknown): CodegenFetchError => CodegenFetchError.make({ message, cause });
const generateError = (message: string, cause: unknown): CodegenGenerateError =>
  CodegenGenerateError.make({ message, cause });
const postProcessError = (message: string, cause: unknown): CodegenPostProcessError =>
  CodegenPostProcessError.make({ message, cause });

/**
 * Callback that renders a package-specific extra module.
 *
 * @category models
 * @since 0.0.0
 */
export type ExtraRenderer = (
  config: GenerateConfig,
  refresh: boolean,
  fetch: (source: SpecSource, refresh?: boolean) => Effect.Effect<S.Json, CodegenFetchError>
) => Effect.Effect<string, CodegenFetchError | CodegenPostProcessError>;

/**
 * Registry of package-specific extra-module renderers keyed by config name.
 *
 * @category models
 * @since 0.0.0
 */
export type ExtraRendererRegistry = Readonly<Record<string, ExtraRenderer>>;

/**
 * Failure union for a composed generation run.
 *
 * @category errors
 * @since 0.0.0
 */
export type CodegenRunError =
  | CodegenFetchError
  | CodegenPatchError
  | CodegenGenerateError
  | CodegenPostProcessError
  | CodegenFormatError
  | CodegenDriftError;

const sourcePath = SpecSource.match({
  file: ({ path }) => path,
  url: ({ cachePath }) => cachePath,
});

const sourceUrl = SpecSource.match({
  file: () => O.none<string>(),
  url: ({ url }) => O.some(url),
});

const definitionContainer = Match.type<GenerateConfig["dialect"]>().pipe(
  Match.when("json-schema-2020-12", (dialect) => dialect),
  Match.when("swagger-2.0", (dialect) => dialect),
  Match.orElse(() => "openapi")
);

const definitionsFor = Effect.fn("CodegenKit.definitionsFor")(function* (document: S.Json, config: GenerateConfig) {
  const decoded = yield* decodeDefinitionDocument(document).pipe(
    Effect.mapError((cause) => generateError("Could not decode the document definition containers", cause))
  );
  const container = definitionContainer(config.dialect);
  return Match.value(container).pipe(
    Match.when("json-schema-2020-12", () => decoded.$defs ?? {}),
    Match.when("swagger-2.0", () => decoded.definitions ?? {}),
    Match.orElse(() => decoded.components?.schemas ?? {})
  );
});

const selectedEntries = (
  definitions: JsonSchema.Definitions,
  roots: ReadonlyArray<string> | undefined
): ReadonlyArray<readonly [string, JsonSchema.JsonSchema]> => {
  const selected =
    roots === undefined
      ? R.toEntries(definitions)
      : A.flatMap(roots, (root) =>
          pipe(
            R.get(definitions, root),
            O.map((node) => [[root, node] as const]),
            O.getOrElse(A.empty<readonly [string, JsonSchema.JsonSchema]>)
          )
        );
  return A.sort(
    selected,
    Order.mapInput(Order.String, (entry: readonly [string, JsonSchema.JsonSchema]) => entry[0])
  );
};

const schemaGeneratorSource = (config: GenerateConfig): "openapi-3.0" | "openapi-3.1" =>
  config.dialect === "openapi-3.0" ? "openapi-3.0" : "openapi-3.1";

const generatorFormat = Match.type<GenerateConfig["format"]>().pipe(
  Match.when("httpclient", () => "httpclient" as const),
  Match.when("httpapi", () => "httpapi" as const),
  Match.when("type-only", () => "httpclient-type-only" as const),
  Match.orElse(() => "httpclient" as const)
);

const lineDifferenceCount = (left: string, right: string): number => {
  const leftLines = Str.split("\n")(left);
  const rightLines = Str.split("\n")(right);
  const sharedDifferences = pipe(
    A.zip(leftLines, rightLines),
    A.filter(([a, b]) => !Str.Equivalence(a, b)),
    A.length
  );
  const sizeDifference = A.length(leftLines) - A.length(rightLines);
  return sharedDifferences + (sizeDifference < 0 ? N.multiply(sizeDifference, -1) : sizeDifference);
};

const hasDrift = (report: DriftReport): boolean => report.status !== "clean";

const makeService = Effect.fn("CodegenKit.make")(function* (extraRenderers: ExtraRendererRegistry) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const httpClient = yield* HttpClient.HttpClient;
  const formatter = yield* makeFormatter();
  const openApiGenerator = yield* OpenApiGenerator.make;

  const readJson = Effect.fn("CodegenKit.readJson")(function* (filePath: string) {
    const content = yield* fs
      .readFileString(filePath)
      .pipe(Effect.mapError((cause) => fetchError(`Could not read cached source ${filePath}`, cause)));
    return yield* decodeJsonText(content).pipe(
      Effect.mapError((cause) => fetchError(`Cached source ${filePath} is not valid JSON`, cause))
    );
  });

  const refreshJson = Effect.fn("CodegenKit.refreshJson")(function* (source: SpecSource) {
    const maybeUrl = sourceUrl(source);
    if (O.isNone(maybeUrl)) {
      return yield* fetchError("Only URL sources can be refreshed", new globalThis.Error("file source"));
    }
    const url = maybeUrl.value;
    const cachePath = sourcePath(source);
    const response = yield* httpClient.get(url).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.mapError((cause) => fetchError(`Could not refresh ${url}`, cause))
    );
    const content = yield* response.text.pipe(
      Effect.mapError((cause) => fetchError(`Could not read refreshed response from ${url}`, cause))
    );
    const document = yield* decodeJsonText(content).pipe(
      Effect.mapError((cause) => fetchError(`Refreshed source ${url} is not valid JSON`, cause))
    );
    const pretty = yield* encodePrettyJson(document).pipe(
      Effect.mapError((cause) => fetchError(`Could not normalize refreshed source ${url}`, cause))
    );
    yield* fs
      .makeDirectory(path.dirname(cachePath), { recursive: true })
      .pipe(Effect.mapError((cause) => fetchError(`Could not create cache directory for ${cachePath}`, cause)));
    yield* fs
      .writeFileString(cachePath, `${pretty}\n`)
      .pipe(Effect.mapError((cause) => fetchError(`Could not write refreshed cache ${cachePath}`, cause)));
    yield* formatter
      .file(cachePath)
      .pipe(Effect.mapError((cause) => fetchError(`Could not format refreshed cache ${cachePath}`, cause)));
    return yield* readJson(cachePath);
  });

  const fetch = Effect.fn("CodegenKit.fetch")(function* (source: SpecSource, refresh?: boolean) {
    return refresh === true ? yield* refreshJson(source) : yield* readJson(sourcePath(source));
  });

  const patch = Effect.fn("CodegenKit.patch")(function* (document: S.Json, patches: GenerateConfig["patches"]) {
    return yield* OpenApiPatch.applyPatches(patches, document).pipe(
      Effect.mapError((cause) => CodegenPatchError.make({ message: "Could not apply configured JSON patches", cause }))
    );
  });

  const generate = Effect.fn("CodegenKit.generate")(function* (document: S.Json, config: GenerateConfig) {
    if (config.format === "schemas") {
      const definitions = yield* definitionsFor(document, config);
      return yield* Effect.try({
        try: () => {
          const generator = makeJsonSchemaGenerator();
          for (const [name, schema] of selectedEntries(definitions, config.roots)) generator.addSchema(name, schema);
          return generator.generate(schemaGeneratorSource(config), definitions, false, {
            onEnter: composeTransforms(config.transforms, definitions),
          });
        },
        catch: (cause) => generateError(`Could not generate schemas for ${config.packageName}`, cause),
      });
    }
    const spec = yield* decodeOpenApiDocument(document).pipe(
      Effect.mapError((cause) => generateError(`Could not decode OpenAPI document for ${config.packageName}`, cause))
    );
    return yield* openApiGenerator.generate(spec, {
      name: packageLabel(config.packageName),
      format: generatorFormat(config.format),
      onEnter: composeTransforms(config.transforms, yield* definitionsFor(document, config)),
    });
  });

  const postProcess = Effect.fn("CodegenKit.postProcess")(function* (source: string, config: GenerateConfig) {
    return yield* Effect.try({
      try: () => postProcessSource(source, config),
      catch: (cause) => postProcessError(`Could not post-process output for ${config.packageName}`, cause),
    });
  });

  const format = Effect.fn("CodegenKit.format")(function* (module: GeneratedModule) {
    const content = yield* formatter.content(module.content, module.path);
    return GeneratedModule.make({ path: module.path, content });
  });

  const write = Effect.fn("CodegenKit.write")(function* (module: GeneratedModule) {
    yield* fs
      .makeDirectory(path.dirname(module.path), { recursive: true })
      .pipe(Effect.mapError((cause) => fetchError(`Could not create output directory for ${module.path}`, cause)));
    yield* fs
      .writeFileString(module.path, module.content)
      .pipe(Effect.mapError((cause) => fetchError(`Could not write generated module ${module.path}`, cause)));
  });

  const drift = Effect.fn("CodegenKit.drift")(function* (module: GeneratedModule) {
    const exists = yield* fs
      .exists(module.path)
      .pipe(Effect.mapError((cause) => fetchError(`Could not inspect generated module ${module.path}`, cause)));
    if (!exists)
      return DriftReport.make({
        path: module.path,
        status: "missing",
        diffLines: A.length(Str.split("\n")(module.content)),
      });
    const current = yield* fs
      .readFileString(module.path)
      .pipe(Effect.mapError((cause) => fetchError(`Could not read generated module ${module.path}`, cause)));
    const diffLines = lineDifferenceCount(current, module.content);
    return DriftReport.make({ path: module.path, status: diffLines === 0 ? "clean" : "changed", diffLines });
  });

  const renderExtras = Effect.fn("CodegenKit.renderExtras")(function* (config: GenerateConfig, refresh: boolean) {
    return yield* Effect.forEach(
      config.extraModules,
      Effect.fnUntraced(function* (extra) {
        const maybeRenderer = R.get(extraRenderers, extra.renderer);
        if (O.isNone(maybeRenderer)) {
          return yield* postProcessError(
            `No extra renderer registered as ${extra.renderer}`,
            new globalThis.Error("missing renderer")
          );
        }
        const renderer = maybeRenderer.value;
        const content = yield* renderer(config, refresh, fetch);
        return yield* format(GeneratedModule.make({ path: extra.path, content }));
      }),
      { concurrency: 1 }
    );
  });

  const run = Effect.fn("CodegenKit.run")(function* (config: GenerateConfig, mode: "write" | "check", refresh = false) {
    const document = yield* fetch(config.source, refresh);
    const patched = yield* patch(document, config.patches);
    const raw = yield* generate(patched, config);
    const processed = yield* postProcess(raw, config);
    const main = yield* format(GeneratedModule.make({ path: config.output.path, content: processed }));
    const modules = A.prepend(yield* renderExtras(config, refresh), main);
    if (mode === "write") {
      yield* Effect.forEach(modules, write, { concurrency: 1, discard: true });
      return A.empty<DriftReport>();
    }
    const reports = yield* Effect.forEach(modules, drift, { concurrency: 1 });
    if (A.some(reports, hasDrift)) {
      return yield* CodegenDriftError.make({ message: "Generated output drift detected", reports });
    }
    return reports;
  });

  return { fetch, patch, generate, postProcess, format, write, drift, run } as const;
});

const packageLabel = (packageName: string): string =>
  pipe(
    packageName,
    Str.split("/"),
    A.last,
    O.getOrElse(() => packageName),
    Str.toUpperCase
  );

/**
 * Shared code-generation service from pinned source through drift detection.
 *
 * **Example** (Access the service)
 *
 * ```ts
 * import { CodegenKit } from "@beep/codegen-kit"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const kit = yield* CodegenKit
 *   return kit
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CodegenKit extends Context.Service<CodegenKit, Effect.Success<ReturnType<typeof makeService>>>()(
  $CodegenKitId`CodegenKit`
) {
  /**
   * Builds the kit with optional package-specific extra-module renderers.
   *
   * **Example** (Build the default layer)
   *
   * ```ts
   * import { CodegenKit } from "@beep/codegen-kit"
   *
   * console.log(CodegenKit.layer())
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    extraRenderers: ExtraRendererRegistry = {}
  ): Layer.Layer<
    CodegenKit,
    never,
    FileSystem.FileSystem | Path.Path | HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner
  > => Layer.effect(CodegenKit, makeService(extraRenderers));
}
