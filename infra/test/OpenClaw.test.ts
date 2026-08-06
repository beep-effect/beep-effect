/** @effect-diagnostics nodeBuiltinImport:skip-file */
// The rendered acceptance script is executed once to prove its fail-closed
// usage path; a raw spawn keeps @beep/infra free of platform-node test deps.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  makeOpenClawBundleHash,
  makeOpenClawDeploymentIntent,
  makeOpenClawGeneration,
  makeOpenClawStackArgsFromConfigValues,
  OpenClawBackupConfig,
  OpenClawBackupShipScriptInput,
  OpenClawBundleHashInput,
  OpenClawDeploymentConfig,
  OpenClawExpectedIdentity,
  OpenClawGenerationIdentityScriptInput,
  OpenClawHostedProviderConfig,
  OpenClawPulumiConfigValues,
  OpenClawStackArgs,
  OpenClawWorkstationPaths,
  renderOpenClawApplyScript,
  renderOpenClawBackupShipScript,
  renderOpenClawDriftAuditScript,
  renderOpenClawGenerationTree,
  renderOpenClawLiveAcceptanceScript,
  renderOpenClawPreflightScript,
  renderOpenClawProbeScript,
  renderOpenClawRollbackScript,
  renderOpenClawRunScript,
  renderOpenClawStageScript,
  renderOpenClawUnit,
} from "@beep/infra";
import { OpenclawSecretReference, OpenclawSha256Hex } from "@beep/openclaw";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as R from "@beep/utils/Record";
import * as Str from "@beep/utils/Str";
import { Effect, pipe, Result } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  openClawLegalSoulMarkdown,
  openClawProofSkillMarkdown,
  openClawProofSkillRelativePath,
  openClawSoulRelativePath,
} from "../src/OpenClawArtifacts.ts";
import { expectSchemaRoundTrip } from "./schemaParity.ts";

const identity = OpenClawExpectedIdentity.make({
  home: "/home/elpresidank",
  hostname: "DankStation",
  machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
  runtimeDir: "/run/user/1000",
  uid: 1000,
  username: "elpresidank",
});

const identityConfigValues = {
  expectedHome: "/home/elpresidank",
  expectedHostname: "DankStation",
  expectedMachineId: "0bffc9bc5a6b48928f1ab4794df5244b",
  expectedRuntimeDir: "/run/user/1000",
  expectedUid: 1000,
  expectedUsername: "elpresidank",
  hostedProviderApiKeyRef: "op://beep-openclaw/hosted/api-key",
  hostedProviderBaseUrl: "https://hosted.example.test/v1",
  hostedProviderId: "hosted",
  hostedProviderModelId: "hosted-model",
  hostedProviderModelName: "Hosted Model",
  localProviderBaseUrl: "http://127.0.0.1:11434/v1",
  localProviderId: "local",
  localProviderModelId: "local-model",
  localProviderModelName: "Local Model",
  telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token",
};

const deploymentConfig = OpenClawDeploymentConfig.make({
  hostedProvider: {
    apiKeyRef: OpenclawSecretReference.make("op://beep-openclaw/hosted/api-key"),
    baseUrl: "https://hosted.example.test/v1",
    modelId: "hosted-model",
    modelName: "Hosted Model",
    providerId: "hosted",
  },
  localProvider: {
    baseUrl: "http://127.0.0.1:11434/v1",
    modelId: "local-model",
    modelName: "Local Model",
    providerId: "local",
  },
  telegramBotTokenRef: OpenclawSecretReference.make("op://beep-openclaw/telegram/bot-token"),
});
const defaultArgs = OpenClawStackArgs.new(identity, deploymentConfig);
const defaultGeneration = makeOpenClawGeneration(defaultArgs);
const parseDocument = (json: string): { readonly [key: string]: unknown } =>
  O.getOrThrow(
    pipe(Result.getOrThrow(S.decodeUnknownResult(S.fromJsonString(S.Unknown))(json)), O.liftPredicate(P.isObject))
  );

/**
 * Unwrap a rendered `/bin/bash --noprofile --norc -p -c '<body>'` command back into the body the
 * shell actually executes, so assertions read as the script an operator sees.
 */
const scriptWrapperPrefix = "/bin/bash --noprofile --norc -p -c '";

