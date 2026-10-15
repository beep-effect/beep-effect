/**
 * Typed errors for the Windows secret store driver.
 *
 * **Details**
 *
 * No error carries a secret value: failures report the operation, the Win32
 * error code and a fixed reason; size failures report only byte counts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WindowsSecretsId } from "@beep/identity";
import * as S from "effect/Schema";
import { SecretStoreOperation, SecretTarget } from "./WindowsSecrets.models.ts";

const $I = $WindowsSecretsId.create("WindowsSecrets.errors");

/**
 * Credential Manager or DPAPI call that returned failure.
 *
 * **Details**
 *
 * `code` is the Win32 `GetLastError` value read right after the failing call.
 * Bun may run code between the call and the read, so treat the code as a
 * diagnostic hint rather than a contract.
 *
 * **Example** (Construct a read failure)
 *
 * ```ts
 * import { SecretStoreFailure } from "@beep/windows-secrets/WindowsSecrets.errors"
 *
 * const error = SecretStoreFailure.make({ operation: "read", code: 5, reason: "CredReadW returned failure." })
 *
 * console.log(error.message) // "Windows secret store read failed (Win32 error 5): CredReadW returned failure."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SecretStoreFailure extends S.TaggedError<SecretStoreFailure, { readonly brand: unique symbol }>(
  $I`SecretStoreFailure`
)(
  "SecretStoreFailure",
  {
    operation: SecretStoreOperation.annotateKey({
      description: "Secret store operation that failed.",
    }),
    code: S.Int.annotateKey({
      description: "Win32 GetLastError code observed after the failing call.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Fixed human-readable failure summary; never contains secret material.",
    }),
  },
  $I.annoteError<SecretStoreFailure>("SecretStoreFailure", {
    description: "A Windows Credential Manager or DPAPI call failed.",
  })
) {
  override get message() {
    return `Windows secret store ${this.operation} failed (Win32 error ${this.code}): ${this.reason}`;
  }
}

/**
 * Secret value whose UTF-16LE encoding exceeds the Credential Manager blob cap.
 *
 * **Details**
 *
 * `limit` is always 2,560 bytes (`CRED_MAX_CREDENTIAL_BLOB_SIZE`). Callers
 * store larger values as DPAPI-protected files instead.
 *
 * **Example** (Construct a size failure)
 *
 * ```ts
 * import { SecretTooLarge } from "@beep/windows-secrets/WindowsSecrets.errors"
 * import { SecretTarget } from "@beep/windows-secrets/WindowsSecrets.models"
 *
 * const error = SecretTooLarge.make({ target: SecretTarget.make("beep/m365/token-cache"), bytes: 4096, limit: 2560 })
 *
 * console.log(error.bytes) // 4096
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SecretTooLarge extends S.TaggedError<SecretTooLarge, { readonly brand: unique symbol }>(
  $I`SecretTooLarge`
)(
  "SecretTooLarge",
  {
    target: SecretTarget.annotateKey({
      description: "Credential Manager target the value was meant for.",
    }),
    bytes: S.Int.annotateKey({
      description: "UTF-16LE byte length of the rejected value.",
    }),
    limit: S.Int.annotateKey({
      description: "Credential Manager blob cap in bytes.",
    }),
  },
  $I.annoteError<SecretTooLarge>("SecretTooLarge", {
    description: "A secret value exceeds the Windows Credential Manager blob cap.",
  })
) {
  override get message() {
    return `Secret for '${this.target}' is ${this.bytes} bytes; Credential Manager accepts at most ${this.limit}.`;
  }
}

/**
 * Live Windows secret store requested on a host that is not Windows.
 *
 * **Example** (Construct an unsupported-platform failure)
 *
 * ```ts
 * import { SecretStoreUnsupported } from "@beep/windows-secrets/WindowsSecrets.errors"
 *
 * const error = SecretStoreUnsupported.make({ platform: "linux" })
 *
 * console.log(error.message) // "The Windows secret store is unavailable on platform 'linux'."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SecretStoreUnsupported extends S.TaggedError<SecretStoreUnsupported, { readonly brand: unique symbol }>(
  $I`SecretStoreUnsupported`
)(
  "SecretStoreUnsupported",
  {
    platform: S.NonEmptyString.annotateKey({
      description: "`process.platform` of the host that requested the live layer.",
    }),
  },
  $I.annoteError<SecretStoreUnsupported>("SecretStoreUnsupported", {
    description: "The live Windows secret store layer was built on a non-Windows host.",
  })
) {
  override get message() {
    return `The Windows secret store is unavailable on platform '${this.platform}'.`;
  }
}
