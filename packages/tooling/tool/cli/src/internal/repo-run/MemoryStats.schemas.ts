/**
 * Scalar boundary codecs for live admission memory-controller readings.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { RunScopeCgroupPath } from "./RunScope.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/MemoryStats.schemas");

/**
 * Decode a non-negative integral memory-controller byte count.
 *
 * **Example** (Decode a controller reading)
 *
 * ```ts
 * import { CgroupBytes } from "./MemoryStats.schemas.ts"
 * import * as S from "effect/Schema"
 * import * as O from "effect/Option"
 * console.log(O.isSome(S.decodeUnknownOption(CgroupBytes)("4096"))) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CgroupBytes = S.NumberFromString.pipe(
  S.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
  $I.annoteSchema("CgroupBytes", {
    description: "Non-negative integral memory-controller byte count.",
  })
);

/**
 * Byte count represented by {@link CgroupBytes}.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CgroupBytes = typeof CgroupBytes.Type;

/**
 * One finite ancestor memory ceiling and its currently unconsumed capacity.
 *
 * **Example** (Record a live controller reading)
 *
 * ```ts
 * import { CgroupMemoryBudget } from "./MemoryStats.schemas.ts"
 * const budget = CgroupMemoryBudget.make({ path: "/worker", ceilingGib: 32, availableGib: 20 })
 * console.log(budget.availableGib) // 20
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CgroupMemoryBudget extends S.Opaque<CgroupMemoryBudget, { readonly brand: unique symbol }>()(
  S.Struct({ path: RunScopeCgroupPath, ceilingGib: S.Finite, availableGib: S.Finite }).pipe(
    $I.annoteSchema("CgroupMemoryBudget", {
      description: "Finite memory ceiling and live availability of one cgroup ancestor.",
    })
  )
) {}
