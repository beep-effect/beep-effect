/**
 * Pure OpenAPI planning and schema projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import {
  LiteralKit,
  MappedLiteralKit,
  NonEmptyTrimmedStr,
  SchemaUtils,
} from "@beep/schema";
import { A, O, P, R, Str, Struct, pipe } from "@beep/utils";
import {
  HashMap,
  HashSet,
  Order,
  Result,
} from "effect";
import {
  fromSchemaOpenApi3_0,
  fromSchemaOpenApi3_1,
} from "effect/JsonSchema";
import * as S from "effect/Schema";
import { isBlockedMember } from "../Codemode.tool-runtime.ts";
import {
  ApiKeyCookie,
  ApiKeyCarrier,
  ApiKeyHeader,
  ApiKeyQuery,
  Body,
  type Document,
  InputField,
  InputLocation,
  InputStyle,
  JsonSchema,
  OperationInput,
  SecurityRequirement,
  SecurityScheme,
  SecuritySchemeApiKey,
  SecuritySchemeHttp,
  SecuritySchemeOAuth2,
  SecuritySchemeOpenIdConnect,
} from "./OpenAPI.types.ts";

const $I = $ScratchpadId.create("codemode/openapi/OpenAPI.specification");

const UnknownRecord = S.Record(S.String, S.Unknown);
const NonEmptyString = S.NonEmptyString;
const SuccessStatus = S.String.check(S.isPattern(/^2\d\d$/u));

/** Supported parameter locations before request-body fields are introduced. */
export const ParameterLocation = LiteralKit(["path", "query", "header"]).pipe(
  $I.annoteSchema("ParameterLocation", {
    description: "OpenAPI parameter locations supported by CodeMode.",
  })
);

/** Runtime type for {@link ParameterLocation}. */
export type ParameterLocation = typeof ParameterLocation.Type;

const ignoredHeaderParameters = LiteralKit([
  "accept",
  "content-type",
  "authorization",
]);

/** Direction used while removing visibility-only schema properties. */
export const SchemaDirection = LiteralKit(["request", "response"]).pipe(
  $I.annoteSchema("SchemaDirection", {
    description: "The model-facing direction of an OpenAPI schema.",
  })
);

/** Runtime type for {@link SchemaDirection}. */
export type SchemaDirection = typeof SchemaDirection.Type;

const HiddenKeyword = MappedLiteralKit([
  ["request", "readOnly"],
  ["response", "writeOnly"],
]);

const nestedSchemas = LiteralKit([
  "items",
  "additionalProperties",
  "unevaluatedProperties",
  "propertyNames",
  "then",
  "else",
]);
const nestedSchemaLists = LiteralKit(["anyOf", "oneOf", "prefixItems"]);
const nestedSchemaMaps = LiteralKit([
  "patternProperties",
  "dependentSchemas",
  "$defs",
  "definitions",
]);

/** Guard for JSON-style records used by OpenAPI. */
export const isRecord = S.is(UnknownRecord);

/** Decodes a non-empty string without scattering nullish checks. */
export const nonEmptyString = S.decodeUnknownOption(NonEmptyString);

/** Own-property lookup for spec-controlled records. */
export const own = <Value>(
  record: Readonly<Record<string, Value>>,
  key: string
): O.Option<Value> => R.get(record, key);

const ownArray = (
  record: Readonly<Record<string, unknown>>,
  key: string
): O.Option<ReadonlyArray<unknown>> => {
  const value = own(record, key);
  return O.isSome(value) && A.isArray(value.value)
    ? O.some(value.value)
    : O.none();
};

const ownBoolean = (
  record: Readonly<Record<string, unknown>>,
  key: string
): O.Option<boolean> =>
  pipe(own(record, key), O.filter(P.isBoolean));

const ownRecord = (
  record: Readonly<Record<string, unknown>>,
  key: string
): O.Option<Readonly<Record<string, unknown>>> =>
  pipe(own(record, key), O.filter(isRecord));

const emptyUnknownArray = (): ReadonlyArray<unknown> => A.empty();
const emptyUnknownRecord = (): Readonly<Record<string, unknown>> =>
  R.emptyReadonly();

const isIgnoredHeaderParameter = S.is(ignoredHeaderParameters);
const isNestedSchema = S.is(nestedSchemas);
const isNestedSchemaList = S.is(nestedSchemaLists);
const isNestedSchemaMap = S.is(nestedSchemaMaps);
const isParameterLocation = S.is(ParameterLocation);
const isInputStyle = S.is(InputStyle);

const resolvePointer = (root: unknown, ref: string): O.Option<unknown> =>
  pipe(
    ref,
    Str.slice(2),
    Str.split("/"),
    A.map(
      (segment) =>
        pipe(
          segment,
          Str.replaceAll("~1", "/"),
          Str.replaceAll("~0", "~")
        )
    ),
    A.reduce(O.some(root), (item, segment) =>
      pipe(
        item,
        O.filter(isRecord),
        O.flatMap((record) => own(record, segment))
      )
    )
  );

/** Resolves a local OpenAPI `$ref`, terminating cycles without native sets. */
export const resolve = (document: Document, value: unknown): unknown => {
  const next = (
    current: unknown,
    seen: HashSet.HashSet<string>
  ): unknown => {
    if (!isRecord(current)) return current;
    const ref = pipe(own(current, "$ref"), O.flatMap(nonEmptyString));
    if (
      O.isNone(ref) ||
      !Str.startsWith(ref.value, "#/") ||
      HashSet.has(seen, ref.value)
    ) {
      return current;
    }
    return pipe(
      resolvePointer(document, ref.value),
      O.match({
        onNone: () => current,
        onSome: (target) => next(target, HashSet.add(seen, ref.value)),
      })
    );
  };
  return next(value, HashSet.empty());
};

