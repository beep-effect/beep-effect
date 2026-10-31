/**
 * Static runtime import graph and command-tree walk behind the per-task
 * policy fingerprint.
 *
 * **Details**
 *
 * The graph is read from source text with the TypeScript parser, never by
 * loading modules, so the same code computes a fingerprint for the live
 * checkout, a test fixture or a historical tree. Type-only edges are skipped;
 * every other static, side-effect, re-export and literal dynamic import is an
 * edge. Workspace specifiers resolve through each package's `exports` map;
 * other bare specifiers are external and end the walk.
 * Graph records are private implementation types, not public wire models.
 * Consumers derive their local record types from the graph reader signatures;
 * the exported source-tree interface describes runtime capabilities.
 *
 * A command path is resolved by walking `Command.make("<name>")` and
 * `Command.withSubcommands([...])` from the root command. Every command on
 * the path contributes its module and that module's imports, except an import
 * whose bindings are only that command's subcommands: those siblings are not
 * run by the path. The dispatch modules (`bin.ts`, `bin-main.ts`, `Root.ts`)
 * reach every command group; their edges into `src/commands` are cut the same
 * way and only the argv path is followed.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { ts } from "ts-morph";
import { PolicyFingerprintError } from "../PolicyFingerprint.schemas.ts";

/**
 * The file tree a fingerprint is computed from, addressed by repo-relative
 * POSIX paths.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface PolicySourceTree {
  /** Every file under a directory, recursively, as repo-relative paths. */
  readonly files: (directory: string) => Effect.Effect<ReadonlyArray<string>, PolicyFingerprintError>;
  /** The text of one file, or `Option.none()` when it does not exist. */
  readonly read: (file: string) => Effect.Effect<O.Option<string>, PolicyFingerprintError>;
}

/**
 * One workspace package: its directory and raw `exports` / `imports` maps.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
interface PolicyWorkspace {
  readonly directory: string;
  readonly exports: unknown;
  readonly imports: unknown;
  readonly name: string;
}

/**
 * The fixed entry points of the CLI being fingerprinted.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
interface PolicyCliLayout {
  /** Directory holding every command module; dispatch edges into it are cut. */
  readonly commandsDirectory: string;
  /** The root command's binding in `rootModule`. */
  readonly rootBinding: string;
  /** The module that defines the root command. */
  readonly rootModule: string;
  /** Shell modules loaded for every invocation; their edges into `commandsDirectory` are cut. */
  readonly shell: ReadonlyArray<string>;
}

interface ClosureEntry {
  readonly cut: (specifier: string, target: string) => boolean;
  readonly module: string;
}

interface ImportEdge {
  /** Local names bound by a named or default import; `none` for namespace, side-effect, re-export or dynamic edges. */
  readonly bindings: O.Option<ReadonlyArray<string>>;
  /** A literal `import("...")` expression rather than a declaration. */
  readonly dynamic: boolean;
  readonly specifier: string;
}

type ExportTarget =
  | { readonly _tag: "Local"; readonly local: string }
  | { readonly _tag: "From"; readonly specifier: string; readonly imported: string };

interface CommandDefinition {
  readonly name: O.Option<string>;
  /** One entry per subcommand: the local binding, or `none` for an expression the walk cannot name. */
  readonly subcommands: ReadonlyArray<O.Option<string>>;
}

interface ModuleSyntax {
  readonly commands: HashMap.HashMap<string, CommandDefinition>;
  readonly edges: ReadonlyArray<ImportEdge>;
  readonly exports: HashMap.HashMap<string, ExportTarget>;
  readonly imports: HashMap.HashMap<string, { readonly specifier: string; readonly imported: string }>;
  readonly opaqueDynamicImport: boolean;
  readonly starExports: ReadonlyArray<string>;
}

const CLI_COMMAND_MODULE = "effect/cli/Command";

const collectSome = <A, B>(values: Iterable<A>, f: (value: A) => O.Option<B>): Array<B> =>
  A.getSomes(A.map(A.fromIterable(values), f));

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isNonNullExpression(node)
    ? unwrap(node.expression)
    : node;

const isNamespaceCall = (node: ts.Expression, namespaces: HashSet.HashSet<string>, member: string) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  HashSet.has(namespaces, node.expression.expression.text) &&
  node.expression.name.text === member;

const stringLiteral = (node: ts.Expression | undefined): O.Option<string> =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? O.some(node.text)
    : O.none();

