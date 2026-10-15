/**
 * `beep skills review` and `beep skills patch add|label`: the review ritual
 * and the patch-series writers it feeds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { expectPlanDigestFlag } from "./internal/PlanFlags.ts";
import { SkillsCommandError } from "./Skills.errors.ts";
import { SkillPatchRecorder, SkillPatchRecorderLive } from "./SkillsPatch.service.ts";
import {
  renderSkillPatchAddReceiptJson,
  renderSkillPatchAddSummary,
  renderSkillPatchLabelReceiptJson,
  renderSkillPatchLabelSummary,
  renderSkillReviewSessionJson,
  renderSkillReviewSessionSummary,
} from "./SkillsReview.render.ts";
import { SkillReviewOptions, SkillReviewScript } from "./SkillsReview.schemas.ts";
import {
  makeSkillReviewDeciderPrompt,
  SkillHunkReview,
  SkillHunkReviewLive,
  SkillReviewDecider,
  skillReviewDeciderFromScript,
} from "./SkillsReview.service.ts";
import type { SkillPatchRecorderFailure } from "./SkillsPatch.service.ts";

const decodeScriptJson = S.decodeUnknownEffect(S.fromJsonString(SkillReviewScript));
const decodeReviewer = S.decodeUnknownEffect(S.NonEmptyString);

const reportError = (command: string) =>
  Effect.fn("Skills.reviewCommand.reportError")(function* (error: { readonly message: string }) {
    const message = `skills:${command}: ${error.message}`;
    yield* Console.error(message);
    return yield* failWithReportedExit(message);
  });

const findRoot = (command: string) =>
  findRepoRoot().pipe(SkillsCommandError.mapError(`Failed to locate repository root for skills ${command}.`));

type ReviewFlags = {
  readonly skill: O.Option<string>;
  readonly json: boolean;
  readonly interactive: boolean;
  readonly decisions: O.Option<string>;
  readonly ghost: boolean;
  readonly reviewer: O.Option<string>;
  readonly budget: number;
};

const readScript = Effect.fn("Skills.reviewCommand.readScript")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(file).pipe(SkillsCommandError.mapError(`Failed to read ${file}.`, file));
  return yield* decodeScriptJson(text).pipe(
    SkillsCommandError.mapError(`${file} is not a list of { hunk, decision, label? } review answers.`, file)
  );
});

// Listing needs no decider; `--decisions` answers from the file; `--interactive` asks the terminal.
const deciderFor = Effect.fn("Skills.reviewCommand.deciderFor")(function* (flags: ReviewFlags) {
  if (O.isSome(flags.decisions)) {
    return skillReviewDeciderFromScript(yield* readScript(flags.decisions.value));
  }
  return flags.interactive ? yield* makeSkillReviewDeciderPrompt : skillReviewDeciderFromScript(A.empty());
});

const requireReviewer = (flags: ReviewFlags, decide: boolean) =>
  decide
    ? O.match(flags.reviewer, {
        onNone: () =>
          Effect.fail(
            SkillsCommandError.make({
              message: "Recording decisions needs --reviewer <handle>, the human who decided them.",
            })
          ),
        onSome: (reviewer) =>
          decodeReviewer(reviewer).pipe(SkillsCommandError.mapError("--reviewer must not be empty.")),
      })
    : Effect.succeed("");

const runReview = Effect.fn("Skills.runSkillsReviewCommand")(function* (flags: ReviewFlags) {
  const repoRoot = yield* findRoot("review");
  const decide = flags.interactive || O.isSome(flags.decisions);
  const reviewer = yield* requireReviewer(flags, decide);
  const decider = yield* deciderFor(flags);
  const review = yield* SkillHunkReview;
  const session = yield* review
    .review(
      repoRoot,
      SkillReviewOptions.make({
        skill: flags.skill,
        decide,
        ghost: flags.ghost,
        reviewer,
        budget: Duration.minutes(flags.budget),
      })
    )
    .pipe(Effect.provideService(SkillReviewDecider, decider));
  yield* Console.log(
    flags.json ? Str.trimEnd(renderSkillReviewSessionJson(session)) : renderSkillReviewSessionSummary(session)
  );
});

/**
 * `beep skills review`: prepare or walk one bounded review session over the vendored patch series.
 *
 * **Details**
 *
 * Without `--interactive` or `--decisions` it only lists the queue and
 * writes nothing. `--interactive` asks the terminal for each hunk;
 * `--decisions <file>` answers from a scripted file of the reviewer's
 * decisions. Either records under `--reviewer`, checkpoints every answer
 * into the hunk ledger, and stops at `--budget` minutes (default 20).
 * `--ghost` first replays earlier decisions on byte-identical hunks.
 *
 * **Example** (Inspect the command)
 *
 * ```ts
 * import { skillsReviewCommand } from "@beep/repo-cli/commands/Skills/SkillsReview.command"
 *
 * console.log(skillsReviewCommand.name) // "review"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const skillsReviewCommand = Command.make(
  "review",
  {
    skill: Flag.String("skill").pipe(Flag.withDescription("Review one vendored lock entry"), Flag.optional),
    json: Flag.Boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the skills-review/v1 session as JSON")
    ),
    interactive: Flag.Boolean("interactive").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Ask the terminal for a decision on each queued hunk")
    ),
    decisions: Flag.String("decisions").pipe(
      Flag.withDescription("Answer from a JSON list of { hunk, decision, label? } review answers"),
      Flag.optional
    ),
    ghost: Flag.Boolean("ghost").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Replay earlier decisions on byte-identical hunks at the same pin first")
    ),
    reviewer: Flag.String("reviewer").pipe(
      Flag.withDescription("The human whose decisions are recorded (required to record)"),
      Flag.optional
    ),
    budget: Flag.Int("budget").pipe(
      Flag.withDefault(20),
      Flag.withDescription("Session budget in minutes; the rest stays queued")
    ),
  },
  Effect.fn("Skills.reviewCommand")(function* (flags) {
    yield* runReview(flags).pipe(Effect.catch(reportError("review")));
  })
).pipe(
  Command.withDescription(
    "List, or walk within a time budget, the vendored hunks awaiting a decision; every answer is checkpointed into .agents/skill-patches/ledger.jsonl"
  ),
  Command.provide(SkillHunkReviewLive)
);

type PatchFlags = { readonly skill: string; readonly expect: O.Option<string>; readonly json: boolean };

const patchFlags = {
  skill: Flag.String("skill").pipe(Flag.withDescription("The vendored lock entry")),
  expect: expectPlanDigestFlag,
  json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the plan receipt as JSON")),
};

// Every failure of the patch writers carries a message; report it and exit non-zero.
const catchPatchErrors =
  (command: string) =>
  <A, R>(effect: Effect.Effect<A, SkillPatchRecorderFailure, R>) =>
    effect.pipe(Effect.catch(reportError(command)));

const runPatchAdd = Effect.fn("Skills.runSkillsPatchAddCommand")(function* (flags: PatchFlags) {
  const repoRoot = yield* findRoot("patch add");
  const recorder = yield* SkillPatchRecorder;
  const receipt = yield* recorder.add(repoRoot, flags.skill, flags.expect);
  yield* Console.log(
    flags.json ? Str.trimEnd(renderSkillPatchAddReceiptJson(receipt)) : renderSkillPatchAddSummary(receipt)
  );
});

const runPatchLabel = Effect.fn("Skills.runSkillsPatchLabelCommand")(function* (flags: PatchFlags) {
  const repoRoot = yield* findRoot("patch label");
  const recorder = yield* SkillPatchRecorder;
  const receipt = yield* recorder.label(repoRoot, flags.skill, flags.expect);
  yield* Console.log(
    flags.json ? Str.trimEnd(renderSkillPatchLabelReceiptJson(receipt)) : renderSkillPatchLabelSummary(receipt)
  );
});

const skillsPatchAddCommand = Command.make(
  "add",
  patchFlags,
  Effect.fn("Skills.patchAddCommand")(function* (flags) {
    yield* runPatchAdd(flags).pipe(catchPatchErrors("patch add"));
  })
).pipe(
  Command.withDescription(
    "Turn a hand edit of a vendored skill's installed tree into new patches and re-record the lock; plan without --expect, write with --expect <planDigest>"
  ),
  Command.provide(SkillPatchRecorderLive)
);

const skillsPatchLabelCommand = Command.make(
  "label",
  patchFlags,
  Effect.fn("Skills.patchLabelCommand")(function* (flags) {
    yield* runPatchLabel(flags).pipe(catchPatchErrors("patch label"));
  })
).pipe(
  Command.withDescription(
    "Move each patch's lock label to the label its hunk-ledger classifications agree on; plan without --expect, write with --expect <planDigest>"
  ),
  Command.provide(SkillPatchRecorderLive)
);

/**
 * `beep skills patch`: the `add` and `label` writers for a vendored patch series.
 *
 * **Example** (Inspect the command)
 *
 * ```ts
 * import { skillsPatchCommand } from "@beep/repo-cli/commands/Skills/SkillsReview.command"
 *
 * console.log(skillsPatchCommand.name) // "patch"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const skillsPatchCommand = Command.make("patch", {}, () =>
  Console.log(
    "Skills patch commands:\n- bun run beep skills patch add --skill <name> [--json] [--expect <planDigest>]\n- bun run beep skills patch label --skill <name> [--json] [--expect <planDigest>]"
  )
).pipe(
  Command.withDescription("Record changes to a vendored skill's patch series"),
  Command.withSubcommands([skillsPatchAddCommand, skillsPatchLabelCommand])
);
