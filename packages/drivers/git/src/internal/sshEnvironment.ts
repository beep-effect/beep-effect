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

const BATCH_MODE = "-o BatchMode=yes";

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

const DECIDES_BATCH_MODE = /(?:^|\s)-o\s*["']?\s*BatchMode\s*[=\s]/i;

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
