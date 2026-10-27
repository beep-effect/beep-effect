/**
 * Repository rulesets through GitHub's REST API.
 *
 * **Details**
 *
 * Creates or updates, lists and deletes repository rulesets, and looks up the
 * team and organization-role ids their bypass actors need. Rulesets inherited
 * from the organization are never written.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";

const $I = $GithubId.create("Ruleset");

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
 * **Example** (Preserve inherited ruleset ownership)
 *
 * ```ts
 * import { RulesetInfo } from "@beep/github/Ruleset";
 * import * as S from "effect/Schema";
 *
 * const ruleset = S.decodeUnknownSync(RulesetInfo)({ id: 1, name: "main", source_type: "Organization" });
 * console.log(ruleset.source_type) // Organization
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class RulesetInfo extends S.Opaque<RulesetInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Finite.pipe($I.annoteKey("RulesetInfo.id", { description: "The ruleset's numeric id." })),
    name: S.String.pipe($I.annoteKey("RulesetInfo.name", { description: "The ruleset's name." })),
    source_type: S.optionalKey(S.String).pipe(
      $I.annoteKey("RulesetInfo.source_type", {
        description:
          "Repository for an owned ruleset, Organization for an inherited ruleset; absent when GitHub omits it.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RulesetInfo", { description: "A plain-object ruleset listing, including its ownership source." })
  )
) {}

/**
 * What a ruleset write sends.
 *
 * **Details**
 *
 * GitHub's rule vocabulary is large, versioned and expanding. Target and
 * enforcement remain strings, and conditions, rules and bypass actors are
 * passed through as given, including future vocabulary and partial parameters.
 *
 * **Example** (Protect matching branches)
 *
 * ```ts
 * import { RulesetPayload } from "@beep/github/Ruleset";
 *
 * const payload = RulesetPayload.make({
 *   name: "main", target: "branch", enforcement: "active",
 *   rules: [{ type: "deletion" }],
 * });
 * console.log(payload.name) // main
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RulesetPayload extends S.Opaque<RulesetPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe(
      $I.annoteKey("RulesetPayload.name", { description: "The ruleset's name, which upsert matches on." })
    ),
    target: S.String.pipe(
      $I.annoteKey("RulesetPayload.target", { description: "What the ruleset applies to, passed to GitHub as given." })
    ),
    enforcement: S.String.pipe(
      $I.annoteKey("RulesetPayload.enforcement", { description: "The enforcement mode, passed to GitHub as given." })
    ),
    conditions: S.optionalKey(S.Unknown).pipe(
      $I.annoteKey("RulesetPayload.conditions", {
        description: "Conditions passed to GitHub as given, including non-ref-name conditions.",
      })
    ),
    rules: S.optionalKey(S.Unknown).pipe(
      $I.annoteKey("RulesetPayload.rules", {
        description: "Rules passed to GitHub as given, including future rule vocabulary and partial parameters.",
      })
    ),
    bypass_actors: S.optionalKey(S.Unknown).pipe(
      $I.annoteKey("RulesetPayload.bypass_actors", {
        description: "Actors allowed to bypass the ruleset, passed to GitHub as given.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RulesetPayload", {
      description: "An open repository ruleset body accepted by both create and update routes.",
    })
  )
) {}

/**
 * Companion types for {@link RulesetPayload}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RulesetPayload {
  /**
   * The plain ruleset body accepted by `Ruleset.upsert`, so a caller can pass an object literal.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RulesetPayload.Encoded;
}

/**
 * Create or update, list and delete repository rulesets, and look up the team
 * and role ids their bypass actors need.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface RulesetShape {
  /** Remove one ruleset by id. */
  readonly delete: (rulesetId: number) => Effect.Effect<void, GitHubError, Repo>;
  /** Every ruleset the repository sees, its own and the organization's. */
  readonly list: Effect.Effect<ReadonlyArray<RulesetInfo>, GitHubError, Repo>;
  /** An organization role's numeric id, for a bypass actor. */
  readonly roleId: (name: string) => Effect.Effect<number, GitHubError, Repo>;

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
  readonly upsert: (payload: RulesetPayload.Encoded) => Effect.Effect<void, GitHubError, Repo>;
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
 * import { Ruleset } from "@beep/github/Ruleset";
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
 * console.log(Effect.isEffect(protectMain)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
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
   *
   * **Example** (Construct the live ruleset layer)
   *
   * ```ts
   * import { Ruleset } from "@beep/github/Ruleset";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(Ruleset.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Ruleset, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub a team lookup)
   *
   * ```ts
   * import { Ruleset } from "@beep/github/Ruleset";
   * import * as Effect from "effect/Effect";
   *
   * const rulesets = Ruleset.makeTest({ teamId: () => Effect.succeed(42) });
   * console.log(Effect.isEffect(rulesets.teamId("maintainers"))) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<RulesetShape> = {}): RulesetShape => ({
    upsert: overrides.upsert ?? (() => unstubbed("upsert")),
    list: overrides.list ?? Effect.suspend(() => unstubbed("list")),
    delete: overrides.delete ?? (() => unstubbed("delete")),
    teamId: overrides.teamId ?? (() => unstubbed("teamId")),
    roleId: overrides.roleId ?? (() => unstubbed("roleId")),
  });

  /**
   * {@link Ruleset.makeTest} behind a `Layer`.
   *
   * **Example** (Provide a ruleset double)
   *
   * ```ts
   * import { Ruleset } from "@beep/github/Ruleset";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.flatMap(Ruleset, (rulesets) => rulesets.roleId("admin")).pipe(
   *   Effect.provide(Ruleset.layerTest({ roleId: () => Effect.succeed(7) })),
   * );
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<RulesetShape> = {}): Layer.Layer<Ruleset> =>
    Layer.succeed(Ruleset, Ruleset.makeTest(overrides));
}

const unstubbed = unstubbedFor({ service: "Ruleset" });

/** An inherited ruleset belongs to the organization and is not this repository's to write. */
const isOwnedByRepository = (ruleset: { readonly source_type?: string | undefined }): boolean =>
  ruleset.source_type !== "Organization";

