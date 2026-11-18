import * as S from "effect/Schema";

/**
 * An organization: the tenant every record belongs to and every grant is
 * scoped within.
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
 * A human principal: someone who signs in and can be held accountable.
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
 * One agent run: a bounded piece of work an agent does for a human.
 *
 * **Example** (Brand a run id)
 * ```ts
 * import { RunId } from "@proto/kernel/Ids";
 *
 * const run = RunId.make("run_1");
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

/**
 * A grant the authority context issued. Invocations carry grants by id with
 * their terms, so a consuming context checks them without asking.
 *
 * **Example** (Brand a grant id)
 * ```ts
 * import { GrantId } from "@proto/kernel/Ids";
 *
 * const grant = GrantId.make("grant_1");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const GrantId = S.String.pipe(S.brand("GrantId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type GrantId = typeof GrantId.Type;

/**
 * A capability: a named set of operations a context declares. The authority
 * context grants capabilities by this id and never imports their declarer.
 *
 * **Example** (Brand a capability id)
 * ```ts
 * import { CapabilityId } from "@proto/kernel/Ids";
 *
 * const review = CapabilityId.make("party.review");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const CapabilityId = S.String.pipe(S.brand("CapabilityId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type CapabilityId = typeof CapabilityId.Type;

/**
 * A delegation: a grant derived from a parent grant for an agent run, which
 * can only narrow it. An invocation records it on each grant it derives.
 *
 * **Example** (Brand a delegation id)
 * ```ts
 * import { DelegationId } from "@proto/kernel/Ids";
 *
 * const delegation = DelegationId.make("dlg_1");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const DelegationId = S.String.pipe(S.brand("DelegationId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type DelegationId = typeof DelegationId.Type;
