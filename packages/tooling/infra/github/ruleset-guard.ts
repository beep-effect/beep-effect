#!/usr/bin/env bun
/**
 * The pre-write guard for ruleset 10240248. It takes the path of a capture of
 * the live ruleset (`gh api repos/beep-effect/beep-effect/rulesets/10240248`),
 * prints every guarded field whose planned value differs from the live one,
 * and exits non-zero on any difference. `--diff-only` prints the same diff and
 * exits zero: the read-only evidence an operator shows before arming. A capture
 * the strict decoder cannot read is refused in both modes.
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
import { productionConfig } from "./src/Production.ts";
import {
  decodeLiveRulesetJson,
  diffFields,
  liveFields,
  liveReviewerCheck,
  plannedFields,
  RulesetDrift,
} from "./src/RulesetGuard.ts";

const rulesetGuard = Command.make(
  "ruleset-guard",
  {
    live: Argument.String("live").pipe(Argument.withDescription("Path of the captured live ruleset JSON")),
    diffOnly: Flag.Boolean("diff-only").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the field-by-field diff and exit zero; never fails on a difference")
    ),
  },
  Effect.fn("InfraGithub.rulesetGuardCli")(function* ({ live, diffOnly }) {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(live);
    // Fail closed: a capture with any key, rule type or value the model does not know is refused,
    // in both modes, rather than compared on the fields that happened to parse.
    const decoded = yield* decodeLiveRulesetJson(text).pipe(
      Effect.tapError((error) =>
        Console.error(
          `ruleset-guard: REFUSED; the capture of ruleset 10240248 has a shape the guard cannot read.\n${error.message}`
        )
      )
    );
    const diffs = yield* diffFields(
      plannedFields(productionConfig.mainRuleset, liveReviewerCheck(decoded)),
      liveFields(decoded)
    );
    for (const diff of diffs) {
      yield* Console.log(`DIFF ${diff.field}\n  planned: ${diff.planned}\n  live:    ${diff.live}`);
    }
    if (A.isReadonlyArrayNonEmpty(diffs)) {
      if (diffOnly) {
        yield* Console.log(`ruleset-guard: ${diffs.length} guarded field(s) differ from ruleset 10240248`);
        return;
      }
      yield* Console.error("ruleset-guard: REFUSED; the deploy would change ruleset 10240248. Nothing was written.");
      return yield* RulesetDrift.make({ diffs });
    }
    yield* Console.log("ruleset-guard: empty diff; the planned body equals ruleset 10240248 in every guarded field");
  })
).pipe(Command.withDescription("Refuse an InfraGithub deploy that would change a guarded field of ruleset 10240248."));

Command.run(rulesetGuard, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
