#!/usr/bin/env node

import { $AcpId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { make as makeJsonSchemaGenerator } from "@effect/openapi-generator/JsonSchemaGenerator";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer, Logger, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import * as ts from "typescript";

const CURRENT_SCHEMA_RELEASE = "v0.11.3";
const GENERATED_SCHEMA_ID = '$AcpId.create("_generated/schema.gen")';
const GENERATED_META_ID = '$AcpId.create("_generated/meta.gen")';
const $I = $AcpId.create("scripts/generate");
const schemaNameOrder = Order.make<string>((left, right) => Str.localeCompare(right)(left));

class GenerateCommandError extends TaggedErrorClass<GenerateCommandError>($I`GenerateCommandError`)(
  "GenerateCommandError",
  {
    message: S.String,
  },
  $I.annote("GenerateCommandError", {
    description: "An error occurred while generating the ACP schema.",
  })
) {}

class AnnotationExtraEntry extends S.Class<AnnotationExtraEntry>($I`AnnotationExtraEntry`)(
  {
    key: S.String,
    value: S.String,
  },
  $I.annote("AnnotationExtraEntry", {
    description: "An extra entry for annotations in the generated schema.",
  })
) {}

class GeneratedSchemaExpression extends S.Class<GeneratedSchemaExpression>($I`GeneratedSchemaExpression`)(
  {
    annotationExtras: S.Array(AnnotationExtraEntry),
    expression: S.String,
  },
  $I.annote("GeneratedSchemaExpression", {
    description: "A generated schema expression with optional annotations.",
  })
) {}

class GeneratedPaths extends S.Class<GeneratedPaths>($I`GeneratedPaths`)(
  {
    generatedDir: S.String,
    metaOutputPath: S.String,
    schemaOutputPath: S.String,
    upstreamMetaPath: S.String,
    upstreamSchemaPath: S.String,
  },
  $I.annote("GeneratedPaths", {
    description: "Paths related to the generated ACP schema.",
  })
) {}

class SchemaEntry extends S.Class<SchemaEntry>($I`SchemaEntry`)(
  {
    code: S.String,
    name: S.String,
  },
  $I.annote("SchemaEntry", {
    description: "A schema entry representing a generated schema with a code and name.",
  })
) {}
class TextReplacement extends S.Class<TextReplacement>($I`TextReplacement`)(
  {
    end: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    start: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    text: S.String,
  },
  $I.annote("TextReplacement", {
    description: "A text replacement operation with start, end, and replacement text.",
  })
) {}

class AcpGeneratorOutputError extends TaggedErrorClass<AcpGeneratorOutputError>($I`AcpGeneratorOutputError`)(
  "AcpGeneratorOutputError",
  {
    message: S.String,
  },
  $I.annote("AcpGeneratorOutputError", {
    description: "Generator output from the upstream JSON-schema converter was not in the expected shape.",
  })
) {}

class MetaJson extends S.Class<MetaJson>($I`MetaJson`)(
  {
    agentMethods: S.Record(S.String, S.String),
    clientMethods: S.Record(S.String, S.String),
    version: S.Union([S.Finite, S.String]),
  },
  $I.annote("MetaJson", {
    description: "ACP upstream metadata JSON downloaded by the generator.",
  })
) {
  static readonly decodeJsonEffect = S.decodeEffect(S.fromJsonString(MetaJson));
  static readonly encodeAgentMethods = S.encodeEffect(S.fromJsonString(MetaJson.fields.agentMethods));
  static readonly encodeClientMethods = S.encodeEffect(S.fromJsonString(MetaJson.fields.clientMethods));
  static readonly encodeVersion = S.encodeEffect(S.fromJsonString(MetaJson.fields.version));
}

class UpstreamJsonSchema extends S.Class<UpstreamJsonSchema>($I`UpstreamJsonSchema`)(
  {
    $defs: S.Record(S.String, S.Json),
  },
  $I.annote("UpstreamJsonSchema", {
    description: "ACP upstream JSON Schema document downloaded by the generator.",
  })
) {
  static readonly decodeJsonEffect = S.decodeEffect(S.fromJsonString(UpstreamJsonSchema));
}

const getGeneratedPaths = Effect.fn("getGeneratedPaths")(function* () {
  const path = yield* Path.Path;
  const generatedDir = path.join(import.meta.dirname, "..", "src", "_generated");
  return {
    generatedDir,
    upstreamSchemaPath: path.join(generatedDir, "upstream-schema.json"),
    upstreamMetaPath: path.join(generatedDir, "upstream-meta.json"),
    schemaOutputPath: path.join(generatedDir, "schema.gen.ts"),
    metaOutputPath: path.join(generatedDir, "meta.gen.ts"),
  } satisfies GeneratedPaths;
});

const ensureGeneratedDir = Effect.fn("ensureGeneratedDir")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const { generatedDir } = yield* getGeneratedPaths();

  yield* fs.makeDirectory(generatedDir, { recursive: true });
});

