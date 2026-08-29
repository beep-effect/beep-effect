import { lintCommand } from "@beep/repo-cli/commands/Lint";
import { LintPolicySubcommand } from "@beep/repo-cli/test/Quality";
import { TSMorphService, TSMorphServiceLive, TsMorphProjectInspectionRequest } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { Node, SyntaxKind } from "ts-morph";
import type { CallExpression, Project, SourceFile } from "ts-morph";

const CommandTestLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);
const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);
const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const decodeProjectInspectionRequest = S.decodeUnknownEffect(TsMorphProjectInspectionRequest);

type LocatedModuleLoad = {
  readonly load: string;
  readonly start: number;
};

const moduleSpecifier = (callExpression: CallExpression): string => {
  const argument = callExpression.getArguments()[0];
  return argument !== undefined && Node.isStringLiteral(argument)
    ? argument.getLiteralText()
    : callExpression.getText();
};

const moduleLoadFromCall = (callExpression: CallExpression): ReadonlyArray<LocatedModuleLoad> => {
  const expression = callExpression.getExpression();
  if (expression.getKind() === SyntaxKind.ImportKeyword) {
    return [{ load: `import():${moduleSpecifier(callExpression)}`, start: callExpression.getStart() }];
  }
  if (Node.isIdentifier(expression) && expression.getText() === "require") {
    return [{ load: `require:${moduleSpecifier(callExpression)}`, start: callExpression.getStart() }];
  }
  return A.empty();
};

const moduleLoads = (sourceFile: SourceFile, before: number): ReadonlyArray<string> => {
  const imports = pipe(
    sourceFile.getImportDeclarations(),
    A.filter((declaration) => !declaration.isTypeOnly()),
    A.map(
      (declaration): LocatedModuleLoad => ({
        load: `import:${declaration.getModuleSpecifierValue()}`,
        start: declaration.getStart(),
      })
    )
  );
  const importEquals = pipe(
    sourceFile.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration),
    A.filter((declaration) => !declaration.isTypeOnly()),
    A.map(
      (declaration): LocatedModuleLoad => ({
        load: `import-equals:${declaration.getModuleReference().getText()}`,
        start: declaration.getStart(),
      })
    )
  );
  const exports = pipe(
    sourceFile.getExportDeclarations(),
    A.filter((declaration) => !declaration.isTypeOnly()),
    A.flatMap((declaration) =>
      pipe(
        O.fromNullishOr(declaration.getModuleSpecifierValue()),
        O.map(
          (specifier): LocatedModuleLoad => ({
            load: `export:${specifier}`,
            start: declaration.getStart(),
          })
        ),
        O.toArray
      )
    )
  );
  const calls = pipe(
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression),
    A.filter((callExpression) => callExpression.getStart() < before),
    A.flatMap(moduleLoadFromCall)
  );

  return pipe(
    imports,
    A.appendAll(importEquals),
    A.appendAll(exports),
    A.appendAll(calls),
    A.sort(Order.mapInput(Order.Number, (entry: LocatedModuleLoad) => entry.start)),
    A.map((entry) => entry.load)
  );
};

const inspectModuleLoads = (project: Project, source: string, stopBeforeFastPath: boolean): ReadonlyArray<string> => {
  const sourceFile = project.createSourceFile("lint-routing-contract.fixture.ts", source, { overwrite: true });
  const before = stopBeforeFastPath
    ? pipe(
        sourceFile.getStatements(),
        A.findFirst(
          (statement) => Node.isIfStatement(statement) && statement.getExpression().getText() === "fastLintFixNoop()"
        ),
        O.map((statement) => statement.getStart()),
        O.getOrElse(() => -1)
      )
    : Number.POSITIVE_INFINITY;
  return moduleLoads(sourceFile, before);
};

