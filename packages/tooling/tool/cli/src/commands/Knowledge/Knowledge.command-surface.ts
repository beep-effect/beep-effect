/**
 * Non-executing command-surface reader for knowledge semantic-delta provenance.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
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
  ArrayLiteralExpression,
  ArrowFunction,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Node as MorphNode,
  ParameterDeclaration,
  PropertyAccessExpression,
  SourceFile,
} from "ts-morph";

const $I = $RepoCliId.create("commands/Knowledge/Knowledge.command-surface");

const COMMAND_SOURCE_ROOT = "packages/tooling/tool/cli/src/commands";
const ROOT_COMMAND_SOURCE = `${COMMAND_SOURCE_ROOT}/Root.ts`;
const STATIC_PROJECT_ROOT = "/repo";
const STATIC_COMMAND_SOURCE_ROOT = `${STATIC_PROJECT_ROOT}/${COMMAND_SOURCE_ROOT}`;
const STATIC_ROOT_COMMAND_SOURCE = `${STATIC_PROJECT_ROOT}/${ROOT_COMMAND_SOURCE}`;
// Shared flag declarations commands import; read as source like the command corpus, never executed.
const SHARED_FLAG_SOURCE = "packages/tooling/tool/cli/src/internal/cli/Flags.ts";
const STATIC_SHARED_FLAG_SOURCE = `${STATIC_PROJECT_ROOT}/${SHARED_FLAG_SOURCE}`;

const StaticCommandAlias = S.NullOr(S.String).pipe(
  $I.annoteSchema("StaticCommandAlias", {
    description: "Optional alternate spelling extracted from one command declaration.",
  })
);

/**
 * One declared Effect CLI flag read statically from command source.
 *
 * **Details**
 *
 * `aliases` are stored without leading dashes, exactly as Effect CLI normalizes them, and
 * `negatable` is true for boolean flags, whose `--no-<name>` spelling also parses.
 *
 * **Example** (Describe the standard JSON switch)
 *
 * ```ts
 * import { KnowledgeStaticCommandFlag } from "@beep/repo-cli/commands/Knowledge/Knowledge.command-surface"
 *
 * const json = KnowledgeStaticCommandFlag.make({ name: "json", aliases: [], negatable: true })
 *
 * console.log(json.negatable) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class KnowledgeStaticCommandFlag extends S.Class<KnowledgeStaticCommandFlag>($I`KnowledgeStaticCommandFlag`)(
  {
    name: S.String,
    aliases: S.Array(S.String),
    negatable: S.Boolean,
  },
  $I.annote("KnowledgeStaticCommandFlag", {
    description:
      "One declared Effect CLI flag: its canonical name, dash-free aliases, and whether a boolean `--no-` form parses.",
  })
) {}

class StaticCommandNode extends S.Class<StaticCommandNode>($I`StaticCommandNode`)(
  {
    name: S.String,
    alias: StaticCommandAlias,
    children: S.Array(S.suspend((): S.Codec<StaticCommandNode> => StaticCommandNode)),
    options: KnowledgeStaticCommandFlag.pipe(S.Array, S.optionalKey),
  },
  $I.annote("StaticCommandNode", {
    description: "One non-executing projection of a CLI command and its ordered descendants.",
  })
) {}

const StaticCommandNodeJson = S.fromJsonString(StaticCommandNode);
const decodeStaticCommandNodeJson = S.decodeUnknownEffect(StaticCommandNodeJson);
const commandNodeEquivalent = S.toEquivalence(StaticCommandNode);

// The command surface is names, aliases, and descendants. Declared options ride on the same node but
// only the static reader derives them (the runtime projection has no public flag accessor), so the
// static/live parity check compares the option-free projection.
const commandSurfaceProjection = (node: StaticCommandNode): StaticCommandNode =>
  StaticCommandNode.make({
    name: node.name,
    alias: node.alias,
    children: A.map(node.children, commandSurfaceProjection),
  });

const staticCommandNodeEquivalent = (self: StaticCommandNode, that: StaticCommandNode): boolean =>
  commandNodeEquivalent(commandSurfaceProjection(self), commandSurfaceProjection(that));
const isKnowledgeOperationalError = S.is(KnowledgeOperationalError);

type LiteralBindings = HashMap.HashMap<string, string>;
type StaticTraversal = HashSet.HashSet<string>;

const failStatic = (category: string): never => {
  throw KnowledgeOperationalError.make({
    message: `Failed to statically derive command surface provenance: ${category}.`,
  });
};

const insideStaticCommandCorpus = (sourceFile: SourceFile): boolean =>
  Str.startsWith(`${STATIC_COMMAND_SOURCE_ROOT}/`)(sourceFile.getFilePath()) ||
  Str.equivalence(sourceFile.getFilePath(), STATIC_SHARED_FLAG_SOURCE);

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
  return parameter === undefined ? O.none() : HashMap.get(bindings, parameterKey(parameter));
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
  return namedImportMemberMatches(exactlyOneBindingDeclaration(identifier), identifier, importedName, moduleSpecifier);
};

const namedImportMemberMatches = (
  node: MorphNode,
  target: Identifier,
  importedName: string,
  moduleSpecifier: string
): boolean => {
  if (!Node.isImportSpecifier(node)) {
    return false;
  }
  const sourceName = node.getNameNode().getText();
  const localName = node.getAliasNode()?.getText() ?? sourceName;
  return (
    Str.equivalence(localName, target.getText()) &&
    Str.equivalence(sourceName, importedName) &&
    Str.equivalence(node.getImportDeclaration().getModuleSpecifierValue(), moduleSpecifier)
  );
};

const namespaceImportMemberMatches = (node: MorphNode, target: Identifier, moduleSpecifier: string): boolean => {
  if (!Node.isNamespaceImport(node)) {
    return false;
  }
  const importDeclaration = node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
  return (
    importDeclaration !== undefined &&
    Str.equivalence(node.getName(), target.getText()) &&
    Str.equivalence(importDeclaration.getModuleSpecifierValue(), moduleSpecifier)
  );
};

const importedMemberTarget = (expression: Expression, memberName: string, bindingName: string): O.Option<Identifier> =>
  pipe(
    expression,
    O.liftPredicate(Node.isPropertyAccessExpression),
    O.filter((property) => Str.equivalence(property.getName(), memberName)),
    O.map((property) => property.getExpression()),
    O.filter(Node.isIdentifier),
    O.filter((target) => Str.equivalence(target.getText(), bindingName))
  );

const isImportedBindingMember = (
  expression: Expression,
  bindingName: string,
  memberName: string,
  moduleSpecifier: string,
  importedName = bindingName
): boolean =>
  pipe(
    importedMemberTarget(expression, memberName, bindingName),
    O.exists((target) => {
      const node = exactlyOneBindingDeclaration(target);
      return (
        namespaceImportMemberMatches(node, target, moduleSpecifier) ||
        namedImportMemberMatches(node, target, importedName, moduleSpecifier)
      );
    })
  );

const isCommandMember = (expression: Expression, memberName: string): boolean =>
  isImportedBindingMember(expression, "Command", memberName, "effect/cli");

const isArrayMake = (expression: Expression): boolean =>
  isImportedBindingMember(expression, "A", "make", "effect/Array") ||
  isImportedBindingMember(expression, "A", "make", "@beep/utils");

const staticNode = (
  name: string,
  alias: string | null = null,
  children: ReadonlyArray<StaticCommandNode> = A.empty()
): StaticCommandNode => StaticCommandNode.make({ name, alias, children });

const addUniqueSpelling = (spellings: HashSet.HashSet<string>, spelling: string): HashSet.HashSet<string> =>
  Str.isEmpty(spelling) || HashSet.has(spellings, spelling)
    ? failStatic("sibling commands contain an empty or colliding name or alias")
    : HashSet.add(spellings, spelling);

const childSpellings = (child: StaticCommandNode): ReadonlyArray<string> =>
  A.appendAll(A.make(child.name), O.toArray(O.fromNullOr(child.alias)));

const validatedChildren = (children: ReadonlyArray<StaticCommandNode>): ReadonlyArray<StaticCommandNode> => {
  A.reduce(children, HashSet.empty<string>(), (spellings, child) =>
    A.reduce(childSpellings(child), spellings, addUniqueSpelling)
  );
  return children;
};

const arrayElementExpressions = (
  expression: ArrayLiteralExpression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<Expression> => {
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
};

const arrayMakeExpressions = (expression: CallExpression): ReadonlyArray<Expression> => {
  const arguments_ = expression.getArguments();
  return A.every(arguments_, Node.isExpression)
    ? arguments_
    : failStatic("an effect Array command list contains a non-expression member");
};

const identifierListExpressions = (
  expression: Identifier,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<Expression> => {
  const key = `${expression.getSourceFile().getFilePath()}:${expression.getStart()}`;
  return HashSet.has(seen, key)
    ? failStatic("the command list declarations contain a cycle")
    : listExpressions(variableInitializer(expression), bindings, HashSet.add(seen, key));
};

const listExpressions = (
  input: Expression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<Expression> => {
  const expression = unwrapExpression(input);
  if (Node.isArrayLiteralExpression(expression)) {
    return arrayElementExpressions(expression, bindings, seen);
  }
  if (Node.isCallExpression(expression) && isArrayMake(expression.getExpression())) {
    return arrayMakeExpressions(expression);
  }
  if (Node.isIdentifier(expression)) {
    return identifierListExpressions(expression, bindings, seen);
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
  seen: StaticTraversal
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

const SurfaceNeutralCommandTransform = LiteralKit([
  "provide",
  "withDescription",
  "withShortDescription",
  "withExamples",
  "withHandler",
  "withAnnotations",
  "withUnlisted",
]).pipe(
  $I.annoteSchema("SurfaceNeutralCommandTransform", {
    description: "Effect CLI transforms proven not to change command names, aliases, or descendants.",
  })
);
const isSurfaceNeutralCommandTransform = S.is(SurfaceNeutralCommandTransform);

const SurfaceNeutralBareCommandTransform = LiteralKit(["unlisted"]).pipe(
  $I.annoteSchema("SurfaceNeutralBareCommandTransform", {
    description:
      "Effect CLI transforms piped as bare references (no call) that hide a command from help without changing names, aliases, or descendants.",
  })
);
const isSurfaceNeutralBareCommandTransform = S.is(SurfaceNeutralBareCommandTransform);

const applyBareCommandTransform = (node: StaticCommandNode, transform: PropertyAccessExpression): StaticCommandNode => {
  const memberName = transform.getName();
  if (!Node.isIdentifier(transform.getExpression()) || !isCommandMember(transform, memberName)) {
    return failStatic("a bare command transform lacks Effect CLI provenance");
  }
  return isSurfaceNeutralBareCommandTransform(memberName)
    ? node
    : failStatic("an unsupported bare Effect CLI command transform changes the command declaration");
};

const commandTransformCall = (transform: Expression): CallExpression =>
  Node.isCallExpression(transform) ? transform : failStatic("a command transform is not a call expression");

const commandTransformMember = (call: CallExpression): string => {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || !Node.isIdentifier(callee.getExpression())) {
    return failStatic("a command transform uses an unsupported expression");
  }
  const memberName = callee.getName();
  return isCommandMember(callee, memberName)
    ? memberName
    : failStatic("a command transform lacks Effect CLI provenance");
};

const applySubcommandsTransform = (
  node: StaticCommandNode,
  call: CallExpression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): StaticCommandNode =>
  StaticCommandNode.make({
    ...node,
    children: validatedChildren(commandChildren(call, bindings, seen)),
  });

const applyAliasTransform = (
  node: StaticCommandNode,
  call: CallExpression,
  bindings: LiteralBindings
): StaticCommandNode => {
  const argument = call.getArguments()[0];
  if (argument === undefined || A.length(call.getArguments()) !== 1) {
    return failStatic("Command.withAlias lacks exactly one string argument");
  }
  const alias = O.getOrElse(boundString(argument, bindings), () =>
    failStatic("Command.withAlias is not a bound string literal")
  );
  return StaticCommandNode.make({ ...node, alias });
};

const applyCommandTransform = (
  node: StaticCommandNode,
  transform: Expression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): StaticCommandNode => {
  if (Node.isPropertyAccessExpression(transform)) {
    return applyBareCommandTransform(node, transform);
  }
  const call = commandTransformCall(transform);
  const memberName = commandTransformMember(call);
  if (Str.equivalence(memberName, "withSubcommands")) {
    return applySubcommandsTransform(node, call, bindings, seen);
  }
  if (Str.equivalence(memberName, "withAlias")) {
    return applyAliasTransform(node, call, bindings);
  }
  return isSurfaceNeutralCommandTransform(memberName)
    ? node
    : failStatic("an unsupported Effect CLI command transform changes the command declaration");
};

const evaluateCommandFactory = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): StaticCommandNode => {
  const functionLike = functionDeclarationForCall(call);
  const factoryKey = `${functionLike.getSourceFile().getFilePath()}:${functionLike.getStart()}`;
  if (HashSet.has(seen, factoryKey)) {
    return failStatic("the command factory declarations contain a cycle");
  }
  const parameters = functionLike.getParameters();
  const arguments_ = call.getArguments();
  if (A.length(parameters) !== A.length(arguments_)) {
    return failStatic("command factory arguments do not exactly match its parameters");
  }
  let nextBindings = bindings;
  for (let index = 0; index < A.length(parameters); index += 1) {
    const argument = arguments_[index]!;
    const value = O.getOrElse(boundString(argument, bindings), () =>
      failStatic("command factory arguments are not bound string literals")
    );
    nextBindings = HashMap.set(nextBindings, parameterKey(parameters[index]!), value);
  }
  return evaluateCommandExpression(directFunctionReturn(functionLike), nextBindings, HashSet.add(seen, factoryKey));
};

const evaluatePipeCall = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: StaticTraversal
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
  seen: StaticTraversal
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

const evaluateCommandIdentifier = (
  expression: Identifier,
  bindings: LiteralBindings,
  seen: StaticTraversal
): StaticCommandNode => {
  const key = `${expression.getSourceFile().getFilePath()}:${expression.getStart()}`;
  return HashSet.has(seen, key)
    ? failStatic("the command declarations contain a cycle")
    : evaluateCommandExpression(variableInitializer(expression), bindings, HashSet.add(seen, key));
};

const FlagConstructor = LiteralKit([
  "String",
  "Boolean",
  "Int",
  "Finite",
  "Date",
  "ChoiceWithValue",
  "Literals",
  "Path",
  "File",
  "Directory",
  "Redacted",
  "FileText",
  "FileParse",
  "FileSchema",
  "KeyValuePair",
]).pipe(
  $I.annoteSchema("FlagConstructor", {
    description: "Effect CLI Flag constructors whose first argument is the flag's canonical name.",
  })
);
const isFlagConstructor = S.is(FlagConstructor);

const FlagNameNeutralCombinator = LiteralKit([
  "withDescription",
  "withMetavar",
  "withHidden",
  "optional",
  "withDefault",
  "withFallbackConfig",
  "withFallbackPrompt",
  "map",
  "mapEffect",
  "mapTryCatch",
  "atLeast",
  "atMost",
  "between",
  "filterMap",
  "filter",
  "withSchema",
]).pipe(
  $I.annoteSchema("FlagNameNeutralCombinator", {
    description:
      "Effect CLI Flag combinators proven not to change a flag's name or aliases; orElse forms add alternatives and are excluded.",
  })
);
const isFlagNameNeutralCombinator = S.is(FlagNameNeutralCombinator);

const isFlagMember = (expression: Expression, memberName: string): boolean =>
  isImportedBindingMember(expression, "Flag", memberName, "effect/cli");

const isArgumentMember = (expression: Expression, memberName: string): boolean =>
  isImportedBindingMember(expression, "Argument", memberName, "effect/cli");

/** The member name of a `Namespace.member` callee, or `O.none()` for any other callee shape. */
const memberName = (expression: Expression): O.Option<string> =>
  Node.isPropertyAccessExpression(expression) && Node.isIdentifier(expression.getExpression())
    ? O.some(expression.getName())
    : O.none();

