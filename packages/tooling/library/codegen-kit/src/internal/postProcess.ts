import { Match, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { ts } from "ts-morph";
import { CodegenPostProcessError } from "../CodegenKit.errors.ts";
import type { GenerateConfig } from "../CodegenKit.models.ts";

class AnnotationEntry {
  readonly key: string;
  readonly value: string;

  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}

class SchemaExpression {
  readonly expression: string;
  readonly annotations: ReadonlyArray<AnnotationEntry>;

  constructor(expression: string, annotations: ReadonlyArray<AnnotationEntry>) {
    this.expression = expression;
    this.annotations = annotations;
  }
}

class Replacement {
  readonly start: number;
  readonly end: number;
  readonly text: string;

  constructor(start: number, end: number, text: string) {
    this.start = start;
    this.end = end;
    this.text = text;
  }
}

const expressionPrefix = "const __schema = ";
const expressionSuffix = ";";
const propertyIdentifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const outputError = (message: string): CodegenPostProcessError =>
  CodegenPostProcessError.make({ message, cause: message });

const parseExpression = (expression: string) => {
  const source = `${expressionPrefix}${expression}${expressionSuffix}`;
  const sourceFile = ts.createSourceFile(
    "schema-expression.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statement = pipe(
    A.get(A.fromIterable(sourceFile.statements), 0),
    O.filter(ts.isVariableStatement),
    O.getOrThrowWith(() => outputError("Malformed schema expression"))
  );
  const initializer = pipe(
    A.get(A.fromIterable(statement.declarationList.declarations), 0),
    O.flatMap((declaration) => O.fromUndefinedOr(declaration.initializer)),
    O.getOrThrowWith(() => outputError("Generated schema expression has no initializer"))
  );
  return { initializer, source, sourceFile };
};

const isSchemaNamespace = (node: ts.Expression): boolean =>
  ts.isIdentifier(node) && (node.text === "S" || node.text === "Schema");

const isSchemaCall = (call: ts.CallExpression, name: string): boolean =>
  ts.isPropertyAccessExpression(call.expression) &&
  call.expression.name.text === name &&
  isSchemaNamespace(call.expression.expression);

const isFirstSchemaArgument = (node: ts.Node, name: string): boolean =>
  ts.isCallExpression(node.parent) && node.parent.arguments[0] === node && isSchemaCall(node.parent, name);

const isAnnotateCall = (
  node: ts.Node
): node is ts.CallExpression & { readonly expression: ts.PropertyAccessExpression } =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === "annotate";

const propertyAccessParent = (node: ts.Node, parent: ts.Node): O.Option<ts.Node> =>
  pipe(
    O.some(parent),
    O.filter(ts.isPropertyAccessExpression),
    O.filter((candidate) => candidate.expression === node)
  );

const callParent = (node: ts.Node, parent: ts.Node): O.Option<ts.Node> =>
  pipe(
    O.some(parent),
    O.filter(ts.isCallExpression),
    O.filter((candidate) => candidate.expression === node)
  );

const parenthesizedParent = (node: ts.Node, parent: ts.Node): O.Option<ts.Node> =>
  pipe(
    O.some(parent),
    O.filter(ts.isParenthesizedExpression),
    O.filter((candidate) => candidate.expression === node)
  );

const spineParent = (node: ts.Node): O.Option<ts.Node> =>
  pipe(
    O.fromUndefinedOr(node.parent),
    O.flatMap((parent) =>
      O.firstSomeOf([propertyAccessParent(node, parent), callParent(node, parent), parenthesizedParent(node, parent)])
    )
  );

const isExpressionSpine = (node: ts.Node, root: ts.Expression): boolean =>
  node === root ||
  pipe(
    spineParent(node),
    O.exists((parent) => isExpressionSpine(parent, root))
  );

const isSchemaSlot = (node: ts.Node, slot: ts.Expression): boolean => {
  const optionalSchema = pipe(
    O.some(slot),
    O.filter(ts.isCallExpression),
    O.filter((call) => isSchemaCall(call, "optionalKey")),
    O.flatMap((call) => A.get(A.fromIterable(call.arguments), 0))
  );
  return (
    isExpressionSpine(node, slot) ||
    pipe(
      optionalSchema,
      O.exists((schema) => isSchemaSlot(node, schema))
    )
  );
};

const isCurrentStructProperty = (node: ts.CallExpression, current: ts.Node): boolean =>
  pipe(
    O.some(current),
    O.filter(ts.isPropertyAssignment),
    O.filter((property) => ts.isObjectLiteralExpression(property.parent)),
    O.filter((property) => isFirstSchemaArgument(property.parent, "Struct")),
    O.exists((property) => isSchemaSlot(node, property.initializer))
  );

const structProperty = (node: ts.CallExpression, current: ts.Node = node): boolean =>
  isCurrentStructProperty(node, current) ||
  pipe(
    O.fromUndefinedOr(current.parent),
    O.exists((parent) => structProperty(node, parent))
  );

const unionArrayMember = (node: ts.CallExpression, current: ts.Node = node): boolean => {
  const parent = current.parent;
  if (parent === undefined) return false;
  if (ts.isArrayLiteralExpression(parent) && isFirstSchemaArgument(parent, "Union")) {
    return A.some(A.fromIterable(parent.elements), (element) => element === current && isSchemaSlot(node, element));
  }
  return unionArrayMember(node, parent);
};

const unionCallMember = (node: ts.CallExpression, current: ts.Node = node): boolean => {
  const parent = current.parent;
  if (parent === undefined) return false;
  if (ts.isCallExpression(parent) && isSchemaCall(parent, "Union")) {
    return A.some(A.fromIterable(parent.arguments), (argument) => argument === current && isSchemaSlot(node, argument));
  }
  return unionCallMember(node, parent);
};

const keyAnnotation = (node: ts.CallExpression): boolean =>
  structProperty(node) || unionArrayMember(node) || unionCallMember(node);

const replacementOrder = Order.make<Replacement>((left, right) =>
  left.start === right.start ? 0 : left.start > right.start ? -1 : 1
);

const applyReplacements = (source: string, replacements: ReadonlyArray<Replacement>): string =>
  A.reduce(
    A.sort(replacements, replacementOrder),
    source,
    (current, replacement) =>
      `${Str.slice(0, replacement.start)(current)}${replacement.text}${Str.slice(replacement.end)(current)}`
  );

const unwrapExpression = (source: string): string =>
  pipe(source, Str.slice(Str.length(expressionPrefix)), Str.slice(0, -Str.length(expressionSuffix)));

const visitNodes = (root: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(root);
  ts.forEachChild(root, (child) => visitNodes(child, visit));
};

type NodeReplacement = (node: ts.Node, sourceFile: ts.SourceFile) => O.Option<Replacement>;

const collectNodeReplacements = (source: string, replacementFor: NodeReplacement): ReadonlyArray<Replacement> => {
  const sourceFile = ts.createSourceFile("generated.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const replacements: Array<Replacement> = [];
  visitNodes(sourceFile, (node) => {
    pipe(
      replacementFor(node, sourceFile),
      O.map((replacement) => replacements.push(replacement))
    );
  });
  return replacements;
};

type StatementReplacement = (statement: ts.Statement, sourceFile: ts.SourceFile) => O.Option<Replacement>;

const collectStatementReplacements = (
  source: string,
  replacementFor: StatementReplacement
): ReadonlyArray<Replacement> => {
  const sourceFile = ts.createSourceFile("generated.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return pipe(
    A.fromIterable(sourceFile.statements),
    A.flatMap((statement) => pipe(replacementFor(statement, sourceFile), O.toArray))
  );
};

const rewriteKeyAnnotations = (expression: string): string => {
  const { source, sourceFile } = parseExpression(expression);
  const replacements: Array<Replacement> = [];
  visitNodes(sourceFile, (node) => {
    if (isAnnotateCall(node) && keyAnnotation(node)) {
      replacements.push(
        new Replacement(node.expression.name.getStart(sourceFile), node.expression.name.getEnd(), "annotateKey")
      );
    }
  });
  return unwrapExpression(applyReplacements(source, replacements));
};

const propertyName = (name: ts.PropertyName): O.Option<string> =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? O.some(name.text) : O.none();

const annotationEntries = (argument: ts.Expression, sourceFile: ts.SourceFile): ReadonlyArray<AnnotationEntry> => {
  if (!ts.isObjectLiteralExpression(argument)) return [];
  return pipe(
    A.fromIterable(argument.properties),
    A.filter(ts.isPropertyAssignment),
    A.flatMap((property) =>
      pipe(
        propertyName(property.name),
        O.filter((key) => key !== "title"),
        O.map((key) => [
          new AnnotationEntry(key === "description" ? "documentation" : key, property.initializer.getText(sourceFile)),
        ]),
        O.getOrElse(A.empty<AnnotationEntry>)
      )
    )
  );
};

const dedupeAnnotations = (entries: ReadonlyArray<AnnotationEntry>): ReadonlyArray<AnnotationEntry> =>
  A.dedupeWith(entries, (left, right) => left.key === right.key);

const extractTopAnnotation = (expression: string): SchemaExpression => {
  const { initializer, source, sourceFile } = parseExpression(expression);
  const replacements: Array<Replacement> = [];
  const annotations: Array<AnnotationEntry> = [];
  visitNodes(initializer, (node) => {
    if (!isAnnotateCall(node) || !isExpressionSpine(node, initializer)) return;
    const argument = node.arguments[0];
    if (argument !== undefined) annotations.push(...annotationEntries(argument, sourceFile));
    replacements.push(
      new Replacement(node.getStart(sourceFile), node.getEnd(), node.expression.expression.getText(sourceFile))
    );
  });
  return new SchemaExpression(
    unwrapExpression(applyReplacements(source, replacements)),
    dedupeAnnotations(annotations)
  );
};

const isSchemaProperty = (node: ts.Node, name: string): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) && node.name.text === name && isSchemaNamespace(node.expression);

const isIntegerCheck = (node: ts.Expression): boolean =>
  (ts.isCallExpression(node) && isSchemaCall(node, "isInt")) ||
  (isAnnotateCall(node) &&
    ts.isCallExpression(node.expression.expression) &&
    isSchemaCall(node.expression.expression, "isInt"));

const integerSchemaReceiver = (node: ts.CallExpression): O.Option<ts.Expression> => {
  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== "check") return O.none();
  if (!pipe(A.get(A.fromIterable(node.arguments), 0), O.exists(isIntegerCheck))) return O.none();
  const receiver = node.expression.expression;
  if (isSchemaProperty(receiver, "Number")) return O.some(receiver);
  return pipe(
    O.some(receiver),
    O.filter(isAnnotateCall),
    O.filter((call) => isSchemaProperty(call.expression.expression, "Number"))
  );
};

