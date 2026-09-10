/**
 * Syntax-only import provenance, shadowing, and harness-containment helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { MutableHashMap } from "effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { Node, SyntaxKind } from "ts-morph";
import type {
  ArrowFunction,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  ImportDeclaration,
  Node as MorphNode,
  SourceFile,
  VariableDeclaration,
} from "ts-morph";

/**
 * Function-like syntax that can own a Vitest registration callback.
 *
 * @category models
 * @since 0.0.0
 */
export type EffectVitestFunctionNode = ArrowFunction | FunctionDeclaration | FunctionExpression;

type ImportBinding = {
  readonly declaration: ImportDeclaration;
  readonly imported: string;
  readonly local: string;
  readonly module: string;
};

/**
 * Parse-tree indexes, import provenance and lexical caches for one source snapshot.
 *
 * @category models
 * @since 0.0.0
 */
export type EffectVitestImports = {
  readonly bindings: ReadonlyArray<ImportBinding>;
  readonly bindingsByLocal: MutableHashMap.MutableHashMap<string, ReadonlyArray<ImportBinding>>;
  readonly calls: ReadonlyArray<CallExpression>;
  readonly functions: ReadonlyArray<EffectVitestFunctionNode>;
  readonly parameterNames: HashSet.HashSet<string>;
  readonly variables: ReadonlyArray<VariableDeclaration>;
  readonly loops: ReadonlyArray<MorphNode>;
  readonly declarationPositions: MutableHashMap.MutableHashMap<string, O.Option<number>>;
  readonly resolveBinding: (identifier: Identifier) => O.Option<MorphNode>;
  readonly chains: WeakMap<Expression, O.Option<ExpressionChain>>;
  readonly harnessModes: WeakMap<CallExpression, O.Option<EffectVitestHarnessMode>>;
  readonly hasEffectImport: boolean;
  readonly plainVitestImports: ReadonlyArray<ImportDeclaration>;
};

type ExpressionChain = {
  readonly base: Identifier;
  readonly local: string;
  readonly members: ReadonlyArray<string>;
};

const functionNode = (node: MorphNode): node is EffectVitestFunctionNode =>
  Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node);

/**
 * Resolve a lexical binding without a type checker or following another source file.
 *
 * **Details**
 * Parameters and block declarations shadow imports, including declarations in
 * the temporal dead zone. An unresolved identifier remains absent.
 *
 * **Example** (Resolve a callback parameter)
 *
 * ```ts
 * import { resolveEffectVitestBinding } from "@beep/repo-cli/commands/Lint"
 * import { Project, SyntaxKind } from "ts-morph"
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("a.ts", "(value) => value")
 * const reference = source.getDescendantsOfKind(SyntaxKind.Identifier)[1]
 * if (reference) console.log(resolveEffectVitestBinding(reference)._tag) // "Some"
 * ```
 *
 * @param identifier - Identifier reference whose enclosing lexical scopes should be searched.
 * @returns The shadowing declaration when resolved, or None for an unbound reference.
 * @category parsing
 * @since 0.0.0
 */
export const resolveEffectVitestBinding = (identifier: Identifier): O.Option<MorphNode> =>
  bindingResolver()(identifier);

const isLexicalScope = (scope: MorphNode): boolean =>
  functionNode(scope) ||
  Node.isBlock(scope) ||
  Node.isSourceFile(scope) ||
  Node.isForOfStatement(scope) ||
  Node.isForInStatement(scope) ||
  Node.isForStatement(scope) ||
  Node.isCatchClause(scope);

type BindSyntaxName = (name: MorphNode, declaration: MorphNode) => void;
type AddSyntaxBinding = (name: string, declaration: MorphNode) => void;

const bindImport = (statement: ImportDeclaration, add: AddSyntaxBinding): void => {
  const namespace = statement.getNamespaceImport();
  const defaultImport = statement.getDefaultImport();
  if (namespace !== undefined) add(namespace.getText(), statement);
  if (defaultImport !== undefined) add(defaultImport.getText(), statement);
  for (const specifier of statement.getNamedImports()) {
    add(specifier.getAliasNode()?.getText() ?? specifier.getName(), statement);
  }
};

const bindStatement = (statement: MorphNode, bind: BindSyntaxName, add: AddSyntaxBinding): void => {
  if (Node.isVariableStatement(statement)) {
    for (const declaration of statement.getDeclarations()) bind(declaration.getNameNode(), declaration);
  } else if (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) {
    const name = statement.getName();
    if (name !== undefined) add(name, statement);
  } else if (Node.isImportDeclaration(statement)) {
    bindImport(statement, add);
  }
};

const bindLoopInitializer = (initializer: MorphNode | undefined, bind: BindSyntaxName): void => {
  if (Node.isVariableDeclarationList(initializer)) {
    for (const declaration of initializer.getDeclarations()) bind(declaration.getNameNode(), declaration);
  }
};

const bindLoopOrCatch = (scope: MorphNode, bind: BindSyntaxName): void => {
  if (Node.isForOfStatement(scope) || Node.isForInStatement(scope) || Node.isForStatement(scope)) {
    bindLoopInitializer(scope.getInitializer(), bind);
  }
  if (Node.isCatchClause(scope)) {
    const declaration = scope.getVariableDeclaration();
    if (declaration !== undefined) bind(declaration.getNameNode(), declaration);
  }
};

const bindScope = (scope: MorphNode, bind: BindSyntaxName, add: AddSyntaxBinding): void => {
  if (functionNode(scope)) {
    for (const parameter of scope.getParameters()) bind(parameter.getNameNode(), parameter);
  }
  bindLoopOrCatch(scope, bind);
  if (Node.isBlock(scope) || Node.isSourceFile(scope)) {
    for (const statement of scope.getStatements()) bindStatement(statement, bind, add);
  }
};

