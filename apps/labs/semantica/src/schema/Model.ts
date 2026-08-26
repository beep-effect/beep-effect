import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SemanticaId.create("schema/Model");

/**
 * Provider families that may produce C0 extraction or gold output.
 *
 * **Example** (Check the offline pattern provider)
 *
 * ```ts
 * import { ProviderFamily } from "@/schema/Model"
 *
 * console.log(ProviderFamily.is.wink("wink")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProviderFamily = LiteralKit(["anthropic", "xai", "wink"]).pipe(
  $I.annoteSchema("ProviderFamily", {
    description: "Anthropic and xAI hosted providers plus the local Wink pattern provider.",
  })
);

/**
 * Decoded literal accepted by {@link ProviderFamily}.
 *
 * **Example** (Annotate a provider family)
 *
 * ```ts
 * import type { ProviderFamily } from "@/schema/Model"
 *
 * const provider: ProviderFamily = "anthropic"
 * console.log(provider) // "anthropic"
 * ```
 *
 * @see {@link ProviderFamily} for literal helpers and validation.
 * @category type-level
 * @since 0.0.0
 */
export type ProviderFamily = typeof ProviderFamily.Type;

/**
 * Task roles that affect model identity and cache behavior.
 *
 * **Example** (Check the gold-proposal task)
 *
 * ```ts
 * import { TaskType } from "@/schema/Model"
 *
 * console.log(TaskType.is["gold-proposal"]("gold-proposal")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskType = LiteralKit(["extraction", "gold-proposal"]).pipe(
  $I.annoteSchema("TaskType", {
    description: "Extraction and gold-proposal roles that distinguish otherwise identical models.",
  })
);

/**
 * Decoded literal accepted by {@link TaskType}.
 *
 * **Example** (Annotate a task type)
 *
 * ```ts
 * import type { TaskType } from "@/schema/Model"
 *
 * const task: TaskType = "gold-proposal"
 * console.log(task) // "gold-proposal"
 * ```
 *
 * @see {@link TaskType} for literal helpers and validation.
 * @category type-level
 * @since 0.0.0
 */
export type TaskType = typeof TaskType.Type;

/**
 * Pinned provider, model, revision, artifact, and task identity.
 *
 * **Example** (Describe an extraction model)
 *
 * ```ts
 * import { ModelIdentity } from "@/schema/Model"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const model = ModelIdentity.make({
 *   provider: "anthropic",
 *   name: "claude",
 *   revision: "2026-08-25",
 *   artifactHash: Sha256Hex.make("0".repeat(64)),
 *   taskType: "extraction"
 * })
 * console.log(model.provider) // "anthropic"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelIdentity extends S.Class<ModelIdentity>($I`ModelIdentity`)(
  {
    provider: ProviderFamily,
    name: S.NonEmptyString,
    revision: S.NonEmptyString,
    artifactHash: Sha256Hex,
    taskType: TaskType,
  },
  $I.annote("ModelIdentity", {
    description: "Pinned provider family, model name, revision, prompt artifact hash, and task role.",
  })
) {}
