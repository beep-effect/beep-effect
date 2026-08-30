/**
 * adapter-typescript — SourceObservation extractor for the beep-ci-ops §4b
 * normalization run (ontology-foundational-auditor contract).
 *
 * Emits one JSON record per matched TOP-LEVEL declaration to stdout (one line
 * per record). The committed python wrapper (adapter-typescript.py) converts
 * records to work/observations/so-<sha12>.yaml files; the validator recomputes
 * every id and span hash, so this script must mirror its canonical rules
 * exactly (validate_artifacts.py: canonical_obs_id, strip_comments, occurs).
 *
 * Determinism contract: input bytes come from `git show <commit>:<path>`,
 * never the working tree; files and records are emitted in sorted order; no
 * timestamps, no randomness. Same pinned commit + same version => same ids.
 */
import ts from "typescript";

const ADAPTER_ID = "adapter-typescript";
const ADAPTER_VERSION = "1.0.0";
const PARSER = `typescript@${ts.version}`;
const SCRIPT =
  "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/adapter-typescript.py";

/** Corpus scope: the S4 candidate-evidence census (32-file census, TS members).
 * Fixed here so the corpus is part of the pinned script bytes. */
const CORPUS_FILES = [
  "packages/tooling/tool/cli/src/commands/Ci/CiLane.ts",
  "packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts",
  "packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts",
  "packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts",
  "packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts",
  "packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts",
  "packages/tooling/tool/cli/src/internal/cli/TurboCache.ts",
  "packages/tooling/tool/cli/src/internal/github/JobShape.ts",
  "packages/tooling/tool/cli/src/internal/process/StepExec.ts",
  "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts",
  "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts",
  "packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts",
  "packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts",
];

type Fact = { predicate: string; object: string };
type Rec = {
  id: string;
  schema_version: 1;
  repository: { commit: string; path: string };
  source_span: { start_line: number; end_line: number; content_sha256: string };
  extractor: { id: string; version: string; parser: string; script: string };
  symbol: { qualified_name: string; lexical_name: string; syntactic_kind: string };
  observed_facts: Fact[];
  source_excerpt: string;
  epistemic_status: "parser_derived";
};

const sha256hex = (data: string): string => {
  const h = new Bun.CryptoHasher("sha256");
  h.update(data);
  return h.digest("hex");
};

/** Mirror of validate_artifacts.py strip_comments (union of comment families,
 * empty replacement, unclosed runs to EOF). */
const stripComments = (text: string): string =>
  text
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/\/\*[\s\S]*?(\*\/|$)/g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/#[^\n]*/g, "")
    .replace(/^[ \t]*[;!][^\n]*/gm, "");

const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mirror of validate_artifacts.py occurs(): token-bounded, # is identifier
 * punctuation. */
const occurs = (probe: string, text: string): boolean =>
  new RegExp(`(?<![\\w$#])${reEscape(probe)}(?![\\w$#])`).test(text);

/** Identifier-object grammar mirror: strip <...> once, then reject
 * whitespace/slash. */
const identOk = (obj: string): boolean => !/[\s/]/.test(obj.replace(/<[^<>]*>/g, ""));

/** Python json.dumps(..., sort_keys=True, separators=(',', ':'),
 * ensure_ascii=False) equivalent for our payloads (arrays / strings / ints —
 * no objects, so sort_keys is moot; JSON.stringify escapes identically). */
const canonicalJson = (v: unknown): string => JSON.stringify(v);

