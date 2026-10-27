/**
 * Repository settings through GitHub's REST and GraphQL APIs.
 *
 * **Details**
 *
 * Reads and patches a repository's settings, routes the settings only GraphQL
 * can write through `updateRepository`, and looks up the default branch, node
 * id and owner type. `security_and_analysis` blocks are normalised to the shape
 * the PATCH accepts before anything is sent.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import { GraphQLDocument } from "./GraphQL.ts";
import { Repo } from "./Repo.ts";
import type { GitHubError } from "./GitHubError.ts";
import type { GitHubGraphQLError } from "./GraphQL.ts";
import type * as Rest from "./Rest.ts";

const $I = $GithubId.create("GitHubRepository");

/**
 * Everything GitHub reports about a repository.
 *
 * **Details**
 *
 * The **generated** response type for `GET /repos/{owner}/{repo}`, not a
 * hand-written projection, so every field GitHub documents is available with
 * its documented type.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RepositorySettings = Rest.Data<"GET /repos/{owner}/{repo}">;

/**
 * The fields `PATCH /repos/{owner}/{repo}` accepts, minus the coordinate.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RepositoryPatch = Omit<Rest.Params<"PATCH /repos/{owner}/{repo}">, "owner" | "repo">;

/**
 * A {@link RepositoryPatch} under construction, where an absent field may be
 * spelled as an explicit `undefined`.
 *
 * **Details**
 *
 * The shape you actually have when you are applying only what a user
 * configured. Octokit's generated params spell an optional field as
 * `has_issues?: boolean`, **not** `has_issues?: boolean | undefined`, so under
 * `exactOptionalPropertyTypes` a `Partial<T>` built from your own settings
 * schema does not assign to `RepositoryPatch` at all. This type does, and
 * {@link repositoryPatch} turns it into one.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RepositoryPatchDraft = {
  readonly [K in keyof RepositoryPatch]?: RepositoryPatch[K] | undefined;
};

/**
 * A {@link RepositoryPatch} from a draft, dropping every explicitly-`undefined`
 * field.
 *
 * **Details**
 *
 * The supported spelling for "apply only what was configured" — the natural
 * shape for a sync action, without a cast at the call site.
 *
 * Dropping the key rather than sending `undefined` is what the wire needs:
 * `PATCH` treats an absent field as "leave it alone", while an explicit `null`
 * or `undefined` is a value.
 *
 * A key-by-key loop still defeats TypeScript's correlation between two indexed
 * accesses (`draft[key] = source[key]` over a union `key`), which no helper can
 * fix — build the draft as a literal where you can.
 *
 * **Example** (Build a repository patch from configured fields)
 *
 * ```ts
 * import { repositoryPatch } from "@beep/github/GitHubRepository";
 *
 * const config: { has_issues: boolean | undefined; has_wiki: boolean | undefined;
 *   description: string | undefined } = { has_issues: true, has_wiki: undefined, description: "App" };
 *
 * // `config.has_issues` is `boolean | undefined`; absent fields drop out.
 * const patch = repositoryPatch({
 *   has_issues: config.has_issues,
 *   has_wiki: config.has_wiki,
 *   description: config.description,
 * });
 * console.log(patch.has_issues) // true
 * console.log(Object.hasOwn(patch, "has_wiki")) // false
 * ```
 *
 * @param draft - The fields to apply, each of which may be `undefined`.
 * @returns A patch carrying only the fields that were actually set.
 * @public
 * @category constructors
 * @since 0.0.0
 */
export const repositoryPatch = (draft: RepositoryPatchDraft): RepositoryPatch => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of R.toEntries<string, unknown>(draft)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};

