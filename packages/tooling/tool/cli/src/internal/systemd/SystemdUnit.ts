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
import { SystemdBunCandidate } from "./SystemdUnit.schemas.ts";

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
