import { fileURLToPath } from "node:url";
import {
  countEffectVitestSourceLines,
  detectEffectVitestFindings,
  diffEffectVitestFindings,
  discoverEffectVitestSourcePaths,
  EffectVitestFinding,
  EffectVitestInventoryDocument,
  EffectVitestPackageTiming,
  EffectVitestReplacement,
  makeEffectVitestFindingKey,
  preserveEffectVitestExceptions,
  readEffectVitestPrimitiveGraph,
  verifyEffectVitestPin,
} from "@beep/repo-cli/commands/Lint";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Project } from "ts-morph";

const discoveryLayer = Layer.mergeAll(NodeServices.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer)));
const repositoryRoot = fileURLToPath(new URL("../../../../..", import.meta.url));

const finding = (line: number, evidence: string, ordinal = 1): EffectVitestFinding =>
  EffectVitestFinding.make({
    id: `EV001:packages/example/test/a.test.ts:${line}:runSync@4#${ordinal}`,
    lens: "detector",
    ruleId: "EV001",
    package: "@beep/example",
    file: "packages/example/test/a.test.ts",
    line,
    endLine: O.some(line),
    symbol: O.some("runSync"),
    testName: O.some("example"),
    class: "runtime-boundary-in-test",
    evidence,
    replacement: EffectVitestReplacement.make({ primitive: "it.effect", sketch: "Return the Effect." }),
    severity: "major",
    confidence: 0.95,
    mechanization: "detector",
    status: "open",
    reason: O.none(),
    fixSha: O.none(),
  });

it("uses the P0a physical-line convention", () => {
  assertTrue(countEffectVitestSourceLines("") === 0);
  assertTrue(countEffectVitestSourceLines("one") === 1);
  assertTrue(countEffectVitestSourceLines("one\ntwo") === 2);
  assertTrue(countEffectVitestSourceLines("one\ntwo\n") === 2);
});

it.layer(discoveryLayer, { timeout: "30 seconds" })("discovery filesystem", (it) => {
  it.effect(
    "discovers the exact D9 fixture set through FsUtils before constructing the Project",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-vitest-discovery-" });
      const included = [
        "apps/labs/demo/test/App.test.ts",
        "packages/demo/test/Example.test.ts",
        "packages/demo/test/support.ts",
      ];
      const excluded = [
        "effect-vitest-lab/test/Stale.test.ts",
        "goals/effect-vitest-canon/test/Packet.test.ts",
        "packages/demo/node_modules/dep/test/Dependency.test.ts",
        "packages/demo/src/Subject.ts",
      ];
      yield* Effect.forEach(
        [...included, ...excluded],
        Effect.fnUntraced(function* (relativePath) {
          const absolutePath = path.join(root, relativePath);
          yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
          yield* fs.writeFileString(absolutePath, "export const fixture = true;\n");
        }),
        { concurrency: 1, discard: true }
      );

      const discovered = yield* discoverEffectVitestSourcePaths(root);
      const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
      project.addSourceFilesAtPaths(discovered);
      const projectPaths = A.map(project.getSourceFiles(), (sourceFile) =>
        Str.replace(`${root}/`, "")(sourceFile.getFilePath())
      );
      assertTrue(
        projectPaths.length === included.length &&
          A.every(included, (relativePath) => A.contains(projectPaths, relativePath))
      );
    })
  );

  it.effect(
    "rejects an installed Effect Vitest version outside the rc.112 pin",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-vitest-pin-" });
      const packagePath = path.join(root, "node_modules/@effect/vitest/package.json");
      yield* fs.makeDirectory(path.dirname(packagePath), { recursive: true });
      yield* fs.writeFileString(packagePath, '{"name":"@effect/vitest","version":"4.0.0-rc.111"}\n');

      const failure = yield* verifyEffectVitestPin(root, graph).pipe(Effect.flip);
      assertTrue(failure._tag === "EffectVitestLintError");
      assertTrue(Str.includes("4.0.0-rc.112")(failure.message));
    })
  );
});

it("accepts EV and lens rule identifiers at the shared finding boundary", () => {
  assertTrue(S.is(EffectVitestFinding)(finding(4, "Fx.runSync(program)")));
  assertTrue(
    S.is(EffectVitestFinding)(
      EffectVitestFinding.make({ ...finding(4, "resource"), ruleId: "L-RES-01", lens: "resource" })
    )
  );
});

it("rejects unordered lines and exceptions without reasons", () => {
  const base = finding(4, "Fx.runSync(program)");
  assertFalse(S.is(EffectVitestFinding)({ ...base, endLine: O.some(3) }));
  assertFalse(S.is(EffectVitestFinding)({ ...base, status: "exception", reason: O.none() }));
  assertFalse(S.is(EffectVitestFinding)({ ...base, class: "flaky-test-wrap", reason: O.none() }));
  assertTrue(
    S.is(EffectVitestFinding)(
      EffectVitestFinding.make({ ...base, status: "exception", reason: O.some("legacy integration boundary") })
    )
  );
  assertTrue(
    S.is(EffectVitestFinding)(
      EffectVitestFinding.make({ ...base, class: "flaky-test-wrap", reason: O.some("external OS timing") })
    )
  );
});