class SchemaResource extends S.Class<SchemaResource>($I`SchemaResource`)(
  { value: S.Unknown, root: S.Unknown },
  $I.annote("SchemaResource", {
    description: "A schema node and the resource root for local references.",
  })
) {
  static readonly new = (value: unknown, root: unknown): SchemaResource =>
    SchemaResource.make({ value, root });
}

const resolveResource = (
  document: Document,
  resource: SchemaResource
): SchemaResource => {
  if (!isRecord(resource.value)) return resource;
  const ref = pipe(own(resource.value, "$ref"), O.flatMap(nonEmptyString));
  if (O.isNone(ref) || !Str.startsWith(ref.value, "#/")) return resource;
  const local =
    Str.startsWith(ref.value, "#/$defs/") ||
    Str.startsWith(ref.value, "#/definitions/");
  return pipe(
    resolvePointer(local ? resource.root : document, ref.value),
    O.match({
      onNone: () => resource,
      onSome: (target) =>
        SchemaResource.new(target, local ? resource.root : target),
    })
  );
};

/** Returns whether a document contains directional visibility keywords. */
export const hasDirectionalSchemas = (document: Document): boolean => {
  const contains = (
    value: unknown,
    visited: HashSet.HashSet<object>
  ): boolean => {
    if (A.isArray(value)) {
      return A.some(value, (item) => contains(item, visited));
    }
    if (
      !isRecord(value) ||
      HashSet.has(visited, value)
    ) {
      return false;
    }
    const next = HashSet.add(visited, value);
    if (
      pipe(ownBoolean(value, "readOnly"), O.contains(true)) ||
      pipe(ownBoolean(value, "writeOnly"), O.contains(true))
    ) {
      return true;
    }
    return pipe(
      value,
      R.values,
      A.some((item) => contains(item, next))
    );
  };
  return contains(document, HashSet.empty());
};

const isHidden = (
  document: Document,
  resource: SchemaResource,
  direction: SchemaDirection,
  seen: HashSet.HashSet<object> = HashSet.empty()
): boolean => {
  const value = resource.value;
  if (!isRecord(value) || HashSet.has(seen, value)) return false;
  const nextSeen = HashSet.add(seen, value);
  if (
    pipe(
      ownBoolean(value, HiddenKeyword.Enum[direction]),
      O.contains(true)
    )
  ) {
    return true;
  }
  const composed = pipe(
    ownArray(value, "allOf"),
    O.getOrElse(emptyUnknownArray),
    A.some((item) =>
      isHidden(
        document,
        SchemaResource.new(item, resource.root),
        direction,
        nextSeen
      )
    )
  );
  if (composed) return true;
  const target = resolveResource(document, resource);
  return (
    target.value !== value &&
    isHidden(document, target, direction, nextSeen)
  );
};

const hiddenNames = (
  document: Document,
  resource: SchemaResource,
  direction: SchemaDirection,
  seen: HashSet.HashSet<object> = HashSet.empty()
): HashSet.HashSet<string> => {
  const value = resource.value;
  if (!isRecord(value) || HashSet.has(seen, value)) return HashSet.empty();
  const nextSeen = HashSet.add(seen, value);
  const properties: ReadonlyArray<[string, unknown]> = pipe(
    ownRecord(value, "properties"),
    O.map(R.toEntries),
    O.getOrElse((): ReadonlyArray<[string, unknown]> => A.empty())
  );
  const declared: HashSet.HashSet<string> = pipe(
    properties,
    A.filter(([, property]) =>
      isHidden(
        document,
        SchemaResource.new(property, resource.root),
        direction
      )
    ),
    A.map(([name]) => name),
    HashSet.fromIterable
  );
  const composed = pipe(
    ownArray(value, "allOf"),
    O.getOrElse(emptyUnknownArray),
    A.reduce(declared, (names, item) =>
      HashSet.union(
        names,
        hiddenNames(
          document,
          SchemaResource.new(item, resource.root),
          direction,
          nextSeen
        )
      )
    )
  );
  const target = resolveResource(document, resource);
  return target.value === value
    ? composed
    : HashSet.union(
        composed,
        hiddenNames(document, target, direction, nextSeen)
      );
};

