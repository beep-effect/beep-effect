/**
 * D6 bulk spike: interpreter vs selective JIT vs global JIT vs AOT for an
 * `S.Array` of N database rows.
 *
 * The row mirrors the effect-drizzle `User` fixture
 * (packages/ecosystem/effect-drizzle/test/fixtures.ts:176-197 + audit columns :59-64),
 * which `repository.ts:396-415` decodes single-row through `SqlSchema.findOne`
 * with `Result: model`. Here the same fields are decoded in bulk as:
 *
 *   model-class   `Model.Class` (effect/schema/Model, the SqlModel row class)
 *   schema-class  `S.Class` over the select-variant fields (SchemaAST.Declaration)
 *   struct        `S.Struct` over the same select-variant fields
 *   struct-wire   `S.Struct` of the encoded row shape (no transformations)
 *
 * Modes (each in a fresh process; the compiler registry is process-global):
 *
 *   interp        no compiler
 *   jit-selective SchemaJITCompiler.enable(schema.ast) before first use
 *   jit-global    import "effect/schema/SchemaJITCompiler/enable" before first use
 *   jit-late      decodeUnknownSync captured BEFORE the global enable (what a
 *                 class static built at definition time sees), then enabled
 *   jit-blocked   global enable under a simulated CSP (Function throws)
 *   aot           SchemaAOTCompiler.compile -> temp module -> install, then
 *                 Function blocked (proves the path needs no eval)
 *
 * Run:   bun run explorations/effect-schema-parity/research/tools/spike-bulk.ts [--rows=1000] [--passes=7]
 */
import { readFileSync } from "node:fs";
import * as S from "effect/Schema";
import * as SchemaParser from "effect/SchemaParser";
import { BuildSmokeRows, CASES, MODES, makeSchemas } from "./spike-bulk-schemas.ts";
import {
  aotInstall,
  bench,
  census,
  childArgs,
  emit,
  fingerprint,
  fmt,
  functionCalls,
  instrumentFunction,
  machineState,
  printMachineState,
  rewriteEffectSpecifiers,
  runChild,
  summarizeCensus,
} from "./spike-harness.ts";
import type { CaseName } from "./spike-bulk-schemas.ts";

// ---------------------------------------------------------------------------
// Fixture: deterministic encoded rows (the driver-side shape `returning *` yields)

const makeRows = (n: number): ReadonlyArray<Record<string, unknown>> => {
  let seed = 42;
  const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 2 ** 32;
  const names = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Barbara Liskov", "Edsger Dijkstra"];
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < n; i++) {
    const name = `${names[i % names.length]} ${i}`;
    const created = new Date(Date.UTC(2026, 0, 1) + Math.floor(rand() * 2.6e10)).toISOString();
    rows.push({
      id: i + 1,
      orgId: 1 + (i % 17),
      email: `user${i}@example.com`,
      name,
      bio: rand() < 0.4 ? null : `Bio for ${name}: ${"lorem ipsum ".repeat(1 + (i % 5))}`,
      nickname: rand() < 0.5 ? null : `nick${i}`,
      settings: { theme: rand() < 0.5 ? "dark" : "light" },
      active: rand() < 0.8,
      status: rand() < 0.9 ? "active" : "archived",
      searchName: name.toLowerCase(),
      createdAt: created,
      updatedAt: created,
      rowVersion: 1 + (i % 9),
    });
  }
  return rows;
};

// ---------------------------------------------------------------------------
// Child

