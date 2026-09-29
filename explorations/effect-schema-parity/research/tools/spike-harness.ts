/**
 * Shared harness for the effect-schema-parity compiler spikes (Lane C, D6).
 *
 * - `machineState()` captures the state the numbers depend on (load, governor,
 *   nightly units, bun and effect versions) so a quiet-machine re-run is comparable.
 * - `bench()` times one synchronous operation with warm-up, GC between rounds and
 *   per-call percentiles.
 * - `census()` classifies every AST node reachable from a root with the same
 *   internal source generator the JIT and AOT compilers use (read-only).
 * - `runChildren()` runs each (mode, case) in a fresh `bun` process, because the
 *   compiler registry is one process-global WeakMap and a global `install` cannot be undone.
 *
 * Nothing here writes into `.repos/effect`. AOT modules are written to the OS temp
 * directory (`research/tools/.tmp/` is not git-ignored in this checkout).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const toolsDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(toolsDir, "../../../..");

const sh = (cmd: string, args: ReadonlyArray<string>): string => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
};

const readText = (path: string): string => {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "unavailable";
  }
};

export interface MachineState {
  readonly bun: string;
  readonly cpu: string;
  readonly effectPin: string;
  readonly effectVersion: string;
  readonly governor: string;
  readonly loadavg: string;
  readonly nightlyUnits: string;
  readonly nproc: number;
  readonly timestamp: string;
}

export const machineState = (): MachineState => {
  const effectPkg = JSON.parse(readFileSync(join(repoRoot, "node_modules/effect/package.json"), "utf8"));
  const rootPkg = readFileSync(join(repoRoot, "package.json"), "utf8");
  const pin = /pkg\.pr\.new\/Effect-TS\/effect\/effect@([0-9a-f]{40})/.exec(rootPkg)?.[1] ?? "unknown";
  return {
    timestamp: new Date().toISOString(),
    loadavg: readText("/proc/loadavg"),
    governor: readText("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"),
    cpu: cpus()[0]?.model ?? "unknown",
    nproc: cpus().length,
    nightlyUnits: sh("systemctl", [
      "--user",
      "is-active",
      "beep-graft-deep-refresh.service",
      "beep-refs-refresh.service",
    ]).replace(/\n/g, " "),
    bun: Bun.version,
    effectVersion: effectPkg.version,
    effectPin: pin,
  };
};

export const printMachineState = (label: string, state: MachineState): void => {
  console.log(`# ${label} — machine state`);
  for (const [key, value] of Object.entries(state)) console.log(`#   ${key.padEnd(14)} ${value}`);
  if (state.nightlyUnits !== "inactive inactive") {
    console.log("#   WARNING: nightly units are not both inactive; numbers are not admissible (D6).");
  }
};

// ---------------------------------------------------------------------------
// Timing

export interface BenchResult {
  readonly coldMs: number;
  readonly opsPerSec: number;
  readonly p50us: number;
  readonly p95us: number;
  readonly roundOps: ReadonlyArray<number>;
  readonly samples: number;
}

const percentile = (sorted: ReadonlyArray<number>, p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!;

export const bench = (
  run: () => unknown,
  options: { readonly warmup: number; readonly rounds: number; readonly perRound: number }
): BenchResult => {
  const t0 = Bun.nanoseconds();
  run();
  const coldMs = (Bun.nanoseconds() - t0) / 1e6;
  for (let i = 0; i < options.warmup; i++) run();
  const all: Array<number> = [];
  const roundOps: Array<number> = [];
  for (let r = 0; r < options.rounds; r++) {
    Bun.gc(true);
    const start = Bun.nanoseconds();
    for (let i = 0; i < options.perRound; i++) {
      const s = Bun.nanoseconds();
      run();
      all.push((Bun.nanoseconds() - s) / 1e3);
    }
    roundOps.push(options.perRound / ((Bun.nanoseconds() - start) / 1e9));
  }
  const sorted = [...all].sort((a, b) => a - b);
  const medianOps = [...roundOps].sort((a, b) => a - b)[Math.floor(roundOps.length / 2)]!;
  return {
    coldMs,
    samples: all.length,
    p50us: percentile(sorted, 0.5),
    p95us: percentile(sorted, 0.95),
    opsPerSec: medianOps,
    roundOps,
  };
};

// ---------------------------------------------------------------------------
// Function-constructor instrumentation (JIT observation and CSP simulation)

export const functionCalls = { attempted: 0 };

/**
 * Wraps `globalThis.Function` to count code-generation calls. With `block`,
 * every construction (including the JIT's `"return true"` support probe) throws
 * an EvalError, which is how a `script-src` without `'unsafe-eval'` behaves.
 */