/**
 * Whether an account is a user or an organization.
 *
 * **Example** (Validate an owner type)
 *
 * ```ts
 * import { OwnerType } from "@beep/github/GitHubRepository";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(OwnerType)("Organization")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const OwnerType = LiteralKit(["User", "Organization"]).pipe(
  $I.annoteSchema("OwnerType", { description: "Whether an account is a user or an organization." })
);

/**
 * The values accepted by {@link OwnerType}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type OwnerType = typeof OwnerType.Type;

/**
 * Fields in the user-facing `security_and_analysis` block that GitHub accepts
 * as `{ status: "enabled" | "disabled" }`.
 *
 * **Details**
 *
 * A caller supplies the bare string; it is wrapped before sending.
 *
 * **Example** (Recognize a security status field)
 *
 * ```ts
 * import { SECURITY_ANALYSIS_STATUS_FIELDS } from "@beep/github/GitHubRepository";
 * import * as HashSet from "effect/HashSet";
 *
 * console.log(HashSet.has(SECURITY_ANALYSIS_STATUS_FIELDS, "secret_scanning")) // true
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const SECURITY_ANALYSIS_STATUS_FIELDS: HashSet.HashSet<string> = HashSet.make(
  "advanced_security",
  "code_security",
  "secret_scanning",
  "secret_scanning_push_protection",
  "secret_scanning_ai_detection",
  "secret_scanning_non_provider_patterns",
  "secret_scanning_delegated_alert_dismissal",
  "secret_scanning_delegated_bypass",
  "dependabot_security_updates"
);

/**
 * Settings reachable **only** through the GraphQL `updateRepository` mutation,
 * mapped from snake_case keys to camelCase GraphQL input fields.
 *
 * **Gotchas**
 *
 * GitHub never exposed these on the REST repository endpoint — the
 * `PATCH /repos/{owner}/{repo}` route accepts none of them, and
 * `has_discussions` is the treacherous one: the REST **read** returns it, so
 * routing its write to the PATCH looks symmetric, but the PATCH silently
 * ignores unknown body fields and answers 200, so the write would look applied
 * while the repository never changed. Setting any of these forces a second
 * round trip to learn the repository's node id.
 *
 * **Example** (Find the GraphQL field for discussions)
 *
 * ```ts
 * import { GRAPHQL_ONLY_SETTINGS } from "@beep/github/GitHubRepository";
 *
 * console.log(GRAPHQL_ONLY_SETTINGS.has_discussions) // hasDiscussionsEnabled
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const GRAPHQL_ONLY_SETTINGS: Readonly<Record<string, string>> = {
  has_sponsorships: "hasSponsorshipsEnabled",
  has_pull_requests: "hasPullRequestsEnabled",
  has_discussions: "hasDiscussionsEnabled",
};

/** The bare security-feature status a caller may supply. */
const SecurityStatus = LiteralKit(["enabled", "disabled"]).pipe(
  $I.annoteSchema("SecurityStatus", { description: "Whether a security feature is enabled or disabled." })
);
const isSecurityStatus = S.is(SecurityStatus);

/** `{ status: "enabled" | "disabled" }` — the form GitHub accepts and the type declares. */
const StatusObject = S.Struct({
  status: SecurityStatus.pipe(
    $I.annoteKey("StatusObject.status", { description: "Whether the security feature is enabled or disabled." })
  ),
}).pipe(
  $I.annoteSchema("StatusObject", {
    description: "The wrapped security-feature status accepted at the repository settings boundary.",
  })
);
const isStatusObject = S.is(StatusObject);

/** A status field, wrapped when bare and passed through when already wrapped. */
const statusEntry = (key: string, raw: unknown): O.Option<readonly [string, unknown]> => {
  if (isSecurityStatus(raw)) return O.some([key, { status: raw }]);
  // Already the shape GitHub wants, which is also the shape `RepositoryPatch`
  // types. Passing it through is not a convenience: without this branch a
  // type-correct caller has the block silently dropped, because the wrapping
  // branch above only matches a bare string. That is data loss on the input
  // the type asks for.
  return isStatusObject(raw) ? O.some([key, raw]) : O.none();
};

