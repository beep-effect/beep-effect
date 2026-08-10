/**
 * Typed configuration + base URLs for the PACER driver.
 *
 * Secrets are read through {@link Config} (never `process.env` directly).
 * The package does not ship a live runner; callers provide a ConfigProvider or
 * an explicit {@link PacerConfig} at their own runtime boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PacerId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Config, Effect, Redacted } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { PacerConfigError } from "./Pacer.errors.ts";
import { PacerEnvironment } from "./Pacer.tokens.ts";

const $I = $PacerId.create("Pacer.config");

const unknownCauseMessage = (cause: unknown): string =>
  P.isError(cause) ? cause.message : "Unable to load PACER config.";

/**
 * PACER Authentication API host per environment.
 *
 * **Example** (Log QA auth base URL)
 *
 * ```ts
 * import { PACER_AUTH_BASE_URL } from "@beep/pacer"
 *
 * console.log(PACER_AUTH_BASE_URL.qa)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACER_AUTH_BASE_URL = {
  qa: "https://qa-login.uscourts.gov",
  prod: "https://pacer.login.uscourts.gov",
};

/**
 * PACER Case Locator (PCL) API host per environment.
 *
 * **Example** (Log prod PCL base URL)
 *
 * ```ts
 * import { PACER_PCL_BASE_URL } from "@beep/pacer"
 *
 * console.log(PACER_PCL_BASE_URL.prod)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACER_PCL_BASE_URL = {
  qa: "https://qa-pcl.uscourts.gov",
  prod: "https://pcl.uscourts.gov",
};

/**
 * Environment variable names the config loader reads.
 *
 * **Example** (Log username env key)
 *
 * ```ts
 * import { PACER_ENV } from "@beep/pacer"
 *
 * console.log(PACER_ENV.username)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACER_ENV = {
  username: "PACER_USERNAME",
  password: "PACER_PASSWORD",
  clientCode: "PACER_CLIENT_CODE",
  otp: "PACER_OTP",
  isFiler: "PACER_IS_FILER",
};

/**
 * Resolved PACER configuration consumed by the auth + PCL services.
 *
 * **Example** (Make base PACER config)
 *
 * ```ts
 * import { PacerConfigBase } from "@beep/pacer"
 * import { Redacted } from "effect"
 * import * as O from "effect/Option"
 *
 * const cfg = PacerConfigBase.make({ authBaseUrl: "https://qa-login.uscourts.gov", pclBaseUrl: "https://qa-pcl.uscourts.gov", loginId: Redacted.make("user"), password: Redacted.make("secret"), clientCode: O.none(), otpCode: O.none(), isFiler: O.none() })
 * console.log(cfg.authBaseUrl)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PacerConfigBase extends S.Class<PacerConfigBase>($I`PacerConfigBase`)(
  {
    authBaseUrl: S.String,
    pclBaseUrl: S.String,
    loginId: S.Redacted(S.String),
    password: S.Redacted(S.String),
    clientCode: S.Option(S.String),
    otpCode: S.String.pipe(S.Redacted, S.Option),
    isFiler: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PacerConfigBase", {
    description: "Base PACER configuration consumed by the auth + PCL services",
  })
) {}

/**
 * QA PACER configuration.
 *
 * **Example** (Make QA PACER config)
 *
 * ```ts
 * import { PacerConfigQA, PACER_AUTH_BASE_URL, PACER_PCL_BASE_URL } from "@beep/pacer"
 * import { Redacted } from "effect"
 * import * as O from "effect/Option"
 *
 * const cfg = PacerConfigQA.make({ environment: "qa", authBaseUrl: PACER_AUTH_BASE_URL.qa, pclBaseUrl: PACER_PCL_BASE_URL.qa, loginId: Redacted.make("user"), password: Redacted.make("secret"), clientCode: O.none(), otpCode: O.none(), isFiler: O.none() })
 * console.log(cfg.environment)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PacerConfigQA extends PacerConfigBase.extend<PacerConfigQA>($I`PacerConfigQA`)(
  {
    environment: S.tag(PacerEnvironment.Enum.qa),
  },
  $I.annote("PacerConfigQA", {
    description: "QA PACER configuration consumed by the auth + PCL services",
  })
) {}

/**
 * Production PACER configuration.
 *
 * **Example** (Make prod PACER config)
 *
 * ```ts
 * import { PacerConfigProd, PACER_AUTH_BASE_URL, PACER_PCL_BASE_URL } from "@beep/pacer"
 * import { Redacted } from "effect"
 * import * as O from "effect/Option"
 *
 * const cfg = PacerConfigProd.make({ environment: "prod", authBaseUrl: PACER_AUTH_BASE_URL.prod, pclBaseUrl: PACER_PCL_BASE_URL.prod, loginId: Redacted.make("user"), password: Redacted.make("secret"), clientCode: O.none(), otpCode: O.none(), isFiler: O.none() })
 * console.log(cfg.environment)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PacerConfigProd extends PacerConfigBase.extend<PacerConfigProd>($I`PacerConfigProd`)(
  {
    environment: S.tag(PacerEnvironment.Enum.prod),
  },
  $I.annote("PacerConfigProd", {
    description: "Production PACER configuration consumed by the auth + PCL services",
  })
) {}

/**
 * Resolved PACER configuration consumed by the auth + PCL services.
 *
 * **Example** (Validate mock PACER config)
 *
 * ```ts
 * import { PacerConfig, mockPacerConfig } from "@beep/pacer"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PacerConfig)(mockPacerConfig()))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PacerConfig = S.Union([PacerConfigQA, PacerConfigProd]).pipe(
  S.toTaggedUnion("environment"),
  $I.annoteSchema("PacerConfig", {
    description: "PACER configuration consumed by the auth + PCL services",
  })
);

/**
 * Type for {@link PacerConfig}.
 *
 * **Example** (Type mock PACER config)
 *
 * ```ts
 * import { mockPacerConfig } from "@beep/pacer"
 * import type { PacerConfig as PacerConfigType } from "@beep/pacer"
 *
 * const config: PacerConfigType = mockPacerConfig()
 * console.log(config.environment)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type PacerConfig = typeof PacerConfig.Type;

/**
 * Options used when loading PACER config from an Effect `ConfigProvider`.
 *
 * **Example** (Make load options)
 *
 * ```ts
 * import { PacerConfigLoadOptions } from "@beep/pacer"
 *
 * const options = PacerConfigLoadOptions.make({ environment: "qa" })
 * console.log(options.environment)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PacerConfigLoadOptions extends S.Class<PacerConfigLoadOptions>($I`PacerConfigLoadOptions`)(
  {
    environment: PacerEnvironment,
    otpCode: S.String.pipe(S.Redacted, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PacerConfigLoadOptions", {
    description: "Options used when loading PACER config from an Effect ConfigProvider.",
  })
) {}

/**
 * Constructor input for {@link PacerConfigLoadOptions}.
 *
 * **Example** (Type load options input)
 *
 * ```ts
 * import type { PacerConfigLoadOptionsInput } from "@beep/pacer"
 *
 * const options: PacerConfigLoadOptionsInput = { environment: "qa" }
 * console.log(options.environment)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type PacerConfigLoadOptionsInput = typeof PacerConfigLoadOptions.Encoded;

/**
 * Load PACER configuration from the environment (secrets via {@link Config}).
 *
 * **Details**
 *
 * `otpCode` is sourced from the explicit `options.otpCode` when present (the
 * live runner passes the freshly-typed code), otherwise from the `PACER_OTP`
 * env var, otherwise `none`.
 *
 * **Example** (Load QA PACER config)
 *
 * ```ts
 * import { loadPacerConfig } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * const program = loadPacerConfig({ environment: "qa" })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @effects Reads PACER config from the active Effect ConfigProvider and fails with `PacerConfigError`.
 * @category configuration
 * @since 0.0.0
 */
