import { fcRuns } from "@beep/fc-runs";
import { NodeFileSystem } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { CliUsageError, GateFailed, LedgerIncomplete } from "../../effected/runner/Audit.errors.ts";
import { CATALOG_ORDER, catalogEntry, catalogMatchesRoster, isIgnoredUpstreamDep, rowId } from "../../effected/runner/Catalog.ts";
import { mapUpstreamToLab, parseCatalogSpecs } from "../../effected/runner/Copy.ts";
import {
  foreignSpecifierLines,
  readExportFacets,
  rewriteSpecifiers,
  scanUnsafeAssertions,
  tsExtension,
} from "../../effected/runner/Exports.ts";
import { CANARY_DIAGNOSTICS, compareVersions, gatePlan, missingCanaryDiagnostics } from "../../effected/runner/Gates.ts";
import { assembleKnowledge, moduleTsconfig, okfLinks, readmeSkeleton, scanVendorNotices } from "../../effected/runner/Knowledge.ts";
import {
  AUDIT_TARGETS,
  exportKindCovers,
  Ledger,
  LedgerJson,
  LedgerRow,
  MODULE_NAMES,
  ModuleName,
  nextStage,
} from "../../effected/runner/Ledger.schema.ts";
import { findRow, pendingRow } from "../../effected/runner/LedgerStore.ts";
import { isModuleTarget, labPaths, upstreamPaths } from "../../effected/runner/Paths.ts";
import { heavy, renderLaunch } from "../../effected/runner/Process.ts";
import { LAW_SURFACES, outOfScopeChanges, reviewBrief, roundDir, seatLaunches } from "../../effected/runner/Review.ts";
import { AppendField } from "../../effected/runner/LedgerStore.ts";
import { rewriteRootImports } from "../../effected/runner/Codemod.ts";
import { blockFindings } from "../../effected/runner/JsdocLaw.ts";
import { Project } from "ts-morph";

const emptyLedger = (rows: ReadonlyArray<LedgerRow>): Ledger =>
  Ledger.make({
    version: 1,
    effectedCommit: "af7566a9da2eff169cb74955efcc5ede1e5de9f8",
    startedAt: "2026-10-07T00:00:00.000Z",
    lastCheckpoint: null,
    rows: [...rows],
    notes: [],
  });

describe("catalog", () => {
  it("lists every module once in roster order", () => {
    assert.isTrue(catalogMatchesRoster());
    assert.deepStrictEqual(CATALOG_ORDER, MODULE_NAMES);
    assert.strictEqual(MODULE_NAMES.length, 29);
    assert.strictEqual(AUDIT_TARGETS.length, 30);
  });
  it("orders kit dependencies before their dependents", () => {
    for (const [index, module] of CATALOG_ORDER.entries()) {
      const entry = catalogEntry(module);
      assertSome(O.map(entry, (found) => found.module), module);
      const deps = O.match(entry, { onNone: () => [], onSome: (found) => found.kitDeps });
      for (const dep of deps) {
        assert.isTrue(CATALOG_ORDER.indexOf(dep) < index, `${dep} must precede ${module}`);
      }
    }
  });
  it("derives row ids in both call forms", () => {
    assert.strictEqual(rowId(1, "yaml"), "w1-yaml");
    assert.strictEqual(pipe(5, rowId("github-actions")), "w5-github-actions");
  });
  it("ignores build tooling and Effect peers but not oracles", () => {
    assert.isTrue(isIgnoredUpstreamDep("@effect/vitest"));
    assert.isTrue(isIgnoredUpstreamDep("@savvy-web/bundler"));
    assert.isFalse(isIgnoredUpstreamDep("minimatch"));
  });
});

