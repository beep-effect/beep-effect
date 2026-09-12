/**
 * Resolution of the paths a systemd user-unit installer writes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { constFalse, dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { SystemdBunCandidate, SystemdInstalledUnit, SystemdUnitDirective } from "./SystemdUnit.schemas.ts";

/**
 * Makes an operator-typed path absolute, expanding a leading `~/` against `home`.
 *
 * **Details**
 *
 * Operators type `~/...` and relative paths; systemd needs absolute ones, and
 * no shell is involved to expand either. `resolve` is the platform's
 * `Path.resolve`, so a relative input is anchored at the working directory.
 *
 * **Example** (Expand a home-relative pin)
 *
 * ```ts
 * import { resolveOperatorPath } from "@beep/repo-cli/test/Systemd"
 * import { pipe } from "effect"
 *
 * console.log(resolveOperatorPath("~/tools/bun", "/home/op", (input) => input)) // /home/op/tools/bun
 * console.log(pipe("/usr/bin/bun", resolveOperatorPath("/home/op", (input) => input))) // /usr/bin/bun
 * ```
 *
 * @param input - The path as the operator typed it; the data-last form takes it alone.
 * @param home - The operator home directory a leading `~/` expands to.
 * @param resolve - The platform path resolver applied to the expanded input.
 * @returns The absolute path systemd can run.
 * @category utilities
 * @since 0.0.0
 */
export const resolveOperatorPath: {
  (input: string, home: string, resolve: (input: string) => string): string;
  (home: string, resolve: (input: string) => string): (input: string) => string;
} = dual(3, (input: string, home: string, resolve: (input: string) => string): string =>
  resolve(Str.startsWith("~/")(input) ? `${home}/${Str.slice(2)(input)}` : input)
);

/**
 * Resolves the Bun a rendered unit runs when the operator pins none.
 *
 * **Details**
 *
 * Each {@link SystemdBunCandidate} is probed under `home` in order and the
 * first regular file this user can execute wins, so a unit installed on a
 * mise-managed workstation runs whichever Bun the repo's `mise.toml` pins on
 * the night it fires. A candidate that is missing, unreadable, a directory,
 * or a leftover without execute permission is skipped rather than pinned, so
 * the probe never fails. The installer's own `process.execPath` is the
 * fallback only when no candidate qualifies: it is one version's binary, and
 * a unit pinned to it keeps running that version after a bump, or fails
 * outright once the version is pruned.
 *
 * **Example** (Prepare a resolution under an operator home)
 *
 * ```ts
 * import { resolveSystemdBunPath } from "@beep/repo-cli/test/Systemd"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveSystemdBunPath("/home/op"))) // true
 * ```
 *
 * @param home - The operator home directory the candidates are probed under.
 * @returns The absolute path of the Bun executable the unit should run.
 * @category utilities
 * @since 0.0.0
 */
export const resolveSystemdBunPath = Effect.fn("SystemdUnit.resolveBunPath")(function* (home: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // stat follows the shim's symlink, so the executable bits are those of the
  // binary the unit would actually run.
  const found = yield* Effect.findFirst(
    A.map(SystemdBunCandidate.Options, (candidate) => path.join(home, candidate)),
    (candidate) =>
      fs.stat(candidate).pipe(
        Effect.map((info) => Eq.equals(info.type, "File") && (info.mode & 0o111) !== 0),
        Effect.orElseSucceed(constFalse)
      )
  );
  return O.getOrElse(found, () => process.execPath);
});

/**
 * Resolves the Bun a unit runs from the operator's pin or, absent one, the probe.
 *
 * **Details**
 *
 * An explicit pin is the operator's choice and is only made absolute (a
 * leading `~/` expands against `home`); the default follows
 * {@link resolveSystemdBunPath} so a Bun bump never strands the unit. Both
 * timer installers call this, so their `--bun-path` flags behave identically.
 *
 * **Example** (Prepare a pinned resolution)
 *
 * ```ts
 * import { resolveUnitBunPath } from "@beep/repo-cli/test/Systemd"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(resolveUnitBunPath({ home: "/home/op", pinned: O.some("~/tools/bun") }))) // true
 * ```
 *
 * @param options - The operator home and the optional `--bun-path` pin.
 * @returns The absolute path of the Bun executable the unit should run.
 * @category utilities
 * @since 0.0.0
 */
