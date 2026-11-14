/**
 * Who owns the beep-reviewer switch on the default-branch ruleset: this CLI,
 * which edits the live ruleset, or the `InfraGithub` Alchemy stack, whose
 * committed `reviewerCheck` configuration the deploy workflow applies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GitHubClient } from "@beep/github/GitHubClient";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ReviewerError } from "./ReviewerErrors.ts";
import type { GitHubError } from "@beep/github/GitHubError";

const $I = $RepoCliId.create("commands/Reviewer/ReviewerRulesetOwner");

/**
 * The repository variable that arms the `InfraGithub` deploy workflow. While
 * it is `true`, the stack owns the default-branch ruleset.
 *
 * **Example** (Read the variable name)
 * ```ts
 * import { infraGithubArmedVariable } from "@beep/repo-cli/commands/Reviewer";
 * console.log(infraGithubArmedVariable); // INFRA_GITHUB_DEPLOY_ARMED
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const infraGithubArmedVariable = "INFRA_GITHUB_DEPLOY_ARMED";

/**
 * The repository-relative file holding the stack's committed `reviewerCheck`.
 *
 * **Example** (Read the configuration path)
 * ```ts
 * import { infraGithubConfigPath } from "@beep/repo-cli/commands/Reviewer";
 * console.log(infraGithubConfigPath); // packages/tooling/infra/github/src/Production.ts
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const infraGithubConfigPath = "packages/tooling/infra/github/src/Production.ts";

/**
 * Owner of the reviewer switch: `cli` edits the live ruleset, `stack` edits the
 * stack configuration and leaves the live ruleset to the deploy.
 *
 * **Example** (Narrow an owner)
 * ```ts
 * import { RulesetOwner } from "@beep/repo-cli/commands/Reviewer";
 * console.log(RulesetOwner.is.stack("stack")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RulesetOwner = LiteralKit(["cli", "stack"]).pipe(
  $I.annoteSchema("RulesetOwner", {
    description: "Who owns the beep-reviewer switch: the CLI (live ruleset) or the InfraGithub stack (configuration).",
  })
);

/**
 * Runtime type for {@link RulesetOwner}.
 *
 * @category models
 * @since 0.0.0
 */
export type RulesetOwner = typeof RulesetOwner.Type;

/**
 * Position of the beep-reviewer switch, as the stack configuration spells it.
 *
 * **Example** (Narrow a position)
 * ```ts
 * import { ReviewerSwitch } from "@beep/repo-cli/commands/Reviewer";
 * console.log(ReviewerSwitch.is.advisory("advisory")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewerSwitch = LiteralKit(["required", "advisory"]).pipe(
  $I.annoteSchema("ReviewerSwitch", {
    description: "required lists the beep-reviewer check in the main ruleset; advisory leaves it out.",
  })
);

/**
 * Runtime type for {@link ReviewerSwitch}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReviewerSwitch = typeof ReviewerSwitch.Type;

const Variable = S.Struct({ value: S.String }).pipe(
  $I.annoteSchema("ArmedVariable", { description: "The value of the INFRA_GITHUB_DEPLOY_ARMED repository variable." })
);

const fail = (message: string) => ReviewerError.make({ operation: "ruleset", message });

const isNotFound = (error: GitHubError) => error.kind === "notFound" || error.status === 404;

/**
 * The owner implied by the arming variable: only the exact value `true` arms
 * the deploy workflow (its job condition), so only it hands the switch to the stack.
 *
 * **Example** (An absent variable keeps the CLI in charge)
 * ```ts
 * import { rulesetOwnerFor } from "@beep/repo-cli/commands/Reviewer";
 * import * as O from "effect/Option";
 * console.log(rulesetOwnerFor(O.none())); // cli
 * console.log(rulesetOwnerFor(O.some("true"))); // stack
 * ```
 *
 * @param armed - The variable's value, `None` when it does not exist.
 * @returns `stack` for exactly `true`, otherwise `cli`.
 * @category policies
 * @since 0.0.0
 */
export const rulesetOwnerFor = (armed: O.Option<string>): RulesetOwner =>
  O.exists(armed, (value) => value === "true") ? "stack" : "cli";

/**
 * Reads the arming variable from the live repository. A missing variable means
 * `cli`; any other read failure refuses, because guessing the owner could edit
 * a ruleset the stack is about to rewrite.
 *
 * **Example** (Compose the read)
 * ```ts
 * import { readRulesetOwner } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(readRulesetOwner()));
 * ```
 *
 * @returns The current owner of the reviewer switch.
 * @category workflows
 * @since 0.0.0
 */
export const readRulesetOwner = Effect.fn("Reviewer.readRulesetOwner")(function* () {
  const client = yield* GitHubClient;
  const armed = yield* client
    .requestDecoded(`GET /repos/beep-effect/beep-effect/actions/variables/${infraGithubArmedVariable}`, {}, Variable)
    .pipe(
      Effect.map(({ value }) => O.some(value)),
      Effect.catchIf(isNotFound, () => Effect.succeedNone),
      Effect.mapError(() =>
        fail(`Cannot read ${infraGithubArmedVariable}; refusing to choose between the live ruleset and the stack.`)
      )
    );
  return rulesetOwnerFor(armed);
});

