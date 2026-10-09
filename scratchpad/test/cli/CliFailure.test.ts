import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import type { AudienceKind, StreamEnv } from "../../effected/env/index.ts";
import { Audience, TerminalEnv } from "../../effected/env/index.ts";
import { Cause, ConfigProvider, Console, Context, Effect, Exit, Layer, Runtime, Schema, Stdio, Terminal } from "effect";
import { Command } from "effect/cli";
import type { Block, Document, RenderContext } from "../../effected/cli/index.ts";
import {
	Cancelled,
	CliAudience,
	CliDoc,
	CliFailure,
	CliLinks,
	CliRuntime,
	CliTheme,
	Doc,
	NotInteractive,
	Render,
	SchemaIssueRenderer,
} from "../../effected/cli/index.ts";

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(7);

const layers = (audience: AudienceKind, stdout: Partial<StreamEnv> = {}, stderr: Partial<StreamEnv> = {}) => {
	const terminal = TerminalEnv.layerTest({
		stdinIsTerminal: true,
		stdout: { isTerminal: true, ...stdout },
		stderr: { isTerminal: true, ...stderr },
	});
	return Layer.mergeAll(
		terminal,
		CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(terminal)),
		Audience.layerTest(audience),
		CliLinks.layerTest("vscode"),
	);
};

/** The context a stderr report is rendered with. */
const contextFor = (
	audience: AudienceKind,
	stderr: Partial<StreamEnv> = {},
	options?: { readonly displayPath?: (p: string) => string },
) => Effect.runSync(Render.context("stderr", options).pipe(Effect.provide(layers(audience, {}, stderr))));

const plain = (doc: Document, audience: AudienceKind = "agent"): string => Render.plain(doc, contextFor(audience));

class Boom extends Error {
	readonly _tag = "Boom";
	constructor(message: string) {
		super(message);
		this.name = "Boom";
	}
}

const kinds = (doc: Document): ReadonlyArray<string> => doc.map((block: Block) => block._tag);

/** A defect whose stack is exactly `frames`, as V8 prints them. */
const errorWithStack = (message: string, frames: ReadonlyArray<string>): Error => {
	const error = new Error(message);
	error.stack = [`Error: ${message}`, ...frames.map((frame) => `    at ${frame}`)].join("\n");
	return error;
};

const USER = "/repo/src/run.ts";
const INTERNAL_FRAMES = [
	"Module._compile (node:internal/modules/cjs/loader:1554:14)",
	"IteratorImpl.~effect/Effect/successCont (file:///repo/node_modules/.pnpm/effect@4.0.0/node_modules/effect/dist/internal/effect.js:987:28)",
	"Generator.next (<anonymous>)",
	"/home/me/work/packages/effect/src/internal/effect.ts:10:5",
];

describe("CliFailure.toDoc: a typed failure", () => {
	it("is one failure status line carrying the error's own text", () => {
		const doc = CliFailure.toDoc(Cause.fail(new Boom("disk full")));
		assert.deepStrictEqual(kinds(doc), ["Paragraph"]);
		const text = plain(doc);
		assert.strictEqual(text.split("\n").length, 1);
		assert.include(text, String(new Boom("disk full")));
		assert.include(text, "✗");
	});

	it("a non-error value is its string", () => {
		assert.include(plain(CliFailure.toDoc(Cause.fail("plain text"))), "plain text");
	});

	it("a failure that cannot be stringified is still one line, never a throw", () => {
		const hostile = Object.create(null) as object;
		const doc = CliFailure.toDoc(Cause.fail(hostile));
		assert.isAbove(plain(doc).length, 0);
	});

	it("a message with several lines is several lines, the status on the first", () => {
		const lines = plain(CliFailure.toDoc(Cause.fail(new Error("one\ntwo\nthree")))).split("\n");
		assert.strictEqual(lines.length, 3);
		assert.include(lines[0] ?? "", "one");
		assert.include(lines[2] ?? "", "three");
	});
});