const elementBinding = (node: ts.Expression): O.Option<string> => {
  const inner = unwrap(node);
  return ts.isIdentifier(inner) ? O.some(inner.text) : O.none();
};

interface ModuleScan {
  arrays: HashMap.HashMap<string, ReadonlyArray<ts.Expression>>;
  readonly definitions: Array<readonly [string, ts.Expression]>;
  readonly edges: Array<ImportEdge>;
  exports: ModuleSyntax["exports"];
  imports: ModuleSyntax["imports"];
  namespaces: HashSet.HashSet<string>;
  readonly starExports: Array<string>;
}

const namedImportLocals = (state: ModuleScan, clause: ts.ImportClause, specifier: string): Array<string> => {
  const locals: Array<string> = [];
  if (clause.name !== undefined) {
    locals.push(clause.name.text);
    state.imports = HashMap.set(state.imports, clause.name.text, { specifier, imported: "default" });
  }
  const named = clause.namedBindings;
  if (named === undefined || !ts.isNamedImports(named)) return locals;
  for (const element of named.elements) {
    if (element.isTypeOnly) continue;
    locals.push(element.name.text);
    state.imports = HashMap.set(state.imports, element.name.text, {
      specifier,
      imported: element.propertyName?.text ?? element.name.text,
    });
  }
  return locals;
};

const scanImport = (state: ModuleScan, statement: ts.ImportDeclaration): void => {
  if (!ts.isStringLiteral(statement.moduleSpecifier)) return;
  const clause = statement.importClause;
  const specifier = statement.moduleSpecifier.text;
  if (clause?.phaseModifier === ts.SyntaxKind.TypeKeyword) return;
  if (clause === undefined) {
    state.edges.push({ specifier, bindings: O.none(), dynamic: false });
    return;
  }
  const named = clause.namedBindings;
  if (named !== undefined && ts.isNamespaceImport(named)) {
    if (specifier === CLI_COMMAND_MODULE) state.namespaces = HashSet.add(state.namespaces, named.name.text);
    state.edges.push({ specifier, bindings: O.none(), dynamic: false });
    return;
  }
  state.edges.push({ specifier, bindings: O.some(namedImportLocals(state, clause, specifier)), dynamic: false });
};

const scanNamedExports = (state: ModuleScan, clause: ts.NamedExports, specifier: O.Option<string>): void => {
  for (const element of clause.elements) {
    if (element.isTypeOnly) continue;
    const local = element.propertyName?.text ?? element.name.text;
    state.exports = HashMap.set(
      state.exports,
      element.name.text,
      O.isSome(specifier) ? { _tag: "From", specifier: specifier.value, imported: local } : { _tag: "Local", local }
    );
  }
};

const scanExport = (state: ModuleScan, statement: ts.ExportDeclaration): void => {
  if (statement.isTypeOnly) return;
  const specifier =
    statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
      ? O.some(statement.moduleSpecifier.text)
      : O.none<string>();
  const clause = statement.exportClause;
  if (O.isSome(specifier)) {
    state.edges.push({ specifier: specifier.value, bindings: O.none(), dynamic: false });
    if (clause === undefined) state.starExports.push(specifier.value);
  }
  if (clause !== undefined && ts.isNamedExports(clause)) scanNamedExports(state, clause, specifier);
};

const scanVariableDeclaration = (state: ModuleScan, declaration: ts.VariableDeclaration, exported: boolean): void => {
  if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) return;
  const name = declaration.name.text;
  if (exported) state.exports = HashMap.set(state.exports, name, { _tag: "Local", local: name });
  const initializer = unwrap(declaration.initializer);
  if (ts.isArrayLiteralExpression(initializer)) state.arrays = HashMap.set(state.arrays, name, initializer.elements);
  state.definitions.push([name, initializer]);
};