const scriptBody = (rendered: string): string =>
  pipe(rendered, Str.slice(scriptWrapperPrefix.length, -1), Str.replace(/'"'"'/gu, "'"));

/** Index of the first line matching `needle`, or `-1` when absent. */
const lineIndexOf = (script: string, needle: string): number =>
  script.split("\n").findIndex((line) => line.includes(needle));

/**
 * The executed part of a script, with the leading shell function definitions
 * dropped, so ordering assertions read the sequence rather than the helpers a
 * failure path calls into.
 */
const mainSequence = (script: string): string => {
  const lines = script.split("\n");
  const lastFunctionEnd = lines.reduce((acc, line, index) => (line === "}" ? index : acc), -1);

  return lines.slice(lastFunctionEnd + 1).join("\n");
};

const goldenUnitText = `# BEEP_OPENCLAW_MANAGED
[Unit]
Description=OpenClaw workstation gateway (beep-managed generation ${defaultGeneration.generationId})
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=PATH=/opt/beep/openclaw/node/bin:/usr/bin:/bin
Environment=HOME=/home/elpresidank
Environment=OPENCLAW_CONFIG_PATH=/etc/beep/openclaw/current/openclaw.json
Environment=OPENCLAW_STATE_DIR=/var/lib/beep/openclaw
Environment=OPENCLAW_NIX_MODE=1
LoadCredential=op-service-account-token:/etc/beep/openclaw/credentials/op-service-account-token
UnsetEnvironment=OP_SERVICE_ACCOUNT_TOKEN OP_SESSION OP_CONNECT_TOKEN OPENCLAW_GATEWAY_TOKEN
ExecStartPre=/etc/beep/openclaw/current/run.sh preflight
ExecStart=/etc/beep/openclaw/current/run.sh
Restart=no
StandardOutput=append:/var/lib/beep/openclaw/log/openclaw.log
StandardError=append:/var/lib/beep/openclaw/log/openclaw.log

[Install]
WantedBy=default.target
`;

describe("@beep/infra OpenClaw", () => {
  it("rejects plaintext HTTP for hosted provider credentials", () => {
    const provider = {
      apiKeyRef: "op://beep-openclaw/hosted/api-key",
      baseUrl: "https://hosted.example.test/v1",
      modelId: "model",
      modelName: "Model",
      providerId: "hosted",
    };

    expect(Result.isSuccess(S.decodeUnknownResult(OpenClawHostedProviderConfig)(provider))).toBe(true);
    expect(
      Result.isFailure(
        S.decodeUnknownResult(OpenClawHostedProviderConfig)({
          ...provider,
          baseUrl: "http://hosted.example.test/v1",
        })
      )
    ).toBe(true);
  });

  it("applies workstation defaults around a declared identity", () => {
    expect(defaultArgs.identity.machineId).toBe("0bffc9bc5a6b48928f1ab4794df5244b");
    expect(defaultArgs.paths.configRoot).toBe("/etc/beep/openclaw");
    expect(defaultArgs.paths.stateDir).toBe("/var/lib/beep/openclaw");
    expect(defaultArgs.paths.unitName).toBe("openclaw.service");
    expect(defaultArgs.deployment.gatewayPort).toBe(19_031);
    expect(defaultArgs.deployment.openclawVersion).toBe("2026.7.1-2");
    expect(defaultArgs.deployment.gatewayAuthTokenRef).toBe("op://beep-openclaw/gateway/token");
    expect(defaultArgs.deployment.telegramDmPolicy).toBe("pairing");
    expect(defaultArgs.deployment.telegramGroupPolicy).toBe("disabled");
    expect(O.isNone(defaultArgs.backup)).toBe(true);
  });

  it("maps the workstation Pulumi stack config to stack args", () => {
    const args = makeOpenClawStackArgsFromConfigValues(identityConfigValues);

    expect(args.identity.hostname).toBe("DankStation");
    expect(args.identity.uid).toBe(1000);
    expect(args.paths.configRoot).toBe("/etc/beep/openclaw");
    expect(args.deployment.agentId).toBe("workstation");
    expect(O.isNone(args.backup)).toBe(true);
  });

  it("renders exactly two providers, hosted primary, DM-only Telegram, and loopback Control UI", () => {
    const intent = makeOpenClawDeploymentIntent(deploymentConfig);
    const document = parseDocument(defaultGeneration.canonicalJson);

    expect(intent.agent.model).toBe("hosted/hosted-model");
    expect(intent.agent.workspace).toBe("/etc/beep/openclaw/current/workspace");
    expect(intent.providers).toHaveLength(2);
    expect(intent.providers[0]?.id).toBe("hosted");
    expect(intent.providers[1]?.id).toBe("local");
    expect(intent.providers[1]?.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(intent.skills).toHaveLength(1);
    expect(intent.skills[0]?.name).toBe("beep-proof-ping");
    expect(O.getOrThrow(intent.telegram).groups).toEqual({});
    expect(document).toMatchObject({
      channels: { telegram: { configWrites: false, groups: {} } },
      gateway: {
        controlUi: {
          allowedOrigins: ["http://127.0.0.1:19031", "http://localhost:19031"],
          enabled: true,
        },
      },
      models: {
        providers: {
          hosted: {
            api: "openai-compat",
            apiKey: { id: "value", provider: "op_provider_hosted", source: "exec" },
          },
          local: {
            api: "openai-compat",
            apiKey: "local-no-secret",
            baseUrl: "http://127.0.0.1:11434/v1",
          },
        },
      },
    });
    expect(defaultGeneration.canonicalJson).toContain("op://beep-openclaw/hosted/api-key");
    expect(defaultGeneration.canonicalJson).not.toContain("raw-credential");
    expect(defaultGeneration.canonicalJson).not.toContain("allowInsecureAuth");
    expect(defaultGeneration.canonicalJson).not.toContain("dangerouslyDisableDeviceAuth");
    expect(defaultGeneration.canonicalJson).not.toContain("dangerouslyAllowHostHeaderOriginFallback");
  });

  it("applies every Pulumi config override including backup shipping", () => {
    const args = makeOpenClawStackArgsFromConfigValues({
      ...identityConfigValues,
      agentId: "docket",
      agentName: "Docket Agent",
      backupPassphraseSecretRef: "op://beep-openclaw/backup/passphrase",
      backupRemoteDir: "/srv/data/openclaw-archive",
      backupSshAgentSocketPath: "/run/user/1000/gcr/ssh",
      backupSshHost: "dankserver-yubi",
      backupSshUser: "deploy",
      configRoot: "/srv/beep/openclaw",
      gatewayAuthTokenRef: "op://beep-openclaw/gateway/rotating",
      gatewayPort: 19_040,
      hostedProviderApiKeyRef: "op://beep-openclaw/hosted/rotating",
      hostedProviderBaseUrl: "https://hosted.example.test/v2",
      hostedProviderId: "hosted-two",
      hostedProviderModelId: "hosted-model-two",
      hostedProviderModelName: "Hosted Model Two",
      localProviderBaseUrl: "http://127.0.0.1:11435/v1",
      localProviderId: "local-two",
      localProviderModelId: "local-model-two",
      localProviderModelName: "Local Model Two",
      logFilePath: "/srv/beep/openclaw/log/openclaw.log",
      nodeBinDir: "/opt/node/bin",
      openclawVersion: "2026.7.1-2",
      resolverCommandPath: "/opt/beep/openclaw/resolve.sh",
      resolverOpBinaryPath: "/opt/beep/openclaw/bin/op-cli",
      resolverTrustedDir: "/opt/beep/openclaw/trusted",
      stateDir: "/srv/beep/openclaw/state",
      telegramBotTokenRef: "op://beep-openclaw/telegram/rotating",
      unitName: "beep-openclaw.service",
    });

    expect(args.deployment.agentId).toBe("docket");
    expect(args.deployment.hostedProvider.providerId).toBe("hosted-two");
    expect(args.deployment.gatewayAuthTokenRef).toBe("op://beep-openclaw/gateway/rotating");
    expect(args.deployment.gatewayPort).toBe(19_040);
    expect(args.deployment.resolverTrustedDir).toBe("/opt/beep/openclaw/trusted");
    expect(args.paths.configRoot).toBe("/srv/beep/openclaw");
    expect(args.paths.nodeBinDir).toBe("/opt/node/bin");
    expect(args.paths.unitName).toBe("beep-openclaw.service");
    expect(O.getOrThrow(args.backup).host).toBe("dankserver-yubi");
    expect(O.getOrThrow(args.backup).user).toBe("deploy");
    expect(O.getOrThrow(args.backup).remoteDir).toBe("/srv/data/openclaw-archive");
    expect(O.getOrUndefined(O.getOrThrow(args.backup).agentSocketPath)).toBe("/run/user/1000/gcr/ssh");
  });

  it("decodes typed Pulumi config values and rejects wrong types", () => {
    const decoded = Effect.runSync(
      OpenClawPulumiConfigValues.decodeEffect({
        expectedUid: 1000,
        gatewayPort: 19_040,
      })
    );

    expect(decoded.expectedUid).toBe(1000);
    expect(decoded.gatewayPort).toBe(19_040);
    expect(() => Effect.runSync(OpenClawPulumiConfigValues.decodeEffect({ gatewayPort: "19040" }))).toThrow();
    expect(() => Effect.runSync(OpenClawPulumiConfigValues.decodeEffect({ gatewayPort: 80 }))).toThrow();
    expect(() =>
      Effect.runSync(OpenClawPulumiConfigValues.decodeEffect({ expectedMachineId: "not-a-machine-id" }))
    ).toThrow();
    expect(() =>
      Effect.runSync(
        OpenClawPulumiConfigValues.decodeEffect({ localProviderBaseUrl: "https://remote.example.test/v1" })
      )
    ).toThrow();
    expect(Effect.runSync(OpenClawPulumiConfigValues.decodeEffect({ configWrites: true }))).not.toHaveProperty(
      "configWrites"
    );
  });

  it("rejects an invalid openclaw:openclawVersion config value", () => {
    expect(() =>
      makeOpenClawStackArgsFromConfigValues({ ...identityConfigValues, openclawVersion: "2026.7.2-beta.4" })
    ).toThrow(/Invalid openclaw:openclawVersion Pulumi config value "2026\.7\.2-beta\.4"/u);
  });

  it("rejects an invalid openclaw:gatewayAuthTokenRef config value", () => {
    expect(() =>
      makeOpenClawStackArgsFromConfigValues({ ...identityConfigValues, gatewayAuthTokenRef: "plaintext-token" })
    ).toThrow(/Invalid openclaw:gatewayAuthTokenRef Pulumi config value "plaintext-token"/u);
  });

  it("refuses to build stack args when the expected identity is incomplete", () => {
    expect(() => makeOpenClawStackArgsFromConfigValues({})).toThrow(/Missing openclaw:expectedHome/u);
    expect(() =>
      makeOpenClawStackArgsFromConfigValues({ ...identityConfigValues, expectedMachineId: undefined })
    ).toThrow(/Missing openclaw:expectedMachineId/u);
  });

  it("encodes OpenClaw config classes with unchanged optional-key wire shapes", () => {
    const encodedPaths = Effect.runSync(
      S.encodeUnknownEffect(OpenClawWorkstationPaths)(OpenClawWorkstationPaths.make({ unitName: "beep.service" }))
    );
    const encodedBackup = Effect.runSync(
      S.encodeUnknownEffect(OpenClawBackupConfig)(
        OpenClawBackupConfig.make({ passphraseSecretRef: "op://beep-openclaw/backup/passphrase" })
      )
    );

    expect(encodedPaths).toEqual({
      configRoot: "/etc/beep/openclaw",
      nodeBinDir: "/opt/beep/openclaw/node/bin",
      stateDir: "/var/lib/beep/openclaw",
      unitName: "beep.service",
    });
    expect(encodedBackup).toEqual({
      host: "dankserver",
      passphraseSecretRef: "op://beep-openclaw/backup/passphrase",
      remoteDir: "/srv/data/beep-openclaw-backups",
      user: "elpresidank",
    });
  });

  it("round-trips OpenClaw config schemas through encoded wire values", () => {
    assertSchemaArbitraryDecodesToSelf(OpenClawPulumiConfigValues, { numRuns: 25 });
    expectSchemaRoundTrip(OpenClawPulumiConfigValues);
    expectSchemaRoundTrip(OpenClawExpectedIdentity);
    expectSchemaRoundTrip(OpenClawWorkstationPaths);
    expectSchemaRoundTrip(OpenClawDeploymentConfig);
    expectSchemaRoundTrip(OpenClawBackupConfig);
    expectSchemaRoundTrip(OpenClawBundleHashInput);
  });

  it("models renderer input contracts as schemas", () => {
    const backup = OpenClawBackupConfig.make({
      passphraseSecretRef: "op://beep-openclaw/backup/passphrase",
    });
    const generationIdentityInput = OpenClawGenerationIdentityScriptInput.make({
      generation: defaultGeneration,
      identity,
    });
    const backupInput = OpenClawBackupShipScriptInput.make({ backup, generation: defaultGeneration });

    expect(S.is(OpenClawGenerationIdentityScriptInput)(generationIdentityInput)).toBe(true);
    expect(S.is(OpenClawBackupShipScriptInput)(backupInput)).toBe(true);
  });

  it("addresses a generation by the length-delimited config/persona/skill/compatibility bundle", () => {
    expect(defaultGeneration.configHash).toBe(
      createHash("sha256").update(defaultGeneration.canonicalJson, "utf8").digest("hex")
    );
    expect(defaultGeneration.generationId).not.toBe(defaultGeneration.configHash);
    expect(defaultGeneration.generationId).toMatch(/^[0-9a-f]{64}$/u);
    expect(makeOpenClawGeneration(defaultArgs).generationId).toBe(defaultGeneration.generationId);
  });

  it("re-addresses the generation when the deployment intent changes", () => {
    const other = makeOpenClawGeneration(
      OpenClawStackArgs.new(identity, OpenClawDeploymentConfig.make({ ...deploymentConfig, gatewayPort: 19_040 }))
    );

    expect(other.generationId).not.toBe(defaultGeneration.generationId);
  });

  it("re-addresses the generation when only SOUL bytes change", () => {
    const changedSoulHash = OpenclawSha256Hex.make(
      createHash("sha256").update(`${openClawLegalSoulMarkdown}\n`, "utf8").digest("hex")
    );

    expect(
      makeOpenClawBundleHash({
        configHash: defaultGeneration.configHash,
        proofSkillHash: defaultGeneration.proofSkillHash,
        soulHash: changedSoulHash,
      })
    ).not.toBe(defaultGeneration.generationId);
  });

  it("renders the systemd unit byte-identically to the recorded golden text", () => {
    expect(renderOpenClawUnit(defaultGeneration)).toBe(goldenUnitText);
  });

  it("renders a run script that resolves the pointer and dispatches on mode", () => {
    const runScript = renderOpenClawRunScript(defaultGeneration);

    expect(runScript.startsWith("#!/usr/bin/env bash\n# BEEP_OPENCLAW_MANAGED\nset -euo pipefail\n")).toBe(true);
    expect(runScript).toContain('generation_dir="$(dirname "$(readlink -f "$0")")"');
    expect(runScript).toContain("unset OP_SERVICE_ACCOUNT_TOKEN OP_SESSION OP_CONNECT_TOKEN OPENCLAW_GATEWAY_TOKEN");
    expect(runScript).toContain('"${op_binary}" whoami >/dev/null');
    expect(runScript).toContain('export OP_SERVICE_ACCOUNT_TOKEN="$(cat "${credential_file}")"');
    expect(runScript).toContain('exec "${openclaw_bin}" config validate');
    expect(runScript).toContain('gateway) exec "${openclaw_bin}" gateway ;;');
  });

  it("renders the generation tree with exact paths and modes", () => {
    const tree = renderOpenClawGenerationTree(defaultGeneration);

    expect(A.sort(R.keys(tree), Str.Order)).toEqual([
      "manifest.json",
      "openclaw.json",
      "run.sh",
      openClawSoulRelativePath,
      openClawProofSkillRelativePath,
    ]);
    expect(tree).toMatchObject({
      "manifest.json": { mode: "0644" },
      "openclaw.json": { content: defaultGeneration.canonicalJson, mode: "0644" },
      "run.sh": { mode: "0755" },
      [openClawSoulRelativePath]: { content: openClawLegalSoulMarkdown, mode: "0644" },
      [openClawProofSkillRelativePath]: { content: openClawProofSkillMarkdown, mode: "0644" },
    });
    const manifestContent = tree["manifest.json"]?.content ?? "";
    expect(manifestContent).toContain(`"openclawVersion": "2026.7.1-2"`);
    expect(manifestContent).toContain(`"nodeVersion": "24.16.0"`);
    expect(manifestContent).toContain(`"generationId": "${defaultGeneration.generationId}"`);
    expect(manifestContent).toContain(`"configHash": "${defaultGeneration.configHash}"`);
    expect(manifestContent).toContain(`"soulSha256": "${defaultGeneration.soulHash}"`);
    expect(manifestContent).toContain(`"proofSkillSha256": "${defaultGeneration.proofSkillHash}"`);
  });

  it("stages every generation file root-owned with its declared mode", () => {
    const script = scriptBody(renderOpenClawStageScript(defaultGeneration));
    const generationDir = `/etc/beep/openclaw/${defaultGeneration.generationId}`;

    expect(script).toContain(
      `/usr/bin/sudo -n install -o root -g root -m 0644 /dev/stdin '${generationDir}/openclaw.json'`
    );
    expect(script).toContain(
      `/usr/bin/sudo -n install -o root -g root -m 0644 /dev/stdin '${generationDir}/manifest.json'`
    );
    expect(script).toContain(`/usr/bin/sudo -n install -o root -g root -m 0755 /dev/stdin '${generationDir}/run.sh'`);
    expect(script).toContain(
      `/usr/bin/sudo -n install -o root -g root -m 0644 /dev/stdin '${generationDir}/${openClawSoulRelativePath}'`
    );
    expect(script).toContain(
      `/usr/bin/sudo -n install -o root -g root -m 0644 /dev/stdin '${generationDir}/${openClawProofSkillRelativePath}'`
    );
    expect(script).toContain("STAGE-FAIL: symlink parent");
    expect(script).toContain("BEEP_OPENCLAW_CONFIG");
    expect(script).toContain("BEEP_OPENCLAW_MANIFEST");
    expect(script).toContain("BEEP_OPENCLAW_RUN");
    expect(script).toContain("BEEP_OPENCLAW_UNIT");
  });

  it("proves the node toolchain is root-owned before running the privileged install", () => {
    const script = scriptBody(renderOpenClawStageScript(defaultGeneration));
    const nodeBinDir = defaultGeneration.nodeBinDir;

    // The privileged install must never resolve `npm` through PATH: a user-writable directory
    // ahead of it would execute an attacker's package manager as root, and `--ignore-scripts`
    // is no defense once the package manager binary itself is attacker-controlled.
    expect(script).not.toMatch(/sudo -n env PATH=\S+ npm install/u);
    expect(script).toContain('"${npm_bin}" install --prefix');
    expect(script).toContain(`node_dir="$(/usr/bin/readlink -f '${nodeBinDir}')"`);
    expect(script).toContain(`node_bin="$(/usr/bin/readlink -f '${nodeBinDir}/node')"`);
    expect(script).toContain(`npm_bin="$(/usr/bin/readlink -f '${nodeBinDir}/npm')"`);
    expect(script).toContain("assert_trusted_path \"${node_dir}\" 'pinned node bin dir'");
    expect(script).toContain("assert_trusted_path \"${node_bin}\" 'pinned node binary'");
    expect(script).toContain("assert_trusted_path \"${npm_bin}\" 'pinned npm binary'");
    expect(script).toContain('[ "${owner}" = 0 ] || fail "${label} is not root-owned: ${probe}"');
    expect(script).toContain('[ "$(( 8#${mode} & 8#22 ))" -eq 0 ]');
    // The walk must terminate at the root inode, so a writable ancestor cannot be swapped.
    expect(script).toContain('if [ "${probe}" = / ]; then break; fi');
    // The guard runs before any privileged mutation the stage script performs.
    const guard = lineIndexOf(script, 'assert_trusted_path "${npm_bin}"');
    const install = lineIndexOf(script, "/usr/bin/sudo -n install -d");
    const privilegedNpm = lineIndexOf(script, '"${npm_bin}" install --prefix');

    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(install);
    expect(guard).toBeLessThan(privilegedNpm);
  });

  it("pins the node toolchain default inside the root-owned trusted tree", () => {
    expect(OpenClawWorkstationPaths.make({}).nodeBinDir).toBe("/opt/beep/openclaw/node/bin");
  });

  it("never renders a login shell and never resolves sudo by name", () => {
    const rendered = [
      renderOpenClawPreflightScript({ generation: defaultGeneration, identity }),
      renderOpenClawStageScript(defaultGeneration),
      renderOpenClawApplyScript(defaultGeneration),
      renderOpenClawRollbackScript(defaultGeneration),
      renderOpenClawDriftAuditScript({ generation: defaultGeneration, identity }),
      renderOpenClawProbeScript({ generation: defaultGeneration, identity }),
      renderOpenClawLiveAcceptanceScript(defaultGeneration),
      renderOpenClawBackupShipScript({
        backup: OpenClawBackupConfig.make({ passphraseSecretRef: "op://beep-openclaw/backup/passphrase" }),
        generation: defaultGeneration,
      }),
    ];

    for (const command of rendered) {
      // A login shell sources the user-writable ~/.bash_profile before the first rendered line,
      // which lets an unprivileged user define a `sudo` function and hijack the armed ticket.
      expect(command.startsWith(scriptWrapperPrefix)).toBe(true);
      expect(command).not.toContain("/bin/bash -lc");

      const body = scriptBody(command);

      // Every privilege-granting call is absolute: a bare `sudo` is satisfied by any shim
      // earlier on PATH, and PATH is attacker-influenced until the pinned export runs.
      expect(body).not.toMatch(/(?<!\/usr\/bin\/)\bsudo -n\b/u);
      const pinnedPath = lineIndexOf(body, "export PATH=/usr/bin:/bin");
      const firstSudo = lineIndexOf(body, "/usr/bin/sudo");

      expect(pinnedPath).toBeGreaterThanOrEqual(0);
      // PATH is pinned before the first privileged call, never after it.
      if (firstSudo >= 0) {
        expect(pinnedPath).toBeLessThan(firstSudo);
      }
    }
  });

  it("asserts sudo is the real setuid binary rather than trusting a name lookup", () => {
    const script = scriptBody(renderOpenClawPreflightScript({ generation: defaultGeneration, identity }));

    expect(script).toContain("[ -u /usr/bin/sudo ] || fail '/usr/bin/sudo is missing or not setuid root'");
    expect(script).not.toContain("command -v sudo");
  });

  it("validates the candidate config with the candidate's own staged binary before apply", () => {
    const script = scriptBody(renderOpenClawStageScript(defaultGeneration));
    const generationDir = `/etc/beep/openclaw/${defaultGeneration.generationId}`;

    expect(script).toContain(`'${generationDir}/node_modules/.bin/openclaw' config validate`);
    expect(script).toContain(`OPENCLAW_CONFIG_PATH='${generationDir}/openclaw.json'`);
    expect(script).toContain("STAGE-OK");
    // Staging renders the unit (which targets `current`) but never moves the
    // pointer itself — switching generations is the apply step's job alone.
    expect(script).not.toContain("mv -T");
    expect(script).not.toContain("ln -s");
  });

  it("binds preflight to the declared identity and fails closed on unreadable values", () => {
    const script = scriptBody(renderOpenClawPreflightScript({ generation: defaultGeneration, identity }));

    expect(script).toContain("PREFLIGHT-FAIL");
    expect(script).toContain("exit 78");
    expect(script).toContain("expected_machine_id='0bffc9bc5a6b48928f1ab4794df5244b'");
    expect(script).toContain("malformed expected identity: empty machine-id (failing closed)");
    expect(script).toContain("unreadable machine-id on the target (failing closed)");
    expect(script).toContain("unreadable hostname on the target (failing closed)");
    expect(script).toContain("machine-id mismatch: expected");
  });

  it("checks linger, a real bus round-trip, the socket cap, and an armed sudo ticket in preflight", () => {
    const script = scriptBody(renderOpenClawPreflightScript({ generation: defaultGeneration, identity }));

    expect(script).toContain("loginctl show-user 'elpresidank' -p Linger --value");
    expect(script).toContain("linger not enabled for elpresidank");
    expect(script).toContain("systemctl --user show -p UnitsLoadTimestampMonotonic --value");
    expect(script).toContain("user bus round-trip failed (systemctl --user show)");
    expect(script).toContain("running|degraded|maintenance|starting) : ;;");
    expect(script).toContain("108-byte UNIX socket cap");
    expect(script).toContain("/usr/bin/sudo -n -v");
    expect(script).toContain("no armed sudo ticket");
    expect(script).toContain("PREFLIGHT-OK");
  });

  it("accepts a degraded user manager without depending on is-system-running's exit code", () => {
    const script = scriptBody(renderOpenClawPreflightScript({ generation: defaultGeneration, identity }));

    expect(script).toContain('manager_state="$(systemctl --user is-system-running 2>&1 || true)"');
    expect(script).toContain("user manager unreachable (state=");
  });

  it("orders apply as stop, snapshot, pointer switch, reload, start, health, commit", () => {
    const script = mainSequence(scriptBody(renderOpenClawApplyScript(defaultGeneration)));
    const stop = lineIndexOf(script, 'systemctl --user stop "${unit}" || true');
    const snapshot = lineIndexOf(script, '/usr/bin/sudo -n cp -a -- "${state_dir}" "${snapshot}"');
    const pointer = lineIndexOf(script, '/usr/bin/sudo -n mv -T -- "${pointer}.tmp.$$" "${pointer}"');
    const reload = lineIndexOf(script, "systemctl --user daemon-reload");
    const start = lineIndexOf(script, 'if ! systemctl --user start "${unit}"; then');
    const health = lineIndexOf(script, "for attempt in $(seq 1 30); do");
    const commit = lineIndexOf(script, ".beep-openclaw-committed");

    expect(stop).toBeGreaterThan(-1);
    expect(snapshot).toBeGreaterThan(stop);
    expect(pointer).toBeGreaterThan(snapshot);
    expect(reload).toBeGreaterThan(pointer);
    expect(start).toBeGreaterThan(reload);
    expect(health).toBeGreaterThan(start);
    expect(commit).toBeGreaterThan(health);
  });

  it("snapshots the stopped state including SQLite WAL sidecars before switching", () => {
    const script = scriptBody(renderOpenClawApplyScript(defaultGeneration));

    expect(script).toContain("APPLY-SNAPSHOT");
    expect(script).toContain("includes SQLite WAL sidecars");
    expect(script).toContain(`snapshot='/etc/beep/openclaw/.snapshots/${defaultGeneration.generationId}'`);
  });

  it("switches the pointer atomically with ln -s followed by mv -T", () => {
    const script = scriptBody(renderOpenClawApplyScript(defaultGeneration));

    expect(script).toContain(`/usr/bin/sudo -n ln -s -- '${defaultGeneration.generationId}' "\${pointer}.tmp.$$"`);
    expect(script).toContain('/usr/bin/sudo -n mv -T -- "${pointer}.tmp.$$" "${pointer}"');
    expect(script).toContain("APPLY-POINTER");
  });

  it("restores the snapshot and prior pointer on a failed start or failed health wait", () => {
    const script = scriptBody(renderOpenClawApplyScript(defaultGeneration));

    expect(script).toContain("restore_snapshot() {");
    expect(script).toContain("APPLY-ROLLBACK: restoring snapshot");
    expect(script).toContain('/usr/bin/sudo -n cp -a -- "${snapshot}" "${state_dir}"');
    expect(script).toContain('/usr/bin/sudo -n ln -s -- "${prior_pointer}" "${pointer}.rollback.$$"');
    expect(script.split("restore_snapshot").length - 1).toBeGreaterThanOrEqual(3);
    expect(script).toContain("APPLY-FAIL: unit failed to start; snapshot and prior pointer restored");
    expect(script).toContain("never succeeded within 30s; snapshot and prior pointer restored");
  });

  it("refuses to start a generation older than the migrated live state", () => {
    const script = scriptBody(renderOpenClawApplyScript(defaultGeneration));
    const guard = lineIndexOf(script, "APPLY-REFUSED: downgrade guard");
    const firstPrivilegedStep = lineIndexOf(script, "/usr/bin/sudo -n");

    expect(script).toContain("PRAGMA user_version;");
    expect(script).toContain('if [ "${candidate_user_version}" -lt "${live_user_version}" ]; then');
    expect(script).toContain("restore a snapshot before switching");
    expect(script).toContain("exit 75");
    expect(script).toContain("downgrade guard read a malformed recorded user_version");
    // The guard must refuse before any privileged mutation is even reachable.
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(firstPrivilegedStep);
  });

  it("restores state before switching binaries in the operator rollback script", () => {
    const script = scriptBody(renderOpenClawRollbackScript(defaultGeneration));
    const restore = lineIndexOf(script, '/usr/bin/sudo -n cp -a -- "${snapshot}" "${state_dir}"');
    const pointer = lineIndexOf(script, '/usr/bin/sudo -n mv -T -- "${pointer}.rollback.$$" "${pointer}"');
    const start = lineIndexOf(script, 'systemctl --user start "${unit}"');

    expect(script).toContain("ROLLBACK-FAIL: no snapshot at");
    expect(script).toContain("ROLLBACK-FAIL: no recorded previous pointer at");
    expect(restore).toBeGreaterThan(-1);
    expect(pointer).toBeGreaterThan(restore);
    expect(start).toBeGreaterThan(pointer);
    expect(script).toContain("ROLLBACK-OK");
  });

  it("audits every drift dimension with alert-only output", () => {
    const script = scriptBody(renderOpenClawDriftAuditScript({ generation: defaultGeneration, identity }));

    expect(script).toContain("ALERT: OPENCLAW_CONFIG_DRIFT %s expected=%s actual=%s");
    expect(script).toContain("alert generation-pointer");
    expect(script).toContain("alert openclaw-version");
    expect(script).toContain("alert node-version");
    expect(script).toContain("alert unit-content");
    expect(script).toContain("alert unit-enabled");
    expect(script).toContain("alert unit-active");
    expect(script).toContain("alert config-hash");
    expect(script).toContain("alert config-validate");
    expect(script).toContain("alert identity-machine-id");
    expect(script).toContain("alert identity-runtime-dir");
    expect(script).toContain("DRIFT-AUDIT-COMPLETE");
    // Alert-only: the audit reports, an operator redeploys.
    expect(script.endsWith("exit 0")).toBe(true);
    expect(script).not.toContain("systemctl --user restart");
  });

  it("normalizes file modes through stat's octal form so 33188 can never read as drift", () => {
    const script = scriptBody(renderOpenClawDriftAuditScript({ generation: defaultGeneration, identity }));

    expect(script).toContain("stat -c '%a'");
    expect(script).toContain("alert config-mode 644");
    expect(script).toContain("alert run-script-mode 755");
    expect(script).not.toContain("33188");
  });

  it("mutates nothing in the drift audit", () => {
    const script = scriptBody(renderOpenClawDriftAuditScript({ generation: defaultGeneration, identity }));

    expect(script).not.toContain("/usr/bin/sudo -n");
    expect(script).not.toContain("mv -T");
    expect(script).not.toContain("rm -rf");
    expect(script).not.toContain("install -o root");
  });

  it("folds the drift inventory into the alert-only acceptance probe", () => {
    const script = scriptBody(renderOpenClawProbeScript({ generation: defaultGeneration, identity }));

    expect(script).toContain("PROBE-LIVENESS");
    expect(script).toContain("http://127.0.0.1:19031/health");
    expect(script).toContain("gateway call health");
    expect(script).toContain("channels status --probe");
    expect(script).toContain("ALERT: OPENCLAW_CONFIG_DRIFT");
    expect(script).toContain("PROBE-COMPLETE");
    expect(script.endsWith("exit 0")).toBe(true);
  });

  it("renders a separate fail-closed live acceptance command", () => {
    const script = scriptBody(renderOpenClawLiveAcceptanceScript(defaultGeneration));

    expect(script).toContain("LIVE-ACCEPTANCE-FAIL");
    expect(script).toContain("skills list --json --eligible --agent");
    expect(script).toContain("message send --channel telegram");
    expect(script).toContain("channels status --channel telegram --probe --json");
    expect(script).toContain("secrets reload --json");
    expect(script).toContain("P3_MODEL_OK");
    expect(script).toContain("P3_SKILL_OK");
    expect(script).toContain("export OPENCLAW_CONFIG_PATH='/etc/beep/openclaw/current/openclaw.json'");
    expect(script).toContain("export OPENCLAW_STATE_DIR='/var/lib/beep/openclaw'");
    expect(script.trimEnd().endsWith("exit 0")).toBe(false);
    const missingPhase = spawnSync("/bin/bash", ["-lc", script], { encoding: "utf8" });
    expect(missingPhase.status).toBe(1);
    expect(missingPhase.stderr).toContain("usage: live-acceptance degraded|restored");
  });

  it("encrypts snapshot archives locally and verifies a remote sha256 receipt", () => {
    const script = scriptBody(
      renderOpenClawBackupShipScript({
        backup: OpenClawBackupConfig.make({
          agentSocketPath: O.some("/run/user/1000/gcr/ssh"),
          passphraseSecretRef: "op://beep-openclaw/backup/passphrase",
        }),
        generation: defaultGeneration,
      })
    );

    expect(script).toContain("export SSH_AUTH_SOCK='/run/user/1000/gcr/ssh'");
    expect(script).toContain("OPENCLAW_BACKUP_PASSPHRASE is unset");
    expect(script).toContain("op://beep-openclaw/backup/passphrase");
    expect(script).toContain("gpg --batch --yes --symmetric --cipher-algo AES256");
    // dankserver is dumb storage: mkdir, scp, and a sha256 read-back, nothing else.
    expect(script).toContain("scp -q");
    expect(script).toContain("mkdir -p /srv/data/beep-openclaw-backups");
    expect(script).toContain("BACKUP-FAIL: receipt sha256 mismatch");
    expect(script).toContain("BACKUP-OK");
    // The passphrase reference travels; the material never does.
    expect(script).not.toContain("--passphrase ");
  });

  it("omits the ssh agent export when no agent socket is declared", () => {
    const script = scriptBody(
      renderOpenClawBackupShipScript({
        backup: OpenClawBackupConfig.make({ passphraseSecretRef: "op://beep-openclaw/backup/passphrase" }),
        generation: defaultGeneration,
      })
    );

    expect(script).not.toContain("SSH_AUTH_SOCK");
    expect(script).toContain("BACKUP-OK");
  });

  it("keeps secret material out of every rendered artifact", () => {
    const artifacts = [
      renderOpenClawUnit(defaultGeneration),
      renderOpenClawRunScript(defaultGeneration),
      scriptBody(renderOpenClawStageScript(defaultGeneration)),
      scriptBody(renderOpenClawApplyScript(defaultGeneration)),
      scriptBody(renderOpenClawProbeScript({ generation: defaultGeneration, identity })),
      defaultGeneration.canonicalJson,
    ];

    for (const artifact of artifacts) {
      expect(artifact).not.toContain("OPENCLAW_GATEWAY_TOKEN=");
    }
    // The unit strips inherited credentials rather than carrying them.
    expect(renderOpenClawUnit(defaultGeneration)).toContain(
      "UnsetEnvironment=OP_SERVICE_ACCOUNT_TOKEN OP_SESSION OP_CONNECT_TOKEN OPENCLAW_GATEWAY_TOKEN"
    );
  });
});
