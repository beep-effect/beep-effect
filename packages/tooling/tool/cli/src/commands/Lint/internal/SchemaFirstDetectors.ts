/**
 * AST detectors for schema-first inventory and SFV4 advisory entries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { flow, pipe } from "effect";
import * as O from "effect/Option";
import { Node, SyntaxKind } from "ts-morph";
import { SchemaFirstInventoryEntry } from "../Lint.schemas.js";
import type { TypeElementTypes } from "ts-morph";

const IDENTIFIER_PROPERTY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const FUNCTION_LIKE_TEXT_PATTERN = /=>|\bEffect\.Effect</;
const NON_SCHEMA_SIGNAL_PATTERN =
  /\bEffect\.Success<|\bLayer\.Layer<|\bAbortSignal\b|\bAbortController\b|\bUint8Array\b|\bEventJournal\.Entry\b|\bZod\b|\bz\.|\bAtom\.|\bNodeJS\.(?:Readable|Writable)Stream\b|\bStartedTestContainer\b|\bpulumi\.Input<|\bWinkMethods\b|\b(?:Any)?OperationResult\b/;
const SCHEMA_FIELDS_CALL_PATTERN = /\bS\.(?:Class|Struct|TaggedClass|TaggedStruct|ErrorClass|TaggedErrorClass)\b/;
const SCHEMA_CLASS_FIELDS_CALL_PATTERN = /\bS\.(?:Class|TaggedClass|ErrorClass|TaggedErrorClass)\b/;
const NUMERIC_DOMAIN_TOKENS = ["timeout", "count", "size", "rate", "limit", "ms", "seconds"] as const;
const STATIC_API_SCHEMA_SIGNAL_PATTERN = /\b(?:S\.(?:TaggedUnion|toTaggedUnion)|LiteralKit|MappedLiteralKit)\s*\(/;
const DEFAULTS_SCHEMA_SIGNAL_PATTERN =
  /\b(?:S\.(?:Class|Struct|TaggedClass|TaggedStruct|ErrorClass|TaggedErrorClass)|withConstructorDefault|withDecodingDefault|SchemaUtils\.withKeyDefaults)\b/;
const EQUIVALENCE_SCHEMA_SIGNAL_PATTERN =
  /\b(?:S\.(?:Class|Struct|TaggedClass|TaggedStruct|ErrorClass|TaggedErrorClass|toEquivalence|overrideToEquivalence)|SchemaUtils\.toEquivalence)\b/;
const FN_CALL_SIGNAL_PATTERN = /\bFn\s*\(/;
const NORMALIZATION_METHOD_NAMES = ["trim", "toUpperCase", "toLowerCase"] as const;
const NORMALIZATION_CALL_SIGNAL_PATTERN = /\.(?:trim|toUpperCase|toLowerCase)\(/;
const NULL_UNDEFINED_RETURN_PATTERN = /\bnull\b|\bundefined\b/;
const GETSOMES_CALL_SIGNAL_PATTERN = /\bgetSomes\s*\(/;
const GETSOMES_OBJECT_NAMES = ["R", "Record"] as const;
const SCHEMA_DERIVED_EQUIVALENCE_PATTERN =
  /\b(?:S|Schema)\.(?:toEquivalence|overrideToEquivalence)\b|SchemaUtils\.toEquivalence\b/;
const MANUAL_EQUALITY_COMPARISON_PATTERN = /===|!==/;
const BROAD_EMAIL_SCHEMA_PATTERN = /^S\.optionalKey\(S\.String(?:\)|,)|^S\.String(?:$|\.pipe\()/;
const DEFAULT_PARAMETER_NAMES = ["options", "params", "config", "request", "args", "input"] as const;
const SCHEMA_DISCRIMINATOR_TOKENS = [
  "_tag",
  "tag",
  "kind",
  "status",
  "type",
  "mode",
  "reason",
  "state",
  "category",
  "profile",
  "family",
  "subtype",
] as const;

const isFunctionLikeMember = (member: Node): boolean => {
  if (
    Node.isMethodSignature(member) ||
    Node.isCallSignatureDeclaration(member) ||
    Node.isConstructSignatureDeclaration(member)
  ) {
    return true;
  }
  if (Node.isPropertySignature(member)) {
    const typeNode = member.getTypeNode();
    return typeNode !== undefined && typeNode.getKind() === SyntaxKind.FunctionType;
  }
  return false;
};

const isTypeNodeUnsafe = (typeText: string): boolean =>
  FUNCTION_LIKE_TEXT_PATTERN.test(typeText) || NON_SCHEMA_SIGNAL_PATTERN.test(typeText);

const typeLiteralMembersUnsafe = (members: ReadonlyArray<Node>): boolean =>
  A.some(members, (member) => {
    if (isFunctionLikeMember(member)) {
      return true;
    }
    if (Node.isPropertySignature(member)) {
      const typeText = member.getTypeNode()?.getText() ?? "";
      return isTypeNodeUnsafe(typeText);
    }
    return false;
  });

const detectInterfaceReason = (node: import("ts-morph").InterfaceDeclaration): O.Option<string> => {
  if (node.getTypeParameters().length > 0) {
    return O.some("Generic interface requires manual modeling and is tracked as an exception.");
  }
  if (node.getExtends().length > 0) {
    return O.some("Derived interface with extends clauses is tracked as an exception.");
  }
  if (typeLiteralMembersUnsafe(node.getMembers())) {
    return O.some("Interface contains non-schema signals such as function members or runtime handles.");
  }
  return O.none();
};

const detectTypeAliasReason = (node: import("ts-morph").TypeAliasDeclaration): O.Option<string> => {
  if (node.getTypeParameters().length > 0) {
    return O.some("Generic type alias requires manual modeling and is tracked as an exception.");
  }
  const typeNode = node.getTypeNode();
  if (typeNode === undefined || typeNode.getKind() !== SyntaxKind.TypeLiteral) {
    return O.some("Non-literal type alias is out of scope for automatic schema-first enforcement.");
  }
  const members = Node.isTypeLiteral(typeNode) ? typeNode.getMembers() : A.empty<TypeElementTypes>();
  if (typeLiteralMembersUnsafe(members)) {
    return O.some("Type alias contains non-schema signals such as function members or runtime handles.");
  }
  return O.none();
};

const isFunctionLocalNode = (node: Node): boolean =>
  node.getFirstAncestor(
    (ancestor) =>
      Node.isFunctionDeclaration(ancestor) ||
      Node.isFunctionExpression(ancestor) ||
      Node.isArrowFunction(ancestor) ||
      Node.isMethodDeclaration(ancestor)
  ) !== undefined;

const nodesShareSymbolDeclaration = (left: Node, right: Node): boolean => {
  const rightDeclarations = right.getSymbol()?.getDeclarations() ?? [];
  return (
    rightDeclarations.length > 0 &&
    A.some(left.getSymbol()?.getDeclarations() ?? [], (leftDeclaration) => rightDeclarations.includes(leftDeclaration))
  );
};

const isStructFieldsInputForSchemaClass = (callExpression: import("ts-morph").CallExpression): boolean => {
  const variableDeclaration = callExpression.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (variableDeclaration === undefined) {
    return false;
  }

  const variableNameNode = variableDeclaration.getNameNode();
  return A.some(callExpression.getSourceFile().getDescendantsOfKind(SyntaxKind.CallExpression), (candidate) => {
    if (candidate === callExpression || !SCHEMA_CLASS_FIELDS_CALL_PATTERN.test(candidate.getExpression().getText())) {
      return false;
    }
    const firstArgument = candidate.getArguments()[0];
    return firstArgument !== undefined && nodesShareSymbolDeclaration(firstArgument, variableNameNode);
  });
};

const detectStructReason = (callExpression: import("ts-morph").CallExpression): O.Option<string> => {
  const firstArgument = callExpression.getArguments()[0];
  if (firstArgument === undefined || !Node.isObjectLiteralExpression(firstArgument)) {
    return O.some("S.Struct usage without a plain object literal stays tracked as an exception.");
  }
  const invalidKeys = A.some(firstArgument.getProperties(), (property) => {
    if (Node.isSpreadAssignment(property)) {
      return true;
    }
    const nameNode = "getNameNode" in property ? property.getNameNode() : undefined;
    if (nameNode === undefined) {
      return true;
    }
    const propertyName = Str.replace(/^["']|["']$/g, "")(nameNode.getText());
    return !IDENTIFIER_PROPERTY_PATTERN.test(propertyName);
  });
  if (invalidKeys) {
    return O.some("S.Struct with non-identifier or spread keys stays tracked as an exception.");
  }
  if (callExpression.getFirstAncestorByKind(SyntaxKind.PropertyAssignment) !== undefined) {
    return O.some("Inline nested S.Struct boundary shapes stay tracked until a dedicated class extraction pass.");
  }
  if (isStructFieldsInputForSchemaClass(callExpression)) {
    return O.some("Internal S.Struct field block feeds an S.Class constructor and stays tied to the class model.");
  }
  if (isFunctionLocalNode(callExpression)) {
    return O.some("Function-local S.Struct wrappers used for transient decode envelopes stay tracked as exceptions.");
  }
  return O.none();
};

const inferStructSymbol = (callExpression: import("ts-morph").CallExpression): string =>
  pipe(
    O.fromNullishOr(callExpression.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)),
    O.map((declaration) => declaration.getName()),
    O.getOrElse(() => {
      const line = callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line;
      return `anonymous@${line}`;
    })
  );

const propertyNameText = (property: import("ts-morph").PropertyAssignment): O.Option<string> =>
  pipe(
    O.fromNullishOr(property.getNameNode()),
    O.map((nameNode) => Str.replace(/^["']|["']$/g, "")(nameNode.getText())),
    O.filter(Str.isNonEmpty)
  );

const fieldNameTokens: (fieldName: string) => ReadonlyArray<string> = flow(
  Str.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
  Str.replace(/[^A-Za-z0-9]+/g, " "),
  Str.trim,
  Str.split(/\s+/),
  A.map(Str.toLowerCase),
  A.filter(Str.isNonEmpty)
);

const isNumericDomainFieldName = (fieldName: string): boolean =>
  A.some(fieldNameTokens(fieldName), (token) =>
    A.some(NUMERIC_DOMAIN_TOKENS, (numericToken) => Str.Equivalence(token, numericToken))
  );

const isBroadNumberSchemaExpression = (initializer: Node): boolean => {
  const text = initializer.getText();
  if (/S\.(?:Finite|Int)\b|\.check\(/.test(text)) {
    return false;
  }
  return (
    text === "S.Number" ||
    text === "S.NumberFromString" ||
    Str.startsWith("S.Number.pipe(")(text) ||
    Str.startsWith("S.NumberFromString.pipe(")(text)
  );
};

const isSchemaFieldsObjectLiteral = (node: Node): boolean => {
  if (!Node.isObjectLiteralExpression(node)) {
    return false;
  }
  const parent = node.getParent();
  return Node.isCallExpression(parent) && SCHEMA_FIELDS_CALL_PATTERN.test(parent.getExpression().getText());
};

const inferSchemaContainerSymbol = (node: Node): string => {
  const classDeclaration = node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
  if (classDeclaration !== undefined) {
    return classDeclaration.getName() ?? "anonymous-class";
  }
  const variableDeclaration = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (variableDeclaration !== undefined) {
    return variableDeclaration.getName();
  }
  const line = node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line;
  return `anonymous@${line}`;
};

const numericDomainEntryFromProperty = (
  property: import("ts-morph").PropertyAssignment,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const parent = property.getParent();
  if (!isSchemaFieldsObjectLiteral(parent)) {
    return O.none();
  }

  const fieldName = propertyNameText(property);
  if (O.isNone(fieldName) || !isNumericDomainFieldName(fieldName.value)) {
    return O.none();
  }

  const initializer = property.getInitializer();
  if (initializer === undefined || !isBroadNumberSchemaExpression(initializer)) {
    return O.none();
  }

  const field = fieldName.value;
  const container = inferSchemaContainerSymbol(parent);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${container}.${field}`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-numeric-domain",
      line: property.getSourceFile().getLineAndColumnAtPos(property.getStart()).line,
      owner,
      reason: `Broad numeric schema field "${field}" should use S.Finite, S.Int, or a range check unless NaN and infinity are intentional.`,
    })
  );
};

const isBroadEmailSchemaExpression = (initializer: Node): boolean => {
  const text = initializer.getText();
  if (/\b(?:Email|ContactEmail)\b|S\.NonEmptyString\b|\.check\(/.test(text)) {
    return false;
  }
  return BROAD_EMAIL_SCHEMA_PATTERN.test(text);
};

const precisionAuditEntryFromProperty = (
  property: import("ts-morph").PropertyAssignment,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const parent = property.getParent();
  if (!isSchemaFieldsObjectLiteral(parent)) {
    return O.none();
  }

  const fieldName = propertyNameText(property);
  if (O.isNone(fieldName) || !Str.Equivalence(fieldName.value, "email")) {
    return O.none();
  }

  const initializer = property.getInitializer();
  if (initializer === undefined || !isBroadEmailSchemaExpression(initializer)) {
    return O.none();
  }

  const container = inferSchemaContainerSymbol(parent);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${container}.email`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-precision-audit",
      line: property.getSourceFile().getLineAndColumnAtPos(property.getStart()).line,
      owner,
      reason:
        'Broad string field "email" should use @beep/schema Email, a local precise email schema, or a documented external-protocol exception.',
    })
  );
};

const sourceHasStaticApiSchemaSignal = (sourceFile: import("ts-morph").SourceFile): boolean =>
  STATIC_API_SCHEMA_SIGNAL_PATTERN.test(sourceFile.getFullText());

const isSchemaDiscriminatorToken = (token: string): boolean =>
  A.some(SCHEMA_DISCRIMINATOR_TOKENS, (discriminatorToken) => Str.Equivalence(discriminatorToken, token));

const schemaDiscriminatorExpressionText = (expression: Node): O.Option<string> => {
  if (Node.isIdentifier(expression) && isSchemaDiscriminatorToken(expression.getText())) {
    return O.some(expression.getText());
  }
  if (Node.isPropertyAccessExpression(expression) && isSchemaDiscriminatorToken(expression.getName())) {
    return O.some(expression.getText());
  }
  return O.none();
};

const inferExecutableContainerSymbol = (node: Node): string => {
  const functionDeclaration = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
  if (functionDeclaration !== undefined) {
    return functionDeclaration.getName() ?? "anonymous-function";
  }
  const arrowFunction = node.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
  const arrowVariableDeclaration = arrowFunction?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (arrowVariableDeclaration !== undefined) {
    return arrowVariableDeclaration.getName();
  }
  const functionExpression = node.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
  const functionExpressionVariableDeclaration = functionExpression?.getFirstAncestorByKind(
    SyntaxKind.VariableDeclaration
  );
  if (functionExpressionVariableDeclaration !== undefined) {
    return functionExpressionVariableDeclaration.getName();
  }
  return inferSchemaContainerSymbol(node);
};

const staticApiEntryFromSwitch = (
  switchStatement: import("ts-morph").SwitchStatement,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> =>
  pipe(
    schemaDiscriminatorExpressionText(switchStatement.getExpression()),
    O.map((expressionText) => {
      const line = switchStatement.getSourceFile().getLineAndColumnAtPos(switchStatement.getStart()).line;
      return SchemaFirstInventoryEntry.make({
        file,
        symbol: `${inferExecutableContainerSymbol(switchStatement)}.switch(${expressionText})`,
        kind: "schema-policy-advisory",
        status: "advisory",
        ruleId: "SFV4-static-api",
        line,
        owner,
        reason: `Schema-modeled discriminator switch "${expressionText}" should use schema-derived .match/.guards or LiteralKit.$match when semantics match.`,
      });
    })
  );

const isJsonParseCallExpression = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
  return (
    Node.isPropertyAccessExpression(expression) &&
    expression.getExpression().getText() === "JSON" &&
    expression.getName() === "parse"
  );
};

const boundaryCodecEntryFromJsonParse = (
  callExpression: import("ts-morph").CallExpression,
  file: string,
  owner: string
): SchemaFirstInventoryEntry =>
  SchemaFirstInventoryEntry.make({
    file,
    symbol: `${inferExecutableContainerSymbol(callExpression)}.JSON.parse`,
    kind: "schema-policy-advisory",
    status: "advisory",
    ruleId: "SFV4-boundary-codec",
    line: callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line,
    owner,
    reason:
      "Direct JSON.parse boundary should use S.UnknownFromJsonString or S.fromJsonString(schema) so parsing and validation stay schema-owned.",
  });

/**
 * Function-like ts-morph node accepted by the fn-schema detectors: a named
 * function declaration or an exported arrow function.
 *
 * @category utilities
 * @since 0.0.0
 */