const child = async (args: Record<string, string>): Promise<void> => {
  const mode = args.mode as (typeof MODES)[number];
  const name = args.case as CaseName;
  const rows = makeRows(Number(args.rows));
  const opts = { warmup: Number(args.warmup), rounds: Number(args.rounds), perRound: Number(args.perRound) };
  let aot: unknown;
  let decode: (input: unknown) => unknown;
  // api=schema: Schema.decodeUnknownSync (Schema.ts:1811-1815, always via decodeUnknownEffect +
  // runSchemaErrorSync; this is what @beep/schema codec statics bind through Reflect.get(S, key)).
  // api=parser: SchemaParser.decodeUnknownSync (SchemaParser.ts:551-558, direct `decode` fast path
  // when adapters are active at capture time).
  const mk = (schema: any): ((input: unknown) => unknown) =>
    args.api === "parser" ? SchemaParser.decodeUnknownSync(schema) : S.decodeUnknownSync(schema);

  if (mode === "build-smoke") return buildSmoke(rows);

  if (mode === "jit-global" || mode === "jit-blocked") {
    instrumentFunction(mode === "jit-blocked");
    await import("effect/schema/SchemaJITCompiler/enable");
    decode = mk(makeSchemas()[name]);
  } else if (mode === "jit-late") {
    instrumentFunction(false);
    decode = mk(makeSchemas()[name]); // captured before activation
    await import("effect/schema/SchemaJITCompiler/enable");
  } else if (mode === "jit-selective") {
    instrumentFunction(false);
    const { enable } = await import("effect/schema/SchemaJITCompiler");
    const schema = makeSchemas()[name];
    enable(schema.ast);
    decode = mk(schema);
  } else if (mode === "aot") {
    const schema = makeSchemas()[name];
    aot = await aotInstall([{ ast: schema.ast, operations: ["decode"] }]);
    instrumentFunction(true); // simulated CSP from here on
    decode = mk(schema);
  } else {
    instrumentFunction(false);
    decode = mk(makeSchemas()[name]);
  }

  const result = bench(() => decode(rows), opts);
  const staticCensus =
    mode === "interp" && args.api === "schema" ? summarizeCensus(await census([makeSchemas()[name].ast])) : undefined;
  emit({
    mode,
    api: args.api,
    case: name,
    ...result,
    functionCalls: functionCalls.attempted,
    fingerprint: fingerprint(decode(rows)),
    aot,
    census: staticCensus,
  });
};