export const resolveUnitBunPath = Effect.fn("SystemdUnit.resolveUnitBunPath")(function* (options: {
  readonly home: string;
  readonly pinned: O.Option<string>;
}) {
  const path = yield* Path.Path;
  return yield* O.match(options.pinned, {
    onNone: () => resolveSystemdBunPath(options.home),
    onSome: (given) => Effect.succeed(resolveOperatorPath(given, options.home, path.resolve)),
  });
});

/**
 * The directory systemd reads this user's units from.
 *
 * **Example** (Locate the user unit directory)
 *
 * ```ts
 * import { systemdUserUnitDir } from "@beep/repo-cli/test/Systemd"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.map(Path.Path, (path) => systemdUserUnitDir(path, "/home/op"))
 * console.log(Effect.runSync(Effect.provide(program, NodePath.layer))) // /home/op/.config/systemd/user
 * ```
 *
 * @param path - The platform path service; the data-last form takes it alone.
 * @param home - The operator home directory.
 * @returns The absolute user unit directory.
 * @category utilities
 * @since 0.0.0
 */
export const systemdUserUnitDir: {
  (path: Path.Path, home: string): string;
  (home: string): (path: Path.Path) => string;
} = dual(2, (path: Path.Path, home: string): string => path.join(home, ".config", "systemd", "user"));

const DIRECTIVE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

// A directive is `Key=Value` with a bare identifier key; section headers have
// no `=`, and a commented-out directive fails the key pattern on its marker.
const parseSystemdDirective = (line: string): O.Option<SystemdUnitDirective> => {
  const trimmed = Str.trim(line);
  return O.flatMap(Str.indexOf("=")(trimmed), (separator) => {
    const key = Str.slice(0, separator)(trimmed);
    return DIRECTIVE_KEY_PATTERN.test(key)
      ? O.some(SystemdUnitDirective.make({ key, value: Str.trim(Str.slice(separator + 1)(trimmed)) }))
      : O.none();
  });
};

/**
 * Parses installed unit text into its directives.
 *
 * **Details**
 *
 * Section headers such as `[Service]`, blank lines, and `#` or `;` comments are
 * dropped; every other `Key=Value` line is kept in file order with its value
 * trimmed. Values are returned as written, so an `Exec*` path keeps the double
 * quotes the renderer put around it; see {@link unquoteSystemdArgument}.
 *
 * **Example** (Parse a rendered service)
 *
 * ```ts
 * import { parseSystemdUnit } from "@beep/repo-cli/test/Systemd"
 *
 * const unit = parseSystemdUnit("[Service]\nWorkingDirectory=/clones/x\n# note\n", "x.service")
 * console.log(unit.directives.map((directive) => directive.key)) // ["WorkingDirectory"]
 * ```
 *
 * @param text - The unit file text; the data-last form takes it alone.
 * @param fileName - The unit file name the text was read from.
 * @returns The unit's directives in file order.
 * @category utilities
 * @since 0.0.0
 */
export const parseSystemdUnit: {
  (text: string, fileName: string): SystemdInstalledUnit;
  (fileName: string): (text: string) => SystemdInstalledUnit;
} = dual(
  2,
  (text: string, fileName: string): SystemdInstalledUnit =>
    SystemdInstalledUnit.make({
      fileName,
      directives: A.getSomes(A.map(Str.split(text, "\n"), parseSystemdDirective)),
    })
);

