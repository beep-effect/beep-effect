import { CodegenPostProcessError } from "@beep/codegen-kit";
import { $RunpodId } from "@beep/identity";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import { A, Str, Struct } from "@beep/utils";
import * as OpenApiPatch from "@effect/openapi-generator/OpenApiPatch";
import * as Bool from "effect/Boolean";
import * as Effect from "effect/Effect";
import { dual, identity, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import openApiPatchInput from "../openapi.patch.json" with { type: "json" };
import { closedObjectPatch } from "./openapi.lowering.ts";
import type { ExtraRenderer, GenerateConfig } from "@beep/codegen-kit";

const $I = $RunpodId.create("scripts/operations.renderer");

const RUNPOD_API_PATH_PREFIX = "/v2";
const COMPONENT_SCHEMA_REF_PREFIX = "#/components/schemas/";
const COMPONENT_PARAMETER_REF_PREFIX = "#/components/parameters/";
const COMPONENT_RESPONSE_REF_PREFIX = "#/components/responses/";
const PAGINATION_CURSOR_FIELD = "cursor";
const PAGINATION_PROPERTY = "pagination";

const RunpodGeneratorHttpMethod = MappedLiteralKit([
  ["get", "GET"],
  ["post", "POST"],
  ["patch", "PATCH"],
  ["put", "PUT"],
  ["delete", "DELETE"],
]);
type HttpMethod = typeof RunpodGeneratorHttpMethod.Type;
const OperationRequestBodyKind = LiteralKit(["json", "none"]);
const OperationResponseBodyKind = LiteralKit(["event-stream", "json", "none", "text"]);
type OperationResponseBodyKind = typeof OperationResponseBodyKind.Type;
const OperationQueryEncoding = LiteralKit(["comma", "json", "repeat"]);
type OperationQueryEncoding = typeof OperationQueryEncoding.Type;
const OperationKind = LiteralKit(["effect", "event-stream"]);
type OperationKind = typeof OperationKind.Type;
const RequestFieldLocation = LiteralKit(["body", "header", "path", "query"]);
type RequestFieldLocation = typeof RequestFieldLocation.Type;

const JsIdentifier = S.String.check(S.isPattern(/^[A-Za-z_$][A-Za-z0-9_$]*$/));
const isJsIdentifier = S.is(JsIdentifier);
const SuccessStatus = S.String.check(S.isPattern(/^2\d\d$/));
const isSuccessStatus = S.is(SuccessStatus);

const JsonSchemaRef = S.suspend((): S.Codec<JsonSchema, JsonSchema.Encoded> => JsonSchema);

class JsonSchema extends S.Class<JsonSchema, { readonly brand: unique symbol }>($I`JsonSchema`)(
  {
    $ref: S.optionalKey(S.String),
    type: S.optionalKey(S.Union([S.String, S.Array(S.String)])),
    format: S.optionalKey(S.String),
    enum: S.Array(S.Unknown).pipe(S.optionalKey),
    items: JsonSchemaRef.pipe(S.optionalKey),
    allOf: S.Array(JsonSchemaRef).pipe(S.optionalKey),
    nullable: S.optionalKey(S.Boolean),
    properties: S.Record(S.String, JsonSchemaRef).pipe(S.optionalKey),
    required: S.Array(S.String).pipe(S.optionalKey),
    additionalProperties: S.Union([JsonSchemaRef, S.Boolean]).pipe(S.optionalKey),
    unevaluatedProperties: S.optionalKey(S.Unknown),
  },
  $I.annote("JsonSchema", {
    description: "JSON Schema subset consumed by the Runpod OpenAPI generator.",
  })
) {}

declare namespace JsonSchema {
  /** Encoded (wire) side of the recursive JSON Schema subset; the branded class is the decoded side. */
  export interface Encoded {
    readonly $ref?: string;
    readonly additionalProperties?: Encoded | boolean;
    readonly allOf?: ReadonlyArray<Encoded>;
    readonly enum?: ReadonlyArray<unknown>;
    readonly format?: string;
    readonly items?: Encoded;
    readonly nullable?: boolean;
    readonly properties?: { readonly [key: string]: Encoded };
    readonly required?: ReadonlyArray<string>;
    readonly type?: string | ReadonlyArray<string>;
    readonly unevaluatedProperties?: unknown;
  }
}

const StringJsonSchema = JsonSchema.make({ type: "string" });
const UnknownJsonSchema = JsonSchema.make({ type: "unknown" });

class OpenApiReference extends S.Opaque<OpenApiReference, { readonly brand: unique symbol }>()(
  S.Struct({
    $ref: S.String,
  }).pipe(
    $I.annoteSchema("OpenApiReference", {
      description: "OpenAPI reference object pointing into the document components.",
    })
  )
) {}
const isOpenApiReference = S.is(OpenApiReference);

class OpenApiMedia extends S.Opaque<OpenApiMedia, { readonly brand: unique symbol }>()(
  S.Struct({
    schema: S.optionalKey(JsonSchema),
  }).pipe(
    $I.annoteSchema("OpenApiMedia", {
      description: "OpenAPI media object subset consumed by the Runpod generator.",
    })
  )
) {}

class OpenApiParameter extends S.Opaque<OpenApiParameter, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    in: S.Literals(["path", "query", "header", "cookie"]),
    required: S.optionalKey(S.Boolean),
    schema: S.optionalKey(JsonSchema),
    content: S.optionalKey(S.Record(S.String, OpenApiMedia)),
    explode: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("OpenApiParameter", {
      description: "OpenAPI parameter subset consumed by the Runpod generator.",
    })
  )
) {}

const OpenApiParameterEntry = S.Union([OpenApiReference, OpenApiParameter]).pipe(
  $I.annoteSchema("OpenApiParameterEntry", {
    description: "Inline OpenAPI parameter or a reference to a component parameter.",
  })
);
type OpenApiParameterEntry = typeof OpenApiParameterEntry.Type;

class OpenApiRequestBody extends S.Opaque<OpenApiRequestBody, { readonly brand: unique symbol }>()(
  S.Struct({
    content: S.optionalKey(S.Record(S.String, OpenApiMedia)),
    required: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("OpenApiRequestBody", {
      description: "OpenAPI request body subset consumed by the Runpod generator.",
    })
  )
) {}

class OpenApiResponse extends S.Opaque<OpenApiResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    content: S.optionalKey(S.Record(S.String, OpenApiMedia)),
  }).pipe(
    $I.annoteSchema("OpenApiResponse", {
      description: "OpenAPI response subset consumed by the Runpod generator.",
    })
  )
) {}

const OpenApiResponseEntry = S.Union([OpenApiReference, OpenApiResponse]).pipe(
  $I.annoteSchema("OpenApiResponseEntry", {
    description: "Inline OpenAPI response or a reference to a component response.",
  })
);
type OpenApiResponseEntry = typeof OpenApiResponseEntry.Type;

