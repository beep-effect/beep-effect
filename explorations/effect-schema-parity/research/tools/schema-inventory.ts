/**
 * Syntax-only, offline research extractor. Runnable from any working directory.
 * Pin: root package.json catalog (`inventoryPin`); bytes: `git show <pin>:<file>` only (see modules.ts).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, posix, relative, resolve } from "node:path";
import { inventoryModules, moduleOf, readInventoryPin, root, showPinned, slugOf } from "./modules.ts";

const base = "explorations/effect-schema-parity/research";
const output = process.argv[2] ? resolve(process.argv[2]) : resolve(root, base, "inventory");
const temporaryRoot = resolve(root, base, "tools/.tmp");
const temporaryRelative = relative(temporaryRoot, output);
if (
  output !== resolve(root, base, "inventory") &&
  (!temporaryRelative ||
    temporaryRelative === ".." ||
    temporaryRelative.startsWith("../") ||
    isAbsolute(temporaryRelative))
)
  throw new Error("Output must be inventory or a directory beneath research/tools/.tmp");
const fullSha = readInventoryPin();
const sha = fullSha;
const ts: typeof import("typescript") = createRequire(import.meta.url)(
  createRequire(resolve(root, "package.json")).resolve("typescript")
);
const files = inventoryModules.map((m) => m.file);
const importableOf = new Map(inventoryModules.map((m) => [m.file, m.importable]));
if (new Set(files).size !== inventoryModules.length) throw new Error("Duplicate file in modules.ts");
const compact = (s: string, limit = 300) => {
  const v = s.replace(/\s+/g, " ").trim();
  return v.length > limit ? `${v.slice(0, limit - 1)}…` : v;
};
type Row = {
  sha: string;
  module: string;
  file: string;
  line: number;
  symbol: string;
  kind: string;
  category: string | null;
  since: string | null;
  deprecated: boolean;
  internal: boolean;
  signature: string;
  summary: string;
  hasExample: boolean;
  overloads: number;
  importable: boolean;
};
const parsed = new Map<string, any>();
for (const file of files) {
  const text = showPinned(fullSha, file).toString("utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics.length) throw new Error(`Parse errors: ${file}`);
  parsed.set(file, sf);
}
const has = (n: any, k: number) => n.modifiers?.some((m: any) => m.kind === k) ?? false;
const doc = (n: any) => {
  const blocks = n.jsDoc ?? [];
  const raw = blocks
    .map((d: any) =>
      d
        .getText()
        .replace(/^\/\*\*|\*\/$/g, "")
        .replace(/^\s*\* ?/gm, "")
    )
    .join("\n")
    .trim();
  const tag = (name: string) => raw.match(new RegExp(`(?:^|\\n)\\s*@${name}\\s+([^\\n]+)`))?.[1]?.trim() ?? null;
  return {
    category: tag("category"),
    since: tag("since"),
    deprecated: /@deprecated\b/.test(raw),
    internal: /@internal\b/.test(raw),
    summary: compact(raw.split(/\n\s*\n|(?:^|\n)\s*@/)[0] ?? "", 400),
    hasExample: /@example\b|\*\*Example\*\*/.test(raw),
  };
};
const kind = (n: any): string =>
  ts.isVariableDeclaration(n) || ts.isBindingElement(n)
    ? "const"
    : ts.isFunctionDeclaration(n)
      ? "function"
      : ts.isClassDeclaration(n)
        ? "class"
        : ts.isInterfaceDeclaration(n)
          ? "interface"
          : ts.isTypeAliasDeclaration(n)
            ? "type"
            : ts.isModuleDeclaration(n)
              ? "namespace"
              : ts.isMethodDeclaration(n) || ts.isMethodSignature(n)
                ? "method"
                : ts.isCallSignatureDeclaration(n)
                  ? "call"
                  : ts.isConstructSignatureDeclaration(n) || ts.isConstructorDeclaration(n)
                    ? "constructor"
                    : ts.isGetAccessor(n) || ts.isSetAccessor(n)
                      ? "accessor"
                      : "property";
const signature = (n: any): string => {
  if (ts.isVariableDeclaration(n) || ts.isBindingElement(n)) {
    if (n.type) return compact(`const ${n.name.getText()}: ${n.type.getText()}`);
    if (n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)))
      return compact(
        `const ${n.name.getText()} = ${n.initializer.getText().slice(0, n.initializer.body.pos - n.initializer.pos)}`
      );
    return `const ${n.name.getText()}: <inferred; see source>`;
  }
  if (ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isModuleDeclaration(n))
    return compact(n.getText().slice(0, n.members ? n.members.pos - n.getStart() - 1 : n.body.pos - n.getStart()));
  if (n.body) return compact(n.getText().slice(0, n.body.pos - n.getStart()));
  return compact(n.getText());
};
const bindingLeaves = (n: any): any[] =>
  ts.isIdentifier(n.name)
    ? [n]
    : [...n.name.elements].filter((e: any) => !ts.isOmittedExpression(e)).flatMap(bindingLeaves);
