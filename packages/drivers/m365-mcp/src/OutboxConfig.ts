/**
 * Configuration of the Microsoft 365 outbox server.
 *
 * **Details**
 *
 * The server reads its settings from the environment. The five credential
 * settings come from 1Password through `op run`; the rest are per-machine
 * paths and limits with defaults. The mailbox is part of this configuration
 * and of nothing else: no tool takes a mailbox parameter.
 *
 * @category configuration
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import { GraphPathSegment, M365AppOnlyConfigInput, M365CertificateCredential } from "@beep/m365";
import { getSomesStruct } from "@beep/utils/Option";
import { Config, Effect, flow, pipe, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OutboxAttachmentPolicy } from "./OutboxAttachmentSource.ts";

const $I = $M365McpId.create("OutboxConfig");

const ROOT_SEPARATOR = ":";
const UNRESOLVED_REFERENCE_PREFIX = "op://";
const STAGING_SUFFIX = "beep/m365-outbox/attachments";
const AUDIT_SUFFIX = "beep/m365-outbox/audit";

/**
 * Environment variable names the outbox server reads.
 *
 * **Example** (Read a variable name)
 *
 * ```ts
 * import { OUTBOX_ENV } from "@beep/m365-mcp/OutboxConfig"
 *
 * console.log(OUTBOX_ENV.attachmentRoots)
 * // "M365_OUTBOX_ATTACHMENT_ROOTS"
 * ```
 *
 * @category constants
 * @since 0.1.0
 */
export const OUTBOX_ENV = {
  attachmentRoots: "M365_OUTBOX_ATTACHMENT_ROOTS",
  auditDirectory: "M365_OUTBOX_AUDIT_DIR",
  certPrivateKey: "M365_OUTBOX_CERT_PRIVATE_KEY",
  certThumbprintSha256: "M365_OUTBOX_CERT_THUMBPRINT_SHA256",
  clientId: "M365_OUTBOX_CLIENT_ID",
  mailbox: "M365_OUTBOX_MAILBOX",
  maxAttachmentBytes: "M365_OUTBOX_MAX_ATTACHMENT_BYTES",
  maxAttachments: "M365_OUTBOX_MAX_ATTACHMENTS",
  maxMessageAttachmentBytes: "M365_OUTBOX_MAX_MESSAGE_ATTACHMENT_BYTES",
  tenantId: "M365_OUTBOX_TENANT_ID",
} as const;

