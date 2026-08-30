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
import { ts } from "ts-morph";
import { GENERATED_MANAGERS } from "./box.surface.ts";
import type { PlatformError } from "effect";

const $I = $BoxId.create("scripts/generate");

const scriptDir = import.meta.dirname;

const BYTE_OR_EVENT_PATTERN = /\b(?:ByteStream|EventStream)\b/;

// Model cross-references in generated schema expressions are always emitted as
// `S.suspend(() => Name)` by `schemaForReference`, so this is the whole edge set
// of the declaration graph the reachability prune walks.
const SUSPEND_REFERENCE_PATTERN = /S\.suspend\(\(\) => ([A-Za-z_$][A-Za-z0-9_$]*)\)/g;

const GENERATED_MODELS_MODULE = "Box.models.gen";

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
    baseName: S.optionalKey(S.String),
    fields: GeneratedField.pipe(S.Array, S.optionalKey),
    kind: DeclarationKind,
    name: S.String,
    schemaExpression: S.optionalKey(S.String),
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

class GeneratedMethodDisposition extends S.TaggedClass<GeneratedMethodDisposition>($I`GeneratedMethodDisposition`)(
  "generated",
  { method: ManagerMethod },
  $I.annote("GeneratedMethodDisposition", { description: "A Box SDK method accepted for JSON code generation." })
) {}

class NamedMethodDisposition extends S.TaggedClass<NamedMethodDisposition>($I`NamedMethodDisposition`)(
  "deprecated",
  { name: S.String },
  $I.annote("NamedMethodDisposition", { description: "A deprecated Box SDK method excluded from generation." })
) {}

class SkippedMethodDisposition extends S.TaggedClass<SkippedMethodDisposition>($I`SkippedMethodDisposition`)(
  "skipped",
  { name: S.String },
  $I.annote("SkippedMethodDisposition", { description: "A non-JSON Box SDK method excluded from generation." })
) {}

type MethodDisposition = GeneratedMethodDisposition | NamedMethodDisposition | SkippedMethodDisposition;

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
    handWrittenSourceRoot: S.String,
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

interface PipeScanState {
  readonly depth: number;
  readonly escaped: boolean;
  readonly index: number;
  readonly pipeOpenIndex: number | undefined;
  readonly quoted: '"' | "'" | "`" | undefined;
}

const scanQuotedCharacter = (state: PipeScanState, character: string): PipeScanState =>
  Match.value(character).pipe(
    Match.when(
      () => state.escaped,
      () => ({ ...state, escaped: false, index: state.index + 1 })
    ),
    Match.when("\\", () => ({ ...state, escaped: true, index: state.index + 1 })),
    Match.when(state.quoted ?? "", () => ({ ...state, index: state.index + 1, quoted: undefined })),
    Match.orElse(() => ({ ...state, index: state.index + 1 }))
  );

const scanUnquotedCharacter = (expression: string, state: PipeScanState, character: string): PipeScanState =>
  Match.value(character).pipe(
    Match.whenOr('"', "'", "`", (quoted) => ({ ...state, index: state.index + 1, quoted })),
    Match.when(
      () => state.depth === 0 && expression.startsWith(".pipe(", state.index),
      () => ({ ...state, index: state.index + 1, pipeOpenIndex: state.index + ".pipe(".length })
    ),
    Match.whenOr("(", "[", "{", () => ({ ...state, depth: state.depth + 1, index: state.index + 1 })),
    Match.whenOr(")", "]", "}", () => ({ ...state, depth: state.depth - 1, index: state.index + 1 })),
    Match.orElse(() => ({ ...state, index: state.index + 1 }))
  );

const finalTopLevelPipeOpenIndex = (expression: string): number | undefined => {
  const initialState: PipeScanState = {
    depth: 0,
    escaped: false,
    index: 0,
    pipeOpenIndex: undefined,
    quoted: undefined,
  };
  const finalState = A.reduce(A.fromIterable(expression), initialState, (state, character) =>
    state.quoted === undefined
      ? scanUnquotedCharacter(expression, state, character)
      : scanQuotedCharacter(state, character)
  );
  return finalState.depth === 0 && Str.endsWith(")")(expression) ? finalState.pipeOpenIndex : undefined;
};

const pipeExpression = (expression: string, operation: string): string => {
  const pipeOpenIndex = finalTopLevelPipeOpenIndex(expression);

  return pipeOpenIndex === undefined
    ? `${expression}.pipe(${operation})`
    : `${Str.slice(0, -1)(expression)}, ${operation})`;
};

const optionalExpression = (expression: string): string => pipeExpression(expression, "S.optionalKey");

const SKIPPED_DECLARATION_NAMES = MutableHashSet.fromIterable(["Authentication", "NetworkSession", "FetchResponse"]);

const shouldSkipDeclaration = (name: string): boolean =>
  Str.endsWith("Manager")(name) ||
  Str.endsWith("ManagerInput")(name) ||
  MutableHashSet.has(SKIPPED_DECLARATION_NAMES, name);

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