const directionalSchema = (
  document: Document,
  resource: SchemaResource,
  direction: SchemaDirection,
  excluded: HashSet.HashSet<string> = HashSet.empty(),
  seen: HashSet.HashSet<object> = HashSet.empty()
): unknown => {
  if (!isRecord(resource.value) || HashSet.has(seen, resource.value)) {
    return resource.value;
  }
  const nextSeen = HashSet.add(seen, resource.value);
  const hidden = HashSet.union(
    excluded,
    hiddenNames(document, resource, direction)
  );
  const project = (
    item: unknown,
    inherited: HashSet.HashSet<string> = HashSet.empty()
  ): unknown =>
    directionalSchema(
      document,
      SchemaResource.new(item, resource.root),
      direction,
      inherited,
      nextSeen
    );

  return pipe(
    resource.value,
    R.toEntries,
    A.map(([key, item]) => {
      if (key === "properties" && isRecord(item)) {
        return [
          key,
          pipe(
            item,
            R.toEntries,
            A.filter(([name]) => !HashSet.has(hidden, name)),
            A.map(([name, property]) => [name, project(property)] as const),
            Struct.fromEntries
          ),
        ] as const;
      }
      if (key === "required" && A.isArray(item)) {
        return [
          key,
          A.filter(
            item,
            (name) => !P.isString(name) || !HashSet.has(hidden, name)
          ),
        ] as const;
      }
      if (key === "allOf" && A.isArray(item)) {
        return [key, A.map(item, (entry) => project(entry, hidden))] as const;
      }
      if (isNestedSchema(key)) return [key, project(item)] as const;
      if (isNestedSchemaList(key) && A.isArray(item)) {
        return [key, A.map(item, (entry) => project(entry))] as const;
      }
      if (isNestedSchemaMap(key) && isRecord(item)) {
        return [
          key,
          pipe(
            item,
            R.toEntries,
            A.map(([name, entry]) => [name, project(entry)] as const),
            Struct.fromEntries
          ),
        ] as const;
      }
      return [key, item] as const;
    }),
    Struct.fromEntries
  );
};

const normalizeSchema = (
  document: Document,
  value: unknown
): Result.Result<JsonSchema, string> => {
  if (!isRecord(value)) return Result.succeed({} as JsonSchema);
  return pipe(
    Result.try({
      try: () =>
        pipe(
          own(document, "openapi"),
          O.flatMap(nonEmptyString),
          O.exists(Str.startsWith("3.0"))
        )
          ? fromSchemaOpenApi3_0(value)
          : fromSchemaOpenApi3_1(value),
      catch: (cause) =>
        `schema normalization failed: ${
          P.isError(cause) ? cause.message : globalThis.String(cause)
        }`,
    }),
    Result.map((normalized) =>
      JsonSchema.make(
        R.isEmptyReadonlyRecord(normalized.definitions)
          ? normalized.schema
          : {
              ...normalized.schema,
              $defs: normalized.definitions,
            }
      )
    )
  );
};

const projectSchema = (
  document: Document,
  value: unknown,
  direction: SchemaDirection
): Result.Result<JsonSchema, string> =>
  normalizeSchema(
    document,
    hasDirectionalSchemas(document)
      ? directionalSchema(
          document,
          SchemaResource.new(value, value),
          direction
        )
      : value
  );

/** Normalizes component schemas for one model-facing direction. */
export const componentDefinitions = (
  document: Document,
  direction: SchemaDirection
): Result.Result<Readonly<Record<string, JsonSchema>>, string> => {
  const components = pipe(
    ownRecord(document, "components"),
    O.getOrElse(emptyUnknownRecord)
  );
  const schemas = pipe(
    ownRecord(components, "schemas"),
    O.getOrElse(emptyUnknownRecord)
  );
  return pipe(
    schemas,
    R.toEntries,
    A.map(([name, value]) =>
      pipe(
        projectSchema(document, value, direction),
        Result.map((schema) => [name, schema] as const)
      )
    ),
    Result.all,
    Result.map(Struct.fromEntries)
  );
};

const withDefinitions = (
  schema: JsonSchema,
  definitions: Readonly<Record<string, JsonSchema>>
): JsonSchema => {
  if (R.isEmptyReadonlyRecord(definitions)) return schema;
  const local = pipe(
    ownRecord(schema, "$defs"),
    O.getOrElse(emptyUnknownRecord)
  );
  return JsonSchema.make({
    ...schema,
    $defs: R.union(definitions, local, (_definition, override) => override),
  });
};

const mediaTypeBase = (mediaType: string): string =>
  pipe(
    mediaType,
    Str.split(";"),
    A.head,
    O.getOrElse(() => ""),
    Str.trim,
    Str.toLowerCase
  );

const isJsonMediaType = (mediaType: string): boolean => {
  const normalized = mediaTypeBase(mediaType);
  return (
    normalized === "application/json" ||
    Str.endsWith(normalized, "+json")
  );
};

const isBinaryMediaType = (
  document: Document,
  mediaType: string,
  value: unknown
): boolean => {
  const normalized = mediaTypeBase(mediaType);
  if (
    !isJsonMediaType(normalized) &&
    !Str.startsWith(normalized, "text/")
  ) {
    return true;
  }
  if (!isRecord(value)) return false;
  const schema = resolve(document, pipe(own(value, "schema"), O.getOrUndefined));
  return (
    isRecord(schema) &&
    pipe(
      own(schema, "format"),
      O.filter(P.isString),
      O.contains("binary")
    )
  );
};

class JsonContent extends S.Class<JsonContent>($I`JsonContent`)(
  { mediaType: NonEmptyTrimmedStr, schema: S.Unknown },
  $I.annote("JsonContent", {
    description: "Selected JSON media type and its schema.",
  })
) {
  static readonly new = (
    mediaType: string,
    schema: unknown
  ): JsonContent =>
    JsonContent.make({
      mediaType: NonEmptyTrimmedStr.make(mediaType),
      schema,
    });
}

const jsonContent = (
  content: Readonly<Record<string, unknown>>
): O.Option<JsonContent> =>
  pipe(
    content,
    R.toEntries,
    A.findFirst(([mediaType]) => isJsonMediaType(mediaType)),
    O.flatMap(([mediaType, value]) =>
      isRecord(value)
        ? O.some(
            JsonContent.new(
              mediaType,
              pipe(own(value, "schema"), O.getOrUndefined)
            )
          )
        : O.none()
    )
  );

