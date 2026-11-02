/**
 * G4 soundness replay for the per-task lint policy fingerprint.
 *
 * Run from the repository root:
 *
 *   bun goals/beep-cli-composition/ops/g4-fingerprint-replay.ts [--commits 400] [--today <ref>] [--head <ref>]
 *
 * For every policy task it builds the task's true import closure with an
 * oracle that shares no parser or resolver with the generator: Bun's own
 * `Transpiler.scanImports` (type-only imports erased) and `Bun.resolveSync`.
 * The oracle applies the generator's documented cut policy (the shell never
 * enters `src/commands`; each command on the argv path drops imports that
 * only bind its subcommands). It then replays the last N first-parent commits
 * of `--head` and reports, per task:
 *
 * - `today`: commits that touch the v1 whole-closure fingerprint inputs at `--today`;
 * - `perTask`: commits that touch the task's seal chain (shared + its prefixes);
 * - `stale`: commits that touch the task's oracle closure but not its seal chain
 *   (a stale-green replay; the soundness claim is that this is zero);
 * - `gaps`: oracle closure modules the seal chain does not declare.
 *
 * Output: JSON on stdout.
 */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
};
const root = process.cwd();
const commits = Number(argument("--commits", "400"));
const todayRef = argument("--today", "2c1ff256c1");
const headRef = argument("--head", "origin/main");
const cli = "packages/tooling/tool/cli/src";
const sealPrefix = "//#lint:policy-fingerprint:";

const graphModule = await import(join(root, `${cli}/commands/Lint/internal/PolicyFingerprintGraph.ts`));
const declaration = JSON.parse(readFileSync(join(root, "standards/policy-tools.fingerprint.json"), "utf8"));
const turbo = JSON.parse(readFileSync(join(root, "turbo.json"), "utf8"));
const todayInputs: Array<string> = JSON.parse(
  await Bun.$`git -C ${root} show ${todayRef}:standards/policy-tools.fingerprint.json`.text()
).inputs;

