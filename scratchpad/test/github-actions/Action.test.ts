// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file asyncFunction:skip-file processEnv:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Cause, Config, ConfigProvider, Context, Effect, FileSystem, Layer, References, Schema } from "effect";
import { vi } from "vitest";
import { Action, ActionEnvironment, ActionEnvironmentError, ActionInput, ActionOutputs, ActionRuntime, describeCause } from "../../effected/github-actions/index.ts";

class Extra extends Context.Service<Extra, { readonly describe: Effect.Effect<string, ActionEnvironmentError> }>()("@beep/scratchpad/test/github-actions/Action.test/Extra") {}

class Boom extends Schema.TaggedError<Boom>()("Boom", { detail: Schema.String }) {
	override get message(): string {
		return `it went wrong: ${this.detail}`;
	}
}

/**
 * Run something with `console.log` captured and `process.exitCode` restored.
 *
 * @remarks
 * The exit code is the point of `Action.run`, and a test that failed to restore
 * it would fail the **vitest process** rather than the test — a green suite
 * whose exit code says otherwise.
 */
const RUNNER_ENV: Readonly<Record<string, string>> = {
	GITHUB_REPOSITORY: "acme/example",
	GITHUB_JOB: "test-job",
	// The runner uppercases an input name and replaces SPACES; dashes survive.
	"INPUT_MY-GREETING": "hello",
	// What the runner writes for an input the workflow did NOT supply.
	INPUT_OMITTED: "",
	// The false-green reproduction: a bare Config read of "dry-run" must reach
	// this variable through the installed provider.
	"INPUT_DRY-RUN": "from-input",
	// The shadowing pair: an input and an env var with the same bare name.
	INPUT_SHADOWED: "from-input",
	SHADOWED: "from-env",
	// A plain variable with no corresponding input, for the fallback.
	PLAIN_VAR: "from-env",
};

