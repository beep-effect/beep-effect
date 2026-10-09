// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import type { AudienceKind } from "../../effected/env/index.ts";
import { Audience, CurrentRuntimeEnv, TerminalEnv } from "../../effected/env/index.ts";
import { Markdown } from "../../effected/markdown/index.ts";
import { Cause, ConfigProvider, Console, Effect, Layer, Option, Stdio, Terminal } from "effect";
import type { Document } from "../../effected/cli/index.ts";
import { CliFailure, CliLinks, CliRuntime, CliTheme, Doc, Render } from "../../effected/cli/index.ts";
import { commandLines } from "./helpers/runnerCommands.ts";

const ZWSP = String.fromCodePoint(0x200b);
const ESC = String.fromCharCode(0x1b);

const HOSTILE = [
	`x\r::error::injected\n##[error]y`,
	`a\r\n::add-mask::secret\r\n  ##[add-mask]b`,
	`prefix ##[add-mask]secret`,
	`mid ##[error]line and ##[stop-commands]tok`,
	`b\u0085::warning::nel`,
	`c\n\u0085 ::error::after nel space\n\t## spaced`,
	`::notice::leading`,
];

const docOf = (text: string): Document => [Doc.heading(2, "report"), Doc.paragraph(text), Doc.paragraph("tail")];

const layers = (audience: AudienceKind, ci: "github-actions" | "generic" | "none" | "absent") => {
	const terminal = TerminalEnv.layerTest({
		stdinIsTerminal: true,
		stdout: { isTerminal: true, color: "basic" },
		stderr: { isTerminal: true, color: "basic" },
	});
	return Layer.mergeAll(
		terminal,
		CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(terminal)),
		Audience.layerTest(audience),
		CliLinks.layerTest("vscode"),
		ci === "absent"
			? Layer.empty
			: CurrentRuntimeEnv.layerTest({ ci: ci === "none" ? Option.none() : Option.some(ci) }),
	);
};

const contextFor = (audience: AudienceKind, ci: "github-actions" | "generic" | "none" | "absent") =>
	Effect.runSync(Render.context("stderr").pipe(Effect.provide(layers(audience, ci))));

describe("Render.context: the runner, not the audience, decides", () => {
	it("is flagged under GitHub Actions for every audience, and for nothing else", () => {
		for (const audience of ["human", "agent", "ci"] as const) {
			assert.isTrue(contextFor(audience, "github-actions").neutralizeWorkflowCommands, audience);
			for (const ci of ["generic", "none", "absent"] as const) {
				assert.notStrictEqual(contextFor(audience, ci).neutralizeWorkflowCommands, true, `${audience} ${ci}`);
			}
		}
	});
});

describe("under GitHub Actions no format emits a line the runner would read as a command", () => {
	const formats = ["plain", "ansi", "markdown", "githubLog"] as const;

	for (const audience of ["agent", "human", "ci"] as const) {
		for (const text of HOSTILE) {
			it(`${audience}: ${JSON.stringify(text)} through every renderer called directly`, () => {
				const ctx = contextFor(audience, "github-actions");
				const doc = docOf(text);
				for (const format of formats) {
					const out = Render[format](doc, ctx);
					assert.deepStrictEqual(commandLines(out), [], `${format}: ${JSON.stringify(out)}`);
				}
			});

			it.effect(`${audience}: ${JSON.stringify(text)} through Doc.print, every format, both streams`, () =>
				Effect.gen(function* () {
					for (const format of ["auto", ...formats] as const) {
						for (const stream of ["stdout", "stderr"] as const) {
							const written: Array<string> = [];
							const double = Object.assign(Object.create(console) as Console.Console, {
								log: (...args: ReadonlyArray<unknown>) => written.push(args.map(String).join(" ")),
								error: (...args: ReadonlyArray<unknown>) => written.push(args.map(String).join(" ")),
							});
							yield* Doc.print(docOf(text), { format, stream }).pipe(
								Effect.provide(layers(audience, "github-actions")),
								Effect.provideService(Console.Console, double),
							);
							assert.deepStrictEqual(commandLines(written.join("\n")), [], `${format} ${stream}`);
						}
					}
				}),
			);
		}
	}

	it("the text itself is otherwise intact: only a zero-width space is added, in front of a command line", () => {
		const ctx = contextFor("agent", "github-actions");
		const out = Render.plain(docOf("keep\n::error::x"), ctx);
		assert.include(out, `${ZWSP}::error::x`);
		assert.include(out, "keep");
		assert.strictEqual(out.replaceAll(ZWSP, ""), Render.plain(docOf("keep\n::error::x"), contextFor("agent", "none")));
	});

	it("githubLog is not neutralized twice", () => {
		const out = Render.githubLog(docOf("::error::x"), contextFor("ci", "github-actions"));
		assert.strictEqual(out.split(ZWSP).length - 1, 1);
		assert.notInclude(out, `${ZWSP}${ZWSP}`);
	});
});

