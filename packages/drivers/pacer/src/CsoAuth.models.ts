/**
 * Schema-first request/response models for the PACER Authentication API
 * (`/services/cso-auth` and `/services/cso-logout`).
 *
 * NOTE: the Authentication API returns failures as HTTP 200 with a body-level
 * `loginResult` code and an empty `nextGenCSO`, so these are decoded with the
 * lower-level `effect/unstable/http` client (not `httpapi`) and branched on in
 * the service layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PacerId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PacerId.create("pacer/auth/CsoAuth.models");

/**
 * `cso-auth` login request body.
 *
 * **Details**
 *
 * `clientCode` is optional billing/matter attribution; `otpCode` is required
 * only when the account is MFA-enrolled; `redactFlag` (`"1"`) is required only
 * for registered filers.
 *
 * **Example** (Construct login request body)
 *
 * ```ts
 * import { CsoAuthRequest } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const request = CsoAuthRequest.make({ loginId: "qa-user", password: "secret", clientCode: O.none(), otpCode: O.none(), redactFlag: O.none() })
 * console.log(request.loginId)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CsoAuthRequest extends S.Class<CsoAuthRequest>($I`CsoAuthRequest`)(
  {
    loginId: S.String,
    password: S.String,
    clientCode: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    otpCode: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    redactFlag: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CsoAuthRequest", {
    description: "PACER cso-auth login request body.",
  })
) {}

/**
 * `cso-auth` login response body.
 *
 * **Details**
 *
 * `loginResult` `"0"` means a token was issued; `nextGenCSO` is empty on
 * failure; `errorDescription` is `""` on clean success, otherwise a warning or
 * error message.
 *
 * **Example** (Construct login response body)
 *
 * ```ts
 * import { CsoAuthResponse } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const response = CsoAuthResponse.make({ nextGenCSO: "token", loginResult: "0", errorDescription: O.none() })
 * console.log(response.loginResult)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CsoAuthResponse extends S.Class<CsoAuthResponse>($I`CsoAuthResponse`)(
  {
    nextGenCSO: S.String,
    loginResult: S.String,
    errorDescription: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CsoAuthResponse", {
    description: "PACER cso-auth login response body.",
  })
) {}

/**
 * `cso-logout` request body — the token to invalidate.
 *
 * **Example** (Construct logout request body)
 *
 * ```ts
 * import { CsoLogoutRequest } from "@beep/pacer"
 *
 * const request = CsoLogoutRequest.make({ nextGenCSO: "token" })
 * console.log(request.nextGenCSO)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CsoLogoutRequest extends S.Class<CsoLogoutRequest>($I`CsoLogoutRequest`)(
  {
    nextGenCSO: S.String,
  },
  $I.annote("CsoLogoutRequest", {
    description: "PACER cso-logout request body.",
  })
) {}

/**
 * `cso-logout` response body.
 *
 * **Example** (Construct logout response body)
 *
 * ```ts
 * import { CsoLogoutResponse } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const response = CsoLogoutResponse.make({ loginResult: O.some("0"), errorDescription: O.none(), nextGenCSO: O.none() })
 * console.log(response.loginResult)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CsoLogoutResponse extends S.Class<CsoLogoutResponse>($I`CsoLogoutResponse`)(
  {
    loginResult: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    errorDescription: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    nextGenCSO: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CsoLogoutResponse", {
    description: "PACER cso-logout response body.",
  })
) {}
