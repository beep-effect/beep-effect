/**
 * Token Budget Service
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
 * @since 2.0.0
 * @module Service/LlmControl/TokenBudget
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, Layer, Ref } from "effect";

const $I = $ScratchpadId.create("effect-ontology/Service/LlmControl/TokenBudget");

// =============================================================================
// Types
// =============================================================================

/**
 * Stage names that have dedicated token budgets
 */
export type BudgetedStage = "entity_extraction" | "relation_extraction" | "grounding" | "property_scoping" | "other";

/**
 * Token budget state tracking usage across stages
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
 * Provides fine-grained control over LLM token consumption with:
 * - Per-stage budget limits
 * - Usage tracking
 * - Budget availability checks
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const budget = yield* TokenBudgetService
 *
 *   // Reset for new request
 *   yield* budget.reset(4096)
 *
 *   // Check if stage can afford tokens
 *   const canProceed = yield* budget.canAfford("entity_extraction", 1000)
 *   if (!canProceed) {
 *     yield* Effect.fail(new Error("Token budget exceeded for stage"))
 *   }
 *
 *   // Record usage after LLM call
 *   yield* budget.recordUsage("entity_extraction", 856)
 *
 *   // Check remaining
 *   const remaining = yield* budget.getRemaining()
 * })
 * ```
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
  const allocation = STAGE_ALLOCATIONS[stage as BudgetedStage] ?? STAGE_ALLOCATIONS.other;
  return Math.floor(total * allocation);
};

/**
 * Default implementation using Effect Ref for state
 */
const make = Effect.gen(function* () {
  const state = yield* Ref.make<TokenBudgetState>({
    total: 4096,
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
 */
export const TokenBudgetServiceLive = Layer.effect(TokenBudgetService, make);

/**
 * Test layer with configurable initial state
 */
export const TokenBudgetServiceTest = (initialTotal: number = 4096): Layer.Layer<TokenBudgetService> =>
  Layer.effect(
    TokenBudgetService,
    Effect.gen(function* () {
      const state = yield* Ref.make<TokenBudgetState>({
        total: initialTotal,
        used: 0,
        byStage: {},
      });

      return {
        canAfford: Effect.fn("TokenBudgetService.canAfford")((stage: string, tokens: number) =>
          Ref.get(state).pipe(
            Effect.map((s) => {
              const stageLimit = getStageBudget(stage, s.total);
              const stageUsed = s.byStage[stage] ?? 0;
              return stageUsed + tokens <= stageLimit;
            })
          )
        ),
        recordUsage: Effect.fn("TokenBudgetService.recordUsage")((stage: string, tokens: number) =>
          Ref.update(state, (s) => ({
            ...s,
            used: s.used + tokens,
            byStage: {
              ...s.byStage,
              [stage]: (s.byStage[stage] ?? 0) + tokens,
            },
          }))
        ),
        getRemaining: Ref.get(state).pipe(Effect.map((s) => s.total - s.used)),
        getStageRemaining: Effect.fn("TokenBudgetService.getStageRemaining")((stage: string) =>
          Ref.get(state).pipe(
            Effect.map((s) => {
              const stageLimit = getStageBudget(stage, s.total);
              const stageUsed = s.byStage[stage] ?? 0;
              return stageLimit - stageUsed;
            })
          )
        ),
        getState: Ref.get(state),
        reset: Effect.fn("TokenBudgetService.reset")((total: number = 4096) =>
          Ref.set(state, { total, used: 0, byStage: {} })
        ),
      };
    })
  );
