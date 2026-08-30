/**
 * Owning-export census for the scratchpad JSDoc quality loop.
 *
 * Usage: bun scratchpad/.jsdoc-loop/census.ts
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import ts from "typescript";

const repoRoot = join(import.meta.dir, "../..");
const scratchpadRoot = join(repoRoot, "scratchpad");
const outDir = join(scratchpadRoot, ".jsdoc-loop");

const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  "docs",
  "test",
  "generated-docs",
  ".jsdoc-loop",
  "dist",
  "build",
  ".turbo",
]);

const EXCLUDED_FILES = new Set([
  "encode-keys-probe.ts",
  "identity-kit-probe.ts",
  "exec.ts",
  "vitest.config.ts",
  "drizzle.config.ts",
]);

const PACKS = [
  "claudecode-events",
  "claudecode-hook",
  "claudecode-config",
  "claudecode-runtime",
  "ontology-domain",
  "ontology-service",
  "ontology-runtime",
  "ontology-rest",
  "yaml-public",
  "yaml-internal",
  "toml",
  "jsonc",
  "jsonl",
  "glob",
  "schemastore",
  "semver",
  "memfs",
  "beep-docs",
  "codemode",
  "remainder",
] as const;

type PackId = (typeof PACKS)[number];

const packFor = (rel: string): PackId => {
  if (rel.startsWith("claudecode/Hook/Events")) return "claudecode-events";
  if (rel.startsWith("claudecode/Hook")) return "claudecode-hook";
  if (rel.startsWith("claudecode/Frontmatter") || rel.startsWith("claudecode/Settings")) return "claudecode-config";
  if (rel.startsWith("claudecode/")) return "claudecode-runtime";
  if (rel.startsWith("effect-ontology/Domain/")) return "ontology-domain";
  if (rel.startsWith("effect-ontology/Service/")) return "ontology-service";
  if (
    rel.startsWith("effect-ontology/Runtime/") ||
    rel.startsWith("effect-ontology/Cluster/") ||
    rel.startsWith("effect-ontology/Workflow/") ||
    rel.startsWith("effect-ontology/Schema/")
  ) {
    return "ontology-runtime";
  }
  if (rel.startsWith("effect-ontology/")) return "ontology-rest";
  if (rel.startsWith("yaml/internal/")) return "yaml-internal";
  if (rel.startsWith("yaml/")) return "yaml-public";
  if (rel.startsWith("toml/")) return "toml";
  if (rel.startsWith("jsonc/")) return "jsonc";
  if (rel.startsWith("jsonl/")) return "jsonl";
  if (rel.startsWith("glob/")) return "glob";
  if (rel.startsWith("schemastore/")) return "schemastore";
  if (rel.startsWith("semver/")) return "semver";
  if (rel.startsWith("memfs/")) return "memfs";
  if (rel.startsWith("beep-docs/")) return "beep-docs";
  if (rel.startsWith("codemode/")) return "codemode";
  return "remainder";
};

type Kind = "value" | "type" | "re-export" | "module";

interface Finding {
  readonly rule: string;
  readonly detail: string;
}

interface ExportRecord {
  readonly file: string;
  readonly name: string;
  readonly line: number;
  readonly kind: Kind;
  readonly exportKind: string;
  readonly pack: PackId;
  readonly tags: ReadonlyArray<string>;
  readonly hasLead: boolean;
  readonly hasTitledExample: boolean;
  readonly hasLegacyExample: boolean;
  readonly hasRemarks: boolean;
  readonly missingTags: ReadonlyArray<string>;
  readonly findings: ReadonlyArray<Finding>;
}

interface ModuleRecord {
  readonly file: string;
  readonly pack: PackId;
  readonly exportCount: number;
  readonly owningExportCount: number;
  readonly hasFileoverview: boolean;
  readonly hasPackageDocumentation: boolean;
  readonly hasSince: boolean;
  readonly hasLead: boolean;
  readonly hasRemarks: boolean;
  readonly hasLegacyExample: boolean;
  readonly findings: ReadonlyArray<Finding>;
}

const walk = async (dir: string, acc: Array<string>): Promise<Array<string>> => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      acc = await walk(join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts") || entry.name.endsWith(".test.ts")) continue;
    if (EXCLUDED_FILES.has(entry.name)) continue;
    acc.push(join(dir, entry.name));
  }
  return acc;
};

const TAG_RE = /@(\w+)/g;

const tagsFrom = (text: string): ReadonlyArray<string> => {
  const found = new Set<string>();
  for (const match of text.matchAll(TAG_RE)) {
    found.add(`@${match[1]}`);
  }
  return [...found];
};

const firstParagraph = (text: string): string => {
  const stripped = text
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd())
    .join("\n")
    .trim();
  const withoutTags = stripped.split(/\n\s*@/)[0]?.trim() ?? "";
  const withoutSections = withoutTags.split(/\n\s*\*\*(?:When to use|Details|Gotchas|Example)\*\*/u)[0]?.trim() ?? "";
  return withoutSections.replace(/\n{2,}/g, "\n").trim();
};

