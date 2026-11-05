/** Discover donor exports and test registrations through the TypeScript AST. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const digest = (value) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const donorRoot = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const ts = (await import(resolve(donorRoot, "node_modules/typescript/lib/typescript.js"))).default;
const tracked = execFileSync("git", ["ls-files", "src", "tests"], { cwd: donorRoot, encoding: "utf8" })
  .trim()
  .split("\n");
const trackedSet = new Set(tracked);
const sourceFiles = tracked.filter((path) => /\.[cm]?[jt]sx?$/.test(path));
const manifest = await Effect.runPromise(
  S.decodeUnknownEffect(S.fromJsonString(S.JsonObject))(readFileSync(resolve(donorRoot, "package.json"), "utf8"))
);
const exportTarget = (value) =>
  typeof value === "string" ? value : exportTarget(value.import ?? value.default ?? value.require);
const publishedEntrypoints = Object.entries(manifest.exports).map(([subpath, value]) => ({
  subpath,
  sourcePath: exportTarget(value)
    .replace(/^\.\/dist\//, "src/")
    .replace(/\.[cm]?js$/, ".ts"),
}));
const derivedEntrypoints = publishedEntrypoints.map((entry) => entry.sourcePath);
const suppliedEntrypoints = process.argv.slice(4);
if (
  suppliedEntrypoints.length &&
  (suppliedEntrypoints.length !== derivedEntrypoints.length ||
    suppliedEntrypoints.some((path) => !derivedEntrypoints.includes(path)))
)
  throw new Error("published entrypoint coverage mismatch");
const entrypoints = derivedEntrypoints;

const program = ts.createProgram(
  entrypoints.map((path) => resolve(donorRoot, path)),
  {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true,
    skipLibCheck: true,
    noEmit: true,
  }
);
const checker = program.getTypeChecker();
const source = (path) => {
  const text = readFileSync(resolve(donorRoot, path), "utf8");
  return (
    program.getSourceFile(resolve(donorRoot, path)) ??
    ts.createSourceFile(resolve(donorRoot, path), text, ts.ScriptTarget.Latest, true)
  );
};
const at = (node) => {
  const file = node.getSourceFile();
  const path = relative(donorRoot, resolve(file.fileName));
  if (path.startsWith("../")) throw new Error("export origin escaped pinned donor");
  const start = node.getStart(file);
  const location = file.getLineAndCharacterOfPosition(start);
  return {
    path,
    line: location.line + 1,
    column: location.character + 1,
    endLine: file.getLineAndCharacterOfPosition(node.end).line + 1,
    sourceSha256: digest(file.text),
    declarationSha256: digest(node.getText(file)),
    material: trackedSet.has(path) ? "tracked" : "generated",
  };
};
const exports = [];
for (const entrypoint of entrypoints) {
  const file = source(entrypoint);
  const symbol = checker.getSymbolAtLocation(file);
  if (!symbol) throw new Error("entrypoint has no module symbol");
  for (const exported of checker.getExportsOfModule(symbol)) {
    const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declarations = target.declarations ?? [];
    if (declarations.length === 0) throw new Error(`unresolved public export ${exported.name}`);
    const origins = declarations.map(at);
    const members = [];
    for (const declaration of declarations) {
      if (!ts.isClassDeclaration(declaration)) continue;
      for (const member of declaration.members) {
        if (
          (ts.canHaveModifiers(member) &&
            ts
              .getModifiers(member)
              ?.some(
                (modifier) =>
                  modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword
              )) ||
          (member.name && ts.isPrivateIdentifier(member.name))
        )
          continue;
        members.push({
          name: member.name?.getText() ?? "constructor",
          syntaxKind: ts.SyntaxKind[member.kind],
          origin: at(member),
        });
      }
    }
    exports.push({
      id: `${entrypoint}::${exported.name}`,
      entrypoint,
      name: exported.name,
      targetName: target.name,
      hasValue: (target.flags & ts.SymbolFlags.Value) !== 0,
      hasType: (target.flags & ts.SymbolFlags.Type) !== 0,
      origins,
      members,
    });
  }
}
const rootName = (node) => {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return rootName(node.expression);
  if (ts.isCallExpression(node) || ts.isTaggedTemplateExpression(node)) return rootName(node.expression);
  return undefined;
};
const registrations = [];
const assertions = [];
const files = [];
for (const path of sourceFiles) {
  const file = source(path);
  files.push({ path, sha256: digest(file.text) });
  if (!path.startsWith("tests/")) continue;
  const testAliases = new Set(["test", "it"]);
  const imports = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        const imported = specifier.propertyName?.text ?? specifier.name.text;
        if ((module === "vitest" || module === "bun:test") && (imported === "it" || imported === "test"))
          testAliases.add(specifier.name.text);
        if (module.includes("src") || module === "eyecite-ts" || module.startsWith("eyecite-ts/"))
          imports.push({
            module,
            imported,
            local: specifier.name.text,
            typeOnly: specifier.isTypeOnly || statement.importClause?.isTypeOnly === true,
          });
      }
    }
  }
  const walk = (node, owner) => {
    let current = owner;
    if (ts.isCallExpression(node)) {
      const name = rootName(node.expression);
      const isEachFactory =
        ts.isPropertyAccessExpression(node.expression) &&
        ["each", "for", "skipIf", "runIf"].includes(node.expression.name.text);
      const isModifierFactory = ts.isCallExpression(node.parent) && node.parent.expression === node;
      if (name && testAliases.has(name) && !isEachFactory && !isModifierFactory) {
        const location = at(node);
        current = `${path}:${location.line}:${location.column}:testDeclaration`;
        const callee = node.expression;
        const runtimePosition = ts.isIdentifier(callee)
          ? callee.getStart(file)
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.getStart(file)
            : callee.end - 1;
        const runtimeLocation = file.getLineAndCharacterOfPosition(runtimePosition);
        registrations.push({
          id: current,
          ...location,
          runtimeLine: runtimeLocation.line + 1,
          runtimeColumn: runtimeLocation.character + 1,
          callee: node.expression.getText(file),
          titleExpression: node.arguments[0]?.getText(file) ?? "",
          argumentCount: node.arguments.length,
          imports,
          parameterized: ts.isCallExpression(node.expression) || ts.isTaggedTemplateExpression(node.expression),
        });
      }
      if (name === "expect" && !ts.isIdentifier(node.expression)) {
        const location = at(node);
        assertions.push({
          id: `${path}:${location.line}:${location.column}:assertion`,
          ...location,
          ownerDeclarationId: current ?? null,
          matcher: node.expression.getText(file),
          expression: node.getText(file),
        });
      }
    }
    ts.forEachChild(node, (child) => walk(child, current));
  };
  walk(file);
}
const fixtures = tracked
  .filter((path) => path.startsWith("tests/") && !sourceFiles.includes(path))
  .map((path) => ({ path, sha256: digest(readFileSync(resolve(donorRoot, path))) }));
const result = {
  fixtures,
  publishedEntrypoints,
  parser: `typescript@${ts.version}`,
  generatorSha256: digest(readFileSync(import.meta.path)),
  files,
  entrypoints,
  exports,
  testDeclarations: registrations,
  assertionSources: assertions,
};
Effect.runPromise(
  S.encodeUnknownEffect(S.fromJsonString(S.JsonObject))(result).pipe(
    Effect.flatMap((text) => Effect.tryPromise(() => Bun.write(output, text))),
    Effect.tap(() =>
      Effect.sync(() =>
        process.stdout.write(
          `exports=${exports.length}; testDeclarations=${registrations.length}; assertionSources=${assertions.length}\n`
        )
      )
    )
  )
).catch(() => {
  process.stderr.write("TypeScript donor inventory failed.\n");
  process.exitCode = 1;
});