const isFlattenableObjectBody = (
  schema: unknown,
  requestRequired: boolean
): schema is Readonly<Record<string, unknown>> => {
  if (!isRecord(schema) || !requestRequired) return false;
  return (
    pipe(own(schema, "type"), O.filter(P.isString), O.contains("object")) &&
    O.isSome(ownRecord(schema, "properties")) &&
    pipe(ownBoolean(schema, "additionalProperties"), O.contains(false)) &&
    !pipe(ownBoolean(schema, "nullable"), O.contains(true)) &&
    O.isNone(own(schema, "allOf")) &&
    O.isNone(own(schema, "anyOf")) &&
    O.isNone(own(schema, "oneOf"))
  );
};

class PlannedField extends S.Class<PlannedField>($I`PlannedField`)(
  {
    name: NonEmptyTrimmedStr,
    location: InputLocation,
    required: S.Boolean,
    schema: JsonSchema,
    style: S.OptionFromOptionalKey(InputStyle).pipe(
      SchemaUtils.withNoneDefault
    ),
    explode: S.OptionFromOptionalKey(S.Boolean).pipe(
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("PlannedField", {
    description: "An operation field before conflict-safe input naming.",
  })
) {
  static readonly new = (
    name: string,
    location: InputLocation,
    required: boolean,
    schema: JsonSchema,
    style: O.Option<InputStyle>,
    explode: O.Option<boolean>
  ): PlannedField =>
    PlannedField.make({
      name: NonEmptyTrimmedStr.make(name),
      location,
      required,
      schema,
      style,
      explode,
    });
}

class DeclaredParameter extends S.Class<DeclaredParameter>(
  $I`DeclaredParameter`
)(
  {
    name: NonEmptyTrimmedStr,
    location: NonEmptyTrimmedStr,
    parameter: UnknownRecord,
  },
  $I.annote("DeclaredParameter", {
    description: "One resolved parameter declaration keyed for override semantics.",
  })
) {
  static readonly new = (
    name: string,
    location: string,
    parameter: Readonly<Record<string, unknown>>
  ): DeclaredParameter =>
    DeclaredParameter.make({
      name: NonEmptyTrimmedStr.make(name),
      location: NonEmptyTrimmedStr.make(location),
      parameter,
    });
}

const operationParameters = (
  document: Document,
  pathItem: Readonly<Record<string, unknown>>,
  operation: Readonly<Record<string, unknown>>
): Result.Result<ReadonlyArray<PlannedField>, string> => {
  const raw = A.appendAll(
    pipe(
      ownArray(pathItem, "parameters"),
      O.getOrElse(emptyUnknownArray)
    ),
    pipe(
      ownArray(operation, "parameters"),
      O.getOrElse(emptyUnknownArray)
    )
  );
  const declared = A.reduce(
    raw,
    Result.succeed(
      HashMap.empty<string, DeclaredParameter>()
    ) as Result.Result<HashMap.HashMap<string, DeclaredParameter>, string>,
    (accumulator, item) =>
      pipe(
        accumulator,
        Result.flatMap((parameters) => {
          const resolved = resolve(document, item);
          if (!isRecord(resolved)) {
            return Result.fail(
              "parameter declaration is invalid or unresolved"
            );
          }
          const name = pipe(own(resolved, "name"), O.flatMap(nonEmptyString));
          const location = pipe(
            own(resolved, "in"),
            O.flatMap(nonEmptyString)
          );
          if (O.isNone(name) || O.isNone(location)) {
            return Result.fail(
              "parameter declaration is missing name or location"
            );
          }
          return Result.succeed(
            HashMap.set(
              parameters,
              `${location.value}:${name.value}`,
              DeclaredParameter.new(
                name.value,
                location.value,
                resolved
              )
            )
          );
        })
      )
  );

  return pipe(
    declared,
    Result.flatMap((parameters) =>
      pipe(
        parameters,
        HashMap.values,
        A.fromIterable,
        A.map((item) => {
          const name = item.name;
          const location = item.location;
          const resolved = item.parameter;
          if (location === "cookie") {
            return Result.fail(
              `cookie parameter '${name}' is not supported`
            );
          }
          if (!isParameterLocation(location)) {
            return Result.fail(
              `parameter '${name}' uses unsupported location '${location}'`
            );
          }
          if (
            location === "header" &&
            isIgnoredHeaderParameter(Str.toLowerCase(name))
          ) {
            return Result.succeed(O.none<PlannedField>());
          }
          const rawSchema = own(resolved, "schema");
          const content = own(resolved, "content");
          if (O.isNone(rawSchema) && O.isNone(content)) {
            return Result.fail(
              `parameter '${name}' declares neither schema nor content`
            );
          }
          if (O.isSome(content)) {
            return Result.fail(
              `parameter '${name}' uses unsupported content encoding`
            );
          }
          const declaredStyle = pipe(
            own(resolved, "style"),
            O.flatMap(nonEmptyString),
            O.getOrElse(() => (location === "query" ? "form" : "simple"))
          );
          if (!isInputStyle(declaredStyle)) {
            return Result.fail(
              `parameter '${name}' uses unsupported style '${declaredStyle}'`
            );
          }
          if (
            location === "query" &&
            declaredStyle !== "form" &&
            declaredStyle !== "deepObject"
          ) {
            return Result.fail(
              `query parameter '${name}' uses unsupported style '${declaredStyle}'`
            );
          }
          if (location !== "query" && declaredStyle !== "simple") {
            return Result.fail(
              `${location} parameter '${name}' uses unsupported style '${declaredStyle}'`
            );
          }
          const explodeValue = own(resolved, "explode");
          if (
            O.isSome(explodeValue) &&
            !P.isBoolean(explodeValue.value)
          ) {
            return Result.fail(
              `parameter '${name}' has an invalid explode value`
            );
          }
          const allowReserved = own(resolved, "allowReserved");
          if (
            O.isSome(allowReserved) &&
            !P.isBoolean(allowReserved.value)
          ) {
            return Result.fail(
              `parameter '${name}' has an invalid allowReserved value`
            );
          }
          if (
            pipe(
              allowReserved,
              O.filter(P.isBoolean),
              O.contains(true)
            )
          ) {
            return Result.fail(
              `parameter '${name}' uses unsupported allowReserved encoding`
            );
          }
          const explode = pipe(
            explodeValue,
            O.filter(P.isBoolean),
            O.getOrElse(() => declaredStyle === "form")
          );
          if (declaredStyle === "deepObject" && !explode) {
            return Result.fail(
              `query parameter '${name}' uses deepObject with explode=false`
            );
          }
          return pipe(
            projectSchema(
              document,
              O.getOrUndefined(rawSchema),
              "request"
            ),
            Result.map((base) => {
              const description = pipe(
                own(resolved, "description"),
                O.flatMap(nonEmptyString)
              );
              const schema =
                O.isNone(own(base, "description")) &&
                O.isSome(description)
                  ? JsonSchema.make({
                      ...base,
                      description: description.value,
                    })
                  : base;
              return O.some(
                PlannedField.new(
                  name,
                  location,
                  pipe(
                    ownBoolean(resolved, "required"),
                    O.contains(true)
                  ) ||
                    location === "path",
                  schema,
                  O.some(declaredStyle),
                  O.some(explode)
                )
              );
            })
          );
        }),
        Result.all,
        Result.map(A.getSomes),
        Result.map((fields) =>
          A.flatMap(ParameterLocation.Options, (location) =>
            A.filter(fields, (field) => field.location === location)
          )
        )
      )
    )
  );
};

class BodyFields extends S.Class<BodyFields>($I`BodyFields`)(
  {
    fields: S.Array(PlannedField),
    body: S.OptionFromOptionalKey(Body).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BodyFields", {
    description: "Request-body fields before conflict-safe input naming.",
  })
) {
  static readonly new = (
    fields: ReadonlyArray<PlannedField>,
    body: O.Option<Body>
  ): BodyFields => BodyFields.make({ fields, body });
}

const operationBody = (
  document: Document,
  operation: Readonly<Record<string, unknown>>
): Result.Result<BodyFields, string> => {
  const resolved = resolve(
    document,
    pipe(own(operation, "requestBody"), O.getOrUndefined)
  );
  if (!isRecord(resolved)) {
    return Result.succeed(BodyFields.new(A.empty(), O.none()));
  }
  const content = pipe(
    ownRecord(resolved, "content"),
    O.getOrElse(emptyUnknownRecord)
  );
  const selected = jsonContent(content);
  if (O.isNone(selected)) {
    const declared = pipe(content, R.keys, A.join(", "));
    return Result.fail(
      `request body has no JSON content (declared: ${
        Str.isEmpty(declared) ? "none" : declared
      })`
    );
  }
  const resolvedSchema = resolve(document, selected.value.schema);
  const schema = hasDirectionalSchemas(document)
    ? directionalSchema(
        document,
        SchemaResource.new(resolvedSchema, resolvedSchema),
        "request"
      )
    : resolvedSchema;
  const required = pipe(
    ownBoolean(resolved, "required"),
    O.contains(true)
  );
  if (!isFlattenableObjectBody(schema, required)) {
    return pipe(
      projectSchema(document, selected.value.schema, "request"),
      Result.map((bodySchema) =>
        BodyFields.new(
          A.of(
            PlannedField.new(
              "body",
              "body",
              required,
              bodySchema,
              O.none(),
              O.none()
            )
          ),
          O.some(Body.new(required, "value", selected.value.mediaType))
        )
      )
    );
  }
  const requiredProperties = pipe(
    ownArray(schema, "required"),
    O.map(
      A.filter((item): item is string => P.isString(item))
    ),
    O.map(HashSet.fromIterable),
    O.getOrElse(HashSet.empty<string>)
  );
  const properties = pipe(
    ownRecord(schema, "properties"),
    O.getOrElse(emptyUnknownRecord)
  );
  return pipe(
    properties,
    R.toEntries,
    A.map(([name, value]) =>
      pipe(
        normalizeSchema(document, value),
        Result.map((fieldSchema) =>
          PlannedField.new(
            name,
            "body",
            required && HashSet.has(requiredProperties, name),
            fieldSchema,
            O.none(),
            O.none()
          )
        )
      )
    ),
    Result.all,
    Result.map((fields) =>
      BodyFields.new(
        fields,
        O.some(Body.new(required, "object", selected.value.mediaType))
      )
    )
  );
};

const nextInputName = (
  base: string,
  used: HashSet.HashSet<string>,
  index = 1
): string => {
  const candidate = index === 1 ? base : `${base}_${index}`;
  return HashSet.has(used, candidate)
    ? nextInputName(base, used, index + 1)
    : candidate;
};

/** Normalizes operation parameters and request-body fields. */
export const operationInput = (
  document: Document,
  pathItem: Readonly<Record<string, unknown>>,
  operation: Readonly<Record<string, unknown>>
): Result.Result<OperationInput, string> =>
  pipe(
    Result.all({
      parameters: operationParameters(document, pathItem, operation),
      requestBody: operationBody(document, operation),
    }),
    Result.map(({ parameters, requestBody }) => {
      const fields = A.appendAll(parameters, requestBody.fields);
      const conflicts = pipe(
        fields,
        A.groupBy((field) => field.name),
        R.toEntries,
        A.filter(([, matches]) =>
          pipe(
            matches,
            A.map((field) => field.location),
            HashSet.fromIterable,
            HashSet.size
          ) > 1
        ),
        A.map(([name]) => name),
        HashSet.fromIterable
      );
      const named = A.reduce(
        fields,
        {
          used: HashSet.empty<string>(),
          output: A.empty<InputField>(),
        },
        (state, field) => {
          const visibleName = isBlockedMember(field.name)
            ? `${field.name}_2`
            : field.name;
          const base = HashSet.has(conflicts, field.name)
            ? `${field.location}_${visibleName}`
            : visibleName;
          const inputName = nextInputName(base, state.used);
          return {
            used: HashSet.add(state.used, inputName),
            output: A.append(
              state.output,
              InputField.new(
                inputName,
                field.name,
                field.location,
                field.required,
                field.schema,
                field.style,
                field.explode
              )
            ),
          };
        }
      );
      return OperationInput.new(named.output, requestBody.body);
    })
  );

/** Emits the object JSON Schema accepted by one generated tool. */
export const inputSchema = (
  fields: ReadonlyArray<InputField>,
  definitions: Readonly<Record<string, JsonSchema>>
): JsonSchema => {
  const required = pipe(
    fields,
    A.filter((field) => field.required),
    A.map((field) => field.inputName)
  );
  const schema = JsonSchema.make({
    type: "object",
    properties: pipe(
      fields,
      A.map((field) => [field.inputName, field.schema] as const),
      Struct.fromEntries
    ),
    ...(A.isReadonlyArrayEmpty(required) ? {} : { required }),
  });
  return withDefinitions(schema, definitions);
};

const successfulResponses = (
  document: Document,
  operation: Readonly<Record<string, unknown>>
): Result.Result<ReadonlyArray<Readonly<Record<string, unknown>>>, string> => {
  const raw = own(operation, "responses");
  if (O.isNone(raw) || !isRecord(raw.value)) {
    return Result.succeed(A.empty());
  }
  const entries = R.toEntries(raw.value);
  const selected = A.appendAll(
    pipe(
      entries,
      A.filter(([status]) => S.is(SuccessStatus)(status)),
      A.sort(
        Order.mapInput(Order.String, ([status]: readonly [string, unknown]) => status)
      )
    ),
    A.filter(entries, ([status]) => Str.toUpperCase(status) === "2XX")
  );
  return pipe(
    selected,
    A.map(([, value]) => {
      const resolved = resolve(document, value);
      return !isRecord(resolved) ||
        pipe(own(resolved, "$ref"), O.flatMap(nonEmptyString), O.isSome)
        ? Result.fail(
            "successful response declaration is invalid or unresolved"
          )
        : Result.succeed(resolved);
    }),
    Result.all
  );
};

/** Produces the normalized success schema for one operation. */
export const operationOutput = (
  document: Document,
  operation: Readonly<Record<string, unknown>>,
  definitions: Readonly<Record<string, JsonSchema>>
): Result.Result<O.Option<JsonSchema>, string> => {
  if (
    pipe(
      ownBoolean(operation, "x-websocket"),
      O.contains(true)
    )
  ) {
    return Result.fail("WebSocket operations are not supported");
  }
  return pipe(
    successfulResponses(document, operation),
    Result.flatMap((responses) => {
      const streams = A.some(responses, (response) =>
        pipe(
          own(response, "content"),
          O.filter(isRecord),
          O.exists((content) =>
            pipe(
              content,
              R.keys,
              A.some(
                (mediaType) => mediaTypeBase(mediaType) === "text/event-stream"
              )
            )
          )
        )
      );
      if (streams) return Result.fail("SSE operations are not supported");
      const binary = A.some(responses, (response) =>
        pipe(
          own(response, "content"),
          O.filter(isRecord),
          O.exists((content) =>
            pipe(
              content,
              R.toEntries,
              A.some(([mediaType, value]) =>
                isBinaryMediaType(document, mediaType, value)
              )
            )
          )
        )
      );
      if (binary) return Result.fail("binary responses are not supported");

      const outcomes = pipe(
        responses,
        A.map((response) => {
          const rawContent = own(response, "content");
          if (O.isSome(rawContent) && !isRecord(rawContent.value)) {
            return Result.succeed(
              O.none<ReadonlyArray<JsonSchema>>()
            );
          }
          const content = pipe(
            rawContent,
            O.filter(isRecord),
            O.getOrElse(emptyUnknownRecord)
          );
          if (R.isEmptyReadonlyRecord(content)) {
            return Result.succeed(
              O.some(A.of(JsonSchema.make({ type: "null" })))
            );
          }
          return pipe(
            content,
            R.toEntries,
            A.map(([mediaType, value]) => {
              if (!isJsonMediaType(mediaType)) {
                return Result.succeed(JsonSchema.make({ type: "string" }));
              }
              if (!isRecord(value) || O.isNone(own(value, "schema"))) {
                return Result.fail("response schema is missing");
              }
              return projectSchema(
                document,
                O.getOrUndefined(own(value, "schema")),
                "response"
              );
            }),
            Result.all,
            Result.map(O.some)
          );
        }),
        Result.all
      );
      return pipe(
        outcomes,
        Result.map(A.getSomes),
        Result.map(A.flatten),
        Result.map((schemas) =>
          A.match(schemas, {
            onEmpty: O.none,
            onNonEmpty: ([head, ...tail]) =>
              O.some(
                withDefinitions(
                  A.isReadonlyArrayEmpty(tail)
                    ? head
                    : JsonSchema.make({ anyOf: schemas }),
                  definitions
                )
              ),
          })
        )
      );
    })
  );
};

const sanitizeOperationSegment = (raw: string): string => {
  const normalized = pipe(
    raw,
    Str.replaceAll(/[^A-Za-z0-9_$]+/gu, "_"),
    Str.replace(/^_+|_+$/gu, ""),
    Str.replace(/^([0-9])/u, "_$1")
  );
  const base = Str.isEmpty(normalized) ? "operation" : normalized;
  return isBlockedMember(base) ? `${base}_2` : base;
};

const titleWord = (word: string, index: number): string => {
  const lower = Str.toLowerCase(word);
  return index === 0
    ? lower
    : `${pipe(lower, Str.slice(0, 1), Str.toUpperCase)}${pipe(
        lower,
        Str.slice(1)
      )}`;
};

const fallbackOperationId = (method: string, path: string): string =>
  pipe(
    A.prepend(
      pipe(
        path,
        Str.split("/"),
        A.filter(Str.isNonEmpty),
        A.flatMap((part) =>
          Str.startsWith(part, "{") && Str.endsWith(part, "}")
            ? A.make("by", pipe(part, Str.slice(1, -1)))
            : A.of(part)
        ),
        A.flatMap((part) =>
          pipe(part, Str.split(/[^A-Za-z0-9]+/u), A.filter(Str.isNonEmpty))
        )
      ),
      method
    ),
    A.map(titleWord),
    A.join("")
  );

const isOperationPathAvailable = (
  segments: ReadonlyArray<string>,
  used: HashSet.HashSet<string>,
  namespaces: HashSet.HashSet<string>
): boolean => {
  const key = pipe(segments, A.join("."));
  if (HashSet.has(used, key) || HashSet.has(namespaces, key)) return false;
  return pipe(
    A.dropRight(segments, 1),
    A.every((_, index) =>
      !HashSet.has(
        used,
        pipe(segments, A.take(index + 1), A.join("."))
      )
    )
  );
};

/** Produces a collision-free dotted Toolkit path for an operation. */
export const operationPath = (
  method: string,
  path: string,
  operation: Readonly<Record<string, unknown>>,
  used: HashSet.HashSet<string>,
  namespaces: HashSet.HashSet<string>
): ReadonlyArray<string> => {
  const raw = pipe(own(operation, "operationId"), O.flatMap(nonEmptyString));
  const segments = pipe(
    raw,
    O.match({
      onNone: () => A.of(fallbackOperationId(method, path)),
      onSome: Str.split("."),
    }),
    A.map(sanitizeOperationSegment)
  );
  if (isOperationPathAvailable(segments, used, namespaces)) return segments;
  const conflict = pipe(
    A.dropRight(segments, 1),
    A.findFirstIndex((_, index) =>
      HashSet.has(
        used,
        pipe(segments, A.take(index + 1), A.join("."))
      )
    )
  );
  if (O.isSome(conflict) && conflict.value + 1 < A.length(segments)) {
    const collapsed = A.flatMap(segments, (segment, index) => {
      if (index === conflict.value) {
        const next = pipe(
          A.get(segments, index + 1),
          O.getOrElse(() => "")
        );
        return A.of(
          `${segment}${pipe(next, Str.slice(0, 1), Str.toUpperCase)}${pipe(
            next,
            Str.slice(1)
          )}`
        );
      }
      return index === conflict.value + 1 ? A.empty() : A.of(segment);
    });
    if (isOperationPathAvailable(collapsed, used, namespaces)) {
      return collapsed;
    }
  }
  const fallback = pipe(segments, A.join("_"));
  const next = (index: number): string => {
    const candidate = `${fallback}_${index}`;
    return isOperationPathAvailable(A.of(candidate), used, namespaces)
      ? candidate
      : next(index + 1);
  };
  return A.of(next(2));
};

/** Validates a host or document server URL. */
export const validateBaseUrl = (
  value: string
): Result.Result<string, string> =>
  pipe(
    S.decodeUnknownResult(S.URLFromString)(value),
    Result.mapError(
      () => `server URL '${value}' is not an absolute HTTP(S) URL`
    ),
    Result.flatMap((url) => {
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return Result.fail(
          `server URL '${value}' is not an absolute HTTP(S) URL`
        );
      }
      if (Str.isNonEmpty(url.search) || Str.isNonEmpty(url.hash)) {
        return Result.fail(
          `server URL '${value}' contains an unsupported query string or fragment`
        );
      }
      return Result.succeed(value);
    })
  );