/** Non-empty reviewer entries, moved under the key the PATCH reads them from. */
const reviewersEntry = (raw: unknown): O.Option<readonly [string, unknown]> =>
  A.isArray(raw) && A.isArrayNonEmpty(raw)
    ? O.some(["secret_scanning_delegated_bypass_options", { reviewers: raw }])
    : O.none();

/** The PATCH entry for one caller entry, or none when GitHub has no use for it. */
const securityEntry = (key: string, raw: unknown): O.Option<readonly [string, unknown]> => {
  if (HashSet.has(SECURITY_ANALYSIS_STATUS_FIELDS, key)) return statusEntry(key, raw);
  return key === "delegated_bypass_reviewers" ? reviewersEntry(raw) : O.none();
};

/**
 * Translate a user-facing `security_and_analysis` block into the shape
 * `PATCH /repos/{owner}/{repo}` expects.
 *
 * **Details**
 *
 * **Both shapes are accepted.** A bare `"enabled"` / `"disabled"` is wrapped;
 * an already-wrapped `{ status }` — which is what `RepositoryPatch` actually
 * types, since it is GitHub's own parameter type — passes through untouched.
 * Accepting only the bare string would silently drop the block for a caller
 * following the types.
 *
 * Reviewer entries must already carry a numeric `reviewer_id` and
 * `reviewer_type`; resolving those from team slugs is the caller's job — see
 * `Ruleset.teamId`.
 *
 * An **empty** `delegated_bypass_reviewers` array is treated as "no change"
 * rather than "no reviewers". GitHub rejects `{ reviewers: [] }` outright when
 * delegated bypass is enabled, so forwarding it would turn an omission into a
 * failure.
 *
 * **Example** (Wrap security status and omit empty reviewer changes)
 *
 * ```ts
 * import { transformSecurityAndAnalysis } from "@beep/github/GitHubRepository";
 *
 * import * as O from "effect/Option";
 *
 * const wrapped = transformSecurityAndAnalysis({ secret_scanning: "enabled" });
 * console.log(JSON.stringify(O.getOrNull(wrapped))) // {"secret_scanning":{"status":"enabled"}}
 * console.log(O.isNone(transformSecurityAndAnalysis({ delegated_bypass_reviewers: [] }))) // true
 * ```
 *
 * @public
 * @category normalization
 * @since 0.0.0
 */
export const transformSecurityAndAnalysis = (value: unknown): O.Option<Record<string, unknown>> => {
  if (!P.isObjectOrArray(value)) return O.none();
  const input: Record<string, unknown> = { ...value };
  return pipe(
    R.toEntries(input),
    A.map(([key, raw]) => securityEntry(key, raw)),
    A.getSomes,
    O.liftPredicate(A.isArrayNonEmpty),
    O.map((entries) => R.fromEntries(entries))
  );
};

/** The mutation's answer. Only its shape matters — the id is never read. */
const UpdateRepositoryResponse = S.Struct({
  updateRepository: S.Struct({
    repository: S.Struct({ id: S.String }),
  }),
});

/**
 * The `updateRepository` mutation, as an owned document.
 *
 * **Details**
 *
 * Named `UpdateRepository`; {@link GitHubClient.layerFixture} keys its GraphQL
 * fixtures by that name.
 */
const UpdateRepository = GraphQLDocument.make({
  name: "UpdateRepository",
  document: `mutation UpdateRepository($input: UpdateRepositoryInput!) {
	updateRepository(input: $input) {
		repository { id }
	}
}`,
  response: UpdateRepositoryResponse,
})<{ readonly input: Record<string, unknown> }>();

/**
 * Keys GitHub rejects when the strategy that owns them is being turned off.
 *
 * **Gotchas**
 *
 * Sending `merge_commit_title` in the same request that sets
 * `allow_merge_commit: false` is a 422, so the dependent keys go out with the
 * strategy that owns them rather than alone.
 */
const DEPENDENT_MERGE_KEYS = {
  allow_merge_commit: ["merge_commit_title", "merge_commit_message"],
  allow_squash_merge: ["squash_merge_commit_title", "squash_merge_commit_message"],
} as const;

