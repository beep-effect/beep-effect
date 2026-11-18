/**
 * Content-addressed OpenClaw generation model and applicator scripts.
 *
 * **Details**
 *
 * Every deployment renders one immutable generation under
 * `<configRoot>/<config-sha256>/` and flips a single `current` symlink at it.
 * Rendering is pure: the unit, `run.sh`, the generation tree and every
 * applicator script (preflight, stage, apply, probe, backup ship, plus the
 * operator-run drift audit, live acceptance and rollback) are plain strings,
 * so they are testable without touching a machine. The OpenClaw stack runs
 * the applicator steps as ordered `Command.Exec` resources.
 *
 * Moved from the Pulumi program (`infra/src/OpenClaw.ts`) by
 * goals/infra-alchemy-rebuild P4; the Pulumi program imports it from here
 * until `infra/` is deleted.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraHostsId } from "@beep/identity/packages";
import {
  OPENCLAW_COMPATIBILITY_SET,
  OpenclawAbsolutePath,
  OpenclawAgentIntent,
  OpenclawAuthProfileIntent,
  OpenclawControlUiIntent,
  OpenclawDeploymentIntent,
  OpenclawGatewayIntent,
  OpenclawGatewayPort,
  OpenclawGuardrailsIntent,
  OpenclawLoggingIntent,
  OpenclawModelDeclaration,
  OpenclawModelProviderIntent,
  OpenclawPersonaIntent,
  OpenclawProviderApiKeyPlaceholder,
  OpenclawProviderApiKeySecretRef,
  OpenclawSecretReference,
  OpenclawSecretsResolverIntent,
  OpenclawSha256Hex,
  OpenclawSkillPin,
  OpenclawTargetVersion,
  OpenclawTelegramIntent,
  renderOpenclawConfig,
} from "@beep/openclaw";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O, P, R, Str } from "@beep/utils";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { dual, pipe } from "effect/Function";
import * as S from "effect/Schema";
import {
  openClawLegalSoulMarkdown,
  openClawProofSkillMarkdown,
  openClawProofSkillRelativePath,
  openClawSoulRelativePath,
} from "./OpenClawArtifacts.ts";
import type { PlatformError } from "effect/PlatformError";

const $I = $InfraHostsId.create("OpenClawGeneration");

const defaultAgentId = "workstation";
const defaultAgentName = "Beep Workstation";
const defaultConfigRoot = "/etc/beep/openclaw";
const defaultGatewayAuthTokenRef = "op://beep-openclaw/gateway/token";
const defaultGatewayPort = 19_031;
const defaultLogFilePath = "/var/lib/beep/openclaw/log/openclaw.log";
// The staging step runs `npm install` as root, so the Node toolchain is part of the trust
// boundary: it lives beside the resolver under the root-owned `/opt/beep/openclaw` tree rather
// than in a user-writable per-user runtime manager directory.
const defaultNodeBinDir = "/opt/beep/openclaw/node/bin";
const defaultResolverCommandPath = "/opt/beep/openclaw/op-resolver.sh";
const defaultResolverOpBinaryPath = "/opt/beep/openclaw/bin/op";
const defaultResolverTrustedDir = "/opt/beep/openclaw";
const defaultStateDir = "/var/lib/beep/openclaw";
const defaultUnitName = "openclaw.service";
const localProviderPlaceholder = "local-no-secret";
const opServiceAccountCredentialPath = "/etc/beep/openclaw/credentials/op-service-account-token";
const proofSkillName = "beep-proof-ping";
const proofSkillSource = "repo-local:packages/tooling/infra/infra-hosts/src/OpenClawArtifacts.ts";
const proofSkillVersion = "1.0.0";
const loopbackProviderBaseUrlPattern = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/.*)?$/u;
const hostedProviderBaseUrlPattern = /^https:\/\/\S+$/u;

const backupPassphraseEnvVar = "OPENCLAW_BACKUP_PASSPHRASE";
const configFileName = "openclaw.json";
const driftAlertPrefix = "ALERT: OPENCLAW_CONFIG_DRIFT";
const generationPointerName = "current";
const healthWaitAttempts = 30;
const manifestFileName = "manifest.json";
const previousPointerFileName = ".previous";
const runScriptFileName = "run.sh";
const snapshotsDirName = ".snapshots";
const stateUserVersionFileName = "state-user-version";
const unitOwnershipMarker = "# BEEP_OPENCLAW_MANAGED";
const unixSocketPathLimit = 108;

const configHeredocSentinel = "BEEP_OPENCLAW_CONFIG";
const manifestHeredocSentinel = "BEEP_OPENCLAW_MANIFEST";
const runScriptHeredocSentinel = "BEEP_OPENCLAW_RUN";
const unitHeredocSentinel = "BEEP_OPENCLAW_UNIT";
const soulHeredocSentinel = "BEEP_OPENCLAW_SOUL";
const proofSkillHeredocSentinel = "BEEP_OPENCLAW_PROOF_SKILL";

const machineIdPattern = /^[0-9a-f]{32}$/u;
const OpenClawFileModeBase = LiteralKit(["0644", "0755"]);

const MachineIdFormat = S.isPattern(
  machineIdPattern,
  $I.annote("MachineIdFormat", {
    title: "Machine ID Format",
    description: "A 32-character lowercase hexadecimal `/etc/machine-id` value.",
    message: "Expected a 32-character lowercase hex machine id",
  })
);

const MachineId = S.String.check(MachineIdFormat).pipe(
  $I.annoteSchema("MachineId", {
    description: "A 32-character lowercase hexadecimal `/etc/machine-id` value.",
  })
);

const LoopbackProviderBaseUrlFormat = S.isPattern(
  loopbackProviderBaseUrlPattern,
  $I.annote("LoopbackProviderBaseUrlFormat", {
    title: "Loopback Provider Base URL",
    description: "An HTTP URL rooted at localhost or 127.0.0.1.",
    message: "Expected an HTTP loopback URL rooted at localhost or 127.0.0.1",
  })
);

const LoopbackProviderBaseUrl = S.NonEmptyString.check(LoopbackProviderBaseUrlFormat).pipe(
  $I.annoteSchema("LoopbackProviderBaseUrl", {
    description: "An HTTP base URL restricted to localhost or 127.0.0.1.",
  })
);

const PosixUidRange = S.isBetween(
  {
    minimum: 0,
    maximum: 65_535,
  },
  $I.annote("PosixUidRange", {
    title: "POSIX UID Range",
    description: "A POSIX user id in the inclusive range 0 through 65535.",
    message: "Expected a POSIX uid between 0 and 65535",
  })
);

const PosixUid = S.Int.check(PosixUidRange).pipe(
  $I.annoteSchema("PosixUid", {
    description: "A POSIX user id in the inclusive range 0 through 65535.",
  })
);

const shellQuote = (value: string): string => `'${pipe(value, Str.replace(/'/gu, `'"'"'`))}'`;

// Never a login shell. `-l` sources /etc/profile and the user-writable ~/.bash_profile before the
// first rendered line runs, so an unprivileged user could define a `sudo` shell function (or
// prepend a PATH entry) and intercept every privileged command while the operator's ticket is
// live. `--noprofile --norc` drops the startup files and `-p` refuses functions exported through
// the environment, which is the only other way to inject one.
const bashScript = (lines: ReadonlyArray<string>): string =>
  `/bin/bash --noprofile --norc -p -c ${shellQuote(A.join(lines, "\n"))}`;

const heredocLines = (input: {
  readonly content: string;
  readonly install: string;
  readonly path: string;
  readonly sentinel: string;
}): ReadonlyArray<string> => [
  `${input.install} /dev/stdin ${shellQuote(input.path)} <<'${input.sentinel}'`,
  Str.trimEnd(input.content),
  input.sentinel,
];

/**
 * Filesystem mode a rendered generation file is materialized with.
 *
 * **Example** (List the file mode literals)
 * ```ts
 * import { OpenClawFileMode } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * console.log(OpenClawFileMode.literals) // ["0644", "0755"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenClawFileMode = OpenClawFileModeBase.pipe(
  $I.annoteSchema("OpenClawFileMode", {
    description: "Filesystem mode a rendered OpenClaw generation file is materialized with.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenClawFileModeBase)
);

/**
 * Runtime type for {@link OpenClawFileMode}.
 *
 * **Example** (Annotate a file mode value)
 * ```ts
 * import type { OpenClawFileMode } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * const mode: OpenClawFileMode = "0644"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenClawFileMode = typeof OpenClawFileMode.Type;

/**
 * Declared identity of the single workstation this stack may mutate.
 *
 * **Details**
 *
 * Every field is required and carries no default on purpose: a silent
 * wrong-target apply is the failure mode this binding exists to prevent, so an
 * incomplete expectation must refuse to render rather than degrade into an
 * empty match.
 *
 * **Example** (Build the expected host identity)
 * ```ts
 * import { OpenClawExpectedIdentity } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * const identity = OpenClawExpectedIdentity.make({
 *   home: "/home/example",
 *   hostname: "workstation",
 *   machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *   runtimeDir: "/run/user/1000",
 *   uid: 1000,
 *   username: "operator"
 * })
 * console.log(identity.hostname) // "workstation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawExpectedIdentity extends S.Opaque<OpenClawExpectedIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    home: OpenclawAbsolutePath.annotateKey({
      description: "Absolute home directory of the target user.",
    }),
    hostname: S.NonEmptyString.annotateKey({
      description: "Expected `/proc/sys/kernel/hostname` value of the target workstation.",
    }),
    machineId: MachineId.annotateKey({
      description: "Expected `/etc/machine-id` value of the target workstation.",
    }),
    runtimeDir: OpenclawAbsolutePath.annotateKey({
      description: "Expected `XDG_RUNTIME_DIR` of the target user, normally `/run/user/<uid>`.",
    }),
    uid: PosixUid.annotateKey({
      description: "Expected POSIX uid of the target user.",
    }),
    username: S.NonEmptyString.annotateKey({
      description: "Expected login name of the target user.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawExpectedIdentity", {
      description: "Fully declared identity of the workstation the OpenClaw stack is bound to.",
    })
  )
) {}

/**
 * Filesystem layout the workstation applicator owns.
 *
 * **Example** (Read the default config root)
 * ```ts
 * import { OpenClawWorkstationPaths } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * console.log(OpenClawWorkstationPaths.make({}).configRoot) // "/etc/beep/openclaw"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawWorkstationPaths extends S.Opaque<OpenClawWorkstationPaths, { readonly brand: unique symbol }>()(
  S.Struct({
    configRoot: OpenclawAbsolutePath.pipe(
      S.withConstructorDefault(Effect.succeed(defaultConfigRoot)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultConfigRoot))
    ).annotateKey({
      description: "Root-owned directory holding every content-addressed generation and the `current` pointer.",
    }),
    nodeBinDir: OpenclawAbsolutePath.pipe(
      S.withConstructorDefault(Effect.succeed(defaultNodeBinDir)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultNodeBinDir))
    ).annotateKey({
      description: "Directory containing the pinned Node binaries prepended to the unit's hermetic PATH.",
    }),
    stateDir: OpenclawAbsolutePath.pipe(
      S.withConstructorDefault(Effect.succeed(defaultStateDir)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultStateDir))
    ).annotateKey({
      description: "OpenClaw state root snapshotted before every generation switch.",
    }),
    unitName: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed(defaultUnitName)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultUnitName))
    ).annotateKey({
      description: "Name of the stack-owned `systemd --user` unit.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawWorkstationPaths", {
      description: "Filesystem layout the OpenClaw workstation applicator owns.",
    })
  )
) {}

/**
 * Hosted OpenAI-compatible provider selected as the workstation primary.
 *
 * **Example** (Configure a hosted provider)
 * ```ts
 * import { OpenClawHostedProviderConfig } from "@beep/infra-hosts/OpenClawGeneration"
 * import { OpenclawSecretReference } from "@beep/openclaw"
 *
 * const provider = OpenClawHostedProviderConfig.make({
 *   apiKeyRef: OpenclawSecretReference.make("op://beep-openclaw/hosted/api-key"),
 *   baseUrl: "https://api.example.com/v1",
 *   modelId: "legal-primary",
 *   modelName: "Legal Primary",
 *   providerId: "hosted"
 * })
 * console.log(provider.providerId) // "hosted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawHostedProviderConfig extends S.Opaque<
  OpenClawHostedProviderConfig,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    apiKeyRef: OpenclawSecretReference,
    baseUrl: S.NonEmptyString.check(
      S.isPattern(hostedProviderBaseUrlPattern, {
        identifier: "OpenClawHostedProviderBaseUrl",
        title: "OpenClaw hosted provider base URL",
        description: "An HTTPS URL for a hosted provider endpoint.",
        message: "Expected an HTTPS URL",
      })
    ),
    modelId: S.NonEmptyString,
    modelName: S.NonEmptyString,
    providerId: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("OpenClawHostedProviderConfig", {
      description: "Required hosted OpenAI-compatible provider configuration.",
    })
  )
) {}

/**
 * Local loopback OpenAI-compatible fallback provider.
 *
 * **Example** (Configure a local Ollama provider)
 * ```ts
 * import { OpenClawLocalProviderConfig } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * const provider = OpenClawLocalProviderConfig.make({
 *   baseUrl: "http://127.0.0.1:11434/v1",
 *   modelId: "gemma3:4b",
 *   modelName: "Gemma 3 4B",
 *   providerId: "ollama"
 * })
 * console.log(provider.baseUrl) // "http://127.0.0.1:11434/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawLocalProviderConfig extends S.Opaque<
  OpenClawLocalProviderConfig,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    baseUrl: LoopbackProviderBaseUrl,
    modelId: S.NonEmptyString,
    modelName: S.NonEmptyString,
    providerId: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("OpenClawLocalProviderConfig", {
      description: "Required local loopback OpenAI-compatible provider configuration.",
    })
  )
) {}

const openClawDeploymentConfigGatewayAuthTokenRefDefault = OpenclawSecretReference.make(defaultGatewayAuthTokenRef);
/**
 * Deployment inputs the stack turns into an OpenClaw deployment intent.
 *
 * **Details**
 *
 * Secret material never appears here: `gatewayAuthTokenRef` is an `op://`
 * reference resolved on the workstation at runtime.
 *
 * **Example** (Build a deployment config)
 * ```ts
 * import {
 *   OpenClawDeploymentConfig,
 *   OpenClawHostedProviderConfig,
 *   OpenClawLocalProviderConfig
 * } from "@beep/infra-hosts/OpenClawGeneration"
 * import { OpenclawSecretReference } from "@beep/openclaw"
 *
 * const deployment = OpenClawDeploymentConfig.make({
 *   hostedProvider: OpenClawHostedProviderConfig.make({
 *     apiKeyRef: OpenclawSecretReference.make("op://beep-openclaw/hosted/api-key"),
 *     baseUrl: "https://api.example.com/v1",
 *     modelId: "legal-primary",
 *     modelName: "Legal Primary",
 *     providerId: "hosted"
 *   }),
 *   localProvider: OpenClawLocalProviderConfig.make({
 *     baseUrl: "http://127.0.0.1:11434/v1",
 *     modelId: "gemma3:4b",
 *     modelName: "Gemma 3 4B",
 *     providerId: "ollama"
 *   }),
 *   telegramBotTokenRef: OpenclawSecretReference.make("op://beep-openclaw/telegram/bot-token")
 * })
 * console.log(deployment.gatewayPort) // 19031
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawDeploymentConfig extends S.Opaque<OpenClawDeploymentConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    agentId: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed(defaultAgentId)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultAgentId))
    ).annotateKey({
      description: "Slug identifying the agent in config and state paths.",
    }),
    agentName: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed(defaultAgentName)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultAgentName))
    ).annotateKey({
      description: "Human-readable agent display name.",
    }),
    gatewayAuthTokenRef: OpenclawSecretReference.pipe(
      S.withConstructorDefault(Effect.succeed(openClawDeploymentConfigGatewayAuthTokenRefDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(openClawDeploymentConfigGatewayAuthTokenRefDefault))
    ).annotateKey({
      description: "op:// reference resolved at runtime into the gateway auth token.",
    }),
    gatewayPort: OpenclawGatewayPort.pipe(
      S.withConstructorDefault(Effect.succeed(defaultGatewayPort)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultGatewayPort))
    ).annotateKey({
      description: "Loopback TCP port the gateway listens on.",
    }),
    hostedProvider: OpenClawHostedProviderConfig,
    localProvider: OpenClawLocalProviderConfig,
    logFilePath: OpenclawAbsolutePath.pipe(
      S.withConstructorDefault(Effect.succeed(defaultLogFilePath)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultLogFilePath))
    ).annotateKey({
      description: "Absolute path of the gateway log file.",
    }),
    openclawVersion: OpenclawTargetVersion.pipe(
      S.withConstructorDefault(Effect.succeed(OPENCLAW_COMPATIBILITY_SET.openclawVersion)),
      S.withDecodingDefaultTypeKey(Effect.succeed(OPENCLAW_COMPATIBILITY_SET.openclawVersion))
    ).annotateKey({
      description: "Pinned OpenClaw version staged into each generation.",
    }),
    resolverCommandPath: OpenclawAbsolutePath.pipe(
      S.withConstructorDefault(Effect.succeed(defaultResolverCommandPath)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultResolverCommandPath))
    ).annotateKey({
      description: "Absolute path of the exec-provider secret resolver command.",
    }),
    resolverOpBinaryPath: OpenclawAbsolutePath.pipe(
      S.withConstructorDefault(Effect.succeed(defaultResolverOpBinaryPath)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultResolverOpBinaryPath))
    ).annotateKey({
      description: "Absolute path of the pinned 1Password CLI binary.",
    }),
    resolverTrustedDir: OpenclawAbsolutePath.pipe(
      S.withConstructorDefault(Effect.succeed(defaultResolverTrustedDir)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultResolverTrustedDir))
    ).annotateKey({
      description: "Directory OpenClaw trusts to contain the resolver command.",
    }),
    telegramBotTokenRef: OpenclawSecretReference,
    telegramDefaultTo: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    telegramDmPolicy: S.Literals(["pairing", "disabled", "open"]).pipe(
      S.withConstructorDefault(Effect.succeed("pairing" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("pairing" as const))
    ),
    telegramGroupPolicy: S.Literals(["open", "disabled"]).pipe(
      S.withConstructorDefault(Effect.succeed("disabled" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("disabled" as const))
    ),
  }).pipe(
    $I.annoteSchema("OpenClawDeploymentConfig", {
      description: "Deployment inputs the OpenClaw stack renders into a deployment intent.",
    })
  )
) {}

const utf8 = new TextEncoder();

const sha256Hex = Effect.fnUntraced(function* (text: string) {
  const crypto = yield* Digest.Digest;
  const digest = yield* crypto.digest(Digest.sha256, utf8.encode(text));
  return Hex.encode(digest);
});

/**
 * Build the driver deployment intent a deployment config describes.
 *
 * **Example** (Derive the deployment intent)
 * ```ts
 * import {
 *   makeOpenClawDeploymentIntent,
 *   OpenClawDeploymentConfig,
 *   OpenClawHostedProviderConfig,
 *   OpenClawLocalProviderConfig
 * } from "@beep/infra-hosts/OpenClawGeneration"
 * import { OpenclawSecretReference } from "@beep/openclaw"
 * import * as Effect from "effect/Effect"
 *
 * const deployment = OpenClawDeploymentConfig.make({
 *   hostedProvider: OpenClawHostedProviderConfig.make({
 *     apiKeyRef: OpenclawSecretReference.make("op://beep-openclaw/hosted/api-key"),
 *     baseUrl: "https://api.example.com/v1",
 *     modelId: "legal-primary",
 *     modelName: "Legal Primary",
 *     providerId: "hosted"
 *   }),
 *   localProvider: OpenClawLocalProviderConfig.make({
 *     baseUrl: "http://127.0.0.1:11434/v1",
 *     modelId: "gemma3:4b",
 *     modelName: "Gemma 3 4B",
 *     providerId: "ollama"
 *   }),
 *   telegramBotTokenRef: OpenclawSecretReference.make("op://beep-openclaw/telegram/bot-token")
 * })
 * console.log(Effect.isEffect(makeOpenClawDeploymentIntent(deployment)))
 * // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOpenClawDeploymentIntent: {
  (
    configRoot?: string
  ): (deployment: OpenClawDeploymentConfig) => Effect.Effect<OpenclawDeploymentIntent, PlatformError, Digest.Digest>;
  (
    deployment: OpenClawDeploymentConfig,
    configRoot?: string
  ): Effect.Effect<OpenclawDeploymentIntent, PlatformError, Digest.Digest>;
} = dual(
  (args) => args.length >= 2 || (args.length === 1 && P.isNotUndefined(args[0]) && !Str.isString(args[0])),
  Effect.fn($I`makeOpenClawDeploymentIntent`)(function* (
    deployment: OpenClawDeploymentConfig,
    configRoot: string = defaultConfigRoot
  ) {
    const integrity = yield* sha256Hex(openClawProofSkillMarkdown);
    return OpenclawDeploymentIntent.make({
      agent: OpenclawAgentIntent.make({
        id: deployment.agentId,
        model: `${deployment.hostedProvider.providerId}/${deployment.hostedProvider.modelId}`,
        name: deployment.agentName,
        workspace: `${configRoot}/${generationPointerName}/workspace`,
      }),
      authProfiles: [
        OpenclawAuthProfileIntent.make({
          mode: "api_key",
          profileId: `${deployment.hostedProvider.providerId}:managed`,
          provider: deployment.hostedProvider.providerId,
        }),
      ],
      controlUi: OpenclawControlUiIntent.make({
        allowedOrigins: [`http://127.0.0.1:${deployment.gatewayPort}`, `http://localhost:${deployment.gatewayPort}`],
        enabled: true,
      }),
      gateway: OpenclawGatewayIntent.make({
        authTokenRef: deployment.gatewayAuthTokenRef,
        port: deployment.gatewayPort,
      }),
      guardrails: OpenclawGuardrailsIntent.make({ toolsDeny: ["*"] }),
      logging: OpenclawLoggingIntent.make({ filePath: deployment.logFilePath }),
      openclawVersion: deployment.openclawVersion,
      persona: OpenclawPersonaIntent.make({
        clientDataPolicy: "synthetic-only",
        confidentialityPolicy: "advisory",
        soulMarkdown: openClawLegalSoulMarkdown,
      }),
      providers: [
        OpenclawModelProviderIntent.make({
          api: "openai-compat",
          apiKey: OpenclawProviderApiKeySecretRef.make({
            _tag: "SecretRef",
            ref: deployment.hostedProvider.apiKeyRef,
          }),
          baseUrl: deployment.hostedProvider.baseUrl,
          id: deployment.hostedProvider.providerId,
          models: [
            OpenclawModelDeclaration.make({
              id: deployment.hostedProvider.modelId,
              input: ["text"],
              name: deployment.hostedProvider.modelName,
            }),
          ],
        }),
        OpenclawModelProviderIntent.make({
          api: "openai-compat",
          apiKey: OpenclawProviderApiKeyPlaceholder.make({
            _tag: "Placeholder",
            value: localProviderPlaceholder,
          }),
          baseUrl: deployment.localProvider.baseUrl,
          id: deployment.localProvider.providerId,
          models: [
            OpenclawModelDeclaration.make({
              id: deployment.localProvider.modelId,
              input: ["text"],
              name: deployment.localProvider.modelName,
            }),
          ],
        }),
      ],
      secretsResolver: OpenclawSecretsResolverIntent.make({
        commandPath: deployment.resolverCommandPath,
        opBinaryPath: deployment.resolverOpBinaryPath,
        trustedDir: deployment.resolverTrustedDir,
      }),
      skills: [
        OpenclawSkillPin.make({
          integrity,
          name: proofSkillName,
          source: proofSkillSource,
          version: proofSkillVersion,
        }),
      ],
      telegram: O.some(
        OpenclawTelegramIntent.make({
          botTokenRef: deployment.telegramBotTokenRef,
          defaultTo: deployment.telegramDefaultTo,
          dmPolicy: deployment.telegramDmPolicy,
          groupPolicy: deployment.telegramGroupPolicy,
          groups: {},
        })
      ),
    });
  })
);

/**
 * Backup shipping inputs for encrypted generation snapshots.
 *
 * **Details**
 *
 * The remote host is dumb storage: the ship script only creates the target
 * directory, copies an already-encrypted archive into it, and reads back a
 * sha256 receipt. Nothing else on the remote is modified.
 *
 * Host, login and remote directory have no defaults: they name a machine, so
 * they come from the stack configuration.
 *
 * **Example** (Declare a backup target)
 * ```ts
 * import { OpenClawBackupConfig } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * const backup = OpenClawBackupConfig.make({
 *   host: "backup-host",
 *   passphraseSecretRef: "op://beep-openclaw/backup/passphrase",
 *   remoteDir: "/srv/backups/openclaw",
 *   user: "operator"
 * })
 * console.log(backup.host) // "backup-host"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawBackupConfig extends S.Opaque<OpenClawBackupConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    agentSocketPath: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Local SSH agent socket exported as `SSH_AUTH_SOCK` while shipping, when declared.",
    }),
    host: S.NonEmptyString.annotateKey({
      description: "Tailnet host receiving encrypted snapshot archives.",
    }),
    passphraseSecretRef: S.NonEmptyString.annotateKey({
      description: "op:// reference for the symmetric archive passphrase; the material never enters Alchemy state.",
    }),
    remoteDir: OpenclawAbsolutePath.annotateKey({
      description: "Absolute remote directory receiving encrypted snapshot archives.",
    }),
    user: S.NonEmptyString.annotateKey({
      description: "Remote login used to ship encrypted snapshot archives.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawBackupConfig", {
      description: "Backup shipping inputs for encrypted OpenClaw generation snapshots.",
    })
  )
) {}

/**
 * One immutable, content-addressed OpenClaw generation.
 *
 * **Details**
 *
 * `generationId` is the length-delimited SHA-256 bundle of the config,
 * persona, proof skill, and compatibility identity. It is also the generation
 * directory name, so equal inputs always produce the same generation
 * directory and the applicator becomes idempotent by construction.
 *
 * **Example** (Materialize a generation)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const generation = Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer)))
 * console.log(generation.generationId.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawGeneration extends S.Opaque<OpenClawGeneration, { readonly brand: unique symbol }>()(
  S.Struct({
    agentId: S.NonEmptyString,
    canonicalJson: S.String.annotateKey({
      description: "Canonical `openclaw.json` bytes rendered by the driver adapter.",
    }),
    configRoot: OpenclawAbsolutePath.annotateKey({
      description: "Root-owned directory holding every generation and the `current` pointer.",
    }),
    configHash: OpenclawSha256Hex.annotateKey({
      description: "SHA-256 of the canonical config bytes, distinct from the bundle generation id.",
    }),
    gatewayPort: OpenclawGatewayPort.annotateKey({
      description: "Loopback TCP port acceptance probes poll.",
    }),
    generationId: OpenclawSha256Hex.annotateKey({
      description: "Length-delimited bundle SHA-256; also the generation directory name.",
    }),
    home: OpenclawAbsolutePath.annotateKey({
      description: "Home directory exported into the unit environment.",
    }),
    logFilePath: OpenclawAbsolutePath.annotateKey({
      description: "Absolute path the unit appends stdout and stderr to.",
    }),
    nodeBinDir: OpenclawAbsolutePath.annotateKey({
      description: "Directory prepended to the unit's hermetic PATH.",
    }),
    nodeVersion: S.NonEmptyString.annotateKey({
      description: "Pinned Node version recorded in the generation manifest.",
    }),
    openclawVersion: OpenclawTargetVersion.annotateKey({
      description: "Pinned OpenClaw version staged into the generation.",
    }),
    opBinaryPath: OpenclawAbsolutePath,
    proofSkillHash: OpenclawSha256Hex,
    proofSkillMarkdown: S.NonEmptyString,
    hostedModelId: S.NonEmptyString,
    hostedProviderId: S.NonEmptyString,
    localBaseUrl: S.NonEmptyString,
    localModelId: S.NonEmptyString,
    runtimeDir: OpenclawAbsolutePath.annotateKey({
      description: "`XDG_RUNTIME_DIR` the applicator constructs before touching the user bus.",
    }),
    stateDir: OpenclawAbsolutePath.annotateKey({
      description: "OpenClaw state root snapshotted before every generation switch.",
    }),
    soulHash: OpenclawSha256Hex,
    soulMarkdown: S.NonEmptyString,
    unitName: S.NonEmptyString.annotateKey({
      description: "Name of the stack-owned `systemd --user` unit.",
    }),
    workspace: OpenclawAbsolutePath.annotateKey({
      description: "Absolute path of the agent workspace directory.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawGeneration", {
      description: "One immutable, content-addressed OpenClaw generation.",
    })
  )
) {}

/**
 * Content hashes that form an immutable OpenClaw generation identity.
 *
 * **Example** (Build bundle hash inputs)
 * ```ts
 * import { OpenClawBundleHashInput } from "@beep/infra-hosts/OpenClawGeneration"
 * import { OpenclawSha256Hex } from "@beep/openclaw"
 *
 * const hash = OpenclawSha256Hex.make("0".repeat(64))
 * const input = OpenClawBundleHashInput.make({
 *   configHash: hash,
 *   proofSkillHash: hash,
 *   soulHash: hash
 * })
 * console.log(input.configHash === hash) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawBundleHashInput extends S.Opaque<OpenClawBundleHashInput, { readonly brand: unique symbol }>()(
  S.Struct({
    configHash: OpenclawSha256Hex.annotateKey({
      description: "SHA-256 of the canonical OpenClaw configuration.",
    }),
    proofSkillHash: OpenclawSha256Hex.annotateKey({
      description: "SHA-256 of the immutable proof skill.",
    }),
    soulHash: OpenclawSha256Hex.annotateKey({
      description: "SHA-256 of the immutable legal-agent persona.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawBundleHashInput", {
      description: "Content hashes combined into the length-delimited OpenClaw generation identity.",
    })
  )
) {}

/**
 * Shared input for rendered scripts that bind a generation to its expected
 * workstation identity.
 *
 * **Example** (Reference the identity script input schema)
 * ```ts
 * import { OpenClawGenerationIdentityScriptInput } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * console.log(typeof OpenClawGenerationIdentityScriptInput !== "undefined")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawGenerationIdentityScriptInput extends S.Opaque<
  OpenClawGenerationIdentityScriptInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    generation: OpenClawGeneration.annotateKey({
      description: "Content-addressed generation the rendered script operates on.",
    }),
    identity: OpenClawExpectedIdentity.annotateKey({
      description: "Expected workstation identity the rendered script verifies.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawGenerationIdentityScriptInput", {
      description: "Input shared by OpenClaw scripts that bind a generation to its expected workstation identity.",
    })
  )
) {}

/**
 * Input for rendering an encrypted OpenClaw backup shipping script.
 *
 * **Example** (Reference the backup script input schema)
 * ```ts
 * import { OpenClawBackupShipScriptInput } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * console.log(typeof OpenClawBackupShipScriptInput !== "undefined")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawBackupShipScriptInput extends S.Opaque<
  OpenClawBackupShipScriptInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    backup: OpenClawBackupConfig.annotateKey({
      description: "Encrypted backup shipping configuration.",
    }),
    generation: OpenClawGeneration.annotateKey({
      description: "Content-addressed generation whose snapshot is shipped.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawBackupShipScriptInput", {
      description: "Input for rendering an encrypted OpenClaw backup shipping script.",
    })
  )
) {}

const generationDir = (generation: OpenClawGeneration): string => `${generation.configRoot}/${generation.generationId}`;

const pointerPath = (generation: OpenClawGeneration): string => `${generation.configRoot}/${generationPointerName}`;

const activeConfigPath = (generation: OpenClawGeneration): string => `${pointerPath(generation)}/${configFileName}`;

const snapshotDir = (generation: OpenClawGeneration): string =>
  `${generation.configRoot}/${snapshotsDirName}/${generation.generationId}`;

const stateDatabasePath = (generation: OpenClawGeneration): string => `${generation.stateDir}/state/openclaw.sqlite`;

const unitPath = (generation: OpenClawGeneration): string =>
  `${generation.home}/.config/systemd/user/${generation.unitName}`;

const stagedOpenclawBinary = (generation: OpenClawGeneration): string =>
  `${generationDir(generation)}/node_modules/.bin/openclaw`;

const healthUrl = (generation: OpenClawGeneration): string => `http://127.0.0.1:${generation.gatewayPort}/health`;

// Pinned before anything else runs: the deploying process inherits the operator's PATH, which on a
// developer workstation routinely leads with user-writable runtime-manager directories. Scripts
// that need the pinned Node toolchain export their own PATH after this line.
const trustedBasePath = "export PATH=/usr/bin:/bin";

const scriptPreamble = (generation: OpenClawGeneration): ReadonlyArray<string> => [
  "set -euo pipefail",
  trustedBasePath,
  `export XDG_RUNTIME_DIR=${shellQuote(generation.runtimeDir)}`,
  `export DBUS_SESSION_BUS_ADDRESS=${shellQuote(`unix:path=${generation.runtimeDir}/bus`)}`,
];

const switchScriptBindings = (generation: OpenClawGeneration): ReadonlyArray<string> => [
  `unit=${shellQuote(generation.unitName)}`,
  `pointer=${shellQuote(pointerPath(generation))}`,
  `snapshot=${shellQuote(snapshotDir(generation))}`,
  `state_dir=${shellQuote(generation.stateDir)}`,
  `previous_pointer_file=${shellQuote(`${generation.configRoot}/${previousPointerFileName}`)}`,
];

const identityAssertionLines = (input: {
  readonly actual: string;
  readonly expected: string;
  readonly label: string;
  readonly variable: string;
}): ReadonlyArray<string> => [
  `${input.variable}=${shellQuote(input.expected)}`,
  `[ -n "\${${input.variable}}" ] || fail ${shellQuote(`malformed expected identity: empty ${input.label} (failing closed)`)}`,
  `actual_${input.variable}="$(${input.actual})" || fail ${shellQuote(`unreadable ${input.label} on the target (failing closed)`)}`,
  `[ -n "\${actual_${input.variable}}" ] || fail ${shellQuote(`unreadable ${input.label} on the target (failing closed)`)}`,
  `[ "\${${input.variable}}" = "\${actual_${input.variable}}" ] || fail "${input.label} mismatch: expected \${${input.variable}}, target is \${actual_${input.variable}}"`,
];

const identityChecks = (
  identity: OpenClawExpectedIdentity
): ReadonlyArray<{
  readonly actual: string;
  readonly expected: string;
  readonly label: string;
  readonly variable: string;
}> => [
  {
    actual: "tr -d '[:space:]' < /etc/machine-id",
    expected: identity.machineId,
    label: "machine-id",
    variable: "expected_machine_id",
  },
  {
    actual: "tr -d '[:space:]' < /proc/sys/kernel/hostname",
    expected: identity.hostname,
    label: "hostname",
    variable: "expected_hostname",
  },
  { actual: "id -u", expected: String(identity.uid), label: "uid", variable: "expected_uid" },
  { actual: "id -un", expected: identity.username, label: "username", variable: "expected_username" },
  {
    actual: 'getent passwd "$(id -u)" | cut -d: -f6',
    expected: identity.home,
    label: "home",
    variable: "expected_home",
  },
  {
    actual: 'printf %s "/run/user/$(id -u)"',
    expected: identity.runtimeDir,
    label: "runtime dir",
    variable: "expected_runtime_dir",
  },
];

const renderGenerationManifest = (generation: OpenClawGeneration): string =>
  `${A.join(
    [
      "{",
      `  "adapterVersion": ${OPENCLAW_COMPATIBILITY_SET.adapterVersion},`,
      `  "configHash": "${generation.configHash}",`,
      `  "generationId": "${generation.generationId}",`,
      `  "nodeVersion": "${generation.nodeVersion}",`,
      `  "npmIntegrity": "${OPENCLAW_COMPATIBILITY_SET.npmIntegrity}",`,
      `  "npmShasum": "${OPENCLAW_COMPATIBILITY_SET.npmShasum}",`,
      `  "openclawCommit": "${OPENCLAW_COMPATIBILITY_SET.openclawCommit}",`,
      `  "openclawVersion": "${generation.openclawVersion}",`,
      `  "paths": {`,
      `    "config": "${configFileName}",`,
      `    "proofSkill": "${openClawProofSkillRelativePath}",`,
      `    "soul": "${openClawSoulRelativePath}"`,
      `  },`,
      `  "proofSkillSha256": "${generation.proofSkillHash}",`,
      `  "soulSha256": "${generation.soulHash}"`,
      "}",
    ],
    "\n"
  )}\n`;

/**
 * Build the deterministic length-delimited generation bundle hash.
 *
 * **Example** (Hash a bundle from zero hashes)
 * ```ts
 * import { makeOpenClawBundleHash, OpenClawBundleHashInput } from "@beep/infra-hosts/OpenClawGeneration"
 * import { OpenclawSha256Hex } from "@beep/openclaw"
 *
 * import * as Effect from "effect/Effect"
 *
 * const zeroHash = OpenclawSha256Hex.make("0".repeat(64))
 * const bundleHash = makeOpenClawBundleHash(
 *   OpenClawBundleHashInput.make({
 *     configHash: zeroHash,
 *     proofSkillHash: zeroHash,
 *     soulHash: zeroHash
 *   })
 * )
 * console.log(Effect.isEffect(bundleHash))
 * // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOpenClawBundleHash: (
  input: OpenClawBundleHashInput
) => Effect.Effect<OpenclawSha256Hex, PlatformError, Digest.Digest> = Effect.fn($I`makeOpenClawBundleHash`)(function* (
  input: OpenClawBundleHashInput
) {
  const crypto = yield* Digest.Digest;
  const compatibilityId = `${OPENCLAW_COMPATIBILITY_SET.adapterVersion}:${OPENCLAW_COMPATIBILITY_SET.openclawVersion}:${OPENCLAW_COMPATIBILITY_SET.openclawCommit}:${OPENCLAW_COMPATIBILITY_SET.nodeVersion}`;
  const bytes = A.reduce(
    [input.configHash, input.soulHash, input.proofSkillHash, compatibilityId],
    new Uint8Array(),
    (accumulated, part) => {
      const encoded = utf8.encode(part);
      const prefix = utf8.encode(`${encoded.byteLength}:`);
      const next = new Uint8Array(accumulated.byteLength + prefix.byteLength + encoded.byteLength);
      next.set(accumulated, 0);
      next.set(prefix, accumulated.byteLength);
      next.set(encoded, accumulated.byteLength + prefix.byteLength);
      return next;
    }
  );
  const digest = yield* crypto.digest(Digest.sha256, bytes);
  return OpenclawSha256Hex.make(Hex.encode(digest));
});

/**
 * Build the content-addressed generation described by stack args.
 *
 * **Details**
 *
 * The driver render adapter turns the deployment config into canonical
 * `openclaw.json` bytes, then the config and immutable workspace artifact
 * hashes become one length-delimited generation identity. Hashing requires
 * `Digest`.
 *
 * **Example** (Build a generation effect)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const generation = makeOpenClawGeneration(args)
 * console.log(Effect.isEffect(generation))
 * // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOpenClawGeneration: (
  args: OpenClawStackArgs
) => Effect.Effect<OpenClawGeneration, PlatformError, Digest.Digest> = Effect.fn($I`makeOpenClawGeneration`)(function* (
  args: OpenClawStackArgs
) {
  const intent = yield* makeOpenClawDeploymentIntent(
    OpenClawDeploymentConfig.make(args.deployment),
    args.paths.configRoot
  );
  const rendered = yield* renderOpenclawConfig(intent);
  const sha256Hex1 = yield* sha256Hex(openClawLegalSoulMarkdown);
  const soulHash = OpenclawSha256Hex.make(sha256Hex1);
  const sha256Hex2 = yield* sha256Hex(openClawProofSkillMarkdown);
  const proofSkillHash = OpenclawSha256Hex.make(sha256Hex2);
  return OpenClawGeneration.make({
    agentId: args.deployment.agentId,
    canonicalJson: rendered.canonicalJson,
    configRoot: args.paths.configRoot,
    configHash: rendered.contentHash,
    gatewayPort: args.deployment.gatewayPort,
    generationId: yield* makeOpenClawBundleHash(
      OpenClawBundleHashInput.make({ configHash: rendered.contentHash, proofSkillHash, soulHash })
    ),
    home: args.identity.home,
    hostedModelId: args.deployment.hostedProvider.modelId,
    hostedProviderId: args.deployment.hostedProvider.providerId,
    localBaseUrl: args.deployment.localProvider.baseUrl,
    localModelId: args.deployment.localProvider.modelId,
    logFilePath: args.deployment.logFilePath,
    nodeBinDir: args.paths.nodeBinDir,
    nodeVersion: OPENCLAW_COMPATIBILITY_SET.nodeVersion,
    openclawVersion: args.deployment.openclawVersion,
    opBinaryPath: args.deployment.resolverOpBinaryPath,
    proofSkillHash,
    proofSkillMarkdown: openClawProofSkillMarkdown,
    runtimeDir: args.identity.runtimeDir,
    stateDir: args.paths.stateDir,
    soulHash,
    soulMarkdown: openClawLegalSoulMarkdown,
    unitName: args.paths.unitName,
    workspace: `${args.paths.configRoot}/${generationPointerName}/workspace`,
  });
});

/**
 * Render the `systemd --user` unit for a generation.
 *
 * **Details**
 *
 * The unit never names a generation directory: it points at the
 * `<configRoot>/current` symlink so a pointer switch also switches binaries.
 * `UnsetEnvironment` strips inherited 1Password and gateway credentials from
 * the manager environment, and the scoped 1Password service-account token
 * arrives exclusively through `LoadCredential`.
 *
 * **Example** (Render the systemd unit)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs, renderOpenClawUnit } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const unit = renderOpenClawUnit(Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))))
 * console.log(unit.startsWith("# BEEP_OPENCLAW_MANAGED")) // true
 * ```
 *
 * @param generation - The rendered OpenClaw generation.
 * @returns The systemd unit text.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawUnit = (generation: OpenClawGeneration): string =>
  `${A.join(
    [
      unitOwnershipMarker,
      "[Unit]",
      `Description=OpenClaw workstation gateway (beep-managed generation ${generation.generationId})`,
      "After=network-online.target",
      "Wants=network-online.target",
      "",
      "[Service]",
      "Type=simple",
      `Environment=PATH=${generation.nodeBinDir}:/usr/bin:/bin`,
      `Environment=HOME=${generation.home}`,
      `Environment=OPENCLAW_CONFIG_PATH=${activeConfigPath(generation)}`,
      `Environment=OPENCLAW_STATE_DIR=${generation.stateDir}`,
      "Environment=OPENCLAW_NIX_MODE=1",
      `LoadCredential=op-service-account-token:${opServiceAccountCredentialPath}`,
      "UnsetEnvironment=OP_SERVICE_ACCOUNT_TOKEN OP_SESSION OP_CONNECT_TOKEN OPENCLAW_GATEWAY_TOKEN",
      `ExecStartPre=${pointerPath(generation)}/${runScriptFileName} preflight`,
      `ExecStart=${pointerPath(generation)}/${runScriptFileName}`,
      "Restart=no",
      `StandardOutput=append:${generation.logFilePath}`,
      `StandardError=append:${generation.logFilePath}`,
      "",
      "[Install]",
      "WantedBy=default.target",
    ],
    "\n"
  )}\n`;

/**
 * Render the generation entrypoint `run.sh`.
 *
 * **Details**
 *
 * The script resolves its own real path, so invoking it through the `current`
 * symlink still execs the binary staged inside the generation it resolves to.
 * `preflight` validates the generation's config with its own binary;
 * `gateway` (the default) starts the gateway.
 *
 * **Example** (Render the run script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs, renderOpenClawRunScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const runScript = renderOpenClawRunScript(Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))))
 * console.log(runScript.includes("config validate")) // true
 * ```
 *
 * @param generation - The rendered OpenClaw generation.
 * @returns The `run.sh` text.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawRunScript = (generation: OpenClawGeneration): string =>
  `${A.join(
    [
      "#!/usr/bin/env bash",
      unitOwnershipMarker,
      "set -euo pipefail",
      'generation_dir="$(dirname "$(readlink -f "$0")")"',
      'openclaw_bin="${generation_dir}/node_modules/.bin/openclaw"',
      `export OPENCLAW_CONFIG_PATH="\${generation_dir}/${configFileName}"`,
      `export OPENCLAW_STATE_DIR=${shellQuote(generation.stateDir)}`,
      "export OPENCLAW_NIX_MODE=1",
      "unset OP_SERVICE_ACCOUNT_TOKEN OP_SESSION OP_CONNECT_TOKEN OPENCLAW_GATEWAY_TOKEN",
      'credential_file="${CREDENTIALS_DIRECTORY:?systemd credentials directory is required}/op-service-account-token"',
      "[ -r \"${credential_file}\" ] || { printf 'missing op-service-account-token credential\\n' >&2; exit 78; }",
      'export OP_SERVICE_ACCOUNT_TOKEN="$(cat "${credential_file}")"',
      'case "${1:-gateway}" in',
      "  preflight)",
      `    op_binary=${shellQuote(generation.opBinaryPath)}`,
      '    "${op_binary}" whoami >/dev/null',
      '    exec "${openclaw_bin}" config validate',
      "    ;;",
      '  gateway) exec "${openclaw_bin}" gateway ;;',
      "  *)",
      "    printf 'unsupported run.sh mode: %s\\n' \"${1}\" >&2",
      "    exit 64",
      "    ;;",
      "esac",
    ],
    "\n"
  )}\n`;

/**
 * Render one generation file with its content and materialization mode.
 *
 * **Example** (Build a generation file)
 * ```ts
 * import { OpenClawGenerationFile } from "@beep/infra-hosts/OpenClawGeneration"
 *
 * const file = OpenClawGenerationFile.make({ content: "{}\n", mode: "0644" })
 * console.log(file.mode) // "0644"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawGenerationFile extends S.Opaque<OpenClawGenerationFile, { readonly brand: unique symbol }>()(
  S.Struct({
    content: S.String.annotateKey({
      description: "Exact bytes written into the generation directory.",
    }),
    mode: OpenClawFileMode.annotateKey({
      description: "Filesystem mode the file is materialized with.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawGenerationFile", {
      description: "One rendered OpenClaw generation file with its materialization mode.",
    })
  )
) {}

/**
 * Render the complete generation tree as pure data.
 *
 * **Details**
 *
 * Keys are paths relative to `<configRoot>/<generationId>/`. The applicator —
 * not this function — materializes them, which keeps generation rendering
 * testable without a filesystem and reusable by a future remote applicator.
 *
 * **Example** (Render the generation tree)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs, renderOpenClawGenerationTree } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const tree = renderOpenClawGenerationTree(Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))))
 * console.log(tree["run.sh"]?.mode) // "0755"
 * ```
 *
 * @param generation - The rendered OpenClaw generation.
 * @returns Every generation file with its path and mode.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawGenerationTree = (
  generation: OpenClawGeneration
): Record<string, OpenClawGenerationFile> => ({
  [configFileName]: OpenClawGenerationFile.make({ content: generation.canonicalJson, mode: "0644" }),
  [manifestFileName]: OpenClawGenerationFile.make({ content: renderGenerationManifest(generation), mode: "0644" }),
  [openClawProofSkillRelativePath]: OpenClawGenerationFile.make({
    content: generation.proofSkillMarkdown,
    mode: "0644",
  }),
  [openClawSoulRelativePath]: OpenClawGenerationFile.make({ content: generation.soulMarkdown, mode: "0644" }),
  [runScriptFileName]: OpenClawGenerationFile.make({
    content: renderOpenClawRunScript(generation),
    mode: "0755",
  }),
});

/**
 * Render the preflight script that must pass before any mutation.
 *
 * **Details**
 *
 * Identity binding fails closed: an unreadable target value or an empty
 * expectation refuses the apply rather than passing on a vacuous match. Bus
 * reachability is a real round-trip (`systemctl --user show`), not
 * `is-system-running`, whose non-zero `degraded` exit is normal on healthy
 * desktops; the manager state is recorded and only rejected outside
 * `running|degraded|maintenance|starting`.
 *
 * **Example** (Render the preflight script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawGenerationIdentityScriptInput, OpenClawStackArgs, renderOpenClawPreflightScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const identity = args.identity
 * const script = renderOpenClawPreflightScript(
 *   OpenClawGenerationIdentityScriptInput.make({
 *     generation: Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))),
 *     identity
 *   })
 * )
 * console.log(script.includes("PREFLIGHT-OK")) // true
 * ```
 *
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawPreflightScript = ({
  generation,
  identity,
}: OpenClawGenerationIdentityScriptInput): string =>
  bashScript([
    ...scriptPreamble(OpenClawGeneration.make(generation)),
    "fail() { printf 'PREFLIGHT-FAIL: %s\\n' \"$1\" >&2; exit 78; }",
    ...A.map(
      ["curl", "install", "loginctl", "sha256sum", "sqlite3", "systemctl"],
      (binary) => `command -v ${binary} >/dev/null || fail ${shellQuote(`${binary} is not installed on the target`)}`
    ),
    // `sudo` is asserted as the real setuid-root binary at its absolute path rather than by name:
    // a name lookup is satisfied by any shim earlier on PATH, which is precisely what the
    // privileged scripts must never call.
    "[ -u /usr/bin/sudo ] || fail '/usr/bin/sudo is missing or not setuid root'",
    ...A.flatMap(identityChecks(OpenClawExpectedIdentity.make(identity)), identityAssertionLines),
    `linger="$(loginctl show-user ${shellQuote(identity.username)} -p Linger --value || printf '')"`,
    `[ "\${linger}" = yes ] || fail "linger not enabled for ${identity.username} (Linger=\${linger})"`,
    `[ -d "\${XDG_RUNTIME_DIR}" ] || fail "runtime dir \${XDG_RUNTIME_DIR} missing"`,
    "units_load_timestamp=\"$(systemctl --user show -p UnitsLoadTimestampMonotonic --value)\" || fail 'user bus round-trip failed (systemctl --user show)'",
    "[ -n \"${units_load_timestamp}\" ] || fail 'user bus round-trip returned no UnitsLoadTimestampMonotonic (failing closed)'",
    'manager_state="$(systemctl --user is-system-running 2>&1 || true)"',
    'case "${manager_state}" in',
    "  running|degraded|maintenance|starting) : ;;",
    '  *) fail "user manager unreachable (state=${manager_state})" ;;',
    "esac",
    `for candidate in ${A.join(
      A.map(
        [
          activeConfigPath(OpenClawGeneration.make(generation)),
          generationDir(OpenClawGeneration.make(generation)),
          generation.stateDir,
          `${generation.runtimeDir}/bus`,
        ],
        shellQuote
      ),
      " "
    )}; do`,
    `  [ "\${#candidate}" -lt ${String(unixSocketPathLimit)} ] || fail "path exceeds the ${String(
      unixSocketPathLimit
    )}-byte UNIX socket cap: \${candidate}"`,
    "done",
    `/usr/bin/sudo -n -v 2>/dev/null || fail ${shellQuote(
      "no armed sudo ticket; re-run alchemy deploy inside an armed pty (ops/handoffs/sudo-session.sh) so privileged steps stay non-interactive"
    )}`,
    `printf 'PREFLIGHT-OK generation=${generation.generationId} machine=%s host=%s uid=%s home=%s runtime=%s linger=%s units_load=%s manager=%s\\n' "\${actual_expected_machine_id}" "\${actual_expected_hostname}" "\${actual_expected_uid}" "\${actual_expected_home}" "\${XDG_RUNTIME_DIR}" "\${linger}" "\${units_load_timestamp}" "\${manager_state}"`,
  ]);

/**
 * Guard lines proving the Node toolchain the privileged staging step executes is root-owned.
 *
 * **Details**
 *
 * Staging runs `npm install` under `sudo`, so every path that decides which `npm` and `node`
 * actually execute is inside the root trust boundary. Each candidate is fully resolved with
 * `readlink -f` (which collapses every symlink component) and then walked to `/`, requiring each
 * component to be uid 0 and not group- or world-writable. `--ignore-scripts` is no defense when
 * the package manager binary itself is writable, and the pinned `npm` is commonly a wrapper that
 * execs a sibling `node`, so the directory and both binaries are proven, not just `npm`.
 *
 * @param generation - The rendered OpenClaw generation.
 * @returns The guard script lines.
 */
