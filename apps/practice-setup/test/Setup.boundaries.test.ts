import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { it } from "@beep/test-runner";
import * as BunPath from "@effect/platform-bun/BunPath";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { GatewayBundle, SetupHost } from "@/Setup.services";

const handle = (stdout: string, exitCode: number) =>
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
    stdout: Stream.succeed(new TextEncoder().encode(stdout)),
    unref: Effect.succeed(Effect.void),
  });

const platform = Layer.mergeAll(
  MemoryFileSystem.layer,
  BunPath.layer,
  ConfigProvider.layer(ConfigProvider.fromUnknown({ LOCALAPPDATA: "/local" }))
);

it.layer(platform, { concurrent: false, timeout: "5 seconds" })(
  "Windows setup boundaries without native execution",
  (it) => {
    const exercise = <E>(
      name: string,
      options: {
        readonly executable?: boolean;
        readonly registry?: boolean;
        readonly msix?: boolean;
        readonly shellExit?: number;
      },
      use: (
        host: SetupHost["Service"],
        calls: ReadonlyArray<ChildProcess.StandardCommand>
      ) => Effect.Effect<void, E, FileSystem.FileSystem>
    ) => {
      const calls: Array<ChildProcess.StandardCommand> = [];
      const spawner = ChildProcessSpawner.ChildProcessSpawner.of(
        ChildProcessSpawner.make((command) => {
          if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected piped command");
          calls.push(command);
          if (command.command === "reg.exe") return Effect.succeed(handle("", options.registry === true ? 0 : 1));
          if (
            A.contains(command.args, "Get-AppxPackage -Name Claude | Select-Object -ExpandProperty PackageFamilyName")
          ) {
            return Effect.succeed(handle(options.msix === true ? "Claude_pzs8sxrjxfjjc\r\n" : "OtherPackage\r\n", 0));
          }
          return Effect.succeed(handle("", options.shellExit ?? 0));
        })
      );
      const host = SetupHost.layer.pipe(Layer.provide(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)));
      it.layer(host, { timeout: "5 seconds" })(name, (it) => {
        it.effect(name, () =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* fs.remove("/local", { recursive: true, force: true });
            if (options.executable === true) {
              yield* fs.makeDirectory("/local/AnthropicClaude", { recursive: true });
              yield* fs.writeFileString("/local/AnthropicClaude/claude.exe", "fixture executable");
            }
            const SetupHost1 = yield* SetupHost;
            yield* use(SetupHost1, calls);
          })
        );
      });
    };

    exercise(
      "detects a per-user executable without querying registry or MSIX",
      { executable: true },
      Effect.fnUntraced(function* (host, calls) {
        const claudeInstall2 = yield* host.claudeInstall;
        expect(claudeInstall2).toBe("per-user");
        expect(calls).toEqual([]);
      })
    );
    exercise(
      "accepts registry detection before querying MSIX",
      { registry: true },
      Effect.fnUntraced(function* (host, calls) {
        const claudeInstall3 = yield* host.claudeInstall;
        expect(claudeInstall3).toBe("per-user");
        expect(A.map(calls, (call) => call.command)).toEqual(["reg.exe"]);
      })
    );
    for (const msix of [true, false]) {
      exercise(
        `distinguishes MSIX=${msix} from a missing install`,
        { msix },
        Effect.fnUntraced(function* (host, calls) {
          const claudeInstall4 = yield* host.claudeInstall;
          expect(claudeInstall4).toBe(msix ? "msix" : "missing");
          expect(A.map(calls, (call) => call.command)).toEqual(["reg.exe", "powershell.exe"]);
        })
      );
    }
    exercise(
      "hands the bundle to the per-user claude.exe through environment variables",
      { executable: true },
      Effect.fnUntraced(function* (host, calls) {
        const file = "/fixture/it's a bundle; $(not a command).mcpb";
        yield* host.openInClaude(file);
        expect(A.map(calls, (call) => call.command)).toEqual(["powershell.exe"]);
        expect(calls[0]?.options.env).toMatchObject({
          BEEP_SETUP_CLAUDE: "/local/AnthropicClaude/claude.exe",
          BEEP_SETUP_TEXT: file,
        });
        expect(calls[0]?.args).not.toContain(file);
      })
    );
    exercise(
      "hands claude:// links to the per-user claude.exe instead of the registered handler",
      { executable: true },
      Effect.fnUntraced(function* (host, calls) {
        const link = "claude://claude.ai/new?q=it's%20$(not%20a%20command)";
        yield* host.openLink(link);
        expect(A.map(calls, (call) => call.command)).toEqual(["powershell.exe"]);
        expect(calls[0]?.options.env).toMatchObject({
          BEEP_SETUP_CLAUDE: "/local/AnthropicClaude/claude.exe",
          BEEP_SETUP_TEXT: link,
        });
        expect(calls[0]?.args).not.toContain(link);
      })
    );
    exercise(
      "reports a failed Claude launch in plain language",
      { executable: true, shellExit: 1 },
      Effect.fnUntraced(function* (host) {
        expect((yield* host.openInClaude("/fixture/bundle.mcpb").pipe(Effect.result))._tag).toBe("Failure");
      })
    );
    exercise(
      "passes installer arguments and shell text without parsing user text as PowerShell",
      { shellExit: 1 },
      Effect.fnUntraced(function* (host, calls) {
        const resultInstaller = yield* host.runInstaller("/fixture/setup.exe", ["/S"]);
        expect(resultInstaller).toBe(1);
        // Without the per-user executable the file goes to Explorer, whose nonzero
        // exit is allowed because it can already have opened the file.
        yield* host.openInClaude("/fixture/bundle.mcpb");
        const text = "text with 'quotes'; $(not a command)";
        expect((yield* host.openLink(text).pipe(Effect.result))._tag).toBe("Failure");
        expect((yield* host.copyToClipboard(text).pipe(Effect.result))._tag).toBe("Failure");
        expect(A.map(calls, (call) => call.command)).toEqual([
          "/fixture/setup.exe",
          "explorer.exe",
          "powershell.exe",
          "powershell.exe",
        ]);
        expect(calls[0]?.args).toEqual(["/S"]);
        expect(calls[2]?.options.env).toMatchObject({ BEEP_SETUP_TEXT: text });
        expect(calls[2]?.args).not.toContain(text);
        const stateDir5 = yield* host.stateDir;
        expect(stateDir5).toBe("/local/beep/practice-setup");
        const fs = yield* FileSystem.FileSystem;
        const exists6 = yield* fs.exists("/local/beep/practice-setup");
        expect(exists6).toBe(true);
      })
    );
    exercise(
      "accepts successful link and clipboard commands",
      {},
      Effect.fnUntraced(function* (host) {
        yield* host.openLink("claude://new");
        yield* host.copyToClipboard("synthetic onboarding");
      })
    );
    it.layer(GatewayBundle.fromFile("/bundle.mcpb", O.some("1.2.3")), { timeout: "5 seconds" })(
      "bundled asset",
      (it) => {
        it.effect("materializes exactly the bundled bytes and preserves its stamped version", () =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* fs.writeFileString("/bundle.mcpb", "synthetic bundle bytes");
            yield* fs.makeDirectory("/target", { recursive: true });
            const bundle = yield* GatewayBundle;
            assertSome(bundle.version, "1.2.3");
            const materialize7 = yield* bundle.materialize("/target");
            expect(materialize7).toBe("/target/practice-gateway.mcpb");
            const readFileString8 = yield* fs.readFileString("/target/practice-gateway.mcpb");
            expect(readFileString8).toBe("synthetic bundle bytes");
          })
        );
      }
    );
    it.layer(GatewayBundle.fromFile("/absent.mcpb", O.none()), { timeout: "5 seconds" })("missing asset", (it) => {
      it.effect("reports a missing embedded bundle without opening or creating a target", () =>
        Effect.gen(function* () {
          const result = yield* (yield* GatewayBundle).materialize("/target").pipe(Effect.result);
          expect(result).toMatchObject({
            _tag: "Failure",
            failure: { message: "The Practice Gateway file is missing from this setup program." },
          });
        })
      );
    });
  }
);
