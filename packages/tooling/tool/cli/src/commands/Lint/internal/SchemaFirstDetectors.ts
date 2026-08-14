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
import { SchemaFirstInventoryEntry } from "../Lint.schemas.ts";
import type { InterfaceDeclaration, Type, TypeAliasDeclaration, TypeElementTypes } from "ts-morph";

const IDENTIFIER_PROPERTY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RUNTIME_HANDLE_TYPE_PATTERN =
  /^(?:(?:import\([^)]*\)|globalThis)\.)?(?:Layer\.Layer|Effect\.Effect|AbortSignal|AbortController|Zod[A-Za-z0-9_$]*|z\.[A-Za-z0-9_$]+|Atom\.[A-Za-z0-9_$]+|MutableHashMap\.[A-Za-z0-9_$]+|Queue\.[A-Za-z0-9_$]+|Ref\.[A-Za-z0-9_$]+|Stream\.[A-Za-z0-9_$]+|Stdio\.Stdio|(?:RpcClient|RpcServer)\.Protocol|NodeJS\.(?:Readable|Writable)Stream|StartedTestContainer|pulumi\.Input|WinkMethods|React(?:\.[A-Za-z0-9_$]+)?|ReactNode|JSX\.Element|d3\.Simulation(?:Link|Node)Datum|AstNode|MaybeNode|HTML[A-Za-z]*Element|WeakMap|WeakSet)(?:<.*>)?(?:\[[^\]]+\])?(?: \| (?:null|undefined))*$/;
const SCHEMA_REPRESENTABLE_CONTAINER_PATTERN =
  /^(?:(?:import\([^)]*\)|globalThis)\.)?(?:HashMap\.HashMap|HashSet\.HashSet|(?:O|Option)\.Option|(?:Readonly)?(?:Map|Set))(?:<|\b)/;
const NULLISH_DATA_TYPE_PATTERN = /^(?:null|undefined)$/;
const PRIMITIVE_DATA_TYPE_PATTERN =
  /^(?:any|bigint|boolean|never|null|number|string|symbol|undefined|unknown|void)(?:\b|$)/;
const RENDER_CONTRACT_PATTERN =
  /\bReact(?:\.|\b)|\bReactNode\b|\bJSX\.Element\b|\b[A-Za-z0-9_$]*(?:Component|Renderer)\b/;