describe("CliFailure.toDoc: who writes the document", () => {
	class Mine extends Error {
		[CliDoc](): Document {
			return [Doc.heading(2, "my own"), Doc.paragraph("with a body")];
		}
	}

	it("an error with [CliDoc] uses its document, and nothing else", () => {
		const doc = CliFailure.toDoc(Cause.fail(new Mine("ignored message")));
		assert.deepStrictEqual(kinds(doc), ["Heading", "Paragraph"]);
		assert.notInclude(plain(doc), "ignored message");
	});

	it("a throwing [CliDoc] falls back to the generic line", () => {
		class Bad extends Error {
			[CliDoc](): Document {
				throw new Error("nope");
			}
		}
		assert.include(plain(CliFailure.toDoc(Cause.fail(new Bad("fallback me")))), "fallback me");
	});

	it("the per-tag render map is honoured, and [CliDoc] still beats it", () => {
		const render = { Boom: (error: unknown) => [Doc.paragraph(`custom for ${(error as Boom).message}`)] };
		assert.strictEqual(plain(CliFailure.toDoc(Cause.fail(new Boom("x")), { render })), "custom for x");
		assert.notInclude(
			plain(CliFailure.toDoc(Cause.fail(new Mine("m")), { render: { Mine: () => [Doc.paragraph("map")] } })),
			"map",
		);
		// A tag with no entry is the generic line, and an inherited name is not an entry.
		assert.include(plain(CliFailure.toDoc(Cause.fail(new Boom("y")), { render: { Other: () => [] } })), "y");
		assert.include(plain(CliFailure.toDoc(Cause.fail({ _tag: "constructor", message: "z" }), { render: {} })), "z");
	});
});

describe("CliFailure.toDoc: a schema failure", () => {
	const Config = Schema.Struct({
		owner: Schema.String,
		groups: Schema.Record(Schema.String, Schema.Struct({ repos: Schema.Array(Schema.String) })),
	});
	const decode = (input: unknown) =>
		Effect.runSync(
			Effect.exit(Schema.decodeUnknownEffect(Config)(input, { onExcessProperty: "error", errors: "all" })),
		);
	const failureOf = (input: unknown): { readonly issue: unknown } => {
		const exit = decode(input);
		if (!Exit.isFailure(exit)) throw new Error("expected a failure");
		return (exit.cause.reasons[0] as unknown as { readonly error: { readonly issue: unknown } }).error;
	};

	it("is a Tree, in which every rejected value of today's renderer appears with its path", () => {
		const error = failureOf({ owner: 1, groups: { g: { repos: ["r"], extra: 1 } }, ownr: "typo" });
		const doc = CliFailure.toDoc(Cause.fail(error));
		assert.deepStrictEqual(kinds(doc), ["Tree"]);
		const text = plain(doc);
		const lines = SchemaIssueRenderer.render(error.issue);
		assert.isAbove(lines.length, 1);
		for (const line of lines) {
			const [message, path] = line.split(" at ");
			assert.include(text, message ?? "", line);
			for (const segment of (path ?? "").split(".").filter((s) => s !== "")) assert.include(text, segment, line);
		}
		// The nesting is the path: g sits under groups.
		assert.match(text, /groups\n.*g\n.*extra: unknown key/);
	});

	it("a bare issue and an error carrying one give the same tree", () => {
		const error = failureOf({ owner: "o", groups: {}, ownr: "typo" });
		const viaError = CliFailure.toDoc(Cause.fail(error));
		const viaIssue = CliFailure.toDoc(Cause.fail(error.issue));
		assert.deepStrictEqual(kinds(viaIssue), ["Tree"]);
		assert.include(plain(viaIssue), "ownr: unknown key");
		assert.include(plain(viaError), "ownr: unknown key");
	});

	it("a value with a malformed issue is the generic line, not a throw", () => {
		assert.include(plain(CliFailure.toDoc(Cause.fail({ issue: { not: "an issue" }, message: "weird" }))), "weird");
	});
});

