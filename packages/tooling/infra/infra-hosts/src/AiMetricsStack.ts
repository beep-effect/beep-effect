/**
 * The AI metrics host stack: Arize Phoenix on dankserver.
 *
 * **Details**
 *
 * Replaces the Pulumi program that wrote a Compose file and a `systemd --user`
 * unit over SSH. The resource graph, for the `prod` stage:
 *
 * ```text
 * Docker.Context (ssh://)  ─┬─ Docker.Network ──────────────┐
 *                           ├─ Docker.Volume.lookup (data) ─┤
 * Exec Preflight ─ Exec RetireCompose ───────────────────────┴─ Docker.Container Phoenix
 *                                                              ├─ Exec TailscaleServe
 *                                                              └─ Exec Health (after Serve)
 * ```
 *
 * The data volume is a lookup: Alchemy reads it and mounts it, and never
 * creates, replaces or removes it, so no plan can touch Phoenix's data. Every
 * other stage is a rehearsal: a throwaway Phoenix on a stage-suffixed network,
 * volume and loopback port behind the same context, with no Compose retirement
 * and no Tailscale Serve.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Docker from "@alchemy.run/docker";
import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";
import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import { AiMetricsHostConfig, aiMetricsConfigEnvKey, phoenixDataVolume } from "./AiMetricsConfig.ts";
import { loadHostConfigFile } from "./HostConfigFile.ts";
import { HostsStageKind, stageKind, WorkstationOnly } from "./HostsStage.ts";
import { overSsh, shellQuote } from "./internal/Shell.ts";

/**
 * Alchemy stack name of the AI metrics host stack.
 *
 * **Example** (Read the stack name)
 * ```ts
 * import { aiMetricsStackName } from "@beep/infra-hosts/AiMetricsStack"
 *
 * console.log(aiMetricsStackName) // "HostsAiMetrics"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const aiMetricsStackName = "HostsAiMetrics";

/**
 * Memo scope for host steps: hash no files. A step re-runs only when its
 * rendered command or environment changes, never because a file in the
 * deploying checkout changed.
 */
const commandOnlyMemo = { include: [], exclude: ["**"] };

const shell = "/bin/sh";

const userSystemdEnvironment = [
  'export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"',
  'export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"',
];

const composeProjectTemplate = '{{ with index .Config.Labels "com.docker.compose.project" }}{{ . }}{{ end }}';

const volumeProjectTemplate = '{{ with index .Labels "com.docker.compose.project" }}{{ . }}{{ end }}';

const healthStatusTemplate = "{{ if .State.Health }}{{ .State.Health.Status }}{{ else }}none{{ end }}";

const tailnetPortStatePath = (config: AiMetricsHostConfig): string =>
  `${config.legacyCompose.configRoot}/phoenix-tailnet-https-port`;

/**
 * Public HTTPS URL of Phoenix on the tailnet.
 *
 * **Example** (Compute the public URL)
 * ```ts
 * import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig"
 * import { phoenixPublicUrl } from "@beep/infra-hosts/AiMetricsStack"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(AiMetricsHostConfig)({
 *   sshDestination: "metrics-host",
 *   phoenix: { image: "arizephoenix/phoenix:15.5.0" },
 *   tailnet: { fqdn: "metrics-host.example.ts.net" },
 *   legacyCompose: { configRoot: "/srv/ai-metrics" },
 *   secretRefs: { hashSalt: "op://v/i/salt", rawArchiveKey: "op://v/i/key" }
 * })
 * console.log(phoenixPublicUrl(config)) // "https://metrics-host.example.ts.net:8447"
 * ```
 *
 * @param config - The decoded AI metrics host configuration.
 * @returns The tailnet HTTPS URL of Phoenix.
 * @category utilities
 * @since 0.0.0
 */
export const phoenixPublicUrl = (config: AiMetricsHostConfig): string =>
  `https://${config.tailnet.fqdn}:${config.tailnet.httpsPort}`;

