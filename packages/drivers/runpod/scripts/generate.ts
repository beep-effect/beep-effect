#!/usr/bin/env bun

import { $RunpodId } from "@beep/identity";
import { LiteralKit, MappedLiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str, Struct } from "@beep/utils";
import * as OpenApiPatch from "@effect/openapi-generator/OpenApiPatch";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Match, Order, pipe, Stream } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const $I = $RunpodId.create("scripts/generate");

const RunpodGeneratorHttpMethod = MappedLiteralKit([
  ["get", "GET"],
  ["post", "POST"],
  ["patch", "PATCH"],
  ["put", "PUT"],
  ["delete", "DELETE"],
]);
type HttpMethod = typeof RunpodGeneratorHttpMethod.Type;
const OperationRequestBodyKind = LiteralKit(["json", "none"]);
const OperationResponseBodyKind = LiteralKit(["json", "none", "text"]);
type OperationResponseBodyKind = typeof OperationResponseBodyKind.Type;

const JsonSchemaRef = S.suspend((): S.Codec<JsonSchema, JsonSchema> => JsonSchema);

class JsonSchema extends S.Class<JsonSchema>($I`JsonSchema`)(
  {
    $ref: S.optionalKey(S.String),
    type: S.optionalKey(S.Union([S.String, S.Array(S.String)])),
    format: S.optionalKey(S.String),
    enum: S.Array(S.Unknown).pipe(S.optionalKey),
    items: JsonSchemaRef.pipe(S.optionalKey),
    nullable: S.optionalKey(S.Boolean),
    properties: S.Record(S.String, JsonSchemaRef).pipe(S.optionalKey),
    required: S.Array(S.String).pipe(S.optionalKey),
    additionalProperties: S.Union([JsonSchemaRef, S.Boolean]).pipe(S.optionalKey),
  },
  $I.annote("JsonSchema", {
    description: "JSON Schema subset consumed by the Runpod OpenAPI generator.",
  })
) {}

const StringJsonSchema = JsonSchema.make({ type: "string" });
const UnknownJsonSchema = JsonSchema.make({ type: "unknown" });

class OpenApiParameter extends S.Class<OpenApiParameter>($I`OpenApiParameter`)(
  {
    name: S.String,
    in: S.Literals(["path", "query", "header", "cookie"]),
    required: S.optionalKey(S.Boolean),
    schema: S.optionalKey(JsonSchema),
  },
  $I.annote("OpenApiParameter", {
    description: "OpenAPI parameter subset consumed by the Runpod generator.",
  })
) {}

class OpenApiMedia extends S.Class<OpenApiMedia>($I`OpenApiMedia`)(
  {
    schema: S.optionalKey(JsonSchema),
  },
  $I.annote("OpenApiMedia", {
    description: "OpenAPI media object subset consumed by the Runpod generator.",
  })
) {}

class OpenApiRequestBody extends S.Class<OpenApiRequestBody>($I`OpenApiRequestBody`)(
  {
    content: S.optionalKey(S.Record(S.String, OpenApiMedia)),
    required: S.optionalKey(S.Boolean),
  },
  $I.annote("OpenApiRequestBody", {
    description: "OpenAPI request body subset consumed by the Runpod generator.",
  })
) {}

class OpenApiResponse extends S.Class<OpenApiResponse>($I`OpenApiResponse`)(
  {
    content: S.optionalKey(S.Record(S.String, OpenApiMedia)),
  },
  $I.annote("OpenApiResponse", {
    description: "OpenAPI response subset consumed by the Runpod generator.",
  })
) {}

class OpenApiOperation extends S.Class<OpenApiOperation>($I`OpenApiOperation`)(
  {
    operationId: S.String,
    summary: S.optionalKey(S.String),
    description: S.optionalKey(S.String),
    tags: S.String.pipe(S.Array, S.optionalKey),
    parameters: S.Array(OpenApiParameter).pipe(SchemaUtils.withEmptyArrayDefaults<OpenApiParameter>()),
    requestBody: S.optionalKey(OpenApiRequestBody),
    responses: S.Record(S.String, OpenApiResponse).pipe(SchemaUtils.withKeyDefaults(R.empty())),
    security: S.Record(S.String, S.Array(S.String)).pipe(S.Array, S.optionalKey),
  },
  $I.annote("OpenApiOperation", {
    description: "OpenAPI operation subset consumed by the Runpod generator.",
  })
) {}

