// A real process for CliUi.live.exit.test.ts: an interactive live view on in-memory streams, its tick running, inside a
// scope that closes after 200 ms. The parent measures how long the process takes to exit once the scope has closed:
// a tick left running on a ref'd timer would hold it open (okf/decisions/live-tick-is-a-scoped-schedule.md), so a prompt exit is the proof that it was not.
import { Effect, Queue, Stream } from "effect";
import { Text } from "ink";
import { createElement } from "react";
import { CliInteractive, CliTheme } from "../../src/index.js";
import { makeFakeStreams } from "../../src/ui/testing/fakeStreams.js";
// The live module and the streams reference, not the ./ui barrel: the live view needs nothing more.
import { live } from "../../src/ui/CliUiLive.js";
import { UiStreams } from "../../src/ui/UiStreams.js";

const fake = makeFakeStreams({ columns: 40, rows: 10 });
const frames = new Set<number>();

const program = Effect.scoped(
	Effect.gen(function* () {
		const queue = yield* Queue.unbounded<string>();
		yield* live({
			events: Stream.fromQueue(queue),
			initial: 0,
			reduce: (count) => count + 1,
			render: (count, frame) => {
				frames.add(frame);
				return createElement(Text, null, `events ${count}`);
			},
			isStart: () => true,
			isTerminal: () => false,
			tickMillis: 20,
		});
		yield* Queue.offer(queue, "go");
		yield* Effect.sleep("200 millis");
	}),
).pipe(
	Effect.provideService(UiStreams, fake.streams),
	Effect.provideService(CliInteractive, true),
	Effect.provide(CliTheme.layerTest()),
);

await Effect.runPromise(program);
process.stdout.write(`closed ${Date.now()} frames ${frames.size}\n`);
