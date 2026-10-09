import { assert, describe, it } from "@effect/vitest";
import type { AudienceKind, StreamEnv } from "../../effected/env/index.ts";
import { Audience, CurrentRuntimeEnv, TerminalEnv } from "../../effected/env/index.ts";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { Document } from "../../effected/cli/index.ts";
import { CliLinks, CliTheme, Doc, Glyphs, Render } from "../../effected/cli/index.ts";
import { composite } from "./helpers/hostileDoc.ts";
import { contextOf } from "./helpers/renderContext.ts";

const ESC = String.fromCharCode(0x1b);

interface Setup {
	readonly audience: AudienceKind;
	/** Provide `CurrentRuntimeEnv` with this CI; omitted, the service is not in the environment at all. */
	readonly ci?: "github-actions" | "generic" | "none";
	readonly stdout?: Partial<StreamEnv>;
	readonly stderr?: Partial<StreamEnv>;
	readonly glyphs?: "unicode" | "ascii";
}

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console), {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

const layers = (setup: Setup) => {
	const terminal = TerminalEnv.layerTest({
		stdinIsTerminal: true,
		stdout: { isTerminal: true, ...setup.stdout },
		stderr: { isTerminal: true, ...setup.stderr },
	});
	const theme = CliTheme.layerTest({
		color: setup.stdout?.color ?? "none",
		stderrColor: setup.stderr?.color ?? "none",
		glyphs: setup.glyphs ?? "unicode",
	});
	return Layer.mergeAll(
		terminal,
		theme,
		Audience.layerTest(setup.audience),
		CliLinks.layerTest("vscode"),
		setup.ci === undefined
			? Layer.empty
			: CurrentRuntimeEnv.layerTest({ ci: setup.ci === "none" ? O.none() : O.some(setup.ci) }),
	);
};

/** Run an effect needing the render services, with a captured Console. */
const under = Effect.fn("under")(function* <A>(
	setup: Setup,
	effect: Effect.Effect<A, never, CliTheme | TerminalEnv | Audience | CliLinks>,
) {
	const { double, out, err } = capturing();
	// These layers contain only pure Layer.succeed doubles; no resource is acquired per call.
	const context = yield* Layer.build(layers(setup));
	const value = yield* effect.pipe(Effect.provideContext(context), Effect.provideService(Console.Console, double));
	return { value, out, err };
});

const WIDE = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");

const doc: Document = [
	Doc.heading(1, "Report"),
	Doc.paragraph(WIDE),
	Doc.paragraph("open ", Doc.link({ file: "/repo/src/a.ts", line: 3, col: 4 }, "a.ts")),
	Doc.table([{ header: "name" }, { header: "detail" }], [["x", WIDE]]),
	Doc.collapsible("Details", [Doc.paragraph("inside")]),
];

const print = (setup: Setup, options?: Parameters<typeof Doc.print>[1]) => under(setup, Doc.print(doc, options));

describe("Doc.print: each audience picks its renderer", () => {
	it.effect("an agent gets plain text: no escape of any kind, no group, wherever the terminal could do more", () =>
		Effect.gen(function* () {
			const { out, err } = yield* print({
				audience: "agent",
				stdout: { color: "truecolor", hyperlinks: true },
				ci: "github-actions",
			});
			assert.strictEqual(out.length, 1);
			assert.deepStrictEqual(err, []);
			assert.notInclude(out[0] ?? "", ESC);
			assert.notInclude(out[0] ?? "", "::group::");
			assert.include(out[0] ?? "", "Report");
			assert.include(out[0] ?? "", "inside");
		}),
	);

	it.effect("a ci audience under GitHub Actions gets the log renderer: the collapsible is a group", () =>
		Effect.gen(function* () {
			const { out } = yield* print({ audience: "ci", stdout: { color: "none" }, ci: "github-actions" });
			assert.include(out[0] ?? "", "::group::Details");
			assert.include(out[0] ?? "", "::endgroup::");
			assert.notInclude(out[0] ?? "", ESC);
		}),
	);

	it.effect("a ci audience elsewhere gets plain text: no group", () =>
		Effect.gen(function* () {
			for (const ci of ["generic", "none"] as const) {
				const { out } = yield* print({ audience: "ci", ci });
				assert.notInclude(out[0] ?? "", "::group::", ci);
				assert.notInclude(out[0] ?? "", ESC, ci);
				assert.include(out[0] ?? "", "Details", ci);
			}
		}),
	);

	it.effect("a ci audience with no CurrentRuntimeEnv in the environment at all is plain text, never an error", () =>
		Effect.gen(function* () {
			const { out } = yield* print({ audience: "ci" });
			assert.notInclude(out[0] ?? "", "::group::");
		}),
	);

	it.effect("a human gets the painted renderer: SGR on a colour terminal, none on a plain one", () =>
		Effect.gen(function* () {
			const painted = yield* print({ audience: "human", stdout: { color: "basic" } });
			assert.include(painted.out[0] ?? "", `${ESC}[`);
			assert.notInclude(painted.out[0] ?? "", "::group::");
			const plainTerminal = yield* print({ audience: "human", stdout: { color: "none" } });
			assert.notInclude(plainTerminal.out[0] ?? "", ESC);
		}),
	);

	it.effect("the audience decides, not the CI: a human under GitHub Actions is still painted", () =>
		Effect.gen(function* () {
			const { out } = yield* print({ audience: "human", stdout: { color: "basic" }, ci: "github-actions" });
			assert.include(out[0] ?? "", `${ESC}[`);
			assert.notInclude(out[0] ?? "", "::group::");
		}),
	);
});

describe("Doc.print: an agent never gets an escape of any kind", () => {
	const OSC = `${ESC}]`;

	it.effect("on truecolor, hyperlink-capable streams, every format, on either stream, is escape-free", () =>
		Effect.gen(function* () {
			const setup: Setup = {
				audience: "agent",
				stdout: { color: "truecolor", hyperlinks: true },
				stderr: { color: "truecolor", hyperlinks: true },
				ci: "github-actions",
			};
			for (const format of ["auto", "plain", "ansi", "markdown", "githubLog"] as const) {
				for (const stream of ["stdout", "stderr"] as const) {
					const { out, err } = yield* print(setup, { format, stream });
					const text = [...out, ...err].join("\n");
					assert.isAbove(text.length, 0, `${format} ${stream}`);
					assert.notInclude(text, ESC, `${format} ${stream}`);
					assert.notInclude(text, OSC, `${format} ${stream}`);
				}
			}
		}),
	);

	it.effect(
		"the context itself is colourless for an agent, so a consumer calling Render.ansi gets nothing either",
		() =>
			Effect.gen(function* () {
				const ctx = (yield* under(
					{ audience: "agent", stdout: { color: "truecolor", hyperlinks: true } },
					Render.context("stdout"),
				)).value;
				assert.strictEqual(ctx.color, "none");
				assert.strictEqual(ctx.paint("failure", "x"), "x");
				assert.strictEqual(ctx.paint({ fg: "#ff0000", bold: true }, "x"), "x");
				assert.notInclude(Render.ansi(doc, ctx), ESC);
			}),
	);

	it.effect(
		"control: a human on the same terminal IS painted, so the agent rule is the audience's and not the terminal's",
		() =>
			Effect.gen(function* () {
				const { out } = yield* print(
					{ audience: "human", stdout: { color: "truecolor", hyperlinks: true } },
					{ format: "ansi" },
				);
				assert.include(out[0] ?? "", `${ESC}[`);
				const ci = yield* print({ audience: "ci", stdout: { color: "truecolor" } }, { format: "ansi" });
				assert.include(ci.out[0] ?? "", `${ESC}[`);
			}),
	);
});

describe("Doc.print: an empty document", () => {
	it.layer(layers({ audience: "human", stdout: { color: "basic" } }), { timeout: "30 seconds" })((it) => {
		it.effect("prints nothing: no blank line on either stream, for every format", () =>
			Effect.gen(function* () {
				for (const format of ["auto", "plain", "ansi", "markdown", "githubLog"] as const) {
					for (const stream of ["stdout", "stderr"] as const) {
						const { double, out, err } = capturing();
						yield* Doc.print([], { format, stream }).pipe(Effect.provideService(Console.Console, double));
						assert.deepStrictEqual([out, err], [[], []], `${format} ${stream}`);
					}
				}
			}),
		);
	});
});

describe("Doc.print: an empty headerless table", () => {
	it.layer(layers({ audience: "human", stdout: { color: "basic" } }), { timeout: "30 seconds" })((it) => {
		it.effect("prints nothing for it, and does not throw, for every format", () =>
			Effect.gen(function* () {
				for (const table of [Doc.countsTable([]), Doc.table([{ header: [] }], [])]) {
					for (const format of ["auto", "plain", "ansi", "markdown", "githubLog"] as const) {
						const { double, out, err } = capturing();
						yield* Doc.print([table], { format }).pipe(Effect.provideService(Console.Console, double));
						assert.deepStrictEqual([out, err], [[], []], `${table._tag} ${format}`);
					}
				}
			}),
		);
	});
});

describe("Doc.print: an explicit format wins over the audience", () => {
	it.effect("every format, for every audience, is that renderer over the context Render.context builds", () =>
		Effect.gen(function* () {
			for (const audience of ["human", "agent", "ci"] as const) {
				const setup: Setup = { audience, stdout: { color: "basic" }, ci: "github-actions" };
				const ctx = (yield* under(setup, Render.context("stdout"))).value;
				for (const format of ["plain", "ansi", "markdown", "githubLog"] as const) {
					const { out } = yield* print(setup, { format });
					assert.deepStrictEqual(out, [Render[format](doc, ctx)], `${audience} ${format}`);
				}
			}
		}),
	);

	it.effect("the formats are distinguishable on the same document", () =>
		Effect.gen(function* () {
			const setup: Setup = { audience: "human", stdout: { color: "basic" } };
			const markdown = (yield* print(setup, { format: "markdown" })).out[0] ?? "";
			assert.match(markdown, /^# Report/m);
			assert.include(markdown, "<details>");
			assert.notInclude(markdown, ESC);
			const log = (yield* print(setup, { format: "githubLog" })).out[0] ?? "";
			assert.include(log, "::group::Details");
			const plain = (yield* print(setup, { format: "plain" })).out[0] ?? "";
			assert.notInclude(plain, ESC);
			assert.notInclude(plain, "::group::");
			const ansi = (yield* print(setup, { format: "ansi" })).out[0] ?? "";
			assert.include(ansi, `${ESC}[`);
		}),
	);
});

describe("Doc.print: the stream", () => {
	it.effect("stdout is the default and goes through Console.log; stderr goes through Console.error", () =>
		Effect.gen(function* () {
			const stdout = yield* print({ audience: "agent" });
			assert.strictEqual(stdout.out.length, 1);
			assert.deepStrictEqual(stdout.err, []);
			const stderr = yield* print({ audience: "agent" }, { stream: "stderr" });
			assert.deepStrictEqual(stderr.out, []);
			assert.strictEqual(stderr.err.length, 1);
			assert.strictEqual(stderr.err[0], stdout.out[0]);
		}),
	);

	it.effect("a stream is painted with ITS colour level: a plain stdout does not quiet a colour stderr", () =>
		Effect.gen(function* () {
			const setup: Setup = { audience: "human", stdout: { color: "none" }, stderr: { color: "basic" } };
			const toStderr = yield* print(setup, { stream: "stderr" });
			assert.include(toStderr.err[0] ?? "", `${ESC}[`);
			const toStdout = yield* print(setup, { stream: "stdout" });
			assert.notInclude(toStdout.out[0] ?? "", ESC);
			// And the other way round.
			const reversed: Setup = { audience: "human", stdout: { color: "basic" }, stderr: { color: "none" } };
			assert.notInclude((yield* print(reversed, { stream: "stderr" })).err[0] ?? "", ESC);
			assert.include((yield* print(reversed, { stream: "stdout" })).out[0] ?? "", `${ESC}[`);
		}),
	);

	it.effect("hyperlinks are that stream's too, and an agent never gets one", () =>
		Effect.gen(function* () {
			const OSC8 = `${ESC}]8;;`;
			const setup: Setup = {
				audience: "human",
				stdout: { color: "basic", hyperlinks: false },
				stderr: { color: "basic", hyperlinks: true },
			};
			assert.include((yield* print(setup, { stream: "stderr", format: "ansi" })).err[0] ?? "", OSC8);
			assert.notInclude((yield* print(setup, { stream: "stdout", format: "ansi" })).out[0] ?? "", OSC8);
			const agent: Setup = { audience: "agent", stdout: { color: "basic", hyperlinks: true } };
			assert.notInclude((yield* print(agent, { format: "ansi" })).out[0] ?? "", OSC8);
		}),
	);
});

describe("Render.context", () => {
	it.effect("carries the audience, the stream's colour, the theme's glyphs and the identity displayPath", () =>
		Effect.gen(function* () {
			const setup: Setup = {
				audience: "ci",
				stdout: { color: "256" },
				stderr: { color: "basic" },
				glyphs: "ascii",
			};
			const out = (yield* under(setup, Render.context("stdout"))).value;
			const err = (yield* under(setup, Render.context("stderr"))).value;
			assert.strictEqual(out.audience, "ci");
			assert.strictEqual(out.color, "256");
			assert.strictEqual(err.color, "basic");
			assert.strictEqual(out.glyphs, Glyphs.ascii);
			assert.strictEqual(out.displayPath("/a/b"), "/a/b");
			// The context paints with the stream's own level.
			const red = { fg: "#ff0000" } as const;
			assert.strictEqual(out.paint(red, "x"), `${ESC}[38;5;196mx${ESC}[39m`);
			assert.strictEqual(err.paint(red, "x"), `${ESC}[91mx${ESC}[39m`);
		}),
	);

	it.effect("displayPath is the option when given", () =>
		Effect.gen(function* () {
			const ctx = (yield* under({ audience: "human" }, Render.context("stdout", { displayPath: (p) => `~${p}` })))
				.value;
			assert.strictEqual(ctx.displayPath("/x"), "~/x");
		}),
	);

	it.effect("link is CliLinks.linker for the stream: an editor link when allowed, the label when not", () =>
		Effect.gen(function* () {
			const target = { file: "/repo/src/a.ts", line: 3, col: 4 } as const;
			const on = (yield* under(
				{ audience: "human", stdout: { color: "basic", hyperlinks: true } },
				Render.context("stdout"),
			)).value;
			assert.strictEqual(
				on.link(target, "a.ts"),
				`${ESC}]8;;vscode://file/repo/src/a.ts:3:4${ESC}\\a.ts${ESC}]8;;${ESC}\\`,
			);
			const off = (yield* under(
				{ audience: "human", stdout: { color: "basic", hyperlinks: false } },
				Render.context("stdout"),
			)).value;
			assert.strictEqual(off.link(target, "a.ts"), "a.ts");
			const agent = (yield* under(
				{ audience: "agent", stdout: { color: "basic", hyperlinks: true } },
				Render.context("stdout"),
			)).value;
			assert.strictEqual(agent.link(target, "a.ts"), "a.ts");
			// A hyperlink-capable stderr does not light up stdout.
			const mixed = (yield* under(
				{ audience: "human", stdout: { hyperlinks: false }, stderr: { hyperlinks: true } },
				Render.context("stdout"),
			)).value;
			assert.strictEqual(mixed.link(target, "a.ts"), "a.ts");
		}),
	);
});

describe("the width", () => {
	const longest = (text: string): number => Math.max(...text.split("\n").map((line) => [...line].length));

	it.effect("a human's default is TerminalEnv.width(): the terminal's columns, else COLUMNS or 80", () =>
		Effect.gen(function* () {
			const narrow = (yield* under({ audience: "human", stdout: { columns: O.some(40) } }, Render.context("stdout")))
				.value;
			assert.strictEqual(narrow.width, 40);
			const unknown = (yield* under({ audience: "human", stdout: { columns: O.none() } }, Render.context("stdout")))
				.value;
			assert.strictEqual(unknown.width, 80);
		}),
	);

	it.effect("a human's output is laid out at that width", () =>
		Effect.gen(function* () {
			const { out } = yield* print({ audience: "human", stdout: { columns: O.some(40), color: "none" } });
			assert.isAtMost(longest(out[0] ?? ""), 40);
			// Control: the same document is wider when unbounded, so the cut above is the width at work.
			const unbounded = yield* print({ audience: "agent", stdout: { columns: O.some(40) } });
			assert.isAbove(longest(unbounded.out[0] ?? ""), 40);
		}),
	);

	it.effect("an agent's and a ci's width is unbounded: nothing wraps or truncates, whatever the terminal says", () =>
		Effect.gen(function* () {
			for (const audience of ["agent", "ci"] as const) {
				const setup: Setup = { audience, stdout: { columns: O.some(30) } };
				const ctx = (yield* under(setup, Render.context("stdout"))).value;
				assert.strictEqual(ctx.width, Number.POSITIVE_INFINITY, audience);
				const { out } = yield* print(setup);
				// The long paragraph is one line, whole; the wide table cell is whole, and not shortened by an ellipsis.
				assert.include(out[0] ?? "", WIDE, audience);
				assert.notInclude(out[0] ?? "", "…", audience);
				assert.strictEqual(
					(out[0] ?? "").split("\n").filter((line) => line.includes("word0 word1")).length,
					2,
					`${audience}: the paragraph and the table row`,
				);
			}
		}),
	);

	it.effect("an explicit width wins, for every audience", () =>
		Effect.gen(function* () {
			for (const audience of ["human", "agent", "ci"] as const) {
				const ctx = (yield* under({ audience }, Render.context("stdout", { width: 33 }))).value;
				assert.strictEqual(ctx.width, 33, audience);
			}
		}),
	);
});

describe("an unbounded width reaches every renderer", () => {
	it.effect("Infinity renders like a width no document reaches, for all four renderers and the hostile composite", () =>
		Effect.gen(function* () {
			const hostile = composite({ codeAndPath: true });
			const unbounded = yield* contextOf({ width: Number.POSITIVE_INFINITY });
			const huge = yield* contextOf({ width: 1_000_000 });
			for (const format of ["plain", "ansi", "markdown", "githubLog"] as const) {
				assert.strictEqual(Render[format](hostile, unbounded), Render[format](hostile, huge), format);
				assert.strictEqual(Render[format](doc, unbounded), Render[format](doc, huge), format);
			}
		}),
	);
});
