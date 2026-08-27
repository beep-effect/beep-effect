/**
 * Schema-driven TypeScript rendering for Effect AI tools.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Unknown } from "@beep/schema/Unknown";
import { $ScratchpadId } from "@beep/identity";
import { JSONSchema, SchemaUtils } from "@beep/schema";
import { A, O, P, R, Str, thunkFalse, pipe } from "@beep/utils";
import { flow, HashSet, JsonPointer, Result } from "effect";
import { dual } from "effect/Function";
import type { JsonSchema } from "effect/JsonSchema";
import * as S from "effect/Schema";
import * as Tool from "effect/unstable/ai/Tool";

const $I = $ScratchpadId.create("codemode/Codemode.tool-schema");

type Node = JSONSchema.Node.Type;
type SubSchema = JSONSchema.SubSchema.Type;
type Definitions = Readonly<Record<string, SubSchema>>;

const decodeNode = S.decodeUnknownResult(JSONSchema.NodeCodec);
const encodeJsonString = Unknown.encodeUnknownResultFromJsonString;

const renderLiteral = (value: unknown): string =>
  pipe(
    encodeJsonString(value),
    Result.getOrElse(() => "unknown")
  );

/**
 * Schema for property names that are safe to emit with dot notation.
 *
 * **Example** (Accept foo, reject foo-bar)
 *
 * ```ts
 * import { IdentifierSegment } from "../../../codemode/Codemode.tool-schema.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IdentifierSegment)("foo")) // true
 * console.log(S.is(IdentifierSegment)("foo-bar")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdentifierSegment = S.String.check(
  S.isPattern(/^[A-Za-z_$][A-Za-z0-9_$]*$/u)
).pipe(
  SchemaUtils.withCodecStatics,
  $I.annoteSchema("IdentifierSegment", {
    description: "An ECMAScript identifier segment safe to render after a dot.",
  })
);

/**
 * Decoded identifier segment produced by {@link IdentifierSegment}.
 *
 * @see {@link IdentifierSegment} for the runtime schema and membership guard.
 * @category type-level
 * @since 0.0.0
 */
export type IdentifierSegment = typeof IdentifierSegment.Type;

/**
 * Guard for property names that are safe to emit with dot notation.
 *
 * **Example** (Admit foo, reject foo-bar)
 *
 * ```ts
 * import { identifierSegment } from "../../../codemode/Codemode.tool-schema.ts"
 *
 * console.log(identifierSegment("foo")) // true
 * console.log(identifierSegment("foo-bar")) // false
 * ```
 *
 * @see {@link IdentifierSegment} for the runtime schema this guard wraps.
 * @category guards
 * @since 0.0.0
 */
export const identifierSegment = IdentifierSegment.is;

const renderKey = (name: string): string =>
  identifierSegment(name) ? name : renderLiteral(name);

const hasType = (node: Node, expected: JSONSchema.TypeName): boolean =>
  pipe(
    node.type,
    O.exists((value) =>
      P.isString(value)
        ? value === expected
        : A.some(value, (candidate) => candidate === expected)
    )
  );

const effectNumberSentinel = (schema: SubSchema): boolean =>
  !P.isBoolean(schema) &&
  hasType(schema, "string") &&
  pipe(
    schema.enum,
    O.exists(
      (values) =>
        A.length(values) === 1 &&
        A.some(values, (value) =>
          value === "NaN" || value === "Infinity" || value === "-Infinity"
        )
    )
  );

const intersection = (members: ReadonlyArray<string>): string => {
  const concrete = A.filter(members, (member) => member !== "unknown");
  return A.match(concrete, {
    onEmpty: () => "unknown",
    onNonEmpty: ([head, ...tail]) =>
      A.isReadonlyArrayEmpty(tail)
        ? head
        : pipe(
            concrete,
            A.map((member) =>
              pipe(member, Str.includes(" | ")) ? `(${member})` : member
            ),
            A.join(" & ")
          ),
  });
};

