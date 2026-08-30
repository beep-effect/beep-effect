import { CodegenPostProcessError } from "@beep/codegen-kit";
import { $RunpodId } from "@beep/identity";
import { LiteralKit, MappedLiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str, Struct } from "@beep/utils";
import * as OpenApiPatch from "@effect/openapi-generator/OpenApiPatch";
import { Effect, flow, Match, Order, pipe } from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import openApiPatchInput from "../openapi.patch.json" with { type: "json" };
import type { ExtraRenderer, GenerateConfig } from "@beep/codegen-kit";

const $I = $RunpodId.create("scripts/operations.renderer");

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

const HTTP_METHODS = RunpodGeneratorHttpMethod.From.Options;
const UnauthenticatedOperationId = LiteralKit(["GetOpenAPI", "GetDocs"]);
const DYNAMIC_ENUM_HINTS = [
  "accelerator",
  "cpuFlavor",
  "cuda",
  "dataCenter",
  "dataCenterId",
  "gpuType",
  "gpuTypeId",
] as const;

const decodePatch = S.decodeUnknownEffect(OpenApiPatch.JsonPatchDocument);

const postProcessError = (message: string, cause: unknown): CodegenPostProcessError =>
  CodegenPostProcessError.make({ message, cause });

// Render the Runpod-owned operation table from the patched OpenAPI document.
const renderOperations: ExtraRenderer = Effect.fn("RunpodGenerator.renderOperations")(
  function* (config, refresh, fetch) {
    const source = yield* fetch(config.source, refresh);
    const patch = yield* decodePatch(openApiPatchInput).pipe(
      Effect.mapError((cause) => postProcessError("Could not decode openapi.patch.json", cause))
    );
    const patched = yield* OpenApiPatch.applyPatches([{ source: "openapi.patch.json", patch }], source).pipe(
      Effect.mapError((cause) => postProcessError("Could not apply openapi.patch.json", cause))
    );
    const document = yield* OpenApiDocument.decodeUnknownEffect(patched).pipe(
      Effect.mapError((cause) => postProcessError("Could not decode the patched Runpod OpenAPI document", cause))
    );
    const sourceDocument = yield* OpenApiDocument.decodeUnknownEffect(source).pipe(
      Effect.mapError((cause) => postProcessError("Could not decode the source Runpod OpenAPI document", cause))
    );
    const operations = buildOperations(document);
    return renderGeneratedFile({
      advisoryEnums: collectAdvisoryEnums(sourceDocument),
      operations,
    });
  }
);

/**
 * Render the Runpod-owned operation table from the patched OpenAPI document.
 *
 * **Example** (Register the renderer)
 *
 * ```ts
 * import { renderRunpodOperations } from "./operations.renderer.ts"
 *
 * console.log(renderRunpodOperations)
 * ```
 *
 * @category code-generation
 * @since 0.1.0
 */
export const renderRunpodOperations: {
  (refresh: boolean, fetch: Parameters<ExtraRenderer>[2]): (config: GenerateConfig) => ReturnType<ExtraRenderer>;
  (config: GenerateConfig, refresh: boolean, fetch: Parameters<ExtraRenderer>[2]): ReturnType<ExtraRenderer>;
} = dual(3, renderOperations);

type BuiltOperation = {
  readonly methodCounts: Record<string, number>;
  readonly operation: Operation;
};

const mediaSchema = (content: Record<string, OpenApiMedia>, mediaType: string): O.Option<JsonSchema> =>
  pipe(
    R.get(content, mediaType),
    O.flatMap((media) => O.fromUndefinedOr(media.schema))
  );

const requestBodySchema = (operation: OpenApiOperation): JsonSchema | undefined =>
  pipe(
    O.fromUndefinedOr(operation.requestBody),
    O.flatMap((body) => O.fromUndefinedOr(body.content)),
    O.flatMap((content) => mediaSchema(content, "application/json")),
    O.getOrUndefined
  );