describe("CliFailure.toDoc: a defect", () => {
	it("is its message, then a collapsible stack of the user's frames only", () => {
		const error = errorWithStack("boom", [`run (${USER}:3:4)`, ...INTERNAL_FRAMES, `main (${USER}:9:1)`]);
		const doc = CliFailure.toDoc(Cause.die(error));
		assert.deepStrictEqual(kinds(doc), ["Paragraph", "Collapsible"]);
		const text = plain(doc);
		assert.include(text, "Error: boom");
		assert.include(text, "stack");
		assert.include(text, `${USER}:3:4`);
		assert.include(text, `${USER}:9:1`);
		for (const hidden of ["node:internal", "node_modules/effect", "effect/src", "Generator.next"]) {
			assert.notInclude(text, hidden);
		}
	});

	it("a stack of nothing but internal frames says so, with the count, never an empty block", () => {
		const doc = CliFailure.toDoc(Cause.die(errorWithStack("boom", INTERNAL_FRAMES)));
		const text = plain(doc);
		assert.include(text, `no user frames (${INTERNAL_FRAMES.length} internal frames hidden)`);
		const stack = doc.find((block) => block._tag === "Collapsible");
		assert.isDefined(stack);
		assert.isAbove((stack as { readonly body: ReadonlyArray<unknown> }).body.length, 0);
	});

	it("a single hidden frame is counted as one", () => {
		const text = plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", [INTERNAL_FRAMES[0] as string]))));
		assert.include(text, "no user frames (1 internal frames hidden)");
	});

	it("an error with no stack at all says there is none", () => {
		const error = new Error("bare");
		Object.defineProperty(error, "stack", { value: undefined });
		assert.include(plain(CliFailure.toDoc(Cause.die(error))), "no stack");
	});

	it("displayPath relativises every frame", () => {
		const error = errorWithStack("boom", [`run (${USER}:3:4)`]);
		const displayPath = (p: string) => p.replace("/repo/", "");
		const doc = CliFailure.toDoc(Cause.die(error), { displayPath });
		// The context applies the same function to the link's target, as the default report does.
		const text = Render.plain(doc, contextFor("agent", {}, { displayPath }));
		assert.include(text, "src/run.ts:3:4");
		assert.notInclude(text, "/repo/");
	});

	it("a frame is a file link: an editor hyperlink for a human on a linking terminal, never for an agent", () => {
		const doc = CliFailure.toDoc(Cause.die(errorWithStack("boom", [`run (${USER}:3:4)`])));
		const human = Render.ansi(doc, contextFor("human", { hyperlinks: true, color: "basic" }));
		assert.include(human, `${ESC}]8;;vscode://file/repo/src/run.ts:3:4`);
		const agent = Render.plain(doc, contextFor("agent", { hyperlinks: true, color: "basic" }));
		assert.notInclude(agent, ESC);
		const agentAnsi = Render.ansi(doc, contextFor("agent", { hyperlinks: true, color: "basic" }));
		assert.notInclude(agentAnsi, `${ESC}]8`);
	});

	it("file URLs in a stack are paths, and a frame with no file stays plain text", () => {
		const text = plain(
			CliFailure.toDoc(
				Cause.die(errorWithStack("boom", ["file:///repo/src/esm%20x.ts:5:6", "eval (eval at <anonymous>)"])),
			),
		);
		assert.include(text, "/repo/src/esm x.ts:5:6");
	});

	it("an Error.cause chain nests as a Tree under the message", () => {
		const error = new Error("outer", { cause: new Error("middle", { cause: new Error("root") }) });
		const doc = CliFailure.toDoc(Cause.die(error));
		const tree = doc.find((block) => block._tag === "Tree");
		assert.isDefined(tree);
		const text = plain(doc);
		const order = ["outer", "middle", "root"].map((word) => text.lastIndexOf(word));
		assert.deepStrictEqual(
			[...order].sort((a, b) => a - b),
			order,
		);
		assert.match(text, /middle\n.*root/);
	});

	it("a cyclic cause chain ends", () => {
		const a = new Error("a");
		const b = new Error("b", { cause: a });
		(a as { cause?: unknown }).cause = b;
		assert.include(plain(CliFailure.toDoc(Cause.die(a))), "b");
	});

	it("a defect that is not an Error is its string, with no stack", () => {
		const doc = CliFailure.toDoc(Cause.die("just a string"));
		assert.deepStrictEqual(kinds(doc), ["Paragraph"]);
		assert.include(plain(doc), "just a string");
	});
});

