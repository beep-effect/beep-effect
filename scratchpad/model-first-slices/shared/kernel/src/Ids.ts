import * as S from "effect/Schema";

/**
 * The organization a principal, agent or process acts for. Every read and
 * write is scoped to one.
 *
 * **Example** (Brand an org id)
 * ```ts
 * import { OrgId } from "@proto/kernel/Ids";
 *
 * const acme = OrgId.make("org_acme");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const OrgId = S.String.pipe(S.brand("OrgId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type OrgId = typeof OrgId.Type;

/**
 * A signed-in human.
 *
 * **Example** (Brand a principal id)
 * ```ts
 * import { PrincipalId } from "@proto/kernel/Ids";
 *
 * const dana = PrincipalId.make("p_dana");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const PrincipalId = S.String.pipe(S.brand("PrincipalId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type PrincipalId = typeof PrincipalId.Type;

/**
 * A named agent (an assistant configuration, not one run of it).
 *
 * **Example** (Brand an agent id)
 * ```ts
 * import { AgentId } from "@proto/kernel/Ids";
 *
 * const assistant = AgentId.make("review-assistant");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const AgentId = S.String.pipe(S.brand("AgentId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type AgentId = typeof AgentId.Type;

/**
 * One run of an agent: the saga execution that made a proposal.
 *
 * **Example** (Brand a run id)
 * ```ts
 * import { RunId } from "@proto/kernel/Ids";
 *
 * const run = RunId.make("run_claim_1");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const RunId = S.String.pipe(S.brand("RunId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type RunId = typeof RunId.Type;
