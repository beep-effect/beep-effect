/** Maintainer-only import/export scan using the already pinned donor TS compiler. */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const hash = (text) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const read = (file) => Effect.tryPromise(() => Bun.file(file).text());
const program = Effect.gen(function* () {
  const path = yield* Path.Path;
  const root = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
  const module = yield* Effect.tryPromise(() => import(process.argv[2]));
  const ts = module.default ?? module;
  if (ts.version !== "5.9.3") throw new Error("Pinned maintainer TypeScript 5.9.3 required");
  const spawner = yield* ChildProcessSpawner;
  const rawFiles = yield* spawner.lines(
    ChildProcess.make(
      "rg",
      [
        "--files",
        "packages",
        "apps",
        "-g",
        "*.ts",
        "-g",
        "*.tsx",
        "-g",
        "*.mts",
        "-g",
        "*.cts",
        "-g",
        "*.js",
        "-g",
        "*.jsx",
        "-g",
        "*.mjs",
        "-g",
        "*.cjs",
      ],
      { cwd: root }
    )
  );
  const files = A.sort(rawFiles, Order.String);
  const surfaceRaw = yield* read(new URL("./citation-migration-surface.json", import.meta.url));
  const surface = yield* S.decodeEffect(
    S.fromJsonString(
      S.Struct({
        schemaVersion: S.tag("citation-migration-surface/v1"),
        baselineHead: S.NonEmptyString,
        scope: S.String,
        directories: S.Array(S.NonEmptyString),
        symbols: S.Array(S.NonEmptyString),
        definitionFiles: S.Array(S.Struct({ path: S.NonEmptyString, sha256: S.NonEmptyString })),
      })
    )
  )(surfaceRaw);
  const directories = surface.directories;
  const legacy = new Set(surface.symbols);
  if (legacy.size !== 76 || surface.symbols.length !== 76 || surface.definitionFiles.length === 0)
    throw new Error("Migration surface inventory changed unexpectedly");
  const findings = [];
  const examined = [];
  const diagnostics = [];
  const owner = "packages/law-practice/domain/";
  const scope = (specifier, filename) => {
    const alias = "@beep/law-practice-domain";
    let relative;
    if (specifier === alias || specifier === `${alias}/values`) return "aggregate";
    if (Str.startsWith(`${alias}/values/`)(specifier)) relative = Str.slice(`${alias}/values/`.length)(specifier);
    else if (Str.startsWith(".")(specifier)) {
      const resolved = path.resolve(root, path.dirname(filename), specifier);
      const base = path.join(root, "packages/law-practice/domain/src");
      if (
        [
          base,
          `${base}/index`,
          `${base}/index.ts`,
          `${base}/values`,
          `${base}/values/index`,
          `${base}/values/index.ts`,
        ].includes(resolved)
      )
        return "aggregate";
      const prefix = `${base}/values/`;
      if (!Str.startsWith(prefix)(resolved)) return null;
      relative = Str.slice(prefix.length)(resolved);
      if (relative === "index.ts") return "aggregate";
    } else return null;
    return A.contains(directories, relative.split("/")[0]) ? "legacy-leaf" : null;
  };
  for (const file of files) {
    const text = yield* read(path.join(root, file));
    if (!Str.includes("domain")(text)) continue;
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      Str.endsWith("x")(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const namespaces = new Map();
    let relevant = false;
    const add = (node, kind, symbol, specifier) => {
      const location = source.getLineAndCharacterOfPosition(node.getStart(source));
      findings.push({
        path: file,
        line: location.line + 1,
        kind,
        symbol,
        specifier,
        ownership: Str.startsWith(owner)(file) ? "owner" : "external",
        production: !/\/(test|dtslint|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(file),
        sourceSha256: hash(text),
      });
    };
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      const target = scope(specifier, file);
      if (!target) continue;
      relevant = true;
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        if (clause?.name) add(statement, "default-import-review", clause.name.text, specifier);
        const bindings = clause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) namespaces.set(bindings.name.text, specifier);
        else if (bindings)
          for (const element of bindings.elements) {
            const name = (element.propertyName ?? element.name).text;
            if (target === "legacy-leaf" || legacy.has(name)) add(element, "named-import", name, specifier);
          }
      } else if (!statement.exportClause || ts.isNamespaceExport(statement.exportClause))
        add(statement, "wildcard-export-review", "*", specifier);
      else
        for (const element of statement.exportClause.elements) {
          const name = (element.propertyName ?? element.name).text;
          if (target === "legacy-leaf" || legacy.has(name)) add(element, "named-export", name, specifier);
        }
    }
    const visit = (node) => {
      if (ts.isIdentifier(node) && namespaces.has(node.text) && !ts.isNamespaceImport(node.parent)) {
        const parent = node.parent;
        if (
          (ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
          (ts.isQualifiedName(parent) && parent.left === node)
        ) {
          const name = ts.isQualifiedName(parent) ? parent.right.text : parent.name.text;
          if (legacy.has(name)) add(parent, "namespace-member", name, namespaces.get(node.text));
        } else if (
          ts.isElementAccessExpression(parent) &&
          parent.expression === node &&
          parent.argumentExpression &&
          ts.isStringLiteral(parent.argumentExpression)
        ) {
          if (legacy.has(parent.argumentExpression.text))
            add(parent, "namespace-member", parent.argumentExpression.text, namespaces.get(node.text));
        } else add(node, "namespace-escape-review", node.text, namespaces.get(node.text));
      }
      if (
        ts.isCallExpression(node) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0]) &&
        scope(node.arguments[0].text, file) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        relevant = true;
        add(node, "dynamic-module-review", "*", node.arguments[0].text);
      }
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal) &&
        scope(node.argument.literal.text, file)
      ) {
        relevant = true;
        let name = node.qualifier;
        while (name && ts.isQualifiedName(name)) name = name.left;
        if (!name || (ts.isIdentifier(name) && legacy.has(name.text)))
          add(node, "import-type-review", name?.text ?? "*", node.argument.literal.text);
      }
      if (ts.isStringLiteral(node) && scope(node.text, file)) {
        const parent = node.parent;
        const declaration =
          (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node;
        const importType = ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent);
        const dynamic =
          ts.isCallExpression(parent) &&
          parent.arguments[0] === node &&
          (parent.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(parent.expression) && parent.expression.text === "require"));
        if (!declaration && !importType && !dynamic) {
          relevant = true;
          add(node, "module-string-review", "*", node.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (relevant) {
      examined.push({ path: file, sourceSha256: hash(text) });
      if (source.parseDiagnostics.length)
        diagnostics.push({ path: file, codes: A.map(source.parseDiagnostics, (item) => item.code) });
    }
  }
  const report = {
    schemaVersion: "citation-consumer-scan/v2",
    surfaceSha256: hash(surfaceRaw),
    baselineHead: surface.baselineHead,
    compilerVersion: ts.version,
    compilerSha256: hash(yield* read(process.argv[2])),
    scannerSha256: hash(yield* read(import.meta.path)),
    searchedFiles: files.length,
    legacySymbols: [...legacy],
    examined,
    findings,
    diagnostics,
  };
  const encoded = yield* S.encodeUnknownEffect(S.fromJsonString(S.JsonObject))(report);
  yield* Effect.tryPromise(() => Bun.write(process.argv[3], encoded));
  yield* Console.log(
    `Citation consumer scan: ${legacy.size} legacy symbols, ${files.length} source files; ${findings.filter((row) => row.ownership === "external" && row.production).length} external production findings; ${diagnostics.length} relevant parse diagnostics.`
  );
});
// @effect-diagnostics-next-line strictEffectProvide:off -- Maintainer process entry point.
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
