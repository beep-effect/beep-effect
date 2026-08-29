/**
 * CLI option-injection guard for child-process argument vectors.
 *
 * When a CLI forwards user- or data-derived values as arguments to a spawned
 * child process (for example through `effect/unstable/process`'
 * `ChildProcess.make(command, args)` or `Command.make`), an argument whose text
 * begins with `-` can be silently reinterpreted by the spawned program as an
 * option/flag rather than as the intended literal positional value. This is the
 * classic argument-injection footgun (e.g. a value of `--privileged`, `-rf`, or
 * `--output=/etc/passwd` slipping into a `docker`/`rm`/`curl` argument vector).
 *
 * This module provides two complementary mitigations:
 *
 * 1. {@link insertEndOfOptions} / {@link toLiteralArgs} — insert the POSIX
 *    end-of-options separator (`--`) before positional/data arguments so every
 *    following token is consumed literally. Pure and total: option-like values
 *    are safely passed through as literals.
 * 2. {@link guardLiteralArg} / {@link guardLiteralArgs} — validate a value and
 *    fail closed with {@link OptionInjectionError} when it is option-like, for
 *    callers that must reject rather than neutralize such values.
 *
 * The helpers operate on the argument vector only and never quote or escape for
 * a shell; they assume the repo's spawn-without-a-shell approach where the
 * command and each argument are passed as discrete `argv` entries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { OptionInjectionError } from "./errors/OptionInjectionError.ts";

const $I = $RepoUtilsId.create("ProcessArgs");

/**
 * Public option-injection guard error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { OptionInjectionError } from "./errors/OptionInjectionError.ts";

/**
 * The POSIX end-of-options separator.
 *
 * **Details**
 *
 * Most well-behaved CLIs treat the first bare `--` token as the end of option
 * parsing: every subsequent token is consumed as a literal positional argument,
 * even when it begins with `-`.
 *
 * **Example** (Bare double-dash separator)
 *
 * ```ts
 * import { END_OF_OPTIONS } from "@beep/repo-utils/ProcessArgs"
 * const argv = ["rm", END_OF_OPTIONS, "-rf"]
 * console.log(argv.join(" "))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const END_OF_OPTIONS = "--" as const;

/**
 * Predicate that reports whether a value is shaped like a command-line option.
 *
 * **Details**
 *
 * A value is considered option-like when it is non-empty and begins with `-`
 * (covering both short `-x` and long `--flag` forms, as well as the bare `--`
 * separator). Such a value risks being reinterpreted as a flag if forwarded
 * into an argument vector ahead of an end-of-options separator.
 *
 * Pure and total.
 *
 * **Example** (Detect option-like values)
 *
 * ```ts
 * import { isOptionLike } from "@beep/repo-utils/ProcessArgs"
 * console.log(isOptionLike("--privileged"))
 * console.log(isOptionLike("graphiti-mcp-falkordb-1"))
 * ```
 *
 * @param value - Candidate argument value.
 * @returns `true` when the value is shaped like an option/flag.
 * @category predicates
 * @since 0.0.0
 */
export const isOptionLike = (value: string): boolean => Str.isNonEmpty(value) && Str.startsWith(value, "-");

const isNotOptionLike = (value: unknown): boolean => P.isString(value) && !isOptionLike(value);

/**
 * Insert the end-of-options separator (`--`) between option-position arguments
 * and data-derived positional arguments, guaranteeing every data argument is
 * consumed literally by the spawned process.
 *
 * **Details**
 *
 * The separator is inserted exactly once. If `optionArgs` already ends with a
 * bare `--`, no second separator is appended. When `dataArgs` is empty, the
 * input is returned unchanged (an empty vector never needs a separator).
 *
 * Pure and total: option-like data values are not rejected here — they are made
 * safe by position. Use {@link guardLiteralArgs} instead when option-like data
 * must be rejected.
 *
 * **Example** (Protect data args with separator)
 *
 * ```ts
 * import { insertEndOfOptions } from "@beep/repo-utils/ProcessArgs"
 * // docker restart -- <containerA> <containerB>
 * const args = insertEndOfOptions(["restart"], ["graphiti-mcp-falkordb-1", "graphiti-mcp-graphiti-mcp-1"])
 * console.log(args)
 * ```
 *
 * @param optionArgs - Arguments that may legitimately contain options/flags
 *   (e.g. `["compose", "-f", composeFile]`), emitted before the separator.
 * @param dataArgs - Data-derived positional arguments to protect, emitted after
 *   the separator.
 * @returns A single argument vector with `--` inserted before the data args.
 * @category combinators
 * @since 0.0.0
 */
export const insertEndOfOptions: {
  (optionArgs: ReadonlyArray<string>, dataArgs: ReadonlyArray<string>): ReadonlyArray<string>;
  (dataArgs: ReadonlyArray<string>): (optionArgs: ReadonlyArray<string>) => ReadonlyArray<string>;
} = dual(2, (optionArgs: ReadonlyArray<string>, dataArgs: ReadonlyArray<string>): ReadonlyArray<string> => {
  if (A.isReadonlyArrayEmpty(dataArgs)) {
    return optionArgs;
  }

  const alreadyTerminated = pipe(
    A.last(optionArgs),
    O.exists((last) => last === END_OF_OPTIONS)
  );

  return alreadyTerminated ? [...optionArgs, ...dataArgs] : [...optionArgs, END_OF_OPTIONS, ...dataArgs];
});