const renderGeneratedSchemaConst = (name: string, description: string, schemaExpression: string): string => {
  if (isLiteralKitExpression(schemaExpression)) {
    return `export const ${name} = ${schemaExpression}.pipe(
  (schema) =>
    schema.pipe(
      $I.annoteSchema(${stringLiteral(name)}, {
        description: ${stringLiteral(description)}
      }),
      withLiteralKitCodecStatics,
      SchemaUtils.withLiteralKitStatics(schema)
    )
)`;
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

const literalValue = (node: ts.LiteralTypeNode): string | number | boolean | null | undefined =>
  Match.value(node.literal).pipe(
    Match.when(ts.isStringLiteral, (literal) => literal.text),
    Match.when(ts.isNumericLiteral, (literal) => Number(literal.text)),
    Match.when({ kind: ts.SyntaxKind.TrueKeyword }, () => true),
    Match.when({ kind: ts.SyntaxKind.FalseKeyword }, () => false),
    Match.when({ kind: ts.SyntaxKind.NullKeyword }, () => null),
    Match.orElse(() => undefined)
  );

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

const typeLiteralProperty = (member: ts.PropertySignature, state: GenerationState): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(member.type),
    O.flatMap((memberType) =>
      pipe(
        extractPropertyName(member.name),
        O.fromUndefinedOr,
        O.filter((name) => name !== "rawData"),
        O.map((name) => {
          const schema = schemaForType(memberType, state);
          return `${propertyName(name)}: ${member.questionToken === undefined ? schema : optionalExpression(schema)},`;
        })
      )
    )
  );

const typeLiteralIndex = (member: ts.IndexSignatureDeclaration, state: GenerationState): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(member.type),
    O.map((memberType) => `S.Record(S.String, ${schemaForType(memberType, state)})`)
  );

const schemaForTypeLiteral = (node: ts.TypeLiteralNode, state: GenerationState): string => {
  const fields = A.getSomes(
    A.map(node.members, (member) =>
      ts.isPropertySignature(member) ? typeLiteralProperty(member, state) : O.none<string>()
    )
  );
  const indexSignatures = A.getSomes(
    A.map(node.members, (member) =>
      ts.isIndexSignatureDeclaration(member) ? typeLiteralIndex(member, state) : O.none<string>()
    )
  );
  return A.match(fields, {
    onEmpty: () =>
      pipe(
        A.head(indexSignatures),
        O.getOrElse(() => "S.Record(S.String, S.Unknown)")
      ),
    onNonEmpty: (values) => `S.Struct({ ${A.join(values, " ")} })`,
  });
};

interface UnionParts {
  readonly hasNull: boolean;
  readonly hasUndefined: boolean;
  readonly literalValues: ReadonlyArray<string | number | boolean>;
  readonly schemas: ReadonlyArray<string>;
}

const appendUnionLiteral = (parts: UnionParts, value: string | number | boolean | null | undefined): UnionParts =>
  Match.value(value).pipe(
    Match.when(null, () => ({ ...parts, hasNull: true })),
    Match.when(undefined, () => ({ ...parts, hasUndefined: true })),
    Match.orElse((literal) => ({ ...parts, literalValues: A.append(parts.literalValues, literal) }))
  );

const collectUnionPart = (state: GenerationState, parts: UnionParts, type: ts.TypeNode): UnionParts =>
  Match.value(type).pipe(
    Match.when({ kind: ts.SyntaxKind.StringKeyword }, () => ({
      ...parts,
      schemas: A.append(parts.schemas, "S.String"),
    })),
    Match.when({ kind: ts.SyntaxKind.NumberKeyword }, () => ({
      ...parts,
      schemas: A.append(parts.schemas, "S.Finite"),
    })),
    Match.when({ kind: ts.SyntaxKind.BooleanKeyword }, () => ({
      ...parts,
      schemas: A.append(parts.schemas, "S.Boolean"),
    })),
    Match.when({ kind: ts.SyntaxKind.NullKeyword }, () => ({ ...parts, hasNull: true })),
    Match.when({ kind: ts.SyntaxKind.UndefinedKeyword }, () => ({ ...parts, hasUndefined: true })),
    Match.when(ts.isLiteralTypeNode, (literal) => appendUnionLiteral(parts, literalValue(literal))),
    Match.orElse((other) => ({ ...parts, schemas: A.append(parts.schemas, schemaForType(other, state)) }))
  );

const unionBaseSchema = (parts: UnionParts): string => {
  const literalSchema = A.match(parts.literalValues, {
    onEmpty: O.none<string>,
    onNonEmpty: (values) => O.some(`LiteralKit([${A.join(A.map(values, literalExpression), ", ")}])`),
  });
  const schemas = A.dedupe(
    pipe(
      literalSchema,
      O.map((schema) => A.prepend(parts.schemas, schema)),
      O.getOrElse(() => parts.schemas)
    )
  );
  return A.match(schemas, {
    onEmpty: () => "S.Unknown",
    onNonEmpty: (values) => (A.length(values) === 1 ? values[0] : `S.Union(${schemaArray(values)})`),
  });
};

const schemaForUnion = (node: ts.UnionTypeNode, state: GenerationState): string => {
  const initialParts: UnionParts = {
    hasNull: false,
    hasUndefined: false,
    literalValues: A.empty<string | number | boolean>(),
    schemas: A.empty<string>(),
  };
  const parts = A.reduce(node.types, initialParts, (acc, type) => collectUnionPart(state, acc, type));
  const base = unionBaseSchema(parts);
  const nullable = parts.hasNull ? pipeExpression(base, "S.NullOr") : base;
  return parts.hasUndefined ? pipeExpression(nullable, "S.UndefinedOr") : nullable;
};

const typeArgumentOrSelf = (node: ts.TypeReferenceNode, index: number): ts.TypeNode =>
  pipe(
    A.get(node.typeArguments ?? A.empty<ts.TypeNode>(), index),
    O.getOrElse(() => node)
  );

