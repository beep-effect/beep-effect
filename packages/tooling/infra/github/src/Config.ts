/**
 * The typed configuration of the `InfraGithub` stack: what the stack owns on
 * the `beep-effect/beep-effect` repository, and every live object it
 * deliberately leaves alone, with the reason.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $InfraGithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $InfraGithubId.create("Config");

/**
 * A pull request merge method a ruleset allows.
 *
 * **Example** (Accept a merge method)
 *
 * ```ts
 * import { MergeMethod } from "@beep/infra-github/Config"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MergeMethod)("squash")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MergeMethod = LiteralKit(["merge", "squash", "rebase"]).pipe(
  $I.annoteSchema("MergeMethod", { description: "A pull request merge method a ruleset allows." })
);

/**
 * Runtime type for {@link MergeMethod}.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeMethod = typeof MergeMethod.Type;

/**
 * The kind of actor a ruleset lets bypass its rules.
 *
 * **Example** (Accept an App bypass)
 *
 * ```ts
 * import { BypassActorType } from "@beep/infra-github/Config"
 *
 * console.log(BypassActorType.is.Integration("Integration")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BypassActorType = LiteralKit(["RepositoryRole", "Team", "Integration", "OrganizationAdmin"]).pipe(
  $I.annoteSchema("BypassActorType", { description: "The kind of actor a ruleset bypass entry names." })
);

/**
 * Runtime type for {@link BypassActorType}.
 *
 * @category models
 * @since 0.0.0
 */
export type BypassActorType = typeof BypassActorType.Type;

/**
 * When a bypass actor may bypass: always, or only through a pull request.
 *
 * **Example** (Accept a bypass mode)
 *
 * ```ts
 * import { BypassMode } from "@beep/infra-github/Config"
 *
 * console.log(BypassMode.is.always("always")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BypassMode = LiteralKit(["always", "pull_request"]).pipe(
  $I.annoteSchema("BypassMode", { description: "When a ruleset bypass actor may bypass its rules." })
);

/**
 * Runtime type for {@link BypassMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type BypassMode = typeof BypassMode.Type;

/**
 * Enforcement of a ruleset.
 *
 * **Example** (Accept an enforcement)
 *
 * ```ts
 * import { RulesetEnforcement } from "@beep/infra-github/Config"
 *
 * console.log(RulesetEnforcement.is.active("active")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RulesetEnforcement = LiteralKit(["disabled", "active", "evaluate"]).pipe(
  $I.annoteSchema("RulesetEnforcement", { description: "Whether a ruleset is enforced, evaluated only, or off." })
);

/**
 * Runtime type for {@link RulesetEnforcement}.
 *
 * @category models
 * @since 0.0.0
 */
export type RulesetEnforcement = typeof RulesetEnforcement.Type;