describe("CliFailure.toDoc: the span path", () => {
	const spanned = Effect.fail(new Boom("x")).pipe(Effect.withSpan("inner"), Effect.withSpan("outer"));

	it.effect("is shown as `in: outer › inner`, outermost first, with the audience's separator", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(spanned);
			if (!Exit.isFailure(exit)) throw new Error("expected a failure");
			const doc = CliFailure.toDoc(exit.cause);
			assert.include(Render.plain(doc, contextFor("agent")), "in: outer > inner");
			assert.include(Render.ansi(doc, contextFor("human")), "in: outer › inner");
		}),
	);

	it("a reason with no spans has no `in:` line", () => {
		assert.notInclude(plain(CliFailure.toDoc(Cause.fail(new Boom("x")))), "in:");
	});

	it.effect("the names are the annotation's StackFrame chain, which is where the runtime keeps them", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(spanned);
			if (!Exit.isFailure(exit)) throw new Error("expected a failure");
			const frame = Context.getOrUndefined(
				Cause.reasonAnnotations(exit.cause.reasons[0] as Cause.Reason<unknown>),
				Cause.StackTrace,
			);
			const names: Array<string> = [];
			for (let current = frame; current !== undefined; current = current.parent) names.push(current.name);
			assert.deepStrictEqual(names, ["inner", "outer"]);
		}),
	);
});

describe("CliFailure.toDoc: interrupts and prompts", () => {
	it("an interrupt-only cause is the single line `interrupted`", () => {
		const doc = CliFailure.toDoc(Cause.interrupt(3));
		assert.deepStrictEqual(kinds(doc), ["Paragraph"]);
		assert.strictEqual(plain(doc), "interrupted");
	});

	it("interrupts beside a real failure are not rendered: the failure is the story", () => {
		const cause = Cause.combine(Cause.interrupt(1), Cause.fail(new Boom("real")));
		const text = plain(CliFailure.toDoc(cause));
		assert.include(text, "real");
		assert.notInclude(text, "interrupted");
	});

	it("Cancelled and NotInteractive keep their one fixed line, with no status glyph", () => {
		assert.strictEqual(
			plain(CliFailure.toDoc(Cause.fail(new Cancelled({ reason: "escape" })))),
			"cancelled; nothing written",
		);
		assert.strictEqual(
			plain(CliFailure.toDoc(Cause.fail(new NotInteractive()))),
			"not interactive: run in a terminal or pass the flag",
		);
	});

	it("an empty cause is an empty document", () => {
		assert.deepStrictEqual(CliFailure.toDoc(Cause.empty), []);
	});

	it("every reason of a cause is rendered, in order", () => {
		const text = plain(CliFailure.toDoc(Cause.combine(Cause.fail(new Boom("first")), Cause.die(new Error("second")))));
		assert.isBelow(text.indexOf("first"), text.indexOf("second"));
	});
});

describe("CliFailure.toDoc: hostile text", () => {
	const HOSTILE = `bad${ESC}[31m red ${ESC}]8;;http://evil${BEL}link${ESC}]8;;${BEL}\rovertyped`;

	const documents: ReadonlyArray<readonly [string, Document]> = [
		["a typed error's message", CliFailure.toDoc(Cause.fail(new Error(HOSTILE)))],
		["a string failure", CliFailure.toDoc(Cause.fail(HOSTILE))],
		["a defect's message", CliFailure.toDoc(Cause.die(new Error(HOSTILE)))],
		["a stack frame", CliFailure.toDoc(Cause.die(errorWithStack("m", [`fn${HOSTILE} (${USER}${HOSTILE}:1:2)`])))],
		["a cause message", CliFailure.toDoc(Cause.die(new Error("o", { cause: new Error(HOSTILE) })))],
		["a thrown value", CliFailure.toDoc(Cause.die({ toString: () => HOSTILE }))],
	];

	for (const [name, doc] of documents) {
		it(`${name}: no escape, BEL or carriage return survives plain or colourless ansi`, () => {
			for (const text of [plain(doc), Render.ansi(doc, contextFor("human")), Render.githubLog(doc, contextFor("ci"))]) {
				assert.notInclude(text, ESC);
				assert.notInclude(text, BEL);
				assert.notInclude(text, "\r");
			}
		});

		it(`${name}: with colour and links on, the only escapes are the kit's own balanced ones`, () => {
			const text = Render.ansi(doc, contextFor("human", { hyperlinks: true, color: "truecolor" }));
			assert.notInclude(text, "evil");
			assert.notInclude(text, `${ESC}[31m red`);
		});
	}
});