const reviewerCheckPattern = /reviewerCheck: "(required|advisory)"/gu;

/**
 * Rewrites the one `reviewerCheck` assignment in the stack configuration source.
 * Zero or several assignments refuse: the edit must be unambiguous.
 *
 * **Example** (Flip the switch in source text)
 * ```ts
 * import { setStackReviewerCheck } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * const next = Effect.runSync(setStackReviewerCheck('reviewerCheck: "advisory",', "required"));
 * console.log(next); // reviewerCheck: "required",
 * ```
 *
 * @param source - The configuration file's text.
 * @param position - The switch position to write.
 * @returns The rewritten text.
 * @category policies
 * @since 0.0.0
 */
export const setStackReviewerCheck = Effect.fn("Reviewer.setStackReviewerCheck")(function* (
  source: string,
  position: ReviewerSwitch
) {
  const matches = A.fromIterable(Str.matchAll(reviewerCheckPattern)(source));
  if (matches.length !== 1)
    return yield* fail(
      `Expected exactly one reviewerCheck assignment in ${infraGithubConfigPath}; found ${matches.length}.`
    );
  return Str.replace(reviewerCheckPattern, `reviewerCheck: "${position}"`)(source);
});

const appIdPattern = /const beepReviewerAppId = (\d+);/u;

/**
 * The reviewer App id the stack configuration binds the check to.
 *
 * **Example** (Read the bound App id)
 * ```ts
 * import { stackReviewerAppId } from "@beep/repo-cli/commands/Reviewer";
 * import * as O from "effect/Option";
 * console.log(O.getOrNull(stackReviewerAppId("const beepReviewerAppId = 5321138;"))); // 5321138
 * ```
 *
 * @param source - The configuration file's text.
 * @returns The App id, `None` when the file names none.
 * @category policies
 * @since 0.0.0
 */
export const stackReviewerAppId = (source: string): O.Option<number> =>
  O.map(O.fromNullishOr(appIdPattern.exec(source)?.[1]), Number);

/**
 * Sets the switch in the stack configuration instead of the live ruleset.
 *
 * **Details**
 *
 * Prints the planned edit; only `apply` writes the file. The live ruleset is
 * never touched: the change reaches GitHub through a pull request and the
 * `Deploy infra-github` workflow. `required` refuses an App id other than the
 * one the configuration binds the check to.
 *
 * **Example** (Compose a dry run)
 * ```ts
 * import { switchStackReviewerCheck } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * console.log(Effect.isEffect(switchStackReviewerCheck("advisory", false, O.none())));
 * ```
 *
 * @param position - The switch position to write.
 * @param apply - Whether to write the file.
 * @param appId - The App id `require` was asked to bind, `None` for `release`.
 * @returns Nothing; the plan and next steps are printed.
 * @category workflows
 * @since 0.0.0
 */
export const switchStackReviewerCheck = Effect.fn("Reviewer.switchStackReviewerCheck")(function* (
  position: ReviewerSwitch,
  apply: boolean,
  appId: O.Option<number>
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* findRepoRoot().pipe(Effect.mapError(() => fail("Cannot find the repository root.")));
  // findRepoRoot answers a posix path, so a separator join is exact.
  const file = `${root}/${infraGithubConfigPath}`;
  const source = yield* fs
    .readFileString(file)
    .pipe(Effect.mapError(() => fail(`Cannot read ${infraGithubConfigPath}.`)));
  const bound = stackReviewerAppId(source);
  if (O.isSome(appId) && !O.contains(bound, appId.value))
    return yield* fail(
      `The stack binds beep-reviewer to App ${O.getOrElse(O.map(bound, String), () => "(none)")}, not ${appId.value}; change beepReviewerAppId in ${infraGithubConfigPath} in a reviewed PR first.`
    );
  const next = yield* setStackReviewerCheck(source, position);
  yield* Console.log(
    `${infraGithubArmedVariable} is true: the InfraGithub stack owns the default-branch ruleset, so the live ruleset is not edited.`
  );
  if (next === source) {
    yield* Console.log(`${infraGithubConfigPath} already sets reviewerCheck: "${position}"; nothing to change.`);
    return;
  }
  yield* Console.log(`${infraGithubConfigPath}: reviewerCheck -> "${position}"`);
  if (!apply) {
    yield* Console.log("Dry run: rerun with --apply to write the file.");
    return;
  }
  yield* fs.writeFileString(file, next).pipe(Effect.mapError(() => fail(`Cannot write ${infraGithubConfigPath}.`)));
  yield* Console.log(
    A.join(
      [
        "Wrote the file. Next:",
        "  1. Commit it on a branch and open a PR through Yeet (bun run beep yeet publish).",
        "  2. Merging it runs Deploy infra-github (prod), which applies the ruleset and checks it.",
        ...(position === "advisory"
          ? [
              "  While the reviewer is down this PR cannot pass a required beep-reviewer check; merge it through the",
              "  repository-admin bypass the main ruleset keeps.",
            ]
          : []),
      ],
      "\n"
    )
  );
});
