import { assert, describe, it } from "@effect/vitest";
import { Effect, Schedule } from "effect";
import { Text, render } from "ink";
import { createElement } from "react";
import { holder, holderSlot } from "../../../effected/cli/ui/internal/Holder.ts";
import { loadInk } from "../../../effected/cli/ui/internal/ink.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";

const until = (ready: () => boolean): Effect.Effect<void> =>
	Effect.suspend(() => (ready() ? Effect.void : Effect.fail("not yet"))).pipe(
		Effect.retry(Schedule.spaced("5 millis")),
		Effect.timeout("1 second"),
		Effect.orDie,
	);

/** A holder mounted with Ink's own render on fake streams, bound to a fresh slot. */
const mounted = Effect.gen(function* () {
	yield* loadInk;
	const fake = makeFakeStreams({ columns: 40, rows: 10 });
	const slot = holderSlot();
	const instance = render(createElement(holder(), { initial: createElement(Text, null, "first"), bind: slot.bind }), {
		stdin: fake.streams.stdin,
		stdout: fake.streams.stdout,
		stderr: fake.streams.stderr,
		interactive: true,
		patchConsole: false,
		exitOnCtrlC: false,
	});
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			instance.unmount();
			await instance.waitUntilExit().catch(() => undefined);
		}),
	);
	return { slot, instance };
});

describe("holderSlot", () => {
	it.live("a swap's waiter is called once React has committed it", () =>
		Effect.gen(function* () {
			const { slot } = yield* mounted;
			assert.isTrue(slot.isBound(), "bound once mounted");
			let committed = false;
			assert.isTrue(slot.swap(createElement(Text, null, "second"), () => (committed = true)));
			yield* until(() => committed);
		}).pipe(Effect.scoped),
	);

	it.live("a swap superseded by a later one before React commits still has its waiter released", () =>
		Effect.gen(function* () {
			const { slot } = yield* mounted;
			const fired: Array<string> = [];
			slot.swap(createElement(Text, null, "second"), () => fired.push("second"));
			slot.swap(createElement(Text, null, "third"), () => fired.push("third"));
			yield* until(() => fired.includes("third"));
			assert.deepStrictEqual(fired, ["second", "third"]);
		}).pipe(Effect.scoped),
	);

	it.live("an unmount releases every waiting swap, and a swap after it is refused and released at once", () =>
		Effect.gen(function* () {
			const { slot, instance } = yield* mounted;
			const fired: Array<string> = [];
			slot.swap(createElement(Text, null, "never committed"), () => fired.push("pending"));
			instance.unmount();
			yield* until(() => !slot.isBound());
			assert.deepStrictEqual(fired, ["pending"]);
			assert.isFalse(slot.swap(createElement(Text, null, "late"), () => fired.push("late")));
			assert.deepStrictEqual(fired, ["pending", "late"]);
		}).pipe(Effect.scoped),
	);
});
