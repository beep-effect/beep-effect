/**
 * Pulumi orchestration surface for the OpenClaw workstation agent stack.
 *
 * The stack is content-addressed: every deployment renders one immutable
 * generation under `<configRoot>/<config-sha256>/` and flips a single
 * `current` symlink at it. Generation rendering is pure and applicator-free,
 * so the rendered unit, `run.sh`, generation tree, and every applicator script
 * are directly testable strings. The applicator itself runs as ordered
 * `command.local.Command` resources — preflight, stage, apply, probe, and an
 * optional backup ship — and the drift audit deliberately lives outside them
 * because `command.*` resources skip execution during preview and have no
 * refresh.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import {
  OPENCLAW_COMPATIBILITY_SET,
  OpenclawAbsolutePath,
  OpenclawAgentIntent,
  OpenclawDeploymentIntent,
  OpenclawGatewayIntent,
  OpenclawGatewayPort,
  OpenclawLoggingIntent,
  OpenclawSecretReference,
  OpenclawSecretsResolverIntent,
  OpenclawSha256Hex,
  OpenclawTargetVersion,
  renderOpenclawConfig,
} from "@beep/openclaw";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O, R, Str } from "@beep/utils";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import { Effect, pipe, Result } from "effect";
import * as S from "effect/Schema";
import {
  optionalPulumiConfigFields,
  pulumiConfigSchemaIssueError,
  withPulumiConfigDecodeEffect,
} from "./internal/PulumiConfigSchema.ts";

const $I = $InfraId.create("OpenClaw");

const defaultAgentId = "workstation";
const defaultAgentModel = "ollama/gemma3:4b";
const defaultAgentName = "Beep Workstation";
const defaultAgentWorkspace = "/var/lib/beep/openclaw/workspace";
const defaultBackupRemoteDir = "/srv/data/beep-openclaw-backups";
const defaultBackupSshHost = "dankserver";
const defaultBackupSshUser = "elpresidank";
const defaultConfigRoot = "/etc/beep/openclaw";
const defaultGatewayAuthTokenRef = "op://beep-openclaw/gateway/token";
const defaultGatewayPort = 19_031;
const defaultLogFilePath = "/var/lib/beep/openclaw/log/openclaw.log";
const defaultNodeBinDir = "/home/elpresidank/.local/share/mise/installs/node/24/bin";
const defaultResolverCommandPath = "/opt/beep/openclaw/op-resolver.sh";
const defaultResolverOpBinaryPath = "/opt/beep/openclaw/bin/op";
const defaultResolverTrustedDir = "/opt/beep/openclaw";
const defaultStateDir = "/var/lib/beep/openclaw";
const defaultUnitName = "openclaw.service";

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

const machineIdPattern = /^[0-9a-f]{32}$/u;
const OpenClawFileModeBase = LiteralKit(["0644", "0755"]);

const MachineIdFormat = S.isPattern(machineIdPattern, {
  identifier: $I`MachineIdFormat`,
  title: "Machine ID Format",
  description: "A 32-character lowercase hexadecimal `/etc/machine-id` value.",
  message: "Expected a 32-character lowercase hex machine id",
});

const MachineId = S.String.check(MachineIdFormat).pipe(
  $I.annoteSchema("MachineId", {
    description: "A 32-character lowercase hexadecimal `/etc/machine-id` value.",
  })
);

const PosixUidRange = S.isBetween(
  {
    minimum: 0,
    maximum: 65_535,
  },
  {
    identifier: $I`PosixUidRange`,
    title: "POSIX UID Range",
    description: "A POSIX user id in the inclusive range 0 through 65535.",
    message: "Expected a POSIX uid between 0 and 65535",
  }
);

const PosixUid = S.Int.check(PosixUidRange).pipe(
  $I.annoteSchema("PosixUid", {
    description: "A POSIX user id in the inclusive range 0 through 65535.",
  })
);

const schemaIssueToPulumiConfigError = pulumiConfigSchemaIssueError("openclaw");

const decodeOpenclawTargetVersion = S.decodeUnknownResult(OpenclawTargetVersion);
const decodeOpenclawSecretReference = S.decodeUnknownResult(OpenclawSecretReference);

const targetVersionFromPulumiConfig = (value: string | undefined): O.Option<OpenclawTargetVersion> =>
  O.map(O.fromUndefinedOr(value), (value) =>
    Result.getOrThrowWith(decodeOpenclawTargetVersion(value), schemaIssueToPulumiConfigError("openclawVersion", value))
  );

const secretReferenceFromPulumiConfig = (key: string, value: string | undefined): O.Option<OpenclawSecretReference> =>
  O.map(O.fromUndefinedOr(value), (value) =>
    Result.getOrThrowWith(decodeOpenclawSecretReference(value), schemaIssueToPulumiConfigError(key, value))
  );

const requiredConfigValue = <Value>(key: string, value: Value | undefined): Value =>
  O.getOrThrowWith(
    O.fromUndefinedOr(value),
    () =>
      new pulumi.RunError(
        `Missing openclaw:${key} Pulumi config value; the OpenClaw stack refuses to apply without a fully declared expected identity.`
      )
  );

const shellQuote = (value: string): string => `'${pipe(value, Str.replace(/'/gu, `'"'"'`))}'`;

const bashScript = (lines: ReadonlyArray<string>): string => `/bin/bash -lc ${shellQuote(A.join(lines, "\n"))}`;

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
 * @example
 * ```ts
 * import { OpenClawFileMode } from "@beep/infra"
 *
 * console.log(OpenClawFileMode.Options) // ["0644", "0755"]
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
 * @example
 * ```ts
 * import type { OpenClawFileMode } from "@beep/infra"
 *
 * const mode: OpenClawFileMode = "0644"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenClawFileMode = typeof OpenClawFileMode.Type;

type OpenClawPulumiConfigValuesFields = {
  readonly agentId?: string | undefined;
  readonly agentModel?: string | undefined;
  readonly agentName?: string | undefined;
  readonly agentWorkspace?: string | undefined;
  readonly backupPassphraseSecretRef?: string | undefined;
  readonly backupRemoteDir?: string | undefined;
  readonly backupSshAgentSocketPath?: string | undefined;
  readonly backupSshHost?: string | undefined;
  readonly backupSshUser?: string | undefined;
  readonly configRoot?: string | undefined;
  readonly expectedHome?: string | undefined;
  readonly expectedHostname?: string | undefined;
  readonly expectedMachineId?: string | undefined;
  readonly expectedRuntimeDir?: string | undefined;
  readonly expectedUid?: number | undefined;
  readonly expectedUsername?: string | undefined;
  readonly gatewayAuthTokenRef?: OpenclawSecretReference | undefined;
  readonly gatewayPort?: number | undefined;
  readonly logFilePath?: string | undefined;
  readonly nodeBinDir?: string | undefined;
  readonly openclawVersion?: OpenclawTargetVersion | undefined;
  readonly resolverCommandPath?: string | undefined;
  readonly resolverOpBinaryPath?: string | undefined;
  readonly resolverTrustedDir?: string | undefined;
  readonly stateDir?: string | undefined;
  readonly unitName?: string | undefined;
};

type OpenClawPulumiConfigInputValues = Omit<
  OpenClawPulumiConfigValuesFields,
  "gatewayAuthTokenRef" | "openclawVersion"
> & {
  readonly gatewayAuthTokenRef?: string | undefined;
  readonly openclawVersion?: string | undefined;
};

/**
 * Raw optional Pulumi config values before workstation defaults are applied.
 *
 * @example
 * ```ts
 * import { OpenClawPulumiConfigValues } from "@beep/infra"
 *
 * console.log(OpenClawPulumiConfigValues)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenClawPulumiConfigValues = S.Class<OpenClawPulumiConfigValuesFields>($I`OpenClawPulumiConfigValues`)(
  {
    agentId: S.String,
    agentModel: S.String,
    agentName: S.String,
    agentWorkspace: OpenclawAbsolutePath,
    backupPassphraseSecretRef: S.String,
    backupRemoteDir: OpenclawAbsolutePath,
    backupSshAgentSocketPath: S.String,
    backupSshHost: S.String,
    backupSshUser: S.String,
    configRoot: OpenclawAbsolutePath,
    expectedHome: OpenclawAbsolutePath,
    expectedHostname: S.String,
    expectedMachineId: MachineId,
    expectedRuntimeDir: OpenclawAbsolutePath,
    expectedUid: PosixUid,
    expectedUsername: S.String,
    gatewayAuthTokenRef: OpenclawSecretReference,
    gatewayPort: OpenclawGatewayPort,
    logFilePath: OpenclawAbsolutePath,
    nodeBinDir: OpenclawAbsolutePath,
    openclawVersion: OpenclawTargetVersion,
    resolverCommandPath: OpenclawAbsolutePath,
    resolverOpBinaryPath: OpenclawAbsolutePath,
    resolverTrustedDir: OpenclawAbsolutePath,
    stateDir: OpenclawAbsolutePath,
    unitName: S.String,
  },
  $I.annote("OpenClawPulumiConfigValues", { description: "Configuration values for OpenClaw Pulumi resources" })
)
  .mapFields(optionalPulumiConfigFields)
  .pipe(withPulumiConfigDecodeEffect);

/**
 * Declared identity of the single workstation this stack may mutate.
 *
 * Every field is required and carries no default on purpose: a silent
 * wrong-target apply is the failure mode this binding exists to prevent, so an
 * incomplete expectation must refuse to render rather than degrade into an
 * empty match.
 *
 * @example
 * ```ts
 * import { OpenClawExpectedIdentity } from "@beep/infra"
 *
 * const identity = OpenClawExpectedIdentity.make({
 *   home: "/home/elpresidank",
 *   hostname: "DankStation",
 *   machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *   runtimeDir: "/run/user/1000",
 *   uid: 1000,
 *   username: "elpresidank"
 * })
 * console.log(identity.hostname) // "DankStation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawExpectedIdentity extends S.Class<OpenClawExpectedIdentity>($I`OpenClawExpectedIdentity`)(
  {
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
  },
  $I.annote("OpenClawExpectedIdentity", {
    description: "Fully declared identity of the workstation the OpenClaw stack is bound to.",
  })
) {}

/**
 * Filesystem layout the workstation applicator owns.
 *
 * @example
 * ```ts
 * import { OpenClawWorkstationPaths } from "@beep/infra"
 *
 * console.log(OpenClawWorkstationPaths.make({}).configRoot) // "/etc/beep/openclaw"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawWorkstationPaths extends S.Class<OpenClawWorkstationPaths>($I`OpenClawWorkstationPaths`)(
  {
    configRoot: OpenclawAbsolutePath.pipe(SchemaUtils.withKeyDefaults(defaultConfigRoot)).annotateKey({
      description: "Root-owned directory holding every content-addressed generation and the `current` pointer.",
    }),
    nodeBinDir: OpenclawAbsolutePath.pipe(SchemaUtils.withKeyDefaults(defaultNodeBinDir)).annotateKey({
      description: "Directory containing the pinned Node binaries prepended to the unit's hermetic PATH.",
    }),
    stateDir: OpenclawAbsolutePath.pipe(SchemaUtils.withKeyDefaults(defaultStateDir)).annotateKey({
      description: "OpenClaw state root snapshotted before every generation switch.",
    }),
    unitName: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(defaultUnitName)).annotateKey({
      description: "Name of the stack-owned `systemd --user` unit.",
    }),
  },
  $I.annote("OpenClawWorkstationPaths", {
    description: "Filesystem layout the OpenClaw workstation applicator owns.",
  })
) {}

/**
 * Deployment inputs the stack turns into an OpenClaw deployment intent.
 *
 * Secret material never appears here: `gatewayAuthTokenRef` is an `op://`
 * reference resolved on the workstation at runtime.
 *
 * @example
 * ```ts
 * import { OpenClawDeploymentConfig } from "@beep/infra"
 *
 * console.log(OpenClawDeploymentConfig.make({}).gatewayPort) // 19031
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawDeploymentConfig extends S.Class<OpenClawDeploymentConfig>($I`OpenClawDeploymentConfig`)(
  {
    agentId: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(defaultAgentId)).annotateKey({
      description: "Slug identifying the agent in config and state paths.",
    }),
    agentModel: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(defaultAgentModel)).annotateKey({
      description: "Primary model reference for the registered agent.",
    }),
    agentName: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(defaultAgentName)).annotateKey({
      description: "Human-readable agent display name.",
    }),
    agentWorkspace: OpenclawAbsolutePath.pipe(SchemaUtils.withKeyDefaults(defaultAgentWorkspace)).annotateKey({
      description: "Absolute path of the agent workspace directory.",
    }),
    gatewayAuthTokenRef: OpenclawSecretReference.pipe(
      SchemaUtils.withKeyDefaults(OpenclawSecretReference.make(defaultGatewayAuthTokenRef))
    ).annotateKey({
      description: "op:// reference resolved at runtime into the gateway auth token.",
    }),
    gatewayPort: OpenclawGatewayPort.pipe(SchemaUtils.withKeyDefaults(defaultGatewayPort)).annotateKey({
      description: "Loopback TCP port the gateway listens on.",
    }),
    logFilePath: OpenclawAbsolutePath.pipe(SchemaUtils.withKeyDefaults(defaultLogFilePath)).annotateKey({
      description: "Absolute path of the gateway log file.",
    }),
    openclawVersion: OpenclawTargetVersion.pipe(
      SchemaUtils.withKeyDefaults(OPENCLAW_COMPATIBILITY_SET.openclawVersion)
    ).annotateKey({
      description: "Pinned OpenClaw version staged into each generation.",
    }),
    resolverCommandPath: OpenclawAbsolutePath.pipe(SchemaUtils.withKeyDefaults(defaultResolverCommandPath)).annotateKey(
      {
        description: "Absolute path of the exec-provider secret resolver command.",
      }
    ),
    resolverOpBinaryPath: OpenclawAbsolutePath.pipe(
      SchemaUtils.withKeyDefaults(defaultResolverOpBinaryPath)
    ).annotateKey({
      description: "Absolute path of the pinned 1Password CLI binary.",
    }),
    resolverTrustedDir: OpenclawAbsolutePath.pipe(SchemaUtils.withKeyDefaults(defaultResolverTrustedDir)).annotateKey({
      description: "Directory OpenClaw trusts to contain the resolver command.",
    }),
  },
  $I.annote("OpenClawDeploymentConfig", {
    description: "Deployment inputs the OpenClaw stack renders into a deployment intent.",
  })
) {}

/**
 * Build the driver deployment intent a deployment config describes.
 *
 * @example
 * ```ts
 * import { makeOpenClawDeploymentIntent, OpenClawDeploymentConfig } from "@beep/infra"
 *
 * console.log(makeOpenClawDeploymentIntent(OpenClawDeploymentConfig.make({})).gateway.port) // 19031
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOpenClawDeploymentIntent = (deployment: OpenClawDeploymentConfig): OpenclawDeploymentIntent =>
  OpenclawDeploymentIntent.make({
    agent: OpenclawAgentIntent.make({
      id: deployment.agentId,
      model: deployment.agentModel,
      name: deployment.agentName,
      workspace: deployment.agentWorkspace,
    }),
    gateway: OpenclawGatewayIntent.make({
      authTokenRef: deployment.gatewayAuthTokenRef,
      port: deployment.gatewayPort,
    }),
    logging: OpenclawLoggingIntent.make({ filePath: deployment.logFilePath }),
    openclawVersion: deployment.openclawVersion,
    providers: [],
    secretsResolver: OpenclawSecretsResolverIntent.make({
      commandPath: deployment.resolverCommandPath,
      opBinaryPath: deployment.resolverOpBinaryPath,
      trustedDir: deployment.resolverTrustedDir,
    }),
  });

/**
 * Backup shipping inputs for encrypted generation snapshots.
 *
 * The remote host is dumb storage: the ship script only creates the target
 * directory, copies an already-encrypted archive into it, and reads back a
 * sha256 receipt. Nothing else on the remote is modified.
 *
 * @example
 * ```ts
 * import { OpenClawBackupConfig } from "@beep/infra"
 *
 * const backup = OpenClawBackupConfig.make({ passphraseSecretRef: "op://beep-openclaw/backup/passphrase" })
 * console.log(backup.host) // "dankserver"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawBackupConfig extends S.Class<OpenClawBackupConfig>($I`OpenClawBackupConfig`)(
  {
    agentSocketPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Local SSH agent socket exported as `SSH_AUTH_SOCK` while shipping, when declared.",
    }),
    host: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(defaultBackupSshHost)).annotateKey({
      description: "Tailnet host receiving encrypted snapshot archives.",
    }),
    passphraseSecretRef: S.NonEmptyString.annotateKey({
      description: "op:// reference for the symmetric archive passphrase; the material never enters Pulumi state.",
    }),
    remoteDir: OpenclawAbsolutePath.pipe(SchemaUtils.withKeyDefaults(defaultBackupRemoteDir)).annotateKey({
      description: "Absolute remote directory receiving encrypted snapshot archives.",
    }),
    user: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(defaultBackupSshUser)).annotateKey({
      description: "Remote login used to ship encrypted snapshot archives.",
    }),
  },
  $I.annote("OpenClawBackupConfig", {
    description: "Backup shipping inputs for encrypted OpenClaw generation snapshots.",
  })
) {}

/**
 * One immutable, content-addressed OpenClaw generation.
 *
 * `generationId` is the SHA-256 of the canonical `openclaw.json` bytes, which
 * is also the generation directory name — equal intents therefore always
 * produce the same generation directory and the applicator becomes idempotent
 * by construction.
 *
 * @example
 * ```ts
 * import { makeOpenClawGeneration, OpenClawExpectedIdentity, OpenClawStackArgs } from "@beep/infra"
 *
 * const generation = makeOpenClawGeneration(
 *   OpenClawStackArgs.new(
 *     OpenClawExpectedIdentity.make({
 *       home: "/home/elpresidank",
 *       hostname: "DankStation",
 *       machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *       runtimeDir: "/run/user/1000",
 *       uid: 1000,
 *       username: "elpresidank"
 *     })
 *   )
 * )
 * console.log(generation.generationId.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawGeneration extends S.Class<OpenClawGeneration>($I`OpenClawGeneration`)(
  {
    canonicalJson: S.String.annotateKey({
      description: "Canonical `openclaw.json` bytes rendered by the driver adapter.",
    }),
    configRoot: OpenclawAbsolutePath.annotateKey({
      description: "Root-owned directory holding every generation and the `current` pointer.",
    }),
    credentialsDir: OpenclawAbsolutePath.annotateKey({
      description: "User-owned directory holding unit-private credential files.",
    }),
    gatewayPort: OpenclawGatewayPort.annotateKey({
      description: "Loopback TCP port acceptance probes poll.",
    }),
    generationId: OpenclawSha256Hex.annotateKey({
      description: "SHA-256 of the canonical config bytes; also the generation directory name.",
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
    runtimeDir: OpenclawAbsolutePath.annotateKey({
      description: "`XDG_RUNTIME_DIR` the applicator constructs before touching the user bus.",
    }),
    stateDir: OpenclawAbsolutePath.annotateKey({
      description: "OpenClaw state root snapshotted before every generation switch.",
    }),
    unitName: S.NonEmptyString.annotateKey({
      description: "Name of the stack-owned `systemd --user` unit.",
    }),
    workspace: OpenclawAbsolutePath.annotateKey({
      description: "Absolute path of the agent workspace directory.",
    }),
  },
  $I.annote("OpenClawGeneration", {
    description: "One immutable, content-addressed OpenClaw generation.",
  })
) {}

const generationDir = (generation: OpenClawGeneration): string => `${generation.configRoot}/${generation.generationId}`;

const pointerPath = (generation: OpenClawGeneration): string => `${generation.configRoot}/${generationPointerName}`;

const activeConfigPath = (generation: OpenClawGeneration): string => `${pointerPath(generation)}/${configFileName}`;

const snapshotDir = (generation: OpenClawGeneration): string =>
  `${generation.configRoot}/${snapshotsDirName}/${generation.generationId}`;

const stateDatabasePath = (generation: OpenClawGeneration): string => `${generation.stateDir}/state/openclaw.sqlite`;

const unitPath = (generation: OpenClawGeneration): string =>
  `${generation.home}/.config/systemd/user/${generation.unitName}`;

const gatewayCredentialPath = (generation: OpenClawGeneration): string => `${generation.credentialsDir}/gateway-token`;

const stagedOpenclawBinary = (generation: OpenClawGeneration): string =>
  `${generationDir(generation)}/node_modules/.bin/openclaw`;

const healthUrl = (generation: OpenClawGeneration): string => `http://127.0.0.1:${generation.gatewayPort}/health`;

const scriptPreamble = (generation: OpenClawGeneration): ReadonlyArray<string> => [
  "set -euo pipefail",
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
      `  "generationId": "${generation.generationId}",`,
      `  "nodeVersion": "${generation.nodeVersion}",`,
      `  "npmIntegrity": "${OPENCLAW_COMPATIBILITY_SET.npmIntegrity}",`,
      `  "npmShasum": "${OPENCLAW_COMPATIBILITY_SET.npmShasum}",`,
      `  "openclawCommit": "${OPENCLAW_COMPATIBILITY_SET.openclawCommit}",`,
      `  "openclawVersion": "${generation.openclawVersion}"`,
      "}",
    ],
    "\n"
  )}\n`;

/**
 * Build the content-addressed generation described by stack args.
 *
 * Pure and total: the driver render adapter turns the deployment config into
 * canonical `openclaw.json` bytes, and their SHA-256 becomes the generation
 * id.
 *
 * @example
 * ```ts
 * import { makeOpenClawGeneration, OpenClawExpectedIdentity, OpenClawStackArgs } from "@beep/infra"
 *
 * const generation = makeOpenClawGeneration(
 *   OpenClawStackArgs.new(
 *     OpenClawExpectedIdentity.make({
 *       home: "/home/elpresidank",
 *       hostname: "DankStation",
 *       machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *       runtimeDir: "/run/user/1000",
 *       uid: 1000,
 *       username: "elpresidank"
 *     })
 *   )
 * )
 * console.log(generation.configRoot) // "/etc/beep/openclaw"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOpenClawGeneration = (args: OpenClawStackArgs): OpenClawGeneration => {
  const rendered = renderOpenclawConfig(makeOpenClawDeploymentIntent(args.deployment));

  return OpenClawGeneration.make({
    canonicalJson: rendered.canonicalJson,
    configRoot: args.paths.configRoot,
    credentialsDir: `${args.identity.home}/.config/beep/openclaw/credentials`,
    gatewayPort: args.deployment.gatewayPort,
    generationId: rendered.contentHash,
    home: args.identity.home,
    logFilePath: args.deployment.logFilePath,
    nodeBinDir: args.paths.nodeBinDir,
    nodeVersion: OPENCLAW_COMPATIBILITY_SET.nodeVersion,
    openclawVersion: args.deployment.openclawVersion,
    runtimeDir: args.identity.runtimeDir,
    stateDir: args.paths.stateDir,
    unitName: args.paths.unitName,
    workspace: args.deployment.agentWorkspace,
  });
};

/**
 * Render the `systemd --user` unit for a generation.
 *
 * The unit never names a generation directory: it points at the
 * `<configRoot>/current` symlink so a pointer switch also switches binaries.
 * `UnsetEnvironment` strips inherited 1Password and gateway credentials from
 * the manager environment, and the gateway token arrives exclusively through
 * `LoadCredential`.
 *
 * @example
 * ```ts
 * import { makeOpenClawGeneration, OpenClawExpectedIdentity, OpenClawStackArgs, renderOpenClawUnit } from "@beep/infra"
 *
 * const unit = renderOpenClawUnit(
 *   makeOpenClawGeneration(
 *     OpenClawStackArgs.new(
 *       OpenClawExpectedIdentity.make({
 *         home: "/home/elpresidank",
 *         hostname: "DankStation",
 *         machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *         runtimeDir: "/run/user/1000",
 *         uid: 1000,
 *         username: "elpresidank"
 *       })
 *     )
 *   )
 * )
 * console.log(unit.startsWith("# BEEP_OPENCLAW_MANAGED")) // true
 * ```
 *
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
      `LoadCredential=gateway-token:${gatewayCredentialPath(generation)}`,
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
 * The script resolves its own real path, so invoking it through the `current`
 * symlink still execs the binary staged inside the generation it resolves to.
 * `preflight` validates the generation's config with its own binary;
 * `gateway` (the default) starts the gateway.
 *
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawRunScript
 * } from "@beep/infra"
 *
 * const runScript = renderOpenClawRunScript(
 *   makeOpenClawGeneration(
 *     OpenClawStackArgs.new(
 *       OpenClawExpectedIdentity.make({
 *         home: "/home/elpresidank",
 *         hostname: "DankStation",
 *         machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *         runtimeDir: "/run/user/1000",
 *         uid: 1000,
 *         username: "elpresidank"
 *       })
 *     )
 *   )
 * )
 * console.log(runScript.includes("config validate")) // true
 * ```
 *
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
      'case "${1:-gateway}" in',
      '  preflight) exec "${openclaw_bin}" config validate ;;',
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
 * @example
 * ```ts
 * import { OpenClawGenerationFile } from "@beep/infra"
 *
 * const file = OpenClawGenerationFile.make({ content: "{}\n", mode: "0644" })
 * console.log(file.mode) // "0644"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawGenerationFile extends S.Class<OpenClawGenerationFile>($I`OpenClawGenerationFile`)(
  {
    content: S.String.annotateKey({
      description: "Exact bytes written into the generation directory.",
    }),
    mode: OpenClawFileMode.annotateKey({
      description: "Filesystem mode the file is materialized with.",
    }),
  },
  $I.annote("OpenClawGenerationFile", {
    description: "One rendered OpenClaw generation file with its materialization mode.",
  })
) {}

/**
 * Render the complete generation tree as pure data.
 *
 * Keys are paths relative to `<configRoot>/<generationId>/`. The applicator —
 * not this function — materializes them, which keeps generation rendering
 * testable without a filesystem and reusable by a future remote applicator.
 *
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawGenerationTree
 * } from "@beep/infra"
 *
 * const tree = renderOpenClawGenerationTree(
 *   makeOpenClawGeneration(
 *     OpenClawStackArgs.new(
 *       OpenClawExpectedIdentity.make({
 *         home: "/home/elpresidank",
 *         hostname: "DankStation",
 *         machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *         runtimeDir: "/run/user/1000",
 *         uid: 1000,
 *         username: "elpresidank"
 *       })
 *     )
 *   )
 * )
 * console.log(tree["run.sh"]?.mode) // "0755"
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawGenerationTree = (
  generation: OpenClawGeneration
): Record<string, OpenClawGenerationFile> => ({
  [configFileName]: OpenClawGenerationFile.make({ content: generation.canonicalJson, mode: "0644" }),
  [manifestFileName]: OpenClawGenerationFile.make({ content: renderGenerationManifest(generation), mode: "0644" }),
  [runScriptFileName]: OpenClawGenerationFile.make({
    content: renderOpenClawRunScript(generation),
    mode: "0755",
  }),
});

/**
 * Render the preflight script that must pass before any mutation.
 *
 * Identity binding fails closed: an unreadable target value or an empty
 * expectation refuses the apply rather than passing on a vacuous match. Bus
 * reachability is a real round-trip (`systemctl --user show`), not
 * `is-system-running`, whose non-zero `degraded` exit is normal on healthy
 * desktops; the manager state is recorded and only rejected outside
 * `running|degraded|maintenance|starting`.
 *
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawPreflightScript
 * } from "@beep/infra"
 *
 * const identity = OpenClawExpectedIdentity.make({
 *   home: "/home/elpresidank",
 *   hostname: "DankStation",
 *   machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *   runtimeDir: "/run/user/1000",
 *   uid: 1000,
 *   username: "elpresidank"
 * })
 * const script = renderOpenClawPreflightScript({
 *   generation: makeOpenClawGeneration(OpenClawStackArgs.new(identity)),
 *   identity
 * })
 * console.log(script.includes("PREFLIGHT-OK")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawPreflightScript = ({
  generation,
  identity,
}: {
  readonly generation: OpenClawGeneration;
  readonly identity: OpenClawExpectedIdentity;
}): string =>
  bashScript([
    ...scriptPreamble(generation),
    "fail() { printf 'PREFLIGHT-FAIL: %s\\n' \"$1\" >&2; exit 78; }",
    ...A.map(
      ["curl", "install", "loginctl", "sha256sum", "sqlite3", "sudo", "systemctl"],
      (binary) => `command -v ${binary} >/dev/null || fail ${shellQuote(`${binary} is not installed on the target`)}`
    ),
    ...A.flatMap(identityChecks(identity), identityAssertionLines),
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
        [activeConfigPath(generation), generationDir(generation), generation.stateDir, `${generation.runtimeDir}/bus`],
        shellQuote
      ),
      " "
    )}; do`,
    `  [ "\${#candidate}" -lt ${String(unixSocketPathLimit)} ] || fail "path exceeds the ${String(
      unixSocketPathLimit
    )}-byte UNIX socket cap: \${candidate}"`,
    "done",
    `sudo -n -v 2>/dev/null || fail ${shellQuote(
      "no armed sudo ticket; re-run pulumi up inside an armed pty (ops/handoffs/sudo-session.sh) so privileged steps stay non-interactive"
    )}`,
    `printf 'PREFLIGHT-OK generation=${generation.generationId} machine=%s host=%s uid=%s home=%s runtime=%s linger=%s units_load=%s manager=%s\\n' "\${actual_expected_machine_id}" "\${actual_expected_hostname}" "\${actual_expected_uid}" "\${actual_expected_home}" "\${XDG_RUNTIME_DIR}" "\${linger}" "\${units_load_timestamp}" "\${manager_state}"`,
  ]);

/**
 * Render the staging script that materializes a generation tree.
 *
 * Staging is side-by-side and never touches the live pointer: the generation
 * directory is created root-owned with exact modes, the pinned OpenClaw
 * release is installed into it, the unit file is written, and the candidate
 * config is validated by the candidate's own binary before apply is allowed to
 * proceed.
 *
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawStageScript
 * } from "@beep/infra"
 *
 * const script = renderOpenClawStageScript(
 *   makeOpenClawGeneration(
 *     OpenClawStackArgs.new(
 *       OpenClawExpectedIdentity.make({
 *         home: "/home/elpresidank",
 *         hostname: "DankStation",
 *         machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *         runtimeDir: "/run/user/1000",
 *         uid: 1000,
 *         username: "elpresidank"
 *       })
 *     )
 *   )
 * )
 * console.log(script.includes("STAGE-OK")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawStageScript = (generation: OpenClawGeneration): string => {
  const tree = renderOpenClawGenerationTree(generation);
  const stagedFiles = [
    { relativePath: configFileName, sentinel: configHeredocSentinel },
    { relativePath: manifestFileName, sentinel: manifestHeredocSentinel },
    { relativePath: runScriptFileName, sentinel: runScriptHeredocSentinel },
  ];

  return bashScript([
    ...scriptPreamble(generation),
    `sudo -n install -d -o root -g root -m 0755 ${shellQuote(generation.configRoot)}`,
    ...heredocLines({
      content: "beep-openclaw\n",
      install: "sudo -n install -o root -g root -m 0644",
      path: `${generation.configRoot}/.beep-openclaw`,
      sentinel: "BEEP_OPENCLAW_MARKER",
    }),
    `sudo -n install -d -o root -g root -m 0755 ${shellQuote(generationDir(generation))}`,
    ...A.flatten(
      A.getSomes(
        A.map(stagedFiles, ({ relativePath, sentinel }) =>
          O.map(R.get(tree, relativePath), (file) =>
            heredocLines({
              content: file.content,
              install: `sudo -n install -o root -g root -m ${file.mode}`,
              path: `${generationDir(generation)}/${relativePath}`,
              sentinel,
            })
          )
        )
      )
    ),
    `sudo -n env PATH=${shellQuote(`${generation.nodeBinDir}:/usr/bin:/bin`)} npm install --prefix ${shellQuote(
      generationDir(generation)
    )} --no-audit --no-fund --ignore-scripts ${shellQuote(`openclaw@${generation.openclawVersion}`)} >/dev/null`,
    `staged_version="$(sudo -n cat ${shellQuote(
      `${generationDir(generation)}/node_modules/openclaw/package.json`
    )} | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' | head -n 1)"`,
    `[ "\${staged_version}" = ${shellQuote(generation.openclawVersion)} ] || { printf 'STAGE-FAIL: staged openclaw %s does not match the pinned %s\\n' "\${staged_version}" ${shellQuote(
      generation.openclawVersion
    )} >&2; exit 73; }`,
    `install -d -m 0700 ${shellQuote(generation.credentialsDir)}`,
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
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawApplyScript
 * } from "@beep/infra"
 *
 * const script = renderOpenClawApplyScript(
 *   makeOpenClawGeneration(
 *     OpenClawStackArgs.new(
 *       OpenClawExpectedIdentity.make({
 *         home: "/home/elpresidank",
 *         hostname: "DankStation",
 *         machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *         runtimeDir: "/run/user/1000",
 *         uid: 1000,
 *         username: "elpresidank"
 *       })
 *     )
 *   )
 * )
 * console.log(script.includes("APPLY-OK")) // true
 * ```
 *
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
    '    sudo -n rm -rf -- "${state_dir}"',
    '    sudo -n cp -a -- "${snapshot}" "${state_dir}"',
    "  fi",
    '  if [ -n "${prior_pointer}" ]; then',
    '    sudo -n ln -s -- "${prior_pointer}" "${pointer}.rollback.$$"',
    '    sudo -n mv -T -- "${pointer}.rollback.$$" "${pointer}"',
    "  fi",
    "  systemctl --user daemon-reload || true",
    '  systemctl --user start "${unit}" || true',
    "}",
    'systemctl --user stop "${unit}" || true',
    `sudo -n install -d -o root -g root -m 0700 ${shellQuote(`${generation.configRoot}/${snapshotsDirName}`)}`,
    'sudo -n rm -rf -- "${snapshot}"',
    'if [ -d "${state_dir}" ]; then',
    '  sudo -n cp -a -- "${state_dir}" "${snapshot}"',
    "else",
    '  sudo -n install -d -o root -g root -m 0700 "${snapshot}"',
    "fi",
    'printf \'APPLY-SNAPSHOT: %s -> %s (stopped state, includes SQLite WAL sidecars)\\n\' "${state_dir}" "${snapshot}"',
    'printf \'%s\\n\' "${prior_pointer}" | sudo -n install -o root -g root -m 0644 /dev/stdin "${previous_pointer_file}"',
    `sudo -n ln -s -- ${shellQuote(generation.generationId)} "\${pointer}.tmp.$$"`,
    'sudo -n mv -T -- "${pointer}.tmp.$$" "${pointer}"',
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
    'printf \'%s\\n\' "$(state_user_version)" | sudo -n install -o root -g root -m 0644 /dev/stdin "${recorded_stamp}"',
    `printf '%s\\n' ${shellQuote(generation.generationId)} | sudo -n install -o root -g root -m 0644 /dev/stdin ${shellQuote(
      `${generationDir(generation)}/.beep-openclaw-committed`
    )}`,
    `printf 'APPLY-OK generation=${generation.generationId} pointer=%s user_version=%s\\n' "$(readlink "\${pointer}")" "$(state_user_version)"`,
  ]);

/**
 * Render the operator rollback script for a committed generation.
 *
 * Rollback is the apply failure path made explicit: stop, restore the
 * generation's stopped-state snapshot, return the pointer to the recorded
 * previous generation, reload, start, and wait for `/health`. It restores
 * state before switching binaries, which is exactly what makes starting the
 * older binary safe.
 *
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawRollbackScript
 * } from "@beep/infra"
 *
 * const script = renderOpenClawRollbackScript(
 *   makeOpenClawGeneration(
 *     OpenClawStackArgs.new(
 *       OpenClawExpectedIdentity.make({
 *         home: "/home/elpresidank",
 *         hostname: "DankStation",
 *         machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *         runtimeDir: "/run/user/1000",
 *         uid: 1000,
 *         username: "elpresidank"
 *       })
 *     )
 *   )
 * )
 * console.log(script.includes("ROLLBACK-OK")) // true
 * ```
 *
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
    'sudo -n rm -rf -- "${state_dir}"',
    'sudo -n cp -a -- "${snapshot}" "${state_dir}"',
    'printf \'ROLLBACK-RESTORE: %s -> %s\\n\' "${snapshot}" "${state_dir}"',
    'sudo -n ln -s -- "${previous_pointer}" "${pointer}.rollback.$$"',
    'sudo -n mv -T -- "${pointer}.rollback.$$" "${pointer}"',
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

const driftAuditLines = (input: {
  readonly generation: OpenClawGeneration;
  readonly identity: OpenClawExpectedIdentity;
}): ReadonlyArray<string> => {
  const generation = input.generation;

  return [
    "drift_alerts=0",
    "alert() {",
    `  printf '${driftAlertPrefix} %s expected=%s actual=%s\\n' "$1" "$2" "$3"`,
    "  drift_alerts=$((drift_alerts + 1))",
    "}",
    `pointer_target="$(readlink ${shellQuote(pointerPath(generation))} 2>/dev/null || printf 'absent')"`,
    `[ "\${pointer_target}" = ${shellQuote(
      generation.generationId
    )} ] || alert generation-pointer ${shellQuote(generation.generationId)} "\${pointer_target}"`,
    `installed_openclaw="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' ${shellQuote(
      `${generationDir(generation)}/node_modules/openclaw/package.json`
    )} 2>/dev/null | head -n 1 || printf 'absent')"`,
    `[ "\${installed_openclaw}" = ${shellQuote(
      generation.openclawVersion
    )} ] || alert openclaw-version ${shellQuote(generation.openclawVersion)} "\${installed_openclaw:-absent}"`,
    `installed_node="$(${shellQuote(`${generation.nodeBinDir}/node`)} --version 2>/dev/null | tr -d 'v' || printf 'absent')"`,
    `[ "\${installed_node}" = ${shellQuote(
      generation.nodeVersion
    )} ] || alert node-version ${shellQuote(generation.nodeVersion)} "\${installed_node:-absent}"`,
    `unit_sha="$(sha256sum ${shellQuote(unitPath(generation))} 2>/dev/null | cut -d' ' -f1 || printf 'absent')"`,
    // `$(...)` strips the trailing newline the heredoc carried, so the digest is
    // taken over the text plus the single newline the installed unit file ends with.
    "expected_unit_sha=\"$(printf '%s\\n' \"${expected_unit_text}\" | sha256sum | cut -d' ' -f1)\"",
    '[ "${unit_sha}" = "${expected_unit_sha}" ] || alert unit-content "${expected_unit_sha}" "${unit_sha:-absent}"',
    `unit_enabled="$(systemctl --user is-enabled ${shellQuote(generation.unitName)} 2>&1 || true)"`,
    `[ "\${unit_enabled}" = enabled ] || alert unit-enabled enabled "\${unit_enabled}"`,
    `unit_active="$(systemctl --user is-active ${shellQuote(generation.unitName)} 2>&1 || true)"`,
    `[ "\${unit_active}" = active ] || alert unit-active active "\${unit_active}"`,
    `config_sha="$(sha256sum ${shellQuote(activeConfigPath(generation))} 2>/dev/null | cut -d' ' -f1 || printf 'absent')"`,
    `[ "\${config_sha}" = ${shellQuote(
      generation.generationId
    )} ] || alert config-hash ${shellQuote(generation.generationId)} "\${config_sha:-absent}"`,
    // Mode comparison uses stat's octal form so the numeric encodings systemd and
    // stat report for the same permissions (33188 vs 420) can never read as drift.
    `config_mode="$(stat -c '%a' ${shellQuote(activeConfigPath(generation))} 2>/dev/null || printf 'absent')"`,
    `[ "\${config_mode}" = 644 ] || alert config-mode 644 "\${config_mode}"`,
    `run_mode="$(stat -c '%a' ${shellQuote(
      `${pointerPath(generation)}/${runScriptFileName}`
    )} 2>/dev/null || printf 'absent')"`,
    `[ "\${run_mode}" = 755 ] || alert run-script-mode 755 "\${run_mode}"`,
    `if env -i PATH=${shellQuote(`${generation.nodeBinDir}:/usr/bin:/bin`)} HOME=${shellQuote(
      generation.home
    )} OPENCLAW_CONFIG_PATH=${shellQuote(activeConfigPath(generation))} OPENCLAW_STATE_DIR=${shellQuote(
      generation.stateDir
    )} OPENCLAW_NIX_MODE=1 ${shellQuote(
      `${pointerPath(generation)}/node_modules/.bin/openclaw`
    )} config validate >/dev/null 2>&1; then`,
    "  config_validate=ok",
    "else",
    "  config_validate=failed",
    "fi",
    '[ "${config_validate}" = ok ] || alert config-validate ok "${config_validate}"',
    ...A.flatMap(identityChecks(input.identity), (check) => [
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
 * The audit deliberately lives outside the `command.local.Command` graph:
 * command resources skip execution during preview and expose no refresh, so
 * they can never be the drift detector. It mutates nothing, always exits zero,
 * and reports each divergence as an `ALERT: OPENCLAW_CONFIG_DRIFT` line —
 * repair is an operator redeploy, never an automatic correction.
 *
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawDriftAuditScript
 * } from "@beep/infra"
 *
 * const identity = OpenClawExpectedIdentity.make({
 *   home: "/home/elpresidank",
 *   hostname: "DankStation",
 *   machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *   runtimeDir: "/run/user/1000",
 *   uid: 1000,
 *   username: "elpresidank"
 * })
 * const script = renderOpenClawDriftAuditScript({
 *   generation: makeOpenClawGeneration(OpenClawStackArgs.new(identity)),
 *   identity
 * })
 * console.log(script.includes("ALERT: OPENCLAW_CONFIG_DRIFT")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawDriftAuditScript = (input: {
  readonly generation: OpenClawGeneration;
  readonly identity: OpenClawExpectedIdentity;
}): string =>
  bashScript(["set -uo pipefail", ...expectedUnitTextLines(input.generation), ...driftAuditLines(input), "exit 0"]);

/**
 * Render the acceptance probe script run after a successful apply.
 *
 * Probes are alert-only: they exercise the gateway health and channel
 * surfaces, then fold in the read-only drift inventory so a single command
 * output carries both acceptance evidence and the post-apply drift picture.
 *
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawProbeScript
 * } from "@beep/infra"
 *
 * const identity = OpenClawExpectedIdentity.make({
 *   home: "/home/elpresidank",
 *   hostname: "DankStation",
 *   machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *   runtimeDir: "/run/user/1000",
 *   uid: 1000,
 *   username: "elpresidank"
 * })
 * const script = renderOpenClawProbeScript({
 *   generation: makeOpenClawGeneration(OpenClawStackArgs.new(identity)),
 *   identity
 * })
 * console.log(script.includes("PROBE-COMPLETE")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawProbeScript = (input: {
  readonly generation: OpenClawGeneration;
  readonly identity: OpenClawExpectedIdentity;
}): string => {
  const generation = input.generation;

  return bashScript([
    "set -uo pipefail",
    `export XDG_RUNTIME_DIR=${shellQuote(generation.runtimeDir)}`,
    `export DBUS_SESSION_BUS_ADDRESS=${shellQuote(`unix:path=${generation.runtimeDir}/bus`)}`,
    ...expectedUnitTextLines(generation),
    `http_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 ${shellQuote(
      healthUrl(generation)
    )} || printf '000')"`,
    `printf 'PROBE-LIVENESS ${healthUrl(generation)} status=%s\\n' "\${http_status}"`,
    `if ${shellQuote(`${pointerPath(generation)}/node_modules/.bin/openclaw`)} gateway call health >/dev/null 2>&1; then`,
    "  printf 'PROBE-GATEWAY-HEALTH ok\\n'",
    "else",
    "  printf 'PROBE-GATEWAY-HEALTH unreachable\\n'",
    "fi",
    `if ${shellQuote(
      `${pointerPath(generation)}/node_modules/.bin/openclaw`
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
 * Render the encrypted snapshot shipping script.
 *
 * The archive is symmetrically encrypted locally before it ever leaves the
 * workstation; the passphrase is read from `OPENCLAW_BACKUP_PASSPHRASE`, which
 * the operator resolves out of band from the recorded `op://` reference, so no
 * secret material enters Pulumi state or the rendered command. The remote is
 * dumb storage: it receives the archive and returns a sha256 receipt that must
 * match the local digest.
 *
 * @example
 * ```ts
 * import {
 *   makeOpenClawGeneration,
 *   OpenClawBackupConfig,
 *   OpenClawExpectedIdentity,
 *   OpenClawStackArgs,
 *   renderOpenClawBackupShipScript
 * } from "@beep/infra"
 *
 * const script = renderOpenClawBackupShipScript({
 *   backup: OpenClawBackupConfig.make({ passphraseSecretRef: "op://beep-openclaw/backup/passphrase" }),
 *   generation: makeOpenClawGeneration(
 *     OpenClawStackArgs.new(
 *       OpenClawExpectedIdentity.make({
 *         home: "/home/elpresidank",
 *         hostname: "DankStation",
 *         machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *         runtimeDir: "/run/user/1000",
 *         uid: 1000,
 *         username: "elpresidank"
 *       })
 *     )
 *   )
 * })
 * console.log(script.includes("BACKUP-OK")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderOpenClawBackupShipScript = ({
  backup,
  generation,
}: {
  readonly backup: OpenClawBackupConfig;
  readonly generation: OpenClawGeneration;
}): string => {
  const remote = `${backup.user}@${backup.host}`;

  return bashScript([
    "set -euo pipefail",
    ...A.fromOption(O.map(backup.agentSocketPath, (socketPath) => `export SSH_AUTH_SOCK=${shellQuote(socketPath)}`)),
    `[ -n "\${${backupPassphraseEnvVar}:-}" ] || { printf 'BACKUP-FAIL: ${backupPassphraseEnvVar} is unset; resolve %s out of band before running pulumi up\\n' ${shellQuote(
      backup.passphraseSecretRef
    )} >&2; exit 78; }`,
    'work="$(mktemp -d)"',
    "trap 'rm -rf -- \"${work}\"' EXIT",
    `archive="\${work}/openclaw-${generation.generationId}-$(date -u +%Y%m%dT%H%M%SZ).tar"`,
    `sudo -n tar -cf "\${archive}" -C ${shellQuote(generation.configRoot)} ${shellQuote(
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
 * Pulumi-facing args for the OpenClaw workstation component.
 *
 * `identity` has no default on purpose — the stack must be told which machine
 * it owns before it can render anything.
 *
 * @example
 * ```ts
 * import { OpenClawExpectedIdentity, OpenClawStackArgs } from "@beep/infra"
 *
 * const args = OpenClawStackArgs.new(
 *   OpenClawExpectedIdentity.make({
 *     home: "/home/elpresidank",
 *     hostname: "DankStation",
 *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *     runtimeDir: "/run/user/1000",
 *     uid: 1000,
 *     username: "elpresidank"
 *   })
 * )
 * console.log(args.paths.unitName) // "openclaw.service"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawStackArgs extends S.Class<OpenClawStackArgs>($I`OpenClawStackArgs`)(
  {
    backup: S.OptionFromOptionalKey(OpenClawBackupConfig).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Backup shipping inputs; absent when snapshots stay on the workstation.",
    }),
    deployment: OpenClawDeploymentConfig.pipe(
      S.withConstructorDefault(Effect.succeed(OpenClawDeploymentConfig.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ).annotateKey({
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
  },
  $I.annote("OpenClawStackArgs", {
    description: "Pulumi-facing OpenClaw workstation arguments resolved before component construction.",
  })
) {
  /**
   * Build component args around a declared workstation identity.
   *
   * @example
   * ```ts
   * import { OpenClawExpectedIdentity, OpenClawStackArgs } from "@beep/infra"
   *
   * const args = OpenClawStackArgs.new(
   *   OpenClawExpectedIdentity.make({
   *     home: "/home/elpresidank",
   *     hostname: "DankStation",
   *     machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
   *     runtimeDir: "/run/user/1000",
   *     uid: 1000,
   *     username: "elpresidank"
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
    deployment: OpenClawDeploymentConfig = OpenClawDeploymentConfig.make({}),
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

/**
 * Build OpenClaw stack args from decoded Pulumi config values.
 *
 * Missing identity keys raise a `pulumi.RunError` rather than defaulting: an
 * apply against an undeclared machine is the outcome this stack exists to make
 * impossible.
 *
 * @example
 * ```ts
 * import { makeOpenClawStackArgsFromConfigValues } from "@beep/infra"
 *
 * const args = makeOpenClawStackArgsFromConfigValues({
 *   expectedHome: "/home/elpresidank",
 *   expectedHostname: "DankStation",
 *   expectedMachineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *   expectedRuntimeDir: "/run/user/1000",
 *   expectedUid: 1000,
 *   expectedUsername: "elpresidank"
 * })
 * console.log(args.identity.hostname) // "DankStation"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOpenClawStackArgsFromConfigValues = ({
  agentId,
  agentModel,
  agentName,
  agentWorkspace,
  backupPassphraseSecretRef,
  backupRemoteDir,
  backupSshAgentSocketPath,
  backupSshHost,
  backupSshUser,
  configRoot,
  expectedHome,
  expectedHostname,
  expectedMachineId,
  expectedRuntimeDir,
  expectedUid,
  expectedUsername,
  gatewayAuthTokenRef,
  gatewayPort,
  logFilePath,
  nodeBinDir,
  openclawVersion,
  resolverCommandPath,
  resolverOpBinaryPath,
  resolverTrustedDir,
  stateDir,
  unitName,
}: OpenClawPulumiConfigInputValues = {}): OpenClawStackArgs =>
  OpenClawStackArgs.new(
    OpenClawExpectedIdentity.make({
      home: requiredConfigValue("expectedHome", expectedHome),
      hostname: requiredConfigValue("expectedHostname", expectedHostname),
      machineId: requiredConfigValue("expectedMachineId", expectedMachineId),
      runtimeDir: requiredConfigValue("expectedRuntimeDir", expectedRuntimeDir),
      uid: requiredConfigValue("expectedUid", expectedUid),
      username: requiredConfigValue("expectedUsername", expectedUsername),
    }),
    OpenClawDeploymentConfig.make({
      ...O.getSomesStruct({
        agentId: O.fromUndefinedOr(agentId),
        agentModel: O.fromUndefinedOr(agentModel),
        agentName: O.fromUndefinedOr(agentName),
        agentWorkspace: O.fromUndefinedOr(agentWorkspace),
        gatewayAuthTokenRef: secretReferenceFromPulumiConfig("gatewayAuthTokenRef", gatewayAuthTokenRef),
        gatewayPort: O.fromUndefinedOr(gatewayPort),
        logFilePath: O.fromUndefinedOr(logFilePath),
        openclawVersion: targetVersionFromPulumiConfig(openclawVersion),
        resolverCommandPath: O.fromUndefinedOr(resolverCommandPath),
        resolverOpBinaryPath: O.fromUndefinedOr(resolverOpBinaryPath),
        resolverTrustedDir: O.fromUndefinedOr(resolverTrustedDir),
      }),
    }),
    OpenClawWorkstationPaths.make({
      ...O.getSomesStruct({
        configRoot: O.fromUndefinedOr(configRoot),
        nodeBinDir: O.fromUndefinedOr(nodeBinDir),
        stateDir: O.fromUndefinedOr(stateDir),
        unitName: O.fromUndefinedOr(unitName),
      }),
    }),
    O.map(O.fromUndefinedOr(backupPassphraseSecretRef), (passphraseSecretRef) =>
      OpenClawBackupConfig.make({
        agentSocketPath: O.fromUndefinedOr(backupSshAgentSocketPath),
        passphraseSecretRef,
        ...O.getSomesStruct({
          host: O.fromUndefinedOr(backupSshHost),
          remoteDir: O.fromUndefinedOr(backupRemoteDir),
          user: O.fromUndefinedOr(backupSshUser),
        }),
      })
    )
  );

/**
 * Load OpenClaw stack args from Pulumi config.
 *
 * @example
 * ```ts
 * import { loadOpenClawStackArgs } from "@beep/infra"
 *
 * console.log(loadOpenClawStackArgs)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadOpenClawStackArgs = (): OpenClawStackArgs => {
  const config = new pulumi.Config("openclaw");

  return makeOpenClawStackArgsFromConfigValues({
    agentId: config.get("agentId"),
    agentModel: config.get("agentModel"),
    agentName: config.get("agentName"),
    agentWorkspace: config.get("agentWorkspace"),
    backupPassphraseSecretRef: config.get("backupPassphraseSecretRef"),
    backupRemoteDir: config.get("backupRemoteDir"),
    backupSshAgentSocketPath: config.get("backupSshAgentSocketPath"),
    backupSshHost: config.get("backupSshHost"),
    backupSshUser: config.get("backupSshUser"),
    configRoot: config.get("configRoot"),
    expectedHome: config.get("expectedHome"),
    expectedHostname: config.get("expectedHostname"),
    expectedMachineId: config.get("expectedMachineId"),
    expectedRuntimeDir: config.get("expectedRuntimeDir"),
    expectedUid: config.getNumber("expectedUid"),
    expectedUsername: config.get("expectedUsername"),
    gatewayAuthTokenRef: config.get("gatewayAuthTokenRef"),
    gatewayPort: config.getNumber("gatewayPort"),
    logFilePath: config.get("logFilePath"),
    nodeBinDir: config.get("nodeBinDir"),
    openclawVersion: config.get("openclawVersion"),
    resolverCommandPath: config.get("resolverCommandPath"),
    resolverOpBinaryPath: config.get("resolverOpBinaryPath"),
    resolverTrustedDir: config.get("resolverTrustedDir"),
    stateDir: config.get("stateDir"),
    unitName: config.get("unitName"),
  });
};

/**
 * Pulumi component applying one OpenClaw generation to the bound workstation.
 *
 * Children run in a fixed order — preflight, stage, apply, probe, and an
 * optional backup ship — each as a `command.local.Command` whose `create` and
 * `update` are the same rendered script, so re-running an unchanged generation
 * is a no-op. `triggers` carry the scalar inputs *and* the rendered document
 * bodies, which is what makes a changed unit or config re-execute the chain.
 * Nothing is torn down on destroy.
 *
 * @example
 * ```ts
 * import { OpenClawExpectedIdentity, OpenClawStack, OpenClawStackArgs } from "@beep/infra"
 *
 * console.log(OpenClawStack)
 * console.log(
 *   OpenClawStackArgs.new(
 *     OpenClawExpectedIdentity.make({
 *       home: "/home/elpresidank",
 *       hostname: "DankStation",
 *       machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *       runtimeDir: "/run/user/1000",
 *       uid: 1000,
 *       username: "elpresidank"
 *     })
 *   ).paths.configRoot
 * )
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export class OpenClawStack extends pulumi.ComponentResource {
  /**
   * Resolved generation as a Pulumi output.
   *
   * @since 0.0.0
   */
  public readonly generation: pulumi.Output<OpenClawGeneration>;

  /**
   * Content-addressed generation id, which is also the generation directory name.
   *
   * @since 0.0.0
   */
  public readonly generationId: pulumi.Output<string>;

  /**
   * Root-owned directory holding every generation and the `current` pointer.
   *
   * @since 0.0.0
   */
  public readonly configRoot: pulumi.Output<string>;

  /**
   * Absolute directory of the generation this stack applies.
   *
   * @since 0.0.0
   */
  public readonly generationDir: pulumi.Output<string>;

  /**
   * OpenClaw state root snapshotted before every generation switch.
   *
   * @since 0.0.0
   */
  public readonly stateDir: pulumi.Output<string>;

  /**
   * Name of the stack-owned `systemd --user` unit.
   *
   * @since 0.0.0
   */
  public readonly unitName: pulumi.Output<string>;

  /**
   * Loopback TCP port acceptance probes poll.
   *
   * @since 0.0.0
   */
  public readonly gatewayPort: pulumi.Output<number>;

  /**
   * Pinned OpenClaw version staged into the generation.
   *
   * @since 0.0.0
   */
  public readonly openclawVersion: pulumi.Output<string>;

  /**
   * Pinned Node version recorded in the generation manifest.
   *
   * @since 0.0.0
   */
  public readonly nodeVersion: pulumi.Output<string>;

  /**
   * Read-only drift audit command an operator runs outside the resource graph.
   *
   * @since 0.0.0
   */
  public readonly driftAuditCommand: pulumi.Output<string>;

  /**
   * Operator rollback command for the applied generation.
   *
   * @since 0.0.0
   */
  public readonly rollbackCommand: pulumi.Output<string>;

  /**
   * Captured stdout from the workstation preflight command.
   *
   * @since 0.0.0
   */
  public readonly preflightStdout: pulumi.Output<string>;

  /**
   * Captured stdout from the generation staging command.
   *
   * @since 0.0.0
   */
  public readonly stageStdout: pulumi.Output<string>;

  /**
   * Captured stdout from the staged apply command.
   *
   * @since 0.0.0
   */
  public readonly applyStdout: pulumi.Output<string>;

  /**
   * Captured stdout from the acceptance probe command.
   *
   * @since 0.0.0
   */
  public readonly probeStdout: pulumi.Output<string>;

  /**
   * Captured stdout from the encrypted backup shipping command.
   *
   * @since 0.0.0
   */
  public readonly backupShipStdout: pulumi.Output<string>;

  public constructor(name: string, args: OpenClawStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super("beep:infra:OpenClawStack", name, {}, opts);

    const generation = makeOpenClawGeneration(args);
    const identity = args.identity;
    const unitText = renderOpenClawUnit(generation);
    const runScript = renderOpenClawRunScript(generation);
    const preflightScript = renderOpenClawPreflightScript({ generation, identity });
    const stageScript = renderOpenClawStageScript(generation);
    const applyScript = renderOpenClawApplyScript(generation);
    const probeScript = renderOpenClawProbeScript({ generation, identity });
    const generationTriggers = [
      generation.generationId,
      generation.canonicalJson,
      generation.gatewayPort,
      generation.nodeVersion,
      generation.openclawVersion,
      runScript,
      unitText,
    ];
    const preflight = new command.local.Command(
      `${name}-preflight`,
      {
        create: preflightScript,
        logging: command.types.enums.local.Logging.StdoutAndStderr,
        triggers: [
          identity.machineId,
          identity.hostname,
          identity.uid,
          identity.username,
          identity.home,
          identity.runtimeDir,
          preflightScript,
        ],
        update: preflightScript,
      },
      { parent: this }
    );
    const stage = new command.local.Command(
      `${name}-stage`,
      {
        create: stageScript,
        logging: command.types.enums.local.Logging.StdoutAndStderr,
        triggers: [...generationTriggers, stageScript],
        update: stageScript,
      },
      { dependsOn: preflight, parent: this }
    );
    const apply = new command.local.Command(
      `${name}-apply`,
      {
        create: applyScript,
        logging: command.types.enums.local.Logging.StdoutAndStderr,
        triggers: [...generationTriggers, applyScript],
        update: applyScript,
      },
      { dependsOn: stage, parent: this }
    );
    const probe = new command.local.Command(
      `${name}-probe`,
      {
        create: probeScript,
        logging: command.types.enums.local.Logging.StdoutAndStderr,
        triggers: [...generationTriggers, probeScript],
        update: probeScript,
      },
      { dependsOn: apply, parent: this }
    );
    const backupShip = O.getOrUndefined(
      O.map(args.backup, (backup) => {
        const backupScript = renderOpenClawBackupShipScript({ backup, generation });

        return new command.local.Command(
          `${name}-backup-ship`,
          {
            create: backupScript,
            logging: command.types.enums.local.Logging.StdoutAndStderr,
            triggers: [
              ...generationTriggers,
              backup.host,
              backup.user,
              backup.remoteDir,
              O.getOrElse(backup.agentSocketPath, () => ""),
              backupScript,
            ],
            update: backupScript,
          },
          { dependsOn: probe, parent: this }
        );
      })
    );

    this.generation = pulumi.output(generation);
    this.generationId = pulumi.output(generation.generationId);
    this.configRoot = pulumi.output(generation.configRoot);
    this.generationDir = pulumi.output(generationDir(generation));
    this.stateDir = pulumi.output(generation.stateDir);
    this.unitName = pulumi.output(generation.unitName);
    this.gatewayPort = pulumi.output(generation.gatewayPort);
    this.openclawVersion = pulumi.output(generation.openclawVersion);
    this.nodeVersion = pulumi.output(generation.nodeVersion);
    this.driftAuditCommand = pulumi.output(renderOpenClawDriftAuditScript({ generation, identity }));
    this.rollbackCommand = pulumi.output(renderOpenClawRollbackScript(generation));
    this.preflightStdout = pulumi.secret(preflight.stdout);
    this.stageStdout = pulumi.secret(stage.stdout);
    this.applyStdout = pulumi.secret(apply.stdout);
    this.probeStdout = pulumi.secret(probe.stdout);
    this.backupShipStdout = pulumi.secret(backupShip?.stdout ?? pulumi.output(""));

    this.registerOutputs({
      applyStdout: this.applyStdout,
      backupShipStdout: this.backupShipStdout,
      configRoot: this.configRoot,
      driftAuditCommand: this.driftAuditCommand,
      gatewayPort: this.gatewayPort,
      generation: this.generation,
      generationDir: this.generationDir,
      generationId: this.generationId,
      nodeVersion: this.nodeVersion,
      openclawVersion: this.openclawVersion,
      preflightStdout: this.preflightStdout,
      probeStdout: this.probeStdout,
      rollbackCommand: this.rollbackCommand,
      stageStdout: this.stageStdout,
      stateDir: this.stateDir,
      unitName: this.unitName,
    });
  }
}