const buildOperation = (
  path: string,
  pathItem: OpenApiPathItem,
  openApiMethod: (typeof HTTP_METHODS)[number],
  methodCounts: Record<string, number>
): O.Option<BuiltOperation> =>
  pipe(
    O.fromUndefinedOr(pathItem[openApiMethod]),
    O.map((operation) => {
      const method = RunpodGeneratorHttpMethod.Enum[openApiMethod];
      const baseMethodName = lowerFirst(operation.operationId);
      const disambiguated = disambiguateMethodName({
        baseMethodName,
        method,
        methodCounts,
        path,
      });
      const methodName = disambiguated.methodName;
      const parameters = mergeParameters(pathItem.parameters, operation.parameters);
      const requestBodyRequired = operation.requestBody?.required === true;
      const requestFields = renderRequestFields(parameters, requestBodySchema(operation), requestBodyRequired);
      const response = chooseResponse(methodName, operation.responses);

      return {
        methodCounts: disambiguated.methodCounts,
        operation: {
          descriptorName: `${methodName}Operation`,
          hasRequiredRequest: pipe(
            requestFields,
            A.some((field) => field.required)
          ),
          method,
          methodName,
          operationId: stableOperationId(operation.operationId, method, path),
          path,
          requestBodyRequired,
          requestClassName: `${upperFirst(methodName)}Request`,
          requestFields,
          responseBody: response.body,
          responseSchemaExpression: response.schemaExpression,
          responseSchemaName: response.schemaName,
          responseTypeExpression: response.typeExpression,
          status: response.status,
          summary: operation.summary,
        },
      };
    })
  );