/**
 * Prefix a list of data-derived positional arguments with the end-of-options
 * separator so the spawned process consumes every value literally.
 *
 * **Details**
 *
 * This is the convenience form of {@link insertEndOfOptions} for the common
 * case where the entire argument vector is data and no preceding options exist.
 * Pure and total.
 *
 * **Example** (Prefix data args with separator)
 *
 * ```ts
 * import { toLiteralArgs } from "@beep/repo-utils/ProcessArgs"
 * // rm -- <userSuppliedPath>
 * const args = toLiteralArgs(["-rf"])
 * console.log(args)
 * ```
 *
 * @param dataArgs - Data-derived positional arguments to protect.
 * @returns The argument vector prefixed with `--`, or an empty vector unchanged.
 * @category combinators
 * @since 0.0.0
 */
export const toLiteralArgs = (dataArgs: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(dataArgs) ? dataArgs : pipe(dataArgs, A.prepend(END_OF_OPTIONS));

/**
 * Validate a single data-derived argument value, failing closed when it is
 * shaped like a command-line option.
 *
 * **Details**
 *
 * Use this when an option-like data value indicates a programming error or an
 * injection attempt that must be surfaced rather than neutralized. For callers
 * that prefer to safely pass option-like values through as literals, use
 * {@link toLiteralArgs} / {@link insertEndOfOptions} instead.
 *
 * **Example** (Reject option-like single arg)
 *
 * ```ts
 * import { guardLiteralArg } from "@beep/repo-utils/ProcessArgs"
 * const program = guardLiteralArg("graphiti-mcp-falkordb-1")
 * console.log(program)
 * ```
 *
 * @param value - Candidate argument value.
 * @returns An Effect that succeeds with the value when it is a safe literal, or
 *   fails with {@link OptionInjectionError} when it is option-like.
 * @effects Performs in-memory argument validation only; no child process is
 * spawned and option-like values fail through the typed `OptionInjectionError`
 * channel.
 * @category guards
 * @since 0.0.0
 */
export const guardLiteralArg: (value: string) => Effect.Effect<string, OptionInjectionError> = Effect.fn(
  "ProcessArgs.guardLiteralArg"
)(function* (value: string) {
  if (isOptionLike(value)) {
    return yield* OptionInjectionError.make({
      value,
      message: `Refusing to forward option-like child-process argument "${value}".`,
    });
  }
  return value;
});

/**
 * Validate a list of data-derived argument values, failing closed on the first
 * value that is shaped like a command-line option.
 *
 * **Details**
 *
 * On success the original vector is returned unchanged, ready to be appended to
 * a child-process argument vector. On failure the returned
 * {@link OptionInjectionError} names the offending value.
 *
 * **Example** (Reject option-like arg list)
 *
 * ```ts
 * import { guardLiteralArgs } from "@beep/repo-utils/ProcessArgs"
 * const program = guardLiteralArgs(["src/index.ts", "src/ProcessArgs.ts"])
 * console.log(program)
 * ```
 *
 * @param values - Candidate argument values.
 * @returns An Effect that succeeds with the validated vector, or fails with
 *   {@link OptionInjectionError} for the first option-like value.
 * @category guards
 * @since 0.0.0
 */
export const guardLiteralArgs: (
  values: ReadonlyArray<string>
) => Effect.Effect<ReadonlyArray<string>, OptionInjectionError> = Effect.fn("ProcessArgs.guardLiteralArgs")(function* (
  values: ReadonlyArray<string>
) {
  yield* Effect.forEach(values, guardLiteralArg, { discard: true });
  return values;
});

/**
 * Schema for a child-process argument value that is guaranteed not to be shaped
 * like a command-line option.
 *
 * **Details**
 *
 * Decoding rejects option-like inputs (non-empty values beginning with `-`),
 * making it suitable for validating data-derived argument values at a boundary
 * before they are forwarded into a spawned argument vector. The decoded value
 * is the input string unchanged.
 *
 * **Example** (Decode safe literal argument)
 *
 * ```ts
 * import { LiteralArg } from "@beep/repo-utils/ProcessArgs"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownSync(LiteralArg)
 * console.log(decode("graphiti-mcp-falkordb-1"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LiteralArg = S.String.check(
  S.makeFilter(isNotOptionLike, {
    identifier: $I`LiteralArgNotOptionLikeCheck`,
    title: "Literal Arg Not Option Like",
    description: "A child-process argument value that is not shaped like a command-line option/flag.",
    message: "Child-process argument must not be shaped like a command-line option",
  })
).pipe(
  $I.annoteSchema("LiteralArg", {
    description:
      "A child-process argument value that is not shaped like a command-line option, safe to forward into a spawned argument vector.",
  })
);