/**
 * Everything both write paths owe the API before a patch is sent.
 *
 * **Details**
 *
 * Shared by `updateSettings` and `applySettings` deliberately: a caller should
 * not get a different `security_and_analysis` shape depending on which one they
 * reached for.
 */
const preparePatch = (patch: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...patch };

  const securityAndAnalysis = transformSecurityAndAnalysis(out.security_and_analysis);
  if (O.isSome(securityAndAnalysis)) {
    out.security_and_analysis = securityAndAnalysis.value;
  } else {
    delete out.security_and_analysis;
  }

  for (const [strategy, dependents] of R.toEntries(DEPENDENT_MERGE_KEYS)) {
    if (out[strategy] === false) {
      for (const dependent of dependents) delete out[dependent];
    }
  }

  return out;
};

/**
 * What {@link GitHubRepositoryShape.applySettings} actually sent.
 *
 * **Details**
 *
 * **These are the fields that went out, not the fields you asked for**, and the
 * difference is the point. `applySettings` drops what GitHub would reject —
 * merge keys whose strategy is being disabled, a `security_and_analysis` block
 * that normalises to nothing — so a caller reporting `Object.keys(input)` is
 * describing its own intent while the package decides the content. The two
 * agree right up until a field is dropped, which is exactly the case anyone
 * reading a dry run is trying to check.
 *
 * Both lists use the **caller's** key names, not the wire names, because the
 * audience for them is a person reading a plan against the config they wrote.
 *
 * **Example** (Decode the keys actually sent)
 *
 * ```ts
 * import { AppliedSettings } from "@beep/github/GitHubRepository";
 * import * as S from "effect/Schema";
 *
 * const applied = S.decodeUnknownSync(AppliedSettings)({
 *   rest: ["has_wiki"], graphql: ["has_discussions"],
 * });
 * console.log(applied.graphql[0]) // has_discussions
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class AppliedSettings extends S.Opaque<AppliedSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    rest: S.Array(S.String).pipe(
      $I.annoteKey("AppliedSettings.rest", {
        description: "Keys sent on the REST patch after preparation dropped anything GitHub would refuse.",
      })
    ),
    graphql: S.Array(S.String).pipe(
      $I.annoteKey("AppliedSettings.graphql", {
        description: "Keys sent through the GraphQL mutation, named as the caller supplied them.",
      })
    ),
  }).pipe(
    $I.annoteSchema("AppliedSettings", {
      description: "The fields actually sent through REST and GraphQL when applying repository settings.",
    })
  )
) {}

/**
 * Read and update a repository's settings, and look up its default branch, node
 * id and owner type.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface GitHubRepositoryShape {
  /**
   * Apply a settings map that may span REST and GraphQL.
   *
   * **Details**
   *
   * `updateSettings` is the thin, faithfully-typed PATCH and returns what
   * GitHub then reports. This is the **applicator**: it takes an open map,
   * routes each key to whichever API can actually set it, and returns an
   * {@link AppliedSettings} naming the keys that were sent through each.
   *
   * Three settings — `has_sponsorships`, `has_pull_requests` and
   * `has_discussions` ({@link GRAPHQL_ONLY_SETTINGS}) — are only reachable
   * through GraphQL's `updateRepository`, which addresses a repository by **node
   * id**. So a map touching any of them costs an extra read; a map touching none
   * does not, which is the common case.
   *
   * The map is open by design. GitHub's settings surface is large and moving,
   * and a closed type here would date the package — but it also means a typo is
   * forwarded rather than rejected, so a caller that owns a schema should
   * validate before calling.
   */
  readonly applySettings: (
    settings: Record<string, unknown>
  ) => Effect.Effect<AppliedSettings, GitHubError | GitHubGraphQLError, Repo>;
  /**
   * The default branch's name.
   *
   * **Details**
   *
   * Reads the repository payload and returns `default_branch`.
   */
  readonly defaultBranch: Effect.Effect<string, GitHubError, Repo>;
  /**
   * The repository's GraphQL node id.
   *
   * **Details**
   *
   * Needed as `repositoryId` by the `createLinkedBranch` and `createPullRequest`
   * mutations.
   */
  readonly nodeId: Effect.Effect<string, GitHubError, Repo>;

  /**
   * Whether the repository's owner is a user or an organization.
   *
   * **Details**
   *
   * Gates the settings that only exist on organization-owned repositories:
   * sending one to a personal repository is rejected, so a caller applying a
   * shared settings template filters by this first.
   *
   * The route is account-scoped (`GET /users/{username}`) but the question is a
   * repository question — *may I send org-only fields to this repository?* —
   * so it sources the login from `Repo.owner` rather than taking an argument.
   * Shaping the API around the route instead of the question would hand every
   * caller a login to thread for no reason.
   */
  readonly ownerType: Effect.Effect<OwnerType, GitHubError, Repo>;
  /** The full, faithfully typed repository payload. */
  readonly settings: Effect.Effect<RepositorySettings, GitHubError, Repo>;
  /** Apply a settings patch and return what GitHub then reports. */
  readonly updateSettings: (patch: RepositoryPatch) => Effect.Effect<RepositorySettings, GitHubError, Repo>;
}

