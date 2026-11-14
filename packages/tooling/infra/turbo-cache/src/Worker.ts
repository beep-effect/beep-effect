/**
 * The repository's cache Worker: the `beep` team's policy bound to
 * {@link turboCache}. Alchemy bundles this module as the Worker, so its
 * default export is the Worker resource.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CachePolicy, Principal, Team } from "./CachePolicy.ts";
import { TurboCacheOptions, turboCache } from "./TurboCache.ts";

/**
 * Logical id prefix of every resource in the `TurboCache` stack.
 *
 * **Example** (Read the prefix)
 *
 * ```ts
 * import { resourceNamePrefix } from "@beep/infra-turbo-cache/Worker"
 *
 * console.log(resourceNamePrefix) // "TurboCache"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const resourceNamePrefix = "TurboCache";

/**
 * Days an artifact lives before R2 expires it; the AWS cache kept 30.
 *
 * **Example** (Read the retention)
 *
 * ```ts
 * import { retentionDays } from "@beep/infra-turbo-cache/Worker"
 *
 * console.log(retentionDays) // 30
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const retentionDays = 30;

/**
 * Who holds a token for the repository's cache.
 *
 * **Details**
 *
 * One team, `beep`. `ci-main` writes from protected `main` pushes (its token
 * lives only in the `turbo-cache-write` GitHub environment); `ci-pr` reads
 * from same-repository pull requests (a repository secret, which GitHub never
 * exposes to fork pull requests, so forks stay local-only). `dankstation` and
 * `beep-worker` are the named trusted workstations that write. Adding a holder
 * is one entry here and a `main` deploy; raising a `rotation` replaces that
 * holder's token.
 *
 * **Example** (List the writers)
 *
 * ```ts
 * import { cachePolicy } from "@beep/infra-turbo-cache/Worker"
 *
 * const writers = cachePolicy.teams[0].principals.filter(({ access }) => access === "write")
 * console.log(writers.map(({ name }) => name)) // ["ci-main", "dankstation", "beep-worker"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const cachePolicy = CachePolicy.make({
  teams: [
    Team.make({
      slug: "beep",
      principals: [
        Principal.make({ name: "ci-main", access: "write", rotation: 1 }),
        Principal.make({ name: "ci-pr", access: "read", rotation: 1 }),
        Principal.make({ name: "dankstation", access: "write", rotation: 1 }),
        Principal.make({ name: "beep-worker", access: "write", rotation: 1 }),
      ],
    }),
  ],
});

/**
 * The cache Worker resource.
 *
 * **Example** (Yield the Worker in a stack)
 *
 * ```ts
 * import CacheWorker from "@beep/infra-turbo-cache/Worker"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const worker = yield* CacheWorker
 *   return worker.url
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default turboCache(
  TurboCacheOptions.make({ main: import.meta.url, policy: cachePolicy, resourceNamePrefix, retentionDays })
);
