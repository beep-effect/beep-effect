/**
 * Pulumi orchestration surface for the OpenClaw workstation agent stack.
 *
 * The generation model and every applicator script moved to
 * `@beep/infra-hosts/OpenClawGeneration` (goals/infra-alchemy-rebuild P4),
 * which the Alchemy OpenClaw stack deploys. This module keeps only the Pulumi
 * config mapping and the Pulumi component, both deleted with `infra/`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import {
  OpenClawBackupConfig,
  OpenClawBackupShipScriptInput,
  OpenClawDeploymentConfig,
  OpenClawExpectedIdentity,
  OpenClawGenerationIdentityScriptInput,
  OpenClawHostedProviderConfig,
  OpenClawLocalProviderConfig,
  OpenClawStackArgs,
  OpenClawWorkstationPaths,
  renderOpenClawApplyScript,
  renderOpenClawBackupShipScript,
  renderOpenClawDriftAuditScript,
  renderOpenClawLiveAcceptanceScript,
  renderOpenClawPreflightScript,
  renderOpenClawProbeScript,
  renderOpenClawRollbackScript,
  renderOpenClawRunScript,
  renderOpenClawStageScript,
  renderOpenClawUnit,
} from "@beep/infra-hosts/OpenClawGeneration";
import {
  OpenclawAbsolutePath,
  OpenclawGatewayPort,
  OpenclawSecretReference,
  OpenclawTargetVersion,
  OpenclawTelegramDmPolicy,
  OpenclawTelegramGroupPolicy,
} from "@beep/openclaw";
import { O } from "@beep/utils";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { optionalPulumiConfigFields, pulumiConfigSchemaIssueError } from "./internal/PulumiConfigSchema.ts";
import type { OpenClawGeneration } from "@beep/infra-hosts/OpenClawGeneration";
import type {
  OpenclawTelegramDmPolicy as OpenclawTelegramDmPolicyType,
  OpenclawTelegramGroupPolicy as OpenclawTelegramGroupPolicyType,
} from "@beep/openclaw";

export * from "@beep/infra-hosts/OpenClawGeneration";

const $I = $InfraId.create("OpenClaw");

const generationDir = (generation: OpenClawGeneration): string => `${generation.configRoot}/${generation.generationId}`;

const schemaIssueToPulumiConfigError = pulumiConfigSchemaIssueError("openclaw");

const decodeOpenclawTargetVersion = S.decodeUnknownResult(OpenclawTargetVersion);
const decodeOpenclawSecretReference = S.decodeUnknownResult(OpenclawSecretReference);
const decodeTelegramDmPolicy = S.decodeUnknownResult(OpenclawTelegramDmPolicy);
const decodeTelegramGroupPolicy = S.decodeUnknownResult(OpenclawTelegramGroupPolicy);

const targetVersionFromPulumiConfig = (value: string | undefined): O.Option<OpenclawTargetVersion> =>
  O.map(O.fromUndefinedOr(value), (value) =>
    Result.getOrThrowWith(decodeOpenclawTargetVersion(value), schemaIssueToPulumiConfigError("openclawVersion", value))
  );

const secretReferenceFromPulumiConfig = (key: string, value: string | undefined): O.Option<OpenclawSecretReference> =>
  O.map(O.fromUndefinedOr(value), (value) =>
    Result.getOrThrowWith(decodeOpenclawSecretReference(value), schemaIssueToPulumiConfigError(key, value))
  );

const telegramDmPolicyFromPulumiConfig = (value: string | undefined): O.Option<OpenclawTelegramDmPolicyType> =>
  O.map(O.fromUndefinedOr(value), (value) =>
    Result.getOrThrowWith(decodeTelegramDmPolicy(value), schemaIssueToPulumiConfigError("telegramDmPolicy", value))
  );

const telegramGroupPolicyFromPulumiConfig = (value: string | undefined): O.Option<OpenclawTelegramGroupPolicyType> =>
  O.map(O.fromUndefinedOr(value), (value) =>
    Result.getOrThrowWith(
      decodeTelegramGroupPolicy(value),
      schemaIssueToPulumiConfigError("telegramGroupPolicy", value)
    )
  );

const requiredConfigValue = <Value>(key: string, value: Value | undefined): Value =>
  O.getOrThrowWith(
    O.fromUndefinedOr(value),
    () =>
      new pulumi.RunError(
        `Missing openclaw:${key} Pulumi config value; the OpenClaw stack refuses to apply without a fully declared expected identity.`
      )
  );
type OpenClawPulumiConfigValuesFields = {
  readonly agentId?: string | undefined;
  readonly agentName?: string | undefined;
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
  readonly hostedProviderApiKeyRef?: OpenclawSecretReference | undefined;
  readonly hostedProviderBaseUrl?: string | undefined;
  readonly hostedProviderId?: string | undefined;
  readonly hostedProviderModelId?: string | undefined;
  readonly hostedProviderModelName?: string | undefined;
  readonly localProviderBaseUrl?: string | undefined;
  readonly localProviderId?: string | undefined;
  readonly localProviderModelId?: string | undefined;
  readonly localProviderModelName?: string | undefined;
  readonly logFilePath?: string | undefined;
  readonly nodeBinDir?: string | undefined;
  readonly openclawVersion?: OpenclawTargetVersion | undefined;
  readonly resolverCommandPath?: string | undefined;
  readonly resolverOpBinaryPath?: string | undefined;
  readonly resolverTrustedDir?: string | undefined;
  readonly stateDir?: string | undefined;
  readonly telegramBotTokenRef?: OpenclawSecretReference | undefined;
  readonly telegramDefaultTo?: string | undefined;
  readonly telegramDmPolicy?: "pairing" | "disabled" | "open" | undefined;
  readonly telegramGroupPolicy?: "open" | "disabled" | undefined;
  readonly unitName?: string | undefined;
};

type OpenClawPulumiConfigInputValues = Omit<
  OpenClawPulumiConfigValuesFields,
  | "gatewayAuthTokenRef"
  | "hostedProviderApiKeyRef"
  | "openclawVersion"
  | "telegramBotTokenRef"
  | "telegramDmPolicy"
  | "telegramGroupPolicy"
> & {
  readonly gatewayAuthTokenRef?: string | undefined;
  readonly hostedProviderApiKeyRef?: string | undefined;
  readonly openclawVersion?: string | undefined;
  readonly telegramBotTokenRef?: string | undefined;
  readonly telegramDmPolicy?: string | undefined;
  readonly telegramGroupPolicy?: string | undefined;
};

/**
 * Raw optional Pulumi config values before workstation defaults are applied.
 *
 * **Example** (Reference the raw config schema)
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
    agentName: S.String,
    backupPassphraseSecretRef: S.String,
    backupRemoteDir: OpenclawAbsolutePath,
    backupSshAgentSocketPath: S.String,
    backupSshHost: S.String,
    backupSshUser: S.String,
    configRoot: OpenclawAbsolutePath,
    expectedHome: OpenclawAbsolutePath,
    expectedHostname: S.String,
    expectedMachineId: OpenClawExpectedIdentity.fields.machineId,
    expectedRuntimeDir: OpenclawAbsolutePath,
    expectedUid: OpenClawExpectedIdentity.fields.uid,
    expectedUsername: S.String,
    gatewayAuthTokenRef: OpenclawSecretReference,
    gatewayPort: OpenclawGatewayPort,
    hostedProviderApiKeyRef: OpenclawSecretReference,
    hostedProviderBaseUrl: S.String,
    hostedProviderId: S.String,
    hostedProviderModelId: S.String,
    hostedProviderModelName: S.String,
    localProviderBaseUrl: OpenClawLocalProviderConfig.fields.baseUrl,
    localProviderId: S.String,
    localProviderModelId: S.String,
    localProviderModelName: S.String,
    logFilePath: OpenclawAbsolutePath,
    nodeBinDir: OpenclawAbsolutePath,
    openclawVersion: OpenclawTargetVersion,
    resolverCommandPath: OpenclawAbsolutePath,
    resolverOpBinaryPath: OpenclawAbsolutePath,
    resolverTrustedDir: OpenclawAbsolutePath,
    stateDir: OpenclawAbsolutePath,
    telegramBotTokenRef: OpenclawSecretReference,
    telegramDefaultTo: S.String,
    telegramDmPolicy: S.Literals(["pairing", "disabled", "open"]),
    telegramGroupPolicy: S.Literals(["open", "disabled"]),
    unitName: S.String,
  },
  $I.annote("OpenClawPulumiConfigValues", { description: "Configuration values for OpenClaw Pulumi resources" })
).mapFields(optionalPulumiConfigFields);

/**
 * Build OpenClaw stack args from decoded Pulumi config values.
 *
 * Missing identity keys raise a `pulumi.RunError` rather than defaulting: an
 * apply against an undeclared machine is the outcome this stack exists to make
 * impossible.
 *
 * **Example** (Map raw config values to stack args)
 * ```ts
 * import { makeOpenClawStackArgsFromConfigValues } from "@beep/infra"
 *
 * const args = makeOpenClawStackArgsFromConfigValues({
 *   expectedHome: "/home/example",
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
  agentName,
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
  hostedProviderApiKeyRef,
  hostedProviderBaseUrl,
  hostedProviderId,
  hostedProviderModelId,
  hostedProviderModelName,
  localProviderBaseUrl,
  localProviderId,
  localProviderModelId,
  localProviderModelName,
  logFilePath,
  nodeBinDir,
  openclawVersion,
  resolverCommandPath,
  resolverOpBinaryPath,
  resolverTrustedDir,
  stateDir,
  telegramBotTokenRef,
  telegramDefaultTo,
  telegramDmPolicy,
  telegramGroupPolicy,
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
        agentName: O.fromUndefinedOr(agentName),
        gatewayAuthTokenRef: secretReferenceFromPulumiConfig("gatewayAuthTokenRef", gatewayAuthTokenRef),
        gatewayPort: O.fromUndefinedOr(gatewayPort),
        logFilePath: O.fromUndefinedOr(logFilePath),
        openclawVersion: targetVersionFromPulumiConfig(openclawVersion),
        resolverCommandPath: O.fromUndefinedOr(resolverCommandPath),
        resolverOpBinaryPath: O.fromUndefinedOr(resolverOpBinaryPath),
        resolverTrustedDir: O.fromUndefinedOr(resolverTrustedDir),
      }),
      hostedProvider: OpenClawHostedProviderConfig.make({
        apiKeyRef: requiredConfigValue(
          "hostedProviderApiKeyRef",
          O.getOrUndefined(secretReferenceFromPulumiConfig("hostedProviderApiKeyRef", hostedProviderApiKeyRef))
        ),
        baseUrl: requiredConfigValue("hostedProviderBaseUrl", hostedProviderBaseUrl),
        modelId: requiredConfigValue("hostedProviderModelId", hostedProviderModelId),
        modelName: requiredConfigValue("hostedProviderModelName", hostedProviderModelName),
        providerId: requiredConfigValue("hostedProviderId", hostedProviderId),
      }),
      localProvider: OpenClawLocalProviderConfig.make({
        baseUrl: requiredConfigValue("localProviderBaseUrl", localProviderBaseUrl),
        modelId: requiredConfigValue("localProviderModelId", localProviderModelId),
        modelName: requiredConfigValue("localProviderModelName", localProviderModelName),
        providerId: requiredConfigValue("localProviderId", localProviderId),
      }),
      telegramBotTokenRef: requiredConfigValue(
        "telegramBotTokenRef",
        O.getOrUndefined(secretReferenceFromPulumiConfig("telegramBotTokenRef", telegramBotTokenRef))
      ),
      telegramDefaultTo: O.fromUndefinedOr(telegramDefaultTo),
      ...O.getSomesStruct({
        telegramDmPolicy: telegramDmPolicyFromPulumiConfig(telegramDmPolicy),
        telegramGroupPolicy: telegramGroupPolicyFromPulumiConfig(telegramGroupPolicy),
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
        host: requiredConfigValue("backupSshHost", backupSshHost),
        remoteDir: requiredConfigValue("backupRemoteDir", backupRemoteDir),
        user: requiredConfigValue("backupSshUser", backupSshUser),
      })
    )
  );

/**
 * Load OpenClaw stack args from Pulumi config.
 *
 * **Example** (Reference the stack args loader)
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
    agentName: config.get("agentName"),
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
    hostedProviderApiKeyRef: config.get("hostedProviderApiKeyRef"),
    hostedProviderBaseUrl: config.get("hostedProviderBaseUrl"),
    hostedProviderId: config.get("hostedProviderId"),
    hostedProviderModelId: config.get("hostedProviderModelId"),
    hostedProviderModelName: config.get("hostedProviderModelName"),
    localProviderBaseUrl: config.get("localProviderBaseUrl"),
    localProviderId: config.get("localProviderId"),
    localProviderModelId: config.get("localProviderModelId"),
    localProviderModelName: config.get("localProviderModelName"),
    logFilePath: config.get("logFilePath"),
    nodeBinDir: config.get("nodeBinDir"),
    openclawVersion: config.get("openclawVersion"),
    resolverCommandPath: config.get("resolverCommandPath"),
    resolverOpBinaryPath: config.get("resolverOpBinaryPath"),
    resolverTrustedDir: config.get("resolverTrustedDir"),
    stateDir: config.get("stateDir"),
    telegramBotTokenRef: config.get("telegramBotTokenRef"),
    telegramDefaultTo: config.get("telegramDefaultTo"),
    telegramDmPolicy: config.get("telegramDmPolicy"),
    telegramGroupPolicy: config.get("telegramGroupPolicy"),
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
 * **Example** (Declare the OpenClaw stack)
 * ```ts
 * import { makeOpenClawStackArgsFromConfigValues, OpenClawStack } from "@beep/infra"
 *
 * const args = makeOpenClawStackArgsFromConfigValues({
 *   expectedHome: "/home/example",
 *   expectedHostname: "DankStation",
 *   expectedMachineId: "0bffc9bc5a6b48928f1ab4794df5244b",
 *   expectedRuntimeDir: "/run/user/1000",
 *   expectedUid: 1000,
 *   expectedUsername: "elpresidank",
 *   hostedProviderApiKeyRef: "op://beep-openclaw/hosted/api-key",
 *   hostedProviderBaseUrl: "https://api.example.com/v1",
 *   hostedProviderId: "hosted",
 *   hostedProviderModelId: "legal-primary",
 *   hostedProviderModelName: "Legal Primary",
 *   localProviderBaseUrl: "http://127.0.0.1:11434/v1",
 *   localProviderId: "ollama",
 *   localProviderModelId: "gemma3:4b",
 *   localProviderModelName: "Gemma 3 4B",
 *   telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token"
 * })
 * console.log(OpenClawStack)
 * console.log(args.paths.configRoot)
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
  public readonly generation: pulumi.Output<pulumi.Unwrap<OpenClawGeneration>>;

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
   * Fail-closed P3 live acceptance command for an operator sitting.
   *
   * @since 0.0.0
   */
  public readonly liveAcceptanceCommand: pulumi.Output<string>;

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

  public constructor(
    name: string,
    args: OpenClawStackArgs,
    generation: OpenClawGeneration,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("beep:infra:OpenClawStack", name, {}, opts);

    const identity = args.identity;
    const unitText = renderOpenClawUnit(generation);
    const runScript = renderOpenClawRunScript(generation);
    const preflightScript = renderOpenClawPreflightScript(
      OpenClawGenerationIdentityScriptInput.make({ generation, identity })
    );
    const stageScript = renderOpenClawStageScript(generation);
    const applyScript = renderOpenClawApplyScript(generation);
    const probeScript = renderOpenClawProbeScript(OpenClawGenerationIdentityScriptInput.make({ generation, identity }));
    const generationTriggers = [
      generation.generationId,
      generation.canonicalJson,
      generation.soulMarkdown,
      generation.proofSkillMarkdown,
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
        triggers: [...generationTriggers, stageScript],
        update: stageScript,
      },
      { dependsOn: preflight, parent: this }
    );
    const apply = new command.local.Command(
      `${name}-apply`,
      {
        create: applyScript,
        triggers: [...generationTriggers, applyScript],
        update: applyScript,
      },
      { dependsOn: stage, parent: this }
    );
    const probe = new command.local.Command(
      `${name}-probe`,
      {
        create: probeScript,
        triggers: [...generationTriggers, probeScript],
        update: probeScript,
      },
      { dependsOn: apply, parent: this }
    );
    const backupShip = O.getOrUndefined(
      O.map(args.backup, (backup) => {
        const backupScript = renderOpenClawBackupShipScript(OpenClawBackupShipScriptInput.make({ backup, generation }));

        return new command.local.Command(
          `${name}-backup-ship`,
          {
            create: backupScript,
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
    this.driftAuditCommand = pulumi.output(
      renderOpenClawDriftAuditScript(OpenClawGenerationIdentityScriptInput.make({ generation, identity }))
    );
    this.liveAcceptanceCommand = pulumi.output(renderOpenClawLiveAcceptanceScript(generation));
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
      liveAcceptanceCommand: this.liveAcceptanceCommand,
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