/** Resolves the first declared server URL. */
export const specServerUrl = (
  source: Readonly<Record<string, unknown>>
): Result.Result<string, string> => {
  const server = pipe(
    ownArray(source, "servers"),
    O.getOrElse(emptyUnknownArray),
    A.findFirst(isRecord)
  );
  const url = pipe(
    server,
    O.flatMap((value) => own(value, "url")),
    O.flatMap(nonEmptyString)
  );
  if (O.isNone(url)) {
    return Result.fail("spec declares no servers; pass baseUrl");
  }
  if (pipe(url.value, Str.match(/\{[^{}]+\}/u), O.isSome)) {
    return Result.fail(
      `server URL '${url.value}' is not an absolute URL; pass baseUrl`
    );
  }
  return validateBaseUrl(url.value);
};

/** Decodes an OpenAPI security requirement array to HashMap-backed models. */
export const securityRequirements = (
  value: unknown
): Result.Result<ReadonlyArray<SecurityRequirement>, string> => {
  if (P.isUndefined(value)) return Result.succeed(A.empty());
  if (!A.isArray(value)) {
    return Result.fail("security declaration is not an array");
  }
  return pipe(
    value,
    A.map((item) => {
      if (!isRecord(item)) {
        return Result.fail("security requirement is not an object");
      }
      return pipe(
        item,
        R.toEntries,
        A.map(([name, scopes]) => {
          if (
            !A.isArray(scopes) ||
            !A.every(scopes, P.isString)
          ) {
            return Result.fail(
              "security requirement scopes are not string arrays"
            );
          }
          return Result.succeed(
            [name, scopes] as const
          );
        }),
        Result.all,
        Result.map(HashMap.fromIterable),
        Result.map(SecurityRequirement.new)
      );
    }),
    Result.all
  );
};

