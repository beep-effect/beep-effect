/**
 * Shared `gh` (GitHub CLI) response schemas for the repo CLI.
 *
 * These are the cross-command shapes decoded from `gh` JSON and GraphQL output.
 * {@link GhPrView} is the union of the two `gh pr view` shapes Yeet previously
 * decoded through separate private classes (a three-field monitor view and a
 * six-field closeout view): its extra fields are optional so it decodes both
 * `--json number,headRefName,state` and
 * `--json number,headRefName,state,url,headRefOid,isDraft` without change.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/github/GhSchema");

/**
 * GitHub actor (author) metadata returned by `gh`.
 *
 * **Details**
 *
 * `__typename` is present only when the GraphQL selection asked for it. It is
 * what separates a review bot (`"Bot"`) from a person on a review thread's
 * newest comment, and it is optional rather than a separate class so the many
 * queries that never select it keep decoding unchanged.
 *
 * `type` is the REST API's account type (`"User"`, `"Bot"`, `"Organization"`)
 * on a REST payload's `user`. A GitHub App can post under a login without the
 * `[bot]` suffix (Copilot's reviewer posts as `Copilot`), and `type: "Bot"` is
 * then the only field that says it is not a person. It is optional for the
 * same reason as `__typename`: GraphQL actors never carry it.
 *
 * **Example** (Make actor from login)
 *
 * ```ts
 * import { GhActor } from "@beep/repo-cli/internal/github"
 *
 * console.log(GhActor.make({ login: "octocat" }).login)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhActor extends S.Class<GhActor>($I`GhActor`)(
  {
    __typename: S.optionalKey(S.String),
    login: S.String,
    type: S.optionalKey(S.String),
  },
  $I.annote("GhActor", {
    description:
      "GitHub actor metadata returned by gh, optionally carrying the GraphQL actor typename or the REST account type.",
  })
) {}

/**
 * GitHub GraphQL connection pagination metadata.
 *
 * **Example** (Make page info fields)
 *
 * ```ts
 * import { GhPageInfo } from "@beep/repo-cli/internal/github"
 *
 * console.log(GhPageInfo.make({ endCursor: null, hasNextPage: false }).hasNextPage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhPageInfo extends S.Class<GhPageInfo>($I`GhPageInfo`)(
  {
    endCursor: S.NullOr(S.String),
    hasNextPage: S.Boolean,
  },
  $I.annote("GhPageInfo", {
    description: "GitHub GraphQL connection pagination metadata.",
  })
) {}

/**
 * A pull request comment returned by GitHub GraphQL.
 *
 * **Example** (Make comment with author)
 *
 * ```ts
 * import { GhActor, GhComment } from "@beep/repo-cli/internal/github"
 *
 * const comment = GhComment.make({
 *   author: GhActor.make({ login: "octocat" }),
 *   body: "looks good",
 *   id: "IC_1",
 *   url: "https://github.com/o/r/pull/1#issuecomment-1"
 * })
 * console.log(comment.body)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhComment extends S.Class<GhComment>($I`GhComment`)(
  {
    author: S.NullOr(GhActor),
    body: S.String,
    createdAt: S.optionalKey(S.String),
    id: S.String,
    url: S.String,
  },
  $I.annote("GhComment", {
    description: "Pull request comment returned by GitHub GraphQL.",
  })
) {}

/**
 * Unified `gh pr view` metadata.
 *
 * **Details**
 *
 * Decodes both `gh pr view` shapes used across Yeet: the monitor view
 * (`number,headRefName,state`) and the closeout view
 * (`number,headRefName,state,url,headRefOid,isDraft`). `headRefOid`, `isDraft`,
 * and `url` are optional so the narrower monitor payload also decodes; callers
 * that request the wider `--json` set always receive them.
 *
 * `author` is optional for the same reason and nullable besides: `gh pr view`
 * reports a null author for a pull request opened by a deleted account. It is
 * the login every review thread's `resolvedBy` is compared against, so a
 * caller that needs the thread gate must add `author` to its `--json` list.
 *
 * **Example** (Make narrow monitor view)
 *
 * ```ts
 * import { GhPrView } from "@beep/repo-cli/internal/github"
 *
 * const view = GhPrView.make({ headRefName: "feature", number: 42, state: "OPEN" })
 * console.log(view.number)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhPrView extends S.Class<GhPrView>($I`GhPrView`)(
  {
    author: GhActor.pipe(S.NullOr, S.optionalKey),
    headRefName: S.String,
    headRefOid: S.optionalKey(S.String),
    isDraft: S.optionalKey(S.Boolean),
    number: S.Finite,
    state: S.String,
    url: S.optionalKey(S.String),
  },
  $I.annote("GhPrView", {
    description: "Unified gh pr view metadata decoding both the monitor and closeout --json field sets.",
  })
) {}
