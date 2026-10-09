import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import * as S from "effect/Schema";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/github/Ruleset");

/**
 * A ruleset, as listing returns it.
 *
 * @remarks
 * `source_type` is the field that matters and the one easiest to drop from a
 * projection: a repository's ruleset listing includes rulesets **inherited from
 * the organization**, and they are indistinguishable from the repository's own
 * without it.
 *
 * @public
 */
export interface RulesetInfo {
  /** The ruleset's numeric id. */
  readonly id: number;
  /** The ruleset's name. */
  readonly name: string;
  /** `"Repository"` for the repository's own, `"Organization"` for an inherited one. */
  readonly source_type?: string | undefined;
}

const RuleDismissalActor = S.Struct({
  id: S.Finite,
  type: S.Literals(["User", "Team", "IntegrationInstallation", "RepositoryRole"]),
}).annotate({
  identifier: "RuleDismissalActor",
  description: "GitHub OpenAPI repository-rule-params-actor wire fields.",
});

const RuleDismissalRestriction = S.Struct({
  allowed_actors: RuleDismissalActor.pipe(S.Array, S.mutable, S.optionalKey),
  enabled: S.Boolean,
}).annotate({
  identifier: "RuleDismissalRestriction",
  description: "GitHub OpenAPI repository-rule-params-dismissal-restriction wire fields.",
});

const RuleReviewer = S.Struct({
  id: S.Finite,
  type: S.Literal("Team"),
}).annotate({
  identifier: "RuleReviewer",
  description: "GitHub OpenAPI repository-rule-params-reviewer wire fields.",
});

const RuleRequiredReviewer = S.Struct({
  file_patterns: S.String.pipe(S.Array, S.mutable),
  minimum_approvals: S.Finite,
  reviewer: RuleReviewer,
}).annotate({
  identifier: "RuleRequiredReviewer",
  description: "GitHub OpenAPI repository-rule-params-required-reviewer-configuration wire fields.",
});

const RuleStatusCheck = S.Struct({
  context: S.String,
  integration_id: S.optionalKey(S.Finite),
}).annotate({
  identifier: "RuleStatusCheck",
  description: "GitHub OpenAPI repository-rule-params-status-check-configuration wire fields.",
});

const RuleWorkflow = S.Struct({
  path: S.String,
  ref: S.optionalKey(S.String),
  repository_id: S.Finite,
  sha: S.optionalKey(S.String),
}).annotate({
  identifier: "RuleWorkflow",
  description: "GitHub OpenAPI repository-rule-params-workflow-file-reference wire fields.",
});

const RuleScanningTool = S.Struct({
  alerts_threshold: S.Literals(["none", "errors", "errors_and_warnings", "all"]),
  security_alerts_threshold: S.Literals(["none", "critical", "high_or_higher", "medium_or_higher", "all"]),
  tool: S.String,
}).annotate({
  identifier: "RuleScanningTool",
  description: "GitHub OpenAPI repository-rule-params-code-scanning-tool wire fields.",
});

const RulesetBypassActor = S.Struct({
  actor_id: S.Finite.pipe(S.NullOr, S.optionalKey),
  actor_type: S.Literals(["Integration", "OrganizationAdmin", "RepositoryRole", "Team", "DeployKey", "User"]),
  bypass_mode: S.optionalKey(S.Literals(["always", "pull_request", "exempt"])),
}).annotate({
  identifier: "RulesetBypassActor",
  description: "GitHub OpenAPI repository-ruleset-bypass-actor wire fields.",
});

const RulesetConditions = S.Struct({
  ref_name: S.optionalKey(S.Struct({
    include: S.String.pipe(S.Array, S.mutable, S.optionalKey),
    exclude: S.String.pipe(S.Array, S.mutable, S.optionalKey),
  })),
}).annotate({
  identifier: "RulesetConditions",
  description: "GitHub OpenAPI repository-ruleset-conditions wire fields.",
});

const RulePatternParameters = S.Struct({
  name: S.optionalKey(S.String),
  negate: S.optionalKey(S.Boolean),
  operator: S.Literals(["starts_with", "ends_with", "contains", "regex"]),
  pattern: S.String,
}).annotate({
  identifier: "RulePatternParameters",
  description: "The operator and pattern shared by commit, email, branch and tag rules.",
});