it("keeps package test timing distinct from detector scan timing", () => {
  assertTrue(
    S.is(EffectVitestPackageTiming)(
      EffectVitestPackageTiming.make({
        package: "@beep/example",
        runner: "node-vitest",
        capturedAt: "2026-09-08T20:00:00.000Z",
        totalMs: 12,
        testCount: 1,
        files: [{ file: "test/a.test.ts", ms: 12, tests: 1 }],
        slowest: [{ file: "test/a.test.ts", testName: "example", ms: 12 }],
      })
    )
  );
});

it("classifies baseline growth and resolution with the shared membership semantics", () => {
  const row = finding(4, "Fx.runSync(program)");
  assertTrue(diffEffectVitestFindings([row], []).introduced.length === 1);
  assertTrue(diffEffectVitestFindings([], [row]).resolved.length === 1);
});

it("preserves a justified exception on the matching live row", () => {
  const live = EffectVitestFinding.make({
    ...finding(8, "Fx.runSync(program)"),
    occurrence: O.some(`v2:${"a".repeat(64)}`),
  });
  const baselineFinding = EffectVitestFinding.make({
    ...live,
    line: 4,
    endLine: O.some(4),
    status: "exception",
    reason: O.some("legacy runtime boundary"),
  });
  const document = EffectVitestInventoryDocument.make({
    schemaVersion: "effect-vitest-inventory/v1",
    effectVitestVersion: "4.0.0-rc.112",
    scope: [],
    findings: [baselineFinding],
  });
  const preserved = preserveEffectVitestExceptions([live], O.some(document));
  assertTrue(preserved[0]?.status === "exception");
  assertTrue(O.contains(preserved[0]?.reason ?? O.none(), "legacy runtime boundary"));
  assertTrue(preserved[0]?.line === 8);
});

it("ignores unrelated line shifts but distinguishes same-fingerprint occurrences", () => {
  const before = finding(4, "Fx.runSync(program)");
  const shifted = finding(14, "Fx.runSync(program)");
  const duplicate = finding(14, "Fx.runSync(program)", 2);
  assertTrue(makeEffectVitestFindingKey(before) === makeEffectVitestFindingKey(shifted));
  assertFalse(makeEffectVitestFindingKey(shifted) === makeEffectVitestFindingKey(duplicate));
  assertTrue(diffEffectVitestFindings([shifted], [before]).introduced.length === 0);
});

const occurrences = (body: string) => {
  const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
    "identity.test.ts",
    `import { Effect } from "effect"; import { it } from "@effect/vitest"; ${body}`
  );
  return A.filter(
    detectEffectVitestFindings(source, "packages/example/test/identity.test.ts", "@beep/example"),
    (row) => row.ruleId === "EV001"
  );
};
const withException = (rows: ReadonlyArray<EffectVitestFinding>) =>
  EffectVitestInventoryDocument.make({
    schemaVersion: "effect-vitest-inventory/v1",
    effectVitestVersion: "4.0.0-rc.112",
    scope: [],
    findings: A.map(rows, (row, index) =>
      index === 0
        ? EffectVitestFinding.make({ ...row, status: "exception", reason: O.some("reviewed first occurrence only") })
        : row
    ),
  });

it("keeps named occurrences stable across reordering and deletion without transferring exceptions", () => {
  const a = 'it("first", () => { Effect.runSync(program); });';
  const b = 'it("second", () => { Effect.runSync(program); });';
  const before = occurrences(a + b);
  const reordered = occurrences(`\n${b}\n${a}`);
  assertTrue(diffEffectVitestFindings(reordered, before).introduced.length === 0);
  const preserved = preserveEffectVitestExceptions(reordered, O.some(withException(before)));
  assertTrue(preserved[0]?.status === "open");
  assertTrue(preserved[1]?.status === "exception");
  const remaining = preserveEffectVitestExceptions(occurrences(b), O.some(withException(before)));
  assertTrue(remaining[0]?.status === "open");
});

it("refuses ambiguous duplicate exception inheritance even after the first duplicate disappears", () => {
  const before = occurrences('it("same", () => { Effect.runSync(program); Effect.runSync(program); });');
  const after = occurrences('it("same", () => { Effect.runSync(program); });');
  assertTrue(before.length === 2 && after.length === 1);
  assertTrue(
    A.every(preserveEffectVitestExceptions(before, O.some(withException(before))), (row) => row.status === "open")
  );
  assertTrue(preserveEffectVitestExceptions(after, O.some(withException(before)))[0]?.status === "open");
});

