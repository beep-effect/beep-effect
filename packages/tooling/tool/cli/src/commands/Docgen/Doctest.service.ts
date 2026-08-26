/**
 * Service contracts for the doctest fence analyzer and rewriter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { DoctestAnalysisError, DoctestRewriteError } from "./Doctest.errors.ts";
import type { DoctestCliConfig, DoctestReport, MarkPlan } from "./Doctest.schemas.ts";

const $I = $RepoCliId.create("commands/Docgen/Doctest.service");

/**
 * Contract for analyzing doctest fences and validating assertions already marked for runtime execution.
 *
 * @category services
 * @since 0.0.0
 */
export interface DoctestFenceAnalyzerShape {
  readonly analyze: (config: DoctestCliConfig) => Effect.Effect<DoctestReport, DoctestAnalysisError>;
  readonly validateMarkedAssertions: (report: DoctestReport) => Effect.Effect<void, DoctestAnalysisError>;
}

/**
 * Provides doctest analysis through the Effect context.
 *
 * **Example** (Access the analyzer service)
 *
 * ```ts
 * import { DoctestFenceAnalyzer } from "@beep/repo-cli/commands/Docgen"
 * import { Effect } from "effect"
 *
 * const access = Effect.gen(function* () {
 *   const analyzer = yield* DoctestFenceAnalyzer
 *   return analyzer.analyze
 * })
 * console.log(Effect.isEffect(access))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DoctestFenceAnalyzer extends Context.Service<DoctestFenceAnalyzer, DoctestFenceAnalyzerShape>()(
  $I`DoctestFenceAnalyzer`
) {}

/**
 * Contract for previewing or applying verified doctest rewrite plans.
 *
 * @category services
 * @since 0.0.0
 */
export interface DoctestFenceRewriterShape {
  readonly preview: (plans: ReadonlyArray<MarkPlan>) => Effect.Effect<ReadonlyArray<string>, DoctestRewriteError>;
  readonly write: (plans: ReadonlyArray<MarkPlan>) => Effect.Effect<ReadonlyArray<string>, DoctestRewriteError>;
}

/**
 * Provides doctest source rewriting through the Effect context.
 *
 * **Example** (Access the rewriter service)
 *
 * ```ts
 * import { DoctestFenceRewriter } from "@beep/repo-cli/commands/Docgen"
 * import { Effect } from "effect"
 *
 * const access = Effect.gen(function* () {
 *   const rewriter = yield* DoctestFenceRewriter
 *   return rewriter.preview
 * })
 * console.log(Effect.isEffect(access))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DoctestFenceRewriter extends Context.Service<DoctestFenceRewriter, DoctestFenceRewriterShape>()(
  $I`DoctestFenceRewriter`
) {}