class OpenApiPathItem extends S.Class<OpenApiPathItem>($I`OpenApiPathItem`)(
  {
    get: S.optionalKey(OpenApiOperation),
    post: S.optionalKey(OpenApiOperation),
    patch: S.optionalKey(OpenApiOperation),
    put: S.optionalKey(OpenApiOperation),
    delete: S.optionalKey(OpenApiOperation),
    parameters: S.Array(OpenApiParameter).pipe(SchemaUtils.withEmptyArrayDefaults<OpenApiParameter>()),
  },
  $I.annote("OpenApiPathItem", {
    description: "OpenAPI path item subset consumed by the Runpod generator.",
  })
) {}

class OpenApiComponents extends S.Class<OpenApiComponents>($I`OpenApiComponents`)(
  {
    schemas: S.Record(S.String, JsonSchema).pipe(SchemaUtils.withKeyDefaults(R.empty())),
  },
  $I.annote("OpenApiComponents", {
    description: "OpenAPI components subset consumed by the Runpod generator.",
  })
) {}

class OpenApiDocument extends S.Class<OpenApiDocument>($I`OpenApiDocument`)(
  {
    openapi: S.String,
    paths: S.Record(S.String, OpenApiPathItem),
    components: S.optionalKey(OpenApiComponents),
    security: S.Record(S.String, S.Array(S.String)).pipe(S.Array, S.optionalKey),
  },
  $I.annote("OpenApiDocument", {
    description: "Runpod OpenAPI document subset consumed by the generator.",
  })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(OpenApiDocument);
}

class RunpodGeneratorError extends S.TaggedError<RunpodGeneratorError>($I`RunpodGeneratorError`)(
  "RunpodGeneratorError",
  {
    message: S.String,
  },
  $I.annoteError<RunpodGeneratorError>("RunpodGeneratorError", {
    description: "A Runpod code-generation step failed.",
  })
) {}

type Operation = {
  readonly descriptorName: string;
  readonly hasRequiredRequest: boolean;
  readonly method: HttpMethod;
  readonly methodName: string;
  readonly operationId: string;
  readonly path: string;
  readonly requestBodyRequired: boolean;
  readonly requestClassName: string;
  readonly requestFields: readonly RequestField[];
  readonly responseBody: OperationResponseBodyKind;
  readonly responseSchemaExpression: string | undefined;
  readonly responseSchemaName: string | undefined;
  readonly responseTypeExpression: string;
  readonly status: string;
  readonly summary: string | undefined;
};

type RequestField = {
  readonly name: string;
  readonly required: boolean;
  readonly schemaExpression: string;
};

type Component = {
  readonly code: string;
  readonly name: string;
};

const repoRoot = new URL("../../..", import.meta.url);
const workspaceRoot = new URL("../../../../", import.meta.url).pathname;
const packageRoot = new URL("../", import.meta.url);
const openApiPath = new URL("openapi.json", packageRoot);
const openApiPatchPath = new URL("openapi.patch.json", packageRoot);
const generatedPath = new URL("src/_generated/Runpod.generated.ts", packageRoot);
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Json));

const HTTP_METHODS = RunpodGeneratorHttpMethod.From.Options;
const DYNAMIC_ENUM_HINTS = [
  "accelerator",
  "cpuFlavor",
  "cuda",
  "dataCenter",
  "dataCenterId",
  "gpuType",
  "gpuTypeId",
] as const;

let advisoryEnums: Record<string, readonly string[]> = {};

const main = Effect.gen(function* () {
  const raw = yield* Effect.tryPromise(() => Bun.file(openApiPath).text());
  const spec = yield* decodeJson(raw);
  const patch = yield* OpenApiPatch.parsePatchInput(openApiPatchPath.pathname);
  const patchedSpec = yield* OpenApiPatch.applyPatches([{ source: "openapi.patch.json", patch }], spec);
  const document = yield* OpenApiDocument.decodeUnknownEffect(patchedSpec);
  const components = document.components?.schemas ?? {};
  const operations = buildOperations(document);
  const rendered = renderGeneratedFile({
    components: pipe(
      Struct.entries(components),
      A.map(([name, schema]) => renderComponent(name, schema))
    ),
    operations,
  });
  const code = yield* formatWithBiome(rendered);
  const check = pipe(Bun.argv, A.contains("--check"));

  if (check) {
    const current = yield* Effect.tryPromise(() => Bun.file(generatedPath).text());
    if (!Str.Equivalence(current, code)) {
      return yield* RunpodGeneratorError.make({
        message: "Generated Runpod module is stale. Run `bun run generate`.",
      });
    }
    return yield* Effect.log("Runpod generated module is current.");
  }

  yield* Effect.tryPromise(() => Bun.write(generatedPath, code));
  yield* Effect.log(
    `Generated ${A.length(operations)} Runpod operations at ${pipe(generatedPath.pathname, Str.replace(repoRoot.pathname, ""))}`
  );
}).pipe(Effect.withSpan("Runpod.generate"));