const captured = async (run: (lines: ReadonlyArray<string>) => Promise<void>): Promise<void> => {
	const lines: Array<string> = [];
	const spy = vi.spyOn(console, "log").mockImplementation((...parts: ReadonlyArray<unknown>) => {
		lines.push(parts.map(String).join(" "));
	});
	const previousExit = process.exitCode;
	const previousEnv = new Map(Object.keys(RUNNER_ENV).map((name) => [name, process.env[name]]));
	Object.assign(process.env, RUNNER_ENV);
	try {
		await run(lines);
	} finally {
		spy.mockRestore();
		// Restored on every path. `Action.run` sets `process.exitCode` by design,
		// and leaving it set would fail the VITEST process — a green suite whose
		// exit code says otherwise.
		process.exitCode = previousExit;
		for (const [name, value] of previousEnv) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
};

/**
 * {@link captured} with extra environment variables on top of `RUNNER_ENV`.
 *
 * @remarks
 * `undefined` DELETES the variable rather than leaving it alone: a suite run on
 * a runner with step debugging on inherits `RUNNER_DEBUG=1`, and a test of the
 * unset case must not silently become a test of the set one.
 */
const capturedWith = (
	env: Readonly<Record<string, string | undefined>>,
	run: (lines: ReadonlyArray<string>) => Promise<void>,
): Promise<void> =>
	captured(async (lines) => {
		const previous = new Map(Object.keys(env).map((name) => [name, process.env[name]]));
		const apply = (values: Iterable<readonly [string, string | undefined]>) => {
			for (const [name, value] of values) {
				if (value === undefined) delete process.env[name];
				else process.env[name] = value;
			}
		};
		apply(Object.entries(env));
		try {
			await run(lines);
		} finally {
			apply(previous);
		}
	});

describe("describeCause", () => {
	it("renders a typed failure as [Tag]: message", () => {
		// What a human scanning a workflow log for the first red line actually
		// needs: which error, and what it said.
		assert.strictEqual(describeCause(Cause.fail(Boom.make({ detail: "no token" }))), "[Boom]: it went wrong: no token");
	});

	it("marks a defect as one, because the two need different fixes", () => {
		const rendered = describeCause(Cause.die(new TypeError("x is not a function")));
		assert.include(rendered, "[defect]");
		assert.include(rendered, "x is not a function");
	});

	it("says something rather than nothing for an interruption", () => {
		// An interrupt carries no error and no message. The predecessor's fallback
		// chain ended in a sentinel for exactly this case; the requirement is only
		// that the line is never empty.
		assert.notStrictEqual(describeCause(Cause.interrupt(1)).trim(), "");
	});

	it("renders a plain Error, which is what a thrown library failure is", () => {
		assert.strictEqual(describeCause(Cause.fail(new RangeError("out of range"))), "[RangeError]: out of range");
	});
});

describe("Action.run", () => {
	it("resolves without touching the exit code when the program succeeds", async () => {
		await captured(async () => {
			await Action.run(Effect.void);
			assert.notStrictEqual(process.exitCode, 1);
		});
	});

	it("renders one ::error:: line and fails the step", async () => {
		await captured(async (lines) => {
			await Action.run(Effect.fail(Boom.make({ detail: "no token" })));
			// The exit code is this function's job: `ActionOutputs.setFailed`
			// deliberately does not set it, so an action that reports a failure and
			// then recovers is not doomed by a side effect it cannot undo.
			assert.strictEqual(process.exitCode, 1);
			const errors = lines.filter((line) => line.startsWith("::error::"));
			assert.lengthOf(errors, 1, "one line, not a wall of them");
			assert.include(errors[0] ?? "", "Action failed: [Boom]: it went wrong: no token");
		});
	});

	it("puts the fiddly diagnostics behind ::debug::, where the runner hides them", async () => {
		await captured(async (lines) => {
			await Action.run(Effect.fail(Boom.make({ detail: "no token" })));
			// A full cause render is genuinely useful and genuinely noisy. The
			// predecessor spliced a JS stack into the VISIBLE error, which in a
			// bundled action points at one line of `dist/main.js`.
			assert.isTrue(lines.some((line) => line.startsWith("::debug::")));
		});
	});

	it("fails the step for a defect too, not only for a typed failure", async () => {
		await captured(async (lines) => {
			await Action.run(
				Effect.sync((): void => {
					throw new TypeError("undefined is not a function");
				}),
			);
			assert.strictEqual(process.exitCode, 1);
			assert.isTrue(lines.some((line) => line.startsWith("::error::") && line.includes("[defect]")));
		});
	});

	it("never rejects, so an action entry point cannot produce an unhandled rejection", async () => {
		await captured(async () => {
			// Two failures — a failed step AND an unhandled rejection — and only the
			// first is legible in a workflow log.
			const settled = await Action.run(Effect.fail(Boom.make({ detail: "x" }))).then(
				() => "resolved",
				() => "rejected",
			);
			assert.strictEqual(settled, "resolved");
		});
	});

	it("provides the runner services the program asks for", async () => {
		await captured(async (lines) => {
			await Action.run(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const repository = yield* env.get("GITHUB_REPOSITORY");
					yield* Effect.logWarning(`saw ${repository}`);
				}),
			);
			assert.notStrictEqual(process.exitCode, 1);
			// Rendered as a workflow COMMAND, not merely printed: the runtime
			// installs the `Logger` that maps `Effect.log*` from any `@effected`
			// package onto `::warning::`, and the default logger would print the same
			// words in a shape the runner does not annotate.
			assert.include(lines, "::warning::saw acme/example");
		});
	});

	it("installs the INPUT_ config provider, so an input resolves without anyone spelling the variable", async () => {
		await captured(async (lines) => {
			await Action.run(
				Effect.gen(function* () {
					const greeting = yield* ActionInput.string("my-greeting");
					yield* Effect.log(`greeting=${greeting}`);
				}),
			);
			// `INPUT_MY-GREETING`, not `INPUT_MY_GREETING`: the runner uppercases and
			// replaces spaces, and leaves dashes alone. A consumer reading the wrong
			// spelling from `process.env` shipped that bug to production.
			assert.isTrue(lines.some((line) => line.includes("greeting=hello")));
			assert.notStrictEqual(process.exitCode, 1);
		});
	});

	it("reads an omitted input as absent, so a default is a default", async () => {
		await captured(async (lines) => {
			await Action.run(
				Effect.gen(function* () {
					const omitted = yield* ActionInput.string("omitted").pipe(Config.withDefault("fallback"));
					yield* Effect.logWarning(`omitted=${omitted}`);
				}),
			);
			// The runner writes `""` for every input a workflow left out, and an
			// empty string that read as PRESENT would make every optional input look
			// supplied and no default ever fire. Asserted end to end because the
			// runtime's installed provider deliberately resolves the accessor's
			// variable through the AMBIENT half — this is the test that fails if
			// the empty-is-absent semantics it relies on ever move.
			assert.include(lines, "::warning::omitted=fallback");
		});
	});

	it("resolves a bare Config read through the INPUT_ derivation — the false-green class, dead at the root", async () => {
		await captured(async (lines) => {
			await Action.run(
				Effect.gen(function* () {
					// The exact shipped defect: a bare read with a default. Before the
					// runtime installed the provider, the plain-named lookup found
					// nothing, the default fired, and a rehearsal flag silently read as
					// its fallback on every run.
					const dryRun = yield* Config.String("dry-run").pipe(Config.withDefault("defaulted"));
					yield* Effect.logWarning(`dry-run=${dryRun}`);
				}),
			);
			assert.include(lines, "::warning::dry-run=from-input", "the default must NOT fire");
			assert.notStrictEqual(process.exitCode, 1);
		});
	});

	it("still resolves a plain env var with no corresponding input", async () => {
		await captured(async (lines) => {
			await Action.run(
				Effect.gen(function* () {
					yield* Effect.logWarning(`plain=${yield* Config.String("PLAIN_VAR")}`);
				}),
			);
			// The fallback half of the installed provider is the ambient lookup
			// unchanged — a program reading ordinary configuration is untouched.
			assert.include(lines, "::warning::plain=from-env");
			assert.notStrictEqual(process.exitCode, 1);
		});
	});

	it("an input shadows an env var of the same bare name — pinned, not accidental", async () => {
		await captured(async (lines) => {
			await Action.run(
				Effect.gen(function* () {
					// Both INPUT_SHADOWED and SHADOWED are set. The input wins for a
					// bare read in ANY casing, because the derivation uppercases; that
					// is the documented trade for killing the false-green class.
					yield* Effect.logWarning(`upper=${yield* Config.String("SHADOWED")}`);
					yield* Effect.logWarning(`lower=${yield* Config.String("shadowed")}`);
				}),
			);
			assert.include(lines, "::warning::upper=from-input");
			assert.include(lines, "::warning::lower=from-input");
		});
	});

	it("a caller-supplied ConfigProvider in the extra layer wins", async () => {
		await captured(async (lines) => {
			await Action.run(
				Effect.gen(function* () {
					const dryRun = yield* Config.String("dry-run").pipe(Config.withDefault("defaulted"));
					yield* Effect.logWarning(`dry-run=${dryRun}`);
				}),
				// Normal layer precedence: the extra layer's context merges LAST in
				// `Action.run`'s composition, so this replaces the installed provider
				// wholesale. INPUT_DRY-RUN is set in the environment — seeing
				// "from-caller" rather than "from-input" is what proves the override.
				{ layer: ConfigProvider.layer(ConfigProvider.fromUnknown({ "dry-run": "from-caller" })) },
			);
			assert.include(lines, "::warning::dry-run=from-caller");
		});
	});

	it("wires an extra layer against the runtime's own services", async () => {
		await captured(async (lines) => {
			// The ergonomic claim: a layer whose requirements are satisfied by the
			// runtime — which is every heavy service in this package — costs the
			// caller one line and no wiring.
			const extra = Layer.effect(
				Extra,
				Effect.map(ActionEnvironment, (env) => ({ describe: env.get("GITHUB_JOB") })),
			);
			await Action.run(
				Effect.gen(function* () {
					const service = yield* Extra;
					yield* Effect.log(`job=${yield* service.describe}`);
				}),
				{ layer: extra },
			);
			assert.isTrue(lines.some((line) => line.includes("job=test-job")));
			assert.notStrictEqual(process.exitCode, 1);
		});
	});

	it("takes a layer requiring the PLATFORM and ActionOutputs, with no sub-provide", async () => {
		await captured(async (lines) => {
			// The regression this exists to catch, from the fluency audit's Case 3:
			// a publish helper that masks a registry token used to force a SECOND
			// `NodeServices`-backed `ActionOutputs` inside the consumer's own
			// composition — with a five-line comment explaining that `Action.run`'s
			// layer option "must be self-contained" — purely so `setSecret` could be
			// reached. It is not self-contained: `ActionRunOptions.layer` is typed
			// `Layer<R, never, ActionServices>`, so a layer may require anything the
			// runtime provides and the platform is provided ONCE, at the boundary.
			const publishLike = Layer.effect(
				Extra,
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const outputs = yield* ActionOutputs;
					return {
						describe: Effect.as(outputs.setSecret("s3cret"), typeof fs.readFile === "function" ? "masked" : "no fs"),
					};
				}),
			);
			await Action.run(
				Effect.gen(function* () {
					const service = yield* Extra;
					yield* Effect.logWarning(`publish=${yield* service.describe}`);
				}),
				{ layer: publishLike },
			);
			assert.include(lines, "::add-mask::s3cret", "the mask reached the runner with no sub-provide");
			assert.include(lines, "::warning::publish=masked", "and the platform reached the layer");
			assert.notStrictEqual(process.exitCode, 1);
		});
	});

	it("does not swallow the transcript of a run that then fails", async () => {
		await captured(async (lines) => {
			// The predecessor wrapped every program in a log buffer, and an unhandled
			// defect inside the buffer swallowed the whole transcript: the run failed
			// and printed nothing at all. Buffering is opt-in now.
			await Action.run(Effect.flatMap(Effect.log("halfway through"), () => Effect.fail(Boom.make({ detail: "later" }))));
			assert.isTrue(lines.some((line) => line.includes("halfway through")));
			assert.isTrue(lines.some((line) => line.startsWith("::error::")));
			assert.strictEqual(process.exitCode, 1);
		});
	});

	it.effect("programs composed over ActionRuntime.layer see the identical resolution", () =>
		Effect.gen(function* () {
			// The same provider `Action.run` installs, reached through the layer a
			// test composes directly — with the ambient environment injected as a
			// provider BENEATH the runtime, so nothing touches the process.
			assert.strictEqual(yield* Config.String("dry-run").pipe(Config.withDefault("defaulted")), "x");
			assert.strictEqual(yield* Config.String("PLAIN_VAR"), "y");
		}).pipe(
			Effect.provide(ActionRuntime.layer),
			Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "INPUT_DRY-RUN": "x", PLAIN_VAR: "y" } }))),
		),
	);

	it("exposes the runtime as a bound layer, not a factory", () => {
		// A layer-returning function mints a fresh layer per call and layers
		// memoize by reference, so a factory would re-read `process.env` at every
		// composition site.
		assert.strictEqual(ActionRuntime.layer, ActionRuntime.layer);
	});
});

