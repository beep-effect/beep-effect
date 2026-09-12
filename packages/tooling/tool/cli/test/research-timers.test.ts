import { researchCommand, runResearchInstallTimers } from "@beep/repo-cli/commands/Research";
import {
  resolveOperatorPath,
  resolveSystemdBunPath,
  SystemdBunCandidate,
  SystemdUnitPath,
} from "@beep/repo-cli/test/Systemd";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertSome, assertSuccess, strictEqual } from "@effect/vitest/utils";
import { ConfigProvider, Console, Effect, FileSystem, Layer, Path, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";

const PAGE_ID = "36869573788d8043907eddb021d99410";
const UNIT_FILES = [
  "beep-research-daily.service",
  "beep-research-daily.timer",
  "beep-research-repo-card.service",
  "beep-research-repo-card.timer",
];

const decodeUnitPath = S.decodeUnknownEffect(SystemdUnitPath);

// Every systemctl call the installer makes is recorded and answered with one
// exit code, so nothing reaches this user's real systemd manager.
const scriptedSystemctl = (
  calls: Array<string>,
  exitCode: number
): Layer.Layer<ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
    ChildProcessSpawner.make((command) =>
      Effect.sync(() => {
        if (command._tag === "StandardCommand") {
          calls.push(A.join([command.command, ...command.args], " "));
        }
        return ChildProcessSpawner.makeHandle({
          pid: ChildProcessSpawner.ProcessId(1),
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          stdin: Sink.drain,
          stdout: Stream.empty,
          stderr: Stream.empty,
          all: Stream.empty,
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
          unref: Effect.succeed(Effect.void),
        });
      })
    )
  );

const withSystemctl = (calls: Array<string>, exitCode = 0) => provideScopedLayer(scriptedSystemctl(calls, exitCode));
const withHome = (home: string) => provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME: home })));
const withoutHome = provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({})));

// The handler reports through Console; capturing it is how its rendering is
// asserted alongside the units it wrote.
const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  const result = yield* Effect.result(
    effect.pipe(
      Effect.provideService(Console.Console, {
        ...current,
        log: (...values: ReadonlyArray<unknown>) => {
          output = A.appendAll(output, values);
        },
      })
    )
  );
  return { result, output };
});

const failureTag = <E extends { readonly _tag: string }>(result: Result.Result<unknown, E>): O.Option<string> =>
  O.map(Result.getFailure(result), (error) => error._tag);

const failureMessage = <E extends { readonly message: string }>(result: Result.Result<unknown, E>): O.Option<string> =>
  O.map(Result.getFailure(result), (error) => error.message);

const fixture = Effect.fn("ResearchTimersTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "research-timers-test-" }));
  const home = path.join(directory, "home");
  yield* fs.makeDirectory(home, { recursive: true });
  const unitDir = path.join(home, ".config", "systemd", "user");
  const touch = Effect.fn("ResearchTimersTest.touch")(function* (file: string) {
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, "");
    yield* fs.chmod(file, 0o755);
  });
  const readUnit = (fileName: string) => fs.readFileString(path.join(unitDir, fileName));
  const execLine = Effect.fn("ResearchTimersTest.execLine")(function* (fileName: string) {
    return A.findFirst(Str.split("\n")(yield* readUnit(fileName)), Str.startsWith("ExecStart="));
  });
  const unitsPresent = Effect.forEach(UNIT_FILES, (fileName) => fs.exists(path.join(unitDir, fileName)));
  return { fs, path, home, unitDir, touch, readUnit, execLine, unitsPresent };
});