describe("ledger schema", () => {
  it("climbs one stage at a time and stops at done", () => {
    assertSome(nextStage(0), 1);
    assertSome(nextStage(4), 5);
    assertNone(nextStage(5));
  });
  it("compares export facets as coverage", () => {
    assert.isTrue(exportKindCovers("both", "value"));
    assert.isTrue(exportKindCovers("both", "type"));
    assert.isTrue(exportKindCovers("value", "value"));
    assert.isFalse(exportKindCovers("value", "type"));
    assert.isFalse(pipe("type", exportKindCovers("both")));
  });
  it.effect.prop("round-trips any ledger row through the JSON codec", [LedgerRow], ([row]) =>
    Effect.gen(function* () {
      const ledger = emptyLedger([row]);
      const text = yield* S.encodeEffect(LedgerJson)(ledger);
      const decoded = yield* S.decodeEffect(LedgerJson)(text);
      assert.deepStrictEqual(yield* S.encodeEffect(LedgerJson)(decoded), text);
    }), { arbitrary: fcRuns(25) }
  );
  it("seeds a pending row for every module", () => {
    for (const module of MODULE_NAMES) {
      const row = pendingRow(module);
      assertSome(O.map(row, (found) => found.status), "pending");
      assertSome(O.map(row, (found) => found.stage), 0);
    }
  });
  it.effect("finds rows and fails typed for a missing one", () =>
    Effect.gen(function* () {
      const row = O.getOrThrow(pendingRow("glob"));
      const ledger = emptyLedger([row]);
      assert.strictEqual((yield* findRow(ledger, "glob")).id, "w1-glob");
      const missing = yield* Effect.flip(pipe(ledger, findRow("yaml")));
      assert.strictEqual(missing._tag, "LedgerRowMissing");
    })
  );
});

describe("paths", () => {
  it("maps modules and the runner to lab directories", () => {
    assert.strictEqual(labPaths("yaml").testDir, "scratchpad/test/yaml");
    assert.deepStrictEqual(labPaths("runner").extraSources, ["scratchpad/effected/audit.ts"]);
    assert.strictEqual(upstreamPaths("memfs").okfModule, "okf/modules/memfs.md");
    assert.isTrue(isModuleTarget("cli"));
    assert.isFalse(isModuleTarget("runner"));
  });
  it("plans gates by stage", () => {
    assert.deepStrictEqual(gatePlan("yaml", 0), { parity: true, strict: false, docgen: false, coverage: false });
    assert.deepStrictEqual(pipe("yaml", gatePlan(2)), { parity: true, strict: true, docgen: true, coverage: false });
    assert.deepStrictEqual(gatePlan("runner", 4), { parity: false, strict: true, docgen: true, coverage: false });
  });
  it("maps upstream source and test paths into the lab", () => {
    assertSome(mapUpstreamToLab("packages/glob/src/internal/brace.ts"), "scratchpad/effected/glob/internal/brace.ts");
    assertSome(mapUpstreamToLab("packages/cli/__test__/ui/App.test.tsx"), "scratchpad/test/cli/ui/App.test.tsx");
    assertNone(mapUpstreamToLab("okf/project.md"));
  });
});

describe("specifier rewrites", () => {
  const resolver = {
    resolveRelative: (specifier: string) => (specifier === "../src/index.js" ? O.some("../../effected/glob/index.js") : O.none()),
    resolveKit: (dep: string, subpath: string) =>
      dep === "memfs" ? O.some(subpath === "." ? "../memfs/index.ts" : "../memfs/NodeSyncFileSystem.ts") : O.none(),
  };
  it("normalizes .js and .jsx extensions only", () => {
    assert.strictEqual(tsExtension("./a.js"), "./a.ts");
    assert.strictEqual(tsExtension("./a.jsx"), "./a.tsx");
    assert.strictEqual(tsExtension("./a.json"), "./a.json");
  });
  it("rewrites kit, relative, dynamic and mocked specifiers; leaves packages alone", () => {
    const source = [
      'import { Glob } from "../src/index.js";',
      'import { MemFs } from "@effected/memfs";',
      'import { NodeSync } from "@effected/memfs/node-sync";',
      'import { Unknown } from "@effected/unknown";',
      'const lazy = await import("./lazy.js");',
      'vi.mock("./mocked.js");',
      'import { Effect } from "effect";',
      "export * from './side.js';",
    ].join("\n");
    const out = rewriteSpecifiers(source, resolver);
    assert.include(out, 'from "../../effected/glob/index.ts"');
    assert.include(out, 'from "../memfs/index.ts"');
    assert.include(out, 'from "../memfs/NodeSyncFileSystem.ts"');
    assert.include(out, 'from "@effected/unknown"');
    assert.include(out, 'import("./lazy.ts")');
    assert.include(out, 'mock("./mocked.ts")');
    assert.include(out, 'from "effect"');
    assert.include(out, "from './side.ts'");
    assert.strictEqual(pipe(source, rewriteSpecifiers(resolver)), out);
  });
  it("finds leftover foreign specifiers by line", () => {
    assert.deepStrictEqual(foreignSpecifierLines("a.ts", 'ok\nimport x from "@effected/glob"\n'), ["a.ts:2"]);
    assert.deepStrictEqual(pipe("a.ts", foreignSpecifierLines("clean")), []);
    const alias = 'import { x } from "@beep/scratchpad/effected/jsonc/index";\n * import { y } from "@beep/scratchpad/effected/jsonc/index"';
    assert.deepStrictEqual(foreignSpecifierLines("t.ts", alias), ["t.ts:1"]);
  });
});

