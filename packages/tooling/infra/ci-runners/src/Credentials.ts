/**
 * The GitHub App credentials the fleet writes to its SSM parameters, read
 * from the environment and never from source.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { placeholderWebhookSecret } from "@beep/alchemy-github-runners/Webhook.program";
import { $InfraCiRunnersId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { productionStage, rehearsalRepository } from "./Config.ts";

const $I = $InfraCiRunnersId.create("Credentials");

/**
 * The App id, base64 private key and webhook secret of the fleet.
 *
 * **Details**
 *
 * The composite writes each as a SecureString parameter under the fleet's
 * own KMS key. Values stay `Redacted` from the environment to the
 * parameter; they never reach a log, a plan or an output.
 *
 * **Example** (Build placeholder credentials)
 *
 * ```ts
 * import { AppCredentials } from "@beep/infra-ci-runners/Credentials"
 * import * as Redacted from "effect/Redacted"
 *
 * const credentials = AppCredentials.make({
 *   id: Redacted.make("1"),
 *   keyBase64: Redacted.make("a2V5"),
 *   webhookSecret: Redacted.make("s"),
 * })
 * console.log(String(credentials.id)) // "<redacted>"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppCredentials extends S.Opaque<AppCredentials, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Redacted(S.String),
    keyBase64: S.Redacted(S.String),
    webhookSecret: S.Redacted(S.String),
  }).pipe($I.annoteSchema("AppCredentials", { description: "GitHub App id, key and webhook secret of the fleet." }))
) {}

/**
 * Environment variables that carry the App credentials.
 *
 * **Details**
 *
 * In CI they are secrets of the `ci-runners-prod` GitHub environment. On a
 * workstation they come only through `op run` from `op://` references; a
 * personal stage without them gets {@link placeholderCredentials}.
 *
 * **Example** (Read the variable names)
 *
 * ```ts
 * import { appCredentialVariables } from "@beep/infra-ci-runners/Credentials"
 *
 * console.log(appCredentialVariables.id) // "CI_RUNNERS_GITHUB_APP_ID"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const appCredentialVariables = {
  id: "CI_RUNNERS_GITHUB_APP_ID",
  keyBase64: "CI_RUNNERS_GITHUB_APP_KEY_BASE64",
  webhookSecret: "CI_RUNNERS_GITHUB_WEBHOOK_SECRET",
} as const;

/**
 * Placeholder App credentials for a stage that has none.
 *
 * **Details**
 *
 * A personal stage without a rehearsal writes these: scale-up cannot mint
 * an installation token, and the webhook answers every delivery with 401,
 * because `verifySignature` refuses the placeholder secret
 * (`placeholderWebhookSecret`) even for a payload signed with it. The empty
 * allow list and the zero pool caps fence the stage a second time.
 *
 * **Example** (Read a placeholder)
 *
 * ```ts
 * import { placeholderCredentials } from "@beep/infra-ci-runners/Credentials"
 * import * as Redacted from "effect/Redacted"
 *
 * console.log(Redacted.value(placeholderCredentials.id)) // "unset"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const placeholderCredentials = AppCredentials.make({
  id: Redacted.make("unset"),
  keyBase64: Redacted.make("unset"),
  webhookSecret: Redacted.make(placeholderWebhookSecret),
});

// A real credential: neither blank (GitHub Actions passes an unset secret as "") nor the placeholder.
const RealCredential = S.String.check(
  S.makeFilter((value: string) => Str.isNonEmpty(Str.trim(value)) && value !== placeholderWebhookSecret, {
    message: "Expected a real credential: an empty value or the placeholder is refused",
  })
).pipe($I.annoteSchema("RealCredential", { description: "A credential that is neither blank nor the placeholder." }));

const realCredential = (name: string) => Config.schema(S.Redacted(RealCredential), name);

/**
 * Read the App credentials from the environment.
 *
 * **Details**
 *
 * Each value must be real: an empty value, which GitHub Actions passes for
 * an unset secret, or the placeholder `unset` fails with a `ConfigError`
 * before any resource is declared, so a fleet never stores a secret that
 * would refuse every delivery. Only the blank or placeholder value can fail
 * this check, and neither is a secret.
 *
 * **Example** (Reference the config)
 *
 * ```ts
 * import { appCredentials } from "@beep/infra-ci-runners/Credentials"
 *
 * console.log(typeof appCredentials) // "object"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const appCredentials = Config.all({
  id: realCredential(appCredentialVariables.id),
  keyBase64: realCredential(appCredentialVariables.keyBase64),
  webhookSecret: realCredential(appCredentialVariables.webhookSecret),
}).pipe(Config.map(AppCredentials.make));

/**
 * The credentials of a stage.
 *
 * **Details**
 *
 * `prod`, and a personal stage with a rehearsal repository, require all
 * three variables; a personal stage without one ignores the environment and
 * takes {@link placeholderCredentials}, so a stray variable on a workstation
 * can never put real credentials into a personal fleet.
 *
 * **Example** (A personal stage without a rehearsal)
 *
 * ```ts
 * import { stageCredentials } from "@beep/infra-ci-runners/Credentials"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 *
 * const credentials = Effect.runSync(stageCredentials("dev-alice"))
 * console.log(Redacted.value(credentials.webhookSecret)) // "unset"
 * ```
 *
 * @param stage - The Alchemy stage.
 * @returns The credentials, or a `ConfigError` when real ones are missing.
 * @category configuration
 * @since 0.0.0
 */
export const stageCredentials = Effect.fn("CiRunners.stageCredentials")(function* (stage: string) {
  const rehearsal = stage === productionStage ? O.none() : yield* rehearsalRepository;
  return stage === productionStage || O.isSome(rehearsal) ? yield* appCredentials : placeholderCredentials;
});
