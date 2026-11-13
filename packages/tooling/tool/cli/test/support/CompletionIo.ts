import { ReviewThreads } from "@beep/github/ReviewThread";
import {
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
} from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas";
import { GoalCompletionIo } from "@beep/repo-cli/commands/Goals/CompletionEvidence.service";
import { YeetCommandError } from "@beep/repo-cli/commands/Yeet/Yeet.errors";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const decodeJson = S.decodeEffect(S.fromJsonString(S.Unknown));

// Recorded pull bodies predate the `state` field the decoder requires; GitHub
// reports a merged pull request as closed, so fill it from `merged`.
const withPullState = (value: unknown): unknown =>
  P.isObject(value) && !P.hasProperty(value, "state")
    ? { ...value, state: P.hasProperty(value, "merged") && value.merged === true ? "closed" : "open" }
    : value;

/**
 * An empty review-thread read: the default the fixture answers for every pull request.
 *
 * **Example** (Read the default)
 * ```ts
 * import { noReviewThreads } from "./CompletionIo.ts"
 * console.log(noReviewThreads.threads.length) // 0
 * ```
 * @category testing
 * @since 0.0.0
 */
export const noReviewThreads = ReviewThreads.make({ pullRequestAuthor: O.none(), threads: [] });

/**
 * Build typed completion reads from recorded endpoint bodies without argv or network calls.
 *
 * **Details**
 *
 * `reviewThreads` answers every pull request with no threads unless the test
 * overrides it, and a recorded `pulls/{n}` body without `state` gets one from
 * `merged`, so fixtures written before either read existed keep decoding.
 *
 * **Example** (Keep local manifest bytes in a fixture)
 * ```ts
 * import { completionIoFixture } from "./CompletionIo.ts"
 * import * as Effect from "effect/Effect"
 * const io = completionIoFixture({ manifest: Effect.succeed("{}"),
 *   origin: Effect.succeed("git@github.com:example/repo.git"),
 *   respond: () => Effect.succeed("{}") })
 * console.log(Effect.isEffect(io.manifestAtHead(".", "head", "manifest.json")))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const completionIoFixture = (options: {
  readonly manifest: Effect.Effect<string, YeetCommandError>;
  readonly origin: Effect.Effect<string, YeetCommandError>;
  readonly respond: (endpoint: string) => Effect.Effect<string, YeetCommandError>;
  readonly reviewThreads?: (number: number) => Effect.Effect<ReviewThreads, YeetCommandError>;
}): GoalCompletionIo["Service"] => {
  const invalid = () => YeetCommandError.make({ message: "Invalid fixture payload" });
  const read = <Schema extends S.Top & { readonly DecodingServices: never }>(endpoint: string, schema: Schema) =>
    options
      .respond(endpoint)
      .pipe(Effect.flatMap((text) => S.decodeEffect(S.fromJsonString(schema))(text).pipe(Effect.mapError(invalid))));
  const prefix = "repos/{owner}/{repo}";
  return GoalCompletionIo.of({
    manifestAtHead: Effect.fn("GoalCompletionIo.manifestAtHead")(() => options.manifest.pipe(Effect.asSome)),
    originUrl: Effect.fn("GoalCompletionIo.originUrl")(() => options.origin.pipe(Effect.asSome)),
    hostedManifest: Effect.fn("GoalCompletionIo.hostedManifest")((_root, head, path) =>
      options.respond(`${prefix}/contents/${path}?ref=${head}`).pipe(Effect.asSome)
    ),
    pullRequest: Effect.fn("GoalCompletionIo.pullRequest")((_root, number) =>
      options
        .respond(`${prefix}/pulls/${number}`)
        .pipe(
          Effect.flatMap((text) =>
            decodeJson(text).pipe(
              Effect.map(withPullState),
              Effect.flatMap(S.decodeUnknownEffect(GoalCompletionPull)),
              Effect.mapError(invalid)
            )
          )
        )
    ),
    commit: Effect.fn("GoalCompletionIo.commit")((_root, sha) =>
      read(`${prefix}/commits/${sha}`, GoalCompletionCommit)
    ),
    checkRuns: Effect.fn("GoalCompletionIo.checkRuns")((_root, sha) =>
      read(`${prefix}/commits/${sha}/check-runs?per_page=100&filter=all`, GoalCompletionCheckPages)
    ),
    timeline: Effect.fn("GoalCompletionIo.timeline")((_root, number) =>
      read(`${prefix}/issues/${number}/timeline?per_page=100`, GoalCompletionTimelinePages)
    ),
    checkSuites: Effect.fn("GoalCompletionIo.checkSuites")((_root, sha) =>
      read(`${prefix}/commits/${sha}/check-suites?per_page=100`, GoalCompletionSuitePages)
    ),
    rulesetHistory: Effect.fn("GoalCompletionIo.rulesetHistory")((_root, id) =>
      read(`${prefix}/rulesets/${id}/history?per_page=100`, GoalCompletionRulesetHistory)
    ),
    rulesetVersion: Effect.fn("GoalCompletionIo.rulesetVersion")((_root, id, version) =>
      read(`${prefix}/rulesets/${id}/history/${version}`, GoalCompletionRulesetVersion)
    ),
    ruleSuites: Effect.fn("GoalCompletionIo.ruleSuites")((_root, ref) =>
      read(`${prefix}/rulesets/rule-suites?ref=${ref}&time_period=month&per_page=100`, GoalCompletionRuleSuiteList)
    ),
    ruleSuite: Effect.fn("GoalCompletionIo.ruleSuite")((_root, id) =>
      read(`${prefix}/rulesets/rule-suites/${id}`, GoalCompletionRuleSuite)
    ),
    rulesets: Effect.fn("GoalCompletionIo.rulesets")(() =>
      read(`${prefix}/rulesets?per_page=100&includes_parents=true`, GoalCompletionRulesetList)
    ),
    reviewThreads: Effect.fn("GoalCompletionIo.reviewThreads")((_root, number) =>
      options.reviewThreads === undefined ? Effect.succeed(noReviewThreads) : options.reviewThreads(number)
    ),
  });
};