const downloadFile = Effect.fn("downloadFile")(function* (url: string, outputPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.makeDirectory(path.dirname(outputPath), { recursive: true });

  const text = yield* HttpClient.get(url).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.text)
  );

  yield* fs.writeFileString(outputPath, text);
});

const downloadSchemas = Effect.fn("downloadSchemas")(function* (tag: string) {
  const { upstreamMetaPath, upstreamSchemaPath } = yield* getGeneratedPaths();
  const fs = yield* FileSystem.FileSystem;
  const baseUrl = `https://github.com/agentclientprotocol/agent-client-protocol/releases/download/${tag}`;

  yield* downloadFile(`${baseUrl}/schema.unstable.json`, upstreamSchemaPath);
  yield* downloadFile(`${baseUrl}/meta.unstable.json`, upstreamMetaPath);

  yield* Effect.addFinalizer(() =>
    Effect.all([fs.remove(upstreamSchemaPath), fs.remove(upstreamMetaPath)]).pipe(Effect.ignoreCause({ log: true }))
  );
});

const readFileString = Effect.fn("readFileString")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(filePath);
});

const writeGeneratedFiles = Effect.fn("writeGeneratedFiles")(function* (schemaOutput: string, metaOutput: string) {
  const fs = yield* FileSystem.FileSystem;
  const { metaOutputPath, schemaOutputPath } = yield* getGeneratedPaths();

  yield* fs.writeFileString(schemaOutputPath, schemaOutput);
  yield* fs.writeFileString(metaOutputPath, metaOutput);
});

const GENERATED_SCHEMA_EXPRESSION_PREFIX = "const __schema = ";
const GENERATED_SCHEMA_EXPRESSION_SUFFIX = ";";
const PROPERTY_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const textReplacementOrder: Order.Order<TextReplacement> = Order.flip(
  Order.mapInput(Order.Number, (replacement) => replacement.start)
);

function parseGeneratedSchemaExpression(schemaExpression: string): {
  readonly initializer: ts.Expression;
  readonly source: string;
  readonly sourceFile: ts.SourceFile;
} {
  const source = `${GENERATED_SCHEMA_EXPRESSION_PREFIX}${schemaExpression}${GENERATED_SCHEMA_EXPRESSION_SUFFIX}`;
  const sourceFile = ts.createSourceFile(
    "schema-expression.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statement = sourceFile.statements[0];
  if (statement === undefined || !ts.isVariableStatement(statement)) {
    throw AcpGeneratorOutputError.make({ message: `Could not parse generated schema expression: ${schemaExpression}` });
  }

  const declaration = statement.declarationList.declarations[0];
  if (declaration === undefined || declaration.initializer === undefined) {
    throw AcpGeneratorOutputError.make({ message: `Missing generated schema initializer: ${schemaExpression}` });
  }

  return { initializer: declaration.initializer, source, sourceFile };
}

function isSchemaNamespaceExpression(node: ts.Expression): boolean {
  return ts.isIdentifier(node) && (node.text === "S" || node.text === "Schema");
}

function isSchemaCall(call: ts.CallExpression, name: string): boolean {
  const expression = call.expression;
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === name &&
    isSchemaNamespaceExpression(expression.expression)
  );
}

