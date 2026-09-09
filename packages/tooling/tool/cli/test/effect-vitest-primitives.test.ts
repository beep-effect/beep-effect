import { fileURLToPath } from "node:url";
import { fcRuns } from "@beep/fc-runs";
import {
  applyEffectVitestPrimitiveGraph,
  countEffectVitestSourceLines,
  decodeEffectVitestPrimitiveGraphDocument,
  detectEffectVitestFindings,
  EffectVitestFinding,
  EffectVitestPrimitive,
  EffectVitestPrimitiveGraphDocument,
  EffectVitestReplacement,
  indexEffectVitestPrimitives,
  readEffectVitestPrimitiveGraph,
  verifyEffectVitestPin,
} from "@beep/repo-cli/commands/Lint";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, HashMap, Number as Num, Path, Schema } from "effect";
import * as O from "effect/Option";
import * as fc from "effect/testing/FastCheck";
import { Node, Project, SyntaxKind } from "ts-morph";

type SourceAnchor = {
  readonly name: string;
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
};

const repositoryRoot = fileURLToPath(new URL("../../../../..", import.meta.url));
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const fixtureRoot = fileURLToPath(new URL("./fixtures/effect-vitest-rc112", import.meta.url));
const indexFile = "packages/vitest/src/index.ts";
const utilsFile = "packages/vitest/src/utils.ts";
const readmeFile = "packages/vitest/README.md";

const anchor = (name: string, file: string, startLine: number, endLine: number): SourceAnchor => ({
  name,
  file,
  startLine,
  endLine,
});

const readmeHeadingText = (line: string): string =>
  Str.startsWith("### ")(line)
    ? Str.slice(4)(line)
    : Str.startsWith("## ")(line)
      ? Str.slice(3)(line)
      : Str.slice(2)(line);

const finding = EffectVitestFinding.make({
  id: "EV001:packages/example/test/a.test.ts:1:runSync@0#1",
  lens: "detector",
  ruleId: "EV001",
  package: "@beep/example",
  file: "packages/example/test/a.test.ts",
  line: 1,
  endLine: O.some(1),
  symbol: O.some("runSync"),
  testName: O.some("example"),
  class: "runtime-boundary-in-test",
  evidence: "Effect.runSync(program)",
  replacement: EffectVitestReplacement.make({ primitive: "it.effect", sketch: "staging hint" }),
  severity: "major",
  confidence: 0.95,
  mechanization: "detector",
  status: "open",
  reason: O.none(),
  fixSha: O.none(),
});

const assertionFinding = (index: number, evidence: string): EffectVitestFinding =>
  EffectVitestFinding.make({
    ...finding,
    id: `EV006:packages/example/test/a.test.ts:${index}:expect@0#1`,
    ruleId: "EV006",
    class: "hand-rolled-data-assertion",
    evidence,
    replacement: EffectVitestReplacement.make({ primitive: "utils.assertSome", sketch: "staging hint" }),
  });

