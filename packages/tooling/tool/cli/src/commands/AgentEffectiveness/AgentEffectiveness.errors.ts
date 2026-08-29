/**
 * Tagged errors for agent-effectiveness eval scoring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/AgentEffectiveness/AgentEffectiveness.errors");

/**
 * Operational failure raised while scoring a SkillOpt eval fixture.
 *
 * **Example** (Create eval scorer error)
 *
 * ```ts
 * import { AgentEffectivenessEvalScorerError } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * const error = AgentEffectivenessEvalScorerError.new("Fixture directory is not readable.", {
 *   file: "fixtures/task"
 * })
 * console.log(error.file)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AgentEffectivenessEvalScorerError extends S.TaggedError<AgentEffectivenessEvalScorerError>(
  $I`AgentEffectivenessEvalScorerError`
)(
  "AgentEffectivenessEvalScorerError",
  {
    message: S.String,
    file: S.optionalKey(S.String),
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<AgentEffectivenessEvalScorerError>("AgentEffectivenessEvalScorerError", {
    description: "Operational scorer failure; law and completion findings stay in score reports instead.",
  })
) {
  static readonly new = (message: string, options: AgentEffectivenessEvalScorerError.Options = {}) =>
    AgentEffectivenessEvalScorerError.make({ message, ...options });

  static readonly mapError =
    (message: string, options: AgentEffectivenessEvalScorerError.Options = {}) =>
    (cause: unknown): AgentEffectivenessEvalScorerError =>
      AgentEffectivenessEvalScorerError.make({ cause, message, ...options });
}

/**
 * Namespace containing option types for {@link AgentEffectivenessEvalScorerError}.
 *
 * **Example** (Define scorer error options)
 *
 * ```ts
 * import { AgentEffectivenessEvalScorerError } from "@beep/repo-cli/commands/AgentEffectiveness/AgentEffectiveness.errors"
 *
 * const options: AgentEffectivenessEvalScorerError.Options = { file: "fixtures/task" }
 * console.log(options.file) // "fixtures/task"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export declare namespace AgentEffectivenessEvalScorerError {
  /**
   * Optional context for a scorer operational failure.
   *
   * @category errors
   * @since 0.0.0
   */
  export type Options = {
    readonly file?: string;
    readonly command?: string;
    readonly exitCode?: number;
  };
}
