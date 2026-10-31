import {
  browserModeIncludeGlobs,
  collectEffectVitestImports,
  detectEffectVitestFindings,
  resolveEffectVitestBinding,
  retainBrowserSafeFindings,
} from "@beep/repo-cli/test/Lint";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { layer, vi } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { createWrappedNode, Node, Project, SyntaxKind, ts } from "ts-morph";
import type { EffectVitestRuleId } from "@beep/repo-cli/test/Lint";
import type { Node as MorphNode } from "ts-morph";

const effectImports = A.join(
  [
    'import { Console, Context, Effect as Fx, Exit as X, FileSystem, Layer as L, Option as O, Result as R, Schedule as S } from "effect";',
    'import * as TC from "effect/testing/TestClock";',
    'import * as fc from "effect/testing/FastCheck";',
  ],
  "\n"
);
const imports = `${effectImports}\nimport { beforeEach, expect, it, test, vi } from "@effect/vitest";`;

const findings = Effect.fnUntraced(function* (body: string) {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const source = project.createSourceFile("fixture.test.ts", `${imports}\n${body}`);
  return yield* detectEffectVitestFindings(source, "packages/example/test/fixture.test.ts", "@beep/example");
});
const hasRule = Effect.fnUntraced(function* (body: string, ruleId: EffectVitestRuleId) {
  return A.some(yield* findings(body), (finding) => finding.ruleId === ruleId);
});

// A fixture test file beside the other in-memory sources it imports, resolved like the scan resolves them.
const findingsAcrossFiles = Effect.fnUntraced(function* (
  files: ReadonlyArray<readonly [path: string, text: string]>,
  body: string
) {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const [path, text] of files) project.createSourceFile(path, `${effectImports}\n${text}`);
  const source = project.createSourceFile("/repo/test/fixture.test.ts", `${imports}\n${body}`);
  return yield* detectEffectVitestFindings(source, "packages/example/test/fixture.test.ts", "@beep/example");
});
const hasRuleAcrossFiles = Effect.fnUntraced(function* (
  files: ReadonlyArray<readonly [path: string, text: string]>,
  body: string,
  ruleId: EffectVitestRuleId
) {
  return A.some(yield* findingsAcrossFiles(files, body), (finding) => finding.ruleId === ruleId);
});

const findingsWithHarness = Effect.fnUntraced(function* (harnessImport: string, body: string) {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const source = project.createSourceFile(
    "instrumented-fixture.test.ts",
    `${effectImports}\n${harnessImport}\n${body}`
  );
  return yield* detectEffectVitestFindings(
    source,
    "packages/example/test/instrumented-fixture.test.ts",
    "@beep/example"
  );
});

const pairedHarnessFindings = Effect.fnUntraced(function* (body: string, module = "@beep/test-utils/Vitest") {
  return {
    instrumented: yield* findingsWithHarness(`import { it as instrumentedIt } from "${module}";`, body),
    original: yield* findingsWithHarness('import { it as instrumentedIt } from "@effect/vitest";', body),
  };
});

const assertEquivalentFindings = Effect.fnUntraced(function* (
  body: string,
  expectedRule: EffectVitestRuleId,
  module?: string
) {
  const { instrumented, original } = yield* pairedHarnessFindings(body, module);
  assertTrue(A.some(original, (finding) => finding.ruleId === expectedRule));
  assertTrue(original.length === instrumented.length);
  A.zipWith(original, instrumented, (left, right) => {
    assertTrue(left.id === right.id);
    assertTrue(left.lens === right.lens);
    assertTrue(left.ruleId === right.ruleId);
    assertTrue(left.class === right.class);
    assertTrue(left.evidence === right.evidence);
    assertTrue(left.replacement.primitive === right.replacement.primitive);
    assertTrue(left.replacement.sketch === right.replacement.sketch);
    assertTrue(left.severity === right.severity);
    assertTrue(left.confidence === right.confidence);
    assertTrue(left.mechanization === right.mechanization);
  });
});

const cases: ReadonlyArray<{
  readonly ruleId: EffectVitestRuleId;
  readonly positive: string;
  readonly negative: string;
}> = [
  {
    ruleId: "EV001",
    positive: 'it("x", () => Fx.runSync(program));',
    negative: 'it("x", () => subject.runSync(program));',
  },
  {
    ruleId: "EV002",
    positive: 'it.effect("x", () => Fx.provide(program, L.scoped(Service, acquire)));',
    negative: 'const stub = L.succeed(Service, value); it.effect("x", () => Fx.provide(program, stub));',
  },
  {
    ruleId: "EV003",
    positive:
      'const withRepo = (effect) => Fx.acquireRelease(acquire, release).pipe(Fx.flatMap(() => effect)); it.effect("x", withRepo(program));',
    negative:
      'const withStatus = (value) => ({ value, status: "ok" }); it.effect("x", () => Fx.succeed(withStatus(value)));',
  },
  {
    ruleId: "EV004",
    positive: 'it.effect("x", () => Fx.scoped(program));',
    negative: 'const fixture = Fx.scoped(program); it.effect("x", () => fixture);',
  },
  {
    ruleId: "EV005",
    positive: 'it("x", () => expect(Fx.result(program)).toBeDefined());',
    negative: 'it("x", () => Fx.result(program));',
  },
  {
    ruleId: "EV006",
    positive: 'it("x", () => expect(value).toEqual(O.some(1)));',
    negative: 'it("x", () => assertSome(value, 1));',
  },
  {
    ruleId: "EV007",
    positive: 'test("x", () => fc.assert(fc.property(fc.string(), () => true)));',
    negative: 'it.prop("x", [fc.string()], () => true);',
  },
  {
    ruleId: "EV008",
    positive: 'it.effect("x", () => Fx.sleep("1 second"));',
    negative: 'it.effect("x", () => Fx.sleep("1 second").pipe(TC.withLive));',
  },
  {
    ruleId: "EV009",
    positive: 'it.live("x", () => Fx.log("diagnostic"));',
    negative: 'it.live("x", () => Console.log("live console"));',
  },
  {
    ruleId: "EV010",
    positive: 'import { readFile } from "node:fs/promises"; it("x", () => readFile("fixture"));',
    negative: 'it.effect("x", () => FileSystem.FileSystem);',
  },
  {
    ruleId: "EV011",
    positive: 'import { describe } from "vitest"; describe("x", () => Fx.void);',
    negative: 'import { describe } from "@effect/vitest"; describe("x", () => Fx.void);',
  },
  {
    ruleId: "EV012",
    positive: 'class MyService extends Context.Service("MyService")<MyService, {}>() {} vi.spyOn(MyService, "make");',
    negative: 'vi.spyOn(Math, "random");',
  },
  {
    ruleId: "EV013",
    positive:
      'it.effect("x", () => Fx.gen(function*(){ let attempts = 0; while (attempts < 3) { attempts += 1; yield* Fx.sleep("1 second"); } }));',
    negative: 'it("x", () => { for (const value of values) consume(value); });',
  },
  {
    ruleId: "EV014",
    positive: 'it.layer(L.scoped(Service, acquire))("db", (it) => { it.effect("x", () => Fx.void); });',
    negative:
      'it.layer(L.scoped(Service, acquire), { timeout: "30 seconds" })("db", (it) => { it.effect("x", () => Fx.void); });',
  },
  {
    ruleId: "EV015",
    positive:
      'it.layer(L.succeed(Service, value))("outer", (it) => { it.layer(L.succeed(Child, value))("inner", (it) => { it.effect("x", () => TC.adjust("1 second")); }); });',
    negative: 'it.effect("unshared", () => TC.adjust("1 second"));',
  },
];