describe("CliRuntime: the default failure path", () => {
	const platform = (stdout: boolean) =>
		Layer.mergeAll(
			Stdio.layerTest({ stdinIsTerminal: Effect.succeed(stdout), stdoutIsTerminal: Effect.succeed(stdout) }),
			Layer.succeed(
				Terminal.Terminal,
				Terminal.make({
					columns: Effect.succeed(100),
					rows: Effect.succeed(24),
					readInput: Effect.die("unused"),
					readLine: Effect.die("unused"),
					display: () => Effect.void,
				}),
			),
		);

	const capturing = () => {
		const err: string[] = [];
		const out: string[] = [];
		const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
			log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
			error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
		});
		return { double, err, out };
	};

	const runMain = <E>(
		program: Effect.Effect<void, E>,
		env: Record<string, string>,
		tty: boolean,
		options: object = {},
	) =>
		Effect.gen(function* () {
			const { double, err, out } = capturing();
			const exit = yield* CliRuntime.main(program, { platform: platform(tty), env: {}, ...options }).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
				Effect.provideService(Console.Console, double),
			);
			const code = Exit.isFailure(exit) ? Runtime.getErrorExitCode(Cause.squash(exit.cause)) : 0;
			return { err, out, code };
		});

	// Fresh errors per run: `reportFailures` marks the error it reports with its exit code, and a shared instance would
	// carry the first run's mark into the next.
	const failing = Effect.suspend(() => Effect.fail(new Boom("disk full")));
	const dying = Effect.suspend(() => Effect.die(errorWithStack("kaboom", [`run (${USER}:3:4)`, ...INTERNAL_FRAMES])));

	it.effect("an agent gets the plain rendering: a status line, no escape of any kind", () =>
		Effect.gen(function* () {
			const { err, out, code } = yield* runMain(failing, { AI_AGENT: "claude", TERM: "xterm-256color" }, true);
			assert.strictEqual(code, 1);
			assert.deepStrictEqual(out, []);
			assert.strictEqual(err.length, 1);
			assert.include(err[0] ?? "", "disk full");
			assert.include(err[0] ?? "", "✗");
			assert.notInclude(err.join("\n"), ESC);
		}),
	);

	it.effect("a human on a colour terminal gets the painted rendering", () =>
		Effect.gen(function* () {
			const { err, code } = yield* runMain(failing, { TERM: "xterm-256color" }, true);
			assert.strictEqual(code, 1);
			assert.include(err.join("\n"), "disk full");
			assert.include(err.join("\n"), `${ESC}[`);
		}),
	);

	it.effect("a defect shows its cleaned stack under a stack heading, for either audience", () =>
		Effect.gen(function* () {
			for (const env of [{ AI_AGENT: "claude" }, { TERM: "xterm-256color" }]) {
				const { err, code } = yield* runMain(dying, env, true);
				assert.strictEqual(code, 1);
				const text = err.join("\n");
				assert.include(text, "kaboom");
				assert.include(text, `${USER}:3:4`);
				assert.notInclude(text, "node:internal");
				assert.notInclude(text, "node_modules/effect");
			}
		}),
	);

	it.effect("a real Effect.sync defect shows the frame that threw", () =>
		Effect.gen(function* () {
			let thrown: Error | undefined;
			const program = Effect.sync(() => {
				thrown = new Error("thrown by a thunk");
				throw thrown;
			});
			const { err } = yield* runMain(program, { AI_AGENT: "claude" }, true);
			const text = err.join("\n");
			assert.include(text, "thrown by a thunk");
			// V8 names the thunk's own frame by Effect's method alias; the frame is still the program's.
			const first = /\((.*CliFailure\.test\.ts:\d+:\d+)\)/.exec(thrown?.stack ?? "")?.[1];
			assert.isDefined(first, "control: V8 put the thunk's frame on the stack");
			assert.include(text, first as string);
		}),
	);

	it.effect("exit codes are unchanged: the exitCode option, a marked error's own code, and Cancelled's 130", () =>
		Effect.gen(function* () {
			assert.strictEqual((yield* runMain(failing, {}, true, { exitCode: 7 })).code, 7);
			const marked = CliRuntime.reported(new Boom("m"), 4);
			assert.strictEqual((yield* runMain(Effect.fail(marked), {}, true, { exitCode: 7 })).code, 4);
			const cancelled = yield* runMain(Effect.fail(new Cancelled({ reason: "escape" })), { AI_AGENT: "claude" }, true);
			assert.strictEqual(cancelled.code, 130);
			assert.deepStrictEqual(cancelled.err, ["cancelled; nothing written"]);
		}),
	);

	it.effect("a consumer render, as a string or as lines, still overrides it", () =>
		Effect.gen(function* () {
			const one = yield* runMain(failing, {}, true, { render: () => "mine" });
			assert.deepStrictEqual(one.err, ["mine"]);
			const many = yield* runMain(failing, {}, true, { render: () => ["a", "b"] });
			assert.deepStrictEqual(many.err, ["a", "b"]);
		}),
	);

	it.effect("the failure report is written through the logger and never to stdout", () =>
		Effect.gen(function* () {
			const { out } = yield* runMain(failing, { AI_AGENT: "claude" }, true);
			assert.deepStrictEqual(out, []);
		}),
	);

	it.effect("without env the report is the plain rendering too, with no services to ask", () =>
		Effect.gen(function* () {
			const { double, err } = capturing();
			yield* CliRuntime.main(failing, { platform: Layer.empty }).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
			);
			assert.strictEqual(err.length, 1);
			assert.include(err[0] ?? "", "disk full");
			assert.notInclude(err[0] ?? "", ESC);
		}),
	);

	it.effect("end to end, a hostile message and stack frame reach stderr with no escape but the kit's own", () =>
		Effect.gen(function* () {
			const hostile = `x${ESC}]8;;http://evil${BEL}y${ESC}[2J\rz`;
			const program = Effect.suspend(() =>
				Effect.die(errorWithStack(hostile, [`fn${hostile} (${USER}${hostile}:1:2)`])),
			);
			for (const env of [{ AI_AGENT: "claude", TERM: "xterm-256color" }, { TERM: "xterm-256color" }]) {
				const { err } = yield* runMain(program, env, true);
				const text = err.join("\n");
				assert.notInclude(text, "evil");
				assert.notInclude(text, BEL);
				assert.notInclude(text, "\r");
				assert.notInclude(text, `${ESC}[2J`);
				// Whatever escapes remain are SGR the kit painted: no OSC and no cursor control.
				assert.notInclude(text, `${ESC}]`);
				for (const line of err) {
					for (const match of line.matchAll(new RegExp(`${ESC}(.)`, "g"))) assert.strictEqual(match[1], "[");
				}
			}
		}),
	);

	it.effect("an audience flag decides the report's audience, and --log-level none does not silence the report", () =>
		Effect.gen(function* () {
			const runTool = (argv: ReadonlyArray<string>, env: Record<string, string> = { TERM: "xterm-256color" }) =>
				Effect.gen(function* () {
					const { double, err } = capturing();
					const tool = Command.make("tool").pipe(
						Command.withSharedFlags(CliAudience.flags()),
						Command.withSubcommands([Command.make("go", {}, () => Effect.fail(new Boom("flagged")))]),
					);
					// The platform main builds the environment from is the colour terminal; the command only gets the
					// services core's runner needs, so they cannot replace the terminal.
					yield* CliRuntime.main(
						CliAudience.runWith(tool, { version: "1.0.0" })(argv).pipe(Effect.provide(NodeServices.layer)),
						{
							platform: platform(true),
							env: {},
						},
					).pipe(
						Effect.exit,
						Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
						Effect.provideService(Console.Console, double),
					);
					return err.join("\n");
				});
			const flagged = yield* runTool(["--agent", "go"]);
			assert.include(flagged, "flagged");
			assert.notInclude(flagged, ESC);
			const unflagged = yield* runTool(["go"]);
			assert.include(unflagged, "flagged");
			assert.include(unflagged, ESC, "control: with no flag the same terminal is painted");
			// And --human restores the painted report where the environment DETECTED an agent.
			const agentEnv = { AI_AGENT: "x", TERM: "xterm-256color" };
			const detected = yield* runTool(["go"], agentEnv);
			assert.include(detected, "flagged");
			assert.notInclude(detected, ESC, "control: a detected agent gets the plain report");
			const human = yield* runTool(["--human", "go"], agentEnv);
			assert.include(human, "flagged");
			assert.include(human, ESC);
			// --log-level none silences the logger, but not the failure report, which is written outside that scope.
			const silent = yield* runTool(["--log-level", "none", "go"], agentEnv);
			assert.include(silent, "flagged");
		}),
	);

	it.effect('--agent rewrites the report target and keeps stackFrames: "all"', () =>
		Effect.gen(function* () {
			const runTool = (stackFrames: "app" | "all") =>
				Effect.gen(function* () {
					const { double, err } = capturing();
					const vendorDefect = Effect.suspend(() => {
						const error = new Error("kaboom");
						error.stack = `Error: kaboom\n    at run (${USER}:3:4)\n    at vendor (/repo/node_modules/vendor/x.js:7:8)`;
						return Effect.die(error);
					});
					const tool = Command.make("tool").pipe(
						Command.withSharedFlags(CliAudience.flags()),
						Command.withSubcommands([Command.make("go", {}, () => vendorDefect)]),
					);
					yield* CliRuntime.main(
						CliAudience.runWith(tool, { version: "1.0.0" })(["--agent", "go"]).pipe(Effect.provide(NodeServices.layer)),
						{ platform: platform(true), env: { stackFrames } },
					).pipe(
						Effect.exit,
						Effect.provideService(
							ConfigProvider.ConfigProvider,
							ConfigProvider.fromUnknown({ TERM: "xterm-256color" }),
						),
						Effect.provideService(Console.Console, double),
					);
					return err.join("\n");
				});
			const all = yield* runTool("all");
			assert.notInclude(all, ESC, "control: the flag made it an agent's report");
			assert.include(all, "node_modules/vendor/x.js:7:8");
			assert.notInclude(yield* runTool("app"), "node_modules/vendor", "control: app hides it");
		}),
	);
});