const MAX_RENDER_DEPTH = 8;
const localRefPrefixes = A.make("#/$defs/", "#/definitions/");

type RenderContext = {
  readonly definitions: Definitions;
  readonly pretty: boolean;
};

const definitionName = (ref: string): O.Option<string> =>
  pipe(
    localRefPrefixes,
    A.findFirst((prefix) => Str.startsWith(ref, prefix)),
    O.map((prefix) => pipe(ref, Str.slice(Str.length(prefix)))),
    O.filter((segment) =>
      Str.isNonEmpty(segment) && !pipe(segment, Str.includes("/"))
    ),
    O.map(JsonPointer.unescapeToken)
  );

const nestedContext = (node: Node, context: RenderContext): RenderContext =>
  pipe(
    node.$defs,
    O.match({
      onNone: () => context,
      onSome: (definitions) => ({
        ...context,
        definitions: R.union(
          context.definitions,
          definitions,
          (_left, right) => right
        ),
      }),
    })
  );

const schemaChildren = (node: Node): ReadonlyArray<SubSchema> =>
  pipe(
    A.make(
      pipe(node.anyOf, O.map(A.fromIterable)),
      pipe(node.oneOf, O.map(A.fromIterable)),
      pipe(node.allOf, O.map(A.fromIterable)),
      pipe(node.properties, O.map(R.values)),
      pipe(node.items, O.map(A.of)),
      pipe(node.additionalProperties, O.map(A.of))
    ),
    A.getSomes,
    A.flatten
  );

const hasUnresolvedRef = (
  schema: SubSchema,
  definitions: Definitions,
  seen: HashSet.HashSet<string> = HashSet.empty(),
  visited: HashSet.HashSet<Node> = HashSet.empty()
): boolean => {
  if (P.isBoolean(schema) || HashSet.has(visited, schema)) return false;
  const nextVisited = HashSet.add(visited, schema);
  const unresolvedSelf = pipe(
    schema.$ref,
    O.exists((ref) =>
      pipe(
        definitionName(ref),
        O.flatMap((name) =>
          HashSet.has(seen, name)
            ? O.none()
            : pipe(
                R.get(definitions, name),
                O.filter(
                  (target) =>
                    !hasUnresolvedRef(
                      target,
                      definitions,
                      HashSet.add(seen, name),
                      nextVisited
                    )
                )
              )
        ),
        O.isNone
      )
    )
  );
  return (
    unresolvedSelf ||
    A.some(schemaChildren(schema), (child) =>
      hasUnresolvedRef(child, definitions, seen, nextVisited)
    )
  );
};

const isEmptyNode = (node: Node): boolean =>
  pipe(
    S.encodeUnknownResult(JSONSchema.NodeCodec)(node),
    Result.match({
      onFailure: thunkFalse,
      onSuccess: R.isEmptyReadonlyRecord,
    })
  );

const docTags = (schema: Node): ReadonlyArray<string> =>
  pipe(
    A.make(
      pipe(
        schema.deprecated,
        O.filter((deprecated) => deprecated),
        O.as("@deprecated")
      ),
      pipe(
        schema.default,
        O.map((value) => `@default ${renderLiteral(value)}`)
      ),
      pipe(schema.format, O.map((format) => `@format ${format}`)),
      pipe(schema.minItems, O.map((value) => `@minItems ${value}`)),
      pipe(schema.maxItems, O.map((value) => `@maxItems ${value}`))
    ),
    A.getSomes
  );

const isBlank = (line: string): boolean => Str.isEmpty(Str.trim(line));

