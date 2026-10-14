/**
 * App-only lane settings loaded from prefixed environment variables.
 *
 * **Details**
 *
 * One loader for every host that runs the app-only lane under `op run`: it
 * reads `<PREFIX>_TENANT_ID`, `<PREFIX>_CLIENT_ID`,
 * `<PREFIX>_CERT_THUMBPRINT_SHA256`, `<PREFIX>_CERT_PRIVATE_KEY` and
 * `<PREFIX>_MAILBOX` through `effect/Config`, and refuses a value that is still
 * an `op://` reference. Errors name the setting, never its value.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { M365AppOnlyConfigInput, M365CertificateCredential } from "./M365.config.ts";
import { M365EnvError } from "./M365.errors.ts";
import { GraphPathSegment } from "./M365.service.ts";

const $I = $M365Id.create("M365.env");

const UNRESOLVED_REFERENCE_PREFIX = "op://";

// `openssl x509 -fingerprint -sha256` with the colons stripped: 32 bytes as 64 hex digits, either case.
const CertThumbprintSha256 = S.String.check(
  S.isPattern(/^[0-9A-Fa-f]{64}$/, {
    identifier: $I`CertThumbprintSha256Check`,
    title: "Certificate SHA-256 thumbprint",
    description: "The certificate's SHA-256 thumbprint as 64 hex digits.",
    message: "Expected the certificate's SHA-256 thumbprint as 64 hex digits",
  })
);

/**
 * Prefix of the app-only environment variables, such as `M365_OUTBOX`.
 *
 * **Example** (Check a prefix)
 *
 * ```ts
 * import { M365EnvPrefix } from "@beep/m365"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(M365EnvPrefix)("M365_OUTBOX")) // true
 * console.log(S.is(M365EnvPrefix)("m365-outbox")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365EnvPrefix = S.String.check(
  S.isPattern(/^[A-Z][A-Z0-9_]*$/, {
    identifier: $I`M365EnvPrefixCheck`,
    title: "Environment prefix",
    description: "Upper-case letters, digits and underscores, starting with a letter.",
    message: "Expected an upper-case environment variable prefix such as M365_OUTBOX",
  })
).pipe(
  $I.annoteSchema("M365EnvPrefix", {
    description: "Prefix of the Microsoft 365 app-only environment variables.",
  })
);

/**
 * Type for {@link M365EnvPrefix}.
 *
 * **Example** (Type a prefix)
 *
 * ```ts
 * import type { M365EnvPrefix } from "@beep/m365"
 *
 * const prefix: M365EnvPrefix = "M365_OUTBOX"
 * console.log(prefix)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365EnvPrefix = typeof M365EnvPrefix.Type;

/**
 * Names of the five environment variables one prefix stands for.
 *
 * **Example** (Name the variables of a prefix)
 *
 * ```ts
 * import { m365AppOnlyEnvNames } from "@beep/m365"
 *
 * console.log(m365AppOnlyEnvNames("M365_OUTBOX").mailbox) // "M365_OUTBOX_MAILBOX"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365AppOnlyEnvNames extends S.Class<M365AppOnlyEnvNames>($I`M365AppOnlyEnvNames`)(
  {
    tenantId: S.NonEmptyString.annotateKey({ description: "Variable holding the Entra tenant id." }),
    clientId: S.NonEmptyString.annotateKey({ description: "Variable holding the Entra application id." }),
    certThumbprintSha256: S.NonEmptyString.annotateKey({
      description: "Variable holding the hex SHA-256 thumbprint of the registered certificate.",
    }),
    certPrivateKey: S.NonEmptyString.annotateKey({
      description: "Variable holding the PEM private key of the registered certificate.",
    }),
    mailbox: S.NonEmptyString.annotateKey({ description: "Variable holding the mailbox address or user id." }),
  },
  $I.annote("M365AppOnlyEnvNames", {
    description: "Names of the environment variables of one Microsoft 365 app-only prefix.",
  })
) {}

/**
 * Name the five app-only environment variables of a prefix.
 *
 * **Example** (Docket lane names)
 *
 * ```ts
 * import { m365AppOnlyEnvNames } from "@beep/m365"
 *
 * console.log(m365AppOnlyEnvNames("CLOUD_M365_DOCKET").tenantId) // "CLOUD_M365_DOCKET_TENANT_ID"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const m365AppOnlyEnvNames = (prefix: M365EnvPrefix): M365AppOnlyEnvNames =>
  M365AppOnlyEnvNames.make({
    tenantId: `${prefix}_TENANT_ID`,
    clientId: `${prefix}_CLIENT_ID`,
    certThumbprintSha256: `${prefix}_CERT_THUMBPRINT_SHA256`,
    certPrivateKey: `${prefix}_CERT_PRIVATE_KEY`,
    mailbox: `${prefix}_MAILBOX`,
  });

/**
 * App-only lane settings and the one mailbox they address.
 *
 * **Example** (Assemble settings by hand)
 *
 * ```ts
 * import { M365AppOnlyConfigInput, M365AppOnlyEnvSettings, M365CertificateCredential } from "@beep/m365"
 * import * as Redacted from "effect/Redacted"
 *
 * const settings = M365AppOnlyEnvSettings.make({
 *   appOnly: M365AppOnlyConfigInput.make({
 *     clientId: "client-id",
 *     credential: M365CertificateCredential.make({
 *       privateKey: Redacted.make("pem-private-key-from-a-protected-store"),
 *       thumbprintSha256: "AB12"
 *     }),
 *     tenantId: "tenant-id"
 *   }),
 *   mailbox: "mailbox@example.test"
 * })
 * console.log(settings.mailbox) // "mailbox@example.test"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365AppOnlyEnvSettings extends S.Class<M365AppOnlyEnvSettings>($I`M365AppOnlyEnvSettings`)(
  {
    appOnly: M365AppOnlyConfigInput.annotateKey({
      description: "App-only lane settings (certificate credential) for `M365.makeAppOnlyLiveLayer`.",
    }),
    mailbox: GraphPathSegment.annotateKey({ description: "Mailbox address or user id the lane addresses." }),
  },
  $I.annote("M365AppOnlyEnvSettings", {
    description: "Microsoft 365 app-only lane settings and mailbox loaded from prefixed environment variables.",
  })
) {}

const decodePrefix = S.decodeUnknownEffect(M365EnvPrefix);

const present = flow(O.map(Str.trim), O.filter(Str.isNonEmpty));

const optionalText = (name: string): Effect.Effect<O.Option<string>, M365EnvError> =>
  Config.String(name).pipe(
    Config.option,
    Effect.map(present),
    Effect.mapError(() => M365EnvError.of(name, "unreadable"))
  );

// An `op://` value means the process was started without `op run`: never authenticate with a reference.
const requiredText = (name: string): Effect.Effect<string, M365EnvError> =>
  optionalText(name).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.fail(M365EnvError.of(name, "missing")),
        onSome: (value) =>
          Str.startsWith(UNRESOLVED_REFERENCE_PREFIX)(value)
            ? Effect.fail(M365EnvError.of(name, "unresolved-reference"))
            : Effect.succeed(value),
      })
    )
  );

/**
 * Load the app-only lane settings of one prefix from the ambient `Config`.
 *
 * **Details**
 *
 * Every one of the five variables is required. A value that still starts with
 * `op://` is refused as `unresolved-reference`; a mailbox that is not a safe
 * Graph path segment, or a thumbprint that is not 64 hex digits, as `invalid`,
 * before any private key reaches the credential. The result feeds
 * `M365.makeAppOnlyLiveLayer(settings.appOnly)`.
 *
 * **Example** (Load the outbox lane settings)
 *
 * ```ts
 * import { loadM365AppOnlyEnv } from "@beep/m365"
 * import * as Effect from "effect/Effect"
 *
 * const program = loadM365AppOnlyEnv("M365_OUTBOX").pipe(Effect.map((settings) => settings.mailbox))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const loadM365AppOnlyEnv = Effect.fn("M365.loadAppOnlyEnv")(function* (
  prefix: string
): Effect.fn.Return<M365AppOnlyEnvSettings, M365EnvError> {
  const names = m365AppOnlyEnvNames(
    yield* decodePrefix(prefix).pipe(Effect.mapError(() => M365EnvError.of("The environment prefix", "invalid")))
  );
  const tenantId = yield* requiredText(names.tenantId);
  const clientId = yield* requiredText(names.clientId);
  const thumbprintSha256 = yield* requiredText(names.certThumbprintSha256);
  if (!S.is(CertThumbprintSha256)(thumbprintSha256)) {
    return yield* M365EnvError.of(names.certThumbprintSha256, "invalid");
  }
  const privateKey = yield* requiredText(names.certPrivateKey);
  const mailbox = yield* requiredText(names.mailbox);
  if (!S.is(GraphPathSegment)(mailbox)) {
    return yield* M365EnvError.of(names.mailbox, "invalid");
  }
  return M365AppOnlyEnvSettings.make({
    appOnly: M365AppOnlyConfigInput.make({
      clientId,
      credential: M365CertificateCredential.make({ privateKey: Redacted.make(privateKey), thumbprintSha256 }),
      tenantId,
    }),
    mailbox,
  });
});
