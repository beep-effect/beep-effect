/**
 * Schemas for Next.js prefetch inlining configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/PrefetchInliningConfig.schema");

class PrefetchInliningConfigComplex extends S.Opaque<
  PrefetchInliningConfigComplex,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    maxSize: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    maxBundleSize: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
  }).pipe(
    $I.annoteSchema("PrefetchInliningConfigComplex", {
      description:
        "Resolved form of the prefetchInlining config after normalization in\nconfig.ts. User input (true, partial objects) is converted to this shape.",
    })
  )
) {}

/**
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
