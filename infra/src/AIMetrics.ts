/**
 * Pulumi orchestration surface for the repo AI metrics stack.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import {
  AiMetricsDeployTarget,
  AiMetricsInstallInput,
  AiMetricsTool,
  makeAiMetricsInstallSpec,
} from "@beep/repo-ai-metrics";
import { SchemaUtils } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import { Effect, pipe, Result } from "effect";
import * as S from "effect/Schema";
import { optionalPulumiConfigFields, withPulumiConfigDecodeEffect } from "./internal/PulumiConfigSchema.ts";
import type { AiMetricsInstallSpec, AiMetricsOtlpEndpointSpec, AiMetricsServiceSpec } from "@beep/repo-ai-metrics";

const $I = $InfraId.create("AIMetrics");
const defaultPhoenixTailnetHttpsPort = 8447;
const defaultRemoteConfigRoot = "/home/elpresidank/ai-metrics";
const defaultRemoteMirrorRoot = "/srv/data/ai-metrics/p7-derived-mirror";
const defaultSshHost = "dankserver";
const defaultSshUser = "elpresidank";
const defaultTailnetFqdn = "dankserver.tailc7c348.ts.net";
const remotePhoenixServiceName = "ai-metrics-phoenix.service";
const remotePhoenixComposeFile = "phoenix.compose.yaml";
const remotePhoenixTailnetPortStateFile = "phoenix-tailnet-https-port";

const TailnetHttpsPortRange = S.isBetween(
  {
    minimum: 1,
    maximum: 65_535,
  },
  {
    identifier: $I`TailnetHttpsPortRange`,
    title: "Tailnet HTTPS Port Range",
    description: "A Tailscale Serve HTTPS port in the inclusive TCP port range 1 through 65535.",
    message: "Expected a Tailnet HTTPS port between 1 and 65535",
  }
);

const TailnetHttpsPort = S.Int.check(TailnetHttpsPortRange).pipe(
  $I.annoteSchema("TailnetHttpsPort", {
    description: "A Tailscale Serve HTTPS port in the inclusive TCP port range 1 through 65535.",
  })
);

const schemaIssueToPulumiConfigError =
  (key: string, value: string) =>
  (cause: S.SchemaError): pulumi.RunError =>
    new pulumi.RunError(`Invalid aiMetrics:${key} Pulumi config value "${value}": ${cause.message}`);

const decodeAiMetricsDeployTarget = S.decodeUnknownResult(AiMetricsDeployTarget);
const decodeAiMetricsTool = S.decodeUnknownResult(AiMetricsTool);

const targetFromPulumiConfig = (value: string | undefined): O.Option<AiMetricsDeployTarget> =>
  O.map(O.fromUndefinedOr(value), (value) =>
    Result.getOrThrowWith(decodeAiMetricsDeployTarget(value), schemaIssueToPulumiConfigError("target", value))
  );

const toolFromPulumiConfig = (value: string | undefined): O.Option<AiMetricsTool> =>
  O.map(O.fromUndefinedOr(value), (value) =>
    Result.getOrThrowWith(decodeAiMetricsTool(value), schemaIssueToPulumiConfigError("defaultTool", value))
  );

const defaultServiceForSpec = (spec: AiMetricsInstallSpec): AiMetricsServiceSpec =>
  pipe(
    spec.services,
    A.findFirst((service) => service.enabledByDefault),
    O.getOrThrowWith(() => new pulumi.RunError("AI metrics install spec does not contain an enabled backend service."))
  );

const remotePhoenixDefaultService = (service: AiMetricsServiceSpec): AiMetricsServiceSpec =>
  pipe(
    O.some(service),
    O.filter((candidate) => candidate.tool === AiMetricsTool.Enum.phoenix),
    O.getOrThrowWith(
      () => new pulumi.RunError("P5b AI metrics remote apply only supports Phoenix as the default backend service.")
    )
  );

const shellQuote = (value: string): string => `'${pipe(value, Str.replace(/'/gu, `'"'"'`))}'`;

const remotePhoenixComposePath = (remoteConfigRoot: string): string =>
  `${remoteConfigRoot}/${remotePhoenixComposeFile}`;

const remoteSshConnection = (remote: AIMetricsRemoteDeploymentConfig): command.types.input.remote.ConnectionArgs => ({
  host: remote.ssh.host,
  ...O.getSomesStruct({ agentSocketPath: remote.ssh.agentSocketPath }),
  user: remote.ssh.user,
});

const renderRemotePhoenixCompose = (service: AiMetricsServiceSpec): string => `name: beep-ai-metrics-dankserver
services:
  ${service.composeServiceName}:
    container_name: beep-ai-metrics-phoenix
    environment:
      PHOENIX_WORKING_DIR: /data
    image: ${service.image}
    ports:
      - 127.0.0.1:6006:6006
    restart: unless-stopped
    volumes:
      - phoenix_data:/data
volumes:
  phoenix_data: {}
`;

const renderRemotePhoenixSystemdService = (remoteConfigRoot: string): string => `[Unit]
Description=Beep AI Metrics Phoenix backend
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${remoteConfigRoot}
ExecStart=/usr/bin/sg docker -c '/usr/bin/docker compose -f ${remotePhoenixComposePath(
  remoteConfigRoot
)} up -d --remove-orphans'
ExecStop=/usr/bin/sg docker -c '/usr/bin/docker compose -f ${remotePhoenixComposePath(remoteConfigRoot)} down'
TimeoutStartSec=0

[Install]
WantedBy=default.target
`;

// cspell:ignore DBUS
const userSystemdEnvironment = A.join(
  [
    'export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"',
    'export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"',
  ],
  "\n"
);

const renderRemotePreflightCommand = (remote: AIMetricsRemoteDeploymentConfig): string =>
  `/bin/bash -lc ${shellQuote(
    A.join(
      [
        "set -euo pipefail",
        "command -v docker >/dev/null",
        "command -v sg >/dev/null",
        "command -v systemctl >/dev/null",
        "command -v tailscale >/dev/null",
        "command -v curl >/dev/null",
        "docker compose version >/dev/null",
        "systemctl --user --version >/dev/null",
        "tailscale status --json >/dev/null",
        `printf 'AI metrics Phoenix preflight passed for ${remote.tailnetFqdn}:${remote.phoenixTailnetHttpsPort}\\n'`,
      ],
      "\n"
    )
  )}`;

const renderRemoteApplyCommand = (remote: AIMetricsRemoteDeploymentConfig, service: AiMetricsServiceSpec): string =>
  `/bin/bash -lc ${shellQuote(
    A.join(
      [
        "set -euo pipefail",
        userSystemdEnvironment,
        `remote_root=${shellQuote(remote.remoteConfigRoot)}`,
        `compose_path="\${remote_root}/${remotePhoenixComposeFile}"`,
        `port_state_path="\${remote_root}/${remotePhoenixTailnetPortStateFile}"`,
        `current_tailnet_port=${shellQuote(String(remote.phoenixTailnetHttpsPort))}`,
        `unit_path="\${HOME}/.config/systemd/user/${remotePhoenixServiceName}"`,
        'install -d -m 0755 "${remote_root}"',
        'install -d -m 0755 "${HOME}/.config/systemd/user"',
        "cat > \"${compose_path}\" <<'BEEP_AI_METRICS_PHOENIX_COMPOSE'",
        renderRemotePhoenixCompose(service),
        "BEEP_AI_METRICS_PHOENIX_COMPOSE",
        "cat > \"${unit_path}\" <<'BEEP_AI_METRICS_PHOENIX_SYSTEMD'",
        renderRemotePhoenixSystemdService(remote.remoteConfigRoot),
        "BEEP_AI_METRICS_PHOENIX_SYSTEMD",
        "systemctl --user daemon-reload",
        `systemctl --user enable ${remotePhoenixServiceName} >/dev/null`,
        `systemctl --user restart ${remotePhoenixServiceName}`,
        'if [ -f "${port_state_path}" ]; then',
        '  previous_tailnet_port="$(tr -d \'[:space:]\' < "${port_state_path}")"',
        '  if printf "%s" "${previous_tailnet_port}" | grep -Eq \'^[0-9]+$\' && [ "${previous_tailnet_port}" != "${current_tailnet_port}" ]; then',
        '    tailscale serve --https="${previous_tailnet_port}" off >/dev/null || true',
        "  fi",
        "fi",
        'tailscale serve --yes --bg --https="${current_tailnet_port}" http://127.0.0.1:6006',
        'printf "%s\\n" "${current_tailnet_port}" > "${port_state_path}"',
        `printf 'AI metrics Phoenix remote apply completed at ${service.publicUrl}\\n'`,
      ],
      "\n"
    )
  )}`;

const renderRemoteHealthCommand = (_remote: AIMetricsRemoteDeploymentConfig, service: AiMetricsServiceSpec): string =>
  `/bin/bash -lc ${shellQuote(
    A.join(
      [
        "set -euo pipefail",
        userSystemdEnvironment,
        `systemctl --user is-active --quiet ${remotePhoenixServiceName}`,
        "for attempt in $(seq 1 24); do",
        "  if curl -fsS http://127.0.0.1:6006 >/dev/null; then",
        "    break",
        "  fi",
        '  if [ "${attempt}" -eq 24 ]; then',
        "    docker logs beep-ai-metrics-phoenix --tail 80 || true",
        "    exit 1",
        "  fi",
        "  sleep 5",
        "done",
        `tailscale serve status --json | grep -F ${shellQuote("127.0.0.1:6006")} >/dev/null`,
        `curl -fsS ${shellQuote(service.publicUrl)} >/dev/null`,
        `printf 'AI metrics Phoenix health check passed for ${service.publicUrl}\\n'`,
      ],
      "\n"
    )
  )}`;

type AIMetricsPulumiConfigValuesFields = {
  readonly dataRoot?: string | undefined;
  readonly defaultTool?: AiMetricsTool | undefined;
  readonly hashSaltSecretRef?: string | undefined;
  readonly phoenixImage?: string | undefined;
  readonly phoenixTailnetHttpsPort?: number | undefined;
  readonly publicBaseUrl?: string | undefined;
  readonly rawArchiveKeySecretRef?: string | undefined;
  readonly remoteConfigRoot?: string | undefined;
  readonly remoteMirrorRoot?: string | undefined;
  readonly sshAgentSocketPath?: string | undefined;
  readonly sshHost?: string | undefined;
  readonly sshUser?: string | undefined;
  readonly tailnetFqdn?: string | undefined;
  readonly target?: AiMetricsDeployTarget | undefined;
};

type AIMetricsPulumiConfigInputValues = Omit<AIMetricsPulumiConfigValuesFields, "defaultTool" | "target"> & {
  readonly defaultTool?: string | undefined;
  readonly target?: string | undefined;
};

/**
 * Raw optional Pulumi config values before target-aware defaults are applied.
 *
 * @example
 * ```ts
 * import { AIMetricsPulumiConfigValues } from "@beep/infra"
 *
 * console.log(AIMetricsPulumiConfigValues)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AIMetricsPulumiConfigValues = S.Class<AIMetricsPulumiConfigValuesFields>($I`AIMetricsPulumiConfigValues`)(
  {
    dataRoot: S.String,
    defaultTool: AiMetricsTool,
    hashSaltSecretRef: S.String,
    phoenixImage: S.String,
    phoenixTailnetHttpsPort: TailnetHttpsPort,
    publicBaseUrl: S.String,
    rawArchiveKeySecretRef: S.String,
    remoteConfigRoot: S.String,
    remoteMirrorRoot: S.String,
    sshAgentSocketPath: S.String,
    sshHost: S.String,
    sshUser: S.String,
    tailnetFqdn: S.String,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AIMetricsPulumiConfigValues", { description: "Configuration values for AIMetrics Pulumi resources" })
)
  .mapFields(optionalPulumiConfigFields)
  .pipe(withPulumiConfigDecodeEffect);

/**
 * SSH connection inputs for native Pulumi command resources.
 *
 * @example
 * ```ts
 * import { AIMetricsRemoteSshConfig } from "@beep/infra"
 *
 * console.log(AIMetricsRemoteSshConfig.make({}).host)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AIMetricsRemoteSshConfig extends S.Class<AIMetricsRemoteSshConfig>($I`AIMetricsRemoteSshConfig`)(
  {
    agentSocketPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    host: S.String.pipe(SchemaUtils.withKeyDefaults(defaultSshHost)),
    user: S.String.pipe(SchemaUtils.withKeyDefaults(defaultSshUser)),
  },
  $I.annote("AIMetricsRemoteSshConfig", {
    description: "Pulumi SSH connection inputs for deploying the AI metrics Phoenix backend with the local SSH agent.",
  })
) {}

/**
 * Remote deployment inputs for the dankserver AI metrics Phoenix backend.
 *
 * @example
 * ```ts
 * import { AIMetricsRemoteDeploymentConfig } from "@beep/infra"
 *
 * console.log(AIMetricsRemoteDeploymentConfig.make({}).phoenixTailnetHttpsPort)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AIMetricsRemoteDeploymentConfig extends S.Class<AIMetricsRemoteDeploymentConfig>(
  $I`AIMetricsRemoteDeploymentConfig`
)(
  {
    phoenixTailnetHttpsPort: TailnetHttpsPort.pipe(SchemaUtils.withKeyDefaults(defaultPhoenixTailnetHttpsPort)),
    remoteConfigRoot: S.String.pipe(SchemaUtils.withKeyDefaults(defaultRemoteConfigRoot)),
    remoteMirrorRoot: S.String.pipe(SchemaUtils.withKeyDefaults(defaultRemoteMirrorRoot)),
    ssh: AIMetricsRemoteSshConfig.pipe(
      S.withConstructorDefault(Effect.succeed(AIMetricsRemoteSshConfig.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    tailnetFqdn: S.String.pipe(SchemaUtils.withKeyDefaults(defaultTailnetFqdn)),
  },
  $I.annote("AIMetricsRemoteDeploymentConfig", {
    description: "Remote host, systemd, and Tailscale Serve settings for the AI metrics Phoenix backend.",
  })
) {}

/**
 * Pulumi-facing args for the AI metrics component.
 *
 * @example
 * ```ts
 * import { AIMetricsStackArgs } from "@beep/infra"
 *
 * console.log(AIMetricsStackArgs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AIMetricsStackArgs extends S.Class<AIMetricsStackArgs>($I`AIMetricsStackArgs`)(
  {
    install: AiMetricsInstallInput,
    remote: AIMetricsRemoteDeploymentConfig.pipe(
      S.withConstructorDefault(Effect.succeed(AIMetricsRemoteDeploymentConfig.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
  },
  $I.annote("AIMetricsStackArgs", {
    description: "Pulumi-facing AI metrics install arguments resolved before component construction.",
  })
) {
  /**
   * Build Pulumi component args from a schema-first install input.
   *
   * @example
   * ```ts
   * import { AIMetricsStackArgs } from "@beep/infra"
   *
   * console.log(AIMetricsStackArgs.new().install.target)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (
    install: AiMetricsInstallInput = AiMetricsInstallInput.make({}),
    remote: AIMetricsRemoteDeploymentConfig = AIMetricsRemoteDeploymentConfig.make({})
  ): AIMetricsStackArgs =>
    AIMetricsStackArgs.make({
      install,
      remote,
    });
}

/**
 * Build AI metrics stack args from decoded Pulumi config values.
 *
 * @example
 * ```ts
 * import { makeAIMetricsStackArgsFromConfigValues } from "@beep/infra"
 *
 * console.log(makeAIMetricsStackArgsFromConfigValues({ target: "local" }).install.target)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeAIMetricsStackArgsFromConfigValues = ({
  dataRoot,
  defaultTool,
  hashSaltSecretRef,
  phoenixImage,
  phoenixTailnetHttpsPort,
  publicBaseUrl,
  rawArchiveKeySecretRef,
  remoteConfigRoot,
  remoteMirrorRoot,
  sshAgentSocketPath,
  sshHost,
  sshUser,
  tailnetFqdn,
  target,
}: AIMetricsPulumiConfigInputValues = {}): AIMetricsStackArgs => {
  const resolvedTarget = targetFromPulumiConfig(target);
  const remote = AIMetricsRemoteDeploymentConfig.make({
    ...O.getSomesStruct({ phoenixTailnetHttpsPort: O.fromUndefinedOr(phoenixTailnetHttpsPort) }),
    ...O.getSomesStruct({ remoteConfigRoot: O.fromUndefinedOr(remoteConfigRoot) }),
    ...O.getSomesStruct({ remoteMirrorRoot: O.fromUndefinedOr(remoteMirrorRoot) }),
    ssh: AIMetricsRemoteSshConfig.make({
      ...O.getSomesStruct({ host: O.fromUndefinedOr(sshHost) }),
      ...O.getSomesStruct({ user: O.fromUndefinedOr(sshUser) }),
      agentSocketPath: O.fromUndefinedOr(sshAgentSocketPath),
    }),
    ...O.getSomesStruct({ tailnetFqdn: O.fromUndefinedOr(tailnetFqdn) }),
  });
  const installTarget = AiMetricsInstallInput.make(O.getSomesStruct({ target: resolvedTarget })).target;
  const resolvedPublicBaseUrl = O.orElse(O.fromUndefinedOr(publicBaseUrl), () =>
    AiMetricsDeployTarget.$match(installTarget, {
      dankserver: () => O.some(`https://${remote.tailnetFqdn}:${remote.phoenixTailnetHttpsPort}`),
      local: O.none<string>,
    })
  );

  return AIMetricsStackArgs.new(
    AiMetricsInstallInput.make({
      ...O.getSomesStruct({ defaultTool: toolFromPulumiConfig(defaultTool) }),
      ...O.getSomesStruct({ dataRoot: O.fromUndefinedOr(dataRoot) }),
      ...O.getSomesStruct({ hashSaltSecretRef: O.fromUndefinedOr(hashSaltSecretRef) }),
      ...O.getSomesStruct({ phoenixImage: O.fromUndefinedOr(phoenixImage) }),
      ...O.getSomesStruct({ publicBaseUrl: resolvedPublicBaseUrl }),
      ...O.getSomesStruct({ rawArchiveKeySecretRef: O.fromUndefinedOr(rawArchiveKeySecretRef) }),
      ...O.getSomesStruct({ target: resolvedTarget }),
    }),
    remote
  );
};

/**
 * Load AI metrics args from Pulumi config.
 *
 * @example
 * ```ts
 * import { loadAIMetricsStackArgs } from "@beep/infra"
 *
 * console.log(loadAIMetricsStackArgs)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadAIMetricsStackArgs = (): AIMetricsStackArgs => {
  const config = new pulumi.Config("aiMetrics");

  return makeAIMetricsStackArgsFromConfigValues({
    dataRoot: config.get("dataRoot"),
    defaultTool: config.get("defaultTool"),
    hashSaltSecretRef: config.get("hashSaltSecretRef"),
    phoenixImage: config.get("phoenixImage"),
    phoenixTailnetHttpsPort: config.getNumber("phoenixTailnetHttpsPort"),
    publicBaseUrl: config.get("publicBaseUrl"),
    rawArchiveKeySecretRef: config.get("rawArchiveKeySecretRef"),
    remoteConfigRoot: config.get("remoteConfigRoot"),
    remoteMirrorRoot: config.get("remoteMirrorRoot"),
    sshAgentSocketPath: config.get("sshAgentSocketPath"),
    sshHost: config.get("sshHost"),
    sshUser: config.get("sshUser"),
    tailnetFqdn: config.get("tailnetFqdn"),
    target: config.get("target"),
  });
};

/**
 * Import-safe Pulumi component for the AI metrics target contract.
 *
 * @example
 * ```ts
 * import { AIMetricsStack, AIMetricsStackArgs } from "@beep/infra"
 *
 * console.log(AIMetricsStack)
 * console.log(AIMetricsStackArgs)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export class AIMetricsStack extends pulumi.ComponentResource {
  /**
   * Resolved install spec as a Pulumi output.
   *
   * @since 0.0.0
   */
  public readonly installSpec: pulumi.Output<AiMetricsInstallSpec>;

  /**
   * Raw transcript archive root.
   *
   * @since 0.0.0
   */
  public readonly rawArchiveDir: pulumi.Output<string>;

  /**
   * Derived DuckDB database path.
   *
   * @since 0.0.0
   */
  public readonly duckDbPath: pulumi.Output<string>;

  /**
   * Resolved stack name.
   *
   * @since 0.0.0
   */
  public readonly stackName: pulumi.Output<string>;

  /**
   * Backend service specs planned for the selected target.
   *
   * @since 0.0.0
   */
  public readonly services: pulumi.Output<ReadonlyArray<AiMetricsServiceSpec>>;

  /**
   * Default backend service planned for the selected target.
   *
   * @since 0.0.0
   */
  public readonly defaultService: pulumi.Output<AiMetricsServiceSpec>;

  /**
   * Default trace-only OTLP endpoint planned for the selected target.
   *
   * @since 0.0.0
   */
  public readonly otlpEndpoint: pulumi.Output<AiMetricsOtlpEndpointSpec>;

  /**
   * Default trace-only OTLP HTTP endpoint URL.
   *
   * @since 0.0.0
   */
  public readonly otlpTraceUrl: pulumi.Output<string>;

  /**
   * Public Phoenix UI and OTLP base URL for the selected target.
   *
   * @since 0.0.0
   */
  public readonly phoenixPublicUrl: pulumi.Output<string>;

  /**
   * Dedicated Tailscale Serve HTTPS port used for the remote Phoenix endpoint.
   *
   * @since 0.0.0
   */
  public readonly phoenixTailnetHttpsPort: pulumi.Output<number>;

  /**
   * Remote root containing the managed compose and systemd unit artifacts.
   *
   * @since 0.0.0
   */
  public readonly remoteConfigRoot: pulumi.Output<string>;

  /**
   * Remote root reserved for sanitized P7 derived mirror bundles.
   *
   * @since 0.0.0
   */
  public readonly remoteMirrorRoot: pulumi.Output<string>;

  /**
   * Captured stdout from the remote Phoenix preflight command.
   *
   * @since 0.0.0
   */
  public readonly remotePreflightStdout: pulumi.Output<string>;

  /**
   * Captured stdout from the remote Phoenix apply command.
   *
   * @since 0.0.0
   */
  public readonly remoteApplyStdout: pulumi.Output<string>;

  /**
   * Captured stdout from the remote Phoenix health command.
   *
   * @since 0.0.0
   */
  public readonly remoteHealthStdout: pulumi.Output<string>;

  public constructor(
    name: string,
    args: AIMetricsStackArgs = AIMetricsStackArgs.new(),
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("beep:infra:AIMetricsStack", name, {}, opts);

    const spec = Effect.runSync(makeAiMetricsInstallSpec(args.install));
    const defaultService = defaultServiceForSpec(spec);
    const remoteResources = AiMetricsDeployTarget.$match(spec.target, {
      dankserver: () => {
        const remoteDefaultService = remotePhoenixDefaultService(defaultService);
        const remoteDeploymentTriggers = [
          remoteDefaultService.image,
          remoteDefaultService.publicUrl,
          renderRemotePhoenixCompose(remoteDefaultService),
          renderRemotePhoenixSystemdService(args.remote.remoteConfigRoot),
          args.remote.phoenixTailnetHttpsPort,
        ];
        const connection = remoteSshConnection(args.remote);
        const preflight = new command.remote.Command(
          `${name}-phoenix-preflight`,
          {
            connection,
            create: renderRemotePreflightCommand(args.remote),
            logging: command.types.enums.remote.Logging.StdoutAndStderr,
            triggers: [
              args.remote.ssh.host,
              args.remote.ssh.user,
              O.getOrElse(args.remote.ssh.agentSocketPath, () => ""),
              args.remote.remoteConfigRoot,
              args.remote.tailnetFqdn,
              args.remote.phoenixTailnetHttpsPort,
            ],
            update: renderRemotePreflightCommand(args.remote),
          },
          { parent: this }
        );
        const apply = new command.remote.Command(
          `${name}-phoenix-apply`,
          {
            connection,
            create: renderRemoteApplyCommand(args.remote, remoteDefaultService),
            logging: command.types.enums.remote.Logging.StdoutAndStderr,
            triggers: remoteDeploymentTriggers,
            update: renderRemoteApplyCommand(args.remote, remoteDefaultService),
          },
          {
            dependsOn: preflight,
            parent: this,
          }
        );
        const health = new command.remote.Command(
          `${name}-phoenix-health`,
          {
            connection,
            create: renderRemoteHealthCommand(args.remote, remoteDefaultService),
            logging: command.types.enums.remote.Logging.StdoutAndStderr,
            triggers: remoteDeploymentTriggers,
            update: renderRemoteHealthCommand(args.remote, remoteDefaultService),
          },
          {
            dependsOn: apply,
            parent: this,
          }
        );

        return {
          apply,
          health,
          preflight,
        };
      },
      local: () => undefined,
    });

    this.installSpec = pulumi.output(spec);
    this.rawArchiveDir = pulumi.output(spec.storage.rawArchiveDir);
    this.duckDbPath = pulumi.output(spec.storage.duckDbPath);
    this.stackName = pulumi.output(spec.stackName);
    this.services = pulumi.output(spec.services);
    this.defaultService = pulumi.output(defaultService);
    this.otlpEndpoint = pulumi.output(defaultService.otlp);
    this.otlpTraceUrl = pulumi.output(defaultService.otlp.traceUrl);
    this.phoenixPublicUrl = pulumi.output(defaultService.publicUrl);
    this.phoenixTailnetHttpsPort = pulumi.output(args.remote.phoenixTailnetHttpsPort);
    this.remoteConfigRoot = pulumi.output(args.remote.remoteConfigRoot);
    this.remoteMirrorRoot = pulumi.output(args.remote.remoteMirrorRoot);
    this.remotePreflightStdout = pulumi.secret(remoteResources?.preflight.stdout ?? pulumi.output(""));
    this.remoteApplyStdout = pulumi.secret(remoteResources?.apply.stdout ?? pulumi.output(""));
    this.remoteHealthStdout = pulumi.secret(remoteResources?.health.stdout ?? pulumi.output(""));

    this.registerOutputs({
      defaultService: this.defaultService,
      duckDbPath: this.duckDbPath,
      installSpec: this.installSpec,
      otlpEndpoint: this.otlpEndpoint,
      otlpTraceUrl: this.otlpTraceUrl,
      phoenixPublicUrl: this.phoenixPublicUrl,
      phoenixTailnetHttpsPort: this.phoenixTailnetHttpsPort,
      rawArchiveDir: this.rawArchiveDir,
      remoteApplyStdout: this.remoteApplyStdout,
      remoteConfigRoot: this.remoteConfigRoot,
      remoteMirrorRoot: this.remoteMirrorRoot,
      remoteHealthStdout: this.remoteHealthStdout,
      remotePreflightStdout: this.remotePreflightStdout,
      services: this.services,
      stackName: this.stackName,
    });
  }
}
