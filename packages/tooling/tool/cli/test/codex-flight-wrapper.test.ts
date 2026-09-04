import { hashPublicTextSha256 } from "@beep/repo-ai-metrics";
import { runCodexExec } from "@beep/repo-cli/commands/Codex";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Path, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const encodeJson = UnknownFromJsonString.encodeUnknownSync;

const stubHandle = (exitCode: number) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

layer(NodeServices.layer)("codex flight wrapper", (it) => {
  it.effect("emits exact hook correlation and persists no prompt or user-facing response", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const stateRoot = yield* fs.makeTempDirectoryScoped({ prefix: "beep-codex-flight-wrapper-" });
        const evidenceRoot = path.join(stateRoot, "agent-evidence");
        const spawned = yield* Ref.make(A.empty<ChildProcess.StandardCommand>());
        let outputPath = "";
        let schemaText = "";
        const spawner = ChildProcessSpawner.make((command) => {
          if (!ChildProcess.isStandardCommand(command)) {
            return Effect.die("The Codex wrapper must never spawn a pipeline.");
          }
          return Effect.gen(function* () {
            yield* Ref.update(spawned, A.append(command));
            const outputFlagIndex = O.getOrThrow(
              A.findFirstIndex(command.args, (argument) => argument === "--output-last-message")
            );
            const schemaFlagIndex = O.getOrThrow(
              A.findFirstIndex(command.args, (argument) => argument === "--output-schema")
            );
            outputPath = O.getOrThrow(O.fromUndefinedOr(command.args[outputFlagIndex + 1]));
            const schemaPath = O.getOrThrow(O.fromUndefinedOr(command.args[schemaFlagIndex + 1]));
            schemaText = yield* fs.readFileString(schemaPath);
            yield* fs.writeFileString(
              outputPath,
              encodeJson({
                message: "user-facing response canary",
                lifecycleState: "terminal",
                activePhase: "verification",
                selfReportedTerminalOutcome: "completed",
              })
            );
            return stubHandle(0);
          });
        });
        const prompt = "inspect checkout prompt canary";
        const configProvider = ConfigProvider.fromEnv({
          env: {
            BEEP_AGENT_EVIDENCE_ROOT: evidenceRoot,
            HOME: stateRoot,
            XDG_STATE_HOME: stateRoot,
          },
        });

        const receipt = yield* runCodexExec([prompt]).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
          Effect.provideService(ConfigProvider.ConfigProvider, configProvider),
          Effect.provide(TestConsole.layer)
        );
        const [command] = yield* Ref.get(spawned);
        const persisted = yield* fs.readFileString(path.join(evidenceRoot, receipt.relativePath));
        const expectedObjectiveRef = yield* hashPublicTextSha256(prompt);

        expect(command?.command).toBe("codex");
        expect(command?.args[0]).toBe("exec");
        expect(command?.options.stdout).toBe("ignore");
        expect(command?.options.stderr).toBe("inherit");
        expect(command?.options.env?.BEEP_FLIGHT_INVOCATION_ID).toBe(receipt.invocationId);
        expect(command?.options.env?.BEEP_FLIGHT_OBJECTIVE_REF).toBe(expectedObjectiveRef);
        expect(schemaText).toContain('"message"');
        expect(schemaText).toContain('"selfReportedTerminalOutcome"');
        expect(schemaText).not.toContain(prompt);
        expect(persisted).not.toContain(prompt);
        expect(persisted).not.toContain("user-facing response canary");
        expect(yield* fs.exists(path.dirname(outputPath))).toBe(false);
      })
    )
  );

  it.effect("refuses an empty prompt before spawning Codex", () =>
    Effect.gen(function* () {
      const error = yield* runCodexExec([]).pipe(Effect.flip);

      expect(error._tag).toBe("CodexCommandError");
      expect(error.message).toContain("non-empty prompt");
    })
  );
});