// Neutralize `*\/` so schema-provided text cannot terminate generated docs.
const jsdoc = (
  description: O.Option<string>,
  tags: ReadonlyArray<string>,
  pad: string
): string => {
  const lines = pipe(
    description,
    O.map(Str.split("\n")),
    O.getOrElse(A.empty),
    A.appendAll(tags),
    A.map(flow(Str.replaceAll("*/", "* /"), Str.trimEnd)),
    A.dropWhile(isBlank),
    A.reverse,
    A.dropWhile(isBlank),
    A.reverse
  );
  return A.match(lines, {
    onEmpty: () => "",
    onNonEmpty: ([head, ...tail]) =>
      A.isReadonlyArrayEmpty(tail)
        ? `${pad}/** ${head} */\n`
        : `${pad}/**\n${pipe(
            lines,
            A.map((line) => `${pad} *${Str.isEmpty(line) ? "" : ` ${line}`}`),
            A.join("\n")
          )}\n${pad} */\n`,
  });
};

const renderSchema = (
  schema: SubSchema,
  context: RenderContext,
  depth = 0,
  seen: HashSet.HashSet<string> = HashSet.empty()
): string => {
  if (P.isBoolean(schema)) return schema ? "unknown" : "never";
  if (depth > MAX_RENDER_DEPTH) return "unknown";

  const nested = nestedContext(schema, context);
  if (O.isSome(schema.$ref)) {
    const name = definitionName(schema.$ref.value);
    const target = pipe(
      name,
      O.filter((candidate) => !HashSet.has(seen, candidate)),
      O.flatMap((candidate) => R.get(nested.definitions, candidate))
    );
    if (O.isNone(name) || O.isNone(target)) return "unknown";
    return intersection(
      A.make(
        renderSchema(
          target.value,
          nested,
          depth,
          HashSet.add(seen, name.value)
        ),
        renderSchema(
          { ...schema, $ref: O.none() },
          nested,
          depth + 1,
          seen
        )
      )
    );
  }

  if (O.isSome(schema.const)) return renderLiteral(schema.const.value);
  if (O.isSome(schema.enum)) {
    return pipe(schema.enum.value, A.map(renderLiteral), A.join(" | "));
  }

  const alternatives = pipe(
    schema.anyOf,
    O.orElse(() => schema.oneOf)
  );
  if (O.isSome(alternatives)) {
    const members = alternatives.value;
    if (
      A.some(members, (item) => !P.isBoolean(item) && hasType(item, "number")) &&
      A.every(
        members,
        (item) =>
          (!P.isBoolean(item) && hasType(item, "number")) ||
          effectNumberSentinel(item)
      )
    ) {
      return "number";
    }
    if (
      A.length(members) === 2 &&
      !P.isBoolean(members[0]) &&
      hasType(members[0], "object") &&
      O.isNone(members[0].properties) &&
      !P.isBoolean(members[1]) &&
      hasType(members[1], "array") &&
      O.isNone(members[1].items)
    ) {
      return "{}";
    }
    const rendered = A.map(members, (item) =>
      renderSchema(item, nested, depth + 1, seen)
    );
    if (A.some(rendered, (member) => member === "unknown")) return "unknown";
    return intersection(
      A.make(
        pipe(rendered, A.join(" | ")),
        renderSchema(
          { ...schema, anyOf: O.none(), oneOf: O.none() },
          nested,
          depth + 1,
          seen
        )
      )
    );
  }

  if (O.isSome(schema.allOf)) {
    const members = A.map(schema.allOf.value, (item) =>
      renderSchema(item, nested, depth + 1, seen)
    );
    if (
      A.some(schema.allOf.value, (item) =>
        hasUnresolvedRef(item, nested.definitions)
      )
    ) {
      return "unknown";
    }
    return intersection([
      renderSchema(
        { ...schema, allOf: O.none() },
        nested,
        depth + 1,
        seen
      ),
      ...members,
    ]);
  }

  if (
    pipe(
      schema.not,
      O.exists((negated) =>
        P.isBoolean(negated) ? negated : isEmptyNode(negated)
      )
    )
  ) {
    return "never";
  }

  if (
    O.isSome(schema.type) &&
    !P.isString(schema.type.value)
  ) {
    return pipe(
      schema.type.value,
      A.map((type) =>
        renderSchema(
          { ...schema, type: O.some(type) },
          nested,
          depth + 1,
          seen
        )
      ),
      A.join(" | ")
    );
  }

  const type = pipe(
    schema.type,
    O.filter(P.isString),
    O.getOrUndefined
  );
  if (
    type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean" ||
    type === "null"
  ) {
    return JSONSchema.TypeName.$match(type, {
      array: () => "unknown",
      boolean: () => "boolean",
      integer: () => "number",
      null: () => "null",
      number: () => "number",
      object: () => "unknown",
      string: () => "string",
    });
  }

  if (type === "array") {
    return `Array<${renderSchema(
      pipe(schema.items, O.getOrElse((): SubSchema => true)),
      nested,
      depth + 1,
      seen
    )}>`;
  }

  if (type === "object" || O.isSome(schema.properties)) {
    const required = pipe(
      schema.required,
      O.map(HashSet.fromIterable),
      O.getOrElse(HashSet.empty<string>)
    );
    const properties = pipe(
      schema.properties,
      O.map(R.toEntries),
      O.getOrElse(A.empty)
    );
    const indexType = pipe(
      schema.additionalProperties,
      O.filter((additional) => additional !== false),
      O.map((additional) =>
        renderSchema(additional, nested, depth + 1, seen)
      )
    );
    const field = ([name, value]: readonly [string, SubSchema]): string =>
      `${renderKey(name)}${HashSet.has(required, name) ? "" : "?"}: ${renderSchema(
        value,
        nested,
        depth + 1,
        seen
      )}`;

    if (!context.pretty) {
      const fields = pipe(properties, A.map(field));
      const members = pipe(
        indexType,
        O.match({
          onNone: () => fields,
          onSome: (value) => A.append(fields, `[key: string]: ${value}`),
        })
      );
      return A.isReadonlyArrayEmpty(members)
        ? "{}"
        : `{ ${pipe(members, A.join("; "))} }`;
    }

    if (A.isReadonlyArrayEmpty(properties) && O.isNone(indexType)) return "{}";
    const pad = pipe("  ", Str.repeat(depth + 1));
    const lines = A.map(
      properties,
      (entry) =>
        `${jsdoc(
          P.isBoolean(entry[1]) ? O.none() : entry[1].description,
          P.isBoolean(entry[1]) ? A.empty() : docTags(entry[1]),
          pad
        )}${pad}${field(entry)},`
    );
    const rendered = pipe(
      indexType,
      O.match({
        onNone: () => lines,
        onSome: (value) =>
          A.append(lines, `${pad}[key: string]: ${value},`),
      })
    );
    return `{\n${pipe(rendered, A.join("\n"))}\n${pipe(
      "  ",
      Str.repeat(depth)
    )}}`;
  }

  return "unknown";
};

