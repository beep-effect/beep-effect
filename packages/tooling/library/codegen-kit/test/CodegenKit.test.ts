import { CodegenKit, GenerateConfig, GeneratedModule } from "@beep/codegen-kit";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { FetchHttpClient } from "effect/unstable/http";

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

const rawSchemaModule = [
  "const __recursive_Example = Schema.suspend((): Schema.Schema<Example> => Example);",
  "export type Example = Schema.Schema.Type<typeof Example>;",
  'export const Example = Schema.Struct({ count: Schema.Number.annotate({ description: "count" }), index: Schema.Number.check(Schema.isInt()) }).annotate({ title: "Example", description: "top level" });',
].join("\n");

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

const withTempDirectory = <A, E, R>(use: (directory: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (directory) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(directory, { recursive: true, force: true }))
  );

layer(CodegenKitTestLayer)("@beep/codegen-kit", (it) => {
  it.effect("repairs ACP ContentBlock and SessionUpdate variant schemas", () =>
    Effect.gen(function* () {
      const kit = yield* CodegenKit;
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
      expect(output).toContain("SchemaUtils.withCodecStatics");
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

      expect(output).toContain("export class Example extends S.Class<Example>($I`Example`)(");
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
      const raw = [
        'import { Effect, Schema } from "effect";',
        'import { HttpApi, HttpApiSchema } from "effect/unstable/httpapi";',
        'import { unused } from "fixture";',
        'export class Api extends HttpApi.make("fixture") {}',
        "export const make = Effect.succeed(Api);",
        "export const NotFound = HttpApiSchema.Empty(404);",
      ].join("\n");
      const output = yield* kit.postProcess(raw, httpConfig);

      expect(output).toContain("@packageDocumentation");
      expect(output).toContain("Do not edit manually");
      expect(output).toContain('import { Effect } from "effect";');
      expect(output).not.toContain('from "fixture"');
      expect(output).toContain("**Example** (Inspect Api)");
      expect(output).toContain("**Example** (Inspect make)");
      expect(output).toContain("**Example** (Inspect NotFound)");
      expect(output).toContain("HttpApiSchema.Empty(404)");
      expect(output).not.toContain("HttpApiS.Empty");
      expect(output).toContain("@category tools");
      expect(output).toContain("@since 0.0.0");
    })
  );

  it.effect("runs a patched Swagger 2.0 HttpApi document end to end", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (directory) {
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

        yield* kit.run(generateConfig, "write");
        const output = yield* fs.readFileString(outputPath);

        expect(output).toContain("export class SwaggerApi extends HttpApi.make");
        expect(output).toContain("S.Int");
        expect(output).toContain("S.Finite");
        expect(output).toContain("S.Array(S.String).pipe(S.optionalKey)");
        expect(output).not.toContain("S.Number");
        expect(output).toContain("**Example** (Inspect SwaggerApi)");
      })
    )
  );

  it.effect("runs an OpenAPI 3.0 HttpApi document end to end", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (directory) {
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

        yield* kit.run(generateConfig, "write");
        const output = yield* fs.readFileString(outputPath);

        expect(output).toContain("export class OpenApiFixture extends HttpApi.make");
        expect(output).toContain("S.Finite");
        expect(output).not.toContain("HttpApiMiddleware");
        expect(output).not.toContain("HttpApiSecurity");
        expect(output).toContain("@since 0.0.0");
      })
    )
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
      const output = yield* kit.generate(warningOpenApi, logConfig);
      const warnings = pipe(yield* TestConsole.errorLines, A.filter(P.isString), A.join("\n"));

      expect(output).toContain("export class WarningApi extends HttpApi.make");
      expect(warnings).toContain("WARNING [cookie-parameter-dropped]");
    })
  );

  it.effect("prints a unified diff when check mode detects drift", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (directory: string) {
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

        const failure = yield* kit.run(generateConfig, "check").pipe(Effect.flip);
        const printed = pipe(yield* TestConsole.errorLines, A.filter(P.isString), A.join("\n"));

        expect(failure._tag).toBe("CodegenDriftError");
        expect(printed).toContain(`--- ${outputPath}`);
        expect(printed).toContain("+++ generated");
        expect(printed).toContain("-export const stale = true;");
        expect(printed).toContain("+/**");
      })
    )
  );

  it.effect("reports clean, changed, and missing generated outputs", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (directory) {
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
    )
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
      const raw = yield* kit.generate(tiny, generateConfig);
      const rendered = yield* kit.postProcess(raw, generateConfig);

      expect(rendered).toContain("export const Widget = S.Struct");
      expect(rendered).toContain('"score": S.Finite');
      expect(rendered).toContain("export type Widget = typeof Widget.Type;");
      expect(rendered).toContain('from "@beep/identity"');
    })
  );
});
