/**
 * Secret redaction for command argv and captured output before it reaches
 * errors, logs or traces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { constant, dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";

/**
 * The placeholder every redaction writes in place of a secret.
 *
 * **Example** (Inspect the secret placeholder)
 *
 * ```ts
 * import { REDACTED } from "@beep/commands/Redaction";
 *
 * console.log(REDACTED) // ***
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const REDACTED = "***";

/**
 * Argument tokens whose *following* positional (or `=`-joined value) is a
 * secret. Lowercase; matching is case-insensitive.
 *
 * **Gotchas**
 *
 * This is the heuristic backstop, not the primary mechanism — it can only know
 * about flags someone thought to list. The primary mechanism is
 * {@link Redaction.applyArgs}, which redacts by **value**: the caller says what
 * its secrets are and every occurrence goes, whatever flag carried it.
 *
 * **Example** (Recognize a secret flag)
 *
 * ```ts
 * import { SECRET_FLAGS } from "@beep/commands/Redaction";
 * import * as HashSet from "effect/HashSet";
 *
 * console.log(HashSet.has(SECRET_FLAGS, "--token")) // true
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const SECRET_FLAGS: HashSet.HashSet<string> = HashSet.fromIterable([
  "--access-token",
  "--api-key",
  "--auth",
  "--auth-token",
  "--otp",
  "--password",
  "--registry-token",
  "--token",
]);

const NPM_AUTH_CONFIG_KEY = /:(?:_authtoken|_password)$/i;

const longestFirstNonEmpty = (secrets: ReadonlyArray<Redacted.Redacted<string>>): ReadonlyArray<string> =>
  A.sort(
    A.filter(A.dedupe(A.map(secrets, Redacted.value)), (value) => value.length > 0),
    Order.mapInput(Order.flip(Order.Number), (value: string) => value.length)
  );

const replaceLiterally: {
  (text: string, values: ReadonlyArray<string>): string;
  (values: ReadonlyArray<string>): (text: string) => string;
} = dual(2, (text: string, values: ReadonlyArray<string>): string => {
  let out = text;
  for (const value of values) {
    out = A.join(Str.split(value)(out), REDACTED);
  }
  return out;
});

const apply: {
  (text: string, secrets: ReadonlyArray<Redacted.Redacted<string>>): string;
  (secrets: ReadonlyArray<Redacted.Redacted<string>>): (text: string) => string;
} = dual(2, (text: string, secrets: ReadonlyArray<Redacted.Redacted<string>>): string =>
  secrets.length === 0 ? text : replaceLiterally(text, longestFirstNonEmpty(secrets))
);

const applyArgs: {
  (args: ReadonlyArray<string>, secrets: ReadonlyArray<Redacted.Redacted<string>>): ReadonlyArray<string>;
  (secrets: ReadonlyArray<Redacted.Redacted<string>>): (args: ReadonlyArray<string>) => ReadonlyArray<string>;
} = dual(2, (args: ReadonlyArray<string>, secrets: ReadonlyArray<Redacted.Redacted<string>>): ReadonlyArray<string> => {
  if (secrets.length === 0) return args;
  return A.map(args, replaceLiterally(longestFirstNonEmpty(secrets)));
});

const isSecretName: {
  (name: string, extra: HashSet.HashSet<string>): boolean;
  (extra: HashSet.HashSet<string>): (name: string) => boolean;
} = dual(2, (name: string, extra: HashSet.HashSet<string>): boolean => {
  const lower = Str.toLowerCase(name);
  return HashSet.has(SECRET_FLAGS, lower) || HashSet.has(extra, lower) || NPM_AUTH_CONFIG_KEY.test(name);
});

const scrubArgAt = (
  args: ReadonlyArray<string>,
  index: number,
  extra: HashSet.HashSet<string>,
  out: Array<string>
): number => {
  const arg = args[index] ?? "";
  const equals = pipe(arg, Str.indexOf("="), O.getOrElse(constant(-1)));
  if (equals > 0 && isSecretName(Str.slice(0, equals)(arg), extra)) {
    out.push(`${Str.slice(0, equals)(arg)}=${REDACTED}`);
    return index + 1;
  }
  out.push(arg);
  const hasFollowingValue = index + 1 < args.length;
  if (isSecretName(arg, extra) && hasFollowingValue) {
    out.push(REDACTED);
    return index + 2;
  }
  return index + 1;
};

const scrubArgs: {
  (
    args: ReadonlyArray<string>,
    options?: { readonly flags?: ReadonlyArray<string> | undefined }
  ): ReadonlyArray<string>;
  (options?: {
    readonly flags?: ReadonlyArray<string> | undefined;
  }): (args: ReadonlyArray<string>) => ReadonlyArray<string>;
} = dual(
  (args) => A.isArray(args[0]),
  (
    args: ReadonlyArray<string>,
    options?: { readonly flags?: ReadonlyArray<string> | undefined }
  ): ReadonlyArray<string> => {
    const extra = HashSet.fromIterable(A.map(options?.flags ?? [], Str.toLowerCase));
    const out: Array<string> = [];
    for (let index = 0; index < args.length; ) {
      index = scrubArgAt(args, index, extra, out);
    }
    return out;
  }
);

/**
 * Secret scrubbing for command arguments and captured output.
 *
 * **Details**
 *
 * Two mechanisms, deliberately layered. {@link Redaction.apply} and
 * {@link Redaction.applyArgs} redact **by value** — the caller declares its
 * secrets as `Redacted` and every occurrence is removed wherever it appears.
 * {@link Redaction.scrubArgs} is a **flag heuristic** that runs in addition, for
 * the secrets a caller forgot to declare.
 *
 * **Example** (Scrub an inline credential)
 *
 * ```ts
 * import { Redaction } from "@beep/commands/Redaction";
 *
 * console.log(Redaction.scrubArgs(["--token=abc"]).join(" ")) // --token=***
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class Redaction {
  private constructor() {}

  /**
   * Replaces every occurrence of every secret's value in `text` with
   * {@link REDACTED}.
   *
   * **Gotchas**
   *
   * Exact, literal matching — no pattern compilation, no encoding-aware search. A
   * secret that reaches the text base64-encoded, URL-encoded, or split across a
   * line break is **not** found; declare the encoded form as a secret too if that
   * is a real risk.
   *
   * A secret composed only of the placeholder's own characters (`*`, `**`, `***`)
   * cannot be fully removed, because the replacement reintroduces it. That is a
   * documented limitation, not a defect.
   *
   * **Example** (Remove a declared secret from output)
   *
   * ```ts
   * import { Redaction } from "@beep/commands/Redaction";
   * import * as Redacted from "effect/Redacted";
   *
   * console.log(Redaction.apply("token=abc", [Redacted.make("abc")])) // token=***
   * ```
   *
   * @since 0.0.0
   */
  static readonly apply = apply;

  /**
   * {@link Redaction.apply} over each entry of an argv array. An entry is
   * redacted whether it *is* a secret or merely *contains* one
   * (`--url=https://u:s3cr3t@host`).
   *
   * **Example** (Remove a secret embedded in an argument)
   *
   * ```ts
   * import { Redaction } from "@beep/commands/Redaction";
   * import * as Redacted from "effect/Redacted";
   *
   * console.log(Redaction.applyArgs(["--url=https://u:s3cr3t@host"], [Redacted.make("s3cr3t")]).join(" ")) // --url=https://u:***@host
   * ```
   *
   * @since 0.0.0
   */
  static readonly applyArgs = applyArgs;

  /**
   * Heuristic backstop: redact any argv value that is introduced by a known
   * secret-bearing flag or npm auth key, in either the separated
   * (`--token abc`) or inline (`--token=abc`) form.
   *
   * **Gotchas**
   *
   * This catches secrets the caller forgot to declare; it cannot catch a flag
   * nobody listed. Prefer {@link Redaction.applyArgs} with the actual
   * `Redacted` values — this runs *in addition*, never instead.
   *
   * **Example** (Scrub separated and inline credentials)
   *
   * ```ts
   * import { Redaction } from "@beep/commands/Redaction";
   *
   * console.log(Redaction.scrubArgs(["--token", "abc", "--password=xyz"]).join(" ")) // --token *** --password=***
   * ```
   *
   * @since 0.0.0
   */
  static readonly scrubArgs = scrubArgs;

  /**
   * Flags treated as secret-bearing by {@link Redaction.scrubArgs}. See {@link SECRET_FLAGS}.
   *
   * **Example** (Inspect the class secret flag set)
   *
   * ```ts
   * import { Redaction } from "@beep/commands/Redaction";
   * import * as HashSet from "effect/HashSet";
   *
   * console.log(HashSet.has(Redaction.SECRET_FLAGS, "--password")) // true
   * ```
   *
   * @since 0.0.0
   */
  static readonly SECRET_FLAGS = SECRET_FLAGS;
}
