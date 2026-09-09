/**
 * Hoist Effect Schema compiler construction out of function bodies.
 *
 * The transform is deliberately conservative. It rewrites only calls detected
 * by the policy rule whose compiler arguments resolve to imports or
 * module-scope declarations. Calls depending on function-local bindings and
 * the uncurried `Schema.asserts` adapter are reported for manual migration.
 * Existing equivalent module-scope compiler constants are reused.
 *
 * ```sh
 * # Analyze the files in the opening census.
 * bun goals/inline-schema-compile-hard-error/ops/codemods/hoist-inline-schema-compilers.codemod.ts
 *
 * # Apply safe rewrites.
 * bun goals/inline-schema-compile-hard-error/ops/codemods/hoist-inline-schema-compilers.codemod.ts --write
 * ```
 */
import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { Node, Project, QuoteKind, ScriptTarget, SyntaxKind } from "ts-morph";
import type { CallExpression, Expression, Identifier, Node as MorphNode, SourceFile, Statement } from "ts-morph";

const COMPILER_METHODS = new Set([
  "is",
  "asserts",
  "decodeEffect",
  "decodeExit",
  "decodeOption",
  "decodePromise",
  "decodeResult",
  "decodeSync",
  "decodeUnknownExit",
  "decodeUnknownEffect",
  "decodeUnknownOption",
  "decodeUnknownPromise",
  "decodeUnknownResult",
  "decodeUnknownSync",
  "encodeExit",
  "encodeEffect",
  "encodeOption",
  "encodePromise",
  "encodeResult",
  "encodeSync",
  "encodeUnknownExit",
  "encodeUnknownEffect",
  "encodeUnknownOption",
  "encodeUnknownPromise",
  "encodeUnknownResult",
  "encodeUnknownSync",
]);

const Census = S.Struct({
  files: S.Array(S.Struct({ filename: S.String })),
});
const decodeCensus = S.decodeUnknownSync(S.fromJsonString(Census));

type Candidate = {
  readonly call: CallExpression;
  readonly method: string;
  readonly receiver: string;
};

type SafeCandidate = Candidate & {
  readonly anchorIndex: number;
};

type RewriteGroup = {
  readonly key: string;
  readonly callText: string;
  readonly method: string;
  readonly receiver: string;
  readonly schema: Expression;
  readonly anchorIndex: number;
  readonly calls: Array<CallExpression>;
};

type ManualFinding = {
  readonly filename: string;
  readonly line: number;
  readonly method: string;
  readonly reason: string;
};

type FileResult = {
  readonly filename: string;
  readonly findings: number;
  readonly rewritten: number;
  readonly compilerConstants: number;
  readonly reusedConstants: number;
  readonly orderingRepairs: number;
  readonly manual: ReadonlyArray<ManualFinding>;
};

const isFunctionBoundary = (node: MorphNode): boolean =>
  Node.isFunctionLikeDeclaration(node) || Node.isFunctionExpression(node) || Node.isArrowFunction(node);

const unwrapExpression = (node: MorphNode): MorphNode => {
  if (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isSatisfiesExpression(node) ||
    Node.isTypeAssertion(node) ||
    Node.isNonNullExpression(node)
  ) {
    return unwrapExpression(node.getExpression());
  }
  return node;
};

const schemaAliases = (sourceFile: SourceFile): ReadonlySet<string> => {
  const aliases = new Set<string>();
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.isTypeOnly()) continue;
    const source = declaration.getModuleSpecifierValue();
    if (source === "effect/Schema") {
      const namespaceImport = declaration.getNamespaceImport();
      if (namespaceImport !== undefined) aliases.add(namespaceImport.getText());
      const defaultImport = declaration.getDefaultImport();
      if (defaultImport !== undefined) aliases.add(defaultImport.getText());
    }
    if (source !== "effect" && source !== "effect/Schema") continue;
    for (const namedImport of declaration.getNamedImports()) {
      if (namedImport.getName() !== "Schema") continue;
      aliases.add(namedImport.getAliasNode()?.getText() ?? namedImport.getName());
    }
  }
  return aliases;
};

const schemaMethodCall = (
  node: MorphNode,
  aliases: ReadonlySet<string>
): { readonly call: CallExpression; readonly method: string; readonly receiver: string } | undefined => {
  const expression = unwrapExpression(node);
  if (!Node.isCallExpression(expression)) return undefined;
  const callee = unwrapExpression(expression.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) return undefined;
  const receiver = unwrapExpression(callee.getExpression());
  if (!Node.isIdentifier(receiver) || !aliases.has(receiver.getText())) return undefined;
  return { call: expression, method: callee.getName(), receiver: receiver.getText() };
};

