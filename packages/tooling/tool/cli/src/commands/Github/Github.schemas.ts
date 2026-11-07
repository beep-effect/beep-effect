/**
 * GitHub App registration manifest and manifest-conversion schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Github/Github.schemas");

/**
 * The webhook block of a GitHub App manifest.
 *
 * **Example** (Describe a disabled webhook)
 *
 * ```ts
 * import { GitHubAppManifestHook } from "@beep/repo-cli/commands/Github"
 *
 * const hook = GitHubAppManifestHook.make({ url: "https://example.invalid/hook", active: false })
 * console.log(hook.active) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GitHubAppManifestHook extends S.Opaque<GitHubAppManifestHook, { readonly brand: unique symbol }>()(
  S.Struct({ url: S.String, active: S.Boolean }).pipe(
    $I.annoteSchema("GitHubAppManifestHook", { description: "The webhook block of a GitHub App manifest." })
  )
) {}

/**
 * A repository permission level granted by a GitHub App manifest.
 *
 * **Example** (Recognize a read grant)
 *
 * ```ts
 * import { GitHubAppPermissionLevel } from "@beep/repo-cli/commands/Github"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GitHubAppPermissionLevel)("read")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GitHubAppPermissionLevel = S.Literals(["read", "write"]).pipe(
  $I.annoteSchema("GitHubAppPermissionLevel", {
    description: "A repository permission level granted by a GitHub App manifest.",
  })
);

/**
 * Decoded GitHubAppPermissionLevel value.
 *
 * @category models
 * @since 0.0.0
 */
export type GitHubAppPermissionLevel = typeof GitHubAppPermissionLevel.Type;

/**
 * The GitHub App manifest posted to the organization registration page.
 *
 * **Details**
 *
 * The checked-in manifest JSON is decoded against this schema before it is
 * printed or posted, so a malformed policy file fails before any browser handoff.
 *
 * **Example** (Decode a manifest)
 *
 * ```ts
 * import { GitHubAppManifest } from "@beep/repo-cli/commands/Github"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(GitHubAppManifest)
 * const program = decode({
 *   name: "beep-reviewer",
 *   url: "https://github.com/beep-effect/beep-effect",
 *   description: "Review checks",
 *   public: false,
 *   redirect_url: "http://localhost:8787/callback",
 *   hook_attributes: { url: "https://example.invalid/hook", active: false },
 *   default_events: [],
 *   default_permissions: { metadata: "read" },
 * })
 * console.log(typeof program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GitHubAppManifest extends S.Opaque<GitHubAppManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    url: S.NonEmptyString,
    description: S.String,
    public: S.Boolean,
    redirect_url: S.NonEmptyString,
    hook_attributes: GitHubAppManifestHook,
    default_events: S.Array(S.String),
    default_permissions: S.Record(S.String, GitHubAppPermissionLevel),
  }).pipe(
    $I.annoteSchema("GitHubAppManifest", {
      description: "The GitHub App manifest posted to the organization registration page.",
    })
  )
) {}

/**
 * The credential payload GitHub returns when a manifest code is converted.
 *
 * **Details**
 *
 * `pem` decodes into a `Redacted` value so the private key never renders. `slug`
 * is optional because only some Apps record it in the vault item.
 *
 * **Example** (Decode a conversion)
 *
 * ```ts
 * import { GitHubAppManifestConversion } from "@beep/repo-cli/commands/Github"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(GitHubAppManifestConversion)({
 *   id: 1,
 *   client_id: "client",
 *   pem: "placeholder",
 * })
 * console.log(typeof program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GitHubAppManifestConversion extends S.Opaque<
  GitHubAppManifestConversion,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    id: S.Int,
    slug: S.optionalKey(S.NonEmptyString),
    client_id: S.NonEmptyString,
    pem: S.RedactedFromValue(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("GitHubAppManifestConversion", {
      description: "The credential payload GitHub returns when a manifest code is converted.",
    })
  )
) {}

/**
 * The outcome of one registration callback, safe to show: no credential, payload, or exception text.
 *
 * **Example** (Match a conversion failure)
 *
 * ```ts
 * import { GitHubAppRegistrationOutcome } from "@beep/repo-cli/commands/Github"
 *
 * const outcome = GitHubAppRegistrationOutcome.cases.ConversionFailed.make({ status: 422 })
 * console.log(GitHubAppRegistrationOutcome.guards.ConversionFailed(outcome)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GitHubAppRegistrationOutcome = S.TaggedUnion({
  Stored: { slug: S.Option(S.String), appId: S.Int },
  ConversionFailed: { status: S.Int },
  StoreFailed: { slug: S.Option(S.String), exitCode: S.Int },
  Failed: {},
}).pipe(
  $I.annoteSchema("GitHubAppRegistrationOutcome", {
    description: "The outcome of one registration callback, safe to show without credential material.",
  })
);

/**
 * Decoded GitHubAppRegistrationOutcome value.
 *
 * @category models
 * @since 0.0.0
 */
export type GitHubAppRegistrationOutcome = typeof GitHubAppRegistrationOutcome.Type;