// One immutable analysis pass owns these AST caches. A fresh import context
// rebuilds them, including after a SourceFile edit or on another scan.
const bindingResolver = (): ((identifier: Identifier) => O.Option<MorphNode>) => {
  const scopes = new WeakMap<MorphNode, MutableHashMap.MutableHashMap<string, MorphNode>>();
  const resolved = new WeakMap<Identifier, O.Option<MorphNode>>();
  const resolvedNames = new WeakMap<MorphNode, MutableHashMap.MutableHashMap<string, O.Option<MorphNode>>>();
  const scopeBindings = (scope: MorphNode) =>
    O.getOrElse(O.fromUndefinedOr(scopes.get(scope)), () => {
      const bindings = MutableHashMap.empty<string, MorphNode>();
      const add = (name: string, declaration: MorphNode) => {
        // Match the original lexical walk's first declaration, including TDZ.
        if (!MutableHashMap.has(bindings, name)) MutableHashMap.set(bindings, name, declaration);
      };
      const bind = (name: MorphNode, declaration: MorphNode): void => {
        if (Node.isIdentifier(name)) add(name.getText(), declaration);
        else if (Node.isObjectBindingPattern(name) || Node.isArrayBindingPattern(name)) {
          for (const element of name.getElements()) {
            if (Node.isBindingElement(element)) bind(element.getNameNode(), declaration);
          }
        }
      };

      bindScope(scope, bind, add);
      scopes.set(scope, bindings);
      return bindings;
    });
  const scopeResolutions = (current: MorphNode) => {
    let names = resolvedNames.get(current);
    if (names === undefined) {
      names = MutableHashMap.empty<string, O.Option<MorphNode>>();
      resolvedNames.set(current, names);
    }
    return names;
  };
  return (identifier) =>
    O.getOrElse(O.fromUndefinedOr(resolved.get(identifier)), () => {
      const name = identifier.getText();
      let result = O.none<MorphNode>();
      const traversed = A.empty<MutableHashMap.MutableHashMap<string, O.Option<MorphNode>>>();
      for (
        let current: MorphNode | undefined = identifier.getParent();
        current !== undefined;
        current = current.getParent()
      ) {
        if (!isLexicalScope(current)) continue;
        const names = scopeResolutions(current);
        const cached = MutableHashMap.get(names, name);
        // Some(None) is a resolved miss; only the outer None needs a walk.
        if (O.isSome(cached)) {
          result = cached.value;
          break;
        }
        traversed.push(names);
        result = MutableHashMap.get(scopeBindings(current), name);
        if (O.isSome(result)) break;
      }
      // Only scopes visited before finding the binding inherit this result.
      // A child's declaration must never populate an unvisited outer scope.
      for (const names of traversed) MutableHashMap.set(names, name, result);
      resolved.set(identifier, result);
      return result;
    });
};

const expressionChain = (expression: Expression, imports: EffectVitestImports): O.Option<ExpressionChain> =>
  O.getOrElse(O.fromUndefinedOr(imports.chains.get(expression)), () => {
    let chain = O.none<ExpressionChain>();
    if (Node.isIdentifier(expression)) chain = O.some({ base: expression, local: expression.getText(), members: [] });
    else if (Node.isPropertyAccessExpression(expression)) {
      chain = O.map(expressionChain(expression.getExpression(), imports), ({ base, local, members }) => ({
        base,
        local,
        members: [...members, expression.getName()],
      }));
    } else if (Node.isCallExpression(expression)) chain = expressionChain(expression.getExpression(), imports);
    imports.chains.set(expression, chain);
    return chain;
  });

const isShadowed = (identifier: Identifier, binding: ImportBinding, imports: EffectVitestImports): boolean => {
  const key = `binding:${identifier.getStart()}`;
  const cached = MutableHashMap.get(imports.declarationPositions, key);
  const position = O.getOrElse(cached, () => {
    const resolved = O.map(imports.resolveBinding(identifier), (declaration) => declaration.getStart());
    MutableHashMap.set(imports.declarationPositions, key, resolved);
    return resolved;
  });
  return O.exists(position, (start) => start !== binding.declaration.getStart());
};

const collectSyntaxRoles = (sourceFile: SourceFile) => {
  // Collect parse-tree roles in one traversal. Identifier/token discovery stays
  // separate because ts-morph includes JSDoc/token children for those queries.
  const calls = A.empty<CallExpression>();
  const functions = A.empty<EffectVitestFunctionNode>();
  const variables = A.empty<VariableDeclaration>();
  const forLoops = A.empty<MorphNode>();
  const whileLoops = A.empty<MorphNode>();
  const doLoops = A.empty<MorphNode>();
  const forOfLoops = A.empty<MorphNode>();
  const forInLoops = A.empty<MorphNode>();
  const collectRole = (node: MorphNode): void => {
    if (Node.isCallExpression(node)) calls.push(node);
    else if (functionNode(node)) functions.push(node);
    else if (Node.isVariableDeclaration(node)) variables.push(node);
    else if (Node.isForStatement(node)) forLoops.push(node);
    else if (Node.isWhileStatement(node)) whileLoops.push(node);
    else if (Node.isDoStatement(node)) doLoops.push(node);
    else if (Node.isForOfStatement(node)) forOfLoops.push(node);
    else if (Node.isForInStatement(node)) forInLoops.push(node);
  };
  const pending = A.reverse(sourceFile.forEachChildAsArray());
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    collectRole(node);
    const children = node.forEachChildAsArray();
    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];
      if (child !== undefined) pending.push(child);
    }
  }

  return { calls, functions, variables, loops: [...forLoops, ...whileLoops, ...doLoops, ...forOfLoops, ...forInLoops] };
};

/**
 * Collect named, renamed, and namespace import provenance without semantic resolution.
 *
 * **Details**
 * Reuse the returned context during one immutable syntax pass. Recollect it after
 * editing the source; AST identity caches are local to this context and never
 * shared between files or runs.
 *
 * **Example** (Collect an aliased Effect import)
 *
 * ```ts
 * import { collectEffectVitestImports } from "@beep/repo-cli/commands/Lint"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "alias.test.ts",
 *   'import { Effect as Fx } from "effect"'
 * )
 * console.log(collectEffectVitestImports(source).hasEffectImport) // true
 * ```
 *
 * @param sourceFile - Source file to analyze without following imports or invoking a type checker.
 * @returns Import provenance and invocation-local syntax indexes for this source file.
 * @category parsing
 * @since 0.0.0
 */
