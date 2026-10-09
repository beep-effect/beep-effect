import { assert, describe, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import type { AudienceOptions } from "../../effected/env/Audience.ts";
import { Audience } from "../../effected/env/Audience.ts";
import { CurrentRuntimeEnv, RuntimeEnv } from "../../effected/env/RuntimeEnv.ts";

/** A pure logger stub that replaces the defaults, so TestConsole is never involved. */
const capture = (lines: Array<{ readonly level: string; readonly text: string }>) =>
	Layer.succeed(
		Logger.CurrentLoggers,
		new Set([
			Logger.make(({ logLevel, message }) => {
				lines.push({ level: logLevel, text: Array.isArray(message) ? message.join(" ") : String(message) });
			}),
		]),
	);

const runtime = (fields: { agent?: string; ci?: "github-actions" | "generic" }) =>
	RuntimeEnv.make({
		agent: O.fromNullishOr(fields.agent),
		ci: O.fromNullishOr(fields.ci),
		terminal: O.none(),
	});

/** `Audience.layer` fed by the real `CurrentRuntimeEnv.layer`, so the whole chain reads one environment. */
const audienceLayer = (env: Record<string, string>, envVar = "OKFIT_AUDIENCE") =>
	Audience.layer({ envVar }).pipe(
		Layer.provide(CurrentRuntimeEnv.layer),
		Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
	);

describe("Audience.detect", () => {
	it("agent beats CI (an agent inside a CI job gets agent output)", () =>
		assert.strictEqual(Audience.detect(runtime({ agent: "claude", ci: "github-actions" })), "agent"));
	it("CI only is ci", () => assert.strictEqual(Audience.detect(runtime({ ci: "generic" })), "ci"));
	it("agent only is agent", () => assert.strictEqual(Audience.detect(runtime({ agent: "codex" })), "agent"));
	it("nothing is human", () => assert.strictEqual(Audience.detect(runtime({})), "human"));
});

describe("Audience.layer", () => {
	class Valid extends Context.Service<Valid, Context.Service.Shape<typeof Audience>>()(
		"@beep/scratchpad/test/env/Audience.test/Valid",
	) {}
	class Invalid extends Context.Service<Invalid, Context.Service.Shape<typeof Audience>>()(
		"@beep/scratchpad/test/env/Audience.test/Invalid",
	) {}
	it.layer(audienceLayer({ CLAUDECODE: "1", OKFIT_AUDIENCE: "human" }), { timeout: "30 seconds" })((it) => {
		it.effect("the override beats detection: CLAUDECODE=1 with OKFIT_AUDIENCE=human is a human", () =>
			Effect.map(Audience, (audience) =>
				assert.deepStrictEqual({ ...audience }, { kind: "human", source: "override" }),
			),
		);
	});

	it.layer(audienceLayer({ CLAUDECODE: "1" }), { timeout: "30 seconds" })((it) => {
		it.effect("CLAUDECODE=1 with no override is an agent, detected, never a refusal", () =>
			Effect.map(Audience, (audience) =>
				assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" }),
			),
		);
	});

	it.layer(audienceLayer({}), { timeout: "30 seconds" })((it) => {
		it.effect("no signals and no override is a detected human", () =>
			Effect.map(Audience, (audience) =>
				assert.deepStrictEqual({ ...audience }, { kind: "human", source: "detected" }),
			),
		);
	});

	it.layer(audienceLayer({ GITHUB_ACTIONS: "true" }), { timeout: "30 seconds" })((it) => {
		it.effect("CI detection feeds the audience", () =>
			Effect.map(Audience, (audience) => assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" })),
		);
	});

	{
		const lines: Array<{ readonly level: string; readonly text: string }> = [];
		it.layer(audienceLayer({ OKFIT_AUDIENCE: "robot", CLAUDECODE: "1" }).pipe(Layer.provide(capture(lines))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("an invalid override falls back to detection and logs exactly one warning", () =>
				Audience.pipe(
					Effect.tap((audience) =>
						Effect.sync(() => {
							assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" });
							assert.lengthOf(lines, 1);
							assert.strictEqual(lines[0]?.level, "Warn");
							assert.strictEqual(lines[0]?.text, "OKFIT_AUDIENCE=robot is not one of human|agent|ci; ignoring it");
						}),
					),
				),
			);
		});
	}

	{
		const valid: Array<{ readonly level: string; readonly text: string }> = [];
		const invalid: Array<{ readonly level: string; readonly text: string }> = [];
		it.layer(
			Layer.mergeAll(
				Layer.effect(Valid, Audience).pipe(
					Layer.provide(audienceLayer({ OKFIT_AUDIENCE: "ci" })),
					Layer.provide(capture(valid)),
				),
				Layer.effect(Invalid, Audience).pipe(
					Layer.provide(audienceLayer({ OKFIT_AUDIENCE: "nope" })),
					Layer.provide(capture(invalid)),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("the capture is live: a valid override logs nothing, an invalid one logs (positive control)", () =>
				Effect.gen(function* () {
					yield* Valid;
					yield* Invalid;
					assert.lengthOf(valid, 0);
					assert.lengthOf(invalid, 1);
				}),
			);
		});
	}

	{
		const lines: Array<{ readonly level: string; readonly text: string }> = [];
		it.layer(audienceLayer({ OKFIT_AUDIENCE: "", GITHUB_ACTIONS: "true" }).pipe(Layer.provide(capture(lines))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("an empty override is unset: detected, with no warning", () =>
				Audience.pipe(
					Effect.tap((audience) =>
						Effect.sync(() => {
							assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" });
							assert.lengthOf(lines, 0);
						}),
					),
				),
			);
		});
	}

	{
		const lines: Array<{ readonly level: string; readonly text: string }> = [];
		it.layer(
			Layer.provide(Audience.layer({ envVar: "OKFIT_AUDIENCE" }), CurrentRuntimeEnv.layer).pipe(
				Layer.provide(
					ConfigProvider.layer(
						ConfigProvider.fromUnknown({ OKFIT_AUDIENCE: "", GITHUB_ACTIONS: "true" }, { preserveEmptyStrings: true }),
					),
				),
				Layer.provide(capture(lines)),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("an empty override is unset even when the provider preserves empty strings", () =>
				Audience.pipe(
					Effect.tap((audience) =>
						Effect.sync(() => {
							assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" });
							assert.lengthOf(lines, 0);
						}),
					),
				),
			);
		});
	}

	it.layer(audienceLayer({ OKFIT_AUDIENCE: "HUMAN", CLAUDECODE: "1" }), { timeout: "30 seconds" })((it) => {
		it.effect("the override is case-insensitive", () =>
			Effect.map(Audience, (audience) =>
				assert.deepStrictEqual({ ...audience }, { kind: "human", source: "override" }),
			),
		);
	});

	it.layer(
		Layer.provide(Audience.layer(), CurrentRuntimeEnv.layer).pipe(
			Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CLAUDECODE: "1", OKFIT_AUDIENCE: "human" }))),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("without an envVar option the audience is always detected", () =>
			Effect.gen(function* () {
				const audience = yield* Audience;
				assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" });
			}),
		);
	});
});

