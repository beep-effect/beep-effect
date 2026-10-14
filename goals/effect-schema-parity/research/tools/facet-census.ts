// P3 gate evidence for goals/effect-schema-parity (SPEC "Facet Census Gate").
//
// Syntax-only and import-anchored: every `@beep/schema` root, concept-subpath
// and in-package relative import is resolved to the concept member it binds,
// then references are counted outside the concept's own file (value, type and
// static-member uses, per file bucket). The SPEC `rg -c -e '\.<member>\b'`
// shape runs beside it so collisions and bare named imports show as a delta,
// and a textual count of doc-comment lines sizes the JSDoc examples a PR rewrites.
// The doctrine sums split each concept's lines into those that read an uncovered
// facet (the nominal brand of a branded member, in type position) and those that
// use a covered facet (schema-value use, every static member, unbranded types).
// Part two classifies the call shapes of the four PR 3b SchemaUtils defaults.
//
// Run from the repo root: node goals/effect-schema-parity/research/tools/facet-census.ts
import { spawnSync } from "node:child_process";
import * as NodePath from "node:path";
import { TsNativeApi, TsNativeConfig } from "@beep/repo-utils/TsNativeApi";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as ts from "@typescript/native/unstable/ast";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";

const SRC = "packages/foundation/modeling/schema/src";
const CONCEPTS = ["Number", "Int", "Unknown", "Opaque"] as const;
const DEFAULTS = ["withNoneDefault", "withKeyDefaults", "withEmptyArrayDefaults", "withConstantDefault"] as const;
const DEFAULT_FILES = [`${SRC}/SchemaUtils/withConstructorDefaults.ts`, `${SRC}/SchemaUtils/withKeyDefaults.ts`];

type Binding = { readonly concept: string; readonly member: string };
type Tally = {
  files: Record<string, true>;
  lines: Record<string, true>;
  prodFiles: Record<string, true>;
  prodLines: Record<string, true>;
  value: number;
  type: number;
  statics: Record<string, number>;
  reexports: number;
  typeLines: Record<string, true>;
  bareLines: Record<string, true>;
  staticLines: Record<string, Record<string, true>>;
};