describe("Action.run step debugging", () => {
	// Info goes out in both cases, so an absent debug line is a filtered entry
	// and not a program that never ran — the positive control every "absent"
	// assertion below leans on.
	const probe = Effect.gen(function* () {
		yield* Effect.logInfo("probe-info");
		yield* Effect.logDebug("probe-debug");
	});

	it("lowers the minimum log level to Debug when RUNNER_DEBUG=1, so Effect.logDebug reaches the runner", async () => {
		await capturedWith({ RUNNER_DEBUG: "1" }, async (lines) => {
			await Action.run(probe);
			assert.include(lines, "probe-info");
			// Rendered as `::debug::`, not merely printed: the entry survived
			// core's filter AND went through the workflow-command logger.
			assert.include(lines, "::debug::probe-debug");
		});
	});

	it("leaves the Info default alone when step debugging is off", async () => {
		await capturedWith({ RUNNER_DEBUG: undefined }, async (lines) => {
			await Action.run(probe);
			assert.include(lines, "probe-info");
			assert.isFalse(lines.some((line) => line.includes("probe-debug")));
		});
	});

	it("honours an explicit opt-out even with step debugging on", async () => {
		await capturedWith({ RUNNER_DEBUG: "1" }, async (lines) => {
			await Action.run(probe, { stepDebugLogLevel: false });
			assert.include(lines, "probe-info");
			assert.isFalse(lines.some((line) => line.includes("probe-debug")));
		});
	});

	it("only ever lowers the level: a caller that already asked for Trace keeps it", async () => {
		await capturedWith({ RUNNER_DEBUG: "1" }, async (lines) => {
			await Action.run(Effect.logTrace("probe-trace"), {
				layer: Layer.succeed(References.MinimumLogLevel, "Trace"),
			});
			// Clamping to Debug here would silently RAISE the caller's floor and
			// drop every Trace entry the moment someone turned step debugging on.
			assert.include(lines, "::debug::probe-trace");
		});
	});
});