const hasUsefulLead = (text: string): boolean => {
  const lead = firstParagraph(text);
  return lead.length >= 12 && !/^\s*$/u.test(lead);
};

const jsDocText = (node: ts.Node, sourceText: string): string => {
  const docs = (node as { jsDoc?: ReadonlyArray<ts.JSDoc> }).jsDoc;
  if (docs !== undefined && docs.length > 0) {
    return docs.map((doc) => sourceText.slice(doc.pos, doc.end)).join("\n");
  }
  return "";
};

const fileOverview = (sourceFile: ts.SourceFile, sourceText: string): string => {
  const ranges = ts.getLeadingCommentRanges(sourceText, 0) ?? [];
  const blocks = ranges
    .map((range) => sourceText.slice(range.pos, range.end))
    .filter((block) => block.startsWith("/**"));
  return blocks.join("\n");
};

const lineOf = (sourceFile: ts.SourceFile, node: ts.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile, false)).line + 1;

const declarationName = (node: ts.NamedDeclaration): string => {
  if (node.name === undefined) return "<default>";
  return node.name.getText();
};

const hasAmbient = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Ambient) !== 0;

const isTypeOnly = (node: ts.Node): boolean =>
  ts.isTypeAliasDeclaration(node) ||
  ts.isInterfaceDeclaration(node) ||
  (ts.isModuleDeclaration(node) && hasAmbient(node));

const exportKindOf = (node: ts.Node): string => {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isModuleDeclaration(node)) return "namespace";
  if (ts.isVariableDeclaration(node)) return "const";
  if (ts.isExportAssignment(node)) return "default";
  return node.kind === ts.SyntaxKind.ExportSpecifier ? "re-export" : "unknown";
};

