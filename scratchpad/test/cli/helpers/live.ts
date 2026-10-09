// Shared by the CliUi.live tests: a small event model, its fold and frame, and the fake-terminal runner.
import type { Cause, PubSub, Stream } from "effect";
import { Console, Effect, Option, Queue, Schedule } from "effect";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { createElement, useEffect } from "react";
import { CliInteractive, CliTheme } from "../../../effected/cli/index.ts";
import type { InkChalk } from "../../../effected/cli/ui/internal/inkChalk.ts";
import { inkChalk } from "../../../effected/cli/ui/internal/inkChalk.ts";
import { UiRenderOptions } from "../../../effected/cli/ui/internal/renderOptions.ts";
import type { FakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import type { LiveOptions } from "../../../effected/cli/ui.ts";
import { CliUi, UiStreams } from "../../../effected/cli/ui.ts";

export const ESC = String.fromCharCode(0x1b);
export const SHOW_CURSOR = `${ESC}[?25h`;
export const CLEAR_SCROLLBACK = `${ESC}[3J`;
export const CLEAR_SCREEN = `${ESC}[2J`;

export type Ev = { readonly _tag: "Start" } | { readonly _tag: "Tick"; readonly n: number } | { readonly _tag: "End" };
export const Start: Ev = { _tag: "Start" };
export const End: Ev = { _tag: "End" };
export const tick = (n: number): Ev => ({ _tag: "Tick", n });

export interface State {
	readonly run: number;
	readonly last: string;
	readonly seen: ReadonlyArray<string>;
}

export const reduce = (state: State, event: Ev): State => {
	const seen = [...state.seen, event._tag === "Tick" ? `tick ${event.n}` : event._tag];
	switch (event._tag) {
		case "Start":
			return { run: state.run + 1, last: "started", seen };
		case "Tick":
			return { ...state, last: `tick ${event.n}`, seen };
		case "End":
			return { ...state, last: "ended", seen };
	}
};

export const frameOf = (state: State): ReactElement =>
	createElement(
		Box,
		{ flexDirection: "column" },
		createElement(Text, null, `RUN ${state.run}`),
		createElement(Text, null, state.last),
	);

export const optionsOf = (
	events: Stream.Stream<Ev> | PubSub.Subscription<Ev>,
	extra: Partial<LiveOptions<Ev, State>> = {},
): LiveOptions<Ev, State> => ({
	events,
	initial: { run: 0, last: "idle", seen: [] },
	reduce,
	render: frameOf,
	isStart: (event) => event._tag === "Start",
	isTerminal: (event) => event._tag === "End",
	...extra,
});

/** How a test runs `CliUi.live`: interactive unless told otherwise, at colour `color`, with optional hooks. */
export interface LiveSettings {
	readonly interactive?: boolean;
	readonly color?: "none" | "truecolor";
	readonly onMount?: () => void;
	readonly onUnmount?: () => void;
	/** The ambient `Console`, which the default logger writes through: where a warning lands. */
	readonly console?: Console.Console;
}

/** `CliUi.live` on fake streams, interactive unless told otherwise, at colour `color`. */
export const liveOn = (fake: FakeStreams, options: LiveOptions<Ev, State>, settings: LiveSettings = {}) => {
	const viewed = CliUi.live(options).pipe(
		Effect.provideService(UiStreams, fake.streams),
		Effect.provideService(CliInteractive, settings.interactive ?? true),
		Effect.provideService(UiRenderOptions, {
			...(settings.onMount === undefined ? {} : { onMount: settings.onMount }),
			...(settings.onUnmount === undefined ? {} : { onUnmount: settings.onUnmount }),
		}),
	);
	const logged =
		settings.console === undefined ? viewed : Effect.provideService(viewed, Console.Console, settings.console);
	return logged.pipe(Effect.provide(CliTheme.layerTest({ color: settings.color ?? "none" })));
};

/** Wait, in real time, until `ready` holds; dies after two seconds. */
export const until = (ready: () => boolean): Effect.Effect<void> =>
	Effect.suspend(() => (ready() ? Effect.void : Effect.fail("not yet"))).pipe(
		Effect.retry(Schedule.spaced("5 millis")),
		Effect.timeout("2 seconds"),
		Effect.orDie,
	);

/** A `CliUi.run` screen that resolves as soon as it mounts: it can only finish once the mount permit is free. */
export const mountsAndResolves = (fake: FakeStreams) => {
	const Resolve = (props: { readonly resolve: (value: string) => void }): ReactElement => {
		useEffect(() => props.resolve("mounted"), [props.resolve]);
		return createElement(Text, null, "a screen");
	};
	return CliUi.run<string>((control) => createElement(Resolve, { resolve: control.resolve })).pipe(
		Effect.provideService(UiStreams, fake.streams),
		Effect.provideService(CliInteractive, true),
		Effect.provide(CliTheme.layerTest()),
		Effect.timeout("2 seconds"),
	);
};

export const chalk: Effect.Effect<InkChalk> = Effect.flatMap(
	Effect.promise(() => inkChalk()),
	Option.match({ onNone: () => Effect.die(new Error("Ink's chalk did not resolve")), onSome: Effect.succeed }),
);

export const queueOf = () => Queue.unbounded<Ev, Cause.Done>();

/** An ambient `Console` that keeps every line, so a test reads what the default logger wrote. */
export const capturing = (): { readonly console: Console.Console; readonly lines: Array<string> } => {
	const lines: Array<string> = [];
	const keep = (...args: ReadonlyArray<unknown>): void => {
		lines.push(args.map(String).join(" "));
	};
	const console = Object.assign(Object.create(globalThis.console) as Console.Console, {
		log: keep,
		info: keep,
		warn: keep,
		error: keep,
		debug: keep,
	});
	return { console, lines };
};

export const warningsIn = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
	lines.filter((line) => line.includes("WARN") && line.includes("live view"));
