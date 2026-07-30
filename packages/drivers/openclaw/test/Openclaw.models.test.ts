import {
  hermeticOpenclawEnv,
  OPENCLAW_COMPATIBILITY_SET,
  OPENCLAW_CONFIG_PATH,
  OPENCLAW_GATEWAY_TOKEN,
  OPENCLAW_HTTP_PROBE_TIMEOUT,
  OPENCLAW_NIX_MODE,
  OPENCLAW_STATE_DIR,
  OPENCLAW_VALIDATE_TIMEOUT,
} from "@beep/openclaw/Openclaw.config";
import {
  OpenclawCliError,
  OpenclawCommandExitError,
  OpenclawCommandSpawnError,
  OpenclawCommandTimeoutError,
  OpenclawOutputParseError,
} from "@beep/openclaw/Openclaw.errors";
import {
  OpenclawAgentTurn,
  OpenclawChannelAccountStatus,
  OpenclawChannelHealth,
  OpenclawCompatibilitySet,
  OpenclawConfigInvalid,
  OpenclawConfigValidation,
  OpenclawDiagnosticText,
  OpenclawDoctorReport,
  OpenclawExitCode,
  OpenclawGatewayHealth,
  OpenclawHttpProbe,
  OpenclawInvocationContext,
  OpenclawProcessRequest,
  OpenclawProcessResult,
  OpenclawSchemaPlaceholderFinding,
  OpenclawSecretsReload,
  OpenclawSecretsReloadDegraded,
  OpenclawSecretsReloaded,
  OpenclawSecretsReloadOutput,
  OpenclawSkillInventory,
  OpenclawSystemdUnitState,
  OpenclawTelegramSendResult,
  OpenclawVersionInfo,
} from "@beep/openclaw/Openclaw.models";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ExitCodeArbitrary = S.toArbitrary(OpenclawExitCode);
const DiagnosticTextArbitrary = S.toArbitrary(OpenclawDiagnosticText);
const ProcessRequestArbitrary = S.toArbitrary(OpenclawProcessRequest);
const ProcessResultArbitrary = S.toArbitrary(OpenclawProcessResult);
const VersionInfoArbitrary = S.toArbitrary(OpenclawVersionInfo);
const SecretsReloadArbitrary = S.toArbitrary(OpenclawSecretsReload);
const ConfigValidationArbitrary = S.toArbitrary(OpenclawConfigValidation);
const ChannelAccountStatusArbitrary = S.toArbitrary(OpenclawChannelAccountStatus);
const AgentTurnArbitrary = S.toArbitrary(OpenclawAgentTurn);
const InvocationContextArbitrary = S.toArbitrary(OpenclawInvocationContext);
const SystemdUnitStateArbitrary = S.toArbitrary(OpenclawSystemdUnitState);
const HttpProbeArbitrary = S.toArbitrary(OpenclawHttpProbe);
const PlaceholderFindingArbitrary = S.toArbitrary(OpenclawSchemaPlaceholderFinding);
const GatewayHealthArbitrary = S.toArbitrary(OpenclawGatewayHealth);
const CompatibilitySetArbitrary = S.toArbitrary(OpenclawCompatibilitySet);

const sameProcessRequest = S.toEquivalence(OpenclawProcessRequest);
const sameProcessResult = S.toEquivalence(OpenclawProcessResult);
const sameVersionInfo = S.toEquivalence(OpenclawVersionInfo);
const sameSecretsReload = S.toEquivalence(OpenclawSecretsReload);
const sameConfigValidation = S.toEquivalence(OpenclawConfigValidation);
const sameChannelAccountStatus = S.toEquivalence(OpenclawChannelAccountStatus);
const sameAgentTurn = S.toEquivalence(OpenclawAgentTurn);
const sameInvocationContext = S.toEquivalence(OpenclawInvocationContext);
const sameSystemdUnitState = S.toEquivalence(OpenclawSystemdUnitState);
const sameHttpProbe = S.toEquivalence(OpenclawHttpProbe);
const samePlaceholderFinding = S.toEquivalence(OpenclawSchemaPlaceholderFinding);
const sameGatewayHealth = S.toEquivalence(OpenclawGatewayHealth);
const sameCompatibilitySet = S.toEquivalence(OpenclawCompatibilitySet);

