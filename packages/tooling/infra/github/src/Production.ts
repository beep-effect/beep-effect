/**
 * The configuration every stage of `InfraGithub` deploys: the live state of
 * `beep-effect/beep-effect` captured on 2026-11-13, restricted to the objects
 * the stack owns, plus the list of live objects it leaves alone.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as O from "effect/Option";
import {
  BypassActor,
  EnvironmentSpec,
  LabelSpec,
  MainRuleset,
  PullRequestRule,
  RepositorySettings,
  RequiredCheck,
  StackConfig,
  UnmanagedObject,
  VariableSpec,
} from "./Config.ts";
import type { ObjectClass } from "./Config.ts";

/**
 * The stage that deploys from CI. Every other stage is a plan-only preview of
 * the same configuration.
 *
 * **Example** (Compare against the production stage)
 *
 * ```ts
 * import { productionStage } from "@beep/infra-github/Production"
 *
 * console.log(productionStage) // "prod"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const productionStage = "prod";

/** GitHub Actions' App id: the source every repository check is bound to. */
const githubActionsAppId = 15368;

/** App id of `beep-fleet-orchestrator`, the fleet's merging App. */
const fleetOrchestratorAppId = 5309624;

/** Role id GitHub gives the repository `admin` role in ruleset bypass lists. */
const repositoryAdminRoleId = 5;

/** The shared Alchemy state role (decision 2026-11-09-github-oidc-state-role-bootstrap). */
const stateRoleArn = "arn:aws:iam::832907639880:role/beep-alchemy-state-rw";

const check = (context: string) => RequiredCheck.make({ context, integrationId: githubActionsAppId });

const label = (name: string, color: string, description: O.Option<string>) =>
  LabelSpec.make({ name, color, description });

const stateRoleVariable = VariableSpec.make({ name: "ALCHEMY_STATE_ROLE_ARN", value: stateRoleArn });

const mainOnly = (name: string, variables: ReadonlyArray<VariableSpec>) =>
  EnvironmentSpec.make({ name, branches: ["main"], variables });

const unmanaged = (objectClass: ObjectClass, reason: string) => (name: string) =>
  UnmanagedObject.make({ objectClass, name, reason });

const vercelEnvironment = unmanaged(
  "environment",
  "Created by the Vercel GitHub App for deployment statuses; Vercel owns it, and the OIP stack (P4) decides its fate."
);