describe("carried documentation", () => {
  it("orders okf links with the module concept first and no duplicates", () => {
    const claude = "See `okf/conventions/testing-standards.md`, @./okf/modules/glob.md and okf/conventions/testing-standards.md.";
    assert.deepStrictEqual(okfLinks("glob", claude), ["okf/modules/glob.md", "okf/conventions/testing-standards.md"]);
  });
  it("assembles a verbatim bundle and marks missing files", () => {
    const text = assembleKnowledge({ module: "glob", commit: "abc" }, [
      { path: "packages/glob/CLAUDE.md", content: O.some("# glob\nbody") },
      { path: "okf/modules/glob.md", content: O.none() },
    ]);
    assert.include(text, "<!-- packages/glob/CLAUDE.md -->\n# glob\nbody");
    assert.include(text, "<!-- missing in the upstream checkout: okf/modules/glob.md -->");
    assert.isTrue(text.endsWith("\n"));
  });
  it("retitles the README and appends the four port-notes subsections", () => {
    const attribution = {
      module: "glob" as const,
      packageName: "@effected/glob",
      version: "0.10.0",
      commit: "abc",
      hasLicense: false,
      notices: ["src/x.ts:1 // Ported from minimatch"],
    };
    const text = readmeSkeleton("# @effected/glob\n\nWhy.", attribution);
    assert.isTrue(text.startsWith("# glob (lab port of @effected/glob)\n\nWhy."));
    for (const heading of ["### Attribution", "### Added exports", "### Deviations", "### Dependency backlog"]) {
      assert.include(text, heading);
    }
    assert.include(text, "- src/x.ts:1 // Ported from minimatch");
    assert.include(text, "ships no LICENSE file");
    assert.isTrue(pipe("no heading", readmeSkeleton(attribution)).startsWith("# glob (lab port of @effected/glob)\nno heading"));
  });
  it("finds vendor notices only in file headers", () => {
    const text = ["// Copyright (c) Isaac Z. Schlueter", ...A.replicate("x", 50), "// MIT later"].join("\n");
    assert.deepStrictEqual(scanVendorNotices("m.ts", text), ["m.ts:1 // Copyright (c) Isaac Z. Schlueter"]);
  });
  it("renders the section 5.3 tsconfig", () => {
    assert.include(moduleTsconfig("walker"), '"extends": "../../tsconfig.json"');
    assert.include(moduleTsconfig("walker"), "../../test/walker/");
  });
  it("parses pnpm catalogs across named catalogs", () => {
    const specs = parseCatalogSpecs(
      ["packages:", "  - packages/*", "catalogs:", "  effect:", '    "@effect/vitest": ^4.0.0', "  build:", "    minimatch: 10.2.5", "other: x"].join("\n")
    );
    assertSome(HashMap.get(specs, "minimatch"), "10.2.5");
    assertSome(HashMap.get(specs, "@effect/vitest"), "^4.0.0");
    assertNone(HashMap.get(specs, "other"));
  });
});

describe("gates and processes", () => {
  it("detects a silent Effect plugin from a tsgo report", () => {
    assert.deepStrictEqual(missingCanaryDiagnostics(""), CANARY_DIAGNOSTICS);
    assert.deepStrictEqual(
      missingCanaryDiagnostics("a effect(missingPipeableSignature)\nb effect(strictBooleanExpressions)"),
      []
    );
  });
  it("orders tsgo versions numerically", () => {
    assert.strictEqual(compareVersions("0.50.0", "0.48.1"), 1);
    assert.strictEqual(compareVersions("0.9.0", "0.10.0"), -1);
    assert.strictEqual(pipe("1.2.3", compareVersions("1.2.3")), 0);
  });
  it("renders and admits launches", () => {
    const launch = { command: "bun", args: ["install"], cwd: "/repo" };
    assert.strictEqual(renderLaunch(launch), "bun install");
    assert.strictEqual(renderLaunch(heavy(launch)), "beep-heavy bun install");
  });
  it("renders typed errors", () => {
    assert.strictEqual(GateFailed.make({ target: "yaml", gate: "lint", exitCode: 1, problems: ["x"] }).message, "yaml lint: red (exit 1)\n  x");
    assert.strictEqual(CliUsageError.make({ detail: "d" }).message, "usage: d");
    assert.strictEqual(LedgerIncomplete.make({ done: 1, total: 29 }).message, "ledger incomplete: 1/29 done");
  });
});

