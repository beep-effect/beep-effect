/**
 * Environment configuration of the docket intake service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import { Config } from "effect";
import * as S from "effect/Schema";

const $I = $DocketIntakeId.create("Config");

/**
 * Resolved settings of the docket intake service.
 *
 * **Example** (Read the schema fields)
 *
 * ```ts
 * import { DocketIntakeAppConfig } from "../../src/Config.ts"
 *
 * console.log(Object.keys(DocketIntakeAppConfig.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketIntakeAppConfig extends S.Class<DocketIntakeAppConfig>($I`DocketIntakeAppConfig`)(
  {
    certPrivateKey: S.Redacted(S.NonEmptyString).annotateKey({
      description: "Private key of the registered certificate; never printed.",
    }),
    certThumbprintSha256: S.NonEmptyString.annotateKey({
      description: "Hex SHA-256 thumbprint of the registered certificate.",
    }),
    clientId: S.NonEmptyString.annotateKey({ description: "Entra application id." }),
    mailbox: S.NonEmptyString.annotateKey({ description: "Watched mailbox user id or address; never logged." }),
    reviewNegatives: S.Boolean.annotateKey({
      description: "Whether the secretary also reviews messages the paralegal found nothing to docket in.",
    }),
    startAt: S.Option(S.DateTimeUtc).annotateKey({
      description: "Receipt time to start from on a first run; the time of that run when absent.",
    }),
    stateDirectory: S.NonEmptyString.annotateKey({ description: "Directory of the state file and the digests." }),
    tenantId: S.NonEmptyString.annotateKey({ description: "Entra tenant id." }),
    timeZone: S.TimeZoneNamed.annotateKey({ description: "IANA time zone of the practice." }),
  },
  $I.annote("DocketIntakeAppConfig", { description: "Resolved settings of the docket intake service." })
) {}

const STATE_SUFFIX = "beep/docket-intake";

// DOCKET_INTAKE_STATE_DIR, else the XDG state home, else the XDG default under the home directory.
const stateDirectory = Config.NonEmptyString("DOCKET_INTAKE_STATE_DIR").pipe(
  Config.orElse(() => Config.NonEmptyString("XDG_STATE_HOME").pipe(Config.map((root) => `${root}/${STATE_SUFFIX}`))),
  Config.orElse(() => Config.NonEmptyString("HOME").pipe(Config.map((home) => `${home}/.local/state/${STATE_SUFFIX}`)))
);

/**
 * The service settings, read from the environment. The time zone has no
 * default: a missing or unknown zone is a configuration error.
 *
 * **Example** (Reference the environment config)
 *
 * ```ts
 * import { DocketIntakeAppConfigFromEnv } from "../../src/Config.ts"
 *
 * console.log(DocketIntakeAppConfigFromEnv)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DocketIntakeAppConfigFromEnv: Config.Config<DocketIntakeAppConfig> = Config.all({
  certPrivateKey: Config.Redacted("DOCKET_INTAKE_CERT_PRIVATE_KEY"),
  certThumbprintSha256: Config.NonEmptyString("DOCKET_INTAKE_CERT_THUMBPRINT_SHA256"),
  clientId: Config.NonEmptyString("DOCKET_INTAKE_CLIENT_ID"),
  mailbox: Config.NonEmptyString("DOCKET_INTAKE_MAILBOX"),
  reviewNegatives: Config.Boolean("DOCKET_INTAKE_REVIEW_NEGATIVES").pipe(Config.withDefault(true)),
  startAt: Config.option(Config.schema(S.DateTimeUtcFromString, "DOCKET_INTAKE_START_AT")),
  stateDirectory,
  tenantId: Config.NonEmptyString("DOCKET_INTAKE_TENANT_ID"),
  timeZone: Config.schema(S.TimeZoneNamedFromString, "DOCKET_INTAKE_TIME_ZONE"),
}).pipe(Config.map((values) => DocketIntakeAppConfig.make(values)));
