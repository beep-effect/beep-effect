import * as AWS from "@alchemy.run/aws";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import { Stage } from "alchemy/Stage";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { productionConfig, productionCreateAllowList, productionStage } from "./src/Production.ts";
import { prodGitHubProviders } from "./src/ProdWriteGuard.ts";
import { readOnlyGitHubProviders } from "./src/ReadOnlyProviders.ts";
import { decodeLiveRulesetJson, liveReviewerCheck } from "./src/RulesetGuard.ts";
import { declareStack } from "./src/Stack.ts";

/**
 * The live default-branch ruleset, captured by the caller right before the
 * plan (`gh api repos/beep-effect/beep-effect/rulesets/10240248 > <file>`) and
 * named by `INFRA_GITHUB_LIVE_RULESET`. The stack carries its `beep-reviewer`
 * check through unchanged; the deploy workflow's guard step compares every
 * other guarded field against the same capture before anything is written,
 * and the guarded ruleset provider re-reads the live ruleset inside its update
 * path and refuses the PUT if it no longer equals this capture.
 */
const capture = Effect.gen(function* () {
  const path = yield* Config.String("INFRA_GITHUB_LIVE_RULESET");
  const fs = yield* FileSystem.FileSystem;
  // A missing capture, or one the strict decoder cannot read (an unknown key, rule type or value),
  // stops the plan: the stack never writes a ruleset it could not fully read.
  return yield* fs.readFileString(path).pipe(Effect.flatMap(decodeLiveRulesetJson));
}).pipe(Effect.orDie);

const liveReviewer = Effect.map(capture, liveReviewerCheck);

/**
 * The GitHub providers for the stage. `prod` gets the shipped providers behind
 * the create guard (`prodGitHubProviders`: only allow-listed logical ids may
 * take the create path, and no replace or delete) with the guarded ruleset
 * provider (re-read before the PUT). Every other stage gets
 * read-only providers: plan works, while create, update and delete fail with
 * `PreviewStageIsReadOnly` before any request, so a preview stage cannot
 * write to the live repository whatever token is in the environment. Both are
 * layered over the `GitHub.providers()` collection, whose credentials they use.
 */
const providers = Layer.unwrap(
  Effect.gen(function* () {
    const stage = yield* Stage;
    if (stage !== productionStage) return readOnlyGitHubProviders(stage);
    const prodCapture = yield* capture;
    return prodGitHubProviders(productionCreateAllowList, prodCapture);
  })
).pipe(Layer.provideMerge(GitHub.providers()));

/**
 * The shared Alchemy state store (goals/infra-alchemy-rebuild, D6 and D17):
 * one account-regional S3 bucket, `alchemy-state-<accountId>-<region>-an`,
 * SSE-KMS with the AWS-managed S3 key, bucket keys on, customer-provided keys
 * blocked. Account, region and credentials come from the process
 * environment: exported from aws-vault on a workstation, set by the GitHub
 * OIDC state role in CI. Runbook: docs/runbooks/alchemy-infra.md.
 */
export const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * The stack's program, exported so tests deploy it into in-memory state.
 *
 * Every stage targets the live repository with the same configuration: the
 * repository, its ruleset and its labels are singletons, so nothing here may
 * derive a name from the stage. `prod` deploys only from CI. Any other stage
 * is a plan-only preview of `prod`: its providers are read-only by construction
 * (`readOnlyGitHubProviders`), and it also refuses to start unless
 * `INFRA_GITHUB_LIVE_PREVIEW=plan-only` acknowledges that it reads the live
 * repository. Every resource is retained, so destroying a stage deletes nothing.
 */
export const program = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  if (stack.stage === productionStage) {
    yield* Config.Literal("true", "CI");
  } else {
    yield* Config.Literal("plan-only", "INFRA_GITHUB_LIVE_PREVIEW");
  }
  const reviewer = yield* liveReviewer;
  return yield* declareStack(productionConfig, reviewer);
});

export default Alchemy.Stack(
  "InfraGithub",
  {
    providers,
    state,
  },
  program
);
