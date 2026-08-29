import { OpenclawCommandExitError, OpenclawOutputParseError } from "@beep/openclaw/Openclaw.errors";
import { OpenclawProcessResult } from "@beep/openclaw/Openclaw.models";
import { OpenclawSystemd } from "@beep/openclaw/OpenclawSystemd.service";
import { describe, expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { OpenclawProcessRequest } from "@beep/openclaw/Openclaw.models";
import type { OpenclawCliRunner } from "@beep/openclaw/OpenclawCli.service";

const unitName = "openclaw-spike.service";
const showStdout =
  "ActiveState=active\n" +
  "MainPID=4242\n" +
  "FragmentPath=/home/user/.config/systemd/user/openclaw-spike.service\n" +
  "ControlGroup=/user.slice/user-1000.slice/user@1000.service/app.slice/openclaw-spike.service\n";
const quiescentShowStdout = "ActiveState=inactive\nMainPID=0\nFragmentPath=\nControlGroup=\n";

const verbStdout: Record<string, { readonly exitCode: number; readonly stdout: string }> = {
  "is-active": { exitCode: 3, stdout: "inactive\n" },
  show: { exitCode: 0, stdout: showStdout },
};

const calls: Array<OpenclawProcessRequest> = [];
const recordingRunner: OpenclawCliRunner = (request) =>
  Effect.sync(() => {
    calls.push(request);
    const output = O.getOrElse(
      O.flatMap(A.get(request.args, 1), (verb) => R.get(verbStdout, verb)),
      () => ({ exitCode: 0, stdout: "" })
    );
    return OpenclawProcessResult.make({ exitCode: output.exitCode, stderr: "", stdout: output.stdout });
  });
const lastRequest = (): OpenclawProcessRequest => O.getOrThrow(A.last(calls));

const quiescentRunner: OpenclawCliRunner = () =>
  Effect.succeed(OpenclawProcessResult.make({ exitCode: 0, stderr: "", stdout: quiescentShowStdout }));

const missingActiveStateRunner: OpenclawCliRunner = () =>
  Effect.succeed(OpenclawProcessResult.make({ exitCode: 0, stderr: "", stdout: "MainPID=4242\n" }));

const failingVerbRunner: OpenclawCliRunner = () =>
  Effect.succeed(
    OpenclawProcessResult.make({ exitCode: 1, stderr: "Failed to start openclaw-spike.service\n", stdout: "" })
  );

describe("@beep/openclaw OpenclawSystemd service", () => {
  layer(OpenclawSystemd.makeLayerFromRunner(recordingRunner))((it) => {
    it.effect(
      "always prefixes --user and passes minimal env on lifecycle verbs",
      Effect.fnUntraced(function* () {
        const systemd = yield* OpenclawSystemd;

        yield* systemd.daemonReload;
        expect(lastRequest().args).toEqual(["--user", "daemon-reload"]);
        expect(lastRequest().executable).toBe("systemctl");
        expect(lastRequest().env).toEqual({});
        expect(lastRequest().stdin).toBe("ignore");
        expect(O.getOrThrow(lastRequest().timeoutMs)).toBe(30_000);

        yield* systemd.enable(unitName);
        expect(lastRequest().args).toEqual(["--user", "enable", unitName]);

        yield* systemd.disable(unitName);
        expect(lastRequest().args).toEqual(["--user", "disable", unitName]);

        yield* systemd.start(unitName);
        expect(lastRequest().args).toEqual(["--user", "start", unitName]);

        yield* systemd.stop(unitName);
        expect(lastRequest().args).toEqual(["--user", "stop", unitName]);

        yield* systemd.restart(unitName);
        expect(lastRequest().args).toEqual(["--user", "restart", unitName]);

        yield* systemd.resetFailed(unitName);
        expect(lastRequest().args).toEqual(["--user", "reset-failed", unitName]);
      })
    );

    it.effect(
      "models is-active nonzero exits as state results, not errors",
      Effect.fnUntraced(function* () {
        const systemd = yield* OpenclawSystemd;
        const state = yield* systemd.isActive(unitName);

        expect(state).toBe("inactive");
        expect(lastRequest().args).toEqual(["--user", "is-active", unitName]);
      })
    );

    it.effect(
      "parses Key=Value lines from systemctl show output",
      Effect.fnUntraced(function* () {
        const systemd = yield* OpenclawSystemd;
        const unitState = yield* systemd.show(unitName);

        expect(unitState.activeState).toBe("active");
        expect(O.getOrThrow(unitState.knownActiveState)).toBe("active");
        expect(O.getOrThrow(unitState.mainPid)).toBe(4242);
        expect(O.getOrThrow(unitState.fragmentPath)).toBe("/home/user/.config/systemd/user/openclaw-spike.service");
        expect(O.getOrThrow(unitState.controlGroup)).toBe(
          "/user.slice/user-1000.slice/user@1000.service/app.slice/openclaw-spike.service"
        );

        expect(lastRequest().args).toEqual([
          "--user",
          "show",
          unitName,
          "-p",
          "MainPID",
          "-p",
          "ActiveState",
          "-p",
          "FragmentPath",
          "-p",
          "ControlGroup",
        ]);
      })
    );
  });

  layer(OpenclawSystemd.makeLayerFromRunner(quiescentRunner))((it) => {
    it.effect(
      "treats MainPID=0 and blank paths as absent unit facts",
      Effect.fnUntraced(function* () {
        const systemd = yield* OpenclawSystemd;
        const unitState = yield* systemd.show(unitName);

        expect(unitState.activeState).toBe("inactive");
        expect(O.getOrThrow(unitState.knownActiveState)).toBe("inactive");
        expect(O.isNone(unitState.mainPid)).toBe(true);
        expect(O.isNone(unitState.fragmentPath)).toBe(true);
        expect(O.isNone(unitState.controlGroup)).toBe(true);
      })
    );
  });

  layer(OpenclawSystemd.makeLayerFromRunner(missingActiveStateRunner))((it) => {
    it.effect(
      "fails show with a parse error when ActiveState is missing",
      Effect.fnUntraced(function* () {
        const systemd = yield* OpenclawSystemd;
        const error = yield* systemd.show(unitName).pipe(Effect.flip);

        expect(error).toBeInstanceOf(OpenclawOutputParseError);
        if (S.is(OpenclawOutputParseError)(error)) {
          expect(error.executable).toBe("systemctl");
          expect(error.subcommand).toBe("show");
        }
      })
    );
  });

  layer(OpenclawSystemd.makeLayerFromRunner(failingVerbRunner))((it) => {
    it.effect(
      "fails lifecycle verbs with redacted exit errors on nonzero exits",
      Effect.fnUntraced(function* () {
        const systemd = yield* OpenclawSystemd;
        const error = yield* systemd.start(unitName).pipe(Effect.flip);

        expect(error).toBeInstanceOf(OpenclawCommandExitError);
        if (S.is(OpenclawCommandExitError)(error)) {
          expect(error.executable).toBe("systemctl");
          expect(error.subcommand).toBe("start");
          expect(error.exitCode).toBe(1);
          expect(O.isNone(error.diagnostics)).toBe(true);
          expect(error.stderrLength).toBe("Failed to start openclaw-spike.service\n".length);
        }
      })
    );
  });
});
