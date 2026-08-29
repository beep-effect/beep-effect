import { diffJudgeRubricLenses, JudgeRubricDrift, lintJudgeRubricCommand } from "@beep/repo-cli/commands/Lint";
import { JUDGE_PROMPT_TEMPLATE, QaLens } from "@beep/repo-cli/commands/Qa";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, FileSystem, Layer, Path } from "effect";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { expectReportedExit } from "./support/CommandTest.ts";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const runLintJudgeRubricCommand = Command.runWith(lintJudgeRubricCommand, { version: "0.0.0" });

const syncedPrompt = [
  "# Judge",
  "",
  "## Lenses",
  "",
  `Use EXACTLY these \`lens\` slugs: ${A.join(
    A.map(QaLens.literals, (lens) => `\`${lens}\``),
    ", "
  )}.`,
  "",
  "## Output contract",
  "",
  "Emit JSON.",
].join("\n");

describe("commands/Lint JudgeRubric lens drift", () => {
  it("reports no drift when the prompt names every schema lens and nothing else", () => {
    const drift = diffJudgeRubricLenses(syncedPrompt);
    expect(drift.missingFromPrompt).toEqual([]);
    expect(drift.unknownInPrompt).toEqual([]);
  });

  it("reports a schema lens the prompt never names", () => {
    const withoutContrast = syncedPrompt.replace("`contrast`, ", "");
    expect(diffJudgeRubricLenses(withoutContrast).missingFromPrompt).toEqual(["contrast"]);
  });

  it("reports a prompt token that is not a QaLens literal", () => {
    const withDriftedLens = syncedPrompt.replace(
      "## Output contract",
      "Also grade `made-up-lens`.\n\n## Output contract"
    );
    expect(diffJudgeRubricLenses(withDriftedLens).unknownInPrompt).toEqual(["made-up-lens"]);
  });

  it("does not report the literal `lens` field name as drift", () => {
    expect(diffJudgeRubricLenses(syncedPrompt).unknownInPrompt).toEqual([]);
  });

  it("ignores backticked tokens outside the Lenses section", () => {
    const withOutsideToken = `Preamble about \`not-a-lens\`.\n\n${syncedPrompt}`;
    expect(diffJudgeRubricLenses(withOutsideToken).unknownInPrompt).toEqual([]);
  });

  it("reports every schema lens missing when the Lenses heading is absent", () => {
    const drift = diffJudgeRubricLenses("# Judge\n\nNo lens section here.\n");
    expect(drift.missingFromPrompt).toEqual([...QaLens.literals]);
  });

  it.effect("rejects unknown values in the missing-lens domain", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        S.decodeUnknownEffect(JudgeRubricDrift)({ missingFromPrompt: ["made-up-lens"], unknownInPrompt: [] })
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("reports the filesystem cause and preserves exit code 2", () => {
    const fileSystemError = PlatformError.systemError({
      _tag: "PermissionDenied",
      module: "FileSystem",
      method: "readFileString",
      pathOrDescriptor: JUDGE_PROMPT_TEMPLATE,
      description: "fixture denied",
    });
    const fileSystemLayer = FileSystem.layerNoop({
      exists: () => Effect.succeed(true),
      readFileString: () => Effect.fail(fileSystemError),
    });

    return Effect.gen(function* () {
      const exit = yield* Effect.exit(runLintJudgeRubricCommand([]));
      const errorLines = yield* TestConsole.errorLines;
      const errorText = A.join(A.filter(errorLines, P.isString), "\n");

      expectReportedExit(exit, 2);
      expect(errorLines).toHaveLength(1);
      expect(errorText).toContain(`[lint:judge-rubric] failed to read`);
      expect(errorText).toContain("PermissionDenied: FileSystem.readFileString");
      expect(errorText).toContain("fixture denied");
    }).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          fileSystemLayer,
          NodePath.layer,
          TestConsole.layer,
          NodeTerminal.layer,
          NodeStdio.layer,
          // The spawner is never exercised here; satisfy its FileSystem | Path
          // requirement privately so the noop FileSystem stub stays authoritative.
          NodeChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)))
        )
      )
    );
  });

  it.effect(
    "the shipped judge prompt and the QaLens schema are in sync",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* findRepoRoot();
      const prompt = yield* fs.readFileString(path.join(root, JUDGE_PROMPT_TEMPLATE));
      const drift = diffJudgeRubricLenses(prompt);
      expect(drift.missingFromPrompt).toEqual([]);
      expect(drift.unknownInPrompt).toEqual([]);
    }, provideScopedLayer(PlatformLayer))
  );
});