/**
 * The class of a live repository object, used to list what the stack leaves
 * unmanaged.
 *
 * **Example** (Accept an object class)
 *
 * ```ts
 * import { ObjectClass } from "@beep/infra-github/Config"
 *
 * console.log(ObjectClass.is.secret("secret")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectClass = LiteralKit([
  "repository-setting",
  "ruleset",
  "environment",
  "variable",
  "secret",
  "label",
  "webhook",
  "actions-permission",
]).pipe($I.annoteSchema("ObjectClass", { description: "The class of a live GitHub repository object." }));

/**
 * Runtime type for {@link ObjectClass}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectClass = typeof ObjectClass.Type;

const HexColor = S.String.check(S.isPattern(/^[0-9a-fA-F]{6}$/u)).pipe(
  $I.annoteSchema("HexColor", { description: "A six-digit hexadecimal label color without the leading #." })
);

const Name = S.String.check(S.isNonEmpty()).pipe(
  $I.annoteSchema("Name", { description: "A non-empty GitHub object name." })
);

/**
 * The repository settings the stack converges. Only fields
 * `GitHub.Repository` sends are listed; every other live setting (squash
 * commit title and message, update-branch, security and analysis) is left
 * as it is.
 *
 * **Example** (Read the default branch)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 *
 * console.log(productionConfig.settings.defaultBranch) // "main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RepositorySettings extends S.Opaque<RepositorySettings, { readonly brand: unique symbol }>()(
  S.Struct({
    homepage: S.String,
    defaultBranch: Name,
    hasIssues: S.Boolean,
    hasProjects: S.Boolean,
    hasWiki: S.Boolean,
    hasDiscussions: S.Boolean,
    isTemplate: S.Boolean,
    allowSquashMerge: S.Boolean,
    allowMergeCommit: S.Boolean,
    allowRebaseMerge: S.Boolean,
    allowAutoMerge: S.Boolean,
    deleteBranchOnMerge: S.Boolean,
    topics: S.Array(Name),
  }).pipe($I.annoteSchema("RepositorySettings", { description: "Repository settings the stack converges." }))
) {}

/**
 * One required status check: its context and the App that must report it.
 *
 * **Example** (Make a required check)
 *
 * ```ts
 * import { RequiredCheck } from "@beep/infra-github/Config"
 *
 * const check = RequiredCheck.make({ context: "Lint", integrationId: 15368 })
 * console.log(check.context) // "Lint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RequiredCheck extends S.Opaque<RequiredCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    context: Name,
    integrationId: S.Int,
  }).pipe($I.annoteSchema("RequiredCheck", { description: "A required status check and the App that must report it." }))
) {}

/**
 * One ruleset bypass entry.
 *
 * **Example** (Let repository admins bypass)
 *
 * ```ts
 * import { BypassActor } from "@beep/infra-github/Config"
 *
 * const admins = BypassActor.make({ actorType: "RepositoryRole", actorId: 5, bypassMode: "always" })
 * console.log(admins.actorId) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BypassActor extends S.Opaque<BypassActor, { readonly brand: unique symbol }>()(
  S.Struct({
    actorType: BypassActorType,
    actorId: S.Int,
    bypassMode: BypassMode,
  }).pipe($I.annoteSchema("BypassActor", { description: "One actor a ruleset lets bypass its rules." }))
) {}

/**
 * The pull request rule of a ruleset.
 *
 * **Example** (Read the thread-resolution rule)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 *
 * console.log(productionConfig.mainRuleset.pullRequest.requiredReviewThreadResolution) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PullRequestRule extends S.Opaque<PullRequestRule, { readonly brand: unique symbol }>()(
  S.Struct({
    requiredApprovingReviewCount: S.Int,
    dismissStaleReviewsOnPush: S.Boolean,
    requireCodeOwnerReview: S.Boolean,
    requireLastPushApproval: S.Boolean,
    requiredReviewThreadResolution: S.Boolean,
    requireExtraApprovalForUnattributedChanges: S.Boolean,
    allowedMergeMethods: S.Array(MergeMethod),
  }).pipe($I.annoteSchema("PullRequestRule", { description: "The pull request rule of a ruleset." }))
) {}

/**
 * The default-branch ruleset (`main`, live id 10240248), adopted in place.
 * `checks` lists every required check except `beep-reviewer`: the stack does
 * not own that check, it carries the live one through unchanged, so
 * `beep reviewer ruleset release|require` stays the only switch.
 *
 * **Example** (Count the owned checks)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 *
 * console.log(productionConfig.mainRuleset.checks.length) // 15
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MainRuleset extends S.Opaque<MainRuleset, { readonly brand: unique symbol }>()(
  S.Struct({
    name: Name,
    enforcement: RulesetEnforcement,
    include: S.Array(Name),
    exclude: S.Array(Name),
    bypassActors: S.Array(BypassActor),
    deletion: S.Boolean,
    nonFastForward: S.Boolean,
    pullRequest: PullRequestRule,
    checks: S.Array(RequiredCheck),
    strictRequiredStatusChecksPolicy: S.Boolean,
  }).pipe(
    $I.annoteSchema("MainRuleset", {
      description: "The default-branch ruleset; the beep-reviewer check is carried from the live ruleset.",
    })
  )
) {}

/**
 * One GitHub Actions variable: its name and its non-secret value.
 *
 * **Example** (Make a variable)
 *
 * ```ts
 * import { VariableSpec } from "@beep/infra-github/Config"
 *
 * const variable = VariableSpec.make({ name: "TURBO_TEAM", value: "team_beep" })
 * console.log(variable.name) // "TURBO_TEAM"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VariableSpec extends S.Opaque<VariableSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    name: Name,
    value: S.String,
  }).pipe($I.annoteSchema("VariableSpec", { description: "A GitHub Actions variable and its non-secret value." }))
) {}

/**
 * One deployment environment: the branches allowed to deploy to it and the
 * variables the stack owns on it.
 *
 * **Example** (Make a main-only environment)
 *
 * ```ts
 * import { EnvironmentSpec } from "@beep/infra-github/Config"
 *
 * const env = EnvironmentSpec.make({ name: "storybook-prod", branches: ["main"], variables: [] })
 * console.log(env.branches) // ["main"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnvironmentSpec extends S.Opaque<EnvironmentSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    name: Name,
    branches: S.Array(Name),
    variables: S.Array(VariableSpec),
  }).pipe(
    $I.annoteSchema("EnvironmentSpec", {
      description: "A deployment environment with its branch policy and variables.",
    })
  )
) {}

/**
 * One issue and pull request label. `description` is `None` where GitHub
 * holds `null`.
 *
 * **Example** (Make a label)
 *
 * ```ts
 * import { LabelSpec } from "@beep/infra-github/Config"
 * import * as O from "effect/Option"
 *
 * const label = LabelSpec.make({ name: "bug", color: "d73a4a", description: O.none() })
 * console.log(label.color) // "d73a4a"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LabelSpec extends S.Opaque<LabelSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    name: Name,
    color: HexColor,
    description: S.OptionFromNullOr(S.String),
  }).pipe($I.annoteSchema("LabelSpec", { description: "An issue and pull request label." }))
) {}

/**
 * A live object the stack deliberately does not own, with the reason.
 *
 * **Example** (Record an unmanaged ruleset)
 *
 * ```ts
 * import { UnmanagedObject } from "@beep/infra-github/Config"
 *
 * const lab = UnmanagedObject.make({ objectClass: "ruleset", name: "queue-lab", reason: "parked lab" })
 * console.log(lab.objectClass) // "ruleset"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnmanagedObject extends S.Opaque<UnmanagedObject, { readonly brand: unique symbol }>()(
  S.Struct({
    objectClass: ObjectClass,
    name: Name,
    reason: Name,
  }).pipe($I.annoteSchema("UnmanagedObject", { description: "A live object the stack leaves alone, with the reason." }))
) {}

/**
 * The whole stack configuration. It never depends on the stage: every stage
 * that plans this stack targets the same repository with the same objects,
 * so a personal plan stage shows exactly what `prod` would do.
 *
 * **Example** (Read the target repository)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 *
 * console.log(`${productionConfig.owner}/${productionConfig.repository}`) // "beep-effect/beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StackConfig extends S.Opaque<StackConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    owner: Name,
    repository: Name,
    settings: RepositorySettings,
    mainRuleset: MainRuleset,
    environments: S.Array(EnvironmentSpec),
    variables: S.Array(VariableSpec),
    labels: S.Array(LabelSpec),
    unmanaged: S.Array(UnmanagedObject),
  }).pipe($I.annoteSchema("StackConfig", { description: "What the InfraGithub stack owns and what it leaves alone." }))
) {}

/**
 * The context name the beep-reviewer App reports its check under.
 *
 * **Example** (Read the reviewer check context)
 *
 * ```ts
 * import { reviewerContext } from "@beep/infra-github/Config"
 *
 * console.log(reviewerContext) // "beep-reviewer"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const reviewerContext = "beep-reviewer";

/**
 * The required checks the stack writes: the configured checks, then the live
 * `beep-reviewer` check exactly as GitHub holds it, when it holds one.
 *
 * **Details**
 *
 * The ruleset is written as a whole body, so a check left out of it is
 * removed. Carrying the live entry keeps whatever the last
 * `beep reviewer ruleset release|require --apply` set; it is appended last
 * because that is where the command puts it.
 *
 * **Example** (Carry a live reviewer check)
 *
 * ```ts
 * import { RequiredCheck, requiredChecks } from "@beep/infra-github/Config"
 * import { productionConfig } from "@beep/infra-github/Production"
 * import * as O from "effect/Option"
 *
 * const live = O.some(RequiredCheck.make({ context: "beep-reviewer", integrationId: 5321138 }))
 * console.log(requiredChecks(productionConfig.mainRuleset, live).at(-1)?.context) // "beep-reviewer"
 * ```
 *
 * @param ruleset - The configured checks.
 * @param liveReviewer - The live `beep-reviewer` check, `None` when the live ruleset lists none.
 * @returns The checks the ruleset requires, `beep-reviewer` last and at most once.
 * @category utilities
 * @since 0.0.0
 */
