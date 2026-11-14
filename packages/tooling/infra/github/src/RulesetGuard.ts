/**
 * The pre-write guard for the default-branch ruleset (10240248), which defines
 * every required merge check. The deploy writes the ruleset as a whole body;
 * this module states what that body holds and compares it with the live
 * ruleset, so a deploy that would change anything is refused before it writes.
 *
 * **Details**
 *
 * The guard fails closed. The live ruleset is decoded strictly: an unknown key,
 * an unknown rule type, or a value the provider would reset (non-empty required
 * reviewers, an enabled dismissal restriction, `do_not_enforce_on_create`) is a
 * decode failure, never a silent skip. Only server-managed fields (ids, node
 * ids, timestamps, links, `current_user_can_bypass`) are read loosely and never
 * compared.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $InfraGithubId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  BypassActor,
  BypassActorType,
  BypassMode,
  MergeMethod,
  RequiredCheck,
  RulesetEnforcement,
  requiredChecks,
  reviewerContext,
} from "./Config.ts";
import type { MainRuleset } from "./Config.ts";

const $I = $InfraGithubId.create("RulesetGuard");

const Empty = S.Tuple([]).pipe($I.annoteSchema("Empty", { description: "An empty list." }));

const LiveCheck = S.Struct({
  context: S.String,
  integration_id: S.Int.pipe(S.NullOr, S.optionalKey),
}).pipe($I.annoteSchema("LiveCheck", { description: "One required status check as GitHub stores it." }));

const LivePullRequest = S.Struct({
  required_approving_review_count: S.Int,
  dismiss_stale_reviews_on_push: S.Boolean,
  required_reviewers: Empty.pipe(S.optionalKey),
  require_code_owner_review: S.Boolean,
  dismissal_restriction: S.Struct({ enabled: S.tag(false), allowed_actors: Empty }).pipe(S.optionalKey),
  require_last_push_approval: S.Boolean,
  required_review_thread_resolution: S.Boolean,
  require_extra_approval_for_unattributed_changes: S.Boolean.pipe(S.optionalKey),
  allowed_merge_methods: S.Array(MergeMethod),
}).pipe(
  $I.annoteSchema("LivePullRequest", {
    description: "The pull request rule; settings the provider never sends must sit at their defaults.",
  })
);

const LiveRule = S.Union([
  S.Struct({ type: S.tag("deletion") }),
  S.Struct({ type: S.tag("non_fast_forward") }),
  S.Struct({ type: S.tag("pull_request"), parameters: LivePullRequest }),
  S.Struct({
    type: S.tag("required_status_checks"),
    parameters: S.Struct({
      strict_required_status_checks_policy: S.Boolean,
      do_not_enforce_on_create: S.Literal(false).pipe(S.optionalKey),
      required_status_checks: S.Array(LiveCheck),
    }),
  }),
]).pipe(
  $I.annoteSchema("LiveRule", {
    description: "A rule of a type the stack writes; any other rule type is a decode failure.",
  })
);

/**
 * Ruleset 10240248 as `GET /repos/{owner}/{repo}/rulesets/{id}` returns it,
 * decoded with excess keys refused at every level (see {@link decodeLiveRuleset}).
 *
 * **Example** (Decode a captured ruleset)
 *
 * ```ts
 * import { decodeLiveRuleset } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 *
 * const live = Effect.runSync(decodeLiveRuleset({
 *   name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
 *   bypass_actors: [], rules: [],
 * }))
 * console.log(live.rules.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiveRuleset extends S.Opaque<LiveRuleset, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int.pipe(S.optionalKey),
    node_id: S.String.pipe(S.optionalKey),
    source_type: S.Literal("Repository").pipe(S.optionalKey),
    source: S.String.pipe(S.optionalKey),
    created_at: S.String.pipe(S.optionalKey),
    updated_at: S.String.pipe(S.optionalKey),
    current_user_can_bypass: S.String.pipe(S.optionalKey),
    _links: S.Unknown.pipe(S.optionalKey),
    name: S.String,
    target: S.tag("branch"),
    enforcement: RulesetEnforcement,
    conditions: S.Struct({ ref_name: S.Struct({ include: S.Array(S.String), exclude: S.Array(S.String) }) }),
    bypass_actors: S.Array(S.Struct({ actor_id: S.Int, actor_type: BypassActorType, bypass_mode: BypassMode })),
    rules: S.Array(LiveRule),
  }).pipe($I.annoteSchema("LiveRuleset", { description: "A live GitHub branch ruleset, decoded strictly." }))
) {}

const LiveRulesetJson = S.fromJsonString(LiveRuleset);

/**
 * Decodes a captured ruleset, failing on any key, rule type or value the
 * model does not know: the guard never compares what it could not read.
 *
 * **Example** (An unknown rule type fails the decode)
 *
 * ```ts
 * import { decodeLiveRuleset } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 *
 * const exit = Effect.runSyncExit(decodeLiveRuleset({
 *   name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: [], exclude: [] } },
 *   bypass_actors: [], rules: [{ type: "required_signatures" }],
 * }))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @param input - The parsed JSON of a ruleset.
 * @returns The decoded ruleset.
 * @category parsing
 * @since 0.0.0
 */
