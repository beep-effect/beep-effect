#!/usr/bin/env bun
/**
 * Branded `S.Opaque` default codemod for the `schema-opaque-default` goal.
 *
 * Run from the repository root:
 *
 *   bun run goals/schema-opaque-default/ops/codemod/run.ts [--check] [--reverse]
 *     [--paths <glob>...] [--report <file.json>] [--no-format]
 *
 * The normative contract is `goals/schema-opaque-default/SPEC.md` (D1-D8);
 * `README.md` next to this file documents every transform and keep reason.
 *
 * Edits are applied as text ranges over the TypeScript AST (`codemod.ts`), so
 * formatting outside the touched spans is untouched; touched files are then
 * formatted with Biome. The codemod is idempotent: a second run computes zero
 * edits, which `--check` turns into the exit code.
 *
 * This is a goal-scoped repository tool (excluded from `bun run check` like
 * every `goals/**` script). It drives the imperative TypeScript compiler API
 * directly; Effect-first laws apply to the code it rewrites, not to its own
 * AST traversal.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { Jsonc } from "@beep/jsonc/Jsonc";
import * as Result from "effect/Result";
import { familyOf, runCodemod } from "./codemod.ts";
import type { KeepEntry } from "./codemod.ts";

const SCOPE_ROOTS = ["apps", "packages", "infra", "scratchpad", "goals", "explorations", "tools"] as const;
const KEEP_CLASS_FILE = "goals/schema-opaque-default/ops/codemod/keep-class.jsonc";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  readonly check: boolean;
  readonly format: boolean;
  readonly paths: ReadonlyArray<string>;
  readonly report: string | undefined;
  readonly reverse: boolean;
}

const parseCli = (argv: ReadonlyArray<string>): CliOptions => {
  let check = false;
  let reverse = false;
  let format = true;
  let report: string | undefined;
  const paths: Array<string> = [];
  let mode: "flags" | "paths" = "flags";
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] ?? "";
    if (arg === "--check") {
      check = true;
      mode = "flags";
    } else if (arg === "--reverse") {
      reverse = true;
      mode = "flags";
    } else if (arg === "--no-format") {
      format = false;
      mode = "flags";
    } else if (arg === "--report") {
      report = argv[++index];
      mode = "flags";
    } else if (arg === "--paths") {
      mode = "paths";
    } else if (mode === "paths" && !arg.startsWith("--")) {
      paths.push(arg);
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(2);
    }
  }
  return { check, reverse, format, paths, report };
};

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

const gitFiles = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  execFileSync("git", ["ls-files", ...args], { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    .split("\n")
    .filter((file) => file.length > 0);

const listScopeFiles = (): ReadonlyArray<string> =>
  gitFiles(["--cached", "--others", "--exclude-standard", "--", ...SCOPE_ROOTS])
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts"))
    .filter((file) => !/(^|\/)(node_modules|dist|\.repos)\//.test(file))
    .filter((file) => existsSync(path.join(repoRoot, file)))
    .filter((file) => !isNestedFixtureProject(file));

/**
 * Files inside a sample project nested under a `fixtures/` directory (it has its own
 * tsconfig.json or package.json) are test inputs whose exact source is the expectation.
 */
const isNestedFixtureProject = (file: string): boolean => {
  const parts = file.split("/");
  const at = parts.indexOf("fixtures");
  if (at < 0) return false;
  for (let end = at + 2; end < parts.length; end++) {
    const dir = path.join(repoRoot, ...parts.slice(0, end));
    if (existsSync(path.join(dir, "tsconfig.json")) || existsSync(path.join(dir, "package.json"))) return true;
  }
  return false;
};

const listPackageDirs = (): ReadonlyMap<string, string> => {
  const out = new Map<string, string>();
  const manifests = gitFiles(["--", ...SCOPE_ROOTS.map((root) => `${root}/**/package.json`)]).filter(
    (file) => !file.includes("node_modules/")
  );
  for (const manifest of manifests) {
    try {
      const name = JSON.parse(readFileSync(path.join(repoRoot, manifest), "utf8")).name;
      if (typeof name === "string") out.set(name, path.dirname(manifest));
    } catch {
      // unreadable manifest: not a resolution target
    }
  }
  return out;
};

