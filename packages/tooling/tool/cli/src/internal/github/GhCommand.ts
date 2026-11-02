/**
 * `gh` (GitHub CLI) invocation and GraphQL cursor pagination plumbing.
 *
 * {@link ghOutput} is the single "run gh, map a nonzero exit or a truncated
 * capture into a caller-owned error" wrapper that Yeet previously hand-rolled at
 * three call sites. It builds on the wave-1 {@link runRepoCommandCapture} so the
 * spawn, env, and capture-bound semantics stay identical; only the error mapping
 * is a parameter, keeping this module free of any command-group error type.
 *
 * What is left here has no `@beep/github` member: `gh pr view` / `gh pr checks`
 * read the current branch's pull request and gh's own check buckets, and
 * `gh repo view` is gh's base-repository resolution. The review-thread page
 * walk moved to the kit's `ReviewThread` resource (W4).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { runRepoCommandCapture } from "../repo-run/index.ts";

/**
 * A classified `gh` invocation failure handed to a caller's error mapper.
 *
 * `spawn` carries the underlying spawn failure cause; `nonzero-exit` carries the
 * exit code and captured output; `truncated` reports that captured output
 * overflowed the repo-run capture bound.
 *
 * **Example** (Classify a truncated capture)
 *
 * ```ts
 * import type { GhCommandFailure } from "@beep/repo-cli/test/SharedInternals"
 *
 * const failure: GhCommandFailure = { _tag: "truncated", label: "gh pr view", command: "gh pr view" }
 * console.log(failure._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GhCommandFailure =
  | { readonly _tag: "spawn"; readonly label: string; readonly command: string; readonly cause: unknown }
  | {
      readonly _tag: "nonzero-exit";
      readonly label: string;
      readonly command: string;
      readonly exitCode: number;
      readonly output: string;
    }
  | { readonly _tag: "truncated"; readonly label: string; readonly command: string };

/**
 * Options for {@link ghOutput}.
 *
 * @typeParam E - Caller-owned error produced from a {@link GhCommandFailure}.
 * @category models
 * @since 0.0.0
 */
export interface GhOutputOptions<E> {
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
  readonly label: string;
  readonly onFailure: (failure: GhCommandFailure) => E;
}

/**
 * Run `gh` with captured output, returning stdout on success and mapping a spawn
 * failure, nonzero exit, or truncated capture into the caller's error.
 *
 * **Example** (Fetch PR facts with a caller-owned error)
 *
 * ```ts
 * import { ghOutput } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect";
 * const program = ghOutput({
 *   args: ["pr", "view", "--json", "number,headRefName,state"],
 *   cwd: process.cwd(),
 *   label: "gh pr view",
 *   onFailure: (failure) => new Error(`${failure.label} failed (${failure._tag})`)
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param options - Command args, working directory, label, and error mapper.
 * @returns The captured stdout on a clean, non-truncated zero-exit run.
 * @category execution
 * @since 0.0.0
 */
export const ghOutput = Effect.fn("GhCommand.ghOutput")(function* <E>(options: GhOutputOptions<E>) {
  const command = A.join(["gh", ...options.args], " ");
  const result = yield* runRepoCommandCapture("gh", options.args, options.cwd).pipe(
    Effect.mapError((cause) => options.onFailure({ _tag: "spawn", label: options.label, command, cause }))
  );
  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      options.onFailure({
        _tag: "nonzero-exit",
        label: options.label,
        command,
        exitCode: result.exitCode,
        output: result.output,
      })
    );
  }
  if (result.truncated) {
    return yield* Effect.fail(options.onFailure({ _tag: "truncated", label: options.label, command }));
  }
  return result.output;
});