it.layer(NodeServices.layer, { timeout: "30 seconds" })("pinned primitive graph", (it) => {
  it.prop(
    "executes synchronous property registration with FastCheck Arbitraries",
    { value: fc.integer() },
    ({ value }) => assertTrue(Num.round(value, 0) === value),
    { fastCheck: fcRuns(10) }
  );

  it.effect.prop(
    "executes effect property registration with Schema inputs",
    { value: Schema.Int },
    ({ value }) => Effect.sync(() => assertTrue(Num.round(value, 0) === value)),
    { fastCheck: fcRuns(10) }
  );

  it.effect(
    "derives every index, namespace, option, utils, README, and charter anchor from portable source",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      strictEqual(graph.entries.length, 85);
      const byName = indexEffectVitestPrimitives(
        A.map(graph.entries, (entry) => EffectVitestPrimitive.make({ ...entry, id: entry.name }))
      );
      const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
      const indexText = yield* fs.readFileString(path.join(fixtureRoot, `${indexFile}.txt`));
      const utilsText = yield* fs.readFileString(path.join(fixtureRoot, `${utilsFile}.txt`));
      const sourceIndex = project.createSourceFile(indexFile, indexText);
      const sourceUtils = project.createSourceFile(utilsFile, utilsText);
      const anchors = A.empty<SourceAnchor>();

      const exportStar = A.findFirst(
        sourceIndex.getExportDeclarations(),
        (declaration) => declaration.getModuleSpecifierValue() === "vitest"
      );
      assertTrue(O.isSome(exportStar), "Expected the pinned Vitest barrel re-export");
      anchors.push(
        anchor(
          "module.@effect/vitest",
          indexFile,
          exportStar.value.getStartLineNumber(),
          exportStar.value.getEndLineNumber()
        )
      );

      const api = sourceIndex.getTypeAliasOrThrow("API");
      anchors.push(anchor(api.getName(), indexFile, api.getStartLineNumber(), api.getEndLineNumber()));
      const namespace = sourceIndex.getModuleOrThrow("Vitest");
      anchors.push(
        anchor(namespace.getName(), indexFile, namespace.getStartLineNumber(), namespace.getEndLineNumber())
      );
      const namespaceBody = namespace.getBodyOrThrow();
      assertTrue(Node.isModuleBlock(namespaceBody));
      for (const declaration of [...namespaceBody.getInterfaces(), ...namespaceBody.getTypeAliases()]) {
        anchors.push(
          anchor(
            `Vitest.${declaration.getName()}`,
            indexFile,
            declaration.getStartLineNumber(),
            declaration.getEndLineNumber()
          )
        );
      }
      for (const declaration of sourceIndex.getVariableDeclarations()) {
        anchors.push(
          anchor(declaration.getName(), indexFile, declaration.getStartLineNumber(), declaration.getEndLineNumber())
        );
      }

      for (const interfaceName of ["Tester", "MethodsNonLive", "Methods"]) {
        const declaration = namespaceBody.getInterfaceOrThrow(interfaceName);
        for (const property of declaration.getProperties()) {
          const memberName = `Vitest.${interfaceName}.${property.getName()}`;
          anchors.push(anchor(memberName, indexFile, property.getStartLineNumber(), property.getEndLineNumber()));
          const typeNode = property.getTypeNode();
          if (typeNode !== undefined) {
            for (const option of typeNode.getDescendantsOfKind(SyntaxKind.PropertySignature)) {
              anchors.push(
                anchor(
                  `${memberName}.option.${option.getName()}`,
                  indexFile,
                  option.getStartLineNumber(),
                  option.getEndLineNumber()
                )
              );
            }
          }
        }
      }

      const layerDeclaration = sourceIndex.getVariableDeclarationOrThrow("layer");
      const layerType = layerDeclaration.getTypeNodeOrThrow();
      for (const option of layerType.getDescendantsOfKind(SyntaxKind.PropertySignature)) {
        anchors.push(
          anchor(`layer.option.${option.getName()}`, indexFile, option.getStartLineNumber(), option.getEndLineNumber())
        );
      }

      for (const declaration of A.filter(sourceUtils.getFunctions(), (candidate) => candidate.isExported())) {
        const name = declaration.getName();
        if (name !== undefined) {
          anchors.push(
            anchor(`utils.${name}`, utilsFile, declaration.getStartLineNumber(), declaration.getEndLineNumber())
          );
        }
      }

      const readme = yield* fs.readFileString(path.join(fixtureRoot, readmeFile));
      const readmeLines = Str.split("\n")(readme);
      const headings = A.map(
        A.filter(
          A.map(readmeLines, (line, index) => ({ index, line })),
          ({ line }) => Str.startsWith("# ")(line) || Str.startsWith("## ")(line) || Str.startsWith("### ")(line)
        ),
        ({ index, line }) => ({ index, text: readmeHeadingText(line) })
      );
      for (const { heading, headingIndex } of A.map(headings, (heading, headingIndex) => ({
        heading,
        headingIndex,
      }))) {
        const next = A.get(headings, headingIndex + 1);
        anchors.push(
          anchor(
            `README:${heading.text}`,
            readmeFile,
            heading.index + 1,
            O.match(next, { onNone: () => countEffectVitestSourceLines(readme), onSome: (value) => value.index })
          )
        );
      }

      for (const charterFile of ["Effect.txt", "Layer.txt", "Logger.txt", "TestClock.txt"]) {
        const text = yield* fs.readFileString(path.join(fixtureRoot, "charter", charterFile));
        const sourcePathLine = A.findFirst(Str.split("\n")(text), Str.includes("from packages/effect/src/"));
        assertTrue(O.isSome(sourcePathLine), "Expected the pinned charter source-path receipt");
        const sourcePath = Str.replace(
          " at",
          ""
        )(
          Str.replace(
            "// Exact declaration excerpt from ",
            ""
          )(Str.replace("// Exact declaration excerpts from ", "")(sourcePathLine.value))
        );
        for (const marker of A.filter(Str.split("\n")(text), Str.includes("@effect-vitest-anchor"))) {
          const fields = Str.split(" ")(marker);
          const name = fields[2];
          const startLine = fields[3];
          const endLine = fields[4];
          assertTrue(name !== undefined && startLine !== undefined && endLine !== undefined);
          anchors.push(
            anchor(name, sourcePath, globalThis.Number.parseInt(startLine, 10), globalThis.Number.parseInt(endLine, 10))
          );
        }
      }

      strictEqual(anchors.length, 85);
      for (const expected of anchors) {
        const actual = HashMap.get(byName, expected.name);
        assertTrue(O.isSome(actual), `Missing pinned primitive for ${expected.name}`);
        strictEqual(actual.value.file, expected.file);
        strictEqual(actual.value.startLine, expected.startLine);
        strictEqual(actual.value.endLine, expected.endLine);
      }
    })
  );

  it.effect(
    "compiles every graph example against the installed rc.112 package surface",
    Effect.fnUntraced(function* () {
      const path = yield* Path.Path;
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const project = new Project({
        tsConfigFilePath: path.join(packageRoot, "tsconfig.json"),
        skipAddingFilesFromTsConfig: true,
      });
      const exampleRoot = path.join(packageRoot, "src", ".effect-vitest-examples");
      for (const { entry, index } of A.map(graph.entries, (entry, index) => ({ entry, index }))) {
        project.createSourceFile(path.join(exampleRoot, `${index}.ts`), entry.example, { overwrite: true });
      }
      const diagnostics = project.getPreEmitDiagnostics();
      assertTrue(A.isReadonlyArrayEmpty(diagnostics), project.formatDiagnosticsWithColorAndContext(diagnostics));
    })
  );

  it.effect(
    "rejects missing graph files, duplicate IDs, and unknown rule IDs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-vitest-graph-" });
      const missing = yield* readEffectVitestPrimitiveGraph(root).pipe(Effect.flip);
      strictEqual(missing._tag, "EffectVitestPrimitiveGraphError");

      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const first = graph.entries[0];
      assertTrue(first !== undefined);
      const duplicate = yield* decodeEffectVitestPrimitiveGraphDocument({
        ...graph,
        entries: [...graph.entries, first],
      }).pipe(Effect.flip);
      strictEqual(duplicate._tag, "SchemaError");

      const unknownRule = yield* decodeEffectVitestPrimitiveGraphDocument({
        ...graph,
        entries: [{ ...first, replaces: ["EV999"] }, ...A.drop(graph.entries, 1)],
      }).pipe(Effect.flip);
      strictEqual(unknownRule._tag, "SchemaError");

      const unknownPolicy = EffectVitestFinding.make({
        ...finding,
        id: "L-RES-01:packages/example/test/a.test.ts:1",
        lens: "resource",
        ruleId: "L-RES-01",
      });
      const unknownPolicyFailure = yield* applyEffectVitestPrimitiveGraph([unknownPolicy], graph).pipe(Effect.flip);
      assertTrue(Str.includes("unknown policy ID L-RES-01")(unknownPolicyFailure.message));
    })
  );

  it.effect(
    "rejects a missing preferred policy primitive even when rule coverage remains complete",
    Effect.fnUntraced(function* () {
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const moduleEntry = A.findFirst(graph.entries, (entry) => entry.id === "module.@effect/vitest");
      assertTrue(O.isSome(moduleEntry), "Expected the pinned module primitive before testing its removal");
      const replacement = EffectVitestPrimitive.make({
        ...moduleEntry.value,
        replaces: [...moduleEntry.value.replaces, "EV001", "EV009"],
        whenToUse: `${moduleEntry.value.whenToUse} Candidate classes runtime-boundary-in-test and unjustified-live-test.`,
      });
      const missingPreferred = EffectVitestPrimitiveGraphDocument.make({
        ...graph,
        entries: A.map(
          A.filter(graph.entries, (entry) => entry.id !== "it.effect"),
          (entry) => (entry.id === moduleEntry.value.id ? replacement : entry)
        ),
      });
      const failure = yield* applyEffectVitestPrimitiveGraph([], missingPreferred).pipe(Effect.flip);
      assertTrue(Str.includes("missing primitive it.effect")(failure.message));
    })
  );

  it.effect(
    "rejects an installed package version that differs from the graph pin",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-vitest-pin-" });
      const packageDirectory = path.join(root, "node_modules", "@effect", "vitest");
      yield* fs.makeDirectory(packageDirectory, { recursive: true });
      yield* fs.writeFileString(
        path.join(packageDirectory, "package.json"),
        '{"name":"@effect/vitest","version":"4.0.0-rc.111"}'
      );
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const failure = yield* verifyEffectVitestPin(root, graph).pipe(Effect.flip);
      assertTrue(Str.includes("does not match graph pin @effect/vitest@4.0.0-rc.112")(failure.message));
      assertTrue(Str.includes("Regenerate source anchors")(failure.message));
      assertTrue(Str.includes("review the semantic diff")(failure.message));
      assertTrue(Str.includes("update the graph pin")(failure.message));
    })
  );

  it.effect(
    "derives Option, Result, and Exit assertion-family guidance from graph edges",
    Effect.fnUntraced(function* () {
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const cases: ReadonlyArray<readonly [evidence: string, primitive: string]> = [
        ["Option.none()", "utils.assertNone"],
        ["Option.some(1)", "utils.assertSome"],
        ["Result.succeed(1)", "utils.assertSuccess"],
        ["Result.fail(error)", "utils.assertFailure"],
        ["Exit.succeed(1)", "utils.assertExitSuccess"],
        ["Exit.fail(error)", "utils.assertExitFailure"],
      ];
      const rows = A.map(cases, ([evidence], index) => assertionFinding(index + 1, evidence));
      const hydrated = yield* applyEffectVitestPrimitiveGraph(rows, graph);
      for (const [index, expected] of A.map(cases, (entry, index): readonly [number, string] => [index, entry[1]])) {
        const row = hydrated[index];
        assertTrue(row !== undefined);
        assertTrue(Str.includes(expected)(row.replacement.sketch));
        strictEqual(row.id, rows[index]?.id);
        strictEqual(row.ruleId, "EV006");
      }
    })
  );

  it.effect(
    "keeps EV005 on the Effect.exit and Exit assertion migration",
    Effect.fnUntraced(function* () {
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const outcome = EffectVitestFinding.make({
        ...finding,
        id: "EV005:packages/example/test/a.test.ts:1:result@0#1",
        ruleId: "EV005",
        class: "result-outcome-assertion",
        evidence: "Effect.result(program)",
        replacement: EffectVitestReplacement.make({ primitive: "utils.assertExitSuccess", sketch: "staging hint" }),
      });
      const hydrated = yield* applyEffectVitestPrimitiveGraph([outcome], graph);
      const row = hydrated[0];
      assertTrue(row !== undefined);
      strictEqual(row.replacement.primitive, "utils.assertExitSuccess");
      assertTrue(Str.includes("utils.assertExitSuccess")(row.replacement.sketch));
      assertTrue(Str.includes("utils.assertExitFailure")(row.replacement.sketch));
      assertTrue(!Str.includes("utils.assertSuccess:")(row.replacement.sketch));
      strictEqual(row.id, outcome.id);
    })
  );

  it.effect(
    "grounds standalone timeout and bounded external-wait alternatives without changing the clock default",
    Effect.fnUntraced(function* () {
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
      const source = project.createSourceFile(
        "alternatives.test.ts",
        `
        import { effect, layer } from "@effect/vitest";
        import { Effect } from "effect";
        import * as TestClock from "effect/testing/TestClock";
        layer(Resource)(it => { it.effect("resource", () => Effect.void); });
        effect("bounded external", () => Effect.sleep("10 millis").pipe(Effect.timeout("1 second"), TestClock.withLive));
        effect("virtual", () => Effect.sleep("1 second"));
      `
      );
      const rows = detectEffectVitestFindings(source, "packages/example/test/alternatives.test.ts", "@beep/example");
      const hydrated = yield* applyEffectVitestPrimitiveGraph(rows, graph);
      const timeout = A.findFirst(hydrated, (row) => row.ruleId === "EV014");
      assertTrue(O.isSome(timeout), "Expected standalone resource timeout judgment");
      assertTrue(Str.includes("layer.option.timeout:")(timeout.value.replacement.sketch));
      const clocks = A.filter(hydrated, (row) => row.ruleId === "EV008");
      strictEqual(clocks.length, 1);
      const clock = clocks[0];
      assertTrue(clock !== undefined);
      strictEqual(clock.replacement.primitive, "readme.testclock");
      assertTrue(Str.includes("TestClock.withLive:")(clock.replacement.sketch));
      assertTrue(Str.includes("bounded external-system wait")(clock.replacement.sketch));
      assertTrue(Str.includes("root cause")(clock.replacement.sketch));
      assertTrue(Str.includes("without replacing the surrounding test clock")(clock.replacement.sketch));
    })
  );

  it.effect(
    "renders graph-authored hints without changing finding membership identity",
    Effect.fnUntraced(function* () {
      const graph = yield* readEffectVitestPrimitiveGraph(repositoryRoot);
      const original = A.findFirst(graph.entries, (entry) => entry.id === "it.effect");
      assertTrue(O.isSome(original), "Expected the original primitive before changing only its hint");
      const changedHint = `${original.value.whenToUse} Prefer the graph-specific reviewed form.`;
      const changed = EffectVitestPrimitiveGraphDocument.make({
        ...graph,
        entries: A.map(graph.entries, (entry) =>
          entry.id === original.value.id ? EffectVitestPrimitive.make({ ...entry, whenToUse: changedHint }) : entry
        ),
      });
      const hydrated = yield* applyEffectVitestPrimitiveGraph([finding], changed);
      strictEqual(hydrated[0]?.replacement.sketch, `${original.value.id}: ${changedHint}`);
      strictEqual(hydrated[0]?.id, finding.id);
      strictEqual(hydrated[0]?.evidence, finding.evidence);
    })
  );
});