const formatWithBiome = Effect.fn("RunpodGenerator.formatWithBiome")(function* (source: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const formatted = yield* spawner
    .string(
      ChildProcess.make("biome", ["check", "--write", "--unsafe", "--stdin-file-path", generatedPath.pathname], {
        cwd: workspaceRoot,
        stdin: Stream.make(source).pipe(Stream.encodeText),
        stderr: "inherit",
        stdout: "pipe",
      })
    )
    .pipe(
      Effect.mapError((error) =>
        RunpodGeneratorError.make({ message: `Biome failed for Runpod.generated.ts: ${error.message}` })
      )
    );

  if (Str.isEmpty(formatted)) {
    return yield* RunpodGeneratorError.make({ message: "Biome returned empty Runpod generator output." });
  }
  return formatted;
});

const buildOperations = (document: OpenApiDocument): readonly Operation[] => {
  let methodCounts: Record<string, number> = {};
  let operations: readonly Operation[] = [];

  for (const [path, pathItem] of Struct.entries(document.paths)) {
    for (const openApiMethod of HTTP_METHODS) {
      const operation = pathItem[openApiMethod];
      if (operation === undefined) {
        continue;
      }

      const method = RunpodGeneratorHttpMethod.Enum[openApiMethod];
      const baseMethodName = lowerFirst(operation.operationId);
      const disambiguated = disambiguateMethodName({
        baseMethodName,
        method,
        methodCounts,
        path,
      });
      methodCounts = disambiguated.methodCounts;
      const methodName = disambiguated.methodName;
      const requestClassName = `${upperFirst(methodName)}Request`;
      const descriptorName = `${methodName}Operation`;
      const parameters = mergeParameters(pathItem.parameters, operation.parameters);
      const bodySchema = operation.requestBody?.content?.["application/json"]?.schema;
      const requestBodyRequired = operation.requestBody?.required === true;
      const requestFields = renderRequestFields(parameters, bodySchema, requestBodyRequired);
      const response = chooseResponse(methodName, operation.responses);
      const operationId = stableOperationId(operation.operationId, method, path);

      operations = A.append(operations, {
        descriptorName,
        hasRequiredRequest: pipe(
          requestFields,
          A.some((field) => field.required)
        ),
        method,
        methodName,
        operationId,
        path,
        requestBodyRequired,
        requestClassName,
        requestFields,
        responseBody: response.body,
        responseSchemaExpression: response.schemaExpression,
        responseSchemaName: response.schemaName,
        responseTypeExpression: response.typeExpression,
        status: response.status,
        summary: operation.summary,
      });
    }
  }

  return operations;
};

const stableOperationId = (operationId: string, method: HttpMethod, path: string): string =>
  method === "POST" && pipe(path, Str.endsWith("/update")) && pipe(operationId, Str.endsWith("ViaPost"))
    ? pipe(operationId, Str.slice(0, -"ViaPost".length))
    : operationId;

const disambiguateMethodName = (input: {
  readonly baseMethodName: string;
  readonly method: HttpMethod;
  readonly methodCounts: Record<string, number>;
  readonly path: string;
}): {
  readonly methodCounts: Record<string, number>;
  readonly methodName: string;
} => {
  const count = pipe(
    input.methodCounts,
    R.get(input.baseMethodName),
    O.getOrElse(() => 0)
  );
  const methodCounts = R.set(input.methodCounts, input.baseMethodName, count + 1);

  if (count === 0) {
    return {
      methodCounts,
      methodName: input.baseMethodName,
    };
  }

  if (input.method === "POST" && pipe(input.path, Str.endsWith("/update"))) {
    return {
      methodCounts,
      methodName: `${input.baseMethodName}ViaPost`,
    };
  }

  return {
    methodCounts,
    methodName: `${input.baseMethodName}${count + 1}`,
  };
};

const renderRequestFields = (
  parameters: readonly OpenApiParameter[],
  bodySchema?: JsonSchema,
  bodyRequired = false
): readonly RequestField[] => {
  const fields = pipe(
    parameters,
    A.filter((parameter) => parameter.in === "path" || parameter.in === "query"),
    A.map((parameter) => ({
      name: parameter.name,
      required: parameter.in === "path" || parameter.required === true,
      schemaExpression: schemaExpression(parameter.schema ?? StringJsonSchema, parameter.name),
    }))
  );

  return bodySchema === undefined
    ? fields
    : A.append(fields, {
        name: "body",
        required: bodyRequired,
        schemaExpression: schemaExpression(bodySchema, "body"),
      });
};

