/**
 * Token Budget Service
 *
 * **Details**
 *
 * Tracks token usage across extraction stages with per-stage budgets.
 * Prevents any single stage from consuming the entire token allocation.
 *
 * Budget allocation:
 * - Entity extraction: 35%
 * - Relation extraction: 35%
 * - Grounding: 15%
 * - Property scoping: 8%
 * - Other: 7%
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Context, Effect, Layer, Ref } from "effect";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Service/LlmControl/TokenBudget");

// =============================================================================
// Types
// =============================================================================

/**
 * Stage names that have dedicated token budgets
 *
 * **Example** (Inspect budgeted stage)
 *
 * ```ts
 * import { BudgetedStage } from "@effect-ontology/Service/LlmControl/TokenBudget"
 *
 * console.log(BudgetedStage)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const BudgetedStage = LiteralKit([
  "entity_extraction",
  "relation_extraction",
  "grounding",
  "property_scoping",
  "other",
]);

/**
 * Describes the budgeted stage data exposed by this module.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type BudgetedStage = typeof BudgetedStage.Type;

const isBudgetedStage = S.is(BudgetedStage);

/**
 * Token budget state tracking usage across stages
 *
 *
 * **Example** (Use the TokenBudgetState contract)
 *
 * ```ts
 * import type { TokenBudgetState } from "@effect-ontology/Service/LlmControl/TokenBudget"
 *
 * const acceptsTokenBudgetState = (_value: TokenBudgetState): void => undefined
 *
 * console.log(acceptsTokenBudgetState)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface TokenBudgetState {
  /** Total token budget for the request */
  readonly total: number;
  /** Total tokens used across all stages */
  readonly used: number;
  /** Tokens used per stage */
  readonly byStage: Record<string, number>;
}

/**
 * Budget allocation percentages by stage
 */
const STAGE_ALLOCATIONS: Record<BudgetedStage, number> = {
  entity_extraction: 0.35,
  relation_extraction: 0.35,
  grounding: 0.15,
  property_scoping: 0.08,
  other: 0.07,
};

// =============================================================================
// Service
// =============================================================================

/**
 * Token budget management for extraction requests
 *
 * **Details**
 *
 * Provides fine-grained control over LLM token consumption with:
 * - Per-stage budget limits
 * - Usage tracking
 * - Budget availability checks
 *
 * **Example** (Inspect the token-budget layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { TokenBudgetServiceLive } from "@effect-ontology/Service/LlmControl/TokenBudget"
 *
 * console.log(Layer.isLayer(TokenBudgetServiceLive)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TokenBudgetService extends Context.Service<
  TokenBudgetService,
  {
    /**
     * Check if a stage can afford the specified tokens
     *
     * @param stage - Extraction stage name
     * @param tokens - Number of tokens to check
     * @returns true if stage has sufficient budget
     */
    readonly canAfford: (stage: string, tokens: number) => Effect.Effect<boolean>;

    /**
     * Record token usage for a stage
     *
     * @param stage - Extraction stage name
     * @param tokens - Number of tokens used
     */
    readonly recordUsage: (stage: string, tokens: number) => Effect.Effect<void>;

    /**
     * Get remaining total budget
     *
     * @returns Number of tokens remaining
     */
    readonly getRemaining: Effect.Effect<number>;

    /**
     * Get remaining budget for a specific stage
     *
     * @param stage - Extraction stage name
     * @returns Number of tokens remaining for stage
     */
    readonly getStageRemaining: (stage: string) => Effect.Effect<number>;

    /**
     * Get current state snapshot
     *
     * @returns Current budget state
     */
    readonly getState: Effect.Effect<TokenBudgetState>;

    /**
     * Reset budget for a new request
     *
     * @param total - Total token budget (default: 4096)
     */
    readonly reset: (total?: number) => Effect.Effect<void>;
  }
>()($I`TokenBudgetService`) {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Get budget limit for a stage based on allocation percentage
 */
const getStageBudget = (stage: string, total: number): number => {
  const allocation = isBudgetedStage(stage) ? STAGE_ALLOCATIONS[stage] : STAGE_ALLOCATIONS.other;
  return Math.floor(total * allocation);
};

/**
 * Default implementation using Effect Ref for state
 */
const make = Effect.fn("TokenBudgetService.make")(function* (initialTotal: number = 4096) {
  const state = yield* Ref.make<TokenBudgetState>({
    total: initialTotal,
    used: 0,
    byStage: {},
  });

  return {
    canAfford: (stage: string, tokens: number) =>
      Ref.get(state).pipe(
        Effect.map((s) => {
          const stageLimit = getStageBudget(stage, s.total);
          const stageUsed = s.byStage[stage] ?? 0;
          return stageUsed + tokens <= stageLimit;
        })
      ),

    recordUsage: (stage: string, tokens: number) =>
      Ref.update(state, (s) => ({
        ...s,
        used: s.used + tokens,
        byStage: {
          ...s.byStage,
          [stage]: (s.byStage[stage] ?? 0) + tokens,
        },
      })),

    getRemaining: Ref.get(state).pipe(Effect.map((s) => s.total - s.used)),

    getStageRemaining: (stage: string) =>
      Ref.get(state).pipe(
        Effect.map((s) => {
          const stageLimit = getStageBudget(stage, s.total);
          const stageUsed = s.byStage[stage] ?? 0;
          return stageLimit - stageUsed;
        })
      ),

    getState: Ref.get(state),

    reset: (total: number = 4096) => Ref.set(state, { total, used: 0, byStage: {} }),
  };
});

/**
 * Default layer providing TokenBudgetService
 *
 * **Example** (Inspect token budget service live)
 *
 * ```ts
 * import { TokenBudgetServiceLive } from "@effect-ontology/Service/LlmControl/TokenBudget"
 *
 * console.log(TokenBudgetServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TokenBudgetServiceLive = Layer.effect(TokenBudgetService, make());

/**
 * Test layer with configurable initial state
 *
 * **Example** (Inspect token budget service test)
 *
 * ```ts
 * import { TokenBudgetServiceTest } from "@effect-ontology/Service/LlmControl/TokenBudget"
 *
 * console.log(TokenBudgetServiceTest)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TokenBudgetServiceTest = (initialTotal: number = 4096): Layer.Layer<TokenBudgetService> =>
  Layer.effect(TokenBudgetService, make(initialTotal));
