import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeFakeStreams } from "../../../../effected/cli/ui/testing/fakeStreams.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("captured output preserves chunks and cross-stream order", [Arbitrary.schema(S.String.pipe(S.Array))], ([chunks]) => Effect.sync(() => {
  const fake = makeFakeStreams();
  const stdout: Array<string> = [];
  const stderr: Array<string> = [];
  for (const [index, chunk] of chunks.entries()) {
    if (index % 2 === 0) {
      fake.streams.stdout.write(chunk);
      stdout.push(chunk);
    } else {
      fake.streams.stderr.write(chunk);
      stderr.push(chunk);
    }
  }
  assert.strictEqual(fake.stdout(), stdout.join(""));
  assert.strictEqual(fake.stderr(), stderr.join(""));
  assert.strictEqual(fake.written(), chunks.join(""));
}), runs);
