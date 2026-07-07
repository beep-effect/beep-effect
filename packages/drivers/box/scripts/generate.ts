#!/usr/bin/env bun

import { $BoxId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { BunRuntime } from "@effect/platform-bun";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { Effect, FileSystem, flow, HashMap, Layer, Match, MutableHashSet, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import ts from "typescript";
import type { PlatformError } from "effect";

const $I = $BoxId.create("scripts/generate");

const scriptDir = import.meta.dirname;

const BYTE_OR_EVENT_PATTERN = /\b(?:ByteStream|EventStream)\b/;

/**
 * The declaration flavour extracted from a Box SDK type surface: an `interface`,
 * a `class`, or a `type` alias.
 */
const DeclarationKind = LiteralKit(["class", "interface", "type"]).pipe(
  $I.annoteSchema("DeclarationKind", {
    description: "The kind of declaration extracted from the Box SDK type surface.",
  })
);

class GeneratedField extends S.Class<GeneratedField>($I`GeneratedField`)(
  {
    name: S.String,
    optional: S.Boolean,
    schemaExpression: S.String,
  },
  $I.annote("GeneratedField", {
    description: "A single generated struct field with its schema expression.",
  })
) {}

// crispen: the optional fields stay schema-optional (`| undefined`) rather than
// `Option` because the AST walker reads them via `?? default` / `!== undefined`;
// `Option` would add wrapping noise here without enforcing any extra invariant.
class GeneratedDeclaration extends S.Class<GeneratedDeclaration>($I`GeneratedDeclaration`)(
  {
    baseName: S.optional(S.String),
    fields: GeneratedField.pipe(S.Array, S.optional),
    kind: DeclarationKind,
    name: S.String,
    schemaExpression: S.optional(S.String),
  },
  $I.annote("GeneratedDeclaration", {
    description: "A schema, model, or type declaration extracted from the Box SDK type surface.",
  })
) {}

class MethodParameter extends S.Class<MethodParameter>($I`MethodParameter`)(
  {
    name: S.String,
    optional: S.Boolean,
    schemaExpression: S.String,
    typeText: S.String,
  },
  $I.annote("MethodParameter", {
    description: "A single Box SDK method parameter with its schema expression and source type text.",
  })
) {}

class ManagerMethod extends S.Class<ManagerMethod>($I`ManagerMethod`)(
  {
    className: S.String,
    fileName: S.String,
    fullMethodName: S.String,
    managerName: S.String,
    methodName: S.String,
    parameters: S.Array(MethodParameter),
    payloadName: S.String,
    returnType: S.String,
    successName: S.String,
    successSchemaExpression: S.String,
  },
  $I.annote("ManagerMethod", {
    description: "A Box SDK manager method wrapped as a generated JSON operation.",
  })
) {}

class ManagerProperty extends S.Class<ManagerProperty>($I`ManagerProperty`)(
  {
    className: S.String,
    managerName: S.String,
  },
  $I.annote("ManagerProperty", {
    description: "A Box SDK manager exposed as a property on the generated BoxClient.",
  })
) {}

class BoxSdkPaths extends S.Class<BoxSdkPaths>($I`BoxSdkPaths`)(
  {
    clientPath: S.String,
    modelsOutputPath: S.String,
    operationsOutputPath: S.String,
    schemaDirectories: S.Array(S.String),
    sdkRoot: S.String,
  },
  $I.annote("BoxSdkPaths", {
    description: "Filesystem paths the Box SDK generator reads from and writes to.",
  })
) {}

// crispen: kept as a plain interface with effect collections — this is mutable
// traversal state (accumulated during recursion), not a decodable data model, so a
// schema would misrepresent it. See "When NOT to crispen".
interface GenerationState {
  readonly constrainedTypes: MutableHashSet.MutableHashSet<string>;
  readonly declarationNames: MutableHashSet.MutableHashSet<string>;
  readonly nonJsonDeclarationNames: MutableHashSet.MutableHashSet<string>;
}

const ascending = Order.make<string>((left, right) => Str.localeCompare(right)(left));
const declarationNameOrder = Order.mapInput(ascending, (declaration: GeneratedDeclaration) => declaration.name);
const managerPropertyOrder = Order.mapInput(ascending, (property: ManagerProperty) => property.managerName);
const managerMethodOrder = Order.mapInput(ascending, (method: ManagerMethod) => method.fullMethodName);

const hasExportModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  A.some(ts.getModifiers(node) ?? A.empty<ts.Modifier>(), (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

const upperFirst = (value: string): string =>
  Str.length(value) === 0 ? value : `${Str.toUpperCase(Str.slice(0, 1)(value))}${Str.slice(1)(value)}`;

const toIdentifier = flow(
  Str.replace(/[^A-Za-z0-9_$]+/g, " "),
  Str.split(" "),
  A.filter((part) => Str.length(part) > 0),
  A.map(upperFirst),
  A.join("")
);

// crispen: `JSON.stringify` is the exact JS string-literal escaper for codegen; the
// schema JSON codec is Effect-only and would force this whole sync render layer into
// Effect for zero correctness gain (see apps/professional-desktop scripts).
const stringLiteral = (value: string): string => JSON.stringify(value);

const literalExpression = (value: string | number | boolean): string => JSON.stringify(value);

const schemaArray = (items: ReadonlyArray<string>): string => `[${A.join(items, ", ")}]`;

// crispen: kept native — this is a character-level scanner for balanced `.pipe(` at
// the top level of a generated schema expression; `Str.*` helpers cannot express
// positional `startsWith`/index reads, and it is a trust boundary for output shape.
const finalTopLevelPipeOpenIndex = (expression: string): number | undefined => {
  let depth = 0;
  let pipeOpenIndex: number | undefined;
  let quoted: '"' | "'" | "`" | undefined;
  let escaped = false;

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];

    if (character === undefined) {
      continue;
    }

    if (quoted !== undefined) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === quoted) {
        quoted = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quoted = character;
      continue;
    }

    if (depth === 0 && expression.startsWith(".pipe(", index)) {
      pipeOpenIndex = index + ".pipe(".length;
      continue;
    }

    if (character === "(" || character === "[" || character === "{") {
      depth += 1;
      continue;
    }

    if (character === ")" || character === "]" || character === "}") {
      depth -= 1;
    }
  }

  return depth === 0 && pipeOpenIndex !== undefined && expression.endsWith(")") ? pipeOpenIndex : undefined;
};

const pipeExpression = (expression: string, operation: string): string => {
  const pipeOpenIndex = finalTopLevelPipeOpenIndex(expression);

  return pipeOpenIndex === undefined
    ? `${expression}.pipe(${operation})`
    : `${Str.slice(0, -1)(expression)}, ${operation})`;
};

const optionalExpression = (expression: string): string => pipeExpression(expression, "S.optionalKey");

const shouldSkipDeclaration = (name: string): boolean =>
  Str.endsWith("Manager")(name) ||
  Str.endsWith("ManagerInput")(name) ||
  name === "Authentication" ||
  name === "NetworkSession" ||
  name === "FetchResponse";

const fieldSchema = (field: GeneratedField): string =>
  field.optional ? optionalExpression(field.schemaExpression) : field.schemaExpression;

const renderField = (field: GeneratedField): string => `${field.name}: ${fieldSchema(field)},`;

const renderStructFields = (fields: string): string => (Str.length(fields) === 0 ? "" : `\n    ${fields}\n  `);

const isLiteralKitExpression = (expression: string): boolean => Str.startsWith("LiteralKit(")(expression);

const annotatedGeneratedSchemaExpression = (name: string, description: string, schemaExpression: string): string =>
  pipeExpression(
    schemaExpression,
    `$I.annoteSchema(${stringLiteral(name)}, {
    description: ${stringLiteral(description)}
  })`
  );

const withGeneratedCodecStatics = (expression: string): string =>
  pipeExpression(expression, "SchemaUtils.withCodecStatics");

const withGeneratedLiteralKitCodecStatics = (expression: string): string =>
  pipeExpression(expression, "withLiteralKitCodecStatics");

const renderGeneratedSchemaConst = (name: string, description: string, schemaExpression: string): string => {
  if (isLiteralKitExpression(schemaExpression)) {
    const baseName = `${name}Base`;
    return `const ${baseName} = ${schemaExpression};
export const ${name} = ${pipeExpression(
      withGeneratedLiteralKitCodecStatics(annotatedGeneratedSchemaExpression(name, description, baseName)),
      `SchemaUtils.withLiteralKitStatics(${baseName})`
    )}`;
  }

  return `export const ${name} = ${withGeneratedCodecStatics(
    annotatedGeneratedSchemaExpression(name, description, schemaExpression)
  )}`;
};

const isIdentifierName = (value: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);

const propertyName = (name: string): string => (isIdentifierName(name) ? name : stringLiteral(name));

const extractPropertyName = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
};

