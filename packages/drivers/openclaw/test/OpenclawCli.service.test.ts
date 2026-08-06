import { OPENCLAW_GATEWAY_TOKEN } from "@beep/openclaw/Openclaw.config";
import {
  OpenclawCommandExitError,
  OpenclawCommandSpawnError,
  OpenclawOutputParseError,
} from "@beep/openclaw/Openclaw.errors";
import {
  OpenclawConfigValidation,
  OpenclawInvocationContext,
  OpenclawProcessResult,
  OpenclawSecretsReload,
} from "@beep/openclaw/Openclaw.models";
import { OpenclawCli } from "@beep/openclaw/OpenclawCli.service";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Duration, Effect, Layer, Result, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { OpenclawProcessRequest } from "@beep/openclaw/Openclaw.models";
import type { OpenclawCliRunner } from "@beep/openclaw/OpenclawCli.service";

const binaryPath = "/opt/openclaw/node_modules/.bin/openclaw";
const gatewayUrl = "ws://127.0.0.1:19031";
const gatewayTokenValue = "gateway-token-value";
const encoder = new TextEncoder();

const baseContext = OpenclawInvocationContext.make({
  binaryPath,
  configPath: O.some("/etc/beep/openclaw/current/openclaw.json"),
  home: O.some("/var/lib/beep/openclaw/home"),
  nodeBinDir: O.some("/opt/node/bin"),
  stateDir: O.some("/var/lib/beep/openclaw/state"),
});
const gatewayContext = OpenclawInvocationContext.make({
  binaryPath,
  configPath: O.some("/etc/beep/openclaw/current/openclaw.json"),
  extraEnv: { [OPENCLAW_GATEWAY_TOKEN]: gatewayTokenValue },
  gatewayUrl: O.some(gatewayUrl),
  home: O.some("/var/lib/beep/openclaw/home"),
  nodeBinDir: O.some("/opt/node/bin"),
  stateDir: O.some("/var/lib/beep/openclaw/state"),
});
const expectedHermeticEnv = {
  HOME: "/var/lib/beep/openclaw/home",
  OPENCLAW_CONFIG_PATH: "/etc/beep/openclaw/current/openclaw.json",
  OPENCLAW_NIX_MODE: "1",
  OPENCLAW_STATE_DIR: "/var/lib/beep/openclaw/state",
  PATH: "/opt/node/bin:/usr/bin:/bin",
};

const versionLine = "OpenClaw 2026.7.1-2 (0790d9f)\n";
const reloadSuccessJson = '{ "ok": true, "warningCount": 0 }';
const schemaExportJson = '{"type":"object","properties":{"gateway":{"type":"object"}},"additionalProperties":false}';
const gatewayHealthJson =
  '{"ok":true,"ts":1753600000000,"durationMs":12,' +
  '"plugins":{"loaded":["telegram","ollama"],"errors":[]},' +
  '"configReload":{"hotReloadStatus":"active"},' +
  '"channels":{"telegram":{"running":true,"connected":true,"restartPending":false,' +
  '"tokenSource":"config","tokenStatus":"available"}},' +
  '"channelOrder":["telegram"],"defaultAgentId":"spike3"}';
const channelsStatusJson =
  '{"channels":{"telegram":{"enabled":true}},"channelAccounts":{"telegram":[' +
  '{"accountId":"default","enabled":true,"configured":true,"running":true,"lastStartAt":1753600000000,' +
  '"lastStopAt":null,"lastError":null,"connected":true,"restartPending":false,"reconnectAttempts":0,' +
  '"tokenSource":"config","tokenStatus":"available","mode":"polling","probe":{"ok":true}}]}}';
const agentTurnJson =
  '{"status":"ok","runId":"run-1753","result":{"meta":{"stopReason":"stop","aborted":false,' +
  '"agentMeta":{"provider":"ollama","model":"gemma3:4b"}},"payloads":[{"text":"PONG"}]},' +
  '"executionTrace":{"runner":"embedded"}}';
const skillsListJson =
  '{"workspaceDir":"/etc/beep/openclaw/current/workspace","skills":[' +
  '{"name":"beep-proof-ping","description":"Return one fixed synthetic sentinel for the P3 declarative-skill proof.",' +
  '"eligible":true,"source":"openclaw-workspace"}]}';