const isStaticSchemaReference = (node: MorphNode): boolean => {
  const expression = unwrapExpression(node);
  if (Node.isIdentifier(expression)) {
    const [first] = expression.getText();
    return first !== undefined && first.toUpperCase() === first;
  }
  if (Node.isPropertyAccessExpression(expression) || Node.isElementAccessExpression(expression)) {
    return isStaticSchemaReference(expression.getExpression());
  }
  return false;
};

const isNestedStaticSchemaCall = (node: MorphNode, aliases: ReadonlySet<string>): boolean => {
  const nested = schemaMethodCall(node, aliases);
  if (nested === undefined) return false;
  const [first] = nested.call.getArguments();
  if (first === undefined) return true;
  const expression = unwrapExpression(first);
  if (
    Node.isIdentifier(expression) ||
    Node.isPropertyAccessExpression(expression) ||
    Node.isElementAccessExpression(expression)
  ) {
    return isStaticSchemaReference(expression);
  }
  const firstNested = schemaMethodCall(expression, aliases);
  return firstNested === undefined || isNestedStaticSchemaCall(expression, aliases);
};

const governedCandidate = (call: CallExpression, aliases: ReadonlySet<string>): Candidate | undefined => {
  const resolved = schemaMethodCall(call, aliases);
  if (resolved === undefined || !COMPILER_METHODS.has(resolved.method)) return undefined;
  if (call.getFirstAncestor(isFunctionBoundary) === undefined) return undefined;
  const [schema] = call.getArguments();
  if (schema === undefined || (!isStaticSchemaReference(schema) && !isNestedStaticSchemaCall(schema, aliases))) {
    return undefined;
  }
  return { call, method: resolved.method, receiver: resolved.receiver };
};

const topLevelStatement = (node: MorphNode): Statement | undefined => {
  let current: MorphNode | undefined = node;
  while (current !== undefined && !Node.isSourceFile(current.getParent())) {
    current = current.getParent();
  }
  return current !== undefined && Node.isStatement(current) ? current : undefined;
};

const isReferenceIdentifier = (identifier: Identifier): boolean => {
  const parent = identifier.getParent();
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) return false;
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier) return false;
  if (Node.isMethodDeclaration(parent) && parent.getNameNode() === identifier) return false;
  if (Node.isPropertyDeclaration(parent) && parent.getNameNode() === identifier) return false;
  if (Node.isPropertySignature(parent) && parent.getNameNode() === identifier) return false;
  return true;
};

const contains = (outer: MorphNode, inner: MorphNode): boolean =>
  outer.getStart() <= inner.getStart() && outer.getEnd() >= inner.getEnd();

const localRuntimeDeclarations = (sourceFile: SourceFile): ReadonlyMap<string, MorphNode> => {
  const declarations = new Map<string, MorphNode>();
  for (const declaration of sourceFile.getVariableDeclarations()) {
    if (declaration.getFirstAncestor(isFunctionBoundary) !== undefined) continue;
    const name = declaration.getNameNode();
    if (Node.isIdentifier(name)) declarations.set(name.getText(), declaration);
  }
  for (const declaration of [...sourceFile.getClasses(), ...sourceFile.getEnums(), ...sourceFile.getFunctions()]) {
    const name = declaration.getNameNode();
    if (name !== undefined) declarations.set(name.getText(), declaration);
  }
  return declarations;
};

