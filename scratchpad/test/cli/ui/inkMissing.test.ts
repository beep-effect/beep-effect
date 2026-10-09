// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as P from "effect/Predicate";
import { Prompt } from "effect/cli";
import { vi } from "vitest";
import { CliInteractive, CliTheme } from "../../../effected/cli/index.ts";
import { loadInk } from "../../../effected/cli/ui/internal/ink.ts";
import { CliUi } from "../../../effected/cli/ui.ts";

vi.mock("ink", () => {
	throw new Error("Cannot find package 'ink'");
});

describe("a missing optional peer", () => {
	it.effect("loadInk dies, never fails, with a message naming ink and react as optional peers", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(loadInk);
			if (Exit.isFailure(exit)) {
				assert.isFalse(Cause.hasFails(exit.cause), "a missing peer is not a typed failure");
				assert.isTrue(Cause.hasDies(exit.cause));
				const defect = Cause.squash(exit.cause);
				assert.isTrue(P.isTagged("MissingInkPeersError")(defect), "the installation defect is a tagged schema error");
				if (defect instanceof Error) {
					assert.strictEqual(defect.name, "Error", "the display name is preserved");
					assert.instanceOf(defect.cause, Error, "the original import failure is retained");
				}
				const message = defect instanceof Error ? defect.message : "";
				assert.include(message, "optional peers ink and react");
				assert.include(message, "install");
			} else {
				assert.fail("expected loadInk to die without ink");
			}
		}),
	);
});

describe("a missing optional peer in an interactive run", () => {
	const screen = () => {
		throw new Error("never mounted");
	};

	/** Die with the peers message, never fall back to `otherwise`: an installation error must not pass as a default. */
	const diesNamingPeers = Effect.fn("diesNamingPeers")(function*<A, E, R> (effect: Effect.Effect<A, E, R>) {
			const exit = yield* Effect.exit(effect);
			if (Exit.isFailure(exit)) {
				assert.isFalse(Cause.hasFails(exit.cause), "a missing peer is not a typed failure");
				const defect = Cause.squash(exit.cause);
				assert.include(defect instanceof Error ? defect.message : String(defect), "optional peers ink and react");
			} else {
				assert.fail(`expected a defect, but it succeeded with ${String(exit.value)}`);
			}
		});

	it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
		it.effect("CliUi.fallback dies with the peers message, never silently using otherwise", () =>
			Effect.gen(function* () {
				const fallback = CliUi.fallback<string>(screen, { flag: "profile", otherwise: "library" });
				yield* diesNamingPeers(
					Prompt.isPrompt(fallback) ? Effect.succeed(fallback) : fallback,
				);
			}).pipe(Effect.provide(CliTheme.layerTest()), Effect.provide(CliInteractive.layerTest(true))),
		);
	});

	it.effect("CliUi.prompt dies with the peers message, never silently using otherwise", () =>
		diesNamingPeers(CliUi.prompt<string>(screen, { otherwise: "library" })).pipe(
			Effect.provide(CliTheme.layerTest()),
			Effect.provide(CliInteractive.layerTest(true)),
		),
	);
});