const messageSendJson =
  '{"action":"send","channel":"telegram","dryRun":false,"handledBy":"plugin",' +
  '"messageId":"synthetic-message-id","payload":{"ok":true,"messageId":"synthetic-message-id"}}';

const successStdout: Record<string, string> = {
  "--version": versionLine,
  "agent --agent": agentTurnJson,
  "channels status": channelsStatusJson,
  "config schema": schemaExportJson,
  "config validate": "Configuration is valid.\n",
  "doctor --non-interactive": "All checks passed.\n",
  "gateway call": gatewayHealthJson,
  "message send": messageSendJson,
  "secrets reload": reloadSuccessJson,
  "skills list": skillsListJson,
};

const commandKey = (request: OpenclawProcessRequest): string => A.join(A.take(request.args, 2), " ");

const successCalls: Array<OpenclawProcessRequest> = [];
const successRunner: OpenclawCliRunner = (request) =>
  Effect.sync(() => {
    successCalls.push(request);
    return OpenclawProcessResult.make({
      exitCode: 0,
      stderr: "",
      stdout: O.getOrElse(R.get(successStdout, commandKey(request)), () => ""),
    });
  });
const lastSuccessRequest = (): OpenclawProcessRequest => O.getOrThrow(A.last(successCalls));

const failureOutputs: Record<string, { readonly stderr: string; readonly stdout: string }> = {
  "--version": { stderr: "node: command failed\n", stdout: "" },
  "config validate": { stderr: "Unknown top-level key: unexpected\n", stdout: "" },
  "doctor --non-interactive": {
    stderr: "",
    stdout: "Doctor config writes are disabled because OpenClaw is running in Nix mode.\n",
  },
  "gateway call": { stderr: "unauthorized: invalid token\n", stdout: "" },
  "secrets reload": { stderr: "Gateway did not respond\n", stdout: "secrets.reload failed\n" },
};

const failureRunner: OpenclawCliRunner = (request) =>
  Effect.sync(() => {
    const output = O.getOrElse(R.get(failureOutputs, commandKey(request)), () => ({ stderr: "failed\n", stdout: "" }));
    return OpenclawProcessResult.make({ exitCode: 1, stderr: output.stderr, stdout: output.stdout });
  });

const garbageRunner: OpenclawCliRunner = () =>
  Effect.succeed(OpenclawProcessResult.make({ exitCode: 0, stderr: "", stdout: "not-json" }));

const spawnFailureRunner: OpenclawCliRunner = (request) =>
  Effect.fail(
    OpenclawCommandSpawnError.make({
      argumentCount: A.length(request.args),
      cause: "ENOENT",
      executable: request.executable,
      subcommand: "--version",
    })
  );

const liveSpawnerLayer = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) {
      return Effect.die("Expected a standard OpenClaw command");
    }

    expect(command.command).toBe(binaryPath);
    expect(command.args).toEqual(["--version"]);
    expect(command.options.extendEnv).toBe(false);
    expect(command.options.stdin).toBe("ignore");
    expect(command.options.stdout).toBe("pipe");
    expect(command.options.stderr).toBe("pipe");
    const forceKillAfter = command.options.forceKillAfter;
    expect(forceKillAfter).toBeDefined();
    if (forceKillAfter !== undefined) {
      expect(Duration.toMillis(forceKillAfter)).toBe(2_000);
    }

    return Effect.succeed(
      ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(1),
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        unref: Effect.succeed(Effect.void),
        stdin: Sink.drain,
        stdout: Stream.make(encoder.encode(versionLine)),
        stderr: Stream.empty,
        all: Stream.empty,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
      })
    );
  })
);

const stdinPayloads: Array<string> = [];
const stdinSpawnerLayer = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) {
      return Effect.die("Expected a standard OpenClaw command");
    }

    expect(command.options.stdin).toBe("pipe");
    return Effect.succeed(
      ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(2),
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        unref: Effect.succeed(Effect.void),
        stdin: Sink.forEach((bytes: Uint8Array) =>
          Effect.sync(() => {
            stdinPayloads.push(new TextDecoder().decode(bytes));
          })
        ),
        stdout: Stream.make(encoder.encode(agentTurnJson)),
        stderr: Stream.empty,
        all: Stream.empty,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
      })
    );
  })
);