/**
 * Preflight on the host: the tools every later step needs, a reachable Docker
 * engine and tailnet; for `prod`, that the data volume exists and carries the
 * configured Compose project; for a rehearsal, that its loopback port is free
 * or already published by this stage's own container.
 *
 * **Example** (Render the prod preflight)
 * ```ts
 * import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig"
 * import { renderPreflightCommand } from "@beep/infra-hosts/AiMetricsStack"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(AiMetricsHostConfig)({
 *   sshDestination: "metrics-host",
 *   phoenix: { image: "arizephoenix/phoenix:15.5.0" },
 *   tailnet: { fqdn: "metrics-host.example.ts.net" },
 *   legacyCompose: { configRoot: "/srv/ai-metrics" },
 *   secretRefs: { hashSalt: "op://v/i/salt", rawArchiveKey: "op://v/i/key" }
 * })
 * console.log(renderPreflightCommand({ config, containerName: "beep-ai-metrics-phoenix", kind: "prod" }).startsWith("ssh ")) // true
 * ```
 *
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderPreflightCommand = ({
  config,
  containerName,
  kind,
}: {
  readonly config: AiMetricsHostConfig;
  readonly containerName: string;
  readonly kind: HostsStageKind;
}): string =>
  overSsh({
    destination: config.sshDestination,
    lines: [
      "set -euo pipefail",
      'for tool in docker curl systemctl tailscale ss; do command -v "${tool}" >/dev/null || { printf \'missing %s\\n\' "${tool}" >&2; exit 1; }; done',
      "docker version --format '{{ .Server.Version }}' >/dev/null",
      "tailscale status --json >/dev/null",
      ...HostsStageKind.match(kind, {
        prod: () => [
          `volume=${shellQuote(phoenixDataVolume(config))}`,
          `expected_project=${shellQuote(config.legacyCompose.composeProject)}`,
          `volume_project="$(docker volume inspect -f ${shellQuote(volumeProjectTemplate)} "\${volume}")"`,
          '[ "${volume_project}" = "${expected_project}" ] || { printf \'data volume %s carries Compose project "%s", expected "%s"; refusing\\n\' "${volume}" "${volume_project}" "${expected_project}" >&2; exit 1; }',
        ],
        // One rehearsal at a time per port on the engine: the port must be free
        // or already published by this stage's own container.
        rehearsal: () => [
          `port=${shellQuote(String(config.phoenix.rehearsalPort))}`,
          `own=${shellQuote(containerName)}`,
          'holder="$(docker ps --filter "publish=${port}" --format \'{{ .Names }}\' | head -n 1)"',
          'if [ -n "${holder}" ] && [ "${holder}" != "${own}" ]; then printf \'rehearsal port %s is held by container %s; one rehearsal at a time per port, set phoenix.rehearsalPort to run two\\n\' "${port}" "${holder}" >&2; exit 1; fi',
          'if [ -z "${holder}" ] && [ -n "$(ss -ltnH "sport = :${port}")" ]; then printf \'rehearsal port %s is held by a process outside Docker; refusing\\n\' "${port}" >&2; exit 1; fi',
        ],
      }),
      "printf 'AI metrics preflight passed\\n'",
    ],
  });

/**
 * Retire the Compose deployment: disable and stop its `systemd --user` unit
 * (whose `ExecStop` runs `docker compose down`, which removes the Compose
 * container and network and keeps the named data volume), archive the unit
 * file beside the Compose file, then refuse to continue if a Compose-labelled
 * container with Phoenix's name survived. A no-op once the unit is archived.
 *
 * **Example** (Render the retirement step)
 * ```ts
 * import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig"
 * import { renderRetireComposeCommand } from "@beep/infra-hosts/AiMetricsStack"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(AiMetricsHostConfig)({
 *   sshDestination: "metrics-host",
 *   phoenix: { image: "arizephoenix/phoenix:15.5.0" },
 *   tailnet: { fqdn: "metrics-host.example.ts.net" },
 *   legacyCompose: { configRoot: "/srv/ai-metrics" },
 *   secretRefs: { hashSalt: "op://v/i/salt", rawArchiveKey: "op://v/i/key" }
 * })
 * console.log(renderRetireComposeCommand(config).includes("disable --now")) // true
 * ```
 *
 * @param config - The decoded AI metrics host configuration.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderRetireComposeCommand = (config: AiMetricsHostConfig): string =>
  overSsh({
    destination: config.sshDestination,
    lines: [
      "set -euo pipefail",
      ...userSystemdEnvironment,
      `unit=${shellQuote(config.legacyCompose.unitName)}`,
      'unit_path="${HOME}/.config/systemd/user/${unit}"',
      `archive_dir=${shellQuote(`${config.legacyCompose.configRoot}/retired-compose`)}`,
      'if [ -f "${unit_path}" ]; then',
      '  systemctl --user disable --now "${unit}"',
      '  install -d -m 0755 "${archive_dir}"',
      '  mv -f -- "${unit_path}" "${archive_dir}/${unit}"',
      "  systemctl --user daemon-reload",
      "fi",
      `container=${shellQuote(config.phoenix.containerName)}`,
      `expected_project=${shellQuote(config.legacyCompose.composeProject)}`,
      `found_project="$(docker container inspect -f ${shellQuote(composeProjectTemplate)} "\${container}" 2>/dev/null || true)"`,
      'if [ "${found_project}" = "${expected_project}" ]; then printf \'Compose container %s of project "%s" survived compose down; refusing\\n\' "${container}" "${found_project}" >&2; exit 1; fi',
      'if [ -n "${found_project}" ]; then printf \'container %s belongs to Compose project "%s", expected "%s"; refusing\\n\' "${container}" "${found_project}" "${expected_project}" >&2; exit 1; fi',
      `docker volume inspect ${shellQuote(phoenixDataVolume(config))} >/dev/null`,
      "printf 'Compose deployment retired; data volume kept\\n'",
    ],
  });

/**
 * Point Tailscale Serve's dedicated HTTPS port at Phoenix's loopback port,
 * turning off a previously served port when the configured one changed.
 *
 * **Example** (Render the Serve step)
 * ```ts
 * import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig"
 * import { renderTailscaleServeCommand } from "@beep/infra-hosts/AiMetricsStack"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(AiMetricsHostConfig)({
 *   sshDestination: "metrics-host",
 *   phoenix: { image: "arizephoenix/phoenix:15.5.0" },
 *   tailnet: { fqdn: "metrics-host.example.ts.net" },
 *   legacyCompose: { configRoot: "/srv/ai-metrics" },
 *   secretRefs: { hashSalt: "op://v/i/salt", rawArchiveKey: "op://v/i/key" }
 * })
 * console.log(renderTailscaleServeCommand(config).includes("--https=")) // true
 * ```
 *
 * @param config - The decoded AI metrics host configuration.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderTailscaleServeCommand = (config: AiMetricsHostConfig): string =>
  overSsh({
    destination: config.sshDestination,
    lines: [
      "set -euo pipefail",
      `port_state_path=${shellQuote(tailnetPortStatePath(config))}`,
      `current_tailnet_port=${shellQuote(String(config.tailnet.httpsPort))}`,
      'if [ -f "${port_state_path}" ]; then',
      '  previous_tailnet_port="$(tr -d \'[:space:]\' < "${port_state_path}")"',
      '  if printf "%s" "${previous_tailnet_port}" | grep -Eq \'^[0-9]+$\' && [ "${previous_tailnet_port}" != "${current_tailnet_port}" ]; then',
      '    tailscale serve --https="${previous_tailnet_port}" off >/dev/null || true',
      "  fi",
      "fi",
      `tailscale serve --yes --bg --https="\${current_tailnet_port}" ${shellQuote(
        `http://127.0.0.1:${config.phoenix.port}`
      )}`,
      'install -d -m 0755 "$(dirname "${port_state_path}")"',
      'printf "%s\\n" "${current_tailnet_port}" > "${port_state_path}"',
      `printf 'Tailscale Serve %s -> 127.0.0.1:%s\\n' "\${current_tailnet_port}" ${shellQuote(
        String(config.phoenix.port)
      )}`,
    ],
  });

/**
 * Health gate: the container's Docker healthcheck reports healthy, Phoenix
 * answers on loopback and, for `prod`, Tailscale Serve fronts it and the public
 * URL answers. The step's exit status is the result: a failure fails the deploy.
 *
 * **Example** (Render the rehearsal health gate)
 * ```ts
 * import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig"
 * import { renderHealthCommand } from "@beep/infra-hosts/AiMetricsStack"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(AiMetricsHostConfig)({
 *   sshDestination: "metrics-host",
 *   phoenix: { image: "arizephoenix/phoenix:15.5.0" },
 *   tailnet: { fqdn: "metrics-host.example.ts.net" },
 *   legacyCompose: { configRoot: "/srv/ai-metrics" },
 *   secretRefs: { hashSalt: "op://v/i/salt", rawArchiveKey: "op://v/i/key" }
 * })
 * console.log(renderHealthCommand({ config, kind: "rehearsal", containerName: "phoenix-dev", hostPort: 16006 }).includes("tailscale")) // false
 * ```
 *
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderHealthCommand = ({
  config,
  containerName,
  hostPort,
  kind,
}: {
  readonly config: AiMetricsHostConfig;
  readonly containerName: string;
  readonly hostPort: number;
  readonly kind: HostsStageKind;
}): string =>
  overSsh({
    destination: config.sshDestination,
    lines: [
      "set -euo pipefail",
      `container=${shellQuote(containerName)}`,
      "for attempt in $(seq 1 36); do",
      `  status="$(docker inspect -f ${shellQuote(healthStatusTemplate)} "\${container}")"`,
      '  [ "${status}" = "healthy" ] && break',
      '  if [ "${attempt}" -eq 36 ]; then',
      '    printf \'Phoenix container %s is %s\\n\' "${container}" "${status}" >&2',
      '    docker logs --tail 80 "${container}" >&2 || true',
      "    exit 1",
      "  fi",
      "  sleep 5",
      "done",
      // The port must be published by this stage's own container, so the curl
      // below cannot be answered by another stage's Phoenix.
      `published=${shellQuote(`127.0.0.1:${hostPort}`)}`,
      `docker port "\${container}" ${shellQuote(`${config.phoenix.port}/tcp`)} | grep -Fqx "\${published}" || { printf 'port %s is not published by container %s; refusing to trust its answer\\n' "\${published}" "\${container}" >&2; exit 1; }`,
      `curl -fsS ${shellQuote(`http://127.0.0.1:${hostPort}`)} >/dev/null`,
      ...HostsStageKind.match(kind, {
        prod: () => [
          `tailscale serve status --json | grep -F ${shellQuote(`127.0.0.1:${config.phoenix.port}`)} >/dev/null`,
          `curl -fsS ${shellQuote(phoenixPublicUrl(config))} >/dev/null`,
        ],
        rehearsal: () => [],
      }),
      "printf 'Phoenix health check passed\\n'",
    ],
  });

/**
 * Operator command that turns the Phoenix Tailscale Serve port off. Exec
 * deletes nothing, so `alchemy destroy` leaves Serve running; this is the
 * explicit teardown step.
 *
 * **Example** (Render the Serve teardown)
 * ```ts
 * import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig"
 * import { renderTailscaleServeOffCommand } from "@beep/infra-hosts/AiMetricsStack"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(AiMetricsHostConfig)({
 *   sshDestination: "metrics-host",
 *   phoenix: { image: "arizephoenix/phoenix:15.5.0" },
 *   tailnet: { fqdn: "metrics-host.example.ts.net" },
 *   legacyCompose: { configRoot: "/srv/ai-metrics" },
 *   secretRefs: { hashSalt: "op://v/i/salt", rawArchiveKey: "op://v/i/key" }
 * })
 * console.log(renderTailscaleServeOffCommand(config).includes(" off")) // true
 * ```
 *
 * @param config - The decoded AI metrics host configuration.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderTailscaleServeOffCommand = (config: AiMetricsHostConfig): string =>
  overSsh({
    destination: config.sshDestination,
    lines: ["set -euo pipefail", `tailscale serve --https=${shellQuote(String(config.tailnet.httpsPort))} off`],
  });

/**
 * Operator rollback to the Compose deployment: remove the Alchemy-managed
 * container (the data volume stays), restore the archived unit and start it,
 * which runs `docker compose up` against the same named volume.
 *
 * **Example** (Render the rollback)
 * ```ts
 * import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig"
 * import { renderRollbackToComposeCommand } from "@beep/infra-hosts/AiMetricsStack"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(AiMetricsHostConfig)({
 *   sshDestination: "metrics-host",
 *   phoenix: { image: "arizephoenix/phoenix:15.5.0" },
 *   tailnet: { fqdn: "metrics-host.example.ts.net" },
 *   legacyCompose: { configRoot: "/srv/ai-metrics" },
 *   secretRefs: { hashSalt: "op://v/i/salt", rawArchiveKey: "op://v/i/key" }
 * })
 * console.log(renderRollbackToComposeCommand(config).includes("enable --now")) // true
 * ```
 *
 * @param config - The decoded AI metrics host configuration.
 * @returns The rendered command.
 * @category serialization
 * @since 0.0.0
 */
