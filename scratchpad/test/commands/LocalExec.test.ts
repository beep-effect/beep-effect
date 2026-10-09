// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { ChildProcess } from "effect/process";
import { ExecContext, LocalExec, LocalExecError } from "../../effected/commands/LocalExec.ts";

/** The argv a command would actually spawn with. */
const argv = (command: ChildProcess.Command): ReadonlyArray<string> => {
	if (!ChildProcess.isStandardCommand(command)) {
		throw new Error("expected a standard command");
	}
	return [command.command, ...command.args];
};

describe("LocalExec.prefixes", () => {
	it("knows each package manager's exec, dlx and script-runner argv", () => {
		assert.deepStrictEqual(LocalExec.prefixes("pnpm"), {
			prefix: ["pnpm", "exec"],
			dlxPrefix: ["pnpm", "dlx"],
			scriptPrefix: ["pnpm", "run"],
		});
		assert.deepStrictEqual(LocalExec.prefixes("npm"), {
			prefix: ["npx", "--no", "--"],
			dlxPrefix: ["npx"],
			// The `--` is load-bearing: bare `npm run <script> --flag` silently
			// claims `--flag` for npm itself rather than forwarding it (probed
			// live at npm 11); `npm run -- <script> --flag` forwards it.
			scriptPrefix: ["npm", "run", "--"],
		});
		assert.deepStrictEqual(LocalExec.prefixes("yarn"), {
			prefix: ["yarn", "exec"],
			dlxPrefix: ["yarn", "dlx"],
			scriptPrefix: ["yarn", "run"],
		});
		assert.deepStrictEqual(LocalExec.prefixes("bun"), {
			prefix: ["bun", "x", "--no-install"],
			dlxPrefix: ["bun", "x"],
			scriptPrefix: ["bun", "run"],
		});
	});

	it("scriptPrefix is a projection of the same table, never a second opinion", () => {
		for (const launcher of ["npm", "pnpm", "yarn", "bun"] as const) {
			assert.deepStrictEqual(LocalExec.scriptPrefix(launcher), LocalExec.prefixes(launcher).scriptPrefix);
		}
	});

	it("every launcher uses the explicit `run` form", () => {
		// The uniformity is the point of the member: the consumer this replaces
		// kept a hand-rolled argv table that disagreed with itself about whether
		// `run` was needed per manager.
		for (const launcher of ["npm", "pnpm", "yarn", "bun"] as const) {
			assert.include(LocalExec.scriptPrefix(launcher), "run", `${launcher} script prefix`);
		}
	});
});

describe("ExecContext", () => {
	const context = ExecContext.make({
		label: "pnpm",
		prefix: ["pnpm", "exec"],
		dlxPrefix: ["pnpm", "dlx"],
		scriptPrefix: ["pnpm", "run"],
		directory: "/repo",
	});

	it("prefixes a command and applies the directory", () => {
		const applied = context.apply(ChildProcess.make("biome", ["--version"]));
		assert.deepStrictEqual(argv(applied), ["pnpm", "exec", "biome", "--version"]);
		if (!ChildProcess.isStandardCommand(applied)) assert.fail("expected a standard command");
		assert.strictEqual(applied.options.cwd, "/repo");
	});

	it("applyDlx uses the dlx prefix", () => {
		const applied = context.applyDlx(ChildProcess.make("biome", ["--version"]));
		assert.deepStrictEqual(argv(applied), ["pnpm", "dlx", "biome", "--version"]);
	});

	it("applyScript uses the script prefix and applies the directory", () => {
		// `command` is the script name; `args` are the script's arguments.
		const applied = context.applyScript(ChildProcess.make("ci:build", ["--watch"]));
		assert.deepStrictEqual(argv(applied), ["pnpm", "run", "ci:build", "--watch"]);
		if (!ChildProcess.isStandardCommand(applied)) assert.fail("expected a standard command");
		assert.strictEqual(applied.options.cwd, "/repo");
	});

	it("applyScript composes npm's `--` so flag arguments reach the script", () => {
		const { prefix, dlxPrefix, scriptPrefix } = LocalExec.prefixes("npm");
		const npm = ExecContext.make({ label: "npm", prefix, dlxPrefix, scriptPrefix });
		const applied = npm.applyScript(ChildProcess.make("ci:build", ["--watch"]));
		assert.deepStrictEqual(argv(applied), ["npm", "run", "--", "ci:build", "--watch"]);
	});

	it("leaves cwd unset when the context carries no directory", () => {
		const anywhere = ExecContext.make({
			label: "npm",
			prefix: ["npx", "--no", "--"],
			dlxPrefix: ["npx"],
			scriptPrefix: ["npm", "run", "--"],
		});
		const applied = anywhere.apply(ChildProcess.make("biome", []));
		if (!ChildProcess.isStandardCommand(applied)) assert.fail("expected a standard command");
		assert.strictEqual(applied.options.cwd, undefined);
		assert.deepStrictEqual(argv(applied), ["npx", "--no", "--", "biome"]);
	});

	it("does not mutate the command it is given", () => {
		const original = ChildProcess.make("biome", ["check"]);
		context.apply(original);
		assert.deepStrictEqual(argv(original), ["biome", "check"]);
	});
});

describe("LocalExec layers", () => {
	it.effect("layerNone answers None — the global-only wiring", () =>
		Effect.gen(function* () {
			const local = yield* LocalExec;
			const context = yield* local.context;
			assert.isTrue(Option.isNone(context));
		}).pipe(Effect.provide(LocalExec.layerNone)),
	);

	it.effect("layerFor answers a context built from the static prefix table", () =>
		Effect.gen(function* () {
			const local = yield* LocalExec;
			const context = yield* local.context;
			if (Option.isNone(context)) assert.fail("expected a context");
			assert.strictEqual(context.value.label, "pnpm");
			assert.deepStrictEqual(argv(context.value.apply(ChildProcess.make("biome", []))), ["pnpm", "exec", "biome"]);
			assert.deepStrictEqual(argv(context.value.applyScript(ChildProcess.make("ci:build", []))), [
				"pnpm",
				"run",
				"ci:build",
			]);
		}).pipe(Effect.provide(LocalExec.layerFor("pnpm", { directory: "/repo" }))),
	);

	it.effect("layerContext answers a caller-supplied context verbatim", () =>
		Effect.gen(function* () {
			const local = yield* LocalExec;
			const context = yield* local.context;
			if (Option.isNone(context)) assert.fail("expected a context");
			assert.strictEqual(context.value.label, "custom");
		}).pipe(
			Effect.provide(
				LocalExec.layerContext(
					ExecContext.make({ label: "custom", prefix: ["exec"], dlxPrefix: ["fetch"], scriptPrefix: ["script"] }),
				),
			),
		),
	);

	it.effect("layerTest defaults to None and accepts an override", () =>
		Effect.gen(function* () {
			const local = yield* LocalExec;
			assert.isTrue(Option.isNone(yield* local.context));
		}).pipe(Effect.provide(LocalExec.layerTest())),
	);

	it.effect("layerTest can answer a failure, so consumers can exercise the error path", () =>
		Effect.gen(function* () {
			const local = yield* LocalExec;
			const error = yield* Effect.flip(local.context);
			assert.instanceOf(error, LocalExecError);
		}).pipe(Effect.provide(LocalExec.layerTest({ context: Effect.fail(LocalExecError.make({})) }))),
	);
});