const typeNameText = (node: ts.EntityName): string =>
  ts.isIdentifier(node) ? node.text : `${typeNameText(node.left)}.${node.right.text}`;

const literalValue = (node: ts.LiteralTypeNode): string | number | boolean | null | undefined => {
  const literal = node.literal;
  if (ts.isStringLiteral(literal) || ts.isNumericLiteral(literal)) {
    return ts.isNumericLiteral(literal) ? Number(literal.text) : literal.text;
  }
  if (literal.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (literal.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (literal.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  return undefined;
};

const schemaForLiteral = (value: string | number | boolean | null | undefined): string => {
  if (value === null) {
    return "S.Null";
  }
  if (value === undefined) {
    return "S.Undefined";
  }
  return `S.Literal(${literalExpression(value)})`;
};

const schemaForReference = (name: string, state: GenerationState): string =>
  Match.value(name).pipe(
    Match.whenOr("string", "String", () => "S.String"),
    Match.whenOr("number", "Number", () => "S.Finite"),
    Match.whenOr("boolean", "Boolean", () => "S.Boolean"),
    Match.whenOr("unknown", "any", "object", "Object", () => {
      MutableHashSet.add(state.constrainedTypes, name);
      return "S.Unknown";
    }),
    Match.when("DateTime", () => "BoxSdkDateTime"),
    Match.when("Date", () => "BoxSdkDate"),
    Match.when("SerializedData", () => "BoxSerializedData"),
    Match.when("CancellationToken", () => "S.instanceOf(AbortSignal)"),
    Match.whenOr(
      "ByteStream",
      "Buffer",
      "FormData",
      "AgentOptions",
      "Agent",
      "Interceptor",
      "TokenStorage",
      "PrivateKeyDecryptor",
      "RequestInit",
      () => {
        MutableHashSet.add(state.constrainedTypes, name);
        return "S.Unknown";
      }
    ),
    Match.orElse(() => (MutableHashSet.has(state.declarationNames, name) ? `S.suspend(() => ${name})` : "S.Unknown"))
  );

const schemaForTypeLiteral = (node: ts.TypeLiteralNode, state: GenerationState): string => {
  let fields = A.empty<string>();
  let indexSignatures = A.empty<string>();

  for (const member of node.members) {
    if (ts.isPropertySignature(member) && member.type !== undefined) {
      const name = extractPropertyName(member.name);
      if (name === undefined || name === "rawData") {
        continue;
      }
      const schema = schemaForType(member.type, state);
      fields = A.append(
        fields,
        `${propertyName(name)}: ${member.questionToken === undefined ? schema : optionalExpression(schema)},`
      );
    }
    if (ts.isIndexSignatureDeclaration(member) && member.type !== undefined) {
      indexSignatures = A.append(indexSignatures, `S.Record(S.String, ${schemaForType(member.type, state)})`);
    }
  }

  if (A.isArrayEmpty(fields)) {
    return pipe(
      A.head(indexSignatures),
      O.getOrElse(() => "S.Record(S.String, S.Unknown)")
    );
  }

  return `S.Struct({ ${A.join(fields, " ")} })`;
};

const schemaForUnion = (node: ts.UnionTypeNode, state: GenerationState): string => {
  let literalValues = A.empty<string | number | boolean>();
  let otherSchemas = A.empty<string>();
  let hasStringKeyword = false;
  let hasNumberKeyword = false;
  let hasBooleanKeyword = false;
  let hasNull = false;
  let hasUndefined = false;

  for (const type of node.types) {
    if (type.kind === ts.SyntaxKind.StringKeyword) {
      hasStringKeyword = true;
      continue;
    }
    if (type.kind === ts.SyntaxKind.NumberKeyword) {
      hasNumberKeyword = true;
      continue;
    }
    if (type.kind === ts.SyntaxKind.BooleanKeyword) {
      hasBooleanKeyword = true;
      continue;
    }
    if (type.kind === ts.SyntaxKind.NullKeyword) {
      hasNull = true;
      continue;
    }
    if (type.kind === ts.SyntaxKind.UndefinedKeyword) {
      hasUndefined = true;
      continue;
    }
    if (ts.isLiteralTypeNode(type)) {
      const value = literalValue(type);
      if (value === null) {
        hasNull = true;
        continue;
      }
      if (value === undefined) {
        hasUndefined = true;
        continue;
      }
      literalValues = A.append(literalValues, value);
      continue;
    }
    otherSchemas = A.append(otherSchemas, schemaForType(type, state));
  }

  if (hasStringKeyword) {
    otherSchemas = A.append(otherSchemas, "S.String");
  }
  if (hasNumberKeyword) {
    otherSchemas = A.append(otherSchemas, "S.Finite");
  }
  if (hasBooleanKeyword) {
    otherSchemas = A.append(otherSchemas, "S.Boolean");
  }

  const literalSchema = A.isArrayEmpty(literalValues)
    ? O.none<string>()
    : O.some(`LiteralKit([${A.join(A.map(literalValues, literalExpression), ", ")}])`);
  const baseSchemas = O.match(literalSchema, {
    onNone: () => otherSchemas,
    onSome: (schema) => A.prepend(otherSchemas, schema),
  });
  const uniqueSchemas = A.dedupe(baseSchemas);
  const base =
    A.length(uniqueSchemas) === 0
      ? "S.Unknown"
      : A.length(uniqueSchemas) === 1
        ? pipe(
            A.head(uniqueSchemas),
            O.getOrElse(() => "S.Unknown")
          )
        : `S.Union(${schemaArray(uniqueSchemas)})`;
  const nullable = hasNull ? pipeExpression(base, "S.NullOr") : base;
  return hasUndefined ? pipeExpression(nullable, "S.UndefinedOr") : nullable;
};

const schemaForType = (node: ts.TypeNode, state: GenerationState): string => {
  if (ts.isParenthesizedTypeNode(node)) {
    return schemaForType(node.type, state);
  }
  if (ts.isArrayTypeNode(node)) {
    return pipeExpression(schemaForType(node.elementType, state), "S.Array");
  }
  if (ts.isTypeOperatorNode(node)) {
    return schemaForType(node.type, state);
  }
  if (ts.isUnionTypeNode(node)) {
    return schemaForUnion(node, state);
  }
  if (ts.isIntersectionTypeNode(node)) {
    MutableHashSet.add(state.constrainedTypes, node.getText());
    return "S.Unknown";
  }
  if (ts.isLiteralTypeNode(node)) {
    return schemaForLiteral(literalValue(node));
  }
  if (ts.isTypeLiteralNode(node)) {
    return schemaForTypeLiteral(node, state);
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = typeNameText(node.typeName);
    const typeArguments = node.typeArguments ?? A.empty<ts.TypeNode>();
    if (name === "Array" || name === "ReadonlyArray") {
      return pipeExpression(
        schemaForType(
          pipe(
            A.get(typeArguments, 0),
            O.getOrElse(() => node)
          ),
          state
        ),
        "S.Array"
      );
    }
    if (name === "Record") {
      return `S.Record(S.String, ${schemaForType(
        pipe(
          A.get(typeArguments, 1),
          O.getOrElse(() => node)
        ),
        state
      )})`;
    }
    if (name === "Promise") {
      return schemaForType(
        pipe(
          A.get(typeArguments, 0),
          O.getOrElse(() => node)
        ),
        state
      );
    }
    return schemaForReference(name, state);
  }

  return Match.value(node.kind).pipe(
    Match.when(ts.SyntaxKind.StringKeyword, () => "S.String"),
    Match.when(ts.SyntaxKind.NumberKeyword, () => "S.Finite"),
    Match.when(ts.SyntaxKind.BooleanKeyword, () => "S.Boolean"),
    Match.whenOr(ts.SyntaxKind.UnknownKeyword, ts.SyntaxKind.AnyKeyword, ts.SyntaxKind.ObjectKeyword, () => {
      MutableHashSet.add(state.constrainedTypes, node.getText());
      return "S.Unknown";
    }),
    Match.when(ts.SyntaxKind.UndefinedKeyword, () => "S.Undefined"),
    Match.when(ts.SyntaxKind.NullKeyword, () => "S.Null"),
    Match.orElse(() => {
      MutableHashSet.add(state.constrainedTypes, node.getText());
      return "S.Unknown";
    })
  );
};

const collectFields = (
  members: ts.NodeArray<ts.ClassElement | ts.TypeElement>,
  state: GenerationState
): ReadonlyArray<GeneratedField> => {
  let fields = A.empty<GeneratedField>();

  for (const member of members) {
    if ((ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) && member.type !== undefined) {
      const name = extractPropertyName(member.name);
      if (name === undefined || name === "rawData") {
        continue;
      }
      fields = A.append(fields, {
        name: propertyName(name),
        optional: member.questionToken !== undefined,
        schemaExpression: schemaForType(member.type, state),
      });
    }
    if (ts.isIndexSignatureDeclaration(member) && member.type !== undefined) {
      fields = A.append(fields, {
        name: "[key: string]",
        optional: false,
        schemaExpression: schemaForType(member.type, state),
      });
    }
  }

  return A.filter(fields, (field) => field.name !== "[key: string]");
};

const declarationName = (statement: ts.Statement): string | undefined => {
  if (
    (ts.isInterfaceDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)) &&
    statement.name !== undefined
  ) {
    return statement.name.text;
  }
  return undefined;
};

const typeReferencesNonJson = (node: ts.TypeNode, state: GenerationState): boolean => {
  if (BYTE_OR_EVENT_PATTERN.test(node.getText())) {
    return true;
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return typeReferencesNonJson(node.type, state);
  }
  if (ts.isArrayTypeNode(node)) {
    return typeReferencesNonJson(node.elementType, state);
  }
  if (ts.isTypeOperatorNode(node)) {
    return typeReferencesNonJson(node.type, state);
  }
  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    return A.some(node.types, (type) => typeReferencesNonJson(type, state));
  }
  if (ts.isTypeLiteralNode(node)) {
    return A.some(node.members, (member) => {
      if ((ts.isPropertySignature(member) || ts.isIndexSignatureDeclaration(member)) && member.type !== undefined) {
        return typeReferencesNonJson(member.type, state);
      }
      return false;
    });
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = typeNameText(node.typeName);
    return (
      MutableHashSet.has(state.nonJsonDeclarationNames, name) ||
      A.some(node.typeArguments ?? A.empty<ts.TypeNode>(), (typeArgument) => typeReferencesNonJson(typeArgument, state))
    );
  }

  return false;
};

const declarationFromStatement = (statement: ts.Statement, state: GenerationState): O.Option<GeneratedDeclaration> => {
  const name = declarationName(statement);
  if (name === undefined || !hasExportModifier(statement) || shouldSkipDeclaration(name)) {
    return O.none();
  }

  if (ts.isInterfaceDeclaration(statement)) {
    return O.some({
      fields: collectFields(statement.members, state),
      kind: "interface",
      name,
    });
  }

  if (ts.isClassDeclaration(statement)) {
    const baseName = O.getOrUndefined(
      pipe(
        A.fromIterable(statement.heritageClauses ?? A.empty<ts.HeritageClause>()),
        A.flatMap((clause) => A.fromIterable(clause.types)),
        A.map((heritage) => heritage.expression.getText(statement.getSourceFile())),
        A.findFirst((candidate) => MutableHashSet.has(state.declarationNames, candidate))
      )
    );

    return O.some({
      baseName,
      fields: collectFields(statement.members, state),
      kind: "class",
      name,
    });
  }

  if (ts.isTypeAliasDeclaration(statement)) {
    return O.some({
      kind: "type",
      name,
      schemaExpression: schemaForType(statement.type, state),
    });
  }

  return O.none();
};

const sortDeclarations = (declarations: ReadonlyArray<GeneratedDeclaration>): ReadonlyArray<GeneratedDeclaration> => {
  const declarationsByName = HashMap.fromIterable(
    A.map(declarations, (declaration) => [declaration.name, declaration] as const)
  );
  let sorted = A.empty<GeneratedDeclaration>();
  const visited = MutableHashSet.empty<string>();
  const visiting = MutableHashSet.empty<string>();

  const visit = (declaration: GeneratedDeclaration): void => {
    if (MutableHashSet.has(visited, declaration.name)) {
      return;
    }
    if (MutableHashSet.has(visiting, declaration.name)) {
      return;
    }

    MutableHashSet.add(visiting, declaration.name);
    pipe(
      O.fromNullishOr(declaration.baseName),
      O.flatMap((baseName) => HashMap.get(declarationsByName, baseName)),
      O.match({ onNone: () => {}, onSome: visit })
    );
    MutableHashSet.remove(visiting, declaration.name);
    MutableHashSet.add(visited, declaration.name);
    sorted = A.append(sorted, declaration);
  };

  for (const declaration of A.sort(declarations, declarationNameOrder)) {
    visit(declaration);
  }

  return sorted;
};

const sourceFileFor = Effect.fn("Box.generate.sourceFileFor")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(filePath);
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
});