export const requiredChecks: {
  (liveReviewer: O.Option<RequiredCheck>): (ruleset: Pick<MainRuleset, "checks">) => ReadonlyArray<RequiredCheck>;
  (ruleset: Pick<MainRuleset, "checks">, liveReviewer: O.Option<RequiredCheck>): ReadonlyArray<RequiredCheck>;
} = dual(
  2,
  (ruleset: Pick<MainRuleset, "checks">, liveReviewer: O.Option<RequiredCheck>): ReadonlyArray<RequiredCheck> =>
    A.appendAll(
      A.filter(ruleset.checks, (check) => check.context !== reviewerContext),
      O.toArray(liveReviewer)
    )
);

/**
 * The logical ids that may take the create path on `prod`: each one's
 * provider converges an existing object by name rather than creating a
 * second one.
 *
 * **Example** (Build an allow-list)
 *
 * ```ts
 * import { CreateAllowList } from "@beep/infra-github/Config"
 *
 * const allow = CreateAllowList.make({ logicalIds: ["Repository", "Label-bug"] })
 * console.log(allow.logicalIds.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateAllowList extends S.Opaque<CreateAllowList, { readonly brand: unique symbol }>()(
  S.Struct({ logicalIds: S.Array(S.String) }).pipe(
    $I.annoteSchema("CreateAllowList", { description: "Logical ids allowed to take the create path on prod." })
  )
) {}

/**
 * Whether `logicalId` is on the allow-list.
 *
 * **Example** (Check a logical id)
 *
 * ```ts
 * import { CreateAllowList, isCreateAllowed } from "@beep/infra-github/Config"
 *
 * const allow = CreateAllowList.make({ logicalIds: ["Repository"] })
 * console.log(isCreateAllowed(allow, "MainRuleset")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isCreateAllowed: {
  (logicalId: string): (allow: CreateAllowList) => boolean;
  (allow: CreateAllowList, logicalId: string): boolean;
} = dual(2, (allow: CreateAllowList, logicalId: string) =>
  HashSet.has(HashSet.fromIterable(allow.logicalIds), logicalId)
);
