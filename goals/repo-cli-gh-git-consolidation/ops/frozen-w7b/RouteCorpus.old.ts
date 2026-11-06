// Frozen at 8602b24203: only the production gh runner is replayed. Imports rebased.
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Schedule from "effect/Schedule";
import { RouteError } from "../../../../packages/tooling/tool/cli/src/commands/Ci/Route.schemas.ts";
import { RouteGhRateLimited } from "../../../../packages/tooling/tool/cli/src/commands/Ci/RouteCorpus.ts";
import { ghOutput } from "../../../../packages/tooling/tool/cli/src/internal/github/index.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RouteGhRunner } from "../../../../packages/tooling/tool/cli/src/commands/Ci/RouteCorpus.ts";
import type { GhCommandFailure } from "../../../../packages/tooling/tool/cli/src/internal/github/index.ts";

const GH_RATE_LIMIT_PATTERN = /rate limit exceeded|secondary rate limit/iu;
const ghFailure = Match.type<GhCommandFailure>().pipe(
  Match.tagsExhaustive({
    spawn: (failure): RouteError | RouteGhRateLimited =>
      RouteError.new("corpus-fetch", `Failed to spawn ${failure.command}.`, failure),
    "nonzero-exit": (failure): RouteError | RouteGhRateLimited =>
      GH_RATE_LIMIT_PATTERN.test(failure.output)
        ? RouteGhRateLimited.make({ command: failure.command, output: failure.output })
        : RouteError.new("corpus-fetch", `${failure.command} exited ${failure.exitCode}: ${failure.output}`, failure),
    truncated: (failure): RouteError | RouteGhRateLimited =>
      RouteError.new("corpus-fetch", `${failure.command} overflowed the capture bound.`, failure),
  })
);

export const routeGhRunner = Effect.gen(function* () {
  const context = yield* Effect.context<
    Digest.Digest | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
  >();
  const runGh: RouteGhRunner = (args, cwd) =>
    ghOutput({
      args,
      cwd,
      label: A.join(["gh", ...A.take(args, 2)], " "),
      onFailure: ghFailure,
    }).pipe(
      // A rate-limited call is not retried here: the corpus waits for the reset.
      Effect.retry({
        times: 2,
        schedule: Schedule.exponential(Duration.seconds(1)),
        while: P.not(P.isTagged("RouteGhRateLimited")),
      }),
      Effect.provide(context)
    );
  return runGh;
}).pipe(Effect.withSpan("RouteCorpus.ghRunner"));
