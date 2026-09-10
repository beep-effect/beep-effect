import {
  collectEffectVitestImports,
  detectEffectVitestFindings,
  resolveEffectVitestBinding,
} from "@beep/repo-cli/test/Lint";
import { it, vi } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { createWrappedNode, Node, Project, SyntaxKind, ts } from "ts-morph";
import type { EffectVitestRuleId } from "@beep/repo-cli/test/Lint";
import type { Node as MorphNode } from "ts-morph";

const effectImports = [
  'import { Console, Context, Effect as Fx, Exit as X, FileSystem, Layer as L, Option as O, Result as R, Schedule as S } from "effect";',
  'import * as TC from "effect/testing/TestClock";',
  'import * as fc from "effect/testing/FastCheck";',
].join("\n");
const imports = `${effectImports}\nimport { beforeEach, expect, it, test, vi } from "@effect/vitest";`;

const findings = (body: string) => {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const source = project.createSourceFile("fixture.test.ts", `${imports}\n${body}`);
  return detectEffectVitestFindings(source, "packages/example/test/fixture.test.ts", "@beep/example");
};
const hasRule = (body: string, ruleId: EffectVitestRuleId): boolean =>
  A.some(findings(body), (finding) => finding.ruleId === ruleId);

const findingsWithHarness = (harnessImport: string, body: string) => {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const source = project.createSourceFile(
    "instrumented-fixture.test.ts",
    `${effectImports}\n${harnessImport}\n${body}`
  );
  return detectEffectVitestFindings(source, "packages/example/test/instrumented-fixture.test.ts", "@beep/example");
};

const pairedHarnessFindings = (body: string) => ({
  instrumented: findingsWithHarness('import { it as instrumentedIt } from "@beep/test-utils/Vitest";', body),
  original: findingsWithHarness('import { it as instrumentedIt } from "@effect/vitest";', body),
});

const assertEquivalentFindings = (body: string, expectedRule: EffectVitestRuleId) => {
  const { instrumented, original } = pairedHarnessFindings(body);
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
};

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

it.each(cases)("$ruleId positive AST fixture", ({ positive, ruleId }) => assertTrue(hasRule(positive, ruleId)));
it.each(cases)("$ruleId negative AST fixture", ({ negative, ruleId }) => assertFalse(hasRule(negative, ruleId)));

it("tracks named Effect and Layer aliases without mistaking lexical shadows", () => {
  assertTrue(
    hasRule(
      'import { runSync as run, provide as give } from "effect/Effect"; import { scoped as resource } from "effect/Layer"; it("x", () => run(program)); it.effect("y", () => give(program, resource(Service, acquire)));',
      "EV001"
    )
  );
  assertTrue(
    hasRule(
      'import { runSync as run, provide as give } from "effect/Effect"; import { scoped as resource } from "effect/Layer"; it.effect("y", () => give(program, resource(Service, acquire)));',
      "EV002"
    )
  );
  assertFalse(hasRule('import { runSync } from "effect/Effect"; it("x", (runSync) => runSync(program));', "EV001"));
});

it("tracks the root Effect namespace and respects hoisted function shadows", () => {
  assertTrue(hasRule('import * as E from "effect"; it("namespace", () => E.Effect.runSync(program));', "EV001"));
  assertFalse(hasRule('it("hoisted", () => { expect(() => Fx.runSync()).toThrow(); function Fx() {} });', "EV001"));
});

it("emits equivalent findings for the instrumented tester runtime, scope, and TestClock boundaries", () => {
  assertEquivalentFindings('instrumentedIt("runtime", () => Fx.runSync(program));', "EV001");
  assertEquivalentFindings('instrumentedIt.effect("scope", () => Fx.scoped(program));', "EV004");
  assertEquivalentFindings('instrumentedIt.effect("clock", () => Fx.sleep("1 second"));', "EV008");
});

it("recognizes every public instrumented it form through existing tester provenance", () => {
  assertTrue(
    A.some(
      findingsWithHarness('import { it } from "@beep/test-utils/Vitest";', 'it("direct", () => Fx.runSync(program));'),
      (finding) => finding.ruleId === "EV001"
    )
  );
  assertTrue(
    A.some(
      findingsWithHarness(
        'import { it as runner } from "@beep/test-utils/Vitest";',
        'runner.effect("alias", () => Fx.sleep("1 second"));'
      ),
      (finding) => finding.ruleId === "EV008"
    )
  );
  assertTrue(
    A.some(
      findingsWithHarness(
        'import * as Instrumented from "@beep/test-utils/Vitest";',
        'Instrumented.it.live("namespace", () => Fx.log("diagnostic"));'
      ),
      (finding) => finding.ruleId === "EV009"
    )
  );
  assertEquivalentFindings(
    'instrumentedIt.each(cases)("each", () => Fx.runSync(program)); instrumentedIt.prop("prop", [], () => Fx.runSync(program));',
    "EV001"
  );
  assertEquivalentFindings(
    'instrumentedIt.layer(L.scoped(Service, acquire))("outer", (it) => { it.layer(L.succeed(Child, value))("inner", (it) => { it.effect("clock", () => Fx.sleep("1 second")); }); });',
    "EV008"
  );
});

it("does not promote unrelated test-utils modules or non-tester Vitest exports", () => {
  const negatives = [
    'import { it as candidate } from "@beep/test-utils/Schema";',
    'import { TestHang as candidate } from "@beep/test-utils/Vitest";',
    'import { test as candidate } from "@beep/test-utils/Vitest";',
    'import { expect as candidate } from "@beep/test-utils/Vitest";',
  ];
  for (const harnessImport of negatives) {
    assertFalse(
      A.some(
        findingsWithHarness(harnessImport, 'candidate("negative", () => Fx.runSync(program));'),
        (finding) => finding.ruleId === "EV001"
      )
    );
  }
  assertFalse(
    A.some(
      findingsWithHarness(
        'import * as Instrumented from "@beep/test-utils/Vitest";',
        'Instrumented.TestHang("negative", () => Fx.runSync(program));'
      ),
      (finding) => finding.ruleId === "EV001"
    )
  );
});