/**
 * Renders an Effect Schema as the TypeScript shape exposed to the guest.
 *
 * **Gotchas**
 *
 * JSON Schema conversion or decode failure becomes the string `"unknown"`.
 * `decoded=true` uses `S.toType(schema)` (decoded-side JSON Schema); the
 * default encoded-side path uses the schema as-is. Descriptions that contain
 * `*\/` sequences are rewritten so generated comments cannot terminate a block.
 *
 * **Example** (Render a string schema)
 *
 * ```ts
 * import { toTypeScript } from "../../../codemode/Codemode.tool-schema.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(toTypeScript(S.String)) // "string"
 * ```
 *
 * @param decoded - When true, render the decoded-side JSON Schema via `S.toType`.
 * @see {@link jsonSchemaToTypeScript} for rendering an already-built JSON Schema document.
 * @see {@link inputTypeScript} for the tool-input renderer that uses this pipeline.
 * @see {@link outputTypeScript} for the tool-output renderer that uses this pipeline.
 * @category formatting
 * @since 0.0.0
 */
export const toTypeScript: {
  (decoded?: boolean, pretty?: boolean): (schema: S.Top) => string;
  (schema: S.Top, decoded?: boolean, pretty?: boolean): string;
} = dual((args) => S.isSchema(args[0]), (
  schema: S.Top,
  decoded = false,
  pretty = false
): string =>
  pipe(
    Result.try({
      try: () => S.toJsonSchemaDocument(decoded === true ? S.toType(schema) : schema),
      catch: (cause) => cause,
    }),
    Result.flatMap(S.decodeUnknownResult(JSONSchema.Document)),
    Result.match({
      onFailure: () => "unknown",
      onSuccess: (document) =>
        renderSchema(document.schema, {
          definitions: document.definitions,
          pretty,
        }),
    })
  ));