const integerSchemaReplacement: NodeReplacement = (node, sourceFile) =>
  pipe(
    O.some(node),
    O.filter(ts.isCallExpression),
    O.flatMap((call) =>
      pipe(
        integerSchemaReceiver(call),
        O.map(
          (receiver) =>
            new Replacement(
              call.getStart(sourceFile),
              call.getEnd(),
              Str.replace(/\bS\.Number\b/, "S.Int")(receiver.getText(sourceFile))
            )
        )
      )
    )
  );

const normalizeIntegerSchemas = (source: string): string =>
  applyReplacements(source, collectNodeReplacements(source, integerSchemaReplacement));

const finiteSchemaReplacement: NodeReplacement = (node, sourceFile) =>
  pipe(
    O.some(node),
    O.filter((candidate): candidate is ts.PropertyAccessExpression => isSchemaProperty(candidate, "Number")),
    O.map((schema) => new Replacement(schema.getStart(sourceFile), schema.getEnd(), "S.Finite"))
  );

const normalizeFiniteSchemas = (source: string): string =>
  applyReplacements(source, collectNodeReplacements(source, finiteSchemaReplacement));

const normalizeNumberSchemas = (source: string, config: GenerateConfig): string => {
  const integers = normalizeIntegerSchemas(source);
  return config.numberPolicy === "finite" ? normalizeFiniteSchemas(integers) : integers;
};

