/**
 * Typed configuration for the AI metrics (Arize Phoenix) host stack.
 *
 * Decoded from the JSON file named by `BEEP_AI_METRICS_HOST_CONFIG`. Fields
 * that name a machine (SSH destination, tailnet name, the legacy Compose root)
 * have no default; fields that name this stack's own conventions (container,
 * network and volume names, the loopback port, the Phoenix data directory)
 * default to the values today's Compose deployment uses, so the stack lands on
 * the same names and the same data volume.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraHostsId } from "@beep/identity/packages";
import { OpenclawSecretReference } from "@beep/openclaw";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $InfraHostsId.create("AiMetricsConfig");

/**
 * Environment variable naming the AI metrics stack's config file.
 *
 * **Example** (Read the variable name)
 * ```ts
 * import { aiMetricsConfigEnvKey } from "@beep/infra-hosts/AiMetricsConfig"
 *
 * console.log(aiMetricsConfigEnvKey) // "BEEP_AI_METRICS_HOST_CONFIG"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const aiMetricsConfigEnvKey = "BEEP_AI_METRICS_HOST_CONFIG";

const TcpPort = S.Int.check(
  S.isBetween(
    { minimum: 1, maximum: 65_535 },
    $I.annote("TcpPortRange", {
      title: "TCP port range",
      description: "A TCP port in the inclusive range 1 through 65535.",
      message: "Expected a TCP port between 1 and 65535",
    })
  )
).pipe($I.annoteSchema("TcpPort", { description: "A TCP port in the inclusive range 1 through 65535." }));

const AbsolutePosixPath = S.NonEmptyString.check(
  S.isPattern(
    /^\/(?:[^\0]*)$/u,
    $I.annote("AbsolutePosixPathFormat", {
      title: "Absolute POSIX path",
      description: "A path that starts at the filesystem root.",
      message: "Expected an absolute path",
    })
  )
).pipe($I.annoteSchema("AbsolutePosixPath", { description: "An absolute POSIX path on the target host." }));

const DockerName = S.NonEmptyString.check(
  S.isPattern(
    /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u,
    $I.annote("DockerNameFormat", {
      title: "Docker object name",
      description: "A Docker container, network, volume or context name.",
      message: "Expected a Docker object name ([A-Za-z0-9][A-Za-z0-9_.-]*)",
    })
  )
).pipe($I.annoteSchema("DockerName", { description: "A Docker container, network, volume or context name." }));

const SshDestination = S.NonEmptyString.check(
  S.isPattern(
    /^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9][A-Za-z0-9.-]*$/u,
    $I.annote("SshDestinationFormat", {
      title: "SSH destination",
      description: "An ssh_config host alias or `user@host`, with no options or spaces.",
      message: "Expected an SSH host alias or user@host",
    })
  )
).pipe(
  $I.annoteSchema("SshDestination", {
    description: "An ssh_config host alias or `user@host` the deploy reaches the host through.",
  })
);

/**
 * A pinned container image reference: an explicit tag other than `latest`,
 * a digest, or both.
 *
 * **Example** (Decode a pinned image)
 * ```ts
 * import { PinnedImage } from "@beep/infra-hosts/AiMetricsConfig"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PinnedImage)("arizephoenix/phoenix:15.5.0")) // true
 * console.log(S.is(PinnedImage)("arizephoenix/phoenix:latest")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PinnedImage = S.NonEmptyString.check(
  S.isPattern(
    /^[a-z0-9][a-z0-9._/-]*(?::(?!latest$)[A-Za-z0-9_][A-Za-z0-9._-]{0,127})?(?:@sha256:[0-9a-f]{64})?$/u,
    $I.annote("PinnedImageFormat", {
      title: "Pinned image reference",
      description: "An image reference with an explicit non-latest tag or a sha256 digest.",
      message: "Expected an image pinned by a non-latest tag or a sha256 digest",
    })
  ),
  S.isPattern(
    /(?::[A-Za-z0-9_][A-Za-z0-9._-]*|@sha256:[0-9a-f]{64})$/u,
    $I.annote("PinnedImageHasPin", {
      title: "Image carries a pin",
      description: "An untagged image floats to latest, so a tag or digest is required.",
      message: "Expected an image tag or digest",
    })
  )
).pipe($I.annoteSchema("PinnedImage", { description: "A container image pinned by tag (not latest) or digest." }));

/**
 * The Phoenix container and its data.
 *
 * **Example** (Defaults match the Compose deployment)
 * ```ts
 * import { PhoenixContainerConfig } from "@beep/infra-hosts/AiMetricsConfig"
 *
 * const phoenix = PhoenixContainerConfig.make({ image: "arizephoenix/phoenix:15.5.0" })
 * console.log(phoenix.containerName) // "beep-ai-metrics-phoenix"
 * console.log(phoenix.dataVolume) // "beep-ai-metrics-dankserver_phoenix_data"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixContainerConfig extends S.Opaque<PhoenixContainerConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    image: PinnedImage.annotateKey({ description: "Pinned Phoenix image; refresh deliberately when upgrading." }),
    containerName: DockerName.pipe(
      S.withConstructorDefault(Effect.succeed("beep-ai-metrics-phoenix")),
      S.withDecodingDefaultTypeKey(Effect.succeed("beep-ai-metrics-phoenix"))
    ).annotateKey({ description: "Container name; the Compose file used the same one." }),
    networkName: DockerName.pipe(
      S.withConstructorDefault(Effect.succeed("beep-ai-metrics")),
      S.withDecodingDefaultTypeKey(Effect.succeed("beep-ai-metrics"))
    ).annotateKey({ description: "Bridge network the stack owns for Phoenix and later sibling services." }),
    dataVolume: DockerName.pipe(
      S.withConstructorDefault(Effect.succeed("beep-ai-metrics-dankserver_phoenix_data")),
      S.withDecodingDefaultTypeKey(Effect.succeed("beep-ai-metrics-dankserver_phoenix_data"))
    ).annotateKey({
      description:
        "Existing named volume holding Phoenix data (Compose project `beep-ai-metrics-dankserver`, volume `phoenix_data`). Looked up, never created or removed.",
    }),
    dataDir: AbsolutePosixPath.pipe(
      S.withConstructorDefault(Effect.succeed("/data")),
      S.withDecodingDefaultTypeKey(Effect.succeed("/data"))
    ).annotateKey({ description: "PHOENIX_WORKING_DIR inside the container, where the volume mounts." }),
    port: TcpPort.pipe(
      S.withConstructorDefault(Effect.succeed(6006)),
      S.withDecodingDefaultTypeKey(Effect.succeed(6006))
    ).annotateKey({ description: "Phoenix HTTP port, published on host loopback only." }),
    rehearsalPort: TcpPort.pipe(
      S.withConstructorDefault(Effect.succeed(16006)),
      S.withDecodingDefaultTypeKey(Effect.succeed(16006))
    ).annotateKey({ description: "Host loopback port a rehearsal stage publishes its throwaway Phoenix on." }),
  }).pipe(
    $I.annoteSchema("PhoenixContainerConfig", {
      description: "The Phoenix container, its network and its data volume.",
    })
  )
) {}

/**
 * Tailscale Serve front for Phoenix.
 *
 * **Example** (Build the tailnet front)
 * ```ts
 * import { TailnetServeConfig } from "@beep/infra-hosts/AiMetricsConfig"
 *
 * const serve = TailnetServeConfig.make({ fqdn: "host.example.ts.net" })
 * console.log(serve.httpsPort) // 8447
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TailnetServeConfig extends S.Opaque<TailnetServeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    fqdn: S.NonEmptyString.annotateKey({ description: "The host's tailnet FQDN." }),
    httpsPort: TcpPort.pipe(
      S.withConstructorDefault(Effect.succeed(8447)),
      S.withDecodingDefaultTypeKey(Effect.succeed(8447))
    ).annotateKey({ description: "Dedicated Tailscale Serve HTTPS port for Phoenix." }),
  }).pipe($I.annoteSchema("TailnetServeConfig", { description: "The Tailscale Serve HTTPS front for Phoenix." }))
) {}

/**
 * The Compose deployment the stack retires at cutover.
 *
 * **Example** (Describe the legacy deployment)
 * ```ts
 * import { LegacyComposeConfig } from "@beep/infra-hosts/AiMetricsConfig"
 *
 * const legacy = LegacyComposeConfig.make({ configRoot: "/srv/ai-metrics" })
 * console.log(legacy.unitName) // "ai-metrics-phoenix.service"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegacyComposeConfig extends S.Opaque<LegacyComposeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    configRoot: AbsolutePosixPath.annotateKey({
      description: "Remote directory holding the Compose file and the Tailscale port state file.",
    }),
    unitName: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed("ai-metrics-phoenix.service")),
      S.withDecodingDefaultTypeKey(Effect.succeed("ai-metrics-phoenix.service"))
    ).annotateKey({ description: "The `systemd --user` unit that runs `docker compose up`." }),
    composeProject: DockerName.pipe(
      S.withConstructorDefault(Effect.succeed("beep-ai-metrics-dankserver")),
      S.withDecodingDefaultTypeKey(Effect.succeed("beep-ai-metrics-dankserver"))
    ).annotateKey({ description: "Compose project name the legacy container and volume carry." }),
  }).pipe(
    $I.annoteSchema("LegacyComposeConfig", { description: "The Compose and systemd deployment retired at cutover." })
  )
) {}

/**
 * `op://` references the AI metrics clients read. The stack only carries and
 * exports the references; it never resolves them.
 *
 * **Example** (Declare the references)
 * ```ts
 * import { AiMetricsSecretRefs } from "@beep/infra-hosts/AiMetricsConfig"
 * import * as S from "effect/Schema"
 *
 * const refs = S.decodeUnknownSync(AiMetricsSecretRefs)({
 *   hashSalt: "op://vault/ai-metrics/hash-salt",
 *   rawArchiveKey: "op://vault/ai-metrics/raw-archive-key"
 * })
 * console.log(refs.hashSalt) // "op://vault/ai-metrics/hash-salt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsSecretRefs extends S.Opaque<AiMetricsSecretRefs, { readonly brand: unique symbol }>()(
  S.Struct({
    hashSalt: OpenclawSecretReference.annotateKey({
      description: "op:// reference to the private-identifier hash salt.",
    }),
    rawArchiveKey: OpenclawSecretReference.annotateKey({
      description: "op:// reference to the raw transcript archive key.",
    }),
  }).pipe(
    $I.annoteSchema("AiMetricsSecretRefs", {
      description: "op:// references the AI metrics clients resolve at run time.",
    })
  )
) {}

/**
 * The whole AI metrics host stack configuration.
 *
 * **Example** (Decode a config file body)
 * ```ts
 * import { AiMetricsHostConfig } from "@beep/infra-hosts/AiMetricsConfig"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(AiMetricsHostConfig)({
 *   sshDestination: "metrics-host",
 *   phoenix: { image: "arizephoenix/phoenix:15.5.0" },
 *   tailnet: { fqdn: "metrics-host.example.ts.net" },
 *   legacyCompose: { configRoot: "/srv/ai-metrics" },
 *   secretRefs: {
 *     hashSalt: "op://vault/ai-metrics/hash-salt",
 *     rawArchiveKey: "op://vault/ai-metrics/raw-archive-key"
 *   }
 * })
 * console.log(config.dockerContextName) // "beep-ai-metrics"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsHostConfig extends S.Opaque<AiMetricsHostConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    sshDestination: SshDestination.annotateKey({
      description: "ssh_config alias or user@host; Docker's ssh:// endpoint and every host step use it.",
    }),
    dockerContextName: DockerName.pipe(
      S.withConstructorDefault(Effect.succeed("beep-ai-metrics")),
      S.withDecodingDefaultTypeKey(Effect.succeed("beep-ai-metrics"))
    ).annotateKey({ description: "Docker CLI context the stack creates on the deploying workstation." }),
    phoenix: PhoenixContainerConfig,
    tailnet: TailnetServeConfig,
    legacyCompose: LegacyComposeConfig,
    secretRefs: AiMetricsSecretRefs,
  }).pipe($I.annoteSchema("AiMetricsHostConfig", { description: "Typed configuration for the AI metrics host stack." }))
) {}