const rg = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(spawnSync("rg", [...args], { encoding: "utf8" }).stdout.split("\n"), (line) => line.length > 0);
const census = Effect.fn("facetCensus")(function* () {
  const api = yield* TsNativeApi;
  const fs = yield* FileSystem.FileSystem;
  const globs = ["-g", "*.ts", "-g", "*.tsx", "-g", "!**/node_modules/**", "-g", "!**/dist/**"];
  const candidates = A.sort(
    A.dedupe([...rg(["-l", "-e", "@beep/schema", "packages", "apps", ...globs]), ...rg(["--files", SRC, ...globs])]),
    Order.String
  );
  let sources = HashMap.empty<string, ts.SourceFile>();
  for (const file of A.dedupe([...candidates, ...A.map(CONCEPTS, (concept) => `${SRC}/${concept}.ts`)])) {
    sources = HashMap.set(
      sources,
      file,
      yield* api.parseSource(file, (yield* fs.exists(file)) ? yield* fs.readFileString(file) : "").pipe(
        Effect.map((source) => ts.getSynthesizedDeepClone(source, true)),
        Effect.scoped
      )
    );
  }
  const parse = (file: string): ts.SourceFile => O.getOrThrow(HashMap.get(sources, file));
  const lineAt = (source: ts.SourceFile, position: number): number =>
    A.length(A.filter(ts.computeLineStarts(source.text), (start) => start <= position));
  const bump = (record: Record<string, number>, key: string): void => {
    record[key] = (record[key] ?? 0) + 1;
  };
  const bucket = (file: string): "prod" | "test" | "schema-src" =>
    /\/(test|tests|__tests__|dtslint)\/|\.(test|spec)\.tsx?$/.test(file)
      ? "test"
      : file.startsWith(`${SRC}/`)
        ? "schema-src"
        : "prod";

  // Members whose schema carries a nominal brand upstream has no pre-branded form for.
  const branded: Record<string, true> = {};

  // Own exports of a concept file; `export { X } from "./Other.ts"` stays with its origin concept.
  const membersOf = (concept: string): Record<string, Binding> => {
    const out: Record<string, Binding> = {};
    for (const statement of parse(`${SRC}/${concept}.ts`).statements) {
      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      ) {
        const origin = NodePath.basename(statement.moduleSpecifier.text, ".ts");
        for (const element of statement.exportClause.elements)
          out[element.name.text] = { concept: origin, member: element.name.text };
      }
      const exported =
        (ts.isVariableStatement(statement) ||
          ts.isFunctionDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement)) &&
        A.some(statement.modifiers ?? [], (m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      if (ts.isVariableStatement(statement)) {
        for (const d of statement.declarationList.declarations)
          if (ts.isIdentifier(d.name)) {
            out[d.name.text] = { concept, member: d.name.text };
            if (d.initializer?.getText().includes("S.brand(") === true) branded[`${concept}.${d.name.text}`] = true;
          }
      } else if ((ts.isFunctionDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name) {
        out[statement.name.text] = { concept, member: statement.name.text };
      }
    }
    return out;
  };

  const conceptMaps: Record<string, Record<string, Binding>> = R.fromEntries(
    A.map(CONCEPTS, (c) => [c, membersOf(c)] as const)
  );
  const rootMap: Record<string, Binding> = Object.assign({}, ...A.map(CONCEPTS, (c) => conceptMaps[c]));
  const utilsMap: Record<string, Binding> = R.fromEntries(
    A.map(DEFAULTS, (d) => [d, { concept: "SchemaUtils", member: d }] as const)
  );

  // Module specifier -> exported-name map, or the SchemaUtils namespace.
  const resolveModule = (from: string, spec: string): O.Option<Record<string, Binding>> => {
    if (spec === "@beep/schema") return O.some(rootMap);
    const sub = spec.startsWith("@beep/schema/")
      ? spec.slice("@beep/schema/".length)
      : spec.startsWith(".")
        ? NodePath.relative(SRC, NodePath.resolve(NodePath.dirname(from), spec)).replace(/\.ts$/, "")
        : "";
    if (A.contains(CONCEPTS, sub)) return O.some(conceptMaps[sub] ?? {});
    if (/^SchemaUtils(\/index|\/withKeyDefaults|\/withConstructorDefaults)?$/.test(sub)) return O.some(utilsMap);
    return O.none();
  };

  const tallies: Record<string, Tally> = {};
  const tallyOf = (b: Binding): Tally => {
    const key = `${b.concept}.${b.member}`;
    tallies[key] ??= {
      files: {},
      lines: {},
      prodFiles: {},
      prodLines: {},
      value: 0,
      type: 0,
      statics: {},
      reexports: 0,
      typeLines: {},
      bareLines: {},
      staticLines: {},
    };
    return tallies[key];
  };
  const shapes: Record<string, Record<string, number>> = R.fromEntries(A.map(DEFAULTS, (d) => [d, {}] as const));
  const shapeFiles: Record<string, Record<string, true>> = R.fromEntries(A.map(DEFAULTS, (d) => [d, {}] as const));
  const shapeProd: Record<string, Record<string, true>> = R.fromEntries(A.map(DEFAULTS, (d) => [d, {}] as const));
  const subjects: Record<string, number> = {};
  const shapeLines: Record<string, Record<string, true>> = R.fromEntries(A.map(DEFAULTS, (d) => [d, {}] as const));

  const isTypePosition = (node: ts.Node): boolean => {
    let current = node;
    while (ts.isQualifiedName(current.parent)) current = current.parent;
    return (
      ts.isTypeReferenceNode(current.parent) ||
      ts.isTypeQueryNode(current.parent) ||
      ts.isImportTypeNode(current.parent)
    );
  };

  const defaultKind = (arg: ts.Expression | undefined): string => {
    if (arg === undefined) return "none";
    if (
      ts.isStringLiteralLikeNode(arg) ||
      ts.isNumericLiteral(arg) ||
      ts.isBigIntLiteral(arg) ||
      ts.isPrefixUnaryExpression(arg)
    )
      return "literal";
    if (
      arg.kind === ts.SyntaxKind.TrueKeyword ||
      arg.kind === ts.SyntaxKind.FalseKeyword ||
      arg.kind === ts.SyntaxKind.NullKeyword
    )
      return "literal";
    if (ts.isIdentifier(arg) || ts.isPropertyAccessExpression(arg)) return "reference";
    if (ts.isArrayLiteralExpression(arg) || ts.isObjectLiteralExpression(arg))
      return "constructed (array/object literal)";
    return "constructed (call/other)";
  };

  // Walks out of call and member chains to the declaration that owns the schema expression.
  const placement = (node: ts.Node): string => {
    let current = node;
    while (
      ts.isCallExpression(current.parent) ||
      ts.isPropertyAccessExpression(current.parent) ||
      ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent)
    )
      current = current.parent;
    if (ts.isPropertyAssignment(current.parent)) return "struct field";
    if (ts.isVariableDeclaration(current.parent)) return "named schema const";
    return "other";
  };

  // Name of the schema a point-free `withNoneDefault` applies to: the previous `.pipe` argument, else the receiver.
  // A call is named by its callee (`S.OptionFromOptionalKey(...)` and a bare
  // `optionalKey(...)` alike). A bare identifier is a function passed point-free when it
  // is a previous `.pipe` argument, and a named schema when it is the receiver.
  const nameOf = (expression: ts.Expression, receiver: boolean): string => {
    let current = expression;
    while (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      A.contains(["pipe", "check", "annotate", "annotateKey"], current.expression.name.text)
    )
      current = current.expression.expression;
    const callee = ts.isCallExpression(current) ? current.expression : current;
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
    if (!ts.isIdentifier(callee)) return "other";
    return receiver && !ts.isCallExpression(current) ? "(local)" : callee.text;
  };
  // `OptionFromOptionalNullishKey` is the `@beep/schema` Options codec (group C); it also decodes a missing key to None.
  const OPTIONAL_KEY = [
    "OptionFromOptionalKey",
    "OptionFromOptional",
    "OptionFromOptionalNullOr",
    "optionalKey",
    "OptionFromOptionalNullishKey",
  ];
  const REQUIRED_KEY = ["Option", "OptionFromNullOr", "OptionFromUndefinedOr", "OptionFromNullishOr"];
  const subjectOf = (call: ts.CallExpression, ref: ts.Expression): string => {
    const index = call.arguments.indexOf(ref);
    const previous = index > 0 ? call.arguments[index - 1] : undefined;
    const name =
      previous !== undefined
        ? nameOf(previous, false)
        : ts.isPropertyAccessExpression(call.expression)
          ? nameOf(call.expression.expression, true)
          : "other";
    return A.contains(OPTIONAL_KEY, name)
      ? "optional-key Option codec (missing key decodes to None)"
      : A.contains(REQUIRED_KEY, name)
        ? "required-key Option codec"
        : name === "(local)"
          ? "named local schema"
          : `other (${name})`;
  };

  const recordShape = (member: string, ref: ts.Expression, file: string): void => {
    const parent = ref.parent;
    const call = ts.isCallExpression(parent) && parent.expression === ref ? parent : undefined;
    const form =
      call === undefined
        ? ts.isCallExpression(parent)
          ? "point-free argument (.pipe(X))"
          : "other reference"
        : member === "withKeyDefaults"
          ? call.arguments.length === 2
            ? `data-first (schema, v); default ${defaultKind(call.arguments[1])}`
            : `data-last (v); default ${defaultKind(call.arguments[0])}`
          : member === "withEmptyArrayDefaults"
            ? `${call.arguments.length === 0 ? "curried ()" : "data-first (schema)"}${call.typeArguments ? " with type argument" : ""}`
            : member === "withConstantDefault"
              ? `curried (v); default ${defaultKind(call.arguments[0])}`
              : "data-first (schema)";
    const shape = shapes[member] ?? {};
    bump(shape, `${form} | ${placement(ref)}`);
    const seen = shapeFiles[member] ?? {};
    seen[file] = true;
    const lines = shapeLines[member] ?? {};
    lines[`${file}:${lineAt(ref.getSourceFile(), ref.getStart())}`] = true;
    if (bucket(file) === "prod") {
      const prod = shapeProd[member] ?? {};
      prod[`${file}:${ref.getStart()}`] = true;
    }
    if (member === "withNoneDefault" && ts.isCallExpression(parent) && call === undefined)
      bump(subjects, subjectOf(parent, ref));
  };

  const visitFile = (file: string): void => {
    const source = parse(file);
    const named: Record<string, Binding> = {};
    const namespaces: Record<string, Record<string, Binding>> = {};
    for (const statement of source.statements) {
      const spec =
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier;
      if (!spec || !ts.isStringLiteral(spec)) continue;
      const resolved = resolveModule(file, spec.text);
      if (O.isNone(resolved)) continue;
      const map = resolved.value;
      if (ts.isExportDeclaration(statement)) {
        if (statement.exportClause && ts.isNamedExports(statement.exportClause))
          for (const e of statement.exportClause.elements) {
            const b = map[(e.propertyName ?? e.name).text];
            if (b) tallyOf(b).reexports++;
          }
        continue;
      }
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) namespaces[bindings.name.text] = map;
      if (bindings && ts.isNamedImports(bindings))
        for (const e of bindings.elements) {
          const imported = (e.propertyName ?? e.name).text;
          if (spec.text === "@beep/schema" && imported === "SchemaUtils") namespaces[e.name.text] = utilsMap;
          const b = map[imported];
          if (b) named[e.name.text] = b;
        }
    }
    if (R.isEmptyRecord(named) && R.isEmptyRecord(namespaces)) return;
    const record = (ref: ts.Node, b: Binding): void => {
      // A concept's own file is not a consumer; sibling concept files are (Int.ts reads Number checks).
      if (b.concept === "SchemaUtils") {
        if (!A.contains(DEFAULT_FILES, file) && ts.isExpression(ref)) recordShape(b.member, ref, file);
        return;
      }
      if (file === `${SRC}/${b.concept}.ts`) return;
      const t = tallyOf(b);
      const where = `${file}:${lineAt(source, ref.getStart())}`;
      t.files[file] = true;
      t.lines[where] = true;
      if (bucket(file) === "prod") {
        t.prodFiles[file] = true;
        t.prodLines[where] = true;
      }
      const parent = ref.parent;
      const member =
        ts.isPropertyAccessExpression(parent) && parent.expression === ref
          ? parent.name.text
          : ts.isQualifiedName(parent) && parent.left === ref
            ? parent.right.text
            : undefined;
      if (member !== undefined) bump(t.statics, member);
      if (isTypePosition(ref)) {
        t.type++;
        t.typeLines[where] = true;
      } else {
        t.value++;
        if (member === undefined) t.bareLines[where] = true;
        else {
          t.staticLines[member] ??= {};
          t.staticLines[member][where] = true;
        }
      }
    };
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const b = namespaces[node.expression.text]?.[node.name.text];
        if (b) record(node, b);
      } else if (ts.isQualifiedName(node) && ts.isIdentifier(node.left)) {
        const b = namespaces[node.left.text]?.[node.right.text];
        if (b) record(node, b);
      } else if (ts.isIdentifier(node) && named[node.text]) {
        const p = node.parent;
        const isName =
          (ts.isPropertyAccessExpression(p) && p.name === node) ||
          (ts.isQualifiedName(p) && p.right === node) ||
          ((ts.isPropertyAssignment(p) ||
            ts.isVariableDeclaration(p) ||
            ts.isParameterDeclaration(p) ||
            ts.isBindingElement(p)) &&
            p.name === node);
        const b = named[node.text];
        if (!isName && b) record(node, b);
      }
      node.forEachChild(visit);
    };
    visit(source);
  };

  for (const file of candidates) visitFile(file);

  const out: Array<string> = [];
  const size = (record: Record<string, unknown>): number => R.size(record);
  for (const concept of CONCEPTS) {
    out.push(
      `\n## ${concept}\n`,
      "| Member | Lines | Files | Prod lines | Prod files | Value refs | Type refs | Re-exports | Static members | SPEC rg lines / files | Doc-comment lines / files |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |"
    );
    for (const [member, binding] of R.toEntries(conceptMaps[concept] ?? {})) {
      if (binding.concept !== concept) continue;
      const t = tallies[`${concept}.${member}`];
      const spec = rg([
        "-c",
        "-e",
        `\\.${member}\\b`,
        "packages",
        "apps",
        "--glob",
        "!node_modules",
        "--glob",
        `!**/${concept}/**`,
        "--glob",
        `!**/schema/src/${concept}.ts`,
        "--glob",
        "*.ts",
        "--glob",
        "*.tsx",
      ]);
      const specLines = A.reduce(spec, 0, (n, line) => n + Number(line.slice(line.lastIndexOf(":") + 1)));
      const docs = rg([
        "-P",
        "-c",
        `^\\s*(\\*|//).*(?<![.\\w])${member}\\b`,
        "packages",
        "apps",
        ...globs,
        "-g",
        `!**/schema/src/${concept}.ts`,
      ]);
      const docLines = A.reduce(docs, 0, (n, line) => n + Number(line.slice(line.lastIndexOf(":") + 1)));
      const statics = t
        ? A.join(
            A.map(
              R.toEntries(t.statics).sort(([, a], [, b]) => b - a),
              ([k, n]) => `${k} ${n}`
            ),
            ", "
          )
        : "";
      out.push(
        `| \`${member}\` | ${t ? size(t.lines) : 0} | ${t ? size(t.files) : 0} | ${t ? size(t.prodLines) : 0} | ${t ? size(t.prodFiles) : 0} | ${t?.value ?? 0} | ${t?.type ?? 0} | ${t?.reexports ?? 0} | ${statics} | ${specLines} / ${spec.length} | ${docLines} / ${docs.length} |`
      );
    }
  }
  out.push(
    "\n## PR 3b default helpers: call shapes\n",
    "| Helper | Shape | Placement | Occurrences |",
    "| --- | --- | --- | ---: |"
  );
  for (const helper of DEFAULTS) {
    const entries = R.toEntries(shapes[helper] ?? {}).sort(([, a], [, b]) => b - a);
    for (const [key, n] of entries) {
      const [form, where] = key.split(" | ");
      out.push(`| \`${helper}\` | ${form} | ${where} | ${n} |`);
    }
    const total = A.reduce(entries, 0, (n, [, k]) => n + k);
    out.push(
      `| \`${helper}\` | **total** (${size(shapeFiles[helper] ?? {})} files; prod occurrences ${size(shapeProd[helper] ?? {})}) | | ${total} |`
    );
  }
  out.push("\n## withNoneDefault subject schema\n", "| Subject | Occurrences |", "| --- | ---: |");
  for (const [subject, n] of R.toEntries(subjects).sort(([, a], [, b]) => b - a)) out.push(`| \`${subject}\` | ${n} |`);
  // --- Doctrine sums (P0 section 11): uncovered-facet lines against covered-facet lines ---
  const union = (sets: ReadonlyArray<Record<string, true>>): Record<string, true> => Object.assign({}, ...sets);
  const count = (set: Record<string, true>): number => R.size(set);
  out.push(
    "\n## Doctrine sums\n",
    "Uncovered: type-position lines of branded members. Covered: schema-value lines, every static member, and type positions of unbranded members. Lines are distinct `file:line` pairs; a line can sit in both sums.\n",
    "| Concept | Uncovered lines | Covered lines | Covered breakdown | Overlap | Verdict | If `.make` on a branded member counted as uncovered |",
    "| --- | ---: | ---: | --- | ---: | --- | --- |"
  );
  for (const concept of CONCEPTS) {
    const members = A.filter(R.toEntries(conceptMaps[concept] ?? {}), ([, b]) => b.concept === concept);
    const tallyList = A.flatMap(members, ([member]) => {
      const t = tallies[`${concept}.${member}`];
      return t === undefined ? [] : [[member, t] as const];
    });
    const isBranded = (member: string): boolean => branded[`${concept}.${member}`] === true;
    const uncovered = union(
      A.map(
        A.filter(tallyList, ([m]) => isBranded(m)),
        ([, t]) => t.typeLines
      )
    );
    const categories: Record<string, Record<string, true>> = {};
    for (const [member, t] of tallyList) {
      categories["schema value"] = union([categories["schema value"] ?? {}, t.bareLines]);
      for (const [key, lines] of R.toEntries(t.staticLines))
        categories[`.${key}`] = union([categories[`.${key}`] ?? {}, lines]);
      if (!isBranded(member)) categories["unbranded type"] = union([categories["unbranded type"] ?? {}, t.typeLines]);
    }
    const covered = union(R.values(categories));
    const overlap = A.filter(R.keys(uncovered), (line) => covered[line] === true).length;
    const brandedMake = union(
      A.map(
        A.filter(tallyList, ([m]) => isBranded(m)),
        ([, t]) => t.staticLines.make ?? {}
      )
    );
    const uncoveredWithMake = union([uncovered, brandedMake]);
    const coveredWithoutMake = union(
      A.map(R.toEntries(categories), ([key, lines]) =>
        key === ".make"
          ? R.filter(
              lines,
              (_, line) =>
                brandedMake[line] !== true ||
                A.some(R.toEntries(categories), ([k, l]) => k !== ".make" && l[line] === true)
            )
          : lines
      )
    );
    const breakdown = A.join(
      A.map(
        R.toEntries(categories).sort(([, a], [, b]) => count(b) - count(a)),
        ([key, lines]) => `${key} ${count(lines)}`
      ),
      ", "
    );
    const verdict = count(uncovered) > count(covered) ? "FLIP to ADAPT" : "RETIRE holds";
    const sensitivity = `${count(uncoveredWithMake)} vs ${count(coveredWithoutMake)}: ${count(uncoveredWithMake) > count(coveredWithoutMake) ? "would flip" : "would hold"}`;
    out.push(
      `| ${concept} | ${count(uncovered)} | ${count(covered)} | ${breakdown} | ${overlap} | ${verdict} | ${sensitivity} |`
    );
  }
  const helperLines = union(R.values(shapeLines));
  out.push(
    `| PR 3b defaults | 0 | ${count(helperLines)} | ${A.join(
      A.map(DEFAULTS, (d) => `${d} ${count(shapeLines[d] ?? {})}`),
      ", "
    )} | 0 | RETIRE holds | n/a |`
  );
  process.stdout.write(`${A.join(out, "\n")}\n`);
});
const layer = TsNativeApi.layer(TsNativeConfig.make({ cwd: process.cwd(), tsconfig: "tsconfig.json" })).pipe(
  Layer.provideMerge(NodeServices.layer)
);
NodeRuntime.runMain(census().pipe(Effect.scoped, Effect.provide(layer)));
