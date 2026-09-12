/**
 * Schemas for what a rendered systemd user unit may carry.
 *
 * Both timer installers in the repo CLI (`beep graft deep install-timer` and
 * `beep research install-timers`) write `Exec*` lines into
 * `~/.config/systemd/user/`. The Bun candidates and the path rule live here so
 * the two units resolve and quote their executables the same way.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/systemd/SystemdUnit.schemas");

/**
 * Home-relative Bun executables a unit installer probes, in preference order.
 *
 * **Details**
 *
 * The mise shim comes first because it follows the repo's pinned Bun across
 * upgrades; a standalone `$HOME/.bun` install is the fallback. The installer's
 * own executable is used only when neither is executable and is not a member
 * here: it names one version's binary, which a later prune removes while the
 * unit still points at it.
 *
 * **Example** (Inspect probe order)
 *
 * ```ts
 * import { SystemdBunCandidate } from "@beep/repo-cli/internal/systemd"
 *
 * console.log(SystemdBunCandidate.Options) // [".local/share/mise/shims/bun", ".bun/bin/bun"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SystemdBunCandidate = LiteralKit([".local/share/mise/shims/bun", ".bun/bin/bun"]).pipe(
  $I.annoteSchema("SystemdBunCandidate", {
    description: "Home-relative Bun executables probed for a systemd user unit, in preference order.",
  })
);

/**
 * A home-relative Bun executable a unit installer may choose.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SystemdBunCandidate = typeof SystemdBunCandidate.Type;

// systemd parses Exec= arguments with its own quoting and escape rules and
// substitutes `%` specifiers and `$` variables throughout a unit, so a path
// carrying any of those characters would render a unit that runs something
// other than what the operator named.
const SYSTEMD_UNIT_PATH_PATTERN = /^[^"\\%$\p{Cc}]+$/u;

/**
 * A path that reaches a rendered systemd unit verbatim.
 *
 * **Details**
 *
 * Double quotes, backslashes, percent signs, dollar signs, and control
 * characters are refused: quoting an argument only protects whitespace, and
 * systemd would reinterpret each of those inside the quotes. Spaces are fine
 * because every `Exec*` path argument is rendered quoted.
 *
 * **Example** (Accept a spaced path and refuse a quoted one)
 *
 * ```ts
 * import { SystemdUnitPath } from "@beep/repo-cli/internal/systemd"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SystemdUnitPath)("/opt/bun 1/bin/bun")) // true
 * console.log(S.is(SystemdUnitPath)('/opt/"bun"/bin/bun')) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SystemdUnitPath = S.String.check(S.isPattern(SYSTEMD_UNIT_PATH_PATTERN)).pipe(
  $I.annoteSchema("SystemdUnitPath", {
    description:
      "Path free of the quote, escape, specifier, and control characters systemd would reinterpret in a unit.",
  })
);

/**
 * A path accepted into a rendered systemd unit.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SystemdUnitPath = typeof SystemdUnitPath.Type;