// Workspaces and a filesystem tree for the generator's command-path walk.
const tracked = (await Bun.$`git -C ${root} ls-files --cached --others --exclude-standard`.text()).trim().split("\n");
const workspaces = [];
for (const manifest of tracked.filter((file) => /^(packages|apps)\/.*package\.json$/.test(file))) {
  if (/\/(test|fixtures|node_modules)\//.test(manifest)) continue;
  const parsed = JSON.parse(readFileSync(join(root, manifest), "utf8"));
  if (typeof parsed.name === "string")
    workspaces.push({
      name: parsed.name,
      directory: manifest.replace(/\/package\.json$/, ""),
      exports: parsed.exports,
      imports: parsed.imports,
    });
}
const tree = {
  read: (file: string) =>
    Effect.sync(() => {
      try {
        return O.some(readFileSync(join(root, file), "utf8"));
      } catch {
        return O.none();
      }
    }),
  files: (directory: string) => Effect.succeed(tracked.filter((file) => file.startsWith(`${directory}/`))),
};
const graph = graphModule.makePolicyGraph({ tree, workspaces });
const layout = {
  shell: [`${cli}/bin.ts`, `${cli}/bin-main.ts`],
  rootModule: `${cli}/commands/Root.ts`,
  rootBinding: "rootCommand",
  commandsDirectory: `${cli}/commands`,
};

// Oracle edges: Bun's scanner and resolver, workspace symlinks resolved to their sources.
const transpilers = { ts: new Bun.Transpiler({ loader: "ts" }), tsx: new Bun.Transpiler({ loader: "tsx" }) };
const edgeCache = new Map<string, Array<{ specifier: string; target: string }>>();
const oracleEdges = (file: string) => {
  const cached = edgeCache.get(file);
  if (cached !== undefined) return cached;
  const edges: Array<{ specifier: string; target: string }> = [];
  if (/\.(ts|tsx)$/.test(file)) {
    const text = readFileSync(join(root, file), "utf8").replace(/^#!.*\n/, "\n");
    for (const entry of transpilers[file.endsWith(".tsx") ? "tsx" : "ts"].scanImports(text)) {
      let target: string;
      try {
        target = relative(root, realpathSync(Bun.resolveSync(entry.path, dirname(join(root, file)))));
      } catch {
        continue;
      }
      if (!target.startsWith("..") && !target.includes("node_modules/")) edges.push({ specifier: entry.path, target });
    }
  }
  edgeCache.set(file, edges);
  return edges;
};
const subcommandSpecifiers = (module: string, binding: string) => {
  const syntax = graphModule.moduleSyntax(module, readFileSync(join(root, module), "utf8"));
  const definition = [...syntax.commands].find(([name]) => name === binding)?.[1];
  if (definition === undefined) return new Set<string>();
  const subcommands = new Set(definition.subcommands.filter(O.isSome).map((value: O.Some<string>) => value.value));
  return new Set(
    syntax.edges
      .filter(
        (edge: { bindings: O.Option<Array<string>> }) =>
          O.isSome(edge.bindings) &&
          edge.bindings.value.length > 0 &&
          edge.bindings.value.every((name) => subcommands.has(name))
      )
      .map((edge: { specifier: string }) => edge.specifier)
  );
};
const oracleShell = (() => {
  const seen = new Set<string>();
  const pending = [...layout.shell];
  while (pending.length > 0) {
    const module = pending.pop() as string;
    if (seen.has(module)) continue;
    seen.add(module);
    for (const edge of oracleEdges(module))
      if (!edge.target.startsWith(`${layout.commandsDirectory}/`)) pending.push(edge.target);
  }
  return seen;
})();
const oracleCommand = (nodes: ReadonlyArray<{ module: string; binding: string }>) => {
  const seen = new Set<string>();
  const expanded = new Set<string>();
  const pending = nodes.map((node) => {
    const cut = subcommandSpecifiers(node.module, node.binding);
    return { module: node.module, cut: (specifier: string) => cut.has(specifier), full: false };
  });
  while (pending.length > 0) {
    const item = pending.pop() as { module: string; cut: (specifier: string) => boolean; full: boolean };
    if (item.full ? expanded.has(item.module) : seen.has(item.module)) continue;
    seen.add(item.module);
    if (item.full) expanded.add(item.module);
    for (const edge of oracleEdges(item.module))
      if (!item.cut(edge.specifier)) pending.push({ module: edge.target, cut: () => false, full: true });
  }
  return seen;
};

// Generated inputs per task: the seal chain from the task's edge up to `shared`.
const entries = new Map<string, { parent: string; inputs: Array<string>; command: Array<string> }>(
  declaration.entries.map((entry: { key: string }) => [entry.key, entry])
);
const chain = (key: string): Array<string> => {
  if (key === "shared") return declaration.shared;
  const entry = entries.get(key);
  return entry === undefined ? [] : [...entry.inputs, ...chain(entry.parent)];
};
const matcher = (inputs: ReadonlyArray<string>) => {
  const files = new Set(inputs.filter((input) => !input.includes("*")));
  const globs = inputs.filter((input) => input.includes("*")).map((glob) => new Bun.Glob(glob));
  return (file: string) => files.has(file) || globs.some((glob) => glob.match(file));
};
const today = matcher(todayInputs);
const globals = new Set<string>(turbo.global?.inputs ?? []);

// Touched files of the last N first-parent commits.
const log = await Bun.$`git -C ${root} log --first-parent -${commits} ${headRef} --format=C%x20%H --name-only`.text();
const touched: Array<Array<string>> = [];
for (const line of log.split("\n")) {
  if (line.startsWith("C ")) touched.push([]);
  else if (line.trim() !== "") touched.at(-1)?.push(line.trim());
}
const globalCommit = touched.map((files) => files.some((file) => globals.has(file)));

const manifests = tracked.filter((file) => /^(packages|apps)\/.*package\.json$/.test(file));
const weightOf = (task: string) =>
  task.startsWith("//#")
    ? 1
    : manifests.filter((manifest) => {
        try {
          return JSON.parse(readFileSync(join(root, manifest), "utf8")).scripts?.[task] !== undefined;
        } catch {
          return false;
        }
      }).length;

type ReplayRow = {
  readonly task: string;
  readonly seals: ReadonlyArray<string>;
  readonly weight: number;
  readonly cached: boolean;
  readonly oracleModules: number;
  readonly gaps: number;
  readonly today: number;
  readonly perTask: number;
  readonly todayNonGlobal: number;
  readonly perTaskNonGlobal: number;
  readonly stale: number;
};
const rows: Array<ReplayRow> = [];
for (const task of Object.keys(turbo.tasks).sort()) {
  if (task.startsWith("//#lint:policy-fingerprint")) continue;
  const keys: ReadonlyArray<string> = (turbo.tasks[task].dependsOn ?? [])
    .filter((dependency: string) => dependency.startsWith(sealPrefix))
    .map((dependency: string) => dependency.slice(sealPrefix.length));
  if (keys.length === 0) continue;
  const declared = matcher([...new Set(keys.flatMap(chain))]);
  const truth = new Set(oracleShell);
  for (const key of keys) {
    const entry = entries.get(key);
    if (entry === undefined) continue;
    const nodes: ReadonlyArray<{ module: string; binding: string }> = await Effect.runPromise(
      graph.commandPath(layout, entry.command)
    );
    for (const module of oracleCommand(nodes)) truth.add(module);
  }
  const gaps = [...truth].filter((module) => !declared(module));
  let todayMisses = 0;
  let perTaskMisses = 0;
  let todayNonGlobal = 0;
  let perTaskNonGlobal = 0;
  let stale = 0;
  touched.forEach((files, index) => {
    const hitToday = files.some(today);
    const hitDeclared = files.some(declared);
    if (hitToday) todayMisses++;
    if (hitDeclared) perTaskMisses++;
    if (hitToday && !globalCommit[index]) todayNonGlobal++;
    if (hitDeclared && !globalCommit[index]) perTaskNonGlobal++;
    if (files.some((file) => truth.has(file)) && !hitDeclared) stale++;
  });
  rows.push({
    task,
    seals: keys,
    weight: weightOf(task),
    cached: turbo.tasks[task].cache !== false,
    oracleModules: truth.size,
    gaps: gaps.length,
    today: todayMisses,
    perTask: perTaskMisses,
    todayNonGlobal,
    perTaskNonGlobal,
    stale,
  });
}
const total = (field: "today" | "perTask" | "todayNonGlobal" | "perTaskNonGlobal", cachedOnly = false) =>
  rows.filter((row) => !cachedOnly || row.cached).reduce((sum, row) => sum + row.weight * row[field], 0);
process.stdout.write(
  `${JSON.stringify(
    {
      head: (await Bun.$`git -C ${root} rev-parse ${headRef}`.text()).trim(),
      today: todayRef,
      commits: touched.length,
      globalInputCommits: globalCommit.filter(Boolean).length,
      tasks: rows.length,
      taskInstances: rows.reduce((sum, row) => sum + row.weight, 0),
      stale: rows.reduce((sum, row) => sum + row.stale, 0),
      gaps: rows.reduce((sum, row) => sum + row.gaps, 0),
      weighted: {
        today: total("today"),
        perTask: total("perTask"),
        todayNonGlobal: total("todayNonGlobal"),
        perTaskNonGlobal: total("perTaskNonGlobal"),
        cachedToday: total("today", true),
        cachedPerTask: total("perTask", true),
      },
      rows,
    },
    null,
    1
  )}\n`
);