const schemaForTypeReference = (node: ts.TypeReferenceNode, state: GenerationState): string =>
  Match.value(typeNameText(node.typeName)).pipe(
    Match.whenOr("Array", "ReadonlyArray", () =>
      pipeExpression(schemaForType(typeArgumentOrSelf(node, 0), state), "S.Array")
    ),
    Match.when("Record", () => `S.Record(S.String, ${schemaForType(typeArgumentOrSelf(node, 1), state)})`),
    Match.when("Promise", () => schemaForType(typeArgumentOrSelf(node, 0), state)),
    Match.orElse((name) => schemaForReference(name, state))
  );

const constrainedTypeSchema = (node: ts.TypeNode, state: GenerationState): string => {
  MutableHashSet.add(state.constrainedTypes, node.getText());
  return "S.Unknown";
};

const schemaForSyntaxKind = (node: ts.TypeNode, state: GenerationState): string =>
  Match.value(node.kind).pipe(
    Match.when(ts.SyntaxKind.StringKeyword, () => "S.String"),
    Match.when(ts.SyntaxKind.NumberKeyword, () => "S.Finite"),
    Match.when(ts.SyntaxKind.BooleanKeyword, () => "S.Boolean"),
    Match.whenOr(ts.SyntaxKind.UnknownKeyword, ts.SyntaxKind.AnyKeyword, ts.SyntaxKind.ObjectKeyword, () =>
      constrainedTypeSchema(node, state)
    ),
    Match.when(ts.SyntaxKind.UndefinedKeyword, () => "S.Undefined"),
    Match.when(ts.SyntaxKind.NullKeyword, () => "S.Null"),
    Match.orElse(() => constrainedTypeSchema(node, state))
  );

const schemaForType = (node: ts.TypeNode, state: GenerationState): string =>
  Match.value(node).pipe(
    Match.when(ts.isParenthesizedTypeNode, (parenthesized) => schemaForType(parenthesized.type, state)),
    Match.when(ts.isArrayTypeNode, (array) => pipeExpression(schemaForType(array.elementType, state), "S.Array")),
    Match.when(ts.isTypeOperatorNode, (operator) => schemaForType(operator.type, state)),
    Match.when(ts.isUnionTypeNode, (union) => schemaForUnion(union, state)),
    Match.when(ts.isIntersectionTypeNode, (intersection) => constrainedTypeSchema(intersection, state)),
    Match.when(ts.isLiteralTypeNode, (literal) => schemaForLiteral(literalValue(literal))),
    Match.when(ts.isTypeLiteralNode, (literal) => schemaForTypeLiteral(literal, state)),
    Match.when(ts.isTypeReferenceNode, (reference) => schemaForTypeReference(reference, state)),
    Match.orElse((other) => schemaForSyntaxKind(other, state))
  );

const propertyField = (
  member: ts.PropertyDeclaration | ts.PropertySignature,
  state: GenerationState
): O.Option<GeneratedField> =>
  pipe(
    O.fromUndefinedOr(member.type),
    O.flatMap((memberType) =>
      pipe(
        extractPropertyName(member.name),
        O.fromUndefinedOr,
        O.filter((name) => name !== "rawData"),
        O.map((name) => ({
          name: propertyName(name),
          optional: member.questionToken !== undefined,
          schemaExpression: schemaForType(memberType, state),
        }))
      )
    )
  );

const indexField = (member: ts.IndexSignatureDeclaration, state: GenerationState): O.Option<GeneratedField> =>
  pipe(
    O.fromUndefinedOr(member.type),
    O.map((memberType) => ({
      name: "[key: string]",
      optional: false,
      schemaExpression: schemaForType(memberType, state),
    }))
  );

const fieldFromMember = (member: ts.ClassElement | ts.TypeElement, state: GenerationState): O.Option<GeneratedField> =>
  Match.value(member).pipe(
    Match.whenOr(ts.isPropertyDeclaration, ts.isPropertySignature, (property) => propertyField(property, state)),
    Match.when(ts.isIndexSignatureDeclaration, (index) => indexField(index, state)),
    Match.orElse(O.none<GeneratedField>)
  );

const collectFields = (
  members: ts.NodeArray<ts.ClassElement | ts.TypeElement>,
  state: GenerationState
): ReadonlyArray<GeneratedField> =>
  pipe(
    members,
    A.map((member) => fieldFromMember(member, state)),
    A.getSomes,
    A.filter((field) => field.name !== "[key: string]")
  );

const declarationName = (statement: ts.Statement): string | undefined =>
  Match.value(statement).pipe(
    Match.when(ts.isInterfaceDeclaration, (declaration) => declaration.name.text),
    Match.when(ts.isClassDeclaration, (declaration) => declaration.name?.text),
    Match.when(ts.isTypeAliasDeclaration, (declaration) => declaration.name.text),
    Match.orElse(() => undefined)
  );

const memberReferencesNonJson = (member: ts.TypeElement, state: GenerationState): boolean => {
  const memberType: ts.TypeNode | undefined = Match.value(member).pipe(
    Match.when(ts.isPropertySignature, (property) => property.type),
    Match.when(ts.isIndexSignatureDeclaration, (index) => index.type),
    Match.orElse(() => undefined)
  );
  return pipe(
    O.fromUndefinedOr(memberType),
    O.exists((type) => typeReferencesNonJson(type, state))
  );
};

const referenceTypeReferencesNonJson = (node: ts.TypeReferenceNode, state: GenerationState): boolean =>
  MutableHashSet.has(state.nonJsonDeclarationNames, typeNameText(node.typeName)) ||
  A.some(node.typeArguments ?? A.empty<ts.TypeNode>(), (argument) => typeReferencesNonJson(argument, state));