const SCHEMA_VALUE_PATTERN =
  /\b(?:S|Schema)\.(?:Class|Struct|TaggedClass|TaggedStruct|Error|TaggedError|declare|decodeTo|transform)\b|\b(?:Field|LiteralKit|MappedLiteralKit)\s*\(/;
const SCHEMA_FIELDS_CALL_PATTERN = /\bS\.(?:Class|Struct|TaggedClass|TaggedStruct|Error|TaggedError)\b/;
const SCHEMA_CLASS_FIELDS_CALL_PATTERN = /\bS\.(?:Class|TaggedClass|Error|TaggedError)\b/;
const NUMERIC_DOMAIN_TOKENS = ["timeout", "count", "size", "rate", "limit", "ms", "seconds"] as const;
const STATIC_API_SCHEMA_SIGNAL_PATTERN = /\b(?:S\.(?:TaggedUnion|toTaggedUnion)|LiteralKit|MappedLiteralKit)\s*\(/;
const DEFAULTS_SCHEMA_SIGNAL_PATTERN =
  /\b(?:S\.(?:Class|Struct|TaggedClass|TaggedStruct|Error|TaggedError)|withConstructorDefault|withDecodingDefault|SchemaUtils\.withKeyDefaults)\b/;
const EQUIVALENCE_SCHEMA_SIGNAL_PATTERN =
  /\b(?:S\.(?:Class|Struct|TaggedClass|TaggedStruct|Error|TaggedError|toEquivalence|overrideToEquivalence)|SchemaUtils\.toEquivalence)\b/;
const FN_CALL_SIGNAL_PATTERN = /\bFn\s*\(/;
const NORMALIZATION_METHOD_NAMES = ["trim", "toUpperCase", "toLowerCase"] as const;
const NORMALIZATION_CALL_SIGNAL_PATTERN = /\.(?:trim|toUpperCase|toLowerCase)\(/;
const SCHEMA_BOUNDARY_CALL_PATTERN = /\b(?:S|Schema)\.(?:decode|encode|validate|asserts|is)[A-Za-z0-9_$]*\s*\(/;
const NULL_UNDEFINED_RETURN_PATTERN = /\bnull\b|\bundefined\b/;
const NULL_SAFE_RETURN_WRAPPER_PATTERN = /^(?:Effect\.Effect|(?:O|Option)\.Option|Result\.Result|Exit\.Exit)<.*>$/;
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

const nodesShareSymbolDeclaration = (left: Node, right: Node): boolean => {
  const rightDeclarations = right.getSymbol()?.getDeclarations() ?? [];
  return (
    rightDeclarations.length > 0 &&
    A.some(left.getSymbol()?.getDeclarations() ?? [], (leftDeclaration) => rightDeclarations.includes(leftDeclaration))
  );
};

const isSameExportedDeclaration = (node: Node, declaration: Node): boolean =>
  declaration.getSourceFile() === node.getSourceFile() &&
  (declaration === node || nodesShareSymbolDeclaration(declaration, node));

const declarationSymbol = (node: Node, declaredName: string | undefined): string =>
  declaredName !== undefined && Str.isNonEmpty(declaredName)
    ? declaredName
    : `default@${node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line}`;

const isEffectivelyExported = (node: Node, name: string): boolean => {
  const exportedDeclarations = node.getSourceFile().getExportedDeclarations();
  if (A.some(exportedDeclarations.get(name) ?? [], (declaration) => isSameExportedDeclaration(node, declaration))) {
    return true;
  }
  return A.some(A.fromIterable(exportedDeclarations.values()), (declarations) =>
    A.some(declarations, (declaration) => isSameExportedDeclaration(node, declaration))
  );
};

const isDataLikeMember = (member: Node): boolean => {
  if (isFunctionLikeMember(member)) {
    return false;
  }
  const typeNodeText = Node.isPropertySignature(member)
    ? member.getTypeNode()?.getText()
    : Node.isIndexSignatureDeclaration(member)
      ? member.getReturnTypeNode()?.getText()
      : undefined;
  if (typeNodeText !== undefined && RUNTIME_HANDLE_TYPE_PATTERN.test(typeNodeText)) {
    return false;
  }
  return Node.isPropertySignature(member) || Node.isIndexSignatureDeclaration(member);
};

const typeLiteralHasDataMember = (members: ReadonlyArray<Node>): boolean =>
  A.some(members, (member) => isDataLikeMember(member));

const dataLikeCollectionDecision = (type: Type, location: Node, depth: number): O.Option<boolean> => {
  if (type.isArray() || type.isReadonlyArray()) {
    const elementType = type.getArrayElementType();
    return O.some(elementType !== undefined && isDataLikeType(elementType, location, depth + 1));
  }
  if (type.isTuple()) {
    const elementTypes = type.getTupleElements();
    return O.some(
      elementTypes.length === 0 ||
        A.every(elementTypes, (elementType) => isDataLikeType(elementType, location, depth + 1))
    );
  }

  const typeText = type.getText(location);
  if (!SCHEMA_REPRESENTABLE_CONTAINER_PATTERN.test(typeText)) {
    return O.none();
  }
  const typeArguments = [...type.getAliasTypeArguments(), ...type.getTypeArguments()];
  return O.some(
    typeArguments.length > 0 &&
      A.every(typeArguments, (typeArgument) => isDataLikeType(typeArgument, location, depth + 1))
  );
};

const dataLikeCompositionDecision = (type: Type, location: Node, depth: number): O.Option<boolean> => {
  if (type.isUnion()) {
    const substantiveMembers = A.filter(
      type.getUnionTypes(),
      (member) => !NULLISH_DATA_TYPE_PATTERN.test(member.getText(location))
    );
    return O.some(
      substantiveMembers.length === 0 ||
        A.some(substantiveMembers, (member) => isDataLikeType(member, location, depth + 1))
    );
  }
  return type.isIntersection()
    ? O.some(A.some(type.getIntersectionTypes(), (member) => isDataLikeType(member, location, depth + 1)))
    : O.none();
};

const dataLikeRuntimeDecision = (type: Type, location: Node): O.Option<boolean> =>
  RUNTIME_HANDLE_TYPE_PATTERN.test(type.getText(location)) ? O.some(false) : O.none();

const dataLikeTerminalDecision = (type: Type, location: Node, depth: number): O.Option<boolean> => {
  const typeText = type.getText(location);
  if (
    typeText === "Uint8Array" ||
    PRIMITIVE_DATA_TYPE_PATTERN.test(typeText) ||
    type.isBooleanLiteral() ||
    type.isStringLiteral() ||
    type.isNumberLiteral()
  ) {
    return O.some(true);
  }
  if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) {
    return O.some(false);
  }
  return depth >= 4 ? O.some(true) : O.none();
};

const isDataLikeObjectType = (type: Type, location: Node, depth: number): boolean => {
  const indexTypes = [type.getStringIndexType(), type.getNumberIndexType()];
  if (A.some(indexTypes, (indexType) => indexType !== undefined)) {
    return A.every(
      indexTypes,
      (indexType) => indexType === undefined || isDataLikeType(indexType, location, depth + 1)
    );
  }

  const properties = type.getProperties();
  if (properties.length === 0) {
    return true;
  }
  return A.some(properties, (property) => isDataLikeProperty(property, location, depth + 1));
};

const isDataLikeType = (type: Type, location: Node, depth = 0): boolean =>
  pipe(
    O.firstSomeOf([
      dataLikeRuntimeDecision(type, location),
      dataLikeCollectionDecision(type, location, depth),
      dataLikeCompositionDecision(type, location, depth),
      dataLikeTerminalDecision(type, location, depth),
    ]),
    O.getOrElse(() => isDataLikeObjectType(type, location, depth))
  );

const isDataLikeProperty = (property: import("ts-morph").Symbol, location: Node, depth = 0): boolean => {
  const declarations = property.getDeclarations();
  const signatureDeclarations = A.filter(
    declarations,
    (declaration) =>
      Node.isPropertySignature(declaration) ||
      Node.isMethodSignature(declaration) ||
      Node.isIndexSignatureDeclaration(declaration)
  );
  if (signatureDeclarations.length > 0) {
    return A.some(
      signatureDeclarations,
      (declaration) =>
        isDataLikeMember(declaration) && isDataLikeType(property.getTypeAtLocation(declaration), declaration, depth + 1)
    );
  }
  return isDataLikeType(property.getTypeAtLocation(location), location, depth + 1);
};

const hasSameNameSchemaCompanion = (node: InterfaceDeclaration | TypeAliasDeclaration): boolean => {
  const sourceFile = node.getSourceFile();
  const name = node.getName();
  const sameNameSchemaValue = A.some(sourceFile.getVariableDeclarations(), (declaration) => {
    if (declaration.getName() !== name || !isEffectivelyExported(declaration, name)) {
      return false;
    }
    return SCHEMA_VALUE_PATTERN.test(declaration.getInitializer()?.getText() ?? "");
  });
  if (sameNameSchemaValue) {
    return true;
  }

  return A.some(sourceFile.getClasses(), (declaration) => {
    if (declaration.getName() !== name || !isEffectivelyExported(declaration, name)) {
      return false;
    }
    const heritage = declaration.getExtends();
    if (heritage === undefined) {
      return false;
    }
    if (SCHEMA_VALUE_PATTERN.test(heritage.getText())) {
      return true;
    }
    return A.some(
      heritage.getExpression().getSymbol()?.getDeclarations() ?? [],
      (baseDeclaration) =>
        Node.isVariableDeclaration(baseDeclaration) &&
        SCHEMA_VALUE_PATTERN.test(baseDeclaration.getInitializer()?.getText() ?? "")
    );
  });
};

const isRenderContract = (node: InterfaceDeclaration | TypeAliasDeclaration): boolean => {
  const sourceFile = node.getSourceFile();
  return (
    RENDER_CONTRACT_PATTERN.test(node.getText()) ||
    (Str.endsWith("Props")(node.getName()) && /(?:from\s+["']react["']|react)/i.test(sourceFile.getFullText()))
  );
};

const isInterfaceSchemaFirstCandidate = (node: InterfaceDeclaration): boolean => {
  if (node.getTypeParameters().length > 0 || isRenderContract(node) || hasSameNameSchemaCompanion(node)) {
    return false;
  }

  if (
    A.some(
      node.getProperties(),
      (property) => isDataLikeMember(property) && isDataLikeType(property.getType(), property)
    )
  ) {
    return true;
  }

  return (
    A.some(
      node.getIndexSignatures(),
      (signature) => isDataLikeMember(signature) && isDataLikeType(signature.getReturnType(), signature)
    ) || A.some(node.getExtends(), (heritage) => isDataLikeType(heritage.getType(), heritage))
  );
};

const isTypeAliasSchemaFirstCandidate = (node: TypeAliasDeclaration): boolean => {
  if (node.getTypeParameters().length > 0 || isRenderContract(node) || hasSameNameSchemaCompanion(node)) {
    return false;
  }
  const typeNode = node.getTypeNode();
  if (typeNode === undefined || typeNode.getKind() !== SyntaxKind.TypeLiteral) {
    return false;
  }
  const members = Node.isTypeLiteral(typeNode) ? typeNode.getMembers() : A.empty<TypeElementTypes>();
  if (!typeLiteralHasDataMember(members)) {
    return false;
  }
  return A.some(node.getType().getProperties(), (property) => isDataLikeProperty(property, node));
};

const isFunctionLocalNode = (node: Node): boolean =>
  node.getFirstAncestor(
    (ancestor) =>
      Node.isFunctionDeclaration(ancestor) ||
      Node.isFunctionExpression(ancestor) ||
      Node.isArrowFunction(ancestor) ||
      Node.isMethodDeclaration(ancestor)
  ) !== undefined;

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

const hasPlainIdentifierStructFields = (callExpression: import("ts-morph").CallExpression): boolean => {
  const firstArgument = callExpression.getArguments()[0];
  if (firstArgument === undefined || !Node.isObjectLiteralExpression(firstArgument)) {
    return false;
  }
  return A.every(firstArgument.getProperties(), (property) => {
    if (Node.isSpreadAssignment(property)) {
      return false;
    }
    const nameNode = "getNameNode" in property ? property.getNameNode() : undefined;
    if (nameNode === undefined) {
      return false;
    }
    const propertyName = Str.replace(/^["']|["']$/g, "")(nameNode.getText());
    return IDENTIFIER_PROPERTY_PATTERN.test(propertyName);
  });
};

const isDirectDefaultStructExport = (callExpression: import("ts-morph").CallExpression): boolean => {
  const exportAssignment = callExpression.getFirstAncestorByKind(SyntaxKind.ExportAssignment);
  return (
    exportAssignment !== undefined &&
    !exportAssignment.isExportEquals() &&
    exportAssignment.getExpression() === callExpression
  );
};

const isTopLevelExportedStructVariable = (callExpression: import("ts-morph").CallExpression): boolean => {
  const variableDeclaration = callExpression.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return (
    variableDeclaration !== undefined &&
    isEffectivelyExported(variableDeclaration, variableDeclaration.getName()) &&
    variableDeclaration.getVariableStatement()?.getParent() === callExpression.getSourceFile()
  );
};

const isStructSchemaFirstCandidate = (callExpression: import("ts-morph").CallExpression): boolean => {
  if (!hasPlainIdentifierStructFields(callExpression)) {
    return false;
  }
  if (
    callExpression.getFirstAncestorByKind(SyntaxKind.PropertyAssignment) !== undefined ||
    isStructFieldsInputForSchemaClass(callExpression) ||
    isFunctionLocalNode(callExpression)
  ) {
    return false;
  }
  return isDirectDefaultStructExport(callExpression) || isTopLevelExportedStructVariable(callExpression);
};

const inferStructSymbol = (callExpression: import("ts-morph").CallExpression): string =>
  pipe(
    O.fromNullishOr(callExpression.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)),
    O.map((declaration) => declaration.getName()),
    O.getOrElse(() => {
      const line = callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line;
      const exportAssignment = callExpression.getFirstAncestorByKind(SyntaxKind.ExportAssignment);
      return exportAssignment !== undefined && !exportAssignment.isExportEquals()
        ? `default@${line}`
        : `anonymous@${line}`;
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
      "Direct JSON.parse boundary should use S.fromJsonString(schema) so parsing and validation stay schema-owned.",
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
): ReadonlyArray<import("ts-morph").ArrowFunction> => {
  const variableArrows = pipe(
    sourceFile.getVariableDeclarations(),
    A.filter((declaration) => isEffectivelyExported(declaration, declaration.getName())),
    A.map((declaration) => O.fromNullishOr(declaration.getInitializer())),
    A.map(O.filter(Node.isArrowFunction)),
    A.getSomes
  );
  const defaultArrows = pipe(
    sourceFile.getExportAssignments(),
    A.filter((assignment) => !assignment.isExportEquals()),
    A.map((assignment) => assignment.getExpression()),
    A.filter(Node.isArrowFunction)
  );
  return [...variableArrows, ...defaultArrows];
};

const functionLikeSymbolName = (node: FunctionLikeDeclarationNode): string => {
  if (Node.isFunctionDeclaration(node)) {
    return declarationSymbol(node, node.getName());
  }
  const variableDeclaration = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return declarationSymbol(node, variableDeclaration?.getName());
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
 * **Example** (Detect inline object contract)
 *
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
 *
 * @param node - Exported `FunctionDeclaration` or `ArrowFunction` candidate.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when an inline object contract is found, `O.none` otherwise.
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
 * **Example** (Detect null return annotation)
 *
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
 *
 * @param node - Exported `FunctionDeclaration` or `ArrowFunction` candidate.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when a null/undefined return annotation is found, `O.none` otherwise.
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
  if (returnTypeNode === undefined) {
    return O.none();
  }
  const returnTypeText = returnTypeNode.getText();
  if (!NULL_UNDEFINED_RETURN_PATTERN.test(returnTypeText) || NULL_SAFE_RETURN_WRAPPER_PATTERN.test(returnTypeText)) {
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
  return SCHEMA_BOUNDARY_CALL_PATTERN.test(text) && NORMALIZATION_CALL_SIGNAL_PATTERN.test(text);
};

const executableContainer = (node: Node): Node | undefined =>
  node.getFirstAncestor(
    (ancestor) =>
      Node.isFunctionDeclaration(ancestor) ||
      Node.isArrowFunction(ancestor) ||
      Node.isFunctionExpression(ancestor) ||
      Node.isMethodDeclaration(ancestor)
  );

const isExportedFunctionExecutable = (container: import("ts-morph").FunctionDeclaration): boolean => {
  const name = container.getName();
  return name !== undefined && isEffectivelyExported(container, name);
};

const isExportedMethodExecutable = (container: import("ts-morph").MethodDeclaration): boolean => {
  if (container.hasModifier(SyntaxKind.PrivateKeyword) || container.hasModifier(SyntaxKind.ProtectedKeyword)) {
    return false;
  }
  const classDeclaration = container.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
  const className = classDeclaration?.getName();
  return (
    classDeclaration !== undefined && className !== undefined && isEffectivelyExported(classDeclaration, className)
  );
};

const isExportedVariableExecutable = (container: Node): boolean => {
  const declaration = container.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return declaration !== undefined && isEffectivelyExported(declaration, declaration.getName());
};

const isInExportedExecutable = (node: Node): boolean => {
  const container = executableContainer(node);
  if (container === undefined) {
    return false;
  }
  if (Node.isFunctionDeclaration(container)) {
    return isExportedFunctionExecutable(container);
  }
  if (Node.isMethodDeclaration(container)) {
    return isExportedMethodExecutable(container);
  }
  return isExportedVariableExecutable(container);
};

const isInSchemaBoundaryExecutable = (node: Node): boolean => {
  const container = executableContainer(node);
  return container !== undefined && SCHEMA_BOUNDARY_CALL_PATTERN.test(container.getText());
};

/**
 * Detect a zero-argument `.trim()`/`.toUpperCase()`/`.toLowerCase()` call made
 * inside the same exported executable as a schema boundary call. Such
 * normalization belongs in a schema transformation so the invariant travels
 * with the decoded data instead of living beside the schema boundary.
 *
 * **Example** (Detect ad hoc normalization)
 *
 * ```ts
 * import { normalizationEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile(
 *   "fixture.ts",
 *   "export function normalizeName(input: unknown): string {\n  return S.decodeUnknownSync(Name)(input).trim()\n}"
 * )
 * const [node] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
 * const entry = normalizationEntryFromCallExpression(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("normalizeName.trim")
 * ```
 *
 * @param callExpression - Candidate call expression to inspect.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` when exported schema-boundary code performs ad hoc normalization, `O.none` otherwise.
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
    !isFunctionLocalNode(callExpression) ||
    !isInExportedExecutable(callExpression) ||
    !isInSchemaBoundaryExecutable(callExpression)
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
 * **Example** (Detect getSomes struct literal)
 *
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
 *
 * @param callExpression - Candidate call expression to inspect.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when an inline Option-struct literal is spread through `getSomes`, `O.none` otherwise.
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
  return isEffectivelyExported(declaration, declaration.getName());
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
 * **Example** (Check interface schema candidate)
 *
 * ```ts
 * import { SchemaFirstDetectors } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export interface Widget { id: string }")
 * const [node] = sourceFile.getInterfaces()
 * console.log(SchemaFirstDetectors.isInterfaceSchemaFirstCandidate(node)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const SchemaFirstDetectors = {
  boundaryCodecEntryFromJsonParse,
  defaultsEntryFromParameter,
  equivalenceEntryFromVariableDeclaration,
  fnSchemaEntryFromFunctionLike,
  getsomesStructEntryFromCallExpression,
  declarationSymbol,
  inferStructSymbol,
  isEffectivelyExported,
  isFnSchemaEligibleFilePath,
  isInterfaceSchemaFirstCandidate,
  isJsonParseCallExpression,
  isNullReturnEligibleFilePath,
  isStructSchemaFirstCandidate,
  isTypeAliasSchemaFirstCandidate,
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
