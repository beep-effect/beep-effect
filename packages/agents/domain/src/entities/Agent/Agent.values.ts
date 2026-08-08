/**
 * Value schemas that constrain agent entity fields.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $AgentsDomainId.create("entities/Agent/Agent.values");

/**
 * Closed vocabulary of execution modes supported by fixture-backed agents.
 *
 * **Example** (Check deterministic fixture mode)
 *
 * ```ts
 * import { AgentMode } from "@beep/agents-domain"
 *
 * console.log(AgentMode.is.deterministic_fixture("deterministic_fixture"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentMode = LiteralKit(["deterministic_fixture"]).pipe(
  $I.annoteSchema("AgentMode", {
    description: "Closed vocabulary of execution modes supported by fixture-backed agents.",
  })
);

/**
 * Type accepted by the {@link AgentMode} schema.
 *
 * **Example** (Satisfy AgentMode type)
 *
 * ```ts
 * import type { AgentMode } from "@beep/agents-domain"
 *
 * const fixtureMode = "deterministic_fixture" satisfies AgentMode
 * console.log(fixtureMode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AgentMode = typeof AgentMode.Type;
