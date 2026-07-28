import { createHash } from "node:crypto";
import {
  makeOpenClawGeneration,
  makeOpenClawStackArgsFromConfigValues,
  OpenClawBackupConfig,
  OpenClawDeploymentConfig,
  OpenClawExpectedIdentity,
  OpenClawPulumiConfigValues,
  OpenClawStackArgs,
  OpenClawWorkstationPaths,
  renderOpenClawApplyScript,
  renderOpenClawBackupShipScript,
  renderOpenClawDriftAuditScript,
  renderOpenClawGenerationTree,
  renderOpenClawPreflightScript,
  renderOpenClawProbeScript,
  renderOpenClawRollbackScript,
  renderOpenClawRunScript,
  renderOpenClawStageScript,
  renderOpenClawUnit,
} from "@beep/infra";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as R from "@beep/utils/Record";
import * as Str from "@beep/utils/Str";
import { Effect, pipe } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
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
};

const defaultArgs = OpenClawStackArgs.new(identity);
const defaultGeneration = makeOpenClawGeneration(defaultArgs);

/**
 * Unwrap a rendered `/bin/bash -lc '<body>'` command back into the body the
 * shell actually executes, so assertions read as the script an operator sees.
 */
const scriptBody = (rendered: string): string =>
  pipe(rendered, Str.slice("/bin/bash -lc '".length, -1), Str.replace(/'"'"'/gu, "'"));

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
Environment=PATH=/home/elpresidank/.local/share/mise/installs/node/24/bin:/usr/bin:/bin
Environment=HOME=/home/elpresidank
Environment=OPENCLAW_CONFIG_PATH=/etc/beep/openclaw/current/openclaw.json
Environment=OPENCLAW_STATE_DIR=/var/lib/beep/openclaw
Environment=OPENCLAW_NIX_MODE=1
LoadCredential=gateway-token:/home/elpresidank/.config/beep/openclaw/credentials/gateway-token
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
  it("applies workstation defaults around a declared identity", () => {
    expect(defaultArgs.identity.machineId).toBe("0bffc9bc5a6b48928f1ab4794df5244b");
    expect(defaultArgs.paths.configRoot).toBe("/etc/beep/openclaw");
    expect(defaultArgs.paths.stateDir).toBe("/var/lib/beep/openclaw");
    expect(defaultArgs.paths.unitName).toBe("openclaw.service");
    expect(defaultArgs.deployment.gatewayPort).toBe(19_031);
    expect(defaultArgs.deployment.openclawVersion).toBe("2026.7.1-2");
    expect(defaultArgs.deployment.gatewayAuthTokenRef).toBe("op://beep-openclaw/gateway/token");
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

  it("applies every Pulumi config override including backup shipping", () => {
    const args = makeOpenClawStackArgsFromConfigValues({
      ...identityConfigValues,
      agentId: "docket",
      agentModel: "ollama/gemma3:12b",
      agentName: "Docket Agent",
      agentWorkspace: "/srv/beep/openclaw/workspace",
      backupPassphraseSecretRef: "op://beep-openclaw/backup/passphrase",
      backupRemoteDir: "/srv/data/openclaw-archive",
      backupSshAgentSocketPath: "/run/user/1000/gcr/ssh",
      backupSshHost: "dankserver-yubi",
      backupSshUser: "deploy",
      configRoot: "/srv/beep/openclaw",
      gatewayAuthTokenRef: "op://beep-openclaw/gateway/rotating",
      gatewayPort: 19_040,
      logFilePath: "/srv/beep/openclaw/log/openclaw.log",
      nodeBinDir: "/opt/node/bin",
      openclawVersion: "2026.7.1-2",
      resolverCommandPath: "/opt/beep/openclaw/resolve.sh",
      resolverOpBinaryPath: "/opt/beep/openclaw/bin/op-cli",
      resolverTrustedDir: "/opt/beep/openclaw/trusted",
      stateDir: "/srv/beep/openclaw/state",
      unitName: "beep-openclaw.service",
    });

    expect(args.deployment.agentId).toBe("docket");
    expect(args.deployment.agentWorkspace).toBe("/srv/beep/openclaw/workspace");
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
      nodeBinDir: "/home/elpresidank/.local/share/mise/installs/node/24/bin",
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
  });

  it("addresses a generation by the sha256 of its own canonical config bytes", () => {
    expect(defaultGeneration.generationId).toBe(
      createHash("sha256").update(defaultGeneration.canonicalJson, "utf8").digest("hex")
    );
    expect(defaultGeneration.generationId).toMatch(/^[0-9a-f]{64}$/u);
    expect(makeOpenClawGeneration(defaultArgs).generationId).toBe(defaultGeneration.generationId);
  });

  it("re-addresses the generation when the deployment intent changes", () => {
    const other = makeOpenClawGeneration(
      OpenClawStackArgs.new(identity, OpenClawDeploymentConfig.make({ gatewayPort: 19_040 }))
    );

    expect(other.generationId).not.toBe(defaultGeneration.generationId);
  });

  it("renders the systemd unit byte-identically to the recorded golden text", () => {
    expect(renderOpenClawUnit(defaultGeneration)).toBe(goldenUnitText);
  });

  it("renders a run script that resolves the pointer and dispatches on mode", () => {
    const runScript = renderOpenClawRunScript(defaultGeneration);

    expect(runScript.startsWith("#!/usr/bin/env bash\n# BEEP_OPENCLAW_MANAGED\nset -euo pipefail\n")).toBe(true);
    expect(runScript).toContain('generation_dir="$(dirname "$(readlink -f "$0")")"');
    expect(runScript).toContain('preflight) exec "${openclaw_bin}" config validate ;;');
    expect(runScript).toContain('gateway) exec "${openclaw_bin}" gateway ;;');
  });

  it("renders the generation tree with exact paths and modes", () => {
    const tree = renderOpenClawGenerationTree(defaultGeneration);

    expect(A.sort(R.keys(tree), Str.Order)).toEqual(["manifest.json", "openclaw.json", "run.sh"]);
    expect(tree["openclaw.json"]?.mode).toBe("0644");
    expect(tree["manifest.json"]?.mode).toBe("0644");
    expect(tree["run.sh"]?.mode).toBe("0755");
    expect(tree["openclaw.json"]?.content).toBe(defaultGeneration.canonicalJson);
    expect(tree["manifest.json"]?.content).toContain(`"openclawVersion": "2026.7.1-2"`);
    expect(tree["manifest.json"]?.content).toContain(`"nodeVersion": "24.16.0"`);
    expect(tree["manifest.json"]?.content).toContain(`"generationId": "${defaultGeneration.generationId}"`);
  });

  it("stages every generation file root-owned with its declared mode", () => {
    const script = scriptBody(renderOpenClawStageScript(defaultGeneration));
    const generationDir = `/etc/beep/openclaw/${defaultGeneration.generationId}`;

    expect(script).toContain(`sudo -n install -o root -g root -m 0644 /dev/stdin '${generationDir}/openclaw.json'`);
    expect(script).toContain(`sudo -n install -o root -g root -m 0644 /dev/stdin '${generationDir}/manifest.json'`);
    expect(script).toContain(`sudo -n install -o root -g root -m 0755 /dev/stdin '${generationDir}/run.sh'`);
    expect(script).toContain("BEEP_OPENCLAW_CONFIG");
    expect(script).toContain("BEEP_OPENCLAW_MANIFEST");
    expect(script).toContain("BEEP_OPENCLAW_RUN");
    expect(script).toContain("BEEP_OPENCLAW_UNIT");
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
    expect(script).toContain("sudo -n -v");
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
    const snapshot = lineIndexOf(script, 'sudo -n cp -a -- "${state_dir}" "${snapshot}"');
    const pointer = lineIndexOf(script, 'sudo -n mv -T -- "${pointer}.tmp.$$" "${pointer}"');
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

    expect(script).toContain(`sudo -n ln -s -- '${defaultGeneration.generationId}' "\${pointer}.tmp.$$"`);
    expect(script).toContain('sudo -n mv -T -- "${pointer}.tmp.$$" "${pointer}"');
    expect(script).toContain("APPLY-POINTER");
  });

  it("restores the snapshot and prior pointer on a failed start or failed health wait", () => {
    const script = scriptBody(renderOpenClawApplyScript(defaultGeneration));

    expect(script).toContain("restore_snapshot() {");
    expect(script).toContain("APPLY-ROLLBACK: restoring snapshot");
    expect(script).toContain('sudo -n cp -a -- "${snapshot}" "${state_dir}"');
    expect(script).toContain('sudo -n ln -s -- "${prior_pointer}" "${pointer}.rollback.$$"');
    expect(script.split("restore_snapshot").length - 1).toBeGreaterThanOrEqual(3);
    expect(script).toContain("APPLY-FAIL: unit failed to start; snapshot and prior pointer restored");
    expect(script).toContain("never succeeded within 30s; snapshot and prior pointer restored");
  });

  it("refuses to start a generation older than the migrated live state", () => {
    const script = scriptBody(renderOpenClawApplyScript(defaultGeneration));
    const guard = lineIndexOf(script, "APPLY-REFUSED: downgrade guard");
    const firstPrivilegedStep = lineIndexOf(script, "sudo -n");

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
    const restore = lineIndexOf(script, 'sudo -n cp -a -- "${snapshot}" "${state_dir}"');
    const pointer = lineIndexOf(script, 'sudo -n mv -T -- "${pointer}.rollback.$$" "${pointer}"');
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

    expect(script).not.toContain("sudo -n");
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