const stripFlagDashes = Str.replace(/^-+/u, "");

const addFlagAlias = (
  flags: ReadonlyArray<KnowledgeStaticCommandFlag>,
  alias: string
): ReadonlyArray<KnowledgeStaticCommandFlag> =>
  A.match(flags, {
    onEmpty: () => failStatic("Flag.withAlias applies to an argument rather than a flag"),
    onNonEmpty: (nonEmpty) =>
      A.length(nonEmpty) === 1
        ? [
            KnowledgeStaticCommandFlag.make({
              ...nonEmpty[0],
              aliases: A.append(nonEmpty[0].aliases, stripFlagDashes(alias)),
            }),
          ]
        : failStatic("Flag.withAlias applies to a param with alternatives"),
  });

const boundStringArgument = (call: CallExpression, index: number, bindings: LiteralBindings): string =>
  pipe(
    O.fromNullishOr(call.getArguments()[index]),
    O.flatMap((argument) => boundString(argument, bindings)),
    O.getOrElse(() => failStatic("a flag name or alias is not a bound string literal"))
  );

const isNameNeutralParamMember = (expression: Expression, member: string): boolean =>
  (isFlagMember(expression, member) && isFlagNameNeutralCombinator(member)) || isArgumentMember(expression, member);

// A bare transform such as `Flag.optional` piped without a call.
const applyBareParamTransform = (
  flags: ReadonlyArray<KnowledgeStaticCommandFlag>,
  transform: PropertyAccessExpression
): ReadonlyArray<KnowledgeStaticCommandFlag> =>
  isNameNeutralParamMember(transform, transform.getName())
    ? flags
    : failStatic("a bare param transform is not a name-neutral Effect CLI combinator");