const isPipeableSchema = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && (isSchemaCall(node, "Array") || isSchemaCall(node, "Record"));

const pipeableSchemaReplacement: NodeReplacement = (node, sourceFile) =>
  pipe(
    O.some(node),
    O.filter(ts.isCallExpression),
    O.filter((call) => isSchemaCall(call, "optionalKey")),
    O.flatMap((call) =>
      pipe(
        A.get(A.fromIterable(call.arguments), 0),
        O.filter(isPipeableSchema),
        O.map(
          (schema) =>
            new Replacement(
              call.getStart(sourceFile),
              call.getEnd(),
              `${schema.getText(sourceFile)}.pipe(S.optionalKey)`
            )
        )
      )
    )
  );

const normalizePipeableSchemas = (source: string): string => {
  const replacements = collectNodeReplacements(source, pipeableSchemaReplacement);
  if (A.isReadonlyArrayEmpty(replacements)) return source;
  const innermost = A.filter(
    replacements,
    (candidate) => !A.some(replacements, (other) => other.start > candidate.start && other.end < candidate.end)
  );
  return normalizePipeableSchemas(applyReplacements(source, innermost));
};

const prepareSchemaExpression = (expression: string, config: GenerateConfig): SchemaExpression =>
  extractTopAnnotation(
    rewriteKeyAnnotations(normalizeNumberSchemas(Str.replaceAll(/\bSchema\./gu, "S.")(expression), config))
  );