export const collectEffectVitestImports = (sourceFile: SourceFile): EffectVitestImports => {
  const imports = A.filter(sourceFile.getImportDeclarations(), (declaration) =>
    Node.isStringLiteral(declaration.getModuleSpecifier())
  );
  const bindings = A.flatMap(imports, (declaration): ReadonlyArray<ImportBinding> => {
    const specifier = declaration.getModuleSpecifier();
    if (!Node.isStringLiteral(specifier)) return [];
    const module = specifier.getLiteralValue();
    const namespace = declaration.getNamespaceImport();
    const namespaceBinding =
      namespace === undefined ? [] : [{ declaration, imported: "*", local: namespace.getText(), module }];
    const namedBindings = A.map(
      declaration.getNamedImports(),
      (specifier): ImportBinding => ({
        declaration,
        imported: specifier.getName(),
        local: specifier.getAliasNode()?.getText() ?? specifier.getName(),
        module,
      })
    );
    const defaultImport = declaration.getDefaultImport();
    const defaultBinding =
      defaultImport === undefined ? [] : [{ declaration, imported: "default", local: defaultImport.getText(), module }];
    return [...namespaceBinding, ...namedBindings, ...defaultBinding];
  });
  const { calls, functions, variables, loops } = collectSyntaxRoles(sourceFile);

  const bindingsByLocal = MutableHashMap.empty<string, ReadonlyArray<ImportBinding>>();
  for (const binding of bindings) {
    MutableHashMap.set(bindingsByLocal, binding.local, [
      ...O.getOrElse(MutableHashMap.get(bindingsByLocal, binding.local), A.empty<ImportBinding>),
      binding,
    ]);
  }
  return {
    bindings,
    bindingsByLocal,
    calls,
    functions,
    parameterNames: HashSet.fromIterable(
      A.flatMap(functions, (node) => A.map(node.getParameters(), (parameter) => parameter.getName()))
    ),
    variables,
    loops,
    declarationPositions: MutableHashMap.empty(),
    resolveBinding: bindingResolver(),
    chains: new WeakMap(),
    harnessModes: new WeakMap(),
    hasEffectImport: A.some(imports, (declaration) => {
      const specifier = declaration.getModuleSpecifier();
      return (
        Node.isStringLiteral(specifier) &&
        (specifier.getLiteralValue() === "effect" || Str.startsWith("effect/")(specifier.getLiteralValue()))
      );
    }),
    plainVitestImports: A.filter(imports, (declaration) => {
      const specifier = declaration.getModuleSpecifier();
      return Node.isStringLiteral(specifier) && specifier.getLiteralValue() === "vitest";
    }),
  };
};

const matchesBareMember = (joined: string, members: ReadonlyArray<string>, member: string, exported: string): boolean =>
  joined === member || (member === exported && A.isReadonlyArrayEmpty(members));

const bindingMemberMatches = (
  binding: ImportBinding,
  members: ReadonlyArray<string>,
  namespaceExport: string,
  member: string
): boolean => {
  const joinedMembers = A.join(members, ".");
  let matches = false;
  if (
    binding.imported === "default" &&
    A.contains(["node:assert", "node:assert/strict", "assert", "assert/strict", "node:os", "os"], binding.module)
  ) {
    matches = matchesBareMember(joinedMembers, members, member, namespaceExport);
  } else if (binding.imported === "*") {
    matches =
      joinedMembers === member ||
      (A.contains(
        ["effect", "effect/testing", "effect/unstable/arbitrary", "@effect/vitest", "vitest"],
        binding.module
      ) &&
        joinedMembers === `${namespaceExport}.${member}`);
  } else if (binding.imported === namespaceExport) {
    matches = matchesBareMember(joinedMembers, members, member, binding.imported);
  } else {
    matches = binding.imported === member && A.isReadonlyArrayEmpty(members);
  }
  return matches;
};

const importedBindingMatches = (
  chain: ExpressionChain,
  imports: EffectVitestImports,
  modules: ReadonlyArray<string>,
  namespaceExport: string,
  member: string
): boolean =>
  A.some(O.getOrElse(MutableHashMap.get(imports.bindingsByLocal, chain.local), A.empty<ImportBinding>), (binding) => {
    if (!A.contains(modules, binding.module) || binding.local !== chain.local) return false;
    const matches = bindingMemberMatches(binding, chain.members, namespaceExport, member);
    return matches && !isShadowed(chain.base, binding, imports);
  });