const RulesetRule = S.Union([
  S.Struct({
    type: S.Literal("creation"),
  }),
  S.Struct({
    type: S.Literal("update"),
    parameters: S.optionalKey(S.Struct({
      update_allows_fetch_and_merge: S.Boolean,
    })),
  }),
  S.Struct({
    type: S.Literal("deletion"),
  }),
  S.Struct({
    type: S.Literal("required_linear_history"),
  }),
  S.Struct({
    type: S.Literal("merge_queue"),
    parameters: S.optionalKey(S.Struct({
      check_response_timeout_minutes: S.Finite,
      grouping_strategy: S.Literals(["ALLGREEN", "HEADGREEN"]),
      max_entries_to_build: S.Finite,
      max_entries_to_merge: S.Finite,
      merge_method: S.Literals(["MERGE", "SQUASH", "REBASE"]),
      min_entries_to_merge: S.Finite,
      min_entries_to_merge_wait_minutes: S.Finite,
    })),
  }),
  S.Struct({
    type: S.Literal("required_deployments"),
    parameters: S.optionalKey(S.Struct({
      required_deployment_environments: S.String.pipe(S.Array, S.mutable),
    })),
  }),
  S.Struct({
    type: S.Literal("required_signatures"),
  }),
  S.Struct({
    type: S.Literal("pull_request"),
    parameters: S.optionalKey(S.Struct({
      allowed_merge_methods: S.Literals(["merge", "squash", "rebase"]).pipe(S.Array, S.mutable, S.optionalKey),
      dismiss_stale_reviews_on_push: S.Boolean,
      dismissal_restriction: S.optionalKey(RuleDismissalRestriction),
      require_code_owner_review: S.Boolean,
      require_last_push_approval: S.Boolean,
      required_approving_review_count: S.Finite,
      required_review_thread_resolution: S.Boolean,
      required_reviewers: RuleRequiredReviewer.pipe(S.Array, S.mutable, S.optionalKey),
    })),
  }),
  S.Struct({
    type: S.Literal("required_status_checks"),
    parameters: S.optionalKey(S.Struct({
      do_not_enforce_on_create: S.optionalKey(S.Boolean),
      required_status_checks: RuleStatusCheck.pipe(S.Array, S.mutable),
      strict_required_status_checks_policy: S.Boolean,
    })),
  }),
  S.Struct({
    type: S.Literal("non_fast_forward"),
  }),
  S.Struct({
    type: S.Literal("commit_message_pattern"),
    parameters: S.optionalKey(RulePatternParameters),
  }),
  S.Struct({
    type: S.Literal("commit_author_email_pattern"),
    parameters: S.optionalKey(RulePatternParameters),
  }),
  S.Struct({
    type: S.Literal("committer_email_pattern"),
    parameters: S.optionalKey(RulePatternParameters),
  }),
  S.Struct({
    type: S.Literal("branch_name_pattern"),
    parameters: S.optionalKey(RulePatternParameters),
  }),
  S.Struct({
    type: S.Literal("tag_name_pattern"),
    parameters: S.optionalKey(RulePatternParameters),
  }),
  S.Struct({
    type: S.Literal("workflows"),
    parameters: S.optionalKey(S.Struct({
      do_not_enforce_on_create: S.optionalKey(S.Boolean),
      workflows: RuleWorkflow.pipe(S.Array, S.mutable),
    })),
  }),
  S.Struct({
    type: S.Literal("code_scanning"),
    parameters: S.optionalKey(S.Struct({
      code_scanning_tools: RuleScanningTool.pipe(S.Array, S.mutable),
    })),
  }),
  S.Struct({
    type: S.Literal("copilot_code_review"),
    parameters: S.optionalKey(S.Struct({
      review_draft_pull_requests: S.optionalKey(S.Boolean),
      review_on_push: S.optionalKey(S.Boolean),
    })),
  }),
  S.Struct({
    type: S.Literal("license_compliance_scanning"),
  }),
  S.Struct({
    type: S.Literal("file_path_restriction"),
    parameters: S.optionalKey(S.Struct({
      restricted_file_paths: S.String.pipe(S.Array, S.mutable),
    })),
  }),
  S.Struct({
    type: S.Literal("max_file_path_length"),
    parameters: S.optionalKey(S.Struct({
      max_file_path_length: S.Finite,
    })),
  }),
  S.Struct({
    type: S.Literal("file_extension_restriction"),
    parameters: S.optionalKey(S.Struct({
      restricted_file_extensions: S.String.pipe(S.Array, S.mutable),
    })),
  }),
  S.Struct({
    type: S.Literal("max_file_size"),
    parameters: S.optionalKey(S.Struct({
      max_file_size: S.Finite,
    })),
  }),
]).pipe(S.toTaggedUnion("type")).annotate({
  identifier: "RulesetRule",
  description: "The repository rule variants supported by the installed Octokit parameters.",
});

