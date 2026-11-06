/**
 * Service contracts for goal completion GitHub reads and merge-time evidence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type { YeetCommandError } from "../Yeet/Yeet.errors.ts";
import type {
  GoalCompletionCheckPages,
  GoalCompletionCommit,
  GoalCompletionPull,
  GoalCompletionRuleSuite,
  GoalCompletionRuleSuiteList,
  GoalCompletionRulesetHistory,
  GoalCompletionRulesetList,
  GoalCompletionRulesetVersion,
  GoalCompletionSuitePages,
  GoalCompletionTimelinePages,
  GoalMergeTimeEvidence,
  GoalMergeTimeEvidenceRequest,
} from "./CompletionEvidence.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/CompletionEvidence.service");

/**
 * Supplies read-only GitHub and git observations; fixture providers never contact the network.
 *
 * **Example** (Inspect the observation port)
 *
 * ```ts
 * import { GoalCompletionIo } from "@beep/repo-cli/commands/Goals/CompletionEvidence.service"
 * console.log(typeof GoalCompletionIo.of)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalCompletionIo extends Context.Service<
  GoalCompletionIo,
  {
    /** Accepted manifest bytes in the local object database; absence permits the hosted fallback. */
    readonly manifestAtHead: (
      root: string,
      head: string,
      path: string
    ) => Effect.Effect<O.Option<string>, YeetCommandError>;
    /** Origin URL, absent when the checkout has no origin. */
    readonly originUrl: (root: string) => Effect.Effect<O.Option<string>, YeetCommandError>;
    /** Accepted manifest bytes from GitHub contents. */
    readonly hostedManifest: (
      root: string,
      head: string,
      path: string
    ) => Effect.Effect<O.Option<string>, YeetCommandError>;
    /** Pull-request decoded observation. */
    readonly pullRequest: (root: string, number: number) => Effect.Effect<GoalCompletionPull, YeetCommandError>;
    /** Decoded merge commit. */
    readonly commit: (root: string, sha: string) => Effect.Effect<GoalCompletionCommit, YeetCommandError>;
    /** All check runs (filter=all), grouped into a single assembled page. */
    readonly checkRuns: (root: string, sha: string) => Effect.Effect<GoalCompletionCheckPages, YeetCommandError>;
    /** All timeline events, including undated events, grouped into one assembled page. */
    readonly timeline: (root: string, number: number) => Effect.Effect<GoalCompletionTimelinePages, YeetCommandError>;
    /** All check suites, grouped into one assembled page. */
    readonly checkSuites: (root: string, sha: string) => Effect.Effect<GoalCompletionSuitePages, YeetCommandError>;
    /** Every historical version of one ruleset. */
    readonly rulesetHistory: (
      root: string,
      id: number
    ) => Effect.Effect<GoalCompletionRulesetHistory, YeetCommandError>;
    /** One historical ruleset state. */
    readonly rulesetVersion: (
      root: string,
      id: number,
      version: number
    ) => Effect.Effect<GoalCompletionRulesetVersion, YeetCommandError>;
    /** Every merge-push rule suite for a ref in the last month. */
    readonly ruleSuites: (root: string, ref: string) => Effect.Effect<GoalCompletionRuleSuiteList, YeetCommandError>;
    /** The evaluated rules of one merge-push suite. */
    readonly ruleSuite: (root: string, id: number) => Effect.Effect<GoalCompletionRuleSuite, YeetCommandError>;
    /** Current repository and inherited rulesets, including creation instants. */
    readonly rulesets: (root: string) => Effect.Effect<GoalCompletionRulesetList, YeetCommandError>;
  }
>()($I`GoalCompletionIo`) {}

/**
 * Operations a merge-time evidence provider supplies.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalMergeTimeEvidenceProviderShape = {
  readonly observe: (root: string, request: GoalMergeTimeEvidenceRequest) => Effect.Effect<GoalMergeTimeEvidence>;
};

/**
 * Reads the merge-time required-check inventory and binds each required context to the accepted head.
 *
 * **Details**
 *
 * The provider never fails: a failed or partial read is recorded as an
 * evidence gap so the verdict stays unknown. The live layer reads GitHub's
 * rule suite for the merge push, the current ruleset inventory and each
 * ruleset's history version at merge through {@link GoalCompletionIo} (or the
 * kit adapters when no port is provided). Tests provide `GoalCompletionIo`
 * with recorded fixtures.
 *
 * **Example** (Read the service key)
 *
 * ```ts
 * import { GoalMergeTimeEvidenceProvider } from "@beep/repo-cli/commands/Goals/CompletionEvidence.service"
 * console.log(GoalMergeTimeEvidenceProvider.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalMergeTimeEvidenceProvider extends Context.Service<
  GoalMergeTimeEvidenceProvider,
  GoalMergeTimeEvidenceProviderShape
>()($I`GoalMergeTimeEvidenceProvider`) {}