export const decodeLiveRuleset = (input: unknown) =>
  S.decodeUnknownEffect(LiveRuleset)(input, { onExcessProperty: "error" });

/**
 * Decodes a captured ruleset from its JSON text, as strictly as {@link decodeLiveRuleset}.
 *
 * **Example** (Decode the text of a capture)
 *
 * ```ts
 * import { decodeLiveRulesetJson } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(decodeLiveRulesetJson("{}")))
 * ```
 *
 * @param text - The JSON text `gh api` wrote.
 * @returns The decoded ruleset.
 * @category parsing
 * @since 0.0.0
 */
export const decodeLiveRulesetJson = (text: string) =>
  S.decodeEffect(LiveRulesetJson)(text, { onExcessProperty: "error" });

/**
 * One required check in the guard's view; `integrationId` is `None` when
 * GitHub accepts the context from any source.
 *
 * **Example** (A check bound to GitHub Actions)
 *
 * ```ts
 * import { GuardedCheck } from "@beep/infra-github/RulesetGuard"
 * import * as O from "effect/Option"
 *
 * console.log(GuardedCheck.make({ context: "Lint", integrationId: O.some(15368) }).context) // "Lint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GuardedCheck extends S.Opaque<GuardedCheck, { readonly brand: unique symbol }>()(
  S.Struct({ context: S.String, integrationId: S.OptionFromNullOr(S.Int) }).pipe(
    $I.annoteSchema("GuardedCheck", { description: "A required check: context name and binding App, if any." })
  )
) {}

/**
 * The pull request rule as the guard compares it.
 *
 * **Example** (Read the planned thread-resolution rule)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { plannedFields } from "@beep/infra-github/RulesetGuard"
 * import * as O from "effect/Option"
 *
 * console.log(plannedFields(productionConfig.mainRuleset, O.none()).pullRequest.requiredReviewThreadResolution) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GuardedPullRequest extends S.Opaque<GuardedPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    requiredApprovingReviewCount: S.Int,
    dismissStaleReviewsOnPush: S.Boolean,
    requireCodeOwnerReview: S.Boolean,
    requireLastPushApproval: S.Boolean,
    requiredReviewThreadResolution: S.Boolean,
    requireExtraApprovalForUnattributedChanges: S.Boolean,
  }).pipe($I.annoteSchema("GuardedPullRequest", { description: "The compared pull request rule settings." }))
) {}

/**
 * Every field of the written body the guard compares: name, target,
 * enforcement, ref conditions, bypass actors, the rule types in order, the
 * pull request settings, allowed merge methods, the strict up-to-date setting
 * and the required checks (contexts and integration ids, in order).
 *
 * **Example** (Count the planned checks)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { plannedFields } from "@beep/infra-github/RulesetGuard"
 * import * as O from "effect/Option"
 *
 * console.log(plannedFields(productionConfig.mainRuleset, O.none()).requiredChecks.length) // 15
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GuardedFields extends S.Opaque<GuardedFields, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    target: S.String,
    enforcement: S.String,
    include: S.Array(S.String),
    exclude: S.Array(S.String),
    bypassActors: S.Array(BypassActor),
    ruleTypes: S.Array(S.String),
    pullRequest: GuardedPullRequest,
    allowedMergeMethods: S.Array(MergeMethod),
    strictRequiredStatusChecksPolicy: S.Boolean,
    requiredChecks: S.Array(GuardedCheck),
  }).pipe($I.annoteSchema("GuardedFields", { description: "The ruleset fields the pre-write guard compares." }))
) {}

/**
 * One guarded field whose planned and live values differ, both as JSON.
 *
 * **Example** (A strict-policy difference)
 *
 * ```ts
 * import { FieldDiff } from "@beep/infra-github/RulesetGuard"
 *
 * const diff = FieldDiff.make({ field: "strictRequiredStatusChecksPolicy", planned: "true", live: "false" })
 * console.log(diff.field) // "strictRequiredStatusChecksPolicy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FieldDiff extends S.Opaque<FieldDiff, { readonly brand: unique symbol }>()(
  S.Struct({ field: S.String, planned: S.String, live: S.String }).pipe(
    $I.annoteSchema("FieldDiff", { description: "A guarded ruleset field whose planned and live values differ." })
  )
) {}

/**
 * Raised when the planned body differs from the live ruleset in a guarded field.
 *
 * **Example** (Inspect a refusal)
 *
 * ```ts
 * import { RulesetDrift } from "@beep/infra-github/RulesetGuard"
 *
 * console.log(RulesetDrift.make({ diffs: [] })._tag) // "RulesetDrift"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RulesetDrift extends S.TaggedError<RulesetDrift, { readonly brand: unique symbol }>($I`RulesetDrift`)(
  "RulesetDrift",
  { diffs: S.Array(FieldDiff) },
  $I.annote("RulesetDrift", { description: "The planned ruleset body differs from the live one; nothing is written." })
) {}

type Rule = LiveRuleset["rules"][number];

const pullRequestOf = (live: LiveRuleset) =>
  A.flatMap(live.rules, (rule: Rule) => (rule.type === "pull_request" ? [rule.parameters] : []));

const checksRuleOf = (live: LiveRuleset) =>
  A.flatMap(live.rules, (rule: Rule) => (rule.type === "required_status_checks" ? [rule.parameters] : []));

const liveChecks = (live: LiveRuleset) =>
  A.flatMap(checksRuleOf(live), (parameters) => parameters.required_status_checks);

/**
 * The live `beep-reviewer` check, which the stack carries through unchanged.
 * A `beep-reviewer` entry without an App binding is `None` here and therefore
 * shows up as a difference in the guard, so the deploy refuses it.
 *
 * **Example** (No reviewer check in the live ruleset)
 *
 * ```ts
 * import { decodeLiveRuleset, liveReviewerCheck } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const live = Effect.runSync(decodeLiveRuleset({
 *   name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: [], exclude: [] } }, bypass_actors: [], rules: [],
 * }))
 * console.log(O.isNone(liveReviewerCheck(live))) // true
 * ```
 *
 * @param live - The decoded live ruleset.
 * @returns The live `beep-reviewer` check bound to its App, if there is one.
 * @category utilities
 * @since 0.0.0
 */