describe("CliRuntime.defaultRender", () => {
	it("is the plain lines of the cause: the stack of a defect, a tree for a schema error", () => {
		const cause = Cause.die(errorWithStack("kaboom", [`run (${USER}:3:4)`, ...INTERNAL_FRAMES]));
		const lines = CliRuntime.defaultRender(Cause.squash(cause), { cause, isDefect: true });
		const text = (typeof lines === "string" ? [lines] : lines).join("\n");
		assert.include(text, "kaboom");
		assert.include(text, `${USER}:3:4`);
		assert.notInclude(text, ESC);
	});

	it("keeps the fixed lines for the two prompt failures", () => {
		const cancelled = Cause.fail(new Cancelled({ reason: "interrupt" }));
		assert.deepStrictEqual(CliRuntime.defaultRender(Cause.squash(cancelled), { cause: cancelled, isDefect: false }), [
			"cancelled; nothing written",
		]);
	});
});

void ({} as RenderContext);

describe("CliFailure.toDoc: third-party frames (A3)", () => {
	const THIRD_PARTY = [
		"runTest (file:///repo/node_modules/.pnpm/@vitest+runner@4.0.0/node_modules/@vitest/runner/dist/run.B2x.js:1:2)",
		"/repo/node_modules/tinypool/dist/entry.js:3:4",
		"C:\\repo\\node_modules\\vitest\\dist\\worker.js:5:6",
	];

	it("hides every node_modules frame by default, not only Effect's", () => {
		const error = errorWithStack("boom", [`run (${USER}:3:4)`, ...THIRD_PARTY, `main (${USER}:9:1)`]);
		const text = plain(CliFailure.toDoc(Cause.die(error)));
		assert.include(text, `${USER}:3:4`);
		assert.include(text, `${USER}:9:1`);
		for (const frame of ["@vitest", "tinypool", "worker.js"]) assert.notInclude(text, frame);
	});

	it("when they are all that is left, they are shown rather than hidden, and the runtime's still are not (fix 2)", () => {
		const text = plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", [...THIRD_PARTY, ...INTERNAL_FRAMES]))));
		for (const frame of ["@vitest", "tinypool", "worker.js"]) assert.include(text, frame);
		for (const hidden of ["node:internal", "node_modules/effect", "Generator.next"]) assert.notInclude(text, hidden);
		assert.notInclude(text, "no user frames");
	});

	it('stackFrames: "all" keeps every frame', () => {
		const error = errorWithStack("boom", [`run (${USER}:3:4)`, ...THIRD_PARTY, ...INTERNAL_FRAMES]);
		const text = plain(CliFailure.toDoc(Cause.die(error), { stackFrames: "all" }));
		for (const frame of ["@vitest", "tinypool", "worker.js", "node:internal", "Generator.next", `${USER}:3:4`]) {
			assert.include(text, frame);
		}
	});
});

