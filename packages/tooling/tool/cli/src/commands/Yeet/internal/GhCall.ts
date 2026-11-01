/**
 * The one-call `gh` invocation the gate-side modules share: run `gh` from the
 * repo root, map any failure to a `YeetCommandError`, and decode the JSON it
 * printed. Reads and writes alike go through it (the merge `PUT`, the S11
 * comment `POST` and run cancels included), so nothing about the name promises
 * a side-effect-free call.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { ghOutput } from "../../../internal/github/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type * as S from "effect/Schema";
import type { GhCommandFailure } from "../../../internal/github/index.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const ghFailure = (what: string) => (failure: GhCommandFailure) =>
  YeetCommandError.make({
    message: `${what} failed (${failure._tag}${failure._tag === "nonzero-exit" ? ` ${failure.exitCode}: ${Str.trim(failure.output)}` : ""}).`,
    command: failure.command,
    exitCode: 1,
  });

/**
 * Run `gh` with these arguments from the repo root and return its stdout; a
 * spawn failure, non-zero exit or truncated capture becomes a `YeetCommandError`
 * whose message starts with `label`. The call may write (a merge `PUT`, a
 * comment `POST`), so a caller never retries it blindly.
 *
 * **Example** (Build a call)
 *
 * ```ts
 * import { yeetGh, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/x",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * console.log(typeof yeetGh(context, "gh api repos", ["api", "repos/{owner}/{repo}"])) // "object"
 * ```
 *
 * @param context - Its `repoRoot` is the working directory `gh` resolves `{owner}/{repo}` from.
 * @param label - Names the read in the failure message, such as `gh api pulls/7`.
 * @param args - The `gh` arguments after the binary name.
 * @returns The captured stdout.
 * @category execution
 * @since 0.0.0
 */
export const yeetGh = Effect.fn("Yeet.gh")(function* (
  context: RepoRunContext,
  label: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom> {
  return yield* ghOutput({ args, cwd: context.repoRoot, label, onFailure: ghFailure(label) });
});

/**
 * Decode one `gh` JSON output with a schema decoder, mapping a schema error to a
 * `YeetCommandError` that names what was being decoded.
 *
 * **Example** (Decode a pull request number)
 *
 * ```ts
 * import { decodeYeetGhOutput } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ number: S.Finite })))
 * console.log(Effect.runSync(decodeYeetGhOutput("the pull request", decode, '{"number":7}')).number) // 7
 * ```
 *
 * @param what - Names the payload in the failure message.
 * @param decode - The schema decoder for the JSON text.
 * @param input - The `gh` stdout to decode.
 * @returns The decoded value.
 * @category parsing
 * @since 0.0.0
 */
export const decodeYeetGhOutput = Effect.fn("Yeet.decodeGhOutput")(function* <A>(
  what: string,
  decode: (input: unknown) => Effect.Effect<A, S.SchemaError>,
  input: string
): Effect.fn.Return<A, YeetCommandError> {
  return yield* decode(input).pipe(Effect.mapError(YeetCommandError.new(`Failed to decode ${what}.`)));
});