it("preserves shadowing for direct, renamed, and namespace instrumented imports", () => {
  assertFalse(
    A.some(
      findingsWithHarness(
        'import { it as runner } from "@beep/test-utils/Vitest";',
        'const verify = () => { const runner = subject; runner("shadowed", () => Fx.runSync(program)); };'
      ),
      (finding) => finding.ruleId === "EV001"
    )
  );
  assertFalse(
    A.some(
      findingsWithHarness(
        'import * as Instrumented from "@beep/test-utils/Vitest";',
        'const verify = () => { const Instrumented = subject; Instrumented.it("shadowed", () => Fx.runSync(program)); };'
      ),
      (finding) => finding.ruleId === "EV001"
    )
  );
});

it("does not classify live sleep as a TestClock hang", () => {
  assertFalse(hasRule('it.live("sleep", () => Fx.sleep("1 millis"));', "EV008"));
  assertTrue(hasRule('it.live("sleep", () => Fx.sleep("1 millis"));', "EV009"));
});

it("recognizes a locally constructed Context provision", () => {
  assertFalse(
    hasRule('const ctx = Context.make(Service, {}); it.effect("context", () => Fx.provide(program, ctx));', "EV002")
  );
});

it("keeps property members when an unrelated import uses the same local name", () => {
  assertTrue(
    hasRule(
      'import * as assert from "@effect/vitest/utils"; it("property", () => fc.assert(fc.property(fc.string(), () => true)));',
      "EV007"
    )
  );
});

it("recognizes const-arrow and Effect.fnUntraced resource wrapper definitions", () => {
  assertTrue(
    hasRule(
      'const withOne = (effect) => Fx.acquireRelease(acquire, release).pipe(Fx.flatMap(() => effect)); it.effect("x", withOne(program));',
      "EV003"
    )
  );
  assertTrue(
    hasRule(
      'const withTwo = Fx.fnUntraced((effect) => Fx.acquireRelease(acquire, release).pipe(Fx.flatMap(() => effect))); it.effect("x", withTwo(program));',
      "EV003"
    )
  );
});

it("inspects Option, Result, and Exit values supplied as matcher arguments", () => {
  assertTrue(hasRule('it("o", () => expect(value).toEqual(O.none()));', "EV006"));
  assertTrue(hasRule('it("r", () => expect(value).toEqual(R.succeed(1)));', "EV006"));
  assertTrue(hasRule('it("e", () => expect(value).toEqual(X.fail(error)));', "EV006"));
});

it("keeps shorter scoped lifetimes as judgments", () => {
  const finding = A.findFirst(
    findings('it.effect("x", () => Fx.flatMap(Fx.scoped(shortLife), () => program));'),
    (candidate) => candidate.ruleId === "EV004"
  );
  assertTrue(O.isSome(finding), "Expected the resource-lifetime judgment to be present");
  assertTrue(finding.value.mechanization === "judgment");
  assertTrue(finding.value.class === "shorter-scope-lifetime-review");
});

it("keeps missing resource-layer timeouts as judgments", () => {
  const finding = A.findFirst(
    findings('it.layer(L.scoped(Service, acquire))("db", (it) => { it.effect("x", () => Fx.void); });'),
    (candidate) => candidate.ruleId === "EV014"
  );
  assertTrue(O.isSome(finding), "Expected the resource-lifetime judgment to be present");
  assertTrue(finding.value.mechanization === "judgment");
});

it("emits deterministic distinct identities for same-line occurrences", () => {
  const source = 'it("x", () => Fx.zip(Fx.runSync(left), Fx.runSync(right)));';
  const first = A.filter(findings(source), (finding) => finding.ruleId === "EV001");
  const second = A.filter(findings(source), (finding) => finding.ruleId === "EV001");
  assertTrue(first.length === 2);
  assertTrue(first[0]?.id !== first[1]?.id);
  assertTrue(A.map(first, (finding) => finding.id).join("|") === A.map(second, (finding) => finding.id).join("|"));
});

it("recognizes standalone public harness exports, aliases, modifiers and nested layer testers", () => {
  const rows = findingsWithHarness(
    'import { effect as check, live as real, layer as shared } from "@effect/vitest";',
    'check.skip.each([1])("effect", () => Fx.runSync(program)); real.only("live", Fx.fnUntraced(function* () { yield* Fx.void; })); shared(Resource, { timeout: "1 second" })("suite", (verify) => { verify.effect.each([1])("nested", () => Fx.sleep("1 second")); });'
  );
  assertTrue(A.filter(rows, (row) => row.ruleId === "EV001").length === 1);
  assertTrue(A.filter(rows, (row) => row.ruleId === "EV009").length === 1);
  assertTrue(A.filter(rows, (row) => row.ruleId === "EV008").length === 1);
  assertFalse(A.some(rows, (row) => row.ruleId === "EV014"));
  assertTrue(
    A.some(
      findingsWithHarness(
        'import * as V from "@effect/vitest";',
        'V.layer(Resource)(verify => { verify.effect("x", () => Fx.runSync(program)); });'
      ),
      (row) => row.ruleId === "EV001"
    )
  );
});

