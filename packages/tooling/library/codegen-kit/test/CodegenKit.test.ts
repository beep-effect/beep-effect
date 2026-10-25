import {
  CodegenKit,
  CodegenTransformError,
  composeTransforms,
  GenerateConfig,
  GeneratedModule,
} from "@beep/codegen-kit";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import type { NamedTransform, SpecSource } from "@beep/codegen-kit";
import type * as JsonSchema from "effect/JsonSchema";

const platform = Layer.merge(NodeServices.layer, FetchHttpClient.layer);
const CodegenKitTestLayer = Layer.mergeAll(
  platform,
  TestConsole.layer,
  CodegenKit.layer().pipe(Layer.provide(platform))
);

const config = (outputPath: string) =>
  GenerateConfig.make({
    packageName: "@beep/codegen-kit-fixture",
    identity: { composer: "$CodegenKitId", moduleId: "fixture/schema.gen" },
    source: { _tag: "file", path: "fixture.json" },
    dialect: "json-schema-2020-12",
    transforms: ["nullableTypeArray", "flattenAllOfRefVariants", "distributeUnionSiblings"],
    format: "schemas",
    output: { path: outputPath },
  });

const acpRegressionFixture: S.Json = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $defs: {
    TextContent: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    ContentBlock: {
      oneOf: [
        {
          allOf: [{ $ref: "#/$defs/TextContent" }],
          type: "object",
          properties: { type: { const: "text", type: "string" } },
          required: ["type"],
        },
        {
          type: "object",
          properties: { type: { const: "image", type: "string" }, data: { type: "string" } },
          required: ["type", "data"],
        },
      ],
    },
    SessionUpdate: {
      oneOf: [
        {
          allOf: [{ $ref: "#/$defs/TextContent" }],
          type: "object",
          properties: { sessionUpdate: { const: "agent_message_chunk", type: "string" } },
          required: ["sessionUpdate"],
        },
      ],
      type: "object",
      properties: { _meta: { type: ["string", "null"] } },
    },
  },
};

const rawSchemaModule = A.join(
  [
    "const __recursive_Example = Schema.suspend((): Schema.Schema<Example> => Example);",
    "export type Example = Schema.Schema.Type<typeof Example>;",
    'export const Example = Schema.Struct({ count: Schema.Number.annotate({ description: "count" }), index: Schema.Number.check(Schema.isInt()) }).annotate({ title: "Example", description: "top level" });',
  ],
  "\n"
);

