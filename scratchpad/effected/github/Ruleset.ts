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

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * A ruleset, as listing returns it.
 *
 * **Details**
 *
 * `source_type` is the field that matters and the one easiest to drop from a
 * projection: a repository's ruleset listing includes rulesets **inherited from
 * the organization**, and they are indistinguishable from the repository's own
 * without it.
 *
 * @public
 */
export const RulesetInfo = S.Struct({
  id: S.Finite.annotateKey({ description: "The ruleset's numeric id." }),
  name: S.String.annotateKey({ description: "The ruleset's name." }),
  source_type: S.optional(S.String).annotateKey({ description: "Repository for an owned ruleset, Organization for an inherited ruleset; absent when GitHub omits it." }),
}).pipe($I.annoteSchema("RulesetInfo", { description: "A plain-object ruleset listing, including its ownership source." }));

/** The plain-object ruleset listing fields. */
export type RulesetInfo = typeof RulesetInfo.Type;

/**
 * What a ruleset write sends.
 *
 * **Details**
 * GitHub's rule vocabulary is large, versioned and expanding. Target and
 * enforcement remain strings, and conditions, rules and bypass actors are
 * passed through as given, including future vocabulary and partial parameters.
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
  name: S.String.annotateKey({ description: "The ruleset's name, which upsert matches on." }),
  target: S.String.annotateKey({ description: "What the ruleset applies to, passed to GitHub as given." }),
  enforcement: S.String.annotateKey({ description: "The enforcement mode, passed to GitHub as given." }),
  conditions: S.optionalKey(S.Unknown).annotateKey({ description: "Conditions passed to GitHub as given, including non-ref-name conditions." }),
  rules: S.optionalKey(S.Unknown).annotateKey({ description: "Rules passed to GitHub as given, including future rule vocabulary and partial parameters." }),
  bypass_actors: S.optionalKey(S.Unknown).annotateKey({ description: "Actors allowed to bypass the ruleset, passed to GitHub as given." }),
}).pipe($I.annoteSchema("RulesetPayload", { description: "An open repository ruleset body accepted by both create and update routes." }));

/** The open repository ruleset write fields. @category type-level @since 0.0.0 */
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
   * **Gotchas**
   *
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
   * **Details**
   *
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
 * **Gotchas**
 *
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
 * **Example** (Protect the default branch against deletion)
 *
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
   * **Gotchas**
   *
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
  throw UnstubbedError.make({ message: `Ruleset.makeTest: ${member}() was called but not stubbed — pass an override.` });
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
      yield* client.requestDecoded("PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
        owner,
        repo,
        ruleset_id: match.id,
        ...body,
      }, S.Unknown);
      return;
    }

    yield* client.requestDecoded("POST /repos/{owner}/{repo}/rulesets", {
      owner,
      repo,
      ...body,
    }, S.Unknown);
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

    yield* client.request("DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
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
