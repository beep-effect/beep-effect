/**
 * Preserve selected task text across grouped native Turbo output.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CachePilotLogInput } from "./Cache.pilot.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.pilot.capture");
const UnambiguousTerminalText = S.String.check(S.isPattern(/^[^\x00-\x08\x0b-\x1f\x7f\ufffd]*$/u)).pipe(
  $I.annoteSchema("UnambiguousTerminalText", {
    description: "Terminal text without carriage returns, escape/control bytes or replacement characters.",
  })
);
const isUnambiguous = S.is(UnambiguousTerminalText);

const validatePilotStreams = Effect.fn("CachePilot.validateStreams")(function* (input: CachePilotLogInput) {
  if (
    input.truncated ||
    new TextEncoder().encode(input.stdout).byteLength > 1024 * 1024 ||
    new TextEncoder().encode(input.stderr).byteLength > 1024 * 1024 ||
    !isUnambiguous(input.stdout) ||
    !isUnambiguous(input.stderr)
  )
    return yield* CacheCommandError.new(
      "Pilot process streams are truncated, oversized or contain ambiguous terminal text."
    );
  if (!input.cacheEnabled && input.origin === "local-hit")
    return yield* CacheCommandError.new("A disabled pilot task cannot be a local hit.");
});

/**
 * Remove only the selected task's first, exactly matched Turbo progress line.
 *
 * **Details**
 * Requires native grouped output with task prefixes and separate streams.
 * Later task text is preserved verbatim, even if it resembles progress output.
 * Empty/missing groups, truncated streams and ambiguous control text fail.
 * Other tasks' prefixed output cannot become selected-task evidence.
 *
 * **Example** (Preserve task text that resembles orchestration)
 *
 * ```ts
 * import { CachePilotLogInput } from "@beep/repo-cli/commands/Cache"
 * import { extractCachePilotLog } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const input = CachePilotLogInput.make({
 *   computation: "@beep/identity#lint", taskHash: "0123456789abcdef",
 *   origin: "fresh", cacheEnabled: false, truncated: false, stderr: "",
 *   stdout: "@beep/identity:lint: cache bypass, force executing 0123456789abcdef\n" +
 *     "@beep/identity:lint: cache miss, executing 0123456789abcdef\n",
 * })
 * console.assert(Effect.isEffect(extractCachePilotLog(input)))
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const extractCachePilotLog = Effect.fn("CachePilot.extractLog")(function* (input: CachePilotLogInput) {
  yield* validatePilotStreams(input);
  const prefix = `${Str.replace("#", ":")(input.computation)}: `;
  const selectedLines = pipe(
    A.fromIterable(Str.linesWithSeparators(input.stdout)),
    A.filter(Str.startsWith(prefix)),
    A.map(Str.slice(prefix.length))
  );
  if (A.some(A.fromIterable(Str.linesWithSeparators(input.stderr)), Str.startsWith(prefix)))
    return yield* CacheCommandError.new(
      "Selected pilot output unexpectedly appeared on the orchestration error stream."
    );
  const progress =
    input.origin === "local-hit"
      ? `cache hit, replaying logs ${input.taskHash}\n`
      : input.cacheEnabled
        ? `cache miss, executing ${input.taskHash}\n`
        : `cache bypass, force executing ${input.taskHash}\n`;
  if (!O.contains(progress)(A.head(selectedLines)))
    return yield* CacheCommandError.new("Selected pilot output is missing its exact native progress boundary.");
  const text = A.join(A.drop(selectedLines, 1), "");
  if (new TextEncoder().encode(text).byteLength > 64 * 1024)
    return yield* CacheCommandError.new("Selected pilot task log exceeded its 64 KiB bound.");
  return text;
});
