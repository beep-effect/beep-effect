import { IdText } from "@proto/kernel/Measure";
import * as S from "effect/Schema";

/**
 * What a run was made with: its prompt, model and tool-contract versions
 * (D6, D19). A change to any of them passes a recorded evaluation first.
 * Each is a version label, compared as it is, so it is {@link IdText}: a
 * model name with a `/` is not one.
 *
 * @category models
 * @since 0.0.0
 */
export const RunVersions = S.Struct({ prompt: IdText, model: IdText, tools: IdText });
/**
 * @category models
 * @since 0.0.0
 */
export type RunVersions = typeof RunVersions.Type;