layer(BunCrypto.layer, { timeout: "10 seconds" })((it) => {
  it.effect("retains outcome findings for piped boolean assertions", () =>
    Effect.gen(function* () {
      const assertionImports =
        'import { assertTrue, assertFalse } from "@effect/vitest/utils"; import { pipe } from "effect";';
      for (const body of [
        'it.effect("method", () => Fx.gen(function* () { const outcome = yield* Fx.result(program); outcome.pipe(R.isFailure, assertTrue); }));',
        'it.effect("functional", () => Fx.gen(function* () { const outcome = yield* Fx.result(program); pipe(outcome, R.isSuccess, assertFalse); }));',
        'it.effect("inline", () => Fx.gen(function* () { (yield* Fx.result(program)).pipe(R.isFailure, assertTrue); }));',
      ]) {
        assertTrue(yield* hasRule(`${assertionImports}\n${body}`, "EV005"));
      }
    })
  );

  it.effect("rejects shadowed and unrelated piped outcome assertions", () =>
    Effect.gen(function* () {
      const assertionImports = 'import { assertTrue } from "@effect/vitest/utils";';
      for (const body of [
        'it.effect("shadow", (assertTrue) => Fx.gen(function* () { const outcome = yield* Fx.result(program); outcome.pipe(R.isFailure, assertTrue); }));',
        'it.effect("unrelated", () => Fx.gen(function* () { const outcome = yield* Fx.result(program); other.pipe(R.isFailure, assertTrue); }));',
        'it.effect("not assertion", () => Fx.gen(function* () { const outcome = yield* Fx.result(program); outcome.pipe(R.isFailure, consume); }));',
        'it.effect("nested initializer", () => Fx.gen(function* () { const outcomes = [yield* Fx.result(program)]; assertTrue(outcomes.length === 1); }));',
      ]) {
        assertFalse(yield* hasRule(`${assertionImports}\n${body}`, "EV005"));
      }
    })
  );
  it.effect.each(cases)("$ruleId positive AST fixture", ({ positive, ruleId }) =>
    Effect.gen(function* () {
      assertTrue(yield* hasRule(positive, ruleId));
    })
  );
  it.effect.each(cases)("$ruleId negative AST fixture", ({ negative, ruleId }) =>
    Effect.gen(function* () {
      assertFalse(yield* hasRule(negative, ruleId));
    })
  );

  it.effect("tracks named Effect and Layer aliases without mistaking lexical shadows", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule(
          'import { runSync as run, provide as give } from "effect/Effect"; import { scoped as resource } from "effect/Layer"; it("x", () => run(program)); it.effect("y", () => give(program, resource(Service, acquire)));',
          "EV001"
        )
      );
      assertTrue(
        yield* hasRule(
          'import { runSync as run, provide as give } from "effect/Effect"; import { scoped as resource } from "effect/Layer"; it.effect("y", () => give(program, resource(Service, acquire)));',
          "EV002"
        )
      );
      assertFalse(
        yield* hasRule('import { runSync } from "effect/Effect"; it("x", (runSync) => runSync(program));', "EV001")
      );
    })
  );

  it.effect("tracks the root Effect namespace and respects hoisted function shadows", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule('import * as E from "effect"; it("namespace", () => E.Effect.runSync(program));', "EV001")
      );
      assertFalse(
        yield* hasRule('it("hoisted", () => { expect(() => Fx.runSync()).toThrow(); function Fx() {} });', "EV001")
      );
    })
  );

  it.effect("emits equivalent findings for the instrumented tester runtime, scope, and TestClock boundaries", () =>
    Effect.gen(function* () {
      yield* assertEquivalentFindings('instrumentedIt("runtime", () => Fx.runSync(program));', "EV001");
      yield* assertEquivalentFindings('instrumentedIt.effect("scope", () => Fx.scoped(program));', "EV004");
      yield* assertEquivalentFindings('instrumentedIt.effect("clock", () => Fx.sleep("1 second"));', "EV008");
    })
  );

  it.effect("recognizes every public instrumented it form through existing tester provenance", () =>
    Effect.gen(function* () {
      assertTrue(
        A.some(
          yield* findingsWithHarness(
            'import { it } from "@beep/test-utils/Vitest";',
            'it("direct", () => Fx.runSync(program));'
          ),
          (finding) => finding.ruleId === "EV001"
        )
      );
      assertTrue(
        A.some(
          yield* findingsWithHarness(
            'import { it as runner } from "@beep/test-utils/Vitest";',
            'runner.effect("alias", () => Fx.sleep("1 second"));'
          ),
          (finding) => finding.ruleId === "EV008"
        )
      );
      assertTrue(
        A.some(
          yield* findingsWithHarness(
            'import * as Instrumented from "@beep/test-utils/Vitest";',
            'Instrumented.it.live("namespace", () => Fx.log("diagnostic"));'
          ),
          (finding) => finding.ruleId === "EV009"
        )
      );
      yield* assertEquivalentFindings(
        'instrumentedIt.each(cases)("each", () => Fx.runSync(program)); instrumentedIt.prop("prop", [], () => Fx.runSync(program));',
        "EV001"
      );
      yield* assertEquivalentFindings(
        'instrumentedIt.layer(L.scoped(Service, acquire))("outer", (it) => { it.layer(L.succeed(Child, value))("inner", (it) => { it.effect("clock", () => Fx.sleep("1 second")); }); });',
        "EV008"
      );
    })
  );

  it.effect("does not promote unrelated test-utils modules or non-tester Vitest exports", () =>
    Effect.gen(function* () {
      const negatives = [
        'import { it as candidate } from "@beep/test-utils/Schema";',
        'import { TestHang as candidate } from "@beep/test-utils/Vitest";',
        'import { test as candidate } from "@beep/test-utils/Vitest";',
        'import { expect as candidate } from "@beep/test-utils/Vitest";',
      ];
      for (const harnessImport of negatives) {
        assertFalse(
          A.some(
            yield* findingsWithHarness(harnessImport, 'candidate("negative", () => Fx.runSync(program));'),
            (finding) => finding.ruleId === "EV001"
          )
        );
      }
      assertFalse(
        A.some(
          yield* findingsWithHarness(
            'import * as Instrumented from "@beep/test-utils/Vitest";',
            'Instrumented.TestHang("negative", () => Fx.runSync(program));'
          ),
          (finding) => finding.ruleId === "EV001"
        )
      );
    })
  );

  it.effect("preserves shadowing for direct, renamed, and namespace instrumented imports", () =>
    Effect.gen(function* () {
      assertFalse(
        A.some(
          yield* findingsWithHarness(
            'import { it as runner } from "@beep/test-utils/Vitest";',
            'const verify = () => { const runner = subject; runner("shadowed", () => Fx.runSync(program)); };'
          ),
          (finding) => finding.ruleId === "EV001"
        )
      );
      assertFalse(
        A.some(
          yield* findingsWithHarness(
            'import * as Instrumented from "@beep/test-utils/Vitest";',
            'const verify = () => { const Instrumented = subject; Instrumented.it("shadowed", () => Fx.runSync(program)); };'
          ),
          (finding) => finding.ruleId === "EV001"
        )
      );
    })
  );

  it.effect("does not classify live sleep as a TestClock hang", () =>
    Effect.gen(function* () {
      assertFalse(yield* hasRule('it.live("sleep", () => Fx.sleep("1 millis"));', "EV008"));
      assertTrue(yield* hasRule('it.live("sleep", () => Fx.sleep("1 millis"));', "EV009"));
    })
  );

  it.effect("recognizes a locally constructed Context provision", () =>
    Effect.gen(function* () {
      assertFalse(
        yield* hasRule(
          'const ctx = Context.make(Service, {}); it.effect("context", () => Fx.provide(program, ctx));',
          "EV002"
        )
      );
    })
  );

  it.effect("follows Context pipe chains and same-file Context factories into a Context provision", () =>
    Effect.gen(function* () {
      for (const body of [
        'const ctx = Context.make(Source, {}).pipe(Context.add(Config, {})); it.effect("piped", () => Fx.provide(program, ctx));',
        'const makeContext = (source: string) => Context.make(Source, source).pipe(Context.add(Config, {}), Context.merge(extra)); it.effect("factory", () => Fx.provide(program, makeContext("a")));',
        'const makeContext = function () { return Context.make(Source, {}); }; it.effect("function", () => Fx.provide(program, makeContext()));',
        'function makeContext() { return Context.add(Context.make(Source, {}), Config, {}); } it.effect("declaration", () => Fx.provide(program, makeContext()));',
      ]) {
        assertFalse(yield* hasRule(body, "EV002"));
      }
      for (const body of [
        'const ctx = Context.make(Source, {}).pipe(mystery); it.effect("unknown stage", () => Fx.provide(program, ctx));',
        'const ctx = mystery.pipe(Context.add(Config, {})); it.effect("unknown receiver", () => Fx.provide(program, ctx));',
        'const makeLayer = () => L.effect(Service, Fx.succeed({})); it.effect("layer factory", () => Fx.provide(program, makeLayer()));',
        'const makeContext = (flag: boolean) => { if (flag) return Context.make(Source, {}); return liveLayer; }; it.effect("mixed returns", () => Fx.provide(program, makeContext(true)));',
        'const makeContext = () => Context.make(Source, {}); it.effect("shadowed", () => { const makeContext = () => liveLayer; return Fx.provide(program, makeContext()); });',
        'const makeContext = (flag: boolean) => (flag ? Context.make(Source, {}) : liveLayer); it.effect("branch", () => Fx.provide(program, makeContext(true)));',
      ]) {
        assertTrue(yield* hasRule(body, "EV002"));
      }
    })
  );

  it.effect("keeps property members when an unrelated import uses the same local name", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule(
          'import * as assert from "@effect/vitest/utils"; it("property", () => fc.assert(fc.property(fc.string(), () => true)));',
          "EV007"
        )
      );
    })
  );

  it.effect("reads the expected literal of a node:assert equality over a data shape", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule(
          'import assert from "node:assert/strict"; it("x", () => assert.strictEqual(O.isSome(value), true));',
          "EV006"
        )
      );
    })
  );

  it.effect("resolves an acquire-release provision instead of routing it to judgment", () =>
    Effect.gen(function* () {
      const rows = yield* findings('it.effect("x", () => Fx.provide(program, Fx.acquireRelease(acquire, release)));');

      assertTrue(A.some(rows, (row) => row.ruleId === "EV002" && row.mechanization === "detector"));
    })
  );

  it.effect("recognizes const-arrow and Effect.fnUntraced resource wrapper definitions", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule(
          'const withOne = (effect) => Fx.acquireRelease(acquire, release).pipe(Fx.flatMap(() => effect)); it.effect("x", withOne(program));',
          "EV003"
        )
      );
      assertTrue(
        yield* hasRule(
          'const withTwo = Fx.fnUntraced((effect) => Fx.acquireRelease(acquire, release).pipe(Fx.flatMap(() => effect))); it.effect("x", withTwo(program));',
          "EV003"
        )
      );
    })
  );

  it.effect("retains unresolved imported resource wrappers for judgment", () =>
    Effect.gen(function* () {
      const rows = yield* findings(
        'import { withFixture } from "./fixture.ts"; it.effect("resource", () => withFixture(program));'
      );
      assertTrue(A.some(rows, (row) => row.ruleId === "EV003" && row.class === "unresolved-resource-wrapper"));
    })
  );

  it.effect("reviews temp wrappers that mutate imported process state or cannot prove their acquisition", () =>
    Effect.gen(function* () {
      for (const body of [
        'import process from "node:process"; const wrap = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, (root) => Fx.sync(() => { delete process.env.ROOT; }).pipe(Fx.andThen(fs.remove(root))));',
        'import * as process from "process"; const wrap = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), (root) => Fx.sync(() => process.chdir(root)).pipe(Fx.andThen(use(root))), (root) => fs.remove(root));',
        "const wrap = (use) => Fx.acquireUseRelease(Fx.flatMap(FileSystem.FileSystem, acquireRoot), use, (root) => fs.remove(root));",
        "const wrap = (use) => Fx.acquireUseRelease(Fx.flatMap(FileSystem.FileSystem, (fs) => { record(); return fs.makeTempDirectory(); }), use, (root) => fs.remove(root));",
        'const wrap = (use) => Fx.acquireUseRelease(Fx.flatMap(FileSystem.FileSystem, (fs) => { return fs.readFileString("fixture"); }), use, (root) => fs.remove(root));',
        "const wrap = (use) => Fx.acquireUseRelease(Fx.gen(() => fs.makeTempDirectory()), use, (root) => fs.remove(root));",
        "const wrap = (use) => Fx.acquireUseRelease(Fx.gen(function* () { return fs.makeTempDirectory(); }), use, (root) => fs.remove(root));",
      ])
        assertTrue(yield* hasRule(`${body} it.effect("resource", () => wrap(program));`, "EV003"));
      assertFalse(
        yield* hasRule(
          'const wrap = (use) => Fx.acquireUseRelease(Fx.flatMap(FileSystem.FileSystem, function (fs) { return fs.makeTempDirectory(); }), use, (root) => fs.remove(root)); it.effect("fresh", () => wrap(program));',
          "EV003"
        )
      );
    })
  );

  it.effect("permits fresh temp-root wrappers and keeps shareable resources under resource review", () =>
    Effect.gen(function* () {
      const fresh = [
        'const withTempDirectory = (use) => Fx.acquireUseRelease(Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; return yield* fs.makeTempDirectory({ prefix: "case-" }); }), use, (root) => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.remove(root, { recursive: true, force: true }); })); it.effect("x", () => withTempDirectory((root) => program(root)));',
        'const withTempCwd = (use) => Fx.acquireUseRelease(Fx.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()), use, (dir) => Fx.flatMap(FileSystem.FileSystem, (fs) => fs.remove(dir, { recursive: true }).pipe(Fx.orDie))); it.effect("x", () => withTempCwd(program));',
        'const inTempRepo = Fx.fn("inTempRepo")(function* (use) { const fs = yield* FileSystem.FileSystem; return yield* Fx.acquireUseRelease(fs.makeTempDirectory(), use, (root) => fs.remove(root, { recursive: true }).pipe(Fx.orDie)); }); it.effect("x", () => inTempRepo(program));',
        'const withTempRoot = (use) => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; const root = yield* Fx.acquireRelease(fs.makeTempDirectoryScoped(), (path) => fs.remove(path, { recursive: true })); return yield* use(root); }); it.effect("x", () => withTempRoot(program));',
        'const withTempDirectory = (use) => Fx.acquireUseRelease(Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; return yield* fs.makeTempDirectory({ directory: safeTempRoot(), prefix: "case-" }); }), use, (root) => fs.remove(root)); it.effect("x", () => withTempDirectory(program));',
        'const withTempDirectory = (use) => Fx.acquireUseRelease(fs.makeTempDirectory({ prefix: "case-" }), (root) => use(root).pipe(Fx.provideService(Roots, [root])), (root) => fs.remove(root)); it.effect("x", () => withTempDirectory(program));',
        'const withTempDirectory = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, Fx.fnUntraced(function* (tmpDir) { yield* fs.remove(tmpDir, { recursive: true }); })); it.effect("x", () => withTempDirectory(program));',
        'const withTempDirectory = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, Fx.fn("release")(function* (tmpDir) { yield* fs.remove(tmpDir); })); it.effect("x", () => withTempDirectory(program));',
      ];
      for (const body of fresh) assertFalse(yield* hasRule(body, "EV003"));

      const shareable = [
        'const withCatalog = (use) => Fx.acquireUseRelease(fs.readFileString("fixtures/catalog.json"), use, () => Fx.void); it.effect("x", () => withCatalog(program));',
        'const withTempLog = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, (root) => Fx.log(root)); it.effect("x", () => withTempLog(program));',
        'const withTempOther = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, (root) => fs.remove(fixtureRoot, { recursive: true })); it.effect("x", () => withTempOther(program));',
        'const withTempStore = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), (root) => Fx.acquireRelease(openStore(root), closeStore).pipe(Fx.flatMap(use)), (root) => fs.remove(root)); it.effect("x", () => withTempStore(program));',
        'const withTempCwd = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, Fx.fnUntraced(function* (tmpDir) { yield* fs.remove(otherDir); })); it.effect("x", () => withTempCwd(program));',
        'const withTempCwd = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, wrap(function* (tmpDir) { yield* fs.remove(tmpDir); })); it.effect("x", () => withTempCwd(program));',
        'const withTempCwd = (use) => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; const root = yield* Fx.acquireRelease(fs.makeTempDirectory(), (path) => fs.remove(path)); process.chdir(root); return yield* use(root); }); it.effect("x", () => withTempCwd(program));',
        'const withTempCwd = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, (root) => fs.remove(root)).pipe(Fx.tap(() => process.chdir(fixtureRoot))); it.effect("x", () => withTempCwd(program));',
        'const enterRoot = (root) => { process.env.BEEP_ROOT = root; }; const withTempEnv = (use) => Fx.gen(function* () { const root = yield* Fx.acquireRelease(fs.makeTempDirectory(), (path) => fs.remove(path)); enterRoot(root); return yield* use(root); }); it.effect("x", () => withTempEnv(program));',
        'const withTempServer = (use) => Fx.acquireUseRelease(Fx.zipLeft(fs.makeTempDirectory(), startServer), use, (root) => fs.remove(root)); it.effect("x", () => withTempServer(program));',
        'const withSeededTemp = (use) => Fx.acquireUseRelease(Fx.tap(fs.makeTempDirectory(), seedFixtures), use, (root) => fs.remove(root)); it.effect("x", () => withSeededTemp(program));',
        'const withSeededTemp = (use) => Fx.acquireUseRelease(fs.makeTempDirectory().pipe(Fx.tap(seedFixtures)), use, (root) => fs.remove(root)); it.effect("x", () => withSeededTemp(program));',
        'const withTempGen = (use) => Fx.acquireUseRelease(Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* startServer; return yield* fs.makeTempDirectory(); }), use, (root) => fs.remove(root)); it.effect("x", () => withTempGen(program));',
        'const withTempFlat = (use) => Fx.acquireUseRelease(Fx.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory().pipe(Fx.tap(seedFixtures))), use, (root) => fs.remove(root)); it.effect("x", () => withTempFlat(program));',
        'const inTempCheckout = Fx.fn(function* (use) { const fs = yield* FileSystem.FileSystem; const cwd = process.cwd(); return yield* Fx.acquireUseRelease(fs.makeTempDirectory(), (root) => Fx.sync(() => process.chdir(root)).pipe(Fx.andThen(use(root))), (root) => Fx.sync(() => process.chdir(cwd)).pipe(Fx.andThen(fs.remove(root)))); }); it.effect("x", () => inTempCheckout(program));',
        'const inTempCheckout = Fx.fn(function* (use) { const fs = yield* FileSystem.FileSystem; const originalCwd = process.cwd; return yield* Fx.acquireUseRelease(fs.makeTempDirectory(), (root) => Fx.gen(function* () { yield* Fx.sync(() => { process.cwd = () => root; }); return yield* use(root); }), (root) => Fx.sync(() => { process.cwd = originalCwd; }).pipe(Fx.andThen(fs.remove(root, { recursive: true }).pipe(Fx.orDie)))); }); it.effect("x", () => inTempCheckout(program));',
        'const withTempHome = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), (root) => Fx.sync(() => { process.env["HOME"] = root; }).pipe(Fx.andThen(use(root))), (root) => fs.remove(root)); it.effect("x", () => withTempHome(program));',
        'const restoreEnv = () => { process.env.HOME = savedHome; }; const withTempEnv = (use) => Fx.acquireUseRelease(fs.makeTempDirectory(), use, (root) => Fx.sync(restoreEnv).pipe(Fx.andThen(fs.remove(root)))); it.effect("x", () => withTempEnv(program));',
        'const withTempServer = (use) => Fx.acquireUseRelease(Fx.zip(fs.makeTempDirectory(), startServer), use, ([root]) => fs.remove(root)); it.effect("x", () => withTempServer(program));',
      ];
      for (const body of shareable) assertTrue(yield* hasRule(body, "EV003"));
    })
  );

  it.effect("permits with-named layer factories that hand their Layer to it.layer", () =>
    Effect.gen(function* () {
      const block = 'it.effect("x", () => program);';
      const factories = [
        `const withFake = (adapter) => L.unwrap(Fx.map(Fake, adapter)).pipe(L.provideMerge(L.sync(Fake, makeFake))); it.layer(L.fresh(withFake(mirror)))((it) => { ${block} });`,
        `const withFake = (adapter) => { return L.unwrap(Fx.map(Fake, adapter)); }; it.layer(withFake(mirror))((it) => { ${block} });`,
        `const withStore = (dataDir) => L.scoped(Store, openStore(dataDir)); it.layer(withStore("fixtures/a"))((it) => { ${block} });`,
        // A function expression owns its returns (#1855 wave 6): ts-morph's isFunctionLikeDeclaration skips it.
        `const withFake = function (adapter) { return L.unwrap(Fx.map(Fake, adapter)); }; it.layer(withFake(mirror))((it) => { ${block} });`,
      ];
      for (const body of factories) assertFalse(yield* hasRule(body, "EV003"));

      const wrappers = [
        'const withStore = (use) => use.pipe(Fx.provide(L.scoped(Store, openStore("a")))); it.effect("x", () => withStore(program));',
        'const withFake = (adapter) => L.build(L.unwrap(Fx.map(Fake, adapter))); it.effect("x", () => withFake(mirror));',
        'const withFake = (adapter) => L.unwrap(Fx.map(Fake, adapter)).pipe(Fx.provide(other)); it.effect("x", () => withFake(mirror));',
        'const withFake = (adapter, use) => { if (adapter) return L.unwrap(Fx.map(Fake, adapter)); return Fx.acquireUseRelease(open, use, close); }; it.effect("x", () => withFake(mirror, program));',
      ];
      for (const body of wrappers) assertTrue(yield* hasRule(body, "EV003"));
    })
  );

  it.effect("inspects Option, Result, and Exit values supplied as matcher arguments", () =>
    Effect.gen(function* () {
      assertTrue(yield* hasRule('it("o", () => expect(value).toEqual(O.none()));', "EV006"));
      assertTrue(yield* hasRule('it("r", () => expect(value).toEqual(R.succeed(1)));', "EV006"));
      assertTrue(yield* hasRule('it("e", () => expect(value).toEqual(X.fail(error)));', "EV006"));
    })
  );

  it.effect("reads truthiness matchers as the polarity of the asserted data shape", () =>
    Effect.gen(function* () {
      assertTrue(yield* hasRule('it("t", () => expect(O.isSome(value)).toBeTruthy());', "EV006"));
      assertTrue(yield* hasRule('it("f", () => expect(O.isNone(value)).toBeFalsy());', "EV006"));
    })
  );

  it.effect("keeps shorter scoped lifetimes as judgments", () =>
    Effect.gen(function* () {
      const finding = A.findFirst(
        yield* findings('it.effect("x", () => Fx.flatMap(Fx.scoped(shortLife), () => program));'),
        (candidate) => candidate.ruleId === "EV004"
      );
      assertTrue(O.isSome(finding), "Expected the resource-lifetime judgment to be present");
      assertTrue(finding.value.mechanization === "judgment");
      assertTrue(finding.value.class === "shorter-scope-lifetime-review");
    })
  );

  it.effect("keeps missing resource-layer timeouts as judgments", () =>
    Effect.gen(function* () {
      const finding = A.findFirst(
        yield* findings('it.layer(L.scoped(Service, acquire))("db", (it) => { it.effect("x", () => Fx.void); });'),
        (candidate) => candidate.ruleId === "EV014"
      );
      assertTrue(O.isSome(finding), "Expected the resource-lifetime judgment to be present");
      assertTrue(finding.value.mechanization === "judgment");
    })
  );

  it.effect("accepts Effect-valued live clock reads as live-mode justification", () =>
    Effect.gen(function* () {
      const clockImport = 'import * as Clock from "effect/Clock";';
      for (const body of [
        'it.live("millis", () => Fx.gen(function* () { yield* Clock.currentTimeMillis; }));',
        'it.live("nanos", Fx.fnUntraced(function* () { const now = yield* Clock.currentTimeNanos; }));',
      ])
        assertFalse(yield* hasRule(`${clockImport}\n${body}`, "EV009"));
      for (const body of [
        'it.live("lookalike", () => Fx.gen(function* () { yield* Fixtures.currentTimeMillis; }));',
        'it.live("shadow", () => Fx.gen(function* () { const Clock = fake; yield* Clock.currentTimeMillis; }));',
        'it.live("unrelated", () => Fx.gen(function* () { yield* Fx.sleep("1 millis"); }));',
      ])
        assertTrue(yield* hasRule(`${clockImport}\n${body}`, "EV009"));
      const namedRead = 'it.live("named", () => Fx.gen(function* () { yield* currentTimeMillis; }));';
      for (const named of [
        'import { currentTimeMillis } from "effect/Clock";',
        'import { currentTimeNanos as currentTimeMillis } from "effect/Clock";',
      ])
        assertFalse(yield* hasRule(`${named}\n${namedRead}`, "EV009"));
      for (const named of [
        'import { currentTimeMillis } from "./fixtures";',
        'import { currentTimeMillis } from "effect/Clock"; const shadow = () => { const currentTimeMillis = fake; return currentTimeMillis; };',
      ])
        assertTrue(
          yield* hasRule(
            `${named}\nit.live("named", () => Fx.gen(function* () { const currentTimeMillis = fake; yield* currentTimeMillis; }));`,
            "EV009"
          )
        );
      assertTrue(yield* hasRule(`import { currentTimeMillis } from "./fixtures";\n${namedRead}`, "EV009"));
    })
  );

  it.effect("emits deterministic distinct identities for same-line occurrences", () =>
    Effect.gen(function* () {
      const source = 'it("x", () => Fx.zip(Fx.runSync(left), Fx.runSync(right)));';
      const first = A.filter(yield* findings(source), (finding) => finding.ruleId === "EV001");
      const second = A.filter(yield* findings(source), (finding) => finding.ruleId === "EV001");
      assertTrue(first.length === 2);
      assertTrue(first[0]?.id !== first[1]?.id);
      assertTrue(
        A.join(
          A.map(first, (finding) => finding.id),
          "|"
        ) ===
          A.join(
            A.map(second, (finding) => finding.id),
            "|"
          )
      );
    })
  );

  it.effect("recognizes standalone public harness exports, aliases, modifiers and nested layer testers", () =>
    Effect.gen(function* () {
      const rows = yield* findingsWithHarness(
        'import { effect as check, live as real, layer as shared } from "@effect/vitest";',
        'check.skip.each([1])("effect", () => Fx.runSync(program)); real.only("live", Fx.fnUntraced(function* () { yield* Fx.void; })); shared(Resource, { timeout: "1 second" })("suite", (verify) => { verify.effect.each([1])("nested", () => Fx.sleep("1 second")); });'
      );
      assertTrue(A.filter(rows, (row) => row.ruleId === "EV001").length === 1);
      assertTrue(A.filter(rows, (row) => row.ruleId === "EV009").length === 1);
      assertTrue(A.filter(rows, (row) => row.ruleId === "EV008").length === 1);
      assertFalse(A.some(rows, (row) => row.ruleId === "EV014"));
      assertTrue(
        A.some(
          yield* findingsWithHarness(
            'import * as V from "@effect/vitest";',
            'V.layer(Resource)(verify => { verify.effect("x", () => Fx.runSync(program)); });'
          ),
          (row) => row.ruleId === "EV001"
        )
      );
    })
  );

  it.effect("does not promote shadowed standalone exports, layer testers or Vitest-only lookalikes", () =>
    Effect.gen(function* () {
      for (const [header, body] of [
        [
          'import { effect } from "@effect/vitest";',
          'const f = ({ effect }) => effect("x", () => Fx.runSync(program));',
        ],
        ['import { effect } from "vitest";', 'effect("x", () => Fx.runSync(program));'],
        [
          'import { layer } from "@effect/vitest";',
          'layer(Resource)(it => { { const it = other; it.effect("x", () => Fx.runSync(program)); } });',
        ],
        ['import * as V from "@effect/vitest";', 'const f = (V) => V.effect("x", () => Fx.runSync(program));'],
      ]) {
        assertFalse(A.some(yield* findingsWithHarness(header ?? "", body ?? ""), (row) => row.ruleId === "EV001"));
      }
    })
  );

  it.effect("captures public allocating providers in fnUntraced composition while retaining pure stubs", () =>
    Effect.gen(function* () {
      const header = 'import { provideScopedLayer as provide } from "@beep/test-utils";';
      const resource = yield* findings(
        `${header} const services = L.effect(Service, acquire); it.effect("x", Fx.fnUntraced(function* () { yield* Fx.void; }, provide(services)));`
      );
      assertTrue(A.some(resource, (row) => row.ruleId === "EV002" && row.mechanization === "detector"));
      assertFalse(
        yield* hasRule(
          `${header} it.effect("stub", Fx.fnUntraced(function* () { yield* Fx.void; }, provide(L.succeed(Service, {}))));`,
          "EV002"
        )
      );
      assertFalse(yield* hasRule(`${header} it.effect("shadow", (provide) => provide(services));`, "EV002"));
      assertTrue(
        yield* hasRule(
          'import * as Kit from "@beep/test-utils"; it.effect("unknown", () => program.pipe(Kit.provideScopedLayer(ImportedLive)));',
          "EV002"
        )
      );
    })
  );

  it.effect("captures same-file layer-building wrappers without requiring a with prefix", () =>
    Effect.gen(function* () {
      const helper =
        "const supply = (layer) => (effect) => Fx.scoped(L.build(layer).pipe(Fx.flatMap(context => effect.pipe(Fx.provide(context)))));";
      const rows = yield* findings(
        `${helper} it.effect("x", Fx.fnUntraced(function* () { yield* Fx.void; }, supply(L.effect(Service, acquire))));`
      );
      assertTrue(A.some(rows, (row) => row.ruleId === "EV002" && row.mechanization === "detector"));
      assertTrue(A.some(rows, (row) => row.ruleId === "EV003" && O.contains(row.symbol, "supply")));
      assertFalse(yield* hasRule(`${helper} it.effect("x", (supply) => supply(Resource));`, "EV002"));
    })
  );

  it.effect("keeps fixed-layer fixtures under resource review without treating their data arguments as layers", () =>
    Effect.gen(function* () {
      const rows = yield* findings(
        'const callTool = Fx.fn(function* (grant, input) { const context = yield* L.build(HandlersLive); return yield* handle(input).pipe(Fx.provide(context)); }); it.effect("send", () => callTool("grant-a", { body: "private" }));'
      );
      assertFalse(A.some(rows, (row) => row.ruleId === "EV002"));
      assertTrue(A.some(rows, (row) => row.ruleId === "EV003"));
      assertTrue(
        yield* hasRule(
          'const supply = (layer, effect) => L.build(layer).pipe(Fx.flatMap(context => effect.pipe(Fx.provide(context)))); it.effect("resource", () => supply(L.effect(Service, acquire), program));',
          "EV002"
        )
      );
    })
  );

  it.effect("judges imported and unknown layer constructors but permits proven pure compositions", () =>
    Effect.gen(function* () {
      for (const layer of ["ImportedLive", "NodeServices.layer", "mockLayer()"])
        assertTrue(
          A.some(
            yield* findings(`it.layer(${layer})("x", it => {});`),
            (row) => row.ruleId === "EV014" && row.mechanization === "judgment"
          )
        );
      assertFalse(
        yield* hasRule(
          'const stub = L.mergeAll(L.succeed(A, {}), L.mock(B, {})); it.layer(stub)("x", it => {});',
          "EV014"
        )
      );
      for (const pure of [
        // #1855 wave 6: unwrapping a stub layer acquires nothing.
        'it.layer(L.unwrap(Fx.succeed(L.succeed(Service, {}))))("x", it => {});',
        'it.layer(L.empty)("x", it => {});',
        'it.layer(L.empty, { excludeTestServices: true })("x", it => {});',
        'const stub = L.mergeAll(L.empty, L.succeed(A, {})); it.layer(stub)("x", it => {});',
        'import { empty } from "effect/Layer"; it.layer(empty)("x", it => {});',
      ])
        assertFalse(yield* hasRule(pure, "EV014"));
      for (const lookalike of [
        'it.layer(Fixtures.empty)("x", it => {});',
        'const f = (L) => it.layer(L.empty)("x", it => {});',
        'it.layer(L.mergeAll(L.empty, ImportedLive))("x", it => {});',
      ])
        assertTrue(
          A.some(yield* findings(lookalike), (row) => row.ruleId === "EV014" && row.mechanization === "judgment")
        );
      assertFalse(
        yield* hasRule(
          'import { layer as shared } from "@effect/vitest"; shared(ImportedLive, { timeout: "2 seconds" })("x", it => {});',
          "EV014"
        )
      );
      assertTrue(
        yield* hasRule('it.layer(ImportedLive)("x", it => { const timeout = { timeout: "2 seconds" }; });', "EV014")
      );
    })
  );

  it.effect("permits platform service layers without a hook timeout and keeps resource layers judged", () =>
    Effect.gen(function* () {
      for (const body of [
        'import * as NodeServices from "@effect/platform-node/NodeServices"; it.layer(NodeServices.layer)("x", it => {});',
        'import * as NodeServices from "@effect/platform-node/NodeServices"; it.layer(NodeServices.layer, { excludeTestServices: true })("x", it => {});',
        'import { layer } from "@effect/vitest"; import * as NodeServices from "@effect/platform-node/NodeServices"; layer(NodeServices.layer)("x", it => {});',
        'import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"; it.layer(BunFileSystem.layer)("x", it => {});',
        'import * as BunServices from "@effect/platform-bun/BunServices"; it.layer(BunServices.layer)("x", it => {});',
        'import * as BunCrypto from "@effect/platform-bun/BunCrypto"; it.layer(BunCrypto.layer)("x", it => {});',
        'import { NodeCrypto, NodeFileSystem, NodePath } from "@effect/platform-node"; it.layer(L.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer))("x", it => {});',
        'import * as Platform from "@effect/platform-node"; it.layer(Platform.NodeServices.layer)("x", it => {});',
        'import * as NodeServices from "@effect/platform-node/NodeServices"; const platform = NodeServices.layer; it.layer(platform)("x", it => {});',
        'import * as BunPath from "@effect/platform-bun/BunPath"; it.layer(L.merge(BunPath.layer, L.succeed(A, {})))("x", it => {});',
      ])
        assertFalse(yield* hasRule(body, "EV014"));
      for (const body of [
        'it.layer(L.scoped(Service, acquire))("x", it => {});',
        'it.layer(NodeServices.layer)("x", it => {});',
        'import * as NodeServices from "@beep/fake/NodeServices"; it.layer(NodeServices.layer)("x", it => {});',
        'import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"; it.layer(NodeHttpServer.layer)("x", it => {});',
        'import * as NodeServices from "@effect/platform-node/NodeServices"; it.layer(L.mergeAll(NodeServices.layer, ImportedLive))("x", it => {});',
        'import * as NodeServices from "@effect/platform-node/NodeServices"; it.layer(L.provide(ImportedLive, NodeServices.layer))("x", it => {});',
        'import * as NodeServices from "@effect/platform-node/NodeServices"; it.layer(NodeServices.other)("x", it => {});',
        'import * as NodeServices from "@effect/platform-node/NodeServices"; const f = (NodeServices) => it.layer(NodeServices.layer)("x", it => {});',
      ])
        assertTrue(A.some(yield* findings(body), (row) => row.ruleId === "EV014" && row.mechanization === "judgment"));
    })
  );

  it.effect("resolves imported test layers across files and classifies them like same-file layers", () =>
    Effect.gen(function* () {
      const block = '("x", (it) => { it.effect("y", () => Fx.void); });';
      const layers = [
        "/repo/test/layers.ts",
        A.join(
          [
            "export const StubLive = L.succeed(Service, {});",
            "export const PromiseLive = L.effect(Service, Fx.promise(() => open()));",
            "export const makeStub = (value) => L.succeed(Service, value);",
            "export class Runner { static readonly makeLayerFromRunner = (runner) => L.succeed(Service, runner); static layer(value) { return L.sync(Service, () => value); } }",
          ],
          "\n"
        ),
      ] as const;
      const barrel = [
        "/repo/src/index.ts",
        'export * from "./impl.ts";\nexport { ImplLive as RenamedLive } from "./impl.ts";\nexport * as Impl from "./impl.ts";',
      ] as const;
      const impl = [
        "/repo/src/impl.ts",
        "export const ImplLive = L.mergeAll(L.succeed(A, {}), L.mock(B, {}));",
      ] as const;
      const files = [layers, barrel, impl];

      for (const body of [
        `import { StubLive } from "./layers.ts"; it.layer(StubLive)${block}`,
        `import * as Layers from "./layers.ts"; it.layer(L.fresh(Layers.StubLive))${block}`,
        `import { makeStub } from "./layers.ts"; it.layer(makeStub(1))${block}`,
        `import { Runner } from "./layers.ts"; it.layer(Runner.makeLayerFromRunner(run))${block}`,
        `import { Runner } from "./layers.ts"; it.layer(Runner.layer(1))${block}`,
        `import { ImplLive } from "../src/index.ts"; it.layer(ImplLive)${block}`,
        `import { RenamedLive } from "../src/index.ts"; it.layer(RenamedLive)${block}`,
        `import { Impl } from "../src/index.ts"; it.layer(Impl.ImplLive)${block}`,
        `import { StubLive } from "./layers.ts"; const Local = StubLive.pipe(L.provideMerge(L.sync(B, () => []))); it.layer(Local)${block}`,
      ])
        assertFalse(yield* hasRuleAcrossFiles(files, body, "EV014"), body);

      for (const body of [
        `import { PromiseLive } from "./layers.ts"; it.layer(PromiseLive)${block}`,
        `import * as Layers from "./layers.ts"; it.layer(L.merge(Layers.StubLive, Layers.PromiseLive))${block}`,
        `import { StubLive } from "./missing.ts"; it.layer(StubLive)${block}`,
        `import { Absent } from "./layers.ts"; it.layer(Absent)${block}`,
        `import type { StubLive } from "./layers.ts"; it.layer(StubLive)${block}`,
        `import { Runner } from "./layers.ts"; it.layer(Runner.missing(1))${block}`,
      ])
        assertTrue(yield* hasRuleAcrossFiles(files, body, "EV014"), body);

      // Re-export cycles terminate and stay unresolved.
      const cycle = [
        ["/repo/test/a.ts", 'export { Loop } from "./b.ts";'],
        ["/repo/test/b.ts", 'export { Loop } from "./a.ts";'],
      ] as const;
      assertTrue(yield* hasRuleAcrossFiles(cycle, `import { Loop } from "./a.ts"; it.layer(Loop)${block}`, "EV014"));
    })
  );

  it.effect("binds factory parameters to call arguments when classifying test layers", () =>
    Effect.gen(function* () {
      const block = '("x", (it) => { it.effect("y", () => Fx.void); });';
      const helper =
        "const withDb = (db) => L.mergeAll(L.succeed(A, {}), db); const testLayer = (respond) => L.succeed(Http, make(respond));";
      for (const body of [
        `${helper} it.layer(testLayer(stub(() => Fx.succeed(1))))${block}`,
        `${helper} it.layer(withDb(L.succeed(Db, {})))${block}`,
        `const withDefault = (db = L.succeed(Db, {})) => db; it.layer(withDefault())${block}`,
        `const first = (db, ...rest) => db; it.layer(first(L.succeed(Db, {}), ...extra))${block}`,
      ])
        assertFalse(yield* hasRule(body, "EV014"), body);
      for (const body of [
        `${helper} it.layer(withDb(L.effect(Db, Fx.promise(() => open()))))${block}`,
        `${helper} it.layer(withDb(ImportedLive))${block}`,
        `const withDb = (...layers) => L.mergeAll(...layers); it.layer(withDb(L.succeed(Db, {})))${block}`,
        `const withDefault = (db = L.effect(Db, Fx.promise(() => open()))) => db; it.layer(withDefault())${block}`,
        // A spread argument shifts every later parameter: `pick(...pair, pure)` binds `db` to `pair[1]`.
        `const pair = [L.succeed(A, {}), L.effect(Db, Fx.promise(() => open()))]; const pick = (a, db) => db; it.layer(pick(...pair, L.succeed(Db, {})))${block}`,
        `const pair = [L.succeed(A, {}), L.effect(Db, Fx.promise(() => open()))]; const pick = (a, db = L.succeed(Db, {})) => db; it.layer(pick(...pair))${block}`,
      ])
        assertTrue(yield* hasRule(body, "EV014"), body);
    })
  );

  it.effect("permits hermetic in-memory acquisitions under it.layer and keeps real acquisitions judged", () =>
    Effect.gen(function* () {
      const block = '("x", (it) => { it.effect("y", () => Fx.void); });';
      const services =
        'import * as Ref from "effect/Ref"; import * as Deferred from "effect/Deferred"; class Recorder extends Context.Service<Recorder, Array<string>>()("Recorder") {}';
      for (const body of [
        `it.layer(L.effect(Store, Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; const ref = yield* Ref.make(0); return { fs, ref }; })))${block}`,
        `it.layer(L.effect(Started, Deferred.make()))${block}`,
        `it.layer(L.effect(Store)(Fx.map(Recorder, (calls) => ({ calls }))))${block}`,
        `it.layer(L.unwrap(Fx.map(Recorder, (calls) => L.succeed(Svc, calls))).pipe(L.provideMerge(L.sync(Recorder, () => []))))${block}`,
        `it.layer(L.unwrap(Fx.gen(function* () { const calls = yield* Recorder; return L.succeed(Svc, calls); })))${block}`,
        `const makeStore = Fx.fn("makeStore")(function* (seed) { return yield* Ref.make(seed); }); it.layer(L.effect(Store, makeStore(0)))${block}`,
        `const makeStore = Fx.gen(function* () { const calls = yield* Recorder; return { calls }; }); const StoreLive = L.effect(Store, makeStore); it.layer(StoreLive)${block}`,
        `it.layer(L.effect(Probe, Fx.acquireRelease(Fx.succeed(1), () => Fx.sync(() => released++))))${block}`,
        `it.layer(L.suspend(() => L.succeed(Svc, {})))${block}`,
      ])
        assertFalse(yield* hasRule(`${services}\n${body}`, "EV014"), body);
      for (const body of [
        `it.layer(L.effect(Store, Fx.gen(function* () { yield* Fx.promise(() => open()); })))${block}`,
        `it.layer(L.effect(Store, Fx.gen(function* () { yield* Fx.sleep("1 second"); })))${block}`,
        `it.layer(L.effect(Engine, Fx.gen(function* () { return yield* Fx.try({ try: loadModel, catch: toError }); })))${block}`,
        `it.layer(L.effect(Store, Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; return yield* fs.makeTempDirectory(); })))${block}`,
        `it.layer(L.effect(Store, Fx.gen(function* () { yield fs; })))${block}`,
        `it.layer(L.effect(Started, Deferred.make().pipe(Fx.flatMap((started) => Deferred.await(started)))))${block}`,
        `it.layer(L.unwrap(Fx.map(Recorder, () => L.effect(Db, Fx.promise(() => open())))))${block}`,
        `it.layer(L.unwrap(Fx.promise(() => import("./layer.ts"))))${block}`,
        `it.layer(L.effect(Store, Fx.gen(function* () { return yield* Fx.gen(function* () { yield* Fx.promise(() => open()); }); })))${block}`,
        `it.layer(L.effect(Probe, Fx.acquireRelease(Fx.promise(() => open()), () => Fx.void)))${block}`,
      ])
        assertTrue(yield* hasRule(`${services}\n${body}`, "EV014"), body);
    })
  );

  it.effect("follows aliases, dual implementations, this-bound statics and local re-exports", () =>
    Effect.gen(function* () {
      const block = '("x", (it) => { it.effect("y", () => Fx.void); });';
      const files = [
        [
          "/repo/test/stores.ts",
          A.join(
            [
              'import { dual } from "effect/Function";',
              "const LocalLive = L.succeed(A, {});",
              "export { LocalLive as ExportedLive };",
              'const makeInMemory = Fx.fn("makeInMemory")(function* () { return yield* Fx.void; });',
              "export const makeStore = makeInMemory;",
              "export const openStore = dual(2, (self, options) => L.succeed(Store, { self, options }));",
              "export function makeLive() { return L.succeed(A, {}); }",
              "export class Store { static readonly make = Fx.succeed({}); static readonly layer = L.effect(Store, this.make); }",
              "export declare function declaredLive(): unknown;",
              "export const { DestructuredLive } = { DestructuredLive: L.succeed(A, {}) };",
              "export type { TypeOnlyLive } from './types.ts';",
            ],
            "\n"
          ),
        ],
        ["/repo/test/barrel.ts", 'export type * from "./stores.ts";\nexport * from "./stores.ts";'],
        ["/repo/test/decl.d.ts", "export declare const DeclLive: unknown;"],
        ["/repo/node_modules/installed/package.json", '{ "name": "installed", "exports": "./index.ts" }'],
        ["/repo/node_modules/installed/index.ts", "export const InstalledLive = L.succeed(A, {});"],
      ] as const;
      for (const body of [
        `import { ExportedLive } from "./stores.ts"; it.layer(ExportedLive)${block}`,
        `import { makeStore } from "./barrel.ts"; it.layer(L.effect(Store, makeStore()))${block}`,
        `import { openStore } from "./stores.ts"; it.layer(openStore(1, {}))${block}`,
        `import { makeLive } from "./stores.ts"; it.layer(makeLive())${block}`,
        `import { Store } from "./stores.ts"; it.layer(Store.layer)${block}`,
        `it.layer(L.provide(L.succeed(A, {}), [L.succeed(B, {}), L.mock(C, {})]))${block}`,
      ])
        assertFalse(yield* hasRuleAcrossFiles(files, body, "EV014"), body);
      for (const body of [
        `import { declaredLive } from "./stores.ts"; it.layer(declaredLive())${block}`,
        `import { DestructuredLive } from "./stores.ts"; it.layer(DestructuredLive)${block}`,
        `import { TypeOnlyLive } from "./stores.ts"; it.layer(TypeOnlyLive)${block}`,
        `import { DeclLive } from "./decl"; it.layer(DeclLive)${block}`,
        `import { InstalledLive } from "installed"; it.layer(InstalledLive)${block}`,
        `import Default from "./stores.ts"; it.layer(Default)${block}`,
        `const loop = other; const other = loop; it.layer(loop)${block}`,
        `const loop = () => loop(); it.layer(loop())${block}`,
        `const makeStore = 1; it.layer(L.effect(Store, makeStore()))${block}`,
        `const makeStore = Fx.fn(name)(function* () { return yield* Fx.void; }); it.layer(L.effect(Store, makeStore()))${block}`,
        `const makeStore = Fx.fnUntraced(function* () { return yield* Fx.void; }, Fx.orDie); it.layer(L.effect(Store, makeStore()))${block}`,
        `it.layer(L.effect(Store))${block}`,
        `it.layer(L.unwrap())${block}`,
        `it.layer(L.suspend(lazyLayer))${block}`,
        `it.layer(L.succeed(A, {}).pipe(L.provide(L.effect(B, Fx.promise(() => open())))))${block}`,
        `it.layer(L.succeed(A, {}).pipe(L.orDie))${block}`,
        `it.layer(L.merge(L.succeed(A, {}))(L.succeed(B, {})))${block}`,
      ])
        assertTrue(yield* hasRuleAcrossFiles(files, body, "EV014"), body);
    })
  );

  it.effect("judges hermetic effect combinators by every effect they run during acquisition", () =>
    Effect.gen(function* () {
      const block = '("x", (it) => { it.effect("y", () => Fx.void); });';
      const services =
        'import * as Ref from "effect/Ref"; import * as Scope from "effect/Scope"; import * as Clock from "effect/Clock"; import * as DateTime from "effect/DateTime"; import * as FileSystem from "effect/FileSystem"; class Recorder extends Context.Service<Recorder, Array<string>>()("Recorder") {} const Seed = Context.Reference("Seed", { defaultValue: () => 0 });';
      const acquire = (effect: string) => `${services}\nit.layer(L.effect(Store, ${effect}))${block}`;
      for (const effect of [
        "Fx.gen(function* () { yield* Fx.void; const scope = yield* Fx.scope; yield* Scope.addFinalizer(scope, Fx.void); yield* Fx.addFinalizer(() => Fx.void); return yield* Clock.currentTimeMillis; })",
        "Fx.gen(function* () { const now = yield* DateTime.now; const fs = yield* FileSystem.FileSystem; const seed = yield* Seed; return { now, fs, seed }; })",
        "Fx.flatMap(Ref.make(0), (ref) => Ref.get(ref))",
        "Ref.make(0).pipe(Fx.flatMap((ref) => Ref.update(ref, (n) => n + 1)), Fx.map(() => ({})), Fx.asVoid)",
        "Fx.as(Recorder, {})",
        'Fx.serviceOption(Recorder).pipe(Fx.withSpan("acquire"))',
      ])
        assertFalse(yield* hasRule(acquire(effect), "EV014"), effect);
      for (const effect of [
        "Fx.flatMap(Ref.make(0), (ref) => Fx.promise(() => persist(ref)))",
        "Fx.flatMap(Ref.make(0))",
        "Fx.map((value) => value)",
        "Ref.make(0).pipe(Fx.flatMap((ref) => Fx.promise(() => persist(ref))))",
        'Ref.make(0).pipe(Fx.timeout("1 second"))',
        "Ref.make(0).pipe(Fx.retry)",
        "Fx.addFinalizer(() => Fx.promise(() => close()))",
        "Fx.gen(function* () { const scope = yield* Fx.scope; yield* Scope.addFinalizer(scope); })",
        "Fx.acquireRelease(Fx.succeed(1))",
        "Fx.gen(function* () { yield* Fixtures.Fixtures; })",
        "Fx.gen(function* () { yield* Plain; }); class Plain extends Base {}",
        "Fx.gen(function* () { yield* notAKey; }); const notAKey = makeKey();",
        "Fx.gen({ self: this })",
      ])
        assertTrue(yield* hasRule(acquire(effect), "EV014"), effect);

      const unwrap = (effect: string) => `${services}\nit.layer(L.unwrap(${effect}))${block}`;
      for (const effect of [
        "Fx.sync(() => L.succeed(A, {}))",
        "Fx.succeed(L.succeed(A, {}))",
        "freeLayerEffect); const freeLayerEffect = Fx.succeed(L.succeed(A, {})",
      ])
        assertFalse(yield* hasRule(unwrap(effect), "EV014"), effect);
      for (const effect of [
        "Fx.sync(() => L.effect(A, Fx.promise(() => open())))",
        "Fx.map(Fx.promise(() => open()), () => L.succeed(A, {}))",
        "Fx.map(Recorder)",
        "Fx.gen(function* () { yield* Recorder; })",
        "Fx.gen(function* () { yield* Fx.promise(() => open()); return L.succeed(A, {}); })",
        "Fx.succeed()",
      ])
        assertTrue(yield* hasRule(unwrap(effect), "EV014"), effect);
    })
  );

  it.effect("judges thunks and non-yielded generator calls by what their bodies run", () =>
    Effect.gen(function* () {
      const block = '("x", (it) => { it.effect("y", () => Fx.void); });';
      const services = A.join(
        [
          'import * as Ref from "effect/Ref";',
          'import * as Arr from "effect/Array";',
          'class Recorder extends Context.Service<Recorder, Array<string>>()("Recorder") {}',
          'class Engine extends Context.Service<Engine, { readonly calls: number }>()("Engine") {}',
          "const makeCounter = (count) => ({ count, label: String(count) });",
          "const loadFromDisk = () => readModelFile();",
          'const makeOp = Fx.fn("makeOp")(function* (n) { return yield* Ref.make(n); });',
        ],
        "\n"
      );
      const layer = (effect: string) => `${services}\nit.layer(L.effect(Engine, ${effect}))${block}`;
      for (const effect of [
        "Fx.sync(() => ({ count: 0 }))",
        "Fx.sync(() => makeCounter(1))",
        "Fx.sync(() => JSON.parse(JSON.stringify({ calls: 0 })))",
        "Fx.suspend(() => Fx.succeed({ calls: 0 }))",
        "Fx.promise(() => Promise.resolve({ calls: 0 }))",
        'Fx.try({ try: () => JSON.parse("{}"), catch: (cause) => cause })',
        "Fx.gen(function* () { const calls = yield* Recorder; const counter = makeCounter(calls.length); const op = makeOp(1); return Engine.of({ calls: counter.count, op }); })",
        "Fx.gen(function* () { const calls = yield* Recorder; const sizes = Arr.map(calls, (call) => call.length); return { calls: sizes.length }; })",
        "Fx.map(Recorder, (calls) => ({ calls: calls.length }))",
        "Fx.gen(function* () { return { calls: 0, run: () => readModelFile() }; })",
      ])
        assertFalse(yield* hasRule(layer(effect), "EV014"), effect);
      for (const effect of [
        "Fx.sync(loadModel)",
        "Fx.sync(loadFromDisk)",
        "Fx.sync(() => loadModel())",
        "Fx.suspend(() => { loadModel(); return Fx.void; })",
        "Fx.promise(() => fetch(url))",
        "Fx.try({ try: loadModel, catch: (cause) => cause })",
        "Fx.gen(function* () { const model = loadModel(); return { model }; })",
        "Fx.gen(function* () { loadFromDisk(); return { calls: 0 }; })",
        "Fx.gen(function* () { return yield* Ref.make(loadModel()); })",
        "Fx.gen(function* () { const calls = yield* Recorder; const models = Arr.map(calls, (call) => loadModel(call)); return { models }; })",
        "Fx.gen(function* () { const value = Fx.runSync(open); return { value }; })",
        "Fx.gen(function* () { const client = new Client(); return { client }; })",
        "Fx.map(Recorder, (calls) => loadModel(calls))",
        "Fx.map(Recorder, loadModel)",
        "Ref.make(0).pipe(Fx.map((ref) => loadModel(ref)))",
        "Fx.flatMap(Ref.make(0), (ref) => { loadModel(ref); return Fx.void; })",
      ])
        assertTrue(yield* hasRule(layer(effect), "EV014"), effect);

      assertFalse(yield* hasRule(`${services}\nit.layer(L.sync(Recorder, () => []))${block}`, "EV014"));
      assertTrue(yield* hasRule(`${services}\nit.layer(L.sync(Recorder, loadModel))${block}`, "EV014"));
      assertTrue(
        yield* hasRule(`${services}\nit.layer(L.suspend(() => { loadModel(); return L.empty; }))${block}`, "EV014")
      );
      assertTrue(
        yield* hasRule(
          `${services}\nit.layer(L.unwrap(Fx.sync(() => { loadModel(); return L.empty; })))${block}`,
          "EV014"
        )
      );
    })
  );

  it.effect("follows constructors, callables and curried calls inside acquisition bodies", () =>
    Effect.gen(function* () {
      const block = '("x", (it) => { it.effect("y", () => Fx.void); });';
      const services = A.join(
        [
          'import * as Ref from "effect/Ref";',
          'import * as Arr from "effect/Array";',
          'import * as Sch from "effect/Schema";',
          'import * as Toolkit from "effect/ai/Toolkit";',
          'class Recorder extends Context.Service<Recorder, Array<string>>()("Recorder") {}',
          'class Engine extends Context.Service<Engine, { readonly calls: number }>()("Engine") {}',
          'class Settings extends Sch.Class<Settings>("Settings")({ calls: Sch.Number }) {}',
          "class Plain { static make() { return loadModel(); } }",
          "const Kit = Toolkit.make();",
          'const makeOp = Fx.fn("makeOp")(function* (n) { return yield* Ref.make(n); });',
          "const curry = () => () => loadModel();",
          'const parse = () => JSON.parse("{}");',
        ],
        "\n"
      );
      const layer = (effect: string) => `${services}\nit.layer(L.effect(Engine, ${effect}))${block}`;
      for (const effect of [
        "Fx.gen(function* () { const settings = Settings.make({ calls: 1 }); return Engine.of({ calls: settings.calls }); })",
        "Fx.gen(function* () { const handlers = Kit.of({}); const index = new Map(); return { handlers, index }; })",
        'Fx.try({ try() { return JSON.parse("{}"); }, catch: (cause) => cause })',
        "Fx.try({ try: parse, catch: (cause) => cause })",
        "Fx.tryPromise({ try: () => Promise.resolve(1), catch: (cause) => cause })",
        "Fx.sync(Arr.empty)",
        "Fx.sync(makeOp)",
        "Fx.map(Recorder, Engine.of)",
        "Fx.map(Recorder, Arr.length)",
      ])
        assertFalse(yield* hasRule(layer(effect), "EV014"), effect);
      for (const effect of [
        "Fx.gen(function* () { const model = Plain.make(); return { model }; })",
        "Fx.gen(function* () { const model = curry()(); return { model }; })",
        "Fx.gen(function* () { const pending = new Promise((resolve) => resolve(loadModel())); return { pending }; })",
        "Fx.gen(function* () { const index = new Map(Arr.map(names, (name) => [name, loadModel(name)])); return { index }; })",
        "Fx.try({ catch: (cause) => cause })",
        "Fx.tryPromise({ try: () => fetch(url), catch: (cause) => cause })",
        "Fx.sync(Fx.runSync)",
        "Fx.sync(() => fetch(url))",
        "Fx.map(Recorder, Plain.make)",
      ])
        assertTrue(yield* hasRule(layer(effect), "EV014"), effect);
    })
  );

  it.effect("names the Effect library layers that build in memory", () =>
    Effect.gen(function* () {
      const block = '("x", (it) => { it.effect("y", () => Fx.void); });';
      for (const body of [
        `it.layer(TC.layer())${block}`,
        `import * as Path from "effect/Path"; it.layer(Path.layer)${block}`,
        `import * as AtomRegistry from "effect/reactivity/AtomRegistry"; it.layer(L.fresh(AtomRegistry.layer))${block}`,
        `import * as AtomRegistry from "effect/reactivity/AtomRegistry"; it.layer(AtomRegistry.layerOptions({ initialValues: [] }))${block}`,
        `import * as FetchHttpClient from "effect/http/FetchHttpClient"; it.layer(FetchHttpClient.layer)${block}`,
        `import * as ConfigProvider from "effect/ConfigProvider"; it.layer(ConfigProvider.layer(ConfigProvider.fromUnknown({ CI: false })))${block}`,
        `import * as Logger from "effect/Logger"; it.layer(Logger.layer([Logger.make(() => undefined)]))${block}`,
        `import * as Toolkit from "effect/ai/Toolkit"; const Kit = Toolkit.make(); it.layer(Kit.toLayer({ lookup: () => Fx.void }))${block}`,
        `import * as Toolkit from "effect/ai/Toolkit"; class Engine extends Context.Service<Engine, {}>()("Engine") {} const Kit = Toolkit.make(); it.layer(Kit.toLayer(Fx.gen(function* () { const engine = yield* Engine; return { lookup: () => Fx.succeed(engine) }; })))${block}`,
        `import * as LanguageModel from "effect/ai/LanguageModel"; it.layer(L.effect(LanguageModel.LanguageModel, LanguageModel.make({ generateText: () => Fx.succeed([]) })))${block}`,
      ])
        assertFalse(yield* hasRule(body, "EV014"), body);
      for (const body of [
        `import * as Path from "@beep/fake/Path"; it.layer(Path.layer)${block}`,
        `import * as ConfigProvider from "effect/ConfigProvider"; it.layer(ConfigProvider.layer(loadProvider))${block}`,
        `import * as Logger from "effect/Logger"; it.layer(Logger.layer([fileLogger]))${block}`,
        `const Kit = makeKit(); it.layer(Kit.toLayer({ lookup: () => Fx.void }))${block}`,
        `import * as Toolkit from "effect/ai/Toolkit"; const Kit = Toolkit.make(); it.layer(Kit.toLayer(Fx.promise(() => loadHandlers())))${block}`,
        `import * as McpServer from "effect/ai/McpServer"; it.layer(McpServer.McpServer.layer)${block}`,
      ])
        assertTrue(yield* hasRule(body, "EV014"), body);
    })
  );

  it.effect("limits withLive exemption to the wrapped wait", () =>
    Effect.gen(function* () {
      assertFalse(yield* hasRule('it.effect("live", () => TC.withLive(Fx.sleep("1 second")));', "EV008"));
      assertFalse(
        yield* hasRule(
          'it.effect("live", () => Fx.gen(function* () { yield* Fx.sleep("1 second"); }).pipe(TC.withLive));',
          "EV008"
        )
      );
      assertTrue(
        yield* hasRule(
          'it.effect("stall", Fx.fnUntraced(function* () { yield* TC.withLive(Fx.succeed(1)); yield* Fx.sleep("1 second"); }));',
          "EV008"
        )
      );
      const sequential = yield* findings(
        'it.effect("stall", Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); yield* TC.adjust("1 second"); }));'
      );
      assertTrue(A.some(sequential, (row) => row.ruleId === "EV008" && row.mechanization === "detector"));
      assertFalse(yield* hasRule('it.effect("count", () => Fx.succeed(1).pipe(Fx.repeat(S.recurs(3))));', "EV008"));
    })
  );

  it.effect("permits waits a forked fiber holds while a later same-body clock operation drives it", () =>
    Effect.gen(function* () {
      const test = (body: string) =>
        `import { Fiber } from "effect"; it.effect("controlled", Fx.fnUntraced(function* () { ${body} }));`;
      const controlled = [
        'const fiber = yield* Fx.forkChild(Fx.sleep("1 minute")); yield* TC.adjust("1 minute"); yield* Fiber.join(fiber);',
        'const fiber = yield* Fx.forkChild(Fx.sleep("1 second")); yield* TC.setTime(1_000);',
        'const fiber = yield* transaction(() => Fx.sleep("1 hour")).pipe(Fx.forkChild({ startImmediately: true })); yield* Fiber.interrupt(fiber);',
        'const slowFs = { ...fs, read: (file) => Fx.sleep("3 seconds").pipe(Fx.andThen(fs.read(file))) }; const service = yield* makeService().pipe(Fx.provideService(FileSystem.FileSystem, slowFs)); const fiber = yield* Fx.forkChild(service.detect(root)); yield* TC.adjust("2 seconds"); yield* Fiber.join(fiber);',
      ];
      for (const body of controlled) assertFalse(yield* hasRule(test(body), "EV008"));

      const uncontrolled = [
        'const fiber = yield* Fx.forkChild(Fx.sleep("1 second")); yield* Fiber.join(fiber);',
        'yield* TC.adjust("1 second"); const fiber = yield* Fx.forkChild(Fx.sleep("1 second")); yield* Fiber.join(fiber);',
        'const slow = { read: () => Fx.sleep("3 seconds") }; yield* slow.read(); yield* TC.adjust("3 seconds");',
        'const slow = { read: () => Fx.sleep("3 seconds") }; const fiber = yield* Fx.forkChild(other()); yield* TC.adjust("3 seconds"); yield* slow.read();',
        'const slow = { read: () => Fx.sleep("3 seconds") }; yield* TC.adjust("3 seconds"); const fiber = yield* Fx.forkChild(slow.read()); yield* Fiber.join(fiber);',
        'const slow = { read: () => Fx.sleep("3 seconds") }; const fiber = yield* Fx.forkChild(slow.read()); yield* slow.read(); yield* TC.adjust("3 seconds"); yield* Fiber.join(fiber);',
        'const slow = { read: () => Fx.sleep("3 seconds") }; const fiber = yield* Fx.forkChild(slow.read()); const direct = yield* slow.read(); yield* TC.adjust("3 seconds"); yield* Fiber.join(fiber);',
      ];
      for (const body of uncontrolled) assertTrue(yield* hasRule(test(body), "EV008"));
    })
  );

  it.effect("treats waits in excludeTestServices layer blocks as live-clock waits", () =>
    Effect.gen(function* () {
      const poll = 'it.effect("poll", () => Fx.sleep("10 millis"));';
      const until =
        'const until = (probe) => probe.pipe(Fx.repeat({ schedule: S.spaced("5 millis"), until: (ready) => ready }));';
      const live = [
        `it.layer(services, { excludeTestServices: true })((it) => { ${poll} });`,
        `it.layer(services, { excludeTestServices: true, timeout: "5 seconds" })("live suite", (it) => { ${poll} });`,
        `it.layer(services, { excludeTestServices: true })((it) => { it.layer(other)((it) => { ${poll} }); });`,
        `${until} it.layer(services, { excludeTestServices: true })((it) => { it.effect("poll", () => until(probe)); });`,
        `const base = services; const twice = L.mergeAll(base, base); it.layer(twice, { excludeTestServices: true })((it) => { ${poll} });`,
        `const left = L.mergeAll(services, right); const right = L.mergeAll(other, left); it.layer(left, { excludeTestServices: true })((it) => { ${poll} });`,
      ];
      for (const body of live) assertFalse(yield* hasRule(body, "EV008"));

      const testClock = [
        `it.layer(services)((it) => { ${poll} });`,
        `it.layer(services, { excludeTestServices: false })((it) => { ${poll} });`,
        `it.layer(services, { excludeTestServices: liveClock })((it) => { ${poll} });`,
        `it.layer(services, { timeout: "5 seconds" })((it) => { ${poll} });`,
        `it.layer(services, { excludeTestServices: true })((it) => { it.effect("outer", () => Fx.void); }); ${poll}`,
        `${until} it.layer(services)((it) => { it.effect("poll", () => until(probe)); });`,
        `it.layer(L.mergeAll(services, TC.layer()), { excludeTestServices: true })((it) => { ${poll} });`,
        `const clocked = L.mergeAll(services, TC.layer()); it.layer(clocked, { excludeTestServices: true })((it) => { ${poll} });`,
        `const clocked = L.mergeAll(services, TC.layer()); const twice = L.mergeAll(clocked, clocked); it.layer(twice, { excludeTestServices: true })((it) => { ${poll} });`,
        `it.layer(services, { excludeTestServices: true })((it) => { it.layer(TC.layer())((it) => { ${poll} }); });`,
        `const clocked = L.mergeAll(other, TC.layer()); it.layer(services, { excludeTestServices: true })((it) => { it.layer(clocked)((it) => { it.layer(more)((it) => { ${poll} }); }); });`,
        `${until} it.layer(services, { excludeTestServices: true })((it) => { it.effect("live", () => until(probe)); }); it.layer(services)((it) => { it.effect("clock", () => until(probe)); });`,
      ];
      for (const body of testClock) assertTrue(yield* hasRule(body, "EV008"));
    })
  );

  it.effect("reviews fnUntraced live registrations without treating sleep as proof of necessity", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule('it.live.each([1])("x", Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); }));', "EV009")
      );
      assertFalse(
        yield* hasRule('it.live("x", Fx.fnUntraced(function* () { yield* Console.log("live console"); }));', "EV009")
      );
      assertTrue(
        yield* hasRule(
          'it.live("x", Fx.fnUntraced(function* () { const Console = fake; yield* Console.log("shadow"); }));',
          "EV009"
        )
      );
    })
  );

  it.effect("recognizes platform subpaths and CommonJS filesystem use with lexical require shadows", () =>
    Effect.gen(function* () {
      for (const module of [
        "@effect/platform-bun/BunFileSystem",
        "@effect/platform-node/NodeFileSystem",
        "@effect/platform-node-shared/NodeFileSystem",
      ])
        assertTrue(yield* hasRule(`import * as Platform from "${module}";`, "EV010"));
      assertFalse(yield* hasRule('import * as Fake from "@effect/platform-node-other/NodeFileSystem";', "EV010"));
      assertTrue(yield* hasRule('const fs = require("node:fs"); const { tmpdir } = require("node:os");', "EV010"));
      assertFalse(yield* hasRule('function run(require) { const fs = require("node:fs"); }', "EV010"));
      assertFalse(yield* hasRule('const { require } = mock; const fs = require("node:fs");', "EV010"));
    })
  );

  it.effect("tracks yielded results to nested assertion arguments through exact lexical bindings", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule(
          'it.effect("result", Fx.fnUntraced(function* () { const missing = yield* Fx.result(program); expect(R.isFailure(missing)).toBe(true); }));',
          "EV005"
        )
      );
      assertFalse(
        yield* hasRule(
          'it.effect("shadow", Fx.fnUntraced(function* () { const missing = yield* Fx.result(program); { const missing = other; expect(R.isFailure(missing)).toBe(true); } }));',
          "EV005"
        )
      );
      assertFalse(
        yield* hasRule(
          'it.effect("unasserted", Fx.fnUntraced(function* () { const missing = yield* Fx.result(program); return missing; }));',
          "EV005"
        )
      );
    })
  );

  it.effect("recognizes public boolean assertions while preserving aliases, shadows and specialized helpers", () =>
    Effect.gen(function* () {
      for (const assertion of [
        'import { assertTrue as check } from "@effect/vitest/utils"; it("x", () => check(O.isSome(value)));',
        'import * as U from "@effect/vitest/utils"; it("x", () => U.assertFalse(X.isFailure(value)));',
      ])
        assertFalse(yield* hasRule(assertion, "EV006"));
      for (const assertion of [
        'import { assert as check } from "@effect/vitest"; it("x", () => check.isTrue(R.isFailure(value)));',
        'import { ok as check } from "node:assert/strict"; it("x", () => check(O.isNone(value)));',
      ])
        assertTrue(yield* hasRule(assertion, "EV006"));
      assertFalse(
        yield* hasRule(
          'import { assertTrue as check } from "@effect/vitest/utils"; it("x", (check) => check(O.isSome(value)));',
          "EV006"
        )
      );
      assertFalse(
        yield* hasRule(
          'import { assertTrue, assertSome } from "@effect/vitest/utils"; it("x", () => { assertTrue(value > 0); assertSome(option, 1); });',
          "EV006"
        )
      );
    })
  );

  it.effect("permits piped fork cancellation without hiding a subsequent direct wait", () =>
    Effect.gen(function* () {
      const rows = yield* findings(
        'import { Fiber } from "effect"; it.effect("cancel", Fx.fnUntraced(function* () { const fiber = yield* transaction(() => Fx.sleep("1 hour")).pipe(Fx.forkChild({ startImmediately: true })); yield* Fiber.interrupt(fiber); yield* Fx.sleep("1 second"); }));'
      );
      assertTrue(A.filter(rows, (row) => row.ruleId === "EV008" && row.mechanization === "judgment").length === 0);
      assertTrue(A.filter(rows, (row) => row.ruleId === "EV008" && row.mechanization === "detector").length === 1);
    })
  );

  it.effect("recognizes namespace tmpdir imports and CommonJS controls without accepting shadowed receivers", () =>
    Effect.gen(function* () {
      for (const text of [
        'import * as os from "node:os"; it("x", () => os.tmpdir());',
        'import os from "node:os"; it("x", () => os.tmpdir());',
        'const os = require("node:os"); it("x", () => os.tmpdir());',
        'it("x", () => require("node:os").tmpdir());',
      ])
        assertTrue(yield* hasRule(text, "EV010"));
      assertFalse(yield* hasRule('const os = require("node:os"); it("x", (os) => os.tmpdir());', "EV010"));
      assertFalse(yield* hasRule('for (const require of loaders) { require("node:fs"); }', "EV010"));
      assertTrue(
        yield* hasRule('import assert from "node:assert/strict"; it("x", () => assert(O.isSome(value)));', "EV006")
      );
    })
  );

  it.effect("retains root namespace provenance for boolean assertions and live clock wrappers", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule(
          'import * as V from "@effect/vitest"; it("x", () => V.assert.isFalse(O.isNone(value)));',
          "EV006"
        )
      );
      assertFalse(
        yield* hasRule(
          'import * as Testing from "effect/testing"; it.effect("x", () => Fx.sleep("1 second").pipe(Testing.TestClock.withLive));',
          "EV008"
        )
      );
      assertTrue(
        yield* hasRule(
          'import { assertTrue as check } from "@effect/vitest/utils"; it.effect("x", Fx.fnUntraced(function* () { const result = yield* Fx.result(program); check(R.isFailure(result)); }));',
          "EV005"
        )
      );
    })
  );

  it.effect(
    "does not assign allocating-provider findings to local pure layer builds or unrelated imported helpers",
    () =>
      Effect.gen(function* () {
        assertFalse(
          yield* hasRule(
            'const supply = effect => Fx.scoped(L.build(L.succeed(Service, {})).pipe(Fx.flatMap(context => effect.pipe(Fx.provide(context))))); it.effect("x", () => supply(program));',
            "EV003"
          )
        );
        assertFalse(
          yield* hasRule(
            'import { provideScopedLayer } from "unrelated"; it.effect("x", () => provideScopedLayer(Resource)(program));',
            "EV002"
          )
        );
        const rows = yield* findings(
          'import { provideScopedLayer } from "@beep/test-utils"; it.effect("x", () => provideScopedLayer(L.effect(Service, acquire))(program));'
        );
        assertTrue(A.filter(rows, (row) => row.ruleId === "EV002").length === 1);
      })
  );

  it.effect("attributes same-file runtime and property helpers once through transitive callers", () =>
    Effect.gen(function* () {
      const rows = yield* findings(`
    function encode(value) { return Fx.runSync(value); }
    const roundTrip = () => fc.assert(fc.property(fc.string(), value => {
      const encoded = Fx.runSync(encodeEffect(value));
      const decoded = Fx.runSync(decodeEffect(encoded));
      return decoded === value;
    }));
    const verify = () => { encode(program); roundTrip(); };
    it("first", () => verify()); it("second", () => verify());
  `);
      const runtimes = A.filter(rows, (row) => row.ruleId === "EV001");
      assertTrue(runtimes.length === 3);
      assertTrue(A.every(runtimes, (row) => row.mechanization === "detector"));
      assertTrue(A.filter(rows, (row) => row.ruleId === "EV007" && row.mechanization === "detector").length === 1);
    })
  );

  it.effect("respects same-file helper binding shadows, unused definitions and imported runtime aliases", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule(
          'import { runSync as run } from "effect/Effect"; const helper = () => run(program); it("x", () => helper());',
          "EV001"
        )
      );
      assertFalse(yield* hasRule('const helper = () => Fx.runSync(program); it("x", (helper) => helper());', "EV001"));
      assertFalse(
        yield* hasRule(
          'const helper = () => Fx.runSync(program); const alias = () => { const helper = () => 1; return helper(); }; it("x", () => alias());',
          "EV001"
        )
      );
      assertFalse(
        yield* hasRule(
          'const helper = () => { function unused() { Fx.runSync(program); } return 1; }; it("x", () => helper());',
          "EV001"
        )
      );
      assertFalse(yield* hasRule('const helper = (Fx) => Fx.runSync(program); it("x", () => helper(fake));', "EV001"));
    })
  );

  it.effect("terminates on reachable and dead same-file call cycles without multiplying findings", () =>
    Effect.gen(function* () {
      const rows = yield* findings(`
    function first() { return second(); }
    function second() { if (condition) first(); return Fx.runSync(program); }
    function deadFirst() { return deadSecond(); }
    function deadSecond() { deadFirst(); return Fx.runSync(unused); }
    it("cycle", () => first());
  `);
      assertTrue(A.filter(rows, (row) => row.ruleId === "EV001").length === 1);
      assertTrue(A.some(rows, (row) => row.ruleId === "EV001" && row.evidence === "Fx.runSync(program)"));
    })
  );

  it.effect("keeps module-only helpers out of test findings and mixed callers as judgments", () =>
    Effect.gen(function* () {
      const helpers =
        "const run = () => Fx.runSync(program); const check = () => fc.assert(fc.property(fc.string(), () => true)); const scoped = () => Fx.scoped(program);";
      const setupOnly = yield* findings(`${helpers} run(); check(); scoped(); it("other", () => 1);`);
      assertFalse(A.some(setupOnly, (row) => A.contains(["EV001", "EV007", "EV004"], row.ruleId)));
      const shared = yield* findings(
        `${helpers} run(); check(); scoped(); it.effect("x", () => { run(); check(); return scoped(); });`
      );
      for (const rule of ["EV001", "EV007", "EV004"])
        assertTrue(A.some(shared, (row) => row.ruleId === rule && row.mechanization === "judgment"));
    })
  );

  it.effect("never declares helper scopes redundant from reachability or repeated calls alone", () =>
    Effect.gen(function* () {
      const helper = "const scoped = () => Fx.scoped(program);";
      const single = yield* findings(`${helper} it.effect("x", () => scoped());`);
      assertTrue(
        A.some(
          single,
          (row) =>
            row.ruleId === "EV004" && row.class === "helper-scope-lifetime-review" && row.mechanization === "judgment"
        )
      );
      const repeated = yield* findings(
        `${helper} it.effect("x", Fx.fnUntraced(function* () { yield* scoped(); yield* scoped(); }));`
      );
      assertTrue(A.filter(repeated, (row) => row.ruleId === "EV004").length === 1);
      assertTrue(
        A.every(
          A.filter(repeated, (row) => row.ruleId === "EV004"),
          (row) => row.mechanization === "judgment"
        )
      );
      assertFalse(yield* hasRule(`${helper} it("plain", () => scoped());`, "EV004"));
      const mixed = yield* findings(`${helper} it("plain", () => scoped()); it.effect("effect", () => scoped());`);
      assertTrue(A.some(mixed, (row) => row.ruleId === "EV004" && row.class === "shared-helper-scope-lifetime-review"));
    })
  );

  it.effect("retains deliberate inner helper scopes and the existing direct whole-body distinction", () =>
    Effect.gen(function* () {
      const rows = yield* findings(`
    const captured = Fx.fnUntraced(function* () {
      const spawner = yield* Service;
      return yield* Fx.scoped(Fx.gen(function* () { const handle = yield* spawner.spawn(command); return yield* handle.exit; }));
    });
    it.effect("uses captured", Fx.fnUntraced(function* () { const code = yield* captured(); expect(code).toBe(1); }));
    it.effect("direct whole", () => Fx.scoped(direct));
  `);
      assertTrue(
        A.some(
          rows,
          (row) =>
            row.ruleId === "EV004" &&
            row.class === "inner-helper-scope-lifetime-review" &&
            row.mechanization === "judgment"
        )
      );
      assertTrue(
        A.some(
          rows,
          (row) =>
            row.ruleId === "EV004" && row.class === "redundant-whole-body-scope" && row.mechanization === "detector"
        )
      );
      assertFalse(
        yield* hasRule(
          'const stubbed = () => Fx.provide(program, L.succeed(Service, {})); it.effect("x", () => stubbed());',
          "EV002"
        )
      );
    })
  );

  it.effect("recognizes registered helper callbacks and keeps escaped or uncertain callback uses as judgments", () =>
    Effect.gen(function* () {
      assertTrue(yield* hasRule('const helper = () => Fx.runSync(program); it.each([1])("x", helper);', "EV001"));
      const exported = yield* findings('export const helper = () => Fx.runSync(program); it("x", () => helper());');
      assertTrue(A.some(exported, (row) => row.ruleId === "EV001" && row.mechanization === "judgment"));
      const callback = yield* findings(
        'const helper = () => subject.evaluate(() => Fx.runSync(program)); it("x", () => helper());'
      );
      assertTrue(A.some(callback, (row) => row.ruleId === "EV001" && row.mechanization === "judgment"));
    })
  );

  it.effect("does not treat type-only references or object keys as non-test helper callers", () =>
    Effect.gen(function* () {
      const rows = yield* findings(
        'const helper = () => Fx.runSync(program); type Signature = typeof helper; const object = { helper: 1 }; it("x", () => helper());'
      );
      assertTrue(A.some(rows, (row) => row.ruleId === "EV001" && row.mechanization === "detector"));
      const exported = yield* findings(
        'const helper = () => Fx.runSync(program); export { helper }; it("x", () => helper());'
      );
      assertTrue(A.some(exported, (row) => row.ruleId === "EV001" && row.mechanization === "judgment"));
    })
  );

  it.effect("compares lexical declarations by identity without opening semantic compiler getters", () =>
    Effect.gen(function* () {
      const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
      const source = project.createSourceFile(
        "identity.test.ts",
        `${imports}
    import { assertTrue } from "@effect/vitest/utils";
    const os = require("node:os"); const other = external;
    other.tmpdir(); os.tmpdir();
    it.effect("outcome", Fx.fnUntraced(function* () {
      const result = yield* Fx.result(program);
      const unrelated = { ok: true };
      assertTrue(unrelated.ok); assertTrue(result.ok);
    }));
  `
      );
      // Obtaining these public wrapper objects is lazy. Detection must never read
      // their compilerObject getters, even indirectly via structural comparison.
      const program = vi.spyOn(project.getProgram(), "compilerObject", "get");
      const checker = vi.spyOn(project.getTypeChecker(), "compilerObject", "get");
      try {
        const rows = yield* detectEffectVitestFindings(
          source,
          "packages/example/test/identity.test.ts",
          "@beep/example"
        );
        assertTrue(A.some(rows, (row) => row.ruleId === "EV005"));
        assertTrue(A.filter(rows, (row) => row.ruleId === "EV010").length === 1);
        assertTrue(program.mock.calls.length === 0, "Syntax detection must not create a compiler program");
        assertTrue(checker.mock.calls.length === 0, "Syntax detection must not create a typechecker");
      } finally {
        checker.mockRestore();
        program.mockRestore();
      }
    })
  );

  it.effect("keeps cached lexical scopes isolated across files and fresh passes after edits", () =>
    Effect.gen(function* () {
      const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
      const original = `${imports}
    const helper = () => Fx.runSync(program);
    it("scopes", () => {
      helper(); helper();
      { helper(); const helper = () => 1; }
      for (const helper of candidates) helper();
      for (let helper = fake; condition; advance()) helper();
      try { subject(); } catch (helper) { helper(); }
      (({ helper }) => helper())(fake);
      (([helper]) => helper())(fake);
    });
  `;
      const shadowed = `${imports} const helper = () => Fx.runSync(program); it("scopes", (helper) => helper());`;
      const source = project.createSourceFile("first.test.ts", original);
      const first = yield* detectEffectVitestFindings(source, "packages/example/test/first.test.ts", "@beep/example");
      assertTrue(A.filter(first, (row) => row.ruleId === "EV001").length === 1);
      deepStrictEqual(
        yield* detectEffectVitestFindings(
          createWrappedNode(
            ts.createLanguageServiceSourceFile(
              source.getFilePath(),
              ts.ScriptSnapshot.fromString(original),
              ts.ScriptTarget.Latest,
              "0",
              true
            )
          ),
          "packages/example/test/first.test.ts",
          "@beep/example"
        ),
        first
      );
      const other = project.createSourceFile("other.test.ts", shadowed);
      assertFalse(
        A.some(
          yield* detectEffectVitestFindings(other, "other.test.ts", "@beep/example"),
          (row) => row.ruleId === "EV001"
        )
      );
      source.replaceWithText(shadowed);
      assertFalse(
        A.some(
          yield* detectEffectVitestFindings(source, "first.test.ts", "@beep/example"),
          (row) => row.ruleId === "EV001"
        )
      );
      source.replaceWithText(original);
      deepStrictEqual(
        yield* detectEffectVitestFindings(source, "packages/example/test/first.test.ts", "@beep/example"),
        first
      );
    })
  );

  it("preserves role spans and order through nested callbacks, shadows, JSX and parser recovery", () => {
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
    const bodies = [
      `${imports}
      function outer(input = () => seed()) {
        const helper = Fx.fn("helper")(function* () {
          yield* Fx.sync(() => input());
          while (pending()) { function local() { tick(); } }
          for (let n = 0; n < 2; n++) local();
          do { const local = function () { finish(); }; local(); } while (again());
        });
        return Fx.fnUntraced(function* () { yield* helper(); });
      }
      it.effect("nested", outer());
    `,
      `${imports}
      const view = <Panel render={function render() {
        const helper = () => value();
        return <Item onClick={() => helper()} />;
      }}>{items.map((item) => <Item value={item} />)}</Panel>;
      for (const item of items) consume(item);
      for (const name in names) consume(name);
    `,
      `${imports}
      function incomplete() {
        const callback = (value) => call(value, ;
        do { const nested = function () { broken( }; } while (;
        for (let n = ; n < 2; n++) { while (unfinished( { next(); }
    `,
    ];
    const spans = (nodes: ReadonlyArray<MorphNode>) =>
      A.map(nodes, (node) => [node.getKind(), node.getStart(), node.getEnd()]);
    for (const body of bodies) {
      const source = project.createSourceFile("roles.tsx", body, { overwrite: true });
      const calls = A.empty<MorphNode>();
      const functions = A.empty<MorphNode>();
      const variables = A.empty<MorphNode>();
      const forLoops = A.empty<MorphNode>();
      const whileLoops = A.empty<MorphNode>();
      const doLoops = A.empty<MorphNode>();
      const forOfLoops = A.empty<MorphNode>();
      const forInLoops = A.empty<MorphNode>();
      // An independent visitor is the parse-order oracle, not another kind query.
      source.forEachDescendant((node) => {
        if (Node.isCallExpression(node)) calls.push(node);
        if (
          A.contains(
            [SyntaxKind.ArrowFunction, SyntaxKind.FunctionExpression, SyntaxKind.FunctionDeclaration],
            node.getKind()
          )
        )
          functions.push(node);
        if (Node.isVariableDeclaration(node)) variables.push(node);
        if (Node.isForStatement(node)) forLoops.push(node);
        if (Node.isWhileStatement(node)) whileLoops.push(node);
        if (Node.isDoStatement(node)) doLoops.push(node);
        if (Node.isForOfStatement(node)) forOfLoops.push(node);
        if (Node.isForInStatement(node)) forInLoops.push(node);
      });
      const indexed = collectEffectVitestImports(source);
      deepStrictEqual(spans(indexed.calls), spans(calls));
      deepStrictEqual(spans(indexed.functions), spans(functions));
      deepStrictEqual(spans(indexed.variables), spans(variables));
      deepStrictEqual(
        spans(indexed.loops),
        spans([...forLoops, ...whileLoops, ...doLoops, ...forOfLoops, ...forInLoops])
      );
    }
  });

  it("keeps shared scope-name results equal to fresh resolution in either reference order", () => {
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
    const source = project.createSourceFile(
      "scope-names.test.ts",
      `${imports}
      const helper = () => Fx.runSync(program);
      missing(); missing(); helper(); helper();
      { missing(); const missing = fake; missing(); }
      { Fx.runSync(program); const Fx = fake; Fx.runSync(program); }
      function nested(missing, { helper }) {
        missing(); helper();
        { const helper = () => missing(); helper(); }
        missing(); helper();
      }
      for (const helper of candidates) { helper(); helper(); }
      for (const helper in candidates) { helper(); helper(); }
      for (let helper = fake; check(); advance()) { helper(); helper(); }
      try { helper(); } catch (helper) { helper(); helper(); }
      (([helper]) => { helper(); helper(); })(fake);
      missing(); helper(); Fx.runSync(program);
    `
    );
    const references = source.getDescendantsOfKind(SyntaxKind.Identifier);
    const fresh = A.map(references, (reference) =>
      O.map(resolveEffectVitestBinding(reference), (binding) => binding.getStart())
    );
    for (const order of [references, A.reverse(references)]) {
      const context = collectEffectVitestImports(source);
      // Prime both successful and absent names, including child scopes first.
      for (const reference of order) context.resolveBinding(reference);
      deepStrictEqual(
        A.map(references, (reference) => O.map(context.resolveBinding(reference), (binding) => binding.getStart())),
        fresh
      );
    }
  });

  it.effect("detects native Arbitrary checks through public barrel, subpath and named aliases", () =>
    Effect.gen(function* () {
      for (const declaration of [
        'import { Arbitrary as Ar } from "effect";',
        'import * as Ar from "effect/Arbitrary";',
      ]) {
        const rows = yield* findings(`${declaration}\nit.effect("native", () => Ar.checkEffect(arb, predicate));`);
        const row = A.findFirst(rows, (candidate) => candidate.ruleId === "EV007");
        row.pipe(O.isSome, assertTrue);
        assertTrue(O.exists(row, (candidate) => candidate.class === "direct-arbitrary-check"));
        assertTrue(O.exists(row, (candidate) => candidate.mechanization === "detector"));
        assertTrue(O.exists(row, (candidate) => candidate.replacement.primitive === "it.effect.prop"));
      }
      assertTrue(
        yield* hasRule(
          'import * as Native from "effect"; it.effect("barrel", () => Native.Arbitrary.checkEffect(arb, predicate));',
          "EV007"
        )
      );
      assertTrue(
        yield* hasRule(
          'import { checkEffect as check } from "effect/Arbitrary"; it.effect("native", () => check(arb, predicate));',
          "EV007"
        )
      );
    })
  );

  it.effect("keeps native property checks lexical and excludes canonical registrations and sampling", () =>
    Effect.gen(function* () {
      for (const body of [
        'import { Arbitrary as Ar } from "effect"; it.effect("shadow", (Ar) => Ar.checkEffect(arb, predicate));',
        'import { Arbitrary as Ar } from "unrelated"; it.effect("other", () => Ar.checkEffect(arb, predicate));',
        'import { Arbitrary as Ar } from "effect"; it.effect("sample", () => Ar.sampleEffect(arb));',
        'import { Arbitrary as Ar } from "effect"; it.effect.prop("canonical", { value: arb }, predicate);',
      ])
        assertFalse(yield* hasRule(body, "EV007"));
    })
  );

  it.effect("retains native property helper reachability, shared judgment and callback execution", () =>
    Effect.gen(function* () {
      const prefix = 'import { Arbitrary as Ar } from "effect";';
      const local = yield* findings(`${prefix}
    const check = Fx.fnUntraced(function* () { yield* Ar.checkEffect(arb, () => Fx.sync(() => true)); });
    it.effect("first", () => check()); it.effect("second", () => check());`);
      assertTrue(
        A.filter(local, (row) => row.ruleId === "EV007" && row.class === "direct-arbitrary-check").length === 1,
        A.join(
          A.map(local, (row) => `${row.ruleId}:${row.class}:${row.evidence}`),
          "\n"
        )
      );
      const shared = yield* findings(`${prefix}
    const check = () => Ar.checkEffect(arb, predicate);
    check(); it.effect("test", () => check());`);
      assertTrue(
        A.some(
          shared,
          (row) =>
            row.ruleId === "EV007" &&
            row.class === "shared-helper-property-assertion-review" &&
            row.mechanization === "judgment"
        )
      );
      const callback = yield* findings(`${prefix}
    it.effect("callback", () => Ar.checkEffect(arb, () => Fx.runSync(program)));`);
      assertTrue(A.some(callback, (row) => row.ruleId === "EV001" && row.mechanization === "detector"));
    })
  );

  it.effect("distinguishes deferred service waits from directly executed and uncertain helper waits", () =>
    Effect.gen(function* () {
      const examples = [
        {
          body: `it.effect("provided", function* () {
      const fs = { readDirectory: () => Fx.gen(function* () { yield* Fx.sleep("1 second"); return []; }) };
      yield* Fx.provideService(Fx.forkChild(consumer), FileSystem.FileSystem, fs);
      yield* TC.adjust("1 second");
    });`,
          mode: "judgment",
          className: "deferred-clock-wait-review",
        },
        {
          body: `it.effect("unrelated", function* () { yield* Fx.sleep("1 second"); yield* Fx.forkChild(other); yield* TC.adjust("1 second"); });`,
          mode: "detector",
          className: "test-clock-stall-risk",
        },
        {
          body: `it.effect("sequential", function* () { yield* Fx.sleep("1 second"); yield* TC.adjust("1 second"); });`,
          mode: "detector",
          className: "test-clock-stall-risk",
        },
        {
          body: `it.effect("nested generators", () => Fx.gen(function* () {
            yield* Fx.gen(function* () {
              yield* Fx.gen(function* () { yield* Fx.sleep("1 second"); });
            });
          }));`,
          mode: "detector",
          className: "test-clock-stall-risk",
        },
        {
          body: `it.effect("direct helper", function* () { const wait = Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); }); yield* wait(); });`,
          mode: "detector",
          className: "test-clock-stall-risk",
        },
        {
          body: `it.effect("immediate", function* () { yield* (function* () { yield* Fx.sleep("1 second"); })(); });`,
          mode: "detector",
          className: "test-clock-stall-risk",
        },
        {
          body: `const wait = Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); }); it.effect("external direct", function* () { yield* wait(); });`,
          mode: "detector",
          className: "test-clock-stall-risk",
        },
        {
          body: `it.effect("uncertain", function* () { const wait = () => Fx.sleep("1 second"); yield* consume(wait); });`,
          mode: "judgment",
          className: "deferred-clock-wait-review",
        },
      ];
      for (const example of examples) {
        const rows = A.filter(yield* findings(example.body), (row) => row.ruleId === "EV008");
        deepStrictEqual(
          A.map(rows, (row) => [row.mechanization, row.class]),
          [[example.mode, example.className]]
        );
      }
    })
  );

  it.effect("retains live-only helper semantics and visible mixed clock ownership", () =>
    Effect.gen(function* () {
      assertFalse(
        yield* hasRule(
          `const wait = Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); }); it.live("live", function* () { yield* wait(); });`,
          "EV008"
        )
      );
      const registrations = [
        'it.live("live", function* () { yield* wait(); });',
        'it.effect("virtual", function* () { yield* wait(); });',
      ];
      for (const ordered of [registrations, A.reverse(registrations)]) {
        const rows = A.filter(
          yield* findings(
            `const wait = Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); }); ${A.join(ordered, "\n")}`
          ),
          (row) => row.ruleId === "EV008"
        );
        deepStrictEqual(
          A.map(rows, (row) => row.mechanization),
          ["judgment"]
        );
      }
    })
  );

  it.effect("uses exact utils Option wrapper provenance without classifying projected plain payloads", () =>
    Effect.gen(function* () {
      for (const body of [
        `import * as Wrapped from "@beep/utils/Option"; it("x", () => expect(Wrapped.isNone(value)).toBe(true));`,
        `import { isSome as present } from "@beep/utils/Option"; it("x", () => expect(present(value)).toBe(true));`,
        `import { none as absent, some as present } from "@beep/utils/Option"; it("x", () => { expect(value).toEqual(absent()); expect(value).toEqual(present(1)); });`,
      ])
        assertTrue(yield* hasRule(body, "EV006"));
      for (const body of [
        `import * as Wrapped from "@beep/utils/Option"; it("x", (Wrapped) => expect(Wrapped.isNone(value)).toBe(true));`,
        `import { isSome as present } from "@beep/utils/Option"; it("x", () => { const present = fake; expect(present(value)).toBe(true); });`,
        `import * as Wrapped from "@beep/utils/OptionOther"; it("x", () => expect(Wrapped.isNone(value)).toBe(true));`,
        `import * as Wrapped from "@beep/utils/Option"; it("x", () => expect(Wrapped.getOrElse(value, () => "fallback")).toEqual("label"));`,
        `it("x", () => { expect(O.getOrThrow(value).path).toEqual("label"); expect(R.getOrThrow(result)).toBe(1); });`,
      ])
        assertFalse(yield* hasRule(body, "EV006"));
    })
  );

  it.effect("permits only the direct vi import required by Vitest mock hoisting", () =>
    Effect.gen(function* () {
      for (const body of [
        'import { vi } from "vitest"; vi.mock("react-dom/client", () => ({ createRoot: vi.fn() }));',
        'import { vi as mocks } from "vitest"; const fake = mocks.hoisted(() => mocks.fn());',
      ])
        assertFalse(
          A.some(
            yield* findingsWithHarness('import { it, expect } from "@effect/vitest";', body),
            (row) => row.ruleId === "EV011"
          )
        );
      for (const body of [
        'import { vi, it } from "vitest"; vi.mock("subject");',
        'import { vi } from "vitest"; vi.fn();',
        'import { vi } from "vitest"; function f(vi) { vi.mock("subject"); }',
        'import * as Vitest from "vitest"; Vitest.vi.mock("subject");',
        'import { describe, expect } from "vitest"; describe("x", () => expect(1).toBe(1));',
      ])
        assertTrue(
          A.some(
            yield* findingsWithHarness('import { it, expect } from "@effect/vitest";', body),
            (row) => row.ruleId === "EV011"
          )
        );
    })
  );

  it.effect("accepts canonical Boolean assertions over compound and piped predicates", () =>
    Effect.gen(function* () {
      const prelude =
        'import { pipe } from "effect/Function"; import { assertTrue, assertFalse } from "@effect/vitest/utils";';
      for (const assertion of [
        "assertTrue(ready && O.isSome(value))",
        "assertTrue(R.isSuccess(decoded) && S.is(Model)(decoded.success))",
        'assertTrue(result.kind === "populated" && O.isNone(result.maximized))',
        "assertTrue((O.isSome(left) || O.isSome(right)))",
        "assertFalse(O.isSome(value) && ready)",
        "assertTrue(value.pipe(O.isSome))",
        "assertTrue(decode(input).pipe(R.isFailure))",
        "assertTrue(pipe(value, O.isSome))",
        "assertFalse(value.pipe(O.isNone))",
      ])
        assertFalse(yield* hasRule(`${prelude} it("canonical", () => ${assertion});`, "EV006"));
      for (const [assertion, primitive] of [
        ["expect(O.isSome(value)).toBe(true)", "utils.assertTrue"],
        ["expect(ready && O.isSome(value)).toBe(true)", "utils.deepStrictEqual"],
        ["assertTrue(!O.isSome(value))", "utils.deepStrictEqual"],
        ["assertTrue(value.pipe(O.map(f)))", "utils.deepStrictEqual"],
      ] as const)
        deepStrictEqual(
          A.map(
            A.filter(yield* findings(`${prelude} it("flagged", () => ${assertion});`), (row) => row.ruleId === "EV006"),
            (row) => row.replacement.primitive
          ),
          [primitive]
        );
      for (const absence of ["assertTrue(value.pipe(O.isNone))", "assertFalse(value.pipe(O.isSome))"])
        assertTrue(yield* hasRule(`${prelude} it("absence", () => ${absence});`, "EV006"));
      assertTrue(
        yield* hasRule(
          'import { assert } from "vitest"; it("plain", () => assert.isTrue(ready && O.isSome(value)));',
          "EV006"
        )
      );
    })
  );

  it.effect("narrows root platform and CommonJS imports to filesystem provenance and explicit opaque residue", () =>
    Effect.gen(function* () {
      for (const body of [
        `import { NodeFileSystem as FS, NodePath } from "@effect/platform-node"; use(FS.layer);`,
        `import * as Platform from "@effect/platform-bun"; use(Platform.BunFileSystem.layer);`,
        `const { NodeFileSystem: FS, NodePath } = require("@effect/platform-node"); use(FS.layer);`,
        `const Platform = require("@effect/platform-bun"); use(Platform.BunFileSystem.layer);`,
        `use(require("@effect/platform-node").NodeFileSystem.layer);`,
        `import * as Platform from "@effect/platform-node"; use(Platform["NodeFileSystem"].layer);`,
        `use(require("@effect/platform-bun")["BunFileSystem"].layer);`,
      ])
        deepStrictEqual(
          A.map(
            A.filter(yield* findings(body), (row) => row.ruleId === "EV010"),
            (row) => row.class
          ),
          ["platform-filesystem-candidate"]
        );
      for (const body of [
        `import * as Path from "@effect/platform-node/NodePath"; use(Path.layer);`,
        `import { NodePath, NodeChildProcessSpawner } from "@effect/platform-node"; use(NodePath.layer);`,
        `import * as Platform from "@effect/platform-node"; it("x", (Platform) => use(Platform.NodeFileSystem.layer));`,
        `import type { NodeFileSystem } from "@effect/platform-node";`,
        `const { NodePath } = require("@effect/platform-node"); use(NodePath.layer);`,
        `function f(require) { use(require("@effect/platform-node").NodeFileSystem.layer); }`,
        `const Platform = require("@effect/platform-node"); function f(Platform) { use(Platform.NodeFileSystem.layer); }`,
        `const FS = require("@effect/platform-node-lookalike/NodeFileSystem");`,
      ])
        assertFalse(yield* hasRule(body, "EV010"));
      const residue = A.filter(
        yield* findings(`import { NodeServices } from "@effect/platform-node"; use(NodeServices.layer);`),
        (row) => row.ruleId === "EV010"
      );
      deepStrictEqual(
        A.map(residue, (row) => [row.class, row.mechanization]),
        [["platform-resource-provenance-review", "judgment"]]
      );
      assertTrue(A.every(residue, (row) => Str.includes("unproven")(row.replacement.sketch)));
    })
  );

  it.effect("classifies proven native filesystem integration subjects apart from opaque platform residue", () =>
    Effect.gen(function* () {
      const harness = 'import { layer } from "@effect/vitest";';
      const subject = 'import { SubjectLive } from "@beep/example/Subject";';
      const consume = (operation: string) =>
        `((it) => { it.effect("x", () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; ${operation} })); });`;
      const reviewClasses = Effect.fnUntraced(function* (body: string) {
        return A.map(
          A.filter(yield* findings(body), (row) => row.ruleId === "EV010"),
          (row) => row.class
        );
      });
      for (const body of [
        `${harness} ${subject} import { NodeServices } from "@effect/platform-node"; const platform = L.mergeAll(NodeServices.layer); const live = SubjectLive.pipe(L.provide(platform)); layer(L.mergeAll(platform, live))${consume("yield* fs.makeTempDirectoryScoped();")}`,
        `${harness} ${subject} import { NodeServices } from "@effect/platform-node"; it.layer(L.provide(SubjectLive, NodeServices.layer))${consume('yield* fs.readFileString("a");')}`,
        `${harness} import * as Services from "@effect/platform-bun/BunServices"; layer(Services.layer)${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import * as Platform from "@effect/platform-node"; layer(Platform.NodeServices.layer)${consume('yield* fs.chmod("a", 0o600);')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; const models = L.mergeAll(ModelsLive); layer(L.mergeAll(NodeServices.layer, models))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(L.provide(TestLive, NodeServices.layer))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(TestLive.pipe(L.provideMerge(Exchange), L.provideMerge(L.mergeAll(NodeServices.layer))))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} ${subject} import { pipe } from "effect/Function"; import { NodeServices } from "@effect/platform-node"; layer(pipe(SubjectLive, L.provide(NodeServices.layer)))${consume('yield* fs.readFileString("a");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer((NodeServices.layer))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import * as Platform from "@effect/platform-node"; const path = Platform.NodePath.layer; layer(Platform.NodeServices.layer)${consume('yield* fs.symlink("a", "b");')}`,
      ])
        deepStrictEqual(yield* reviewClasses(body), []);
      for (const body of [
        `${harness} import * as FakeFs from "./fake-fs"; import { NodeServices } from "@effect/platform-node"; layer(NodeServices.layer)((it) => { it.effect("x", () => Fx.gen(function* () { const fs = yield* FakeFs.FileSystem; yield* fs.symlink("a", "b"); })); });`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(NodeServices.layer)${consume('yield* fs.readFileString("a");')}`,
        `${harness} import { TestLive } from "@beep/test-utils/Layer"; import { NodeServices } from "@effect/platform-node"; layer(TestLive.pipe(L.provide(NodeServices.layer)))${consume('yield* fs.readFileString("a");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(NodeServices.layer)${consume('yield* fs.symlink("a", "b");')} it.effect("y", () => program.pipe(Fx.provide(NodeServices.layer)));`,
        `${harness} import { NodeServices } from "@effect/platform-node"; function f(layer) { layer(NodeServices.layer)${consume('yield* fs.symlink("a", "b");')} }`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(NodeServices.layer)${consume('const other = makeFake(); yield* other.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; const pass = (value) => value; layer(pass(NodeServices))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; const wrap = (value) => Fake.layer; layer(wrap(NodeServices.layer))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(flag ? NodeServices.layer : Fake.layer)${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; const pass = (value) => value; const x = pass(NodeServices.layer); layer(x)${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(TestLive.pipe(L.provideMerge(NodeServices.layer), wrap))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(NodeServices.layer.pipe(wrap))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} ${subject} import { NodeServices } from "@effect/platform-node"; layer(L.provide(NodeServices.layer, SubjectLive))${consume('yield* fs.readFileString("a");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; const stage = L.provideMerge(NodeServices.layer); layer(TestLive.pipe(stage))${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(NodeServices.layer())${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(TestLive, NodeServices.layer)${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; let platform = NodeServices.layer; layer(platform)${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; const platform = NodeServices.layer; use(platform); layer(platform)${consume('yield* fs.symlink("a", "b");')}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; const platform = NodeServices.layer;`,
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(NodeServices.layer)(suite);`,
        `${harness} import * as Platform from "@effect/platform-node"; use(Platform); layer(Platform.NodeServices.layer)${consume('yield* fs.symlink("a", "b");')}`,
      ])
        deepStrictEqual(yield* reviewClasses(body), ["platform-resource-provenance-review"], body);
    })
  );

  it.effect("follows same-file helpers that read FileSystem in the harness context", () =>
    Effect.gen(function* () {
      const harness = 'import { layer } from "@effect/vitest";';
      const subject = 'import { SubjectLive } from "@beep/example/Subject";';
      const subjectLayer = `${harness} ${subject} import { NodeServices } from "@effect/platform-node"; const platform = L.mergeAll(NodeServices.layer); const live = SubjectLive.pipe(L.provide(platform));`;
      const subjectSuite = (call: string) =>
        `layer(L.mergeAll(platform, live))((it) => { it.effect("x", () => Fx.gen(function* () { yield* ${call}; })); });`;
      const subjectBody = (statements: string) =>
        `layer(L.mergeAll(platform, live))((it) => { it.effect("x", () => Fx.gen(function* () { ${statements} })); });`;
      const bound = (statements: string) =>
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectBody(statements)}`;
      const platformSuite = (call: string) =>
        `${harness} import { NodeServices } from "@effect/platform-node"; layer(NodeServices.layer)((it) => { it.effect("x", () => Fx.gen(function* () { yield* ${call}; })); });`;
      const stage = (operation: string) =>
        `Fx.fnUntraced(function* () { const fs = yield* FileSystem.FileSystem; ${operation} })`;
      const reviewClasses = Effect.fnUntraced(function* (body: string) {
        return A.map(
          A.filter(yield* findings(body), (row) => row.ruleId === "EV010"),
          (row) => row.class
        );
      });
      for (const body of [
        `${subjectLayer} const stageWorkspace = ${stage("yield* fs.makeTempDirectoryScoped();")}; ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} const stageWorkspace = ${stage("yield* fs.makeTempDirectoryScoped();")}; const runCheckIn = Fx.fnUntraced(function* () { return yield* stageWorkspace(); }); const runCheck = () => Fx.map(runCheckIn(), (run) => run); ${subjectSuite("runCheck()")}`,
        `${subjectLayer} const stageWorkspace = Fx.fn("stageWorkspace")(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }); ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} function stageWorkspace() { return Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }); } ${subjectSuite("stageWorkspace()")}`,
        `const link = ${stage('yield* fs.symlink("a", "b");')}; ${platformSuite("link()")}`,
        `const again = () => again(); const link = ${stage('yield* fs.symlink("a", "b");')}; ${platformSuite("Fx.andThen(again(), link())")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("stageWorkspace().pipe(Fx.provideServiceEffect(Console.Console, makeConsole))")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("Fx.provideService(stageWorkspace(), Console.Console, testConsole)")}`,
        `${subjectLayer} import * as NativeConsole from "effect/Console"; const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("stageWorkspace().pipe(Fx.provideService(NativeConsole.Console, testConsole))")}`,
        `${subjectLayer} const stageWorkspace = () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }).pipe(Fx.provideService(Console.Console, testConsole)); ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} ${subjectBody("const Bun = { file: () => Fx.void }; yield* Bun.file();")}`,
        bound("const program = stageWorkspace(); yield* program;"),
        bound("const program = stageWorkspace(); yield* (program);"),
        bound("const program = stageWorkspace(); const mapped = Fx.map(program, (value) => value); yield* mapped;"),
        bound(
          "const program = stageWorkspace(); yield* program.pipe(Fx.provideServiceEffect(Console.Console, makeConsole));"
        ),
        bound("const workspace = yield* stageWorkspace(); yield* Fx.log(workspace);"),
        bound("const { root } = yield* stageWorkspace(); yield* Fx.log(root);"),
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; const runIt = () => { const program = stageWorkspace(); return program; }; ${subjectSuite("runIt()")}`,
        `${subjectLayer} import ConsoleTag from "./console-tag"; const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("Fx.provideService(stageWorkspace(), ConsoleTag, testConsole)")}`,
        `${subjectLayer} import * as Logs from "./logs"; const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("stageWorkspace().pipe(Fx.provideService(Logs.Tag, testLogs))")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; layer(L.mergeAll(platform, live))((it) => { it.effect("x", () => stageWorkspace()); });`,
      ])
        deepStrictEqual(yield* reviewClasses(body), []);
      for (const body of [
        `${subjectLayer} import { stageWorkspace } from "./helpers/stage"; ${subjectSuite("stageWorkspace()")}`,
        `${harness} import { NodeServices } from "@effect/platform-node"; import { stageWorkspace } from "./support/CommandTest.ts"; layer(NodeServices.layer)((it) => { it.effect("explore check", () => Fx.gen(function* () { yield* stageWorkspace(); })); });`,
        `${subjectLayer} import * as CommandTest from "./support/CommandTest.ts"; ${subjectSuite("CommandTest.stageWorkspace()")}`,
        `${subjectLayer} import { stageWorkspace as stage } from "./support/CommandTest.ts"; const run = () => stage(); ${subjectSuite("run()")}`,
        `${subjectLayer} import { stageWorkspace } from "./support/CommandTest.ts"; const run = () => stageWorkspace().pipe(Fx.provide(FakeLayer)); ${subjectSuite("run()")}`,
        `import { stageWorkspace } from "./support/CommandTest.ts"; ${platformSuite('stageWorkspace("fixture")')}`,
        `${subjectLayer} import { buildBundleConsumer } from "./bundle-build.ts"; ${subjectSuite("Fx.tryPromise(buildBundleConsumer)")}`,
        `${subjectLayer} import { fixtureEffect } from "./support/CommandTest.ts"; ${subjectSuite("fixtureEffect")}`,
        `${subjectLayer} import { buildBundleConsumer } from "./bundle-build.ts"; const run = () => Fx.tryPromise(buildBundleConsumer); ${subjectSuite("Fx.suspend(run)")}`,
        `${subjectLayer} ${subjectSuite('Fx.promise(() => Bun.file("fixture").text())')}`,
        `${subjectLayer} ${subjectSuite('Fx.sync(() => new Bun.Glob("**/*").scanSync())')}`,
        `${subjectLayer} ${subjectSuite('Fx.sync(() => require("./helpers/stage").stageWorkspace("fixture"))')}`,
        `${subjectLayer} ${subjectSuite("Fx.sync(() => process.cwd())")}`,

        `${subjectLayer} const stageWorkspace = Fx.fnUntraced(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }, Fx.provide(FakeFs.layer)); ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} const stageWorkspace = () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }).pipe(Fx.provide(FakeFs.layer)); ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} let stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} const helpers = { stageWorkspace: ${stage('yield* fs.readFileString("a");')} }; ${subjectSuite("helpers.stageWorkspace()")}`,
        `${subjectLayer} const stageWorkspace = withFakeFileSystem(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }); ${subjectSuite("stageWorkspace()")}`,
        `const read = ${stage('yield* fs.readFileString("a");')}; ${platformSuite("read()")}`,
        `const unused = ${stage('yield* fs.symlink("a", "b");')}; ${platformSuite("Fx.void")}`,
        `${subjectLayer} import { provideScopedLayer } from "@beep/test-utils"; const stageWorkspace = () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }).pipe(provideScopedLayer(FakeFs.layer)); ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} const stageWorkspace = () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }).pipe(Fx.updateService(FileSystem.FileSystem, () => fakeFs)); ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("Fx.provideService(stageWorkspace(), FileSystem.FileSystem, fakeFs)")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("stageWorkspace().pipe(Fx.provide(FakeLayer))")}`,
        `${subjectLayer} import { pipe } from "effect/Function"; const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("pipe(stageWorkspace(), Fx.updateContext((context) => context))")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("Fx.provide(Fx.map(stageWorkspace(), (value) => value), FakeLayer)")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("stageWorkspace().pipe(Fx.provideService(FileSystem.FileSystem)(fakeFs))")}`,
        `${subjectLayer} const Fs = FileSystem.FileSystem; const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("stageWorkspace().pipe(Fx.provideService(Fs, fakeFs))")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; layer(L.mergeAll(platform, live))((it) => { it.effect("x", () => Fx.gen(function* () { yield* Fx.updateServiceScoped(FileSystem.FileSystem, () => fakeFs); yield* stageWorkspace(); })); });`,
        bound("const program = stageWorkspace(); yield* program.pipe(Fx.provide(FakeLayer));"),
        bound("const program = stageWorkspace(); yield* Fx.provide(program, FakeLayer);"),
        bound(
          "const program = stageWorkspace(); yield* program.pipe(Fx.provideService(FileSystem.FileSystem)(fakeFs));"
        ),
        `${subjectLayer} const stageWorkspace = () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("a"); }).pipe(Fx.setContext(fakeContext)); ${subjectSuite("stageWorkspace()")}`,
        `${subjectLayer} const stageWorkspace = ${stage('yield* fs.readFileString("a");')}; ${subjectSuite("Fx.setContext(stageWorkspace(), fakeContext)")}`,
        bound(
          "const program = stageWorkspace(); const mapped = Fx.map(program, (value) => value); yield* Fx.provide(mapped, FakeLayer);"
        ),
        bound("const program = stageWorkspace(); yield* runElsewhere(program);"),
        bound("let program = stageWorkspace(); yield* program;"),
        bound("const [program] = [stageWorkspace()]; yield* program;"),
        bound("const programs = { program: stageWorkspace() }; yield* Fx.provide(programs.program, FakeLayer);"),
        bound("const workspace = yield* stageWorkspace(); yield* Fx.provide(workspace, FakeLayer);"),
        bound("const program = stageWorkspace(); const wrap = () => program; yield* Fx.provide(wrap(), FakeLayer);"),
        bound("yield* withFakeFs(stageWorkspace());"),
        bound("yield* runElsewhere(stageWorkspace());"),
        bound("yield* runElsewhere(Fx.map(stageWorkspace(), (value) => value));"),
        bound("yield* Fx.forEach([1], () => stageWorkspace());"),
        bound("yield* Fx.forEach([1], () => { return stageWorkspace(); });"),
      ])
        deepStrictEqual(yield* reviewClasses(body), ["platform-resource-provenance-review"], body);
    })
  );

  it.effect("keeps filesystem I/O in imported support helpers opaque", () =>
    Effect.gen(function* () {
      const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
      project.createSourceFile(
        "support/CommandTest.ts",
        `
        import * as Effect from "effect/Effect";
        import * as FileSystem from "effect/FileSystem";
        export const stageWorkspace = Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectory();
          yield* fs.writeFileString(root + "/fixture", "fixture");
          return root;
        });
      `
      );
      const source = project.createSourceFile(
        "explore-check.test.ts",
        `
        import { it } from "@effect/vitest";
        import { NodeServices } from "@effect/platform-node";
        import { stageWorkspace } from "./support/CommandTest.ts";
        it.layer(NodeServices.layer)((it) => {
          it.effect("stages workspace", () => stageWorkspace());
        });
      `
      );
      const rows = yield* detectEffectVitestFindings(
        source,
        "packages/example/test/explore-check.test.ts",
        "@beep/example"
      );
      deepStrictEqual(
        A.map(
          A.filter(rows, (row) => row.ruleId === "EV010"),
          (row) => row.class
        ),
        ["platform-resource-provenance-review"]
      );
    })
  );

  it.effect("retains native filesystem provenance through the instrumented layer harness", () =>
    Effect.gen(function* () {
      for (const module of ["@beep/test-runner", "@beep/test-utils/Vitest", "@effect/vitest"]) {
        const rows = yield* findingsWithHarness(
          `import { it as instrumentedIt } from "${module}";`,
          'import { NodeServices } from "@effect/platform-node"; instrumentedIt.layer(NodeServices.layer, { timeout: "10 seconds" })("native", (it) => { it.effect("physical root", () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.realPath("fixture"); })); });'
        );
        assertFalse(A.some(rows, (row) => row.ruleId === "EV010"));
      }
    })
  );

  it.effect("keeps the TsNativeApi subject opaque when platform filesystem provenance is unproven", () =>
    Effect.gen(function* () {
      for (const module of ["@effect/vitest", "@beep/test-runner", "@beep/test-utils/Vitest"]) {
        const rows = yield* findingsWithHarness(
          `import { it } from "${module}";`,
          `import { TsNativeApi, TsNativeConfig } from "@beep/repo-utils/TsNativeApi";
import { NodeServices } from "@effect/platform-node";
const subject = TsNativeApi.layer(TsNativeConfig.make({ cwd: fixture })).pipe(L.provide(NodeServices.layer));
it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
  it.layer(subject, { timeout: "30 seconds" })((it) => {
    it.effect("program", () => Fx.gen(function* () { const api = yield* TsNativeApi; yield* api.program(); }));
  });
  it.effect("spawn failure", () => Fx.gen(function* () {
    const unavailable = TsNativeApi.layer(config).pipe(L.provide(NodeServices.layer));
    yield* L.build(unavailable);
  }));
  it.effect("explicit teardown", () => Fx.gen(function* () { yield* L.buildWithScope(L.fresh(subject), scope); }));
});`
        );
        const platform = A.filter(rows, (row) => row.ruleId === "EV010");
        deepStrictEqual(
          A.map(platform, (row) => [row.class, row.mechanization]),
          [["platform-resource-provenance-review", "judgment"]]
        );
        assertTrue(A.every(platform, (row) => Str.includes("unproven")(row.replacement.sketch)));
      }
    })
  );

  it.effect("does not borrow native filesystem evidence from a nested layer with a different owner", () =>
    Effect.gen(function* () {
      for (const module of ["@effect/vitest", "@beep/test-runner", "@beep/test-utils/Vitest"]) {
        for (const callback of ["(it) =>", "function (it)"]) {
          const rows = yield* findingsWithHarness(
            `import { it } from "${module}";`,
            `import { NodeServices } from "@effect/platform-node";
it.layer(NodeServices.layer)((it) => {
  it.layer(FakeFileSystemLive)(${callback} {
    it.effect("fake native operation", () => Fx.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.realPath("fixture");
    }));
  });
});`
          );
          deepStrictEqual(
            A.map(
              A.filter(rows, (row) => row.ruleId === "EV010"),
              (row) => row.class
            ),
            ["platform-resource-provenance-review"]
          );
        }
      }
    })
  );

  it.effect("retains per-test resource findings beside an owned native platform layer", () =>
    Effect.gen(function* () {
      for (const module of ["@effect/vitest", "@beep/test-runner", "@beep/test-utils/Vitest"]) {
        const rows = yield* findingsWithHarness(
          `import { it } from "${module}";`,
          `import { NodeServices } from "@effect/platform-node";
it.layer(NodeServices.layer)((it) => {
  it.effect("native boundary", () => Fx.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.realPath("fixture");
    yield* program.pipe(Fx.provide(L.effect(Service, acquire)));
  }));
});`
        );
        assertFalse(A.some(rows, (row) => row.ruleId === "EV010"));
        assertTrue(A.some(rows, (row) => row.ruleId === "EV002" && row.class === "per-test-layer-provide"));
      }
    })
  );

  it.effect("indexes for-of and for-in retry candidates with explicit loop presence and ordinary loop negatives", () =>
    Effect.gen(function* () {
      const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
      const source = project.createSourceFile(
        "loops.test.ts",
        `${imports}
    for (const outer of values) retry(outer);
    it.effect("loops", function* () {
      for (const attempt of attempts) yield* Fx.sleep("1 second");
      for (const retry in retries) consume(retry);
      for (const value of values) consume(value);
    });`
      );
      const indexed = collectEffectVitestImports(source);
      deepStrictEqual(
        A.map(indexed.loops, (node) => node.getKind()),
        [SyntaxKind.ForOfStatement, SyntaxKind.ForOfStatement, SyntaxKind.ForOfStatement, SyntaxKind.ForInStatement]
      );
      const rows = A.filter(
        yield* detectEffectVitestFindings(source, "loops.test.ts", "@beep/example"),
        (row) => row.ruleId === "EV013"
      );
      deepStrictEqual(
        A.map(rows, (row) => row.mechanization),
        ["judgment", "judgment"]
      );
      assertTrue(Str.includes("attempt")(rows[0]?.evidence ?? ""));
      assertTrue(Str.includes("retry")(rows[1]?.evidence ?? ""));
      assertFalse(
        yield* hasRule(
          `for (const retry in retries) consume(retry); it("x", () => { for (const value of values) consume(value); });`,
          "EV013"
        )
      );
    })
  );

  it.effect("retains shared deterministic clock review for nested single-test and reset/concurrent layers", () =>
    Effect.gen(function* () {
      for (const body of [
        `it.layer(resource)("parent", (it) => { it.layer(child)("single", (it) => { it.effect("timeout", function* () { const fiber = yield* Fx.forkChild(Fx.timeoutOption(work, "1 second")); yield* TC.adjust("1 second"); yield* Fiber.join(fiber); }); }); });`,
        `it.layer(resource)("shared", (it) => { beforeEach(() => TC.setTime(0)); it.effect.concurrent("a", () => TC.adjust("1 second")); it.effect.concurrent("b", () => TC.adjust("2 seconds")); });`,
      ]) {
        const rows = A.filter(yield* findings(body), (row) => row.ruleId === "EV015");
        assertTrue(rows.length > 0);
        assertTrue(
          A.every(rows, (row) => row.mechanization === "judgment" && row.replacement.primitive === "TestClock.adjust")
        );
        assertTrue(
          A.every(
            rows,
            (row) =>
              Str.includes("not concurrency isolation")(row.replacement.sketch) &&
              Str.includes("intentional live")(row.replacement.sketch)
          )
        );
      }
    })
  );

  it.effect("exempts top-level single-test layer blocks, whose TestClock no other test shares", () =>
    Effect.gen(function* () {
      const adjust = 'Fx.gen(function* () { yield* TC.adjust("1 second"); })';
      for (const body of [
        `it.layer(resource, { timeout: "30 seconds" })((it) => { it.effect("one", () => ${adjust}); });`,
        `it.layer(resource)("named", (it) => { it.effect("one", Fx.fnUntraced(function* () { yield* TC.adjust("4 seconds"); })); });`,
        `it.layer(resource)("expression body", (it) => it.effect("one", () => ${adjust}));`,
        `import { describe, layer } from "@effect/vitest"; describe("suite", () => { layer(resource)((it) => { it.effect("one", () => ${adjust}); }); });`,
        `const pollInterval = "5 seconds"; it.layer(resource)((it) => { const expected = 3; it.effect("one", () => Fx.gen(function* () { yield* TC.adjust(pollInterval); expect(expected).toBe(3); })); });`,
      ]) {
        assertFalse(yield* hasRule(body, "EV015"));
      }
      for (const body of [
        `it.layer(resource)((it) => { it.effect("a", () => ${adjust}); it.effect("b", () => Fx.void); });`,
        `it.layer(resource)((it) => { it.effect.each([1, 2])("case %d", () => ${adjust}); });`,
        `it.layer(resource)((it) => { for (const name of ["a", "b"]) it.effect(name, () => ${adjust}); });`,
        `it.layer(resource)((it) => { it.effect("a", () => ${adjust}); it.layer(child)("inner", (it) => { it.effect("b", () => Fx.void); }); });`,
        `it.layer(resource)((it) => { it.effect("a", () => ${adjust}); registerMore(it); });`,
        `it.layer(resource)((it) => { it.effect.prop("p", [fc.string()], () => ${adjust}); });`,
        `it.layer(resource)("parent", (it) => { it.layer(child)("single", (it) => { it.effect("a", () => ${adjust}); }); });`,
      ]) {
        assertTrue(yield* hasRule(body, "EV015"));
      }
    })
  );

  it.effect("exempts a nested single-test block whose own layer is a fresh TestClock.layer() call", () =>
    Effect.gen(function* () {
      const adjust = 'Fx.gen(function* () { yield* TC.adjust("1 second"); })';
      for (const body of [
        `it.layer(resource)("parent", (it) => { it.layer(TC.layer())((it) => { it.effect("a", () => ${adjust}); }); });`,
        `it.layer(resource)((it) => { it.layer(TC.layer(), { timeout: "5 seconds" })("own clock", (it) => { it.effect("a", () => ${adjust}); }); it.effect("b", () => Fx.void); });`,
        `it.layer(resource)((it) => { it.layer(child)((it) => { it.layer(TC.layer({}))((it) => { it.effect("a", () => ${adjust}); }); }); });`,
      ]) {
        assertFalse(yield* hasRule(body, "EV015"));
      }
      for (const body of [
        `it.layer(resource)((it) => { it.layer(TC.layer())((it) => { it.effect("a", () => ${adjust}); it.effect("b", () => Fx.void); }); });`,
        `it.layer(resource)((it) => { it.layer(TC.layer())((it) => { it.effect.each([1, 2])("case %d", () => ${adjust}); }); });`,
        `const clock = TC.layer(); it.layer(resource)((it) => { it.layer(clock)((it) => { it.effect("a", () => ${adjust}); }); });`,
        `import * as Local from "./clock"; it.layer(resource)((it) => { it.layer(Local.layer())((it) => { it.effect("a", () => ${adjust}); }); });`,
        `it.layer(resource)((it) => { it.layer(TC.layer())((it) => { it.effect("x", () => ${adjust}); it.layer(child)((it) => { it.effect("a", () => ${adjust}); }); }); });`,
      ]) {
        assertTrue(yield* hasRule(body, "EV015"));
      }
      const rows = A.filter(
        yield* findings(
          `it.layer(resource)((it) => { it.layer(TC.layer())((it) => { it.effect("x", () => ${adjust}); it.layer(child)((it) => { it.effect("a", () => ${adjust}); }); }); });`
        ),
        (row) => row.ruleId === "EV015"
      );
      deepStrictEqual(rows.length, 2);
    })
  );

  it.effect("permits repeated lifecycles of a layer built from test-body values and keeps single provisions", () =>
    Effect.gen(function* () {
      const scoped = 'import { provideScopedLayer } from "@beep/test-utils";';
      const provisions = Effect.fnUntraced(function* (body: string) {
        return A.filter(yield* findings(body), (row) => row.ruleId === "EV002");
      });
      for (const body of [
        'it.effect("reopen", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* write.pipe(Fx.provide(Store.makeLayer({ dataDir }))); yield* read.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }));',
        `${scoped} it.effect("replay", () => Fx.gen(function* () { const out = yield* makeOut; const layer = makeRunLayer(manifest, out); yield* run.pipe(provideScopedLayer(layer)); yield* replay.pipe(provideScopedLayer(layer)); }));`,
        `import * as Path from "effect/Path"; ${scoped} it.effect("target", Fx.fnUntraced(function* () { const path = yield* Path.Path; const out = yield* makeOut(); const target = Store.makeLayer({ dataDir: path.join(out, "kg") }); yield* first.pipe(provideScopedLayer(target)); yield* second.pipe(provideScopedLayer(target)); }));`,
        `import * as Path from "effect/Path"; ${scoped} it.effect("host", Fx.fnUntraced(function* () { const path = yield* Path.Path; const out = yield* makeOut(); const resources = L.mergeAll(Store.makeLayer({ dataDir: path.join(out, "kg") }), Clock.layer); const host = L.mergeAll(Server.layer, Toolkit).pipe(L.provide(resources)); yield* first.pipe(provideScopedLayer(host)); yield* second.pipe(provideScopedLayer(host)); }));`,
        'it.effect("same effect layer", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(L.effect(StoreA, openA(dataDir)))); yield* b.pipe(Fx.provide(L.effect(StoreA, openA(dataDir)))); }));',
        'it.effect("store path binding", () => Fx.gen(function* () { const root = yield* makeDataDir; const target = path.join(root, "a"); yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir: target }))); yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir: target }))); }));',
        `${scoped} it.effect("carry", Fx.fnUntraced(function* () { const carried = yield* makeOut; yield* first.pipe(provideScopedLayer(Store.makeLayer({ dataDir: path.join(carried, "kg") }))); yield* second.pipe(provideScopedLayer(Store.makeLayer({ dataDir: path.join(carried, "kg") }))); }));`,
        'it.effect("outer binding", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* Fx.gen(function* () { yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }); yield* Fx.gen(function* () { yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }); }));',
        'import * as Path from "effect/Path"; it.effect("nested path services", () => Fx.gen(function* () { const root = yield* makeDataDir; yield* Fx.gen(function* () { const path = yield* Path.Path; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir: path.join(root, "kg") }))); }); yield* Fx.gen(function* () { const path = yield* Path.Path; yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir: path.join(root, "kg") }))); }); }));',
      ]) {
        deepStrictEqual(yield* provisions(body), []);
      }
      for (const [body, count] of [
        [
          'const shared = Store.makeLayer({ dataDir: "fixtures" }); it.effect("module", () => Fx.gen(function* () { yield* a.pipe(Fx.provide(shared)); yield* b.pipe(Fx.provide(shared)); }));',
          2,
        ],
        [
          'it.effect("single", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }));',
          1,
        ],
        [
          'it.effect("distinct", () => Fx.gen(function* () { const left = yield* makeDataDir; const right = yield* makeDataDir; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir: left }))); yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir: right }))); }));',
          2,
        ],
        [
          'it.effect("stub beside", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(L.succeed(Config, dataDir))); yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }));',
          1,
        ],
        [
          'it.effect("parameter", (ctx) => Fx.gen(function* () { yield* a.pipe(Fx.provide(Store.makeLayer(ctx))); yield* b.pipe(Fx.provide(Store.makeLayer(ctx))); }));',
          2,
        ],
        [
          'it.effect("built once", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; const context = yield* L.build(Store.makeLayer({ dataDir })); yield* a.pipe(Fx.provide(context)); yield* b.pipe(Fx.provide(context)); }));',
          2,
        ],
        [
          `import * as ConfigProvider from "effect/ConfigProvider"; import * as Ref from "effect/Ref"; ${scoped} it.effect("shared utilities", () => Fx.gen(function* () { const commands = yield* Ref.make([]); const root = yield* makeDataDir; const output = \`\${root}/out.txt\`; const env = ConfigProvider.layer(ConfigProvider.fromUnknown({ OUT: output })); yield* a.pipe(provideScopedLayer(L.mergeAll(gitSpawner("one", commands), env))); yield* b.pipe(provideScopedLayer(L.mergeAll(gitSpawner("", commands), env))); }));`,
          2,
        ],
        [
          'import * as Path from "effect/Path"; it.effect("path service", () => Fx.gen(function* () { const path = yield* Path.Path; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir: path.join("fixtures", "a") }))); yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir: path.join("fixtures", "a") }))); }));',
          2,
        ],
        [
          'it.effect("generic constructors", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(L.effect(StoreA, openA(dataDir)))); yield* b.pipe(Fx.provide(L.effect(StoreB, openB(dataDir)))); }));',
          2,
        ],
        [
          'it.effect("stubs in merges", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(L.mergeAll(L.succeed(ServiceA, { dataDir }), Other))); yield* b.pipe(Fx.provide(L.mergeAll(L.succeed(ServiceB, { dataDir }), Other))); }));',
          2,
        ],
        [
          'it.effect("derived paths", () => Fx.gen(function* () { const root = yield* makeDataDir; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir: path.join(root, "a") }))); yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir: path.join(root, "b") }))); }));',
          2,
        ],
        [
          'it.effect("different stores", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir }))); yield* b.pipe(Fx.provide(Cache.makeLayer({ dataDir }))); }));',
          2,
        ],
        [
          'it.effect("nested scopes", () => Fx.gen(function* () { yield* Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }); yield* Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }); }));',
          2,
        ],
        [
          'it.effect("sibling blocks", () => Fx.gen(function* () { { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir }))); } { const dataDir = yield* makeDataDir; yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir }))); } }));',
          2,
        ],
        [
          'it.effect("nested derived paths", () => Fx.gen(function* () { yield* Fx.gen(function* () { const root = yield* makeDataDir; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir: path.join(root, "kg") }))); }); yield* Fx.gen(function* () { const root = yield* makeDataDir; yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir: path.join(root, "kg") }))); }); }));',
          2,
        ],
        [
          'it.effect("nested effect layers", () => Fx.gen(function* () { yield* Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(L.effect(StoreA, openA(dataDir)))); }); yield* Fx.gen(function* () { const dataDir = yield* makeDataDir; yield* b.pipe(Fx.provide(L.effect(StoreA, openA(dataDir)))); }); }));',
          2,
        ],
        [
          `${scoped} it.effect("nested run layers", () => Fx.gen(function* () { yield* Fx.gen(function* () { const out = yield* makeOut; const layer = makeRunLayer(manifest, out); yield* run.pipe(provideScopedLayer(layer)); }); yield* Fx.gen(function* () { const out = yield* makeOut; const layer = makeRunLayer(manifest, out); yield* replay.pipe(provideScopedLayer(layer)); }); }));`,
          2,
        ],
      ] as const) {
        deepStrictEqual((yield* provisions(body)).length, count);
      }
    })
  );

  it.effect("keys EV002 reopens through uninitialized, destructured and repeated test-body bindings", () =>
    Effect.gen(function* () {
      const provisions = Effect.fnUntraced(function* (body: string) {
        return A.filter(yield* findings(body), (row) => row.ruleId === "EV002").length;
      });
      for (const [body, count] of [
        [
          'it.effect("assigned store value", () => Fx.gen(function* () { let dataDir: string; dataDir = yield* makeDataDir; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir }))); yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }));',
          0,
        ],
        [
          'it.effect("destructured store value", () => Fx.gen(function* () { const { dataDir } = yield* setup; yield* a.pipe(Fx.provide(Store.makeLayer({ dataDir }))); yield* b.pipe(Fx.provide(Store.makeLayer({ dataDir }))); }));',
          0,
        ],
        [
          'it.effect("one store read twice", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; const layer = L.mergeAll(Store.makeLayer({ dataDir }), Cache.makeLayer({ dataDir })); yield* a.pipe(Fx.provide(layer)); yield* b.pipe(Fx.provide(layer)); }));',
          0,
        ],
        [
          'it.effect("one binding merged twice", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; const store = Store.makeLayer({ dataDir }); const both = L.merge(store, store); yield* a.pipe(Fx.provide(both)); yield* b.pipe(Fx.provide(both)); }));',
          0,
        ],
        [
          'it.effect("reassigned layer", () => Fx.gen(function* () { const dataDir = yield* makeDataDir; let layer: L.Layer<Store>; layer = Store.makeLayer({ dataDir }); yield* a.pipe(Fx.provide(layer)); yield* b.pipe(Fx.provide(layer)); }));',
          2,
        ],
        [
          'it.effect("destructured layer", () => Fx.gen(function* () { const { layer } = yield* setup; yield* a.pipe(Fx.provide(layer)); yield* b.pipe(Fx.provide(layer)); }));',
          2,
        ],
      ] as const) {
        deepStrictEqual(yield* provisions(body), count);
      }
    })
  );

  it.effect("reads browser-mode include globs only from enabled vitest browser projects", () =>
    Effect.gen(function* () {
      const config = (text: string) =>
        new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true }).createSourceFile(
          "vitest.browser.config.ts",
          text
        );
      deepStrictEqual(
        browserModeIncludeGlobs(
          config(
            'export default defineConfig({ test: { name: "b", include: ["test/browser/**/*.test.{ts,tsx}"], browser: { enabled: true, instances: [{ browser: "chromium" }] } } });'
          )
        ),
        ["test/browser/**/*.test.{ts,tsx}"]
      );
      deepStrictEqual(
        browserModeIncludeGlobs(
          config(
            'export default mergeConfig(shared, defineConfig({ test: { include: ["test/**/*.test.ts"], browser: { enabled: true } } }));'
          )
        ),
        ["test/**/*.test.ts"]
      );
      for (const text of [
        'export default defineConfig({ test: { include: ["test/**/*.test.ts"], browser: { enabled: false } } });',
        'export default defineConfig({ test: { environment: "jsdom", include: ["test/**/*.test.{ts,tsx}"] } });',
        'export default defineConfig({ test: { exclude: ["test/browser/**"] } });',
        "export default defineConfig({ test: { browser: { enabled: true } } });",
        'const include = ["test/**"]; export default defineConfig({ test: { include, browser: { enabled: true } } });',
        "export default defineConfig({ test: { include: browserGlobs, browser: { enabled: true } } });",
        'export default defineConfig({ test: { include: ["test/a.test.ts", dir + "/*.test.ts"], browser: { enabled: true } } });',
        'export default defineConfig({ test: { include: ["test/**"], browser: true } });',
      ]) {
        deepStrictEqual(browserModeIncludeGlobs(config(text)), []);
      }
      deepStrictEqual(
        browserModeIncludeGlobs(
          config(
            "export default defineConfig({ test: { include: [`test/browser/**/*.test.ts`], browser: { enabled: true } } });"
          )
        ),
        ["test/browser/**/*.test.ts"]
      );
      deepStrictEqual(
        browserModeIncludeGlobs(
          config(
            'export default defineConfig({ test: { projects: [{ test: { include: ["a/**"], browser: { enabled: true } } }, { test: { include: ["b/**"] } }, { test: { include: ["c/**"], browser: { enabled: true } } }] } });'
          )
        ),
        ["a/**", "c/**"]
      );
    })
  );

  it.effect("drops only node:assert-backed data-assertion rows from files a browser project runs", () =>
    Effect.gen(function* () {
      const rows = yield* findings(
        'it("x", () => expect(value).toEqual(O.some(1))); it.effect("y", () => Fx.provide(program, L.scoped(Service, acquire)));'
      );
      assertTrue(A.some(rows, (row) => row.ruleId === "EV006"));
      deepStrictEqual(retainBrowserSafeFindings(rows, false), rows);
      const browser = retainBrowserSafeFindings(rows, true);
      assertFalse(A.some(browser, (row) => row.ruleId === "EV006"));
      assertTrue(A.some(browser, (row) => row.ruleId === "EV002"));
      deepStrictEqual(retainBrowserSafeFindings(true)(rows), browser);
      deepStrictEqual(retainBrowserSafeFindings(false)(rows), rows);
    })
  );

  it.effect("routes data assertions by family, polarity and supplied operands without inventing payloads", () =>
    Effect.gen(function* () {
      const examples = [
        ["expect(O.isNone(value)).toBe(true)", "utils.assertNone", "detector"],
        ["expect(O.isNone(value)).toBe(false)", "utils.assertFalse", "judgment"],
        ["expect(O.isSome(value)).not.toBe(true)", "utils.assertNone", "detector"],
        ["expect(O.isNone(value)).not.toBe(false)", "utils.assertNone", "detector"],
        ["expect(R.isFailure(value)).toBe(true)", "utils.assertTrue", "judgment"],
        ["expect(X.isSuccess(value)).not.toBe(true)", "utils.assertFalse", "judgment"],
        ["expect(X.isFailure(value)).toBe(false)", "utils.assertFalse", "judgment"],
        ["expect(value).toEqual(O.some(1))", "utils.assertSome", "judgment"],
        ["expect(value).toEqual(R.fail(error))", "utils.assertFailure", "judgment"],
        ["expect(value).toEqual(R.succeed(1))", "utils.assertSuccess", "judgment"],
        ["expect(value).toEqual(X.succeed(1))", "utils.assertExitSuccess", "judgment"],
        ["expect(value).toEqual(X.fail(error))", "utils.deepStrictEqual", "judgment"],
        ["expect(value).not.toEqual(O.none())", "utils.deepStrictEqual", "judgment"],
        ["expect(O.isNone(a) && R.isFailure(b)).toBe(true)", "utils.deepStrictEqual", "judgment"],
        ["expect(A.every(values, O.isNone)).toBe(true)", "utils.assertTrue", "judgment"],
      ];
      for (const [assertion, primitive, mode] of examples) {
        const rows = A.filter(
          yield* findings(`import * as A from "effect/Array"; it("route", () => ${assertion});`),
          (row) => row.ruleId === "EV006"
        );
        deepStrictEqual(
          A.map(rows, (row) => [row.replacement.primitive, row.mechanization]),
          [[primitive, mode]]
        );
      }
      assertFalse(yield* hasRule(`it("plain", () => expect(R.getOrThrow(value).path).toBe("label"));`, "EV006"));
    })
  );

  it.effect("distinguishes unknown codec module mocks from binding-proven local service candidates", () =>
    Effect.gen(function* () {
      const rows = yield* findings(
        `vi.mock("@beep/codec", () => ({ decode: () => Fx.fail(error) })); class Service extends Context.Service<Service>()("Service", {}) {} vi.spyOn(Service, "method");`
      );
      deepStrictEqual(
        A.map(
          A.filter(rows, (row) => row.ruleId === "EV012"),
          (row) => [row.class, row.mechanization]
        ),
        [
          ["unproven-module-mock-review", "judgment"],
          ["effect-service-mock-candidate", "judgment"],
        ]
      );
      assertTrue(
        A.every(
          A.filter(rows, (row) => row.ruleId === "EV012"),
          (row) => Str.includes("real service key")(row.replacement.sketch)
        )
      );
      assertFalse(yield* hasRule(`vi.spyOn(Math, "random");`, "EV012"));
      assertFalse(
        yield* hasRule(
          `function test(Context) { class Fake extends Context.Service() {} vi.spyOn(Fake, "method"); }`,
          "EV012"
        )
      );
    })
  );

  it.effect("retains CommonJS tmpdir aliases without matching declaration text or shadows", () =>
    Effect.gen(function* () {
      assertTrue(
        yield* hasRule(`const { tmpdir: temporary } = require("node:os"); it("x", () => temporary());`, "EV010")
      );
      assertFalse(
        yield* hasRule(
          `const { tmpdir: temporary } = require("node:os"); it("x", (temporary) => temporary());`,
          "EV010"
        )
      );
      assertFalse(yield* hasRule(`import * as os from "node:os"; const text = "tmpdir";`, "EV010"));
    })
  );

  it.effect.each([
    {
      predicate: "O.isSome",
      truth: true,
      primitive: "utils.assertTrue",
      mode: "judgment",
      polarity: "true polarity",
      requirement: "do not invent",
    },
    {
      predicate: "O.isSome",
      truth: false,
      primitive: "utils.assertNone",
      mode: "detector",
      polarity: "predicate polarity",
      requirement: "original Option is None",
    },
    {
      predicate: "O.isNone",
      truth: true,
      primitive: "utils.assertNone",
      mode: "detector",
      polarity: "predicate polarity",
      requirement: "original Option is None",
    },
    {
      predicate: "O.isNone",
      truth: false,
      primitive: "utils.assertFalse",
      mode: "judgment",
      polarity: "false polarity",
      requirement: "do not invent",
    },
    {
      predicate: "R.isSuccess",
      truth: true,
      primitive: "utils.assertTrue",
      mode: "judgment",
      polarity: "true polarity",
      requirement: "do not invent",
    },
    {
      predicate: "R.isSuccess",
      truth: false,
      primitive: "utils.assertFalse",
      mode: "judgment",
      polarity: "false polarity",
      requirement: "do not invent",
    },
    {
      predicate: "R.isFailure",
      truth: true,
      primitive: "utils.assertTrue",
      mode: "judgment",
      polarity: "true polarity",
      requirement: "do not invent",
    },
    {
      predicate: "R.isFailure",
      truth: false,
      primitive: "utils.assertFalse",
      mode: "judgment",
      polarity: "false polarity",
      requirement: "do not invent",
    },
    {
      predicate: "X.isSuccess",
      truth: true,
      primitive: "utils.assertTrue",
      mode: "judgment",
      polarity: "true polarity",
      requirement: "do not invent",
    },
    {
      predicate: "X.isSuccess",
      truth: false,
      primitive: "utils.assertFalse",
      mode: "judgment",
      polarity: "false polarity",
      requirement: "do not invent",
    },
    {
      predicate: "X.isFailure",
      truth: true,
      primitive: "utils.assertTrue",
      mode: "judgment",
      polarity: "true polarity",
      requirement: "do not invent",
    },
    {
      predicate: "X.isFailure",
      truth: false,
      primitive: "utils.assertFalse",
      mode: "judgment",
      polarity: "false polarity",
      requirement: "do not invent",
    },
  ])(
    "keeps $predicate at $truth under the correct review route",
    ({ predicate, truth, primitive, mode, polarity, requirement }) =>
      Effect.gen(function* () {
        const expression = `${predicate}(value)`;
        for (const assertion of [
          `expect(${expression}).toBe(${truth})`,
          `${truth ? "assertTrue" : "assertFalse"}(${expression})`,
        ]) {
          const rows = A.filter(
            yield* findings(
              `import { assertTrue, assertFalse } from "@effect/vitest/utils"; it("residue", () => ${assertion});`
            ),
            (row) => row.ruleId === "EV006"
          );
          deepStrictEqual(
            A.map(rows, (row) => [row.replacement.primitive, row.mechanization]),
            assertion === `${truth ? "assertTrue" : "assertFalse"}(${expression})` && primitive !== "utils.assertNone"
              ? []
              : [[primitive, mode]]
          );
          assertTrue(A.every(rows, (row) => Str.includes(expression)(row.evidence)));
          assertTrue(A.every(rows, (row) => Str.includes(polarity)(row.replacement.sketch)));
          assertTrue(A.every(rows, (row) => Str.includes(requirement)(row.replacement.sketch)));
        }
      })
  );

  it.effect("accepts public Boolean assertions over proven membership and aggregate predicates", () =>
    Effect.gen(function* () {
      for (const expression of [
        "O.contains(value, expected)",
        "O.contains(expected)(value)",
        "A.every(values, O.isNone)",
        "A.some(values, (value) => O.isSome(value.field))",
        "A.every(O.isNone)(values)",
      ]) {
        for (const truth of [true, false]) {
          const prelude =
            'import * as A from "effect/Array"; import { assertTrue, assertFalse } from "@effect/vitest/utils";';
          const helper = truth ? "assertTrue" : "assertFalse";
          assertFalse(
            yield* hasRule(`${prelude} it("canonical", () => ${helper}(${expression}, "preserved message"));`, "EV006")
          );
          const rows = A.filter(
            yield* findings(`${prelude} it("legacy", () => expect(${expression}).toBe(${truth}));`),
            (row) => row.ruleId === "EV006"
          );
          deepStrictEqual(
            A.map(rows, (row) => [row.mechanization, row.replacement.primitive]),
            [["judgment", `utils.${helper}`]]
          );
        }
      }
      for (const expression of ["O.map(value, transform)", "O.filter(value, predicate)", "O.some(value)"]) {
        assertTrue(
          yield* hasRule(
            `import { assertTrue } from "@effect/vitest/utils"; it("notBoolean", () => assertTrue(${expression}));`,
            "EV006"
          )
        );
      }
      assertFalse(
        yield* hasRule(
          'import { assertTrue } from "@effect/vitest/utils"; it("shadow", (assertTrue) => assertTrue(O.contains(value, expected)));',
          "EV006"
        )
      );
    })
  );

  it.effect("requires canonical absence assertions through proven pipe stages", () =>
    Effect.gen(function* () {
      for (const assertion of [
        "value.pipe(O.isNone, assertTrue)",
        "value.pipe(O.isSome, assertFalse)",
        "pipe(value, O.isNone, assertTrue)",
        "pipe(value, O.isSome, assertFalse)",
      ]) {
        const rows = A.filter(
          yield* findings(
            `import { pipe } from "effect/Function"; import { assertTrue, assertFalse } from "@effect/vitest/utils"; it("absence", () => ${assertion});`
          ),
          (row) => row.ruleId === "EV006"
        );
        deepStrictEqual(
          A.map(rows, (row) => row.replacement.primitive),
          ["utils.assertNone"]
        );
      }
      for (const assertion of [
        "value.pipe(O.isSome, assertTrue)",
        "value.pipe(O.isNone, assertFalse)",
        "value.pipe(X.isFailure, assertTrue)",
        "value.pipe(O.isNone, consume)",
      ]) {
        assertFalse(
          yield* hasRule(
            `import { assertTrue, assertFalse } from "@effect/vitest/utils"; it("valid", () => ${assertion});`,
            "EV006"
          )
        );
      }
      assertFalse(
        yield* hasRule(
          'import { assertTrue } from "@effect/vitest/utils"; it("shadow", (assertTrue) => value.pipe(O.isNone, assertTrue));',
          "EV006"
        )
      );
      for (const body of [
        'import { assertTrue } from "@effect/vitest/utils"; it("shadow", (O) => value.pipe(O.isNone, assertTrue));',
        'import { pipe } from "effect/Function"; import { assertTrue } from "@effect/vitest/utils"; it("shadow", (pipe) => pipe(value, O.isNone, assertTrue));',
      ]) {
        assertFalse(yield* hasRule(body, "EV006"));
      }
      assertTrue(
        yield* hasRule(
          'import { pipe as flowValue } from "effect/Function"; import { assertFalse as checkFalse } from "@effect/vitest/utils"; it("alias", () => flowValue(value, O.isSome, checkFalse));',
          "EV006"
        )
      );
    })
  );

  it.effect("retains opaque aliases and dynamic runtime references in canonical harnesses", () =>
    Effect.gen(function* () {
      const platform = 'import * as Services from "@effect/platform-bun/BunServices";';
      for (const [prelude, expression] of [
        ['import { fixtureEffect } from "./fixture.ts"; const fixture = fixtureEffect;', "fixture"],
        ['import { buildBundleConsumer } from "./bundle.ts"; const run = Fx.tryPromise(buildBundleConsumer);', "run"],
        ["const api = Bun;", 'Fx.sync(() => api.file("fixture"))'],
        ["const first = process; const second = first;", "Fx.sync(() => second.cwd())"],
        ['const load = () => import("./fixture.ts"); const alias = load;', "Fx.promise(alias)"],
        ["let counter = 2; counter--;", "Fx.succeed(counter)"],
        ["let counter = 2; --counter;", "Fx.succeed(counter)"],
        ["", 'Fx.promise(() => import("./bundle-build.ts"))'],
        ["", 'Fx.sync(() => globalThis.Bun.file("fixture"))'],
        ["", 'Fx.sync(() => global.Bun.file("fixture"))'],
        ["", "Fx.sync(() => global.process.cwd())"],
        ['let helper = () => 1; helper = () => Bun.file("fixture");', "Fx.sync(helper)"],
        ['var helper = () => 1; helper = () => Bun.file("fixture");', "Fx.sync(helper)"],
        ["let api = {}; api = Bun;", 'Fx.sync(() => api.file("fixture"))'],
        ['let helper = () => Bun.file("fixture");', "Fx.sync(helper)"],
        ['const helper = Fx.fn("helper")(function* () { return 1; }, () => Bun.file("fixture"));', "helper()"],
        [
          'import { stage } from "./fixture.ts"; const helper = Fx.fnUntraced(function* () { return 1; }, stage);',
          "helper()",
        ],
        [
          'import { fixtureEffect } from "./fixture.ts"; const first = () => second; const second = () => first; const fixture = [first, fixtureEffect];',
          "fixture",
        ],
        ["const first = second; const second = [first, Bun];", "second"],
      ]) {
        assertTrue(
          yield* hasRule(
            `${platform} ${prelude} it.layer(Services.layer)((it) => { it.effect("opaque", () => ${expression}); });`,
            "EV010"
          )
        );
      }
    })
  );

  it.effect("clears pure aliases, recursive helpers and lexically shadowed runtime values", () =>
    Effect.gen(function* () {
      const platform = 'import * as Services from "@effect/platform-bun/BunServices";';
      for (const [prelude, expression] of [
        ["const fixtureEffect = Fx.succeed(1); const fixture = fixtureEffect;", "fixture"],
        ["const fixture = Fx.succeed(1);", "Fx.all([fixture, fixture])"],
        [
          "const buildBundleConsumer = () => Promise.resolve(1); const run = Fx.tryPromise(buildBundleConsumer);",
          "run",
        ],
        ['const Bun = { file: () => "pure" }; const api = Bun;', "Fx.sync(() => api.file())"],
        ['const globalThis = { Bun: { file: () => "pure" } };', "Fx.sync(() => globalThis.Bun.file())"],
        ['const global = { Bun: { file: () => "pure" } };', "Fx.sync(() => global.Bun.file())"],
        ["", "Fx.sync((global) => global.Bun.file())"],
        ['let unused = () => 1; unused = () => Bun.file("fixture");', "Fx.succeed(1)"],
        ['const load = () => "./bundle-build.ts";', "Fx.sync(load)"],
        ["", "Fx.succeed(import.meta.dirname)"],
        ["const helper = () => 1;", "Fx.sync(helper)"],
        ["let helper = () => 1;", "Fx.sync(helper)"],
        ["let counter = 1; const copied = counter + 1;", "Fx.succeed(copied)"],
        ["let counter = 1; const copied = !counter;", "Fx.succeed(copied)"],
        ["var helper = () => 1;", "Fx.sync(helper)"],
        ['const helper = Fx.fn("helper")(function* () { return 1; }, Fx.map((value) => value));', "helper()"],
        ["const first = () => second(); function second() { return first(); }", "Fx.sync(first)"],
        ["const first = second; const second = first;", "second"],
        [
          'import { fixtureEffect } from "./fixture.ts"; const fixture = fixtureEffect;',
          "Fx.sync((fixture) => fixture)",
        ],
        ["const api = Bun;", "Fx.sync((api) => api.file())"],
        ['const unused = () => import("./bundle-build.ts");', "Fx.succeed(1)"],
      ]) {
        assertFalse(
          yield* hasRule(
            `${platform} ${prelude} it.layer(Services.layer)((it) => { it.effect("pure", () => ${expression}); });`,
            "EV010"
          )
        );
      }
    })
  );

  it.effect("clears canonical harness loop heads, stable locals and catch bindings", () =>
    Effect.gen(function* () {
      const platform = 'import * as Services from "@effect/platform-bun/BunServices";';
      for (const body of [
        'for (const name of ["a", "b"]) it.effect(name, () => Fx.succeed(name));',
        "for (const name in { a: 1 }) it.effect(name, () => Fx.succeed(name));",
        'for (let index = 0; index < 1;) { it.effect("index", () => Fx.succeed(index)); break; }',
        'let counter = 1; it.effect("counter", () => Fx.succeed(counter));',
        'try { it.effect("try", () => Fx.succeed(1)); } catch (error) { it.effect("catch", () => Fx.succeed(error)); }',
      ])
        assertFalse(yield* hasRule(`${platform} it.layer(Services.layer)((it) => { ${body} });`, "EV010"));
      for (const body of [
        'let helper = () => 1; helper = () => 2; it.effect("write", () => Fx.sync(helper));',
        'function rewrite() { helper = () => 2; } let helper = () => 1; rewrite(); it.effect("write", () => Fx.sync(helper));',
        'let counter = 0; counter++; it.effect("write", () => Fx.succeed(counter));',
        'let counter = 0; ++counter; it.effect("write", () => Fx.succeed(counter));',
        'let counter = 0; counter += 1; it.effect("write", () => Fx.succeed(counter));',
        'let helper = () => 1; ({ helper } = replacement); it.effect("write", () => Fx.sync(helper));',
        'let helper = () => 1; for (helper of helpers) {} it.effect("write", () => Fx.sync(helper));',
        'let name = "pure"; for (name in names) {} it.effect("write", () => Fx.succeed(name));',
      ])
        assertTrue(yield* hasRule(`${platform} it.layer(Services.layer)((it) => { ${body} });`, "EV010"));
    })
  );

  it.effect.each([
    { root: "@effect/platform-node", services: "NodeServices" },
    { root: "@effect/platform-bun", services: "BunServices" },
  ])("excludes canonical $services harness setup without inferring filesystem use", ({ root, services }) =>
    Effect.gen(function* () {
      const suite = '((it) => { it.effect("subject", () => program); });';
      for (const body of [
        `import { ${services} as Services } from "${root}"; it.layer(Services.layer)${suite}`,
        `import * as Platform from "${root}"; it.layer(Platform.${services}.layer)${suite}`,
        `import * as Services from "${root}/${services}"; it.layer(Services.layer)${suite}`,
        `import { layer as platform } from "${root}/${services}"; it.layer(platform)${suite}`,
        `import { layer as shared } from "@effect/vitest"; import { ${services} } from "${root}"; const platform = ${services}.layer; shared(platform)${suite}`,
        `import { SubjectLive } from "@beep/example/Subject"; import { ${services} } from "${root}"; const live = SubjectLive.pipe(L.provide(${services}.layer)); it.layer(live)${suite}`,
      ])
        assertFalse(yield* hasRule(body, "EV010"));
      for (const body of [
        `import { ${services} } from "${root}"; it.effect("unit", () => program.pipe(Fx.provide(${services}.layer)));`,
        `import { ${services} } from "${root}"; it.layer(${services}.layer)${suite} use(${services}.layer);`,
        `import { ${services} } from "${root}"; function setup(it) { it.layer(${services}.layer)${suite} }`,
        `import { ${services} } from "${root}"; const platform = ${services}.layer; use(platform); it.layer(platform)${suite}`,
        `import { ${services} } from "${root}"; it.layer(${services}.layer)(suite);`,
        `import { ${services} } from "${root}"; it.layer(${services}.layer)((it) => { it.effect("portable", () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("fixture"); })); });`,
      ])
        assertTrue(yield* hasRule(body, "EV010"));
    })
  );

  // #1855 wave 7, H1: a later memory filesystem operand replaces the bundle's FileSystem in the merged context.
  it.effect.each([
    { root: "@effect/platform-node", services: "NodeServices" },
    { root: "@effect/platform-bun", services: "BunServices" },
  ])("clears a $services bundle whose FileSystem a later memory layer replaces", ({ root, services }) =>
    Effect.gen(function* () {
      const bundle = `import { ${services} } from "${root}";`;
      const memory = 'import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";';
      const suite =
        '((it) => { it.effect("reads", () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("fixture"); })); });';
      for (const body of [
        `${bundle} ${memory} it.layer(L.mergeAll(${services}.layer, MemoryFileSystem.layer))${suite}`,
        `${bundle} ${memory} it.layer(L.merge(${services}.layer, MemoryFileSystem.layer))${suite}`,
        `${bundle} import { MemoryFileSystem as Memory } from "@beep/memfs"; const platform = L.mergeAll(${services}.layer, Memory.layer); it.layer(platform)${suite}`,
        `${bundle} import * as Memfs from "@beep/memfs"; it.layer(L.mergeAll(${services}.layer, Memfs.MemoryFileSystem.layerWith({ "/a": "a" })))${suite}`,
        `${bundle} ${memory} import { SubjectLive } from "@beep/example/Subject"; const live = SubjectLive.pipe(L.provideMerge(L.mergeAll(${services}.layer, MemoryFileSystem.layer))); it.layer(live)${suite}`,
      ])
        assertFalse(yield* hasRule(body, "EV010"), body);
      for (const body of [
        `${bundle} ${memory} it.layer(L.mergeAll(MemoryFileSystem.layer, ${services}.layer))${suite}`,
        `${bundle} ${memory} it.layer(L.merge(MemoryFileSystem.layer, ${services}.layer))${suite}`,
        `${bundle} import { MemoryFileSystem } from "./memory.ts"; it.layer(L.mergeAll(${services}.layer, MemoryFileSystem.layer))${suite}`,
        `${bundle} ${memory} it.layer(L.mergeAll(${services}.layer, MemoryFileSystem.makeVolume))${suite}`,
        `${bundle} ${memory} it.layer(L.provideMerge(${services}.layer, MemoryFileSystem.layer))${suite}`,
        `${bundle} ${memory} it.layer(L.mergeAll(${services}.layer, MemoryFileSystem.layer))${suite} it.layer(${services}.layer)${suite}`,
      ])
        assertTrue(yield* hasRule(body, "EV010"), body);
    })
  );

  // #1855 wave 7, H6: a native filesystem layer whose every harness exercises a native link operation.
  it.effect.each([
    { module: "@effect/platform-node/NodeFileSystem" },
    { module: "@effect/platform-bun/BunFileSystem" },
    { module: "@effect/platform-node-shared/NodeFileSystem" },
  ])("clears a $module layer only when every harness proves native links", ({ module }) =>
    Effect.gen(function* () {
      const native =
        '((it) => { it.effect("links", () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.symlink("target", "link"); })); });';
      const portable =
        '((it) => { it.effect("reads", () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("fixture"); })); });';
      for (const body of [
        `import * as NodeFileSystem from "${module}"; it.layer(NodeFileSystem.layer)${native}`,
        `import { layer as fileSystem } from "${module}"; const platform = L.mergeAll(fileSystem, Paths.layer); it.layer(platform)${native} it.layer(platform)${native}`,
        `import * as NodeFileSystem from "${module}"; const link = () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.realPath("link"); }); it.layer(NodeFileSystem.layer)((it) => { it.effect("helper", () => link()); });`,
      ])
        assertFalse(yield* hasRule(body, "EV010"), body);
      for (const body of [
        `import * as NodeFileSystem from "${module}"; it.layer(NodeFileSystem.layer)${portable}`,
        `import * as NodeFileSystem from "${module}"; it.layer(NodeFileSystem.layer)${native} it.layer(NodeFileSystem.layer)${portable}`,
        `import * as NodeFileSystem from "${module}"; it.layer(NodeFileSystem.layer)${native} it.effect("x", () => program.pipe(Fx.provide(NodeFileSystem.layer)));`,
        `import * as NodeFileSystem from "${module}"; import { SubjectLive } from "@beep/example/Subject"; it.layer(SubjectLive.pipe(L.provide(NodeFileSystem.layer)))${portable}`,
        `import * as NodeFileSystem from "${module}"; it.layer(NodeFileSystem.layer)((it) => { it.effect("other", () => Fx.sync(() => other.symlink("target", "link"))); });`,
        `import * as NodeFileSystem from "${module}"; import * as os from "node:os"; os.tmpdir(); it.layer(NodeFileSystem.layer)${native}`,
      ])
        assertTrue(yield* hasRule(body, "EV010"), body);
      assertTrue(
        yield* hasRule(
          `import * as NodeFS from "node:fs"; it.layer(Platform.layer)${native} NodeFS.existsSync("x");`,
          "EV010"
        )
      );
    })
  );

  // #1855 wave 7, H6: a runtime choice between bundles keeps the chosen layer's harness flows.
  it.effect("follows both branches of a conditional platform bundle", () =>
    Effect.gen(function* () {
      const imports =
        'import { BunServices } from "@effect/platform-bun"; import { NodeServices } from "@effect/platform-node";';
      const native =
        '((it) => { it.effect("links", () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.symlink("target", "link"); })); });';
      const portable =
        '((it) => { it.effect("reads", () => Fx.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.readFileString("fixture"); })); });';
      assertFalse(
        yield* hasRule(
          `${imports} const platform = process.versions.bun === undefined ? NodeServices.layer : BunServices.layer; it.layer(platform)${native}`,
          "EV010"
        )
      );
      assertFalse(
        yield* hasRule(
          `${imports} it.layer(L.mergeAll(Subject.layer).pipe(L.provideMerge(isBun ? BunServices.layer : NodeServices.layer)))${native}`,
          "EV010"
        )
      );
      deepStrictEqual(
        A.length(
          A.filter(
            yield* findings(
              `${imports} const platform = process.versions.bun === undefined ? NodeServices.layer : BunServices.layer; it.layer(platform)${portable}`
            ),
            (row) => row.ruleId === "EV010"
          )
        ),
        2
      );
      assertTrue(
        yield* hasRule(
          `${imports} const platform = NodeServices.layer ? BunServices.layer : Fallback.layer; it.layer(platform)${native}`,
          "EV010"
        )
      );
    })
  );

  it.effect.each([
    { root: "@effect/platform-node", services: "NodeServices", path: "NodePath", spawner: "NodeChildProcessSpawner" },
    { root: "@effect/platform-bun", services: "BunServices", path: "BunPath", spawner: "BunChildProcessSpawner" },
  ])("retains exact $services root/subpath resource review parity", ({ root, services }) =>
    Effect.gen(function* () {
      const expected = A.map(
        A.filter(
          yield* findings(`import { ${services} as Services } from "${root}"; use(Services.layer);`),
          (row) => row.ruleId === "EV010"
        ),
        (row) => [row.class, row.mechanization, row.replacement]
      );
      deepStrictEqual(
        A.map(expected, (row) => A.take(row, 2)),
        [["platform-resource-provenance-review", "judgment"]]
      );
      for (const body of [
        `import * as Platform from "${root}"; use(Platform.${services}.layer);`,
        `import * as Services from "${root}/${services}"; use(Services.layer);`,
        `import { layer as servicesLayer } from "${root}/${services}"; use(servicesLayer);`,
        `import { type ${services}, layer as servicesLayer } from "${root}/${services}"; use(servicesLayer);`,
        `const { ${services}: Services } = require("${root}"); use(Services.layer);`,
        `const Services = require("${root}/${services}"); use(Services.layer);`,
        `const { layer: servicesLayer } = require("${root}/${services}"); use(servicesLayer);`,
        `use(require("${root}/${services}").layer);`,
      ]) {
        const rows = A.filter(yield* findings(body), (row) => row.ruleId === "EV010");
        deepStrictEqual(
          A.map(rows, (row) => [row.class, row.mechanization, row.replacement]),
          expected
        );
        assertTrue(A.every(rows, (row) => Str.includes("filesystem use is unproven")(row.replacement.sketch)));
      }
    })
  );

  it.effect.each([
    { root: "@effect/platform-node", services: "NodeServices", path: "NodePath", spawner: "NodeChildProcessSpawner" },
    { root: "@effect/platform-bun", services: "BunServices", path: "BunPath", spawner: "BunChildProcessSpawner" },
  ])("excludes type-only, shadowed and unrelated $services imports", ({ root, services, path, spawner }) =>
    Effect.gen(function* () {
      for (const body of [
        `import type * as Services from "${root}/${services}";`,
        `import { type ${services} } from "${root}/${services}";`,
        `import * as Services from "${root}/${services}"; function f(Services) { use(Services.layer); }`,
        `function f(require) { use(require("${root}/${services}").layer); }`,
        `const Services = require("${root}/${services}"); function f(Services) { use(Services.layer); }`,
        `import * as Services from "${root}/${services}Other"; use(Services.layer);`,
        `const Services = require("${root}-other/${services}"); use(Services.layer);`,
        `import { layer } from "${root}/${path}"; use(layer);`,
        `const { layer } = require("${root}/${spawner}"); use(layer);`,
        `import { layer } from "@effect/platform-node-shared/${services}"; use(layer);`,
      ])
        assertFalse(yield* hasRule(body, "EV010"));
    })
  );

  it.effect.each([
    `expect(decode(CapturedSanityRequestBodyJson, O.getOrThrow(bodyText ?? O.none()))).toEqual({ params: {}, query: "query" });`,
    `expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(raw.session_id, O.none()));`,
    `expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(base.session_id, O.none()));`,
    `expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(legacy.sessionId, O.none()));`,
    `expect(Fx.runSync(Arbitrary.checkEffect(Arbitrary.all([Arbitrary.filter(PackageJsonDependenciesArbitrary, O.isSome)]), ([value]) => { expect(decode(encode(value))).toEqual(value); return true; }, fcRuns(20)))._tag).toBe("Passed");`,
    `expect(Fx.runSync(Arbitrary.checkEffect(Arbitrary.all([Arbitrary.filter(NpmPackageJsonPeerDependenciesMetaArbitrary, O.isSome)]), ([value]) => { expect(decode(encode(value))).toEqual(value); return true; }, fcRuns(20)))._tag).toBe("Passed");`,
    `expect(Fx.runSync(Arbitrary.checkEffect(arbitrary, (value) => { const record = makeRecord({ harness: O.some(value) }); expect(render(record)).toEqual(expected); return true; }, fcRuns(20)))._tag).toBe("Passed");`,
  ])("does not infer asserted tagged data from incidental inputs: %s", (body) =>
    Effect.gen(function* () {
      assertFalse(yield* hasRule(`it.effect("plain", function* () { ${body} });`, "EV006"));
    })
  );

  it.effect("keeps direct and compound tagged assertions visible without entering unrelated callbacks", () =>
    Effect.gen(function* () {
      for (const expression of [
        "O.isNone(a) && R.isFailure(b)",
        "!X.isSuccess(a)",
        "A.every(values, O.isNone)",
        "A.some(values, R.isFailure)",
      ]) {
        assertTrue(
          yield* hasRule(
            `import * as A from "effect/Array"; it("compound", () => expect(${expression}).toBe(true));`,
            "EV006"
          )
        );
      }
      for (const expression of [
        "() => O.isSome(value)",
        "transform(value, () => O.none())",
        "O.some(value).value",
        "Arbitrary.filter(values, O.isSome)",
      ]) {
        assertFalse(yield* hasRule(`it("plain", () => expect(${expression}).toEqual(expected));`, "EV006"));
      }
    })
  );

  it.effect.each([
    "O.map(relation, (claim) => O.some(claim.id))",
    "O.all([O.map(subject, (claim) => claim.id), O.map(object, (claim) => claim.id)]).pipe(O.map(O.some))",
    "O.map((value) => value.id)(relation)",
    "pipe(relation, O.map((value) => value.id))",
    "O.flatMap(relation, (value) => O.some(value.id))",
    "O.filter(relation, (value) => value.id > 0)",
    "O.flatten(nested)",
    "R.map(result, (value) => value.id)",
    "R.mapError((error) => error.message)(result)",
    "R.flatMap(result, (value) => R.succeed(value.id))",
    "R.all(results)",
    "R.flip(result)",
    "X.map(exit, (value) => value.id)",
    "X.mapError((error) => error.message)(exit)",
    "X.mapBoth(exit, { onSuccess: identity, onFailure: identity })",
  ])("retains a completed public tagged transformation as judgment: %s", (expression) =>
    Effect.gen(function* () {
      const rows = A.filter(
        yield* findings(`import { pipe } from "effect"; it("tagged", () => expect(${expression}).toEqual(expected));`),
        (row) => row.ruleId === "EV006"
      );
      deepStrictEqual(
        A.map(rows, (row) => [row.mechanization, row.replacement.primitive]),
        [["judgment", "utils.deepStrictEqual"]]
      );
      assertTrue(A.every(rows, (row) => Str.includes("expect(")(row.evidence)));
    })
  );

  it.effect.each([
    "inserted.nickname.pipe(isNone)",
    "missing.pipe(isNone)",
    "pipe(missing, O.isSome)",
    "O.contains(option, value)",
    "O.contains(value)(option)",
    "option.pipe(O.contains(value))",
    "A.every(values, (value) => O.isNone(decode(value)))",
    "A.every(values, (value) => R.isFailure(decode(value)) && R.isFailure(other(value)))",
    "A.some(values, (value) => O.isSome(value.field))",
    "A.every(values, (value) => { return O.isNone(value); })",
    "A.every(O.isNone)(values)",
    "pipe(values, A.some(O.isSome))",
    "values.pipe(A.every((value) => value.status === 'open' && O.isNone(value.reason)))",
    "Utils.A.every(values, X.isFailure)",
    "Wrapped.every(values, (value) => O.isSome(value.field))",
  ])("retains composed tagged predicates without claiming a payload: %s", (expression) =>
    Effect.gen(function* () {
      for (const truth of [true, false]) {
        const rows = A.filter(
          yield* findings(
            `import { pipe } from "effect"; import { isNone } from "effect/Option"; import * as A from "effect/Array"; import * as Utils from "@beep/utils"; import { A as Wrapped } from "@beep/utils"; it("predicate", () => expect(${expression}).toBe(${truth}));`
          ),
          (row) => row.ruleId === "EV006"
        );
        deepStrictEqual(
          A.map(rows, (row) => row.mechanization),
          ["judgment"]
        );
        assertTrue(A.every(rows, (row) => Str.includes(`toBe(${truth})`)(row.evidence)));
      }
    })
  );

  it.effect.each([
    "yield* Fx.exit(program)",
    "yield* Fx.result(program)",
    "yield* validate({ expectedInfo: O.none() }).pipe(Fx.exit)",
    "yield* validate({ expectedInfo: O.some(info) }).pipe(Fx.result)",
    "yield* pipe(program, Fx.exit)",
  ])("recognizes executed tagged outcomes rather than their unevaluated Effects: %s", (expression) =>
    Effect.gen(function* () {
      const rows = A.filter(
        yield* findings(
          `import { pipe } from "effect"; it.effect("outcome", function* () { expect(${expression}).toMatchObject({ _tag: "Failure" }); });`
        ),
        (row) => row.ruleId === "EV006"
      );
      deepStrictEqual(
        A.map(rows, (row) => [row.mechanization, row.replacement.primitive]),
        [["judgment", "utils.deepStrictEqual"]]
      );
    })
  );

  it.effect.each([
    "O.map((value) => O.some(value))",
    "O.map()",
    "O.map(...args)",
    "O.map(value, transform, extra)",
    "O.map(transform)(value)(extra)",
    "O.match(option, { onNone: () => '', onSome: (value) => value.name })",
    "O.getOrElse(O.some(value), () => fallback)",
    "R.getOrThrow(R.succeed(value))",
    "X.match(exit, { onSuccess: identity, onFailure: identity })",
    "O.map(option, transform).pipe(O.getOrElse(() => plain))",
    "pipe(O.some(value), unknown)",
    "O.some(value).pipe(unknown)",
    "Fx.exit(program)",
    "program.pipe(Fx.result)",
    "yield* Fx.exit(program).pipe(Fx.map(() => plain))",
    "yield Fx.exit(program)",
    "A.filter(values, O.isSome).length",
    "A.every(values, (value) => unknown(O.some(value)))",
    "A.every(values, (value) => { const incidental = O.some(value); return true; })",
    "A.every(values, async (value) => O.isSome(value))",
    "A.every(values, function* (value) { return O.isSome(value); })",
    "A.every(O.isNone)",
    "A.every(O.isNone)(values)(extra)",
  ])("does not infer tagged return values across a plain or incomplete boundary: %s", (expression) =>
    Effect.gen(function* () {
      assertFalse(
        yield* hasRule(
          `import { pipe } from "effect"; import * as A from "effect/Array"; it.effect("plain", function* () { expect(${expression}).toBeDefined(); });`,
          "EV006"
        )
      );
    })
  );

  it.effect("requires exact provenance for computed transforms, pipe predicates and Array facades", () =>
    Effect.gen(function* () {
      for (const body of [
        `import { map as mapped } from "effect/Option"; it("alias", () => expect(mapped(option, transform)).toEqual(expected));`,
        `import * as Wrapped from "@beep/utils/Option"; it("alias", () => expect(Wrapped.map(option, transform)).toEqual(expected));`,
        `import * as Wrapped from "@beep/utils/Array"; it("alias", () => expect(Wrapped.some(values, O.isSome)).toBe(true));`,
      ])
        assertTrue(yield* hasRule(body, "EV006"));
      for (const body of [
        `import * as Wrapped from "effect/OptionOther"; it("fake", () => expect(Wrapped.map(option, transform)).toEqual(expected));`,
        `import { map as mapped } from "effect/Option"; it("shadow", (mapped) => expect(mapped(option, transform)).toEqual(expected));`,
        `import { isNone } from "effect/Option"; it("shadow", (isNone) => expect(option.pipe(isNone)).toBe(true));`,
        `import * as A from "effect/Array"; it("shadow", (A) => expect(A.every(values, O.isNone)).toBe(true));`,
        `import { A } from "@beep/utils-other"; it("fake", () => expect(A.every(values, O.isNone)).toBe(true));`,
        `import * as Utils from "@beep/utils"; it("fake", () => expect(Utils.every(values, O.isNone)).toBe(true));`,
        `import { A as Wrapped } from "@beep/utils"; it("shadow", (Wrapped) => expect(Wrapped.every(values, O.isNone)).toBe(true));`,
        `it("unknown", () => expect(opaque(O.map(option, transform))).toEqual(expected));`,
      ])
        assertFalse(yield* hasRule(body, "EV006"));
    })
  );

  it.effect.each([
    'it.effect("health", () => verifyHealth().pipe(Fx.scoped));',
    'import { pipe } from "effect"; it.live("health", () => pipe(verifyHealth(), Fx.scoped));',
    'import { scoped as closeScope } from "effect/Effect"; it.effect("health", () => program.pipe(closeScope));',
    'it.live("tika", Fx.fnUntraced(function* () { yield* acquire; }, Fx.scoped));',
  ])("recognizes final whole-body scope application: %s", (source) =>
    Effect.gen(function* () {
      const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV004");
      deepStrictEqual(
        A.map(rows, (row) => [row.class, row.mechanization]),
        [["redundant-whole-body-scope", "detector"]]
      );
    })
  );

  it.effect.each([
    'it.effect("reader", Fx.fnUntraced(function* () { yield* reader.pipe(Fx.scoped, Fx.flip); yield* after; }));',
    'it.effect("tail", () => program.pipe(Fx.scoped, unknown));',
    'it.live("tika", Fx.fnUntraced(function* () { yield* acquire; }, Fx.scoped, unknown));',
    'const shared = () => program.pipe(Fx.scoped); shared(); it.effect("shared", () => shared());',
  ])("retains shorter or uncertain scope ownership: %s", (source) =>
    Effect.gen(function* () {
      const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV004");
      deepStrictEqual(
        A.map(rows, (row) => row.mechanization),
        ["judgment"]
      );
      assertFalse(A.some(rows, (row) => row.class === "redundant-whole-body-scope"));
    })
  );

  it.effect.each([
    'const scoped = Fx.scoped(program); it.effect("hoisted", () => scoped);',
    'it.effect("shadow", (Fx) => program.pipe(Fx.scoped));',
    'import { scoped } from "lookalike"; it.effect("fake", () => program.pipe(scoped));',
    'it("plain", () => program.pipe(Fx.scoped));',
    "const unused = program.pipe(Fx.scoped);",
  ])("does not invent applied test scopes: %s", (source) =>
    Effect.gen(function* () {
      assertFalse(yield* hasRule(source, "EV004"));
    })
  );

  it.effect.each([
    'const provideLive = provide(L.effect(Service, acquire)); it.live("tika", Fx.fnUntraced(function* () { yield* program; }, provideLive));',
    'const provideLive = provide(L.effect(Service, acquire)); it.effect("pipe", () => program.pipe(provideLive));',
    'const provideLive = provide(L.effect(Service, acquire)); it.effect("call", () => provideLive(program));',
    'const provideLive = Fx.provide(L.effect(Service, acquire)); const alias = provideLive; it.live("alias", Fx.fnUntraced(function* () { yield* program; }, alias));',
  ])("retains applied immutable provider provenance: %s", (source) =>
    Effect.gen(function* () {
      const rows = A.filter(
        yield* findings(`import { provideScopedLayer as provide } from "@beep/test-utils/Layer"; ${source}`),
        (row) => row.ruleId === "EV002"
      );
      deepStrictEqual(
        A.map(rows, (row) => [row.class, row.mechanization, row.replacement.primitive]),
        [["per-test-layer-provide", "detector", "it.layer"]]
      );
    })
  );

  it.effect("preserves pure, unknown, shadowed and unused provider-result distinctions", () =>
    Effect.gen(function* () {
      const header = 'import { provideScopedLayer as provide } from "@beep/test-utils";';
      for (const layer of ["L.succeed(Service, {})", "L.mock(Service, {})"]) {
        assertFalse(
          yield* hasRule(
            `${header} const provideLive = provide(${layer}); it.live("stub", Fx.fnUntraced(function* () { yield* program; }, provideLive));`,
            "EV002"
          )
        );
      }
      const rows = A.filter(
        yield* findings(
          `${header} const provideLive = provide(ImportedLive); it.live("opaque", Fx.fnUntraced(function* () { yield* program; }, provideLive));`
        ),
        (row) => row.ruleId === "EV002"
      );
      deepStrictEqual(
        A.map(rows, (row) => [row.class, row.mechanization]),
        [["unresolved-layer-provide", "judgment"]]
      );
      for (const source of [
        `${header} const unused = provide(L.effect(Service, acquire)); it.live("unused", () => program);`,
        `${header} let mutable = provide(L.effect(Service, acquire)); it.live("mutable", Fx.fnUntraced(function* () { yield* program; }, mutable));`,
        `${header} const provideLive = provide(L.effect(Service, acquire)); it.live("shadow", (provideLive) => program.pipe(provideLive));`,
        'import { provideScopedLayer as provide } from "lookalike"; const provideLive = provide(Resource); it.live("fake", Fx.fnUntraced(function* () { yield* program; }, provideLive));',
      ])
        assertFalse(yield* hasRule(source, "EV002"));
    })
  );

  it.effect("distinguishes nested resource, pure-stub and opaque layer provisions", () =>
    Effect.gen(function* () {
      const resource = A.filter(
        yield* findings(
          'it.effect("nested", () => Fx.succeed(1).pipe(Fx.provide(L.mergeAll(L.effect(Service, acquire), L.empty))))'
        ),
        (row) => row.ruleId === "EV002"
      );
      deepStrictEqual(
        A.map(resource, (row) => [row.class, row.mechanization, row.replacement.primitive]),
        [["per-test-layer-provide", "detector", "it.layer"]]
      );
      assertFalse(
        yield* hasRule(
          'it.effect("stub", () => program.pipe(Fx.provide(L.mergeAll(L.succeed(Service, {}), L.succeed(Other, {})))))',
          "EV002"
        )
      );
      const unknown = A.filter(
        yield* findings('it.effect("opaque", () => program.pipe(Fx.provide(wrap(unknownLayer))))'),
        (row) => row.ruleId === "EV002"
      );
      deepStrictEqual(
        A.map(unknown, (row) => [row.class, row.mechanization]),
        [["unresolved-layer-provide", "judgment"]]
      );
    })
  );

  it.effect.each([
    'it.live("tika", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(engine.extract(operation)); if (R.isFailure(outcome)) expect(outcome.failure._tag).toBe("ExtractError"); }));',
    'it.effect("success Boolean", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(program); expect(R.isSuccess(outcome)).not.toBe(false); }));',
    'it.effect("unknown", () => expect(Fx.result(program)).toBeDefined());',
  ])("keeps result migration neutral without inventing expected values: %s", (source) =>
    Effect.gen(function* () {
      const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV005");
      deepStrictEqual(
        A.map(rows, (row) => [row.replacement.primitive, row.mechanization]),
        [["readme.exit", "judgment"]]
      );
      assertTrue(A.every(rows, (row) => Str.includes("Cause")(row.replacement.sketch)));
    })
  );

  it.effect.each([
    'it.effect("known success", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(Fx.succeed(42)); expect(outcome).toEqual(R.succeed(42)); }));',
    'it.effect("known failure", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(Fx.fail(error)); expect(outcome).toEqual(R.fail(error)); }));',
    'it.effect("mixed", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(program); expect(R.isFailure(outcome) || R.isSuccess(outcome)).toBe(true); }));',
  ])("keeps Result operands intact while requiring Exit migration review: %s", (source) =>
    Effect.gen(function* () {
      const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV005");
      deepStrictEqual(
        A.map(rows, (row) => [row.replacement.primitive, row.mechanization]),
        [["readme.exit", "judgment"]]
      );
    })
  );

  it.effect("does not invent result migration for an unexecuted unasserted effect or a shadow", () =>
    Effect.gen(function* () {
      assertFalse(
        yield* hasRule('it.effect("unused", () => { const unused = Fx.result(program); return Fx.void; });', "EV005")
      );
      assertFalse(yield* hasRule('it.effect("shadow", (Fx) => expect(Fx.result(program)).toBeDefined());', "EV005"));
    })
  );

  it.effect("retains inner helper pipe scopes and ambiguous generator-return lifetimes as judgment", () =>
    Effect.gen(function* () {
      const inner = A.filter(
        yield* findings(
          'const helper = Fx.fnUntraced(function* () { yield* reader.pipe(Fx.scoped); yield* after; }); it.effect("helper", helper);'
        ),
        (row) => row.ruleId === "EV004"
      );
      deepStrictEqual(
        A.map(inner, (row) => [row.class, row.mechanization]),
        [["inner-helper-scope-lifetime-review", "judgment"]]
      );
      for (const source of [
        'it.effect("returned value", Fx.fnUntraced(function* () { return program.pipe(Fx.scoped); }));',
        'it.live("opaque body", Fx.fnUntraced(body, Fx.scoped));',
      ]) {
        const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV004");
        deepStrictEqual(
          A.map(rows, (row) => row.mechanization),
          ["judgment"]
        );
      }
    })
  );
});