const mergeParameters = (
  pathParameters: readonly OpenApiParameter[],
  operationParameters: readonly OpenApiParameter[]
): readonly OpenApiParameter[] =>
  pipe(
    operationParameters,
    A.appendAll(pathParameters),
    A.dedupeWith((left, right) => left.name === right.name && left.in === right.in)
  );

const chooseResponse = (
  methodName: string,
  responses: Record<string, OpenApiResponse>
): {
  readonly body: OperationResponseBodyKind;
  readonly schemaExpression?: string;
  readonly schemaName?: string;
  readonly status: string;
  readonly typeExpression: string;
} => {
  const status = pipe(
    ["200", "201", "202", "204"],
    A.findFirst((candidate) => responses[candidate] !== undefined)
  );
  const selectedStatus = pipe(
    status,
    O.getOrElse(() =>
      pipe(
        Struct.keys(responses),
        A.head,
        O.getOrElse(() => "200")
      )
    )
  );
  const response = responses[selectedStatus];
  const content = response?.content ?? {};
  const jsonSchema = content["application/json"]?.schema;
  const textSchema = content["text/plain"]?.schema ?? content["text/html"]?.schema ?? content["text/markdown"]?.schema;

  if (jsonSchema !== undefined) {
    const refName = refNameFromSchema(jsonSchema);
    if (O.isSome(refName)) {
      return {
        body: OperationResponseBodyKind.Enum.json,
        schemaExpression: refName.value,
        status: selectedStatus,
        typeExpression: refName.value,
      };
    }

    const schemaName = `${upperFirst(methodName)}Status${selectedStatus}Response`;
    return {
      body: OperationResponseBodyKind.Enum.json,
      schemaExpression: schemaExpression(jsonSchema, schemaName),
      schemaName,
      status: selectedStatus,
      typeExpression: schemaName,
    };
  }

  if (textSchema !== undefined || R.has(content, "text/html")) {
    return {
      body: OperationResponseBodyKind.Enum.text,
      schemaExpression: "S.String",
      schemaName: `${upperFirst(methodName)}Status${selectedStatus}TextResponse`,
      status: selectedStatus,
      typeExpression: "string",
    };
  }

  return {
    body: OperationResponseBodyKind.Enum.none,
    status: selectedStatus,
    typeExpression: "void",
  };
};

const renderGeneratedFile = (input: {
  readonly components: readonly Component[];
  readonly operations: readonly Operation[];
}): string => {
  let responseSchemas: Record<string, string> = {};
  for (const operation of input.operations) {
    if (operation.responseSchemaName !== undefined && operation.responseSchemaExpression !== undefined) {
      responseSchemas = R.set(responseSchemas, operation.responseSchemaName, operation.responseSchemaExpression);
    }
  }

  return `${renderHeader()}

${pipe(
  input.components,
  A.map((component) => component.code),
  A.join("\n\n")
)}

${renderAdvisoryEnums()}

${pipe(
  Struct.entries(responseSchemas),
  A.map(([name, expression]) => renderSchemaAlias(name, expression)),
  A.join("\n\n")
)}

${pipe(input.operations, A.map(renderRequestClass), A.join("\n\n"))}

${renderOperationDescriptorClass(input.operations)}

${pipe(input.operations, A.map(renderOperationDescriptor), A.join("\n\n"))}

${renderOperationSpecs(input.operations)}

${renderOperationsShape(input.operations)}
`;
};

const renderHeader = (): string => `/**
 * Generated Runpod REST schemas and operation descriptors.
 * Do not edit this file by hand.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { pipe, type Effect } from "effect";
import * as S from "effect/Schema";

import { $RunpodId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";

const $I = $RunpodId.create("Runpod.generated");
`;

// fallow-ignore-next-line code-duplication -- OpenAPI property-field template is shared with nested struct emission in this codegen script; jsdoc-carrier migration only rewrote comment carriers and Fallow attributes the pre-existing twin as introduced
const renderComponent = (name: string, schema: JsonSchema): Component => {
  if (schema.type === "object" || schema.properties !== undefined) {
    const required = pipe(schema.required, O.fromUndefinedOr, O.getOrElse(A.empty<string>));
    const properties = Struct.entries(schema.properties ?? {});
    const fields = pipe(
      properties,
      A.map(([propertyName, propertySchema]) => {
        const expression = schemaExpression(propertySchema, propertyName);
        const renderedExpression = pipe(required, A.contains(propertyName))
          ? expression
          : optionalExpression(expression);

        return `    ${propertyName}: ${renderedExpression},`;
      })
    );

    return {
      code: `/**
 * ${name} model returned by the Runpod REST API.
 *
 * **Example** (Inspect the ${name} schema)
 *
 * \`\`\`ts
 * import { ${name} } from "@beep/runpod"
 *
 * console.log(${name}.ast)
 * \`\`\`
 *
 * @category models
 * @since 0.1.0
 */
export class ${name} extends S.Class<${name}>($I\`${name}\`)(
  {
${pipe(fields, A.join("\n"))}
  },
  $I.annote("${name}", {
    description: "${name} model returned by the Runpod REST API.",
  })
) {}`,
      name,
    };
  }

  return {
    code: renderSchemaAlias(name, schemaExpression(schema, name)),
    name,
  };
};