/**
 * Match an expression against named, renamed, or namespace import provenance.
 *
 * **Example** (Recognize an Effect namespace member)
 *
 * ```ts
 * import { collectEffectVitestImports, isProvenanceExpression } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "namespace.test.ts",
 *   'import * as E from "effect"; E.Effect.runSync(program)'
 * )
 * const call = A.head(source.getDescendantsOfKind(SyntaxKind.CallExpression))
 * console.log(O.exists(call, (node) => isProvenanceExpression(
 *   node.getExpression(), collectEffectVitestImports(source), ["effect"], "Effect", ["runSync"]
 * ))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const isProvenanceExpression: {
  (
    expression: Expression,
    imports: EffectVitestImports,
    modules: ReadonlyArray<string>,
    namespaceExport: string,
    members: ReadonlyArray<string>
  ): boolean;
  (
    imports: EffectVitestImports,
    modules: ReadonlyArray<string>,
    namespaceExport: string,
    members: ReadonlyArray<string>
  ): (expression: Expression) => boolean;
} = dual(
  5,
  (
    expression: Expression,
    imports: EffectVitestImports,
    modules: ReadonlyArray<string>,
    namespaceExport: string,
    members: ReadonlyArray<string>
  ): boolean =>
    O.exists(expressionChain(expression, imports), (chain) =>
      A.some(members, (member) => importedBindingMatches(chain, imports, modules, namespaceExport, member))
    )
);

/**
 * Match a call expression against syntax-only import provenance.
 *
 * **Example** (Recognize an aliased call)
 *
 * ```ts
 * import { collectEffectVitestImports, isProvenanceCall } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "alias.test.ts",
 *   'import { runSync as run } from "effect/Effect"; run(program)'
 * )
 * const call = A.head(source.getDescendantsOfKind(SyntaxKind.CallExpression))
 * console.log(O.exists(call, (node) => isProvenanceCall(
 *   node, collectEffectVitestImports(source), ["effect/Effect"], "Effect", ["runSync"]
 * ))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const isProvenanceCall: {
  (
    call: CallExpression,
    imports: EffectVitestImports,
    modules: ReadonlyArray<string>,
    namespaceExport: string,
    members: ReadonlyArray<string>
  ): boolean;
  (
    imports: EffectVitestImports,
    modules: ReadonlyArray<string>,
    namespaceExport: string,
    members: ReadonlyArray<string>
  ): (call: CallExpression) => boolean;
} = dual(
  5,
  (
    call: CallExpression,
    imports: EffectVitestImports,
    modules: ReadonlyArray<string>,
    namespaceExport: string,
    members: ReadonlyArray<string>
  ): boolean => isProvenanceExpression(call.getExpression(), imports, modules, namespaceExport, members)
);

const isImportedHarness = (binding: ImportBinding, chain: ExpressionChain): boolean => {
  const exports =
    binding.module === "@effect/vitest" ? ["it", "test", "effect", "live", "layer", "prop"] : ["it", "test"];
  const importedHarness =
    A.contains(["@effect/vitest", "vitest"], binding.module) &&
    (A.contains(exports, binding.imported) ||
      (binding.imported === "*" && A.contains(exports, chain.members[0] ?? "")));
  return importedHarness;
};

const isInstrumentedHarness = (binding: ImportBinding, chain: ExpressionChain): boolean => {
  const instrumentedHarness =
    binding.module === "@beep/test-utils/Vitest" &&
    (binding.imported === "it" || (binding.imported === "*" && chain.members[0] === "it"));
  return instrumentedHarness;
};

const importedHarnessBinding = (chain: ExpressionChain, imports: EffectVitestImports): O.Option<ImportBinding> =>
  A.findFirst(
    O.getOrElse(MutableHashMap.get(imports.bindingsByLocal, chain.local), A.empty<ImportBinding>),
    (binding) => {
      if (binding.local !== chain.local) return false;
      const importedHarness = isImportedHarness(binding, chain);
      const instrumentedHarness = isInstrumentedHarness(binding, chain);
      return (importedHarness || instrumentedHarness) && !isShadowed(chain.base, binding, imports);
    }
  );

const importedHarnessChain = (chain: ExpressionChain, imports: EffectVitestImports): boolean =>
  O.isSome(importedHarnessBinding(chain, imports));

const registrationForFunction = (
  callback: EffectVitestFunctionNode,
  imports: EffectVitestImports
): O.Option<{ readonly call: CallExpression; readonly mode: EffectVitestHarnessMode }> => {
  let child: MorphNode = callback;
  let current: MorphNode | undefined = callback.getParent();
  while (current !== undefined && Node.isCallExpression(current)) {
    if (A.some(current.getArguments(), (argument) => argument === child)) {
      const mode = classifyHarnessCall(current, imports);
      if (O.isSome(mode)) return O.some({ call: current, mode: mode.value });
    }
    child = current;
    current = current.getParent();
  }
  return O.none();
};

const layerTesterOwner = (base: Identifier, imports: EffectVitestImports): O.Option<EffectVitestFunctionNode> => {
  if (!HashSet.has(imports.parameterNames, base.getText())) return O.none();
  const binding = imports.resolveBinding(base);
  if (!O.exists(binding, Node.isParameterDeclaration)) return O.none();
  let current: MorphNode | undefined = base.getParent();
  while (current !== undefined) {
    if (
      functionNode(current) &&
      A.some(current.getParameters(), (parameter) => parameter.getName() === base.getText())
    ) {
      return O.some(current);
    }
    current = current.getParent();
  }
  return O.none();
};

const layerCallbackTester = (base: Identifier, imports: EffectVitestImports): boolean =>
  O.exists(layerTesterOwner(base, imports), (owner) =>
    O.exists(registrationForFunction(owner, imports), (registration) => registration.mode === "layer")
  );

const harnessMembers = (chain: ExpressionChain, imports: EffectVitestImports): ReadonlyArray<string> => {
  if (layerCallbackTester(chain.base, imports)) return chain.members;
  return importedHarnessMembers(chain, imports);
};

const importedHarnessMembers = (chain: ExpressionChain, imports: EffectVitestImports): ReadonlyArray<string> => {
  const binding = importedHarnessBinding(chain, imports);
  return O.match(binding, {
    onNone: () => chain.members,
    onSome: (candidate) => {
      const members = candidate.imported === "*" ? chain.members : [candidate.imported, ...chain.members];
      return A.contains(["it", "test"], members[0] ?? "") ? A.drop(members, 1) : members;
    },
  });
};

/**
 * Registration modes whose callback semantics affect detector predicates.
 *
 * @category models
 * @since 0.0.0
 */
export type EffectVitestHarnessMode = "plain" | "effect" | "live" | "layer";

/**
 * Cached lexical callback lookup used by every call in one source file.
 *
 * @category models
 * @since 0.0.0
 */
export type EffectVitestHarnessIndex = {
  /** Definition-site reachability through same-file lexical calls, never a redundancy proof. */
  readonly reachableHelper: (node: MorphNode) => O.Option<{
    readonly callback: EffectVitestFunctionNode;
    readonly effect: boolean;
    readonly testClock: boolean;
    readonly plain: boolean;
    readonly shared: boolean;
  }>;
  readonly enclosingLayerBlock: (node: MorphNode) => O.Option<EffectVitestFunctionNode>;
  readonly enclosingTest: (
    node: MorphNode
  ) => O.Option<{ readonly callback: EffectVitestFunctionNode; readonly mode: "plain" | "effect" | "live" }>;
};