export const liveReviewerCheck = (live: LiveRuleset): O.Option<RequiredCheck> =>
  A.findFirst(liveChecks(live), (check) => check.context === reviewerContext).pipe(
    O.flatMap((check) => O.fromNullishOr(check.integration_id)),
    O.map((integrationId) => RequiredCheck.make({ context: reviewerContext, integrationId }))
  );

const plannedRuleTypes = (ruleset: MainRuleset) => [
  ...(ruleset.deletion ? ["deletion"] : []),
  ...(ruleset.nonFastForward ? ["non_fast_forward"] : []),
  "pull_request",
  "required_status_checks",
];

/**
 * The guarded fields of the body the stack writes.
 *
 * **Example** (Planned rule types)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { plannedFields } from "@beep/infra-github/RulesetGuard"
 * import * as O from "effect/Option"
 *
 * console.log(plannedFields(productionConfig.mainRuleset, O.none()).ruleTypes.length) // 4
 * ```
 *
 * @param ruleset - The declared ruleset.
 * @param liveReviewer - The live `beep-reviewer` check the body carries.
 * @returns The fields the deploy would write.
 * @category utilities
 * @since 0.0.0
 */
export const plannedFields: {
  (liveReviewer: O.Option<RequiredCheck>): (ruleset: MainRuleset) => GuardedFields;
  (ruleset: MainRuleset, liveReviewer: O.Option<RequiredCheck>): GuardedFields;
} = dual(
  2,
  (ruleset: MainRuleset, liveReviewer: O.Option<RequiredCheck>): GuardedFields =>
    GuardedFields.make({
      name: ruleset.name,
      target: "branch",
      enforcement: ruleset.enforcement,
      include: ruleset.include,
      exclude: ruleset.exclude,
      bypassActors: ruleset.bypassActors,
      ruleTypes: plannedRuleTypes(ruleset),
      pullRequest: GuardedPullRequest.make({
        requiredApprovingReviewCount: ruleset.pullRequest.requiredApprovingReviewCount,
        dismissStaleReviewsOnPush: ruleset.pullRequest.dismissStaleReviewsOnPush,
        requireCodeOwnerReview: ruleset.pullRequest.requireCodeOwnerReview,
        requireLastPushApproval: ruleset.pullRequest.requireLastPushApproval,
        requiredReviewThreadResolution: ruleset.pullRequest.requiredReviewThreadResolution,
        requireExtraApprovalForUnattributedChanges: ruleset.pullRequest.requireExtraApprovalForUnattributedChanges,
      }),
      allowedMergeMethods: ruleset.pullRequest.allowedMergeMethods,
      strictRequiredStatusChecksPolicy: ruleset.strictRequiredStatusChecksPolicy,
      requiredChecks: A.map(requiredChecks(ruleset, liveReviewer), ({ context, integrationId }) =>
        GuardedCheck.make({ context, integrationId: O.some(integrationId) })
      ),
    })
);

