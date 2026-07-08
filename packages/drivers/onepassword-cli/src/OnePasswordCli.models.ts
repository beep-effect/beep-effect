/**
 * Data models for the 1Password CLI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OnepasswordCliId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference";
import * as S from "effect/Schema";

const $I = $OnepasswordCliId.create("OnePasswordCli.models");
const OnePasswordReferenceProbeStatusBase = LiteralKit(["resolved", "missing"]);
const withProbeStatusDecodeOption = SchemaUtils.withStatics((schema: typeof OnePasswordReferenceProbeStatusBase) => ({
  decodeOption: S.decodeUnknownOption(schema),
}));

const OnePasswordCliAccountName = S.Trim.pipe(
  $I.annoteSchema("OnePasswordCliAccountName", {
    description: "Trimmed 1Password account name reported by `op whoami`.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * 1Password reference probe status.
 *
 * @example
 * ```ts
 * import { OnePasswordReferenceProbeStatus } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * console.log(OnePasswordReferenceProbeStatus)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OnePasswordReferenceProbeStatus = OnePasswordReferenceProbeStatusBase.pipe(
  $I.annoteSchema("OnePasswordReferenceProbeStatus", {
    description: "Product-neutral 1Password secret-reference probe status.",
  }),
  SchemaUtils.withLiteralKitStatics(OnePasswordReferenceProbeStatusBase),
  withProbeStatusDecodeOption
);

/**
 * Runtime type for {@link OnePasswordReferenceProbeStatus}.
 *
 * @example
 * ```ts
 * import { OnePasswordReferenceProbeStatus } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * const status: OnePasswordReferenceProbeStatus = "resolved"
 * console.log(OnePasswordReferenceProbeStatus.is.resolved(status))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OnePasswordReferenceProbeStatus = typeof OnePasswordReferenceProbeStatus.Type;

/**
 * Process exit status accepted from the native 1Password CLI.
 *
 * @example
 * ```ts
 * import { OnePasswordCliExitCode } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * const exitCode = OnePasswordCliExitCode.make(0)
 *
 * console.log(exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OnePasswordCliExitCode = S.Int.check(S.isBetween({ minimum: 0, maximum: 255 })).pipe(
  $I.annoteSchema("OnePasswordCliExitCode", {
    description: "Integer process exit status in the conventional 0-255 CLI range.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link OnePasswordCliExitCode}.
 *
 * @example
 * ```ts
 * import type { OnePasswordCliExitCode } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * const exitCode: OnePasswordCliExitCode = 0
 *
 * console.log(exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OnePasswordCliExitCode = typeof OnePasswordCliExitCode.Type;

/**
 * Trim-normalized redacted CLI diagnostic text.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { OnePasswordCliDiagnosticText } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * const diagnostic = Result.getOrThrow(
 *   S.decodeUnknownResult(OnePasswordCliDiagnosticText)(" not signed in\n")
 * )
 *
 * console.log(diagnostic) // "not signed in"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OnePasswordCliDiagnosticText = S.Trim.pipe(
  $I.annoteSchema("OnePasswordCliDiagnosticText", {
    description: "Trim-normalized redacted stdout or stderr text used for diagnostics.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link OnePasswordCliDiagnosticText}.
 *
 * @example
 * ```ts
 * import type { OnePasswordCliDiagnosticText } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * const diagnostic: OnePasswordCliDiagnosticText = "not signed in"
 *
 * console.log(diagnostic)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OnePasswordCliDiagnosticText = typeof OnePasswordCliDiagnosticText.Type;

/**
 * Process output captured by a 1Password CLI command.
 *
 * @example
 * ```ts
 * import { OnePasswordCliProcessResult } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * console.log(OnePasswordCliProcessResult)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OnePasswordCliProcessResult extends S.Class<OnePasswordCliProcessResult>($I`OnePasswordCliProcessResult`)(
  {
    exitCode: OnePasswordCliExitCode.annotateKey({
      description: "1Password CLI process exit status.",
    }),
    stderr: S.String.annotateKey({
      description: "Raw standard error captured from the 1Password CLI command.",
    }),
    stdout: S.String.annotateKey({
      description: "Raw standard output captured from the 1Password CLI command; secret reads keep this exact.",
    }),
  },
  $I.annote("OnePasswordCliProcessResult", {
    description: "Stdout, stderr, and exit code captured from a 1Password CLI command.",
  })
) {}

/**
 * 1Password account/session probe result.
 *
 * @example
 * ```ts
 * import { OnePasswordCliAccount } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * console.log(OnePasswordCliAccount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OnePasswordCliAccount extends S.Class<OnePasswordCliAccount>($I`OnePasswordCliAccount`)(
  {
    account: S.OptionFromOptionalKey(OnePasswordCliAccountName).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Trimmed account identifier reported by `op whoami`, when signed in.",
    }),
    signedIn: S.Boolean.annotateKey({
      description: "Whether the 1Password CLI reports an active signed-in account.",
    }),
  },
  $I.annote("OnePasswordCliAccount", {
    description: "Redacted 1Password CLI session status.",
  })
) {}

/**
 * Secret-reference validation result that does not expose the secret.
 *
 * @example
 * ```ts
 * import { OnePasswordReferenceProbe } from "@beep/onepassword-cli/OnePasswordCli.models"
 *
 * console.log(OnePasswordReferenceProbe)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OnePasswordReferenceProbe extends S.Class<OnePasswordReferenceProbe>($I`OnePasswordReferenceProbe`)(
  {
    byteLength: NonNegativeInt.annotateKey({
      description: "Resolved secret byte length, without exposing the secret value.",
    }),
    reference: OnePasswordReference.annotateKey({
      description: "Validated op:// secret reference that was probed.",
    }),
    status: OnePasswordReferenceProbeStatus.annotateKey({
      description: "Redacted probe status for the 1Password secret reference.",
    }),
  },
  $I.annote("OnePasswordReferenceProbe", {
    description: "1Password secret-reference probe result with only redacted metadata.",
  })
) {}