const SecurityRequirements = S.Record(S.String, S.Array(S.String)).pipe(
  S.Array,
  $I.annoteSchema("SecurityRequirements", {
    description: "OpenAPI security requirement list; an empty list makes an operation public.",
  })
);
type SecurityRequirements = typeof SecurityRequirements.Type;

const openApiOperationParametersDefault = A.empty<OpenApiParameterEntry>();
const openApiOperationResponsesDefault = R.empty();
class OpenApiOperation extends S.Opaque<OpenApiOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    operationId: S.String,
    summary: S.optionalKey(S.String),
    parameters: S.Array(OpenApiParameterEntry).pipe(
      S.withConstructorDefault(Effect.succeed(openApiOperationParametersDefault)),
      S.withDecodingDefaultType(Effect.succeed(openApiOperationParametersDefault))
    ),
    requestBody: S.optionalKey(OpenApiRequestBody),
    responses: S.Record(S.String, OpenApiResponseEntry).pipe(
      S.withConstructorDefault(Effect.succeed(openApiOperationResponsesDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(openApiOperationResponsesDefault))
    ),
    security: S.optionalKey(SecurityRequirements),
  }).pipe(
    $I.annoteSchema("OpenApiOperation", {
      description: "OpenAPI operation subset consumed by the Runpod generator.",
    })
  )
) {}

const openApiPathItemParametersDefault = A.empty<OpenApiParameterEntry>();
class OpenApiPathItem extends S.Opaque<OpenApiPathItem, { readonly brand: unique symbol }>()(
  S.Struct({
    get: S.optionalKey(OpenApiOperation),
    post: S.optionalKey(OpenApiOperation),
    patch: S.optionalKey(OpenApiOperation),
    put: S.optionalKey(OpenApiOperation),
    delete: S.optionalKey(OpenApiOperation),
    parameters: S.Array(OpenApiParameterEntry).pipe(
      S.withConstructorDefault(Effect.succeed(openApiPathItemParametersDefault)),
      S.withDecodingDefaultType(Effect.succeed(openApiPathItemParametersDefault))
    ),
  }).pipe(
    $I.annoteSchema("OpenApiPathItem", {
      description: "OpenAPI path item subset consumed by the Runpod generator.",
    })
  )
) {}

const openApiComponentsSchemasDefault = R.empty();
const openApiComponentsParametersDefault = R.empty();
const openApiComponentsResponsesDefault = R.empty();
class OpenApiComponents extends S.Opaque<OpenApiComponents, { readonly brand: unique symbol }>()(
  S.Struct({
    schemas: S.Record(S.String, JsonSchema).pipe(
      S.withConstructorDefault(Effect.succeed(openApiComponentsSchemasDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(openApiComponentsSchemasDefault))
    ),
    parameters: S.Record(S.String, OpenApiParameter).pipe(
      S.withConstructorDefault(Effect.succeed(openApiComponentsParametersDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(openApiComponentsParametersDefault))
    ),
    responses: S.Record(S.String, OpenApiResponse).pipe(
      S.withConstructorDefault(Effect.succeed(openApiComponentsResponsesDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(openApiComponentsResponsesDefault))
    ),
  }).pipe(
    $I.annoteSchema("OpenApiComponents", {
      description: "OpenAPI components subset consumed by the Runpod generator.",
    })
  )
) {}

const openApiDocumentComponentsDefault = OpenApiComponents.make({});
class OpenApiDocument extends S.Opaque<OpenApiDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    openapi: S.String,
    paths: S.Record(S.String, OpenApiPathItem),
    components: OpenApiComponents.pipe(
      S.withConstructorDefault(Effect.succeed(openApiDocumentComponentsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(openApiDocumentComponentsDefault))
    ),
    security: S.optionalKey(SecurityRequirements),
  }).pipe(
    $I.annoteSchema("OpenApiDocument", {
      description: "Runpod OpenAPI document subset consumed by the generator.",
    })
  )
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(OpenApiDocument);
}

type RequestField = {
  readonly location: RequestFieldLocation;
  readonly name: string;
  readonly queryEncoding: OperationQueryEncoding;
  readonly required: boolean;
  readonly schemaExpression: string;
  readonly wireName: string;
};

type SchemaAlias = {
  readonly expression: string;
  readonly name: string;
};

type OperationResponse = {
  readonly alias: O.Option<SchemaAlias>;
  readonly body: OperationResponseBodyKind;
  readonly decoderExpression: O.Option<string>;
  readonly schema: O.Option<JsonSchema>;
  readonly status: string;
  readonly typeExpression: string;
};

type OperationPagination = {
  readonly itemTypeExpression: string;
  readonly itemsKey: string;
};

type Operation = {
  readonly authenticated: boolean;
  readonly descriptorName: string;
  readonly hasRequiredRequest: boolean;
  readonly kind: OperationKind;
  readonly method: HttpMethod;
  readonly methodName: string;
  readonly operationId: string;
  readonly pagination: O.Option<OperationPagination>;
  readonly path: string;
  readonly requestBodyRequired: boolean;
  readonly requestClassName: string;
  readonly requestFields: ReadonlyArray<RequestField>;
  readonly responseTypeExpression: string;
  readonly responses: A.NonEmptyReadonlyArray<OperationResponse>;
  readonly summary: O.Option<string>;
};

const HTTP_METHODS = A.map(RunpodGeneratorHttpMethod.Pairs, ([method]) => method);
type OpenApiMethod = (typeof HTTP_METHODS)[number];

const decodePatch = S.decodeUnknownEffect(OpenApiPatch.JsonPatchDocument);

const postProcessError = (message: string, cause: unknown): CodegenPostProcessError =>
  CodegenPostProcessError.make({ message, cause });

const encodeJsonLiteral = (value: unknown): string =>
  Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(value), identity);

