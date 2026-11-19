/**
 * The summary of output a run wrote around its runner's console capture, and
 * the note a console prints for it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import { Count } from "./Scalars.ts";
import { OutputStream } from "./Vocabulary.ts";

const $I = $GateReportId.create("StrayOutput");

/**
 * One sampled stray line and the stream it went to.
 *
 * **Example** (Build a sample)
 *
 * ```ts
 * import { StrayOutputSample } from "@beep/gate-report/StrayOutput";
 *
 * const sample = StrayOutputSample.make({ stream: "stdout", text: "hello" });
 * console.log(sample.text); // hello
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class StrayOutputSample extends S.Opaque<StrayOutputSample, { readonly brand: unique symbol }>()(
  S.Struct({
    stream: OutputStream,
    text: S.String,
  }).pipe(
    $I.annoteSchema("StrayOutputSample", {
      description: "One sampled stray output line and the stream it was written to.",
    })
  )
) {}

/**
 * Per-stream line counts, the bytes written and the first sampled lines.
 *
 * **Example** (Build a summary)
 *
 * ```ts
 * import { StrayOutput } from "@beep/gate-report/StrayOutput";
 *
 * const stray = StrayOutput.make({ total: 1, stdout: 1, stderr: 0, bytes: 6, samples: [] });
 * console.log(stray.total); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class StrayOutput extends S.Opaque<StrayOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    total: Count,
    stdout: Count,
    stderr: Count,
    bytes: Count,
    samples: S.Array(StrayOutputSample),
  }).pipe(
    $I.annoteSchema("StrayOutput", {
      description: "Output a run wrote directly to stdout or stderr, around the runner's console capture.",
    })
  )
) {}

const MAX_NOTE_SAMPLES = 3;

const streamsOf = (stray: StrayOutput): string =>
  stray.stdout > 0 && stray.stderr > 0 ? "stdout and stderr" : stray.stdout > 0 ? "stdout" : "stderr";

/**
 * The note a console prints for stray output: one line naming the count, the
 * streams, the usual cause and the fix, then up to three samples and how many
 * lines it left out.
 *
 * **Example** (Render the note)
 *
 * ```ts
 * import { StrayOutput, strayOutputNote } from "@beep/gate-report/StrayOutput";
 *
 * const lines = strayOutputNote(StrayOutput.make({ total: 2, stdout: 2, stderr: 0, bytes: 12, samples: [] }));
 * console.log(lines.length); // 1
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const strayOutputNote = (stray: StrayOutput): ReadonlyArray<string> => {
  const shown = A.take(stray.samples, MAX_NOTE_SAMPLES);
  const more = stray.total - shown.length;
  const head = `Stray output: tests wrote ${stray.total} ${stray.total === 1 ? "line" : "lines"} directly to ${streamsOf(stray)}, bypassing the runner's console capture. A child process with inherited stdio is the usual cause; pass \`stdio: "pipe"\`.`;
  return pipe(
    [head],
    A.appendAll(A.map(shown, (sample) => `  ${sample.stream}: ${sample.text}`)),
    A.appendAll(more > 0 && shown.length > 0 ? [`  (+${more} more)`] : [])
  );
};