const gitShow = (repo: string, commit: string, path: string): string => {
  const p = Bun.spawnSync(["git", "-C", repo, "show", `${commit}:${path}`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (p.exitCode !== 0) {
    throw new Error(`git show ${commit}:${path} failed: ${p.stderr.toString()}`);
  }
  return p.stdout.toString();
};

const splitKeepEnds = (text: string): string[] => {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
};

const KIND_NAMES: Partial<Record<ts.SyntaxKind, string>> = {
  [ts.SyntaxKind.ClassDeclaration]: "class_declaration",
  [ts.SyntaxKind.InterfaceDeclaration]: "interface_declaration",
  [ts.SyntaxKind.TypeAliasDeclaration]: "type_alias_declaration",
  [ts.SyntaxKind.EnumDeclaration]: "enum_declaration",
  [ts.SyntaxKind.FunctionDeclaration]: "function_declaration",
  [ts.SyntaxKind.VariableStatement]: "variable_declaration",
  [ts.SyntaxKind.ModuleDeclaration]: "module_declaration",
};

const isExported = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node)
    ? (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    : false;

/** Leftmost dotted-name of an expression: S.Class<X>()("X", {...}) -> "S.Class". */
const leftmostName = (e: ts.Expression): string | undefined => {
  let cur: ts.Expression = e;
  for (;;) {
    if (ts.isCallExpression(cur)) cur = cur.expression;
    else if (ts.isExpressionWithTypeArguments(cur)) cur = cur.expression;
    else if (ts.isParenthesizedExpression(cur)) cur = cur.expression;
    else break;
  }
  const dotted = (x: ts.Expression): string | undefined => {
    if (ts.isIdentifier(x)) return x.text;
    if (ts.isPropertyAccessExpression(x)) {
      const left = dotted(x.expression);
      return left === undefined ? undefined : `${left}.${x.name.text}`;
    }
    return undefined;
  };
  return dotted(cur);
};

const nameText = (n: ts.PropertyName | ts.Identifier | undefined): string | undefined => {
  if (!n) return undefined;
  if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) return n.text;
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  return undefined;
};

/** Collect string-literal members of LiteralKit-family call expressions inside
 * a subtree (direct args and array-literal args). */
const literalKitMembers = (root: ts.Node): string[] => {
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const callee = leftmostName(n.expression);
      if (callee !== undefined && /(^|\.)(Mapped)?LiteralKit$/.test(callee)) {
        for (const arg of n.arguments) {
          if (ts.isStringLiteral(arg)) out.push(arg.text);
          else if (ts.isArrayLiteralExpression(arg)) {
            for (const el of arg.elements) if (ts.isStringLiteral(el)) out.push(el.text);
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(root);
  return out;
};

interface Decl {
  node: ts.Node;
  name: string;
  kind: string;
  facts: Fact[];
}

const declFacts = (node: ts.Node): Decl[] => {
  const out: Decl[] = [];
  const push = (name: string | undefined, kind: string, facts: Fact[], n: ts.Node): void => {
    if (name === undefined || name === "") return;
    out.push({ node: n, name, kind, facts });
  };
  const heritage = (n: ts.ClassDeclaration | ts.InterfaceDeclaration, facts: Fact[]): void => {
    for (const h of n.heritageClauses ?? []) {
      const pred =
        h.token === ts.SyntaxKind.ExtendsKeyword
          ? "extends_syntactically"
          : "implements_syntactically";
      for (const t of h.types) {
        const nm = leftmostName(t.expression);
        if (nm !== undefined) facts.push({ predicate: pred, object: nm });
      }
    }
  };
  const decorators = (n: ts.Node, facts: Fact[]): void => {
    if (!ts.canHaveDecorators(n)) return;
    for (const d of ts.getDecorators(n) ?? []) {
      const nm = leftmostName(d.expression);
      if (nm !== undefined) facts.push({ predicate: "decorates_with", object: nm });
    }
  };

  if (ts.isClassDeclaration(node)) {
    const facts: Fact[] = [];
    const name = node.name?.text;
    if (isExported(node) && name) facts.push({ predicate: "exports_symbol", object: name });
    heritage(node, facts);
    decorators(node, facts);
    for (const m of node.members) {
      if (ts.isConstructorDeclaration(m)) continue;
      const nm = nameText(m.name as ts.PropertyName | undefined);
      if (nm !== undefined) facts.push({ predicate: "declares_member", object: nm });
    }
    for (const lm of literalKitMembers(node)) {
      facts.push({ predicate: "declares_literal_member", object: lm });
    }
    push(name, "class_declaration", facts, node);
  } else if (ts.isInterfaceDeclaration(node)) {
    const facts: Fact[] = [];
    if (isExported(node)) facts.push({ predicate: "exports_symbol", object: node.name.text });
    heritage(node, facts);
    for (const m of node.members) {
      const nm = nameText(m.name as ts.PropertyName | undefined);
      if (nm !== undefined) facts.push({ predicate: "declares_field", object: nm });
    }
    push(node.name.text, "interface_declaration", facts, node);
  } else if (ts.isTypeAliasDeclaration(node)) {
    const facts: Fact[] = [{ predicate: "declares_type_alias", object: node.name.text }];
    if (isExported(node)) facts.push({ predicate: "exports_symbol", object: node.name.text });
    const t = node.type;
    const memberTexts = (members: readonly ts.TypeNode[], pred: string): void => {
      for (const m of members) {
        if (ts.isLiteralTypeNode(m) && ts.isStringLiteral(m.literal)) {
          facts.push({ predicate: pred, object: `"${m.literal.text}"` });
        } else if (ts.isTypeReferenceNode(m) && ts.isIdentifier(m.typeName)) {
          facts.push({ predicate: pred, object: m.typeName.text });
        }
      }
    };
    if (ts.isUnionTypeNode(t)) memberTexts(t.types, "declares_union_member");
    if (ts.isIntersectionTypeNode(t)) memberTexts(t.types, "declares_intersection_member");
    push(node.name.text, "type_alias_declaration", facts, node);
  } else if (ts.isEnumDeclaration(node)) {
    const facts: Fact[] = [];
    if (isExported(node)) facts.push({ predicate: "exports_symbol", object: node.name.text });
    for (const m of node.members) {
      const nm = nameText(m.name);
      if (nm !== undefined) facts.push({ predicate: "declares_member", object: nm });
    }
    push(node.name.text, "enum_declaration", facts, node);
  } else if (ts.isFunctionDeclaration(node)) {
    const name = node.name?.text;
    const facts: Fact[] = [];
    if (isExported(node) && name) facts.push({ predicate: "exports_symbol", object: name });
    for (const p of node.parameters) {
      if (ts.isIdentifier(p.name)) {
        facts.push({ predicate: "declares_parameter", object: p.name.text });
      }
    }
    push(name, "function_declaration", facts, node);
  } else if (ts.isVariableStatement(node)) {
    for (const d of node.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      const facts: Fact[] = [];
      if (isExported(node)) facts.push({ predicate: "exports_symbol", object: d.name.text });
      if (d.initializer) {
        for (const lm of literalKitMembers(d.initializer)) {
          facts.push({ predicate: "declares_literal_member", object: lm });
        }
      }
      push(d.name.text, "variable_declaration", facts, node);
    }
  } else if (ts.isModuleDeclaration(node)) {
    const name = ts.isIdentifier(node.name) ? node.name.text : undefined;
    const facts: Fact[] = [];
    if (isExported(node)) {
      if (name) facts.push({ predicate: "exports_symbol", object: name });
    }
    const body = node.body;
    if (body && ts.isModuleBlock(body)) {
      for (const st of body.statements) {
        const nm =
          (ts.isTypeAliasDeclaration(st) ||
            ts.isInterfaceDeclaration(st) ||
            ts.isClassDeclaration(st) ||
            ts.isEnumDeclaration(st) ||
            ts.isFunctionDeclaration(st)) &&
          st.name &&
          ts.isIdentifier(st.name)
            ? st.name.text
            : undefined;
        if (nm !== undefined) facts.push({ predicate: "declares_member", object: nm });
      }
    }
    push(name, "module_declaration", facts, node);
  }
  return out;
};

const extractFile = (commit: string, path: string, text: string): Rec[] => {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lines = splitKeepEnds(text);
  const recs: Rec[] = [];
  for (const stmt of sf.statements) {
    for (const decl of declFacts(stmt)) {
      const start = sf.getLineAndCharacterOfPosition(decl.node.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(decl.node.getEnd()).line + 1;
      const spanText = lines.slice(start - 1, end).join("");
      const stripped = stripComments(spanText);
      // Grammar + occurrence guards mirror the validator: a fact that cannot
      // pass is DROPPED here (never squashed into a near-miss shape).
      const seen = new Set<string>();
      const facts: Fact[] = [];
      for (const f of decl.facts) {
        if (f.object === "") continue;
        if (f.predicate !== "declares_literal_member" && !identOk(f.object)) continue;
        if (!occurs(f.object, stripped)) continue;
        const key = `${f.predicate} ${f.object}`;
        if (seen.has(key)) continue;
        seen.add(key);
        facts.push(f);
      }
      if (!occurs(decl.name, stripped)) continue;
      // A declaration the closed vocabulary cannot describe at all (zero
      // representable facts) is recorded via the escape hatch — never dropped,
      // never squashed; such records may only disposition unresolved/irrelevant.
      if (facts.length === 0) {
        facts.push({ predicate: "unrepresentable_construct", object: decl.kind });
      }
      const sortedPairs = facts
        .map((f) => [f.predicate, f.object] as [string, string])
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
      const payload = [commit, path, start, end, sortedPairs, ADAPTER_ID, ADAPTER_VERSION];
      const id = `so:sha256:${sha256hex(canonicalJson(payload))}`;
      recs.push({
        id,
        schema_version: 1,
        repository: { commit, path },
        source_span: { start_line: start, end_line: end, content_sha256: sha256hex(spanText) },
        extractor: { id: ADAPTER_ID, version: ADAPTER_VERSION, parser: PARSER, script: SCRIPT },
        symbol: {
          qualified_name: `${path}::${decl.name}`,
          lexical_name: decl.name,
          syntactic_kind: decl.kind,
        },
        observed_facts: sortedPairs.map(([predicate, object]) => ({ predicate, object })),
        source_excerpt: (lines[start - 1] ?? "").trim().slice(0, 200),
        epistemic_status: "parser_derived",
      });
    }
  }
  return recs;
};

const main = (): void => {
  const args = new Map<string, string>();
  const argv = Bun.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) args.set(argv[i], argv[i + 1] ?? "");
  const repo = args.get("--repo");
  const commit = args.get("--commit");
  const goldenInput = args.get("--golden-input");
  if (goldenInput !== undefined && goldenInput !== "") {
    // Golden mode: fixed commit "GOLDEN", path = provided relative path,
    // bytes read directly from the fixture file.
    const path = args.get("--golden-path") ?? "golden/input.ts";
    const text = new TextDecoder().decode(
      new Uint8Array(require("node:fs").readFileSync(goldenInput)),
    );
    for (const r of extractFile("GOLDEN", path, text)) console.log(JSON.stringify(r));
    return;
  }
  if (repo === undefined || commit === undefined) {
    console.error(
      "usage: bun adapter-typescript.ts --repo <root> --commit <sha> | --golden-input <file> --golden-path <rel>",
    );
    process.exit(2);
  }
  const all: Rec[] = [];
  for (const path of [...CORPUS_FILES].sort()) {
    all.push(...extractFile(commit, path, gitShow(repo, commit, path)));
  }
  all.sort((a, b) =>
    a.repository.path < b.repository.path
      ? -1
      : a.repository.path > b.repository.path
        ? 1
        : a.source_span.start_line - b.source_span.start_line ||
          (a.symbol.lexical_name < b.symbol.lexical_name ? -1 : 1),
  );
  for (const r of all) console.log(JSON.stringify(r));
};

main();