it("does not promote shadowed standalone exports, layer testers or Vitest-only lookalikes", () => {
  for (const [header, body] of [
    ['import { effect } from "@effect/vitest";', 'const f = ({ effect }) => effect("x", () => Fx.runSync(program));'],
    ['import { effect } from "vitest";', 'effect("x", () => Fx.runSync(program));'],
    [
      'import { layer } from "@effect/vitest";',
      'layer(Resource)(it => { { const it = other; it.effect("x", () => Fx.runSync(program)); } });',
    ],
    ['import * as V from "@effect/vitest";', 'const f = (V) => V.effect("x", () => Fx.runSync(program));'],
  ]) {
    assertFalse(A.some(findingsWithHarness(header ?? "", body ?? ""), (row) => row.ruleId === "EV001"));
  }
});

it("captures public allocating providers in fnUntraced composition while retaining pure stubs", () => {
  const header = 'import { provideScopedLayer as provide } from "@beep/test-utils";';
  const resource = findings(
    `${header} const services = L.effect(Service, acquire); it.effect("x", Fx.fnUntraced(function* () { yield* Fx.void; }, provide(services)));`
  );
  assertTrue(A.some(resource, (row) => row.ruleId === "EV002" && row.mechanization === "detector"));
  assertFalse(
    hasRule(
      `${header} it.effect("stub", Fx.fnUntraced(function* () { yield* Fx.void; }, provide(L.succeed(Service, {}))));`,
      "EV002"
    )
  );
  assertFalse(hasRule(`${header} it.effect("shadow", (provide) => provide(services));`, "EV002"));
  assertTrue(
    hasRule(
      'import * as Kit from "@beep/test-utils"; it.effect("unknown", () => program.pipe(Kit.provideScopedLayer(ImportedLive)));',
      "EV002"
    )
  );
});

it("captures same-file layer-building wrappers without requiring a with prefix", () => {
  const helper =
    "const supply = (layer) => (effect) => Fx.scoped(L.build(layer).pipe(Fx.flatMap(context => effect.pipe(Fx.provide(context)))));";
  const rows = findings(
    `${helper} it.effect("x", Fx.fnUntraced(function* () { yield* Fx.void; }, supply(L.effect(Service, acquire))));`
  );
  assertTrue(A.some(rows, (row) => row.ruleId === "EV002" && row.mechanization === "detector"));
  assertTrue(A.some(rows, (row) => row.ruleId === "EV003" && O.contains(row.symbol, "supply")));
  assertFalse(hasRule(`${helper} it.effect("x", (supply) => supply(Resource));`, "EV002"));
});

it("judges imported and unknown layer constructors but permits proven pure compositions", () => {
  for (const layer of [
    "ImportedLive",
    "NodeServices.layer",
    "mockLayer()",
    "L.unwrap(Fx.succeed(L.succeed(Service, {})))",
  ])
    assertTrue(
      A.some(
        findings(`it.layer(${layer})("x", it => {});`),
        (row) => row.ruleId === "EV014" && row.mechanization === "judgment"
      )
    );
  assertFalse(
    hasRule('const stub = L.mergeAll(L.succeed(A, {}), L.mock(B, {})); it.layer(stub)("x", it => {});', "EV014")
  );
  assertFalse(
    hasRule(
      'import { layer as shared } from "@effect/vitest"; shared(ImportedLive, { timeout: "2 seconds" })("x", it => {});',
      "EV014"
    )
  );
  assertTrue(hasRule('it.layer(ImportedLive)("x", it => { const timeout = { timeout: "2 seconds" }; });', "EV014"));
});

it("limits withLive exemption to the wrapped wait and preserves cancellation uncertainty", () => {
  assertFalse(hasRule('it.effect("live", () => TC.withLive(Fx.sleep("1 second")));', "EV008"));
  assertFalse(
    hasRule(
      'it.effect("live", () => Fx.gen(function* () { yield* Fx.sleep("1 second"); }).pipe(TC.withLive));',
      "EV008"
    )
  );
  assertTrue(
    hasRule(
      'it.effect("stall", Fx.fnUntraced(function* () { yield* TC.withLive(Fx.succeed(1)); yield* Fx.sleep("1 second"); }));',
      "EV008"
    )
  );
  const sequential = findings(
    'it.effect("stall", Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); yield* TC.adjust("1 second"); }));'
  );
  assertTrue(A.some(sequential, (row) => row.ruleId === "EV008" && row.mechanization === "detector"));
  for (const control of ['TC.adjust("1 second")', "Fiber.interrupt(fiber)"]) {
    const rows = findings(
      `import { Fiber } from "effect"; it.effect("controlled", Fx.fnUntraced(function* () { const fiber = yield* Fx.forkChild(Fx.sleep("1 second")); yield* ${control}; }));`
    );
    assertTrue(A.some(rows, (row) => row.ruleId === "EV008" && row.mechanization === "judgment"));
  }
  assertFalse(hasRule('it.effect("count", () => Fx.succeed(1).pipe(Fx.repeat(S.recurs(3))));', "EV008"));
});

it("reviews fnUntraced live registrations without treating sleep as proof of necessity", () => {
  assertTrue(hasRule('it.live.each([1])("x", Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); }));', "EV009"));
  assertFalse(hasRule('it.live("x", Fx.fnUntraced(function* () { yield* Console.log("live console"); }));', "EV009"));
  assertTrue(
    hasRule(
      'it.live("x", Fx.fnUntraced(function* () { const Console = fake; yield* Console.log("shadow"); }));',
      "EV009"
    )
  );
});

it("recognizes platform subpaths and CommonJS filesystem use with lexical require shadows", () => {
  for (const module of [
    "@effect/platform-bun/BunFileSystem",
    "@effect/platform-node/NodeFileSystem",
    "@effect/platform-node-shared/NodeFileSystem",
  ])
    assertTrue(hasRule(`import * as Platform from "${module}";`, "EV010"));
  assertFalse(hasRule('import * as Fake from "@effect/platform-node-other/NodeFileSystem";', "EV010"));
  assertTrue(hasRule('const fs = require("node:fs"); const { tmpdir } = require("node:os");', "EV010"));
  assertFalse(hasRule('function run(require) { const fs = require("node:fs"); }', "EV010"));
  assertFalse(hasRule('const { require } = mock; const fs = require("node:fs");', "EV010"));
});

