/**
 * Per-package build baseline for `goals/declaration-only-builds` (SPEC
 * "Baseline and proof harness" and "Declaration-only build" after numbers).
 *
 * Run from the repository root of a built tree, inside one admission job:
 *
 *   beep-heavy bun goals/declaration-only-builds/ops/measure-build-baseline.ts --out <rows.tsv> [--runs 3] [--filter <text>]
 *
 * For every workspace package whose generated `beep:build` emits through
 * `tsrs -p tsconfig.json`, each run:
 *
 * 1. removes `dist`, then times `tsrs -p tsconfig.json` (cold emit);
 * 2. sizes `dist` by class: JavaScript, JavaScript maps, declarations,
 *    declaration maps, incremental state, anything else;
 * 3. times `bun run babel` when the manifest has that script, and sizes the
 *    JavaScript again (the pass rewrites it in place);
 * 4. times a cold `--emitDeclarationOnly` emit into a scratch directory under
 *    the package's git-ignored `.beep/`, as the projection of a
 *    declaration-only build, then removes the scratch directory.
 *
 * Packages run one at a time, in manifest path order, so a package's `dist` is
 * never missing while another program reads it. The tree is left as a normal
 * build leaves it. Rows are tab-separated, one per package and run; the
 * summary on stdout sums each package's fastest run.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const outPath = argument("--out");
if (outPath === undefined) {
  console.error("usage: measure-build-baseline.ts --out <rows.tsv> [--runs 3] [--filter <text>]");
  process.exit(2);
}
const runs = Number(argument("--runs") ?? "3");
const filter = argument("--filter");
const tsrs = join(root, "node_modules/.bin/tsrs");
const emitBuildPrefix = "tsrs -p tsconfig.json";
const scratchRelative = ".beep/declaration-only-baseline";

type Manifest = { readonly name?: string; readonly scripts?: Readonly<Record<string, string>> };
type Package = { readonly name: string; readonly dir: string; readonly hasBabel: boolean };

const tracked = spawnSync("git", ["ls-files", "--", "apps", "packages", "infra", "tools"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
});
const packages: ReadonlyArray<Package> = tracked.stdout
  .split("\n")
  .filter((file) => file.endsWith("/package.json") && !file.includes("/fixtures/") && !file.includes("node_modules/"))
  .sort()
  .flatMap((file): ReadonlyArray<Package> => {
    const manifest: Manifest = JSON.parse(readFileSync(join(root, file), "utf8"));
    const build = manifest.scripts?.["beep:build"];
    if (manifest.name === undefined || build === undefined || !build.startsWith(emitBuildPrefix)) return [];
    if (filter !== undefined && !manifest.name.includes(filter)) return [];
    return [{ name: manifest.name, dir: join(root, dirname(file)), hasBabel: manifest.scripts?.babel !== undefined }];
  });

type Sizes = {
  js: number;
  jsMap: number;
  dts: number;
  dtsMap: number;
  buildInfo: number;
  other: number;
  jsFiles: number;
  dtsFiles: number;
};

const sizeOf = (directory: string): Sizes => {
  const sizes: Sizes = { js: 0, jsMap: 0, dts: 0, dtsMap: 0, buildInfo: 0, other: 0, jsFiles: 0, dtsFiles: 0 };
  if (!existsSync(directory)) return sizes;
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      const bytes = statSync(path).size;
      if (entry.name.endsWith(".d.ts.map")) sizes.dtsMap += bytes;
      else if (entry.name.endsWith(".d.ts")) {
        sizes.dts += bytes;
        sizes.dtsFiles += 1;
      } else if (entry.name.endsWith(".js.map")) sizes.jsMap += bytes;
      else if (entry.name.endsWith(".js")) {
        sizes.js += bytes;
        sizes.jsFiles += 1;
      } else if (entry.name.endsWith(".tsbuildinfo")) sizes.buildInfo += bytes;
      else sizes.other += bytes;
    }
  };
  walk(directory);
  return sizes;
};

const timed = (command: string, args: ReadonlyArray<string>, cwd: string): { ms: number; exit: number } => {
  const started = performance.now();
  const result = spawnSync(command, [...args], { cwd, stdio: ["ignore", "ignore", "ignore"] });
  return { ms: Math.round(performance.now() - started), exit: result.status ?? -1 };
};

const columns = [
  "package",
  "run",
  "emit_ms",
  "emit_exit",
  "babel_ms",
  "babel_exit",
  "declaration_only_ms",
  "declaration_only_exit",
  "js_bytes",
  "js_map_bytes",
  "js_bytes_after_babel",
  "js_map_bytes_after_babel",
  "dts_bytes",
  "dts_map_bytes",
  "buildinfo_bytes",
  "other_bytes",
  "js_files",
  "dts_files",
  "declaration_only_dts_bytes",
  "declaration_only_dts_map_bytes",
  "declaration_only_buildinfo_bytes",
] as const;
const rows: Array<string> = [columns.join("\t")];
type Fastest = { emit: number; babel: number; declarationOnly: number };
type LastSizes = { readonly before: Sizes; readonly after: Sizes; readonly declarationOnly: Sizes };
const fastest: Array<Fastest> = [];
const lastSizes: Array<LastSizes> = [];

for (const pkg of packages) {
  const best: Fastest = {
    emit: Number.POSITIVE_INFINITY,
    babel: Number.POSITIVE_INFINITY,
    declarationOnly: Number.POSITIVE_INFINITY,
  };
  let sizes: LastSizes | undefined;
  for (let run = 1; run <= runs; run += 1) {
    const dist = join(pkg.dir, "dist");
    rmSync(dist, { recursive: true, force: true });
    const emit = timed(tsrs, ["-p", "tsconfig.json"], pkg.dir);
    const before = sizeOf(dist);
    const babel = pkg.hasBabel ? timed("bun", ["run", "babel"], pkg.dir) : undefined;
    const after = sizeOf(dist);

    const scratch = join(pkg.dir, scratchRelative);
    rmSync(scratch, { recursive: true, force: true });
    mkdirSync(scratch, { recursive: true });
    const declarationOnly = timed(
      tsrs,
      [
        "-p",
        "tsconfig.json",
        "--emitDeclarationOnly",
        "--sourceMap",
        "false",
        "--outDir",
        join(scratch, "dist"),
        "--tsBuildInfoFile",
        join(scratch, "dist/tsconfig.tsbuildinfo"),
      ],
      pkg.dir
    );
    const declarationOnlySizes = sizeOf(join(scratch, "dist"));
    rmSync(scratch, { recursive: true, force: true });

    rows.push(
      [
        pkg.name,
        run,
        emit.ms,
        emit.exit,
        babel?.ms ?? "",
        babel?.exit ?? "",
        declarationOnly.ms,
        declarationOnly.exit,
        before.js,
        before.jsMap,
        after.js,
        after.jsMap,
        after.dts,
        after.dtsMap,
        after.buildInfo,
        after.other,
        after.jsFiles,
        after.dtsFiles,
        declarationOnlySizes.dts,
        declarationOnlySizes.dtsMap,
        declarationOnlySizes.buildInfo,
      ].join("\t")
    );
    best.emit = Math.min(best.emit, emit.ms);
    best.babel = Math.min(best.babel, babel?.ms ?? 0);
    best.declarationOnly = Math.min(best.declarationOnly, declarationOnly.ms);
    sizes = { before, after, declarationOnly: declarationOnlySizes };
  }
  if (sizes !== undefined) {
    fastest.push(best);
    lastSizes.push(sizes);
  }
}

mkdirSync(dirname(join(root, outPath)), { recursive: true });
writeFileSync(join(root, outPath), `${rows.join("\n")}\n`);

const sum = (pick: (value: Fastest) => number): number => fastest.reduce((total, value) => total + pick(value), 0);
const sumSizes = (pick: (value: LastSizes) => number): number =>
  lastSizes.reduce((total, value) => total + pick(value), 0);

console.log(`packages=${packages.length} runs=${runs} rows=${outPath}`);
console.log(
  `fastest-run sums (ms): emit=${sum((v) => v.emit)} babel=${sum((v) => v.babel)} declaration_only=${sum((v) => v.declarationOnly)}`
);
console.log(
  `dist bytes: js+maps=${sumSizes((v) => v.after.js + v.after.jsMap)} declarations+maps=${sumSizes((v) => v.after.dts + v.after.dtsMap)} buildinfo=${sumSizes((v) => v.after.buildInfo)} other=${sumSizes((v) => v.after.other)}`
);
console.log(
  `declaration-only projection bytes: declarations+maps=${sumSizes((v) => v.declarationOnly.dts + v.declarationOnly.dtsMap)} buildinfo=${sumSizes((v) => v.declarationOnly.buildInfo)}`
);