export type FunctionLikeDeclarationNode = import("ts-morph").FunctionDeclaration | import("ts-morph").ArrowFunction;

const sourceExportedArrowFunctions = (
  sourceFile: import("ts-morph").SourceFile
): ReadonlyArray<import("ts-morph").ArrowFunction> =>
  pipe(
    sourceFile.getVariableStatements(),
    A.filter((statement) => statement.isExported()),
    A.flatMap((statement) => statement.getDeclarations()),
    A.map((declaration) => O.fromNullishOr(declaration.getInitializer())),
    A.map(O.filter(Node.isArrowFunction)),
    A.getSomes
  );

const functionLikeSymbolName = (node: FunctionLikeDeclarationNode): string => {
  if (Node.isFunctionDeclaration(node)) {
    return node.getName() ?? "anonymous-function";
  }
  const variableDeclaration = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return variableDeclaration?.getName() ?? "anonymous-arrow";
};

const isInlineTypeLiteralNode = (typeNode: Node | undefined): boolean =>
  typeNode !== undefined && Node.isTypeLiteral(typeNode);

const sourceHasFnSchemaSignal = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return SCHEMA_FIELDS_CALL_PATTERN.test(text) || FN_CALL_SIGNAL_PATTERN.test(text);
};

const isFnSchemaEligibleFilePath = (filePath: string): boolean => !Str.endsWith(".tsx")(filePath);