export const loadPacerConfig = Effect.fn("Pacer.loadPacerConfig")((rawOptions: PacerConfigLoadOptionsInput) =>
  Effect.gen(function* () {
    const options = yield* S.decodeUnknownEffect(PacerConfigLoadOptions)(rawOptions).pipe(
      Effect.mapError((cause) => PacerConfigError.make_(unknownCauseMessage(cause)))
    );
    const loginId = yield* Config.redacted(PACER_ENV.username);
    const password = yield* Config.redacted(PACER_ENV.password);
    const clientCode = yield* Config.string(PACER_ENV.clientCode).pipe(Config.option);
    const otpFromEnv = yield* Config.redacted(PACER_ENV.otp).pipe(Config.option);
    const isFiler = yield* Config.boolean(PACER_ENV.isFiler).pipe(Config.option);
    return PacerConfig.make({
      environment: options.environment,
      authBaseUrl: PACER_AUTH_BASE_URL[options.environment],
      pclBaseUrl: PACER_PCL_BASE_URL[options.environment],
      loginId,
      password,
      clientCode,
      otpCode: O.orElse(options.otpCode, () => otpFromEnv),
      isFiler,
    });
  }).pipe(Effect.mapError((cause) => PacerConfigError.make_(unknownCauseMessage(cause))))
);

/**
 * A placeholder configuration for the deterministic mock runner. Reads no
 * secrets; the credential values are never sent anywhere real.
 *
 * **Example** (Create mock PACER config)
 *
 * ```ts
 * import { mockPacerConfig } from "@beep/pacer"
 *
 * const cfg = mockPacerConfig()
 * console.log(cfg.environment)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const mockPacerConfig = (overrides: Partial<PacerConfig> = {}): PacerConfig =>
  PacerConfigQA.make({
    authBaseUrl: PACER_AUTH_BASE_URL.qa,
    pclBaseUrl: PACER_PCL_BASE_URL.qa,
    loginId: Redacted.make("mock-login-id"),
    password: Redacted.make("mock-password"),
    clientCode: O.some("MOCK-CLIENT-CODE"),
    otpCode: O.none(),
    isFiler: O.none(),
    ...overrides,
    environment: "qa",
  });