/**
 * Read and update a repository's settings, including settings only GraphQL can
 * write, and look up its default branch, node id and owner type.
 *
 * **Details**
 *
 * Provide it with {@link GitHubRepository.layer}, which needs a `GitHubClient`;
 * every member also needs a `Repo` in `R`. `settings`, `defaultBranch`, `nodeId`
 * and `ownerType` are `Effect` values, not functions.
 *
 * **Example** (Read the default branch and apply REST and GraphQL settings)
 *
 * ```ts
 * import { GitHubRepository } from "@beep/github/GitHubRepository";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* GitHubRepository;
 *   const branch = yield* repository.defaultBranch;
 *   const applied = yield* repository.applySettings({ has_wiki: false, has_discussions: true });
 *   return { branch, applied }; // applied.rest, applied.graphql
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class GitHubRepository extends Context.Service<GitHubRepository, GitHubRepositoryShape>()($I`GitHubRepository`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Inspect the live service layer)
   *
   * ```ts
   * import { GitHubRepository } from "@beep/github/GitHubRepository";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GitHubRepository.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<GitHubRepository, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Override a test-double member)
   *
   * ```ts
   * import { GitHubRepository } from "@beep/github/GitHubRepository";
   * import * as Effect from "effect/Effect";
   *
   * const repository = GitHubRepository.makeTest({ defaultBranch: Effect.succeed("main") });
   * console.log(Effect.isEffect(repository.defaultBranch)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<GitHubRepositoryShape> = {}): GitHubRepositoryShape => ({
    settings: overrides.settings ?? Effect.sync(() => unstubbed("settings")),
    updateSettings: overrides.updateSettings ?? (() => unstubbed("updateSettings")),
    defaultBranch: overrides.defaultBranch ?? Effect.sync(() => unstubbed("defaultBranch")),
    nodeId: overrides.nodeId ?? Effect.sync(() => unstubbed("nodeId")),
    ownerType: overrides.ownerType ?? Effect.sync(() => unstubbed("ownerType")),
    applySettings: overrides.applySettings ?? (() => unstubbed("applySettings")),
  });

  /**
   * {@link GitHubRepository.makeTest} behind a `Layer`.
   *
   * **Example** (Provide an in-memory service layer)
   *
   * ```ts
   * import { GitHubRepository } from "@beep/github/GitHubRepository";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GitHubRepository.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<GitHubRepositoryShape> = {}): Layer.Layer<GitHubRepository> =>
    Layer.succeed(GitHubRepository, GitHubRepository.makeTest(overrides));
}

const unstubbed = unstubbedFor({ service: "GitHubRepository", access: "read" });

/** The GraphQL input field for a caller key, when only GraphQL can set it. */
const graphqlFieldOf = (key: string): O.Option<string> =>
  // `R.has` checks own keys: the map is open by design, so a caller key of
  // `toString` or `constructor` would otherwise resolve through the prototype
  // chain to a FUNCTION, and that function would be sent as a GraphQL input
  // field name and reported as applied.
  R.has(GRAPHQL_ONLY_SETTINGS, key) ? O.fromUndefinedOr(GRAPHQL_ONLY_SETTINGS[key]) : O.none();