const typeReferencesNonJson = (node: ts.TypeNode, state: GenerationState): boolean =>
  BYTE_OR_EVENT_PATTERN.test(node.getText()) ||
  Match.value(node).pipe(
    Match.when(ts.isParenthesizedTypeNode, (parenthesized) => typeReferencesNonJson(parenthesized.type, state)),
    Match.when(ts.isArrayTypeNode, (array) => typeReferencesNonJson(array.elementType, state)),
    Match.when(ts.isTypeOperatorNode, (operator) => typeReferencesNonJson(operator.type, state)),
    Match.when(ts.isUnionTypeNode, (union) => A.some(union.types, (type) => typeReferencesNonJson(type, state))),
    Match.when(ts.isIntersectionTypeNode, (intersection) =>
      A.some(intersection.types, (type) => typeReferencesNonJson(type, state))
    ),
    Match.when(ts.isTypeLiteralNode, (literal) =>
      A.some(literal.members, (member) => memberReferencesNonJson(member, state))
    ),
    Match.when(ts.isTypeReferenceNode, (reference) => referenceTypeReferencesNonJson(reference, state)),
    Match.orElse(() => false)
  );

const classBaseName = (statement: ts.ClassDeclaration, state: GenerationState): string | undefined =>
  pipe(
    A.fromIterable(statement.heritageClauses ?? A.empty<ts.HeritageClause>()),
    A.flatMap((clause) => A.fromIterable(clause.types)),
    A.map((heritage) => heritage.expression.getText(statement.getSourceFile())),
    A.findFirst((candidate) => MutableHashSet.has(state.declarationNames, candidate)),
    O.getOrUndefined
  );

const supportedDeclaration = (
  statement: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
  state: GenerationState,
  name: string
): GeneratedDeclaration =>
  Match.value(statement).pipe(
    Match.when(ts.isInterfaceDeclaration, (declaration) => ({
      fields: collectFields(declaration.members, state),
      kind: "interface" as const,
      name,
    })),
    Match.when(ts.isClassDeclaration, (declaration) => ({
      ...pipe(
        classBaseName(declaration, state),
        O.fromUndefinedOr,
        O.map((baseName) => ({ baseName })),
        O.getOrElse(() => ({}))
      ),
      fields: collectFields(declaration.members, state),
      kind: "class" as const,
      name,
    })),
    Match.when(ts.isTypeAliasDeclaration, (declaration) => ({
      kind: "type" as const,
      name,
      schemaExpression: schemaForType(declaration.type, state),
    })),
    Match.exhaustive
  );

const declarationFromStatement = (statement: ts.Statement, state: GenerationState): O.Option<GeneratedDeclaration> =>
  pipe(
    declarationName(statement),
    O.fromUndefinedOr,
    O.filter(() => hasExportModifier(statement)),
    O.filter((name) => !shouldSkipDeclaration(name)),
    O.flatMap((name) =>
      Match.value(statement).pipe(
        Match.when(ts.isClassDeclaration, (declaration) => O.some(supportedDeclaration(declaration, state, name))),
        Match.when(ts.isInterfaceDeclaration, (declaration) => O.some(supportedDeclaration(declaration, state, name))),
        Match.when(ts.isTypeAliasDeclaration, (declaration) => O.some(supportedDeclaration(declaration, state, name))),
        Match.orElse(O.none<GeneratedDeclaration>)
      )
    )
  );

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

const referencedDeclarationNames = (expression: string): ReadonlyArray<string> =>
  A.getSomes(
    A.map(A.fromIterable(expression.matchAll(SUSPEND_REFERENCE_PATTERN)), (match) => O.fromNullishOr(match[1]))
  );

const declarationExpressions = (declaration: GeneratedDeclaration): ReadonlyArray<string> => {
  const fieldExpressions = A.map(declaration.fields ?? A.empty<GeneratedField>(), (field) => field.schemaExpression);
  return declaration.schemaExpression === undefined
    ? fieldExpressions
    : A.append(fieldExpressions, declaration.schemaExpression);
};

// Every declaration name a single declaration depends on: its `.extend` base
// class plus every `S.suspend` reference in its own schema expressions.
const declarationReferences = (declaration: GeneratedDeclaration): ReadonlyArray<string> => {
  const references = A.flatMap(declarationExpressions(declaration), referencedDeclarationNames);
  return declaration.baseName === undefined ? references : A.prepend(references, declaration.baseName);
};

/**
 * Walk the declaration graph from `roots`, following `S.suspend` references and
 * `.extend` base names, and return every declaration name that must be emitted.
 */
const reachableDeclarationNames = (
  declarations: ReadonlyArray<GeneratedDeclaration>,
  roots: ReadonlyArray<string>
): MutableHashSet.MutableHashSet<string> => {
  const declarationsByName = HashMap.fromIterable(
    A.map(declarations, (declaration) => [declaration.name, declaration] as const)
  );
  const reached = MutableHashSet.empty<string>();

  const visit = (name: string): void => {
    if (MutableHashSet.has(reached, name)) {
      return;
    }
    MutableHashSet.add(reached, name);

    pipe(
      HashMap.get(declarationsByName, name),
      O.match({
        onNone: () => {},
        onSome: (declaration) => A.forEach(declarationReferences(declaration), visit),
      })
    );
  };

  for (const root of roots) {
    visit(root);
  }

  return reached;
};

