import { CodegenKit, GenerateConfig, GeneratedModule } from "@beep/codegen-kit";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type * as S from "effect/Schema";

const platform = Layer.merge(NodeServices.layer, FetchHttpClient.layer);
const CodegenKitTestLayer = Layer.merge(platform, CodegenKit.layer().pipe(Layer.provide(platform)));

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
      const output = yield* kit.postProcess(rawSchemaModule, config("schema.gen.ts"));

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
        'import { HttpApi } from "effect/unstable/httpapi";',
        'import { unused } from "fixture";',
        'export class Api extends HttpApi.make("fixture") {}',
        "export const make = Effect.succeed(Api);",
      ].join("\n");
      const output = yield* kit.postProcess(raw, httpConfig);

      expect(output).toContain('import { Effect } from "effect";');
      expect(output).not.toContain('from "fixture"');
      expect(output).toContain("**Example** (Inspect Api)");
      expect(output).toContain("**Example** (Inspect make)");
      expect(output).toContain("@category tools");
      expect(output).toContain("@since 0.0.0");
    })
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