const mechanicalExportFindings = (opts: {
  readonly kind: Kind;
  readonly text: string;
  readonly tags: ReadonlyArray<string>;
}): { readonly missingTags: ReadonlyArray<string>; readonly findings: ReadonlyArray<Finding> } => {
  const findings: Array<Finding> = [];
  const missingTags: Array<string> = [];
  if (opts.kind === "re-export") {
    if (opts.tags.includes("@example") || /@remarks\b/u.test(opts.text)) {
      findings.push({
        rule: "legacy-carrier",
        detail: "Re-export JSDoc uses a retired @example or @remarks carrier.",
      });
    }
    return { missingTags, findings };
  }
  if (!hasUsefulLead(opts.text)) {
    findings.push({ rule: "missing-summary", detail: "Owning export lacks a useful one-paragraph lead." });
  }
  if (!opts.tags.includes("@category")) missingTags.push("@category");
  if (!opts.tags.includes("@since")) missingTags.push("@since");
  const hasTitled = /\*\*Example\*\*\s*\(/u.test(opts.text);
  const hasLegacy = /@example\b/u.test(opts.text);
  if (opts.kind === "value" && !hasTitled && !hasLegacy) missingTags.push("@example");
  if (hasLegacy) {
    findings.push({
      rule: "legacy-example",
      detail: "Uses retired @example carrier; convert to **Example** (Title).",
    });
  }
  if (/@remarks\b/u.test(opts.text)) {
    findings.push({ rule: "legacy-remarks", detail: "Uses retired @remarks; move into Details or Gotchas." });
  }
  if (/@module\b/u.test(opts.text)) {
    findings.push({ rule: "forbidden-module", detail: "Uses @module; replace with @packageDocumentation." });
  }
  if (/@template\b/u.test(opts.text)) {
    findings.push({ rule: "forbidden-template", detail: "Uses @template; replace with @typeParam." });
  }
  if (/@(?:param|returns|throws)\s+\{/u.test(opts.text)) {
    findings.push({ rule: "type-braces", detail: "Type braces in @param/@returns/@throws." });
  }
  if (/@(?:returns|throws)\s+-\s/u.test(opts.text)) {
    findings.push({ rule: "hyphen-after-returns-throws", detail: "Hyphen after @returns or @throws." });
  }
  if (/@see\s+\{@link [^}]+\}\s*$/mu.test(opts.text) || /@see\s+\{@link [^}]+\}\s*\n/u.test(opts.text)) {
    const seeLines = opts.text.split("\n").filter((line) => /@see\b/u.test(line));
    for (const line of seeLines) {
      if (/@see\s+\{@link [^}]+\}\s*$/u.test(line.trim())) {
        findings.push({ rule: "undescribed-see", detail: `Bare @see without purpose phrase: ${line.trim()}` });
      }
    }
  }
  if (missingTags.length > 0) {
    findings.push({ rule: "missing-required-tags", detail: `Missing ${missingTags.join(", ")}.` });
  }
  return { missingTags, findings };
};

