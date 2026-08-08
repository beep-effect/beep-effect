/**
 * Branded value objects and literal enumerations shared across the PACER driver.
 *
 * These are the small, dependency-free schema primitives that the auth and PCL
 * models build on: the opaque `NextGenCSO` auth token, the `loginResult` codes
 * returned by the Authentication API, and the PCL `jurisdictionType` codes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PacerId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PacerId.create("pacer/Pacer.tokens");

const NEXT_GEN_CSO_TOKEN_LENGTH = 128;

/**
 * The opaque 128-character PACER `nextGenCSO` authentication token.
 *
 * **Details**
 *
 * Branded so it can never be confused with an ordinary string; the service
 * layer wraps it in a redacted value before it is stored or
 * threaded onto downstream PCL requests.
 *
 * **Example** (Make branded CSO token)
 *
 * ```ts
 * import { NextGenCsoToken } from "@beep/pacer"
 * import * as Str from "effect/String"
 *
 * const token = NextGenCsoToken.make(Str.repeat(128)("Q"))
 * console.log(token.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NextGenCsoToken = S.String.pipe(
  S.check(
    S.isMinLength(NEXT_GEN_CSO_TOKEN_LENGTH, {
      identifier: $I`NextGenCsoTokenMinLengthCheck`,
      title: "NextGenCSO Min Length",
      description: "PACER nextGenCSO tokens must contain exactly 128 characters.",
    }),
    S.isMaxLength(NEXT_GEN_CSO_TOKEN_LENGTH, {
      identifier: $I`NextGenCsoTokenMaxLengthCheck`,
      title: "NextGenCSO Max Length",
      description: "PACER nextGenCSO tokens must contain exactly 128 characters.",
    })
  ),
  S.brand("NextGenCsoToken"),
  $I.annoteSchema("NextGenCsoToken", {
    description: "Opaque PACER nextGenCSO authentication token (128 characters on success).",
  })
);

/**
 * Type for {@link NextGenCsoToken}.
 *
 * **Example** (Annotate token variable type)
 *
 * ```ts
 * import { NextGenCsoToken } from "@beep/pacer"
 * import type { NextGenCsoToken as NextGenCsoTokenType } from "@beep/pacer"
 * import * as Str from "effect/String"
 *
 * const token: NextGenCsoTokenType = NextGenCsoToken.make(Str.repeat(128)("Q"))
 * console.log(token.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NextGenCsoToken = typeof NextGenCsoToken.Type;

/**
 * Documented PACER `loginResult` codes from the Authentication API.
 *
 * **Details**
 *
 * `"0"` = a token was issued (note: a non-empty `errorDescription` can still
 * accompany `"0"` as a non-fatal search-privilege warning); `"1"` = a registered
 * filer omitted the redaction flag; `"13"` = invalid username, password, or OTP.
 * Any non-`"0"` value means authentication failed and `nextGenCSO` is empty.
 *
 * **Example** (Lookup invalid credentials code)
 *
 * ```ts
 * import { LoginResult } from "@beep/pacer"
 *
 * console.log(LoginResult.Enum["13"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LoginResult = LiteralKit(["0", "1", "13"]).pipe(
  $I.annoteSchema("LoginResult", {
    description:
      "Documented PACER cso-auth loginResult codes: 0 ok, 1 redaction-flag missing, 13 invalid credentials/OTP.",
  })
);

/**
 * Type for {@link LoginResult}.
 *
 * **Example** (Annotate login result type)
 *
 * ```ts
 * import { LoginResult } from "@beep/pacer"
 * import type { LoginResult as LoginResultType } from "@beep/pacer"
 *
 * const result: LoginResultType = LoginResult.Enum["0"]
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LoginResult = typeof LoginResult.Type;

/**
 * PCL request `jurisdictionType` codes (lowercase): appellate, bankruptcy,
 * criminal, civil, and multidistrict litigation. Note the PCL *response* spells
 * jurisdiction out (e.g. `"Civil"`), so responses keep a plain string.
 *
 * **Example** (Access civil jurisdiction code)
 *
 * ```ts
 * import { JurisdictionType } from "@beep/pacer"
 *
 * console.log(JurisdictionType.Enum.cv)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JurisdictionType = LiteralKit(["ap", "bk", "cr", "cv", "mdl"]).pipe(
  $I.annoteSchema("JurisdictionType", {
    description: "PCL request jurisdictionType codes: ap, bk, cr, cv, mdl.",
  })
);

/**
 * Type for {@link JurisdictionType}.
 *
 * **Example** (Annotate jurisdiction type)
 *
 * ```ts
 * import { JurisdictionType } from "@beep/pacer"
 * import type { JurisdictionType as JurisdictionTypeType } from "@beep/pacer"
 *
 * const jurisdiction: JurisdictionTypeType = JurisdictionType.Enum.cv
 * console.log(jurisdiction)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JurisdictionType = typeof JurisdictionType.Type;

/**
 * A PCL "full" case number, e.g. `1:2002bk20340`.
 *
 * **Details**
 *
 * Plain `string` at the type level, but it carries a custom `toArbitrary`
 * annotation so any schema-derived generation (`Schema.toArbitrary` for mock
 * bodies and property tests) produces realistic case numbers instead of random
 * unicode — exercising the real shape rather than hardcoded fixtures.
 *
 * **Example** (Make full case number)
 *
 * ```ts
 * import { CaseNumberFull } from "@beep/pacer"
 *
 * const caseNumber = CaseNumberFull.make("1:2002bk20340")
 * console.log(caseNumber)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CaseNumberFull = S.String.pipe(
  $I.annoteSchema("CaseNumberFull", {
    description: "PCL full case number, e.g. 1:2002bk20340.",
  })
).annotate({
  toArbitrary: () => (fc) =>
    fc.constantFrom("1:2002bk20340", "2:2019cv01234", "0:2001ap00100", "3:2020bk00777", "1:2018cr00045"),
});

/**
 * Type for {@link CaseNumberFull}.
 *
 * **Example** (Annotate case number type)
 *
 * ```ts
 * import { CaseNumberFull } from "@beep/pacer"
 * import type { CaseNumberFull as CaseNumberFullType } from "@beep/pacer"
 *
 * const caseNumber: CaseNumberFullType = CaseNumberFull.make("1:2002bk20340")
 * console.log(caseNumber)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CaseNumberFull = typeof CaseNumberFull.Type;

/**
 * Which PACER environment the POC targets. QA is non-billable test data; prod
 * is the real, billable service.
 *
 * **Example** (Access QA environment value)
 *
 * ```ts
 * import { PacerEnvironment } from "@beep/pacer"
 *
 * console.log(PacerEnvironment.Enum.qa)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacerEnvironment = LiteralKit(["qa", "prod"]).pipe(
  $I.annoteSchema("PacerEnvironment", {
    description: "Target PACER environment: qa (non-billable test data) or prod (billable).",
  })
);

/**
 * Type for {@link PacerEnvironment}.
 *
 * **Example** (Annotate environment type)
 *
 * ```ts
 * import { PacerEnvironment } from "@beep/pacer"
 * import type { PacerEnvironment as PacerEnvironmentType } from "@beep/pacer"
 *
 * const environment: PacerEnvironmentType = PacerEnvironment.Enum.qa
 * console.log(environment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PacerEnvironment = typeof PacerEnvironment.Type;

/**
 * Status of a PCL asynchronous batch/download report job.
 *
 * **Example** (Access completed report status)
 *
 * ```ts
 * import { ReportStatus } from "@beep/pacer"
 *
 * console.log(ReportStatus.Enum.COMPLETED)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReportStatus = LiteralKit(["WAITING", "RUNNING", "COMPLETED", "FAILED"]).pipe(
  $I.annoteSchema("ReportStatus", {
    description: "PCL batch report job status: WAITING, RUNNING, COMPLETED, FAILED.",
  })
);

/**
 * Type for {@link ReportStatus}.
 *
 * **Example** (Annotate report status type)
 *
 * ```ts
 * import { ReportStatus } from "@beep/pacer"
 * import type { ReportStatus as ReportStatusType } from "@beep/pacer"
 *
 * const status: ReportStatusType = ReportStatus.Enum.COMPLETED
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReportStatus = typeof ReportStatus.Type;