const readKeepClass = (): ReadonlyArray<KeepEntry> => {
  const file = path.join(repoRoot, KEEP_CLASS_FILE);
  if (!existsSync(file)) return [];
  const parsed: unknown = Result.getOrUndefined(Jsonc.parseResult(readFileSync(file, "utf8")));
  const entries: ReadonlyArray<unknown> = Array.isArray(parsed) ? parsed : [];
  return entries.filter(
    (entry): entry is KeepEntry =>
      typeof entry === "object" &&
      entry !== null &&
      "file" in entry &&
      "class" in entry &&
      "reason" in entry &&
      typeof entry.file === "string" &&
      typeof entry.class === "string" &&
      typeof entry.reason === "string"
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const formatFiles = (files: ReadonlyArray<string>): void => {
  const biome = path.join(repoRoot, "node_modules/.bin/biome");
  for (let index = 0; index < files.length; index += 200) {
    const batch = files.slice(index, index + 200);
    try {
      execFileSync(biome, ["check", "--write", "--linter-enabled=false", "--no-errors-on-unmatched", ...batch], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "pipe"],
      });
    } catch (error) {
      process.stderr.write(`biome format failed for a batch: ${String(error).slice(0, 2000)}\n`);
    }
  }
};

const main = (): void => {
  const options = parseCli(process.argv.slice(2));
  const started = Date.now();
  const files = listScopeFiles();
  const keepClass = readKeepClass();
  const matchers = options.paths.map((pattern) => new Bun.Glob(pattern));
  const inScope = (file: string): boolean => matchers.length === 0 || matchers.some((glob) => glob.match(file));

  const { results, outputs, newSites, opaqueWithKeepReasons } = runCodemod({
    sources: files.map((file) => ({ file, text: readFileSync(path.join(repoRoot, file), "utf8") })),
    packageDirs: listPackageDirs(),
    keepClass,
    reverse: options.reverse,
    inScope,
  });

  const changed = outputs.map((output) => output.file);
  if (!options.check) {
    for (const output of outputs) writeFileSync(path.join(repoRoot, output.file), output.text);
    if (options.format && changed.length > 0) formatFiles(changed);
  }

  const scoped = results.filter((result) => inScope(result.file));
  const byOutcome: Record<string, number> = {};
  const byKindOutcome: Record<string, number> = {};
  const byFamily: Record<string, Record<string, number>> = {};
  const keepHistogram: Record<string, number> = {};
  for (const result of scoped) {
    byOutcome[result.outcome] = (byOutcome[result.outcome] ?? 0) + 1;
    const kindKey = `${result.kind}:${result.outcome}`;
    byKindOutcome[kindKey] = (byKindOutcome[kindKey] ?? 0) + 1;
    const family = familyOf(result.file);
    const familyCounts = byFamily[family] ?? {};
    familyCounts[result.outcome] = (familyCounts[result.outcome] ?? 0) + 1;
    byFamily[family] = familyCounts;
    for (const reason of result.keepReasons) keepHistogram[reason] = (keepHistogram[reason] ?? 0) + 1;
  }
  const summary = {
    mode: options.check ? "check" : options.reverse ? "reverse" : "write",
    files: files.length,
    declarations: scoped.length,
    changedFiles: changed.length,
    byOutcome,
    byKindOutcome,
    keepHistogram,
    byFamily,
    newSites,
    opaqueWithKeepReasons,
    keepClassEntries: keepClass.length,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  if (options.report !== undefined) {
    writeFileSync(
      path.resolve(options.report),
      `${JSON.stringify({ ...summary, declarationsDetail: scoped }, null, 2)}\n`
    );
  }
  process.stdout.write(`${JSON.stringify({ ...summary, byFamily: undefined, newSites: newSites.length }, null, 2)}\n`);
  if (options.check && changed.length > 0) {
    process.stderr.write(`--check: ${changed.length} file(s) would change:\n${changed.slice(0, 50).join("\n")}\n`);
    process.exit(1);
  }
};

main();