export const renderRollbackToComposeCommand = (config: AiMetricsHostConfig): string =>
  overSsh({
    destination: config.sshDestination,
    lines: [
      "set -euo pipefail",
      ...userSystemdEnvironment,
      `unit=${shellQuote(config.legacyCompose.unitName)}`,
      'unit_path="${HOME}/.config/systemd/user/${unit}"',
      `archive_dir=${shellQuote(`${config.legacyCompose.configRoot}/retired-compose`)}`,
      '[ -f "${archive_dir}/${unit}" ] || { printf \'no archived unit at %s\\n\' "${archive_dir}/${unit}" >&2; exit 1; }',
      `docker rm -f ${shellQuote(config.phoenix.containerName)} >/dev/null 2>&1 || true`,
      'install -d -m 0755 "${HOME}/.config/systemd/user"',
      'mv -f -- "${archive_dir}/${unit}" "${unit_path}"',
      "systemctl --user daemon-reload",
      'systemctl --user enable --now "${unit}"',
      "printf 'Compose deployment restored\\n'",
    ],
  });

const phoenixHealthcheck = (config: AiMetricsHostConfig): Docker.Container.Healthcheck => ({
  cmd: [
    "CMD",
    "python3",
    "-c",
    `import urllib.request; urllib.request.urlopen('http://127.0.0.1:${config.phoenix.port}/healthz', timeout=5)`,
  ],
  interval: "30 seconds",
  timeout: "10 seconds",
  retries: 3,
  startPeriod: "60 seconds",
});