function isFirstArgumentOfSchemaCall(node: ts.Node, name: string): boolean {
  const parent = node.parent;
  return ts.isCallExpression(parent) && parent.arguments[0] === node && isSchemaCall(parent, name);
}

function isAnnotateCall(node: ts.Node): node is ts.CallExpression & {
  readonly expression: ts.PropertyAccessExpression;
} {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "annotate"
  );
}

function isOnExpressionSpine(node: ts.Node, root: ts.Expression): boolean {
  let current = node;
  while (current !== root) {
    const parent = current.parent;
    if (parent === undefined) {
      return false;
    }
    if (ts.isPropertyAccessExpression(parent) && parent.expression === current) {
      current = parent;
      continue;
    }
    if (ts.isCallExpression(parent) && parent.expression === current) {
      current = parent;
      continue;
    }
    if (ts.isParenthesizedExpression(parent) && parent.expression === current) {
      current = parent;
      continue;
    }
    return false;
  }
  return true;
}

function isOnSchemaSlot(node: ts.Node, slot: ts.Expression): boolean {
  if (isOnExpressionSpine(node, slot)) {
    return true;
  }
  if (ts.isCallExpression(slot) && isSchemaCall(slot, "optionalKey")) {
    const optionalSchema = slot.arguments[0];
    return optionalSchema !== undefined && isOnSchemaSlot(node, optionalSchema);
  }
  return false;
}

function isStructPropertyAnnotation(node: ts.CallExpression): boolean {
  let current: ts.Node | undefined = node;
  while (current !== undefined) {
    if (
      ts.isPropertyAssignment(current) &&
      ts.isObjectLiteralExpression(current.parent) &&
      isFirstArgumentOfSchemaCall(current.parent, "Struct")
    ) {
      return isOnSchemaSlot(node, current.initializer);
    }
    current = current.parent;
  }
  return false;
}

function isUnionMemberAnnotation(node: ts.CallExpression): boolean {
  let current: ts.Node | undefined = node;
  while (current !== undefined) {
    const parent: ts.Node | undefined = current.parent;
    if (parent !== undefined && ts.isArrayLiteralExpression(parent) && isFirstArgumentOfSchemaCall(parent, "Union")) {
      for (const element of parent.elements) {
        if (element === current && isOnSchemaSlot(node, element)) {
          return true;
        }
      }
    }
    if (parent !== undefined && ts.isCallExpression(parent) && isSchemaCall(parent, "Union")) {
      for (const argument of parent.arguments) {
        if (argument === current && isOnSchemaSlot(node, argument)) {
          return true;
        }
      }
    }
    current = parent;
  }
  return false;
}

function applyTextReplacements(source: string, replacements: ReadonlyArray<TextReplacement>): string {
  return pipe(
    replacements,
    A.sort(textReplacementOrder),
    A.reduce(
      source,
      (current, replacement) =>
        `${Str.slice(0, replacement.start)(current)}${replacement.text}${Str.slice(replacement.end)(current)}`
    )
  );
}

function stripGeneratedSchemaExpressionWrapper(source: string): string {
  return pipe(
    source,
    Str.slice(Str.length(GENERATED_SCHEMA_EXPRESSION_PREFIX)),
    Str.slice(0, -Str.length(GENERATED_SCHEMA_EXPRESSION_SUFFIX))
  );
}