/**
 * The first value of a directive, in file order.
 *
 * **Example** (Read the working directory)
 *
 * ```ts
 * import { parseSystemdUnit, systemdUnitDirective } from "@beep/repo-cli/test/Systemd"
 * import * as O from "effect/Option"
 *
 * const unit = parseSystemdUnit("WorkingDirectory=/clones/x\n", "x.service")
 * console.log(O.getOrNull(systemdUnitDirective(unit, "WorkingDirectory"))) // /clones/x
 * console.log(O.isNone(systemdUnitDirective("OnCalendar")(unit))) // true
 * ```
 *
 * @param unit - The installed unit.
 * @param key - The directive key, case-sensitive as systemd reads it.
 * @returns The value when the directive is present.
 * @category utilities
 * @since 0.0.0
 */
export const systemdUnitDirective: {
  (unit: SystemdInstalledUnit, key: string): O.Option<string>;
  (key: string): (unit: SystemdInstalledUnit) => O.Option<string>;
} = dual(
  2,
  (unit: SystemdInstalledUnit, key: string): O.Option<string> =>
    O.map(
      A.findFirst(unit.directives, (directive) => Eq.equals(directive.key, key)),
      (directive) => directive.value
    )
);

/**
 * Strips the double quotes the renderers put around `Exec*` path arguments.
 *
 * **Example** (Unquote a rendered argument)
 *
 * ```ts
 * import { unquoteSystemdArgument } from "@beep/repo-cli/test/Systemd"
 *
 * console.log(unquoteSystemdArgument('"/opt/bun 1/bin/bun"')) // /opt/bun 1/bin/bun
 * console.log(unquoteSystemdArgument("/usr/bin/bun")) // /usr/bin/bun
 * ```
 *
 * @param value - One argument as it appears in the unit.
 * @returns The argument without its surrounding quotes.
 * @category utilities
 * @since 0.0.0
 */
export const unquoteSystemdArgument = (value: string): string =>
  Str.length(value) >= 2 && Str.startsWith('"')(value) && Str.endsWith('"')(value) ? Str.slice(1, -1)(value) : value;

/**
 * The `EnvironmentFile=` path with systemd's optional leading dash removed.
 *
 * **Example** (Read an optional environment file)
 *
 * ```ts
 * import { parseSystemdUnit, systemdEnvironmentFile } from "@beep/repo-cli/test/Systemd"
 * import * as O from "effect/Option"
 *
 * const unit = parseSystemdUnit("EnvironmentFile=-/home/op/.config/beep-research/env\n", "x.service")
 * console.log(O.getOrNull(systemdEnvironmentFile(unit))) // /home/op/.config/beep-research/env
 * ```
 *
 * @param unit - The installed unit.
 * @returns The environment file path when the directive is present.
 * @category utilities
 * @since 0.0.0
 */
export const systemdEnvironmentFile = (unit: SystemdInstalledUnit): O.Option<string> =>
  O.map(systemdUnitDirective(unit, "EnvironmentFile"), (value) =>
    Str.startsWith("-")(value) ? Str.slice(1)(value) : value
  );

/**
 * Reads an installed user unit back, or `None` when it is not installed.
 *
 * **Details**
 *
 * Only the presence probe and the read can fail; a unit that does not exist is
 * an ordinary `None`, so a `--refresh` can turn it into its own "install first"
 * message rather than a platform error.
 *
 * **Example** (Prepare a read)
 *
 * ```ts
 * import { readInstalledSystemdUnit } from "@beep/repo-cli/test/Systemd"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readInstalledSystemdUnit({ home: "/home/op", fileName: "x.service" }))) // true
 * ```
 *
 * @param options - The operator home and the unit file name under its user unit directory.
 * @returns The parsed unit when installed.
 * @category utilities
 * @since 0.0.0
 */
export const readInstalledSystemdUnit = Effect.fn("SystemdUnit.readInstalledUnit")(function* (options: {
  readonly home: string;
  readonly fileName: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(systemdUserUnitDir(path, options.home), options.fileName);
  const present = yield* fs.exists(file);
  if (!present) {
    return O.none<SystemdInstalledUnit>();
  }
  return O.some(parseSystemdUnit(yield* fs.readFileString(file), options.fileName));
});
