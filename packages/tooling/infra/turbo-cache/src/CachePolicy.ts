/**
 * Who may read and who may write the Turborepo remote cache.
 * The policy carries the signed-policy semantics of the AWS cache and the R2
 * pilot (goals/infra-alchemy-rebuild, D7) as data: every team owns its own
 * artifacts, and every principal of a team holds its own token of one access
 * class. Protected `main` CI and named trusted workstations hold `write`
 * tokens; same-repository pull-request jobs hold a `read` token; forks receive
 * no token at all, so they stay local-only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $InfraTurboCacheId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const $I = $InfraTurboCacheId.create("CachePolicy");

const segmentPattern = /^[a-zA-Z0-9_-]+$/u;

const distinct = (names: ReadonlyArray<string>): boolean => HashSet.size(HashSet.fromIterable(names)) === names.length;

/**
 * A Turborepo team slug: the `?slug=` value every cache request carries and
 * the key prefix of every artifact the team owns.
 *
 * **Example** (Accept a team slug)
 *
 * ```ts
 * import { TeamSlug } from "@beep/infra-turbo-cache/CachePolicy"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TeamSlug)("beep")) // true
 * console.log(S.is(TeamSlug)("bad.slug")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TeamSlug = S.String.check(S.isPattern(segmentPattern)).pipe(
  $I.annoteSchema("TeamSlug", { description: "A Turborepo team slug: letters, digits, `_` and `-` only." })
);

/**
 * Runtime type for {@link TeamSlug}.
 *
 * @category models
 * @since 0.0.0
 */
export type TeamSlug = typeof TeamSlug.Type;

/**
 * A Turborepo artifact hash as it appears in `/v8/artifacts/<hash>`.
 *
 * **Example** (Refuse a path-shaped hash)
 *
 * ```ts
 * import { ArtifactHash } from "@beep/infra-turbo-cache/CachePolicy"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArtifactHash)("9f2c1e")) // true
 * console.log(S.is(ArtifactHash)("a/b")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArtifactHash = S.String.check(S.isPattern(segmentPattern)).pipe(
  $I.annoteSchema("ArtifactHash", { description: "A Turborepo artifact hash: letters, digits, `_` and `-` only." })
);

/**
 * Runtime type for {@link ArtifactHash}.
 *
 * @category models
 * @since 0.0.0
 */
export type ArtifactHash = typeof ArtifactHash.Type;

/**
 * The name of one token holder inside a team, such as `ci-main` or
 * `dankstation`. It names the token's Alchemy resource, so it is lowercase
 * kebab case.
 *
 * **Example** (Accept a principal name)
 *
 * ```ts
 * import { PrincipalName } from "@beep/infra-turbo-cache/CachePolicy"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PrincipalName)("ci-main")) // true
 * console.log(S.is(PrincipalName)("CI Main")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrincipalName = S.String.check(S.isPattern(/^[a-z0-9][a-z0-9-]*$/u)).pipe(
  $I.annoteSchema("PrincipalName", { description: "A token holder's name inside a team, lowercase kebab case." })
);

/**
 * Runtime type for {@link PrincipalName}.
 *
 * @category models
 * @since 0.0.0
 */
export type PrincipalName = typeof PrincipalName.Type;

/**
 * The access class of a token: `read` restores artifacts, `write` also
 * uploads them.
 *
 * **Example** (Narrow an access class)
 *
 * ```ts
 * import { Access } from "@beep/infra-turbo-cache/CachePolicy"
 *
 * console.log(Access.is.write("write")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Access = LiteralKit(["read", "write"]).pipe(
  $I.annoteSchema("Access", { description: "A token's access class: read restores artifacts, write also uploads." })
);

/**
 * Runtime type for {@link Access}.
 *
 * @category models
 * @since 0.0.0
 */
export type Access = typeof Access.Type;