describe("source analysis", () => {
  it("reads the facets of the jsonc entry from disk", () => {
    const facets = readExportFacets("scratchpad/effected/jsonc/index.ts", ".");
    const byName = (name: string) => A.findFirst(facets, (entry) => entry.name === name);
    assertSome(O.map(byName("JsoncBoundCodec"), (entry) => entry.kind), "type");
    assertSome(O.map(byName("Jsonc"), (entry) => entry.entry), ".");
    assert.isTrue(O.isSome(byName("JsoncParseError")));
    assert.isTrue(A.every(facets, (entry) => S.is(ModuleName)("jsonc") && entry.entry === "."));
  });
  it.layer(NodeFileSystem.layer)((it) => {
    it.effect("flags every D15 assertion class and allows as const and satisfies", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        const file = `${directory}/fixture.ts`;
        const source = [
          "const a = 1 as unknown;",
          "const b = [1] as const;",
          "declare const c: string | undefined;",
          "const d = c!;",
          "const e = <number>a;",
          "let f: any;",
          "// @ts-ignore",
          "const g = { x: 1 } satisfies { x: number };",
        ].join("\n");
        yield* fs.writeFileString(file, source);
        const kinds = A.map(scanUnsafeAssertions([[file, "fixture.ts"]]), (finding) => finding.kind);
        assert.deepStrictEqual(A.sort(kinds, Order.String), ["angle-cast", "any", "as", "non-null", "ts-ignore"]);
      })
    );
  });
});

describe("review loop", () => {
  it("places round evidence under the module's .review directory", () => {
    assert.strictEqual(roundDir("yaml", 3), "scratchpad/effected/yaml/.review/round-3");
    assert.strictEqual(pipe("glob", roundDir(1)), "scratchpad/effected/glob/.review/round-1");
  });
  it("renders the section 12.3 brief with the previous inventory from round 2", () => {
    const first = reviewBrief("jsonl", { round: 1, commit: "abc" });
    assert.include(first, "Module: jsonl. Commit: abc. Round: 1.");
    assert.include(first, "Previous rounds: none (first round).");
    assert.include(first, "REQUIRED: <n>");
    for (const surface of LAW_SURFACES) {
      assert.include(first, surface);
    }
    const second = pipe("jsonl", reviewBrief({ round: 2, commit: "def" }));
    assert.include(second, "scratchpad/effected/jsonl/.review/round-1/INVENTORY.md");
  });
  it("launches Grok with read-only tools and Sol read-only, writing reports beside the brief", () => {
    const seats = seatLaunches("/repo", "scratchpad/effected/jsonl/.review/round-1");
    assert.deepStrictEqual(A.map(seats, (seat) => seat.seat), ["grok", "sol"]);
    const scripts = A.map(seats, (seat) => A.join(seat.launch.args, " "));
    assert.include(scripts[0] ?? "", '--tools "read_file,grep,list_dir"');
    assert.include(scripts[0] ?? "", '--deny "Write(**)"');
    assert.include(scripts[0] ?? "", "grok-4.7 --reasoning-effort xhigh");
    assert.include(scripts[1] ?? "", "-s read-only");
    assert.include(scripts[1] ?? "", 'model_reasoning_effort="high"');
    assert.include(scripts[1] ?? "", "round-1/sol.md");
  });
  it("finds reviewer edits outside the round directory", () => {
    const status = [" M scratchpad/effected/jsonl/Line.ts", "?? scratchpad/effected/jsonl/.review/round-1/grok.md", ""].join("\n");
    assert.deepStrictEqual(outOfScopeChanges(status, "scratchpad/effected/jsonl/.review/"), ["scratchpad/effected/jsonl/Line.ts"]);
    assert.deepStrictEqual(pipe("", outOfScopeChanges("x/")), []);
  });
  it("names the accumulating ledger fields", () => {
    assert.deepStrictEqual(AppendField.literals, ["deviations", "backlog", "reviewRounds", "exportsAdded"]);
  });
});