const buildOperations = (document: OpenApiDocument): readonly Operation[] => {
  let methodCounts: Record<string, number> = {};
  let operations: readonly Operation[] = [];

  for (const [path, pathItem] of Struct.entries(document.paths)) {
    for (const openApiMethod of HTTP_METHODS) {
      pipe(
        buildOperation(path, pathItem, openApiMethod, methodCounts),
        O.map((built) => {
          methodCounts = built.methodCounts;
          operations = A.append(operations, built.operation);
        })
      );
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

type ChosenResponse = {
  readonly body: OperationResponseBodyKind;
  readonly schemaExpression?: string;
  readonly schemaName?: string;
  readonly status: string;
  readonly typeExpression: string;
};

const selectResponseStatus = (responses: Record<string, OpenApiResponse>): string =>
  pipe(
    ["200", "201", "202", "204"],
    A.findFirst((candidate) => R.has(responses, candidate)),
    O.orElse(() => pipe(Struct.keys(responses), A.head)),
    O.getOrElse(() => "200")
  );

const responseContent = (
  responses: Record<string, OpenApiResponse>,
  selectedStatus: string
): Record<string, OpenApiMedia> =>
  pipe(
    R.get(responses, selectedStatus),
    O.flatMap((response) => O.fromUndefinedOr(response.content)),
    O.getOrElse(R.empty<string, OpenApiMedia>)
  );

const chooseJsonResponse = (methodName: string, selectedStatus: string, jsonSchema: JsonSchema): ChosenResponse =>
  pipe(
    refNameFromSchema(jsonSchema),
    O.match({
      onNone: () => {
        const schemaName = `${upperFirst(methodName)}Status${selectedStatus}Response`;
        return {
          body: OperationResponseBodyKind.Enum.json,
          schemaExpression: schemaExpression(jsonSchema, schemaName),
          schemaName,
          status: selectedStatus,
          typeExpression: schemaName,
        };
      },
      onSome: (refName) => ({
        body: OperationResponseBodyKind.Enum.json,
        schemaExpression: `Models.${refName}`,
        status: selectedStatus,
        typeExpression: `Models.${refName}`,
      }),
    })
  );

const chooseTextResponse = (methodName: string, selectedStatus: string): ChosenResponse => ({
  body: OperationResponseBodyKind.Enum.text,
  schemaExpression: "S.String",
  schemaName: `${upperFirst(methodName)}Status${selectedStatus}TextResponse`,
  status: selectedStatus,
  typeExpression: "string",
});

const chooseEmptyResponse = (selectedStatus: string): ChosenResponse => ({
  body: OperationResponseBodyKind.Enum.none,
  status: selectedStatus,
  typeExpression: "void",
});

const textResponse = (
  methodName: string,
  selectedStatus: string,
  content: Record<string, OpenApiMedia>
): O.Option<ChosenResponse> =>
  pipe(
    O.firstSomeOf([
      mediaSchema(content, "text/plain"),
      mediaSchema(content, "text/html"),
      mediaSchema(content, "text/markdown"),
    ]),
    O.orElse(() => pipe(R.get(content, "text/html"), O.as(true))),
    O.as(chooseTextResponse(methodName, selectedStatus))
  );

const chooseResponse = (methodName: string, responses: Record<string, OpenApiResponse>): ChosenResponse => {
  const selectedStatus = selectResponseStatus(responses);
  const content = responseContent(responses, selectedStatus);

  return pipe(
    mediaSchema(content, "application/json"),
    O.map((jsonSchema) => chooseJsonResponse(methodName, selectedStatus, jsonSchema)),
    O.orElse(() => textResponse(methodName, selectedStatus, content)),
    O.getOrElse(() => chooseEmptyResponse(selectedStatus))
  );
};

const renderGeneratedFile = (input: {
  readonly advisoryEnums: Readonly<Record<string, readonly string[]>>;
  readonly operations: readonly Operation[];
}): string => {
  let responseSchemas: Record<string, string> = {};
  for (const operation of input.operations) {
    if (operation.responseSchemaName !== undefined && operation.responseSchemaExpression !== undefined) {
      responseSchemas = R.set(responseSchemas, operation.responseSchemaName, operation.responseSchemaExpression);
    }
  }

  return `${renderHeader()}

${renderAdvisoryEnums(input.advisoryEnums)}

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
 * Generated Runpod REST request models and operation descriptors.
 * Do not edit this file by hand.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import type { Effect } from "effect";
import * as S from "effect/Schema";

import { $RunpodId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Models from "./Runpod.models.gen.ts";

const $I = $RunpodId.create("Runpod.generated");
`;

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

const renderArrayAliasExpression = (expression: string, annotation: string): string => `${Str.slice(
  0,
  -".pipe(S.Array)".length
)(expression)}.pipe(
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

const collectSchemaAdvisories = (
  collected: Readonly<Record<string, readonly string[]>>,
  schema: JsonSchema,
  hint: string
): Readonly<Record<string, readonly string[]>> => {
  const values = pipe(schema.enum, O.fromUndefinedOr, O.getOrElse(A.empty<unknown>), A.filter(P.isString));
  const current =
    A.isReadonlyArrayNonEmpty(values) && shouldTrackAdvisoryEnum(hint)
      ? R.set(collected, Str.camelCase(hint), values)
      : collected;
  const withItems = pipe(
    O.fromUndefinedOr(schema.items),
    O.map((items) => collectSchemaAdvisories(current, items, hint)),
    O.getOrElse(() => current)
  );
  return pipe(
    Struct.entries(schema.properties ?? {}),
    A.reduce(withItems, (state, [propertyName, propertySchema]) =>
      collectSchemaAdvisories(state, propertySchema, propertyName)
    )
  );
};

const collectParameterAdvisories = (
  collected: Readonly<Record<string, readonly string[]>>,
  parameters: ReadonlyArray<OpenApiParameter>
): Readonly<Record<string, readonly string[]>> =>
  pipe(
    parameters,
    A.reduce(collected, (state, parameter) =>
      pipe(
        O.fromUndefinedOr(parameter.schema),
        O.map((schema) => collectSchemaAdvisories(state, schema, parameter.name)),
        O.getOrElse(() => state)
      )
    )
  );

const collectOperationAdvisories = (document: OpenApiDocument): Readonly<Record<string, readonly string[]>> =>
  pipe(
    Struct.entries(document.paths),
    A.reduce(R.empty<string, readonly string[]>(), (pathState, [, pathItem]) =>
      pipe(
        HTTP_METHODS,
        A.reduce(pathState, (methodState, method) =>
          pipe(
            O.fromUndefinedOr(pathItem[method]),
            O.map((operation) =>
              collectParameterAdvisories(methodState, mergeParameters(pathItem.parameters, operation.parameters))
            ),
            O.getOrElse(() => methodState)
          )
        )
      )
    )
  );

const collectAdvisoryEnums = (document: OpenApiDocument): Readonly<Record<string, readonly string[]>> =>
  pipe(
    Struct.entries(document.components?.schemas ?? {}),
    A.reduce(collectOperationAdvisories(document), (collected, [name, schema]) =>
      collectSchemaAdvisories(collected, schema, name)
    )
  );

const renderAdvisoryEnums = (advisoryEnums: Readonly<Record<string, readonly string[]>>): string => {
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

const renderBooleanLiteral = Bool.match({
  onFalse: () => "false",
  onTrue: () => "true",
});

const renderAuthentication = Match.type<string>().pipe(
  Match.when(UnauthenticatedOperationId.is.GetOpenAPI, () => "false"),
  Match.when(UnauthenticatedOperationId.is.GetDocs, () => "false"),
  Match.orElse(() => "true")
);

const renderRequestBodyKind: (requestFields: readonly RequestField[]) => string = flow(
  A.some((field: RequestField) => field.name === "body"),
  Bool.match({
    onFalse: () => JSON.stringify(OperationRequestBodyKind.Enum.none),
    onTrue: () => JSON.stringify(OperationRequestBodyKind.Enum.json),
  })
);

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
  authenticated: ${renderAuthentication(operation.operationId)},
  method: "${operation.method}",
  methodName: "${operation.methodName}",
  operationId: "${operation.operationId}",
  path: "${operation.path}",
  pathParams: ${JSON.stringify(pathParams)},
  queryParams: ${JSON.stringify(queryParams)},
  requestBody: ${renderRequestBodyKind(operation.requestFields)},
  requestBodyRequired: ${renderBooleanLiteral(operation.requestBodyRequired)},
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

const referencedSchemaExpression = (schema: JsonSchema): O.Option<string> =>
  pipe(
    refNameFromSchema(schema),
    O.map((refName) => wrapNullable(schema, `S.suspend(() => Models.${refName})`))
  );

const enumSchemaExpression = (schema: JsonSchema, hint: string): O.Option<string> => {
  const values = pipe(schema.enum, O.fromUndefinedOr, O.getOrElse(A.empty<unknown>), A.filter(P.isString));

  return pipe(
    values,
    O.liftPredicate(A.isReadonlyArrayNonEmpty),
    O.map((enumValues) =>
      pipe(
        shouldTrackAdvisoryEnum(hint),
        Bool.match({
          onFalse: () => wrapNullable(schema, `LiteralKit(${JSON.stringify(enumValues)})`),
          onTrue: () => wrapNullable(schema, "S.String"),
        })
      )
    )
  );
};

const renderStructProperty = (
  required: readonly string[],
  propertyName: string,
  propertySchema: JsonSchema
): string => {
  const expression = schemaExpression(propertySchema, propertyName);
  const renderedExpression = pipe(
    required,
    A.contains(propertyName),
    Bool.match({
      onFalse: () => optionalExpression(expression),
      onTrue: () => expression,
    })
  );

  return `    ${propertyName}: ${renderedExpression},`;
};

const structSchemaExpression = (schema: JsonSchema): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(schema.properties),
    O.map((properties) => {
      const required = pipe(schema.required, O.fromUndefinedOr, O.getOrElse(A.empty<string>));
      const renderedProperties = pipe(
        Struct.entries(properties),
        A.map(([propertyName, propertySchema]) => renderStructProperty(required, propertyName, propertySchema)),
        A.join("\n")
      );

      return wrapNullable(schema, `S.Struct({\n${renderedProperties}\n  })`);
    })
  );

const additionalPropertySchemaExpression = (additionalProperties: true | JsonSchema, hint: string): string =>
  Match.type<true | JsonSchema>().pipe(
    Match.when(P.isBoolean, () => "S.Unknown"),
    Match.orElse((propertySchema) => schemaExpression(propertySchema, hint))
  )(additionalProperties);

const recordSchemaExpression = (schema: JsonSchema, hint: string): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(schema.additionalProperties),
    O.filter((additionalProperties): additionalProperties is true | JsonSchema => additionalProperties !== false),
    O.map((additionalProperties) =>
      wrapNullable(schema, `S.Record(S.String, ${additionalPropertySchemaExpression(additionalProperties, hint)})`)
    )
  );

const objectSchemaExpression = (schema: JsonSchema, hint: string): string =>
  pipe(
    structSchemaExpression(schema),
    O.orElse(() => recordSchemaExpression(schema, hint)),
    O.getOrElse(() => wrapNullable(schema, "S.Record(S.String, S.Unknown)"))
  );

const schemaTypeOption = Match.type<string | readonly string[]>().pipe(
  Match.when(P.isString, (type): O.Option<string> => O.some(type)),
  Match.orElse((types): O.Option<string> => A.head(types))
);

const schemaType = (schema: JsonSchema): string | undefined =>
  pipe(O.fromUndefinedOr(schema.type), O.flatMap(schemaTypeOption), O.getOrUndefined);

const primitiveSchemaExpression = (schema: JsonSchema, hint: string): string =>
  Match.type<string | undefined>().pipe(
    Match.when("array", () =>
      wrapNullable(schema, pipeExpression(schemaExpression(schema.items ?? UnknownJsonSchema, hint), "S.Array"))
    ),
    Match.when("boolean", () => wrapNullable(schema, "S.Boolean")),
    Match.when("integer", () => wrapNullable(schema, "S.Int")),
    Match.when("number", () => wrapNullable(schema, "S.Finite")),
    Match.when("object", () => objectSchemaExpression(schema, hint)),
    Match.when("string", () => wrapNullable(schema, "S.String")),
    Match.orElse(() => wrapNullable(schema, "S.Unknown"))
  )(schemaType(schema));

const schemaExpression = (schema: JsonSchema, hint: string): string =>
  pipe(
    referencedSchemaExpression(schema),
    O.orElse(() => enumSchemaExpression(schema, hint)),
    O.getOrElse(() => primitiveSchemaExpression(schema, hint))
  );

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
