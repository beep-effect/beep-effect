import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { Text, render } from "ink";
import { createElement } from "react";
import { vi } from "vitest";
import { drainPerformance, resolveDrain } from "../../../effected/cli/ui/internal/perfDrain.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";

// React's development build records user-timing entries only when `console.timeStamp` is a function, checked once as
// the reconciler loads (react-reconciler.development.js, `supportsUserTiming`). Node's console has it; a Vitest
// worker's does not, so without this the leak never happens here and the control below could not fail. Installed
// before Ink, and so React, is imported.
vi.hoisted(() => {
	const target = console as { timeStamp?: (label?: string) => void };
	if (typeof target.timeStamp !== "function") target.timeStamp = () => undefined;
});

const RERENDERS = 200;

/** Mount an Ink frame on fake streams and rerender it `RERENDERS` times, draining (or not) after each; the measures left. */
const measuresAfterRerenders = (drain: boolean): number => {
	performance.clearMeasures();
	const fake = makeFakeStreams({ columns: 40, rows: 10 });
	const instance = render(createElement(Text, null, "tick 0"), {
		stdin: fake.streams.stdin,
		stdout: fake.streams.stdout,
		stderr: fake.streams.stderr,
		interactive: true,
		patchConsole: false,
		exitOnCtrlC: false,
	});
	for (let tick = 1; tick <= RERENDERS; tick++) {
		instance.rerender(createElement(Text, null, `tick ${tick}`));
		drainPerformance(drain);
	}
	instance.unmount();
	drainPerformance(drain);
	return performance.getEntriesByType("measure").length;
};

const withNodeEnv = (value: string | undefined) =>
	Effect.provideService(
		ConfigProvider.ConfigProvider,
		ConfigProvider.fromUnknown(value === undefined ? {} : { NODE_ENV: value }),
	);

describe("drainPerformance: React's development build leaks user-timing entries (okf/gotchas/react-dev-performance-entries.md)", () => {
	it("control: without the drain, 200 rerenders leave more than one measure entry per rerender", () => {
		assert.isAbove(measuresAfterRerenders(false), RERENDERS);
	});

	it("with the drain after every rerender and the unmount, none are left", () => {
		assert.strictEqual(measuresAfterRerenders(true), 0);
	});

	it("a host's own marks survive the drain: React leaks measures only, so marks are left alone", () => {
		performance.clearMarks("host-mark");
		performance.mark("host-mark");
		drainPerformance(true);
		assert.strictEqual(performance.getEntriesByName("host-mark", "mark").length, 1);
		performance.clearMarks("host-mark");
	});
});

describe("resolveDrain: whether a drain mode drains", () => {
	it.effect("auto drains unless NODE_ENV is exactly production: unset and test both leak", () =>
		Effect.gen(function* () {
			assert.isTrue(yield* resolveDrain("auto").pipe(withNodeEnv(undefined)), "unset");
			assert.isTrue(yield* resolveDrain("auto").pipe(withNodeEnv("test")), "test");
			assert.isTrue(yield* resolveDrain("auto").pipe(withNodeEnv("development")), "development");
			assert.isFalse(yield* resolveDrain("auto").pipe(withNodeEnv("production")), "production");
		}),
	);

	it.effect("an explicit mode wins over NODE_ENV", () =>
		Effect.gen(function* () {
			assert.isTrue(yield* resolveDrain(true).pipe(withNodeEnv("production")));
			assert.isFalse(yield* resolveDrain(false).pipe(withNodeEnv("test")));
		}),
	);
});