it("tracks yielded results to nested assertion arguments through exact lexical bindings", () => {
  assertTrue(
    hasRule(
      'it.effect("result", Fx.fnUntraced(function* () { const missing = yield* Fx.result(program); expect(R.isFailure(missing)).toBe(true); }));',
      "EV005"
    )
  );
  assertFalse(
    hasRule(
      'it.effect("shadow", Fx.fnUntraced(function* () { const missing = yield* Fx.result(program); { const missing = other; expect(R.isFailure(missing)).toBe(true); } }));',
      "EV005"
    )
  );
  assertFalse(
    hasRule(
      'it.effect("unasserted", Fx.fnUntraced(function* () { const missing = yield* Fx.result(program); return missing; }));',
      "EV005"
    )
  );
});

it("recognizes public boolean assertions while preserving aliases, shadows and specialized helpers", () => {
  for (const assertion of [
    'import { assertTrue as check } from "@effect/vitest/utils"; it("x", () => check(O.isSome(value)));',
    'import * as U from "@effect/vitest/utils"; it("x", () => U.assertFalse(X.isFailure(value)));',
    'import { assert as check } from "@effect/vitest"; it("x", () => check.isTrue(R.isFailure(value)));',
    'import { ok as check } from "node:assert/strict"; it("x", () => check(O.isNone(value)));',
  ])
    assertTrue(hasRule(assertion, "EV006"));
  assertFalse(
    hasRule(
      'import { assertTrue as check } from "@effect/vitest/utils"; it("x", (check) => check(O.isSome(value)));',
      "EV006"
    )
  );
  assertFalse(
    hasRule(
      'import { assertTrue, assertSome } from "@effect/vitest/utils"; it("x", () => { assertTrue(value > 0); assertSome(option, 1); });',
      "EV006"
    )
  );
});

it("keeps piped fork cancellation as judgment without hiding a subsequent direct wait", () => {
  const rows = findings(
    'import { Fiber } from "effect"; it.effect("cancel", Fx.fnUntraced(function* () { const fiber = yield* transaction(() => Fx.sleep("1 hour")).pipe(Fx.forkChild({ startImmediately: true })); yield* Fiber.interrupt(fiber); yield* Fx.sleep("1 second"); }));'
  );
  assertTrue(A.filter(rows, (row) => row.ruleId === "EV008" && row.mechanization === "judgment").length === 1);
  assertTrue(A.filter(rows, (row) => row.ruleId === "EV008" && row.mechanization === "detector").length === 1);
});

it("recognizes namespace tmpdir imports and CommonJS controls without accepting shadowed receivers", () => {
  for (const text of [
    'import * as os from "node:os"; it("x", () => os.tmpdir());',
    'import os from "node:os"; it("x", () => os.tmpdir());',
    'const os = require("node:os"); it("x", () => os.tmpdir());',
    'it("x", () => require("node:os").tmpdir());',
  ])
    assertTrue(hasRule(text, "EV010"));
  assertFalse(hasRule('const os = require("node:os"); it("x", (os) => os.tmpdir());', "EV010"));
  assertFalse(hasRule('for (const require of loaders) { require("node:fs"); }', "EV010"));
  assertTrue(hasRule('import assert from "node:assert/strict"; it("x", () => assert(O.isSome(value)));', "EV006"));
});

it("retains root namespace provenance for boolean assertions and live clock wrappers", () => {
  assertTrue(
    hasRule('import * as V from "@effect/vitest"; it("x", () => V.assert.isFalse(O.isNone(value)));', "EV006")
  );
  assertFalse(
    hasRule(
      'import * as Testing from "effect/testing"; it.effect("x", () => Fx.sleep("1 second").pipe(Testing.TestClock.withLive));',
      "EV008"
    )
  );
  assertTrue(
    hasRule(
      'import { assertTrue as check } from "@effect/vitest/utils"; it.effect("x", Fx.fnUntraced(function* () { const result = yield* Fx.result(program); check(R.isFailure(result)); }));',
      "EV005"
    )
  );
});

it("does not assign allocating-provider findings to local pure layer builds or unrelated imported helpers", () => {
  assertFalse(
    hasRule(
      'const supply = effect => Fx.scoped(L.build(L.succeed(Service, {})).pipe(Fx.flatMap(context => effect.pipe(Fx.provide(context))))); it.effect("x", () => supply(program));',
      "EV003"
    )
  );
  assertFalse(
    hasRule(
      'import { provideScopedLayer } from "unrelated"; it.effect("x", () => provideScopedLayer(Resource)(program));',
      "EV002"
    )
  );
  const rows = findings(
    'import { provideScopedLayer } from "@beep/test-utils"; it.effect("x", () => provideScopedLayer(L.effect(Service, acquire))(program));'
  );
  assertTrue(A.filter(rows, (row) => row.ruleId === "EV002").length === 1);
});