// The real clock, not the test clock: this suite drives filesystem work and
// subprocess capture through the shared runner.
layer(NodeServices.layer, { excludeTestServices: true, timeout: "30 seconds" })("Research timers", (it) => {
  it.effect(
    "resolves the units' Bun through the mise shim, then a standalone Bun, then this executable",
    Effect.fn(function* () {
      const { fs, path, home, touch } = yield* fixture();
      const shim = path.join(home, ".local", "share", "mise", "shims", "bun");
      const standalone = path.join(home, ".bun", "bin", "bun");
      expect(SystemdBunCandidate.Options).toEqual([".local/share/mise/shims/bun", ".bun/bin/bun"]);
      // Neither candidate: the running executable is the fallback.
      expect(yield* resolveSystemdBunPath(home)).toBe(process.execPath);
      yield* Effect.forEach([shim, standalone], touch);
      // Both executable: the shim wins because it follows the repo's pinned Bun.
      expect(yield* resolveSystemdBunPath(home)).toBe(shim);
      // A leftover without execute permission is skipped, not pinned.
      yield* fs.chmod(shim, 0o644);
      expect(yield* resolveSystemdBunPath(home)).toBe(standalone);
      // So is a directory sitting where the executable should be.
      yield* fs.remove(standalone);
      yield* fs.makeDirectory(standalone);
      expect(yield* resolveSystemdBunPath(home)).toBe(process.execPath);
      // A candidate this user cannot even reach is skipped rather than failing
      // the install, so an uninstall is never blocked by the probe either.
      yield* fs.remove(standalone, { recursive: true });
      yield* touch(shim);
      yield* fs.chmod(path.dirname(shim), 0o000);
      const unreachable = yield* resolveSystemdBunPath(home).pipe(
        Effect.ensuring(Effect.orDie(fs.chmod(path.dirname(shim), 0o755)))
      );
      expect(unreachable).toBe(process.execPath);
      // Operator pins expand `~/` against HOME and otherwise resolve as typed.
      expect(resolveOperatorPath(home, path.resolve, "~/tools/bun")).toBe(path.join(home, "tools", "bun"));
      expect(resolveOperatorPath(home, path.resolve, "/usr/bin/bun")).toBe("/usr/bin/bun");
      expect(resolveOperatorPath(home, path.resolve, "tools/bun")).toBe(path.resolve("tools/bun"));
    })
  );

  it.effect(
    "writes both unit pairs with the Bun path quoted for systemd and enables the timers",
    Effect.fn(function* () {
      const { home, readUnit, unitsPresent } = yield* fixture();
      const calls: Array<string> = [];
      const bunPath = "/opt/bun 1/bin/bun";
      const wrote = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.some(bunPath), page: O.some(PAGE_ID), uninstall: false }).pipe(
          withSystemctl(calls),
          withHome(home)
        )
      );
      assertSuccess(wrote.result, undefined);
      expect(calls).toEqual([
        "systemctl --user daemon-reload",
        "systemctl --user enable --now beep-research-daily.timer",
        "systemctl --user enable --now beep-research-repo-card.timer",
      ]);
      expect(wrote.output).toEqual([
        "research install-timers: enabled beep-research-daily.timer (*-*-* 21:00:00), beep-research-repo-card.timer (Sun *-*-* 20:30:00).",
        `research install-timers: secrets load from ${home}/.config/beep-research/env when present.`,
      ]);
      expect(yield* unitsPresent).toEqual([true, true, true, true]);
      expect(yield* readUnit("beep-research-daily.service")).toBe(
        [
          "[Unit]",
          "Description=beep research daily pipeline (sift, notion-pull, cognify, digest)",
          "",
          "[Service]",
          "Type=oneshot",
          `WorkingDirectory=${process.cwd()}`,
          `EnvironmentFile=-${home}/.config/beep-research/env`,
          `ExecStart="${bunPath}" run beep research daily --commit --page ${PAGE_ID}`,
          "TimeoutStartSec=1800",
          "",
        ].join("\n")
      );
      expect(yield* readUnit("beep-research-daily.timer")).toBe(
        [
          "[Unit]",
          "Description=Timer for beep research daily pipeline (sift, notion-pull, cognify, digest)",
          "",
          "[Timer]",
          "OnCalendar=*-*-* 21:00:00",
          "Persistent=true",
          "",
          "[Install]",
          "WantedBy=timers.target",
          "",
        ].join("\n")
      );
      expect(yield* readUnit("beep-research-repo-card.service")).toBe(
        [
          "[Unit]",
          "Description=beep research weekly repo-card refresh",
          "",
          "[Service]",
          "Type=oneshot",
          `WorkingDirectory=${process.cwd()}`,
          `EnvironmentFile=-${home}/.config/beep-research/env`,
          `ExecStart="${bunPath}" run beep research repo-card`,
          "TimeoutStartSec=1800",
          "",
        ].join("\n")
      );
      expect(yield* readUnit("beep-research-repo-card.timer")).toBe(
        [
          "[Unit]",
          "Description=Timer for beep research weekly repo-card refresh",
          "",
          "[Timer]",
          "OnCalendar=Sun *-*-* 20:30:00",
          "Persistent=true",
          "",
          "[Install]",
          "WantedBy=timers.target",
          "",
        ].join("\n")
      );
    })
  );

  it.effect(
    "runs the units through the resolved default Bun unless --bun-path pins one",
    Effect.fn(function* () {
      const { path, home, touch, execLine } = yield* fixture();
      const shim = path.join(home, ".local", "share", "mise", "shims", "bun");
      yield* touch(shim);
      const calls: Array<string> = [];
      const defaulted = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.none(), page: O.none(), uninstall: false }).pipe(
          withSystemctl(calls),
          withHome(home)
        )
      );
      assertSuccess(defaulted.result, undefined);
      assertSome(
        yield* execLine("beep-research-daily.service"),
        `ExecStart="${shim}" run beep research daily --commit`
      );
      assertSome(yield* execLine("beep-research-repo-card.service"), `ExecStart="${shim}" run beep research repo-card`);
      // An explicit --bun-path is pinned as given, with `~/` expanded against HOME.
      const pinned = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.some("~/tools/bun"), page: O.none(), uninstall: false }).pipe(
          withSystemctl(calls),
          withHome(home)
        )
      );
      assertSuccess(pinned.result, undefined);
      assertSome(
        yield* execLine("beep-research-daily.service"),
        `ExecStart="${path.join(home, "tools", "bun")}" run beep research daily --commit`
      );
    })
  );

  it.effect(
    "refuses a page id or path systemd would reinterpret before writing anything",
    Effect.fn(function* () {
      const { fs, home, unitDir } = yield* fixture();
      const calls: Array<string> = [];
      const refusedPage = yield* captureOutput(
        runResearchInstallTimers({
          bunPath: O.some("/usr/bin/bun"),
          page: O.some("not a page id"),
          uninstall: false,
        }).pipe(withSystemctl(calls), withHome(home))
      );
      assertSome(failureTag(refusedPage.result), "ResearchCommandError");
      assertSome(O.map(failureMessage(refusedPage.result), Str.includes("--page must be a bare Notion page id")), true);
      const refusedBun = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.some('/opt/"bun"/bin/bun'), page: O.none(), uninstall: false }).pipe(
          withSystemctl(calls),
          withHome(home)
        )
      );
      assertSome(failureTag(refusedBun.result), "ResearchCommandError");
      expect(calls).toEqual([]);
      expect(yield* fs.exists(unitDir)).toBe(false);
      // The refinement is the single home of that rule: spaces pass because the
      // Bun path is rendered quoted; the rest systemd would rewrite.
      expect(yield* decodeUnitPath("/opt/bun 1/bin/bun")).toBe("/opt/bun 1/bin/bun");
      yield* Effect.forEach(["/opt/%h/bun", "/opt/$HOME/bun", "/opt\\bun", "/opt/bun\n", ""], (bad) =>
        Effect.map(Effect.flip(decodeUnitPath(bad)), (failure) => strictEqual(failure._tag, "SchemaError"))
      );
    })
  );

  it.effect(
    "removes the units on --uninstall and reports a failing systemctl instead of claiming success",
    Effect.fn(function* () {
      const { home, unitsPresent } = yield* fixture();
      const installed = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.some("/usr/bin/bun"), page: O.none(), uninstall: false }).pipe(
          withSystemctl([]),
          withHome(home)
        )
      );
      assertSuccess(installed.result, undefined);
      expect(yield* unitsPresent).toEqual([true, true, true, true]);
      // The install paths are never read on the way out, so none of them can
      // keep an installed unit from being removed.
      const removeCalls: Array<string> = [];
      const removed = yield* captureOutput(
        runResearchInstallTimers({
          bunPath: O.some('/opt/"gone"/bun'),
          page: O.some("not a page id"),
          uninstall: true,
        }).pipe(withSystemctl(removeCalls), withHome(home))
      );
      assertSuccess(removed.result, undefined);
      expect(removed.output).toEqual(["research install-timers: removed research timers."]);
      expect(removeCalls).toEqual([
        "systemctl --user disable --now beep-research-daily.timer",
        "systemctl --user disable --now beep-research-repo-card.timer",
        "systemctl --user daemon-reload",
      ]);
      expect(yield* unitsPresent).toEqual([false, false, false, false]);
      // Nothing installed is nothing to undo: a second uninstall still reloads cleanly.
      const again = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.none(), page: O.none(), uninstall: true }).pipe(
          withSystemctl([]),
          withHome(home)
        )
      );
      assertSuccess(again.result, undefined);
      // A daemon-reload that exits nonzero is reported on install and uninstall alike.
      const failedInstall = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.some("/usr/bin/bun"), page: O.none(), uninstall: false }).pipe(
          withSystemctl([], 1),
          withHome(home)
        )
      );
      assertSome(
        O.map(failureMessage(failedInstall.result), Str.includes("systemctl --user daemon-reload exited with 1")),
        true
      );
      const failedRemove = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.none(), page: O.none(), uninstall: true }).pipe(
          withSystemctl([], 1),
          withHome(home)
        )
      );
      assertSome(
        O.map(failureMessage(failedRemove.result), Str.includes("systemctl --user daemon-reload exited with 1")),
        true
      );
      // Without HOME there is no unit directory to write or clear.
      const homeless = yield* captureOutput(
        runResearchInstallTimers({ bunPath: O.none(), page: O.none(), uninstall: true }).pipe(
          withSystemctl([]),
          withoutHome
        )
      );
      assertSome(failureMessage(homeless.result), "HOME is not set; cannot locate systemd user directory.");
    })
  );

  it.effect(
    "wires --bun-path, --page, and --uninstall through the research command tree",
    Effect.fn(function* () {
      const { home, execLine, unitsPresent } = yield* fixture();
      const calls: Array<string> = [];
      const runCommand = (args: ReadonlyArray<string>) =>
        captureOutput(
          Command.runWith(researchCommand, { version: "test", renderErrors: false })(["install-timers", ...args])
        ).pipe(withSystemctl(calls), withHome(home), provideScopedLayer(FetchHttpClient.layer));
      const installed = yield* runCommand(["--bun-path", "/usr/bin/bun", "--page", PAGE_ID]);
      assertSuccess(installed.result, undefined);
      assertSome(
        yield* execLine("beep-research-daily.service"),
        `ExecStart="/usr/bin/bun" run beep research daily --commit --page ${PAGE_ID}`
      );
      const removed = yield* runCommand(["--uninstall"]);
      assertSuccess(removed.result, undefined);
      expect(yield* unitsPresent).toEqual([false, false, false, false]);
      expect(calls).toEqual([
        "systemctl --user daemon-reload",
        "systemctl --user enable --now beep-research-daily.timer",
        "systemctl --user enable --now beep-research-repo-card.timer",
        "systemctl --user disable --now beep-research-daily.timer",
        "systemctl --user disable --now beep-research-repo-card.timer",
        "systemctl --user daemon-reload",
      ]);
    })
  );
});