const tinySwagger: S.Json = {
  swagger: "2.0",
  info: { title: "Tiny Swagger API", version: "1.0.0" },
  host: "example.com",
  basePath: "/api",
  schemes: ["https"],
  paths: {
    "/widgets": {
      get: {
        operationId: "listWidgets",
        responses: {
          "200": {
            description: "Widget list",
            schema: { type: "array", items: { $ref: "#/definitions/Widget" } },
          },
        },
      },
    },
  },
  definitions: {
    Widget: {
      type: "object",
      properties: {
        count: { type: "integer" },
        score: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
    },
  },
};

const tinyOpenApi: S.Json = {
  openapi: "3.0.3",
  info: { title: "Tiny OpenAPI", version: "1.0.0" },
  paths: {
    "/widgets": {
      get: {
        operationId: "getWidgets",
        responses: {
          "200": {
            description: "Widget list",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Widget" } },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Widget: {
        type: "object",
        properties: { score: { type: "number" } },
      },
    },
  },
};

const inlineOpenApiResponse = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Inline OpenAPI",
    "version": "1.0.0"
  },
  "paths": {}
}`;

const inlineHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(inlineOpenApiResponse, { status: 200, headers: { "content-type": "application/json" } })
      )
    )
  )
);
const refreshPlatform = Layer.merge(NodeServices.layer, inlineHttpClientLayer);
const CodegenKitRefreshTestLayer = Layer.mergeAll(
  refreshPlatform,
  CodegenKit.layer().pipe(Layer.provide(refreshPlatform))
);

const warningOpenApi: S.Json = {
  openapi: "3.0.3",
  info: { title: "Warning API", version: "1.0.0" },
  paths: {
    "/widgets": {
      get: {
        operationId: "getWidget",
        parameters: [{ in: "cookie", name: "session", schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Json, { space: 2 }));

const writeJson = Effect.fnUntraced(function* (filePath: string, document: S.Json) {
  const fs = yield* FileSystem.FileSystem;
  const encoded = yield* encodeJson(document);
  yield* fs.writeFileString(filePath, `${encoded}\n`);
});

it.layer(CodegenKitRefreshTestLayer, { timeout: "10 seconds" })("@beep/codegen-kit source pins", (it) => {
  it.effect("derives url-embedded policy and writes a matching refresh", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const cachePath = path.join(directory, "url-embedded.json");
      const source: SpecSource = {
        _tag: "url",
        url: "https://example.test/releases/v1/openapi.json",
        pin: "v1",
        cachePath,
      };

      yield* Effect.logInfo("Codegen stage: refresh/cache-format");
      yield* kit.fetch(source, true);
      const cache = yield* fs.readFileString(cachePath);

      expect(cache).toContain('"version": "1.0.0"');
    })
  );

  it.effect("rejects a url-embedded mismatch without replacing the cache", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const cachePath = path.join(directory, "url-embedded-mismatch.json");
      const previous = '{"sentinel":"untouched"}\n';
      const source: SpecSource = {
        _tag: "url",
        url: "https://example.test/releases/v2/openapi.json",
        pin: "v1",
        pinPolicy: "url-embedded",
        cachePath,
      };
      yield* fs.writeFileString(cachePath, previous);

      yield* Effect.logInfo("Codegen stage: refresh/cache-format");
      const failure = yield* kit.fetch(source, true).pipe(Effect.flip);
      const cache = yield* fs.readFileString(cachePath);

      expect(failure._tag).toBe("CodegenFetchError");
      expect(failure.message).toContain("Configured pin v1");
      expect(cache).toBe(previous);
    })
  );

  it.effect("derives info-version policy and writes a matching refresh", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const cachePath = path.join(directory, "info-version.json");
      const source: SpecSource = {
        _tag: "url",
        url: "https://example.test/openapi.json",
        pin: "1.0.0",
        cachePath,
      };

      yield* Effect.logInfo("Codegen stage: refresh/cache-format");
      yield* kit.fetch(source, true);
      const cache = yield* fs.readFileString(cachePath);

      expect(cache).toContain('"version": "1.0.0"');
    })
  );

  it.effect("rejects an info-version mismatch without replacing the cache", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const cachePath = path.join(directory, "info-version-mismatch.json");
      const previous = '{"sentinel":"untouched"}\n';
      const source: SpecSource = {
        _tag: "url",
        url: "https://example.test/openapi.json",
        pin: "2.0.0",
        pinPolicy: "info-version",
        cachePath,
      };
      yield* fs.writeFileString(cachePath, previous);

      yield* Effect.logInfo("Codegen stage: refresh/cache-format");
      const failure = yield* kit.fetch(source, true).pipe(Effect.flip);
      const cache = yield* fs.readFileString(cachePath);

      expect(failure._tag).toBe("CodegenFetchError");
      expect(failure.message).toContain("info.version 1.0.0");
      expect(failure.message).toContain("configured pin is 2.0.0");
      expect(failure.message).toContain("bump pin deliberately");
      expect(cache).toBe(previous);
    })
  );
});

it.layer(CodegenKitTestLayer, { timeout: "10 seconds" })("@beep/codegen-kit", (it) => {
  it.effect("preserves boolean union members while distributing object siblings", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      yield* Effect.logInfo("Codegen stage: generate");
      const output = yield* kit.generate(
        {
          $defs: {
            BooleanUnion: {
              anyOf: [false, { type: "object", properties: { value: { type: "string" } } }],
              properties: { label: { type: "string" } },
              required: ["label"],
            },
            Open: { type: "object", additionalProperties: true },
            Typed: { type: "object", additionalProperties: { type: "string" } },
          },
        },
        GenerateConfig.make({ ...config("boolean.gen.ts"), transforms: ["distributeUnionSiblings", "openObjects"] })
      );
      expect(output).toContain("Schema.Never");
      expect(output).toContain('"label": Schema.String');
      expect(output).toContain('"value": Schema.optionalKey(Schema.String)');
      expect(output).toContain("export const Typed");
    })
  );

  it.effect("repairs ACP ContentBlock and SessionUpdate variant schemas", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      yield* Effect.logInfo("Codegen stage: generate");
      const raw = yield* kit.generate(acpRegressionFixture, config("schema.gen.ts"));

      expect(raw).not.toContain("Schema.Never");
      expect(raw).toContain('Schema.Literal("text")');
      expect(raw).toContain('Schema.Literal("agent_message_chunk")');
      expect(raw).toContain("Schema.Null");
    })
  );

  it.effect("opens closed object output and strips schema examples", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const transformConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/transforms.gen" },
        source: { _tag: "file", path: "fixture.json" },
        dialect: "json-schema-2020-12",
        transforms: ["openObjects", "stripExamples"],
        format: "schemas",
        output: { path: "transforms.gen.ts" },
      });
      const document: S.Json = {
        $defs: {
          OpenRecord: {
            type: "object",
            examples: [{ value: "example" }],
            properties: { value: { type: "string", examples: ["example"] } },
          },
        },
      };
      yield* Effect.logInfo("Codegen stage: generate");
      const raw = yield* kit.generate(document, transformConfig);

      expect(raw).toContain("Schema.StructWithRest");
      expect(raw).not.toContain("example");
    })
  );

  it.effect("applies the schema post-processing contract", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const generateConfig = config("schema.gen.ts");
      const output = yield* kit.postProcess(rawSchemaModule, generateConfig);

      expect(generateConfig.schemaStyle).toBe("struct");
      expect(generateConfig.onWarning).toBe("fail");
      expect(output).toContain("S.Finite.annotateKey");
      expect(output).toContain("index: S.Int");
      expect(output).toContain('$I.annoteSchema("Example"');
      expect(output).toContain('documentation: "top level"');
      expect(output).toContain("**Example** (Inspect the Example schema)");
      expect(output).toContain("@category schemas");
      expect(output).toContain("@since 0.0.0");
      expect(output).toContain("const __recursive_Example = S.suspend");
    })
  );

  it.effect("renders object schemas as classes when requested", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const classConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/classes.gen" },
        source: { _tag: "file", path: "fixture.json" },
        dialect: "json-schema-2020-12",
        format: "schemas",
        schemaStyle: "class",
        output: { path: "classes.gen.ts" },
      });
      const output = yield* kit.postProcess(rawSchemaModule, classConfig);

      expect(output).toContain(
        "export class Example extends S.Class<Example, { readonly brand: unique symbol }>($I`Example`)("
      );
      expect(output).toContain('$I.annote("Example"');
      expect(output).toContain("static readonly is = S.is(Example);");
      expect(output).not.toContain("export type Example =");
      expect(output).toContain('from "@beep/codegen-kit-fixture"');
    })
  );

  it.effect("documents runtime HTTP exports and removes unused imports", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const httpConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/http.gen" },
        source: { _tag: "file", path: "fixture.json" },
        dialect: "openapi-3.1",
        format: "httpapi",
        output: { path: "http.gen.ts" },
      });
      const raw = A.join(
        [
          'import * as Effect from "effect/Effect";',
          'import * as Schema from "effect/Schema";',
          'import { HttpApi, HttpApiSchema } from "effect/http-api";',
          'import { unused } from "fixture";',
          'export class Api extends HttpApi.make("fixture") {}',
          "export type Payload = { readonly value: string };",
          "export const Payload = Schema.Struct({ value: Schema.String });",
          "export const make = Effect.succeed(Api);",
          "export const NotFound = HttpApiSchema.Empty(404);",
        ],
        "\n"
      );
      const output = yield* kit.postProcess(raw, httpConfig);

      expect(output).toContain("@packageDocumentation");
      expect(output).toContain("Do not edit manually");
      expect(output).toContain("\\@beep/codegen-kit-fixture");
      expect(output).toContain('import * as Effect from "effect/Effect";');
      expect(output).toContain('import { $CodegenKitId } from "@beep/identity";');
      expect(output).not.toContain('from "fixture"');
      expect(output).toContain('const $I = $CodegenKitId.create("fixture/http.gen");');
      expect(output).toContain('$I.annoteSchema("Payload"');
      expect(output).toContain("**Example** (Inspect Api)");
      expect(output).toContain("**Example** (Inspect make)");
      expect(output).toContain("**Example** (Inspect NotFound)");
      expect(output).toContain('import * as HttpApi from "effect/http-api/HttpApi";');
      expect(output).toContain('import * as HttpApiSchema from "effect/http-api/HttpApiSchema";');
      expect(output).toContain("HttpApiSchema.Empty(404)");
      expect(output).not.toContain("HttpApiS.Empty");
      expect(output).toContain("@category tools");
      expect(output).toContain("@since 0.0.0");
    })
  );

  it.effect("emits leaf HTTP module imports while preserving aliases and type-only bindings", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const httpConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/imports.gen" },
        source: { _tag: "file", path: "fixture.json" },
        dialect: "openapi-3.1",
        format: "httpapi",
        output: { path: "imports.gen.ts" },
      });
      const raw = A.join(
        [
          'import { HttpApi as Api, type HttpApiEndpoint as Endpoint, HttpApiSecurity } from "effect/http-api";',
          'import type { HttpApiGroup as Group } from "effect/http-api";',
          'import { Multipart as Parts } from "effect/http";',
          'import type { Multipart as PartTypes } from "effect/http";',
          'import { make as makeApi } from "effect/http-api/HttpApi";',
          'export const api = Api.make("fixture");',
          "export const multipart = Parts.FileSchema;",
          "export const leaf = makeApi;",
          "export type EndpointValue = Endpoint.Any;",
          "export type GroupValue = Group.Any;",
          "export type FileValue = PartTypes.File;",
        ],
        "\n"
      );
      const output = yield* kit.postProcess(raw, httpConfig);
      expect(output).toContain('import * as Api from "effect/http-api/HttpApi";');
      expect(output).toContain('import type * as Endpoint from "effect/http-api/HttpApiEndpoint";');
      expect(output).toContain('import type * as Group from "effect/http-api/HttpApiGroup";');
      expect(output).toContain('import * as Parts from "effect/http/Multipart";');
      expect(output).toContain('import type * as PartTypes from "effect/http/Multipart";');
      expect(output).toContain('import { make as makeApi } from "effect/http-api/HttpApi";');
      expect(output).not.toContain('from "effect/http-api"');
      expect(output).not.toContain('from "effect/http"');
      expect(output).not.toContain("HttpApiSecurity");
    })
  );

  it.effect("runs a patched Swagger 2.0 HttpApi document end to end", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const specPath = path.join(directory, "swagger.json");
      const outputPath = path.join(directory, "SwaggerApi.gen.ts");
      yield* writeJson(specPath, tinySwagger);
      const generateConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        name: "SwaggerApi",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/SwaggerApi.gen" },
        source: { _tag: "file", path: specPath },
        dialect: "swagger-2.0",
        patches: [
          {
            source: "inline produces patch",
            patch: [{ op: "add", path: "/produces", value: ["application/json"] }],
          },
        ],
        format: "httpapi",
        output: { path: outputPath },
      });

      yield* Effect.logInfo("Codegen stage: format/write-or-drift-check");
      yield* kit.run(generateConfig, "write");
      const output = yield* fs.readFileString(outputPath);

      expect(output).toContain("export class SwaggerApi extends HttpApi.make");
      expect(output).toContain("S.Int");
      expect(output).toContain("S.Finite");
      expect(output).toContain("S.Array(S.String).pipe(S.optionalKey)");
      expect(output).not.toContain("S.Number");
      expect(output).toContain("**Example** (Inspect SwaggerApi)");
    })
  );

  it.effect("runs an OpenAPI 3.0 HttpApi document end to end", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const specPath = path.join(directory, "openapi.json");
      const outputPath = path.join(directory, "OpenApi.gen.ts");
      yield* writeJson(specPath, tinyOpenApi);
      const generateConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        name: "OpenApiFixture",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/OpenApi.gen" },
        source: { _tag: "file", path: specPath },
        dialect: "openapi-3.0",
        format: "httpapi",
        output: { path: outputPath },
      });

      yield* Effect.logInfo("Codegen stage: format/write-or-drift-check");
      yield* kit.run(generateConfig, "write");
      const output = yield* fs.readFileString(outputPath);

      expect(output).toContain("export class OpenApiFixture extends HttpApi.make");
      expect(output).toContain("S.Finite");
      expect(output).not.toContain("HttpApiMiddleware");
      expect(output).not.toContain("HttpApiSecurity");
      expect(output).toContain("@since 0.0.0");
    })
  );

  it.effect("fails on generator warnings by default and logs them when configured", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const strictConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        name: "WarningApi",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/WarningApi.gen" },
        source: { _tag: "file", path: "warning.json" },
        dialect: "openapi-3.0",
        format: "httpapi",
        output: { path: "WarningApi.gen.ts" },
      });
      yield* Effect.logInfo("Codegen stage: generate");
      const failure = yield* kit.generate(warningOpenApi, strictConfig).pipe(Effect.flip);
      expect(failure._tag).toBe("CodegenGenerateError");
      expect(failure.message).toContain("cookie-parameter-dropped");

      const logConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        name: "WarningApi",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/WarningApi.gen" },
        source: { _tag: "file", path: "warning.json" },
        dialect: "openapi-3.0",
        format: "httpapi",
        onWarning: "log",
        output: { path: "WarningApi.gen.ts" },
      });
      yield* Effect.logInfo("Codegen stage: generate");
      const output = yield* kit.generate(warningOpenApi, logConfig);
      const warnings = pipe(yield* TestConsole.errorLines, A.filter(P.isString), A.join("\n"));

      expect(output).toContain("export class WarningApi extends HttpApi.make");
      expect(warnings).toContain("WARNING [cookie-parameter-dropped]");
    })
  );

  it.effect("prints a unified diff when check mode detects drift", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const specPath = path.join(directory, "openapi.json");
      const outputPath = path.join(directory, "DriftApi.gen.ts");
      yield* writeJson(specPath, tinyOpenApi);
      yield* fs.writeFileString(outputPath, "export const stale = true;\n");
      const generateConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        name: "DriftApi",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/DriftApi.gen" },
        source: { _tag: "file", path: specPath },
        dialect: "openapi-3.0",
        format: "httpapi",
        output: { path: outputPath },
      });

      yield* Effect.logInfo("Codegen stage: format/write-or-drift-check");
      const failure = yield* kit.run(generateConfig, "check").pipe(Effect.flip);
      const printed = pipe(yield* TestConsole.errorLines, A.filter(P.isString), A.join("\n"));

      expect(failure._tag).toBe("CodegenDriftError");
      expect(printed).toContain(`--- ${outputPath}`);
      expect(printed).toContain("+++ generated");
      expect(printed).toContain("-export const stale = true;");
      expect(printed).toContain("+/**");
    })
  );

  it.effect("reports clean, changed, and missing generated outputs", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const outputPath = path.join(directory, "schema.gen.ts");
      const current = GeneratedModule.make({ path: outputPath, content: "export const value = 1;\n" });

      const missing = yield* kit.drift(current);
      expect(missing.status).toBe("missing");
      expect(missing.diffLines).toBeGreaterThan(0);

      yield* fs.writeFileString(outputPath, current.content);
      const clean = yield* kit.drift(current);
      expect(clean.status).toBe("clean");
      expect(clean.diffLines).toBe(0);

      const changed = yield* kit.drift(
        GeneratedModule.make({ path: outputPath, content: "export const value = 2;\n" })
      );
      expect(changed.status).toBe("changed");
      expect(changed.diffLines).toBe(1);
    })
  );

  it.effect("runs a tiny schema document through generation and rendering", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const tiny: S.Json = {
        $defs: {
          Widget: {
            type: "object",
            properties: { score: { type: "number" } },
            required: ["score"],
          },
        },
      };
      const generateConfig = config("widget.gen.ts");
      yield* Effect.logInfo("Codegen stage: generate");
      const raw = yield* kit.generate(tiny, generateConfig);
      const rendered = yield* kit.postProcess(raw, generateConfig);

      expect(rendered).toContain("export const Widget = S.Struct");
      expect(rendered).toContain('"score": S.Finite');
      expect(rendered).toContain("export type Widget = typeof Widget.Type;");
      expect(rendered).toContain('from "@beep/identity"');
    })
  );

  it.effect("renders required const properties as schema tags", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const tagged: S.Json = {
        $defs: {
          Gadget: {
            type: "object",
            properties: {
              kind: { const: "gadget", type: "string" },
              stage: { const: "beta", type: "string" },
            },
            required: ["kind"],
          },
        },
      };
      const generateConfig = config("gadget.gen.ts");
      const raw = yield* kit.generate(tagged, generateConfig);
      const rendered = yield* kit.postProcess(raw, generateConfig);

      expect(rendered).toContain('"kind": S.tag("gadget")');
      expect(rendered).toContain('"stage": S.optionalKey(S.Literal("beta"))');
      expect(rendered).not.toContain('S.Literal("gadget")');
    })
  );
});

const acpTransforms: ReadonlyArray<NamedTransform> = [
  "nullableTypeArray",
  "unevaluatedPropertiesOpen",
  "notDiscriminatorPattern",
  "uniqueDiscriminatorOneOfAsAnyOf",
  "intersectSiblingProperties",
  "distributeAllOf",
];

// The ACP `IdleStateUpdate` shape since schema-v2.0.0-alpha.9: union branches narrow the base `stopReason`.
const idleStateUpdate = {
  type: "object",
  properties: {
    usage: { type: "string" },
    stopReason: { description: "Why foreground work stopped.", type: ["string", "null"] },
  },
  anyOf: [
    { type: "object", properties: { stopReason: { type: "string", const: "end_turn" } }, required: ["stopReason"] },
    { type: "object", properties: { stopReason: { type: "null" } } },
    { type: "object", properties: { code: { type: "integer" } } },
  ],
} satisfies JsonSchema.JsonSchema;

const isTransformError = S.is(CodegenTransformError);

const unexpectedFailure = (cause: unknown): CodegenTransformError =>
  CodegenTransformError.make({ transform: "stripExamples", message: `unexpected failure: ${String(cause)}` });

const transformFailure = (run: () => unknown) =>
  Effect.try({ try: run, catch: (cause) => (isTransformError(cause) ? cause : unexpectedFailure(cause)) }).pipe(
    Effect.asVoid,
    Effect.flip
  );

const elicitationDefinitions = {
  SessionScope: {
    type: "object",
    properties: { sessionId: { type: "string" } },
    required: ["sessionId"],
  },
  RequestScope: {
    type: "object",
    properties: { requestId: { type: "string" } },
    required: ["requestId"],
  },
  FormMode: {
    type: "object",
    properties: { requestedSchema: { type: "object" } },
    anyOf: [{ allOf: [{ $ref: "#/$defs/SessionScope" }] }, { allOf: [{ $ref: "#/$defs/RequestScope" }] }],
    required: ["requestedSchema"],
  },
  UrlMode: {
    type: "object",
    properties: { url: { type: "string" } },
    anyOf: [{ allOf: [{ $ref: "#/$defs/SessionScope" }] }, { allOf: [{ $ref: "#/$defs/RequestScope" }] }],
    required: ["url"],
  },
  CreateElicitationRequest: {
    type: "object",
    properties: { message: { type: "string" }, _meta: { type: ["object", "null"] } },
    anyOf: [
      {
        type: "object",
        properties: { mode: { type: "string", const: "form" } },
        required: ["mode"],
        allOf: [{ $ref: "#/$defs/FormMode" }],
      },
      {
        type: "object",
        properties: { mode: { type: "string", const: "url" } },
        required: ["mode"],
        allOf: [{ $ref: "#/$defs/UrlMode" }],
      },
      {
        type: "object",
        properties: { mode: { type: "string" } },
        required: ["mode"],
        anyOf: [{ allOf: [{ $ref: "#/$defs/SessionScope" }] }, { allOf: [{ $ref: "#/$defs/RequestScope" }] }],
        unevaluatedProperties: true,
        not: {
          anyOf: [
            { type: "object", properties: { mode: { type: "string", const: "form" } }, required: ["mode"] },
            { type: "object", properties: { mode: { type: "string", const: "url" } }, required: ["mode"] },
          ],
        },
      },
    ],
    required: ["message"],
  },
};

const elicitationRequest: JsonSchema.JsonSchema = elicitationDefinitions.CreateElicitationRequest;

const closedOpenApi: S.Json = {
  openapi: "3.1.0",
  info: { title: "Closed API", version: "1.0.0" },
  paths: {
    "/closed": {
      get: {
        operationId: "getClosed",
        responses: {
          "200": {
            description: "Closed object",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Closed" } } },
          },
        },
      },
    },
  },
  components: { schemas: { Closed: { type: "object", unevaluatedProperties: false } } },
};

const unionMembers = (node: unknown): ReadonlyArray<unknown> =>
  P.isObject(node) && A.isArray(node.anyOf) ? node.anyOf : [];

const leafRequired = (node: unknown): ReadonlyArray<string> =>
  P.isObject(node) && A.isArray(node.required) ? A.filter(node.required, P.isString) : [];

it.layer(CodegenKitTestLayer, { timeout: "10 seconds" })("@beep/codegen-kit ACP transforms", (it) => {
  it.effect("rewrites a forward-compatible not exclusion into an escaped discriminator pattern", () =>
    Effect.sync(() => {
      const hook = composeTransforms(["notDiscriminatorPattern"], {});
      const node: JsonSchema.JsonSchema = {
        type: "object",
        properties: { type: { type: "string", description: "kind" } },
        not: { anyOf: [{ properties: { type: { const: "text" } } }, { properties: { type: { const: "a.b" } } }] },
      };
      const rewritten = hook(node);

      expect(rewritten.not).toBeUndefined();
      expect(rewritten.properties).toEqual({
        type: { type: "string", description: "kind", pattern: "^(?!(?:text|a\\.b)$)[\\s\\S]*$" },
      });
      expect(hook(rewritten)).toEqual(rewritten);
      const pattern = /^(?!(?:text|a\.b)$)[\s\S]*$/u;
      expect(pattern.test("future_content")).toBe(true);
      expect(pattern.test("text")).toBe(false);
      expect(pattern.test("a.b")).toBe(false);
      expect(pattern.test("axb")).toBe(true);
    })
  );

  it.effect("fails on unsupported not shapes with a typed transform error", () =>
    Effect.gen(function* () {
      const hook = composeTransforms(["notDiscriminatorPattern"], {});
      const scalar = yield* transformFailure(() => hook({ type: "string", not: { type: "number" } }));
      expect(scalar.transform).toBe("notDiscriminatorPattern");
      expect(scalar.message).toContain("expected not.anyOf");

      const mixed = yield* transformFailure(() =>
        hook({
          type: "object",
          properties: { type: { type: "string" }, kind: { type: "string" } },
          not: { anyOf: [{ properties: { type: { const: "a" } } }, { properties: { kind: { const: "b" } } }] },
        })
      );
      expect(mixed.message).toContain("share one discriminator");

      const missing = yield* transformFailure(() =>
        hook({ type: "object", properties: {}, not: { anyOf: [{ properties: { type: { const: "a" } } }] } })
      );
      expect(missing.message).toContain("Missing discriminator property type");

      const nonString = yield* transformFailure(() =>
        hook({
          type: "object",
          properties: { type: { type: "string" } },
          not: { anyOf: [{ properties: { type: { const: 1 } } }] },
        })
      );
      expect(nonString.message).toContain("string const");

      const propertyless = yield* transformFailure(() =>
        hook({ type: "object", properties: { type: { type: "string" } }, not: { anyOf: [{ const: "a" }] } })
      );
      expect(propertyless.message).toContain("expected an object with properties");

      const compound = yield* transformFailure(() =>
        hook({
          type: "object",
          properties: { type: { type: "string" } },
          not: { anyOf: [{ properties: { type: { const: "a" }, kind: { const: "b" } } }] },
        })
      );
      expect(compound.message).toContain("expected exactly one discriminator property");

      const unshaped = yield* transformFailure(() =>
        hook({ type: "object", not: { anyOf: [{ properties: { type: { const: "a" } } }] } })
      );
      expect(unshaped.message).toContain("missing properties for discriminator type");
    })
  );

  it.effect("opens unevaluatedProperties true and rejects other values", () =>
    Effect.gen(function* () {
      const hook = composeTransforms(["unevaluatedPropertiesOpen"], {});
      const opened = hook({ type: "object", unevaluatedProperties: true });

      expect(opened).toEqual({ type: "object", additionalProperties: true });
      expect(hook(opened)).toEqual(opened);

      const closed = yield* transformFailure(() => hook({ type: "object", unevaluatedProperties: false }));
      expect(closed.transform).toBe("unevaluatedPropertiesOpen");
    })
  );

  it.effect("lowers uniquely discriminated oneOf unions to anyOf only", () =>
    Effect.sync(() => {
      const hook = composeTransforms(["uniqueDiscriminatorOneOfAsAnyOf"], {});
      const constants = hook({ oneOf: [{ const: "a" }, { const: "b" }] });
      const discriminated = hook({
        discriminator: { propertyName: "kind" },
        oneOf: [{ properties: { kind: { const: "a" } } }, { properties: { kind: { const: "b" } } }],
      });
      const duplicated = { oneOf: [{ const: "a" }, { const: "a" }] };
      const untagged = { oneOf: [{ type: "string" }, { type: "number" }] };

      expect(constants).toEqual({ anyOf: [{ const: "a" }, { const: "b" }] });
      expect(discriminated.oneOf).toBeUndefined();
      expect(A.isArray(discriminated.anyOf)).toBe(true);
      expect(hook(duplicated)).toEqual(duplicated);
      expect(hook(untagged)).toEqual(untagged);
      expect(hook(constants)).toEqual(constants);
    })
  );

  it.effect("distributes elicitation mode and scope intersections into their cross product", () =>
    Effect.sync(() => {
      const hook = composeTransforms(acpTransforms, elicitationDefinitions);
      const flattened = hook(elicitationRequest);
      const modes = unionMembers(flattened);

      expect(A.length(modes)).toBe(3);
      const scoped = A.map(modes, (mode) => A.map(unionMembers(mode), leafRequired));
      expect(scoped).toEqual([
        [
          ["message", "mode", "requestedSchema", "sessionId"],
          ["message", "mode", "requestedSchema", "requestId"],
        ],
        [
          ["message", "mode", "url", "sessionId"],
          ["message", "mode", "url", "requestId"],
        ],
        [
          ["message", "mode", "sessionId"],
          ["message", "mode", "requestId"],
        ],
      ]);
      const other = A.get(unionMembers(A.get(modes, 2).pipe(O.getOrUndefined)), 0).pipe(O.getOrUndefined);
      expect(P.isObject(other) ? other.additionalProperties : undefined).toBe(true);
      expect(P.isObject(other) ? other.not : "missing").toBeUndefined();
      expect(hook(flattened)).toEqual(flattened);
    })
  );

  it.effect("inlines a $ref in either allOf position so member order does not matter", () =>
    Effect.gen(function* () {
      const definitions: JsonSchema.Definitions = {
        Named: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
          description: "Target description",
          title: "Target title",
        },
      };
      const hook = composeTransforms(["distributeAllOf"], definitions);
      const extra = { type: "object", properties: { x: { type: "number" } } };
      const member = { $ref: "#/$defs/Named", description: "Member description", title: "Member title" };
      const outer = { description: "Outer", title: "Outer title" };
      const refFirst = hook({ ...outer, allOf: [member, extra] });
      const refLast = hook({ ...outer, allOf: [extra, member] });
      expect(refFirst).toEqual({
        description: "Outer",
        title: "Outer title",
        type: "object",
        properties: { name: { type: "string" }, x: { type: "number" } },
        required: ["name"],
      });
      expect(refLast).toEqual(refFirst);
      expect(refFirst.$ref).toBeUndefined();
      expect(refLast.$ref).toBeUndefined();
    })
  );

  it.effect("keeps outer allOf annotations on the reduced union and preserves branch annotations", () =>
    Effect.gen(function* () {
      const branches = [
        { type: "object", properties: { done: { const: true } }, description: "Completed", title: "Done" },
        { type: "object", properties: { done: { const: false } }, description: "Cancelled", title: "Stopped" },
      ];
      const hook = composeTransforms(["distributeAllOf"], { Outcome: { anyOf: branches } });
      const outer = { description: "Outer description", title: "Outer title" };
      const constraints = { type: "object", properties: { id: { type: "string" } } };
      const expected = {
        ...outer,
        anyOf: A.map(branches, (branch) => ({
          ...branch,
          properties: { ...constraints.properties, ...branch.properties },
        })),
      };
      const direct = hook({ ...outer, ...constraints, allOf: [{ anyOf: branches }] });
      const referenced = hook({ ...outer, ...constraints, allOf: [{ $ref: "#/$defs/Outcome" }] });
      expect(direct).toEqual(expected);
      expect(referenced).toEqual(expected);
      expect(hook(referenced)).toEqual(expected);
    })
  );

  it.effect("keeps union-level annotations when an intersection distributes a union of unions", () =>
    Effect.sync(() => {
      const scopes = [
        { type: "object", properties: { sessionId: { type: "string" } }, description: "Session scope" },
        { type: "object", properties: { requestId: { type: "string" } }, description: "Request scope" },
      ];
      const hook = composeTransforms(["distributeAllOf"], { Scoped: { description: "Scope", anyOf: scopes } });
      const extend = (properties: Record<string, unknown>) =>
        A.map(scopes, (scope) => ({ ...scope, properties: { ...properties, ...scope.properties } }));
      const mode = (value: string, annotations: Record<string, string>) => ({
        ...annotations,
        type: "object",
        properties: { mode: { const: value } },
        allOf: [{ $ref: "#/$defs/Scoped" }],
      });
      const message = { message: { type: "string" } };
      const request = hook({
        type: "object",
        properties: message,
        anyOf: [
          mode("form", { description: "Form mode", title: "Form" }),
          mode("url", { description: "URL mode" }),
          mode("other", {}),
        ],
      });
      expect(request).toEqual({
        anyOf: [
          { description: "Form mode", title: "Form", anyOf: extend({ ...message, mode: { const: "form" } }) },
          { description: "URL mode", anyOf: extend({ ...message, mode: { const: "url" } }) },
          { description: "Scope", anyOf: extend({ ...message, mode: { const: "other" } }) },
        ],
      });
      expect(hook(request)).toEqual(request);

      const variants = [{ properties: { a: { type: "string" } } }, { properties: { b: { type: "string" } } }];
      const crossed = hook({ description: "Outer", type: "object", allOf: [{ anyOf: scopes }], anyOf: variants });
      expect(crossed).toEqual({
        description: "Outer",
        anyOf: A.map(scopes, ({ description, ...scope }) => ({
          description,
          anyOf: A.map(variants, (variant) => ({
            ...scope,
            properties: { ...scope.properties, ...variant.properties },
          })),
        })),
      });
      expect(hook(crossed)).toEqual(crossed);
    })
  );

  it.effect("keeps a constrained node's own annotations on its anyOf in either member order", () =>
    Effect.sync(() => {
      const scopes = [
        {
          type: "object",
          properties: { sessionId: { type: "string" } },
          required: ["sessionId"],
          description: "Session scope",
          title: "Session",
        },
        {
          type: "object",
          properties: { requestId: { type: "string" } },
          required: ["requestId"],
          description: "Request scope",
        },
        { type: "object", properties: { token: { type: "string" } } },
      ];
      const form = { requestedSchema: { type: "object" } };
      const message = { message: { type: "string" } };
      const mode = { description: "Form mode", title: "Form", type: "object", properties: form, anyOf: scopes };
      const hook = composeTransforms(["distributeAllOf"], {
        Mode: mode,
        Message: { description: "Message part", "x-side": "client", type: "object", properties: message },
      });
      const scoped = (properties: Record<string, unknown>) =>
        A.map(scopes, (scope) => ({ ...scope, properties: { ...properties, ...scope.properties } }));

      const own = hook(mode);
      expect(own).toEqual({ description: "Form mode", title: "Form", anyOf: scoped(form) });
      expect(hook(own)).toEqual(own);

      const outer = { description: "Request" };
      const expected = {
        description: "Request",
        title: "Form",
        "x-side": "client",
        anyOf: scoped({ ...form, ...message }),
      };
      const modeRef = { $ref: "#/$defs/Mode" };
      const messageRef = { $ref: "#/$defs/Message" };
      const unionFirst = hook({ ...outer, allOf: [modeRef, messageRef] });
      const unionLast = hook({ ...outer, allOf: [messageRef, modeRef] });
      expect(unionFirst).toEqual(expected);
      expect(unionLast).toEqual(expected);
      expect(hook(unionFirst)).toEqual(expected);

      // Without outer annotations the union keeps its own description in either member order.
      expect(hook({ allOf: [modeRef, messageRef] })).toEqual({ ...expected, description: "Form mode" });
      expect(hook({ allOf: [messageRef, modeRef] })).toEqual({ ...expected, description: "Form mode" });
    })
  );

  it.effect("keeps a union's default, examples and discriminator on its anyOf and a branch's on that branch", () =>
    Effect.sync(() => {
      const branches = [
        {
          type: "object",
          properties: { kind: { const: "text" } },
          required: ["kind"],
          default: { kind: "text" },
          examples: [{ kind: "text" }],
        },
        {
          type: "object",
          properties: { kind: { const: "image" }, uri: { type: "string" } },
          required: ["kind", "uri"],
        },
      ];
      const unionLevel = {
        default: { kind: "image", uri: "a.png" },
        examples: [{ kind: "text" }, { kind: "image", uri: "b.png" }],
        discriminator: { propertyName: "kind" },
      };
      const shared = { id: { type: "string" } };
      const block = { ...unionLevel, type: "object", properties: shared, anyOf: branches };
      const hook = composeTransforms(["distributeAllOf"], { Block: block });
      const extend = (properties: Record<string, unknown>) =>
        A.map(branches, (branch) => ({ ...branch, properties: { ...properties, ...shared, ...branch.properties } }));

      const own = hook(block);
      expect(own).toEqual({ ...unionLevel, anyOf: extend({}) });
      expect(hook(own)).toEqual(own);

      const caption = { caption: { type: "string" } };
      const member = hook({
        description: "Captioned block",
        type: "object",
        properties: caption,
        allOf: [{ $ref: "#/$defs/Block" }],
      });
      expect(member).toEqual({ description: "Captioned block", ...unionLevel, anyOf: extend(caption) });
      expect(hook(member)).toEqual(member);
    })
  );

  it.effect("keeps a union's own annotations over an intersected object's in any member order", () =>
    Effect.sync(() => {
      const branches = [
        {
          type: "object",
          properties: { kind: { const: "text" } },
          description: "Text block",
          default: { kind: "text" },
        },
        { type: "object", properties: { kind: { const: "image" } } },
      ];
      const caption = {
        description: "Caption part",
        title: "Caption",
        default: { caption: "" },
        "x-side": "client",
        type: "object",
        properties: { caption: { type: "string" } },
      };
      const hook = composeTransforms(["distributeAllOf"], {
        Block: {
          description: "Content block",
          title: "Block",
          default: { kind: "text" },
          discriminator: { propertyName: "kind" },
          anyOf: branches,
        },
        Caption: caption,
        Locale: {
          description: "Locale",
          title: "Locale",
          anyOf: [{ properties: { lang: { const: "en" } } }, { properties: { lang: { const: "fr" } } }],
        },
        Meta: { "x-side": "server", type: "object", properties: { meta: { type: "string" } } },
      });
      const blockRef = { $ref: "#/$defs/Block" };
      const captionRef = { $ref: "#/$defs/Caption" };
      const expected = {
        description: "Content block",
        title: "Block",
        default: { kind: "text" },
        discriminator: { propertyName: "kind" },
        "x-side": "client",
        anyOf: A.map(branches, (branch) => ({
          ...branch,
          properties: { ...branch.properties, ...caption.properties },
        })),
      };

      const unionFirst = hook({ allOf: [blockRef, captionRef] });
      expect(unionFirst).toEqual(expected);
      expect(hook({ allOf: [captionRef, blockRef] })).toEqual(expected);
      expect(hook(unionFirst)).toEqual(expected);

      // Annotations beside a member's `$ref` override the referenced definition's and rank as that
      // member's own; the node's own win over every member.
      const useSite = { $ref: "#/$defs/Block", description: "Use site" };
      expect(hook({ allOf: [useSite, captionRef] })).toEqual({ ...expected, description: "Use site" });
      expect(hook({ allOf: [captionRef, useSite] })).toEqual({ ...expected, description: "Use site" });
      expect(hook({ allOf: [blockRef, { ...captionRef, description: "Captioned" }] })).toEqual(expected);
      expect(hook({ title: "Outer", allOf: [captionRef, blockRef] })).toEqual({ ...expected, title: "Outer" });

      // Objects resolve a conflict right over left wherever the union sits among the members.
      const metaRef = { $ref: "#/$defs/Meta" };
      const sides = A.map(
        [
          [blockRef, captionRef, metaRef],
          [captionRef, blockRef, metaRef],
          [captionRef, metaRef, blockRef],
          [metaRef, blockRef, captionRef],
        ],
        (allOf) => hook({ allOf })["x-side"]
      );
      expect(sides).toEqual(["server", "server", "server", "client"]);

      // Between two unions, as between two objects, the later member wins.
      const localeRef = { $ref: "#/$defs/Locale" };
      const localeLast = hook({ allOf: [blockRef, localeRef] });
      const localeFirst = hook({ allOf: [localeRef, blockRef] });
      expect([localeLast.description, localeLast.title]).toEqual(["Locale", "Locale"]);
      expect([localeFirst.description, localeFirst.title]).toEqual(["Content block", "Block"]);
    })
  );

  it.effect("keeps object annotation precedence stable across pure allOf regrouping", () =>
    Effect.sync(() => {
      const hook = composeTransforms(["distributeAllOf"], {});
      const left = { type: "object", description: "a", properties: { a: { type: "string" } } };
      const right = { type: "object", description: "b", properties: { b: { type: "string" } } };
      const union = { anyOf: [{ properties: { kind: { const: "x" } } }, { properties: { kind: { const: "y" } } }] };
      const flat = hook({ allOf: [left, union, right] });
      expect(flat.description).toBe("b");
      for (const allOf of [
        [{ allOf: [left, union] }, right],
        [left, { allOf: [union, right] }],
        [{ allOf: [{ allOf: [left, union] }, { allOf: [right] }] }],
        [{ allOf: [] }, left, union, right],
      ]) {
        expect(hook({ allOf })).toEqual(flat);
      }
      expect(hook(flat)).toEqual(flat);
      expect(hook({ allOf: [{ description: "Group", allOf: [left, union] }, right] }).description).toBe("Group");
      expect(hook({ allOf: [{ type: "object", allOf: [left, union] }, right] }).description).toBe("a");
      expect(hook({ description: "Outer", allOf: [{ allOf: [left, union] }, right] }).description).toBe("Outer");
    })
  );

  it.effect("keeps annotation-only references and rejects conflicting intersections", () =>
    Effect.gen(function* () {
      const definitions: JsonSchema.Definitions = {
        Id: { type: "string" },
        Named: { type: "object", properties: { name: { type: "string" } } },
      };
      const hook = composeTransforms(["distributeAllOf"], definitions);
      const annotated = hook({ description: "An id", allOf: [{ $ref: "#/$defs/Id" }] });
      expect(annotated).toEqual({ $ref: "#/$defs/Id", description: "An id" });
      expect(hook(annotated)).toEqual(annotated);
      expect(hook({ $ref: "#/$defs/Id", allOf: [{ description: "An id" }] })).toEqual(annotated);

      const keyword = hook({
        type: "object",
        properties: { anyOf: { type: "array" }, allOf: { type: "string" } },
        required: ["anyOf"],
      });
      expect(keyword.properties).toEqual({ anyOf: { type: "array" }, allOf: { type: "string" } });

      const distributed = hook({
        allOf: [
          {
            anyOf: [
              { type: "object", properties: { a: { type: "string" } } },
              { type: "object", properties: { b: { type: "string" } } },
            ],
          },
          { type: "object", properties: { c: { type: "string" } } },
        ],
      });
      expect(distributed).toEqual({
        anyOf: [
          { type: "object", properties: { a: { type: "string" }, c: { type: "string" } } },
          { type: "object", properties: { b: { type: "string" }, c: { type: "string" } } },
        ],
      });

      const conflict = yield* transformFailure(() =>
        hook({ type: "object", properties: {}, allOf: [{ type: "string" }] })
      );
      expect(conflict.transform).toBe("distributeAllOf");
      expect(conflict.message).toContain("conflicting schema constraint: type");

      const overlap = yield* transformFailure(() =>
        hook({ type: "object", properties: { name: { type: "number" } }, allOf: [{ $ref: "#/$defs/Named" }] })
      );
      expect(overlap.message).toContain("overlapping schema property: name");

      const missing = yield* transformFailure(() =>
        hook({ type: "object", properties: {}, allOf: [{ $ref: "#/$defs/Missing" }] })
      );
      expect(missing.message).toContain("Missing definition #/$defs/Missing");

      const scalar = yield* transformFailure(() => hook({ type: "object", properties: {}, allOf: [true] }));
      expect(scalar.message).toContain("intersection of non-object schemas");
    })
  );

  it.effect("resolves $ref by its full JSON pointer and rejects pointers outside the definition pool", () =>
    Effect.gen(function* () {
      const definitions: JsonSchema.Definitions = {
        Envelope: {
          type: "object",
          properties: { meta: { type: "object", properties: { traceId: { type: "string" } }, required: ["traceId"] } },
        },
        meta: { type: "object", properties: { legacy: { type: "number" } }, required: ["legacy"] },
        "a/b": { type: "object", properties: { escaped: { type: "string" } } },
      };
      const distribute = composeTransforms(["distributeAllOf"], definitions);
      const node = (ref: string): JsonSchema.JsonSchema => ({
        type: "object",
        properties: { id: { type: "string" } },
        allOf: [{ $ref: ref }],
      });

      const nested = yield* transformFailure(() => distribute(node("#/$defs/Envelope/properties/meta")));
      expect(nested.transform).toBe("distributeAllOf");
      expect(nested.message).toContain("Unsupported $ref #/$defs/Envelope/properties/meta");

      const external = yield* transformFailure(() => distribute(node("other.json#/$defs/meta")));
      expect(external.message).toContain("Unsupported $ref other.json#/$defs/meta");

      expect(distribute(node("#/$defs/a~1b")).properties).toEqual({
        id: { type: "string" },
        escaped: { type: "string" },
      });
      expect(distribute(node("#/components/schemas/meta"))).toEqual({
        type: "object",
        properties: { id: { type: "string" }, legacy: { type: "number" } },
        required: ["legacy"],
      });

      const flatten = composeTransforms(["flattenAllOfRefVariants"], definitions);
      const unresolved = node("#/$defs/Envelope/properties/meta");
      expect(flatten(unresolved)).toEqual(unresolved);
    })
  );

  it.effect("compares intersected constraints structurally regardless of key order", () =>
    Effect.sync(() => {
      const hook = composeTransforms(["distributeAllOf"], {});
      const merged = hook({
        type: "object",
        properties: { name: { type: "string", minLength: 1 } },
        additionalProperties: { type: "string", maxLength: 8 },
        allOf: [
          {
            type: "object",
            properties: { name: { minLength: 1, type: "string" }, tag: { type: "string" } },
            additionalProperties: { maxLength: 8, type: "string" },
          },
        ],
      });

      expect(merged).toEqual({
        type: "object",
        properties: { name: { minLength: 1, type: "string" }, tag: { type: "string" } },
        additionalProperties: { maxLength: 8, type: "string" },
      });
    })
  );

  it.effect("intersects a base property into every union branch that narrows it", () =>
    Effect.sync(() => {
      const hook = composeTransforms(acpTransforms, {});
      const narrowed = hook(idleStateUpdate);

      expect(narrowed).toEqual({
        anyOf: [
          {
            type: "object",
            properties: {
              usage: { type: "string" },
              stopReason: { description: "Why foreground work stopped.", type: "string", const: "end_turn" },
            },
            required: ["stopReason"],
          },
          { type: "object", properties: { usage: { type: "string" }, stopReason: { type: "null" } } },
          {
            type: "object",
            properties: {
              usage: { type: "string" },
              code: { type: "integer" },
              stopReason: {
                anyOf: [{ description: "Why foreground work stopped.", type: "string" }, { type: "null" }],
              },
            },
          },
        ],
      });
      expect(hook(narrowed)).toEqual(narrowed);

      const pushedDown = composeTransforms(["intersectSiblingProperties"], {})(idleStateUpdate);
      expect(pushedDown.properties).toEqual({ usage: { type: "string" } });

      const unchanged: JsonSchema.JsonSchema = {
        type: "object",
        properties: { kind: { type: "string" } },
        anyOf: [{ type: "object", properties: { kind: { type: "string" } } }],
      };
      expect(composeTransforms(["intersectSiblingProperties"], {})(unchanged)).toEqual(unchanged);
    })
  );

  it.effect("narrows number and integer sibling properties to integer in either order", () =>
    Effect.sync(() => {
      const hook = composeTransforms(["intersectSiblingProperties"], {});
      const narrowed = (base: JsonSchema.JsonSchema, branch: JsonSchema.JsonSchema) =>
        hook({
          type: "object",
          properties: { count: base },
          anyOf: [{ type: "object", properties: { count: branch } }],
        }).anyOf;

      expect(narrowed({ type: "number", minimum: 0 }, { type: "integer" })).toEqual([
        { type: "object", properties: { count: { type: "integer", minimum: 0 } } },
      ]);
      expect(narrowed({ type: "integer" }, { type: "number", maximum: 9 })).toEqual([
        { type: "object", properties: { count: { type: "integer", maximum: 9 } } },
      ]);
    })
  );

  it.effect("rejects sibling property intersections it cannot express", () =>
    Effect.gen(function* () {
      const hook = composeTransforms(["intersectSiblingProperties"], {});
      const overlap = (base: JsonSchema.JsonSchema, branch: unknown): JsonSchema.JsonSchema => ({
        type: "object",
        properties: { name: base },
        anyOf: [branch],
      });

      const unsatisfiable = yield* transformFailure(() =>
        hook(overlap({ type: "string" }, { type: "object", properties: { name: { type: "number" } } }))
      );
      expect(unsatisfiable.transform).toBe("intersectSiblingProperties");
      expect(unsatisfiable.message).toContain("Unsatisfiable overlapping property name");

      const conflict = yield* transformFailure(() =>
        hook(
          overlap(
            { type: "string", maxLength: 3 },
            { type: "object", properties: { name: { type: "string", maxLength: 5 } } }
          )
        )
      );
      expect(conflict.message).toContain("conflicting constraint maxLength on overlapping property name");

      for (const [property, message] of [
        [true, "expected an object schema"],
        [{ type: "string", anyOf: [{ type: "string" }] }, "anyOf with sibling constraints"],
        [{ anyOf: [true] }, "expected object alternatives"],
        [{ $ref: "#/$defs/Name" }, "$ref alternatives"],
      ] as const) {
        const failure = yield* transformFailure(() =>
          hook(overlap({ type: "string" }, { type: "object", properties: { name: property } }))
        );
        expect(failure.transform).toBe("intersectSiblingProperties");
        expect(failure.message).toContain(message);
      }

      const reference = yield* transformFailure(() =>
        hook({
          type: "object",
          properties: { name: { type: "string" } },
          anyOf: [{ $ref: "#/$defs/Named" }, { type: "object", properties: { name: { const: "x" } } }],
        })
      );
      expect(reference.message).toContain("expected an inline object schema");

      const narrowName = (base: unknown, branch: unknown) =>
        transformFailure(() =>
          hook({
            type: "object",
            properties: { name: base },
            anyOf: [{ type: "object", properties: { name: branch } }],
          })
        );

      const nonObject = yield* narrowName(true, { type: "string" });
      expect(nonObject.transform).toBe("intersectSiblingProperties");
      expect(nonObject.message).toContain("Unsupported overlapping property name: expected an object schema");

      const constrainedUnion = yield* narrowName(
        { anyOf: [{ type: "string" }, { type: "null" }], maxLength: 3 },
        { type: "string" }
      );
      expect(constrainedUnion.message).toContain(
        "Unsupported overlapping property name: anyOf with sibling constraints"
      );

      const nonObjectAlternative = yield* narrowName({ anyOf: [true, { type: "null" }] }, { type: "string" });
      expect(nonObjectAlternative.message).toContain(
        "Unsupported overlapping property name: expected object alternatives"
      );

      const baseReference = yield* narrowName({ $ref: "#/$defs/Name" }, { type: "string" });
      expect(baseReference.message).toContain("Unsupported overlapping property name: $ref alternatives");

      const branchReference = yield* narrowName({ type: "string" }, { $ref: "#/$defs/Name" });
      expect(branchReference.message).toContain("Unsupported overlapping property name: $ref alternatives");
    })
  );

  it.effect("drops disjoint const alternatives and keeps branches that repeat the base property", () =>
    Effect.sync(() => {
      const hook = composeTransforms(["intersectSiblingProperties"], {});

      expect(
        hook({
          type: "object",
          properties: { kind: { anyOf: [{ const: "a" }, { const: "b" }], description: "Kind." } },
          anyOf: [
            { type: "object", properties: { kind: { const: "a" } } },
            { type: "object", properties: { kind: { anyOf: [{ const: "a" }, { const: "b" }], description: "Kind." } } },
          ],
        })
      ).toEqual({
        type: "object",
        properties: {},
        anyOf: [
          { type: "object", properties: { kind: { description: "Kind.", const: "a" } } },
          { type: "object", properties: { kind: { anyOf: [{ const: "a" }, { const: "b" }], description: "Kind." } } },
        ],
      });
    })
  );

  it.effect("generates the ACP transform set end to end and wraps transform failures", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const acpConfig = GenerateConfig.make({ ...config("acp.gen.ts"), transforms: acpTransforms });
      yield* Effect.logInfo("Codegen stage: generate");
      const raw = yield* kit.generate({ $defs: elicitationDefinitions }, acpConfig);

      expect(raw).toContain("export const CreateElicitationRequest");
      expect(raw).not.toContain("Schema.Never");
      expect(raw).not.toContain('mode: "oneOf"');
      expect(raw).toContain("(?!(?:form|url)$)");

      const idleConfig = GenerateConfig.make({ ...config("idle.gen.ts"), transforms: acpTransforms });
      const idle = yield* kit.postProcess(
        yield* kit.generate({ $defs: { IdleStateUpdate: idleStateUpdate } }, idleConfig),
        idleConfig
      );
      expect(idle).toContain('"stopReason": S.tag("end_turn")');
      expect(idle).toContain('"stopReason": S.optionalKey(S.Null)');

      const failure = yield* kit
        .generate({ $defs: { Closed: { type: "object", unevaluatedProperties: false } } }, acpConfig)
        .pipe(Effect.flip);
      expect(failure._tag).toBe("CodegenGenerateError");
      expect(isTransformError(failure.cause)).toBe(true);
    })
  );

  it.effect("reports transform failures on OpenAPI formats as typed generate errors", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const formats: ReadonlyArray<GenerateConfig["format"]> = ["httpclient", "httpapi", "type-only"];
      yield* Effect.logInfo("Codegen stage: generate");
      const failures = yield* Effect.forEach(formats, (format) =>
        kit
          .generate(
            closedOpenApi,
            GenerateConfig.make({
              packageName: "@beep/codegen-kit-fixture",
              name: "ClosedApi",
              identity: { composer: "$CodegenKitId", moduleId: "fixture/ClosedApi.gen" },
              source: { _tag: "file", path: "closed.json" },
              dialect: "openapi-3.1",
              transforms: ["unevaluatedPropertiesOpen"],
              format,
              output: { path: "ClosedApi.gen.ts" },
            })
          )
          .pipe(Effect.flip)
      );

      expect(A.map(failures, (failure) => failure._tag)).toEqual([
        "CodegenGenerateError",
        "CodegenGenerateError",
        "CodegenGenerateError",
      ]);
      expect(A.map(failures, (failure) => isTransformError(failure.cause))).toEqual([true, true, true]);
      expect(A.map(failures, (failure) => failure.message)).toEqual([
        "Could not generate httpclient for @beep/codegen-kit-fixture",
        "Could not generate httpapi for @beep/codegen-kit-fixture",
        "Could not generate type-only for @beep/codegen-kit-fixture",
      ]);
    })
  );

  it.effect("points generic HTTP export examples at a configured import specifier", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const httpConfig = GenerateConfig.make({
        packageName: "@beep/codegen-kit-fixture",
        identity: { composer: "$CodegenKitId", moduleId: "fixture/v1/http.gen" },
        source: { _tag: "file", path: "fixture.json" },
        dialect: "openapi-3.1",
        format: "httpapi",
        output: { path: "v1/http.gen.ts", exampleImport: "@beep/codegen-kit-fixture/v1" },
      });
      const raw = A.join(
        [
          'import * as Effect from "effect/Effect";',
          'import { HttpApi } from "effect/http-api";',
          'export class Api extends HttpApi.make("fixture") {}',
          "export const make = Effect.succeed(Api);",
        ],
        "\n"
      );
      const output = yield* kit.postProcess(raw, httpConfig);

      expect(output).toContain('import { Api } from "@beep/codegen-kit-fixture/v1"');
      expect(output).toContain('import { make } from "@beep/codegen-kit-fixture/v1"');
      expect(output).not.toContain('from "@beep/codegen-kit-fixture"');
    })
  );

  it.effect("renders generated examples against a configured import specifier", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
      const generateConfig = GenerateConfig.make({
        ...config("schema-v1.gen.ts"),
        output: { path: "schema-v1.gen.ts", exampleImport: "@beep/codegen-kit-fixture/schema-v1" },
      });
      const output = yield* kit.postProcess(rawSchemaModule, generateConfig);

      expect(output).toContain('import { Example } from "@beep/codegen-kit-fixture/schema-v1"');
      expect(output).toContain('import type { Example } from "@beep/codegen-kit-fixture/schema-v1"');
      expect(output).not.toContain('from "@beep/codegen-kit-fixture/schema"');
    })
  );

  it.effect("collects drift reports from every config before failing", () =>
    Effect.gen(function* () {
      const directory = yield* Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs.makeTempDirectoryScoped({ directory: import.meta.dirname, prefix: "codegen-kit-test-" })
      );

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kit = yield* CodegenKit;
      const specPath = path.join(directory, "schema.json");
      yield* writeJson(specPath, {
        $defs: { Widget: { type: "object", properties: { score: { type: "number" } }, required: ["score"] } },
      });
      const configFor = (name: string) =>
        GenerateConfig.make({
          packageName: "@beep/codegen-kit-fixture",
          identity: { composer: "$CodegenKitId", moduleId: `fixture/${name}.gen` },
          source: { _tag: "file", path: specPath },
          dialect: "json-schema-2020-12",
          format: "schemas",
          output: { path: path.join(directory, `${name}.gen.ts`) },
        });
      const first = configFor("first");
      const second = configFor("second");

      yield* Effect.logInfo("Codegen stage: format/write-or-drift-check");
      const written = yield* kit.runAll([first, second], "write");
      expect(written).toEqual([]);
      expect(yield* kit.runAll([first, second], "check")).toHaveLength(2);

      yield* fs.writeFileString(first.output.path, "export const stale = 1;\n");
      yield* fs.writeFileString(second.output.path, "export const stale = 2;\n");
      const failure = yield* kit.runAll([first, second], "check").pipe(Effect.flip);
      const printed = pipe(yield* TestConsole.errorLines, A.filter(P.isString), A.join("\n"));

      expect(failure._tag).toBe("CodegenDriftError");
      const drifted = failure._tag === "CodegenDriftError" ? failure.reports : [];
      expect(A.map(drifted, (report) => [report.path, report.status])).toEqual([
        [first.output.path, "changed"],
        [second.output.path, "changed"],
      ]);
      expect(printed).toContain("-export const stale = 1;");
      expect(printed).toContain("-export const stale = 2;");
    })
  );
});