/**
 * Failure to assemble the outbox configuration.
 *
 * **Details**
 *
 * The message names the setting at fault and never a value.
 *
 * **Example** (Construct a configuration failure)
 *
 * ```ts
 * import { OutboxConfigError } from "@beep/m365-mcp/OutboxConfig"
 *
 * const error = OutboxConfigError.make({ message: "M365_OUTBOX_MAILBOX is not set." })
 * console.log(error._tag)
 * // "OutboxConfigError"
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export class OutboxConfigError extends S.TaggedError<OutboxConfigError>($I`OutboxConfigError`)(
  "OutboxConfigError",
  {
    message: S.String.annotateKey({ description: "Which setting is missing or invalid; never its value." }),
  },
  $I.annoteError<OutboxConfigError>("OutboxConfigError", {
    description: "Failure to assemble the Microsoft 365 outbox server configuration.",
  })
) {}

/**
 * Resolved configuration of the outbox server.
 *
 * **Example** (Assemble a configuration by hand)
 *
 * ```ts
 * import { M365AppOnlyConfigInput, M365CertificateCredential } from "@beep/m365"
 * import { OutboxAttachmentPolicy } from "@beep/m365-mcp/OutboxAttachmentSource"
 * import { OutboxConfig } from "@beep/m365-mcp/OutboxConfig"
 * import { Redacted } from "effect"
 *
 * const config = OutboxConfig.make({
 *   appOnly: M365AppOnlyConfigInput.make({
 *     clientId: "client-id",
 *     credential: M365CertificateCredential.make({
 *       privateKey: Redacted.make("pem-private-key-from-a-protected-store"),
 *       thumbprintSha256: "AB12"
 *     }),
 *     tenantId: "tenant-id"
 *   }),
 *   attachments: OutboxAttachmentPolicy.make({ roots: ["/srv/outbox-staging"] }),
 *   auditDirectory: "/var/lib/outbox/audit",
 *   mailbox: "mailbox@example.test"
 * })
 * console.log(config.attachments.roots.length)
 * // 1
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxConfig extends S.Class<OutboxConfig>($I`OutboxConfig`)(
  {
    appOnly: M365AppOnlyConfigInput.annotateKey({
      description: "App-only lane settings of the outbox's own Entra registration (certificate credential).",
    }),
    attachments: OutboxAttachmentPolicy.annotateKey({ description: "Attachment roots and limits." }),
    auditDirectory: S.NonEmptyString.annotateKey({ description: "Directory of the local audit log." }),
    mailbox: GraphPathSegment.annotateKey({
      description: "The one mailbox every tool addresses; fixed here, never a tool parameter.",
    }),
  },
  $I.annote("OutboxConfig", { description: "Resolved configuration of the Microsoft 365 outbox server." })
) {}

const fail = (message: string): Effect.Effect<never, OutboxConfigError> =>
  Effect.fail(OutboxConfigError.make({ message }));

const present = flow(O.map(Str.trim), O.filter(Str.isNonEmpty));

const optionalText = (name: string): Effect.Effect<O.Option<string>, OutboxConfigError> =>
  Config.String(name).pipe(
    Config.option,
    Effect.map(present),
    Effect.mapError(() => OutboxConfigError.make({ message: `${name} could not be read.` }))
  );

// An `op://` value means the server was started without `op run`: never authenticate with a reference.
const requiredText = (name: string): Effect.Effect<string, OutboxConfigError> =>
  optionalText(name).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => fail(`${name} is not set. Start the server through its op run launcher.`),
        onSome: (value) =>
          Str.startsWith(UNRESOLVED_REFERENCE_PREFIX)(value)
            ? fail(`${name} is an unresolved 1Password reference. Start the server through op run.`)
            : Effect.succeed(value),
      })
    )
  );

const optionalInt = (name: string): Effect.Effect<O.Option<number>, OutboxConfigError> =>
  Config.Int(name).pipe(
    Config.option,
    Effect.mapError(() => OutboxConfigError.make({ message: `${name} must be a whole number.` }))
  );

const stateRoot = Effect.fnUntraced(function* (
  variable: string,
  homeRelative: string
): Effect.fn.Return<string, OutboxConfigError> {
  const configured = yield* optionalText(variable);
  if (O.isSome(configured)) {
    return configured.value;
  }
  const home = yield* optionalText("HOME");
  return yield* pipe(
    home,
    O.match({
      onNone: () => fail(`Neither ${variable} nor HOME is set.`),
      onSome: (directory) => Effect.succeed(`${directory}/${homeRelative}`),
    })
  );
});

const splitRoots = flow(Str.split(ROOT_SEPARATOR), A.map(Str.trim), A.filter(Str.isNonEmpty));

const decodePolicy = S.decodeUnknownEffect(OutboxAttachmentPolicy);

const attachmentPolicy = Effect.fnUntraced(function* () {
  const configuredRoots = yield* optionalText(OUTBOX_ENV.attachmentRoots);
  // With no roots configured the one sanctioned root is a dedicated staging directory,
  // never the home directory or a working tree.
  const roots = yield* pipe(
    configuredRoots,
    O.match({
      onNone: () =>
        stateRoot("XDG_DATA_HOME", ".local/share").pipe(Effect.map((dataHome) => [`${dataHome}/${STAGING_SUFFIX}`])),
      onSome: flow(splitRoots, Effect.succeed),
    })
  );
  if (!A.every(roots, Str.startsWith("/"))) {
    return yield* fail(`${OUTBOX_ENV.attachmentRoots} must list absolute directories separated by ':'.`);
  }
  const maxAttachmentBytes = yield* optionalInt(OUTBOX_ENV.maxAttachmentBytes);
  const maxAttachments = yield* optionalInt(OUTBOX_ENV.maxAttachments);
  const maxMessageAttachmentBytes = yield* optionalInt(OUTBOX_ENV.maxMessageAttachmentBytes);
  return yield* decodePolicy({
    createMissingRoots: O.isNone(configuredRoots),
    roots,
    ...getSomesStruct({ maxAttachmentBytes, maxAttachments, maxMessageAttachmentBytes }),
  }).pipe(
    Effect.mapError(() =>
      OutboxConfigError.make({
        message: `${OUTBOX_ENV.attachmentRoots} must name at least one directory, and the attachment limits must be positive whole numbers.`,
      })
    )
  );
});

/**
 * Load the outbox configuration from the ambient Effect `Config`.
 *
 * **Details**
 *
 * Required: `M365_OUTBOX_TENANT_ID`, `M365_OUTBOX_CLIENT_ID`,
 * `M365_OUTBOX_CERT_THUMBPRINT_SHA256`, `M365_OUTBOX_CERT_PRIVATE_KEY` and
 * `M365_OUTBOX_MAILBOX`. A value that is still an `op://` reference counts as
 * missing.
 *
 * Optional: `M365_OUTBOX_ATTACHMENT_ROOTS` (absolute directories separated by
 * `:`; when unset, the single staging directory
 * `${XDG_DATA_HOME:-$HOME/.local/share}/beep/m365-outbox/attachments`, which
 * the server creates), `M365_OUTBOX_MAX_ATTACHMENT_BYTES`,
 * `M365_OUTBOX_MAX_MESSAGE_ATTACHMENT_BYTES`, `M365_OUTBOX_MAX_ATTACHMENTS`
 * and `M365_OUTBOX_AUDIT_DIR` (default
 * `${XDG_STATE_HOME:-$HOME/.local/state}/beep/m365-outbox/audit`).
 *
 * **Example** (Load the configuration)
 *
 * ```ts
 * import { loadOutboxConfig } from "@beep/m365-mcp/OutboxConfig"
 * import { Effect } from "effect"
 *
 * const program = loadOutboxConfig().pipe(Effect.map((config) => config.attachments.maxAttachments))
 * console.log(Effect.isEffect(program))
 * // true
 * ```
 *
 * @category configuration
 * @since 0.1.0
 */