layer(BunCrypto.layer, { timeout: "10 seconds" })((it) => {
  it.effect("does not infer tagged return values across a plain or incomplete boundary: (each)", () =>
    Effect.gen(function* () {
      for (const expression of [
        "O.map((value) => O.some(value))",
        "O.map()",
        "O.map(...args)",
        "O.map(value, transform, extra)",
        "O.map(transform)(value)(extra)",
        "O.match(option, { onNone: () => '', onSome: (value) => value.name })",
        "O.getOrElse(O.some(value), () => fallback)",
        "R.getOrThrow(R.succeed(value))",
        "X.match(exit, { onSuccess: identity, onFailure: identity })",
        "O.map(option, transform).pipe(O.getOrElse(() => plain))",
        "pipe(O.some(value), unknown)",
        "O.some(value).pipe(unknown)",
        "Fx.exit(program)",
        "program.pipe(Fx.result)",
        "yield* Fx.exit(program).pipe(Fx.map(() => plain))",
        "yield Fx.exit(program)",
        "A.filter(values, O.isSome).length",
        "A.every(values, (value) => unknown(O.some(value)))",
        "A.every(values, (value) => { const incidental = O.some(value); return true; })",
        "A.every(values, async (value) => O.isSome(value))",
        "A.every(values, function* (value) { return O.isSome(value); })",
        "A.every(O.isNone)",
        "A.every(O.isNone)(values)(extra)",
      ]) {
        assertFalse(
          yield* hasRule(
            `import { pipe } from "effect"; import * as A from "effect/Array"; it.effect("plain", function* () { expect(${expression}).toBeDefined(); });`,
            "EV006"
          )
        );
      }
    })
  );

  it.effect("requires exact provenance for computed transforms, pipe predicates and Array facades", () =>
    Effect.gen(function* () {
      for (const body of [
        `import { map as mapped } from "effect/Option"; it("alias", () => expect(mapped(option, transform)).toEqual(expected));`,
        `import * as Wrapped from "@beep/utils/Option"; it("alias", () => expect(Wrapped.map(option, transform)).toEqual(expected));`,
        `import * as Wrapped from "@beep/utils/Array"; it("alias", () => expect(Wrapped.some(values, O.isSome)).toBe(true));`,
      ])
        assertTrue(yield* hasRule(body, "EV006"));
      for (const body of [
        `import * as Wrapped from "effect/OptionOther"; it("fake", () => expect(Wrapped.map(option, transform)).toEqual(expected));`,
        `import { map as mapped } from "effect/Option"; it("shadow", (mapped) => expect(mapped(option, transform)).toEqual(expected));`,
        `import { isNone } from "effect/Option"; it("shadow", (isNone) => expect(option.pipe(isNone)).toBe(true));`,
        `import * as A from "effect/Array"; it("shadow", (A) => expect(A.every(values, O.isNone)).toBe(true));`,
        `import { A } from "@beep/utils-other"; it("fake", () => expect(A.every(values, O.isNone)).toBe(true));`,
        `import * as Utils from "@beep/utils"; it("fake", () => expect(Utils.every(values, O.isNone)).toBe(true));`,
        `import { A as Wrapped } from "@beep/utils"; it("shadow", (Wrapped) => expect(Wrapped.every(values, O.isNone)).toBe(true));`,
        `it("unknown", () => expect(opaque(O.map(option, transform))).toEqual(expected));`,
      ])
        assertFalse(yield* hasRule(body, "EV006"));
    })
  );

  it.effect("recognizes final whole-body scope application: (each)", () =>
    Effect.gen(function* () {
      for (const source of [
        'it.effect("health", () => verifyHealth().pipe(Fx.scoped));',
        'import { pipe } from "effect"; it.live("health", () => pipe(verifyHealth(), Fx.scoped));',
        'import { scoped as closeScope } from "effect/Effect"; it.effect("health", () => program.pipe(closeScope));',
        'it.live("tika", Fx.fnUntraced(function* () { yield* acquire; }, Fx.scoped));',
      ]) {
        const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV004");
        deepStrictEqual(
          A.map(rows, (row) => [row.class, row.mechanization]),
          [["redundant-whole-body-scope", "detector"]]
        );
      }
    })
  );

  it.effect("retains shorter or uncertain scope ownership: (each)", () =>
    Effect.gen(function* () {
      for (const source of [
        'it.effect("reader", Fx.fnUntraced(function* () { yield* reader.pipe(Fx.scoped, Fx.flip); yield* after; }));',
        'it.effect("tail", () => program.pipe(Fx.scoped, unknown));',
        'it.live("tika", Fx.fnUntraced(function* () { yield* acquire; }, Fx.scoped, unknown));',
        'const shared = () => program.pipe(Fx.scoped); shared(); it.effect("shared", () => shared());',
      ]) {
        const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV004");
        deepStrictEqual(
          A.map(rows, (row) => row.mechanization),
          ["judgment"]
        );
        assertFalse(A.some(rows, (row) => row.class === "redundant-whole-body-scope"));
      }
    })
  );

  it.effect("accepts shorter scopes whose close a later assertion observes", () =>
    Effect.gen(function* () {
      for (const source of [
        'it.effect("call", Fx.fnUntraced(function* () { yield* Fx.scoped(acquire); expect(released).toBe(true); }));',
        'it.effect("pipe", () => Fx.gen(function* () { const error = yield* serve.pipe(Fx.flip, Fx.scoped); expect(error.closed).toBe(true); }));',
        'it.effect("nested", Fx.fnUntraced(function* () { if (ready) { yield* Fx.scoped(acquire); } expect(released).toBe(true); }));',
        'it.effect("callback", () => Fx.flatMap(root, () => Fx.gen(function* () { yield* Fx.scoped(acquire); expect(released).toBe(true); })));',
        'const helper = Fx.fnUntraced(function* () { yield* reader.pipe(Fx.scoped); expect(closed).toBe(true); }); it.effect("helper", helper);',
        'it.effect("staged", Fx.fnUntraced(function* () { yield* Fx.succeed(1).pipe(Fx.tap(acquire), Fx.scoped); expect(released).toBe(true); }));',
        'import { deepStrictEqual } from "@effect/vitest/utils"; it.effect("utils", Fx.fnUntraced(function* () { yield* Fx.scoped(acquire); deepStrictEqual(released, true); }));',
        'import { assert } from "@effect/vitest"; it.effect("assert", Fx.fnUntraced(function* () { yield* Fx.scoped(acquire); assert.strictEqual(released, true); }));',
        'it.effect("returned", () => Fx.flatMap(root, () => { return Fx.gen(function* () { yield* Fx.scoped(acquire); expect(released).toBe(true); }); }));',
      ]) {
        assertFalse(yield* hasRule(source, "EV004"));
      }
    })
  );

  it.effect("keeps shorter scopes no later assertion observes as judgments", () =>
    Effect.gen(function* () {
      for (const source of [
        'it.effect("before", Fx.fnUntraced(function* () { expect(ready).toBe(true); yield* Fx.scoped(acquire); yield* after; }));',
        'it.effect("closure", Fx.fnUntraced(function* () { yield* Fx.scoped(acquire); yield* Fx.sync(() => expect(released).toBe(true)); }));',
        'it.effect("deferred", Fx.fnUntraced(function* () { const later = () => Fx.scoped(acquire); expect(ready).toBe(true); yield* later(); }));',
        'it.effect("fork", Fx.fnUntraced(function* () { yield* Fx.scoped(acquire).pipe(Fx.forkChild); expect(running).toBe(true); }));',
        'it.effect("pure", Fx.fnUntraced(function* () { const value = yield* Fx.scoped(Fx.succeed(1)); expect(value).toBe(1); }));',
        'it.effect("inner", Fx.fnUntraced(function* () { yield* Fx.scoped(Fx.gen(function* () { yield* acquire; expect(open).toBe(true); })); }));',
        'it.effect("built", Fx.fnUntraced(function* () { const work = Fx.scoped(acquire); expect(ready).toBe(true); yield* work; }));',
        'it.effect("bare", Fx.fnUntraced(function* () { Fx.scoped(acquire); expect(ready).toBe(true); }));',
        'it.effect("pure stage", Fx.fnUntraced(function* () { yield* Fx.succeed(1).pipe(Fx.scoped); expect(ready).toBe(true); }));',
        'it.effect("method", Fx.fnUntraced(function* () { yield* Fx.scoped(acquire); const observer = { check() { expect(released).toBe(true); } }; yield* use(observer); }));',
        'it.effect("accessor", Fx.fnUntraced(function* () { yield* Fx.scoped(acquire); const observer = { get closed() { return expect(released).toBe(true); } }; yield* use(observer); }));',
        'it.effect("class", Fx.fnUntraced(function* () { yield* Fx.scoped(acquire); class Probe { run() { expect(released).toBe(true); } } yield* use(Probe); }));',
        'import { pipe } from "effect/Function"; it.effect("pipe fork", Fx.fnUntraced(function* () { yield* pipe(Fx.scoped(acquire), Fx.forkChild); expect(running).toBe(true); }));',
      ]) {
        const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV004");
        deepStrictEqual(
          A.map(rows, (row) => row.mechanization),
          ["judgment"]
        );
      }
    })
  );

  it.effect("does not invent applied test scopes: (each)", () =>
    Effect.gen(function* () {
      for (const source of [
        'const scoped = Fx.scoped(program); it.effect("hoisted", () => scoped);',
        'it.effect("shadow", (Fx) => program.pipe(Fx.scoped));',
        'import { scoped } from "lookalike"; it.effect("fake", () => program.pipe(scoped));',
        'it("plain", () => program.pipe(Fx.scoped));',
        "const unused = program.pipe(Fx.scoped);",
      ]) {
        assertFalse(yield* hasRule(source, "EV004"));
      }
    })
  );

  it.effect("retains applied immutable provider provenance: (each)", () =>
    Effect.gen(function* () {
      for (const source of [
        'const provideLive = provide(L.effect(Service, acquire)); it.live("tika", Fx.fnUntraced(function* () { yield* program; }, provideLive));',
        'const provideLive = provide(L.effect(Service, acquire)); it.effect("pipe", () => program.pipe(provideLive));',
        'const provideLive = provide(L.effect(Service, acquire)); it.effect("call", () => provideLive(program));',
        'const provideLive = Fx.provide(L.effect(Service, acquire)); const alias = provideLive; it.live("alias", Fx.fnUntraced(function* () { yield* program; }, alias));',
      ]) {
        const rows = A.filter(
          yield* findings(`import { provideScopedLayer as provide } from "@beep/test-utils/Layer"; ${source}`),
          (row) => row.ruleId === "EV002"
        );
        deepStrictEqual(
          A.map(rows, (row) => [row.class, row.mechanization, row.replacement.primitive]),
          [["per-test-layer-provide", "detector", "it.layer"]]
        );
      }
    })
  );

  it.effect("preserves pure, unknown, shadowed and unused provider-result distinctions", () =>
    Effect.gen(function* () {
      const header = 'import { provideScopedLayer as provide } from "@beep/test-utils";';
      for (const layer of ["L.succeed(Service, {})", "L.mock(Service, {})"]) {
        assertFalse(
          yield* hasRule(
            `${header} const provideLive = provide(${layer}); it.live("stub", Fx.fnUntraced(function* () { yield* program; }, provideLive));`,
            "EV002"
          )
        );
      }
      const rows = A.filter(
        yield* findings(
          `${header} const provideLive = provide(ImportedLive); it.live("opaque", Fx.fnUntraced(function* () { yield* program; }, provideLive));`
        ),
        (row) => row.ruleId === "EV002"
      );
      deepStrictEqual(
        A.map(rows, (row) => [row.class, row.mechanization]),
        [["unresolved-layer-provide", "judgment"]]
      );
      for (const source of [
        `${header} const unused = provide(L.effect(Service, acquire)); it.live("unused", () => program);`,
        `${header} let mutable = provide(L.effect(Service, acquire)); it.live("mutable", Fx.fnUntraced(function* () { yield* program; }, mutable));`,
        `${header} const provideLive = provide(L.effect(Service, acquire)); it.live("shadow", (provideLive) => program.pipe(provideLive));`,
        'import { provideScopedLayer as provide } from "lookalike"; const provideLive = provide(Resource); it.live("fake", Fx.fnUntraced(function* () { yield* program; }, provideLive));',
      ])
        assertFalse(yield* hasRule(source, "EV002"));
    })
  );

  it.effect("distinguishes nested resource, pure-stub and opaque layer provisions", () =>
    Effect.gen(function* () {
      const resource = A.filter(
        yield* findings(
          'it.effect("nested", () => Fx.succeed(1).pipe(Fx.provide(L.mergeAll(L.effect(Service, acquire), L.empty))))'
        ),
        (row) => row.ruleId === "EV002"
      );
      deepStrictEqual(
        A.map(resource, (row) => [row.class, row.mechanization, row.replacement.primitive]),
        [["per-test-layer-provide", "detector", "it.layer"]]
      );
      assertFalse(
        yield* hasRule(
          'it.effect("stub", () => program.pipe(Fx.provide(L.mergeAll(L.succeed(Service, {}), L.succeed(Other, {})))))',
          "EV002"
        )
      );
      const unknown = A.filter(
        yield* findings('it.effect("opaque", () => program.pipe(Fx.provide(wrap(unknownLayer))))'),
        (row) => row.ruleId === "EV002"
      );
      deepStrictEqual(
        A.map(unknown, (row) => [row.class, row.mechanization]),
        [["unresolved-layer-provide", "judgment"]]
      );
    })
  );

  it.effect("keeps result migration neutral without inventing expected values: (each)", () =>
    Effect.gen(function* () {
      for (const source of [
        'it.live("tika", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(engine.extract(operation)); if (R.isFailure(outcome)) expect(outcome.failure._tag).toBe("ExtractError"); }));',
        'it.effect("success Boolean", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(program); expect(R.isSuccess(outcome)).not.toBe(false); }));',
        'it.effect("unknown", () => expect(Fx.result(program)).toBeDefined());',
      ]) {
        const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV005");
        deepStrictEqual(
          A.map(rows, (row) => [row.replacement.primitive, row.mechanization]),
          [["readme.exit", "judgment"]]
        );
        assertTrue(A.every(rows, (row) => Str.includes("Cause")(row.replacement.sketch)));
      }
    })
  );

  it.effect("keeps Result operands intact while requiring Exit migration review: (each)", () =>
    Effect.gen(function* () {
      for (const source of [
        'it.effect("known success", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(Fx.succeed(42)); expect(outcome).toEqual(R.succeed(42)); }));',
        'it.effect("known failure", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(Fx.fail(error)); expect(outcome).toEqual(R.fail(error)); }));',
        'it.effect("mixed", Fx.fnUntraced(function* () { const outcome = yield* Fx.result(program); expect(R.isFailure(outcome) || R.isSuccess(outcome)).toBe(true); }));',
      ]) {
        const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV005");
        deepStrictEqual(
          A.map(rows, (row) => [row.replacement.primitive, row.mechanization]),
          [["readme.exit", "judgment"]]
        );
      }
    })
  );

  it.effect("does not invent result migration for an unexecuted unasserted effect or a shadow", () =>
    Effect.gen(function* () {
      assertFalse(
        yield* hasRule('it.effect("unused", () => { const unused = Fx.result(program); return Fx.void; });', "EV005")
      );
      assertFalse(yield* hasRule('it.effect("shadow", (Fx) => expect(Fx.result(program)).toBeDefined());', "EV005"));
    })
  );

  it.effect("retains inner helper pipe scopes and ambiguous generator-return lifetimes as judgment", () =>
    Effect.gen(function* () {
      const inner = A.filter(
        yield* findings(
          'const helper = Fx.fnUntraced(function* () { yield* reader.pipe(Fx.scoped); yield* after; }); it.effect("helper", helper);'
        ),
        (row) => row.ruleId === "EV004"
      );
      deepStrictEqual(
        A.map(inner, (row) => [row.class, row.mechanization]),
        [["inner-helper-scope-lifetime-review", "judgment"]]
      );
      for (const source of [
        'it.effect("returned value", Fx.fnUntraced(function* () { return program.pipe(Fx.scoped); }));',
        'it.live("opaque body", Fx.fnUntraced(body, Fx.scoped));',
      ]) {
        const rows = A.filter(yield* findings(source), (row) => row.ruleId === "EV004");
        deepStrictEqual(
          A.map(rows, (row) => row.mechanization),
          ["judgment"]
        );
      }
    })
  );

  it.effect("preserves instrumented tester provenance for the test-runner modules", () =>
    Effect.gen(function* () {
      for (const module of ["@beep/test-runner", "@beep/test-runner/Vitest"]) {
        yield* assertEquivalentFindings('instrumentedIt("runtime", () => Fx.runSync(program));', "EV001", module);
        yield* assertEquivalentFindings('instrumentedIt.effect("scope", () => Fx.scoped(program));', "EV004", module);
        yield* assertEquivalentFindings(
          'instrumentedIt.layer(L.succeed(Service, value))("shared", (it) => { it.effect("clock", () => Fx.sleep("1 second")); });',
          "EV008",
          module
        );
        assertTrue(
          A.some(
            yield* findingsWithHarness(
              `import * as Runner from "${module}";`,
              'Runner.it("namespace", () => Fx.runSync(program));'
            ),
            (finding) => finding.ruleId === "EV001"
          )
        );
        assertFalse(
          A.some(
            yield* findingsWithHarness(
              `import { it as runner } from "${module}";`,
              'const run = () => { const runner = subject; runner("shadowed", () => Fx.runSync(program)); };'
            ),
            (finding) => finding.ruleId === "EV001"
          )
        );
        assertFalse(
          A.some(
            yield* findingsWithHarness(
              `import * as Runner from "${module}";`,
              'Runner.TestHang("unrelated", () => Fx.runSync(program));'
            ),
            (finding) => finding.ruleId === "EV001"
          )
        );
        assertFalse(
          A.some(
            yield* findingsWithHarness(
              `import { TestHang as candidate } from "${module}";`,
              'candidate("error", () => Fx.runSync(program));'
            ),
            (finding) => finding.ruleId === "EV001"
          )
        );
      }
    })
  );
});

