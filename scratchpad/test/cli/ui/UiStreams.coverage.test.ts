import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { UiStreams } from "../../../effected/cli/ui/UiStreams.ts";

it.effect("the default service supplies the process standard streams", () =>
  Effect.gen(function* () {
    const streams = yield* UiStreams;
    assert.strictEqual(streams.stdin, process.stdin);
    assert.strictEqual(streams.stdout, process.stdout);
    assert.strictEqual(streams.stderr, process.stderr);
    assert.strictEqual(yield* UiStreams, streams);
  }),
);
