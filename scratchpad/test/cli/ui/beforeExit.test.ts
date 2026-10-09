import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Text } from "ink";
import { createElement } from "react";
import type { Screen } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import type { Ev, State } from "../helpers/live.ts";
import { End, Start, reduce } from "../helpers/live.ts";

// More than Node's default of ten listeners, past which it prints `MaxListenersExceededWarning`.
const RUNS = 12;

const beforeExit = (): number => process.listenerCount("beforeExit");

describe("Ink's beforeExit listener", () => {
	it.effect(`CliUi.run leaves none behind after ${RUNS} screens`, () =>
		Effect.gen(function* () {
			const before = beforeExit();
			const screen: Screen<never> = () => createElement(Text, null, "screen");
			for (let i = 0; i < RUNS; i++) {
				yield* Effect.scoped(Effect.flatMap(CliUiTest.render(screen), (handle) => handle.frame));
			}
			assert.strictEqual(beforeExit(), before);
		}),
	);

	it.effect(`CliUi.live leaves none behind after ${RUNS} runs`, () =>
		Effect.gen(function* () {
			const before = beforeExit();
			yield* Effect.scoped(
				Effect.gen(function* () {
					const view = yield* CliUiTest.live({
						initial: { run: 0, last: "idle", seen: [] } as State,
						reduce,
						render: (state: State) => createElement(Text, null, `RUN ${state.run}`),
						isStart: (event: Ev) => event._tag === "Start",
						isTerminal: (event: Ev) => event._tag === "End",
					});
					for (let i = 0; i < RUNS; i++) {
						yield* view.publish(Start);
						assert.strictEqual(yield* view.plainFrame, `RUN ${i + 1}`, "control: the run mounted");
						yield* view.publish(End);
					}
					yield* view.end;
				}),
			);
			assert.strictEqual(beforeExit(), before);
		}),
	);
});