/**
 * Renders a raw JSON Schema document after schema-first decoding.
 *
 * **Gotchas**
 *
 * JSON Schema decode failure becomes the string `"unknown"` rather than a
 * typed error.
 *
 * **Example** (Render a number JSON Schema)
 *
 * ```ts
 * import { jsonSchemaToTypeScript } from "@beep/scratchpad/codemode"
 *
 * console.log(jsonSchemaToTypeScript({ type: "number" })) // "number"
 * ```
 *
 * @see {@link toTypeScript} for the Effect Schema entry point that builds JSON Schema first.
 * @see {@link inputTypeScript} for the tool-input renderer that delegates here.
 * @category formatting
 * @since 0.0.0
 */
export const jsonSchemaToTypeScript: {
  (pretty?: boolean): (schema: JsonSchema) => string;
  (schema: JsonSchema, pretty?: boolean): string;
} = dual((args) => P.isObject(args[0]), (
  schema: JsonSchema,
  pretty = false
): string =>
  pipe(
    decodeNode(schema),
    Result.match({
      onFailure: () => "unknown",
      onSuccess: (node) =>
        renderSchema(node, {
          definitions: pipe(node.$defs, O.getOrElse(R.emptyReadonly)),
          pretty,
        }),
    })
  ));

/**
 * One discoverable input property decoded from a tool input JSON Schema.
 *
 * **Example** (Construct a required name property)
 *
 * ```ts
 * import { InputProperty } from "../../../codemode/Codemode.tool-schema.ts"
 * import * as O from "effect/Option"
 *
 * const property = InputProperty.new("name", O.some("Guest name"), true)
 *
 * console.log(property.name) // "name"
 * console.log(property.required) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InputProperty extends S.Class<InputProperty>($I`InputProperty`)(
  {
    name: S.String,
    description: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault
    ),
    required: S.Boolean,
  },
  $I.annote("InputProperty", {
    description: "One property decoded from a tool input JSON Schema.",
  })
) {
  static readonly new = (
    name: string,
    description: O.Option<string>,
    required: boolean
  ): InputProperty => InputProperty.make({ name, description, required });
}
type ToolInputDocument = {
  readonly schema: Node;
  readonly definitions: Definitions;
};

const toolInputDocument = (
  tool: Tool.Any
): Result.Result<ToolInputDocument, unknown> =>
  pipe(
    Result.try({
      try: () => Tool.getJsonSchema(tool),
      catch: (cause) => cause,
    }),
    Result.flatMap(decodeNode),
    Result.map((schema) => ({
      schema,
      definitions: pipe(schema.$defs, O.getOrElse(R.emptyReadonly)),
    }))
  );

/**
 * Returns the schema-owned properties used by the built-in tool search.
 *
 * **Example** (List input property names)
 *
 * ```ts
 * import { inputProperties } from "../../../codemode/Codemode.tool-schema.ts"
 * import { Tool } from "@beep/scratchpad/codemode"
 * import * as S from "effect/Schema"
 *
 * const Ping = Tool.make("Ping", {
 *   parameters: S.Struct({ name: S.String }),
 *   success: S.String,
 * })
 *
 * console.log(inputProperties(Ping).map((property) => property.name)) // ["name"]
 * ```
 *
 * @see {@link InputProperty} for the property model this function returns.
 * @see {@link inputTypeScript} for the TypeScript rendering of the same input schema.
 * @category getters
 * @since 0.0.0
 */
