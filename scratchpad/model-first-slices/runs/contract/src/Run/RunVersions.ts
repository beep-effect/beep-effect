import * as S from "effect/Schema";

/**
 * What a run was made with: its prompt, model and tool-contract versions
 * (D6, D19). A change to any of them passes a recorded evaluation first.
 *
 * @category models
 * @since 0.0.0
 */
export const RunVersions = S.Struct({ prompt: S.String, model: S.String, tools: S.String });
/**
 * @category models
 * @since 0.0.0
 */
export type RunVersions = typeof RunVersions.Type;