/**
 * A repository ruleset write matching the installed Octokit parameter vocabulary.
 *
 * **Details**
 * This wire schema preserves optional keys and uses mutable arrays to match
 * Octokit's generated request types. Decode unknown configuration with it
 * before calling `upsert`.
 *
 * **Example** (Protect matching branches)
 * ```ts
 * import { RulesetPayload } from "./Ruleset.ts";
 *
 * const payload = RulesetPayload.make({
 *   name: "main", target: "branch", enforcement: "active",
 *   rules: [{ type: "deletion" }],
 * });
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RulesetPayload = S.Struct({
  name: S.String,
  target: S.Literals(["branch", "tag", "push"]),
  enforcement: S.Literals(["active", "evaluate", "disabled"]),
  conditions: S.optionalKey(RulesetConditions),
  rules: RulesetRule.pipe(S.Array, S.mutable, S.optionalKey),
  bypass_actors: RulesetBypassActor.pipe(S.Array, S.mutable, S.optionalKey),
}).annotate({
  identifier: "RulesetPayload",
  description: "A repository ruleset body accepted by both create and update routes.",
});

/** The validated repository ruleset write fields. @category type-level @since 0.0.0 */
export type RulesetPayload = typeof RulesetPayload.Type;

/**
 * Create or update, list and delete repository rulesets, and look up the team
 * and role ids their bypass actors need.
 *
 * @public
 */
export interface RulesetShape {
  /**
   * Create or update a ruleset, matched by name.
   *
   * @remarks
   * A ruleset has **no natural key** on GitHub's side — only a numeric id
   * assigned at creation — so this matches on `name`. Renaming a ruleset in a
   * caller's configuration therefore creates a second one rather than renaming
   * the first; removing the orphan is the caller's cleanup pass.
   */
  readonly upsert: (payload: RulesetPayload) => Effect.Effect<void, GitHubError, Repo>;
  /** Every ruleset the repository sees, its own and the organization's. */
  readonly list: Effect.Effect<ReadonlyArray<RulesetInfo>, GitHubError, Repo>;
  /** Remove one ruleset by id. */
  readonly delete: (rulesetId: number) => Effect.Effect<void, GitHubError, Repo>;

  /**
   * A team's numeric id, for a bypass actor.
   *
   * @remarks
   * Org-scoped, sourced from `Repo.owner` — the organization that owns the
   * repository. A team in a *different* organization is not reachable here and
   * should not be: `Repo` would be lying about the scope.
   */
  readonly teamId: (slug: string) => Effect.Effect<number, GitHubError, Repo>;
  /** An organization role's numeric id, for a bypass actor. */
  readonly roleId: (name: string) => Effect.Effect<number, GitHubError, Repo>;
}

/**
 * Create or update, list and delete repository rulesets, and look up the team
 * and role ids their bypass actors need.
 *
 * @remarks
 * ## An inherited ruleset is never written to
 *
 * `GET /repos/{owner}/{repo}/rulesets` returns rulesets **inherited from the
 * organization** alongside the repository's own. Matching by name alone lets a
 * repository-scoped call issue a `PUT` against the organization's ruleset id —
 * rewriting policy for **every repository the organization owns**, from a caller
 * that never mentioned the organization.
 *
 * {@link RulesetShape.upsert} filters on `source_type` before matching, so an
 * inherited ruleset can never be the target of a write.
 *
 * Provide it with {@link Ruleset.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { Ruleset } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const protectMain = Effect.gen(function* () {
 *   const rulesets = yield* Ruleset;
 *   yield* rulesets.upsert({
 *     name: "protect-main",
 *     target: "branch",
 *     enforcement: "active",
 *     conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
 *     rules: [{ type: "deletion" }],
 *   });
 * });
 * ```
 *
 * @public
 */
