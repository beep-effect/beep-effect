// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file
// What a command with a live view loads, run by run: React and Ink load only when something is drawn with Ink. No
// static ink or react import here, and none of the view's module: the mocks below record each package's first load,
// and the fixture counts its own.
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Console, Effect, Layer, Stream } from "effect";
import { Command } from "effect/cli";
import { vi } from "vitest";
import type { Document } from "../../../effected/cli/index.ts";
import { CliEnv, CliLinks, Doc } from "../../../effected/cli/index.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import type { LiveOptions } from "../../../effected/cli/ui.ts";
import { CliUi, UiStreams } from "../../../effected/cli/ui.ts";
import type { SyncState } from "../fixtures/live-view.ts";

const { loads } = vi.hoisted(() => ({ loads: [] as Array<string> }));
vi.mock("ink", async (importOriginal) => {
	loads.push("ink");
	return await importOriginal();
});
vi.mock("react", async (importOriginal) => {
	loads.push("react");
	return await importOriginal();
});

const viewLoads = (): number => (globalThis as { liveViewLoads?: number }).liveViewLoads ?? 0;

type Ev = "start" | "item" | "end";

// Module level, as a command module declares it: building the lazy render loads nothing.
const render = CliUi.lazyView(() => import("../fixtures/live-view.ts"));
const final = (state: SyncState): Document => [Doc.paragraph(`synced ${state.done}`)];

const options = (withFinal: boolean): LiveOptions<Ev, SyncState> => ({
	events: Stream.make<Array<Ev>>("start", "item", "item", "end"),
	initial: { done: 0 },
	reduce: (state, event) => (event === "item" ? { done: state.done + 1 } : event === "start" ? { done: 0 } : state),
	render,
	...(withFinal ? { final } : {}),
	isStart: (event) => event === "start",
	isTerminal: (event) => event === "end",
});

const tool = (withFinal: boolean) =>
	Command.make("tool").pipe(
		Command.withSubcommands([
			Command.make("sync", {}, () =>
				Effect.scoped(Effect.flatMap(CliUi.live(options(withFinal)), (handle) => handle.done)),
			),
		]),
	);

/** Run argv with an agent's environment (not interactive) on fake streams; what reached the view's stdout. */
const run = (argv: ReadonlyArray<string>, withFinal: boolean) =>
	Effect.gen(function* () {
		const fake = makeFakeStreams({ columns: 80, rows: 24 });
		const help: Array<string> = [];
		const console: Console.Console = Object.assign(Object.create(globalThis.console) as Console.Console, {
			log: (...args: ReadonlyArray<unknown>) => help.push(args.map(String).join(" ")),
		});
		yield* Command.runWith(tool(withFinal), { version: "1.0.0" })(argv).pipe(
			Effect.provide(Layer.mergeAll(CliEnv.layerTest({ audience: "agent" }), CliLinks.layerTest("off"))),
			Effect.provideService(UiStreams, fake.streams),
			Effect.provide(NodeServices.layer),
			Effect.provideService(Console.Console, console),
		);
		return { stdout: fake.stdout(), help: help.join("\n") };
	});

describe("a command with a lazy live view", () => {
	// In file order: each test needs the loads of the ones before it to have been none.
	it.effect("--help loads neither react nor ink, nor the view's module", () =>
		Effect.gen(function* () {
			const { help } = yield* run(["--help"], true);
			assert.include(help, "sync", "control: the help was printed");
			assert.deepStrictEqual(loads, []);
			assert.strictEqual(viewLoads(), 0);
		}),
	);

	it.effect("an agent's run with final prints the document and loads neither react nor ink, nor the view", () =>
		Effect.gen(function* () {
			const { stdout } = yield* run(["sync"], true);
			assert.strictEqual(stdout, "synced 2\n");
			assert.deepStrictEqual(loads, []);
			assert.strictEqual(viewLoads(), 0);
		}),
	);

	it.effect("control: the same run without final loads Ink, React and the view to print its frame", () =>
		Effect.gen(function* () {
			const { stdout } = yield* run(["sync"], false);
			assert.include(stdout, "INK done 2 frame");
			assert.includeMembers(loads, ["ink", "react"]);
			assert.strictEqual(viewLoads(), 1);
		}),
	);
});