it("bridges only unique legacy fingerprints and keeps legacy duplicate migrations visible", () => {
  const live = occurrences('it("same", () => { Effect.runSync(program); });');
  const legacy = A.map(live, (row) => EffectVitestFinding.make({ ...row, occurrence: O.none() }));
  assertTrue(diffEffectVitestFindings(live, legacy).introduced.length === 0);
  assertTrue(preserveEffectVitestExceptions(live, O.some(withException(legacy)))[0]?.status === "open");
  const duplicates = [
    ...legacy,
    ...A.map(legacy, (row) => EffectVitestFinding.make({ ...row, id: Str.replace("#1", "#2")(row.id) })),
  ];
  assertTrue(diffEffectVitestFindings(live, duplicates).introduced.length === 1);
  assertTrue(preserveEffectVitestExceptions(live, O.some(withException(duplicates)))[0]?.status === "open");
});

it("retains full token evidence beyond the display limit and significant literal whitespace", () => {
  const prefix = "a".repeat(240);
  const before = occurrences(`it("x", () => { Effect.runSync(subject("${prefix}a  b")); });`);
  const after = occurrences(`it("x", () => { Effect.runSync(subject("${prefix}a b")); });`);
  assertTrue(before[0]?.evidence === after[0]?.evidence);
  assertTrue(diffEffectVitestFindings(after, before).introduced.length === 1);
});

it("validates optional occurrence anchors without rejecting legacy inventory rows", () => {
  const base = finding(4, "Fx.runSync(program)");
  assertTrue(S.is(EffectVitestFinding)(base));
  assertFalse(S.is(EffectVitestFinding)({ ...base, occurrence: O.some("v2:not-a-digest") }));
  assertTrue(A.every(occurrences('it("x", () => Effect.runSync(program));'), S.is(EffectVitestFinding)));
});

it("requires re-review of a unique legacy exception when historical statement or context is unknowable", () => {
  const prefix = "a".repeat(240);
  const original = occurrences(`it("original", () => { Effect.runSync(subject("${prefix}before")); });`);
  const legacy = A.map(original, (row) => EffectVitestFinding.make({ ...row, occurrence: O.none() }));
  const document = O.some(withException(legacy));
  const changedTail = occurrences(`it("original", () => { Effect.runSync(subject("${prefix}after")); });`);
  const changedContext = occurrences(`it("different", () => { Effect.runSync(subject("${prefix}before")); });`);
  for (const live of [original, changedTail, changedContext, legacy]) {
    assertTrue(live.length === 1 && live[0]?.evidence === legacy[0]?.evidence);
    assertTrue(diffEffectVitestFindings(live, legacy).introduced.length === 0);
    const merged = preserveEffectVitestExceptions(live, document);
    assertTrue(merged[0]?.status === "open");
    assertTrue(O.isNone(merged[0]?.reason ?? O.none()), "Unproved legacy exception reasons must not transfer");
  }
});

it("preserves accepted full-token occurrence digests through iterative leaf traversal", () => {
  // Digests were obtained from the immutable pre-performance occurrenceAnchor,
  // including comment leaves, empty syntax lists, escapes, JSX and helper scope.
  const vectors = [
    {
      body: 'it("empty", () => Effect.runSync({ empty: [], value: "a  b" }));',
      expected: "v2:0a9fb46ffd8f8a490ca94483458b28ea9c1316850ae883d43155a5b5eb0e21db",
    },
    {
      body: 'describe("outer", () => { it("comments", () => { return Effect.runSync(() => { /* retained comment */ return /a\\\\s+/u; }); }); });',
      expected: "v2:768dd5d08992f9831bf31b535c059800f1f2e05004ce1f44c77228d7fb4d6743",
    },
    {
      body: 'it("unicode", () => Effect.runSync(`π\\n${1} \\u{1F680}`));',
      expected: "v2:5eb6f2963008dd966879c7531e091f81aa87e9affb4becd4121ec23160cc9098",
    },
    {
      body: 'it("jsx", () => Effect.runSync(<Box title="a  b">{value}</Box>));',
      expected: "v2:37380087a3bc39e9d9394fdb0476891ecc6f11cb1fedb8a3a6be4604681fb431",
    },
    {
      body: 'function helper() { /** @type {string} */ const label = "kept"; return Effect.runSync(label); } it("helper", () => helper());',
      expected: "v2:c1902c0f48558f336ed37ffc00467ea1452049e794451a458d5ae59d6fec45a0",
    },
  ];
  const prefix = 'import { Effect } from "effect"; import { it, describe } from "@effect/vitest";\n';
  for (const { body, expected } of vectors) {
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
    const source = project.createSourceFile("anchor.test.tsx", prefix + body);
    const row = A.findFirst(
      detectEffectVitestFindings(source, "packages/example/test/anchor.test.tsx", "@beep/example"),
      (finding) => finding.ruleId === "EV001"
    );
    assertSome(
      O.flatMap(row, (finding) => finding.occurrence),
      expected
    );
  }
});
