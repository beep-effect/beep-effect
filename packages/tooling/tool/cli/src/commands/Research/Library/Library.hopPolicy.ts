/**
 * Typed hop-2 admission policy values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Research/Library/Library.hopPolicy");

/**
 * Typed hop-2 admission policy values.
 *
 * **Details**
 *
 * Policy, not catalog schema: changing a value re-runs `acquire` without touching recorded
 * identities, which are catalogued at every hop regardless.
 *
 * **Example** (Read the default domain cap)
 *
 * ```ts
 * import { LibraryHopPolicy } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryHopPolicy.make({}).domainCap) // 25
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class LibraryHopPolicy extends S.Opaque<LibraryHopPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    domainCap: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(25)),
      S.withDecodingDefaultTypeKey(Effect.succeed(25))
    ),
    liveGoalStatuses: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(["active", "paused"])),
      S.withDecodingDefaultTypeKey(Effect.succeed(["active", "paused"]))
    ),
    closedExplorationStatuses: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(["parked", "killed", "graduated"])),
      S.withDecodingDefaultTypeKey(Effect.succeed(["parked", "killed", "graduated"]))
    ),
    githubTransitive: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("LibraryHopPolicy", {
      description: "Hop-2 admission policy: per-domain cap, live packet statuses and the GitHub transitivity rule.",
    })
  )
) {}