const deployProd = Effect.fn("AiMetricsStack.deployProd")(function* (config: AiMetricsHostConfig) {
  const context = yield* Docker.Context("Host", {
    name: config.dockerContextName,
    docker: `host=ssh://${config.sshDestination}`,
    description: "beep AI metrics host (managed by @beep/infra-hosts)",
  });
  const preflight = yield* Command.Exec("Preflight", {
    command: renderPreflightCommand({
      config,
      containerName: config.phoenix.containerName,
      kind: HostsStageKind.Enum.prod,
    }),
    shell,
    memo: commandOnlyMemo,
  });
  const retire = yield* Command.Exec("RetireCompose", {
    command: renderRetireComposeCommand(config),
    shell,
    memo: commandOnlyMemo,
    env: { BEEP_HOSTS_AFTER: preflight.hash.input },
  });
  const network = yield* Docker.Network("Network", {
    context,
    name: config.phoenix.networkName,
    driver: "bridge",
  });
  const data = Docker.Volume.lookup({ name: phoenixDataVolume(config), context: context.name });
  const phoenix = yield* Docker.Container("Phoenix", {
    context,
    name: config.phoenix.containerName,
    image: config.phoenix.image,
    start: true,
    restart: "unless-stopped",
    environment: { PHOENIX_WORKING_DIR: config.phoenix.dataDir },
    ports: [{ external: `127.0.0.1:${config.phoenix.port}`, internal: config.phoenix.port }],
    volumes: [{ hostPath: data.name, containerPath: config.phoenix.dataDir }],
    networks: [{ name: network.name }],
    healthcheck: phoenixHealthcheck(config),
    labels: { "beep.infra-hosts/compose-retired": Output.map(retire.hash, () => "true") },
  });
  const serve = yield* Command.Exec("TailscaleServe", {
    command: renderTailscaleServeCommand(config),
    shell,
    memo: commandOnlyMemo,
    env: { BEEP_HOSTS_PHOENIX: phoenix.name },
  });
  yield* Command.Exec("Health", {
    command: renderHealthCommand({
      config,
      containerName: config.phoenix.containerName,
      hostPort: config.phoenix.port,
      kind: HostsStageKind.Enum.prod,
    }),
    shell,
    memo: commandOnlyMemo,
    env: { BEEP_HOSTS_PHOENIX_ID: phoenix.id, BEEP_HOSTS_AFTER: serve.hash.input },
  });
  return { containerName: config.phoenix.containerName, phoenixUrl: phoenixPublicUrl(config) };
});

