/**
 * Pure prompt-suppression and conservative SSH command policy for Git spawns.
 * Repository config acquisition and precedence resolution belong to
 * internal/execution.ts; this module applies the resolved command policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as O from "@beep/utils/Option";
import * as HashSet from "effect/HashSet";
import * as Str from "effect/String";

/**
 * The environment EVERY `Git` invocation is spawned with. A network-touching
 * member adds one more key on top, resolved per call — see {@link sshEnv}.
 *
 * **Details**
 *
 * These pins serve runtime error classification and prompt suppression. The
 * pure `GitCommand` constructors carry no runtime environment.
 *
 * - `LC_ALL=C` — `classify` matches untranslated stderr text
 *   (`"not a git repository"`, `"unknown revision"`). A localized message silently
 *   misclassifies into `GitCommandError` instead of the typed domain error.
 * - `GIT_TERMINAL_PROMPT=0` — git's own credential prompt. Without it a
 *   network-touching member against a credential-requiring remote blocks
 *   until `GIT_TIMEOUT` fires.
 * - `GIT_ASKPASS=""` — the askpass chain, which `GIT_TERMINAL_PROMPT=0` does
 *   NOT close. Probed against git 2.55: an empty `GIT_ASKPASS` is a hard
 *   stop, not a fall-through — it suppresses a configured `core.askPass` and
 *   `SSH_ASKPASS` too, so this single key closes all three routes to a
 *   blocking credential dialog.
 * - `SSH_ASKPASS_REQUIRE="never"` — defense in depth for the ssh path. With
 *   `BatchMode=yes` below, `ssh` never asks and never reaches an askpass
 *   helper; this still matters for an ssh command {@link withBatchMode}
 *   declines to touch.
 *
 * **Example** (Inspect the SSH environment policy)
 *
 * ```ts
 * import { BASE_ENV } from "@beep/git/internal/sshEnvironment";
 * console.log(BASE_ENV.GIT_TERMINAL_PROMPT); // "0"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const BASE_ENV = {
  LC_ALL: "C",
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  SSH_ASKPASS_REQUIRE: "never",
} as const;

/**
 * `ssh` reads a key passphrase and a host-key confirmation from `/dev/tty`
 * DIRECTLY, so neither `GIT_TERMINAL_PROMPT` nor any askpass pin reaches
 * them; `-o BatchMode=yes` is the only lever that makes `ssh` fail instead of
 * block. Probed against OpenSSH under a real pty: with the askpass chain
 * closed but no `BatchMode`, a first-contact host key hangs indefinitely;
 * with `BatchMode=yes` the same call fails immediately with
 * `"Host key verification failed."`.
 */
const BATCH_MODE = "-o BatchMode=yes";

/**
 * Matches an ssh command this package is willing to append an option to: the
 * program's basename is `ssh`, mirroring git's own basename-driven variant
 * detection.
 */
const OPENSSH_PROGRAM = /(?:^|[\\/])ssh(?:\.exe)?$/i;

/**
 * `ssh.variant` / `GIT_SSH_VARIANT` values under which this package is willing
 * to treat the command as OpenSSH. `auto` means "infer from the basename",
 * which is the inference {@link OPENSSH_PROGRAM} performs.
 *
 * **Gotchas**
 *
 * This exists because the basename inference is OVERRIDABLE, and the override
 * silently changes the argument grammar. Verified against git 2.55: a program
 * literally named `ssh` with `ssh.variant=plink` set is invoked with plink's
 * `-P` rather than OpenSSH's `-p`, and without `-o SendEnv=...`. Appending
 * `-o BatchMode=yes` to that would break an invocation that worked before.
 *
 * It is an allow-list, and so **deliberately narrower than git**, which
 * resolves any UNRECOGNIZED value to OpenSSH rather than rejecting it — also
 * verified against git 2.55, where `ssh.variant=openssh` and an outright typo
 * both produce the OpenSSH grammar. Two divergences follow, and both forgo
 * the pin rather than corrupt a command, which is the direction to err in:
 * a misspelled variant declines here where git would have accepted it, and a
 * set-but-empty `GIT_SSH_VARIANT` — which git reads as "OpenSSH, and skip the
 * config entirely" — is treated here as absent, so a `plink` in the config
 * can still decline it. Widening this to a deny-list of the known non-OpenSSH
 * variants would match git exactly today, at the cost of appending blindly to
 * whatever variant git adds next.
 *
 * **Example** (Inspect the SSH environment policy)
 *
 * ```ts
 * import { OPENSSH_VARIANTS } from "@beep/git/internal/sshEnvironment";
 * import * as HashSet from "effect/HashSet";
 * console.log(HashSet.has(OPENSSH_VARIANTS, "plink")); // false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENSSH_VARIANTS = HashSet.make("", "auto", "ssh");

/**
 * Whether an ssh command line already decides `BatchMode` for itself.
 *
 * **Details**
 *
 * Deliberately matches `BatchMode` only where it is an OPTION — after a `-o`,
 * with or without intervening space or quoting, and taking either the
 * `Key=value` or the `"Key value"` spelling `ssh -o` accepts. A bare
 * occurrence of the word does not count: `ssh -F /tmp/BatchMode` names a
 * config file and decides nothing, and treating it as a decision would skip
 * the pin for a caller who never asked to be prompted.
 *
 * A miss in the other direction is harmless, which is why this errs toward
 * matching less: because OpenSSH honors the first value obtained, appending
 * after a spelling this does not recognize is inert rather than overriding —
 * the caller's own value still wins.
 */