function rewriteKeyAnnotations(schemaExpression: string): string {
  const { source, sourceFile } = parseGeneratedSchemaExpression(schemaExpression);
  let replacements = A.empty<TextReplacement>();

  function visit(node: ts.Node): void {
    if (isAnnotateCall(node) && (isStructPropertyAnnotation(node) || isUnionMemberAnnotation(node))) {
      replacements = A.append(replacements, {
        start: node.expression.name.getStart(sourceFile),
        end: node.expression.name.getEnd(),
        text: "annotateKey",
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return stripGeneratedSchemaExpressionWrapper(applyTextReplacements(source, replacements));
}

function propertyNameToString(name: ts.PropertyName): O.Option<string> {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return O.some(name.text);
  }
  return O.none();
}

function renderObjectPropertyKey(key: string): string {
  if (PROPERTY_IDENTIFIER_PATTERN.test(key)) {
    return key;
  }

  return pipe(key, Str.replaceAll("\\", "\\\\"), Str.replaceAll('"', '\\"'), (escaped) => `"${escaped}"`);
}

function collectAnnotationExtraEntries(
  annotationArgument: ts.Expression,
  sourceFile: ts.SourceFile
): ReadonlyArray<AnnotationExtraEntry> {
  if (!ts.isObjectLiteralExpression(annotationArgument)) {
    return A.empty<AnnotationExtraEntry>();
  }

  let entries = A.empty<AnnotationExtraEntry>();
  for (const property of annotationArgument.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const key = propertyNameToString(property.name);
    if (O.isNone(key) || key.value === "title") {
      continue;
    }

    entries = A.append(entries, {
      key: key.value === "description" ? "documentation" : key.value,
      value: property.initializer.getText(sourceFile),
    });
  }

  return entries;
}

function dedupeAnnotationExtraEntries(
  entries: ReadonlyArray<AnnotationExtraEntry>
): ReadonlyArray<AnnotationExtraEntry> {
  let deduped = A.empty<AnnotationExtraEntry>();
  for (const entry of entries) {
    if (!A.some(deduped, (existing) => existing.key === entry.key)) {
      deduped = A.append(deduped, entry);
    }
  }
  return deduped;
}

function extractTopLevelAnnotation(schemaExpression: string): GeneratedSchemaExpression {
  const { initializer, source, sourceFile } = parseGeneratedSchemaExpression(schemaExpression);
  let replacements = A.empty<TextReplacement>();
  let annotationExtras = A.empty<AnnotationExtraEntry>();

  function visit(node: ts.Node): void {
    if (isAnnotateCall(node) && isOnExpressionSpine(node, initializer)) {
      const annotationArgument = node.arguments[0];
      if (annotationArgument !== undefined) {
        annotationExtras = A.appendAll(annotationExtras, collectAnnotationExtraEntries(annotationArgument, sourceFile));
      }
      replacements = A.append(replacements, {
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        text: node.expression.expression.getText(sourceFile),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(initializer);

  return {
    expression: stripGeneratedSchemaExpressionWrapper(applyTextReplacements(source, replacements)),
    annotationExtras: dedupeAnnotationExtraEntries(annotationExtras),
  };
}

function prepareGeneratedSchemaExpression(schemaExpression: string): GeneratedSchemaExpression {
  return extractTopLevelAnnotation(rewriteKeyAnnotations(schemaExpression));
}

function renderSchemaAnnotation(name: string, annotationExtras: ReadonlyArray<AnnotationExtraEntry>): string {
  const entries = dedupeAnnotationExtraEntries([
    {
      key: "description",
      value: `"Generated ACP schema for ${name}."`,
    },
    ...annotationExtras,
  ]);

  return pipe(
    [
      `  $I.annoteSchema("${name}", {`,
      ...A.map(entries, (entry) => `    ${renderObjectPropertyKey(entry.key)}: ${entry.value},`),
      "  })",
    ],
    A.join("\n")
  );
}

function collectSchemaEntries(chunk: string): ReadonlyArray<SchemaEntry> {
  const lines = pipe(
    chunk,
    Str.split("\n"),
    A.map(Str.trim),
    A.filter((line) => Str.length(line) > 0 && !Str.startsWith("//")(line))
  );
  let entries = A.empty<SchemaEntry>();

  for (let index = 0; index < lines.length; index += 1) {
    const typeLine = lines[index];
    if (!P.isString(typeLine) || !Str.startsWith("export type ")(typeLine)) {
      continue;
    }

    const constLine = lines[index + 1];
    if (!P.isString(constLine) || !Str.startsWith("export const ")(constLine)) {
      throw AcpGeneratorOutputError.make({ message: `Malformed generator output near: ${typeLine}` });
    }

    const match = /^export type ([A-Za-z0-9_]+)/.exec(typeLine);
    const schemaName = match?.[1];
    if (schemaName === undefined) {
      throw AcpGeneratorOutputError.make({ message: `Could not extract schema name from: ${typeLine}` });
    }

    entries = A.append(entries, {
      name: schemaName,
      code: renderSchemaEntry(schemaName, constLine),
    });
    index += 1;
  }

  return entries;
}

function renderSchemaEntry(name: string, constLine: string): string {
  const schemaExpression = prepareGeneratedSchemaExpression(
    pipe(
      constLine,
      Str.replace(new RegExp(`^export const ${name} = `), ""),
      Str.replace(/;$/, ""),
      Str.replaceAll("Schema.", "S.")
    )
  );
  return pipe(
    [
      "/**",
      ` * Generated ACP schema for \`${name}\`.`,
      " *",
      " * @example",
      " * ```ts",
      ` * import { ${name} } from "@beep/acp/schema"`,
      " *",
      ` * console.log(${name}.ast)`,
      " * ```",
      " *",
      " * @category schemas",
      " * @since 0.0.0",
      " */",
      `export const ${name} = ${schemaExpression.expression}.pipe(`,
      `${renderSchemaAnnotation(name, schemaExpression.annotationExtras)},`,
      "  SchemaUtils.withCodecStatics",
      ");",
      "",
      "/**",
      ` * Type for {@link ${name}}.`,
      " *",
      " * @example",
      " * ```ts",
      ` * import type { ${name} } from "@beep/acp/schema"`,
      " *",
      ` * type ${name}Value = ${name}`,
      " * ```",
      " *",
      " * @category models",
      " * @since 0.0.0",
      " */",
      `export type ${name} = typeof ${name}.Type;`,
    ],
    A.join("\n")
  );
}

function renderMetaConst(name: string, value: string, description: string): string {
  return pipe(
    [
      "/**",
      ` * ${description}`,
      " *",
      " * @example",
      " * ```ts",
      ` * import { ${name} } from "@beep/acp/schema"`,
      " *",
      ` * console.log(${name})`,
      " * ```",
      " *",
      " * @category constants",
      " * @since 0.0.0",
      " */",
      `export const ${name} = ${value} as const;`,
    ],
    A.join("\n")
  );
}

type Json = S.Json;

function normalizeNullableTypes(value: Json): Json {
  if (A.isArray(value)) {
    return A.map(value as ReadonlyArray<Json>, normalizeNullableTypes);
  }
  if (value === null || !P.isObject(value)) {
    return value;
  }

  const normalizedObject = R.map(value as Record<string, Json>, normalizeNullableTypes);
  const typeValue = normalizedObject.type;

  if (!A.isArray(typeValue)) {
    return normalizedObject;
  }

  const normalizedTypes = A.filter(typeValue, P.isString);
  if (A.length(normalizedTypes) !== A.length(typeValue) || !A.contains(normalizedTypes, "null")) {
    return normalizedObject;
  }

  const nonNullTypes = A.filter(normalizedTypes, (entry) => entry !== "null");
  if (A.length(nonNullTypes) !== 1) {
    return normalizedObject;
  }
  const nonNullType = nonNullTypes[0]!;

  const nextObject = R.remove(normalizedObject, "type");

  return {
    anyOf: [
      {
        ...nextObject,
        type: nonNullType,
      },
      { type: "null" },
    ],
  };
}

const generateSchemas = Effect.fn("generateSchemas")(function* (skipDownload: boolean) {
  const { upstreamMetaPath, upstreamSchemaPath } = yield* getGeneratedPaths();

  yield* ensureGeneratedDir();

  if (!skipDownload) {
    yield* Effect.log(`Downloading ACP schema assets for ${CURRENT_SCHEMA_RELEASE}`);
    yield* downloadSchemas(CURRENT_SCHEMA_RELEASE);
  }

  const upstreamSchema = yield* readFileString(upstreamSchemaPath).pipe(
    Effect.flatMap(UpstreamJsonSchema.decodeJsonEffect)
  );
  const upstreamMeta = yield* readFileString(upstreamMetaPath).pipe(Effect.flatMap(MetaJson.decodeJsonEffect));
  const normalizedDefinitions = R.map(upstreamSchema.$defs, normalizeNullableTypes);

  const sortedEntries = pipe(
    R.toEntries(normalizedDefinitions),
    A.sort(Order.mapInput(schemaNameOrder, (entry: readonly [string, Json]) => entry[0]))
  );
  let generatedEntries = A.empty<SchemaEntry>();
  const generator = makeJsonSchemaGenerator();

  for (const [name, schema] of sortedEntries) {
    generator.addSchema(name, schema as never);
  }

  const output = Str.trim(generator.generate("openapi-3.1", normalizedDefinitions as never, false));
  if (output.length > 0) {
    for (const entry of collectSchemaEntries(output)) {
      if (!A.some(generatedEntries, (existing) => existing.name === entry.name)) {
        generatedEntries = A.append(generatedEntries, entry);
      }
    }
  }

  const prelude = [
    "/**",
    " * Generated ACP protocol schema and metadata modules.",
    " *",
    " * @packageDocumentation",
    " * @since 0.0.0",
    " */",
    "",
    `// This file is generated by the @beep/acp package. Do not edit manually.`,
    `// Current ACP schema release: ${CURRENT_SCHEMA_RELEASE}`,
    "",
  ];

  const schemaOutput = pipe(
    [
      ...prelude,
      'import { $AcpId } from "@beep/identity";',
      'import { SchemaUtils } from "@beep/schema";',
      'import * as S from "effect/Schema";',
      "",
      `const $I = ${GENERATED_SCHEMA_ID};`,
      "",
      pipe(
        generatedEntries,
        A.map((entry) => entry.code),
        A.join("\n\n")
      ),
      "",
    ],
    A.join("\n")
  );

  const metaOutput = pipe(
    [
      ...prelude,
      'import { $AcpId } from "@beep/identity";',
      "",
      `const $I = ${GENERATED_META_ID};`,
      "void $I;",
      "",
      renderMetaConst(
        "AGENT_METHODS",
        yield* MetaJson.encodeAgentMethods(upstreamMeta.agentMethods),
        "Generated ACP agent method lookup table."
      ),
      "",
      renderMetaConst(
        "CLIENT_METHODS",
        yield* MetaJson.encodeClientMethods(upstreamMeta.clientMethods),
        "Generated ACP client method lookup table."
      ),
      "",
      renderMetaConst(
        "PROTOCOL_VERSION",
        yield* MetaJson.encodeVersion(upstreamMeta.version),
        "Generated ACP protocol version."
      ),
      "",
    ],
    A.join("\n")
  );

  yield* writeGeneratedFiles(schemaOutput, metaOutput);
  yield* Effect.log(`Generated ${A.length(generatedEntries)} ACP schemas from ${CURRENT_SCHEMA_RELEASE}`);

  const { generatedDir } = yield* getGeneratedPaths();
  yield* Effect.service(ChildProcessSpawner.ChildProcessSpawner).pipe(
    Effect.flatMap((spawner) => spawner.spawn(ChildProcess.make("bunx", ["--bun", "oxfmt", generatedDir]))),
    Effect.flatMap((child) => child.exitCode),
    Effect.tap((code) =>
      code === 0
        ? Effect.void
        : GenerateCommandError.make({
            message: `oxfmt failed with exit code ${code}`,
          })
    )
  );
});

const generateCommand = Command.make(
  "generate",
  {
    skipDownload: Flag.boolean("skip-download").pipe(Flag.withDefault(false)),
  },
  ({ skipDownload }) => generateSchemas(skipDownload)
).pipe(Command.withDescription("Generate Effect ACP schemas from the pinned ACP release assets."));

const runtimeLayer = Layer.mergeAll(Logger.layer([Logger.consolePretty()]), NodeServices.layer, FetchHttpClient.layer);

const program = Effect.scoped(
  Layer.build(runtimeLayer).pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (context) {
        return yield* Command.run(generateCommand, { version: "0.0.0" }).pipe(Effect.provide(context));
      })
    )
  )
);

NodeRuntime.runMain(program);
