/**
 * Frozen pre-W3 body for `ops/reviewer-ci-github-differential-w3.ts`: the gh api governance client, verbatim from
 * main 12ececd3b7 except for import paths, the identity namespace and the service shape typed locally.
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { CiCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Ci/Ci.errors.ts";
import { GithubApiReply } from "../../../../packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts";
import { runRepoCommandCapture } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

export const makeClient = Effect.fn("CiGovernance.makeClient")(function* (root: string) {
  // Capture the platform dependencies once; commands provide this implementation.
  const capture = yield* Effect.context<SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>();
  const request = Effect.fn("CiGovernance.request")(function* (args: ReadonlyArray<string>) {
    const result = yield* runRepoCommandCapture("gh", ["api", ...args], root).pipe(
      Effect.provide(capture),
      CiCommandError.mapError("GitHub policy request failed; state is unknown.")
    );
    return GithubApiReply.make(result);
  });
  const execute = Effect.fn("CiGovernance.execute")(function* (args: ReadonlyArray<string>) {
    const result = yield* request(args);
    if (result.exitCode !== 0 || result.truncated)
      return yield* CiCommandError.make({
        message: `GitHub policy request failed (exit ${result.exitCode}, truncated=${result.truncated}); state is unknown.`,
      });
    return result.output;
  });
  return {
    read: Effect.fn("GithubPolicyClient.read")((endpoint: string, projection?: string) =>
      execute([endpoint, ...A.flatMap(O.toArray(O.fromUndefinedOr(projection)), (jq) => ["--jq", jq])])
    ),
    write: Effect.fn("GithubPolicyClient.write")((args: ReadonlyArray<string>) => execute(args).pipe(Effect.asVoid)),
    request,
  };
});