const DECIDES_BATCH_MODE = /(?:^|\s)-o\s*["']?\s*BatchMode\s*[=\s]/i;

/**
 * The program an ssh command line invokes, as git's shell would see it.
 *
 * **Details**
 *
 * `GIT_SSH_COMMAND` is interpreted by the shell, so the program may be
 * QUOTED to carry spaces — `"/opt/my tools/ssh" -i key` is a working setup
 * (verified against git 2.55). Splitting on whitespace alone would read that
 * as `"/opt/my`, fail to recognize ssh, and silently skip the pin.
 *
 * This is quote-aware, not shell-aware: it does not expand variables, honor
 * escapes, or handle a command built by shell operators. Anything it cannot
 * read confidently comes back `undefined` and the caller's command is left
 * strictly alone — the safe direction, since declining only forgoes the new
 * protection where mangling would break a working remote.
 */
/** A leading quoted program: the opening quote, then everything up to the first matching quote. */
const QUOTED_PROGRAM = /^(["'])([\s\S]*?)\1/;

const sshProgram = (command: string): string | undefined => {
  const quote = command[0];
  if (quote === '"' || quote === "'") {
    const quoted = QUOTED_PROGRAM.exec(command);
    return quoted === null ? undefined : quoted[2];
  }
  return Str.split(/\s+/)(command)[0];
};

/**
 * Appends `-o BatchMode=yes` to an ssh command line, or declines.
 *
 * **Gotchas**
 *
 * Declining is the important half, and it covers two cases where appending
 * would do harm rather than good:
 *
 * - **The program is not OpenSSH.** `plink` (PuTTY) has no `-o KEY=VALUE`
 *   form at all — its non-interactive switch is `-batch` — so appending two
 *   tokens breaks a previously working setup outright instead of degrading.
 *   The same goes for a wrapper script taking positional arguments. git
 *   itself dispatches on the program's basename; this mirrors that, and
 *   anything unrecognized is left strictly alone.
 * - **The caller already decides `BatchMode`.** OpenSSH takes the FIRST value
 *   obtained for a repeated option (`ssh_config(5)`; verified against
 *   OpenSSH 10.3 with `ssh -G`), so an append after the caller's own
 *   `-o BatchMode=no` is silently inert. Rather than pretend otherwise, the
 *   caller's decision stands and no pin is applied — a caller who explicitly
 *   asked to be prompted owns the resulting wait.
 */
const withBatchMode = (command: string): O.Option<string> => {
  const trimmed = Str.trim(command);
  const program = sshProgram(trimmed);
  if (program === undefined || !OPENSSH_PROGRAM.test(program) || DECIDES_BATCH_MODE.test(trimmed)) {
    return O.none();
  }
  return O.some(`${trimmed} ${BATCH_MODE}`);
};

/**
 * The spawn environment for a network-touching member: {@link BASE_ENV} plus
 * a `GIT_SSH_COMMAND` carrying `BatchMode`, when there is an ssh command
 * worth pinning.
 *
 * **Details**
 *
 * `resolved` is the ssh COMMAND git would have used if this package pinned
 * nothing. Resolving it first is what makes the pin additive rather than
 * destructive: a pinned environment key wins over the merged parent
 * environment AND over `core.sshCommand` and `GIT_SSH` in git's own
 * precedence order, so pinning a bare `ssh` would silently discard a
 * configured identity file and turn "prompts for a passphrase" into "cannot
 * reach the remote at all" — a worse failure than the one being fixed, and
 * the one this design set out to avoid.
 *
 * `GIT_SSH` never reaches here, deliberately. It is the third rung of that
 * precedence order (`GIT_SSH_COMMAND` \> `core.sshCommand` \> `GIT_SSH` \> plain
 * `ssh`, verified against git 2.55), but it names a PROGRAM and supports no
 * arguments — appending to it would have git invoke a program of that literal
 * name. So when `GIT_SSH` is the deciding rung, `Git.layer`'s resolution
 * declines to pin at all rather than displace it, exactly as it declines for
 * plink. `GIT_TERMINAL_PROMPT` and `GIT_ASKPASS` still apply to those callers;
 * only the ssh-level pin is skipped.
 *
 * **Example** (Inspect the SSH environment policy)
 *
 * ```ts
 * import { sshEnv } from "@beep/git/internal/sshEnvironment";
 * console.log(sshEnv("ssh -i key").GIT_SSH_COMMAND); // "ssh -i key -o BatchMode=yes"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const sshEnv = (resolved: string): Record<string, string> =>
  O.match(withBatchMode(resolved), {
    onNone: () => ({ ...BASE_ENV }),
    onSome: (pinned) => ({ ...BASE_ENV, GIT_SSH_COMMAND: pinned }),
  });