/**
 * Classify a Vitest registration call, including curried each and layer forms.
 *
 * **Example** (Classify an Effect test)
 *
 * ```ts
 * import { classifyHarnessCall, collectEffectVitestImports } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "effect.test.ts",
 *   'import { it } from "@effect/vitest"; it.effect("works", () => program)'
 * )
 * const call = A.head(source.getDescendantsOfKind(SyntaxKind.CallExpression))
 * console.log(O.flatMap(call, (node) => classifyHarnessCall(node, collectEffectVitestImports(source)))) // Some("effect")
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const classifyHarnessCall: {
  (call: CallExpression, imports: EffectVitestImports): O.Option<EffectVitestHarnessMode>;
  (imports: EffectVitestImports): (call: CallExpression) => O.Option<EffectVitestHarnessMode>;
} = dual(2, (call: CallExpression, imports: EffectVitestImports) =>
  O.getOrElse(O.fromUndefinedOr(imports.harnessModes.get(call)), () => {
    const mode = O.flatMap(
      expressionChain(call.getExpression(), imports),
      (chain): O.Option<EffectVitestHarnessMode> => {
        const imported = importedHarnessChain(chain, imports);
        const callbackTester = layerCallbackTester(chain.base, imports);
        if (!imported && !callbackTester) return O.none();
        const members = harnessMembers(chain, imports);
        if (A.contains(members, "layer")) return O.some("layer");
        if (A.contains(members, "effect")) return O.some("effect");
        if (A.contains(members, "live")) return O.some("live");
        return O.some("plain");
      }
    );
    imports.harnessModes.set(call, mode);
    return mode;
  })
);

/**
 * Test one exact harness method while preserving alias and layer-callback provenance.
 *
 * **Example** (Recognize a live registration)
 *
 * ```ts
 * import { collectEffectVitestImports, isHarnessMethodCall } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "live.test.ts",
 *   'import { it } from "@effect/vitest"; it.live("works", () => program)'
 * )
 * const call = A.head(source.getDescendantsOfKind(SyntaxKind.CallExpression))
 * console.log(O.exists(call, (node) => isHarnessMethodCall(node, collectEffectVitestImports(source), "live"))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const isHarnessMethodCall: {
  (call: CallExpression, imports: EffectVitestImports, method: string): boolean;
  (imports: EffectVitestImports, method: string): (call: CallExpression) => boolean;
} = dual(3, (call: CallExpression, imports: EffectVitestImports, method: string): boolean =>
  O.exists(
    expressionChain(call.getExpression(), imports),
    (chain) =>
      (importedHarnessChain(chain, imports) || layerCallbackTester(chain.base, imports)) &&
      A.contains(harnessMembers(chain, imports), method)
  )
);

/**
 * Find the nearest plain, Effect, or live test callback containing a syntax node.
 *
 * **Example** (Find the enclosing plain test)
 *
 * ```ts
 * import { collectEffectVitestImports, enclosingTest } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "plain.test.ts",
 *   'import { it } from "@effect/vitest"; it("works", () => subject())'
 * )
 * const subject = A.last(source.getDescendantsOfKind(SyntaxKind.CallExpression))
 * console.log(O.flatMap(subject, (node) => enclosingTest(node, collectEffectVitestImports(source)))) // Some callback
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const enclosingTest: {
  (
    node: MorphNode,
    imports: EffectVitestImports
  ): O.Option<{ readonly callback: EffectVitestFunctionNode; readonly mode: "plain" | "effect" | "live" }>;
  (
    imports: EffectVitestImports
  ): (
    node: MorphNode
  ) => O.Option<{ readonly callback: EffectVitestFunctionNode; readonly mode: "plain" | "effect" | "live" }>;
} = dual(2, (node: MorphNode, imports: EffectVitestImports) => {
  let current = node.getParent();
  while (current !== undefined) {
    if (functionNode(current)) {
      const registration = registrationForFunction(current, imports);
      if (O.isSome(registration) && registration.value.mode !== "layer") {
        return O.some({ callback: current, mode: registration.value.mode });
      }
    }
    current = current.getParent();
  }
  return O.none();
});

/**
 * Find an enclosing `it.layer` callback even through a nested `it.effect` callback.
 *
 * **Example** (Find a layer block around a nested test)
 *
 * ```ts
 * import { collectEffectVitestImports, enclosingLayerBlock } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "layer.test.ts",
 *   'import { it } from "@effect/vitest"; it.layer(layer)("suite", (it) => { it.effect("works", () => subject()) })'
 * )
 * const subject = A.last(source.getDescendantsOfKind(SyntaxKind.CallExpression))
 * console.log(O.flatMap(subject, (node) => enclosingLayerBlock(node, collectEffectVitestImports(source)))) // Some callback
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const enclosingLayerBlock: {
  (node: MorphNode, imports: EffectVitestImports): O.Option<EffectVitestFunctionNode>;
  (imports: EffectVitestImports): (node: MorphNode) => O.Option<EffectVitestFunctionNode>;
} = dual(2, (node: MorphNode, imports: EffectVitestImports) => {
  let current = node.getParent();
  while (current !== undefined) {
    if (functionNode(current) && O.exists(registrationForFunction(current, imports), ({ mode }) => mode === "layer")) {
      return O.some(current);
    }
    current = current.getParent();
  }
  return O.none();
});

/**
 * Collect registration callbacks through the pinned Effect function and generator wrappers.
 *
 * **Details**
 * Arbitrary call arguments are not assumed to execute as test bodies. This same
 * extraction drives containment and live-mode review.
 *
 * **Example** (Find an untraced test body)
 *
 * ```ts
 * import { collectEffectVitestImports, effectVitestTestCallbacks } from "@beep/repo-cli/commands/Lint"
 * import { Project, SyntaxKind } from "ts-morph"
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("a.ts",
 *   'import { Effect } from "effect"; it.effect("x", Effect.fnUntraced(function* () { yield* Effect.void }))')
 * const call = source.getDescendantsOfKind(SyntaxKind.CallExpression)[0]
 * if (call) console.log(effectVitestTestCallbacks(call, collectEffectVitestImports(source)).length) // 1
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const effectVitestTestCallbacks: {
  (call: CallExpression, imports: EffectVitestImports): ReadonlyArray<EffectVitestFunctionNode>;
  (imports: EffectVitestImports): (call: CallExpression) => ReadonlyArray<EffectVitestFunctionNode>;
} = dual(2, (call: CallExpression, imports: EffectVitestImports) => {
  const callbacks = (node: MorphNode): ReadonlyArray<EffectVitestFunctionNode> => {
    if (functionNode(node)) return [node];
    if (!Node.isCallExpression(node)) return [];
    if (isProvenanceCall(node, imports, ["effect", "effect/Effect"], "Effect", ["gen", "fn", "fnUntraced"]))
      return A.flatMap(node.getArguments(), callbacks);
    const expression = node.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "pipe"
      ? callbacks(expression.getExpression())
      : [];
  };
  return A.flatMap(call.getArguments(), callbacks);
});

// AST vertices and worklists are analysis state, not persisted finding models.
type FunctionReachability = {
  readonly node: O.Option<EffectVitestFunctionNode>;
  readonly callees: Array<FunctionReachability>;
  plain: boolean;
  effect: boolean;
  testClock: boolean;
  outside: boolean;
  uncertain: boolean;
};

const addsReachability = (from: FunctionReachability, to: FunctionReachability): boolean =>
  (from.plain && !to.plain) ||
  // A test-clock vertex is always an Effect vertex; propagating that stronger
  // mode covers both bits without allocating a flag list on the hot path.
  (from.testClock ? !to.testClock : from.effect && !to.effect) ||
  (from.outside && !to.outside) ||
  (from.uncertain && !to.uncertain);

const isPropertyName = (reference: Identifier, parent: MorphNode | undefined): boolean =>
  (Node.isPropertyAccessExpression(parent) || Node.isPropertyAssignment(parent)) && parent.getNameNode() === reference;

const isDeclarationName = (reference: Identifier, declaration: MorphNode): boolean =>
  (Node.isVariableDeclaration(declaration) || Node.isFunctionDeclaration(declaration)) &&
  declaration.getNameNode() === reference;

const helperReachability = (
  sourceFile: SourceFile,
  imports: EffectVitestImports,
  modes: MutableHashMap.MutableHashMap<number, EffectVitestHarnessMode>
): EffectVitestHarnessIndex["reachableHelper"] => {
  const vertex = (node: O.Option<EffectVitestFunctionNode>): FunctionReachability => ({
    node,
    callees: [],
    plain: false,
    effect: false,
    testClock: false,
    outside: false,
    uncertain: false,
  });
  const module = vertex(O.none());
  module.outside = true;
  const functions = imports.functions;
  const vertices = MutableHashMap.empty<number, FunctionReachability>();
  const bindings = MutableHashMap.empty<number, FunctionReachability>();
  const names = MutableHashMap.empty<string, boolean>();
  const boundFunctions = MutableHashMap.empty<number, boolean>();
  const initializeVertex = (node: EffectVitestFunctionNode): void => {
    const value = vertex(O.some(node));
    const mode = MutableHashMap.get(modes, node.getStart());
    value.plain = O.contains(mode, "plain");
    value.effect = O.exists(mode, (mode) => mode === "effect" || mode === "live");
    value.testClock = O.contains(mode, "effect");
    value.outside = O.contains(mode, "layer");
    MutableHashMap.set(vertices, node.getStart(), value);
  };
  for (const node of functions) initializeVertex(node);
  const owner = (node: MorphNode): FunctionReachability =>
    O.getOrElse(
      O.flatMap(O.fromUndefinedOr(node.getFirstAncestor(functionNode)), (parent) =>
        MutableHashMap.get(vertices, parent.getStart())
      ),
      () => module
    );
  const bind = (declaration: MorphNode, name: string, node: EffectVitestFunctionNode) => {
    const value = MutableHashMap.get(vertices, node.getStart());
    if (O.isSome(value)) {
      MutableHashMap.set(bindings, declaration.getStart(), value.value);
      MutableHashMap.set(names, name, true);
      MutableHashMap.set(boundFunctions, node.getStart(), true);
      if (
        (Node.isFunctionDeclaration(declaration) || Node.isVariableDeclaration(declaration)) &&
        declaration.hasExportKeyword()
      )
        value.value.outside = true;
    }
  };
  const bindFunctionDeclaration = (node: EffectVitestFunctionNode): void => {
    if (Node.isFunctionDeclaration(node)) {
      const name = node.getName();
      if (name !== undefined) bind(node, name, node);
    }
  };
  for (const node of functions) bindFunctionDeclaration(node);
  const bindVariableHelper = (declaration: VariableDeclaration): void => {
    const initializer = declaration.getInitializer();
    if (initializer === undefined || !Node.isIdentifier(declaration.getNameNode())) return;
    if (functionNode(initializer)) bind(declaration, declaration.getName(), initializer);
    else if (
      Node.isCallExpression(initializer) &&
      isProvenanceCall(initializer, imports, ["effect", "effect/Effect"], "Effect", ["fn", "fnUntraced"])
    ) {
      const body = A.head(effectVitestTestCallbacks(initializer, imports));
      if (O.isSome(body)) bind(declaration, declaration.getName(), body.value);
    }
  };
  for (const declaration of imports.variables) bindVariableHelper(declaration);
  // Literal callbacks to known Effect/property constructors execute as part of
  // their owner. Unknown callback APIs retain reachability with judgment only.
  const connectLiteralCallback = (node: EffectVitestFunctionNode): void => {
    if (
      O.isSome(MutableHashMap.get(boundFunctions, node.getStart())) ||
      O.isSome(MutableHashMap.get(modes, node.getStart()))
    )
      return;
    const parent = node.getParent();
    if (!Node.isCallExpression(parent) || !A.some(parent.getArguments(), (argument) => argument === node)) return;
    const value = MutableHashMap.get(vertices, node.getStart());
    if (O.isNone(value)) return;
    const known =
      isProvenanceCall(parent, imports, ["effect", "effect/Effect"], "Effect", [
        "gen",
        "fn",
        "fnUntraced",
        "map",
        "flatMap",
        "tap",
        "sync",
        "suspend",
        "acquireRelease",
        "acquireUseRelease",
      ]) ||
      isProvenanceCall(
        parent,
        imports,
        ["effect/unstable/arbitrary", "effect/unstable/arbitrary/Arbitrary"],
        "Arbitrary",
        ["checkEffect"]
      ) ||
      isProvenanceCall(parent, imports, ["effect/testing", "effect/testing/FastCheck", "fast-check"], "FastCheck", [
        "property",
        "asyncProperty",
      ]);
    value.value.uncertain = !known;
    owner(node).callees.push(value.value);
  };
  for (const node of functions) connectLiteralCallback(node);
  const connectRegistrationArgument = (
    reference: Identifier,
    parent: CallExpression,
    target: FunctionReachability
  ): void => {
    const registration = classifyHarnessCall(parent, imports);
    if (O.isSome(registration) && registration.value !== "layer" && parent.getArguments()[0] !== reference) {
      target.plain ||= registration.value === "plain";
      target.effect ||= registration.value === "effect" || registration.value === "live";
      target.testClock ||= registration.value === "effect";
    } else {
      target.uncertain = true;
      owner(reference).callees.push(target);
    }
  };
  const connectReferenceTarget = (
    reference: Identifier,
    parent: MorphNode | undefined,
    target: FunctionReachability
  ): void => {
    if (Node.isCallExpression(parent) && parent.getExpression() === reference) {
      owner(reference).callees.push(target);
    } else if (Node.isCallExpression(parent) && A.some(parent.getArguments(), (argument) => argument === reference)) {
      connectRegistrationArgument(reference, parent, target);
    } else {
      // An exported/value-escaping function may have callers this file cannot
      // enumerate. Do not turn a test path into exclusive ownership evidence.
      target.outside = true;
    }
  };
  const connectHelperReference = (reference: Identifier): void => {
    if (O.isNone(MutableHashMap.get(names, reference.getText()))) return;
    const parent = reference.getParent();
    if (reference.getFirstAncestor(Node.isTypeNode) !== undefined) return;
    if (isPropertyName(reference, parent)) return;
    const declaration = imports.resolveBinding(reference);
    if (O.isNone(declaration)) return;
    const target = MutableHashMap.get(bindings, declaration.value.getStart());
    if (O.isNone(target)) return;
    if (isDeclarationName(reference, declaration.value)) return;
    connectReferenceTarget(reference, parent, target.value);
  };
  for (const reference of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) connectHelperReference(reference);
  const queue = [
    module,
    ...A.map(functions, (node) => O.getOrElse(MutableHashMap.get(vertices, node.getStart()), () => module)),
  ];
  const propagateReachability = (from: FunctionReachability, to: FunctionReachability): void => {
    if (addsReachability(from, to)) {
      to.plain ||= from.plain;
      to.effect ||= from.effect;
      to.testClock ||= from.testClock;
      to.outside ||= from.outside;
      to.uncertain ||= from.uncertain;
      queue.push(to);
    }
  };
  const propagateAll = (): void => {
    for (let index = 0; index < queue.length; index++) {
      const from = queue[index];
      if (from === undefined) continue;
      for (const to of from.callees) propagateReachability(from, to);
    }
  };
  propagateAll();
  return (node) => {
    const value = owner(node);
    return O.flatMap(value.node, (callback) =>
      value.plain || value.effect
        ? O.some({
            callback,
            effect: value.effect,
            testClock: value.testClock,
            plain: value.plain,
            shared: value.outside || value.uncertain,
          })
        : O.none()
    );
  };
};

/**
 * Index callback registration modes once for repeated per-node detector queries.
 *
 * **Example** (Build a syntax-only harness index)
 *
 * ```ts
 * import { Project } from "ts-morph"
 * import { collectEffectVitestImports, createEffectVitestHarnessIndex } from "@beep/repo-cli/commands/Lint"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("a.test.ts", "")
 * const index = createEffectVitestHarnessIndex(source, collectEffectVitestImports(source))
 * console.log(index.enclosingTest(source)._tag) // "None"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const createEffectVitestHarnessIndex: {
  (sourceFile: SourceFile, imports: EffectVitestImports): EffectVitestHarnessIndex;
  (imports: EffectVitestImports): (sourceFile: SourceFile) => EffectVitestHarnessIndex;
} = dual(2, (sourceFile: SourceFile, imports: EffectVitestImports) => {
  const calls = imports.calls;
  const modes = MutableHashMap.empty<number, EffectVitestHarnessMode>();
  const modeFromMembers = (members: ReadonlyArray<string>): EffectVitestHarnessMode => {
    if (A.contains(members, "layer")) return "layer";
    if (A.contains(members, "effect")) return "effect";
    if (A.contains(members, "live")) return "live";
    return "plain";
  };
  const registerCallbacks = (call: CallExpression, mode: EffectVitestHarnessMode): boolean => {
    let changed = false;
    const callbacks = effectVitestTestCallbacks(call, imports);
    for (const callback of callbacks) {
      if (O.isNone(MutableHashMap.get(modes, callback.getStart()))) {
        MutableHashMap.set(modes, callback.getStart(), mode);
        changed = true;
      }
    }
    return changed;
  };
  const layerCalls = A.empty<{
    readonly call: CallExpression;
    readonly owner: EffectVitestFunctionNode;
    readonly members: ReadonlyArray<string>;
  }>();
  for (const call of calls) {
    const chain = expressionChain(call.getExpression(), imports);
    if (O.isNone(chain)) continue;
    if (importedHarnessChain(chain.value, imports)) {
      registerCallbacks(call, modeFromMembers(importedHarnessMembers(chain.value, imports)));
    }
    const owner = layerTesterOwner(chain.value.base, imports);
    if (O.isSome(owner)) layerCalls.push({ call, owner: owner.value, members: chain.value.members });
  }
  // Only parameter-based testers depend on the fixed point. Their lexical
  // owners are invariant; retain the same call order on every propagation pass.
  const propagateLayerRegistrations = (): void => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const { call, owner, members } of layerCalls) {
        if (O.contains(MutableHashMap.get(modes, owner.getStart()), "layer")) {
          changed = registerCallbacks(call, modeFromMembers(members)) || changed;
        }
      }
    }
  };
  propagateLayerRegistrations();
  const lookup = (node: MorphNode, layer: boolean) => {
    let current: MorphNode | undefined = node.getParent();
    while (current !== undefined) {
      const callback = current;
      current = current.getParent();
      if (!functionNode(callback)) continue;
      const mode = MutableHashMap.get(modes, callback.getStart());
      if (O.exists(mode, (value) => (value === "layer") === layer)) return O.map(mode, (mode) => ({ callback, mode }));
    }
    return O.none<{ readonly callback: EffectVitestFunctionNode; readonly mode: EffectVitestHarnessMode }>();
  };
  let helpers = O.none<EffectVitestHarnessIndex["reachableHelper"]>();
  return {
    reachableHelper: (node: MorphNode) => {
      const lookup = O.getOrElse(helpers, () => {
        const created = helperReachability(sourceFile, imports, modes);
        helpers = O.some(created);
        return created;
      });
      return lookup(node);
    },
    enclosingLayerBlock: (node: MorphNode) => O.map(lookup(node, true), ({ callback }) => callback),
    enclosingTest: (node: MorphNode) =>
      O.flatMap(lookup(node, false), ({ callback, mode }) =>
        mode === "layer" ? O.none() : O.some({ callback, mode })
      ),
  };
});

/**
 * Identify a resource wrapper call supplied directly as a registered test body.
 *
 * **Example** (Recognize a direct wrapper body)
 *
 * ```ts
 * import { collectEffectVitestImports, rootTestBodyCall } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "wrapper.test.ts",
 *   'import { it } from "@effect/vitest"; it.effect("works", withRepo(program))'
 * )
 * const wrapper = A.last(source.getDescendantsOfKind(SyntaxKind.CallExpression))
 * console.log(O.exists(wrapper, (call) => rootTestBodyCall(call, collectEffectVitestImports(source)))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const rootTestBodyCall: {
  (call: CallExpression, imports: EffectVitestImports): boolean;
  (imports: EffectVitestImports): (call: CallExpression) => boolean;
} = dual(2, (call: CallExpression, imports: EffectVitestImports) => {
  const parent = call.getParent();
  return (
    Node.isCallExpression(parent) &&
    A.some(parent.getArguments(), (argument) => argument === call) &&
    O.exists(classifyHarnessCall(parent, imports), (mode) => mode !== "layer")
  );
});

/**
 * Distinguish a redundant whole-body call from a deliberate shorter inner lifetime.
 *
 * **Example** (Recognize a whole callback body)
 *
 * ```ts
 * import { isWholeBodyCall, sourceFunctionDefinitions } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("scope.ts", "const body = () => Effect.scoped(program)")
 * const definition = A.head(sourceFunctionDefinitions(source))
 * const call = A.head(source.getDescendantsOfKind(SyntaxKind.CallExpression))
 * console.log(O.exists(definition, ({ node }) => O.exists(call, (value) => isWholeBodyCall(value, node)))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const isWholeBodyCall: {
  (call: CallExpression, callback: EffectVitestFunctionNode): boolean;
  (callback: EffectVitestFunctionNode): (call: CallExpression) => boolean;
} = dual(2, (call: CallExpression, callback: EffectVitestFunctionNode) => {
  const body = callback.getBody();
  if (body === undefined) return false;
  if (Node.isCallExpression(body)) return body === call;
  if (!Node.isBlock(body)) return false;
  const statements = body.getStatements();
  if (statements.length !== 1) return false;
  const statement = statements[0];
  return (
    (Node.isReturnStatement(statement) && statement.getExpression() === call) ||
    (Node.isExpressionStatement(statement) && statement.getExpression() === call)
  );
});

/**
 * Locate named functions, const arrows, and Effect function wrappers in one source file.
 *
 * **Example** (Collect both declaration styles)
 *
 * ```ts
 * import { sourceFunctionDefinitions } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "wrappers.ts",
 *   "function withOne() {} const withTwo = () => program"
 * )
 * console.log(A.map(sourceFunctionDefinitions(source), ({ name }) => name)) // ["withOne", "withTwo"]
 * ```
 *
 * @param sourceFile - Source file whose named function declarations and initialized variables are inspected.
 * @returns Named functions and directly wrapped function initializers available for local analysis.
 * @category parsing
 * @since 0.0.0
 */