const noPullRequest = GuardedPullRequest.make({
  requiredApprovingReviewCount: -1,
  dismissStaleReviewsOnPush: false,
  requireCodeOwnerReview: false,
  requireLastPushApproval: false,
  requiredReviewThreadResolution: false,
  requireExtraApprovalForUnattributedChanges: false,
});

/**
 * The guarded fields of the live ruleset. A live ruleset without a pull
 * request rule reads as an impossible review count, so it always differs from
 * a planned body (which always has one).
 *
 * **Example** (Read the live conditions)
 *
 * ```ts
 * import { decodeLiveRuleset, liveFields } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 *
 * const live = Effect.runSync(decodeLiveRuleset({
 *   name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } }, bypass_actors: [], rules: [],
 * }))
 * console.log(liveFields(live).include) // ["~DEFAULT_BRANCH"]
 * ```
 *
 * @param live - The decoded live ruleset.
 * @returns The fields GitHub holds now.
 * @category utilities
 * @since 0.0.0
 */
export const liveFields = (live: LiveRuleset): GuardedFields => {
  const pullRequest = A.head(pullRequestOf(live));
  return GuardedFields.make({
    name: live.name,
    target: live.target,
    enforcement: live.enforcement,
    include: live.conditions.ref_name.include,
    exclude: live.conditions.ref_name.exclude,
    bypassActors: A.map(live.bypass_actors, (actor) =>
      BypassActor.make({ actorType: actor.actor_type, actorId: actor.actor_id, bypassMode: actor.bypass_mode })
    ),
    ruleTypes: A.map(live.rules, (rule: Rule) => rule.type),
    pullRequest: O.match(pullRequest, {
      onNone: () => noPullRequest,
      onSome: (parameters) =>
        GuardedPullRequest.make({
          requiredApprovingReviewCount: parameters.required_approving_review_count,
          dismissStaleReviewsOnPush: parameters.dismiss_stale_reviews_on_push,
          requireCodeOwnerReview: parameters.require_code_owner_review,
          requireLastPushApproval: parameters.require_last_push_approval,
          requiredReviewThreadResolution: parameters.required_review_thread_resolution,
          requireExtraApprovalForUnattributedChanges:
            parameters.require_extra_approval_for_unattributed_changes ?? false,
        }),
    }),
    allowedMergeMethods: A.flatMap(pullRequestOf(live), (parameters) => parameters.allowed_merge_methods),
    strictRequiredStatusChecksPolicy: A.some(
      checksRuleOf(live),
      (parameters) => parameters.strict_required_status_checks_policy
    ),
    requiredChecks: A.map(liveChecks(live), (check) =>
      GuardedCheck.make({ context: check.context, integrationId: O.fromNullishOr(check.integration_id) })
    ),
  });
};

const encodeFields = S.encodeEffect(GuardedFields);
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const guardedNames = [
  "name",
  "target",
  "enforcement",
  "include",
  "exclude",
  "bypassActors",
  "ruleTypes",
  "pullRequest",
  "allowedMergeMethods",
  "strictRequiredStatusChecksPolicy",
  "requiredChecks",
] as const;

/**
 * Every guarded field whose planned and live values differ.
 *
 * **Example** (Identical fields have no diff)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { diffFields, plannedFields } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const planned = plannedFields(productionConfig.mainRuleset, O.none())
 * console.log(Effect.runSync(diffFields(planned, planned))) // []
 * ```
 *
 * @param planned - The fields the deploy would write.
 * @param live - The fields GitHub holds now.
 * @returns The differing fields, in a fixed order; an empty array when the deploy changes nothing guarded.
 * @category utilities
 * @since 0.0.0
 */
