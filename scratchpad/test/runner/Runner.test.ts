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
import { CANARY_DIAGNOSTICS, gatePlan, missingCanaryDiagnostics } from "../../effected/runner/Gates.ts";
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