const make = (client: GitHubClient["Service"]): RulesetShape => {
  const upsert = Effect.fn("Ruleset.upsert")(function* (payload: RulesetPayload.Encoded) {
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
    const match = A.findFirst(existing, (ruleset) => ruleset.name === payload.name && isOwnedByRepository(ruleset));

    const body = {
      name: payload.name,
      target: payload.target,
      enforcement: payload.enforcement,
      ...O.getSomesStruct({ conditions: O.fromUndefinedOr(payload.conditions) }),
      ...O.getSomesStruct({ rules: O.fromUndefinedOr(payload.rules) }),
      ...O.getSomesStruct({ bypass_actors: O.fromUndefinedOr(payload.bypass_actors) }),
    };

    if (O.isSome(match)) {
      yield* client.requestDecoded(
        "PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}",
        {
          owner,
          repo,
          ruleset_id: match.value.id,
          ...body,
        },
        S.Unknown
      );
      return;
    }

    yield* client.requestDecoded(
      "POST /repos/{owner}/{repo}/rulesets",
      {
        owner,
        repo,
        ...body,
      },
      S.Unknown
    );
  });

  const list = Effect.suspend(
    Effect.fn("Ruleset.list")(function* () {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo });

      const rulesets = yield* client.paginate("GET /repos/{owner}/{repo}/rulesets", {
        owner,
        repo,
      });
      return yield* Effect.forEach(rulesets, (ruleset) =>
        S.decodeEffect(RulesetInfo)({
          id: ruleset.id,
          name: ruleset.name,
          ...O.getSomesStruct({ source_type: O.fromUndefinedOr(ruleset.source_type) }),
        }).pipe(
          Effect.mapError((error) => GitHubError.decode("Ruleset.list", "GitHub returned an unexpected ruleset", error))
        )
      );
    })
  );

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
    const role = A.findFirst(roles, (candidate) => candidate.name === name);

    if (O.isNone(role)) {
      const available = pipe(
        roles,
        A.map((candidate) => candidate.name),
        A.join(", ")
      );
      // Listing what WAS available is the difference between a user fixing a
      // typo and a user guessing. Role ids are per-organization even for
      // predefined roles, so the list cannot be hardcoded.
      return yield* GitHubError.notFound(
        "Ruleset.roleId",
        `organization role '${name}' in '${owner}' (available: ${available || "none"})`
      );
    }

    if (!P.isNumber(role.value.id)) {
      return yield* GitHubError.decode("Ruleset.roleId", "organization role id was not a number");
    }

    return role.value.id;
  });

  return { upsert, list, delete: delete_, teamId, roleId };
};
