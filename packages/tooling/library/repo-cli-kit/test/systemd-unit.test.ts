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

const fixture = Effect.fn("SystemdUnitTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved1 = yield* fs.makeTempDirectoryScoped({ prefix: "systemd-unit-test-" });
  const directory = yield* fs.realPath(resolved1);
  const home = path.join(directory, "home");
  yield* fs.makeDirectory(home, { recursive: true });
  const unitDir = path.join(home, ".config", "systemd", "user");
  const touchExecutable = Effect.fn("SystemdUnitTest.touchExecutable")(function* (file: string) {
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, "");
    yield* fs.chmod(file, 0o755);
  });
  return { fs, path, home, unitDir, touchExecutable };
});

layer(NodeServices.layer, { excludeTestServices: true, timeout: "30 seconds" })("systemd/SystemdUnit", (it) => {
  it.effect(
    "resolves the units' Bun through the mise shim, then a standalone Bun, then this executable",
    Effect.fn(function* () {
      const { fs, path, home, touchExecutable } = yield* fixture();
      const shim = path.join(home, ".local", "share", "mise", "shims", "bun");
      const standalone = path.join(home, ".bun", "bin", "bun");
      expect(SystemdBunCandidate.literals).toEqual([".local/share/mise/shims/bun", ".bun/bin/bun"]);
      const resolved2 = yield* resolveSystemdBunPath(home);
      expect(resolved2, "with neither candidate the running executable is the fallback").toBe(process.execPath);
      yield* Effect.forEach([shim, standalone], touchExecutable, { concurrency: 1 });
      const resolved3 = yield* resolveSystemdBunPath(home);
      expect(resolved3, "with both executable the shim wins: it follows the repo's pinned Bun").toBe(shim);
      yield* fs.chmod(shim, 0o644);
      const resolved4 = yield* resolveSystemdBunPath(home);
      expect(resolved4, "a leftover without execute permission is skipped, not pinned").toBe(standalone);
      yield* fs.remove(standalone);
      yield* fs.makeDirectory(standalone);
      const resolved5 = yield* resolveSystemdBunPath(home);
      expect(resolved5, "a directory where the executable should be is skipped").toBe(process.execPath);
      yield* fs.remove(standalone, { recursive: true });
      yield* touchExecutable(shim);
      yield* fs.chmod(path.dirname(shim), 0o000);
      const unreachable = yield* resolveSystemdBunPath(home).pipe(
        Effect.ensuring(Effect.orDie(fs.chmod(path.dirname(shim), 0o755)))
      );
      expect(unreachable, "an unreachable candidate is skipped rather than failing the install or uninstall").toBe(
        process.execPath
      );
      expect(resolveOperatorPath("~/tools/bun", home, path.resolve), "an operator pin expands ~/ against HOME").toBe(
        path.join(home, "tools", "bun")
      );
      expect(resolveOperatorPath("/usr/bin/bun", home, path.resolve)).toBe("/usr/bin/bun");
      expect(resolveOperatorPath("tools/bun", home, path.resolve)).toBe(path.resolve("tools/bun"));
      expect(
        resolveOperatorPath(home, path.resolve)("~/tools/bun"),
        "the data-last form takes the typed path alone"
      ).toBe(path.join(home, "tools", "bun"));
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
      const resolved6 = yield* readInstalledSystemdUnit(options);
      assertNone(resolved6);
      yield* fs.makeDirectory(unitDir, { recursive: true });
      yield* fs.writeFileString(path.join(unitDir, options.fileName), "[Service]\nWorkingDirectory= /clone \n");
      const resolved7 = yield* readInstalledSystemdUnit(options);
      assertSome(
        resolved7,
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
      const { path, home, touchExecutable } = yield* fixture();
      const resolved8 = yield* resolveUnitBunPath({ home, pinned: O.some("~/tools/bun") });
      expect(resolved8).toBe(path.join(home, "tools", "bun"));
      const resolved9 = yield* resolveUnitBunPath({ home, pinned: O.none() });
      expect(resolved9).toBe(process.execPath);
      const standalone = path.join(home, ".bun", "bin", "bun");
      yield* touchExecutable(standalone);
      const resolved10 = yield* resolveUnitBunPath({ home, pinned: O.none() });
      expect(resolved10).toBe(standalone);
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