const findFiles: (
  directory: string
) => Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "Box.generate.findFiles"
)(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(directory);
  const nested = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* (entry: string) {
      const entryPath = path.join(directory, entry);
      const info = yield* fs.stat(entryPath);
      if (info.type === "Directory") {
        return yield* findFiles(entryPath);
      }
      return Str.endsWith(".d.ts")(entryPath) ? A.of(entryPath) : A.empty<string>();
    }),
    { concurrency: "unbounded" }
  );
  return A.sort(A.flatten(nested), ascending);
});

const writeGeneratedFile = Effect.fn("Box.generate.writeGeneratedFile")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, `${Str.trimEnd(content)}\n`);
});

const resolveBoxPaths = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const repoRoot = path.resolve(scriptDir, "../../../..");
  const packageRoot = path.resolve(scriptDir, "..");
  const sdkRoot = path.resolve(repoRoot, "node_modules/box-node-sdk");
  const generatedRoot = path.resolve(packageRoot, "src/_generated");
  return {
    clientPath: path.resolve(sdkRoot, "lib/client.d.ts"),
    modelsOutputPath: path.resolve(generatedRoot, "Box.models.gen.ts"),
    operationsOutputPath: path.resolve(generatedRoot, "Box.operations.gen.ts"),
    schemaDirectories: [path.resolve(sdkRoot, "lib/schemas"), path.resolve(sdkRoot, "lib/managers")],
    sdkRoot,
  } satisfies BoxSdkPaths;
});

