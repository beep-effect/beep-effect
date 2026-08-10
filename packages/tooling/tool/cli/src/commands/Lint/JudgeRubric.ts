/**
 * Judge-rubric lens drift lint.
 *
 * **Details**
 *
 * The browser-qa-loop judge prompt names the review lenses a vision judge may
 * attribute findings to, while `QaLens` in the Qa inventory schema is the
 * decode-time authority. The two are maintained by hand in different files: a
 * lens named in the prompt but absent from the schema makes every inventory
 * citing it fail `decodeQaInventory`, silently discarding a whole
 * capture+extract+judge round; a schema lens missing from the prompt silently
 * narrows judge coverage. This lint binds the two surfaces so drift fails
 * loudly instead.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { A, O, Str, thunkEmptyStr } from "@beep/utils";
import { Console, Effect, FileSystem, HashSet, Order, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { Command } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { JUDGE_PROMPT_TEMPLATE, QaLens } from "../Qa/index.ts";

const $I = $RepoCliId.create("commands/Lint/JudgeRubric");

const LENSES_SECTION = /## Lenses\r?\n([\s\S]*?)(?:\r?\n## |$)/;
const BACKTICK_TOKEN = /`([a-z][a-z0-9-]*)`/g;
// The prompt's Lenses section may backtick exactly two things: lens slugs and
// the literal field name `lens`. Anything else is either a drifted lens or a
// new meta token that must be admitted here explicitly.
const PROMPT_META_TOKENS = HashSet.fromIterable(["lens"]);

const lensesSection = (prompt: string): string =>
  pipe(
    prompt,
    Str.match(LENSES_SECTION),
    O.flatMap((match) => A.get(match, 1)),
    O.getOrElse(thunkEmptyStr)
  );

const promptLensTokens = (prompt: string): HashSet.HashSet<string> =>
  pipe(
    lensesSection(prompt),
    Str.matchAll(BACKTICK_TOKEN),
    A.fromIterable,
    A.map((match) => A.get(match, 1)),
    A.getSomes,
    HashSet.fromIterable
  );

/**
 * Drift between the judge prompt's lens list and the `QaLens` schema.
 *
 * **Example** (Construct a drift report)
 *
 * ```ts
 * import { JudgeRubricDrift } from "@beep/repo-cli/commands/Lint"
 *
 * const drift = JudgeRubricDrift.make({ missingFromPrompt: ["contrast"], unknownInPrompt: [] })
 * console.log(drift.missingFromPrompt) // [ "contrast" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JudgeRubricDrift extends S.Class<JudgeRubricDrift>($I`JudgeRubricDrift`)(
  {
    missingFromPrompt: S.Array(QaLens),
    unknownInPrompt: S.Array(S.String),
  },
  $I.annote("JudgeRubricDrift", {
    description: "Lenses missing from the judge prompt and unknown lens tokens the prompt names.",
  })
) {}

/**
 * Diff the judge prompt's Lenses section against the `QaLens` literal domain.
 *
 * **Details**
 *
 * `missingFromPrompt` lists schema lenses the prompt never names (the judge is
 * never asked to look through them); `unknownInPrompt` lists backticked tokens
 * in the Lenses section that are neither `QaLens` literals nor admitted meta
 * tokens (a judge instructed to emit one produces inventories that fail
 * decode). Both empty means the surfaces are in sync.
 *
 * **Example** (Detect a drifted lens)
 *
 * ```ts
 * import { diffJudgeRubricLenses } from "@beep/repo-cli/commands/Lint"
 *
 * const drift = diffJudgeRubricLenses("## Lenses\n\nUse `made-up-lens` only.\n\n## Output contract\n")
 * console.log(drift.unknownInPrompt) // [ "made-up-lens" ]
 * ```
 *
 * @param prompt - Full judge prompt template text.
 * @returns The drift between the prompt's lens list and the schema domain.
 * @category utilities
 * @since 0.0.0
 */
export const diffJudgeRubricLenses = (prompt: string): JudgeRubricDrift => {
  const promptTokens = promptLensTokens(prompt);
  const schemaLenses = HashSet.fromIterable(QaLens.literals);
  return JudgeRubricDrift.make({
    missingFromPrompt: A.filter(QaLens.literals, (lens) => !HashSet.has(promptTokens, lens)),
    unknownInPrompt: pipe(
      A.fromIterable(promptTokens),
      A.filter((token) => !HashSet.has(schemaLenses, token) && !HashSet.has(PROMPT_META_TOKENS, token)),
      A.sort(Order.String)
    ),
  });
};

const runLintJudgeRubric = Effect.fn("runLintJudgeRubric")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const templatePath = path.join(repoRoot, JUDGE_PROMPT_TEMPLATE);
  const prompt = yield* fs.readFileString(templatePath).pipe(
    Effect.catch((error) => {
      const message = `[lint:judge-rubric] failed to read ${templatePath}: ${error.message}`;
      return Console.error(message).pipe(Effect.andThen(failWithReportedExit(message, 2)));
    })
  );
  const drift = diffJudgeRubricLenses(prompt);
  const violationCount = A.length(drift.missingFromPrompt) + A.length(drift.unknownInPrompt);

  if (violationCount > 0) {
    yield* Console.error(`[lint:judge-rubric] found ${violationCount} lens drift violation(s).`);
    for (const lens of drift.missingFromPrompt) {
      yield* Console.error(
        `${JUDGE_PROMPT_TEMPLATE} [missing-from-prompt] QaLens "${lens}" is never named in the Lenses section.`
      );
    }
    for (const token of drift.unknownInPrompt) {
      yield* Console.error(
        `${JUDGE_PROMPT_TEMPLATE} [unknown-in-prompt] "${token}" is not a QaLens literal; inventories citing it fail decode.`
      );
    }
    return yield* failWithReportedExit("lint judge-rubric: judge prompt and QaLens schema have drifted.");
  }

  yield* Console.log(
    `[lint:judge-rubric] OK: all ${A.length(QaLens.literals)} QaLens lenses are named in ${JUDGE_PROMPT_TEMPLATE} and no unknown lens tokens appear.`
  );
});

/**
 * Lint command binding the judge prompt lens list to the `QaLens` schema.
 *
 * **Example** (Inspect the registered command)
 *
 * ```ts
 * import { lintJudgeRubricCommand } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(lintJudgeRubricCommand.name) // "judge-rubric"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintJudgeRubricCommand = Command.make("judge-rubric", {}, runLintJudgeRubric).pipe(
  Command.withDescription("Check the browser-qa-loop judge prompt lens list against the QaLens schema")
);