it("attributes same-file runtime and property helpers once through transitive callers", () => {
  const rows = findings(`
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
});

it("respects same-file helper binding shadows, unused definitions and imported runtime aliases", () => {
  assertTrue(
    hasRule(
      'import { runSync as run } from "effect/Effect"; const helper = () => run(program); it("x", () => helper());',
      "EV001"
    )
  );
  assertFalse(hasRule('const helper = () => Fx.runSync(program); it("x", (helper) => helper());', "EV001"));
  assertFalse(
    hasRule(
      'const helper = () => Fx.runSync(program); const alias = () => { const helper = () => 1; return helper(); }; it("x", () => alias());',
      "EV001"
    )
  );
  assertFalse(
    hasRule(
      'const helper = () => { function unused() { Fx.runSync(program); } return 1; }; it("x", () => helper());',
      "EV001"
    )
  );
  assertFalse(hasRule('const helper = (Fx) => Fx.runSync(program); it("x", () => helper(fake));', "EV001"));
});

it("terminates on reachable and dead same-file call cycles without multiplying findings", () => {
  const rows = findings(`
    function first() { return second(); }
    function second() { if (condition) first(); return Fx.runSync(program); }
    function deadFirst() { return deadSecond(); }
    function deadSecond() { deadFirst(); return Fx.runSync(unused); }
    it("cycle", () => first());
  `);
  assertTrue(A.filter(rows, (row) => row.ruleId === "EV001").length === 1);
  assertTrue(A.some(rows, (row) => row.ruleId === "EV001" && row.evidence === "Fx.runSync(program)"));
});

it("keeps module-only helpers out of test findings and mixed callers as judgments", () => {
  const helpers =
    "const run = () => Fx.runSync(program); const check = () => fc.assert(fc.property(fc.string(), () => true)); const scoped = () => Fx.scoped(program);";
  const setupOnly = findings(`${helpers} run(); check(); scoped(); it("other", () => 1);`);
  assertFalse(A.some(setupOnly, (row) => A.contains(["EV001", "EV007", "EV004"], row.ruleId)));
  const shared = findings(
    `${helpers} run(); check(); scoped(); it.effect("x", () => { run(); check(); return scoped(); });`
  );
  for (const rule of ["EV001", "EV007", "EV004"])
    assertTrue(A.some(shared, (row) => row.ruleId === rule && row.mechanization === "judgment"));
});

it("never declares helper scopes redundant from reachability or repeated calls alone", () => {
  const helper = "const scoped = () => Fx.scoped(program);";
  const single = findings(`${helper} it.effect("x", () => scoped());`);
  assertTrue(
    A.some(
      single,
      (row) =>
        row.ruleId === "EV004" && row.class === "helper-scope-lifetime-review" && row.mechanization === "judgment"
    )
  );
  const repeated = findings(
    `${helper} it.effect("x", Fx.fnUntraced(function* () { yield* scoped(); yield* scoped(); }));`
  );
  assertTrue(A.filter(repeated, (row) => row.ruleId === "EV004").length === 1);
  assertTrue(
    A.every(
      A.filter(repeated, (row) => row.ruleId === "EV004"),
      (row) => row.mechanization === "judgment"
    )
  );
  assertFalse(hasRule(`${helper} it("plain", () => scoped());`, "EV004"));
  const mixed = findings(`${helper} it("plain", () => scoped()); it.effect("effect", () => scoped());`);
  assertTrue(A.some(mixed, (row) => row.ruleId === "EV004" && row.class === "shared-helper-scope-lifetime-review"));
});

it("retains deliberate inner helper scopes and the existing direct whole-body distinction", () => {
  const rows = findings(`
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
        row.ruleId === "EV004" && row.class === "inner-helper-scope-lifetime-review" && row.mechanization === "judgment"
    )
  );
  assertTrue(
    A.some(
      rows,
      (row) => row.ruleId === "EV004" && row.class === "redundant-whole-body-scope" && row.mechanization === "detector"
    )
  );
  assertFalse(
    hasRule(
      'const stubbed = () => Fx.provide(program, L.succeed(Service, {})); it.effect("x", () => stubbed());',
      "EV002"
    )
  );
});

it("recognizes registered helper callbacks and keeps escaped or uncertain callback uses as judgments", () => {
  assertTrue(hasRule('const helper = () => Fx.runSync(program); it.each([1])("x", helper);', "EV001"));
  const exported = findings('export const helper = () => Fx.runSync(program); it("x", () => helper());');
  assertTrue(A.some(exported, (row) => row.ruleId === "EV001" && row.mechanization === "judgment"));
  const callback = findings(
    'const helper = () => subject.evaluate(() => Fx.runSync(program)); it("x", () => helper());'
  );
  assertTrue(A.some(callback, (row) => row.ruleId === "EV001" && row.mechanization === "judgment"));
});

it("does not treat type-only references or object keys as non-test helper callers", () => {
  const rows = findings(
    'const helper = () => Fx.runSync(program); type Signature = typeof helper; const object = { helper: 1 }; it("x", () => helper());'
  );
  assertTrue(A.some(rows, (row) => row.ruleId === "EV001" && row.mechanization === "detector"));
  const exported = findings('const helper = () => Fx.runSync(program); export { helper }; it("x", () => helper());');
  assertTrue(A.some(exported, (row) => row.ruleId === "EV001" && row.mechanization === "judgment"));
});

it("compares lexical declarations by identity without opening semantic compiler getters", () => {
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
    const rows = detectEffectVitestFindings(source, "packages/example/test/identity.test.ts", "@beep/example");
    assertTrue(A.some(rows, (row) => row.ruleId === "EV005"));
    assertTrue(A.filter(rows, (row) => row.ruleId === "EV010").length === 1);
    assertTrue(program.mock.calls.length === 0, "Syntax detection must not create a compiler program");
    assertTrue(checker.mock.calls.length === 0, "Syntax detection must not create a typechecker");
  } finally {
    checker.mockRestore();
    program.mockRestore();
  }
});