const collectDeclarationNames = Effect.fn("Box.generate.collectDeclarationNames")(function* (
  files: ReadonlyArray<string>
) {
  const names = MutableHashSet.empty<string>();

  for (const file of files) {
    const sourceFile = yield* sourceFileFor(file);
    for (const statement of sourceFile.statements) {
      const name = declarationName(statement);
      if (name !== undefined && hasExportModifier(statement) && !shouldSkipDeclaration(name)) {
        MutableHashSet.add(names, name);
      }
    }
  }

  return names;
});

const collectNonJsonDeclarationNames = Effect.fn("Box.generate.collectNonJsonDeclarationNames")(function* (
  files: ReadonlyArray<string>
) {
  const names = MutableHashSet.empty<string>();

  for (const file of files) {
    const sourceFile = yield* sourceFileFor(file);
    for (const statement of sourceFile.statements) {
      const name = declarationName(statement);
      if (
        name !== undefined &&
        hasExportModifier(statement) &&
        BYTE_OR_EVENT_PATTERN.test(statement.getText(sourceFile))
      ) {
        MutableHashSet.add(names, name);
      }
    }
  }

  return names;
});

const collectDeclarations = Effect.fn("Box.generate.collectDeclarations")(function* (
  files: ReadonlyArray<string>,
  state: GenerationState
) {
  let declarations = A.empty<GeneratedDeclaration>();

  for (const file of files) {
    const sourceFile = yield* sourceFileFor(file);
    declarations = A.appendAll(
      declarations,
      A.getSomes(A.map(sourceFile.statements, (statement) => declarationFromStatement(statement, state)))
    );
  }

  return sortDeclarations(declarations);
});