/**
 * The stack configuration. Every value equals the live object it adopts, so a
 * deploy converges nothing on day one; the snapshot test in
 * `test/Census.test.ts` fails when code and captured live state diverge.
 *
 * **Example** (Count the owned labels)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 *
 * console.log(productionConfig.labels.length) // 26
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const productionConfig: StackConfig = StackConfig.make({
  owner: "beep-effect",
  repository: "beep-effect",
  settings: RepositorySettings.make({
    homepage: "https://www.oip.law",
    defaultBranch: "main",
    hasIssues: true,
    hasProjects: true,
    hasWiki: true,
    hasDiscussions: false,
    isTemplate: false,
    allowSquashMerge: true,
    allowMergeCommit: true,
    allowRebaseMerge: true,
    allowAutoMerge: true,
    deleteBranchOnMerge: true,
    topics: [
      "base-ui",
      "biomejs",
      "docker-compose",
      "domain-driven-design",
      "drizzle-orm",
      "effect",
      "effect-ts",
      "feature-sliced",
      "lexical-editor",
      "postgresql",
      "shadcn-ui",
      "turborepo",
      "typescript",
      "vertical-slice-architecture",
    ],
  }),
  mainRuleset: MainRuleset.make({
    name: "main",
    enforcement: "active",
    include: ["~DEFAULT_BRANCH"],
    exclude: [],
    bypassActors: [
      BypassActor.make({ actorType: "RepositoryRole", actorId: repositoryAdminRoleId, bypassMode: "always" }),
      BypassActor.make({ actorType: "Integration", actorId: fleetOrchestratorAppId, bypassMode: "always" }),
    ],
    deletion: true,
    nonFastForward: true,
    pullRequest: PullRequestRule.make({
      requiredApprovingReviewCount: 0,
      dismissStaleReviewsOnPush: false,
      requireCodeOwnerReview: false,
      requireLastPushApproval: false,
      requiredReviewThreadResolution: true,
      requireExtraApprovalForUnattributedChanges: true,
      allowedMergeMethods: ["merge", "squash", "rebase"],
    }),
    checks: [
      check("Lint"),
      check("Heavy / Check"),
      check("Test Unit"),
      check("Heavy / Test Integration"),
      check("Heavy / Docgen"),
      check("Codegen Drift"),
      check("Repo Sanity"),
      check("Commitlint"),
      check("Secret Scanning"),
      check("Security"),
      check("SAST"),
      check("Nix Shell"),
      check("Professional Desktop IPC Stdio"),
      check("Heavy / Doctest"),
      check("JSDoc Ratchet"),
    ],
    // beep-reviewer is not listed: the stack carries the live entry (RulesetGuard).
    strictRequiredStatusChecksPolicy: false,
  }),
  environments: [
    mainOnly("beep-effect-web-prod", [stateRoleVariable]),
    mainOnly("storybook-prod", [stateRoleVariable]),
    mainOnly("turbo-cache-prod", [stateRoleVariable]),
    mainOnly("turbo-cache-write", []),
  ],
  variables: [
    VariableSpec.make({ name: "KNOWLEDGE_MINT_APP_CLIENT_ID", value: "Iv23liz4xPSwPCH0qfJR" }),
    VariableSpec.make({ name: "KNOWLEDGE_MINT_APP_SLUG", value: "beep-knowledge-mint" }),
  ],
  labels: [
    label("aardvark", "ededed", O.none()),
    label("area/ast-kg", "5319e7", O.some("AST KG indexing and dual-write")),
    label("bug", "d73a4a", O.some("Something isn't working")),
    label("codex", "ededed", O.none()),
    label("compute-profile-worker", "ededed", O.none()),
    label("dependencies", "0366d6", O.some("Pull requests that update a dependency file")),
    label("documentation", "0075ca", O.some("Improvements or additions to documentation")),
    label("duplicate", "cfd3d7", O.some("This issue or pull request already exists")),
    label("enhancement", "a2eeef", O.some("New feature or request")),
    label("github_actions", "000000", O.some("Pull requests that update GitHub Actions code")),
    label("good first issue", "7057ff", O.some("Good for newcomers")),
    label("help wanted", "008672", O.some("Extra attention is needed")),
    label("invalid", "e4e669", O.some("This doesn't seem right")),
    label(
      "owner-merge-hold",
      "ededed",
      O.some("Owner merges this PR itself once its condition is met. Do not merge by hand.")
    ),
    label("phase/P7", "5319e7", O.some("P7 KG excellence work")),
    label("priority/P0", "5319e7", O.some("Critical priority")),
    label("priority/P1", "5319e7", O.some("High priority")),
    label("property-laws-nightly", "ededed", O.none()),
    label("question", "d876e3", O.some("Further information is requested")),
    label(
      "ready-for-heavy",
      "0E8A16",
      O.some("Admits the heavy CI matrix (Heavy / *) for this pull request; time-to-certainty B8")
    ),
    label("size/L", "ededed", O.none()),
    label("size/M", "ededed", O.none()),
    label("size/S", "ededed", O.none()),
    label("size/XL", "ededed", O.none()),
    label(
      "unblocks-main",
      "B60205",
      O.some("Declared unblocker for a red-main episode; orchestrator applies, one PR per episode")
    ),
    label("wontfix", "ffffff", O.some("This will not be worked on")),
  ],
  unmanaged: [
    unmanaged(
      "ruleset",
      "goals/merge-queue-lab parks it at build concurrency 0 and merge-group-parity re-arms it by a live edit; owning it would revert that."
    )("queue-lab"),
    ...A.map(
      [
        "squash_merge_commit_title",
        "squash_merge_commit_message",
        "merge_commit_title",
        "merge_commit_message",
        "allow_update_branch",
        "web_commit_signoff_required",
        "security_and_analysis",
        "description",
        "visibility",
      ],
      unmanaged(
        "repository-setting",
        "GitHub.Repository does not send it (description and visibility: the stack leaves them as they are)."
      )
    ),
    unmanaged(
      "environment",
      "Its deployment policy is a tag pattern; GitHub.Environment recreates missing custom policies as branch policies only."
    )("professional-desktop-release"),
    ...A.map(
      [
        "Preview",
        "Preview – beep-dev",
        "Preview – beep-effect-web",
        "Preview – oip-web",
        "Preview – oip-web-staging",
        "Preview – todox",
        "Preview – todox-marketing",
        "Production",
        "Production – beep-dev",
        "Production – beep-effect-infra",
        "Production – beep-effect-marketing",
        "Production – beep-effect-marketing-jbbs",
        "Production – beep-effect-marketing-jbbs-1765233294724-vLlH",
        "Production – beep-effect-web",
        "Production – oip-web",
        "Production – oip-web-staging",
        "Production – todox",
        "Production – todox-marketing",
        "vercel-oip-web-preview",
        "vercel-oip-web-production",
        "vercel-todox-preview",
        "vercel-todox-production",
      ],
      vercelEnvironment
    ),
    unmanaged(
      "variable",
      "An operator switch the CI goals driver flips live (overflow pool); a deploy would revert the flip."
    )("BEEP_SHARD_OVERFLOW"),
    ...A.map(
      ["TURBO_API", "TURBO_R2_BUCKET", "TURBO_R2_ENABLED", "TURBO_R2_ENDPOINT", "TURBO_TEAM"],
      unmanaged("variable", "Turbo cache enrollment; @beep/infra-turbo-cache's cutover sets these.")
    ),
    ...A.map(
      ["APP_ENV", "APP_LOG_FORMAT", "APP_LOG_LEVEL", "APP_NAME", "NEXT_PUBLIC_ENV"],
      unmanaged("secret", "No known value source in 1Password; values cannot be read back from GitHub.")
    ),
    unmanaged(
      "secret",
      "Value source exists (beep-knowledge-mint GitHub App item, private_key); held until the secret-delivery ruling."
    )("KNOWLEDGE_MINT_APP_PRIVATE_KEY"),
    unmanaged(
      "secret",
      "Two candidate 1Password fields (CLOUD_VERCEL_TOKEN, CLOUD_VERCEL_API_TOKEN); OIP stack (P4) decides."
    )("VERCEL_TOKEN"),
    ...A.map(
      [
        "TURBO_R2_READ_ACCESS_KEY_ID",
        "TURBO_R2_READ_SECRET_ACCESS_KEY",
        "TURBO_READ_TOKEN",
        "TURBO_TEAM",
        "turbo-cache-write/TURBO_R2_WRITE_ACCESS_KEY_ID",
        "turbo-cache-write/TURBO_R2_WRITE_SECRET_ACCESS_KEY",
        "turbo-cache-write/TURBO_TOKEN",
      ],
      unmanaged("secret", "Produced by the turbo cache stack; not duplicated here.")
    ),
    ...A.flatMap(["beep-effect-web-prod", "storybook-prod", "turbo-cache-prod"], (environment) =>
      A.map(
        [`${environment}/CLOUDFLARE_API_TOKEN`, `${environment}/CLOUDFLARE_ACCOUNT_ID`],
        unmanaged("secret", "Cloudflare deploy credentials for that stack; not duplicated here.")
      )
    ),
    ...A.map(
      ["hook-663255260", "hook-711445970"],
      unmanaged("webhook", "Runner fleet workflow_job webhooks; their secret belongs to the ci-runners stack (P5).")
    ),
    ...A.map(
      ["enabled", "allowed_actions", "sha_pinning_required", "default_workflow_permissions"],
      unmanaged("actions-permission", "No @alchemy.run/github resource (verified gap in the P0 matrix).")
    ),
  ],
});