// `M.Foo` in a value position.
const propertyAccessMemberName = (node: ts.Node, alias: string): string | undefined =>
  ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === alias
    ? node.name.text
    : undefined;

// `M.Foo` in a type position.
const qualifiedMemberName = (node: ts.Node, alias: string): string | undefined =>
  ts.isQualifiedName(node) && ts.isIdentifier(node.left) && node.left.text === alias ? node.right.text : undefined;

const aliasMemberName = (node: ts.Node, alias: string): string | undefined =>
  propertyAccessMemberName(node, alias) ?? qualifiedMemberName(node, alias);

const namespaceMemberNames = (sourceFile: ts.SourceFile, alias: string): ReadonlyArray<string> => {
  let names = A.empty<string>();

  const visit = (node: ts.Node): void => {
    const member = aliasMemberName(node, alias);
    if (member !== undefined) {
      names = A.append(names, member);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return names;
};

const isGeneratedModelsImport = (statement: ts.Statement): statement is ts.ImportDeclaration =>
  ts.isImportDeclaration(statement) &&
  ts.isStringLiteral(statement.moduleSpecifier) &&
  Str.includes(GENERATED_MODELS_MODULE)(statement.moduleSpecifier.text);

const generatedModelsImportBindings = (statement: ts.Statement): ts.NamedImportBindings | undefined =>
  isGeneratedModelsImport(statement) ? statement.importClause?.namedBindings : undefined;

const bindingModelNames = (sourceFile: ts.SourceFile, bindings: ts.NamedImportBindings): ReadonlyArray<string> =>
  ts.isNamespaceImport(bindings)
    ? namespaceMemberNames(sourceFile, bindings.name.text)
    : A.map(bindings.elements, (element) => (element.propertyName ?? element.name).text);

const importedModelNames = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  let names = A.empty<string>();

  for (const statement of sourceFile.statements) {
    const bindings = generatedModelsImportBindings(statement);
    if (bindings !== undefined) {
      names = A.appendAll(names, bindingModelNames(sourceFile, bindings));
    }
  }

  return names;
};

const sourceFileFor = Effect.fn("Box.generate.sourceFileFor")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(filePath);
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
});

const findFiles: (
  directory: string,
  include: (filePath: string) => boolean
) => Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "Box.generate.findFiles"
)(function* (directory: string, include: (filePath: string) => boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(directory);
  const nested = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* (entry: string) {
      const entryPath = path.join(directory, entry);
      const info = yield* fs.stat(entryPath);
      if (info.type === "Directory") {
        return yield* findFiles(entryPath, include);
      }
      return include(entryPath) ? A.of(entryPath) : A.empty<string>();
    }),
    { concurrency: "unbounded" }
  );
  return A.sort(A.flatten(nested), ascending);
});

const isDeclarationFile = Str.endsWith(".d.ts");

// The driver's own hand-written sources are a second root set for the model
// closure: `Box.streaming.ts` supplies the byte/event operations the generator
// deliberately skips, and still needs their payload models emitted.
const isHandWrittenSourceFile = (filePath: string): boolean =>
  Str.endsWith(".ts")(filePath) && !Str.includes("_generated")(filePath);

const writeGeneratedFile = Effect.fn("Box.generate.writeGeneratedFile")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, `${Str.trimEnd(content)}\n`);
});

// Walk up for the installed SDK rather than assuming it sits in the repo root's
// node_modules: git worktrees have no node_modules of their own and resolve
// against the primary checkout.
const findSdkRoot = Effect.fn("Box.generate.findSdkRoot")(function* (startDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let directory = startDirectory;

  for (;;) {
    const candidate = path.resolve(directory, "node_modules/box-node-sdk");
    if (yield* fs.exists(candidate)) {
      return candidate;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return yield* Effect.die(
        `Could not find node_modules/box-node-sdk above ${startDirectory}. Run bun install first.`
      );
    }
    directory = parent;
  }
});

const resolveBoxPaths = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const packageRoot = path.resolve(scriptDir, "..");
  const sdkRoot = yield* findSdkRoot(packageRoot);
  const generatedRoot = path.resolve(packageRoot, "src/_generated");
  return {
    clientPath: path.resolve(sdkRoot, "lib/client.d.ts"),
    handWrittenSourceRoot: path.resolve(packageRoot, "src"),
    modelsOutputPath: path.resolve(generatedRoot, "Box.models.gen.ts"),
    operationsOutputPath: path.resolve(generatedRoot, "Box.operations.gen.ts"),
    schemaDirectories: [path.resolve(sdkRoot, "lib/schemas"), path.resolve(sdkRoot, "lib/managers")],
    sdkRoot,
  } satisfies BoxSdkPaths;
});

const collectStatementNames = Effect.fn("Box.generate.collectStatementNames")(function* (
  files: ReadonlyArray<string>,
  include: (statement: ts.Statement, sourceFile: ts.SourceFile, name: string) => boolean
) {
  const sourceFiles = yield* Effect.forEach(files, sourceFileFor, { concurrency: "unbounded" });
  return MutableHashSet.fromIterable(
    A.getSomes(
      A.flatMap(sourceFiles, (sourceFile) =>
        A.map(sourceFile.statements, (statement) =>
          pipe(
            declarationName(statement),
            O.fromUndefinedOr,
            O.filter((name) => hasExportModifier(statement) && include(statement, sourceFile, name))
          )
        )
      )
    )
  );
});

const collectDeclarationNames = (files: ReadonlyArray<string>) =>
  collectStatementNames(files, (_statement, _sourceFile, name) => !shouldSkipDeclaration(name));