const collectManagerProperties = Effect.fn("Box.generate.collectManagerProperties")(function* (clientPath: string) {
  const sourceFile = yield* sourceFileFor(clientPath);
  let properties = A.empty<ManagerProperty>();

  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement) || statement.name?.text !== "BoxClient") {
      continue;
    }

    for (const member of statement.members) {
      if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name) || member.type === undefined) {
        continue;
      }
      if (!ts.isTypeReferenceNode(member.type)) {
        continue;
      }
      const className = typeNameText(member.type.typeName);
      if (Str.endsWith("Manager")(className)) {
        properties = A.append(properties, { className, managerName: member.name.text });
      }
    }
  }

  return A.sort(properties, managerPropertyOrder);
});

const unwrapPromise = (typeNode: ts.TypeNode): ts.TypeNode =>
  ts.isTypeReferenceNode(typeNode) && typeNameText(typeNode.typeName) === "Promise"
    ? pipe(
        A.get(typeNode.typeArguments ?? A.empty<ts.TypeNode>(), 0),
        O.getOrElse(() => typeNode)
      )
    : typeNode;

const methodHasDeprecatedTag = (member: ts.MethodDeclaration): boolean =>
  A.some(ts.getJSDocTags(member), (tag) => tag.tagName.text === "deprecated") ||
  Str.includes("@deprecated")(member.getFullText(member.getSourceFile()));

const collectManagerMethods = Effect.fn("Box.generate.collectManagerMethods")(function* (
  managerProperties: ReadonlyArray<ManagerProperty>,
  state: GenerationState,
  sdkRoot: string
) {
  const path = yield* Path.Path;
  let generated = A.empty<ManagerMethod>();
  let skipped = A.empty<string>();
  let deprecated = A.empty<string>();
  let wrapped = A.empty<string>();

  for (const property of managerProperties) {
    const managerFile = path.resolve(sdkRoot, "lib/managers", `${property.managerName}.d.ts`);
    const sourceFile = yield* sourceFileFor(managerFile);

    for (const statement of sourceFile.statements) {
      if (!ts.isClassDeclaration(statement) || statement.name?.text !== property.className) {
        continue;
      }

      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name) || member.type === undefined) {
          continue;
        }

        const methodName = member.name.text;
        const fullMethodName = `${property.managerName}.${methodName}`;
        const signatureText = `${member.type.getText(sourceFile)} ${A.join(
          A.map(member.parameters, (parameter) => parameter.type?.getText(sourceFile) ?? ""),
          " "
        )}`;
        const referencesNonJson =
          typeReferencesNonJson(member.type, state) ||
          A.some(
            member.parameters,
            (parameter) => parameter.type !== undefined && typeReferencesNonJson(parameter.type, state)
          );

        if (methodHasDeprecatedTag(member)) {
          deprecated = A.append(deprecated, fullMethodName);
          continue;
        }

        wrapped = A.append(wrapped, fullMethodName);

        if (BYTE_OR_EVENT_PATTERN.test(signatureText) || referencesNonJson) {
          skipped = A.append(skipped, fullMethodName);
          continue;
        }

        const parameters = A.map(member.parameters, (parameter) => ({
          name: parameter.name.getText(sourceFile),
          optional: parameter.questionToken !== undefined,
          schemaExpression: parameter.type === undefined ? "S.Unknown" : schemaForType(parameter.type, state),
          typeText: parameter.type?.getText(sourceFile) ?? "unknown",
        }));
        const operationName = `${toIdentifier(property.managerName)}${toIdentifier(methodName)}`;

        generated = A.append(generated, {
          className: property.className,
          fileName: path.basename(managerFile),
          fullMethodName,
          managerName: property.managerName,
          methodName,
          parameters,
          payloadName: `${operationName}Payload`,
          returnType: member.type.getText(sourceFile),
          successName: `${operationName}Success`,
          successSchemaExpression: schemaForType(unwrapPromise(member.type), state),
        });
      }
    }
  }

  return {
    deprecated: A.sort(deprecated, ascending),
    generated: A.sort(generated, managerMethodOrder),
    skipped: A.sort(skipped, ascending),
    wrapped: A.sort(wrapped, ascending),
  };
});