export const instrumentFunction = (block: boolean): void => {
  const Original = globalThis.Function;
  const Wrapped = function (this: unknown, ...args: Array<string>) {
    functionCalls.attempted++;
    if (block) throw new EvalError("Code generation from strings disallowed (simulated CSP)");
    return Original(...args);
  } as unknown as FunctionConstructor;
  Wrapped.prototype = Original.prototype;
  globalThis.Function = Wrapped;
};

// ---------------------------------------------------------------------------
// AOT: compile -> write module to the OS temp dir -> import -> install

const effectDist = dirname(fileURLToPath(import.meta.resolve("effect/Schema")));

/** Bare `effect/...` specifiers do not resolve from the temp dir; point them at this checkout's install. */
export const rewriteEffectSpecifiers = (source: string): string =>
  source.replace(
    /from "effect\/([^"]+)"/g,
    (_m, sub: string) => `from ${JSON.stringify(pathToFileURL(join(effectDist, `${sub}.js`)).href)}`
  );

export interface AotStats {
  readonly bytes: number;
  readonly compileMs: number;
  readonly decodeEffect: number;
  readonly factories: number;
  readonly fastDecode: number;
  readonly fastIs: number;
  readonly importInstallMs: number;
  readonly installedNodes: number;
}

export const aotInstall = async (
  targets: ReadonlyArray<{ readonly ast: unknown; readonly operations: ReadonlyArray<"decode" | "is" | "make"> }>
): Promise<AotStats> => {
  const { compile } = await import("effect/schema/SchemaAOTCompiler");
  const c0 = Bun.nanoseconds();
  const source = compile(targets as never);
  const compileMs = (Bun.nanoseconds() - c0) / 1e6;
  const dir = mkdtempSync(join(tmpdir(), "beep-schema-aot-"));
  const file = join(dir, "schema-aot.mjs");
  writeFileSync(file, rewriteEffectSpecifiers(source));
  const i0 = Bun.nanoseconds();
  const mod = await import(pathToFileURL(file).href);
  mod.install(targets.map((t) => t.ast));
  const importInstallMs = (Bun.nanoseconds() - i0) / 1e6;
  rmSync(dir, { recursive: true, force: true });
  return {
    bytes: source.length,
    installedNodes: (source.match(/runtime\.setCompiler\(/g) ?? []).length,
    factories: (source.match(/^function d\d+\(/gm) ?? []).length,
    fastDecode: (source.match(/case "decode":\{/g) ?? []).length,
    fastIs: (source.match(/case "is":\{/g) ?? []).length,
    decodeEffect: (source.match(/case "decodeEffect":\{/g) ?? []).length,
    compileMs,
    importInstallMs,
  };
};

// ---------------------------------------------------------------------------
// Static fallback census through the internal generator (same source JIT and AOT use)

type AnyAst = { readonly _tag: string; readonly [k: string]: any };

export type NodeClass =
  | "fast-validator" // generated `decode`/`is`: the whole subtree is checked by generated code
  | "generated-loop" // generated Struct/Array traversal; children resolved through the registry
  | "inline-transform" // generated single-transformation orchestration
  | "interpreted-orchestration" // compiler entry, but runtime.decode -> Interpreter with registry children
  | "interpreter"; // shouldCompileParser = false: plain interpreted entry (leaves, Declarations without encoding, Suspend)

export interface CensusRow {
  readonly beyondSuspend: boolean;
  readonly cls: NodeClass;
  readonly identifier: string | undefined;
  readonly tag: string;
}

export const loadCodegen = async (): Promise<{
  generate: (ast: unknown, op: string) => string | undefined;
  shouldCompileParser: (ast: unknown) => boolean;
}> => import(pathToFileURL(join(effectDist, "internal/schema/codegen.js")).href);

const identifierOf = (ast: AnyAst): string | undefined => {
  const a = ast.annotations as Record<string, unknown> | undefined;
  const id = a?.identifier ?? a?.title;
  return typeof id === "string" ? id : undefined;
};

export const census = async (roots: ReadonlyArray<unknown>): Promise<ReadonlyArray<CensusRow>> => {
  const codegen = await loadCodegen();
  const seen = new Map<AnyAst, boolean>();
  const rows: Array<CensusRow> = [];
  const queue: Array<[AnyAst, boolean]> = roots.map((r) => [r as AnyAst, false]);
  while (queue.length > 0) {
    const [ast, beyond] = queue.shift()!;
    const prior = seen.get(ast);
    if (prior !== undefined && (prior === false || beyond)) continue;
    seen.set(ast, beyond);
    const push = (child: AnyAst, b = beyond) => queue.push([child, b]);
    switch (ast._tag) {
      case "Declaration":
        ast.typeParameters.forEach((c: AnyAst) => push(c));
        break;
      case "TemplateLiteral":
        ast.parts.forEach((c: AnyAst) => push(c));
        break;
      case "Arrays":
        ast.elements.forEach((c: AnyAst) => push(c));
        ast.rest.forEach((c: AnyAst) => push(c));
        break;
      case "Objects":
        ast.propertySignatures.forEach((p: AnyAst) => push(p.type));
        ast.indexSignatures.forEach((s: AnyAst) => push(s.type));
        break;
      case "Union":
        ast.types.forEach((c: AnyAst) => push(c));
        break;
      case "Suspend":
        push(ast.thunk(), true);
        break;
    }
    ast.encoding?.forEach((link: AnyAst) => push(link.to));
    if (prior !== undefined) continue; // already classified; only re-walked to clear beyondSuspend
    let cls: NodeClass;
    if (!codegen.shouldCompileParser(ast)) cls = "interpreter";
    else if (codegen.generate(ast, "decode") !== undefined) cls = "fast-validator";
    else {
      const de = codegen.generate(ast, "decodeEffect") ?? "";
      if (de.startsWith("const transform=")) cls = "inline-transform";
      else {
        const hasObject = de.includes("function({ast,getProperties,fallback,resume,step})");
        const hasArray = de.includes("function({getElement,step,resume})");
        cls = hasObject || hasArray ? "generated-loop" : "interpreted-orchestration";
      }
    }
    rows.push({ tag: ast._tag, cls, beyondSuspend: beyond, identifier: identifierOf(ast) });
  }
  // Re-read final beyondSuspend (a node first seen past a Suspend may later be reached directly).
  return rows.map((row, i) => ({ ...row, beyondSuspend: [...seen.values()][i] ?? row.beyondSuspend }));
};

export const summarizeCensus = (rows: ReadonlyArray<CensusRow>): string => {
  const classes: ReadonlyArray<NodeClass> = [
    "fast-validator",
    "generated-loop",
    "inline-transform",
    "interpreted-orchestration",
    "interpreter",
  ];
  const tags = [...new Set(rows.map((r) => r.tag))].sort();
  const lines = [`| tag | ${classes.join(" | ")} | total |`, `|---|${classes.map(() => "---:").join("|")}|---:|`];
  for (const tag of tags) {
    const of = rows.filter((r) => r.tag === tag);
    lines.push(`| ${tag} | ${classes.map((c) => of.filter((r) => r.cls === c).length).join(" | ")} | ${of.length} |`);
  }
  lines.push(
    `| **all** | ${classes.map((c) => rows.filter((r) => r.cls === c).length).join(" | ")} | ${rows.length} |`
  );
  const beyond = rows.filter((r) => r.beyondSuspend).length;
  lines.push(`\nnodes reachable only through a Suspend (AOT leaves these to the interpreter): ${beyond}`);
  const decls = rows.filter((r) => r.tag === "Declaration" || r.tag === "Suspend");
  const named = [...new Set(decls.map((r) => `${r.tag}:${r.identifier ?? "<anonymous>"}(${r.cls})`))];
  lines.push(
    `Declaration/Suspend nodes (${decls.length}): ${named.slice(0, 60).join(", ")}${named.length > 60 ? ", …" : ""}`
  );
  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Child-process orchestration

export const runChild = (script: string, args: Record<string, string>): Record<string, unknown> => {
  const argv = Object.entries(args).map(([k, v]) => `--${k}=${v}`);
  const r = spawnSync(process.execPath, ["run", script, "--child", ...argv], {
    encoding: "utf8",
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("RESULT "));
  if (r.status !== 0 || line === undefined) {
    throw new Error(`child failed (${JSON.stringify(args)}):\n${r.stdout}\n${r.stderr}`);
  }
  return JSON.parse(line.slice("RESULT ".length));
};

export const childArgs = (): Record<string, string> | undefined => {
  if (!process.argv.includes("--child")) return undefined;
  const out: Record<string, string> = {};
  for (const a of process.argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
};

export const emit = (result: unknown): void => {
  console.log(`RESULT ${JSON.stringify(result)}`);
};

/** Cheap structural fingerprint so the parent can assert every mode decodes identically. */
export const fingerprint = (value: unknown): string => {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return `${text.length}:${(h >>> 0).toString(16)}`;
};

export const fmt = (n: number, digits = 1): string =>
  n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(digits);
