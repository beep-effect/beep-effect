/**
 * Schema-driven TypeScript rendering for Effect AI tools.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { JSONSchema, SchemaUtils } from "@beep/schema";
import { A, O, P, R, Str, thunkFalse, pipe } from "@beep/utils";
import { HashSet, JsonPointer, Result } from "effect";
import type { JsonSchema } from "effect/JsonSchema";
import * as S from "effect/Schema";
import * as Tool from "effect/unstable/ai/Tool";

const $I = $ScratchpadId.create("codemode/Codemode.tool-schema");

type Node = JSONSchema.Node.Type;
type SubSchema = JSONSchema.SubSchema.Type;
type Definitions = Readonly<Record<string, SubSchema>>;

const decodeNode = S.decodeUnknownResult(JSONSchema.NodeCodec);
const encodeJsonString = S.encodeUnknownResult(S.UnknownFromJsonString);

const renderLiteral = (value: unknown): string =>
  pipe(
    encodeJsonString(value),
    Result.getOrElse(() => "unknown")
  );

/** Schema for property names that are safe to emit with dot notation. */
export const IdentifierSegment = S.String.check(
  S.isPattern(/^[A-Za-z_$][A-Za-z0-9_$]*$/u)
).pipe(
  $I.annoteSchema("IdentifierSegment", {
    description: "An ECMAScript identifier segment safe to render after a dot.",
  })
);

/** Guard for {@link IdentifierSegment}. */
export const identifierSegment = S.is(IdentifierSegment);

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
    A.map((line) =>
      pipe(line, Str.replaceAll("*/", "* /"), Str.trimEnd)
    ),
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

/** Renders an Effect Schema as the TypeScript shape exposed to the guest. */
export const toTypeScript = (
  schema: S.Top,
  decoded = false,
  pretty = false
): string =>
  pipe(
    Result.try({
      try: () => S.toJsonSchemaDocument(decoded ? S.toType(schema) : schema),
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
  );

/** Renders a raw JSON Schema document after schema-first decoding. */
export const jsonSchemaToTypeScript = (
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
  );

/** One discoverable input property. */
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

/** Returns the schema-owned properties used by the built-in tool search. */
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

/** Renders one tool's input schema. */
export const inputTypeScript = (tool: Tool.Any, pretty = false): string =>
  jsonSchemaToTypeScript(Tool.getJsonSchema(tool), pretty);

/** Renders one tool's success and returned-failure schemas. */
export const outputTypeScript = (tool: Tool.Any, pretty = false): string => {
  const success = toTypeScript(tool.successSchema, true, pretty);
  if (tool.failureMode !== "return") return success;
  const failure = toTypeScript(tool.failureSchema, true, pretty);
  return failure === "never" ? success : `${success} | ${failure}`;
};
