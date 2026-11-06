/**
 * `beep ci dependency-review`: the manifest-aware replacement for the pinned
 * dependency-review action step.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { GithubPolicyClientLive } from "./CiGovernance.ts";
import {
  DependencyReview,
  DependencyReviewLive,
  dependencyReviewFailure,
  renderDependencyReview,
} from "./DependencyReview.ts";
import { DependencyReviewRequest } from "./DependencyReviewSchemas.ts";

const decodeRequest = S.decodeUnknownEffect(DependencyReviewRequest);
const INVALID_SHAS = "dependency-review: --base and --head must be full 40-character commit SHAs";

/**
 * Run one dependency review, print its summary, and fail with a reported exit
 * on `fail` or `unknown`.
 *
 * **Details**
 *
 * Invalid SHAs exit 64; `fail` and `unknown` exit 1 after printing a GitHub
 * `::error::` annotation. The program needs a {@link DependencyReview}, so
 * tests run it over a recorded GitHub client.
 *
 * **Example** (Build the program for one range)
 *
 * ```ts
 * import { runDependencyReview } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const program = runDependencyReview({ base: "a".repeat(40), head: "b".repeat(40) })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param refs - The pull request's base and head SHAs as given on the command line.
 * @returns An effect that succeeds only on a `pass` verdict.
 * @category use-cases
 * @since 0.0.0
 */
export const runDependencyReview = Effect.fn("Ci.dependencyReview")(function* (
  refs: typeof DependencyReviewRequest.Encoded
) {
  const request = yield* decodeRequest(refs).pipe(
    Effect.catchTag("SchemaError", () =>
      Console.error(`::error::${INVALID_SHAS}`).pipe(Effect.andThen(failWithReportedExit(INVALID_SHAS, 64)))
    )
  );
  const service = yield* DependencyReview;
  const verdict = yield* service.review(request);
  yield* printLines(renderDependencyReview(verdict, request, service.settings.policy));
  const failure = dependencyReviewFailure(verdict);
  if (O.isSome(failure)) {
    yield* Console.error(`::error::${failure.value}`);
    return yield* failWithReportedExit(failure.value);
  }
});

/**
 * Review a pull request's dependency changes, excluding declared fixture
 * manifests, and exit non-zero on `fail` or `unknown`.
 *
 * **Details**
 *
 * `--base` and `--head` are the pull request's full base and head SHAs. The
 * command reads GitHub through `gh api`, so it needs only a `GH_TOKEN` with
 * `contents: read`; `GH_REPO` names the repository when the checkout's remote
 * does not.
 *
 * **Example** (Register the subcommand)
 *
 * ```ts
 * import { ciDependencyReviewCommand } from "@beep/repo-cli/commands/Ci"
 *
 * const subcommands = [ciDependencyReviewCommand]
 * console.log(subcommands.length) // 1
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciDependencyReviewCommand = Command.make(
  "dependency-review",
  {
    base: Flag.String("base").pipe(Flag.withDescription("Full 40-character base commit SHA")),
    head: Flag.String("head").pipe(Flag.withDescription("Full 40-character head commit SHA")),
  },
  runDependencyReview
).pipe(
  Command.withDescription("Review dependency changes between two commits, excluding declared fixture manifests"),
  Command.provide(DependencyReviewLive.pipe(Layer.provide(GithubPolicyClientLive)))
);