/**
 * Detect an exported function or arrow function whose parameter or return
 * contract is an inline object type literal rather than a schema, within a
 * schema-modeled file. Generic declarations are conservatively skipped.
 *
 * @param node - Exported `FunctionDeclaration` or `ArrowFunction` candidate.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when an inline object contract is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { fnSchemaEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function updateWidget(input: { id: string; name: string }): void {}")
 * const [node] = sourceFile.getFunctions()
 * const entry = fnSchemaEntryFromFunctionLike(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("updateWidget")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const fnSchemaEntryFromFunctionLike = (
  node: FunctionLikeDeclarationNode,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  if (node.getTypeParameters().length > 0) {
    return O.none();
  }

  const hasInlineParameterTypeLiteral = A.some(node.getParameters(), (parameter) =>
    isInlineTypeLiteralNode(parameter.getTypeNode())
  );
  const hasInlineReturnTypeLiteral = isInlineTypeLiteralNode(node.getReturnTypeNode());
  if (!hasInlineParameterTypeLiteral && !hasInlineReturnTypeLiteral) {
    return O.none();
  }

  const name = functionLikeSymbolName(node);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: name,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-fn-schema",
      line: node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line,
      owner,
      reason: `Exported function "${name}" carries inline object contracts in a schema-modeled file; model them with Fn({ input, output }) from @beep/schema or an S.Class so the contract is executable.`,
    })
  );
};

/**
 * Detect an exported function or arrow function whose explicit return type
 * annotation includes `null` or `undefined` rather than an `O.Option`,
 * `Result`, `Effect`, or `Exit` return. Only explicit annotations are
 * inspected; inferred returns are out of scope. Generic declarations and
 * `.tsx` react boundary files are conservatively skipped by callers.
 *
 * @param node - Exported `FunctionDeclaration` or `ArrowFunction` candidate.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when a null/undefined return annotation is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { nullReturnEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function findUser(id: string): string | null {\n  return null\n}")
 * const [node] = sourceFile.getFunctions()
 * const entry = nullReturnEntryFromFunctionLike(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("findUser")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const nullReturnEntryFromFunctionLike = (
  node: FunctionLikeDeclarationNode,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  if (node.getTypeParameters().length > 0) {
    return O.none();
  }

  const returnTypeNode = node.getReturnTypeNode();
  if (returnTypeNode === undefined || !NULL_UNDEFINED_RETURN_PATTERN.test(returnTypeNode.getText())) {
    return O.none();
  }

  const name = functionLikeSymbolName(node);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: name,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-null-return",
      line: node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line,
      owner,
      reason: `Exported helper "${name}" declares a null/undefined return; return O.Option, Result, Effect, or Exit instead (3rd-party/react boundary returns are ledgered exceptions).`,
    })
  );
};

const isNullReturnEligibleFilePath = (filePath: string): boolean => !Str.endsWith(".tsx")(filePath);

const isNormalizationMethodName = (name: string): boolean =>
  A.some(NORMALIZATION_METHOD_NAMES, (methodName) => Str.Equivalence(methodName, name));

const sourceHasNormalizationSignal = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return SCHEMA_FIELDS_CALL_PATTERN.test(text) && NORMALIZATION_CALL_SIGNAL_PATTERN.test(text);
};

/**
 * Detect a zero-argument `.trim()`/`.toUpperCase()`/`.toLowerCase()` call made
 * inside a function body of a schema-modeled file. Such normalization belongs
 * in a schema transformation so the invariant travels with the data instead of
 * living in ad hoc imperative code.
 *
 * @param callExpression - Candidate call expression to inspect.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when a function-local normalization call is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { normalizationEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function normalizeName(name: string): string {\n  return name.trim()\n}")
 * const [node] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
 * const entry = normalizationEntryFromCallExpression(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("normalizeName.trim")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const normalizationEntryFromCallExpression = (
  callExpression: import("ts-morph").CallExpression,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const expression = callExpression.getExpression();
  if (
    !Node.isPropertyAccessExpression(expression) ||
    !isNormalizationMethodName(expression.getName()) ||
    callExpression.getArguments().length > 0 ||
    !isFunctionLocalNode(callExpression)
  ) {
    return O.none();
  }

  const methodName = expression.getName();
  const container = inferExecutableContainerSymbol(callExpression);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${container}.${methodName}`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-normalization",
      line: callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line,
      owner,
      reason: `Normalization call ".${methodName}()" inside a function body in a schema-modeled file should live in a schema transformation (S.decodeTo + SchemaTransformation, or SchemaGetter) so the invariant travels with the data.`,
    })
  );
};

const sourceHasGetSomesSignal = (sourceFile: import("ts-morph").SourceFile): boolean =>
  GETSOMES_CALL_SIGNAL_PATTERN.test(sourceFile.getFullText());

const isGetSomesObjectName = (name: string): boolean =>
  A.some(GETSOMES_OBJECT_NAMES, (objectName) => Str.Equivalence(objectName, name));

/**
 * Detect an `R.getSomes(...)`/`Record.getSomes(...)` call whose first argument
 * is an inline object literal, i.e. a heterogeneous Option-struct spread that
 * should preserve literal keys and per-key value types through
 * `O.getSomesStruct` instead. Calls over an identifier/variable argument (the
 * homogeneous dynamic-key dictionary case) are left alone.
 *
 * @param callExpression - Candidate call expression to inspect.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when an inline Option-struct literal is spread through `getSomes`, `O.none` otherwise.
 * @example
 * ```ts
 * import { getsomesStructEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function pickSomes() {\n  return R.getSomes({ a: 1, b: 2 })\n}")
 * const [node] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
 * const entry = getsomesStructEntryFromCallExpression(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("pickSomes.R.getSomes")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const getsomesStructEntryFromCallExpression = (
  callExpression: import("ts-morph").CallExpression,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const expression = callExpression.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "getSomes") {
    return O.none();
  }
  if (!isGetSomesObjectName(expression.getExpression().getText())) {
    return O.none();
  }
  const firstArgument = callExpression.getArguments()[0];
  if (firstArgument === undefined || !Node.isObjectLiteralExpression(firstArgument)) {
    return O.none();
  }

  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${inferExecutableContainerSymbol(callExpression)}.R.getSomes`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-getsomes-struct",
      line: callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line,
      owner,
      reason:
        "R.getSomes over an inline Option-struct literal should use O.getSomesStruct (@beep/utils) to preserve literal keys and per-key value types; R.getSomes remains for homogeneous dynamic-key dictionaries (Law 20/47 as amended 2026-07-05).",
    })
  );
};

const sourceHasDefaultsSchemaSignal = (sourceFile: import("ts-morph").SourceFile): boolean =>
  DEFAULTS_SCHEMA_SIGNAL_PATTERN.test(sourceFile.getFullText());

const isDefaultParameterName = (name: string): boolean =>
  A.some(DEFAULT_PARAMETER_NAMES, (parameterName) => Str.Equivalence(parameterName, name));

const isNonEmptyObjectLiteral = (node: Node): node is import("ts-morph").ObjectLiteralExpression =>
  Node.isObjectLiteralExpression(node) && node.getProperties().length > 0;

const defaultsEntryFromParameter = (
  parameter: import("ts-morph").ParameterDeclaration,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const initializer = parameter.getInitializer();
  if (initializer === undefined || !isNonEmptyObjectLiteral(initializer)) {
    return O.none();
  }

  const parameterName = parameter.getName();
  if (!isDefaultParameterName(parameterName)) {
    return O.none();
  }

  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${inferExecutableContainerSymbol(parameter)}.${parameterName}`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-defaults",
      line: parameter.getSourceFile().getLineAndColumnAtPos(parameter.getStart()).line,
      owner,
      reason: `Parameter default object for "${parameterName}" should move fallback values into schema defaults so construction, decoding, and tests share one source of truth.`,
    })
  );
};

const sourceHasEquivalenceSchemaSignal = (sourceFile: import("ts-morph").SourceFile): boolean =>
  EQUIVALENCE_SCHEMA_SIGNAL_PATTERN.test(sourceFile.getFullText());

const isSchemaDerivedEquivalenceExpression = (text: string): boolean => SCHEMA_DERIVED_EQUIVALENCE_PATTERN.test(text);

const hasManualEqualityComparison = (text: string): boolean => MANUAL_EQUALITY_COMPARISON_PATTERN.test(text);

const isExportedEqualsVariableDeclaration = (declaration: import("ts-morph").VariableDeclaration): boolean => {
  if (!Str.Equivalence(declaration.getName(), "equals")) {
    return false;
  }
  const variableStatement = declaration.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  return variableStatement?.isExported() ?? false;
};

const equivalenceEntryFromVariableDeclaration = (
  declaration: import("ts-morph").VariableDeclaration,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  if (!isExportedEqualsVariableDeclaration(declaration)) {
    return O.none();
  }

  const initializerText = declaration.getInitializer()?.getText() ?? "";
  if (isSchemaDerivedEquivalenceExpression(initializerText) || !hasManualEqualityComparison(initializerText)) {
    return O.none();
  }

  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: declaration.getName(),
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-equivalence",
      line: declaration.getSourceFile().getLineAndColumnAtPos(declaration.getStart()).line,
      owner,
      reason:
        'Exported schema-modeled equality helper "equals" should derive from S.toEquivalence(schema) unless comparison intentionally differs from schema semantics.',
    })
  );
};

/**
 * Grouped schema-first AST detectors consumed by the scan orchestrator.
 *
 * @example
 * ```ts
 * import { SchemaFirstDetectors } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export interface Widget { id: string }")
 * const [node] = sourceFile.getInterfaces()
 * console.log(O.isOption(SchemaFirstDetectors.detectInterfaceReason(node))) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const SchemaFirstDetectors = {
  boundaryCodecEntryFromJsonParse,
  defaultsEntryFromParameter,
  detectInterfaceReason,
  detectStructReason,
  detectTypeAliasReason,
  equivalenceEntryFromVariableDeclaration,
  fnSchemaEntryFromFunctionLike,
  getsomesStructEntryFromCallExpression,
  inferStructSymbol,
  isFnSchemaEligibleFilePath,
  isJsonParseCallExpression,
  isNullReturnEligibleFilePath,
  normalizationEntryFromCallExpression,
  nullReturnEntryFromFunctionLike,
  numericDomainEntryFromProperty,
  precisionAuditEntryFromProperty,
  sourceExportedArrowFunctions,
  sourceHasDefaultsSchemaSignal,
  sourceHasEquivalenceSchemaSignal,
  sourceHasFnSchemaSignal,
  sourceHasGetSomesSignal,
  sourceHasNormalizationSignal,
  sourceHasStaticApiSchemaSignal,
  staticApiEntryFromSwitch,
} as const;
