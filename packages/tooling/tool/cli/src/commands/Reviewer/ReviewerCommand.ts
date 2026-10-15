/**
 * CLI adapters for the beep-reviewer GitHub App.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { GitHubAppAuth, GitHubAppAuthLive } from "./GitHubAppAuth.ts";
import { ReviewerError } from "./ReviewerErrors.ts";
import { reviewerWire } from "./ReviewerModels.ts";
import { enforceReviewerGate, requireReviewerRuleset } from "./ReviewerRuleset.ts";
import { Reviewer, ReviewerLive } from "./ReviewerService.ts";

const authLayer = ReviewerLive.pipe(Layer.provideMerge(GitHubAppAuthLive));
const number = (name: string) => Flag.Int(name);
const pr = number("pr");
const sha = Flag.String("sha");
const id = number("id");
const isReviewerError = S.is(ReviewerError);
const boundary = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  program.pipe(
    Effect.catchCause((cause) => {
      const error = Cause.squash(cause);
      return failWithReportedExit(
        isReviewerError(error)
          ? `[reviewer] ${error.message}`
          : "[reviewer] Operation failed. Verify App configuration, input, and repository access; secret diagnostics suppressed."
      );
    })
  );
const readFile = Effect.fn("Reviewer.readFile")(function* (path: string) {
  return yield* (yield* FileSystem.FileSystem).readFileString(path);
});
const tokenCommand = Command.make("token", {}, () =>
  boundary(
    Effect.gen(function* () {
      const auth = yield* GitHubAppAuth;
      // The only deliberate token declassification. Stdout is for a pipe/command substitution, never logs.
      yield* auth.token.pipe(Effect.map(Redacted.value), Effect.flatMap(Console.log));
    })
  )
).pipe(Command.provide(GitHubAppAuthLive));
const startCommand = Command.make("start", { pr, sha }, ({ pr, sha }) =>
  boundary(Reviewer.use((reviewer) => reviewer.start(pr, sha)).pipe(Effect.flatMap(Console.log)))
);
const completeCommand = Command.make(
  "complete",
  {
    id,
    score: number("score"),
    tier: Flag.ChoiceWithValue("tier", [
      ["L0", "L0"],
      ["L1", "L1"],
      ["L2", "L2"],
      ["L3", "L3"],
    ]),
    p0: number("p0"),
    p1: number("p1"),
    p2: number("p2"),
    summaryFile: Flag.String("summary-file").pipe(Flag.optional),
    annotationsFile: Flag.String("annotations-file").pipe(Flag.optional),
    conclusion: Flag.ChoiceWithValue("conclusion", [
      ["auto", "auto"],
      ["success", "success"],
      ["failure", "failure"],
      ["neutral", "neutral"],
      ["cancelled", "cancelled"],
      ["timed_out", "timed_out"],
      ["action_required", "action_required"],
    ]).pipe(Flag.withDefault("auto")),
  },
  (options) =>
    boundary(
      Effect.gen(function* () {
        const summary = O.isSome(options.summaryFile) ? yield* readFile(options.summaryFile.value) : "Review complete.";
        const annotations = O.isSome(options.annotationsFile)
          ? yield* readFile(options.annotationsFile.value).pipe(Effect.flatMap(reviewerWire.annotations))
          : [];
        const result = yield* reviewerWire.result({ ...options, summary, annotations });
        yield* Console.log(yield* (yield* Reviewer).complete(options.id, result));
      })
    )
);
const cancelCommand = Command.make(
  "cancel",
  { id, reason: Flag.String("reason").pipe(Flag.withDefault("superseded")) },
  ({ id, reason }) =>
    boundary(Reviewer.use((reviewer) => reviewer.cancel(id, reason)).pipe(Effect.flatMap(Console.log)))
);
const checkCommand = Command.make("check").pipe(
  Command.withSubcommands([startCommand, completeCommand, cancelCommand]),
  Command.provide(authLayer)
);
const commentCommand = Command.make("comment").pipe(
  Command.withSubcommands([
    Command.make("upsert", { pr, bodyFile: Flag.String("body-file") }, ({ pr, bodyFile }) =>
      boundary(
        Effect.gen(function* () {
          yield* Console.log(yield* (yield* Reviewer).upsert(pr, yield* readFile(bodyFile)));
        })
      )
    ),
  ]),
  Command.provide(authLayer)
);
const reviewCommand = Command.make("review").pipe(
  Command.withSubcommands([
    Command.make("post", { pr, sha, json: Flag.String("json") }, ({ pr, sha, json }) =>
      boundary(
        Effect.gen(function* () {
          const input = yield* readFile(json).pipe(Effect.flatMap(reviewerWire.review));
          yield* Console.log(yield* (yield* Reviewer).review(pr, sha, input));
        })
      )
    ),
  ]),
  Command.provide(authLayer)
);
const rulesetCommand = Command.make("ruleset").pipe(
  Command.withSubcommands([
    Command.make(
      "require",
      {
        dryRun: Flag.Boolean("dry-run").pipe(Flag.optional),
        apply: Flag.Boolean("apply").pipe(Flag.withDefault(false)),
        rulesetId: number("ruleset-id").pipe(Flag.optional),
      },
      ({ apply, dryRun, rulesetId }) =>
        boundary(
          Effect.gen(function* () {
            const appId = yield* Config.Number("BEEP_REVIEWER_APP_ID");
            if (!Number.isSafeInteger(appId) || appId <= 0)
              return yield* ReviewerError.make({ operation: "ruleset", message: "A positive App id is required." });
            yield* requireReviewerRuleset(
              appId,
              apply && !O.getOrElse(dryRun, () => false),
              O.getOrUndefined(rulesetId)
            );
          })
        )
    ),
  ])
);
const l0Command = Command.make("l0", { pr, sha }, ({ pr, sha }) =>
  boundary(
    Effect.gen(function* () {
      const reviewer = yield* Reviewer;
      const classifiedBase = yield* reviewer.docsOnly(pr, sha);
      if (O.isNone(classifiedBase)) {
        yield* Console.log("Non-L0: review required.");
        return;
      }
      const check = yield* reviewer.start(pr, sha, classifiedBase);
      const result = yield* reviewerWire.result({
        score: 5,
        tier: "L0",
        p0: 0,
        p1: 0,
        p2: 0,
        summary: "L0: documentation-only changes. Review automatically satisfied.",
        conclusion: "auto",
        annotations: [],
      });
      yield* Console.log(yield* reviewer.complete(check, result));
    })
  )
).pipe(Command.provide(authLayer));
const gateCommand = Command.make("gate", { pr, sha }, ({ pr, sha }) =>
  boundary(enforceReviewerGate(pr, sha).pipe(Effect.andThen(Console.log("beep-reviewer: gate satisfied"))))
);

/**
 * Reviewer App CLI with token, check, comment, review, ruleset, and fleet gate operations.
 *
 * **Example** (Inspect the command family)
 * ```ts
 * import { reviewerCommand } from "@beep/repo-cli/commands/Reviewer";
 * console.log(reviewerCommand.name); // reviewer
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const reviewerCommand = Command.make("reviewer").pipe(
  Command.withSubcommands([
    tokenCommand,
    checkCommand,
    commentCommand,
    reviewCommand,
    rulesetCommand,
    l0Command,
    gateCommand,
  ])
);