const renderOperations: ExtraRenderer = Effect.fn("RunpodGenerator.renderOperations")(
  function* (config, refresh, fetch) {
    const source = yield* fetch(config.source, refresh);
    const patch = yield* decodePatch(openApiPatchInput).pipe(
      Effect.mapError((cause) => postProcessError("Could not decode openapi.patch.json", cause))
    );
    const patchedLikeModelsGenerator = yield* OpenApiPatch.applyPatches(
      [
        { source: "openapi.patch.json", patch },
        { source: "openapi.lowering.ts", patch: closedObjectPatch(source) },
      ],
      source
    ).pipe(Effect.mapError((cause) => postProcessError("Could not apply the Runpod OpenAPI patches", cause)));
    const document = yield* OpenApiDocument.decodeUnknownEffect(patchedLikeModelsGenerator).pipe(
      Effect.mapError((cause) => postProcessError("Could not decode the patched Runpod OpenAPI document", cause))
    );
    yield* ensureNoUnevaluatedClosures(document);
    const operations = yield* buildOperations(document);
    yield* ensureNoModelNameCollisions(document, operations);
    return renderGeneratedFile(operations);
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

const ensureNoUnevaluatedClosures = Effect.fnUntraced(function* (document: OpenApiDocument) {
  const remaining = pipe(
    Struct.entries(document.components.schemas),
    A.filter(([, schema]) => schema.unevaluatedProperties !== undefined),
    A.map(([name]) => name)
  );

  if (A.isReadonlyArrayNonEmpty(remaining)) {
    return yield* postProcessError(
      `Component schemas still declare unevaluatedProperties after lowering, which Effect's JSON Schema importer cannot read: ${A.join(remaining, ", ")}`,
      "unlowered closure"
    );
  }
});

const generatedFixedNames = [
  "RUNPOD_OPERATION_SPECS",
  "RunpodHeaderParameter",
  "RunpodHttpMethod",
  "RunpodOperationDescriptor",
  "RunpodOperationFactory",
  "RunpodOperationId",
  "RunpodOperationResponse",
  "RunpodOperationSpec",
  "RunpodOperationsShape",
  "RunpodQueryEncoding",
  "RunpodQueryParameter",
  "RunpodRequestBodyKind",
  "RunpodResponseBodyKind",
  "makeRunpodOperations",
];

const generatedOperationNames = (operation: Operation): ReadonlyArray<string> =>
  A.appendAll(
    [operation.requestClassName, operation.descriptorName],
    pipe(
      operation.responses,
      A.flatMap((response) => O.toArray(O.map(response.alias, (alias) => alias.name)))
    )
  );

const ensureNoModelNameCollisions = Effect.fnUntraced(function* (
  document: OpenApiDocument,
  operations: ReadonlyArray<Operation>
) {
  const generated = A.appendAll(generatedFixedNames, A.flatMap(operations, generatedOperationNames));
  const collisions = A.intersection(generated, Struct.keys(document.components.schemas));
  const duplicates = duplicatesOf(generated);

  if (A.isReadonlyArrayNonEmpty(collisions) || A.isReadonlyArrayNonEmpty(duplicates)) {
    return yield* postProcessError(
      `Generated operation exports collide with each other or with a model name in the shared package barrel: ${A.join(A.appendAll(collisions, duplicates), ", ")}`,
      "export name collision"
    );
  }
});

const duplicatesOf = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    values,
    A.filter((value, index) =>
      pipe(
        A.findFirstIndex(values, (other) => other === value),
        O.exists((first) => first !== index)
      )
    ),
    A.dedupe
  );

const componentName = (ref: string, prefix: string): O.Option<string> =>
  pipe(ref, O.liftPredicate(Str.startsWith(prefix)), O.map(Str.slice(Str.length(prefix))));

const resolveParameter =
  (document: OpenApiDocument) =>
  (entry: OpenApiParameterEntry): Effect.Effect<OpenApiParameter, CodegenPostProcessError> =>
    isOpenApiReference(entry)
      ? pipe(
          componentName(entry.$ref, COMPONENT_PARAMETER_REF_PREFIX),
          O.flatMap((name) => R.get(document.components.parameters, name)),
          Effect.fromOption(() => postProcessError(`Unresolvable parameter reference ${entry.$ref}`, entry.$ref))
        )
      : Effect.succeed(entry);

const resolveResponse =
  (document: OpenApiDocument) =>
  (entry: OpenApiResponseEntry): Effect.Effect<OpenApiResponse, CodegenPostProcessError> =>
    isOpenApiReference(entry)
      ? pipe(
          componentName(entry.$ref, COMPONENT_RESPONSE_REF_PREFIX),
          O.flatMap((name) => R.get(document.components.responses, name)),
          Effect.fromOption(() => postProcessError(`Unresolvable response reference ${entry.$ref}`, entry.$ref))
        )
      : Effect.succeed(entry);

const mediaSchema = (content: Readonly<Record<string, OpenApiMedia>>, mediaType: string): O.Option<JsonSchema> =>
  pipe(
    R.get(content, mediaType),
    O.flatMap((media) => O.fromUndefinedOr(media.schema))
  );

const requestBodySchema = (operation: OpenApiOperation): O.Option<JsonSchema> =>
  pipe(
    O.fromUndefinedOr(operation.requestBody),
    O.flatMap((body) => O.fromUndefinedOr(body.content)),
    O.flatMap((content) => mediaSchema(content, "application/json"))
  );

const stripApiPathPrefix = (path: string): Effect.Effect<string, CodegenPostProcessError> =>
  pipe(
    path,
    O.liftPredicate(Str.startsWith(`${RUNPOD_API_PATH_PREFIX}/`)),
    O.map(Str.slice(Str.length(RUNPOD_API_PATH_PREFIX))),
    Effect.fromOption(() =>
      postProcessError(`Runpod path ${path} is outside the ${RUNPOD_API_PATH_PREFIX} API prefix`, path)
    )
  );

const isAuthenticated = (document: OpenApiDocument, operation: OpenApiOperation): boolean =>
  pipe(
    O.fromUndefinedOr(operation.security),
    O.orElse(() => O.fromUndefinedOr(document.security)),
    O.getOrElse(A.empty<SecurityRequirements[number]>),
    A.some((requirement) => !R.isEmptyRecord(requirement))
  );

type OperationCandidate = {
  readonly method: OpenApiMethod;
  readonly operation: OpenApiOperation;
  readonly path: string;
  readonly pathItem: OpenApiPathItem;
};

const operationCandidates = (document: OpenApiDocument): ReadonlyArray<OperationCandidate> =>
  pipe(
    Struct.entries(document.paths),
    A.flatMap(([path, pathItem]) =>
      pipe(
        HTTP_METHODS,
        A.flatMap((method) =>
          pipe(
            O.fromUndefinedOr(pathItem[method]),
            O.map((operation) => ({ method, operation, path, pathItem })),
            O.toArray
          )
        )
      )
    )
  );

const buildOperations = Effect.fnUntraced(function* (document: OpenApiDocument) {
  const operations = yield* Effect.forEach(
    operationCandidates(document),
    (candidate) => buildOperation(document, candidate),
    { concurrency: 1 }
  );
  const duplicateMethods = duplicatesOf(A.map(operations, (operation) => operation.methodName));

  if (A.isReadonlyArrayNonEmpty(duplicateMethods)) {
    return yield* postProcessError(
      `Runpod operation ids are not unique: ${A.join(duplicateMethods, ", ")}`,
      "duplicate operation id"
    );
  }

  return operations;
});

const mergeParameters = (
  pathParameters: ReadonlyArray<OpenApiParameter>,
  operationParameters: ReadonlyArray<OpenApiParameter>
): ReadonlyArray<OpenApiParameter> =>
  pipe(
    operationParameters,
    A.appendAll(pathParameters),
    A.dedupeWith((left, right) => left.name === right.name && left.in === right.in)
  );

const buildOperation = Effect.fnUntraced(function* (
  document: OpenApiDocument,
  candidate: OperationCandidate
): Effect.fn.Return<Operation, CodegenPostProcessError> {
  const { method: openApiMethod, operation, path, pathItem } = candidate;
  const methodName = Str.uncapitalize(operation.operationId);
  const relativePath = yield* stripApiPathPrefix(path);
  const pathParameters = yield* Effect.forEach(pathItem.parameters, resolveParameter(document), {
    concurrency: 1,
  });
  const operationParameters = yield* Effect.forEach(operation.parameters, resolveParameter(document), {
    concurrency: 1,
  });
  const requestBodyRequired = operation.requestBody?.required === true;
  const requestFields = yield* renderRequestFields(
    methodName,
    mergeParameters(pathParameters, operationParameters),
    requestBodySchema(operation),
    requestBodyRequired
  );
  const responses = yield* buildResponses(document, methodName, operation);
  const kind = yield* operationKind(methodName, responses);
  const responseTypeExpression = pipe(
    responses,
    A.map((response) => response.typeExpression),
    A.dedupe,
    A.join(" | ")
  );
  const pagination = yield* operationPagination({
    document,
    kind,
    methodName,
    requestFields,
    responseTypeExpression,
    responses,
  });

  return {
    authenticated: isAuthenticated(document, operation),
    descriptorName: `${methodName}Operation`,
    hasRequiredRequest: A.some(requestFields, (field) => field.required),
    kind,
    method: RunpodGeneratorHttpMethod.Enum[openApiMethod],
    methodName,
    operationId: operation.operationId,
    pagination,
    path: relativePath,
    requestBodyRequired,
    requestClassName: `${Str.capitalize(methodName)}Params`,
    requestFields,
    responseTypeExpression,
    responses,
    summary: O.fromUndefinedOr(operation.summary),
  };
});

const parameterLocation = Match.type<OpenApiParameter["in"]>().pipe(
  Match.when("path", (): O.Option<RequestFieldLocation> => O.some(RequestFieldLocation.Enum.path)),
  Match.when("query", (): O.Option<RequestFieldLocation> => O.some(RequestFieldLocation.Enum.query)),
  Match.when("header", (): O.Option<RequestFieldLocation> => O.some(RequestFieldLocation.Enum.header)),
  Match.when("cookie", (): O.Option<RequestFieldLocation> => O.none()),
  Match.exhaustive
);

const parameterSchema = (parameter: OpenApiParameter): JsonSchema =>
  pipe(
    O.fromUndefinedOr(parameter.schema),
    O.orElse(() =>
      pipe(
        O.fromUndefinedOr(parameter.content),
        O.flatMap((content) => mediaSchema(content, "application/json"))
      )
    ),
    O.getOrElse(() => StringJsonSchema)
  );

const queryEncoding = (parameter: OpenApiParameter): OperationQueryEncoding =>
  pipe(
    O.fromUndefinedOr(parameter.content),
    O.flatMap((content) => R.get(content, "application/json")),
    O.match({
      onNone: () =>
        parameter.explode === false ? OperationQueryEncoding.Enum.comma : OperationQueryEncoding.Enum.repeat,
      onSome: () => OperationQueryEncoding.Enum.json,
    })
  );

const requestFieldName = (name: string): string => (isJsIdentifier(name) ? name : Str.camelCase(name));

const isUnnamablePathParameter = (location: RequestFieldLocation, parameter: OpenApiParameter): boolean =>
  location === RequestFieldLocation.Enum.path && !isJsIdentifier(parameter.name);

const isRequiredRequestField = (location: RequestFieldLocation, parameter: OpenApiParameter): boolean =>
  location === RequestFieldLocation.Enum.path || parameter.required === true;

const parameterField = (methodName: string, parameter: OpenApiParameter) =>
  pipe(
    parameterLocation(parameter.in),
    O.map(
      (location): Effect.Effect<RequestField, CodegenPostProcessError> =>
        isUnnamablePathParameter(location, parameter)
          ? Effect.fail(
              postProcessError(
                `Path parameter ${parameter.name} of ${methodName} is not a valid field name`,
                parameter.name
              )
            )
          : Effect.succeed({
              location,
              name: requestFieldName(parameter.name),
              queryEncoding: queryEncoding(parameter),
              required: isRequiredRequestField(location, parameter),
              schemaExpression: schemaExpression(parameterSchema(parameter), parameter.name),
              wireName: parameter.name,
            })
    )
  );

const renderRequestFields = Effect.fnUntraced(function* (
  methodName: string,
  parameters: ReadonlyArray<OpenApiParameter>,
  bodySchema: O.Option<JsonSchema>,
  bodyRequired: boolean
) {
  const parameterFields = yield* Effect.forEach(
    A.getSomes(A.map(parameters, (parameter) => parameterField(methodName, parameter))),
    identity,
    { concurrency: 1 }
  );
  const fields = pipe(
    bodySchema,
    O.map(
      (schema): RequestField => ({
        location: RequestFieldLocation.Enum.body,
        name: "body",
        queryEncoding: OperationQueryEncoding.Enum.repeat,
        required: bodyRequired,
        schemaExpression: schemaExpression(schema, "body"),
        wireName: "body",
      })
    ),
    O.match({
      onNone: () => parameterFields,
      onSome: (bodyField) => A.append(parameterFields, bodyField),
    })
  );
  const duplicateFields = duplicatesOf(A.map(fields, (field) => field.name));

  if (A.isReadonlyArrayNonEmpty(duplicateFields)) {
    return yield* postProcessError(
      `Request fields of ${methodName} collide: ${A.join(duplicateFields, ", ")}`,
      "request field collision"
    );
  }

  return fields;
});

const TEXT_MEDIA_TYPES = ["text/plain", "text/html", "text/markdown"] as const;

const responseBodyKind = (content: Readonly<Record<string, OpenApiMedia>>): OperationResponseBodyKind =>
  Match.value(content).pipe(
    Match.when(
      (value) => R.has(value, "application/json"),
      () => OperationResponseBodyKind.Enum.json
    ),
    Match.when(
      (value) => R.has(value, "text/event-stream"),
      () => OperationResponseBodyKind.Enum["event-stream"]
    ),
    Match.when(
      (value) => A.some(TEXT_MEDIA_TYPES, (mediaType) => R.has(value, mediaType)),
      () => OperationResponseBodyKind.Enum.text
    ),
    Match.orElse(() => OperationResponseBodyKind.Enum.none)
  );

const jsonResponse = (methodName: string, status: string, schema: JsonSchema): OperationResponse =>
  pipe(
    refNameFromSchema(schema),
    O.match({
      onNone: () => {
        const name = `${Str.capitalize(methodName)}Status${status}Response`;
        return {
          alias: O.some({ expression: schemaExpression(schema, name), name }),
          body: OperationResponseBodyKind.Enum.json,
          decoderExpression: O.some(name),
          schema: O.some(schema),
          status,
          typeExpression: name,
        };
      },
      onSome: (refName) => ({
        alias: O.none(),
        body: OperationResponseBodyKind.Enum.json,
        decoderExpression: O.some(`Models.${refName}`),
        schema: O.some(schema),
        status,
        typeExpression: `Models.${refName}`,
      }),
    })
  );

const textResponse = (status: string): OperationResponse => ({
  alias: O.none(),
  body: OperationResponseBodyKind.Enum.text,
  decoderExpression: O.some("S.String"),
  schema: O.none(),
  status,
  typeExpression: "string",
});

const eventStreamResponse = (status: string): OperationResponse => ({
  alias: O.none(),
  body: OperationResponseBodyKind.Enum["event-stream"],
  decoderExpression: O.none(),
  schema: O.none(),
  status,
  typeExpression: "Sse.Event",
});

const emptyResponse = (status: string, onlySuccessStatus: boolean): OperationResponse => ({
  alias: O.none(),
  body: OperationResponseBodyKind.Enum.none,
  decoderExpression: O.some(onlySuccessStatus ? "S.Void" : "S.Undefined"),
  schema: O.none(),
  status,
  typeExpression: onlySuccessStatus ? "void" : "undefined",
});

const successResponse = (
  methodName: string,
  status: string,
  response: OpenApiResponse,
  alone: boolean
): OperationResponse => {
  const content = response.content ?? R.empty<string, OpenApiMedia>();

  return Match.value(responseBodyKind(content)).pipe(
    Match.when("json", () =>
      pipe(
        mediaSchema(content, "application/json"),
        O.map((schema) => jsonResponse(methodName, status, schema)),
        O.getOrElse(() => jsonResponse(methodName, status, UnknownJsonSchema))
      )
    ),
    Match.when("event-stream", () => eventStreamResponse(status)),
    Match.when("text", () => textResponse(status)),
    Match.when("none", () => emptyResponse(status, alone)),
    Match.exhaustive
  );
};

const buildResponses = Effect.fnUntraced(function* (
  document: OpenApiDocument,
  methodName: string,
  operation: OpenApiOperation
) {
  const statuses = pipe(Struct.keys(operation.responses), A.filter(isSuccessStatus), A.sort(Order.String));
  const alone = A.length(statuses) === 1;
  const responses = yield* Effect.forEach(
    statuses,
    (status) =>
      pipe(
        R.get(operation.responses, status),
        Effect.fromOption(() => postProcessError(`Missing ${status} response of ${methodName}`, status)),
        Effect.flatMap(resolveResponse(document)),
        Effect.map((response) => successResponse(methodName, status, response, alone))
      ),
    { concurrency: 1 }
  );

  return yield* A.match(responses, {
    onEmpty: () => Effect.fail(postProcessError(`Runpod operation ${methodName} declares no 2xx response`, methodName)),
    onNonEmpty: Effect.succeed,
  });
});

const operationKind = (
  methodName: string,
  responses: A.NonEmptyReadonlyArray<OperationResponse>
): Effect.Effect<OperationKind, CodegenPostProcessError> => {
  const isStreaming = (response: OperationResponse): boolean =>
    response.body === OperationResponseBodyKind.Enum["event-stream"];

  return Match.value({ all: A.every(responses, isStreaming), any: A.some(responses, isStreaming) }).pipe(
    Match.when({ any: false }, () => Effect.succeed(OperationKind.Enum.effect)),
    Match.when({ all: true }, () => Effect.succeed(OperationKind.Enum["event-stream"])),
    Match.orElse(() =>
      Effect.fail(
        postProcessError(`Runpod operation ${methodName} mixes event-stream and other success bodies`, methodName)
      )
    )
  );
};

const schemaProperties = (document: OpenApiDocument, schema: JsonSchema): Readonly<Record<string, JsonSchema>> => {
  const target = pipe(
    refNameFromSchema(schema),
    O.flatMap((name) => R.get(document.components.schemas, name)),
    O.getOrElse(() => schema)
  );
  const fromMembers = pipe(
    O.fromUndefinedOr(target.allOf),
    O.getOrElse(A.empty<JsonSchema>),
    A.reduce(R.empty<string, JsonSchema>(), (properties, member) => ({
      ...properties,
      ...schemaProperties(document, member),
    }))
  );

  return { ...fromMembers, ...(target.properties ?? R.empty<string, JsonSchema>()) };
};

const operationPagination = Effect.fnUntraced(function* (input: {
  readonly document: OpenApiDocument;
  readonly kind: OperationKind;
  readonly methodName: string;
  readonly requestFields: ReadonlyArray<RequestField>;
  readonly responseTypeExpression: string;
  readonly responses: A.NonEmptyReadonlyArray<OperationResponse>;
}) {
  const hasCursor = A.some(
    input.requestFields,
    (field) => field.location === RequestFieldLocation.Enum.query && field.name === PAGINATION_CURSOR_FIELD
  );
  const properties = pipe(
    input.responses,
    O.liftPredicate((responses) => A.length(responses) === 1 && input.kind === OperationKind.Enum.effect),
    O.map(A.headNonEmpty),
    O.flatMap((response) => response.schema),
    O.map((schema) => schemaProperties(input.document, schema)),
    O.filter((schemaProperties) => R.has(schemaProperties, PAGINATION_PROPERTY))
  );

  if (!hasCursor || O.isNone(properties)) {
    return O.none<OperationPagination>();
  }

  const itemKeys = pipe(
    Struct.entries(properties.value),
    A.filter(([name, schema]) => name !== PAGINATION_PROPERTY && schemaType(schema) === "array"),
    A.map(([name]) => name)
  );

  return yield* A.match(itemKeys, {
    onEmpty: () =>
      Effect.fail(postProcessError(`Paginated operation ${input.methodName} has no item array`, input.methodName)),
    onNonEmpty: (keys) =>
      A.length(keys) === 1
        ? Effect.succeedSome({
            itemTypeExpression: `${input.responseTypeExpression}["${A.headNonEmpty(keys)}"][number]`,
            itemsKey: A.headNonEmpty(keys),
          })
        : Effect.fail(
            postProcessError(
              `Paginated operation ${input.methodName} has several item arrays: ${A.join(keys, ", ")}`,
              input.methodName
            )
          ),
  });
});

const renderGeneratedFile = (operations: ReadonlyArray<Operation>): string => {
  const aliases = pipe(
    operations,
    A.flatMap((operation) => A.flatMap(operation.responses, (response) => O.toArray(response.alias))),
    A.dedupeWith((left, right) => left.name === right.name)
  );

  return `${renderHeader(operations)}

${pipe(aliases, A.map(renderSchemaAlias), A.join("\n\n"))}

${pipe(operations, A.map(renderRequestClass), A.join("\n\n"))}

${renderOperationDescriptorClass(operations)}

${pipe(operations, A.map(renderOperationDescriptor), A.join("\n\n"))}

${renderOperationSpecs(operations)}

${renderOperationFactory()}

${renderOperationsShape(operations)}

${renderMakeOperations(operations)}
`;
};

const usesEventStream = (operations: ReadonlyArray<Operation>): boolean =>
  A.some(operations, (operation) => operation.kind === OperationKind.Enum["event-stream"]);

const renderHeader = (operations: ReadonlyArray<Operation>): string => `/**
 * Generated Runpod REST API v2 request models, operation descriptors, and
 * the operation table.
 * Do not edit this file by hand.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import type * as Effect from "effect/Effect";
${usesEventStream(operations) ? 'import type * as Sse from "effect/encoding/Sse";\n' : ""}import * as S from "effect/Schema";
import type * as Stream from "effect/Stream";

import { $RunpodId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Models from "./Runpod.models.gen.ts";

const $I = $RunpodId.create("Runpod.generated");
`;

const renderSchemaAlias = (alias: SchemaAlias): string => {
  const annotation = `$I.annoteSchema("${alias.name}", {
    description: "${alias.name} schema generated from the Runpod OpenAPI document.",
  })`;

  return `/**
 * ${alias.name} schema generated from the Runpod OpenAPI document.
 *
 * **Example** (Inspect the ${alias.name} schema)
 *
 * \`\`\`ts
 * import { ${alias.name} } from "@beep/runpod"
 *
 * console.log(${alias.name}.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.1.0
 */
export const ${alias.name} = ${pipeExpression(alias.expression, annotation)};

/**
 * ${alias.name} value generated from the Runpod OpenAPI document.
 *
 * **Example** (Reference the ${alias.name} type)
 *
 * \`\`\`ts
 * import type { ${alias.name} } from "@beep/runpod"
 *
 * type ${alias.name}Value = ${alias.name}
 * \`\`\`
 *
 * @category type-level
 * @since 0.1.0
 */
export type ${alias.name} = typeof ${alias.name}.Type;`;
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
export class ${operation.requestClassName} extends S.Class<${operation.requestClassName}, { readonly brand: unique symbol }>($I\`${operation.requestClassName}\`)(
  {
${pipe(fields, A.join("\n"))}
  },
  $I.annote("${operation.requestClassName}", {
    description: "Request input for ${operation.operationId}.",
  })
) {}`;
};

const renderLiteralKitSchema = (input: {
  readonly description: string;
  readonly name: string;
  readonly typeAlias: string;
  readonly values: ReadonlyArray<string>;
}): string => `const ${input.name}Base = LiteralKit(${encodeJsonLiteral(input.values)});
/**
 * ${input.description}
 *
 * **Example** (Inspect the ${input.name} schema)
 *
 * \`\`\`ts
 * import { ${input.name} } from "@beep/runpod"
 *
 * console.log(${input.name}.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
export const ${input.name} = ${input.name}Base.pipe(
  $I.annoteSchema("${input.name}", {
    description: "${input.description}",
  }),
  SchemaUtils.withLiteralKitStatics(${input.name}Base)
);

/**
 * ${input.description}
 *
 * **Example** (Reference the ${input.name} type)
 *
 * \`\`\`ts
 * import type { ${input.name} } from "@beep/runpod"
 *
 * type ${input.typeAlias} = ${input.name}
 * \`\`\`
 *
 * @category type-level
 * @since 0.1.0
 */
export type ${input.name} = typeof ${input.name}.Type;`;

const renderOperationDescriptorClass = (operations: ReadonlyArray<Operation>): string => {
  const methods = A.dedupe(A.map(operations, (operation) => operation.method));
  const operationIds = A.dedupe(A.map(operations, (operation) => operation.operationId));

  return `${renderLiteralKitSchema({
    description: "Supported Runpod HTTP methods.",
    name: "RunpodHttpMethod",
    typeAlias: "Method",
    values: methods,
  })}

${renderLiteralKitSchema({
  description: "Operation ids exposed by Runpod REST API v2.",
  name: "RunpodOperationId",
  typeAlias: "OperationId",
  values: operationIds,
})}

${renderLiteralKitSchema({
  description: "Request body encoding used by a Runpod operation.",
  name: "RunpodRequestBodyKind",
  typeAlias: "RequestBodyKind",
  values: OperationRequestBodyKind.literals,
})}

${renderLiteralKitSchema({
  description: "Response body decoding used by a Runpod operation status.",
  name: "RunpodResponseBodyKind",
  typeAlias: "ResponseBodyKind",
  values: OperationResponseBodyKind.literals,
})}

${renderLiteralKitSchema({
  description: "Query serialization of a Runpod parameter: repeated keys, comma-joined values, or one JSON value.",
  name: "RunpodQueryEncoding",
  typeAlias: "QueryEncoding",
  values: OperationQueryEncoding.literals,
})}

/**
 * Query parameter of a Runpod operation: the request field it reads, its wire name, and its serialization.
 *
 * **Example** (Describe a repeated query parameter)
 *
 * \`\`\`ts
 * import { RunpodQueryParameter } from "@beep/runpod"
 *
 * const parameter = RunpodQueryParameter.make({ encoding: "repeat", field: "limit", name: "limit" })
 * console.log(parameter.name)
 * \`\`\`
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodQueryParameter extends S.Opaque<RunpodQueryParameter, { readonly brand: unique symbol }>()(
  S.Struct({
    encoding: RunpodQueryEncoding,
    field: S.String,
    name: S.String,
  }).pipe(
    $I.annoteSchema("RunpodQueryParameter", {
      description: "Query parameter of a Runpod operation: request field, wire name, and serialization.",
    })
  )
) {}

/**
 * Header parameter of a Runpod operation: the request field it reads and the header it sets.
 *
 * **Example** (Describe a header parameter)
 *
 * \`\`\`ts
 * import { RunpodHeaderParameter } from "@beep/runpod"
 *
 * const parameter = RunpodHeaderParameter.make({ field: "idempotencyKey", name: "Idempotency-Key" })
 * console.log(parameter.name)
 * \`\`\`
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodHeaderParameter extends S.Opaque<RunpodHeaderParameter, { readonly brand: unique symbol }>()(
  S.Struct({
    field: S.String,
    name: S.String,
  }).pipe(
    $I.annoteSchema("RunpodHeaderParameter", {
      description: "Header parameter of a Runpod operation: request field and header name.",
    })
  )
) {}

/**
 * Success status declared by a Runpod operation and how its body decodes.
 *
 * **Example** (Describe a JSON success response)
 *
 * \`\`\`ts
 * import { RunpodOperationResponse } from "@beep/runpod"
 *
 * const response = RunpodOperationResponse.make({ body: "json", status: "200" })
 * console.log(response.status)
 * \`\`\`
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodOperationResponse extends S.Opaque<RunpodOperationResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    body: RunpodResponseBodyKind,
    status: S.String,
  }).pipe(
    $I.annoteSchema("RunpodOperationResponse", {
      description: "Success status declared by a Runpod operation and how its body decodes.",
    })
  )
) {}

/**
 * Static metadata for one Runpod REST operation.
 *
 * **Details**
 *
 * \`path\` is relative to the \`https://api.runpod.io/v2\` base URL.
 * \`responses\` lists the declared 2xx statuses in ascending order; the first
 * one decodes a success status the operation does not declare.
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
export class RunpodOperationDescriptor extends S.Class<RunpodOperationDescriptor, { readonly brand: unique symbol }>($I\`RunpodOperationDescriptor\`)(
  {
    authenticated: S.Boolean,
    headerParams: S.Array(RunpodHeaderParameter),
    method: RunpodHttpMethod,
    methodName: S.String,
    operationId: RunpodOperationId,
    path: S.String,
    pathParams: S.Array(S.String),
    queryParams: S.Array(RunpodQueryParameter),
    requestBody: RunpodRequestBodyKind,
    requestBodyRequired: S.Boolean,
    responses: S.Array(RunpodOperationResponse),
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

const fieldsAt = (operation: Operation, location: RequestFieldLocation): ReadonlyArray<RequestField> =>
  A.filter(operation.requestFields, (field) => field.location === location);

const renderArrayLiteral = (entries: ReadonlyArray<string>): string =>
  A.match(entries, {
    onEmpty: () => "[]",
    onNonEmpty: (values) =>
      `[\n${pipe(
        values,
        A.map((value) => `    ${value},`),
        A.join("\n")
      )}\n  ]`,
  });

const renderOperationDescriptor = (operation: Operation): string => {
  const pathParams = A.map(fieldsAt(operation, RequestFieldLocation.Enum.path), (field) => field.wireName);
  const queryParams = A.map(
    fieldsAt(operation, RequestFieldLocation.Enum.query),
    (field) =>
      `RunpodQueryParameter.make({ encoding: "${field.queryEncoding}", field: "${field.name}", name: "${field.wireName}" })`
  );
  const headerParams = A.map(
    fieldsAt(operation, RequestFieldLocation.Enum.header),
    (field) => `RunpodHeaderParameter.make({ field: "${field.name}", name: "${field.wireName}" })`
  );
  const responses = A.map(
    operation.responses,
    (response) => `RunpodOperationResponse.make({ body: "${response.body}", status: "${response.status}" })`
  );
  const requestBody = A.isReadonlyArrayNonEmpty(fieldsAt(operation, RequestFieldLocation.Enum.body))
    ? OperationRequestBodyKind.Enum.json
    : OperationRequestBodyKind.Enum.none;

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
  authenticated: ${renderBooleanLiteral(operation.authenticated)},
  headerParams: ${renderArrayLiteral(headerParams)},
  method: "${operation.method}",
  methodName: "${operation.methodName}",
  operationId: "${operation.operationId}",
  path: "${operation.path}",
  pathParams: ${encodeJsonLiteral(pathParams)},
  queryParams: ${renderArrayLiteral(queryParams)},
  requestBody: "${requestBody}",
  requestBodyRequired: ${renderBooleanLiteral(operation.requestBodyRequired)},
  responses: ${renderArrayLiteral(responses)},
});`;
};

const renderResponseDecoders = (operation: Operation): string =>
  pipe(
    operation.responses,
    A.flatMap((response) =>
      O.toArray(O.map(response.decoderExpression, (decoder) => `      "${response.status}": ${decoder},`))
    ),
    A.match({
      onEmpty: () => "{}",
      onNonEmpty: (entries) => `{\n${A.join(entries, "\n")}\n    }`,
    })
  );

const renderOperationSpecs = (operations: ReadonlyArray<Operation>): string => {
  const entries = A.map(
    operations,
    (operation) => `  ${operation.methodName}: {
    descriptor: ${operation.descriptorName},
    request: ${operation.requestClassName},
    responses: ${renderResponseDecoders(operation)},
  },`
  );

  return `/**
 * Generated operation spec table for Runpod service construction.
 *
 * **Details**
 *
 * \`responses\` maps each declared 2xx status to the schema its body decodes
 * with. Event-stream operations declare no decoder: their bodies are parsed as
 * Server-Sent Events.
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
${A.join(entries, "\n")}
};`;
};

const renderOperationFactory = (): string => `/**
 * Request schema, descriptor, and per-status response decoders of one Runpod operation.
 *
 * **Example** (Type a spec from the generated table)
 *
 * \`\`\`ts
 * import type { ListPodsParams, ListPodsResponse, RunpodOperationSpec } from "@beep/runpod"
 * import { RUNPOD_OPERATION_SPECS } from "@beep/runpod"
 *
 * const spec: RunpodOperationSpec<ListPodsParams, ListPodsResponse> = RUNPOD_OPERATION_SPECS.listPods
 * console.log(spec.descriptor.path)
 * \`\`\`
 *
 * @category models
 * @since 0.1.0
 */
export interface RunpodOperationSpec<Request, Response> {
  readonly descriptor: RunpodOperationDescriptor;
  readonly request: S.ConstraintCodec<Request, unknown>;
  readonly responses: { readonly [status: string]: S.ConstraintDecoder<Response> };
}

/**
 * Transport that turns generated operation specs into callable methods.
 *
 * **Details**
 *
 * \`effect\` runs one request and decodes the body of the returned success
 * status. \`eventStream\` parses a Server-Sent Events body. \`paginate\` follows
 * \`pagination.nextCursor\` through the \`cursor\` query parameter and emits the
 * items of every page. Each takes an optional default request for operations
 * whose request has no required field.
 *
 * **Example** (Reference the factory type)
 *
 * \`\`\`ts
 * import type { RunpodOperationFactory } from "@beep/runpod"
 *
 * type Factory = RunpodOperationFactory<never>
 * \`\`\`
 *
 * @category services
 * @since 0.1.0
 */
export interface RunpodOperationFactory<E> {
  readonly effect: {
    <Request, Response>(spec: RunpodOperationSpec<Request, Response>): (request: Request) => Effect.Effect<Response, E>;
    <Request, Response>(
      spec: RunpodOperationSpec<Request, Response>,
      defaultRequest: () => Request
    ): (request?: Request) => Effect.Effect<Response, E>;
  };
  readonly eventStream: {
    <Request>(spec: RunpodOperationSpec<Request, unknown>): (request: Request) => Stream.Stream<Sse.Event, E>;
    <Request>(
      spec: RunpodOperationSpec<Request, unknown>,
      defaultRequest: () => Request
    ): (request?: Request) => Stream.Stream<Sse.Event, E>;
  };
  readonly paginate: {
    <Request, Page extends { readonly pagination: Models.Pagination }, Item>(
      spec: RunpodOperationSpec<Request, Page>,
      items: (page: Page) => ReadonlyArray<Item>
    ): (request: Request) => Stream.Stream<Item, E>;
    <Request, Page extends { readonly pagination: Models.Pagination }, Item>(
      spec: RunpodOperationSpec<Request, Page>,
      items: (page: Page) => ReadonlyArray<Item>,
      defaultRequest: () => Request
    ): (request?: Request) => Stream.Stream<Item, E>;
  };
}`;

const sanitizeComment = (text: string): string =>
  pipe(text, Str.replaceAll("*/", "*\\/"), Str.replaceAll("\n", " "), Str.trim);

const renderShapeMember = (input: {
  readonly name: string;
  readonly request: string;
  readonly result: string;
  readonly summary: O.Option<string>;
}): string => {
  const doc = pipe(
    input.summary,
    O.map((summary) => `  /** ${sanitizeComment(summary)} */\n`),
    O.getOrElse(() => "")
  );

  return `${doc}  readonly ${input.name}: (${input.request}) => ${input.result};`;
};

const requestParameter = (operation: Operation): string =>
  operation.hasRequiredRequest ? `request: ${operation.requestClassName}` : `request?: ${operation.requestClassName}`;

const operationShapeMembers = (operation: Operation): ReadonlyArray<string> => {
  const request = requestParameter(operation);
  const primary = Match.value(operation.kind).pipe(
    Match.when("effect", () =>
      renderShapeMember({
        name: operation.methodName,
        request,
        result: `Effect.Effect<${operation.responseTypeExpression}, E>`,
        summary: operation.summary,
      })
    ),
    Match.when("event-stream", () =>
      renderShapeMember({
        name: operation.methodName,
        request,
        result: "Stream.Stream<Sse.Event, E>",
        summary: operation.summary,
      })
    ),
    Match.exhaustive
  );
  const paginated = pipe(
    operation.pagination,
    O.map((pagination) =>
      renderShapeMember({
        name: `${operation.methodName}Stream`,
        request,
        result: `Stream.Stream<${pagination.itemTypeExpression}, E>`,
        summary: O.some(`Stream every ${pagination.itemsKey} item of ${operation.operationId}, following the cursor.`),
      })
    ),
    O.toArray
  );

  return A.prepend(paginated, primary);
};

const renderOperationsShape = (operations: ReadonlyArray<Operation>): string => `/**
 * Typed method surface generated from Runpod REST API v2.
 *
 * **Details**
 *
 * Every cursor-paginated list also gets a \`<method>Stream\` member that
 * emits the items of every page.
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
${pipe(operations, A.flatMap(operationShapeMembers), A.join("\n"))}
}`;

const defaultRequestArgument = (operation: Operation): string =>
  operation.hasRequiredRequest ? "" : `, () => ${operation.requestClassName}.make({})`;

const operationMembers = (operation: Operation): ReadonlyArray<string> => {
  const spec = `RUNPOD_OPERATION_SPECS.${operation.methodName}`;
  const defaultRequest = defaultRequestArgument(operation);
  const primary = Match.value(operation.kind).pipe(
    Match.when(
      "effect",
      () =>
        `  ${operation.methodName}: factory.effect<${operation.requestClassName}, ${operation.responseTypeExpression}>(${spec}${defaultRequest}),`
    ),
    Match.when(
      "event-stream",
      () => `  ${operation.methodName}: factory.eventStream<${operation.requestClassName}>(${spec}${defaultRequest}),`
    ),
    Match.exhaustive
  );
  const paginated = pipe(
    operation.pagination,
    O.map(
      (pagination) =>
        `  ${operation.methodName}Stream: factory.paginate<${operation.requestClassName}, ${operation.responseTypeExpression}, ${pagination.itemTypeExpression}>(${spec}, (page) => page.${pagination.itemsKey}${defaultRequest}),`
    ),
    O.toArray
  );

  return A.prepend(paginated, primary);
};

const renderMakeOperations = (operations: ReadonlyArray<Operation>): string => `/**
 * Build the generated Runpod method surface from an operation factory.
 *
 * **Example** (Inspect the operation table builder)
 *
 * \`\`\`ts
 * import { makeRunpodOperations } from "@beep/runpod"
 *
 * console.log(makeRunpodOperations.length) // => 1
 * \`\`\`
 *
 * @category constructors
 * @since 0.1.0
 */
export const makeRunpodOperations = <E>(factory: RunpodOperationFactory<E>): RunpodOperationsShape<E> => ({
${pipe(operations, A.flatMap(operationMembers), A.join("\n"))}
});`;

const referencedSchemaExpression = (schema: JsonSchema): O.Option<string> =>
  pipe(
    refNameFromSchema(schema),
    O.map((refName) => wrapNullable(schema, `S.suspend(() => Models.${refName})`))
  );

const annotatedRefWrapperExpression = (schema: JsonSchema, hint: string): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(schema.allOf),
    O.filter((members) => A.length(members) === 1),
    O.flatMap(A.head),
    O.map((member) => schemaExpression(member, hint))
  );

const enumSchemaExpression = (schema: JsonSchema): O.Option<string> =>
  pipe(
    schema.enum,
    O.fromUndefinedOr,
    O.map(A.filter(P.isString)),
    O.filter((values) => A.isReadonlyArrayNonEmpty(values)),
    O.map((values) => wrapNullable(schema, `LiteralKit(${encodeJsonLiteral(values)})`))
  );

const renderStructProperty = (
  required: ReadonlyArray<string>,
  propertyName: string,
  propertySchema: JsonSchema
): string => {
  const expression = schemaExpression(propertySchema, propertyName);
  const renderedExpression = A.contains(required, propertyName) ? expression : optionalExpression(expression);

  return `    ${propertyName}: ${renderedExpression},`;
};

const structSchemaExpression = (schema: JsonSchema): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(schema.properties),
    O.map((properties) => {
      const required = schema.required ?? A.empty<string>();
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

const schemaTypes = (schema: JsonSchema): ReadonlyArray<string> =>
  Match.type<string | ReadonlyArray<string> | undefined>().pipe(
    Match.when(P.isString, (type): ReadonlyArray<string> => [type]),
    Match.when(P.isUndefined, (): ReadonlyArray<string> => []),
    Match.orElse((types): ReadonlyArray<string> => types)
  )(schema.type);

const schemaType = (schema: JsonSchema): string | undefined =>
  pipe(
    schemaTypes(schema),
    A.findFirst((type) => type !== "null"),
    O.getOrUndefined
  );

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
    O.orElse(() => annotatedRefWrapperExpression(schema, hint)),
    O.orElse(() => enumSchemaExpression(schema)),
    O.getOrElse(() => primitiveSchemaExpression(schema, hint))
  );

const pipeExpression = (expression: string, operation: string): string => {
  const pipeMatch = /^([^\n]*\.pipe\()([\s\S]*)\)$/.exec(expression);

  return pipeMatch === null ? `${expression}.pipe(${operation})` : `${pipeMatch[1]}${pipeMatch[2]}, ${operation})`;
};

const optionalExpression = (expression: string): string => pipeExpression(expression, "S.optionalKey");

const isNullable = (schema: JsonSchema): boolean => schema.nullable === true || A.contains(schemaTypes(schema), "null");

const wrapNullable = (schema: JsonSchema, expression: string): string =>
  isNullable(schema) ? pipeExpression(expression, "S.NullOr") : expression;

const refNameFromSchema = (schema: JsonSchema): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(schema.$ref),
    O.flatMap((ref) => componentName(ref, COMPONENT_SCHEMA_REF_PREFIX))
  );
