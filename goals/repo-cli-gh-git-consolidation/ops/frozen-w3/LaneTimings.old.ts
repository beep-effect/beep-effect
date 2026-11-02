/**
 * Frozen pre-W3 body for `ops/reviewer-ci-github-differential-w3.ts`: the gh api JSON reader with its transient classifier and retry, verbatim from
 * main 12ececd3b7 except for import paths, the identity namespace and the jq projections exported.
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, O } from "@beep/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { CiCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Ci/Ci.errors.ts";
import { runRepoCommandCapture } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("goals/repo-cli-gh-git-consolidation/ops/frozen-w3/LaneTimings.old");

export const CI_WORKFLOW_RUNS_JQ =
  "{total_count,workflow_runs:[.workflow_runs[]|{created_at,event,head_branch,head_sha,id,run_attempt,run_started_at,updated_at}]}";
export const CI_LEGACY_WORKFLOW_JOBS_JQ =
  "{total_count,jobs:[.jobs[]|{completed_at,conclusion,created_at,id,labels,name,run_attempt,run_id,runner_name,started_at,status,steps}]}";
export const CI_WINDOW_WORKFLOW_JOBS_JQ =
  "{total_count,jobs:[.jobs[]|{completed_at,conclusion,created_at,id,name,run_attempt,run_id,started_at,status}]}";
export const CI_BRANCH_RULES_JQ = "[.[]|{ruleset_id,type}+(if .parameters==null then {} else {parameters} end)]";

const GH_API_TRANSIENT_RETRY_COUNT = 4;

const GhApiTransientKind = LiteralKit(["transport", "secondary-rate-limit"]).pipe(
  $I.annoteSchema("GhApiTransientKind", {
    description: "Which transient class a failed gh api exit belongs to; each class has its own backoff base.",
  })
);
type GhApiTransientKind = typeof GhApiTransientKind.Type;

const GH_API_TRANSIENT_BASE_DELAY: Record<GhApiTransientKind, Duration.Duration> = {
  transport: Duration.millis(250),
  "secondary-rate-limit": Duration.minutes(1),
};

const GH_API_TRANSPORT_OUTPUT_PATTERNS: ReadonlyArray<RegExp> = [
  /bad record MAC/iu,
  /connection reset/iu,
  /unexpected EOF/iu,
  /\btimed out\b|\btimeout\b/iu,
  /\(HTTP 50[234]\)/u,
];

const GH_API_SECONDARY_RATE_LIMIT_PATTERN = /secondary rate limit/iu;
const GH_API_RATE_LIMIT_STATUS_PATTERN = /\(HTTP (?:403|429)\)/u;

const classifyGhApiTransientOutput = (output: string): O.Option<GhApiTransientKind> =>
  GH_API_SECONDARY_RATE_LIMIT_PATTERN.test(output) && GH_API_RATE_LIMIT_STATUS_PATTERN.test(output)
    ? O.some("secondary-rate-limit")
    : A.some(GH_API_TRANSPORT_OUTPUT_PATTERNS, (pattern) => pattern.test(output))
      ? O.some("transport")
      : O.none();

class CiGhApiTransientExit extends S.TaggedError<CiGhApiTransientExit, { readonly brand: unique symbol }>(
  $I`CiGhApiTransientExit`
)(
  "CiGhApiTransientExit",
  { endpoint: S.String, exitCode: S.Finite, kind: GhApiTransientKind, output: S.String },
  $I.annoteError<CiGhApiTransientExit>("CiGhApiTransientExit", {
    description: "A non-zero gh api exit whose output matches a transient transport or rate-limit failure.",
  })
) {}

const isCiGhApiTransientExit = P.isTagged("CiGhApiTransientExit");

const ghApiTransientBaseDelay = (error: CiCommandError | CiGhApiTransientExit): Duration.Duration =>
  isCiGhApiTransientExit(error) ? GH_API_TRANSIENT_BASE_DELAY[error.kind] : GH_API_TRANSIENT_BASE_DELAY.transport;

const ghApiTransientRetrySchedule: Schedule.Schedule<Duration.Duration, CiCommandError | CiGhApiTransientExit> =
  Schedule.fromStepWithMetadata(
    Effect.succeed((meta: Schedule.InputMetadata<CiCommandError | CiGhApiTransientExit>) => {
      const delay = Duration.millis(
        meta.input.pipe(ghApiTransientBaseDelay, Duration.toMillis) * 2 ** (meta.attempt - 1)
      );
      return Effect.succeed<[Duration.Duration, Duration.Duration]>([delay, delay]);
    })
  ).pipe(
    Schedule.modifyDelay(({ duration }) =>
      Effect.map(Random.next, (random) => Duration.millis(Duration.toMillis(duration) * (1 + 0.2 * random)))
    )
  );

const ghApiJsonAttempt = Effect.fn("Ci.laneTimingsGhApiAttempt")(function* (
  repoRoot: string,
  endpoint: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<
  string,
  CiCommandError | CiGhApiTransientExit,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const result = yield* runRepoCommandCapture("gh", args, repoRoot).pipe(
    CiCommandError.mapError(`Failed to run gh api ${endpoint}.`)
  );
  if (result.truncated) {
    return yield* CiCommandError.make({ message: `gh api ${endpoint} returned a truncated response.` });
  }
  if (result.exitCode !== 0) {
    return yield* O.match(classifyGhApiTransientOutput(result.output), {
      onNone: () => CiCommandError.make({ message: `gh api ${endpoint} exited ${result.exitCode}: ${result.output}` }),
      onSome: (kind) => CiGhApiTransientExit.make({ endpoint, exitCode: result.exitCode, kind, output: result.output }),
    });
  }
  return result.output;
});

export const ghApiJson = Effect.fn("Ci.laneTimingsGhApi")(function* (
  repoRoot: string,
  endpoint: string,
  jqProjection: O.Option<string>
): Effect.fn.Return<string, CiCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const args = A.appendAll(
    ["api", endpoint],
    A.flatMap(O.toArray(jqProjection), (projection) => ["--jq", projection])
  );
  return yield* ghApiJsonAttempt(repoRoot, endpoint, args).pipe(
    Effect.retry({
      schedule: ghApiTransientRetrySchedule,
      times: GH_API_TRANSIENT_RETRY_COUNT,
      while: isCiGhApiTransientExit,
    }),
    Effect.catchTag("CiGhApiTransientExit", (exit) =>
      CiCommandError.make({
        message: `gh api ${endpoint} exited ${exit.exitCode} on every one of ${GH_API_TRANSIENT_RETRY_COUNT + 1} attempts (${exit.kind}): ${exit.output}`,
      })
    )
  );
});