export class Ruleset extends Context.Service<Ruleset, RulesetShape>()($I`Ruleset`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * @remarks
   * `(client) => make(client)` rather than `make`: a static initializer runs
   * while the module body is still evaluating, so naming a `const` declared
   * further down throws at import time with a clean typecheck.
   */
  static readonly layer: Layer.Layer<Ruleset, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /** An in-memory double; unstubbed members die naming themselves. */
  static readonly makeTest = (overrides: Partial<RulesetShape> = {}): RulesetShape => ({
    upsert: overrides.upsert ?? (() => unstubbed("upsert")),
    list: overrides.list ?? (Effect.suspend(() => unstubbed("list"))),
    delete: overrides.delete ?? (() => unstubbed("delete")),
    teamId: overrides.teamId ?? (() => unstubbed("teamId")),
    roleId: overrides.roleId ?? (() => unstubbed("roleId")),
  });

  /** {@link Ruleset.makeTest} behind a `Layer`. */
  static readonly layerTest = (overrides: Partial<RulesetShape> = {}): Layer.Layer<Ruleset> =>
    Layer.succeed(Ruleset, Ruleset.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw new Error(`Ruleset.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

/** An inherited ruleset belongs to the organization and is not this repository's to write. */
const isOwnedByRepository = (ruleset: {
  readonly source_type?: string | undefined
}): boolean =>
  ruleset.source_type !== "Organization";

const make = (client: GitHubClient["Service"]): RulesetShape => {
  const upsert = Effect.fn("Ruleset.upsert")(function* (payload: RulesetPayload) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, ruleset: payload.name });

    // Paginated, and this read is the existence check the create-vs-update
    // decision turns on. A truncated first page would make an existing
    // ruleset invisible past it and turn an update into a create.
    const existing = yield* client.paginate("GET /repos/{owner}/{repo}/rulesets", {
      owner,
      repo,
    });

    // Repository-owned only. Without this filter a name match against an
    // inherited ruleset issues a PUT at the organization's id.
    const match = existing.find((ruleset) => ruleset.name === payload.name && isOwnedByRepository(ruleset));

    const body = {
      name: payload.name,
      target: payload.target,
      enforcement: payload.enforcement,
      ...O.getSomesStruct({ conditions: O.fromUndefinedOr(payload.conditions) }),
      ...O.getSomesStruct({ rules: O.fromUndefinedOr(payload.rules) }),
      ...O.getSomesStruct({ bypass_actors: O.fromUndefinedOr(payload.bypass_actors) }),
    };

    if (match !== undefined) {
      yield* client.request("PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
        owner,
        repo,
        ruleset_id: match.id,
        ...body,
      });
      return;
    }

    yield* client.request("POST /repos/{owner}/{repo}/rulesets", {
      owner,
      repo,
      ...body,
    });
  });

  const list = Effect.suspend(Effect.fn("Ruleset.list")(function* () {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo });

    const rulesets = yield* client.paginate("GET /repos/{owner}/{repo}/rulesets", {
      owner,
      repo,
    });
    return rulesets.map(
      (ruleset): RulesetInfo => ({
        id: ruleset.id,
        name: ruleset.name,
        source_type: ruleset.source_type,
      }),
    );
  }));

  const delete_ = Effect.fn("Ruleset.delete")(function* (rulesetId: number) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, ruleset_id: rulesetId });

    return yield* client.request("DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
      owner,
      repo,
      ruleset_id: rulesetId,
    });
  });

  const teamId = Effect.fn("Ruleset.teamId")(function* (slug: string) {
    const { owner } = yield* Repo;
    // Annotated as `org`, not `owner`: the coordinate is reused and the
    // telemetry should say which meaning is in play.
    yield* Effect.annotateCurrentSpan({ org: owner, team_slug: slug });

    const team = yield* client.request("GET /orgs/{org}/teams/{team_slug}", {
      org: owner,
      team_slug: slug,
    });
    return team.id;
  });

  const roleId = Effect.fn("Ruleset.roleId")(function* (name: string) {
    const { owner } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ org: owner, role: name });

    const data = yield* client.request("GET /orgs/{org}/organization-roles", { org: owner });
    const roles = data.roles ?? [];
    const role = roles.find((candidate) => candidate.name === name);

    if (role === undefined) {
      const available = roles.map((candidate) => candidate.name).join(", ");
      // Listing what WAS available is the difference between a user fixing a
      // typo and a user guessing. Role ids are per-organization even for
      // predefined roles, so the list cannot be hardcoded.
      return yield* GitHubError.notFound(
        "Ruleset.roleId",
        `organization role '${name}' in '${owner}' (available: ${available || "none"})`,
      );
    }

    if (!P.isNumber(role.id)) {
      return yield* GitHubError.decode("Ruleset.roleId", "organization role id was not a number");
    }

    return role.id;
  });

  return { upsert, list, delete: delete_, teamId, roleId };
};