const applyCalledParamTransform = (
  flags: ReadonlyArray<KnowledgeStaticCommandFlag>,
  transform: CallExpression,
  bindings: LiteralBindings
): ReadonlyArray<KnowledgeStaticCommandFlag> => {
  const callee = transform.getExpression();
  const member = O.getOrElse(memberName(callee), () => failStatic("a param transform uses an unsupported callee"));
  if (isFlagMember(callee, member) && Str.equivalence(member, "withAlias")) {
    return addFlagAlias(flags, boundStringArgument(transform, 0, bindings));
  }
  return isNameNeutralParamMember(callee, member)
    ? flags
    : failStatic("a param transform is not a name-neutral Effect CLI combinator");
};

const applyParamTransform = (
  flags: ReadonlyArray<KnowledgeStaticCommandFlag>,
  transform: MorphNode,
  bindings: LiteralBindings
): ReadonlyArray<KnowledgeStaticCommandFlag> => {
  if (Node.isPropertyAccessExpression(transform)) {
    return applyBareParamTransform(flags, transform);
  }
  return Node.isCallExpression(transform)
    ? applyCalledParamTransform(flags, transform, bindings)
    : failStatic("a param transform is not a call expression");
};

const applyParamTransforms = (
  flags: ReadonlyArray<KnowledgeStaticCommandFlag>,
  transforms: ReadonlyArray<MorphNode>,
  bindings: LiteralBindings
): ReadonlyArray<KnowledgeStaticCommandFlag> =>
  A.reduce(transforms, flags, (current, transform) => applyParamTransform(current, transform, bindings));