const dependencyAnchor = (
  candidate: Candidate,
  sourceFile: SourceFile,
  fallbackDeclarations: ReadonlyMap<string, MorphNode> = localRuntimeDeclarations(sourceFile)
): { readonly anchorIndex: number } | { readonly reason: string } => {
  if (candidate.method === "asserts") {
    return { reason: "Schema.asserts is uncurried and requires the compiled assertion adapter family" };
  }
  if (candidate.call.getTypeArguments().length > 0) {
    return { reason: "compiler call has explicit type arguments requiring manual scope review" };
  }

  const statements = sourceFile.getStatements();
  let anchorIndex = sourceFile.getImportDeclarations().length - 1;
  for (const argument of candidate.call.getArguments()) {
    const identifiers = [
      ...(Node.isIdentifier(argument) ? [argument] : []),
      ...argument.getDescendantsOfKind(SyntaxKind.Identifier),
    ];
    for (const identifier of identifiers) {
      if (!isReferenceIdentifier(identifier)) continue;
      const symbolDeclarations = identifier.getSymbol()?.getDeclarations() ?? [];
      const fallback = fallbackDeclarations.get(identifier.getText());
      const declarations = symbolDeclarations.length > 0 || fallback === undefined ? symbolDeclarations : [fallback];
      for (const declaration of declarations) {
        if (contains(candidate.call, declaration)) continue;
        if (declaration.getSourceFile() !== sourceFile) continue;
        const functionScope = declaration.getFirstAncestor(isFunctionBoundary);
        if (functionScope !== undefined) {
          return { reason: `compiler argument depends on function-local binding ${identifier.getText()}` };
        }
        const statement = topLevelStatement(declaration);
        if (statement !== undefined) {
          anchorIndex = Math.max(anchorIndex, statements.indexOf(statement));
        }
      }
    }
  }
  return { anchorIndex };
};

const repairCompilerOrdering = (sourceFile: SourceFile, aliases: ReadonlySet<string>): number => {
  let repairs = 0;
  for (;;) {
    const statements = sourceFile.getStatements();
    const fallbackDeclarations = localRuntimeDeclarations(sourceFile);
    const misplaced = A.findFirst(sourceFile.getVariableDeclarations(), (declaration) => {
      if (declaration.getFirstAncestor(isFunctionBoundary) !== undefined) return false;
      const initializer = declaration.getInitializer();
      if (initializer === undefined || !Node.isCallExpression(unwrapExpression(initializer))) return false;
      const resolved = schemaMethodCall(initializer, aliases);
      if (resolved === undefined || !COMPILER_METHODS.has(resolved.method) || resolved.method === "asserts")
        return false;
      const statement = topLevelStatement(declaration);
      if (statement === undefined) return false;
      const dependency = dependencyAnchor(resolved, sourceFile, fallbackDeclarations);
      return "anchorIndex" in dependency && dependency.anchorIndex > statements.indexOf(statement);
    });
    if (misplaced._tag === "None") return repairs;

    const declaration = misplaced.value;
    const initializer = declaration.getInitializerOrThrow();
    const resolved = schemaMethodCall(initializer, aliases);
    const statement = topLevelStatement(declaration);
    if (resolved === undefined || statement === undefined) return repairs;
    const dependency = dependencyAnchor(resolved, sourceFile, fallbackDeclarations);
    if (!("anchorIndex" in dependency)) return repairs;
    const statementIndex = statements.indexOf(statement);
    if (statementIndex >= dependency.anchorIndex) return repairs;
    const sourceText = sourceFile.getFullText();
    const statementStart = statement.getStart();
    const statementEnd = statement.getEnd();
    const dependencyEnd = statements[dependency.anchorIndex]?.getEnd();
    if (dependencyEnd === undefined) return repairs;
    sourceFile.replaceWithText(
      `${sourceText.slice(0, statementStart)}${sourceText.slice(statementEnd, dependencyEnd)}\n${statement.getText()}${sourceText.slice(dependencyEnd)}`
    );
    repairs++;
  }
};