/** Selects supported security alternatives for one operation. */
export const operationSecurityRequirements = (
  value: unknown,
  defaults: Result.Result<ReadonlyArray<SecurityRequirement>, string>,
  schemes: HashMap.HashMap<string, SecurityScheme>
): Result.Result<ReadonlyArray<SecurityRequirement>, string> =>
  pipe(
    P.isUndefined(value) ? defaults : securityRequirements(value),
    Result.flatMap((requirements) => {
      const supported = A.filter(requirements, (requirement) =>
        pipe(
          requirement.schemes,
          HashMap.keys,
          A.fromIterable,
          A.every((name) =>
            pipe(
              HashMap.get(schemes, name),
              O.exists(
                (scheme) =>
                  !SecurityScheme.guards.apiKey(scheme) ||
                  !ApiKeyCarrier.guards.cookie(scheme.carrier)
              )
            )
          )
        )
      );
      if (
        A.isReadonlyArrayEmpty(requirements) ||
        A.isReadonlyArrayNonEmpty(supported)
      ) {
        return Result.succeed(supported);
      }
      const names = pipe(
        requirements,
        A.flatMap((requirement) =>
          pipe(requirement.schemes, HashMap.keys, A.fromIterable)
        ),
        HashSet.fromIterable,
        A.fromIterable
      );
      const cookieScheme = A.findFirst(names, (name) =>
        pipe(
          HashMap.get(schemes, name),
          O.exists(
            (scheme) =>
              SecurityScheme.guards.apiKey(scheme) &&
              ApiKeyCarrier.guards.cookie(scheme.carrier)
          )
        )
      );
      return Result.fail(
        O.isNone(cookieScheme)
          ? `security requirement references missing or malformed scheme: ${pipe(
              names,
              A.join(", ")
            )}`
          : `cookie authentication '${cookieScheme.value}' is not supported`
      );
    })
  );