const trustedToolchainLines = (generation: OpenClawGeneration): ReadonlyArray<string> => [
  "fail() { printf 'STAGE-FAIL: %s\\n' \"$1\" >&2; exit 73; }",
  "assert_trusted_path() {",
  '  probe="$1"',
  '  label="$2"',
  "  while :; do",
  '    metadata="$(/usr/bin/stat -c \'%u %a\' "${probe}")" || fail "cannot inspect ${label}: ${probe}"',
  '    owner="${metadata%% *}"',
  '    mode="${metadata##* }"',
  '    [ "${owner}" = 0 ] || fail "${label} is not root-owned: ${probe}"',
  // Both operands are written `8#` explicitly: a bare `022` is octal in bash but decimal in some
  // other shells, and this comparison decides whether root executes an attacker-writable binary.
  '    [ "$(( 8#${mode} & 8#22 ))" -eq 0 ] || fail "${label} is group- or world-writable: ${probe}"',
  '    if [ "${probe}" = / ]; then break; fi',
  '    probe="$(/usr/bin/dirname "${probe}")"',
  "  done",
  "}",
  `node_dir="$(/usr/bin/readlink -f ${shellQuote(
    generation.nodeBinDir
  )})" || fail 'cannot resolve the pinned node bin dir'`,
  `node_bin="$(/usr/bin/readlink -f ${shellQuote(
    `${generation.nodeBinDir}/node`
  )})" || fail 'cannot resolve the pinned node binary'`,
  `npm_bin="$(/usr/bin/readlink -f ${shellQuote(
    `${generation.nodeBinDir}/npm`
  )})" || fail 'cannot resolve the pinned npm binary'`,
  "[ -x \"${node_bin}\" ] || fail 'the pinned node binary is not executable'",
  "[ -x \"${npm_bin}\" ] || fail 'the pinned npm binary is not executable'",
  "assert_trusted_path \"${node_dir}\" 'pinned node bin dir'",
  "assert_trusted_path \"${node_bin}\" 'pinned node binary'",
  "assert_trusted_path \"${npm_bin}\" 'pinned npm binary'",
];