export const loadOutboxConfig = Effect.fn("OutboxConfig.load")(function* (): Effect.fn.Return<
  OutboxConfig,
  OutboxConfigError
> {
  const tenantId = yield* requiredText(OUTBOX_ENV.tenantId);
  const clientId = yield* requiredText(OUTBOX_ENV.clientId);
  const thumbprintSha256 = yield* requiredText(OUTBOX_ENV.certThumbprintSha256);
  const privateKey = yield* requiredText(OUTBOX_ENV.certPrivateKey);
  const mailbox = yield* requiredText(OUTBOX_ENV.mailbox);
  const attachments = yield* attachmentPolicy();
  const auditDirectory = yield* pipe(
    yield* optionalText(OUTBOX_ENV.auditDirectory),
    O.match({
      onNone: () =>
        stateRoot("XDG_STATE_HOME", ".local/state").pipe(Effect.map((stateHome) => `${stateHome}/${AUDIT_SUFFIX}`)),
      onSome: Effect.succeed,
    })
  );

  if (!S.is(GraphPathSegment)(mailbox)) {
    return yield* fail(`${OUTBOX_ENV.mailbox} must be a mailbox address or user id.`);
  }

  return OutboxConfig.make({
    appOnly: M365AppOnlyConfigInput.make({
      clientId,
      credential: M365CertificateCredential.make({ privateKey: Redacted.make(privateKey), thumbprintSha256 }),
      tenantId,
    }),
    attachments,
    auditDirectory,
    mailbox,
  });
});
