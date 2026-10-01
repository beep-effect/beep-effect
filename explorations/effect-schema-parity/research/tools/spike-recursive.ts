/**
 * D6 recursive spike: interpreter vs selective JIT vs global JIT vs AOT on the
 * Pandoc strict decode (`decodePandocJsonStrict`,
 * packages/foundation/modeling/pandoc-ast/src/Pandoc.codec.ts:1282).
 *
 * Cases (one op = one full document):
 *
 *   strict  Effect.runSync(decodePandocJsonStrict(json)) — the real entry point:
 *           PandocJsonWire (S.Class, blocks as S.Array(S.Json)) + 27 module-private
 *           payload wire decoders captured at module load (Pandoc.codec.ts:564-583)
 *           + PandocDocument.make over the recursive model
 *   wire    S.decodeUnknownSync(PandocJsonWire)(json) — the wire class alone
 *   model   S.decodeUnknownSync(PandocDocument)(encoded) — the recursive class model
 *           (10 S.suspend, 26-member inline union, 15-member block union, ~43 classes)
 *
 * Modes (fresh process each; the registry is process-global):
 *
 *   interp         no compiler
 *   jit-global     enable imported BEFORE @beep/pandoc-ast is loaded
 *   jit-late       @beep/pandoc-ast loaded first (its module-level decoders captured,
 *                  not yet invoked), then the global enable
 *   jit-selective  SchemaJITCompiler.enable(ast) for every direct Schema export of the
 *                  package (module-private schemas cannot be reached)
 *   jit-blocked    global enable under a simulated CSP (Function throws)
 *   aot            SchemaAOTCompiler.compile(every direct Schema export, ["decode"])
 *                  -> temp module -> install, then Function blocked
 *
 * Fixture: deterministic Markdown rendered by the local `pandoc` binary to JSON
 * (headers, nested bullet/ordered lists, block quotes, code, tables, notes, links,
 * emphasis, math, spans and divs). Nothing is written to disk except the AOT module
 * in the OS temp dir.
 *
 * Run:   bun run explorations/effect-schema-parity/research/tools/spike-recursive.ts [--sections=40] [--passes=5]
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
  runChild,
  summarizeCensus,
} from "./spike-harness.ts";

const CASES = ["strict", "wire", "model"] as const;
const MODES = ["interp", "jit-selective", "jit-global", "jit-late", "jit-blocked", "aot"] as const;

// ---------------------------------------------------------------------------
// Fixture

const makeMarkdown = (sections: number): string => {
  let seed = 7;
  const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 2 ** 32;
  const pick = <A>(xs: ReadonlyArray<A>): A => xs[Math.floor(rand() * xs.length)]!;
  const words = ["claim", "patent", "effect", "schema", "decode", "office", "action", "prior", "art", "figure"];
  const inline = (n: number): string =>
    Array.from({ length: n }, (_, i) => {
      const w = pick(words);
      switch (i % 11) {
        case 1:
          return `*${w}*`;
        case 3:
          return `**${w} ${pick(words)}**`;
        case 5:
          return `\`${w}()\``;
        case 7:
          return `[${w}](https://example.com/${w}/${i} "t")`;
        case 8:
          return `$x_${i}^2$`;
        case 9:
          return `"${w}"`;
        case 10:
          return `[${w}]{.mark}`;
        default:
          return w;
      }
    }).join(" ");
  const list = (depth: number, ordered: boolean): string => {
    const lines: Array<string> = [];
    const indent = "    ".repeat(3 - depth);
    for (let i = 0; i < 3; i++) {
      lines.push(`${indent}${ordered ? `${i + 1}.` : "-"} ${inline(6)}`);
      if (depth > 1 && i === 1) lines.push(list(depth - 1, !ordered));
    }
    return lines.join("\n");
  };
  const out: Array<string> = [];
  for (let s = 0; s < sections; s++) {
    out.push(`# Section ${s} ${inline(3)}`, "", inline(40) + `^[Note ${s}: ${inline(8)}]`, "");
    out.push(`## Detail ${s}`, "", inline(30), "", list(3, s % 2 === 0), "");
    out.push(`> ${inline(20)}\n>\n> - ${inline(5)}\n> - ${inline(5)}`, "");
    out.push("```ts\nconst x = decode(input)\n```", "");
    out.push("| a | b | c |\n|---|---|---|\n| " + inline(2) + " | " + inline(2) + " | 3 |\n| x | y | z |", "");
    out.push(`::: {.callout}\n${inline(15)}\n:::`, "", "---", "");
  }
  return out.join("\n");
};

const makeFixture = (sections: number): unknown => {
  const r = spawnSync("pandoc", ["-f", "markdown", "-t", "json"], { input: makeMarkdown(sections), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`pandoc failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
};

const countNodes = (value: unknown): { blocks: number; inlines: number; bytes: number } => {
  const blockTags = new Set([
    "Plain",
    "Para",
    "Header",
    "BulletList",
    "OrderedList",
    "BlockQuote",
    "CodeBlock",
    "Table",
    "Div",
    "HorizontalRule",
    "LineBlock",
    "RawBlock",
    "DefinitionList",
    "Figure",
  ]);
  let blocks = 0;
  let inlines = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === "object") {
      const t = (v as { t?: unknown }).t;
      if (typeof t === "string") blockTags.has(t) ? blocks++ : inlines++;
      Object.values(v).forEach(walk);
    }
  };
  walk(value);
  return { blocks, inlines, bytes: JSON.stringify(value).length };
};

// ---------------------------------------------------------------------------
// Child

const schemaExports = async (S: typeof import("effect/Schema")) => {
  const namespaces = await Promise.all([
    import("@beep/pandoc-ast"),
    import("@beep/pandoc-ast/Pandoc.codec"),
    import("@beep/pandoc-ast/Pandoc.model"),
  ]);
  const seen = new Set<unknown>();
  const out: Array<{ name: string; schema: any }> = [];
  for (const ns of namespaces) {
    for (const [name, value] of Object.entries(ns)) {
      if (S.isSchema(value) && !seen.has((value as any).ast)) {
        seen.add((value as any).ast);
        out.push({ name, schema: value });
      }
    }
  }
  return out;
};

const child = async (args: Record<string, string>): Promise<void> => {
  const mode = args.mode as (typeof MODES)[number];
  const name = args.case as (typeof CASES)[number];
  const opts = { warmup: Number(args.warmup), rounds: Number(args.rounds), perRound: Number(args.perRound) };
  const json = makeFixture(Number(args.sections));
  let aot: unknown;
  let roots = 0;

  if (mode === "jit-global" || mode === "jit-blocked") {
    instrumentFunction(mode === "jit-blocked");
    await import("effect/schema/SchemaJITCompiler/enable");
  }
  const S = await import("effect/Schema");
  const Effect = await import("effect/Effect");
  const Pandoc = await import("@beep/pandoc-ast");
  if (mode === "jit-late") {
    instrumentFunction(false);
    await import("effect/schema/SchemaJITCompiler/enable");
  } else if (mode === "jit-selective") {
    instrumentFunction(false);
    const { enable } = await import("effect/schema/SchemaJITCompiler");
    const exported = await schemaExports(S);
    roots = exported.length;
    for (const e of exported) enable(e.schema.ast);
  } else if (mode === "aot") {
    const exported = await schemaExports(S);
    roots = exported.length;
    aot = await aotInstall(exported.map((e) => ({ ast: e.schema.ast, operations: ["decode"] as const })));
    instrumentFunction(true);
  } else if (mode === "interp") {
    instrumentFunction(false);
  }

  let run: () => unknown;
  if (name === "strict") run = () => Effect.runSync(Pandoc.decodePandocJsonStrict(json));
  else if (name === "wire") {
    const decode = S.decodeUnknownSync(Pandoc.PandocJsonWire);
    run = () => decode(json);
  } else {
    // Encoded model input, produced by a throwaway interpreted encode in a separate
    // decoder instance (encoding uses the flipped AST, a different registry key).
    const doc = Effect.runSync(Pandoc.decodePandocJsonStrict(json));
    const encoded = S.encodeSync(Pandoc.PandocDocument)(doc);
    const decode = S.decodeUnknownSync(Pandoc.PandocDocument);
    run = () => decode(encoded);
  }

  const result = bench(run, opts);
  let staticCensus: string | undefined;
  if (mode === "interp") {
    const target = name === "wire" ? Pandoc.PandocJsonWire : Pandoc.PandocDocument;
    staticCensus = summarizeCensus(await census([target.ast]));
  }
  emit({
    mode,
    case: name,
    ...result,
    roots,
    functionCalls: functionCalls.attempted,
    fingerprint: fingerprint(run()),
    fixture: countNodes(json),
    aot,
    census: staticCensus,
  });
};

// ---------------------------------------------------------------------------
// Parent

const parent = (argv: Record<string, string>): void => {
  const cfg = {
    sections: argv.sections ?? "40",
    warmup: argv.warmup ?? "6",
    rounds: argv.rounds ?? "3",
    perRound: argv.perRound ?? "8",
  };
  const passes = Number(argv.passes ?? "5");
  printMachineState("spike-recursive (start)", machineState());
  console.log(`# config: ${JSON.stringify({ ...cfg, passes })}`);

  type R = Record<string, any>;
  const results = new Map<string, Array<R>>();
  const loads: Array<string> = [];
  for (let pass = 0; pass < passes; pass++) {
    const modes = [...MODES.slice(pass % MODES.length), ...MODES.slice(0, pass % MODES.length)];
    loads.push(readFileSync("/proc/loadavg", "utf8").trim());
    for (const name of CASES) {
      for (const mode of modes) {
        const r = runChild(import.meta.path, { ...cfg, mode, case: name });
        const key = `${name}|${mode}`;
        results.set(key, [...(results.get(key) ?? []), { ...r, pass }]);
        process.stderr.write(".");
      }
    }
  }
  process.stderr.write("\n");
  const fixture = results.get("strict|interp")![0]!.fixture;
  console.log(`# fixture: ${JSON.stringify(fixture)}\n`);

  const median = (xs: ReadonlyArray<number>) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const passRatio = (rs: ReadonlyArray<R>, base: ReadonlyArray<R>): string => {
    const ratios = rs.map((r) => median(r.roundOps) / median(base.find((b) => b.pass === r.pass)!.roundOps));
    const sorted = [...ratios].sort((a, b) => a - b);
    return `${median(ratios).toFixed(2)}x (${sorted[0]!.toFixed(2)}–${sorted[sorted.length - 1]!.toFixed(2)})`;
  };
  console.log(`# loadavg at the start of each pass: ${loads.join(" | ")}`);
  for (const name of CASES) {
    const interpOps = median(results.get(`${name}|interp`)!.flatMap((r) => r.roundOps));
    const interpFp = results.get(`${name}|interp`)![0]!.fingerprint;
    console.log(`\n## ${name}  (one op = one document)\n`);
    console.log(
      "| mode | docs/s | p50 ms | p95 ms | cold first call ms | vs interp (pooled) | per-pass ratio median (min–max) | roots | Function calls | output = interp |"
    );
    console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|:---:|");
    for (const mode of MODES) {
      const rs = results.get(`${name}|${mode}`)!;
      const ops = median(rs.flatMap((r) => r.roundOps));
      console.log(
        `| ${mode} | ${fmt(ops)} | ${(median(rs.map((r) => r.p50us)) / 1000).toFixed(2)} | ${(
          median(rs.map((r) => r.p95us)) / 1000
        ).toFixed(
          2
        )} | ${fmt(median(rs.map((r) => r.coldMs)), 2)} | ${(ops / interpOps).toFixed(2)}x | ${passRatio(rs, results.get(`${name}|interp`)!)} | ${
          rs[0]!.roots || "-"
        } | ${rs[0]!.functionCalls} | ${rs.every((r) => r.fingerprint === interpFp) ? "yes" : "NO"} |`
      );
    }
    const aot = results.get(`${name}|aot`)![0]!.aot;
    console.log(`\nAOT module: ${JSON.stringify(aot)}`);
    console.log(`\nStatic census:\n`);
    console.log(results.get(`${name}|interp`)![0]!.census);
  }
  console.log("");
  printMachineState("spike-recursive (end)", machineState());
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
