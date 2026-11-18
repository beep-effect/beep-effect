/**
 * The GitHub App credentials the fleet writes to its SSM parameters, read
 * from the environment and never from source.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { AppSigningKey, appKeyCanSign } from "@beep/alchemy-github-runners/GitHubApp.layer";
import { placeholderWebhookSecret } from "@beep/alchemy-github-runners/Webhook.program";
import { $InfraCiRunnersId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
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

/**
 * The fewest characters a webhook secret may have. A secret generated from
 * a random source in the hex alphabet (16 symbols, 4 bits each) carries 128
 * bits at this length, and the wider alphabets the check admits carry more.
 * The check cannot measure entropy: it refuses values that are short, use
 * other characters, repeat few characters or hold the placeholder, and the
 * 128 bits assume the secret was generated, as GitHub and `openssl rand`
 * generate one.
 *
 * **Example** (128 bits as hex)
 *
 * ```ts
 * import { minimumWebhookSecretLength } from "@beep/infra-ci-runners/Credentials"
 *
 * console.log(minimumWebhookSecretLength * 4) // 128
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const minimumWebhookSecretLength = 32;

// The required format: hex, base64 or base64url, the alphabets `openssl rand -hex|-base64` and GitHub generate.
const secretAlphabet = /^[A-Za-z0-9+/=_-]+$/u;

// A random 32-character secret from even the hex alphabet shows at least 10 distinct characters with near
// certainty; fewer means a pattern ("unset" repeated, a run of one character), not a random value.
const minimumDistinctCharacters = 10;

// Failure messages name the problem only, never the value or its length.
const WebhookSecret = S.String.check(
  S.makeFilter((value: string) => !Str.includes(placeholderWebhookSecret)(Str.toLowerCase(value)), {
    message: "webhook secret is a placeholder",
  }),
  S.makeFilter((value: string) => secretAlphabet.test(value), {
    message: "webhook secret has characters outside [A-Za-z0-9+/=_-]",
  }),
  S.makeFilter(
    (value: string) =>
      value.length >= minimumWebhookSecretLength &&
      HashSet.size(HashSet.fromIterable(value)) >= minimumDistinctCharacters,
    { message: "webhook secret too weak" }
  )
).pipe(
  $I.annoteSchema("WebhookSecret", {
    description: "A generated webhook secret: hex, base64 or base64url, at least 32 characters.",
  })
);

const pemPrivateKey =
  /^-----BEGIN (?:RSA |EC )?PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END (?:RSA |EC )?PRIVATE KEY-----\s*$/u;

// A 2048-bit RSA key in PEM is about 1,700 characters; anything under 1,000 is not a usable App key.
const minimumPemLength = 1000;

const isPemPrivateKey = (base64: string): boolean =>
  Result.match(Base64.decodeString(Str.trim(base64)), {
    onFailure: () => false,
    onSuccess: (pem) => pem.length >= minimumPemLength && pemPrivateKey.test(pem),
  });

const AppKeyBase64 = S.String.check(
  S.makeFilter(isPemPrivateKey, { message: "App key is not a PEM private key" })
).pipe($I.annoteSchema("AppKeyBase64", { description: "A base64-encoded PEM private key." }));

const AppId = S.String.check(
  S.makeFilter((value: string) => /^\d+$/u.test(value), { message: "App id is not a number" })
).pipe($I.annoteSchema("AppId", { description: "A GitHub App id." }));

/**
 * Read the App credentials from the environment.
 *
 * **Details**
 *
 * This is the one loader every stage that holds real credentials uses
 * (`prod` and a rehearsal), so both `plan-check.ts plan` and
 * `plan-check.ts deploy` decode through it before any resource is
 * declared. The webhook secret must be generated in the hex, base64 or
 * base64url format (`[A-Za-z0-9+/=_-]`), with at least
 * {@link minimumWebhookSecretLength} characters and at least 10 distinct
 * ones, so a padded placeholder or a run of one character is refused; a
 * generated secret of that length carries at least 128 bits. The App key
 * must decode from base64 to a PEM private-key block of plausible RSA
 * length, and the App id must be a number. An empty value, which GitHub
 * Actions passes for an unset secret, fails all three. Each failure is a
 * `ConfigError` whose message names the problem only ("webhook secret is a
 * placeholder", "webhook secret has characters outside [A-Za-z0-9+/=_-]",
 * "webhook secret too weak", "App key is not a PEM private key"), never the
 * value or its length. These checks are what make the checked plan's salted secret
 * fingerprint safe to store beside its salt.
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
  id: Config.schema(S.Redacted(AppId), appCredentialVariables.id),
  keyBase64: Config.schema(S.Redacted(AppKeyBase64), appCredentialVariables.keyBase64),
  webhookSecret: Config.schema(S.Redacted(WebhookSecret), appCredentialVariables.webhookSecret),
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

/**
 * Fail unless the App key can sign the RS256 JWT GitHub requires.
 *
 * **Details**
 *
 * The loader's checks prove the key is a base64 PEM private-key block of
 * plausible length; only signing proves it is a usable RSA key. A key that
 * passes the format but cannot sign would let the webhook accept jobs while
 * scale-up never gets an installation token. `plan-check.ts` runs this with
 * the runtime's own signer before planning, for every stage that holds real
 * credentials. The failure is a `ConfigError` that says only "App key cannot
 * sign a GitHub App JWT".
 *
 * **Example** (Reference the check)
 *
 * ```ts
 * import { requireSigningAppKey } from "@beep/infra-ci-runners/Credentials"
 *
 * console.log(typeof requireSigningAppKey) // "function"
 * ```
 *
 * @param credentials - The loaded App credentials.
 * @returns An effect that fails with a `ConfigError` when the key cannot sign.
 * @category configuration
 * @since 0.0.0
 */
export const requireSigningAppKey = Effect.fn("CiRunners.requireSigningAppKey")(function* (
  credentials: AppCredentials
) {
  const pem = credentials.keyBase64.pipe(
    Redacted.value,
    Str.trim,
    Base64.decodeString,
    Result.getOrElse(() => "")
  );
  const signs = yield* appKeyCanSign(
    AppSigningKey.make({ appId: Redacted.value(credentials.id), privateKeyPem: Redacted.make(pem) })
  );
  if (!signs) {
    return yield* Effect.fail(
      new Config.ConfigError(new ConfigProvider.SourceError({ message: "App key cannot sign a GitHub App JWT" }))
    );
  }
});