/**
 * What a cache request asks to do, derived from its method and path.
 *
 * **Example** (Name the upload operation)
 *
 * ```ts
 * import { ArtifactOperation } from "@beep/infra-turbo-cache/CachePolicy"
 *
 * console.log(ArtifactOperation.Enum.upload) // "upload"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArtifactOperation = LiteralKit(["status", "events", "query", "download", "upload"]).pipe(
  $I.annoteSchema("ArtifactOperation", {
    description: "A cache request's operation: status, events, query, download or upload.",
  })
);

/**
 * Runtime type for {@link ArtifactOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type ArtifactOperation = typeof ArtifactOperation.Type;

/**
 * One token holder of a team.
 *
 * **Details**
 *
 * `rotation` is part of the token's resource id. Raising it makes the next
 * deploy generate a fresh token and drop the previous one, so a leaked token is
 * rotated by a one-line change and a `main` deploy.
 *
 * **Example** (Declare a pull-request reader)
 *
 * ```ts
 * import { Principal } from "@beep/infra-turbo-cache/CachePolicy"
 *
 * const reader = Principal.make({ name: "ci-pr", access: "read", rotation: 1 })
 * console.log(reader.access) // "read"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Principal extends S.Opaque<Principal, { readonly brand: unique symbol }>()(
  S.Struct({
    name: PrincipalName,
    access: Access,
    rotation: S.Int.check(S.isGreaterThanOrEqualTo(1)),
  }).pipe(
    $I.annoteSchema("Principal", { description: "One token holder of a team, with its access class and rotation." })
  )
) {}

/**
 * One cache team: the artifacts under its slug and the principals that hold
 * its tokens.
 *
 * **Example** (Declare a team with a writer and a reader)
 *
 * ```ts
 * import { Principal, Team } from "@beep/infra-turbo-cache/CachePolicy"
 *
 * const team = Team.make({
 *   slug: "beep",
 *   principals: [
 *     Principal.make({ name: "ci-main", access: "write", rotation: 1 }),
 *     Principal.make({ name: "ci-pr", access: "read", rotation: 1 }),
 *   ],
 * })
 * console.log(team.principals.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Team extends S.Opaque<Team, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: TeamSlug,
    principals: S.NonEmptyArray(Principal).check(
      S.makeFilter((principals) => distinct(A.map(principals, ({ name }) => name)), {
        message: "Each principal of a team needs its own name.",
      })
    ),
  }).pipe($I.annoteSchema("Team", { description: "A cache team: its slug and the principals that hold its tokens." }))
) {}

/**
 * The whole cache policy: every team the Worker serves.
 *
 * **Example** (Decode a policy)
 *
 * ```ts
 * import { CachePolicy } from "@beep/infra-turbo-cache/CachePolicy"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownSync(CachePolicy)({
 *   teams: [{ slug: "beep", principals: [{ name: "ci-pr", access: "read", rotation: 1 }] }],
 * })
 * console.log(policy.teams[0].slug) // "beep"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicy extends S.Opaque<CachePolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    teams: S.NonEmptyArray(Team).check(
      S.makeFilter((teams) => distinct(A.map(teams, ({ slug }) => slug)), {
        message: "Each team needs its own slug.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CachePolicy", { description: "Every team the cache Worker serves and who holds its tokens." })
  )
) {}

/**
 * Whether a token of the given access class may perform an operation.
 *
 * **Details**
 *
 * `write` permits everything. `read` permits everything except `upload`: a
 * pull-request job restores artifacts, asks which hashes exist and reports
 * usage events, but never stores an artifact another job would trust.
 *
 * **Example** (Refuse an upload with a read token)
 *
 * ```ts
 * import { permits } from "@beep/infra-turbo-cache/CachePolicy"
 *
 * console.log(permits("read", "download")) // true
 * console.log(permits("read", "upload")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const permits: {
  (operation: ArtifactOperation): (access: Access) => boolean;
  (access: Access, operation: ArtifactOperation): boolean;
} = dual(
  2,
  (access: Access, operation: ArtifactOperation): boolean =>
    Access.is.write(access) || !ArtifactOperation.is.upload(operation)
);

/**
 * A team principal flattened with its team slug, the unit one token is
 * generated for.
 *
 * **Example** (List every token holder)
 *
 * ```ts
 * import { CachePolicy, tokenHolders } from "@beep/infra-turbo-cache/CachePolicy"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownSync(CachePolicy)({
 *   teams: [{ slug: "beep", principals: [{ name: "ci-pr", access: "read", rotation: 1 }] }],
 * })
 * console.log(tokenHolders(policy).map(({ team, principal }) => `${team}/${principal.name}`)) // ["beep/ci-pr"]
 * ```
 *
 * @param policy - The policy whose token holders to list.
 * @returns One entry per principal, with its team slug.
 *
 * @category utilities
 * @since 0.0.0
 */
export const tokenHolders = (
  policy: CachePolicy
): ReadonlyArray<{ readonly team: TeamSlug; readonly principal: Principal }> =>
  pipe(
    policy.teams,
    A.flatMap(({ slug, principals }) => A.map(principals, (principal) => ({ team: slug, principal })))
  );