/**
 * Render the staging script that materializes a generation tree.
 *
 * **Details**
 *
 * Staging is side-by-side and never touches the live pointer: the generation
 * directory is created root-owned with exact modes, the pinned OpenClaw
 * release is installed into it, the unit file is written, and the candidate
 * config is validated by the candidate's own binary before apply is allowed to
 * proceed.
 *
 * **Example** (Render the stage script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs, renderOpenClawStageScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const script = renderOpenClawStageScript(Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))))
 * console.log(script.includes("STAGE-OK")) // true
 * ```
 *
 * @param generation - The rendered OpenClaw generation.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawStageScript = (generation: OpenClawGeneration): string => {
  const tree = renderOpenClawGenerationTree(generation);
  const stagedFiles = [
    { relativePath: configFileName, sentinel: configHeredocSentinel },
    { relativePath: manifestFileName, sentinel: manifestHeredocSentinel },
    { relativePath: openClawSoulRelativePath, sentinel: soulHeredocSentinel },
    { relativePath: openClawProofSkillRelativePath, sentinel: proofSkillHeredocSentinel },
    { relativePath: runScriptFileName, sentinel: runScriptHeredocSentinel },
  ];

  return bashScript([
    ...scriptPreamble(generation),
    ...trustedToolchainLines(generation),
    `[ ! -L ${shellQuote(generation.configRoot)} ] || { printf 'STAGE-FAIL: symlink parent %s\\n' ${shellQuote(
      generation.configRoot
    )} >&2; exit 73; }`,
    `/usr/bin/sudo -n install -d -o root -g root -m 0755 ${shellQuote(generation.configRoot)}`,
    ...heredocLines({
      content: "beep-openclaw\n",
      install: "/usr/bin/sudo -n install -o root -g root -m 0644",
      path: `${generation.configRoot}/.beep-openclaw`,
      sentinel: "BEEP_OPENCLAW_MARKER",
    }),
    `for parent in ${A.join(
      A.map(
        [
          generation.configRoot,
          generationDir(generation),
          `${generationDir(generation)}/workspace`,
          `${generationDir(generation)}/workspace/skills`,
          `${generationDir(generation)}/workspace/skills/${proofSkillName}`,
        ],
        shellQuote
      ),
      " "
    )}; do [ ! -L "\${parent}" ] || { printf 'STAGE-FAIL: symlink parent %s\\n' "\${parent}" >&2; exit 73; }; done`,
    `/usr/bin/sudo -n install -d -o root -g root -m 0755 ${shellQuote(generationDir(generation))}`,
    `/usr/bin/sudo -n install -d -o root -g root -m 0755 ${shellQuote(`${generationDir(generation)}/workspace`)}`,
    `/usr/bin/sudo -n install -d -o root -g root -m 0755 ${shellQuote(`${generationDir(generation)}/workspace/skills`)}`,
    `/usr/bin/sudo -n install -d -o root -g root -m 0755 ${shellQuote(
      `${generationDir(generation)}/workspace/skills/${proofSkillName}`
    )}`,
    ...A.flatten(
      A.getSomes(
        A.map(stagedFiles, ({ relativePath, sentinel }) =>
          O.map(R.get(tree, relativePath), (file) =>
            heredocLines({
              content: file.content,
              install: `/usr/bin/sudo -n install -o root -g root -m ${file.mode}`,
              path: `${generationDir(generation)}/${relativePath}`,
              sentinel,
            })
          )
        )
      )
    ),
    `/usr/bin/sudo -n env PATH=${shellQuote(
      `${generation.nodeBinDir}:/usr/bin:/bin`
    )} "\${npm_bin}" install --prefix ${shellQuote(
      generationDir(generation)
    )} --no-audit --no-fund --ignore-scripts ${shellQuote(`openclaw@${generation.openclawVersion}`)} >/dev/null`,
    `staged_version="$(/usr/bin/sudo -n cat ${shellQuote(
      `${generationDir(generation)}/node_modules/openclaw/package.json`
    )} | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' | head -n 1)"`,
    `[ "\${staged_version}" = ${shellQuote(generation.openclawVersion)} ] || { printf 'STAGE-FAIL: staged openclaw %s does not match the pinned %s\\n' "\${staged_version}" ${shellQuote(
      generation.openclawVersion
    )} >&2; exit 73; }`,
    `install -d -m 0755 ${shellQuote(`${generation.home}/.config/systemd/user`)}`,
    ...heredocLines({
      content: renderOpenClawUnit(generation),
      install: "install -m 0644",
      path: unitPath(generation),
      sentinel: unitHeredocSentinel,
    }),
    `env -i PATH=${shellQuote(`${generation.nodeBinDir}:/usr/bin:/bin`)} HOME=${shellQuote(
      generation.home
    )} OPENCLAW_CONFIG_PATH=${shellQuote(`${generationDir(generation)}/${configFileName}`)} OPENCLAW_STATE_DIR=${shellQuote(
      generation.stateDir
    )} OPENCLAW_NIX_MODE=1 ${shellQuote(stagedOpenclawBinary(generation))} config validate`,
    `printf 'STAGE-OK generation=${generation.generationId} openclaw=%s\\n' "\${staged_version}"`,
  ]);
};

/**
 * Render the staged apply script that switches the active generation.
 *
 * **Details**
 *
 * The sequence is fixed and every step is recoverable: stop, snapshot the
 * stopped state with `cp -a` (so SQLite WAL and shm sidecars are captured
 * consistently), record the prior pointer, flip the pointer atomically with
 * `ln -s` plus `mv -T`, `daemon-reload`, start, wait a bounded 30 seconds for
 * `/health`, then write the commit marker. Any failure after the snapshot
 * restores both the snapshot and the prior pointer. A downgrade guard refuses
 * up front to start a generation whose recorded `PRAGMA user_version` is older
 * than the live state, because an old binary cannot safely open migrated
 * state.
 *
 * **Example** (Render the apply script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs, renderOpenClawApplyScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const script = renderOpenClawApplyScript(Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))))
 * console.log(script.includes("APPLY-OK")) // true
 * ```
 *
 * @param generation - The rendered OpenClaw generation.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawApplyScript = (generation: OpenClawGeneration): string =>
  bashScript([
    ...scriptPreamble(generation),
    ...switchScriptBindings(generation),
    `state_db=${shellQuote(stateDatabasePath(generation))}`,
    `recorded_stamp=${shellQuote(`${generationDir(generation)}/${stateUserVersionFileName}`)}`,
    "state_user_version() {",
    '  [ -f "${state_db}" ] || { printf 0; return 0; }',
    "  sqlite3 \"file:${state_db}?mode=ro\" 'PRAGMA user_version;' 2>/dev/null || printf 0",
    "}",
    'prior_pointer="$(readlink "${pointer}" 2>/dev/null || printf \'\')"',
    'live_user_version="$(state_user_version)"',
    'if [ -f "${recorded_stamp}" ]; then',
    '  candidate_user_version="$(tr -d \'[:space:]\' < "${recorded_stamp}")"',
    "  printf '%s' \"${candidate_user_version}\" | grep -Eq '^[0-9]+$' || { printf 'APPLY-REFUSED: downgrade guard read a malformed recorded user_version %s\\n' \"${candidate_user_version}\" >&2; exit 75; }",
    '  if [ "${candidate_user_version}" -lt "${live_user_version}" ]; then',
    `    printf 'APPLY-REFUSED: downgrade guard — generation ${generation.generationId} recorded PRAGMA user_version=%s but live state is %s; restore a snapshot before switching\\n' "\${candidate_user_version}" "\${live_user_version}" >&2`,
    "    exit 75",
    "  fi",
    "fi",
    "restore_snapshot() {",
    '  printf \'APPLY-ROLLBACK: restoring snapshot %s and prior pointer %s\\n\' "${snapshot}" "${prior_pointer}" >&2',
    '  systemctl --user stop "${unit}" || true',
    '  if [ -d "${snapshot}" ]; then',
    '    /usr/bin/sudo -n rm -rf -- "${state_dir}"',
    '    /usr/bin/sudo -n cp -a -- "${snapshot}" "${state_dir}"',
    "  fi",
    '  if [ -n "${prior_pointer}" ]; then',
    '    /usr/bin/sudo -n ln -s -- "${prior_pointer}" "${pointer}.rollback.$$"',
    '    /usr/bin/sudo -n mv -T -- "${pointer}.rollback.$$" "${pointer}"',
    "  fi",
    "  systemctl --user daemon-reload || true",
    '  systemctl --user start "${unit}" || true',
    "}",
    'systemctl --user stop "${unit}" || true',
    `/usr/bin/sudo -n install -d -o root -g root -m 0700 ${shellQuote(`${generation.configRoot}/${snapshotsDirName}`)}`,
    '/usr/bin/sudo -n rm -rf -- "${snapshot}"',
    'if [ -d "${state_dir}" ]; then',
    '  /usr/bin/sudo -n cp -a -- "${state_dir}" "${snapshot}"',
    "else",
    '  /usr/bin/sudo -n install -d -o root -g root -m 0700 "${snapshot}"',
    "fi",
    'printf \'APPLY-SNAPSHOT: %s -> %s (stopped state, includes SQLite WAL sidecars)\\n\' "${state_dir}" "${snapshot}"',
    'printf \'%s\\n\' "${prior_pointer}" | /usr/bin/sudo -n install -o root -g root -m 0644 /dev/stdin "${previous_pointer_file}"',
    `/usr/bin/sudo -n ln -s -- ${shellQuote(generation.generationId)} "\${pointer}.tmp.$$"`,
    '/usr/bin/sudo -n mv -T -- "${pointer}.tmp.$$" "${pointer}"',
    'printf \'APPLY-POINTER: current -> %s\\n\' "$(readlink "${pointer}")"',
    "systemctl --user daemon-reload",
    'if ! systemctl --user start "${unit}"; then',
    '  journalctl --user -u "${unit}" -n 80 --no-pager || true',
    "  restore_snapshot",
    "  printf 'APPLY-FAIL: unit failed to start; snapshot and prior pointer restored\\n' >&2",
    "  exit 70",
    "fi",
    "healthy=0",
    `for attempt in $(seq 1 ${String(healthWaitAttempts)}); do`,
    `  if curl -fsS -o /dev/null --max-time 3 ${shellQuote(healthUrl(generation))}; then`,
    "    healthy=1",
    "    break",
    "  fi",
    "  sleep 1",
    "done",
    'if [ "${healthy}" -ne 1 ]; then',
    '  journalctl --user -u "${unit}" -n 80 --no-pager || true',
    "  restore_snapshot",
    `  printf 'APPLY-FAIL: ${healthUrl(generation)} never succeeded within ${String(
      healthWaitAttempts
    )}s; snapshot and prior pointer restored\\n' >&2`,
    "  exit 70",
    "fi",
    'printf \'%s\\n\' "$(state_user_version)" | /usr/bin/sudo -n install -o root -g root -m 0644 /dev/stdin "${recorded_stamp}"',
    `printf '%s\\n' ${shellQuote(generation.generationId)} | /usr/bin/sudo -n install -o root -g root -m 0644 /dev/stdin ${shellQuote(
      `${generationDir(generation)}/.beep-openclaw-committed`
    )}`,
    `printf 'APPLY-OK generation=${generation.generationId} pointer=%s user_version=%s\\n' "$(readlink "\${pointer}")" "$(state_user_version)"`,
  ]);

/**
 * Render the operator rollback script for a committed generation.
 *
 * **Details**
 *
 * Rollback is the apply failure path made explicit: stop, restore the
 * generation's stopped-state snapshot, return the pointer to the recorded
 * previous generation, reload, start, and wait for `/health`. It restores
 * state before switching binaries, which is exactly what makes starting the
 * older binary safe.
 *
 * **Example** (Render the rollback script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs, renderOpenClawRollbackScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const script = renderOpenClawRollbackScript(Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))))
 * console.log(script.includes("ROLLBACK-OK")) // true
 * ```
 *
 * @param generation - The rendered OpenClaw generation.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawRollbackScript = (generation: OpenClawGeneration): string =>
  bashScript([
    ...scriptPreamble(generation),
    ...switchScriptBindings(generation),
    '[ -d "${snapshot}" ] || { printf \'ROLLBACK-FAIL: no snapshot at %s\\n\' "${snapshot}" >&2; exit 66; }',
    '[ -f "${previous_pointer_file}" ] || { printf \'ROLLBACK-FAIL: no recorded previous pointer at %s\\n\' "${previous_pointer_file}" >&2; exit 66; }',
    'previous_pointer="$(tr -d \'[:space:]\' < "${previous_pointer_file}")"',
    "[ -n \"${previous_pointer}\" ] || { printf 'ROLLBACK-FAIL: recorded previous pointer is empty\\n' >&2; exit 66; }",
    'systemctl --user stop "${unit}" || true',
    '/usr/bin/sudo -n rm -rf -- "${state_dir}"',
    '/usr/bin/sudo -n cp -a -- "${snapshot}" "${state_dir}"',
    'printf \'ROLLBACK-RESTORE: %s -> %s\\n\' "${snapshot}" "${state_dir}"',
    '/usr/bin/sudo -n ln -s -- "${previous_pointer}" "${pointer}.rollback.$$"',
    '/usr/bin/sudo -n mv -T -- "${pointer}.rollback.$$" "${pointer}"',
    "systemctl --user daemon-reload",
    'systemctl --user start "${unit}"',
    "healthy=0",
    `for attempt in $(seq 1 ${String(healthWaitAttempts)}); do`,
    `  if curl -fsS -o /dev/null --max-time 3 ${shellQuote(healthUrl(generation))}; then`,
    "    healthy=1",
    "    break",
    "  fi",
    "  sleep 1",
    "done",
    '[ "${healthy}" -eq 1 ] || { journalctl --user -u "${unit}" -n 80 --no-pager || true; printf \'ROLLBACK-FAIL: restored generation never became healthy\\n\' >&2; exit 70; }',
    'printf \'ROLLBACK-OK pointer=%s\\n\' "$(readlink "${pointer}")"',
  ]);

const driftAuditLines = (input: OpenClawGenerationIdentityScriptInput): ReadonlyArray<string> => {
  const generation = input.generation;

  return [
    "drift_alerts=0",
    "alert() {",
    `  printf '${driftAlertPrefix} %s expected=%s actual=%s\\n' "$1" "$2" "$3"`,
    "  drift_alerts=$((drift_alerts + 1))",
    "}",
    `pointer_target="$(readlink ${shellQuote(pointerPath(OpenClawGeneration.make(generation)))} 2>/dev/null || printf 'absent')"`,
    `[ "\${pointer_target}" = ${shellQuote(
      generation.generationId
    )} ] || alert generation-pointer ${shellQuote(generation.generationId)} "\${pointer_target}"`,
    `installed_openclaw="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' ${shellQuote(
      `${generationDir(OpenClawGeneration.make(generation))}/node_modules/openclaw/package.json`
    )} 2>/dev/null | head -n 1 || printf 'absent')"`,
    `[ "\${installed_openclaw}" = ${shellQuote(
      generation.openclawVersion
    )} ] || alert openclaw-version ${shellQuote(generation.openclawVersion)} "\${installed_openclaw:-absent}"`,
    `installed_node="$(${shellQuote(`${generation.nodeBinDir}/node`)} --version 2>/dev/null | tr -d 'v' || printf 'absent')"`,
    `[ "\${installed_node}" = ${shellQuote(
      generation.nodeVersion
    )} ] || alert node-version ${shellQuote(generation.nodeVersion)} "\${installed_node:-absent}"`,
    `unit_sha="$(sha256sum ${shellQuote(unitPath(OpenClawGeneration.make(generation)))} 2>/dev/null | cut -d' ' -f1 || printf 'absent')"`,
    // `$(...)` strips the trailing newline the heredoc carried, so the digest is
    // taken over the text plus the single newline the installed unit file ends with.
    "expected_unit_sha=\"$(printf '%s\\n' \"${expected_unit_text}\" | sha256sum | cut -d' ' -f1)\"",
    '[ "${unit_sha}" = "${expected_unit_sha}" ] || alert unit-content "${expected_unit_sha}" "${unit_sha:-absent}"',
    `unit_enabled="$(systemctl --user is-enabled ${shellQuote(generation.unitName)} 2>&1 || true)"`,
    `[ "\${unit_enabled}" = enabled ] || alert unit-enabled enabled "\${unit_enabled}"`,
    `unit_active="$(systemctl --user is-active ${shellQuote(generation.unitName)} 2>&1 || true)"`,
    `[ "\${unit_active}" = active ] || alert unit-active active "\${unit_active}"`,
    `config_sha="$(sha256sum ${shellQuote(activeConfigPath(OpenClawGeneration.make(generation)))} 2>/dev/null | cut -d' ' -f1 || printf 'absent')"`,
    `[ "\${config_sha}" = ${shellQuote(
      generation.configHash
    )} ] || alert config-hash ${shellQuote(generation.configHash)} "\${config_sha:-absent}"`,
    // Mode comparison uses stat's octal form so the numeric encodings systemd and
    // stat report for the same permissions (33188 vs 420) can never read as drift.
    `config_mode="$(stat -c '%a' ${shellQuote(activeConfigPath(OpenClawGeneration.make(generation)))} 2>/dev/null || printf 'absent')"`,
    `[ "\${config_mode}" = 644 ] || alert config-mode 644 "\${config_mode}"`,
    `run_mode="$(stat -c '%a' ${shellQuote(
      `${pointerPath(OpenClawGeneration.make(generation))}/${runScriptFileName}`
    )} 2>/dev/null || printf 'absent')"`,
    `[ "\${run_mode}" = 755 ] || alert run-script-mode 755 "\${run_mode}"`,
    `if env -i PATH=${shellQuote(`${generation.nodeBinDir}:/usr/bin:/bin`)} HOME=${shellQuote(
      generation.home
    )} OPENCLAW_CONFIG_PATH=${shellQuote(activeConfigPath(OpenClawGeneration.make(generation)))} OPENCLAW_STATE_DIR=${shellQuote(
      generation.stateDir
    )} OPENCLAW_NIX_MODE=1 ${shellQuote(
      `${pointerPath(OpenClawGeneration.make(generation))}/node_modules/.bin/openclaw`
    )} config validate >/dev/null 2>&1; then`,
    "  config_validate=ok",
    "else",
    "  config_validate=failed",
    "fi",
    '[ "${config_validate}" = ok ] || alert config-validate ok "${config_validate}"',
    ...A.flatMap(identityChecks(OpenClawExpectedIdentity.make(input.identity)), (check) => [
      `observed_${check.variable}="$(${check.actual} 2>/dev/null || printf 'unreadable')"`,
      `[ "\${observed_${check.variable}}" = ${shellQuote(check.expected)} ] || alert identity-${Str.replace(
        / /gu,
        "-"
      )(check.label)} ${shellQuote(check.expected)} "\${observed_${check.variable}}"`,
    ]),
    `printf 'DRIFT-AUDIT-COMPLETE generation=${generation.generationId} alerts=%s\\n' "\${drift_alerts}"`,
  ];
};

const expectedUnitTextLines = (generation: OpenClawGeneration): ReadonlyArray<string> => [
  `expected_unit_text="$(cat <<'${unitHeredocSentinel}'`,
  Str.trimEnd(renderOpenClawUnit(generation)),
  unitHeredocSentinel,
  ')"',
];

/**
 * Render the read-only drift audit script.
 *
 * **Details**
 *
 * The audit deliberately lives outside the `command.local.Command` graph:
 * command resources skip execution during preview and expose no refresh, so
 * they can never be the drift detector. It mutates nothing, always exits zero,
 * and reports each divergence as an `ALERT: OPENCLAW_CONFIG_DRIFT` line —
 * repair is an operator redeploy, never an automatic correction.
 *
 * **Example** (Render the drift audit script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawGenerationIdentityScriptInput, OpenClawStackArgs, renderOpenClawDriftAuditScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const identity = args.identity
 * const script = renderOpenClawDriftAuditScript(
 *   OpenClawGenerationIdentityScriptInput.make({
 *     generation: Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))),
 *     identity
 *   })
 * )
 * console.log(script.includes("ALERT: OPENCLAW_CONFIG_DRIFT")) // true
 * ```
 *
 * @param input - The generation and the declared workstation identity it is bound to.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawDriftAuditScript = (input: OpenClawGenerationIdentityScriptInput): string =>
  bashScript([
    "set -uo pipefail",
    trustedBasePath,
    ...expectedUnitTextLines(OpenClawGeneration.make(input.generation)),
    ...driftAuditLines(input),
    "exit 0",
  ]);

/**
 * Render the acceptance probe script run after a successful apply.
 *
 * **Details**
 *
 * Probes are alert-only: they exercise the gateway health and channel
 * surfaces, then fold in the read-only drift inventory so a single command
 * output carries both acceptance evidence and the post-apply drift picture.
 *
 * **Example** (Render the probe script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawGenerationIdentityScriptInput, OpenClawStackArgs, renderOpenClawProbeScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const identity = args.identity
 * const script = renderOpenClawProbeScript(
 *   OpenClawGenerationIdentityScriptInput.make({
 *     generation: Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer))),
 *     identity
 *   })
 * )
 * console.log(script.includes("PROBE-COMPLETE")) // true
 * ```
 *
 * @param input - The generation and the declared workstation identity it is bound to.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawProbeScript = (input: OpenClawGenerationIdentityScriptInput): string => {
  const generation = input.generation;

  return bashScript([
    "set -uo pipefail",
    trustedBasePath,
    `export XDG_RUNTIME_DIR=${shellQuote(generation.runtimeDir)}`,
    `export DBUS_SESSION_BUS_ADDRESS=${shellQuote(`unix:path=${generation.runtimeDir}/bus`)}`,
    ...expectedUnitTextLines(OpenClawGeneration.make(generation)),
    `http_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 ${shellQuote(
      healthUrl(OpenClawGeneration.make(generation))
    )} || printf '000')"`,
    `printf 'PROBE-LIVENESS ${healthUrl(OpenClawGeneration.make(generation))} status=%s\\n' "\${http_status}"`,
    `if ${shellQuote(`${pointerPath(OpenClawGeneration.make(generation))}/node_modules/.bin/openclaw`)} gateway call health >/dev/null 2>&1; then`,
    "  printf 'PROBE-GATEWAY-HEALTH ok\\n'",
    "else",
    "  printf 'PROBE-GATEWAY-HEALTH unreachable\\n'",
    "fi",
    `if ${shellQuote(
      `${pointerPath(OpenClawGeneration.make(generation))}/node_modules/.bin/openclaw`
    )} channels status --probe >/dev/null 2>&1; then`,
    "  printf 'PROBE-CHANNELS ok\\n'",
    "else",
    "  printf 'PROBE-CHANNELS unreachable\\n'",
    "fi",
    ...driftAuditLines(input),
    `printf 'PROBE-COMPLETE generation=${generation.generationId} liveness=%s drift_alerts=%s\\n' "\${http_status}" "\${drift_alerts}"`,
    "exit 0",
  ]);
};

/**
 * Render the fail-closed, operator-invoked P3 live acceptance script.
 *
 * **Details**
 *
 * Run `degraded` while the designated op:// reference is unresolvable, then
 * restore it and run `restored`; the restored phase immediately proves model,
 * local inventory, skill, Telegram send, and channel health.
 *
 * **Example** (Render the live acceptance script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawStackArgs, renderOpenClawLiveAcceptanceScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const generation = Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer)))
 * const script = renderOpenClawLiveAcceptanceScript(generation)
 * console.log(script.includes("LIVE-ACCEPTANCE-RESTORED PASS")) // true
 * ```
 *
 * @param generation - The rendered OpenClaw generation.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawLiveAcceptanceScript = (generation: OpenClawGeneration): string =>
  bashScript([
    ...scriptPreamble(generation),
    `export PATH=${shellQuote(`${generation.nodeBinDir}:/usr/bin:/bin`)}`,
    `export HOME=${shellQuote(generation.home)}`,
    `export OPENCLAW_CONFIG_PATH=${shellQuote(activeConfigPath(generation))}`,
    `export OPENCLAW_STATE_DIR=${shellQuote(generation.stateDir)}`,
    "export OPENCLAW_NIX_MODE=1",
    `openclaw=${shellQuote(`${pointerPath(generation)}/node_modules/.bin/openclaw`)}`,
    `skill_file=${shellQuote(`${pointerPath(generation)}/${openClawProofSkillRelativePath}`)}`,
    "fail() { printf 'LIVE-ACCEPTANCE-FAIL: %s\\n' \"$1\" >&2; exit 1; }",
    'phase="${1:-}"',
    'case "${phase}" in',
    "  degraded)",
    '    if "${openclaw}" secrets reload --json >/dev/null 2>&1; then',
    "      fail 'designated broken reference did not degrade secrets reload'",
    "    fi",
    "    printf 'LIVE-ACCEPTANCE-DEGRADED PASS (verify degraded-reloader alert in sanitized journal evidence)\\n'",
    "    exit 0",
    "    ;;",
    "  restored) ;;",
    "  *) fail 'usage: live-acceptance degraded|restored' ;;",
    "esac",
    'reload_json="$("${openclaw}" secrets reload --json)" || fail \'restored secrets reload failed\'',
    `printf '%s' "\${reload_json}" | jq -e '.ok == true and .warningCount == 0' >/dev/null || fail 'restored reload reported warnings'`,
    `model_json="$("\${openclaw}" agent --agent ${shellQuote(generation.agentId)} --session-key p3-model-proof --message 'Return exactly P3_MODEL_OK' --thinking off --timeout 120 --json)" || fail 'hosted model turn failed'`,
    `printf '%s' "\${model_json}" | jq -e ${shellQuote(
      `.status == "ok" and (.runId | type == "string" and length > 0) and .result.meta.stopReason == "stop" and .result.meta.aborted == false and .result.meta.agentMeta.provider == "${generation.hostedProviderId}" and .result.meta.agentMeta.model == "${generation.hostedModelId}" and .result.payloads[0].text == "P3_MODEL_OK"`
    )} >/dev/null || fail 'hosted model assertion failed'`,
    `curl -fsS --max-time 10 ${shellQuote(`${generation.localBaseUrl}/models`)} | jq -e ${shellQuote(
      `.data | map(.id) | index("${generation.localModelId}") != null`
    )} >/dev/null || fail 'local /models omitted configured model'`,
    `skills_json="$("\${openclaw}" skills list --json --eligible --agent ${shellQuote(
      generation.agentId
    )})" || fail 'skills inventory failed'`,
    `printf '%s' "\${skills_json}" | jq -e '[.skills[] | select(.name == "beep-proof-ping" and .eligible == true and .source == "openclaw-workspace")] | length == 1' >/dev/null || fail 'proof skill inventory assertion failed'`,
    `[ "$(sha256sum "\${skill_file}" | cut -d' ' -f1)" = ${shellQuote(
      generation.proofSkillHash
    )} ] || fail 'active proof skill hash mismatch'`,
    `skill_json="$("\${openclaw}" agent --agent ${shellQuote(generation.agentId)} --session-key p3-skill-proof --message 'P3 proof skill ping' --thinking off --timeout 120 --json)" || fail 'proof skill turn failed'`,
    `printf '%s' "\${skill_json}" | jq -e '.status == "ok" and .result.payloads[0].text == "P3_SKILL_OK"' >/dev/null || fail 'proof skill sentinel mismatch'`,
    "[ -n \"${P3_TELEGRAM_TARGET:-}\" ] || fail 'P3_TELEGRAM_TARGET is required'",
    "[ -n \"${P3_SYNTHETIC_NONCE:-}\" ] || fail 'P3_SYNTHETIC_NONCE is required'",
    'send_json="$("${openclaw}" message send --channel telegram --target "${P3_TELEGRAM_TARGET}" --message "${P3_SYNTHETIC_NONCE}" --json)" || fail \'Telegram send failed\'',
    `printf '%s' "\${send_json}" | jq -e '.channel == "telegram" and .payload.ok == true and (.messageId | type == "string" and length > 0)' >/dev/null || fail 'Telegram receipt assertion failed'`,
    'channel_json="$("${openclaw}" channels status --channel telegram --probe --json)" || fail \'Telegram channel probe failed\'',
    `printf '%s' "\${channel_json}" | jq -e '[.channelAccounts.telegram[] | select(.accountId == "default" and .probe.ok == true and (.probe.error == null))] | length == 1' >/dev/null || fail 'Telegram channel assertion failed'`,
    `printf 'LIVE-ACCEPTANCE-RESTORED PASS generation=${generation.generationId}\\n'`,
  ]);

/**
 * Render the encrypted snapshot shipping script.
 *
 * **Details**
 *
 * The archive is symmetrically encrypted locally before it ever leaves the
 * workstation; the passphrase is read from `OPENCLAW_BACKUP_PASSPHRASE`, which
 * the operator resolves out of band from the recorded `op://` reference, so no
 * secret material enters Alchemy state or the rendered command. The remote is
 * dumb storage: it receives the archive and returns a sha256 receipt that must
 * match the local digest.
 *
 * **Example** (Render the backup ship script)
 * ```ts
 * import { makeOpenClawGeneration, OpenClawBackupConfig, OpenClawBackupShipScriptInput, OpenClawStackArgs, renderOpenClawBackupShipScript } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * const script = renderOpenClawBackupShipScript(
 *   OpenClawBackupShipScriptInput.make({
 *     backup: OpenClawBackupConfig.make({ host: "backup-host", passphraseSecretRef: "op://beep-openclaw/backup/passphrase", remoteDir: "/srv/backups/openclaw", user: "operator" }),
 *     generation: Effect.runSync(makeOpenClawGeneration(args).pipe(Effect.provide(NodeCrypto.layer)))
 *   })
 * )
 * console.log(script.includes("BACKUP-OK")) // true
 * ```
 *
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawBackupShipScript = ({ backup, generation }: OpenClawBackupShipScriptInput): string => {
  const remote = `${backup.user}@${backup.host}`;

  return bashScript([
    "set -euo pipefail",
    trustedBasePath,
    ...A.fromOption(O.map(backup.agentSocketPath, (socketPath) => `export SSH_AUTH_SOCK=${shellQuote(socketPath)}`)),
    `[ -n "\${${backupPassphraseEnvVar}:-}" ] || { printf 'BACKUP-FAIL: ${backupPassphraseEnvVar} is unset; resolve %s out of band before running alchemy deploy\\n' ${shellQuote(
      backup.passphraseSecretRef
    )} >&2; exit 78; }`,
    'work="$(mktemp -d)"',
    "trap 'rm -rf -- \"${work}\"' EXIT",
    `archive="\${work}/openclaw-${generation.generationId}-$(date -u +%Y%m%dT%H%M%SZ).tar"`,
    `/usr/bin/sudo -n tar -cf "\${archive}" -C ${shellQuote(generation.configRoot)} ${shellQuote(
      `${snapshotsDirName}/${generation.generationId}`
    )}`,
    `printf '%s' "\${${backupPassphraseEnvVar}}" | gpg --batch --yes --symmetric --cipher-algo AES256 --pinentry-mode loopback --passphrase-fd 0 --output "\${archive}.gpg" "\${archive}"`,
    'rm -f -- "${archive}"',
    'archive_name="$(basename "${archive}.gpg")"',
    'local_sha="$(sha256sum "${archive}.gpg" | cut -d\' \' -f1)"',
    `ssh ${shellQuote(remote)} ${shellQuote(`mkdir -p ${backup.remoteDir}`)}`,
    `scp -q "\${archive}.gpg" ${shellQuote(`${remote}:${backup.remoteDir}/`)}`,
    `remote_sha="$(ssh ${shellQuote(remote)} "sha256sum ${backup.remoteDir}/\${archive_name}" | cut -d' ' -f1)"`,
    '[ "${local_sha}" = "${remote_sha}" ] || { printf \'BACKUP-FAIL: receipt sha256 mismatch local=%s remote=%s\\n\' "${local_sha}" "${remote_sha}" >&2; exit 74; }',
    `printf 'BACKUP-OK archive=%s sha256=%s remote=%s\\n' "\${archive_name}" "\${local_sha}" ${shellQuote(
      `${remote}:${backup.remoteDir}`
    )}`,
  ]);
};

/**
 * Typed arguments for the OpenClaw workstation stack.
 *
 * **Details**
 *
 * `identity` has no default on purpose — the stack must be told which machine
 * it owns before it can render anything.
 *
 * **Example** (Build stack args from config values)
 * ```ts
 * import { OpenClawStackArgs } from "@beep/infra-hosts/OpenClawGeneration"
 * import * as S from "effect/Schema"
 *
 * const args = S.decodeUnknownSync(OpenClawStackArgs)({
 *   identity: {
 *     home: "/home/example",
 *     hostname: "workstation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "operator"
 *   },
 *   deployment: {
 *     hostedProvider: {
 *       apiKeyRef: "op://beep-openclaw/hosted/api-key",
 *       baseUrl: "https://api.example.com/v1",
 *       modelId: "legal-primary",
 *       modelName: "Legal Primary",
 *       providerId: "hosted"
 *     },
 *     localProvider: {
 *       baseUrl: "http://127.0.0.1:11434/v1",
 *       modelId: "gemma3:4b",
 *       modelName: "Gemma 3 4B",
 *       providerId: "ollama"
 *     },
 *     telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 *   }
 * })
 * console.log(args.paths.unitName) // "openclaw.service"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawStackArgs extends S.Opaque<OpenClawStackArgs, { readonly brand: unique symbol }>()(
  S.Struct({
    backup: S.OptionFromOptionalKey(OpenClawBackupConfig)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Backup shipping inputs; absent when snapshots stay on the workstation.",
      }),
    deployment: OpenClawDeploymentConfig.annotateKey({
      description: "Deployment inputs rendered into the OpenClaw deployment intent.",
    }),
    identity: OpenClawExpectedIdentity.annotateKey({
      description: "Fully declared identity of the workstation this stack owns.",
    }),
    paths: OpenClawWorkstationPaths.pipe(
      S.withConstructorDefault(Effect.succeed(OpenClawWorkstationPaths.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ).annotateKey({
      description: "Filesystem layout the workstation applicator owns.",
    }),
  }).pipe(
    $I.annoteSchema("OpenClawStackArgs", {
      description: "OpenClaw workstation arguments decoded from configuration before the stack renders a generation.",
    })
  )
) {
  /**
   * Build component args around a declared workstation identity.
   *
   * **Example** (Build stack args from identity and deployment)
   * ```ts
   * import {
   *   OpenClawDeploymentConfig,
   *   OpenClawExpectedIdentity,
   *   OpenClawHostedProviderConfig,
   *   OpenClawLocalProviderConfig,
   *   OpenClawStackArgs
   * } from "@beep/infra-hosts/OpenClawGeneration"
   * import { OpenclawSecretReference } from "@beep/openclaw"
   *
   * const args = OpenClawStackArgs.new(
   *   OpenClawExpectedIdentity.make({
   *     home: "/home/example",
   *     hostname: "workstation",
   *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
   *     runtimeDir: "/run/user/1000",
   *     uid: 1000,
   *     username: "operator"
   *   }),
   *   OpenClawDeploymentConfig.make({
   *     hostedProvider: OpenClawHostedProviderConfig.make({
   *       apiKeyRef: OpenclawSecretReference.make("op://beep-openclaw/hosted/api-key"),
   *       baseUrl: "https://api.example.com/v1",
   *       modelId: "legal-primary",
   *       modelName: "Legal Primary",
   *       providerId: "hosted"
   *     }),
   *     localProvider: OpenClawLocalProviderConfig.make({
   *       baseUrl: "http://127.0.0.1:11434/v1",
   *       modelId: "gemma3:4b",
   *       modelName: "Gemma 3 4B",
   *       providerId: "ollama"
   *     }),
   *     telegramBotTokenRef: OpenclawSecretReference.make("op://beep-openclaw/telegram/bot-token")
   *   })
   * )
   * console.log(args.deployment.agentId) // "workstation"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (
    identity: OpenClawExpectedIdentity,
    deployment: OpenClawDeploymentConfig,
    paths: OpenClawWorkstationPaths = OpenClawWorkstationPaths.make({}),
    backup: O.Option<OpenClawBackupConfig> = O.none()
  ): OpenClawStackArgs =>
    OpenClawStackArgs.make({
      backup,
      deployment,
      identity,
      paths,
    });
}