describe("@beep/openclaw OpenclawCli service", () => {
  layer(OpenclawCli.makeLayer().pipe(Layer.provide(liveSpawnerLayer)))((it) => {
    it.effect(
      "configures live child-process ownership and timeout escalation",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const info = yield* cli.version(baseContext);

        expect(info.version).toBe("2026.7.1-2");
      })
    );
  });

  layer(OpenclawCli.makeLayer().pipe(Layer.provide(stdinSpawnerLayer)))((it) => {
    it.effect(
      "pipes private agent messages through stdin",
      Effect.fnUntraced(function* () {
        stdinPayloads.length = 0;
        const cli = yield* OpenclawCli;

        yield* cli.agentTurn(gatewayContext, {
          agentId: "spike3",
          message: "private prompt",
          timeoutSeconds: 120,
        });

        expect(stdinPayloads).toEqual(["private prompt"]);
      })
    );
  });

  layer(OpenclawCli.makeLayerFromRunner(successRunner))((it) => {
    it.effect(
      "runs --version hermetically and parses the pinned version line",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const info = yield* cli.version(baseContext);

        expect(info.version).toBe("2026.7.1-2");
        expect(O.getOrThrow(info.commit)).toBe("0790d9f");
        expect(info.raw).toBe("OpenClaw 2026.7.1-2 (0790d9f)");

        const request = lastSuccessRequest();
        expect(request.executable).toBe(binaryPath);
        expect(request.args).toEqual(["--version"]);
        expect(request.env).toEqual(expectedHermeticEnv);
        expect(request.stdin).toBe("ignore");
        expect(O.getOrThrow(request.timeoutMs)).toBe(10_000);
      })
    );

    it.effect(
      "lists eligible skills with the pinned argv and decoded workspace source",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const inventory = yield* cli.skillsList(baseContext, { agentId: "workstation", eligible: true });

        expect(inventory.skills).toHaveLength(1);
        expect(inventory.skills[0]?.source).toBe("openclaw-workspace");
        expect(lastSuccessRequest().args).toEqual(["skills", "list", "--json", "--eligible", "--agent", "workstation"]);
      })
    );

    it.effect(
      "sends a synthetic Telegram message with the pinned argv and returns a receipt",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const result = yield* cli.messageSend(gatewayContext, {
          message: "P3 synthetic nonce",
          target: "redacted-target",
        });

        expect(result.messageId).toBe("synthetic-message-id");
        expect(lastSuccessRequest().args).toEqual([
          "message",
          "send",
          "--channel",
          "telegram",
          "--target",
          "redacted-target",
          "--message",
          "P3 synthetic nonce",
          "--json",
        ]);
      })
    );

    it.effect(
      "validates config with the exact argv and reports Valid",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const validation = yield* cli.configValidate(baseContext);

        expect(Result.getOrThrow(S.encodeResult(OpenclawConfigValidation)(validation))).toEqual({
          _tag: "Valid",
          output: "Configuration is valid.",
        });

        const request = lastSuccessRequest();
        expect(request.args).toEqual(["config", "validate"]);
        expect(request.env).toEqual(expectedHermeticEnv);
        expect(O.getOrThrow(request.timeoutMs)).toBe(45_000);
      })
    );

    it.effect(
      "exports the config schema as a decoded JSON document",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const schemaDocument = yield* cli.configSchema(baseContext);

        expect(schemaDocument).toEqual({
          additionalProperties: false,
          properties: { gateway: { type: "object" } },
          type: "object",
        });
        expect(lastSuccessRequest().args).toEqual(["config", "schema"]);
      })
    );

    it.effect(
      "runs doctor read-only and never passes --fix",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const report = yield* cli.doctor(baseContext);

        expect(report.exitCode).toBe(0);
        expect(report.findings).toBe("All checks passed.");

        const request = lastSuccessRequest();
        expect(request.args).toEqual(["doctor", "--non-interactive"]);
        expect(A.contains(request.args, "--fix")).toBe(false);
      })
    );

    it.effect(
      "reloads secrets with the token in env and never in argv",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const reload = yield* cli.secretsReload(gatewayContext, { timeoutMs: 15_000 });

        expect(Result.getOrThrow(S.encodeResult(OpenclawSecretsReload)(reload))).toEqual({
          _tag: "Reloaded",
          warningCount: 0,
        });

        const request = lastSuccessRequest();
        expect(request.args).toEqual(["secrets", "reload", "--json", "--timeout", "15000", "--url", gatewayUrl]);
        expect(request.env).toEqual({ ...expectedHermeticEnv, [OPENCLAW_GATEWAY_TOKEN]: gatewayTokenValue });
        expect(A.contains(request.args, "--token")).toBe(false);
        expect(A.contains(request.args, gatewayTokenValue)).toBe(false);
        expect(O.getOrThrow(request.timeoutMs)).toBe(30_000);
      })
    );

    it.effect(
      "calls gateway health with --url and projects the health document",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const health = yield* cli.gatewayHealth(gatewayContext, { timeoutMs: 5_000 });

        expect(health.ok).toBe(true);
        expect(health.pluginsLoaded).toEqual(["telegram", "ollama"]);
        expect(health.pluginErrorCount).toBe(0);
        const telegram = O.getOrThrow(R.get(health.channels, "telegram"));
        expect(O.getOrThrow(telegram.running)).toBe(true);
        expect(O.getOrThrow(telegram.connected)).toBe(true);
        expect(O.getOrThrow(telegram.tokenStatus)).toBe("available");

        const request = lastSuccessRequest();
        expect(request.args).toEqual(["gateway", "call", "health", "--json", "--url", gatewayUrl, "--timeout", "5000"]);
        expect(request.env).toEqual({ ...expectedHermeticEnv, [OPENCLAW_GATEWAY_TOKEN]: gatewayTokenValue });
        expect(A.contains(request.args, "--token")).toBe(false);
      })
    );

    it.effect(
      "lists channel account statuses with the nested probe projected",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const accounts = yield* cli.channelsStatus(gatewayContext, {
          channel: "telegram",
          probe: true,
          timeoutMs: 15_000,
        });

        expect(A.length(accounts)).toBe(1);
        const account = O.getOrThrow(A.head(accounts));
        expect(account.accountId).toBe("default");
        expect(account.enabled).toBe(true);
        expect(account.configured).toBe(true);
        expect(account.running).toBe(true);
        expect(O.getOrThrow(account.connected)).toBe(true);
        expect(O.getOrThrow(account.probeOk)).toBe(true);
        expect(O.isNone(account.probeError)).toBe(true);
        expect(O.getOrThrow(account.tokenSource)).toBe("config");

        expect(lastSuccessRequest().args).toEqual([
          "channels",
          "status",
          "--channel",
          "telegram",
          "--probe",
          "--timeout",
          "15000",
          "--json",
        ]);
      })
    );

    it.effect(
      "runs a gateway agent turn and projects the nested result",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const turn = yield* cli.agentTurn(gatewayContext, {
          agentId: "spike3",
          message: "ping",
          timeoutSeconds: 120,
        });

        expect(turn.status).toBe("ok");
        expect(O.getOrThrow(turn.runId)).toBe("run-1753");
        expect(O.getOrThrow(turn.stopReason)).toBe("stop");
        expect(O.getOrThrow(turn.aborted)).toBe(false);
        expect(O.getOrThrow(turn.text)).toBe("PONG");
        expect(O.getOrThrow(turn.provider)).toBe("ollama");
        expect(O.getOrThrow(turn.model)).toBe("gemma3:4b");

        expect(lastSuccessRequest().args).toEqual([
          "agent",
          "--agent",
          "spike3",
          "--message-file",
          "-",
          "--thinking",
          "off",
          "--timeout",
          "120",
          "--json",
        ]);
        expect(O.getOrThrow(lastSuccessRequest().stdinText)).toBe("ping");
        expect(A.contains(lastSuccessRequest().args, "ping")).toBe(false);

        yield* cli.agentTurn(gatewayContext, {
          agentId: "spike3",
          local: true,
          message: "ping",
          timeoutSeconds: 120,
        });
        expect(A.contains(lastSuccessRequest().args, "--local")).toBe(true);
      })
    );
  });

  layer(OpenclawCli.makeLayerFromRunner(failureRunner))((it) => {
    it.effect(
      "models nonzero config validate exits as Invalid results",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const validation = yield* cli.configValidate(baseContext);

        expect(Result.getOrThrow(S.encodeResult(OpenclawConfigValidation)(validation))).toEqual({
          _tag: "Invalid",
          diagnostics: "Unknown top-level key: unexpected",
          exitCode: 1,
        });
      })
    );

    it.effect(
      "models nonzero secrets reload exits as Degraded results",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const reload = yield* cli.secretsReload(gatewayContext);

        expect(Result.getOrThrow(S.encodeResult(OpenclawSecretsReload)(reload))).toEqual({
          _tag: "Degraded",
          diagnostics: "secrets.reload failed",
          exitCode: 1,
        });
      })
    );

    it.effect(
      "models nonzero doctor exits as reports, not errors",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const report = yield* cli.doctor(baseContext);

        expect(report.exitCode).toBe(1);
        expect(report.findings).toBe("Doctor config writes are disabled because OpenClaw is running in Nix mode.");
      })
    );

    it.effect(
      "fails version with a redacted exit error carrying diagnostics",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const error = yield* cli.version(baseContext).pipe(Effect.flip);

        expect(error).toBeInstanceOf(OpenclawCommandExitError);
        if (S.is(OpenclawCommandExitError)(error)) {
          expect(error.exitCode).toBe(1);
          expect(error.stdoutLength).toBe(0);
          expect(error.stderrLength).toBe("node: command failed\n".length);
          expect(O.getOrThrow(error.diagnostics)).toBe("node: command failed");
        }
      })
    );

    it.effect(
      "fails gateway health with lengths only, never diagnostics",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const error = yield* cli.gatewayHealth(gatewayContext).pipe(Effect.flip);

        expect(error).toBeInstanceOf(OpenclawCommandExitError);
        if (S.is(OpenclawCommandExitError)(error)) {
          expect(error.exitCode).toBe(1);
          expect(O.isNone(error.diagnostics)).toBe(true);
          expect(error.stderrLength).toBe("unauthorized: invalid token\n".length);
        }
      })
    );
  });

  layer(OpenclawCli.makeLayerFromRunner(garbageRunner))((it) => {
    it.effect(
      "fails undecodable stdout with redacted parse errors",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;

        const reloadError = yield* cli.secretsReload(gatewayContext).pipe(Effect.flip);
        expect(reloadError).toBeInstanceOf(OpenclawOutputParseError);
        if (S.is(OpenclawOutputParseError)(reloadError)) {
          expect(reloadError.subcommand).toBe("secrets reload");
          expect(reloadError.stdoutLength).toBe("not-json".length);
        }

        const versionError = yield* cli.version(baseContext).pipe(Effect.flip);
        expect(versionError).toBeInstanceOf(OpenclawOutputParseError);

        const healthError = yield* cli.gatewayHealth(gatewayContext).pipe(Effect.flip);
        expect(healthError).toBeInstanceOf(OpenclawOutputParseError);
      })
    );
  });

  layer(OpenclawCli.makeLayerFromRunner(spawnFailureRunner))((it) => {
    it.effect(
      "propagates typed spawn failures from the runner",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const error = yield* cli.version(baseContext).pipe(Effect.flip);

        expect(error).toBeInstanceOf(OpenclawCommandSpawnError);
        if (S.is(OpenclawCommandSpawnError)(error)) {
          expect(error.executable).toBe(binaryPath);
          expect(error.subcommand).toBe("--version");
        }
      })
    );
  });

  it("round-trips the schema-derived CLI result unions asserted above", () => {
    const validationEquivalence = S.toEquivalence(OpenclawConfigValidation);
    const reloadEquivalence = S.toEquivalence(OpenclawSecretsReload);
    fc.assert(
      fc.property(
        S.toArbitrary(OpenclawConfigValidation),
        S.toArbitrary(OpenclawSecretsReload),
        (validation, reload) => {
          const validationWire = Result.getOrThrow(S.encodeResult(OpenclawConfigValidation)(validation));
          const reloadWire = Result.getOrThrow(S.encodeResult(OpenclawSecretsReload)(reload));
          expect(
            validationEquivalence(
              Result.getOrThrow(S.decodeUnknownResult(OpenclawConfigValidation)(validationWire)),
              validation
            )
          ).toBe(true);
          expect(
            reloadEquivalence(Result.getOrThrow(S.decodeUnknownResult(OpenclawSecretsReload)(reloadWire)), reload)
          ).toBe(true);
        }
      ),
      fcRuns(50)
    );
  });
});