const collectNonJsonDeclarationNames = Effect.fn("Box.generate.collectNonJsonDeclarationNames")(function* (
  files: ReadonlyArray<string>
) {
  return yield* collectStatementNames(files, (statement, sourceFile) =>
    BYTE_OR_EVENT_PATTERN.test(statement.getText(sourceFile))
  );
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

const collectHandWrittenModelRoots = Effect.fn("Box.generate.collectHandWrittenModelRoots")(function* (
  sourceRoot: string
) {
  const files = yield* findFiles(sourceRoot, isHandWrittenSourceFile);
  let names = A.empty<string>();

  for (const file of files) {
    const sourceFile = yield* sourceFileFor(file);
    names = A.appendAll(names, importedModelNames(sourceFile));
  }

  return A.dedupe(A.sort(names, ascending));
});

const managerPropertyFromMember = (member: ts.ClassElement): O.Option<ManagerProperty> =>
  pipe(
    O.liftPredicate(ts.isPropertyDeclaration)(member),
    O.filter((property) => ts.isIdentifier(property.name)),
    O.flatMap((property) =>
      pipe(
        O.fromUndefinedOr(property.type),
        O.filter(ts.isTypeReferenceNode),
        O.map((reference) => ({ className: typeNameText(reference.typeName), managerName: property.name.getText() }))
      )
    ),
    O.filter((property) => Str.endsWith("Manager")(property.className))
  );

const collectManagerProperties = Effect.fn("Box.generate.collectManagerProperties")(function* (clientPath: string) {
  const sourceFile = yield* sourceFileFor(clientPath);
  return pipe(
    sourceFile.statements,
    A.findFirst((statement) => ts.isClassDeclaration(statement) && statement.name?.text === "BoxClient"),
    O.filter(ts.isClassDeclaration),
    O.map((declaration) => A.getSomes(A.map(declaration.members, managerPropertyFromMember))),
    O.getOrElse(A.empty<ManagerProperty>),
    A.sort(managerPropertyOrder)
  );
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

const managerMethodCandidate = (member: ts.ClassElement): O.Option<ts.MethodDeclaration> =>
  pipe(
    O.liftPredicate(ts.isMethodDeclaration)(member),
    O.filter((method) => ts.isIdentifier(method.name)),
    O.filter((method) => method.type !== undefined)
  );

const methodReferencesNonJson = (member: ts.MethodDeclaration, state: GenerationState): boolean =>
  pipe(
    O.fromUndefinedOr(member.type),
    O.exists((returnType) => typeReferencesNonJson(returnType, state))
  ) ||
  A.some(
    member.parameters,
    (parameter) => parameter.type !== undefined && typeReferencesNonJson(parameter.type, state)
  );

const generatedManagerMethod = (
  property: ManagerProperty,
  member: ts.MethodDeclaration,
  returnType: ts.TypeNode,
  sourceFile: ts.SourceFile,
  fileName: string,
  state: GenerationState
): ManagerMethod => {
  const methodName = member.name.getText(sourceFile);
  const operationName = `${toIdentifier(property.managerName)}${toIdentifier(methodName)}`;
  return {
    className: property.className,
    fileName,
    fullMethodName: `${property.managerName}.${methodName}`,
    managerName: property.managerName,
    methodName,
    parameters: A.map(member.parameters, (parameter) => ({
      name: parameter.name.getText(sourceFile),
      optional: parameter.questionToken !== undefined,
      schemaExpression: parameter.type === undefined ? "S.Unknown" : schemaForType(parameter.type, state),
      typeText: parameter.type?.getText(sourceFile) ?? "unknown",
    })),
    payloadName: `${operationName}Payload`,
    returnType: returnType.getText(sourceFile),
    successName: `${operationName}Success`,
    successSchemaExpression: schemaForType(unwrapPromise(returnType), state),
  };
};

const classifyManagerMethod = (
  property: ManagerProperty,
  member: ts.MethodDeclaration,
  sourceFile: ts.SourceFile,
  fileName: string,
  state: GenerationState
): MethodDisposition => {
  const methodName = member.name.getText(sourceFile);
  const fullMethodName = `${property.managerName}.${methodName}`;
  return Match.value(methodHasDeprecatedTag(member)).pipe(
    Match.when(true, () => NamedMethodDisposition.make({ name: fullMethodName })),
    Match.when(false, () =>
      pipe(
        O.fromUndefinedOr(member.type),
        O.match({
          onNone: () => SkippedMethodDisposition.make({ name: fullMethodName }),
          onSome: (returnType) => {
            const signatureText = `${returnType.getText(sourceFile)} ${A.join(
              A.map(member.parameters, (parameter) => parameter.type?.getText(sourceFile) ?? ""),
              " "
            )}`;
            return Match.value(
              BYTE_OR_EVENT_PATTERN.test(signatureText) || methodReferencesNonJson(member, state)
            ).pipe(
              Match.when(true, () => SkippedMethodDisposition.make({ name: fullMethodName })),
              Match.when(false, () =>
                GeneratedMethodDisposition.make({
                  method: generatedManagerMethod(property, member, returnType, sourceFile, fileName, state),
                })
              ),
              Match.exhaustive
            );
          },
        })
      )
    ),
    Match.exhaustive
  );
};

const generatedDispositionMethod = (disposition: MethodDisposition): O.Option<ManagerMethod> =>
  disposition._tag === "generated" ? O.some(disposition.method) : O.none();

const deprecatedDispositionName = (disposition: MethodDisposition): O.Option<string> =>
  disposition._tag === "deprecated" ? O.some(disposition.name) : O.none();

const skippedDispositionName = (disposition: MethodDisposition): O.Option<string> =>
  disposition._tag === "skipped" ? O.some(disposition.name) : O.none();

const wrappedDispositionName = (disposition: MethodDisposition): O.Option<string> =>
  Match.value(disposition).pipe(
    Match.tag("generated", ({ method }) => O.some(method.fullMethodName)),
    Match.tag("skipped", ({ name }) => O.some(name)),
    Match.tag("deprecated", O.none<string>),
    Match.exhaustive
  );

const managerClassMethods = (
  property: ManagerProperty,
  sourceFile: ts.SourceFile,
  fileName: string,
  state: GenerationState
): ReadonlyArray<MethodDisposition> =>
  pipe(
    sourceFile.statements,
    A.findFirst((statement) => ts.isClassDeclaration(statement) && statement.name?.text === property.className),
    O.filter(ts.isClassDeclaration),
    O.map((declaration) =>
      A.getSomes(
        A.map(declaration.members, (member) =>
          pipe(
            managerMethodCandidate(member),
            O.map((method) => classifyManagerMethod(property, method, sourceFile, fileName, state))
          )
        )
      )
    ),
    O.getOrElse(A.empty<MethodDisposition>)
  );

const collectManagerMethods = Effect.fn("Box.generate.collectManagerMethods")(function* (
  managerProperties: ReadonlyArray<ManagerProperty>,
  state: GenerationState,
  sdkRoot: string
) {
  const path = yield* Path.Path;
  const dispositions = yield* Effect.forEach(
    managerProperties,
    Effect.fnUntraced(function* (property) {
      const managerFile = path.resolve(sdkRoot, "lib/managers", `${property.managerName}.d.ts`);
      const sourceFile = yield* sourceFileFor(managerFile);
      return managerClassMethods(property, sourceFile, path.basename(managerFile), state);
    }),
    { concurrency: "unbounded" }
  ).pipe(Effect.map(A.flatten));

  const generated = A.getSomes(A.map(dispositions, generatedDispositionMethod));
  const deprecated = A.getSomes(A.map(dispositions, deprecatedDispositionName));
  const skipped = A.getSomes(A.map(dispositions, skippedDispositionName));
  const wrapped = A.getSomes(A.map(dispositions, wrappedDispositionName));

  return {
    deprecated: A.sort(deprecated, ascending),
    generated: A.sort(generated, managerMethodOrder),
    skipped: A.sort(skipped, ascending),
    wrapped: A.sort(wrapped, ascending),
  };
});

const renderTypeDeclaration = (
  declaration: GeneratedDeclaration,
  description: string,
  schemaConst: string
): string => `/**
 * ${description}
 *
 * **Example** (Inspect the ${declaration.name} schema)
 *
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
 * **Example** (Reference the ${declaration.name} type)
 *
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

const renderExtendedClassDeclaration = (
  declaration: GeneratedDeclaration,
  description: string,
  fields: string,
  baseName: string
): string => `/**
 * ${description}
 *
 * **Example** (Inspect the ${declaration.name} schema)
 *
 * \`\`\`ts
 * import { ${declaration.name} } from "@beep/box"
 *
 * console.log(${declaration.name}.ast)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class ${declaration.name} extends ${baseName}.extend<${declaration.name}>($I\`${declaration.name}\`)(
  {${fields}},
  $I.annote(${stringLiteral(declaration.name)}, {
    description: ${stringLiteral(description)}
  })
) {}
`;

const renderStandaloneClassDeclaration = (
  declaration: GeneratedDeclaration,
  description: string,
  fields: string
): string => `/**
 * ${description}
 *
 * **Example** (Inspect the ${declaration.name} schema)
 *
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

const renderDeclaration = (declaration: GeneratedDeclaration): string => {
  const description = `Generated Box SDK schema for ${declaration.name}.`;
  if (declaration.kind === "type") {
    return renderTypeDeclaration(
      declaration,
      description,
      renderGeneratedSchemaConst(declaration.name, description, declaration.schemaExpression ?? "S.Unknown")
    );
  }
  const fields = renderStructFields(
    pipe(declaration.fields ?? A.empty<GeneratedField>(), A.map(renderField), A.join("\n    "))
  );
  return pipe(
    O.fromUndefinedOr(declaration.baseName),
    O.match({
      onNone: () => renderStandaloneClassDeclaration(declaration, description, fields),
      onSome: (baseName) => renderExtendedClassDeclaration(declaration, description, fields, baseName),
    })
  );
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
 * **Example** (Inspect the ${method.payloadName} schema)
 *
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
 * **Example** (Inspect the ${method.successName} schema)
 *
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
 * **Example** (Reference the ${method.successName} type)
 *
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

// Kept local because importing this generic helper makes TypeScript instantiate it
// against thousands of generated schemas and exceed the compiler's depth limit.
const withLiteralKitCodecStatics = <Sch extends S.Top & S.ConstraintDecoder<unknown>>(
  schema: Sch
): Sch & {
  // fallow-ignore-next-line code-duplication -- generated-local codec statics avoid TypeScript instantiation-depth failures
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
 * **Example** (Inspect the BoxSerializedData schema)
 *
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
 * **Example** (Reference the BoxSerializedData type)
 *
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
 * **Example** (Inspect the BoxSdkDate schema)
 *
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
 * **Example** (Reference the BoxSdkDate type)
 *
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
 * **Example** (Inspect the BoxSdkDateTime schema)
 *
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
 * **Example** (Reference the BoxSdkDateTime type)
 *
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
 * **Example** (Guard a generated Box method name)
 *
 * \`\`\`ts
 * import { BoxMethodName } from "@beep/box"
 *
 * console.log(BoxMethodName.is["files.getFileById"]("files.getFileById"))
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
${renderGeneratedSchemaConst(
  "BoxMethodName",
  "Generated Box SDK method names wrapped by the Box technical driver.",
  `LiteralKit([
  ${renderedMethodNames}
])`
)};

/**
 * Type for {@link BoxMethodName}.
 *
 * **Example** (Reference the BoxMethodName type)
 *
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
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import type * as S from "effect/Schema";
import type { BoxError } from "../Box.errors.ts";
import * as M from "./Box.models.gen.ts";

/**
 * Shared generated operation runner supplied by {@link Box}.
 *
 * **Example** (Reference the BoxRunSdkCall type)
 *
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
 * **Example** (Reference the BoxGeneratedOperations type)
 *
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
 * **Example** (Inspect the generated operations factory)
 *
 * \`\`\`ts
 * import { makeGeneratedOperations } from "@beep/box/Box.operations.gen"
 *
 * console.log(makeGeneratedOperations)
 * \`\`\`
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGeneratedOperations: {
  (runSdkCall: BoxRunSdkCall): (client: unknown) => BoxGeneratedOperations;
  (client: unknown, runSdkCall: BoxRunSdkCall): BoxGeneratedOperations;
} = dual(2, (client: unknown, runSdkCall: BoxRunSdkCall): BoxGeneratedOperations => ({
  ${A.join(
    A.map(sortedManagers, (managerName) => renderOperationManager(managerName, methodsOf(managerName))),
    "\n  "
  )}
}));
`;
};

const generate = Effect.gen(function* () {
  const paths = yield* resolveBoxPaths();
  const sourceFiles = yield* Effect.forEach(
    paths.schemaDirectories,
    (directory) => findFiles(directory, isDeclarationFile),
    { concurrency: "unbounded" }
  ).pipe(Effect.map(A.flatten));
  const declarationNames = yield* collectDeclarationNames(sourceFiles);
  const nonJsonDeclarationNames = yield* collectNonJsonDeclarationNames(sourceFiles);
  const state: GenerationState = {
    constrainedTypes: MutableHashSet.empty<string>(),
    declarationNames,
    nonJsonDeclarationNames,
  };
  const declarations = yield* collectDeclarations(sourceFiles, state);
  const allManagerProperties = yield* collectManagerProperties(paths.clientPath);

  // Demand-scoped surface: only the managers named in `box.surface.ts` are
  // wrapped. See goals/box-typecheck-cost/SPEC.md.
  const allowedManagers = MutableHashSet.fromIterable(GENERATED_MANAGERS);
  const managerProperties = A.filter(allManagerProperties, (property) =>
    MutableHashSet.has(allowedManagers, property.managerName)
  );
  const droppedManagers = A.filter(
    A.map(allManagerProperties, (property) => property.managerName),
    (managerName) => !MutableHashSet.has(allowedManagers, managerName)
  );
  const unknownManagers = A.filter(
    GENERATED_MANAGERS,
    (managerName) => !A.some(allManagerProperties, (property) => property.managerName === managerName)
  );

  const methods = yield* collectManagerMethods(managerProperties, state, paths.sdkRoot);

  // Model roots come from the kept operations plus the driver's own hand-written
  // sources; everything else is pruned by reachability.
  const handWrittenRoots = yield* collectHandWrittenModelRoots(paths.handWrittenSourceRoot);
  const operationRoots = A.flatMap(methods.generated, (method) =>
    A.appendAll(
      referencedDeclarationNames(method.successSchemaExpression),
      A.flatMap(method.parameters, (parameter) => referencedDeclarationNames(parameter.schemaExpression))
    )
  );
  const reachable = reachableDeclarationNames(declarations, A.appendAll(operationRoots, handWrittenRoots));
  const keptDeclarations = A.filter(declarations, (declaration) => MutableHashSet.has(reachable, declaration.name));

  yield* writeGeneratedFile(
    paths.modelsOutputPath,
    renderModelsFile(keptDeclarations, methods.generated, methods.wrapped)
  );
  yield* writeGeneratedFile(paths.operationsOutputPath, renderOperationsFile(methods.generated));

  const constrainedTypes = A.sort(A.fromIterable(state.constrainedTypes), ascending);

  yield* Effect.log(
    `Generated ${A.length(keptDeclarations)} Box model schemas (pruned ${
      A.length(declarations) - A.length(keptDeclarations)
    } unreachable of ${A.length(declarations)}).`
  );
  yield* Effect.log(`Generated ${A.length(methods.generated)} Box JSON operations.`);
  yield* Effect.log(
    `Wrapped ${A.length(managerProperties)} of ${A.length(allManagerProperties)} SDK managers. Dropped ${A.length(
      droppedManagers
    )}: ${A.match(droppedManagers, {
      onEmpty: () => "none",
      onNonEmpty: (values) => A.join(A.sort(values, ascending), ", "),
    })}.`
  );
  yield* A.match(unknownManagers, {
    onEmpty: () => Effect.void,
    onNonEmpty: (values) =>
      Effect.logWarning(
        `box.surface.ts names ${A.length(values)} manager(s) absent from BoxClient: ${A.join(values, ", ")}.`
      ),
  });
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