const isLiteralKitExpression: (expression: string) => boolean = Str.startsWith("LiteralKit(");

const isMultilineArrayPipeExpression = (expression: string): boolean =>
  pipe(expression, Str.endsWith(".pipe(S.Array)")) && pipe(expression, Str.includes("\n"));

const renderLiteralKitAliasExpression = (name: string, annotation: string): string => `${name}Base.pipe(
  ${annotation},
  SchemaUtils.withLiteralKitStatics(${name}Base),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
)`;

const renderArrayAliasExpression = (expression: string, annotation: string): string => `pipe(
  ${Str.slice(0, -".pipe(S.Array)".length)(expression)},
  S.Array,
  ${annotation},
  SchemaUtils.withCodecStatics,
)`;

const renderAliasExpressionWithAnnotation = (name: string, expression: string, annotation: string): string =>
  Match.value(expression).pipe(
    Match.when(isLiteralKitExpression, () => renderLiteralKitAliasExpression(name, annotation)),
    Match.when(isMultilineArrayPipeExpression, (value) => renderArrayAliasExpression(value, annotation)),
    Match.orElse((value) => pipeExpression(pipeExpression(value, annotation), "SchemaUtils.withCodecStatics"))
  );

const renderLiteralKitBaseExpression = (name: string, expression: string): string =>
  pipe(
    expression,
    O.liftPredicate(isLiteralKitExpression),
    O.match({
      onNone: () => "",
      onSome: (value) => `const ${name}Base = ${value};\n`,
    })
  );

const renderSchemaAlias = (name: string, expression: string): string => {
  const annotation = `$I.annoteSchema("${name}", {
    description: "${name} schema generated from the Runpod OpenAPI document.",
  })`;
  const expressionWithAnnotation = renderAliasExpressionWithAnnotation(name, expression, annotation);
  const baseExpression = renderLiteralKitBaseExpression(name, expression);

  return `/**
 * ${name} schema generated from the Runpod OpenAPI document.
 *
 * **Example** (Inspect the ${name} schema)
 *
 * \`\`\`ts
 * import { ${name} } from "@beep/runpod"
 *
 * console.log(${name}.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.1.0
 */
${baseExpression}
export const ${name} = ${expressionWithAnnotation};

/**
 * ${name} value generated from the Runpod OpenAPI document.
 *
 * **Example** (Reference the ${name} type)
 *
 * \`\`\`ts
 * import type { ${name} } from "@beep/runpod"
 *
 * type ${name}Value = ${name}
 * \`\`\`
 *
 * @category type-level
 * @since 0.1.0
 */
export type ${name} = typeof ${name}.Type;`;
};

const renderAdvisoryEnums = (): string => {
  const entries = pipe(
    Struct.entries(advisoryEnums),
    A.sort(Order.mapInput(Str.Order, ([name]: readonly [string, readonly string[]]) => name))
  );

  if (A.isReadonlyArrayEmpty(entries)) {
    return "";
  }

  return pipe(
    entries,
    A.map(([name, values]) => {
      const constantName = `RUNPOD_${Str.screamingSnake(name)}_VALUES`;

      return `/**
 * Advisory ${name} values observed in the checked-in Runpod OpenAPI document.
 *
 * **Example** (Read the ${constantName} values)
 *
 * \`\`\`ts
 * import { ${constantName} } from "@beep/runpod"
 *
 * console.log(${constantName})
 * \`\`\`
 *
 * @category constants
 * @since 0.1.0
 */
export const ${constantName} = ${JSON.stringify(values)} as const;`;
    }),
    A.join("\n\n")
  );
};

