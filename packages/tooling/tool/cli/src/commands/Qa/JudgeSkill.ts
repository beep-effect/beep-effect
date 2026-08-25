/**
 * The `qa judge-skill` SKILL.md projection writer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { renderSkillMarkdown } from "@beep/skill-contract";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { QaJudgeContract } from "./JudgeContract.ts";

const $I = $RepoCliId.create("commands/Qa/JudgeSkill");

/**
 * Options accepted by `qa judge-skill`.
 *
 * **Example** (Target a file instead of stdout)
 *
 * ```ts
 * import { QaJudgeSkillOptions } from "@beep/repo-cli/commands/Qa"
 * import * as O from "effect/Option"
 *
 * const options = QaJudgeSkillOptions.make({ write: O.some("skills/qa-inventory-judge/SKILL.md") })
 * console.log(O.isSome(options.write)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaJudgeSkillOptions extends S.Class<QaJudgeSkillOptions>($I`QaJudgeSkillOptions`)(
  {
    write: S.Option(S.String).annotateKey({
      description: "Destination path for the rendered artifact; absent means print the exact bytes to stdout.",
    }),
  },
  $I.annote("QaJudgeSkillOptions", {
    description: "Options for rendering the qa-inventory judge contract as SKILL.md.",
  })
) {}

const writeArtifact = Effect.fn("QaJudgeSkill.write")(function* (outputPath: string, markdown: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(outputPath), { recursive: true });
  yield* fs.writeFileString(outputPath, markdown);
});

/**
 * Renders {@link QaJudgeContract} as deterministic SKILL.md and writes it to
 * the requested path or to stdout.
 *
 * **Details**
 *
 * The stdout path writes the renderer output verbatim rather than through the
 * line printer: the committed artifact carries no trailing newline, so
 * `bun run beep qa judge-skill > SKILL.md` must reproduce the exact bytes that
 * `verifySkillArtifact` re-renders.
 *
 * **Example** (Render to a file)
 *
 * ```ts
 * import { QaJudgeSkillOptions, runQaJudgeSkill } from "@beep/repo-cli/commands/Qa"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = runQaJudgeSkill(QaJudgeSkillOptions.make({ write: O.some("out/SKILL.md") }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Destination selection for the rendered artifact.
 * @returns An effect that renders and emits the artifact.
 * @category use-cases
 * @since 0.0.0
 */
export const runQaJudgeSkill = Effect.fn("QaJudgeSkill.run")(function* (options: QaJudgeSkillOptions) {
  const markdown = yield* Effect.fromResult(renderSkillMarkdown(QaJudgeContract));
  yield* O.match(options.write, {
    onNone: () =>
      Effect.sync(() => {
        process.stdout.write(markdown);
      }),
    onSome: (outputPath) => writeArtifact(outputPath, markdown),
  });
});
