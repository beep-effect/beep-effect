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
 * Reserved and placeholder host names whose hop-2 URLs carry no content.
 *
 * **Details**
 *
 * Each entry matches the host itself and every subdomain of it, so `example` covers
 * `a.example` and `test` covers `site.test`. The list holds the RFC 2606 / RFC 6761
 * documentation and special-use names: `example.com`, `example.org`, `example.net`, the
 * `example`, `invalid`, `test` and `localhost` top-level names. Literal IPv4 and IPv6 hosts
 * are refused by the gate as a fixed rule, outside this list.
 *
 * **Example** (Read the reserved hosts)
 *
 * ```ts
 * import { LibraryHopNonContentHosts } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryHopNonContentHosts.includes("localhost")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LibraryHopNonContentHosts: ReadonlyArray<string> = [
  "example.com",
  "example.org",
  "example.net",
  "example",
  "invalid",
  "test",
  "localhost",
];

/**
 * Static-asset and media path extensions whose hop-2 URLs are refused as non-content.
 *
 * **Details**
 *
 * Matched case-insensitively against the last `.`-suffix of the URL path, so
 * `bundle.tar.gz` matches `gz`. Images, stylesheets, scripts, fonts, audio, video and
 * archives are files a page embeds or links for download, not readable sources.
 *
 * **Example** (Read the asset extensions)
 *
 * ```ts
 * import { LibraryHopNonContentExtensions } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryHopNonContentExtensions.includes("png")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LibraryHopNonContentExtensions: ReadonlyArray<string> = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "ico",
  "css",
  "js",
  "woff",
  "woff2",
  "ttf",
  "mp4",
  "mp3",
  "webm",
  "zip",
  "tar",
  "gz",
];

/**
 * Typed hop-2 admission policy values.
 *
 * **Details**
 *
 * Policy, not catalog schema: changing a value re-runs `acquire` without touching recorded
 * identities, which are catalogued at every hop regardless. `hop2Limit` is the global
 * budget of acquired hop-2 sources, already-captured ones included; `nonContentHosts` and
 * `nonContentExtensions` default to {@link LibraryHopNonContentHosts} and
 * {@link LibraryHopNonContentExtensions}.
 *
 * **Example** (Read the default caps)
 *
 * ```ts
 * import { LibraryHopPolicy } from "@beep/repo-cli/commands/Research"
 *
 * const policy = LibraryHopPolicy.make({})
 * console.log(policy.domainCap, policy.hop2Limit) // 25 400
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
    hop2Limit: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(400)),
      S.withDecodingDefaultTypeKey(Effect.succeed(400))
    ),
    nonContentHosts: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(LibraryHopNonContentHosts)),
      S.withDecodingDefaultTypeKey(Effect.succeed(LibraryHopNonContentHosts))
    ),
    nonContentExtensions: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(LibraryHopNonContentExtensions)),
      S.withDecodingDefaultTypeKey(Effect.succeed(LibraryHopNonContentExtensions))
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
      description:
        "Hop-2 admission policy: per-domain cap, global hop-2 budget, non-content hosts and extensions, live packet statuses and the GitHub transitivity rule.",
    })
  )
) {}