const renderRequestClass = (operation: Operation): string => {
  const fields = pipe(
    operation.requestFields,
    A.map(
      (field) =>
        `    ${field.name}: ${field.required ? field.schemaExpression : optionalExpression(field.schemaExpression)},`
    )
  );

  return `/**
 * Request input for ${operation.operationId}.
 *
 * **Example** (Inspect the ${operation.requestClassName} schema)
 *
 * \`\`\`ts
 * import { ${operation.requestClassName} } from "@beep/runpod"
 *
 * console.log(${operation.requestClassName}.ast)
 * \`\`\`
 *
 * @category dtos
 * @since 0.1.0
 */
export class ${operation.requestClassName} extends S.Class<${operation.requestClassName}>($I\`${operation.requestClassName}\`)(
  {
${pipe(fields, A.join("\n"))}
  },
  $I.annote("${operation.requestClassName}", {
    description: "Request input for ${operation.operationId}.",
  })
) {}`;
};

const renderOperationDescriptorClass = (operations: readonly Operation[]): string => {
  const methods = unique(
    pipe(
      operations,
      A.map((operation) => operation.method)
    )
  );
  const operationIds = unique(
    pipe(
      operations,
      A.map((operation) => operation.operationId)
    )
  );

  return `const RunpodHttpMethodBase = LiteralKit(${JSON.stringify(methods)});
/**
 * Supported Runpod HTTP methods.
 *
 * **Example** (Inspect the RunpodHttpMethod schema)
 *
 * \`\`\`ts
 * import { RunpodHttpMethod } from "@beep/runpod"
 *
 * console.log(RunpodHttpMethod.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunpodHttpMethod = RunpodHttpMethodBase.pipe(
  $I.annoteSchema("RunpodHttpMethod", {
    description: "Supported Runpod HTTP methods.",
  }),
  SchemaUtils.withLiteralKitStatics(RunpodHttpMethodBase),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
);

/**
 * Supported Runpod HTTP method.
 *
 * **Example** (Reference the RunpodHttpMethod type)
 *
 * \`\`\`ts
 * import type { RunpodHttpMethod } from "@beep/runpod"
 *
 * type Method = RunpodHttpMethod
 * \`\`\`
 *
 * @category type-level
 * @since 0.1.0
 */
export type RunpodHttpMethod = typeof RunpodHttpMethod.Type;

const RunpodOperationIdBase = LiteralKit(${JSON.stringify(operationIds)});
/**
 * Operation ids exposed by Runpod REST API v1.
 *
 * **Example** (Inspect the RunpodOperationId schema)
 *
 * \`\`\`ts
 * import { RunpodOperationId } from "@beep/runpod"
 *
 * console.log(RunpodOperationId.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunpodOperationId = RunpodOperationIdBase.pipe(
  $I.annoteSchema("RunpodOperationId", {
    description: "Operation ids exposed by Runpod REST API v1.",
  }),
  SchemaUtils.withLiteralKitStatics(RunpodOperationIdBase),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
);

/**
 * Operation id exposed by Runpod REST API v1.
 *
 * **Example** (Reference the RunpodOperationId type)
 *
 * \`\`\`ts
 * import type { RunpodOperationId } from "@beep/runpod"
 *
 * type OperationId = RunpodOperationId
 * \`\`\`
 *
 * @category type-level
 * @since 0.1.0
 */
export type RunpodOperationId = typeof RunpodOperationId.Type;

const RunpodRequestBodyKindBase = LiteralKit(${JSON.stringify(OperationRequestBodyKind.Options)});
/**
 * Request body encoding used by a Runpod operation.
 *
 * **Example** (Inspect the RunpodRequestBodyKind schema)
 *
 * \`\`\`ts
 * import { RunpodRequestBodyKind } from "@beep/runpod"
 *
 * console.log(RunpodRequestBodyKind.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunpodRequestBodyKind = RunpodRequestBodyKindBase.pipe(
  $I.annoteSchema("RunpodRequestBodyKind", {
    description: "Request body encoding used by a Runpod operation.",
  }),
  SchemaUtils.withLiteralKitStatics(RunpodRequestBodyKindBase),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
);

/**
 * Request body encoding used by a Runpod operation.
 *
 * **Example** (Reference the RunpodRequestBodyKind type)
 *
 * \`\`\`ts
 * import type { RunpodRequestBodyKind } from "@beep/runpod"
 *
 * type RequestBodyKind = RunpodRequestBodyKind
 * \`\`\`
 *
 * @category type-level
 * @since 0.1.0
 */
export type RunpodRequestBodyKind = typeof RunpodRequestBodyKind.Type;

const RunpodResponseBodyKindBase = LiteralKit(${JSON.stringify(OperationResponseBodyKind.Options)});
/**
 * Response body decoding used by a Runpod operation.
 *
 * **Example** (Inspect the RunpodResponseBodyKind schema)
 *
 * \`\`\`ts
 * import { RunpodResponseBodyKind } from "@beep/runpod"
 *
 * console.log(RunpodResponseBodyKind.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunpodResponseBodyKind = RunpodResponseBodyKindBase.pipe(
  $I.annoteSchema("RunpodResponseBodyKind", {
    description: "Response body decoding used by a Runpod operation.",
  }),
  SchemaUtils.withLiteralKitStatics(RunpodResponseBodyKindBase),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
);

/**
 * Response body decoding used by a Runpod operation.
 *
 * **Example** (Reference the RunpodResponseBodyKind type)
 *
 * \`\`\`ts
 * import type { RunpodResponseBodyKind } from "@beep/runpod"
 *
 * type ResponseBodyKind = RunpodResponseBodyKind
 * \`\`\`
 *
 * @category type-level
 * @since 0.1.0
 */
export type RunpodResponseBodyKind = typeof RunpodResponseBodyKind.Type;

/**
 * Static metadata for one Runpod REST operation.
 *
 * **Example** (Inspect the RunpodOperationDescriptor schema)
 *
 * \`\`\`ts
 * import { RunpodOperationDescriptor } from "@beep/runpod"
 *
 * console.log(RunpodOperationDescriptor.ast)
 * \`\`\`
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodOperationDescriptor extends S.Class<RunpodOperationDescriptor>($I\`RunpodOperationDescriptor\`)(
  {
  authenticated: S.Boolean,
  method: RunpodHttpMethod,
  methodName: S.String,
  operationId: RunpodOperationId,
  path: S.String,
  pathParams: S.Array(S.String),
  queryParams: S.Array(S.String),
  requestBody: RunpodRequestBodyKind,
  requestBodyRequired: S.Boolean,
  responseBody: RunpodResponseBodyKind,
  status: S.String,
  },
  $I.annote("RunpodOperationDescriptor", {
    description: "Static metadata for one Runpod REST operation.",
  })
) {
  static readonly is = S.is(RunpodOperationDescriptor);
}`;
};