const deployRehearsal = Effect.fn("AiMetricsStack.deployRehearsal")(function* (
  config: AiMetricsHostConfig,
  stage: string
) {
  const suffix = (name: string) => `${name}-${stage}`;
  const containerName = suffix(config.phoenix.containerName);
  const context = yield* Docker.Context("Host", {
    name: suffix(config.dockerContextName),
    docker: `host=ssh://${config.sshDestination}`,
    description: `beep AI metrics rehearsal stage ${stage} (managed by @beep/infra-hosts)`,
  });
  const preflight = yield* Command.Exec("Preflight", {
    command: renderPreflightCommand({ config, containerName, kind: HostsStageKind.Enum.rehearsal }),
    shell,
    memo: commandOnlyMemo,
  });
  const network = yield* Docker.Network("Network", {
    context,
    name: suffix(config.phoenix.networkName),
    driver: "bridge",
  });
  const data = yield* Docker.Volume("RehearsalData", { context, name: suffix(phoenixDataVolume(config)) });
  const phoenix = yield* Docker.Container("Phoenix", {
    context,
    name: containerName,
    image: config.phoenix.image,
    start: true,
    restart: "unless-stopped",
    environment: { PHOENIX_WORKING_DIR: config.phoenix.dataDir },
    ports: [{ external: `127.0.0.1:${config.phoenix.rehearsalPort}`, internal: config.phoenix.port }],
    volumes: [{ hostPath: data.name, containerPath: config.phoenix.dataDir }],
    networks: [{ name: network.name }],
    healthcheck: phoenixHealthcheck(config),
    labels: { "beep.infra-hosts/preflight": Output.map(preflight.hash, () => "passed") },
  });
  yield* Command.Exec("Health", {
    command: renderHealthCommand({
      config,
      containerName,
      hostPort: config.phoenix.rehearsalPort,
      kind: HostsStageKind.Enum.rehearsal,
    }),
    shell,
    memo: commandOnlyMemo,
    env: { BEEP_HOSTS_PHOENIX_ID: phoenix.id },
  });
  return { containerName, phoenixUrl: `http://127.0.0.1:${config.phoenix.rehearsalPort}` };
});