export const sourceFunctionDefinitions = (
  sourceFile: SourceFile
): ReadonlyArray<{ readonly name: string; readonly node: EffectVitestFunctionNode }> => {
  const declarations = A.flatMap(
    sourceFile.getVariableDeclarations(),
    (declaration): ReadonlyArray<{ readonly name: string; readonly node: EffectVitestFunctionNode }> => {
      const initializer = declaration.getInitializer();
      if (initializer === undefined) return [];
      if (functionNode(initializer)) return [{ name: declaration.getName(), node: initializer }];
      if (Node.isCallExpression(initializer)) {
        const wrapped = A.findFirst(initializer.getArguments(), functionNode);
        return O.match(wrapped, { onNone: () => [], onSome: (node) => [{ name: declaration.getName(), node }] });
      }
      return [];
    }
  );
  return [
    ...A.flatMap(
      sourceFile.getFunctions(),
      (node): ReadonlyArray<{ readonly name: string; readonly node: EffectVitestFunctionNode }> =>
        O.match(O.fromUndefinedOr(node.getName()), { onNone: () => [], onSome: (name) => [{ name, node }] })
    ),
    ...declarations,
  ];
};

/**
 * Render a dotted callee label for evidence without treating text as provenance.
 *
 * **Example** (Render a namespace call)
 *
 * ```ts
 * import { callLabel } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("call.ts", "Effect.runSync(program)")
 * console.log(O.map(A.head(source.getDescendantsOfKind(SyntaxKind.CallExpression)), callLabel)) // Some("Effect.runSync")
 * ```
 *
 * @param call - Call expression whose callee text is rendered as evidence.
 * @returns The callee source text, without inferring import provenance.
 * @category formatting
 * @since 0.0.0
 */