const renderOperationDescriptor = (operation: Operation): string => {
  const pathParams = pipe(
    operation.requestFields,
    A.filter((field) => pipe(operation.path, Str.includes(`{${field.name}}`))),
    A.map((field) => field.name)
  );
  const queryParams = pipe(
    operation.requestFields,
    A.filter((field) => field.name !== "body" && !pipe(operation.path, Str.includes(`{${field.name}}`))),
    A.map((field) => field.name)
  );

  return `/**
 * Descriptor for ${operation.operationId}.
 *
 * **Example** (Read the ${operation.descriptorName} path)
 *
 * \`\`\`ts
 * import { ${operation.descriptorName} } from "@beep/runpod"
 *
 * console.log(${operation.descriptorName}.path)
 * \`\`\`
 *
 * @category constants
 * @since 0.1.0
 */
export const ${operation.descriptorName} = RunpodOperationDescriptor.make({
  authenticated: ${operation.operationId === "GetOpenAPI" || operation.operationId === "GetDocs" ? "false" : "true"},
  method: "${operation.method}",
  methodName: "${operation.methodName}",
  operationId: "${operation.operationId}",
  path: "${operation.path}",
  pathParams: ${JSON.stringify(pathParams)},
  queryParams: ${JSON.stringify(queryParams)},
  requestBody: ${
    pipe(
      operation.requestFields,
      A.some((field) => field.name === "body")
    )
      ? JSON.stringify(OperationRequestBodyKind.Enum.json)
      : JSON.stringify(OperationRequestBodyKind.Enum.none)
  },
  requestBodyRequired: ${operation.requestBodyRequired ? "true" : "false"},
  responseBody: ${JSON.stringify(operation.responseBody)},
  status: "${operation.status}",
});`;
};

const renderOperationSpecs = (operations: readonly Operation[]): string => {
  const entries = pipe(
    operations,
    A.map((operation) => {
      const response = operation.responseSchemaName ?? operation.responseSchemaExpression;
      const responseField = response !== undefined ? `,\n    response: ${response}` : "";

      return `  ${operation.methodName}: {
    descriptor: ${operation.descriptorName},
    request: ${operation.requestClassName}${responseField},
  },`;
    })
  );

  return `/**
 * Generated operation spec table for Runpod service construction.
 *
 * **Example** (List the generated operation spec keys)
 *
 * \`\`\`ts
 * import { RUNPOD_OPERATION_SPECS } from "@beep/runpod"
 *
 * console.log(Object.keys(RUNPOD_OPERATION_SPECS))
 * \`\`\`
 *
 * @category constants
 * @since 0.1.0
 */
export const RUNPOD_OPERATION_SPECS = {
${pipe(entries, A.join("\n"))}
};`;
};