const firstExpressionArgument = (call: CallExpression, failure: string): Expression => {
  const first = call.getArguments()[0];
  return first !== undefined && Node.isExpression(first) ? first : failStatic(failure);
};

// `Flag.<constructor>(name)`, a data-first combinator (`Flag.optional(flag)`, `Flag.withAlias(flag, "x")`),
// or any `Argument.*` call, which declares no flag.
const evaluateParamMemberCall = (
  call: CallExpression,
  callee: Expression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<KnowledgeStaticCommandFlag> => {
  const member = O.getOrElse(memberName(callee), () => failStatic("a param uses an unsupported call"));
  if (isArgumentMember(callee, member)) {
    return A.empty();
  }
  if (!isFlagMember(callee, member)) {
    return failStatic("a param call lacks Effect CLI provenance");
  }
  if (isFlagConstructor(member)) {
    return [
      KnowledgeStaticCommandFlag.make({
        name: boundStringArgument(call, 0, bindings),
        aliases: A.empty(),
        negatable: Str.equivalence(member, "Boolean"),
      }),
    ];
  }
  const base = evaluateParamExpression(
    firstExpressionArgument(call, "a data-first flag combinator lacks its flag argument"),
    bindings,
    seen
  );
  if (Str.equivalence(member, "withAlias")) {
    return addFlagAlias(base, boundStringArgument(call, 1, bindings));
  }
  return isFlagNameNeutralCombinator(member) ? base : failStatic("a data-first flag combinator is not name-neutral");
};

const evaluateParamCall = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<KnowledgeStaticCommandFlag> => {
  const callee = call.getExpression();
  if (Node.isIdentifier(callee) && isTrustedPipe(callee)) {
    const base = evaluateParamExpression(
      firstExpressionArgument(call, "a param pipe has no base param"),
      bindings,
      seen
    );
    return applyParamTransforms(base, A.drop(call.getArguments(), 1), bindings);
  }
  if (Node.isPropertyAccessExpression(callee) && Str.equivalence(callee.getName(), "pipe")) {
    return applyParamTransforms(
      evaluateParamExpression(callee.getExpression(), bindings, seen),
      call.getArguments(),
      bindings
    );
  }
  return Node.isIdentifier(callee)
    ? evaluateParamFactory(call, bindings, seen)
    : evaluateParamMemberCall(call, callee, bindings, seen);
};

// A param factory such as `packageFlag("...")`: only bound string arguments bind; defaulted or
// non-literal parameters stay unbound, so a flag name that depends on one fails the derivation.
const evaluateParamFactory = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<KnowledgeStaticCommandFlag> => {
  const functionLike = functionDeclarationForCall(call);
  const factoryKey = `${functionLike.getSourceFile().getFilePath()}:${functionLike.getStart()}`;
  if (HashSet.has(seen, factoryKey)) {
    return failStatic("the param factory declarations contain a cycle");
  }
  const arguments_ = call.getArguments();
  const nextBindings = A.reduce(functionLike.getParameters(), bindings, (current, parameter, index) =>
    pipe(
      O.fromNullishOr(arguments_[index]),
      O.flatMap((argument) => boundString(argument, bindings)),
      O.match({
        onNone: () => current,
        onSome: (value) => HashMap.set(current, parameterKey(parameter), value),
      })
    )
  );
  return evaluateConfigOrParam(directFunctionReturn(functionLike), nextBindings, HashSet.add(seen, factoryKey));
};

const evaluateParamExpression = (
  input: Expression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<KnowledgeStaticCommandFlag> => {
  const expression = unwrapExpression(input);
  requireInsideStaticCommandCorpus(expression);
  if (Node.isIdentifier(expression)) {
    const key = `${expression.getSourceFile().getFilePath()}:${expression.getStart()}`;
    return HashSet.has(seen, key)
      ? failStatic("the param declarations contain a cycle")
      : evaluateConfigOrParam(variableInitializer(expression), bindings, HashSet.add(seen, key));
  }
  return Node.isCallExpression(expression)
    ? evaluateParamCall(expression, bindings, seen)
    : failStatic("a param uses an unsupported expression");
};

const shorthandInitializer = (property: MorphNode): Expression => {
  const declarations = pipe(
    O.fromNullishOr(Node.isShorthandPropertyAssignment(property) ? property.getValueSymbol() : undefined),
    O.map((symbol) => symbol.getDeclarations()),
    O.getOrElse(A.empty<MorphNode>)
  );
  const declaration = A.length(declarations) === 1 ? declarations[0] : undefined;
  const initializer =
    declaration !== undefined && Node.isVariableDeclaration(declaration)
      ? requireInsideStaticCommandCorpus(declaration).getInitializer()
      : undefined;
  return initializer === undefined ? failStatic("a shorthand config member has no variable initializer") : initializer;
};

const evaluateConfigProperty = (
  property: MorphNode,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<KnowledgeStaticCommandFlag> => {
  if (Node.isPropertyAssignment(property)) {
    const initializer = property.getInitializer();
    return initializer === undefined
      ? failStatic("a config member has no initializer")
      : evaluateConfigOrParam(initializer, bindings, seen);
  }
  if (Node.isShorthandPropertyAssignment(property)) {
    return evaluateConfigOrParam(shorthandInitializer(property), bindings, seen);
  }
  return Node.isSpreadAssignment(property)
    ? evaluateConfigOrParam(property.getExpression(), bindings, seen)
    : failStatic("a config member uses an unsupported form");
};

// A command config is a (possibly nested) record of flags and arguments; a member is either another
// record or one param expression.
const evaluateConfigOrParam = (
  input: Expression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): ReadonlyArray<KnowledgeStaticCommandFlag> => {
  const expression = unwrapExpression(input);
  return Node.isObjectLiteralExpression(expression)
    ? A.flatMap(requireInsideStaticCommandCorpus(expression).getProperties(), (property) =>
        evaluateConfigProperty(property, bindings, seen)
      )
    : evaluateParamExpression(expression, bindings, seen);
};

/**
 * The flags one `Command.make` call declares, or `O.none()` when its config is not statically
 * derivable. Unlike the command names, an underivable option set never fails the surface closed: the
 * Stage-1 gate does not read options, and the doctor reports such commands as unchecked instead.
 */
const commandMakeOptions = (
  call: CallExpression,
  bindings: LiteralBindings
): O.Option<ReadonlyArray<KnowledgeStaticCommandFlag>> =>
  O.match(O.fromNullishOr(call.getArguments()[1]), {
    onNone: () => O.some(A.empty<KnowledgeStaticCommandFlag>()),
    onSome: (config) =>
      Node.isExpression(config)
        ? O.liftThrowable(() => evaluateConfigOrParam(config, bindings, HashSet.empty()))()
        : O.none(),
  });

const evaluateCommandMake = (call: CallExpression, bindings: LiteralBindings): StaticCommandNode => {
  const nameArgument = call.getArguments()[0];
  if (nameArgument === undefined) {
    return failStatic("Command.make lacks a command name");
  }
  const name = O.getOrElse(boundString(nameArgument, bindings), () =>
    failStatic("Command.make name is not a bound string literal")
  );
  return O.match(commandMakeOptions(call, bindings), {
    onNone: () => staticNode(name),
    onSome: (options) => StaticCommandNode.make({ name, alias: null, children: A.empty(), options }),
  });
};

const isTrustedPipe = (callee: Identifier): boolean =>
  isNamedImport(callee, "pipe", "effect") ||
  isNamedImport(callee, "pipe", "effect/Function") ||
  isNamedImport(callee, "pipe", "@beep/utils");

const evaluateCommandCall = (
  call: CallExpression,
  bindings: LiteralBindings,
  seen: StaticTraversal
): StaticCommandNode => {
  const callee = call.getExpression();
  if (isCommandMember(callee, "make")) {
    return evaluateCommandMake(call, bindings);
  }
  if (Node.isIdentifier(callee) && isTrustedPipe(callee)) {
    return evaluatePipeCall(call, bindings, seen);
  }
  if (Node.isPropertyAccessExpression(callee) && Str.equivalence(callee.getName(), "pipe")) {
    return evaluateMethodPipeCall(call, bindings, seen);
  }
  return Node.isIdentifier(callee)
    ? evaluateCommandFactory(call, bindings, seen)
    : failStatic("a command declaration uses an unsupported call");
};

const evaluateCommandExpression = (
  input: Expression,
  bindings: LiteralBindings = HashMap.empty(),
  seen: StaticTraversal = HashSet.empty()
): StaticCommandNode => {
  const expression = unwrapExpression(input);
  requireInsideStaticCommandCorpus(expression);
  if (Node.isIdentifier(expression)) {
    return evaluateCommandIdentifier(expression, bindings, seen);
  }
  return Node.isCallExpression(expression)
    ? evaluateCommandCall(expression, bindings, seen)
    : failStatic("a command declaration uses an unsupported expression");
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
  const sharedFlagSource = path.join(checkoutRoot, SHARED_FLAG_SOURCE);
  const sharedFlagExists = yield* fs
    .exists(sharedFlagSource)
    .pipe(
      Effect.mapError(() => KnowledgeOperationalError.make({ message: "Failed to inspect shared flag source data." }))
    );
  const readCommandSourceFile = Effect.fnUntraced(function* (filePath: string) {
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
  });
  return yield* Effect.forEach(
    sharedFlagExists ? A.append(sourceNames, sharedFlagSource) : sourceNames,
    readCommandSourceFile
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
      project.addSourceFileAtPathIfExists(STATIC_SHARED_FLAG_SOURCE);
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

type StaticCommandResolution = {
  readonly status: "resolved" | "unknown";
  readonly canonicalPath: ReadonlyArray<string>;
  /** The deepest resolved node; on an unknown word, the parent the word was looked up under. */
  readonly node: StaticCommandNode;
  /** How many leading words the resolution consumed, including an unknown word. */
  readonly consumed: number;
};

const resolveStaticCommandNode = (root: StaticCommandNode, words: ReadonlyArray<string>): StaticCommandResolution => {
  let command = root;
  let canonicalPath = A.empty<string>();
  let consumed = 0;
  for (const word of words) {
    if (A.length(command.children) === 0 || Str.startsWith("-")(word)) {
      break;
    }
    const child = A.findFirst(
      command.children,
      (candidate) => Str.equivalence(candidate.name, word) || O.contains(O.fromNullOr(candidate.alias), word)
    );
    if (O.isNone(child)) {
      return { status: "unknown", canonicalPath: A.append(canonicalPath, word), node: command, consumed: consumed + 1 };
    }
    canonicalPath = A.append(canonicalPath, child.value.name);
    command = child.value;
    consumed += 1;
  }
  return { status: "resolved", canonicalPath, node: command, consumed };
};

const resolveStaticCommand = (
  root: StaticCommandNode,
  words: ReadonlyArray<string>
): readonly ["resolved" | "unknown", ReadonlyArray<string>] => {
  const resolution = resolveStaticCommandNode(root, words);
  return [resolution.status, resolution.canonicalPath];
};

// Rebuilds the node at `path` (canonical names) with `update`, leaving every other node untouched.
const updateStaticCommandAt = (
  node: StaticCommandNode,
  path: ReadonlyArray<string>,
  update: (target: StaticCommandNode) => O.Option<StaticCommandNode>
): O.Option<StaticCommandNode> =>
  A.match(path, {
    onEmpty: () => update(node),
    onNonEmpty: ([head, ...rest]) =>
      O.some(
        StaticCommandNode.make({
          ...node,
          children: A.getSomes(
            A.map(node.children, (child) =>
              Str.equivalence(child.name, head) ? updateStaticCommandAt(child, rest, update) : O.some(child)
            )
          ),
        })
      ),
  });

/** The surface without the command at `path`; the root itself cannot be pruned this way. */
const pruneStaticCommand = (root: StaticCommandNode, path: ReadonlyArray<string>): StaticCommandNode =>
  O.getOrElse(
    updateStaticCommandAt(root, path, () => O.none()),
    () => root
  );

/** The surface with the flag named `option` (canonical name) removed from the command at `path`. */
const withoutStaticCommandOption = (
  root: StaticCommandNode,
  path: ReadonlyArray<string>,
  option: string
): StaticCommandNode =>
  O.getOrElse(
    updateStaticCommandAt(root, path, (target) =>
      O.some(
        P.isUndefined(target.options)
          ? target
          : StaticCommandNode.make({
              ...target,
              options: A.filter(target.options, (flag) => !Str.equivalence(flag.name, option)),
            })
      )
    ),
    () => root
  );

/**
 * Source-only command-surface operations used by the semantic-delta archive oracle.
 *
 * **Example** (Build a current-tree probe)
 *
 * ```ts
 * import { KnowledgeCommandSurface } from "@beep/repo-cli/test/Knowledge"
 * import * as Str from "effect/String"
 *
 * const source = KnowledgeCommandSurface.commandTreeProbeSource("/repo/commands/Root.ts")
 *
 * console.log(Str.includes("rootCommand")(source)) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const KnowledgeCommandSurface = {
  buildStaticCommandTree,
  commandTreeProbeSource,
  decodeCurrentCommandTree,
  pruneStaticCommand,
  resolveStaticCommand,
  resolveStaticCommandNode,
  staticCommandNodeEquivalent,
  withoutStaticCommandOption,
} as const;

/**
 * Recursive command tree derived without executing checkout-owned modules.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type KnowledgeStaticCommandTree = StaticCommandNode;
