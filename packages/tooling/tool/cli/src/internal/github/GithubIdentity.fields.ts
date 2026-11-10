/**
 * Field schemas shared by a selected GitHub identity and a configured one.
 *
 * **Details**
 *
 * `GithubIdentity` (the selected identity) and `ConfiguredGithubIdentity`
 * (an entry of `identities.json`) carry the same reference fields. Both use
 * these schemas, so a pasted raw token fails to decode in either. The module
 * is a leaf: it imports neither identity module, which keeps the two free of
 * an import cycle.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/github/GithubIdentity.fields");

const OpReference = S.String.check(
  S.isPattern(/^op:\/\/[^\s]+$/, {
    identifier: "OpReferencePattern",
    title: "1Password reference",
    description: "An op:// secret reference, never a raw secret.",
    message: "must be an op:// reference, not a raw secret",
  })
);

/**
 * A 1Password reference to a GitHub token.
 *
 * **Example** (Reject a raw token)
 *
 * ```ts
 * import { GithubTokenRef } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubTokenRef)("op://vault/item/token")) // true
 * console.log(S.is(GithubTokenRef)("ghp_raw")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubTokenRef = OpReference.pipe(
  $I.annoteSchema("GithubTokenRef", { description: "An op:// reference to a GitHub token." })
);

/**
 * Type of {@link GithubTokenRef}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubTokenRef = typeof GithubTokenRef.Type;

/**
 * A 1Password reference to a GitHub App private key.
 *
 * **Example** (Accept a key reference)
 *
 * ```ts
 * import { GithubPrivateKeyRef } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubPrivateKeyRef)("op://vault/app/private-key")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubPrivateKeyRef = OpReference.pipe(
  $I.annoteSchema("GithubPrivateKeyRef", { description: "An op:// reference to a GitHub App private key." })
);

/**
 * Type of {@link GithubPrivateKeyRef}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubPrivateKeyRef = typeof GithubPrivateKeyRef.Type;

/**
 * A GitHub App id, as the App settings page shows it.
 *
 * **Example** (Accept an App id)
 *
 * ```ts
 * import { GithubAppId } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubAppId)("123456")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubAppId = S.NonEmptyString.pipe($I.annoteSchema("GithubAppId", { description: "A GitHub App id." }));

/**
 * Type of {@link GithubAppId}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubAppId = typeof GithubAppId.Type;

/**
 * A GitHub App installation id.
 *
 * **Example** (Accept an installation id)
 *
 * ```ts
 * import { GithubInstallationId } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubInstallationId)(42)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubInstallationId = S.Int.pipe(
  $I.annoteSchema("GithubInstallationId", { description: "A GitHub App installation id." })
);

/**
 * Type of {@link GithubInstallationId}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubInstallationId = typeof GithubInstallationId.Type;

/**
 * A GitHub user login: 1 to 39 letters, digits or hyphens, not starting with a hyphen.
 *
 * **Example** (Check a login)
 *
 * ```ts
 * import { GithubLogin } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubLogin)("octocat")) // true
 * console.log(S.is(GithubLogin)("-bad")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubLogin = S.String.check(
  S.isPattern(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/, {
    identifier: "GithubLoginPattern",
    title: "GitHub login",
    description: "A GitHub user login.",
    message: "must be a GitHub login",
  })
).pipe($I.annoteSchema("GithubLogin", { description: "A GitHub user login." }));

/**
 * Type of {@link GithubLogin}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubLogin = typeof GithubLogin.Type;