const renderOperationsShape = (operations: readonly Operation[]): string => {
  const methods = pipe(
    operations,
    A.map((operation) => {
      const requestParameter = operation.hasRequiredRequest
        ? `request: ${operation.requestClassName}`
        : `request?: ${operation.requestClassName}`;

      return `  readonly ${operation.methodName}: (${requestParameter}) => Effect.Effect<${operation.responseTypeExpression}, E>;`;
    })
  );

  return `/**
 * Typed method surface generated from Runpod REST API v1.
 *
 * **Example** (Reference the RunpodOperationsShape type)
 *
 * \`\`\`ts
 * import type { RunpodOperationsShape } from "@beep/runpod"
 *
 * type Operations = RunpodOperationsShape<never>
 * \`\`\`
 *
 * @category services
 * @since 0.1.0
 */
export interface RunpodOperationsShape<E> {
${pipe(methods, A.join("\n"))}
}`;
};

const schemaExpression = (schema: JsonSchema, hint: string): string => {
  const refName = refNameFromSchema(schema);
  if (O.isSome(refName)) {
    return wrapNullable(schema, `S.suspend(() => ${refName.value})`);
  }

  const values = pipe(schema.enum, O.fromUndefinedOr, O.getOrElse(A.empty<unknown>), A.filter(P.isString));
  if (A.isReadonlyArrayNonEmpty(values)) {
    if (shouldTrackAdvisoryEnum(hint)) {
      advisoryEnums = R.set(advisoryEnums, Str.camelCase(hint), values);

      return wrapNullable(schema, "S.String");
    }

    return wrapNullable(schema, `LiteralKit(${JSON.stringify(values)})`);
  }

  const type = P.isString(schema.type) ? schema.type : schema.type?.[0];

  return Match.type<string | undefined>().pipe(
    Match.when("array", () =>
      wrapNullable(schema, pipeExpression(schemaExpression(schema.items ?? UnknownJsonSchema, hint), "S.Array"))
    ),
    Match.when("boolean", () => wrapNullable(schema, "S.Boolean")),
    Match.when("integer", () => wrapNullable(schema, "S.Int")),
    Match.when("number", () => wrapNullable(schema, "S.Finite")),
    Match.when("object", () => {
      if (schema.properties !== undefined) {
        const required = pipe(schema.required, O.fromUndefinedOr, O.getOrElse(A.empty<string>));
        const properties = pipe(
          Struct.entries(schema.properties),
          A.map(([propertyName, propertySchema]) => {
            const expression = schemaExpression(propertySchema, propertyName);
            const renderedExpression = pipe(required, A.contains(propertyName))
              ? expression
              : optionalExpression(expression);

            return `    ${propertyName}: ${renderedExpression},`;
          })
        );

        return wrapNullable(schema, `S.Struct({\n${pipe(properties, A.join("\n"))}\n  })`);
      }

      if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
        const valueSchema =
          schema.additionalProperties === true ? "S.Unknown" : schemaExpression(schema.additionalProperties, hint);

        return wrapNullable(schema, `S.Record(S.String, ${valueSchema})`);
      }

      return wrapNullable(schema, "S.Record(S.String, S.Unknown)");
    }),
    Match.when("string", () => wrapNullable(schema, "S.String")),
    Match.orElse(() => wrapNullable(schema, "S.Unknown"))
  )(type);
};

const pipeExpression = (expression: string, operation: string): string => {
  const pipeMatch = /^([^\n]*\.pipe\()([\s\S]*)\)$/.exec(expression);

  return pipeMatch === null ? `${expression}.pipe(${operation})` : `${pipeMatch[1]}${pipeMatch[2]}, ${operation})`;
};

const optionalExpression = (expression: string): string => pipeExpression(expression, "S.optionalKey");

const wrapNullable = (schema: JsonSchema, expression: string): string =>
  schema.nullable === true ? pipeExpression(expression, "S.NullOr") : expression;

const refNameFromSchema = (schema: JsonSchema): O.Option<string> =>
  pipe(O.fromUndefinedOr(schema.$ref), O.map(Str.replace("#/components/schemas/", "")));

const shouldTrackAdvisoryEnum = (hint: string): boolean =>
  pipe(
    DYNAMIC_ENUM_HINTS,
    A.some((dynamicHint) => pipe(hint, Str.toLowerCase, Str.includes(pipe(dynamicHint, Str.toLowerCase))))
  );

const lowerFirst = Str.uncapitalize;

const upperFirst = Str.capitalize;

const unique = <Value>(values: readonly Value[]): readonly Value[] => A.dedupe(values);

const program = Effect.scoped(
  Layer.build(BunServices.layer).pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (context) {
        return yield* main.pipe(Effect.provide(context));
      })
    )
  )
);

BunRuntime.runMain(program);