const renderDeclaration = (declaration: GeneratedDeclaration): string => {
  const description = `Generated Box SDK schema for ${declaration.name}.`;
  const schemaConst = renderGeneratedSchemaConst(
    declaration.name,
    description,
    declaration.schemaExpression ?? "S.Unknown"
  );

  if (declaration.kind === "type") {
    return `/**
 * ${description}
 *
 * @example
 * \`\`\`ts
 * import { ${declaration.name} } from "@beep/box"
 *
 * console.log(${declaration.name}.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
${schemaConst};

/**
 * Type for {@link ${declaration.name}}.
 *
 * @example
 * \`\`\`ts
 * import type { ${declaration.name} } from "@beep/box"
 *
 * type Value = ${declaration.name}
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type ${declaration.name} = typeof ${declaration.name}.Type;
`;
  }

  const fields = renderStructFields(
    pipe(declaration.fields ?? A.empty<GeneratedField>(), A.map(renderField), A.join("\n    "))
  );

  if (declaration.baseName !== undefined) {
    return `/**
 * ${description}
 *
 * @example
 * \`\`\`ts
 * import { ${declaration.name} } from "@beep/box"
 *
 * console.log(${declaration.name}.ast)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class ${declaration.name} extends ${declaration.baseName}.extend<${declaration.name}>($I\`${declaration.name}\`)(
  {${fields}},
  $I.annote(${stringLiteral(declaration.name)}, {
    description: ${stringLiteral(description)}
  })
) {}
`;
  }

  return `/**
 * ${description}
 *
 * @example
 * \`\`\`ts
 * import { ${declaration.name} } from "@beep/box"
 *
 * console.log(${declaration.name}.ast)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class ${declaration.name} extends S.Class<${declaration.name}>($I\`${declaration.name}\`)(
  {${fields}},
  $I.annote(${stringLiteral(declaration.name)}, {
    description: ${stringLiteral(description)}
  })
) {}
`;
};

const renderPayload = (method: ManagerMethod): string => {
  const fields = renderStructFields(
    pipe(
      method.parameters,
      A.map((parameter) =>
        renderField({
          name: propertyName(parameter.name),
          optional: parameter.optional,
          schemaExpression: parameter.schemaExpression,
        })
      ),
      A.join("\n    ")
    )
  );
  const description = `Payload for Box SDK method ${method.fullMethodName}.`;

  return `/**
 * ${description}
 *
 * @example
 * \`\`\`ts
 * import { ${method.payloadName} } from "@beep/box"
 *
 * console.log(${method.payloadName}.ast)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class ${method.payloadName} extends S.Class<${method.payloadName}>($I\`${method.payloadName}\`)(
  {${fields}},
  $I.annote(${stringLiteral(method.payloadName)}, {
    description: ${stringLiteral(description)}
  })
) {}
`;
};

const renderSuccess = (method: ManagerMethod): string => {
  const description = `Decoded success value for Box SDK method ${method.fullMethodName}.`;
  const schemaConst = renderGeneratedSchemaConst(method.successName, description, method.successSchemaExpression);

  return `/**
 * ${description}
 *
 * @example
 * \`\`\`ts
 * import { ${method.successName} } from "@beep/box"
 *
 * console.log(${method.successName}.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
${schemaConst};

/**
 * Type for {@link ${method.successName}}.
 *
 * @example
 * \`\`\`ts
 * import type { ${method.successName} } from "@beep/box"
 *
 * type Value = ${method.successName}
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type ${method.successName} = typeof ${method.successName}.Type;
`;
};

