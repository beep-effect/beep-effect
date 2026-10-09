// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Schedule from "effect/Schedule";
import { CliInteractive } from "../../../effected/cli/CliInteractive.ts";
import { CliTheme } from "../../../effected/cli/index.ts";
import { stripAnsi } from "../../../effected/cli/internal/displayWidth.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import type { MultiSelectSection } from "../../../effected/cli/ui.ts";
import { CliUi, MultiSelect, UiStreams } from "../../../effected/cli/ui.ts";

const sections: ReadonlyArray<MultiSelectSection<string>> = [
	{
		title: "Drafts",
		items: [
			{ key: "a1", label: "first draft", value: "a1", detail: "about the first draft" },
			{ key: "a2", label: "second draft", value: "a2" },
		],
	},
];

/** A MultiSelect on the production render path (Ink's ordinary output) over fake TTY streams of the given size. */
const drawn = Effect.fn("drawn")(function* (columns: number, rows: number) {
		const fake = makeFakeStreams({ columns, rows });
		const fiber = yield* Effect.forkChild(
			CliUi.run(MultiSelect.screen({ message: "Attest which?", sections })).pipe(
				Effect.provideService(UiStreams, fake.streams),
				Effect.provideService(CliInteractive, true),
				Effect.provide(CliTheme.layerTest()),
			),
		);
		// Polled, not slept: the first frame is drawn once its message is on stdout, however loaded the runner is.
		yield* Effect.suspend(() =>
			stripAnsi(fake.stdout()).includes("Attest which?") ? Effect.void : Effect.fail("not yet"),
		).pipe(Effect.retry(Schedule.spaced("5 millis")), Effect.timeout("2 seconds"), Effect.orDie);
		yield* Fiber.interrupt(fiber);
		return stripAnsi(fake.stdout());
	});

describe("a terminal reporting 0x0 is an unknown size (O1)", () => {
	it.live("the production path draws a full MultiSelect row and its detail line, and no bare ellipsis row", () =>
		Effect.gen(function* () {
			const out = yield* drawn(0, 0);
			assert.include(out, "first draft");
			assert.include(out, "about the first draft");
			assert.include(out, "Attest which?");
			const bare = out.split(/\r?\n/).filter((line) => line.trim() === "…");
			assert.deepStrictEqual(bare, [], out);
		}),
	);

	it.live("control: a real 80x24 terminal draws the same rows", () =>
		Effect.gen(function* () {
			const out = yield* drawn(80, 24);
			assert.include(out, "first draft");
			assert.include(out, "about the first draft");
		}),
	);
});