export const inputProperties = (tool: Tool.Any): ReadonlyArray<InputProperty> =>
  pipe(
    toolInputDocument(tool),
    Result.map(({ definitions, schema: root }) => {
      const schema = pipe(
        root.$ref,
        O.flatMap(definitionName),
        O.flatMap((name) => R.get(definitions, name)),
        O.filter(JSONSchema.Node.is),
        O.getOrElse(() => root)
      );
      const required = pipe(
        schema.required,
        O.map(HashSet.fromIterable),
        O.getOrElse(HashSet.empty<string>)
      );
      return pipe(
        schema.properties,
        O.map(R.toEntries),
        O.getOrElse(A.empty),
        A.map(([name, value]) =>
          InputProperty.new(
            name,
            P.isBoolean(value) ? O.none() : value.description,
            HashSet.has(required, name)
          )
        )
      );
    }),
    Result.getOrElse(A.empty)
  );

/**
 * Renders one tool's input schema as TypeScript.
 *
 * **Example** (Render a struct input)
 *
 * ```ts
 * import { inputTypeScript, Tool } from "@beep/scratchpad/codemode"
 * import * as S from "effect/Schema"
 *
 * const Ping = Tool.make("Ping", {
 *   parameters: S.Struct({ name: S.String }),
 *   success: S.String,
 * })
 *
 * console.log(inputTypeScript(Ping).includes("name")) // true
 * ```
 *
 * @see {@link jsonSchemaToTypeScript} for the JSON Schema renderer this function delegates to.
 * @see {@link outputTypeScript} for the corresponding output renderer.
 * @category formatting
 * @since 0.0.0
 */
export const inputTypeScript: {
  (pretty?: boolean): (tool: Tool.Any) => string;
  (tool: Tool.Any, pretty?: boolean): string;
} = dual((args) => P.isObject(args[0]), (tool: Tool.Any, pretty = false): string =>
  jsonSchemaToTypeScript(Tool.getJsonSchema(tool), pretty));

/**
 * Renders one tool's success and returned-failure schemas as TypeScript.
 *
 * **Gotchas**
 *
 * Success and failure schemas are unioned only when `tool.failureMode === "return"`.
 * Tools with `failureMode: "error"` emit the success type only, even when a
 * failure schema exists. Conversion failure becomes the string `"unknown"`.
 *
 * **Example** (Union output when failures are returned)
 *
 * ```ts
 * import { outputTypeScript, Tool } from "@beep/scratchpad/codemode"
 * import * as S from "effect/Schema"
 *
 * const Ping = Tool.make("Ping", {
 *   parameters: S.Struct({}),
 *   success: S.Number,
 *   failure: S.String,
 *   failureMode: "return",
 * })
 *
 * console.log(outputTypeScript(Ping)) // "number | string"
 * ```
 *
 * @see {@link toTypeScript} for the schema renderer used for success and failure.
 * @see {@link inputTypeScript} for the corresponding input renderer.
 * @category formatting
 * @since 0.0.0
 */
export const outputTypeScript: {
  (pretty?: boolean): (tool: Tool.Any) => string;
  (tool: Tool.Any, pretty?: boolean): string;
} = dual((args) => P.isObject(args[0]), (tool: Tool.Any, pretty = false): string => {
  const success = toTypeScript(tool.successSchema, true, pretty);
  if (tool.failureMode !== "return") return success;
  const failure = toTypeScript(tool.failureSchema, true, pretty);
  return failure === "never" ? success : `${success} | ${failure}`;
});