export const diffFields = Effect.fn("InfraGithub.diffFields")(function* (planned: GuardedFields, live: GuardedFields) {
  const plannedEncoded = yield* encodeFields(planned);
  const liveEncoded = yield* encodeFields(live);
  const compared = yield* Effect.forEach(guardedNames, (field) =>
    Effect.all({ planned: encodeJson(plannedEncoded[field]), live: encodeJson(liveEncoded[field]) }).pipe(
      Effect.map((values) => (values.planned === values.live ? [] : [FieldDiff.make({ field, ...values })]))
    )
  );
  return A.flatten(compared);
  // Encoding these field schemas to JSON is total; a failure here is a defect, not a drift.
}, Effect.orDie);

/**
 * Compares the body the stack would write for the declared ruleset with the
 * live one and fails with {@link RulesetDrift} on any guarded difference.
 *
 * **Example** (Compose the guard)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { decodeLiveRuleset, guardRuleset } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 *
 * const live = Effect.runSync(decodeLiveRuleset({
 *   name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: [], exclude: [] } }, bypass_actors: [], rules: [],
 * }))
 * console.log(Effect.isEffect(guardRuleset(productionConfig.mainRuleset, live)))
 * ```
 *
 * @param ruleset - The declared ruleset.
 * @param live - The decoded live ruleset.
 * @returns The (empty) diff on success.
 * @category workflows
 * @since 0.0.0
 */
export const guardRuleset = Effect.fn("InfraGithub.guardRuleset")(function* (ruleset: MainRuleset, live: LiveRuleset) {
  const diffs = yield* diffFields(plannedFields(ruleset, liveReviewerCheck(live)), liveFields(live));
  if (A.isReadonlyArrayNonEmpty(diffs)) return yield* RulesetDrift.make({ diffs });
  return diffs;
});

/**
 * Raised by the post-deploy check when the only guarded difference is the
 * `beep-reviewer` check: it moved between the capture the deploy wrote and the
 * after-deploy read, so the switch must be re-applied.
 *
 * **Example** (Inspect the refusal)
 *
 * ```ts
 * import { ReviewerChangedDuringDeploy } from "@beep/infra-github/RulesetGuard"
 *
 * const changed = ReviewerChangedDuringDeploy.make({ written: "required", live: "advisory" })
 * console.log(changed._tag) // "ReviewerChangedDuringDeploy"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReviewerChangedDuringDeploy extends S.TaggedError<
  ReviewerChangedDuringDeploy,
  { readonly brand: unique symbol }
>($I`ReviewerChangedDuringDeploy`)(
  "ReviewerChangedDuringDeploy",
  { written: S.String, live: S.String },
  $I.annote("ReviewerChangedDuringDeploy", {
    description: "The beep-reviewer check changed during the deploy window and must be re-applied.",
  })
) {}

const reviewerPosition = (check: O.Option<RequiredCheck>) =>
  O.match(check, { onNone: () => "advisory (absent)", onSome: (found) => `required (App ${found.integrationId})` });

/**
 * The post-deploy check: the ruleset read after the deploy must equal the body
 * the deploy wrote, whose `beep-reviewer` check came from the `before` capture.
 * A difference only in that check fails with {@link ReviewerChangedDuringDeploy}
 * (the switch moved in the last round-trip); any other difference fails with
 * {@link RulesetDrift}.
 *
 * **Example** (Compose the post-deploy check)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { decodeLiveRuleset, guardAfterDeploy } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 *
 * const live = Effect.runSync(decodeLiveRuleset({
 *   name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: [], exclude: [] } }, bypass_actors: [], rules: [],
 * }))
 * console.log(Effect.isEffect(guardAfterDeploy(productionConfig.mainRuleset, live, live)))
 * ```
 *
 * @param ruleset - The declared ruleset.
 * @param before - The capture the deploy wrote from.
 * @param after - The ruleset read after the deploy.
 * @returns The (empty) diff on success.
 * @category workflows
 * @since 0.0.0
 */
export const guardAfterDeploy = Effect.fn("InfraGithub.guardAfterDeploy")(function* (
  ruleset: MainRuleset,
  before: LiveRuleset,
  after: LiveRuleset
) {
  const written = liveReviewerCheck(before);
  const diffs = yield* diffFields(plannedFields(ruleset, written), liveFields(after));
  if (!A.isReadonlyArrayNonEmpty(diffs)) return diffs;
  const live = liveReviewerCheck(after);
  const selfDiffs = yield* diffFields(plannedFields(ruleset, live), liveFields(after));
  if (!A.isReadonlyArrayNonEmpty(selfDiffs)) {
    return yield* ReviewerChangedDuringDeploy.make({
      written: reviewerPosition(written),
      live: reviewerPosition(live),
    });
  }
  return yield* RulesetDrift.make({ diffs });
});
