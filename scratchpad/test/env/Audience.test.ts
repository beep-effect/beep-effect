// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Logger, Option } from "effect";
import type { AudienceOptions } from "../../effected/env/Audience.ts";
import { Audience } from "../../effected/env/Audience.ts";
import { CurrentRuntimeEnv, RuntimeEnv } from "../../effected/env/RuntimeEnv.ts";

const withEnv = (env: Record<string, string>) =>
	Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

/** A logger layer that replaces the defaults (mergeWithExisting is off), so TestConsole is never involved. */
const capture = (lines: Array<{ readonly level: string; readonly text: string }>) =>
	Logger.layer([
		Logger.make(({ logLevel, message }) => {
			lines.push({ level: logLevel, text: Array.isArray(message) ? message.join(" ") : String(message) });
		}),
	]);

const runtime = (fields: { agent?: string; ci?: "github-actions" | "generic" }) =>
	RuntimeEnv.make({
		agent: Option.fromNullishOr(fields.agent),
		ci: Option.fromNullishOr(fields.ci),
		terminal: Option.none(),
	});

/** `Audience.layer` fed by the real `CurrentRuntimeEnv.layer`, so the whole chain reads one environment. */
const audienceFrom = (env: Record<string, string>, envVar = "OKFIT_AUDIENCE") =>
	Audience.pipe(Effect.provide(Layer.provide(Audience.layer({ envVar }), CurrentRuntimeEnv.layer)), withEnv(env));

describe("Audience.detect", () => {
	it("agent beats CI (an agent inside a CI job gets agent output)", () =>
		assert.strictEqual(Audience.detect(runtime({ agent: "claude", ci: "github-actions" })), "agent"));
	it("CI only is ci", () => assert.strictEqual(Audience.detect(runtime({ ci: "generic" })), "ci"));
	it("agent only is agent", () => assert.strictEqual(Audience.detect(runtime({ agent: "codex" })), "agent"));
	it("nothing is human", () => assert.strictEqual(Audience.detect(runtime({})), "human"));
});

describe("Audience.layer", () => {
	it.effect("the override beats detection: CLAUDECODE=1 with OKFIT_AUDIENCE=human is a human", () =>
		Effect.map(audienceFrom({ CLAUDECODE: "1", OKFIT_AUDIENCE: "human" }), (audience) =>
			assert.deepStrictEqual({ ...audience }, { kind: "human", source: "override" }),
		),
	);

	it.effect("CLAUDECODE=1 with no override is an agent, detected, never a refusal", () =>
		Effect.map(audienceFrom({ CLAUDECODE: "1" }), (audience) =>
			assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" }),
		),
	);

	it.effect("no signals and no override is a detected human", () =>
		Effect.map(audienceFrom({}), (audience) =>
			assert.deepStrictEqual({ ...audience }, { kind: "human", source: "detected" }),
		),
	);

	it.effect("CI detection feeds the audience", () =>
		Effect.map(audienceFrom({ GITHUB_ACTIONS: "true" }), (audience) =>
			assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" }),
		),
	);

	it.effect("an invalid override falls back to detection and logs exactly one warning", () => {
		const lines: Array<{ readonly level: string; readonly text: string }> = [];
		return audienceFrom({ OKFIT_AUDIENCE: "robot", CLAUDECODE: "1" }).pipe(
			Effect.provide(capture(lines)),
			Effect.tap((audience) =>
				Effect.sync(() => {
					assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" });
					assert.lengthOf(lines, 1);
					assert.strictEqual(lines[0]?.level, "Warn");
					assert.strictEqual(lines[0]?.text, "OKFIT_AUDIENCE=robot is not one of human|agent|ci; ignoring it");
				}),
			),
		);
	});

	it.effect("the capture is live: a valid override logs nothing, an invalid one logs (positive control)", () => {
		const valid: Array<{ readonly level: string; readonly text: string }> = [];
		const invalid: Array<{ readonly level: string; readonly text: string }> = [];
		return Effect.gen(function* () {
			yield* audienceFrom({ OKFIT_AUDIENCE: "ci" }).pipe(Effect.provide(capture(valid)));
			yield* audienceFrom({ OKFIT_AUDIENCE: "nope" }).pipe(Effect.provide(capture(invalid)));
			assert.lengthOf(valid, 0);
			assert.lengthOf(invalid, 1);
		});
	});

	it.effect("an empty override is unset: detected, with no warning", () => {
		const lines: Array<{ readonly level: string; readonly text: string }> = [];
		return audienceFrom({ OKFIT_AUDIENCE: "", GITHUB_ACTIONS: "true" }).pipe(
			Effect.provide(capture(lines)),
			Effect.tap((audience) =>
				Effect.sync(() => {
					assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" });
					assert.lengthOf(lines, 0);
				}),
			),
		);
	});

	it.effect("an empty override is unset even when the provider preserves empty strings", () => {
		const lines: Array<{ readonly level: string; readonly text: string }> = [];
		return Audience.pipe(
			Effect.provide(Layer.provide(Audience.layer({ envVar: "OKFIT_AUDIENCE" }), CurrentRuntimeEnv.layer)),
			Effect.provide(capture(lines)),
			Effect.provideService(
				ConfigProvider.ConfigProvider,
				ConfigProvider.fromUnknown({ OKFIT_AUDIENCE: "", GITHUB_ACTIONS: "true" }, { preserveEmptyStrings: true }),
			),
			Effect.tap((audience) =>
				Effect.sync(() => {
					assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" });
					assert.lengthOf(lines, 0);
				}),
			),
		);
	});

	it.effect("the override is case-insensitive", () =>
		Effect.map(audienceFrom({ OKFIT_AUDIENCE: "HUMAN", CLAUDECODE: "1" }), (audience) =>
			assert.deepStrictEqual({ ...audience }, { kind: "human", source: "override" }),
		),
	);

	it.effect("without an envVar option the audience is always detected", () =>
		Effect.gen(function* () {
			const audience = yield* Audience;
			assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" });
		}).pipe(
			Effect.provide(Layer.provide(Audience.layer(), CurrentRuntimeEnv.layer)),
			withEnv({ CLAUDECODE: "1", OKFIT_AUDIENCE: "human" }),
		),
	);
});

describe("Audience options", () => {
	it("the named options type is the one layer takes", () => {
		const options: AudienceOptions = { envVar: "OKFIT_AUDIENCE" };
		assert.isDefined(Audience.layer(options));
	});
});

describe("Audience.layerTest", () => {
	it.effect("fixes the kind as an override and needs nothing", () =>
		Effect.gen(function* () {
			const audience = yield* Audience;
			assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "override" });
		}).pipe(Effect.provide(Audience.layerTest("ci"))),
	);

	it.effect("takes the source as a second argument, so a test can say the variable did not decide", () =>
		Effect.gen(function* () {
			const audiences = [
				yield* Audience.pipe(Effect.provide(Audience.layerTest("human", "detected"))),
				yield* Audience.pipe(Effect.provide(Audience.layerTest("human", "override"))),
				yield* Audience.pipe(Effect.provide(Audience.layerTest("agent"))),
				yield* Audience.pipe(Effect.provide(Audience.layerTest("ci", "flag"))),
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