it("keeps cached lexical scopes isolated across files and fresh passes after edits", () => {
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
  const first = detectEffectVitestFindings(source, "packages/example/test/first.test.ts", "@beep/example");
  assertTrue(A.filter(first, (row) => row.ruleId === "EV001").length === 1);
  deepStrictEqual(
    detectEffectVitestFindings(
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
    A.some(detectEffectVitestFindings(other, "other.test.ts", "@beep/example"), (row) => row.ruleId === "EV001")
  );
  source.replaceWithText(shadowed);
  assertFalse(
    A.some(detectEffectVitestFindings(source, "first.test.ts", "@beep/example"), (row) => row.ruleId === "EV001")
  );
  source.replaceWithText(original);
  deepStrictEqual(detectEffectVitestFindings(source, "packages/example/test/first.test.ts", "@beep/example"), first);
});

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

it("detects native Arbitrary checks through public barrel, subpath and named aliases", () => {
  for (const declaration of [
    'import { Arbitrary as Ar } from "effect/unstable/arbitrary";',
    'import * as Ar from "effect/unstable/arbitrary/Arbitrary";',
  ]) {
    const rows = findings(`${declaration}\nit.effect("native", () => Ar.checkEffect(arb, predicate));`);
    const row = A.findFirst(rows, (candidate) => candidate.ruleId === "EV007");
    row.pipe(O.isSome, assertTrue);
    assertTrue(O.exists(row, (candidate) => candidate.class === "direct-arbitrary-check"));
    assertTrue(O.exists(row, (candidate) => candidate.mechanization === "detector"));
    assertTrue(O.exists(row, (candidate) => candidate.replacement.primitive === "it.effect.prop"));
  }
  assertTrue(
    hasRule(
      'import * as Native from "effect/unstable/arbitrary"; it.effect("barrel", () => Native.Arbitrary.checkEffect(arb, predicate));',
      "EV007"
    )
  );
  assertTrue(
    hasRule(
      'import { checkEffect as check } from "effect/unstable/arbitrary/Arbitrary"; it.effect("native", () => check(arb, predicate));',
      "EV007"
    )
  );
});

it("keeps native property checks lexical and excludes canonical registrations and sampling", () => {
  for (const body of [
    'import { Arbitrary as Ar } from "effect/unstable/arbitrary"; it.effect("shadow", (Ar) => Ar.checkEffect(arb, predicate));',
    'import { Arbitrary as Ar } from "unrelated"; it.effect("other", () => Ar.checkEffect(arb, predicate));',
    'import { Arbitrary as Ar } from "effect/unstable/arbitrary"; it.effect("sample", () => Ar.sampleEffect(arb));',
    'import { Arbitrary as Ar } from "effect/unstable/arbitrary"; it.effect.prop("canonical", { value: arb }, predicate);',
  ])
    assertFalse(hasRule(body, "EV007"));
});

it("retains native property helper reachability, shared judgment and callback execution", () => {
  const prefix = 'import { Arbitrary as Ar } from "effect/unstable/arbitrary";';
  const local = findings(`${prefix}
    const check = Fx.fnUntraced(function* () { yield* Ar.checkEffect(arb, () => Fx.sync(() => true)); });
    it.effect("first", () => check()); it.effect("second", () => check());`);
  assertTrue(
    A.filter(local, (row) => row.ruleId === "EV007" && row.class === "direct-arbitrary-check").length === 1,
    A.join(
      A.map(local, (row) => `${row.ruleId}:${row.class}:${row.evidence}`),
      "\n"
    )
  );
  const shared = findings(`${prefix}
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
  const callback = findings(`${prefix}
    it.effect("callback", () => Ar.checkEffect(arb, () => Fx.runSync(program)));`);
  assertTrue(A.some(callback, (row) => row.ruleId === "EV001" && row.mechanization === "detector"));
});

it("distinguishes deferred service waits from directly executed and uncertain helper waits", () => {
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
    const rows = A.filter(findings(example.body), (row) => row.ruleId === "EV008");
    deepStrictEqual(
      A.map(rows, (row) => [row.mechanization, row.class]),
      [[example.mode, example.className]]
    );
  }
});

it("retains live-only helper semantics and visible mixed clock ownership", () => {
  assertFalse(
    hasRule(
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
      findings(`const wait = Fx.fnUntraced(function* () { yield* Fx.sleep("1 second"); }); ${A.join(ordered, "\n")}`),
      (row) => row.ruleId === "EV008"
    );
    deepStrictEqual(
      A.map(rows, (row) => row.mechanization),
      ["judgment"]
    );
  }
});

it("uses exact utils Option wrapper provenance without classifying projected plain payloads", () => {
  for (const body of [
    `import * as Wrapped from "@beep/utils/Option"; it("x", () => expect(Wrapped.isNone(value)).toBe(true));`,
    `import { isSome as present } from "@beep/utils/Option"; it("x", () => expect(present(value)).toBe(true));`,
    `import { none as absent, some as present } from "@beep/utils/Option"; it("x", () => { expect(value).toEqual(absent()); expect(value).toEqual(present(1)); });`,
  ])
    assertTrue(hasRule(body, "EV006"));
  for (const body of [
    `import * as Wrapped from "@beep/utils/Option"; it("x", (Wrapped) => expect(Wrapped.isNone(value)).toBe(true));`,
    `import { isSome as present } from "@beep/utils/Option"; it("x", () => { const present = fake; expect(present(value)).toBe(true); });`,
    `import * as Wrapped from "@beep/utils/OptionOther"; it("x", () => expect(Wrapped.isNone(value)).toBe(true));`,
    `import * as Wrapped from "@beep/utils/Option"; it("x", () => expect(Wrapped.getOrElse(value, () => "fallback")).toEqual("label"));`,
    `it("x", () => { expect(O.getOrThrow(value).path).toEqual("label"); expect(R.getOrThrow(result)).toBe(1); });`,
  ])
    assertFalse(hasRule(body, "EV006"));
});

it("narrows root platform and CommonJS imports to filesystem provenance and explicit opaque residue", () => {
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
        A.filter(findings(body), (row) => row.ruleId === "EV010"),
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
    assertFalse(hasRule(body, "EV010"));
  const residue = A.filter(
    findings(`import { NodeServices } from "@effect/platform-node"; use(NodeServices.layer);`),
    (row) => row.ruleId === "EV010"
  );
  deepStrictEqual(
    A.map(residue, (row) => [row.class, row.mechanization]),
    [["platform-resource-provenance-review", "judgment"]]
  );
  assertTrue(A.every(residue, (row) => row.replacement.sketch.includes("unproven")));
});

it("indexes for-of and for-in retry candidates with explicit loop presence and ordinary loop negatives", () => {
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
    detectEffectVitestFindings(source, "loops.test.ts", "@beep/example"),
    (row) => row.ruleId === "EV013"
  );
  deepStrictEqual(
    A.map(rows, (row) => row.mechanization),
    ["judgment", "judgment"]
  );
  assertTrue(rows[0]?.evidence.includes("attempt"));
  assertTrue(rows[1]?.evidence.includes("retry"));
  assertFalse(
    hasRule(
      `for (const retry in retries) consume(retry); it("x", () => { for (const value of values) consume(value); });`,
      "EV013"
    )
  );
});

it("retains shared deterministic clock review for nested single-test and reset/concurrent layers", () => {
  for (const body of [
    `it.layer(resource)("parent", (it) => { it.layer(child)("single", (it) => { it.effect("timeout", function* () { const fiber = yield* Fx.forkChild(Fx.timeoutOption(work, "1 second")); yield* TC.adjust("1 second"); yield* Fiber.join(fiber); }); }); });`,
    `it.layer(resource)("shared", (it) => { beforeEach(() => TC.setTime(0)); it.effect.concurrent("a", () => TC.adjust("1 second")); it.effect.concurrent("b", () => TC.adjust("2 seconds")); });`,
  ]) {
    const rows = A.filter(findings(body), (row) => row.ruleId === "EV015");
    assertTrue(rows.length > 0);
    assertTrue(
      A.every(rows, (row) => row.mechanization === "judgment" && row.replacement.primitive === "TestClock.adjust")
    );
    assertTrue(
      A.every(
        rows,
        (row) =>
          row.replacement.sketch.includes("not concurrency isolation") &&
          row.replacement.sketch.includes("intentional live")
      )
    );
  }
});

it("routes data assertions by family, polarity and supplied operands without inventing payloads", () => {
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
    ["expect(A.every(values, O.isNone)).toBe(true)", "utils.deepStrictEqual", "judgment"],
  ];
  for (const [assertion, primitive, mode] of examples) {
    const rows = A.filter(
      findings(`import * as A from "effect/Array"; it("route", () => ${assertion});`),
      (row) => row.ruleId === "EV006"
    );
    deepStrictEqual(
      A.map(rows, (row) => [row.replacement.primitive, row.mechanization]),
      [[primitive, mode]]
    );
  }
  assertFalse(hasRule(`it("plain", () => expect(R.getOrThrow(value).path).toBe("label"));`, "EV006"));
});

it("distinguishes unknown codec module mocks from binding-proven local service candidates", () => {
  const rows = findings(
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
      (row) => row.replacement.sketch.includes("real service key")
    )
  );
  assertFalse(hasRule(`vi.spyOn(Math, "random");`, "EV012"));
  assertFalse(
    hasRule(`function test(Context) { class Fake extends Context.Service() {} vi.spyOn(Fake, "method"); }`, "EV012")
  );
});

it("retains CommonJS tmpdir aliases without matching declaration text or shadows", () => {
  assertTrue(hasRule(`const { tmpdir: temporary } = require("node:os"); it("x", () => temporary());`, "EV010"));
  assertFalse(
    hasRule(`const { tmpdir: temporary } = require("node:os"); it("x", (temporary) => temporary());`, "EV010")
  );
  assertFalse(hasRule(`import * as os from "node:os"; const text = "tmpdir";`, "EV010"));
});

it.each([
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
  ({ predicate, truth, primitive, mode, polarity, requirement }) => {
    const expression = `${predicate}(value)`;
    for (const assertion of [
      `expect(${expression}).toBe(${truth})`,
      `${truth ? "assertTrue" : "assertFalse"}(${expression})`,
    ]) {
      const rows = A.filter(
        findings(`import { assertTrue, assertFalse } from "@effect/vitest/utils"; it("residue", () => ${assertion});`),
        (row) => row.ruleId === "EV006"
      );
      deepStrictEqual(
        A.map(rows, (row) => [row.replacement.primitive, row.mechanization]),
        [[primitive, mode]]
      );
      assertTrue(A.every(rows, (row) => row.evidence.includes(expression)));
      assertTrue(A.every(rows, (row) => row.replacement.sketch.includes(polarity)));
      assertTrue(A.every(rows, (row) => row.replacement.sketch.includes(requirement)));
    }
  }
);

it.each([
  { root: "@effect/platform-node", services: "NodeServices", path: "NodePath", spawner: "NodeChildProcessSpawner" },
  { root: "@effect/platform-bun", services: "BunServices", path: "BunPath", spawner: "BunChildProcessSpawner" },
])("retains exact $services root/subpath resource review parity", ({ root, services }) => {
  const expected = A.map(
    A.filter(
      findings(`import { ${services} as Services } from "${root}"; use(Services.layer);`),
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
    const rows = A.filter(findings(body), (row) => row.ruleId === "EV010");
    deepStrictEqual(
      A.map(rows, (row) => [row.class, row.mechanization, row.replacement]),
      expected
    );
    assertTrue(A.every(rows, (row) => row.replacement.sketch.includes("filesystem use is unproven")));
  }
});

it.each([
  { root: "@effect/platform-node", services: "NodeServices", path: "NodePath", spawner: "NodeChildProcessSpawner" },
  { root: "@effect/platform-bun", services: "BunServices", path: "BunPath", spawner: "BunChildProcessSpawner" },
])("excludes type-only, shadowed and unrelated $services imports", ({ root, services, path, spawner }) => {
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
    assertFalse(hasRule(body, "EV010"));
});

it.each([
  `expect(decode(CapturedSanityRequestBodyJson, O.getOrThrow(bodyText ?? O.none()))).toEqual({ params: {}, query: "query" });`,
  `expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(raw.session_id, O.none()));`,
  `expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(base.session_id, O.none()));`,
  `expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(legacy.sessionId, O.none()));`,
  `expect(Fx.runSync(Arbitrary.checkEffect(Arbitrary.all([Arbitrary.filter(PackageJsonDependenciesArbitrary, O.isSome)]), ([value]) => { expect(decode(encode(value))).toEqual(value); return true; }, fcRuns(20)))._tag).toBe("Passed");`,
  `expect(Fx.runSync(Arbitrary.checkEffect(Arbitrary.all([Arbitrary.filter(NpmPackageJsonPeerDependenciesMetaArbitrary, O.isSome)]), ([value]) => { expect(decode(encode(value))).toEqual(value); return true; }, fcRuns(20)))._tag).toBe("Passed");`,
  `expect(Fx.runSync(Arbitrary.checkEffect(arbitrary, (value) => { const record = makeRecord({ harness: O.some(value) }); expect(render(record)).toEqual(expected); return true; }, fcRuns(20)))._tag).toBe("Passed");`,
])("does not infer asserted tagged data from incidental inputs: %s", (body) => {
  assertFalse(hasRule(`it.effect("plain", function* () { ${body} });`, "EV006"));
});

it("keeps direct and compound tagged assertions visible without entering unrelated callbacks", () => {
  for (const expression of [
    "O.isNone(a) && R.isFailure(b)",
    "!X.isSuccess(a)",
    "A.every(values, O.isNone)",
    "A.some(values, R.isFailure)",
  ]) {
    assertTrue(
      hasRule(`import * as A from "effect/Array"; it("compound", () => expect(${expression}).toBe(true));`, "EV006")
    );
  }
  for (const expression of [
    "() => O.isSome(value)",
    "transform(value, () => O.none())",
    "O.some(value).value",
    "Arbitrary.filter(values, O.isSome)",
  ]) {
    assertFalse(hasRule(`it("plain", () => expect(${expression}).toEqual(expected));`, "EV006"));
  }
});

it.each([
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
])("retains a completed public tagged transformation as judgment: %s", (expression) => {
  const rows = A.filter(
    findings(`import { pipe } from "effect"; it("tagged", () => expect(${expression}).toEqual(expected));`),
    (row) => row.ruleId === "EV006"
  );
  deepStrictEqual(
    A.map(rows, (row) => [row.mechanization, row.replacement.primitive]),
    [["judgment", "utils.deepStrictEqual"]]
  );
  assertTrue(A.every(rows, (row) => row.evidence.includes("expect(")));
});

it.each([
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
])("retains composed tagged predicates without claiming a payload: %s", (expression) => {
  for (const truth of [true, false]) {
    const rows = A.filter(
      findings(
        `import { pipe } from "effect"; import { isNone } from "effect/Option"; import * as A from "effect/Array"; import * as Utils from "@beep/utils"; import { A as Wrapped } from "@beep/utils"; it("predicate", () => expect(${expression}).toBe(${truth}));`
      ),
      (row) => row.ruleId === "EV006"
    );
    deepStrictEqual(
      A.map(rows, (row) => row.mechanization),
      ["judgment"]
    );
    assertTrue(A.every(rows, (row) => row.evidence.includes(`toBe(${truth})`)));
  }
});

it.each([
  "yield* Fx.exit(program)",
  "yield* Fx.result(program)",
  "yield* validate({ expectedInfo: O.none() }).pipe(Fx.exit)",
  "yield* validate({ expectedInfo: O.some(info) }).pipe(Fx.result)",
  "yield* pipe(program, Fx.exit)",
])("recognizes executed tagged outcomes rather than their unevaluated Effects: %s", (expression) => {
  const rows = A.filter(
    findings(
      `import { pipe } from "effect"; it.effect("outcome", function* () { expect(${expression}).toMatchObject({ _tag: "Failure" }); });`
    ),
    (row) => row.ruleId === "EV006"
  );
  deepStrictEqual(
    A.map(rows, (row) => [row.mechanization, row.replacement.primitive]),
    [["judgment", "utils.deepStrictEqual"]]
  );
});

it.each([
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
])("does not infer tagged return values across a plain or incomplete boundary: %s", (expression) => {
  assertFalse(
    hasRule(
      `import { pipe } from "effect"; import * as A from "effect/Array"; it.effect("plain", function* () { expect(${expression}).toBeDefined(); });`,
      "EV006"
    )
  );
});

it("requires exact provenance for computed transforms, pipe predicates and Array facades", () => {
  for (const body of [
    `import { map as mapped } from "effect/Option"; it("alias", () => expect(mapped(option, transform)).toEqual(expected));`,
    `import * as Wrapped from "@beep/utils/Option"; it("alias", () => expect(Wrapped.map(option, transform)).toEqual(expected));`,
    `import * as Wrapped from "@beep/utils/Array"; it("alias", () => expect(Wrapped.some(values, O.isSome)).toBe(true));`,
  ])
    assertTrue(hasRule(body, "EV006"));
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
    assertFalse(hasRule(body, "EV006"));
});