const scanVariables = (state: ModuleScan, statement: ts.VariableStatement): void => {
  const exported = A.some(statement.modifiers ?? [], (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  A.forEach(statement.declarationList.declarations, (declaration) =>
    scanVariableDeclaration(state, declaration, exported)
  );
};

const scanStatement = (state: ModuleScan, statement: ts.Statement): void => {
  if (ts.isImportDeclaration(statement)) scanImport(state, statement);
  else if (ts.isExportDeclaration(statement)) scanExport(state, statement);
  else if (ts.isVariableStatement(statement)) scanVariables(state, statement);
};

const scanDynamicImports = (state: ModuleScan, source: ts.SourceFile): boolean => {
  let opaque = false;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = stringLiteral(node.arguments[0]);
      if (O.isSome(specifier)) state.edges.push({ specifier: specifier.value, bindings: O.none(), dynamic: true });
      else opaque = true;
    }
    if (ts.isImportTypeNode(node)) return;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return opaque;
};

interface CommandAnalysisContext {
  readonly arrays: ModuleScan["arrays"];
  readonly namespaces: HashSet.HashSet<string>;
}
interface CommandAnalysis {
  readonly make: O.Option<ts.CallExpression>;
  readonly subcommands: ReadonlyArray<O.Option<string>>;
}

const elementBindings = (elements: ReadonlyArray<ts.Expression>): ReadonlyArray<O.Option<string>> =>
  A.map(elements, (element) => (ts.isSpreadElement(element) ? O.none() : elementBinding(element)));

const subcommandElements = (node: ts.Expression, context: CommandAnalysisContext): ReadonlyArray<O.Option<string>> => {
  const inner = unwrap(node);
  if (ts.isArrayLiteralExpression(inner)) return elementBindings(inner.elements);
  if (ts.isIdentifier(inner))
    return O.match(HashMap.get(context.arrays, inner.text), {
      onNone: () => [O.none()],
      onSome: elementBindings,
    });
  return [O.none()];
};

const analyzeWithSubcommands = (call: ts.CallExpression, context: CommandAnalysisContext): CommandAnalysis => {
  const [self, subcommands] = call.arguments;
  const base = self === undefined ? { make: O.none(), subcommands: [] } : analyzeCommand(self, context);
  return {
    make: base.make,
    subcommands: [...base.subcommands, ...(subcommands === undefined ? [] : subcommandElements(subcommands, context))],
  };
};

const pipedSubcommands = (
  argument: ts.Expression,
  context: CommandAnalysisContext
): ReadonlyArray<O.Option<string>> => {
  const call = unwrap(argument);
  return ts.isCallExpression(call) && isNamespaceCall(call, context.namespaces, "withSubcommands")
    ? A.flatMap(call.arguments, (node) => subcommandElements(node, context))
    : [];
};

const analyzeCommand = (node: ts.Expression, context: CommandAnalysisContext): CommandAnalysis => {
  const inner = unwrap(node);
  if (!ts.isCallExpression(inner)) return { make: O.none(), subcommands: [] };
  if (isNamespaceCall(inner, context.namespaces, "make")) return { make: O.some(inner), subcommands: [] };
  if (isNamespaceCall(inner, context.namespaces, "withSubcommands") && inner.arguments.length === 2)
    return analyzeWithSubcommands(inner, context);
  if (ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === "pipe") {
    const base = analyzeCommand(inner.expression.expression, context);
    return {
      make: base.make,
      subcommands: [
        ...base.subcommands,
        ...A.flatMap(inner.arguments, (argument) => pipedSubcommands(argument, context)),
      ],
    };
  }
  return { make: O.none(), subcommands: [] };
};

const commandsOf = (state: ModuleScan): ModuleSyntax["commands"] => {
  let commands = HashMap.empty<string, CommandDefinition>();
  for (const [name, initializer] of state.definitions) {
    const analysis = analyzeCommand(initializer, state);
    if (O.isSome(analysis.make))
      commands = HashMap.set(commands, name, {
        name: stringLiteral(analysis.make.value.arguments[0]),
        subcommands: analysis.subcommands,
      });
  }
  return commands;
};

/**
 * Read the import edges, export map and command definitions of one module.
 *
 * **Example** (Read a module's runtime edges)
 *
 * ```ts
 * import { moduleSyntax } from "@beep/repo-cli/test/Lint"
 *
 * const syntax = moduleSyntax("a.ts", 'import type { T } from "./t.ts"\nimport { b } from "./b.ts"')
 * console.log(syntax.edges.length) // 1
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const moduleSyntax: {
  (text: string): (file: string) => ModuleSyntax;
  (file: string, text: string): ModuleSyntax;
} = dual(2, (file: string, text: string): ModuleSyntax => {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    false,
    Str.endsWith("x")(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const state: ModuleScan = {
    edges: [],
    starExports: [],
    imports: HashMap.empty(),
    exports: HashMap.empty(),
    namespaces: HashSet.empty(),
    arrays: HashMap.empty(),
    definitions: [],
  };
  A.forEach(source.statements, (statement) => scanStatement(state, statement));
  const opaqueDynamicImport = scanDynamicImports(state, source);
  return {
    edges: state.edges,
    imports: state.imports,
    exports: state.exports,
    starExports: state.starExports,
    commands: commandsOf(state),
    opaqueDynamicImport,
  };
});

const RUNTIME_EXPORT_CONDITIONS = ["bun", "import", "node", "default"] as const;

const exportTarget = (value: unknown): O.Option<string> => {
  if (P.isString(value)) return O.some(value);
  if (A.isArray(value)) return A.findFirst(A.map(value, exportTarget), O.isSome).pipe(O.flatten);
  if (P.isObject(value) && !A.isArray(value)) {
    const record = value as Readonly<Record<string, unknown>>;
    return pipe(
      RUNTIME_EXPORT_CONDITIONS,
      A.findFirst((condition) => R.has(record, condition)),
      O.flatMap((condition) => exportTarget(record[condition]))
    );
  }
  return O.none();
};

/**
 * Resolve a subpath key (`"."`, `"./sub"`, `"#internal"`) against an
 * `exports` or `imports` map, with single-`*` patterns and Bun's runtime
 * conditions.
 *
 * **Example** (Resolve a wildcard subpath)
 *
 * ```ts
 * import { resolvePackageSubpath } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrUndefined(resolvePackageSubpath({ "./*": "./src/*.ts" }, "./A"))) // "./src/A.ts"
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const resolvePackageSubpath: {
  (key: string): (map: unknown) => O.Option<string>;
  (map: unknown, key: string): O.Option<string>;
} = dual(2, (map: unknown, key: string): O.Option<string> => {
  if (P.isString(map) || A.isArray(map)) return key === "." ? exportTarget(map) : O.none();
  if (!P.isObject(map)) return O.none();
  const record = map as Readonly<Record<string, unknown>>;
  if (R.has(record, key)) return exportTarget(record[key]);
  const patterns = pipe(
    R.keys(record),
    A.filter((pattern) => {
      const [prefix, suffix] = Str.split(pattern, "*");
      return (
        A.length(Str.split(pattern, "*")) === 2 &&
        prefix !== undefined &&
        suffix !== undefined &&
        Str.startsWith(prefix)(key) &&
        Str.endsWith(suffix)(key) &&
        key.length >= prefix.length + suffix.length
      );
    }),
    A.sort(Order.mapInput(Order.Number, (pattern: string) => -pattern.length))
  );
  return pipe(
    A.head(patterns),
    O.flatMap((pattern) => {
      const [prefix = "", suffix = ""] = Str.split(pattern, "*");
      const captured = Str.slice(prefix.length, key.length - suffix.length)(key);
      return O.map(exportTarget(record[pattern]), Str.replaceAll("*", captured));
    })
  );
});

const joinPath = (...parts: ReadonlyArray<string>): string =>
  A.join(
    A.reduce(A.flatMap(parts, Str.split("/")), A.empty<string>(), (segments, part) =>
      part === ".." ? A.dropRight(segments, 1) : part === "." || part === "" ? segments : A.append(segments, part)
    ),
    "/"
  );

const directoryOf = (file: string): string => A.join(A.dropRight(Str.split(file, "/"), 1), "/");

const TYPESCRIPT_SOURCE = /\.(?:ts|tsx|mts|cts)$/;

/**
 * The resolved graph a fingerprint key reaches.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
interface PolicyClosure {
  /** Every module reached, repo-relative. */
  readonly modules: HashSet.HashSet<string>;
  /** Workspace directories whose sources hold a non-literal dynamic import that was reached. */
  readonly opaqueWorkspaces: HashSet.HashSet<string>;
}

