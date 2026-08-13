/**
 * Non-executing command-surface reader for knowledge semantic-delta provenance.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import { Effect, FileSystem, HashSet, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  InMemoryFileSystemHost,
  ModuleKind,
  ModuleResolutionKind,
  Node,
  Project,
  ScriptTarget,
  SyntaxKind,
} from "ts-morph";
import { KnowledgeOperationalError } from "./Knowledge.errors.ts";
import type {
  ArrowFunction,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Node as MorphNode,
  ParameterDeclaration,
  SourceFile,
} from "ts-morph";

const $I = $RepoCliId.create("commands/Knowledge/Knowledge.command-surface");

const COMMAND_SOURCE_ROOT = "packages/tooling/tool/cli/src/commands";
const ROOT_COMMAND_SOURCE = `${COMMAND_SOURCE_ROOT}/Root.ts`;
const STATIC_PROJECT_ROOT = "/repo";
const STATIC_COMMAND_SOURCE_ROOT = `${STATIC_PROJECT_ROOT}/${COMMAND_SOURCE_ROOT}`;
const STATIC_ROOT_COMMAND_SOURCE = `${STATIC_PROJECT_ROOT}/${ROOT_COMMAND_SOURCE}`;

const StaticCommandAlias = S.NullOr(S.String).pipe(
  $I.annoteSchema("StaticCommandAlias", {
    description: "Optional alternate spelling extracted from one command declaration.",
  })
);

class StaticCommandNode extends S.Class<StaticCommandNode>($I`StaticCommandNode`)(
  {
    name: S.String,
    alias: StaticCommandAlias,
    children: S.Array(S.suspend((): S.Codec<StaticCommandNode> => StaticCommandNode)),
  },
  $I.annote("StaticCommandNode", {
    description: "One non-executing projection of a CLI command and its ordered descendants.",
  })
) {}

const StaticCommandNodeJson = S.fromJsonString(StaticCommandNode);
const decodeStaticCommandNodeJson = S.decodeUnknownEffect(StaticCommandNodeJson);
const staticCommandNodeEquivalent = S.toEquivalence(StaticCommandNode);
const isKnowledgeOperationalError = S.is(KnowledgeOperationalError);

type LiteralBindings = ReadonlyMap<string, string>;

const failStatic = (category: string): never => {
  throw KnowledgeOperationalError.make({
    message: `Failed to statically derive command surface provenance: ${category}.`,
  });
};

const insideStaticCommandCorpus = (sourceFile: SourceFile): boolean =>
  Str.startsWith(`${STATIC_COMMAND_SOURCE_ROOT}/`)(sourceFile.getFilePath());

const requireInsideStaticCommandCorpus = <A extends MorphNode>(node: A): A =>
  insideStaticCommandCorpus(node.getSourceFile()) ? node : failStatic("a definition escaped the command source corpus");

const unwrapExpression = (input: Expression): Expression => {
  let expression = input;
  while (
    Node.isAsExpression(expression) ||
    Node.isParenthesizedExpression(expression) ||
    Node.isSatisfiesExpression(expression) ||
    Node.isNonNullExpression(expression)
  ) {
    expression = expression.getExpression();
  }
  return expression;
};

const definitionNodes = (identifier: Identifier): ReadonlyArray<MorphNode> =>
  A.map(identifier.getDefinitions(), (definition) => requireInsideStaticCommandCorpus(definition.getNode()));

const exactlyOneDefinition = (identifier: Identifier): MorphNode => {
  const definitions = definitionNodes(identifier);
  return A.length(definitions) === 1
    ? definitions[0]!
    : failStatic("a command identifier did not have exactly one definition");
};

const variableInitializer = (identifier: Identifier): Expression => {
  const node = exactlyOneDefinition(identifier);
  const declaration = Node.isVariableDeclaration(node)
    ? node
    : node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const initializer = declaration?.getInitializer();
  return initializer === undefined
    ? failStatic("a command identifier did not have a variable initializer")
    : initializer;
};

const parameterKey = (input: ParameterDeclaration): string =>
  `${input.getSourceFile().getFilePath()}:${input.getStart()}`;

const boundString = (input: MorphNode, bindings: LiteralBindings): O.Option<string> => {
  if (Node.isStringLiteral(input) || Node.isNoSubstitutionTemplateLiteral(input)) {
    return O.some(input.getLiteralValue());
  }
  if (!Node.isIdentifier(input)) {
    return O.none();
  }
  const definitions = definitionNodes(input);
  if (A.length(definitions) !== 1) {
    return O.none();
  }
  const node = definitions[0]!;
  const parameter = Node.isParameterDeclaration(node) ? node : node.getFirstAncestorByKind(SyntaxKind.Parameter);
  return parameter === undefined ? O.none() : O.fromUndefinedOr(bindings.get(parameterKey(parameter)));
};

const bindingDeclarations = (identifier: Identifier): ReadonlyArray<MorphNode> =>
  pipe(
    O.fromNullishOr(identifier.getSymbol()),
    O.map((symbol) => A.map(symbol.getDeclarations(), requireInsideStaticCommandCorpus)),
    O.getOrElse(A.empty<MorphNode>)
  );

const exactlyOneBindingDeclaration = (identifier: Identifier): MorphNode => {
  const declarations = bindingDeclarations(identifier);
  return A.length(declarations) === 1
    ? declarations[0]!
    : failStatic("a trusted helper did not have exactly one lexical binding");
};

const isNamedImport = (identifier: Identifier, importedName: string, moduleSpecifier: string): boolean => {
  if (!Str.equivalence(identifier.getText(), importedName)) {
    return false;
  }
  const node = exactlyOneBindingDeclaration(identifier);
  if (!Node.isImportSpecifier(node)) {
    return false;
  }
  const sourceName = node.getNameNode().getText();
  const localName = node.getAliasNode()?.getText() ?? sourceName;
  return (
    Str.equivalence(localName, identifier.getText()) &&
    Str.equivalence(sourceName, importedName) &&
    Str.equivalence(node.getImportDeclaration().getModuleSpecifierValue(), moduleSpecifier)
  );
};

const isImportedBindingMember = (
  expression: Expression,
  bindingName: string,
  memberName: string,
  moduleSpecifier: string,
  importedName = bindingName
): boolean => {
  if (!Node.isPropertyAccessExpression(expression) || !Str.equivalence(expression.getName(), memberName)) {
    return false;
  }
  const target = expression.getExpression();
  if (!Node.isIdentifier(target) || !Str.equivalence(target.getText(), bindingName)) {
    return false;
  }
  const node = exactlyOneBindingDeclaration(target);
  if (Node.isNamespaceImport(node)) {
    const importDeclaration = node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
    return (
      importDeclaration !== undefined &&
      Str.equivalence(node.getName(), target.getText()) &&
      Str.equivalence(importDeclaration.getModuleSpecifierValue(), moduleSpecifier)
    );
  }
  const sourceName = Node.isImportSpecifier(node) ? node.getNameNode().getText() : "";
  const localName = Node.isImportSpecifier(node) ? (node.getAliasNode()?.getText() ?? sourceName) : "";
  return (
    Node.isImportSpecifier(node) &&
    Str.equivalence(localName, target.getText()) &&
    Str.equivalence(sourceName, importedName) &&
    Str.equivalence(node.getImportDeclaration().getModuleSpecifierValue(), moduleSpecifier)
  );
};

const isCommandMember = (expression: Expression, memberName: string): boolean =>
  isImportedBindingMember(expression, "Command", memberName, "effect/unstable/cli");

const isArrayMake = (expression: Expression): boolean =>
  isImportedBindingMember(expression, "A", "make", "effect/Array") ||
  isImportedBindingMember(expression, "A", "make", "@beep/utils");

const staticNode = (
  name: string,
  alias: string | null = null,
  children: ReadonlyArray<StaticCommandNode> = A.empty()
): StaticCommandNode => StaticCommandNode.make({ name, alias, children });

const validatedChildren = (children: ReadonlyArray<StaticCommandNode>): ReadonlyArray<StaticCommandNode> => {
  let spellings = HashSet.empty<string>();
  for (const child of children) {
    if (Str.isEmpty(child.name) || HashSet.has(spellings, child.name)) {
      return failStatic("sibling commands contain an empty or duplicate name");
    }
    spellings = HashSet.add(spellings, child.name);
    if (child.alias !== null) {
      if (Str.isEmpty(child.alias) || HashSet.has(spellings, child.alias)) {
        return failStatic("sibling commands contain an empty or colliding alias");
      }
      spellings = HashSet.add(spellings, child.alias);
    }
  }
  return children;
};

const listExpressions = (
  input: Expression,
  bindings: LiteralBindings,
  seen: ReadonlySet<string>
): ReadonlyArray<Expression> => {
  const expression = unwrapExpression(input);
  if (Node.isArrayLiteralExpression(expression)) {
    let values = A.empty<Expression>();
    for (const element of expression.getElements()) {
      if (Node.isOmittedExpression(element)) {
        failStatic("a command list contains an omitted member");
      } else if (Node.isSpreadElement(element)) {
        values = A.appendAll(values, listExpressions(element.getExpression(), bindings, seen));
      } else if (Node.isExpression(element)) {
        values = A.append(values, element);
      } else {
        failStatic("a command list contains an unsupported member");
      }
    }
    return values;
  }
  if (Node.isCallExpression(expression) && isArrayMake(expression.getExpression())) {
    const arguments_ = expression.getArguments();
    if (!A.every(arguments_, Node.isExpression)) {
      return failStatic("an effect Array command list contains a non-expression member");
    }
    return arguments_;
  }
  if (Node.isIdentifier(expression)) {
    const key = `${expression.getSourceFile().getFilePath()}:${expression.getStart()}`;
    if (seen.has(key)) {
      return failStatic("the command list declarations contain a cycle");
    }
    return listExpressions(variableInitializer(expression), bindings, new Set([...seen, key]));
  }
  return failStatic("a command list uses an unsupported expression");
};

const functionDeclarationForCall = (call: CallExpression): FunctionDeclaration | ArrowFunction | FunctionExpression => {
  const callee = call.getExpression();
  if (!Node.isIdentifier(callee)) {
    return failStatic("a command factory uses an unsupported callee");
  }
  const node = exactlyOneDefinition(callee);
  if (Node.isFunctionDeclaration(node)) {
    return node;
  }
  const declaration = Node.isVariableDeclaration(node)
    ? node
    : node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const initializer = declaration?.getInitializer();
  return initializer !== undefined && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    ? initializer
    : failStatic("a command factory binding is not a function declaration");
};

const directFunctionReturn = (functionLike: FunctionDeclaration | ArrowFunction | FunctionExpression): Expression => {
  const body = functionLike.getBody();
  if (body === undefined) {
    return failStatic("a command factory has no body");
  }
  if (Node.isExpression(body)) {
    return body;
  }
  if (!Node.isBlock(body)) {
    return failStatic("a command factory uses an unsupported body");
  }
  const statements = body.getStatements();
  if (A.length(statements) !== 1 || !Node.isReturnStatement(statements[0])) {
    return failStatic("a command factory is not a concise expression or one direct return");
  }
  const returned = statements[0].getExpression();
  return returned === undefined ? failStatic("a command factory returns no expression") : returned;
};

const commandChildren = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: ReadonlySet<string>
): ReadonlyArray<StaticCommandNode> => {
  const argument = call.getArguments()[0];
  if (argument === undefined || !Node.isExpression(argument)) {
    return failStatic("Command.withSubcommands lacks a command-list expression");
  }
  if (A.length(call.getArguments()) !== 1) {
    return failStatic("Command.withSubcommands has an unexpected argument count");
  }
  return A.map(listExpressions(argument, bindings, seen), (child) => evaluateCommandExpression(child, bindings, seen));
};

const surfaceNeutralCommandTransforms = new Set([
  "provide",
  "withDescription",
  "withShortDescription",
  "withExamples",
  "withHandler",
  "withAnnotations",
  "withUnlisted",
]);

const applyCommandTransform = (
  node: StaticCommandNode,
  transform: Expression,
  bindings: LiteralBindings,
  seen: ReadonlySet<string>
): StaticCommandNode => {
  if (!Node.isCallExpression(transform)) {
    return failStatic("a command transform is not a call expression");
  }
  const callee = transform.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || !Node.isIdentifier(callee.getExpression())) {
    return failStatic("a command transform uses an unsupported expression");
  }
  const memberName = callee.getName();
  if (!isCommandMember(callee, memberName)) {
    return failStatic("a command transform lacks Effect CLI provenance");
  }
  if (Str.equivalence(memberName, "withSubcommands")) {
    return StaticCommandNode.make({
      ...node,
      children: validatedChildren(commandChildren(transform, bindings, seen)),
    });
  }
  if (Str.equivalence(memberName, "withAlias")) {
    const argument = transform.getArguments()[0];
    if (argument === undefined || A.length(transform.getArguments()) !== 1) {
      return failStatic("Command.withAlias lacks exactly one string argument");
    }
    const alias = O.getOrElse(boundString(argument, bindings), () =>
      failStatic("Command.withAlias is not a bound string literal")
    );
    return StaticCommandNode.make({ ...node, alias });
  }
  return surfaceNeutralCommandTransforms.has(memberName)
    ? node
    : failStatic("an unsupported Effect CLI command transform changes the command declaration");
};

const evaluateCommandFactory = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: ReadonlySet<string>
): StaticCommandNode => {
  const functionLike = functionDeclarationForCall(call);
  const factoryKey = `${functionLike.getSourceFile().getFilePath()}:${functionLike.getStart()}`;
  if (seen.has(factoryKey)) {
    return failStatic("the command factory declarations contain a cycle");
  }
  const parameters = functionLike.getParameters();
  const arguments_ = call.getArguments();
  if (A.length(parameters) !== A.length(arguments_)) {
    return failStatic("command factory arguments do not exactly match its parameters");
  }
  const nextBindings = new Map(bindings);
  for (let index = 0; index < A.length(parameters); index += 1) {
    const argument = arguments_[index]!;
    const value = O.getOrElse(boundString(argument, bindings), () =>
      failStatic("command factory arguments are not bound string literals")
    );
    nextBindings.set(parameterKey(parameters[index]!), value);
  }
  return evaluateCommandExpression(directFunctionReturn(functionLike), nextBindings, new Set([...seen, factoryKey]));
};

const evaluatePipeCall = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: ReadonlySet<string>
): StaticCommandNode => {
  const arguments_ = call.getArguments();
  const first = arguments_[0];
  if (first === undefined || !Node.isExpression(first)) {
    return failStatic("an effect pipe command expression has no base command");
  }
  let node = evaluateCommandExpression(first, bindings, seen);
  for (const transform of A.drop(arguments_, 1)) {
    if (!Node.isExpression(transform)) {
      return failStatic("an effect pipe command expression contains a non-expression transform");
    }
    node = applyCommandTransform(node, transform, bindings, seen);
  }
  return node;
};

const evaluateMethodPipeCall = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: ReadonlySet<string>
): StaticCommandNode => {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || !Str.equivalence(callee.getName(), "pipe")) {
    return failStatic("a command call uses an unsupported method");
  }
  let node = evaluateCommandExpression(callee.getExpression(), bindings, seen);
  for (const transform of call.getArguments()) {
    if (!Node.isExpression(transform)) {
      return failStatic("a command pipe contains a non-expression transform");
    }
    node = applyCommandTransform(node, transform, bindings, seen);
  }
  return node;
};

const evaluateCommandExpression = (
  input: Expression,
  bindings: LiteralBindings = new Map(),
  seen: ReadonlySet<string> = new Set()
): StaticCommandNode => {
  const expression = unwrapExpression(input);
  requireInsideStaticCommandCorpus(expression);
  if (Node.isIdentifier(expression)) {
    const key = `${expression.getSourceFile().getFilePath()}:${expression.getStart()}`;
    if (seen.has(key)) {
      return failStatic("the command declarations contain a cycle");
    }
    return evaluateCommandExpression(variableInitializer(expression), bindings, new Set([...seen, key]));
  }
  if (!Node.isCallExpression(expression)) {
    return failStatic("a command declaration uses an unsupported expression");
  }
  const callee = expression.getExpression();
  if (isCommandMember(callee, "make")) {
    const nameArgument = expression.getArguments()[0];
    if (nameArgument === undefined) {
      return failStatic("Command.make lacks a command name");
    }
    const name = O.getOrElse(boundString(nameArgument, bindings), () =>
      failStatic("Command.make name is not a bound string literal")
    );
    return staticNode(name);
  }
  if (
    Node.isIdentifier(callee) &&
    (isNamedImport(callee, "pipe", "effect") || isNamedImport(callee, "pipe", "@beep/utils"))
  ) {
    return evaluatePipeCall(expression, bindings, seen);
  }
  if (Node.isPropertyAccessExpression(callee) && Str.equivalence(callee.getName(), "pipe")) {
    return evaluateMethodPipeCall(expression, bindings, seen);
  }
  if (Node.isIdentifier(callee)) {
    return evaluateCommandFactory(expression, bindings, seen);
  }
  return failStatic("a command declaration uses an unsupported call");
};

const commandSourceFiles = Effect.fn("Knowledge.commandSourceFiles")(function* (checkoutRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceRoot = path.join(checkoutRoot, COMMAND_SOURCE_ROOT);
  const names = yield* fs
    .readDirectory(sourceRoot, { recursive: true })
    .pipe(
      Effect.mapError(() =>
        KnowledgeOperationalError.make({ message: "Failed to enumerate command surface source data." })
      )
    );
  const sourceNames = pipe(
    names,
    A.map((name) => path.join(sourceRoot, name)),
    A.filter((filePath) => Str.endsWith(".ts")(filePath) || Str.endsWith(".tsx")(filePath)),
    A.sort(Order.String)
  );
  return yield* Effect.forEach(sourceNames, (filePath) =>
    Effect.gen(function* () {
      const info = yield* fs
        .stat(filePath)
        .pipe(
          Effect.mapError(() =>
            KnowledgeOperationalError.make({ message: "Failed to inspect command surface source data." })
          )
        );
      if (info.type !== "File") {
        return O.none<readonly [string, string]>();
      }
      const text = yield* fs
        .readFileString(filePath)
        .pipe(
          Effect.mapError(() =>
            KnowledgeOperationalError.make({ message: "Failed to read command surface source data." })
          )
        );
      return O.some([path.relative(checkoutRoot, filePath), text] as const);
    })
  ).pipe(Effect.map(A.getSomes));
});

const buildStaticCommandTree = Effect.fn("Knowledge.buildStaticCommandTree")(function* (checkoutRoot: string) {
  const sources = yield* commandSourceFiles(checkoutRoot);
  return yield* Effect.try({
    try: () => {
      const host = new InMemoryFileSystemHost();
      for (const [repoPath, text] of sources) {
        host.writeFileSync(`${STATIC_PROJECT_ROOT}/${repoPath}`, text);
      }
      const project = new Project({
        fileSystem: host,
        compilerOptions: {
          module: ModuleKind.NodeNext,
          moduleResolution: ModuleResolutionKind.NodeNext,
          target: ScriptTarget.ESNext,
        },
        skipAddingFilesFromTsConfig: true,
        skipLoadingLibFiles: true,
      });
      project.addSourceFilesAtPaths(`${STATIC_COMMAND_SOURCE_ROOT}/**/*.{ts,tsx}`);
      const rootSource = project.getSourceFileOrThrow(STATIC_ROOT_COMMAND_SOURCE);
      return evaluateCommandExpression(rootSource.getVariableDeclarationOrThrow("rootCommand").getInitializerOrThrow());
    },
    catch: (cause) =>
      isKnowledgeOperationalError(cause)
        ? cause
        : KnowledgeOperationalError.make({ message: "Failed to statically derive command surface provenance." }),
  });
});

const commandTreeProbeSource = (rootCommandModule: string): string => `
import { rootCommand } from ${JSON.stringify(rootCommandModule)}
const project = (command) => ({
  name: command.name,
  alias: command.alias ?? null,
  children: command.subcommands.flatMap((group) => group.commands).map(project),
})
process.stdout.write(JSON.stringify(project(rootCommand)))
`;

const decodeCurrentCommandTree = (output: string): Effect.Effect<StaticCommandNode, KnowledgeOperationalError> =>
  decodeStaticCommandNodeJson(output).pipe(
    Effect.mapError(() =>
      KnowledgeOperationalError.make({ message: "Current-checkout command surface probe emitted malformed output." })
    )
  );

const resolveStaticCommand = (
  root: StaticCommandNode,
  words: ReadonlyArray<string>
): readonly ["resolved" | "unknown", ReadonlyArray<string>] => {
  let command = root;
  let canonicalPath = A.empty<string>();
  for (const word of words) {
    if (A.length(command.children) === 0 || Str.startsWith("-")(word)) {
      break;
    }
    const child = A.findFirst(
      command.children,
      (candidate) => Str.equivalence(candidate.name, word) || O.contains(O.fromNullOr(candidate.alias), word)
    );
    if (O.isNone(child)) {
      return ["unknown", A.append(canonicalPath, word)];
    }
    canonicalPath = A.append(canonicalPath, child.value.name);
    command = child.value;
  }
  return ["resolved", canonicalPath];
};

/**
 * Source-only command-surface operations used by the semantic-delta archive oracle.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const KnowledgeCommandSurface = {
  buildStaticCommandTree,
  commandTreeProbeSource,
  decodeCurrentCommandTree,
  resolveStaticCommand,
  staticCommandNodeEquivalent,
} as const;

/**
 * Recursive command tree derived without executing checkout-owned modules.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type KnowledgeStaticCommandTree = StaticCommandNode;
