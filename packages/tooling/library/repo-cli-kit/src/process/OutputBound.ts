/**
 * Output bounds for captured subprocess text: the character cap and its
 * retention policy, the bounded accumulator, and the fold step that keeps it
 * within the cap.
 *
 * **Details**
 *
 * This leaf holds only schemas and a pure reducer, so a caller that bounds
 * an excerpt (a gate recorder on every package check) does not load the
 * subprocess runner and its platform layers. `StepExec` re-exports every
 * symbol here, so its existing imports keep working.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliKitId.create("process/OutputBound");

/**
 * What a bound keeps once output passes its cap: the head, or the head and
 * the rolling tail.
 *
 * **Example** (Read the retention policies)
 *
 * ```ts
 * import { OutputRetention } from "@beep/repo-cli-kit/process/OutputBound"
 *
 * console.log(OutputRetention.literals) // ["head", "head-tail"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OutputRetention = LiteralKit(["head", "head-tail"]).pipe(
  $I.annoteSchema("OutputRetention", { description: "Retain the leading output or both bounded edges." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type OutputRetention = typeof OutputRetention.Type;

/**
 * **Details**
 * Head retention is the compatible default. Head-tail retention shares the
 * same character cap between the beginning and the rolling end of the output;
 * the notice is inserted between those ranges.
 *
 * **Example** (Cap captured output at 4 KiB)
 *
 * ```ts
 * import { OutputBound } from "@beep/repo-cli-kit/process/OutputBound"
 *
 * const bound = OutputBound.make({ maxChars: 4096, truncatedNotice: "\n[cli] truncated" })
 * console.log(bound.maxChars)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutputBound extends S.Opaque<OutputBound, { readonly brand: unique symbol }>()(
  S.Struct({
    maxChars: S.Finite,
    truncatedNotice: S.String,
    retention: OutputRetention.pipe(
      S.withDecodingDefaultKey(Effect.succeed(OutputRetention.Enum.head)),
      S.withConstructorDefault(Effect.succeed(OutputRetention.Enum.head))
    ),
  }).pipe(
    $I.annoteSchema("OutputBound", {
      description: "Character cap, truncation notice and backward-compatible output retention policy.",
    })
  )
) {}

/**
 * **Example** (Seed a fold accumulator)
 *
 * ```ts
 * import { BoundedOutput } from "@beep/repo-cli-kit/process/OutputBound"
 *
 * const state = BoundedOutput.make({ text: "captured", truncated: false })
 * console.log(state.truncated)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoundedOutput extends S.Opaque<BoundedOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String,
    truncated: S.Boolean,
  }).pipe(
    $I.annoteSchema("BoundedOutput", {
      description: "Accumulator produced by the bounded subprocess output fold.",
    })
  )
) {}

/**
 * Empty bounded-output accumulator seed.
 *
 * **Example** (Start a fold from the untruncated seed)
 *
 * ```ts
 * import { emptyBoundedOutput } from "@beep/repo-cli-kit/process/OutputBound"
 *
 * console.log(emptyBoundedOutput.truncated)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const emptyBoundedOutput = BoundedOutput.make({
  text: "",
  truncated: false,
});

/**
 * Reducer that appends a decoded chunk while enforcing an output bound.
 *
 * **Details**
 *
 * Head retention appends the notice once the cap is exceeded and ignores later
 * chunks. Head-tail retention keeps the leading half and rolls the remaining
 * budget over the latest output, preserving final diagnostics without growing
 * the retained text. An empty chunk does not truncate head-tail output.
 *
 * **Example** (Overflow a four-character bound)
 *
 * ```ts
 * import { boundedChunkReducer, emptyBoundedOutput, OutputBound } from "@beep/repo-cli-kit/process/OutputBound"
 *
 * const step = boundedChunkReducer(OutputBound.make({ maxChars: 4, truncatedNotice: "!" }))
 * console.log(step(emptyBoundedOutput, "abcdef"))
 * ```
 *
 * @param bound - Character cap and truncation notice to enforce.
 * @returns A fold step over `(state, chunk)`.
 * @category folding
 * @since 0.0.0
 */
export const boundedChunkReducer = (bound: OutputBound) => {
  if (bound.retention === OutputRetention.Enum["head-tail"]) {
    return (state: BoundedOutput, chunk: string): BoundedOutput => {
      if (Str.isEmpty(chunk)) return state;
      const combined = `${state.text}${chunk}`;
      if (!state.truncated && Str.length(combined) <= bound.maxChars) {
        return BoundedOutput.make({ text: combined, truncated: false });
      }
      const head = Str.takeLeft(bound.maxChars / 2)(combined);
      const tail = Str.takeRight(bound.maxChars - Str.length(head))(combined);
      return BoundedOutput.make({
        text: `${head}${bound.truncatedNotice}${tail}`,
        truncated: true,
      });
    };
  }

  return (state: BoundedOutput, chunk: string): BoundedOutput => {
    if (state.truncated) {
      return state;
    }

    const remaining = bound.maxChars - Str.length(state.text);
    if (remaining <= 0) {
      return BoundedOutput.make({
        text: `${state.text}${bound.truncatedNotice}`,
        truncated: true,
      });
    }

    if (Str.length(chunk) <= remaining) {
      return BoundedOutput.make({
        text: `${state.text}${chunk}`,
        truncated: false,
      });
    }

    return BoundedOutput.make({
      text: `${state.text}${Str.slice(0, remaining)(chunk)}${bound.truncatedNotice}`,
      truncated: true,
    });
  };
};