describe("CliFailure.toDoc: an installed program's own frames", () => {
	const INSTALLED = [
		"main (/usr/lib/node_modules/my-cli/dist/main.js:10:3)",
		"run (file:///home/me/.local/share/pnpm/store/node_modules/.pnpm/my-cli@1.0.0/node_modules/my-cli/dist/run.js:4:7)",
	];

	it("when every non-runtime frame is under node_modules, the program's are shown and Effect's still hidden", () => {
		const text = plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", [...INSTALLED, ...INTERNAL_FRAMES]))));
		assert.include(text, "my-cli/dist/main.js:10:3");
		assert.include(text, "my-cli/dist/run.js:4:7");
		for (const hidden of ["node:internal", "node_modules/effect", "effect/src", "Generator.next"]) {
			assert.notInclude(text, hidden);
		}
		assert.notInclude(text, "no user frames");
	});

	it("a mixed stack shows only the app's frames", () => {
		const text = plain(
			CliFailure.toDoc(Cause.die(errorWithStack("boom", [`run (${USER}:3:4)`, ...INSTALLED, ...INTERNAL_FRAMES]))),
		);
		assert.include(text, `${USER}:3:4`);
		assert.notInclude(text, "my-cli");
		assert.notInclude(text, "node_modules/effect");
	});

	it("a stack of nothing but runtime and Effect frames still says no user frames, with the count", () => {
		const text = plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", INTERNAL_FRAMES))));
		assert.include(text, `no user frames (${INTERNAL_FRAMES.length} internal frames hidden)`);
	});
});