/**
 * One resolved command on an argv path.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
interface PolicyCommandNode {
  readonly binding: string;
  readonly module: string;
  readonly name: string;
}

/**
 * What a {@link makePolicyGraph} reader walks.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
interface PolicyGraphOptions {
  readonly tree: PolicySourceTree;
  readonly workspaces: ReadonlyArray<PolicyWorkspace>;
}

/**
 * Build a graph reader over a source tree and its workspaces.
 *
 * **Details**
 *
 * The reader caches parsed modules, so one reader serves every key of a
 * fingerprint computation.
 *
 * **Example** (Create a graph reader)
 *
 * ```ts
 * import { makePolicyGraph } from "@beep/repo-cli/test/Lint"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const tree = { read: () => Effect.succeed(O.none()), files: () => Effect.succeed([]) }
 * const graph = makePolicyGraph({ tree, workspaces: [] })
 * console.log(typeof graph.closure) // "function"
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 * @returns Cached graph reader with source, resolution and closure operations.
 */
export const makePolicyGraph = ({ tree, workspaces }: PolicyGraphOptions) => {
  const byName = HashMap.fromIterable(A.map(workspaces, (workspace) => [workspace.name, workspace] as const));
  const byDepth = A.sort(
    workspaces,
    Order.mapInput(Order.Number, (workspace: PolicyWorkspace) => -workspace.directory.length)
  );
  const syntaxCache = MutableHashMap.empty<string, O.Option<ModuleSyntax>>();

  const workspaceOf = (file: string): O.Option<PolicyWorkspace> =>
    A.findFirst(byDepth, (workspace) => Str.startsWith(`${workspace.directory}/`)(file));

  const syntaxOf = Effect.fnUntraced(function* (file: string) {
    const cached = MutableHashMap.get(syntaxCache, file);
    if (O.isSome(cached)) return cached.value;
    const text = yield* tree.read(file);
    const syntax = O.map(text, (content) =>
      TYPESCRIPT_SOURCE.test(file)
        ? moduleSyntax(file, content)
        : {
            edges: [],
            opaqueDynamicImport: false,
            imports: HashMap.empty(),
            exports: HashMap.empty(),
            starExports: [],
            commands: HashMap.empty(),
          }
    );
    MutableHashMap.set(syntaxCache, file, syntax);
    return syntax;
  });

  const exists = Effect.fnUntraced(function* (file: string) {
    return O.isSome(yield* syntaxOf(file));
  });

  const resolveRelative = Effect.fnUntraced(function* (from: string, specifier: string) {
    const base = joinPath(directoryOf(from), specifier);
    const candidates = Str.endsWith(".js")(base)
      ? [`${Str.slice(0, -3)(base)}.ts`, `${Str.slice(0, -3)(base)}.tsx`, base]
      : [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
    for (const candidate of candidates) if (yield* exists(candidate)) return O.some(candidate);
    return O.none<string>();
  });

  /** Resolve one specifier from a module; external packages resolve to `none`. */
  const resolve = Effect.fnUntraced(function* (from: string, specifier: string) {
    if (Str.startsWith(".")(specifier)) return yield* resolveRelative(from, specifier);
    if (Str.startsWith("#")(specifier)) {
      return yield* O.match(workspaceOf(from), {
        onNone: () => Effect.succeed(O.none<string>()),
        onSome: (workspace) =>
          O.match(resolvePackageSubpath(workspace.imports, specifier), {
            onNone: () => Effect.succeed(O.none<string>()),
            onSome: (target) => resolveRelative(`${workspace.directory}/package.json`, target),
          }),
      });
    }
    const segments = Str.split(specifier, "/");
    const name = Str.startsWith("@")(specifier) ? A.join(A.take(segments, 2), "/") : (segments[0] ?? "");
    const workspace = HashMap.get(byName, name);
    if (O.isNone(workspace)) return O.none<string>();
    const key = specifier === name ? "." : `.${Str.slice(name.length)(specifier)}`;
    const target = resolvePackageSubpath(workspace.value.exports, key);
    if (O.isNone(target)) {
      return yield* PolicyFingerprintError.make({
        message: `Cannot resolve workspace specifier ${specifier} imported by ${from}`,
        cause: specifier,
      });
    }
    return yield* resolveRelative(`${workspace.value.directory}/package.json`, target.value);
  });

  type ResolvedBinding = { readonly module: string; readonly local: string };
  const followExport = Effect.fnUntraced(function* (
    module: string,
    target: ExportTarget,
    depth: number
  ): Effect.fn.Return<O.Option<ResolvedBinding>, PolicyFingerprintError> {
    if (target._tag === "Local") return yield* resolveLocal(module, target.local, depth + 1);
    const next = yield* resolve(module, target.specifier);
    return O.isNone(next) ? O.none() : yield* resolveExport(next.value, target.imported, depth + 1);
  });
  const resolveStarExports = Effect.fnUntraced(function* (
    module: string,
    specifiers: ReadonlyArray<string>,
    name: string,
    depth: number
  ): Effect.fn.Return<O.Option<ResolvedBinding>, PolicyFingerprintError> {
    for (const specifier of specifiers) {
      const next = yield* resolve(module, specifier);
      if (O.isNone(next)) continue;
      const found = yield* resolveExport(next.value, name, depth + 1);
      if (O.isSome(found)) return found;
    }
    return O.none();
  });

  const resolveExport: (
    module: string,
    name: string,
    depth: number
  ) => Effect.Effect<O.Option<{ readonly module: string; readonly local: string }>, PolicyFingerprintError> =
    Effect.fnUntraced(function* (module: string, name: string, depth: number) {
      if (depth > 32) return O.none();
      const syntax = yield* syntaxOf(module);
      if (O.isNone(syntax)) return O.none();
      const target = HashMap.get(syntax.value.exports, name);
      if (O.isSome(target)) return yield* followExport(module, target.value, depth);
      return yield* resolveStarExports(module, syntax.value.starExports, name, depth);
    });

  const resolveLocal = Effect.fnUntraced(function* (module: string, local: string, depth: number) {
    const syntax = yield* syntaxOf(module);
    if (O.isNone(syntax)) return O.none<{ readonly module: string; readonly local: string }>();
    if (HashMap.has(syntax.value.commands, local)) return O.some({ module, local });
    const imported = HashMap.get(syntax.value.imports, local);
    if (O.isNone(imported)) return O.some({ module, local });
    const next = yield* resolve(module, imported.value.specifier);
    return O.isNone(next) ? O.none() : yield* resolveExport(next.value, imported.value.imported, depth + 1);
  });

  const definitionOf = Effect.fnUntraced(function* (module: string, binding: string) {
    const syntax = yield* syntaxOf(module);
    return O.flatMap(syntax, (value) => HashMap.get(value.commands, binding));
  });

  interface ResolvedSubcommand {
    readonly definition: CommandDefinition;
    readonly node: PolicyCommandNode;
  }
  const resolveSubcommand = Effect.fnUntraced(function* (
    module: string,
    element: O.Option<string>,
    token: string
  ): Effect.fn.Return<O.Option<ResolvedSubcommand>, PolicyFingerprintError> {
    if (O.isNone(element)) return O.none();
    const target = yield* resolveLocal(module, element.value, 0);
    if (O.isNone(target)) return O.none();
    const definition = yield* definitionOf(target.value.module, target.value.local);
    if (O.isNone(definition) || !O.contains(definition.value.name, token)) return O.none();
    return O.some({
      node: { module: target.value.module, binding: target.value.local, name: token },
      definition: definition.value,
    });
  });
  const nextCommand = Effect.fnUntraced(function* (module: string, current: CommandDefinition, token: string) {
    for (const element of current.subcommands) {
      const next = yield* resolveSubcommand(module, element, token);
      if (O.isSome(next)) return next;
    }
    return O.none<ResolvedSubcommand>();
  });

  /**
   * Walk argv tokens from the root command. Returns every command on the
   * matched path, root first, and how many tokens it consumed.
   */
  const commandPath = Effect.fnUntraced(function* (layout: PolicyCliLayout, tokens: ReadonlyArray<string>) {
    const rootDefinition = yield* definitionOf(layout.rootModule, layout.rootBinding);
    if (O.isNone(rootDefinition)) {
      return yield* PolicyFingerprintError.make({
        message: `Cannot read the root command ${layout.rootBinding} in ${layout.rootModule}`,
        cause: layout.rootModule,
      });
    }
    const nodes: Array<PolicyCommandNode> = [
      {
        module: layout.rootModule,
        binding: layout.rootBinding,
        name: O.getOrElse(rootDefinition.value.name, () => ""),
      },
    ];
    let current = rootDefinition.value;
    let currentModule = layout.rootModule;
    for (const token of tokens) {
      const next = yield* nextCommand(currentModule, current, token);
      if (O.isNone(next)) break;
      nodes.push(next.value.node);
      current = next.value.definition;
      currentModule = next.value.node.module;
    }
    return nodes;
  });

  /** The specifiers of a command node's module whose imports only bind its subcommands. */
  const subcommandSpecifiers = Effect.fnUntraced(function* (node: PolicyCommandNode) {
    const syntax = yield* syntaxOf(node.module);
    const definition = yield* definitionOf(node.module, node.binding);
    if (O.isNone(syntax) || O.isNone(definition)) return HashSet.empty<string>();
    const subcommands = HashSet.fromIterable(A.getSomes(definition.value.subcommands));
    return HashSet.fromIterable(
      collectSome(syntax.value.edges, (edge) =>
        O.isSome(edge.bindings) &&
        A.isReadonlyArrayNonEmpty(edge.bindings.value) &&
        A.every(edge.bindings.value, (binding) => HashSet.has(subcommands, binding))
          ? O.some(edge.specifier)
          : O.none()
      )
    );
  });

  interface ClosureWalkState {
    expanded: HashSet.HashSet<string>;
    modules: HashSet.HashSet<string>;
    opaqueWorkspaces: HashSet.HashSet<string>;
    readonly pending: Array<ClosureEntry>;
  }
  const noCut = () => false;
  const opaqueWorkspace = (current: HashSet.HashSet<string>, module: string) =>
    O.match(workspaceOf(module), {
      onNone: () => current,
      onSome: (workspace) => HashSet.add(current, workspace.directory),
    });
  const closureTarget = Effect.fnUntraced(function* (item: ClosureEntry, edge: ImportEdge) {
    const target = yield* resolve(item.module, edge.specifier);
    if (O.isNone(target)) {
      if (Str.startsWith(".")(edge.specifier))
        return yield* PolicyFingerprintError.make({
          message: `Cannot resolve ${edge.specifier} imported by ${item.module}`,
          cause: edge.specifier,
        });
      return O.none<string>();
    }
    return item.cut(edge.specifier, target.value) ? O.none<string>() : target;
  });
  const expandClosureItem = Effect.fnUntraced(function* (state: ClosureWalkState, item: ClosureEntry) {
    const full = item.cut === noCut;
    if (full ? HashSet.has(state.expanded, item.module) : HashSet.has(state.modules, item.module)) return;
    state.modules = HashSet.add(state.modules, item.module);
    if (full) state.expanded = HashSet.add(state.expanded, item.module);
    const syntax = yield* syntaxOf(item.module);
    if (O.isNone(syntax))
      return yield* PolicyFingerprintError.make({
        message: `Reached module ${item.module} does not exist`,
        cause: item.module,
      });
    if (syntax.value.opaqueDynamicImport) state.opaqueWorkspaces = opaqueWorkspace(state.opaqueWorkspaces, item.module);
    for (const edge of syntax.value.edges) {
      const target = yield* closureTarget(item, edge);
      if (O.isSome(target)) state.pending.push({ module: target.value, cut: noCut });
    }
  });

  /**
   * The closure of a set of entry modules. An entry with cut specifiers does
   * not follow those edges; a module reached any other way follows all of its
   * edges.
   */
  const closure = Effect.fnUntraced(function* (entries: ReadonlyArray<ClosureEntry>) {
    const state: ClosureWalkState = {
      modules: HashSet.empty(),
      opaqueWorkspaces: HashSet.empty(),
      expanded: HashSet.empty(),
      pending: [...entries],
    };
    while (A.isReadonlyArrayNonEmpty(state.pending)) {
      const item = state.pending.pop();
      if (item === undefined) break;
      yield* expandClosureItem(state, item);
    }
    return { modules: state.modules, opaqueWorkspaces: state.opaqueWorkspaces } satisfies PolicyClosure;
  });

  interface ShellWalkContext {
    readonly entries: HashSet.HashSet<string>;
    readonly insideCommands: (file: string) => boolean;
  }
  interface ShellWalkState {
    modules: HashSet.HashSet<string>;
    opaqueWorkspaces: HashSet.HashSet<string>;
    readonly pending: Array<string>;
  }
  const shellTarget = Effect.fnUntraced(function* (context: ShellWalkContext, module: string, edge: ImportEdge) {
    const target = yield* resolve(module, edge.specifier);
    if (O.isNone(target)) return O.none<string>();
    if (!context.insideCommands(target.value)) return target;
    if (edge.dynamic || HashSet.has(context.entries, module)) return O.none<string>();
    return yield* PolicyFingerprintError.make({
      message: `Shell module ${module} statically imports command module ${target.value}`,
      cause: target.value,
    });
  });
  const expandShellModule = Effect.fnUntraced(function* (
    context: ShellWalkContext,
    state: ShellWalkState,
    module: string
  ) {
    if (HashSet.has(state.modules, module)) return;
    state.modules = HashSet.add(state.modules, module);
    const syntax = yield* syntaxOf(module);
    if (O.isNone(syntax))
      return yield* PolicyFingerprintError.make({ message: `Shell module ${module} does not exist`, cause: module });
    if (syntax.value.opaqueDynamicImport && !HashSet.has(context.entries, module))
      state.opaqueWorkspaces = opaqueWorkspace(state.opaqueWorkspaces, module);
    for (const edge of syntax.value.edges) {
      const target = yield* shellTarget(context, module, edge);
      if (O.isSome(target)) state.pending.push(target.value);
    }
  });

  /**
   * The shell closure: everything the bin loads before it dispatches. The
   * walk never enters the commands directory; only the argv path is followed
   * there. A dispatch edge into it is a declaration in a shell entry or a
   * literal `import()` (a lazy dispatch manifest); a static import of a
   * command module from any other shell module would run that module for
   * every command, so it fails the computation. A shell entry's computed
   * dynamic import (`bin.ts` loading `bin-main.js` by URL) targets another
   * shell entry, so it is not treated as opaque.
   */
  const shellClosure = Effect.fnUntraced(function* (layout: PolicyCliLayout) {
    const context: ShellWalkContext = {
      entries: HashSet.fromIterable(layout.shell),
      insideCommands: Str.startsWith(`${layout.commandsDirectory}/`),
    };
    const state: ShellWalkState = {
      modules: HashSet.empty(),
      opaqueWorkspaces: HashSet.empty(),
      pending: [...layout.shell],
    };
    while (A.isReadonlyArrayNonEmpty(state.pending)) {
      const module = state.pending.pop();
      if (module === undefined) continue;
      yield* expandShellModule(context, state, module);
    }
    return { modules: state.modules, opaqueWorkspaces: state.opaqueWorkspaces } satisfies PolicyClosure;
  });

  /** The closure of one command path, without the shell. */
  const commandClosure = Effect.fnUntraced(function* (nodes: ReadonlyArray<PolicyCommandNode>) {
    const entries = yield* Effect.forEach(nodes, (node) =>
      Effect.map(subcommandSpecifiers(node), (specifiers) => ({
        module: node.module,
        cut: (specifier: string) => HashSet.has(specifiers, specifier),
      }))
    );
    return yield* closure(entries);
  });

  return { workspaceOf, commandPath, shellClosure, commandClosure, closure, resolve, syntaxOf } as const;
};

/**
 * A policy graph reader.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type PolicyGraph = ReturnType<typeof makePolicyGraph>;

/**
 * Render a closure as Turbo inputs: every reached module, each reached
 * workspace manifest, one `src/**\/*.<ext>` glob per non-TypeScript asset
 * extension under each reached `src` (assets are read at runtime, not
 * imported), and the whole `src` of a workspace with an opaque dynamic import.
 *
 * **Details**
 *
 * Files are listed one by one rather than collapsed into directory globs, so
 * the inputs change only when an import edge changes, never when an unrelated
 * file is added. `covered` holds inputs another set already declares (the
 * shared seal); they are dropped.
 *
 * @internal
 * @category rendering
 * @since 0.0.0
 */
export const renderClosureInputs = Effect.fnUntraced(function* (
  tree: PolicySourceTree,
  graph: PolicyGraph,
  reached: PolicyClosure,
  covered: HashSet.HashSet<string>
) {
  const workspaceDirectories = A.sort(
    A.dedupe(
      collectSome(A.fromIterable(reached.modules), (module) => O.map(graph.workspaceOf(module), (w) => w.directory))
    ),
    Order.String
  );
  const inputs: Array<string> = A.fromIterable(reached.modules);
  for (const directory of workspaceDirectories) {
    inputs.push(`${directory}/package.json`);
    if (HashSet.has(reached.opaqueWorkspaces, directory)) {
      inputs.push(`${directory}/src/**`);
      continue;
    }
    const sources = yield* tree.files(`${directory}/src`);
    const extensions = A.dedupe(
      collectSome(sources, (file) => {
        if (TYPESCRIPT_SOURCE.test(file)) return O.none();
        const base = O.getOrElse(A.last(Str.split(file, "/")), () => file);
        return O.map(Str.lastIndexOf(".")(base), (index) => Str.slice(index + 1)(base));
      })
    );
    for (const extension of extensions) inputs.push(`${directory}/src/**/*.${extension}`);
  }
  const opaque = A.map(A.fromIterable(reached.opaqueWorkspaces), (directory) => `${directory}/src/`);
  return A.sort(
    A.dedupe(
      A.filter(
        inputs,
        (input) =>
          !HashSet.has(covered, input) &&
          (Str.endsWith("/src/**")(input) || !A.some(opaque, (prefix) => Str.startsWith(prefix)(input)))
      )
    ),
    Order.String
  );
});