const renderModelsFile = (
  declarations: ReadonlyArray<GeneratedDeclaration>,
  methods: ReadonlyArray<ManagerMethod>,
  methodNames: ReadonlyArray<string>
): string => {
  const renderedMethodNames = A.join(A.map(methodNames, stringLiteral), ",\n  ");

  return `/**
 * Generated Box SDK schemas, payloads, and success models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// This file is generated by @beep/box/scripts/generate.ts. Do not edit manually.

import { $BoxId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $BoxId.create("_generated/Box.models.gen");

const withLiteralKitCodecStatics = <Sch extends S.Top & S.ConstraintDecoder<unknown>>(
  schema: Sch
): Sch & {
  readonly decodeOption: (input: unknown) => import("effect/Option").Option<Sch["Type"]>;
  readonly fromUnknown: (input: unknown) => Sch["Type"];
} =>
  SchemaUtils.withStatics((self: Sch) => ({
    decodeOption: S.decodeUnknownOption(self),
    fromUnknown: S.decodeUnknownSync(self)
  }))(schema);

/**
 * Serialized Box SDK JSON payloads.
 *
 * @example
 * \`\`\`ts
 * import { BoxSerializedData } from "@beep/box"
 *
 * console.log(BoxSerializedData.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
${renderGeneratedSchemaConst("BoxSerializedData", "Permissive schema for Box SDK SerializedData values.", "S.Unknown")};

/**
 * Type for {@link BoxSerializedData}.
 *
 * @example
 * \`\`\`ts
 * import type { BoxSerializedData } from "@beep/box"
 *
 * type Value = BoxSerializedData
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type BoxSerializedData = typeof BoxSerializedData.Type;

/**
 * Box SDK date wrapper or encoded date string.
 *
 * @example
 * \`\`\`ts
 * import { BoxSdkDate } from "@beep/box"
 *
 * console.log(BoxSdkDate.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
${renderGeneratedSchemaConst(
  "BoxSdkDate",
  "Box SDK Date wrapper or encoded date string.",
  `S.Union([
  S.String,
  S.Struct({ value: S.Date })
])`
)};

/**
 * Type for {@link BoxSdkDate}.
 *
 * @example
 * \`\`\`ts
 * import type { BoxSdkDate } from "@beep/box"
 *
 * type Value = BoxSdkDate
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type BoxSdkDate = typeof BoxSdkDate.Type;

/**
 * Box SDK date-time wrapper or encoded date-time string.
 *
 * @example
 * \`\`\`ts
 * import { BoxSdkDateTime } from "@beep/box"
 *
 * console.log(BoxSdkDateTime.ast)
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
${renderGeneratedSchemaConst(
  "BoxSdkDateTime",
  "Box SDK DateTime wrapper or encoded date-time string.",
  `S.Union([
  S.String,
  S.Struct({ value: S.Date })
])`
)};

/**
 * Type for {@link BoxSdkDateTime}.
 *
 * @example
 * \`\`\`ts
 * import type { BoxSdkDateTime } from "@beep/box"
 *
 * type Value = BoxSdkDateTime
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type BoxSdkDateTime = typeof BoxSdkDateTime.Type;

/**
 * Generated Box SDK method names wrapped by \\@beep/box.
 *
 * @example
 * \`\`\`ts
 * import { BoxMethodName } from "@beep/box"
 *
 * console.log(BoxMethodName.is["files.getFileById"]("files.getFileById"))
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
const BoxMethodNameBase = LiteralKit([
  ${renderedMethodNames}
]);
export const BoxMethodName = BoxMethodNameBase.pipe(
  $I.annoteSchema("BoxMethodName", {
    description: "Generated Box SDK method names wrapped by the Box technical driver."
  }),
  withLiteralKitCodecStatics,
  SchemaUtils.withLiteralKitStatics(BoxMethodNameBase)
);

/**
 * Type for {@link BoxMethodName}.
 *
 * @example
 * \`\`\`ts
 * import type { BoxMethodName } from "@beep/box"
 *
 * const method: BoxMethodName = "files.getFileById"
 * console.log(method)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type BoxMethodName = typeof BoxMethodName.Type;

${A.join(A.map(declarations, renderDeclaration), "\n")}
${A.join(A.map(methods, renderPayload), "\n")}
${A.join(A.map(methods, renderSuccess), "\n")}
`;
};

const renderOperationShape = (managerName: string, methods: ReadonlyArray<ManagerMethod>): string =>
  `readonly ${propertyName(managerName)}: {\n${A.join(
    A.map(
      methods,
      (method) =>
        `    readonly ${propertyName(method.methodName)}: (payload: M.${method.payloadName}) => Effect.Effect<M.${method.successName}, BoxError>;`
    ),
    "\n"
  )}\n  };`;

const argumentExpression = (parameter: MethodParameter): string => {
  if (parameter.name === "cancellationToken") {
    return `combineCancellationToken(decoded.${parameter.name}, signal)`;
  }
  if (parameter.name === "optionalsInput") {
    return `mergeCancellation(decoded.${parameter.name}, signal)`;
  }
  return `decoded.${parameter.name}`;
};

const renderOperationMethod = (method: ManagerMethod): string =>
  `${propertyName(method.methodName)}: (payload) =>
      runSdkCall(
        ${stringLiteral(method.managerName)},
        ${stringLiteral(method.methodName)},
        ${stringLiteral(method.fullMethodName)},
        M.${method.payloadName},
        M.${method.successName},
        payload,
        (decoded, signal) =>
          invokeSdkMethod(client, ${stringLiteral(method.managerName)}, ${stringLiteral(method.methodName)}, [
            ${A.join(A.map(method.parameters, argumentExpression), ",\n            ")}
          ])
      ),`;

const renderOperationManager = (managerName: string, methods: ReadonlyArray<ManagerMethod>): string =>
  `${propertyName(managerName)}: {
    ${A.join(A.map(methods, renderOperationMethod), "\n    ")}
  },`;