layer(BunCrypto.layer, { timeout: "10 seconds" })((it) => {
  it.effect("accepts the exact canonical Boolean helper while retaining stronger Option routes", () =>
    Effect.gen(function* () {
      for (const body of [
        'import { assertTrue } from "@effect/vitest/utils"; it("some", () => assertTrue(O.isSome(value)));',
        'import { assertFalse as no } from "@effect/vitest/utils"; it("some", () => no(O.isNone(value), "present"));',
        'import * as utils from "@effect/vitest/utils"; it("failure", () => utils.assertTrue(R.isFailure(value)));',
        'import { assertFalse } from "@effect/vitest/utils"; it("exit", () => assertFalse(X.isSuccess(value)));',
      ]) {
        assertFalse(yield* hasRule(body, "EV006"), body);
      }
      for (const body of [
        'import { assertTrue } from "@effect/vitest/utils"; it("none", () => assertTrue(O.isNone(value)));',
        'import { assertFalse } from "@effect/vitest/utils"; it("none", () => assertFalse(O.isSome(value)));',
        'it("legacy", () => expect(O.isSome(value)).toBe(true));',
        'import { assert } from "@effect/vitest"; it("legacy", () => assert.isTrue(O.isSome(value)));',
      ]) {
        assertTrue(yield* hasRule(body, "EV006"), body);
      }
    })
  );
});