describe("Render.markdown under GitHub Actions", () => {
	const sectioned: Document = [
		Doc.section("Results", [
			Doc.paragraph("ok"),
			Doc.section("Coverage", [Doc.paragraph("fine"), Doc.section("Detail", [Doc.paragraph("deep")])]),
		]),
		Doc.heading(3, "Loose heading"),
	];

	const headingsOf = (markdown: string): ReadonlyArray<string> => {
		const parsed = Markdown.parseResult(markdown);
		if (parsed._tag === "Failure") throw new Error("the markdown did not parse");
		return parsed.success.children.filter((node) => node.type === "heading").map((node) => node.type);
	};

	it("every heading survives: a bare ## is not a command, so the facade leaves it alone", () => {
		for (const audience of ["human", "agent", "ci"] as const) {
			const under = Render.markdown(sectioned, contextFor(audience, "github-actions"));
			const outside = Render.markdown(sectioned, contextFor(audience, "none"));
			assert.strictEqual(headingsOf(under).length, 4, `${audience}: ${JSON.stringify(under)}`);
			assert.strictEqual(under, outside, `${audience}: markdown without a ##[ in it is identical under Actions`);
		}
	});

	it("text can not make ##[ appear outside code: markdown escapes the bracket", () => {
		const text = "see ##[add-mask]secret and ##[error]x";
		const out = Render.markdown(
			[Doc.paragraph(text), Doc.list([Doc.paragraph("a ##[b]")])],
			contextFor("agent", "none"),
		);
		assert.notInclude(out, "##[");
	});

	it("code, which markdown does not escape, gets the zero-width space under Actions, and only there", () => {
		const doc: Document = [Doc.paragraph(Doc.code("##[error]x")), Doc.codeBlock("a ##[add-mask]b\n::error::c", "txt")];
		const under = Render.markdown(doc, contextFor("agent", "github-actions"));
		assert.deepStrictEqual(commandLines(under), []);
		assert.include(under, `##${ZWSP}[error]x`);
		const outside = Render.markdown(doc, contextFor("agent", "none"));
		assert.include(outside, "##[error]x");
		assert.notInclude(outside, ZWSP);
	});
});

describe("outside GitHub Actions the text is left alone: no zero-width noise", () => {
	it("a command-looking line is untouched for every format and audience", () => {
		for (const ci of ["generic", "none", "absent"] as const) {
			for (const audience of ["human", "agent", "ci"] as const) {
				const ctx = contextFor(audience, ci);
				for (const format of ["plain", "ansi", "markdown"] as const) {
					const out = Render[format](docOf("x\r::error::y\n##[error]z"), ctx);
					assert.notInclude(out, ZWSP, `${audience} ${ci} ${format}`);
					assert.isAbove(
						commandLines(out).length,
						0,
						`control: the lines are really there (${audience} ${ci} ${format})`,
					);
				}
			}
		}
	});

	it("githubLog still neutralizes, wherever it is chosen explicitly", () => {
		const out = Render.githubLog(docOf("::error::y"), contextFor("agent", "none"));
		assert.deepStrictEqual(commandLines(out), []);
		assert.include(out, ZWSP);
	});
});

