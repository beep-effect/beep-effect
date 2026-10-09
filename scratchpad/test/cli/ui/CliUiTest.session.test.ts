import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { NotInteractive } from "../../../effected/cli/index.ts";
import { CliUi, Select, TextInput } from "../../../effected/cli/ui.ts";
import { CliUiTest, type CliUiTestSession, type CliUiTestSessionOptions } from "../../../effected/cli/ui-testing.ts";

class TestSession extends Context.Service<TestSession, CliUiTestSession>()(
	"@beep/scratchpad/test/cli/ui/CliUiTest.session.test/TestSession",
) {}

const sessionLayer = (options: CliUiTestSessionOptions = {}) =>
	Layer.unwrap(
		Effect.map(CliUiTest.session(options), (session) =>
			Layer.merge(session.layer, Layer.succeed(TestSession, session)),
		),
	);

const offlineFixture = Effect.gen(function* () {
	const session = yield* CliUiTest.session({ interactive: false });
	const context = yield* Layer.build(session.layer);
	return { session, context };
});
class OfflineSession extends Context.Service<OfflineSession, Effect.Success<typeof offlineFixture>>()(
	"@beep/scratchpad/test/cli/ui/CliUiTest.session.test/OfflineSession",
) {}
const offlineLayer = Layer.effect(OfflineSession, offlineFixture);

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
	it.layer(sessionLayer(), { timeout: "30 seconds" })((it) => {
		it.effect(
			"drives each screen a program mounts in turn, with its own frames, and captures the program's output",
			() =>
				Effect.gen(function* () {
					const session = yield* TestSession;
					const fiber = yield* Effect.forkScoped(twoScreens);
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
				}),
		);
	});

	it.layer(sessionLayer(), { timeout: "30 seconds" })((it) => {
		it.effect("next dies naming what it waited for when no screen mounts within 2 s", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				const exit = yield* Effect.exit(session.next({ contains: "Profile" }));
				if (Exit.isFailure(exit)) {
					const defect = Cause.squash(exit.cause);
					assert.instanceOf(defect, Error);
					const message = String(defect.message);
					assert.include(message, "screen 1");
					assert.include(message, '"Profile"');
					assert.include(message, "0 mounted");
				} else {
					assert.fail("expected next to die with no screen mounted");
				}
				assert.strictEqual(yield* session.mounts, 0);
			}),
		);
	});

	it.layer(sessionLayer(), { timeout: "30 seconds" })((it) => {
		it.effect("next dies when the screen that mounts never shows the expected text", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				yield* Effect.forkScoped(CliUi.run(profile));
				const exit = yield* Effect.exit(session.next({ contains: "Config location" }));
				if (Exit.isFailure(exit)) {
					const defect = Cause.squash(exit.cause);
					assert.instanceOf(defect, Error);
					const message = String(defect.message);
					assert.include(message, '"Config location"');
					assert.include(message, "1 mounted");
				} else {
					assert.fail("expected next to die: the mounted screen never shows that text");
				}
			}),
		);
	});

	it.layer(Layer.merge(sessionLayer({ color: "none", columns: 40 }), offlineLayer), { timeout: "30 seconds" })((it) => {
		it.effect("takes render's options: colour none gives escape-free frames, and not interactive mounts nothing", () =>
			Effect.gen(function* () {
				const plain = yield* TestSession;
				yield* Effect.forkScoped(CliUi.run(profile));
				const screen = yield* plain.next();
				assert.notInclude(yield* screen.rawFrame, "\u001b[3", "no colour escapes");
				const { session: offline, context } = yield* OfflineSession;
				const error = yield* Effect.flip(CliUi.run(profile).pipe(Effect.provideContext(context)));
				assert.instanceOf(error, NotInteractive);
				assert.strictEqual(yield* offline.mounts, 0);
			}),
		);
	});
});

describe("CliUiTest.session carry-ins", () => {
	it.layer(sessionLayer(), { timeout: "30 seconds" })((it) => {
		it.effect("the captured console formats objects as data, not [object Object]", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				yield* Console.log("x", { a: 1 }, [2, "b"]);
				yield* Console.error(new Map([["k", 1]]).size, null);
				assert.strictEqual(yield* session.stdout, 'x {"a":1} [2,"b"]\n');
				assert.strictEqual(yield* session.stderr, "1 null\n");
			}),
		);
	});

	it.layer(sessionLayer(), { timeout: "30 seconds" })((it) => {
		it.effect("a screen that has ended dies on press, type or chunk, rather than typing into the next one", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				const fiber = yield* Effect.forkScoped(twoScreens);
				const first = yield* session.next({ contains: "Profile" });
				yield* first.press("enter");
				const second = yield* session.next({ contains: "Bundle directory" });
				for (const send of [first.press("down"), first.type("x"), first.chunk("down", "up")]) {
					const exit = yield* Effect.exit(send);
					if (Exit.isFailure(exit)) {
						const defect = Cause.squash(exit.cause);
						assert.instanceOf(defect, Error);
						assert.include(String(defect.message), "has ended");
					} else {
						assert.fail("expected a defect: the screen had ended");
					}
				}
				assert.notInclude(yield* second.plainFrame, "docsx", "nothing reached the screen mounted now");
				yield* second.press("enter");
				yield* Fiber.join(fiber);
			}),
		);
	});

	it.layer(sessionLayer(), { timeout: "30 seconds" })((it) => {
		it.effect("render's handle dies the same way once its screen has ended", () =>
			Effect.gen(function* () {
				const handle = yield* CliUiTest.render(profile);
				yield* handle.press("enter");
				assert.strictEqual(yield* handle.result, "software-project");
				const exit = yield* Effect.exit(handle.press("down"));
				const cause = Exit.match(exit, {
					onFailure: (cause) => cause,
					onSuccess: () => assert.fail("a key after the end is a defect"),
				});
				assertExitFailure(exit, cause);
				assert.isTrue(Cause.hasDies(exit.cause), "a key after the end is a defect");
			}),
		);
	});
});
