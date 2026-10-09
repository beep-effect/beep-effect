// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file
// Ink throttles its production path to 30 fps by default, a trailing timer of about 33 ms: a frame rendered just after
// another is written a throttle period later, which can land after the harness's settle has already read the screen.
// The harness raises Ink's maxFps so that cannot happen; this pins the option it mounts with, on both production paths.
import { assert, describe, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import { vi } from "vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { CliUi, Select } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import type { Ev, State } from "../helpers/live.ts";
import { End, Start, frameOf, reduce } from "../helpers/live.ts";

const { mounts } = vi.hoisted(() => ({ mounts: Array<{ readonly maxFps?: number; readonly debug?: boolean }>() }));
vi.mock("ink", async (importOriginal) => {
	const ink = await importOriginal<typeof import("ink")>();
	return {
		...ink,
		render: ((tree: Parameters<typeof ink.render>[0], options: Parameters<typeof ink.render>[1]) => {
			const recorded = typeof options === "object" && options !== null && !("write" in options) ? options : {};
			mounts.push({
				...("maxFps" in recorded && recorded.maxFps !== undefined ? { maxFps: recorded.maxFps } : {}),
				...("debug" in recorded && recorded.debug !== undefined ? { debug: recorded.debug } : {}),
			});
			return ink.render(tree, options);
		}),
	};
});

const screen = Select.screen({ message: "Pick", choices: [{ label: "a", value: "a" }] });
const sessions = Effect.gen(function* () {
	const fixtures = [];
	for (const renderPath of ["production", "debug"] as const) {
		const session = yield* CliUiTest.session({ renderPath, color: "none" });
		const services = yield* Layer.build(session.layer);
		fixtures.push({ renderPath, session, run: Effect.provide(CliUi.run(screen), services) });
	}
	return fixtures;
});
class Sessions extends Context.Service<Sessions, Effect.Success<typeof sessions>>()("@beep/scratchpad/test/cli/ui/CliUiTest.throttle.test/Sessions") {}

describe("the harness's production path is not throttled to Ink's 30 fps", () => {
	it.effect("CliUiTest.live mounts its view at 1000 fps", () =>
		Effect.gen(function* () {
			const before = mounts.length;
			const view = yield* CliUiTest.live({
				initial: { run: 0, last: "idle", seen: [] } satisfies State,
				reduce,
				render: frameOf,
				isStart: (event: Ev) => event._tag === "Start",
				isTerminal: (event: Ev) => event._tag === "End",
				color: "none",
			});
			yield* view.publish(Start);
			yield* view.publish(End);
			yield* view.end;
			const mounted = mounts.slice(before);
			assert.isNotEmpty(mounted, "control: the wrapper saw the mount");
			for (const mount of mounted) assert.strictEqual(mount.maxFps, 1000);
		}),
	);

	it.layer(Layer.effect(Sessions, sessions), { timeout: "30 seconds" })((it) => {
		it.effect("a production-path session's screens mount at 1000 fps; the debug path is unthrottled anyway", () =>
			Effect.gen(function* () {
				for (const { renderPath, session, run } of yield* Sessions) {
					const before = mounts.length;
					const fiber = yield* Effect.forkScoped(run);
					yield* (yield* session.next({ contains: "Pick" })).press("enter");
					yield* Fiber.join(fiber);
					const [mount] = mounts.slice(before);
					assert.strictEqual(mount?.maxFps, 1000, renderPath);
					assert.strictEqual(mount?.debug === true, renderPath === "debug", "control: the paths really differ");
				}
			}),
		);
	});
});