describe("commands/Lint fast-path allowlist binding", () => {
  // bin-main.ts routes `beep lint <sub>` to the full command tree only when
  // <sub> is in the LintPolicySubcommand domain; a registered subcommand
  // missing from the domain is silently swallowed by the turbo lint aggregate
  // (the judge-rubric incident, 2026-08-08). This binds the two surfaces.
  it("LintPolicySubcommand exactly matches the subcommands registered on lintCommand", () => {
    const registered = pipe(
      lintCommand.subcommands,
      A.flatMap((group) => group.commands),
      A.map((command) => command.name)
    );
    expect(sortedNames(LintPolicySubcommand.literals)).toEqual(sortedNames(registered));
  });

  it.effect(
    "lists every registered subcommand in the lint help index",
    Effect.fnUntraced(function* () {
      yield* runLintCommand([]);
      const lines = yield* TestConsole.logLines;
      const registered = pipe(
        lintCommand.subcommands,
        A.flatMap((group) => group.commands),
        A.map((command) => `- bun run beep lint ${command.name}`)
      );

      for (const line of registered) {
        expect(lines).toContain(line);
      }
    }, provideScopedLayer(CommandTestLayer))
  );
});

// Every module bin-main.ts imports eagerly is paid on every `beep` invocation
// before the fast paths run, so each one is held to the same zero-import
// contract as LintRouting.ts and enumerated in the allowlist below.
const PRE_FAST_PATH_MODULES: ReadonlyArray<string> = [
  "internal/cli/FailureRendering.ts",
  "internal/cli/LintRouting.ts",
];

describe("internal/cli dependency-free boundary", () => {
  // bin-main.ts pays every eager import on every `beep` invocation before its
  // fast-path branches run; routing data hidden behind a heavier module cost
  // ~1.1s/415MB of startup (the round-1 ARCH-BOUNDARY-01 regression). Existing
  // tests only compare routing values, so a routine helper import added to
  // LintRouting.ts would restore the regression while staying green. Guard the
  // boundary at the source level — a timing assertion would be
  // environment-sensitive.
  it.effect(
    "pre-fast-path modules stay import-free and bin-main keeps an explicit module-load allowlist",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tsMorph = yield* TSMorphService;
      const repoRoot = yield* findRepoRoot();
      const sourceDir = path.join(repoRoot, "packages/tooling/tool/cli/src");
      const preFastPathSources = yield* Effect.forEach(PRE_FAST_PATH_MODULES, (module) =>
        Effect.map(fs.readFileString(path.join(sourceDir, module)), (source) => ({ module, source }))
      );
      const binMainSource = yield* fs.readFileString(path.join(sourceDir, "bin-main.ts"));
      const request = yield* decodeProjectInspectionRequest({
        entrypoint: {
          _tag: "tsconfig",
          tsConfigPath: "packages/tooling/tool/cli/tsconfig.json",
        },
        repoRootPath: repoRoot,
        mode: "syntax",
        referencePolicy: "workspaceOnly",
        filePaths: [],
        sourceFileGlobs: [],
      });

      yield* tsMorph.inspectProject(request, ({ project }) => {
        const dependencyFreeMutations = [
          'import { x } from "heavy";',
          'import x = require("heavy");',
          'export { x } from "heavy";',
          'const dynamic = import ("heavy");',
          'const required = require("heavy");',
        ];
        for (const { module, source } of preFastPathSources) {
          expect(inspectModuleLoads(project, source, false), module).toEqual([]);
          for (const mutation of dependencyFreeMutations) {
            expect(inspectModuleLoads(project, `${mutation}\n${source}`, false), `${module}: ${mutation}`).not.toEqual(
              []
            );
          }
        }

        expect(inspectModuleLoads(project, binMainSource, true)).toEqual([
          "import:./internal/cli/FailureRendering.ts",
          "import:./internal/cli/LintRouting.ts",
          "import():@beep/utils",
          "import():effect",
        ]);

        const beforeFastPath = (mutation: string): string =>
          Str.replace(
            "const LINT_POLICY_SUBCOMMAND_NAMES",
            `${mutation}\nconst LINT_POLICY_SUBCOMMAND_NAMES`
          )(binMainSource);
        expect(
          inspectModuleLoads(
            project,
            beforeFastPath('const { LintPolicySubcommand } = await import("./commands/Quality/Quality.schemas.ts");'),
            true
          )
        ).not.toEqual(inspectModuleLoads(project, binMainSource, true));
        expect(inspectModuleLoads(project, beforeFastPath('require("heavy");'), true)).not.toEqual(
          inspectModuleLoads(project, binMainSource, true)
        );
      });
    }, provideScopedLayer(CommandTestLayer))
  );
});
