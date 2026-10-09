// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { NotInteractive } from "../../../effected/cli/index.ts";
import { CliUi, Select, TextInput } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const profile = Select.screen({
	message: "Profile",
	choices: [
		{ label: "software-project", value: "software-project" },
		{ label: "library", value: "library" },
	],
});

/** Two screens in a row, then the program's own output on both streams. */
const twoScreens = Effect.gen(function* () {
	const chosen = yield* CliUi.run(profile);
	const dir = yield* CliUi.run(TextInput.screen({ message: "Bundle directory", initial: "docs" }));
	yield* Console.log(`${chosen}|${dir}`);
	yield* Console.error("done");
});

describe("CliUiTest.session", () => {
	it.effect("drives each screen a program mounts in turn, with its own frames, and captures the program's output", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const fiber = yield* Effect.forkScoped(twoScreens.pipe(Effect.provide(session.layer)));
			const first = yield* session.next({ contains: "Profile" });
			assert.include(yield* first.plainFrame, "software-project");
			yield* first.press("down", "enter");
			const second = yield* session.next({ contains: "Bundle directory" });
			const frames = yield* second.frames;
			assert.isNotEmpty(frames);
			assert.isFalse(
				frames.some((frame) => frame.includes("Profile")),
				"a screen's capture starts at its own mount",
			);
			yield* second.type("/x");
			yield* second.press("enter");
			yield* Fiber.join(fiber);
			assert.strictEqual(yield* session.mounts, 2);
			assert.strictEqual(yield* session.stdout, "library|docs/x\n");
			assert.strictEqual(yield* session.stderr, "done\n");
			assert.include(yield* first.plainFrame, "library", "an ended screen keeps its last frame");
		}).pipe(Effect.scoped),
	);

	it.effect("next dies naming what it waited for when no screen mounts within 2 s", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const exit = yield* Effect.exit(session.next({ contains: "Profile" }));
			if (Exit.isFailure(exit)) {
				const message = String((Cause.squash(exit.cause) as Error).message);
				assert.include(message, "screen 1");
				assert.include(message, '"Profile"');
				assert.include(message, "0 mounted");
			} else {
				assert.fail("expected next to die with no screen mounted");
			}
			assert.strictEqual(yield* session.mounts, 0);
		}).pipe(Effect.scoped),
	);

	it.effect("next dies when the screen that mounts never shows the expected text", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			yield* Effect.forkScoped(CliUi.run(profile).pipe(Effect.provide(session.layer)));
			const exit = yield* Effect.exit(session.next({ contains: "Config location" }));
			if (Exit.isFailure(exit)) {
				const message = String((Cause.squash(exit.cause) as Error).message);
				assert.include(message, '"Config location"');
				assert.include(message, "1 mounted");
			} else {
				assert.fail("expected next to die: the mounted screen never shows that text");
			}
		}).pipe(Effect.scoped),
	);

	it.effect("takes render's options: colour none gives escape-free frames, and not interactive mounts nothing", () =>
		Effect.gen(function* () {
			const plain = yield* CliUiTest.session({ color: "none", columns: 40 });
			yield* Effect.forkScoped(CliUi.run(profile).pipe(Effect.provide(plain.layer)));
			const screen = yield* plain.next();
			assert.notInclude(yield* screen.rawFrame, "\u001b[3", "no colour escapes");
			const offline = yield* CliUiTest.session({ interactive: false });
			const error = yield* Effect.flip(CliUi.run(profile).pipe(Effect.provide(offline.layer)));
			assert.instanceOf(error, NotInteractive);
			assert.strictEqual(yield* offline.mounts, 0);
		}).pipe(Effect.scoped),
	);
});

describe("CliUiTest.session carry-ins", () => {
	it.effect("the captured console formats objects as data, not [object Object]", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			yield* Console.log("x", { a: 1 }, [2, "b"]).pipe(Effect.provide(session.layer));
			yield* Console.error(new Map([["k", 1]]).size, null).pipe(Effect.provide(session.layer));
			assert.strictEqual(yield* session.stdout, 'x {"a":1} [2,"b"]\n');
			assert.strictEqual(yield* session.stderr, "1 null\n");
		}).pipe(Effect.scoped),
	);

	it.effect("a screen that has ended dies on press, type or chunk, rather than typing into the next one", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const fiber = yield* Effect.forkScoped(twoScreens.pipe(Effect.provide(session.layer)));
			const first = yield* session.next({ contains: "Profile" });
			yield* first.press("enter");
			const second = yield* session.next({ contains: "Bundle directory" });
			for (const send of [first.press("down"), first.type("x"), first.chunk("down", "up")]) {
				const exit = yield* Effect.exit(send);
				if (Exit.isFailure(exit)) {
					assert.include(String((Cause.squash(exit.cause) as Error).message), "has ended");
				} else {
					assert.fail("expected a defect: the screen had ended");
				}
			}
			assert.notInclude(yield* second.plainFrame, "docsx", "nothing reached the screen mounted now");
			yield* second.press("enter");
			yield* Fiber.join(fiber);
		}).pipe(Effect.scoped),
	);

	it.effect("render's handle dies the same way once its screen has ended", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(profile);
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, "software-project");
			const exit = yield* Effect.exit(handle.press("down"));
			assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause), "a key after the end is a defect");
		}).pipe(Effect.scoped),
	);
});