/**
 * The AI metrics stack program: guard, decode the config file, declare the
 * stage's resource graph and return its outputs. `prod` refuses to run in CI.
 * The outputs carry `op://` references only.
 *
 * **Example** (Compose the stack)
 * ```ts
 * import * as AWS from "@alchemy.run/aws"
 * import * as Docker from "@alchemy.run/docker"
 * import { aiMetricsStackName, aiMetricsStackProgram } from "@beep/infra-hosts/AiMetricsStack"
 * import * as Alchemy from "alchemy"
 * import * as Command from "alchemy/Command"
 * import * as Layer from "effect/Layer"
 *
 * const stack = Alchemy.Stack(
 *   aiMetricsStackName,
 *   { providers: Layer.mergeAll(Docker.providers(), Command.providers()), state: AWS.state({ backend: "s3" }) },
 *   aiMetricsStackProgram
 * )
 * console.log(stack.stackName) // "HostsAiMetrics"
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const aiMetricsStackProgram = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  const kind = stageKind(stack.stage);
  if (kind === HostsStageKind.Enum.prod) {
    yield* WorkstationOnly;
  }
  const config = yield* loadHostConfigFile(AiMetricsHostConfig, aiMetricsConfigEnvKey);
  const deployed = yield* HostsStageKind.match(kind, {
    prod: () => deployProd(config),
    rehearsal: () => deployRehearsal(config, stack.stage),
  });
  return {
    stage: kind,
    containerName: deployed.containerName,
    phoenixUrl: deployed.phoenixUrl,
    otlpTraceUrl: `${deployed.phoenixUrl}/v1/traces`,
    secretRefs: { hashSalt: config.secretRefs.hashSalt, rawArchiveKey: config.secretRefs.rawArchiveKey },
    operatorCommands: {
      tailscaleServeOff: renderTailscaleServeOffCommand(config),
      rollbackToCompose: renderRollbackToComposeCommand(config),
    },
  };
});