describe("the default failure report", () => {
	const platform = Layer.mergeAll(
		Stdio.layerTest({ stdinIsTerminal: Effect.succeed(true), stdoutIsTerminal: Effect.succeed(true) }),
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

	const report = (env: Record<string, string>, message: string, withEnv = true) =>
		Effect.gen(function* () {
			const err: Array<string> = [];
			const double = Object.assign(Object.create(console) as Console.Console, {
				log: () => undefined,
				error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
			});
			const program = Effect.suspend(() => Effect.fail(new Error(message)));
			yield* (
				withEnv ? CliRuntime.main(program, { platform, env: {} }) : CliRuntime.main(program, { platform: Layer.empty })
			).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
				Effect.provideService(Console.Console, double),
			);
			return err;
		});

	it.effect("an agent, a human and a ci under GitHub Actions: no line of the report is a command", () =>
		Effect.gen(function* () {
			for (const env of [
				{ GITHUB_ACTIONS: "true", AI_AGENT: "x", TERM: "xterm-256color" },
				{ GITHUB_ACTIONS: "true", TERM: "xterm-256color", PROBE_HUMAN: "1" },
				{ GITHUB_ACTIONS: "true", CI: "true" },
			]) {
				for (const message of HOSTILE) {
					const err = yield* report(env, message);
					assert.deepStrictEqual(commandLines(err.join("\n")), [], `${JSON.stringify(env)} ${JSON.stringify(message)}`);
					assert.isAbove(err.length, 0);
				}
			}
		}),
	);

	it.effect("with no environment services at all it still refuses to emit a command line", () =>
		Effect.gen(function* () {
			for (const message of HOSTILE) {
				const err = yield* report({ GITHUB_ACTIONS: "true" }, message, false);
				assert.deepStrictEqual(commandLines(err.join("\n")), [], JSON.stringify(message));
			}
		}),
	);

	it("the plain lines of defaultRender are safe too", () => {
		for (const message of HOSTILE) {
			const cause = Cause.fail(new Error(message));
			const lines = CliRuntime.defaultRender(Cause.squash(cause), { cause, isDefect: false });
			assert.deepStrictEqual(
				commandLines((typeof lines === "string" ? [lines] : lines).join("\n")),
				[],
				JSON.stringify(message),
			);
		}
	});

	it.effect("outside GitHub Actions the report is untouched: no zero-width space", () =>
		Effect.gen(function* () {
			const err = yield* report({ AI_AGENT: "x" }, "x\n::error::y");
			assert.notInclude(err.join("\n"), ZWSP);
		}),
	);
});

describe("CliFailure.toDoc: the stack filter keeps a user's own effect directory", () => {
	const stackOf = (frames: ReadonlyArray<string>): Error => {
		const error = new Error("boom");
		error.stack = ["Error: boom", ...frames.map((frame) => `    at ${frame}`)].join("\n");
		return error;
	};
	const plain = (doc: Document) =>
		Render.plain(doc, Effect.runSync(Render.context("stderr").pipe(Effect.provide(layers("agent", "none")))));

	it("a frame under /home/u/effect/src/ is kept, and Effect's own source and package are still hidden", () => {
		const text = plain(
			CliFailure.toDoc(
				Cause.die(
					stackOf([
						"main (/home/u/effect/src/main.ts:3:4)",
						"x (/home/u/work/packages/effect/src/internal/effect.ts:1:1)",
						"y (file:///r/node_modules/.pnpm/effect@4/node_modules/effect/dist/internal/effect.js:9:9)",
					]),
				),
			),
		);
		assert.include(text, "/home/u/effect/src/main.ts:3:4");
		assert.notInclude(text, "packages/effect/src");
		assert.notInclude(text, "node_modules/effect");
	});
});

void ESC;
