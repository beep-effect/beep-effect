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
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { OpenclawProcessRequest } from "@beep/openclaw/Openclaw.models";
import type { OpenclawCliRunner } from "@beep/openclaw/OpenclawCli.service";

const binaryPath = "/opt/openclaw/node_modules/.bin/openclaw";
const gatewayUrl = "ws://127.0.0.1:19031";
const gatewayTokenValue = "gateway-token-value";

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

const successStdout: Record<string, string> = {
  "--version": versionLine,
  "agent --agent": agentTurnJson,
  "channels status": channelsStatusJson,
  "config schema": schemaExportJson,
  "config validate": "Configuration is valid.\n",
  "doctor --non-interactive": "All checks passed.\n",
  "gateway call": gatewayHealthJson,
  "secrets reload": reloadSuccessJson,
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

describe("@beep/openclaw OpenclawCli service", () => {
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
          sessionKey: "p0-spike3",
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
          "--session-key",
          "p0-spike3",
          "--message",
          "ping",
          "--thinking",
          "off",
          "--timeout",
          "120",
          "--json",
        ]);

        yield* cli.agentTurn(gatewayContext, {
          agentId: "spike3",
          local: true,
          message: "ping",
          sessionKey: "p0-spike3",
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
