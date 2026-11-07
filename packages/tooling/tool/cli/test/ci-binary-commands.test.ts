import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { ciBinaryCommand, ciBinaryMain, ciCompileBinaryCommand, compileCiBinary } from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { provideSpawner } from "./support/ScriptedProcess.ts";

// The slim CI binary's command values, run in-process: the platform is real, every child
// process is scripted, and the environment comes from a ConfigProvider instead of the host.
const runCi = Command.runWith(ciBinaryCommand, { version: "0.0.0" });

const withEnvironment = (environment: Readonly<Record<string, string>>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment));

const lines = (logged: ReadonlyArray<unknown>) => A.map(logged, (line) => `${line}`);
const loggedLines = Effect.map(TestConsole.logLines, lines);
const errorLines = Effect.map(TestConsole.errorLines, lines);

const PROFILE_FULL = "goals_only=false\ndocs_only=false\ndesktop_rust_relevant=true";

it.layer(Layer.mergeAll(NodeServices.layer, Digest.layerWebCrypto), { timeout: "60 seconds" })(
  "CI binary commands in-process",
  (it) => {
    it.effect(
      "checks the pattern projection and prints the full local change profile",
      Effect.fnUntraced(function* () {
        const spawner = ScriptedSpawner.make(() => ({ exit: 0 }));
        yield* runCi(["ci", "patterns"]);
        yield* runCi(["ci", "change-profile"]).pipe(
          withEnvironment({ GITHUB_EVENT_NAME: "local" }),
          provideSpawner(spawner)
        );
        const logged = yield* loggedLines;
        expect(logged).toContain("CI pattern projection is in sync.");
        expect(logged).toContain(PROFILE_FULL);
        expect(spawner.spawns).toEqual([]);
      })
    );

    it.effect(
      "reports an operational failure on stderr and exits 1",
      Effect.fnUntraced(function* () {
        const failure = yield* runCi(["ci", "job-env"]).pipe(withEnvironment({}), Effect.flip);
        expect(failure).toMatchObject({ _tag: "CliReportedExit", exitCode: 1 });
        const reported = yield* errorLines;
        expect(reported).toContain("Failed to export the CI job environment.");
      })
    );

    it.effect(
      "prunes a named apt directory unprivileged and the system one through sudo",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "ci-binary-apt-" });
        yield* fs.writeFileString(path.join(directory, "third-party.list"), "deb https://example.test stable main\n");
        yield* fs.writeFileString(path.join(directory, "ubuntu.sources"), "Types: deb\n");
        const spawner = ScriptedSpawner.make((command) => ({ exit: 0, stdout: command === "ls" ? "total 0\n" : "" }));
        yield* runCi(["ci", "prune-apt", directory]).pipe(provideSpawner(spawner));
        const kept = yield* Effect.forEach(["third-party.list", "ubuntu.sources"], (name) =>
          fs.exists(path.join(directory, name))
        );
        expect(kept).toEqual([false, true]);
        yield* runCi(["ci", "prune-apt"]).pipe(provideSpawner(spawner));
        expect(A.map(spawner.spawns, ({ command, args }) => `${command} ${A.join(A.take(args, 2), " ")}`)).toEqual([
          `ls -l ${directory}`,
          `ls -l ${directory}`,
          "ls -l /etc/apt/sources.list.d",
          "sudo find /etc/apt/sources.list.d",
          "ls -l /etc/apt/sources.list.d",
        ]);
        const logged = yield* loggedLines;
        expect(logged).toContain(path.join(directory, "third-party.list"));
      })
    );

    it.effect(
      "runs a resource lane, preserves its status and refuses an unsafe lane name",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temp = yield* fs.makeTempDirectoryScoped({ prefix: "ci-binary-lane-" });
        // No /proc snapshot under the fixture root: measurement is unavailable, the lane still runs.
        const environment = withEnvironment({ BEEP_CI_PROC_ROOT: path.join(temp, "proc"), RUNNER_TEMP: temp });
        const passing = ScriptedSpawner.make(() => ({ exit: 0 }));
        yield* runCi(["ci", "runner-resources", "check", "true"]).pipe(environment, provideSpawner(passing));
        expect(A.map(passing.spawns, ({ command, args }) => [command, ...args])).toEqual([
          ["bash", "-c", '"$@"; exit "$?"', "beep-ci-lane", "true"],
        ]);
        const failing = ScriptedSpawner.make(() => ({ exit: 3 }));
        const failed = yield* runCi(["ci", "runner-resources", "check", "false", "--", "--flag"]).pipe(
          environment,
          provideSpawner(failing),
          Effect.flip
        );
        expect(failed).toMatchObject({ _tag: "CliReportedExit", message: "CI lane failed", exitCode: 3 });
        const refused = yield* runCi(["ci", "runner-resources", "Not_A_Lane", "true"]).pipe(Effect.flip);
        expect(refused).toMatchObject({ message: "Invalid resource lane name", exitCode: 64 });
      })
    );

    it.effect(
      "runs the main effect over the supplied platform",
      Effect.fnUntraced(function* () {
        const spawner = ScriptedSpawner.make(() => ({ exit: 0 }));
        const platform = Layer.mergeAll(
          NodeServices.layer,
          spawner.layer,
          Stdio.layerTest({ args: Effect.succeed(["ci", "change-profile"]) })
        );
        yield* ciBinaryMain(["ci", "change-profile"], platform).pipe(withEnvironment({ GITHUB_EVENT_NAME: "local" }));
        expect(spawner.spawns).toEqual([]);
      })
    );

    it.effect(
      "compiles the CI entry with bun and writes a sha256sum line beside the executable",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const digest = yield* Digest.Digest;
        const root = yield* findRepoRoot();
        const dist = yield* fs.makeTempDirectoryScoped({ prefix: "ci-binary-compile-" });
        const outfile = path.join(dist, "bin", "beep");
        // The scripted `bun build` leaves the executable a previous build wrote in place.
        yield* fs.makeDirectory(path.dirname(outfile), { recursive: true });
        yield* fs.writeFileString(outfile, "compiled executable\n");
        const expected = yield* digest
          .digest(Digest.sha256, new TextEncoder().encode("compiled executable\n"))
          .pipe(Effect.map(Hex.encode));
        const spawner = ScriptedSpawner.make(() => ({ exit: 0 }));
        const hash = yield* compileCiBinary(outfile, "bun-linux-arm64").pipe(provideSpawner(spawner));
        expect(hash).toBe(expected);
        const checksum = yield* fs.readFileString(`${outfile}.sha256`);
        const logged = yield* loggedLines;
        expect(checksum).toBe(`${expected}  beep\n`);
        expect(logged).toContain(`${expected}  ${outfile}`);
        expect(A.map(spawner.spawns, ({ command, args, cwd }) => ({ command, args, cwd }))).toEqual([
          {
            command: "bun",
            args: [
              "build",
              "--compile",
              "--target=bun-linux-arm64",
              path.join(root, "packages/tooling/tool/cli/src/bin-ci.ts"),
              "--outfile",
              outfile,
            ],
            cwd: root,
          },
        ]);
        yield* Command.runWith(ciCompileBinaryCommand, { version: "0.0.0" })(["--outfile", outfile]).pipe(
          provideSpawner(spawner)
        );
        expect(A.map(spawner.spawns, ({ args }) => args[2])).toEqual([
          "--target=bun-linux-arm64",
          "--target=bun-linux-x64",
        ]);
      })
    );

    it.effect(
      "reports a failed build or an unreadable executable and exits 1",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dist = yield* fs.makeTempDirectoryScoped({ prefix: "ci-binary-compile-fail-" });
        const outfile = path.join(dist, "beep");
        const runCompile = Command.runWith(ciCompileBinaryCommand, { version: "0.0.0" });
        const refused = ScriptedSpawner.make(() => ({ exit: 2 }));
        const failed = yield* runCompile(["--outfile", outfile]).pipe(provideSpawner(refused), Effect.flip);
        expect(failed).toMatchObject({
          _tag: "CliReportedExit",
          message: "bun build --compile exited 2.",
          exitCode: 1,
        });
        // A build that exits 0 without writing the executable fails on the read, wrapped once.
        const silent = ScriptedSpawner.make(() => ({ exit: 0 }));
        const unreadable = yield* compileCiBinary(outfile, "bun-linux-x64").pipe(provideSpawner(silent), Effect.flip);
        expect(unreadable._tag).toBe("CiCommandError");
        expect(Str.startsWith("Failed to compile the CI binary.")(unreadable.message)).toBe(true);
        const reported = yield* errorLines;
        const checksumWritten = yield* fs.exists(`${outfile}.sha256`);
        expect(reported).toContain("bun build --compile exited 2.");
        expect(checksumWritten).toBe(false);
      })
    );
  }
);