const renderKey = (key: string): string =>
  propertyIdentifierPattern.test(key)
    ? key
    : `"${pipe(key, Str.replaceAll("\\", "\\\\"), Str.replaceAll('"', '\\"'))}"`;

const packageLabel = (packageName: string): string =>
  pipe(
    packageName,
    Str.split("/"),
    A.last,
    O.getOrElse(() => packageName),
    Str.toUpperCase
  );

const renderAnnotation = (
  name: string,
  annotations: ReadonlyArray<AnnotationEntry>,
  config: GenerateConfig,
  annotation: "annote" | "annoteSchema" = "annoteSchema"
): string => {
  const entries = dedupeAnnotations([
    new AnnotationEntry("description", `"Generated ${packageLabel(config.packageName)} schema for ${name}."`),
    ...annotations,
  ]);
  return pipe(
    [
      `  $I.${annotation}("${name}", {`,
      ...A.map(entries, (entry) => `    ${renderKey(entry.key)}: ${entry.value},`),
      "  })",
    ],
    A.join("\n")
  );
};

const schemaImportPath = (config: GenerateConfig): string =>
  config.schemaStyle === "class" ? config.packageName : `${config.packageName}/schema`;

const renderSchemaEntry = (name: string, constLine: string, config: GenerateConfig): string => {
  const expression = prepareSchemaExpression(
    pipe(constLine, Str.replace(new RegExp(`^export const ${name} = `), ""), Str.replace(/;$/, "")),
    config
  );
  return pipe(
    [
      "/**",
      ` * Generated ${packageLabel(config.packageName)} schema for \`${name}\`.`,
      " *",
      ` * **Example** (Inspect the ${name} schema)`,
      " *",
      " * ```ts",
      ` * import { ${name} } from "${schemaImportPath(config)}"`,
      " *",
      ` * console.log(${name}.ast)`,
      " * ```",
      " *",
      " * @category schemas",
      " * @since 0.0.0",
      " */",
      `export const ${name} = ${expression.expression}.pipe(`,
      `${renderAnnotation(name, expression.annotations, config)},`,
      "  SchemaUtils.withCodecStatics",
      ");",
      "",
      "/**",
      ` * Type for {@link ${name}}.`,
      " *",
      ` * **Example** (Reference the ${name} type)`,
      " *",
      " * ```ts",
      ` * import type { ${name} } from "${schemaImportPath(config)}"`,
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
};

const structFields = (expression: string): O.Option<string> => {
  const { initializer, sourceFile } = parseExpression(expression);
  return pipe(
    O.some(initializer),
    O.filter(ts.isCallExpression),
    O.filter((call) => isSchemaCall(call, "Struct")),
    O.flatMap((call) => A.get(A.fromIterable(call.arguments), 0)),
    O.map((fields) => fields.getText(sourceFile))
  );
};

const renderClassEntry = (
  name: string,
  fields: string,
  annotations: ReadonlyArray<AnnotationEntry>,
  config: GenerateConfig
): string =>
  pipe(
    [
      "/**",
      ` * Generated ${packageLabel(config.packageName)} class schema for \`${name}\`.`,
      " *",
      ` * **Example** (Inspect ${name})`,
      " *",
      " * ```ts",
      ` * import { ${name} } from "${schemaImportPath(config)}"`,
      " *",
      ` * console.log(${name}.ast)`,
      " * ```",
      " *",
      " * @category schemas",
      " * @since 0.0.0",
      " */",
      `export class ${name} extends S.Class<${name}>($I\`${name}\`)(`,
      `  ${fields},`,
      `${renderAnnotation(name, annotations, config, "annote")}`,
      ") {",
      `  static readonly is = S.is(${name});`,
      "}",
    ],
    A.join("\n")
  );

const renderSchemaPair = (name: string, constLine: string, config: GenerateConfig): string => {
  if (config.schemaStyle === "struct") return renderSchemaEntry(name, constLine, config);
  const expression = prepareSchemaExpression(
    pipe(constLine, Str.replace(new RegExp(`^export const ${name} = `), ""), Str.replace(/;$/, "")),
    config
  );
  return pipe(
    structFields(expression.expression),
    O.map((fields) => renderClassEntry(name, fields, expression.annotations, config)),
    O.getOrElse(() => renderSchemaEntry(name, constLine, config))
  );
};

const schemaName = (typeLine: string): O.Option<string> =>
  pipe(Str.match(/^export type ([A-Za-z0-9_]+)/)(typeLine), O.flatMap(A.get(1)), O.filter(P.isString));

const rawLines = (source: string): ReadonlyArray<string> =>
  pipe(source, Str.split("\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));

const schemaPairs = (source: string): ReadonlyArray<readonly [string, string]> => {
  const lines = rawLines(source);
  return pipe(
    lines,
    A.flatMap((line, index) =>
      pipe(
        schemaName(line),
        O.flatMap((name) =>
          pipe(
            A.get(lines, index + 1),
            O.filter(Str.startsWith(`export const ${name} = `)),
            O.map((constLine) => [[name, constLine] as const])
          )
        ),
        O.getOrElse(A.empty<readonly [string, string]>)
      )
    ),
    A.dedupeWith((left, right) => left[0] === right[0])
  );
};

const recursiveInternals = (source: string, config: GenerateConfig): ReadonlyArray<string> =>
  pipe(
    rawLines(source),
    A.filter(Str.startsWith("const __recursive_")),
    A.map((line) => normalizeNumberSchemas(Str.replaceAll(/\bSchema\./gu, "S.")(line), config))
  );

const defaultHeader = (config: GenerateConfig): string =>
  pipe(
    [
      "/**",
      ` * Generated ${config.format} source for ${Str.replaceAll("@", "\\@")(config.packageName)}.`,
      " *",
      " * @packageDocumentation",
      " * @since 0.0.0",
      " */",
      "",
      "// This file is generated. Do not edit manually.",
    ],
    A.join("\n")
  );

const renderSchemas = (source: string, config: GenerateConfig): string =>
  pipe(
    [
      config.output.header ?? defaultHeader(config),
      "",
      `import { ${config.identity.composer} } from "@beep/identity";`,
      'import { SchemaUtils } from "@beep/schema";',
      'import * as S from "effect/Schema";',
      "",
      `const $I = ${config.identity.composer}.create("${config.identity.moduleId}");`,
      "",
      ...recursiveInternals(source, config),
      recursiveInternals(source, config).length === 0 ? "" : "",
      pipe(
        schemaPairs(source),
        A.map(([name, line]) => renderSchemaPair(name, line, config)),
        A.join("\n\n")
      ),
      "",
    ],
    A.join("\n")
  );

const namedStatementName = (statement: ts.NamedDeclaration): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(statement.name),
    O.filter(ts.isIdentifier),
    O.map((name) => name.text)
  );

const variableStatementName = (statement: ts.VariableStatement): O.Option<string> =>
  pipe(
    A.get(A.fromIterable(statement.declarationList.declarations), 0),
    O.map((declaration) => declaration.name),
    O.filter(ts.isIdentifier),
    O.map((name) => name.text)
  );

const declarationName = (statement: ts.Statement): O.Option<string> =>
  Match.value(statement).pipe(
    Match.when(ts.isClassDeclaration, namedStatementName),
    Match.when(ts.isFunctionDeclaration, namedStatementName),
    Match.when(ts.isInterfaceDeclaration, namedStatementName),
    Match.when(ts.isTypeAliasDeclaration, namedStatementName),
    Match.when(ts.isVariableStatement, variableStatementName),
    Match.orElse(() => O.none<string>())
  );

const isExported = (statement: ts.Statement): boolean =>
  A.some(
    A.fromIterable(ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : []),
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

const isTypeOnly = (statement: ts.Statement): boolean =>
  ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);

const renderGenericDoc = (name: string, typeOnly: boolean, config: GenerateConfig): string =>
  pipe(
    [
      "/**",
      ` * Generated ${name} declaration for ${Str.replaceAll("@", "\\@")(config.packageName)}.`,
      ...(typeOnly
        ? []
        : [
            " *",
            ` * **Example** (Inspect ${name})`,
            " *",
            " * ```ts",
            ` * import { ${name} } from "${config.packageName}"`,
            " *",
            ` * console.log(${name})`,
            " * ```",
          ]),
      " *",
      ` * @category ${typeOnly ? "models" : "tools"}`,
      " * @since 0.0.0",
      " */",
    ],
    A.join("\n")
  );

const generatedSchemaInitializerPattern =
  /^S\.(?:String|Number|Boolean|BigInt|Symbol|Object|Unknown|Any|Never|Void|Null|Undefined|Date|Array|Record|Struct|Union|Literal|TemplateLiteral|Tuple|Class|Enums|OptionFrom|NullOr|TaggedStruct|TaggedError)(?:\s*(?:[({[;,]|$)|\.pipe\s*\()/;

const exportedSchemaDeclaration = (
  statement: ts.Statement,
  sourceFile: ts.SourceFile
): O.Option<readonly [name: string, initializer: ts.Expression]> =>
  pipe(
    O.some(statement),
    O.filter(ts.isVariableStatement),
    O.filter(isExported),
    O.flatMap((variableStatement) => A.get(A.fromIterable(variableStatement.declarationList.declarations), 0)),
    O.flatMap((declaration) =>
      pipe(
        O.all({
          initializer: O.fromUndefinedOr(declaration.initializer),
          name: pipe(O.some(declaration.name), O.filter(ts.isIdentifier)),
        }),
        O.filter(({ initializer }) => generatedSchemaInitializerPattern.test(initializer.getText(sourceFile))),
        O.map(({ initializer, name }) => [name.text, initializer] as const)
      )
    )
  );

const addIdentityContext = (source: string, config: GenerateConfig): string => {
  const withImport = `import { ${config.identity.composer} } from "@beep/identity";\n${source}`;
  const sourceFile = ts.createSourceFile("generated.ts", withImport, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const insertionPoint = pipe(
    A.fromIterable(sourceFile.statements),
    A.filter(ts.isImportDeclaration),
    A.last,
    O.map((declaration) => declaration.getEnd()),
    O.getOrElse(() => 0)
  );
  const identity = `\n\nconst $I = ${config.identity.composer}.create("${config.identity.moduleId}");`;
  return `${Str.slice(0, insertionPoint)(withImport)}${identity}${Str.slice(insertionPoint)(withImport)}`;
};

const annotateExportedSchemas = (source: string, config: GenerateConfig): string => {
  const replacements = collectStatementReplacements(source, (statement, sourceFile) =>
    pipe(
      exportedSchemaDeclaration(statement, sourceFile),
      O.map(
        ([name, initializer]) =>
          new Replacement(
            initializer.getStart(sourceFile),
            initializer.getEnd(),
            `${initializer.getText(sourceFile)}.pipe(\n${renderAnnotation(name, [], config)}\n)`
          )
      )
    )
  );
  return A.isReadonlyArrayEmpty(replacements)
    ? source
    : addIdentityContext(applyReplacements(source, replacements), config);
};

const addExportDocs = (source: string, config: GenerateConfig): string =>
  applyReplacements(
    source,
    collectStatementReplacements(source, (statement, sourceFile) =>
      pipe(
        O.some(statement),
        O.filter(isExported),
        O.flatMap((exportedStatement) =>
          pipe(
            declarationName(exportedStatement),
            O.map(
              (name) =>
                new Replacement(
                  exportedStatement.getStart(sourceFile),
                  exportedStatement.getStart(sourceFile),
                  `${renderGenericDoc(name, isTypeOnly(exportedStatement), config)}\n`
                )
            )
          )
        )
      )
    )
  );

const collectIdentifiers = (statement: ts.Statement): ReadonlyArray<string> => {
  const identifiers: Array<string> = [];
  visitNodes(statement, (node) => {
    if (ts.isIdentifier(node)) identifiers.push(node.text);
  });
  return identifiers;
};

const bindingIsUsed = (used: ReadonlyArray<string>, identifier: ts.Identifier | undefined): boolean =>
  identifier !== undefined && A.contains(used, identifier.text);

const pruneNamedBindings = (
  bindings: ts.NamedImportBindings | undefined,
  used: ReadonlyArray<string>
): ts.NamedImportBindings | undefined =>
  Match.value(bindings).pipe(
    Match.when(P.isUndefined, () => undefined),
    Match.when(ts.isNamespaceImport, (namespace) =>
      pipe(
        O.some(namespace),
        O.filter((candidate) => bindingIsUsed(used, candidate.name)),
        O.getOrUndefined
      )
    ),
    Match.when(ts.isNamedImports, (named) => pruneNamedImports(named, used)),
    Match.exhaustive
  );

const pruneNamedImports = (bindings: ts.NamedImports, used: ReadonlyArray<string>): ts.NamedImports | undefined => {
  const elements = A.filter(A.fromIterable(bindings.elements), (element) => bindingIsUsed(used, element.name));
  return A.length(elements) > 0 ? ts.factory.updateNamedImports(bindings, elements) : undefined;
};

const pruneImport = (
  declaration: ts.ImportDeclaration,
  used: ReadonlyArray<string>,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): string =>
  Match.value(declaration.importClause).pipe(
    Match.when(P.isUndefined, () => declaration.getText(sourceFile)),
    Match.orElse((clause) =>
      pipe(
        prunedImportClause(clause, used),
        O.map((updatedClause) =>
          ts.factory.updateImportDeclaration(
            declaration,
            declaration.modifiers,
            updatedClause,
            declaration.moduleSpecifier,
            declaration.attributes
          )
        ),
        O.map((updated) => printer.printNode(ts.EmitHint.Unspecified, updated, sourceFile)),
        O.getOrElse(() => "")
      )
    )
  );

const prunedImportClause = (clause: ts.ImportClause, used: ReadonlyArray<string>): O.Option<ts.ImportClause> => {
  const name = pipe(
    O.fromUndefinedOr(clause.name),
    O.filter((identifier) => bindingIsUsed(used, identifier))
  );
  const namedBindings = O.fromUndefinedOr(pruneNamedBindings(clause.namedBindings, used));
  return pipe(
    O.all({ name, namedBindings }),
    O.orElse(() => O.map(name, (keptName) => ({ name: keptName, namedBindings: undefined }))),
    O.orElse(() => O.map(namedBindings, (keptBindings) => ({ name: undefined, namedBindings: keptBindings }))),
    O.map(({ name: keptName, namedBindings: keptBindings }) =>
      ts.factory.updateImportClause(clause, clause.phaseModifier, keptName, keptBindings)
    )
  );
};

const stripUnusedImports = (source: string): string => {
  const sourceFile = ts.createSourceFile("generated.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const used = pipe(
    A.fromIterable(sourceFile.statements),
    A.filter((statement) => !ts.isImportDeclaration(statement)),
    A.flatMap(collectIdentifiers)
  );
  const printer = ts.createPrinter();
  const replacements = pipe(
    A.fromIterable(sourceFile.statements),
    A.filter(ts.isImportDeclaration),
    A.map(
      (declaration) =>
        new Replacement(
          declaration.getStart(sourceFile),
          declaration.getEnd(),
          pruneImport(declaration, used, sourceFile, printer)
        )
    )
  );
  return applyReplacements(source, replacements);
};

const prependHeader = (source: string, config: GenerateConfig): string =>
  `${config.output.header ?? defaultHeader(config)}\n\n${source}`;

const normalizeModule = (source: string, config: GenerateConfig): string =>
  pipe(
    source,
    Str.replaceAll('import * as Schema from "effect/Schema"', 'import * as S from "effect/Schema"'),
    Str.replaceAll(/\bSchema\./gu, "S."),
    (text) => normalizeNumberSchemas(text, config),
    normalizePipeableSchemas,
    stripUnusedImports,
    (text) => annotateExportedSchemas(text, config),
    (text) => addExportDocs(text, config),
    (text) => prependHeader(text, config)
  );

export const postProcess: {
  (config: GenerateConfig): (source: string) => string;
  (source: string, config: GenerateConfig): string;
} = dual(2, (source: string, config: GenerateConfig): string =>
  config.format === "schemas" ? renderSchemas(source, config) : normalizeModule(source, config)
);
