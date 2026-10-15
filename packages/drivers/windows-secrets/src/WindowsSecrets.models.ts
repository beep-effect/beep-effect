/**
 * Data models for the Windows secret store driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WindowsSecretsId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $WindowsSecretsId.create("WindowsSecrets.models");
const SecretStoreOperationBase = LiteralKit(["read", "write", "delete", "protect", "unprotect"]);

/**
 * Credential Manager target name owned by beep, shaped `beep/<provider>/<key>`.
 *
 * **Details**
 *
 * Both segments are lowercase kebab-case (`a-z`, `0-9`, single hyphens
 * between words). The target is not secret: it names the credential and may
 * appear in spans, logs and errors.
 *
 * **Example** (Decode a target name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SecretTarget } from "@beep/windows-secrets/WindowsSecrets.models"
 *
 * const target = SecretTarget.make("beep/m365/refresh-token")
 *
 * console.log(target) // "beep/m365/refresh-token"
 * console.log(S.is(SecretTarget)("beep/M365/token")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SecretTarget = S.String.check(
  S.isPattern(/^beep\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/u, {
    identifier: $I`SecretTargetCheck`,
    title: "Secret Target",
    description: "A beep/<provider>/<key> Credential Manager target with lowercase kebab-case segments.",
    message: "Secret targets must match beep/<provider>/<key> with lowercase kebab-case segments",
  })
).pipe(
  S.brand("SecretTarget"),
  $I.annoteSchema("SecretTarget", {
    description: "Windows Credential Manager target name for a beep-owned secret.",
  })
);

/**
 * Runtime type for {@link SecretTarget}.
 *
 * **Example** (Annotate a target)
 *
 * ```ts
 * import { SecretTarget } from "@beep/windows-secrets/WindowsSecrets.models"
 *
 * const target: SecretTarget = SecretTarget.make("beep/box/access-token")
 *
 * console.log(target) // "beep/box/access-token"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SecretTarget = typeof SecretTarget.Type;

/**
 * Secret store operation that a {@link SecretStoreFailure} reports.
 *
 * **Example** (Check an operation name)
 *
 * ```ts
 * import { SecretStoreOperation } from "@beep/windows-secrets/WindowsSecrets.models"
 *
 * console.log(SecretStoreOperation.is.protect("protect")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SecretStoreOperation = SecretStoreOperationBase.pipe(
  $I.annoteSchema("SecretStoreOperation", {
    description: "Credential Manager or DPAPI operation performed by the Windows secret store.",
  }),
  SchemaUtils.withLiteralKitStatics(SecretStoreOperationBase)
);

/**
 * Runtime type for {@link SecretStoreOperation}.
 *
 * **Example** (Annotate an operation)
 *
 * ```ts
 * import type { SecretStoreOperation } from "@beep/windows-secrets/WindowsSecrets.models"
 *
 * const operation: SecretStoreOperation = "read"
 *
 * console.log(operation) // "read"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SecretStoreOperation = typeof SecretStoreOperation.Type;

/**
 * Largest credential blob, in bytes, that Windows Credential Manager accepts.
 *
 * **Details**
 *
 * This is `CRED_MAX_CREDENTIAL_BLOB_SIZE` (5 * 512). Values are stored as
 * UTF-16LE, so the cap is 1,280 UTF-16 code units. Larger values belong in a
 * DPAPI-protected file.
 *
 * **Example** (Compare an encoded size)
 *
 * ```ts
 * import { CredentialBlobMaxBytes } from "@beep/windows-secrets/WindowsSecrets.models"
 *
 * console.log(CredentialBlobMaxBytes) // 2560
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CredentialBlobMaxBytes = 2560;