const declarations = (statements: any) =>
  statements.flatMap((s: any) =>
    ts.isVariableStatement(s)
      ? [...s.declarationList.declarations].flatMap(bindingLeaves).map((n) => ({ n, owner: s }))
      : [{ n: s, owner: s }]
  );
const allStats: any[] = [];
const allRows: Row[] = [];
let stars = 0;
for (const file of files) {
  const sf = parsed.get(file);
  const module = moduleOf(file);
  const importable = importableOf.get(file) as boolean;
  const rows = new Map<string, Row>();
  const add = (n: any, owner: any, symbol: string, fileAt = file, forcedKind?: string, sig?: string) => {
    const source = parsed.get(fileAt);
    const metadata = doc(owner);
    const k = forcedKind ?? kind(n);
    const key = `${symbol}|${k}`;
    const callable = k === "function" || k === "method" || k === "call" || k === "constructor";
    const count = callable
      ? n.body
        ? 0
        : 1
      : n.type && ts.isTypeLiteralNode(n.type)
        ? n.type.members.filter(ts.isCallSignatureDeclaration).length
        : 0;
    const existing = rows.get(key);
    if (existing) {
      existing.overloads += count;
      return;
    }
    rows.set(key, {
      sha,
      module,
      file: fileAt,
      line: source.getLineAndCharacterOfPosition(owner.getStart()).line + 1,
      symbol,
      kind: k,
      ...metadata,
      signature: sig ?? signature(n),
      overloads: count,
      importable,
    });
  };
  const visit = (statements: any, prefix = "", depth = 0, fileAt = file) => {
    const decls = declarations(statements);
    const locals = new Map(
      decls.filter(({ n }: any) => n.name).map(({ n, owner }: any) => [n.name.getText(), { n, owner }])
    );
    const emit = (n: any, owner: any, name: string, declarationFile = fileAt) => {
      const symbol = prefix + name;
      add(n, owner, symbol, declarationFile);
      if (depth !== 0) return;
      if (ts.isModuleDeclaration(n) && n.body && ts.isModuleBlock(n.body))
        visit(n.body.statements, `${symbol}.`, 1, declarationFile);
      else {
        const members = n.members ?? (n.type && ts.isTypeLiteralNode(n.type) ? n.type.members : undefined);
        for (const m of members ?? []) {
          if (
            has(m, ts.SyntaxKind.PrivateKeyword) ||
            has(m, ts.SyntaxKind.ProtectedKeyword) ||
            (m.name && ts.isPrivateIdentifier(m.name))
          )
            continue;
          const memberName =
            m.name?.getText() ??
            (ts.isCallSignatureDeclaration(m) ? "<call>" : ts.isIndexSignatureDeclaration(m) ? "<index>" : "<new>");
          add(m, m, `${symbol}.${memberName}`, declarationFile);
        }
      }
    };
    for (const { n, owner } of decls) {
      if (ts.isExportDeclaration(n)) {
        const clause = n.exportClause;
        if (!clause) {
          stars++;
          continue;
        }
        if (ts.isNamespaceExport(clause)) {
          // Barrel dedupe: a namespace re-export is one row; its target is inventoried under its own
          // module, so its members are never repeated under the barrel's import path.
          const target = posix.normalize(posix.join(posix.dirname(fileAt), n.moduleSpecifier.text));
          if (!importableOf.has(target))
            throw new Error(`${fileAt} re-exports ${target} as a namespace; add it to modules.ts first`);
          add(n, n, prefix + clause.name.text, fileAt, "namespace", compact(n.getText()));
        } else
          for (const e of clause.elements) {
            const local: any = locals.get((e.propertyName ?? e.name).text);
            if (!n.moduleSpecifier && local) emit(local.n, e.jsDoc?.length ? e : local.owner, e.name.text);
            else add(e, e, prefix + e.name.text, fileAt, "re-export", compact(n.getText()));
          }
      } else if (n.name && has(owner, ts.SyntaxKind.ExportKeyword)) emit(n, owner, n.name.getText());
    }
  };
  visit(sf.statements);
  const values = [...rows.values()].sort(
    (a, b) =>
      a.file.localeCompare(b.file, "en") ||
      a.line - b.line ||
      a.symbol.localeCompare(b.symbol, "en") ||
      a.kind.localeCompare(b.kind, "en")
  );
  const slug = slugOf(module);
  const target = resolve(output, `${slug}.jsonl`);
  mkdirSync(dirname(target), { recursive: true });
  const body = values.map((r) => JSON.stringify(r)).join("\n") + (values.length ? "\n" : "");
  writeFileSync(target, body);
  const group = (field: "kind" | "category") =>
    Object.entries(
      values.reduce((a: any, r) => {
        const k = r[field] ?? "(untagged)";
        a[k] = (a[k] ?? 0) + 1;
        return a;
      }, Object.create(null))
    ).sort(([a], [b]) => a.localeCompare(b, "en"));
  allStats.push({
    module,
    slug,
    importable,
    rows: values.length,
    bytes: Buffer.byteLength(body),
    kinds: group("kind"),
    categories: group("category"),
  });
  allRows.push(...values);
}
// Independent ripgrep census: exact JSON fragments verify every reported grouping.
const verifyCount = (needle: string, paths: string[], expected: number) => {
  const result = Bun.spawnSync(["rg", "--no-ignore", "--no-heading", "-F", "-c", needle, ...paths], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode > 1) throw new Error(result.stderr.toString());
  const actual = result.stdout
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean)
    .reduce((sum, line) => sum + Number(line.slice(line.lastIndexOf(":") + 1)), 0);
  if (actual !== expected) throw new Error(`rg census mismatch ${needle}: ${actual} != ${expected}`);
};
const inventoryPaths = allStats.map((s) => resolve(output, `${s.slug}.jsonl`));
for (const s of allStats) {
  const paths = [resolve(output, `${s.slug}.jsonl`)];
  verifyCount('"sha":', paths, s.rows);
  for (const [k, n] of s.kinds) verifyCount(`${JSON.stringify("kind")}:${JSON.stringify(k)}`, paths, n);
  for (const [k, n] of s.categories)
    verifyCount(`"category":${k === "(untagged)" ? "null" : JSON.stringify(k)}`, paths, n);
}
verifyCount('"sha":', inventoryPaths, allRows.length);
const top = allStats
  .find((s) => s.module === "effect/Schema")
  .categories.filter(([k]: any) => k !== "(untagged)")
  .sort((a: any, b: any) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))
  .slice(0, 15);