const roundTrip = <Sch extends S.Codec<unknown, unknown, never, never>>(schema: Sch, value: Sch["Type"]): Sch["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(Result.getOrThrow(S.encodeResult(schema)(value as never))));

describe("@beep/openclaw models", () => {
  it("parses the exact observed --version output", () => {
    const info = O.getOrThrow(OpenclawVersionInfo.fromVersionOutput("OpenClaw 2026.7.1-2 (0790d9f)"));

    expect(info.raw).toBe("OpenClaw 2026.7.1-2 (0790d9f)");
    expect(info.version).toBe("2026.7.1-2");
    expect(O.getOrThrow(info.commit)).toBe("0790d9f");

    const trailingNewline = O.getOrThrow(OpenclawVersionInfo.fromVersionOutput("OpenClaw 2026.7.1-2 (0790d9f)\n"));
    expect(trailingNewline.version).toBe("2026.7.1-2");

    const commitless = O.getOrThrow(OpenclawVersionInfo.fromVersionOutput("OpenClaw 2026.7.1-2"));
    expect(commitless.version).toBe("2026.7.1-2");
    expect(O.isNone(commitless.commit)).toBe(true);

    expect(O.isNone(OpenclawVersionInfo.fromVersionOutput("node: command not found"))).toBe(true);
  });

  it("decodes the exact observed secrets reload success JSON", () => {
    const output = Result.getOrThrow(
      S.decodeUnknownResult(S.fromJsonString(OpenclawSecretsReloadOutput))('{ "ok": true, "warningCount": 0 }')
    );

    expect(output.ok).toBe(true);
    expect(output.warningCount).toBe(0);
  });

  it("tolerantly decodes channels status account entries with unmodeled wire keys", () => {
    const accountJson =
      '{"accountId":"default","enabled":true,"configured":true,"running":true,"lastStartAt":1753600000000,' +
      '"lastStopAt":null,"lastError":null,"connected":true,"restartPending":false,"reconnectAttempts":0,' +
      '"tokenSource":"config","tokenStatus":"available","mode":"polling","probe":{"ok":true}}';
    const account = Result.getOrThrow(
      S.decodeUnknownResult(S.fromJsonString(OpenclawChannelAccountStatus))(accountJson)
    );

    expect(account.accountId).toBe("default");
    expect(account.enabled).toBe(true);
    expect(account.configured).toBe(true);
    expect(account.running).toBe(true);
    expect(O.getOrThrow(account.connected)).toBe(true);
    expect(O.getOrThrow(account.tokenSource)).toBe("config");
    expect(O.getOrThrow(account.tokenStatus)).toBe("available");
    expect(O.isNone(account.probeOk)).toBe(true);
    expect(O.isNone(account.probeError)).toBe(true);
  });

  it("tolerantly decodes channel health subsets of the gateway health document", () => {
    const channel = Result.getOrThrow(
      S.decodeUnknownResult(S.fromJsonString(OpenclawChannelHealth))(
        '{"running":true,"connected":true,"restartPending":false,"tokenSource":"config","tokenStatus":"available"}'
      )
    );

    expect(O.getOrThrow(channel.running)).toBe(true);
    expect(O.getOrThrow(channel.connected)).toBe(true);
    expect(O.getOrThrow(channel.restartPending)).toBe(false);
    expect(O.getOrThrow(channel.tokenSource)).toBe("config");
    expect(O.getOrThrow(channel.tokenStatus)).toBe("available");
  });

  it("tolerantly decodes agent turn projections with unmodeled keys", () => {
    const turn = Result.getOrThrow(
      S.decodeUnknownResult(S.fromJsonString(OpenclawAgentTurn))(
        '{"status":"ok","runId":"run-1753","stopReason":"stop","aborted":false,"text":"PONG",' +
          '"provider":"ollama","model":"gemma3:4b","executionTrace":{"runner":"embedded"}}'
      )
    );

    expect(turn.status).toBe("ok");
    expect(O.getOrThrow(turn.runId)).toBe("run-1753");
    expect(O.getOrThrow(turn.stopReason)).toBe("stop");
    expect(O.getOrThrow(turn.aborted)).toBe(false);
    expect(O.getOrThrow(turn.text)).toBe("PONG");
    expect(O.getOrThrow(turn.provider)).toBe("ollama");
    expect(O.getOrThrow(turn.model)).toBe("gemma3:4b");
  });

  it("decodes sanitized pinned skill-list and Telegram-send shapes", () => {
    const inventory = Result.getOrThrow(
      S.decodeUnknownResult(S.fromJsonString(OpenclawSkillInventory))(
        '{"workspaceDir":"/etc/beep/openclaw/current/workspace","skills":[' +
          '{"name":"beep-proof-ping","description":"Return one fixed synthetic sentinel for the P3 declarative-skill proof.",' +
          '"eligible":true,"source":"openclaw-workspace"}]}'
      )
    );
    const send = Result.getOrThrow(
      S.decodeUnknownResult(S.fromJsonString(OpenclawTelegramSendResult))(
        '{"action":"send","channel":"telegram","dryRun":false,"handledBy":"plugin",' +
          '"messageId":"synthetic-message-id","payload":{"ok":true,"messageId":"synthetic-message-id"}}'
      )
    );

    expect(inventory.skills[0]?.name).toBe("beep-proof-ping");
    expect(inventory.skills[0]?.source).toBe("openclaw-workspace");
    expect(send.messageId).toBe("synthetic-message-id");
    expect(send.payload.ok).toBe(true);
  });

  it("keeps encoded wire shapes byte-identical", () => {
    const health = OpenclawGatewayHealth.make({
      channels: {
        telegram: OpenclawChannelHealth.make({
          connected: O.some(true),
          restartPending: O.some(false),
          running: O.some(true),
          tokenSource: O.some("config"),
          tokenStatus: O.some("available"),
        }),
      },
      ok: true,
      pluginErrorCount: NonNegativeInt.make(0),
      pluginsLoaded: ["telegram", "ollama"],
    });
    const probe = OpenclawHttpProbe.make({
      endpoint: "http://127.0.0.1:19031/health",
      httpStatus: O.some(200),
      status: "healthy",
    });
    const finding = OpenclawSchemaPlaceholderFinding.make({
      reason: "placeholder",
      surface: "channels.telegram",
    });
    const doctor = OpenclawDoctorReport.make({
      exitCode: 1,
      findings: OpenclawDiagnosticText.fromUnknown("Doctor config writes are disabled\n"),
    });
    const validation = OpenclawConfigInvalid.make({
      _tag: "Invalid",
      diagnostics: OpenclawDiagnosticText.fromUnknown("Unknown top-level key: unexpected"),
      exitCode: 1,
    });
    const reloaded = OpenclawSecretsReloaded.make({
      _tag: "Reloaded",
      warningCount: NonNegativeInt.make(0),
    });
    const degraded = OpenclawSecretsReloadDegraded.make({
      _tag: "Degraded",
      diagnostics: OpenclawDiagnosticText.fromUnknown("secrets.reload failed"),
      exitCode: 1,
    });

    expect(Result.getOrThrow(S.encodeResult(OpenclawGatewayHealth)(health))).toEqual({
      channels: {
        telegram: {
          connected: true,
          restartPending: false,
          running: true,
          tokenSource: "config",
          tokenStatus: "available",
        },
      },
      ok: true,
      pluginErrorCount: 0,
      pluginsLoaded: ["telegram", "ollama"],
    });
    expect(Result.getOrThrow(S.encodeResult(OpenclawHttpProbe)(probe))).toEqual({
      endpoint: "http://127.0.0.1:19031/health",
      httpStatus: 200,
      status: "healthy",
    });
    expect(Result.getOrThrow(S.encodeResult(OpenclawSchemaPlaceholderFinding)(finding))).toEqual({
      reason: "placeholder",
      surface: "channels.telegram",
    });
    expect(Result.getOrThrow(S.encodeResult(OpenclawDoctorReport)(doctor))).toEqual({
      exitCode: 1,
      findings: "Doctor config writes are disabled",
    });
    expect(Result.getOrThrow(S.encodeResult(OpenclawConfigValidation)(validation))).toEqual({
      _tag: "Invalid",
      diagnostics: "Unknown top-level key: unexpected",
      exitCode: 1,
    });
    expect(Result.getOrThrow(S.encodeResult(OpenclawSecretsReload)(reloaded))).toEqual({
      _tag: "Reloaded",
      warningCount: 0,
    });
    expect(Result.getOrThrow(S.encodeResult(OpenclawSecretsReload)(degraded))).toEqual({
      _tag: "Degraded",
      diagnostics: "secrets.reload failed",
      exitCode: 1,
    });
  });

  it("caps and trims diagnostic text", () => {
    expect(OpenclawDiagnosticText.fromUnknown(" secrets.reload failed\n")).toBe("secrets.reload failed");

    const capped = OpenclawDiagnosticText.fromUnknown("x".repeat(5_000));
    expect(capped.length).toBe(2_000);

    const trimmedAfterCap = OpenclawDiagnosticText.fromUnknown(`${"a".repeat(1_999)} ${"b".repeat(3_000)}`);
    expect(trimmedAfterCap).toBe("a".repeat(1_999));
  });

  it("derives known systemd active states from raw values", () => {
    const active = OpenclawSystemdUnitState.make({
      activeState: "active",
      controlGroup: O.some("/user.slice/user-1000.slice/user@1000.service/app.slice/openclaw-spike.service"),
      fragmentPath: O.some("/home/user/.config/systemd/user/openclaw-spike.service"),
      mainPid: O.some(4242),
    });
    const unrecognized = OpenclawSystemdUnitState.make({ activeState: "reloading" });

    expect(O.getOrThrow(active.knownActiveState)).toBe("active");
    expect(O.isNone(unrecognized.knownActiveState)).toBe(true);
  });

  it("constructs redacted driver errors with stable messages", () => {
    const spawn = OpenclawCommandSpawnError.make({
      argumentCount: 2,
      cause: "ENOENT",
      executable: "openclaw",
      subcommand: "config validate",
    });
    const exit = OpenclawCommandExitError.make({
      diagnostics: O.some(OpenclawDiagnosticText.fromUnknown("Unknown top-level key: unexpected")),
      executable: "openclaw",
      exitCode: 1,
      stderrLength: 34,
      stdoutLength: 0,
      subcommand: "config validate",
    });
    const timeout = OpenclawCommandTimeoutError.make({
      executable: "systemctl",
      subcommand: "is-active",
      timeoutMs: 30_000,
    });
    const parse = OpenclawOutputParseError.make({
      cause: "invalid JSON",
      executable: "openclaw",
      stdoutLength: 17,
      subcommand: "secrets reload",
    });
    const isCliError = S.is(OpenclawCliError);

    expect(spawn.message).toBe("Failed to spawn openclaw config validate.");
    expect(exit.message).toBe("openclaw config validate exited with code 1.");
    expect(timeout.message).toBe("systemctl is-active timed out after 30000ms.");
    expect(parse.message).toBe("Failed to decode openclaw secrets reload output.");
    expect(isCliError(spawn)).toBe(true);
    expect(isCliError(exit)).toBe(true);
    expect(isCliError(timeout)).toBe(true);
    expect(isCliError(parse)).toBe(true);

    const encodedExit = Result.getOrThrow(S.encodeResult(OpenclawCommandExitError)(exit));
    expect(Object.keys(encodedExit).sort()).toEqual([
      "_tag",
      "diagnostics",
      "executable",
      "exitCode",
      "stderrLength",
      "stdoutLength",
      "subcommand",
    ]);
  });

  it("pins the compatibility set and technical constants", () => {
    expect(OPENCLAW_COMPATIBILITY_SET.openclawVersion).toBe("2026.7.1-2");
    expect(OPENCLAW_COMPATIBILITY_SET.openclawCommit).toBe("0790d9f");
    expect(OPENCLAW_COMPATIBILITY_SET.npmShasum).toBe("4583b987ea7277230ce1c7b2b8535d3e219f57ac");
    expect(OPENCLAW_COMPATIBILITY_SET.npmIntegrity).toBe(
      "sha512-ycF3yPcbjN6bUPeaUx6Mh6vze1hQWoD3CT/wWcmD7a8xaHHHRUaAlaq+lFxMHf1ssEgODVAwjlzYqp2twkYZ7g=="
    );
    expect(OPENCLAW_COMPATIBILITY_SET.nodeVersion).toBe("24.16.0");
    expect(OPENCLAW_COMPATIBILITY_SET.adapterVersion).toBe(1);
    expect(S.is(OpenclawCompatibilitySet)(OPENCLAW_COMPATIBILITY_SET)).toBe(true);

    expect(Duration.toSeconds(OPENCLAW_VALIDATE_TIMEOUT)).toBe(45);
    expect(Duration.toMillis(OPENCLAW_HTTP_PROBE_TIMEOUT)).toBe(2_500);
    expect(OPENCLAW_CONFIG_PATH).toBe("OPENCLAW_CONFIG_PATH");
    expect(OPENCLAW_STATE_DIR).toBe("OPENCLAW_STATE_DIR");
    expect(OPENCLAW_NIX_MODE).toBe("OPENCLAW_NIX_MODE");
    expect(OPENCLAW_GATEWAY_TOKEN).toBe("OPENCLAW_GATEWAY_TOKEN");
  });

  it("builds hermetic environments with extraEnv winning last", () => {
    const fullCtx = OpenclawInvocationContext.make({
      binaryPath: "/opt/openclaw/node_modules/.bin/openclaw",
      configPath: O.some("/etc/beep/openclaw/current/openclaw.json"),
      extraEnv: { OPENCLAW_GATEWAY_TOKEN: "gateway-token-value" },
      home: O.some("/var/lib/beep/openclaw/home"),
      nodeBinDir: O.some("/opt/node/bin"),
      stateDir: O.some("/var/lib/beep/openclaw/state"),
    });
    const minimalCtx = OpenclawInvocationContext.make({
      binaryPath: "openclaw",
      nixMode: false,
    });
    const overrideCtx = OpenclawInvocationContext.make({
      binaryPath: "openclaw",
      extraEnv: { PATH: "/override" },
      nixMode: false,
    });

    expect(hermeticOpenclawEnv(fullCtx)).toEqual({
      HOME: "/var/lib/beep/openclaw/home",
      OPENCLAW_CONFIG_PATH: "/etc/beep/openclaw/current/openclaw.json",
      OPENCLAW_GATEWAY_TOKEN: "gateway-token-value",
      OPENCLAW_NIX_MODE: "1",
      OPENCLAW_STATE_DIR: "/var/lib/beep/openclaw/state",
      PATH: "/opt/node/bin:/usr/bin:/bin",
    });
    expect(hermeticOpenclawEnv(minimalCtx)).toEqual({ PATH: "/usr/bin:/bin" });
    expect(hermeticOpenclawEnv(overrideCtx)).toEqual({ PATH: "/override" });
  });

  it("round-trips schema-derived process and CLI output payloads", () =>
    fc.assert(
      fc.property(
        ExitCodeArbitrary,
        DiagnosticTextArbitrary,
        ProcessRequestArbitrary,
        ProcessResultArbitrary,
        VersionInfoArbitrary,
        SecretsReloadArbitrary,
        ConfigValidationArbitrary,
        (exitCode, diagnosticText, request, result, versionInfo, secretsReload, configValidation) => {
          expect(roundTrip(OpenclawExitCode, exitCode)).toBe(exitCode);
          expect(roundTrip(OpenclawDiagnosticText, diagnosticText)).toBe(diagnosticText);
          expect(sameProcessRequest(roundTrip(OpenclawProcessRequest, request), request)).toBe(true);
          expect(sameProcessResult(roundTrip(OpenclawProcessResult, result), result)).toBe(true);
          expect(sameVersionInfo(roundTrip(OpenclawVersionInfo, versionInfo), versionInfo)).toBe(true);
          expect(sameSecretsReload(roundTrip(OpenclawSecretsReload, secretsReload), secretsReload)).toBe(true);
          expect(sameConfigValidation(roundTrip(OpenclawConfigValidation, configValidation), configValidation)).toBe(
            true
          );
        }
      ),
      fcRuns(50)
    ));

  it("round-trips schema-derived status and probe payloads", () =>
    fc.assert(
      fc.property(
        ChannelAccountStatusArbitrary,
        AgentTurnArbitrary,
        InvocationContextArbitrary,
        SystemdUnitStateArbitrary,
        HttpProbeArbitrary,
        PlaceholderFindingArbitrary,
        GatewayHealthArbitrary,
        CompatibilitySetArbitrary,
        (accountStatus, agentTurn, invocationContext, unitState, httpProbe, finding, gatewayHealth, compatibility) => {
          expect(sameChannelAccountStatus(roundTrip(OpenclawChannelAccountStatus, accountStatus), accountStatus)).toBe(
            true
          );
          expect(sameAgentTurn(roundTrip(OpenclawAgentTurn, agentTurn), agentTurn)).toBe(true);
          expect(
            sameInvocationContext(roundTrip(OpenclawInvocationContext, invocationContext), invocationContext)
          ).toBe(true);
          expect(sameSystemdUnitState(roundTrip(OpenclawSystemdUnitState, unitState), unitState)).toBe(true);
          expect(sameHttpProbe(roundTrip(OpenclawHttpProbe, httpProbe), httpProbe)).toBe(true);
          expect(samePlaceholderFinding(roundTrip(OpenclawSchemaPlaceholderFinding, finding), finding)).toBe(true);
          expect(sameGatewayHealth(roundTrip(OpenclawGatewayHealth, gatewayHealth), gatewayHealth)).toBe(true);
          expect(sameCompatibilitySet(roundTrip(OpenclawCompatibilitySet, compatibility), compatibility)).toBe(true);
        }
      ),
      fcRuns(50)
    ));
});