describe("Audience options", () => {
	it("the named options type is the one layer takes", () => {
		const options: AudienceOptions = { envVar: "OKFIT_AUDIENCE" };
		assert.isDefined(Audience.layer(options));
	});
});

describe("Audience.layerTest", () => {
	it.layer(Audience.layerTest("ci"), { timeout: "30 seconds" })((it) => {
		it.effect("fixes the kind as an override and needs nothing", () =>
			Effect.gen(function* () {
				const audience = yield* Audience;
				assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "override" });
			}),
		);
	});
	it.effect("takes the source as a second argument, so a test can say the variable did not decide", () =>
		Effect.gen(function* () {
			const audiences = [
				yield* Layer.build(Audience.layerTest("human", "detected")).pipe(
					Effect.map((context) => Context.get(context, Audience)),
				),
				yield* Layer.build(Audience.layerTest("human", "override")).pipe(
					Effect.map((context) => Context.get(context, Audience)),
				),
				yield* Layer.build(Audience.layerTest("agent")).pipe(Effect.map((context) => Context.get(context, Audience))),
				yield* Layer.build(Audience.layerTest("ci", "flag")).pipe(
					Effect.map((context) => Context.get(context, Audience)),
				),
			];
			assert.deepStrictEqual(
				audiences.map((audience) => ({ ...audience })),
				[
					{ kind: "human", source: "detected" },
					{ kind: "human", source: "override" },
					{ kind: "agent", source: "override" },
					{ kind: "ci", source: "flag" },
				],
			);
		}),
	);
});