/** Split an open settings map into the REST body and the GraphQL input. */
const routeSettings = (
  input: Record<string, unknown>
): {
  readonly rest: Record<string, unknown>;
  readonly graphql: Record<string, unknown>;
  readonly graphqlKeys: ReadonlyArray<string>;
} => {
  const rest: Record<string, unknown> = {};
  const graphql: Record<string, unknown> = {};
  // The caller's key for each GraphQL field, so the report speaks their
  // vocabulary rather than the wire's.
  const graphqlKeys: Array<string> = [];
  for (const [key, value] of R.toEntries(input)) {
    if (P.isUndefined(value)) continue;
    const graphqlField = graphqlFieldOf(key);
    if (O.isSome(graphqlField)) {
      graphql[graphqlField.value] = value;
      graphqlKeys.push(key);
    } else {
      rest[key] = value;
    }
  }
  return { rest, graphql, graphqlKeys };
};

const make = (client: GitHubClient["Service"]): GitHubRepositoryShape => {
  const settings = Effect.gen(function* () {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo });
    return yield* client.request("GET /repos/{owner}/{repo}", { owner, repo });
  }).pipe(Effect.withSpan("GitHubRepository.settings"));

  const ownerType = Effect.gen(function* () {
    const { owner } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner });
    const user = yield* client.request("GET /users/{username}", { username: owner });
    return user.type === "Organization" ? "Organization" : "User";
  }).pipe(Effect.withSpan("GitHubRepository.ownerType"));

  return {
    settings,
    updateSettings: Effect.fn("GitHubRepository.updateSettings")(function* (patch: RepositoryPatch) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, fields: R.keys<string, unknown>(patch).length });
      return yield* client.request("PATCH /repos/{owner}/{repo}", { ...preparePatch({ ...patch }), owner, repo });
    }),
    defaultBranch: Effect.map(settings, (repository) => repository.default_branch),
    nodeId: Effect.map(settings, (repository) => repository.node_id),
    ownerType,
    applySettings: Effect.fn("GitHubRepository.applySettings")(function* (input: Record<string, unknown>) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo });

      const { rest, graphql, graphqlKeys } = routeSettings(input);

      // Prepared ONCE, and the report is taken from the result: reporting
      // `rest` here would name fields that preparation then drops, which is a
      // dry run that lies in the direction of looking successful.
      const prepared = preparePatch(rest);
      // Gate on the PREPARED body, never the raw keys. Preparation can drop
      // every key it was given — a `security_and_analysis` block whose fields
      // are all unrecognised normalises to nothing — and gating on `rest`
      // then fires a PATCH carrying only `owner` and `repo`, while the report
      // below truthfully says nothing was sent. The report contradicting the
      // wire is the one failure `AppliedSettings` exists to prevent.
      const restKeys = R.keys(prepared);

      if (restKeys.length > 0) {
        yield* client.request("PATCH /repos/{owner}/{repo}", {
          ...prepared,
          owner,
          repo,
        });
      }

      if (R.keys(graphql).length > 0) {
        // Only now is the node id worth a round trip.
        const repository = yield* client.request("GET /repos/{owner}/{repo}", { owner, repo });
        yield* client.graphql(UpdateRepository, {
          input: { repositoryId: repository.node_id, ...graphql },
        });
      }

      return AppliedSettings.make({ rest: restKeys, graphql: graphqlKeys });
    }),
  };
};