const pascal = (text: string): string => {
  const words = text.match(/[A-Za-z0-9]+/gu) ?? [];
  return A.join(
    A.map(words, (word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`),
    ""
  );
};

const schemaName = (node: MorphNode, receiver: string): string => {
  const expression = unwrapExpression(node);
  if (Node.isIdentifier(expression)) return pascal(expression.getText());
  if (Node.isPropertyAccessExpression(expression)) {
    const segments = expression
      .getText()
      .split(".")
      .filter((segment) => segment !== receiver);
    return pascal(A.join(segments, " "));
  }
  if (Node.isElementAccessExpression(expression)) {
    return pascal(expression.getText());
  }
  if (Node.isCallExpression(expression)) {
    const callee = unwrapExpression(expression.getExpression());
    const method = Node.isPropertyAccessExpression(callee) ? callee.getName() : "Schema";
    const [first] = expression.getArguments();
    const inner = first === undefined ? "" : schemaName(first, receiver);
    if (method === "fromJsonString") return `${inner}Json`;
    if (method === "toEncoded") return `Encoded${inner}`;
    if (method === "toType") return `${inner}Type`;
    if (method === "NonEmptyArray") return `NonEmpty${inner}Array`;
    if (method === "Array") return `${inner}Array`;
    return `${pascal(method)}${inner}`;
  }
  return "InlineSchema";
};

const compilerName = (method: string, schema: Expression, receiver: string): string => {
  const match = /^(decode|encode)(Unknown)?(Effect|Exit|Option|Promise|Result|Sync)$/u.exec(method);
  if (match !== null) {
    const [, direction = "decode", unknown = "", adapter = ""] = match;
    return `${direction}${unknown}${schemaName(schema, receiver)}${adapter === "Effect" ? "" : adapter}`;
  }
  return `${method}${schemaName(schema, receiver)}`;
};

const boundNames = (sourceFile: SourceFile): Set<string> =>
  new Set(A.map(sourceFile.getDescendantsOfKind(SyntaxKind.Identifier), (identifier) => identifier.getText()));

const uniqueName = (preferred: string, names: Set<string>): string => {
  if (!names.has(preferred)) {
    names.add(preferred);
    return preferred;
  }
  for (let suffix = 2; ; suffix++) {
    const candidate = `${preferred}${suffix}`;
    if (!names.has(candidate)) {
      names.add(candidate);
      return candidate;
    }
  }
};

const moduleCompilerConstants = (sourceFile: SourceFile): ReadonlyMap<string, string> => {
  const constants = new Map<string, string>();
  for (const statement of sourceFile.getVariableStatements()) {
    if (statement.getFirstAncestor(isFunctionBoundary) !== undefined) continue;
    for (const declaration of statement.getDeclarations()) {
      const initializer = declaration.getInitializer();
      if (initializer !== undefined && Node.isCallExpression(unwrapExpression(initializer))) {
        constants.set(initializer.getText(), declaration.getName());
      }
    }
  }
  return constants;
};

const groupSafeCandidates = (safe: ReadonlyArray<SafeCandidate>): ReadonlyArray<RewriteGroup> => {
  const groups = new Map<string, RewriteGroup>();
  for (const candidate of safe) {
    const callText = candidate.call.getText();
    const key = `${candidate.anchorIndex}\u0000${callText}`;
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.calls.push(candidate.call);
      continue;
    }
    const [schema] = candidate.call.getArguments();
    if (schema === undefined || !Node.isExpression(schema)) continue;
    groups.set(key, {
      key,
      callText,
      method: candidate.method,
      receiver: candidate.receiver,
      schema,
      anchorIndex: candidate.anchorIndex,
      calls: [candidate.call],
    });
  }
  return A.sort(
    A.fromIterable(groups.values()),
    Order.mapInput(Order.String, (group) => group.key)
  );
};

const replaceCompilerCall = (call: CallExpression, compiler: string): void => {
  const declaration = call.getParent();
  if (
    Node.isVariableDeclaration(declaration) &&
    declaration.getInitializer() === call &&
    Node.isIdentifier(declaration.getNameNode())
  ) {
    const statement = declaration.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    const declarationList = declaration.getParentIfKind(SyntaxKind.VariableDeclarationList);
    const references = declaration.getNameNode().findReferencesAsNodes();
    const changesShorthandKey = A.some(references, (reference) =>
      Node.isShorthandPropertyAssignment(reference.getParent())
    );
    if (
      statement !== undefined &&
      declarationList !== undefined &&
      declarationList.getDeclarations().length === 1 &&
      !changesShorthandKey
    ) {
      for (const reference of A.sort(
        references,
        Order.mapInput(Order.Number, (entry) => -entry.getStart())
      )) {
        reference.replaceWithText(compiler);
      }
      statement.remove();
      return;
    }
  }
  call.replaceWithText(compiler);
};

const rewriteSourceFile = (sourceFile: SourceFile, write: boolean): FileResult => {
  const aliases = schemaAliases(sourceFile);
  if (aliases.size === 0) {
    return {
      filename: sourceFile.getFilePath(),
      findings: 0,
      rewritten: 0,
      compilerConstants: 0,
      reusedConstants: 0,
      orderingRepairs: 0,
      manual: [],
    };
  }

  const orderingRepairs = repairCompilerOrdering(sourceFile, aliases);

  const candidates: Array<Candidate> = [];
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const candidate = governedCandidate(call, aliases);
    if (candidate !== undefined) candidates.push(candidate);
  }
  const safe: Array<SafeCandidate> = [];
  const manual: Array<ManualFinding> = [];
  const fallbackDeclarations = localRuntimeDeclarations(sourceFile);
  for (const candidate of candidates) {
    const dependency = dependencyAnchor(candidate, sourceFile, fallbackDeclarations);
    if ("reason" in dependency) {
      manual.push({
        filename: sourceFile.getFilePath(),
        line: candidate.call.getStartLineNumber(),
        method: candidate.method,
        reason: dependency.reason,
      });
    } else {
      safe.push({ ...candidate, anchorIndex: dependency.anchorIndex });
    }
  }

  const groups = groupSafeCandidates(safe);
  const existingConstants = moduleCompilerConstants(sourceFile);
  const names = boundNames(sourceFile);
  const insertions = new Map<number, Array<string>>();
  let rewritten = 0;
  let compilerConstants = 0;
  let reusedConstants = 0;

  for (const group of groups) {
    const existingName = existingConstants.get(group.callText);
    const name = existingName ?? uniqueName(compilerName(group.method, group.schema, group.receiver), names);
    if (existingName === undefined) {
      const statements = insertions.get(group.anchorIndex) ?? [];
      statements.push(`const ${name} = ${group.callText};`);
      insertions.set(group.anchorIndex, statements);
      compilerConstants++;
    } else {
      reusedConstants++;
    }
    for (const call of A.sort(
      group.calls,
      Order.mapInput(Order.Number, (entry) => -entry.getStart())
    )) {
      replaceCompilerCall(call, name);
      rewritten++;
    }
  }

  for (const [anchorIndex, statements] of A.sort(
    A.fromIterable(insertions.entries()),
    Order.mapInput(Order.Number, ([index]) => -index)
  )) {
    sourceFile.insertStatements(anchorIndex + 1, statements);
  }

  if (write && (rewritten > 0 || orderingRepairs > 0)) sourceFile.saveSync();
  return {
    filename: sourceFile.getFilePath(),
    findings: candidates.length,
    rewritten,
    compilerConstants,
    reusedConstants,
    orderingRepairs,
    manual,
  };
};

const repoRoot = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stdout: "pipe" }).stdout.toString().trim();
const censusPath = resolve(repoRoot, "goals/inline-schema-compile-hard-error/research/opening-census.json");
const census = decodeCensus(readFileSync(censusPath, "utf8"));
const requestedFiles = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const filenames = A.isReadonlyArrayNonEmpty(requestedFiles)
  ? requestedFiles
  : A.map(census.files, ({ filename }) => filename);
const write = process.argv.includes("--write");

const results: Array<FileResult> = [];
const chunkSize = 20;
for (let offset = 0; offset < filenames.length; offset += chunkSize) {
  const project = new Project({
    compilerOptions: { target: ScriptTarget.ESNext },
    manipulationSettings: { quoteKind: QuoteKind.Double },
    skipAddingFilesFromTsConfig: true,
  });
  const chunk = A.take(A.drop(filenames, offset), chunkSize);
  for (const filename of chunk) {
    results.push(rewriteSourceFile(project.addSourceFileAtPath(resolve(repoRoot, filename)), write));
  }
  for (const sourceFile of project.getSourceFiles()) project.removeSourceFile(sourceFile);
  Bun.gc(false);
}
const manual = A.flatMap(results, (result) => result.manual);
const normalizedManual = A.map(manual, (finding) => ({
  ...finding,
  filename: relative(repoRoot, finding.filename),
}));

const output = `${JSON.stringify(
  {
    write,
    files: results.length,
    filesChanged: A.filter(results, (result) => result.rewritten > 0).length,
    findings: A.reduce(results, 0, (sum, result) => sum + result.findings),
    rewritten: A.reduce(results, 0, (sum, result) => sum + result.rewritten),
    compilerConstants: A.reduce(results, 0, (sum, result) => sum + result.compilerConstants),
    reusedConstants: A.reduce(results, 0, (sum, result) => sum + result.reusedConstants),
    orderingRepairs: A.reduce(results, 0, (sum, result) => sum + result.orderingRepairs),
    manualCount: normalizedManual.length,
    fileResults: A.map(results, (result) => ({
      ...result,
      filename: relative(repoRoot, result.filename),
      manual: A.map(result.manual, (finding) => ({
        ...finding,
        filename: relative(repoRoot, finding.filename),
      })),
    })),
    manual: normalizedManual,
  },
  null,
  2
)}\n`;
const reportArgument = A.findFirst(process.argv.slice(2), (argument) => argument.startsWith("--report="));
if (reportArgument._tag === "Some") {
  writeFileSync(resolve(repoRoot, reportArgument.value.slice("--report=".length)), output);
}
process.stdout.write(output);