const totalBytes = allStats.reduce((n, s) => n + s.bytes, 0);
let index = `# Schema inventory index\n\nPin: \`${fullSha}\` (inventoryPin: root package.json catalog \`effect\`; sources read with \`git -C .repos/effect show <pin>:<file>\`). TypeScript parser: \`${ts.version}\`. Counts include direct public members at one level; barrel namespace re-exports are one row each and are not expanded. Module list: \`${base}/tools/modules.ts\`.\n\nRegenerate from repo root (offline):\n\n\`\`\`sh\nbun run ${base}/tools/schema-inventory.ts\n\`\`\`\n\n## Module totals\n\nCount verification: \`rg --no-ignore --no-heading -F -c '"sha":' ${base}/inventory/*.jsonl\` (sum file counts). Bytes are UTF-8 JSONL bytes from Buffer.byteLength, excluding Markdown and tools; byte sizes are not line counts.\n\nImportable \`no\` marks provenance-only modules whose path effect's exports map nulls (\`./internal/*\`); their rows carry \`"importable":false\`.\n\n| Module | Importable | Rows | Bytes |\n| --- | --- | ---: | ---: |\n`;
for (const s of allStats)
  index += `| [${s.module}](${s.slug}.jsonl) | ${s.importable ? "yes" : "no"} | ${s.rows} | ${s.bytes} |\n`;
index += `| **Total** | | **${allRows.length}** | **${totalBytes}** |\n\n## Per-module kinds and categories\n\nEvery cell verified with \`rg --no-ignore --no-heading -F -c '"kind":"<kind>"' <module.jsonl>\` or \`rg --no-ignore --no-heading -F -c '"category":"<category>"' <module.jsonl>\`; untagged uses \`'"category":null'\`. The generator runs these exact commands for every group.\n\n| Module | Kinds | Categories |\n| --- | --- | --- |\n`;
for (const s of allStats)
  index += `| ${s.module} | ${s.kinds.map(([k, n]: any) => `${k}: ${n}`).join("; ")} | ${s.categories.map(([k, n]: any) => `${k}: ${n}`).join("; ")} |\n`;
index += `\n## Largest Schema.ts category groups\n\nVerification: \`rg --no-ignore --no-heading -F -c '"category":"<category>"' ${base}/inventory/effect-Schema.jsonl\`; same independently verified groups above, ranked by count, lexical tie-break. Untagged members excluded.\n\n| Category | Rows |\n| --- | ---: |\n${top.map(([k, n]: any) => `| ${k} | ${n} |`).join("\n")}\n`;
writeFileSync(resolve(output, "INDEX.md"), index);
console.log(
  JSON.stringify(
    {
      modules: files.length,
      rows: allRows.length,
      schemaRows: allStats.find((s) => s.module === "effect/Schema").rows,
      bytes: totalBytes,
      top,
      bareStarDeclarationsOmitted: stars,
      internal: allRows.filter((r) => r.internal).length,
      deprecated: allRows.filter((r) => r.deprecated).length,
    },
    null,
    2
  )
);
