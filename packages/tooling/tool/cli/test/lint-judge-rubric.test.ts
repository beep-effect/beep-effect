import {
  diffJudgeRubricFamily,
  diffJudgeRubricLenses,
  JudgeRubricDrift,
  JudgeRubricFamilyInput,
  lintJudgeRubricCommand,
} from "@beep/repo-cli/commands/Lint";
import {
  BrowserQaLens,
  DRAWING_JUDGE_PROMPT_TEMPLATE,
  DrawingQaLens,
  JUDGE_PROMPT_TEMPLATE,
} from "@beep/repo-cli/commands/Qa";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Console from "effect/Console";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit } from "./support/CommandTest.ts";

const decodeUnknownJudgeRubricDrift = S.decodeUnknownEffect(JudgeRubricDrift);

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const runLintJudgeRubricCommand = Command.runWith(lintJudgeRubricCommand, { version: "0.0.0" });

const syncedPrompt = [
  "# Judge",
  "",
  "## Lenses",
  "",
  `Use EXACTLY these \`lens\` slugs: ${A.join(
    A.map(BrowserQaLens.literals, (lens) => `\`${lens}\``),
    ", "
  )}.`,
  "",
  "## Output contract",
  "",
  "Emit JSON.",
].join("\n");

it.layer(PlatformLayer, { timeout: "5 seconds" })((it) => {
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
      expect(drift.missingFromPrompt).toEqual([...BrowserQaLens.literals]);
    });

    it("treats a lens from another rubric family as drift", () => {
      const withDrawingLens = syncedPrompt.replace(
        "## Output contract",
        "Also grade `view-agreement`.\n\n## Output contract"
      );
      expect(diffJudgeRubricLenses(withDrawingLens).unknownInPrompt).toEqual(["view-agreement"]);
      expect(
        diffJudgeRubricFamily(JudgeRubricFamilyInput.make({ prompt: syncedPrompt, family: DrawingQaLens.literals }))
          .missingFromPrompt
      ).toEqual([...DrawingQaLens.literals]);
    });

    it.effect("rejects unknown values in the missing-lens domain", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          decodeUnknownJudgeRubricDrift({ missingFromPrompt: ["made-up-lens"], unknownInPrompt: [] })
        );
        assertTrue(exit._tag === "Failure");
      })
    );

    it.layer(
      Layer.mergeAll(
        NodePath.layer,
        Layer.effect(Console.Console, TestConsole.make),
        NodeTerminal.layer,
        NodeStdio.layer
      ),
      {
        timeout: "5 seconds",
      }
    )((it) => {
      it.effect("reports the filesystem cause and preserves exit code 2", () => {
        const fileSystemError = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "readFileString",
          pathOrDescriptor: JUDGE_PROMPT_TEMPLATE,
          description: "fixture denied",
        });
        const fileSystem = FileSystem.makeNoop({
          exists: () => Effect.succeed(true),
          readFileString: () => Effect.fail(fileSystemError),
        });

        const spawned: Array<unknown> = [];
        const spawner = ChildProcessSpawner.make((command) =>
          Effect.sync(() => spawned.push(command)).pipe(
            Effect.andThen(Effect.die("Unexpected judge-rubric child process"))
          )
        );
        return Effect.gen(function* () {
          const exit = yield* Effect.exit(runLintJudgeRubricCommand([]));
          const errorLines = yield* TestConsole.errorLines;
          const errorText = A.join(A.filter(errorLines, P.isString), "\n");

          expectReportedExit(exit, 2);
          expect(spawned).toEqual([]);
          expect(errorLines).toHaveLength(1);
          expect(errorText).toContain(`[lint:judge-rubric] failed to read`);
          expect(errorText).toContain("PermissionDenied: FileSystem.readFileString");
          expect(errorText).toContain("fixture denied");
        }).pipe(
          Effect.provideService(FileSystem.FileSystem, fileSystem),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
      });
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
      })
    );

    it.effect(
      "the shipped drawing judge prompt and the DrawingQaLens family are in sync",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* findRepoRoot();
        const prompt = yield* fs.readFileString(path.join(root, DRAWING_JUDGE_PROMPT_TEMPLATE));
        const drift = diffJudgeRubricFamily(JudgeRubricFamilyInput.make({ prompt, family: DrawingQaLens.literals }));
        expect(drift.missingFromPrompt).toEqual([]);
        expect(drift.unknownInPrompt).toEqual([]);
      })
    );
  });
});