describe("root import codemod", () => {
  const rewrite = (text: string) => {
    const file = new Project({ useInMemoryFileSystem: true }).createSourceFile("a.ts", text);
    return { result: rewriteRootImports(file), text: file.getFullText() };
  };
  it("aliases data modules, keeps other namespaces and routes combinators to effect/Function", () => {
    const { result, text } = rewrite(
      'import { Effect, Option, Schema, pipe } from "effect";\nexport const x = pipe(Option.some(1), Option.map((n) => n));\nexport const y: Schema.Schema<string> = Schema.String;\nexport const z = Effect.void;\n'
    );
    assert.deepStrictEqual(result.aliased, ["Option->O", "Schema->S"]);
    assert.include(text, 'import * as Effect from "effect/Effect";');
    assert.include(text, 'import * as O from "effect/Option";');
    assert.include(text, 'import * as S from "effect/Schema";');
    assert.include(text, 'import { pipe } from "effect/Function";');
    assert.include(text, "pipe(O.some(1), O.map((n) => n))");
    assert.include(text, "const y: S.Schema<string> = S.String;");
    assert.notInclude(text, 'from "effect";');
  });
  it("keeps the long name when the alias would collide", () => {
    const { result, text } = rewrite(
      'import { Schema } from "effect";\nexport const f = <S extends Schema.Top>(schema: S): S => schema;\n'
    );
    assert.deepStrictEqual(result.collisions, ["Schema->S"]);
    assert.include(text, 'import * as Schema from "effect/Schema";');
    assert.include(text, "<S extends Schema.Top>");
  });
  it("preserves type-only imports and explicit aliases", () => {
    const { text } = rewrite(
      'import type { DateTime, Schema as SchemaNs } from "effect";\nimport { type Option, Effect } from "effect";\nexport type T = DateTime.Utc | SchemaNs.Top | Option.Option<number>;\nexport const e = Effect.void;\n'
    );
    assert.include(text, 'import type * as DateTime from "effect/DateTime";');
    assert.include(text, 'import type * as SchemaNs from "effect/Schema";');
    assert.include(text, 'import type * as O from "effect/Option";');
    assert.include(text, "Option.Option<number>".replace("Option.", "O."));
  });
  it("leaves files without root imports untouched", () => {
    const { result, text } = rewrite('import * as S from "effect/Schema";\nexport const s = S.String;\n');
    assert.strictEqual(result.rewritten, 0);
    assert.include(text, 'import * as S from "effect/Schema";');
  });
});

describe("jsdoc law", () => {
  const block = (...lines: ReadonlyArray<string>) => ["/**", ...lines.map((line) => ` * ${line}`), " */"].join("\n");
  it("accepts a canonical block", () => {
    const text = block("Lead.", "", "**Details**", "", "More.", "", "**Example** (Use it)", "", "```ts", "x", "```", "", "@see {@link X} for the schema.", "@category utilities", "@since 0.0.0");
    assert.deepStrictEqual(blockFindings(text), []);
  });
  it("requires a When to use section to open with an allowed phrase", () => {
    const bad = block("Lead.", "", "**When to use**", "", "Use at boundaries.", "@since 0.0.0");
    const good = block("Lead.", "", "**When to use**", "", "Use when parsing at a boundary.", "@since 0.0.0");
    assert.include(A.map(blockFindings(bad), (finding) => finding.split(":")[0]), "when-to-use-opener");
    assert.deepStrictEqual(blockFindings(good), []);
  });
  it("flags legacy carriers, bare see, bad category and since, hyphens and braces", () => {
    const text = block("Lead.", "", "@remarks old", "@example", "@param {string} x - the x", "@returns - y", "@see {@link X}", "@category stuff", "@since 1.0.0");
    const rules = A.map(blockFindings(text), (finding) => finding.split(":")[0]);
    for (const rule of ["legacy-tag", "tag-type-braces", "tag-hyphen", "see-purpose", "category", "since"]) {
      assert.include(rules, rule);
    }
  });
  it("flags untitled, duplicate-titled, fenceless and loose examples, and section order", () => {
    const text = block(
      "Lead.",
      "",
      "```ts",
      "loose",
      "```",
      "",
      "**Example**",
      "",
      "**Example** (Same)",
      "",
      "```ts",
      "a",
      "```",
      "",
      "**Example** (Same)",
      "",
      "```ts",
      "b",
      "```",
      "",
      "**Details**",
      "",
      "late",
      "@since 0.0.0"
    );
    const rules = A.map(blockFindings(text), (finding) => finding.split(":")[0]);
    for (const rule of ["loose-fence", "example-title", "example-fences", "section-order"]) {
      assert.include(rules, rule);
    }
  });
});