/** AOT Build workflow smoke: loads this module's direct Schema exports and writes a self-installing module. */
const buildSmoke = async (rows: ReadonlyArray<unknown>): Promise<void> => {
  const { build } = await import("effect/schema/SchemaAOTCompiler/Build");
  const { layer } = await import("@effect/platform-bun/BunServices");
  const Effect = await import("effect/Effect");
  const { tmpdir } = await import("node:os");
  const { mkdtempSync, readFileSync, writeFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const dir = mkdtempSync(join(tmpdir(), "beep-schema-aot-build-"));
  const outFile = join(dir, "schema-aot.js");
  const self = await import("./spike-bulk-schemas.ts");
  const res = await Effect.runPromise(
    build({
      modules: { "./spike-bulk-schemas.ts": () => import("./spike-bulk-schemas.ts") },
      baseUrl: import.meta.url,
      outFile,
    }).pipe(Effect.provide(layer))
  );
  const raw = readFileSync(outFile, "utf8");
  const relImport = /^import \* as m0 from "([^"]+)";/m.exec(raw)?.[1];
  writeFileSync(outFile, rewriteEffectSpecifiers(raw));
  await import(pathToFileURL(outFile).href); // self-installs
  const Registry = await import(
    pathToFileURL(join(import.meta.dir, "../../../../node_modules/effect/dist/internal/schema/compilerRegistry.js"))
      .href
  );
  const entry = Registry.resolve(self.BuildSmokeRows.ast);
  instrumentFunction(true);
  const decoded = S.decodeUnknownSync(self.BuildSmokeRows)(rows);
  rmSync(dir, { recursive: true, force: true });
  emit({
    mode: "build-smoke",
    result: res,
    relativeImportFromTmp: relImport,
    bareEffectSpecifiersRewritten: (raw.match(/from "effect\//g) ?? []).length,
    rootEntryCompiled: entry.compiled !== undefined,
    decodedRows: (decoded as ReadonlyArray<unknown>).length,
    functionCalls: functionCalls.attempted,
    sameModuleInstance: self.BuildSmokeRows === BuildSmokeRows,
  });
};

// ---------------------------------------------------------------------------
// Parent

const APIS = ["schema", "parser"] as const;

const parent = (argv: Record<string, string>): void => {
  const cfg = {
    rows: argv.rows ?? "1000",
    warmup: argv.warmup ?? "40",
    rounds: argv.rounds ?? "3",
    perRound: argv.perRound ?? "60",
  };
  const passes = Number(argv.passes ?? "7");
  const before = machineState();
  printMachineState("spike-bulk (start)", before);
  console.log(`# config: ${JSON.stringify({ ...cfg, passes })}\n`);

  type R = Record<string, any>;
  const results = new Map<string, Array<R>>();
  const loads: Array<string> = [];
  for (let pass = 0; pass < passes; pass++) {
    const modes = [...MODES.slice(pass % MODES.length), ...MODES.slice(0, pass % MODES.length)];
    loads.push(readFileSync("/proc/loadavg", "utf8").trim());
    for (const name of CASES) {
      for (const mode of modes)
        for (const api of APIS) {
          const r = runChild(import.meta.path, { ...cfg, mode, case: name, api });
          const key = `${name}|${mode}|${api}`;
          results.set(key, [...(results.get(key) ?? []), { ...r, pass }]);
          process.stderr.write(".");
        }
    }
  }
  process.stderr.write("\n");

  const median = (xs: ReadonlyArray<number>) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const passRatio = (rs: ReadonlyArray<R>, base: ReadonlyArray<R>): string => {
    const ratios = rs.map((r) => median(r.roundOps) / median(base.find((b) => b.pass === r.pass)!.roundOps));
    const sorted = [...ratios].sort((a, b) => a - b);
    return `${median(ratios).toFixed(2)}x (${sorted[0]!.toFixed(2)}–${sorted[sorted.length - 1]!.toFixed(2)})`;
  };
  console.log(`# loadavg at the start of each pass: ${loads.join(" | ")}`);
  for (const name of CASES) {
    const interpOps = median(results.get(`${name}|interp|schema`)!.flatMap((r) => r.roundOps));
    const interpFp = results.get(`${name}|interp|schema`)![0]!.fingerprint;
    console.log(
      `\n## ${name}  (S.Array of ${cfg.rows} rows; one op = one array decode; baseline = interp + Schema API)\n`
    );
    console.log(
      "| mode | api | arrays/s | rows/s | p50 µs | p95 µs | cold first call ms | vs interp (pooled) | per-pass ratio median (min–max) | Function calls | output = interp |"
    );
    console.log("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|:---:|");
    for (const mode of MODES)
      for (const api of APIS) {
        const rs = results.get(`${name}|${mode}|${api}`)!;
        const ops = median(rs.flatMap((r) => r.roundOps));
        console.log(
          `| ${mode} | ${api} | ${fmt(ops)} | ${fmt(ops * Number(cfg.rows))} | ${fmt(median(rs.map((r) => r.p50us)))} | ${fmt(
            median(rs.map((r) => r.p95us))
          )} | ${fmt(median(rs.map((r) => r.coldMs)), 2)} | ${(ops / interpOps).toFixed(2)}x | ${passRatio(rs, results.get(`${name}|interp|schema`)!)} | ${rs[0]!.functionCalls} | ${
            rs.every((r) => r.fingerprint === interpFp) ? "yes" : "NO"
          } |`
        );
      }
    const aot = results.get(`${name}|aot|schema`)![0]!.aot;
    console.log(`\nAOT module: ${JSON.stringify(aot)}`);
    console.log(`\nStatic census (codegen.generate / shouldCompileParser per reachable AST node):\n`);
    console.log(results.get(`${name}|interp|schema`)![0]!.census);
  }

  console.log("\n## AOT Build workflow smoke\n");
  console.log(
    JSON.stringify(runChild(import.meta.path, { ...cfg, mode: "build-smoke", case: "struct", api: "schema" }), null, 2)
  );
  console.log("");
  printMachineState("spike-bulk (end)", machineState());
};

if (import.meta.main) {
  const args = childArgs();
  if (args !== undefined) await child(args);
  else {
    const argv: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
      const m = /^--([^=]+)=(.*)$/.exec(a);
      if (m) argv[m[1]!] = m[2]!;
    }
    parent(argv);
  }
}
