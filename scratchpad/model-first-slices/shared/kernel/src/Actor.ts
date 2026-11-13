import * as S from "effect/Schema";
import { AgentId, OrgId, PrincipalId, RunId } from "./Ids.ts";

/**
 * Who made something true: a person, an agent run acting on a person's behalf,
 * or a system process. Every event records one as `by`, so provenance is
 * business data rather than envelope metadata.
 *
 * **Example** (Match on the kind of actor)
 * ```ts
 * import { Actor, human } from "@proto/kernel/Actor";
 *
 * const label = Actor.match(human("p_dana", "org_acme"), {
 *   Human: (h) => `person ${h.principal}`,
 *   Agent: (a) => `agent ${a.agent} for ${a.onBehalfOf}`,
 *   System: (s) => `process ${s.process}`,
 * });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Actor = S.TaggedUnion({
  Human: { principal: PrincipalId, org: OrgId },
  Agent: { agent: AgentId, model: S.String, run: RunId, onBehalfOf: PrincipalId, org: OrgId },
  System: { process: S.String, org: OrgId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Actor = typeof Actor.Type;

/**
 * A human actor.
 *
 * **Example** (A reviewer at one org)
 * ```ts
 * import { human } from "@proto/kernel/Actor";
 *
 * const reviewer = human("p_dana", "org_acme");
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const human = (principal: string, org: string): Actor =>
  Actor.cases.Human.make({ principal: PrincipalId.make(principal), org: OrgId.make(org) });

/**
 * An agent actor: one run of a named agent, acting for a principal.
 *
 * **Example** (An assistant run)
 * ```ts
 * import { agent } from "@proto/kernel/Actor";
 *
 * const assistant = agent({ agent: "review-assistant", model: "stub", run: "run_1", onBehalfOf: "p_dana", org: "org_acme" });
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const agent = (options: {
  readonly agent: string;
  readonly model: string;
  readonly run: string;
  readonly onBehalfOf: string;
  readonly org: string;
}): Actor =>
  Actor.cases.Agent.make({
    agent: AgentId.make(options.agent),
    model: options.model,
    run: RunId.make(options.run),
    onBehalfOf: PrincipalId.make(options.onBehalfOf),
    org: OrgId.make(options.org),
  });

/**
 * A system actor: a process (a policy, a poller) acting inside one org.
 *
 * **Example** (A policy acting as the system)
 * ```ts
 * import { system } from "@proto/kernel/Actor";
 *
 * const merger = system("MergeOnSameParty", "org_acme");
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const system = (process: string, org: string): Actor =>
  Actor.cases.System.make({ process, org: OrgId.make(org) });

/**
 * The org an actor acts in. Every variant carries one, so this needs no match.
 *
 * **Example** (Scope a read to the caller)
 * ```ts
 * import { human, orgOf } from "@proto/kernel/Actor";
 *
 * const org = orgOf(human("p_dana", "org_acme"));
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const orgOf = (actor: Actor): OrgId => actor.org;