const renderOperationsFile = (methods: ReadonlyArray<ManagerMethod>): string => {
  const byManager = A.groupBy(methods, (method) => method.managerName);
  const sortedManagers = A.sort(R.keys(byManager), ascending);
  const methodsOf = (managerName: string): ReadonlyArray<ManagerMethod> =>
    pipe(R.get(byManager, managerName), O.getOrElse(A.empty<ManagerMethod>));

  return `/**
 * Generated Box SDK operation wrappers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// This file is generated by @beep/box/scripts/generate.ts. Do not edit manually.

import { Effect, Result } from "effect";
import * as P from "effect/Predicate";
import type * as S from "effect/Schema";
import type { BoxError } from "../Box.errors.ts";
import * as M from "./Box.models.gen.ts";

/**
 * Shared generated operation runner supplied by {@link Box}.
 *
 * @example
 * \`\`\`ts
 * import type { BoxRunSdkCall } from "@beep/box/Box.operations.gen"
 *
 * type Runner = BoxRunSdkCall
 * \`\`\`
 *
 * @category services
 * @since 0.0.0
 */
export type BoxRunSdkCall = <Payload, Success>(
  manager: string,
  method: string,
  methodName: M.BoxMethodName,
  payloadSchema: S.ConstraintDecoder<Payload>,
  successSchema: S.ConstraintDecoder<Success>,
  payload: Payload,
  invoke: (decoded: Payload, signal: AbortSignal | undefined) => Promise<unknown>
) => Effect.Effect<Success, BoxError>;

/**
 * Generated JSON operation groups for the Box SDK.
 *
 * @example
 * \`\`\`ts
 * import type { BoxGeneratedOperations } from "@beep/box/Box.operations.gen"
 *
 * type Managers = keyof BoxGeneratedOperations
 * \`\`\`
 *
 * @category services
 * @since 0.0.0
 */
export type BoxGeneratedOperations = {
  ${A.join(
    A.map(sortedManagers, (managerName) => renderOperationShape(managerName, methodsOf(managerName))),
    "\n  "
  )}
};

const readProperty = (value: unknown, key: PropertyKey): unknown => (P.isObject(value) ? Reflect.get(value, key) : undefined);

const readCancellationToken = (value: unknown): AbortSignal | undefined => {
  const token = readProperty(value, "cancellationToken");
  return token instanceof AbortSignal ? token : undefined;
};

const combineCancellationToken = (
  callerSignal: AbortSignal | undefined,
  driverSignal: AbortSignal | undefined
): AbortSignal | undefined => {
  if (callerSignal === undefined) {
    return driverSignal;
  }
  if (driverSignal === undefined || callerSignal === driverSignal) {
    return callerSignal;
  }
  return AbortSignal.any([callerSignal, driverSignal]);
};

const mergeCancellation = <A>(
  input: A | undefined,
  signal: AbortSignal | undefined
): A | { readonly cancellationToken: AbortSignal } | undefined => {
  const cancellationToken = combineCancellationToken(readCancellationToken(input), signal);
  if (cancellationToken === undefined) {
    return input;
  }
  if (P.isObject(input)) {
    return { ...input, cancellationToken };
  }
  return { cancellationToken };
};

const sdkShapeFailure = (manager: string, method: string): Promise<never> =>
  Promise.reject({
    _tag: "BoxSdkShapeError",
    manager,
    method
  });

const invokeSdkMethod = (
  client: unknown,
  manager: string,
  method: string,
  args: ReadonlyArray<unknown>
): Promise<unknown> => {
  const managerValue = readProperty(client, manager);
  const methodValue = readProperty(managerValue, method);

  if (!P.isFunction(methodValue)) {
    return sdkShapeFailure(manager, method);
  }

  const result = Result.try(() => Reflect.apply(methodValue, managerValue, args));
  return Result.match(result, {
    onFailure: (cause) => Promise.reject(cause),
    onSuccess: (value) => Promise.resolve(value)
  });
};

/**
 * Build generated Box SDK operation groups from a SDK client and shared runner.
 *
 * @example
 * \`\`\`ts
 * import { makeGeneratedOperations } from "@beep/box/Box.operations.gen"
 *
 * console.log(makeGeneratedOperations)
 * \`\`\`
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGeneratedOperations = (client: unknown, runSdkCall: BoxRunSdkCall): BoxGeneratedOperations => ({
  ${A.join(
    A.map(sortedManagers, (managerName) => renderOperationManager(managerName, methodsOf(managerName))),
    "\n  "
  )}
});
`;
};

const generate = Effect.gen(function* () {
  const paths = yield* resolveBoxPaths();
  const sourceFiles = yield* Effect.forEach(paths.schemaDirectories, findFiles, { concurrency: "unbounded" }).pipe(
    Effect.map(A.flatten)
  );
  const declarationNames = yield* collectDeclarationNames(sourceFiles);
  const nonJsonDeclarationNames = yield* collectNonJsonDeclarationNames(sourceFiles);
  const state: GenerationState = {
    constrainedTypes: MutableHashSet.empty<string>(),
    declarationNames,
    nonJsonDeclarationNames,
  };
  const declarations = yield* collectDeclarations(sourceFiles, state);
  const managerProperties = yield* collectManagerProperties(paths.clientPath);
  const methods = yield* collectManagerMethods(managerProperties, state, paths.sdkRoot);

  yield* writeGeneratedFile(paths.modelsOutputPath, renderModelsFile(declarations, methods.generated, methods.wrapped));
  yield* writeGeneratedFile(paths.operationsOutputPath, renderOperationsFile(methods.generated));

  const constrainedTypes = A.sort(A.fromIterable(state.constrainedTypes), ascending);

  yield* Effect.log(`Generated ${A.length(declarations)} Box model schemas.`);
  yield* Effect.log(`Generated ${A.length(methods.generated)} Box JSON operations.`);
  yield* Effect.log(
    `Skipped ${A.length(methods.skipped)} byte/event operations: ${A.match(methods.skipped, {
      onEmpty: () => "none",
      onNonEmpty: (values) => A.join(values, ", "),
    })}.`
  );
  yield* Effect.log(
    `Skipped ${A.length(methods.deprecated)} deprecated operations: ${A.match(methods.deprecated, {
      onEmpty: () => "none",
      onNonEmpty: (values) => A.join(values, ", "),
    })}.`
  );
  yield* Effect.log(
    `Constrained dynamic SDK types: ${A.match(constrainedTypes, {
      onEmpty: () => "none",
      onNonEmpty: (values) => A.join(values, ", "),
    })}.`
  );
}).pipe(Effect.withSpan("Box.generate"));

const MainLive = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);

// Build the platform layers into a Context once and provide it at this entry point,
// keeping scope lifetimes correct and satisfying effect(strictEffectProvide).
const program = Effect.scoped(
  Layer.build(MainLive).pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (context) {
        return yield* generate.pipe(Effect.provide(context));
      })
    )
  )
);

BunRuntime.runMain(program);
