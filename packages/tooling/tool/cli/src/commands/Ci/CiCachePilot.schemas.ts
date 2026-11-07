/**
 * Literal domains of the hosted cache-pilot CI commands.
 *
 * **Details**
 *
 * The pre-toolchain cleanup command imports this module, so it depends only on
 * `effect/Schema` and the repo literal kit, never on the cache command family.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoCliId.create("commands/Ci/CiCachePilot.schemas");

/**
 * The two job layouts a hosted cache pilot prepares and cleans up.
 *
 * **Details**
 *
 * `signed` is the protected producer trial, `local` the credential-free local
 * observation. Each owns a fixed input directory under `.beep/cache/`.
 *
 * **Example** (Guard a pilot mode)
 *
 * ```ts
 * import { CiCachePilotMode } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CiCachePilotMode)("signed")) // true
 * console.log(S.is(CiCachePilotMode)("remote")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCachePilotMode = LiteralKit(["signed", "local"]).pipe(
  $I.annoteSchema("CiCachePilotMode", { description: "Hosted cache pilot job layout." })
);

/**
 * Type of {@link CiCachePilotMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiCachePilotMode = typeof CiCachePilotMode.Type;

/**
 * The lint computations a hosted cache pilot may prepare.
 *
 * **Details**
 *
 * The signed producer trial accepts only `@beep/identity#lint`; the local
 * observation accepts both.
 *
 * **Example** (Guard a pilot computation)
 *
 * ```ts
 * import { CiCachePilotComputation } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CiCachePilotComputation)("@beep/types#lint")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCachePilotComputation = LiteralKit(["@beep/identity#lint", "@beep/types#lint"]).pipe(
  $I.annoteSchema("CiCachePilotComputation", { description: "Reviewed hosted cache pilot lint computation." })
);

/**
 * Type of {@link CiCachePilotComputation}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiCachePilotComputation = typeof CiCachePilotComputation.Type;
