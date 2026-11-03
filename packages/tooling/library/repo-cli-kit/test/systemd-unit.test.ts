import {
  parseSystemdUnit,
  readInstalledSystemdUnit,
  resolveOperatorPath,
  resolveSystemdBunPath,
  resolveUnitBunPath,
  SystemdBunCandidate,
  SystemdInstalledUnit,
  SystemdUnitDirective,
  SystemdUnitPath,
  systemdEnvironmentFile,
  systemdUnitDirective,
  systemdUnitPathRule,
  systemdUserUnitDir,
  unquoteSystemdArgument,
} from "@beep/repo-cli-kit/systemd/index";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const isSystemdUnitPath = S.is(SystemdUnitPath);

// A scratch HOME with the user unit directory path precomputed; `touch` leaves an executable file.
const fixture = Effect.fn("SystemdUnitTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "systemd-unit-test-" }));
  const home = path.join(directory, "home");
  yield* fs.makeDirectory(home, { recursive: true });
  const unitDir = path.join(home, ".config", "systemd", "user");
  const touch = Effect.fn("SystemdUnitTest.touch")(function* (file: string) {
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, "");
    yield* fs.chmod(file, 0o755);
  });
  return { fs, path, home, unitDir, touch };
});

// The real clock, not the test clock: this suite drives filesystem work.
layer(NodeServices.layer, { excludeTestServices: true, timeout: "30 seconds" })("systemd/SystemdUnit", (it) => {
  it.effect(
    "resolves the units' Bun through the mise shim, then a standalone Bun, then this executable",
    Effect.fn(function* () {
      const { fs, path, home, touch } = yield* fixture();
      const shim = path.join(home, ".local", "share", "mise", "shims", "bun");
      const standalone = path.join(home, ".bun", "bin", "bun");
      expect(SystemdBunCandidate.literals).toEqual([".local/share/mise/shims/bun", ".bun/bin/bun"]);
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
      expect(resolveOperatorPath("~/tools/bun", home, path.resolve)).toBe(path.join(home, "tools", "bun"));
      expect(resolveOperatorPath("/usr/bin/bun", home, path.resolve)).toBe("/usr/bin/bun");
      expect(resolveOperatorPath("tools/bun", home, path.resolve)).toBe(path.resolve("tools/bun"));
      // The data-last form takes the typed path alone, so it composes in a pipe.
      expect(resolveOperatorPath(home, path.resolve)("~/tools/bun")).toBe(path.join(home, "tools", "bun"));
      expect(pipe("/usr/bin/bun", resolveOperatorPath(home, path.resolve))).toBe("/usr/bin/bun");
    })
  );

  it.effect(
    "parses systemd directives in order and supports data-first and data-last readers",
    Effect.fn(function* () {
      const text =
        "[Unit]\n# Description=ignored\n; ignored=yes\n\n Description=  daily job  \n[Service]\nWorkingDirectory= /clone \nEnvironment=FIRST=one\nEnvironment=SECOND=two\n";
      const expected = SystemdInstalledUnit.make({
        fileName: "test.service",
        directives: [
          SystemdUnitDirective.make({ key: "Description", value: "daily job" }),
          SystemdUnitDirective.make({ key: "WorkingDirectory", value: "/clone" }),
          SystemdUnitDirective.make({ key: "Environment", value: "FIRST=one" }),
          SystemdUnitDirective.make({ key: "Environment", value: "SECOND=two" }),
        ],
      });
      const unit = parseSystemdUnit(text, "test.service");
      expect(unit).toEqual(expected);
      expect(pipe(text, parseSystemdUnit("test.service"))).toEqual(expected);
      assertSome(systemdUnitDirective(unit, "Environment"), "FIRST=one");
      assertSome(pipe(unit, systemdUnitDirective("WorkingDirectory")), "/clone");
      assertNone(systemdUnitDirective(unit, "Missing"));
      assertNone(pipe(unit, systemdUnitDirective("Missing")));
    })
  );

  it.effect(
    "unquotes systemd arguments and strips optional environment-file dashes",
    Effect.fn(function* () {
      expect(unquoteSystemdArgument('"/opt/bun 1/bin/bun"')).toBe("/opt/bun 1/bin/bun");
      expect(unquoteSystemdArgument("/usr/bin/bun")).toBe("/usr/bin/bun");
      expect(unquoteSystemdArgument("")).toBe("");
      expect(unquoteSystemdArgument('"')).toBe('"');
      expect(unquoteSystemdArgument('""')).toBe("");
      expect(unquoteSystemdArgument('"/usr/bin/bun')).toBe('"/usr/bin/bun');
      assertSome(systemdEnvironmentFile(parseSystemdUnit("EnvironmentFile=-/env", "x.service")), "/env");
      assertSome(systemdEnvironmentFile(parseSystemdUnit("EnvironmentFile=/env", "x.service")), "/env");
      assertNone(systemdEnvironmentFile(parseSystemdUnit("[Service]", "x.service")));
    })
  );

  it.effect(
    "reads absent and written systemd units from the user unit directory",
    Effect.fn(function* () {
      const { fs, path, home, unitDir } = yield* fixture();
      expect(systemdUserUnitDir(path, home)).toBe(unitDir);
      expect(pipe(path, systemdUserUnitDir(home))).toBe(unitDir);
      const options = { home, fileName: "test.service" };
      assertNone(yield* readInstalledSystemdUnit(options));
      yield* fs.makeDirectory(unitDir, { recursive: true });
      yield* fs.writeFileString(path.join(unitDir, options.fileName), "[Service]\nWorkingDirectory= /clone \n");
      assertSome(
        yield* readInstalledSystemdUnit(options),
        SystemdInstalledUnit.make({
          fileName: options.fileName,
          directives: [SystemdUnitDirective.make({ key: "WorkingDirectory", value: "/clone" })],
        })
      );
    })
  );

  it.effect(
    "resolves a pinned Bun path against HOME and probes the candidates when none is pinned",
    Effect.fn(function* () {
      const { path, home, touch } = yield* fixture();
      expect(yield* resolveUnitBunPath({ home, pinned: O.some("~/tools/bun") })).toBe(path.join(home, "tools", "bun"));
      expect(yield* resolveUnitBunPath({ home, pinned: O.none() })).toBe(process.execPath);
      const standalone = path.join(home, ".bun", "bin", "bun");
      yield* touch(standalone);
      expect(yield* resolveUnitBunPath({ home, pinned: O.none() })).toBe(standalone);
    })
  );

  it.effect(
    "accepts plain unit paths and rejects characters systemd would reinterpret",
    Effect.fn(function* () {
      expect(isSystemdUnitPath("/opt/bun 1/bin/bun")).toBe(true);
      for (const bad of ['/opt/"bun"', "/opt\\bun", "/opt/%h", "/opt/$HOME", "/opt/\nbun", ""]) {
        expect(isSystemdUnitPath(bad)).toBe(false);
      }
      expect(systemdUnitPathRule).toContain("percent signs");
    })
  );
});
