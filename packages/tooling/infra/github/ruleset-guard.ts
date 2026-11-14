#!/usr/bin/env bun
/**
 * The pre-write and post-deploy guard for ruleset 10240248. It takes the path
 * of a capture of the live ruleset (`gh api repos/beep-effect/beep-effect/rulesets/10240248`),
 * prints every guarded field whose planned value differs from the live one,
 * and exits non-zero on any difference. `--reviewer-from <before>` is the
 * post-deploy mode: the planned body carries the `beep-reviewer` check of the
 * capture the deploy wrote from, so a `beep-reviewer` that differs from what the
 * deploy wrote (it moved after the write) fails with its own message. `--diff-only` prints the diff and exits zero:
 * the read-only evidence an operator shows before arming. A capture the strict
 * decoder cannot read is refused in every mode.
 *
 * @internal
 * @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import { productionConfig } from "./src/Production.ts";
import {
  decodeLiveRulesetJson,
  diffFields,
  guardAfterDeploy,
  guardRuleset,
  liveFields,
  liveReviewerCheck,
  plannedFields,
  reviewerMismatchMessage,
} from "./src/RulesetGuard.ts";
import type { FieldDiff } from "./src/RulesetGuard.ts";

const readCapture = Effect.fn("InfraGithub.readRulesetCapture")(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(path);
  // Fail closed: a capture with any key, rule type or value the model does not know is refused.
  return yield* decodeLiveRulesetJson(text).pipe(
    Effect.tapError((error) =>
      Console.error(`ruleset-guard: REFUSED; ${path} has a shape the guard cannot read.\n${error.message}`)
    )
  );
});

const printDiffs = (diffs: ReadonlyArray<FieldDiff>) =>
  Effect.forEach(
    diffs,
    (diff) => Console.log(`DIFF ${diff.field}\n  planned: ${diff.planned}\n  live:    ${diff.live}`),
    {
      discard: true,
    }
  );

const rulesetGuard = Command.make(
  "ruleset-guard",
  {
    live: Argument.String("live").pipe(Argument.withDescription("Path of the captured live ruleset JSON")),
    diffOnly: Flag.Boolean("diff-only").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the field-by-field diff and exit zero; never fails on a difference")
    ),
    reviewerFrom: Flag.String("reviewer-from").pipe(
      Flag.optional,
      Flag.withDescription("Post-deploy mode: take the beep-reviewer check from this earlier capture")
    ),
  },
  Effect.fn("InfraGithub.rulesetGuardCli")(function* ({ live, diffOnly, reviewerFrom }) {
    const decoded = yield* readCapture(live);
    const before = yield* O.match(reviewerFrom, { onNone: () => Effect.succeed(decoded), onSome: readCapture });
    if (diffOnly) {
      const diffs = yield* diffFields(
        plannedFields(productionConfig.mainRuleset, liveReviewerCheck(before)),
        liveFields(decoded)
      );
      yield* printDiffs(diffs);
      yield* Console.log(
        A.isReadonlyArrayNonEmpty(diffs)
          ? `ruleset-guard: ${diffs.length} guarded field(s) differ from ruleset 10240248`
          : "ruleset-guard: empty diff; the planned body equals ruleset 10240248 in every guarded field"
      );
      return;
    }
    const checked = O.isSome(reviewerFrom)
      ? guardAfterDeploy(productionConfig.mainRuleset, before, decoded)
      : guardRuleset(productionConfig.mainRuleset, decoded);
    yield* checked.pipe(
      Effect.tapError((error) =>
        error._tag === "ReviewerChangedDuringDeploy"
          ? error.pipe(reviewerMismatchMessage, Console.error)
          : printDiffs(error.diffs).pipe(
              Effect.andThen(
                Console.error(
                  "ruleset-guard: REFUSED; ruleset 10240248 differs from the declared body. Nothing was written by this check."
                )
              )
            )
      )
    );
    yield* Console.log("ruleset-guard: empty diff; the planned body equals ruleset 10240248 in every guarded field");
  })
).pipe(Command.withDescription("Refuse an InfraGithub deploy that would change, or did change, ruleset 10240248."));

Command.run(rulesetGuard, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
