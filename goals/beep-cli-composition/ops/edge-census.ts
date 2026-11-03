/**
 * Full import-edge census of `@beep/repo-cli`, mapped to the future homes in
 * `research/design-record.md` (the W1 and W7 exit gates in `SPEC.md`).
 *
 * Run from the repository root:
 *
 *   bun goals/beep-cli-composition/ops/edge-census.ts [--json]
 *
 * Every `import`, `export ... from`, `import type` and dynamic `import()` in
 * `packages/tooling/tool/cli/src` is read (type-only edges count: a split
 * package needs the dependency either way) and resolved relative to its file.
 * Each file gets a home from `homeOf`:
 *
 * - `app:beep` — the shell, root command and dispatch manifest (W8);
 * - `app:<name>` — groups leaving tooling (D4);
 * - `tool:<name>` — the command tools (D7, D8, D9, D19), by command group;
 * - `lib:<name>` — `src/internal/**` and the library carve-outs that still
 *   sit under a command group;
 * - `test-kit` — the source-only `src/test/*.test-kit.ts` facades, which only
 *   re-export and are not counted.
 *
 * Forbidden edges, counted separately:
 *
 * - `library-to-tool`: a `lib:*` file imports a `tool:*` or `app:*` file
 *   (W1 exit gate: zero);
 * - `cross-tool`: a `tool:*` file imports a different `tool:*` or an `app:*`
 *   file (W7 exit gate: zero).
 *
 * Exits non-zero when `--gate w1` (or `--gate w7`) is passed and that class is
 * not empty.
 */
import { readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

const root = process.cwd();
const src = "packages/tooling/tool/cli/src";
const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

// Command group to future home (design-record "Verified package map").
const groupHome: Record<string, string> = {
  Yeet: "tool:beep-yeet",
  Worktree: "tool:beep-yeet",
  Reviewer: "tool:beep-yeet",
  Holds: "tool:beep-yeet",
  Quality: "tool:beep-quality",
  Lint: "tool:beep-quality",
  Laws: "tool:beep-quality",
  Fallow: "tool:beep-quality",
  Qa: "tool:beep-quality",
  Codex: "tool:beep-quality",
  Observability: "tool:beep-quality",
  Models: "tool:beep-harness",
  Accounts: "tool:beep-harness",
  HarnessLedger: "tool:beep-harness",
  AgentEffectiveness: "tool:beep-harness",
  AIMetrics: "tool:beep-harness",
  Session: "tool:beep-harness",
  Palantiri: "tool:beep-harness",
  Skills: "tool:beep-harness",
  Goals: "tool:beep-goals",
  Explore: "tool:beep-goals",
  Knowledge: "tool:beep-goals",
  Docs: "tool:beep-goals",
  CreatePackage: "tool:beep-workspace",
  DeletePackage: "tool:beep-workspace",
  TopoSort: "tool:beep-workspace",
  TsconfigSync: "tool:beep-workspace",
  VersionSync: "tool:beep-workspace",
  Architecture: "tool:beep-workspace",
  Purge: "tool:beep-workspace",
  Labs: "tool:beep-workspace",
  Codegen: "tool:beep-workspace",
  SyncDataToTs: "tool:beep-workspace",
  Refs: "tool:beep-workspace",
  Ci: "tool:beep-ci",
  Cache: "tool:beep-ci",
  Runners: "tool:beep-ci",
  Docgen: "tool:beep-docgen",
  Corpus: "app:practice-corpus",
  Drawings: "app:practice-drawings",
  Files: "app:dataset-curation",
  Image: "app:dataset-curation",
  Research: "app:research",
  AgentMessage: "app:agent-router",
};

// Library content that still sits under a command group, and the library it
// moves to. Each wave adds the files it carves out (W1b: the PLAN "Verifier
// must-fix list"; W2 to W7: each new library) before it moves them, and the
// census must stay at zero library-to-tool edges. Longest prefix wins.
const carveOuts: Record<string, string> = {};

// `src/internal/<dir>` to its library (design-record "New libraries").
const internalHome = (path: string): string => {
  const [, directory] = path.split("/");
  switch (directory) {
    case "dispatch":
      return "app:beep";
    case "repo-run":
    case "state":
      return "lib:repo-run";
    case "github":
      return "lib:repo-github";
    case "quality":
    case "ratchet":
      return "lib:repo-gates";
    case "jsdoc":
    case "tsmorph":
      return "lib:repo-utils";
    default:
      return "lib:repo-cli-kit";
  }
};

export const homeOf = (path: string): string => {
  const carve = Object.keys(carveOuts)
    .filter((prefix) => path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`))
    .sort((left, right) => right.length - left.length)[0];
  if (carve !== undefined) return carveOuts[carve] ?? "unknown";
  if (path.startsWith("test/")) return "test-kit";
  if (path === "bin.ts" || path === "bin-main.ts" || path === "index.ts" || path === "commands/Root.ts")
    return "app:beep";
  if (path.startsWith("internal/")) return internalHome(path);
  const group = path.match(/^commands\/([^/]+)\//)?.[1];
  return group === undefined ? "unknown" : (groupHome[group] ?? `unknown:${group}`);
};

const files = (await Bun.$`git -C ${root} ls-files --cached --others --exclude-standard -- ${src}`.text())
  .trim()
  .split("\n")
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));
const known = new Set(files.map((file) => relative(src, file)));

const specifierPattern =
  /(?:^|[\s;}])(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

type Edge = { readonly from: string; readonly to: string; readonly fromHome: string; readonly toHome: string };
const edges: Array<Edge> = [];
for (const file of files) {
  const from = relative(src, file);
  const text = stripComments(readFileSync(join(root, file), "utf8"));
  for (const match of text.matchAll(specifierPattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier === undefined || !specifier.startsWith(".")) continue;
    const to = normalize(join(dirname(from), specifier));
    // A specifier that leaves `src` (or is not a tracked module, as in generated
    // source held in a template string) is not a repo-cli edge.
    if (to.startsWith("..") || !(known.has(to) || known.has(`${to}.ts`) || known.has(`${to}/index.ts`))) continue;
    const resolved = known.has(to)
      ? to
      : known.has(`${to}.ts`)
        ? `${to}.ts`
        : known.has(`${to}/index.ts`)
          ? `${to}/index.ts`
          : to;
    edges.push({ from, to: resolved, fromHome: homeOf(from), toHome: homeOf(resolved) });
  }
}

const libraryToTool = edges.filter(
  (edge) => edge.fromHome.startsWith("lib:") && (edge.toHome.startsWith("tool:") || edge.toHome.startsWith("app:"))
);
const crossTool = edges.filter(
  (edge) =>
    edge.fromHome.startsWith("tool:") &&
    ((edge.toHome.startsWith("tool:") && edge.toHome !== edge.fromHome) || edge.toHome.startsWith("app:"))
);
const unknown = [
  ...new Set(edges.flatMap((edge) => [edge.fromHome, edge.toHome]).filter((home) => home.startsWith("unknown"))),
];

const summary = {
  files: files.length,
  edges: edges.length,
  unknownHomes: unknown,
  libraryToTool: libraryToTool.length,
  crossTool: crossTool.length,
  crossToolPairs: Object.entries(
    crossTool.reduce<Record<string, number>>((pairs, edge) => {
      const key = `${edge.fromHome} -> ${edge.toHome}`;
      pairs[key] = (pairs[key] ?? 0) + 1;
      return pairs;
    }, {})
  ).sort((left, right) => right[1] - left[1]),
};

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        ...summary,
        libraryToToolEdges: libraryToTool,
        crossToolEdges: crossTool,
        unknownEdges: edges.filter((edge) => edge.fromHome.startsWith("unknown") || edge.toHome.startsWith("unknown")),
      },
      null,
      2
    )
  );
} else {
  console.log(JSON.stringify(summary, null, 2));
  for (const edge of libraryToTool) console.log(`library-to-tool ${edge.from} -> ${edge.to} (${edge.toHome})`);
}

const gate = argument("--gate");
if ((gate === "w1" && libraryToTool.length > 0) || (gate === "w7" && crossTool.length > 0) || unknown.length > 0)
  process.exitCode = 1;