/** Resolves supported component security schemes to a HashMap. */
export const securitySchemes = (
  document: Document
): HashMap.HashMap<string, SecurityScheme> => {
  const components = pipe(
    ownRecord(document, "components"),
    O.getOrElse(emptyUnknownRecord)
  );
  const declared = pipe(
    ownRecord(components, "securitySchemes"),
    O.getOrElse(emptyUnknownRecord)
  );
  return pipe(
    declared,
    R.toEntries,
    A.map(
      ([name, value]): O.Option<readonly [string, SecurityScheme]> => {
      const resolved = resolve(document, value);
      if (!isRecord(resolved)) return O.none();
      const type = pipe(own(resolved, "type"), O.flatMap(nonEmptyString));
      if (O.isNone(type)) return O.none();
      if (type.value === "apiKey") {
        const carrier = pipe(own(resolved, "in"), O.flatMap(nonEmptyString));
        const parameter = pipe(
          own(resolved, "name"),
          O.flatMap(nonEmptyString)
        );
        if (O.isNone(carrier) || O.isNone(parameter)) return O.none();
        const decodedCarrier: O.Option<ApiKeyCarrier> =
          carrier.value === "header"
            ? O.some(ApiKeyHeader.new(parameter.value))
            : carrier.value === "query"
              ? O.some(ApiKeyQuery.new(parameter.value))
              : carrier.value === "cookie"
                ? O.some(ApiKeyCookie.new(parameter.value))
                : O.none();
        return pipe(
          decodedCarrier,
          O.map((value) => [name, SecuritySchemeApiKey.new(value)] as const)
        );
      }
      if (type.value === "http") {
        return pipe(
          own(resolved, "scheme"),
          O.flatMap(nonEmptyString),
          O.map(Str.toLowerCase),
          O.map(
            (scheme) =>
              [name, SecuritySchemeHttp.new(scheme)] as const
          )
        );
      }
      if (type.value === "oauth2") {
        return O.some([name, SecuritySchemeOAuth2.new()] as const);
      }
      return type.value === "openIdConnect"
        ? O.some([name, SecuritySchemeOpenIdConnect.new()] as const)
        : O.none();
      }
    ),
    A.getSomes,
    HashMap.fromIterable
  );
};