describe("CliFailure.toDoc: frames are classified by file path, never by name", () => {
	const ALIAS = "PrimitiveImpl.boom [as ~effect/Effect/args] (/abs/probe-defect.ts:10:8)";
	const EFFECT_DIST =
		"PrimitiveImpl.~effect/Effect/evaluate (file:///repo/node_modules/.pnpm/effect@4.0.0/node_modules/effect/dist/internal/effect.js:709:29)";

	it("a user frame carrying Effect's method alias is the program's, and its file is shown", () => {
		const text = plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", [ALIAS, EFFECT_DIST, ...INTERNAL_FRAMES]))));
		assert.include(text, "/abs/probe-defect.ts:10:8");
		assert.notInclude(text, "no user frames");
	});

	it("an Effect dist frame is still hidden, whatever its name", () => {
		const text = plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", [ALIAS, EFFECT_DIST]))));
		assert.include(text, "/abs/probe-defect.ts:10:8");
		assert.notInclude(text, "node_modules/effect");
		assert.notInclude(text, "effect.js");
	});

	it("every node: frame and every frame with no file is the runtime's", () => {
		const text = plain(
			CliFailure.toDoc(
				Cause.die(
					errorWithStack("boom", [
						ALIAS,
						"FSReqCallback.oncomplete (node:fs:197:5)",
						"process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
						"new Promise (<anonymous>)",
						"Array.map (native)",
					]),
				),
			),
		);
		assert.include(text, "/abs/probe-defect.ts:10:8");
		for (const hidden of ["node:fs", "node:internal", "new Promise", "Array.map"]) assert.notInclude(text, hidden);
	});
});

describe("CliFailure.toDoc: the hidden-frame count", () => {
	it("a mixed stack shows its app frames and, after them, how many internal frames were hidden", () => {
		const frames = [
			`run (${USER}:3:4)`,
			...INTERNAL_FRAMES,
			"FSReqCallback.oncomplete (node:fs:197:5)",
			`main (${USER}:9:1)`,
		];
		const text = plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", frames))));
		assert.include(text, `${USER}:3:4`);
		assert.include(text, `${USER}:9:1`);
		const note = `(+${INTERNAL_FRAMES.length + 1} internal frames hidden)`;
		assert.include(text, note);
		assert.isAbove(text.indexOf(note), text.indexOf(`${USER}:9:1`), "the note follows the frames");
	});

	it("nothing hidden prints no note", () => {
		const text = plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", [`run (${USER}:3:4)`]))));
		assert.notInclude(text, "hidden");
	});

	it('stackFrames: "all" hides nothing and prints no note', () => {
		const error = errorWithStack("boom", [`run (${USER}:3:4)`, ...INTERNAL_FRAMES]);
		assert.notInclude(plain(CliFailure.toDoc(Cause.die(error), { stackFrames: "all" })), "hidden");
	});
});