export const callLabel = (call: CallExpression): string => call.getExpression().getText();

/**
 * Collapse source evidence to one whitespace-normalized line of at most 200 characters.
 *
 * **Example** (Compact multiline evidence)
 *
 * ```ts
 * import { compactEvidence } from "@beep/repo-cli/commands/Lint"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("evidence.ts", "const value =\n  subject()")
 * console.log(compactEvidence(source)) // "const value = subject()"
 * ```
 *
 * @param node - Syntax node whose source text supplies display evidence.
 * @returns Whitespace-normalized display text truncated to at most 200 characters.
 * @category formatting
 * @since 0.0.0
 */
export const compactEvidence = (node: MorphNode): string =>
  Str.trim(Str.slice(0, 200)(Str.replaceAll(/\s+/gu, " ")(node.getText())));

/**
 * Collect every call expression lexically contained by a callback node.
 *
 * **Example** (Count callback calls)
 *
 * ```ts
 * import { callbackCalls, sourceFunctionDefinitions } from "@beep/repo-cli/commands/Lint"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("callback.ts", "const run = () => one(two())")
 * const definition = A.head(sourceFunctionDefinitions(source))
 * console.log(O.map(definition, ({ node }) => callbackCalls(node).length)) // Some(2)
 * ```
 *
 * @param callback - Function node whose lexical descendants are inspected.
 * @returns Descendant call expressions, including calls inside nested functions.
 * @category parsing
 * @since 0.0.0
 */
export const callbackCalls = (callback: EffectVitestFunctionNode): ReadonlyArray<CallExpression> =>
  callback.getDescendantsOfKind(SyntaxKind.CallExpression);