const recordOwning = (
  records: Array<ExportRecord>,
  opts: {
    readonly file: string;
    readonly pack: PackId;
    readonly sourceFile: ts.SourceFile;
    readonly node: ts.NamedDeclaration | ts.ExportAssignment;
    readonly name: string;
    readonly kind: Kind;
    readonly sourceText: string;
    readonly docText?: string;
  }
): void => {
  const text = opts.docText !== undefined && opts.docText.length > 0 ? opts.docText : jsDocText(opts.node, opts.sourceText);
  const tags = tagsFrom(text);
  const { missingTags, findings } = mechanicalExportFindings({ kind: opts.kind, text, tags });
  records.push({
    file: opts.file,
    name: opts.name,
    line: lineOf(opts.sourceFile, opts.node),
    kind: opts.kind,
    exportKind: exportKindOf(opts.node),
    pack: opts.pack,
    tags,
    hasLead: hasUsefulLead(text),
    hasTitledExample: /\*\*Example\*\*\s*\(/u.test(text),
    hasLegacyExample: /@example\b/u.test(text),
    hasRemarks: /@remarks\b/u.test(text),
    missingTags,
    findings,
  });
};

const visitSource = (rel: string, pack: PackId, sourceFile: ts.SourceFile, sourceText: string): {
  readonly module: ModuleRecord;
  readonly exports: ReadonlyArray<ExportRecord>;
} => {
  const exports: Array<ExportRecord> = [];
  const overview = fileOverview(sourceFile, sourceText);
  const overviewTags = tagsFrom(overview);

  const visit = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node)) {
      const isTypeOnlyExport = node.isTypeOnly;
      if (node.moduleSpecifier !== undefined) {
        const text = jsDocText(node, sourceText);
        const tags = tagsFrom(text);
        const { missingTags, findings } = mechanicalExportFindings({ kind: "re-export", text, tags });
        const label =
          node.exportClause === undefined
            ? "*"
            : ts.isNamespaceExport(node.exportClause)
              ? `* as ${node.exportClause.name.getText()}`
              : node.exportClause.elements.map((el) => el.name.getText()).join(", ");
        exports.push({
          file: rel,
          name: label,
          line: lineOf(sourceFile, node),
          kind: "re-export",
          exportKind: isTypeOnlyExport ? "type-re-export" : "re-export",
          pack,
          tags,
          hasLead: hasUsefulLead(text),
          hasTitledExample: /\*\*Example\*\*\s*\(/u.test(text),
          hasLegacyExample: /@example\b/u.test(text),
          hasRemarks: /@remarks\b/u.test(text),
          missingTags,
          findings,
        });
        return;
      }
      if (node.exportClause !== undefined && ts.isNamedExports(node.exportClause)) {
        const text = jsDocText(node, sourceText);
        const tags = tagsFrom(text);
        const { missingTags, findings } = mechanicalExportFindings({ kind: "re-export", text, tags });
        for (const el of node.exportClause.elements) {
          exports.push({
            file: rel,
            name: el.name.getText(),
            line: lineOf(sourceFile, el),
            kind: "re-export",
            exportKind: node.isTypeOnly || el.isTypeOnly ? "type-re-export" : "re-export",
            pack,
            tags,
            hasLead: hasUsefulLead(text),
            hasTitledExample: /\*\*Example\*\*\s*\(/u.test(text),
            hasLegacyExample: /@example\b/u.test(text),
            hasRemarks: /@remarks\b/u.test(text),
            missingTags,
            findings,
          });
        }
      }
      return;
    }

    if (ts.isExportAssignment(node)) {
      if (ts.isIdentifier(node.expression)) {
        const text = jsDocText(node, sourceText);
        const tags = tagsFrom(text);
        const { missingTags, findings } = mechanicalExportFindings({ kind: "re-export", text, tags });
        exports.push({
          file: rel,
          name: "default",
          line: lineOf(sourceFile, node),
          kind: "re-export",
          exportKind: "default-re-export",
          pack,
          tags,
          hasLead: hasUsefulLead(text),
          hasTitledExample: /\*\*Example\*\*\s*\(/u.test(text),
          hasLegacyExample: /@example\b/u.test(text),
          hasRemarks: /@remarks\b/u.test(text),
          missingTags,
          findings,
        });
        return;
      }
      recordOwning(exports, {
        file: rel,
        pack,
        sourceFile,
        node,
        name: "default",
        kind: "value",
        sourceText,
      });
      return;
    }

    const exported =
      ts.canHaveModifiers(node) &&
      (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
    if (!exported) {
      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isVariableStatement(node)) {
      const statementDoc = jsDocText(node, sourceText);
      for (const decl of node.declarationList.declarations) {
        recordOwning(exports, {
          file: rel,
          pack,
          sourceFile,
          node: decl,
          name: declarationName(decl),
          kind: "value",
          sourceText,
          docText: jsDocText(decl, sourceText) || statementDoc,
        });
      }
      return;
    }

    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)
    ) {
      const kind: Kind = isTypeOnly(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)
        ? "type"
        : "value";
      recordOwning(exports, {
        file: rel,
        pack,
        sourceFile,
        node,
        name: declarationName(node),
        kind,
        sourceText,
      });
      return;
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  const owning = exports.filter((entry) => entry.kind !== "re-export");
  const moduleFindings: Array<Finding> = [];
  if (owning.length > 0) {
    if (!hasUsefulLead(overview)) {
      moduleFindings.push({ rule: "missing-module-summary", detail: "Module lacks a useful fileoverview lead." });
    }
    if (!overviewTags.includes("@packageDocumentation")) {
      moduleFindings.push({
        rule: "missing-packageDocumentation",
        detail: "Exporting module lacks @packageDocumentation.",
      });
    }
    if (!overviewTags.includes("@since")) {
      moduleFindings.push({ rule: "missing-module-since", detail: "Exporting module lacks @since 0.0.0." });
    }
    if (/@remarks\b/u.test(overview)) {
      moduleFindings.push({ rule: "legacy-remarks", detail: "Module fileoverview uses @remarks." });
    }
    if (/@example\b/u.test(overview)) {
      moduleFindings.push({ rule: "legacy-example", detail: "Module fileoverview uses @example." });
    }
    if (/@module\b/u.test(overview)) {
      moduleFindings.push({ rule: "forbidden-module", detail: "Module uses @module." });
    }
  }

  return {
    module: {
      file: rel,
      pack,
      exportCount: exports.length,
      owningExportCount: owning.length,
      hasFileoverview: overview.startsWith("/**"),
      hasPackageDocumentation: overviewTags.includes("@packageDocumentation"),
      hasSince: overviewTags.includes("@since"),
      hasLead: hasUsefulLead(overview),
      hasRemarks: /@remarks\b/u.test(overview),
      hasLegacyExample: /@example\b/u.test(overview),
      findings: moduleFindings,
    },
    exports,
  };
};

const main = async (): Promise<void> => {
  const files = (await walk(scratchpadRoot, [])).sort();
  const modules: Array<ModuleRecord> = [];
  const exports: Array<ExportRecord> = [];

  for (const abs of files) {
    const rel = relative(scratchpadRoot, abs).replaceAll("\\", "/");
    const pack = packFor(rel);
    const sourceText = await readFile(abs, "utf8");
    const sourceFile = ts.createSourceFile(abs, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visited = visitSource(rel, pack, sourceFile, sourceText);
    if (visited.module.exportCount === 0) continue;
    modules.push(visited.module);
    exports.push(...visited.exports);
  }

  const packEntries = PACKS.map((id) => {
    const packModules = modules.filter((entry) => entry.pack === id);
    const packExports = exports.filter((entry) => entry.pack === id);
    const owning = packExports.filter((entry) => entry.kind !== "re-export");
    const openModules = packModules.filter((entry) => entry.findings.length > 0);
    const openOwning = owning.filter((entry) => entry.findings.length > 0);
    return {
      id,
      files: packModules.map((entry) => entry.file),
      moduleCount: packModules.length,
      exportCount: packExports.length,
      owningExportCount: owning.length,
      openModuleCount: openModules.length,
      openOwningExportCount: openOwning.length,
      openModules: openModules.map((entry) => ({ file: entry.file, findings: entry.findings })),
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    moduleCount: modules.length,
    exportCount: exports.length,
    owningExportCount: exports.filter((entry) => entry.kind !== "re-export").length,
    reExportCount: exports.filter((entry) => entry.kind === "re-export").length,
    openModuleCount: modules.filter((entry) => entry.findings.length > 0).length,
    openOwningExportCount: exports.filter((entry) => entry.kind !== "re-export" && entry.findings.length > 0).length,
    byKind: {
      value: exports.filter((entry) => entry.kind === "value").length,
      type: exports.filter((entry) => entry.kind === "type").length,
      "re-export": exports.filter((entry) => entry.kind === "re-export").length,
    },
    packs: packEntries.map((pack) => ({
      id: pack.id,
      moduleCount: pack.moduleCount,
      owningExportCount: pack.owningExportCount,
      openModuleCount: pack.openModuleCount,
      openOwningExportCount: pack.openOwningExportCount,
    })),
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "census.json"), `${JSON.stringify({ summary, modules, exports }, null, 2)}\n`);
  await writeFile(join(outDir, "packs.json"), `${JSON.stringify(packEntries, null, 2)}\n`);
  await writeFile(join(outDir, "census-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  const md: Array<string> = [
    "# Scratchpad JSDoc census",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Totals",
    "",
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| scanned files | ${summary.fileCount} |`,
    `| exporting modules | ${summary.moduleCount} |`,
    `| all export declarations | ${summary.exportCount} |`,
    `| owning exports | ${summary.owningExportCount} |`,
    `| re-exports | ${summary.reExportCount} |`,
    `| open modules (mechanical) | ${summary.openModuleCount} |`,
    `| open owning exports (mechanical) | ${summary.openOwningExportCount} |`,
    "",
    "## Packs",
    "",
    `| Pack | Modules | Owning | Open modules | Open owning |`,
    `| --- | ---: | ---: | ---: | ---: |`,
    ...packEntries.map(
      (pack) =>
        `| \`${pack.id}\` | ${pack.moduleCount} | ${pack.owningExportCount} | ${pack.openModuleCount} | ${pack.openOwningExportCount} |`
    ),
    "",
  ];
  await writeFile(join(outDir, "census.md"), `${md.join("\n")}\n`);

  console.log(JSON.stringify(summary, null, 2));
};

await main();
