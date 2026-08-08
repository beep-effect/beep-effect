import { diffJudgeRubricLenses } from "@beep/repo-cli/commands/Lint";
import { JUDGE_PROMPT_TEMPLATE, QaLens } from "@beep/repo-cli/commands/Qa";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

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

  it.effect(
    "the shipped judge prompt and the QaLens schema are in sync",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      let root = process.cwd();
      for (let depth = 0; depth < 8; depth++) {
        if (yield* fs.exists(path.join(root, JUDGE_PROMPT_TEMPLATE))) {
          break;
        }
        root = path.join(root, "..");
      }
      const prompt = yield* fs.readFileString(path.join(root, JUDGE_PROMPT_TEMPLATE));
      const drift = diffJudgeRubricLenses(prompt);
      expect(drift.missingFromPrompt).toEqual([]);
      expect(drift.unknownInPrompt).toEqual([]);
    }, provideScopedLayer(PlatformLayer))
  );
});
