/**
 * Schemas for Next.js prefetch inlining configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { NonNegNum } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/PrefetchInliningConfig.schema");

class PrefetchInliningConfigComplex extends S.Class<PrefetchInliningConfigComplex>($I`PrefetchInliningConfigComplex`)(
  {
    maxSize: NonNegNum,
    maxBundleSize: NonNegNum,
  },
  $I.annote("PrefetchInliningConfigComplex", {
    description:
      "Resolved form of the prefetchInlining config after normalization in\nconfig.ts. User input (true, partial objects) is converted to this shape.",
  })
) {}

/**
 * Resolved form of the prefetchInlining config after normalization in
 * config.ts. User input (true, partial objects) is converted to this shape.
 *
 * **Example** (Import and log schema)
 *
 * ```ts
 * import { PrefetchInliningConfig } from "@beep/repo-configs/next/models/PrefetchInliningConfig.schema"
 * const schema = PrefetchInliningConfig
 * console.log(schema)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrefetchInliningConfig = S.Union([S.Literal(false), PrefetchInliningConfigComplex]).pipe(
  $I.annoteSchema("PrefetchInliningConfig", {
    description:
      "Resolved form of the prefetchInlining config after normalization in\nconfig.ts. User input (true, partial objects) is converted to this shape.",
  })
);

/**
 * Companion type for {@link PrefetchInliningConfig} schema
 *
 * **Example** (Type-check false config)
 *
 * ```ts
 * import type { PrefetchInliningConfig } from "@beep/repo-configs/next/models/PrefetchInliningConfig.schema"
 * const config = false satisfies PrefetchInliningConfig
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PrefetchInliningConfig = typeof PrefetchInliningConfig.Type;
