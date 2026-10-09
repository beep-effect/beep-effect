import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";

describe("fake stream regressions", () => {
	it.effect("uncorks 12000 writes in order and calls every write callback exactly once", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams();
			const stdout = fake.streams.stdout;
			const expected: Array<string> = [];
			const expectedCallbacks: Array<number> = [];
			const callbacks: Array<number> = [];
			const errors: Array<Error> = [];
			stdout.cork();
			for (let index = 0; index < 12000; index++) {
				const byte = `${index % 10}`;
				expected.push(byte);
				expectedCallbacks.push(index);
				stdout.write(byte, (error) => {
					if (error !== undefined && error !== null) errors.push(error);
					callbacks.push(index);
				});
			}
			stdout.uncork();
			yield* Effect.callback<void>((resume) => {
				stdout.end(() => resume(Effect.void));
			});
			assert.strictEqual(fake.stdout(), expected.join(""));
			assert.strictEqual(fake.written(), expected.join(""));
			assert.deepStrictEqual(callbacks, expectedCallbacks);
			assert.deepStrictEqual(errors, []);
		}),
	);

	it("completes a synchronous vector write with exactly one batch callback", () => {
		const fake = makeFakeStreams();
		const chunks: Array<{ chunk: string; encoding: BufferEncoding }> = [];
		for (let index = 0; index < 12000; index++) chunks.push({ chunk: "x", encoding: "utf8" });
		let callbacks = 0;
		fake.streams.stdout._writev?.(chunks, (error) => {
			assert.isNotOk(error);
			callbacks++;
		});
		assert.strictEqual(fake.stdout(), "x".repeat(12000));
		assert.strictEqual(callbacks, 1);
	});

	it.effect("resumes a buffered input batch after the reader releases backpressure", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams();
			const stdin = fake.streams.stdin;
			const chunks = ["a", "b", "c"].map((byte) => byte.repeat(stdin.readableHighWaterMark));
			const received: Array<string> = [];
			const callbacks: Array<number> = [];
			stdin.setEncoding("utf8");
			stdin.cork();
			for (const [index, chunk] of chunks.entries()) stdin.write(chunk, () => callbacks.push(index));
			stdin.uncork();
			assert.strictEqual(stdin.readableLength, stdin.readableHighWaterMark);
			assert.deepStrictEqual(callbacks, []);
			yield* Effect.callback<void>((resume) => {
				stdin.once("end", () => resume(Effect.void));
				stdin.on("data", (chunk: string) => received.push(chunk));
				stdin.end();
			});
			assert.strictEqual(received.join(""), chunks.join(""));
			assert.deepStrictEqual(callbacks, [0, 1, 2]);
		}),
	);

	it.effect("raw-mode ref/unref cycles keep connect listeners and warnings unchanged", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams();
			const stdin = fake.streams.stdin;
			const before = stdin.listenerCount("connect");
			const warnings: Array<Error> = [];
			const onWarning = (warning: Error): void => {
				if (warning.name === "MaxListenersExceededWarning") warnings.push(warning);
			};
			process.on("warning", onWarning);
			try {
				for (let cycle = 0; cycle < 100; cycle++) {
					assert.strictEqual(stdin.setRawMode(true), stdin);
					assert.strictEqual(stdin.ref(), stdin);
					assert.strictEqual(stdin.setRawMode(false), stdin);
					assert.strictEqual(stdin.unref(), stdin);
				}
				yield* Effect.callback<void>((resume) => {
					process.nextTick(() => resume(Effect.void));
				});
				assert.strictEqual(stdin.listenerCount("connect"), before);
				assert.strictEqual(fake.rawModes.length, 200);
				assert.isFalse(stdin.isRaw);
				assert.deepStrictEqual(warnings, []);
			} finally {
				process.off("warning", onWarning);
			}
		}),
	);
});
