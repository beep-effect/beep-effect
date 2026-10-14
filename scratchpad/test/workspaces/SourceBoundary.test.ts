// biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are source text under test
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import { ReferenceOptions, ScanOptions, BoundaryFixture, BoundaryRule as BoundaryRuleModel, OffenceRule as OffenceRuleModel } from "../../effected/workspaces/SourceBoundary.ts";
import { assert, describe, it } from "@effect/vitest";
import type { BoundaryRule, OffenceRule } from "../../effected/workspaces/testing.ts";
import { SourceBoundary } from "../../effected/workspaces/testing.ts";

const lines = (text: string, rule: BoundaryRule): ReadonlyArray<number> =>
	SourceBoundary.check("fixture.ts", text, [rule]).map((offence) => offence.line);

describe("SourceBoundary round-3 boundary regressions", () => {
	it("spares incomplete and malformed stdout members", () => {
		for (const source of ["stdout.", "stdout?. /* comment */", "stdout.\\u00ZZ", "stdout.\\u{110000}"]) {
			assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["stdout-write"]), [], source);
		}
	});
	it("spares complete cooked stderr methods and flags escaped longer console names", () => {
		for (const source of [
			"console.\\u0065rror(x)", "console?.wa\\u0072n(x)", "console.tr\\u{61}ce(x)",
			"conso\\u006ce /* comment */ ?. /* comment */ ass\\u0065rt(ok)",
		]) assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["console-stdout"]), [], source);
		for (const member of ["error\\u0058", "wa\\u0072n\\u{58}", "trace\\u{1d499}", "assert\\uD835\\uDC99"]) {
			const source = `"😀";\n  console.${member}(x)`;
			const found = SourceBoundary.check("f.ts", source, ["console-stdout"]);
			assert.strictEqual(found.length, 1, source);
			assert.strictEqual(found[0]?.line, 2, source);
			assert.strictEqual(found[0]?.column, 3, source);
		}
	});

	it("flags complete cooked stdout receivers and members at their original locations", () => {
		for (const [receiver, member, detail] of [
			["std\\u006fut", "wr\\u0069te", "stdout.write"],
			["\\u{73}tdout", "\\u0077rite", "stdout.write"],
			["stdout", "e\\u006ed", "stdout.end"],
			["std\\u{6f}ut", "\\u{65}nd", "stdout.end"],
		] as const) {
			const source = `"😀";\n  child.${receiver} /* comment */ ?. /* comment */ ${member}(chunk)`;
			assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["stdout-write"]).map((offence) => offence.label), [
				`f.ts:2:9 stdout-write ${detail}`,
			], source);
		}
	});

	it("spares escaped longer stdout names, private receivers and chunkless end calls", () => {
		for (const source of [
			"stdout.wr\\u0069te\\u0058(chunk)", "stdout.end\\u{58}(chunk)", "stdout.write\\u{1d499}(chunk)",
			"stdout\\u0058.write(chunk)", "\\u{78}stdout.write(chunk)", "this.#std\\u006fut.write(chunk)",
			"std\\u006fut.e\\u006ed()", "stdout?.\\u0065nd( /* comment */ )",
			'"stdout.wr\\u0069te(chunk)"', "/* stdout.wr\\u0069te(chunk) */",
		]) assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["stdout-write"]), [], source);
		assert.strictEqual(SourceBoundary.check("f.ts", "stdout.wr\\u0069te", ["stdout-write"])[0]?.detail, "stdout.write");
	});

	it("keeps default and custom exemptions exact when an escaped suffix continues the name", () => {
		for (const token of ["process.env.__PACKAGE_VERSION__", "process.platform"]) {
			const options = token === "process.platform" ? { ignoreTokens: [token] } : {};
			assert.deepStrictEqual(SourceBoundary.check("f.ts", `${token};`, ["process"], options), []);
			for (const suffix of ["\\u0058", "\\u{58}", "\\u{1d499}", "\\uD835\\uDC99"]) {
				const source = `  ${token}${suffix};`;
				assert.isTrue(SourceBoundary.referencesProcess(source, options), source);
				assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["process"], options).map((offence) => offence.label), [
					"f.ts:1:3 process process",
				], source);
				assert.deepStrictEqual(SourceBoundary.check("f.ts", source, [{ forbidTokens: [token] }]), [], source);
			}
			assert.strictEqual(SourceBoundary.check("f.ts", `${token};`, [{ forbidTokens: [token] }]).length, 1);
		}
		assert.isTrue(SourceBoundary.referencesProcess("process.env.\\u005f_PACKAGE_VERSION__;"));
		assert.isFalse(SourceBoundary.referencesProcess("process.plat\\u0066orm;", { ignoreTokens: ["process.plat\\u0066orm"] }));
		assert.isTrue(SourceBoundary.referencesProcess("process.platform;", { ignoreTokens: ["process.plat\\u0066orm"] }));
		assert.isTrue(SourceBoundary.referencesProcess("globalThis.process.platform;", { ignoreTokens: ["process.platform"] }));
	});

	it("flags optional end calls with a chunk and spares optional end calls without one", () => {
		for (const receiver of ["stdout", "process.stdout", "stdout?"]) {
			const member = `${receiver}.end`;
			assert.deepStrictEqual(SourceBoundary.check("f.ts", `  ${member} /* comment */ ?. /* comment */ (chunk);`, ["stdout-write"]).map((offence) => offence.label), [
				`f.ts:1:${receiver === "process.stdout" ? 11 : 3} stdout-write stdout.end`,
			]);
			assert.deepStrictEqual(SourceBoundary.check("f.ts", `${member}?.( /* comment */ );`, ["stdout-write"]), []);
		}
		assert.strictEqual(SourceBoundary.check("f.ts", 'stdout.e\\u006ed?.("chunk");', ["stdout-write"])[0]?.detail, "stdout.end");
		assert.strictEqual(SourceBoundary.check("f.ts", "stdout.write?.();", ["stdout-write"])[0]?.detail, "stdout.write");
	});

	it("finds executable process reads after spaced, commented and repeated postfix assertions", () => {
		for (const operand of ["x !", "x/* comment */!", "x!!", "x ! /* comment */ !", "f(x) ! !", "xs[0] ! !"]) {
			const source = `const y = ${operand} / 2;\n  process.cwd(); const z = 1 / 4;`;
			assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["process"]).map((offence) => offence.label), [
				"f.ts:2:3 process process",
			], source);
		}
		assert.deepStrictEqual(SourceBoundary.check("f.ts", "!! /process.cwd()/.test(value);", ["process"]), []);
	});

	it("spares local nested global-object names while recognizing genuine global-object chains", () => {
		for (const receiver of ["child.globalThis", "child?.window", "child.self", "child?.global", "child.globalThis.window", "child.\\u{77}indow"]) {
			const source = `const child = { globalThis: { process: 42 }, window: { console: 42 } }; ${receiver}?.process; ${receiver}.console.log(x);`;
			assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["process", "console", "console-stdout"]), [], source);
		}
		for (const receiver of ["globalThis", "globalThis.window", "globalThis?.globalThis", "globalTh\\u0069s?.\\u{77}indow", "...globalThis"]) {
			const source = `${receiver}?.pr\\u006fcess; ${receiver}.console.log(x);`;
			assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["process", "console-stdout"]).map((offence) => offence.detail), ["process", "console.log"], source);
		}
	});
});

describe("SourceBoundary.stripComments", () => {
	it("blanks line and block comments to spaces, keeping the length and every line break", () => {
		const text = "const a = 1; // process\n/* process\n */ const b = 2;";
		const out = SourceBoundary.stripComments(text);
		assert.strictEqual(out.length, text.length);
		assert.notInclude(out, "process");
		assert.strictEqual(out.split("\n").length, 3);
		assert.include(out, "const b = 2;");
	});

	it("leaves comment markers inside strings, templates and regex literals alone", () => {
		const text = 'const u = "http://x/*y*/"; const t = `//z`; const r = /\\/\\*/;';
		assert.strictEqual(SourceBoundary.stripComments(text), text);
	});
});

describe("SourceBoundary.referencesProcess", () => {
	const reads = [
		["destructuring", "const { env } = process;"],
		["bracket access", 'const env = process["env"];'],
		["a member of globalThis", "const cwd = globalThis.process?.cwd();"],
		["a template substitution", "const where = `cwd: ${process.cwd()}`;"],
		["a nested template substitution", "const s = `a ${`b ${process.pid}`}`;"],
		["a spread", "const copy = { ...process.env };"],
		["a typeof guard", 'if (typeof process !== "undefined") run();'],
		[
			"code after a string holding a comment opener",
			'const open = "/*"; const argv = process.argv; const close = "*/";',
		],
		["code after a regex holding a quote", 'const re = /"/; const argv = process.argv; const q = "x";'],
		["code after a regex whose class holds a slash", 'const re = /[/"]/; const argv = process.argv; const q = "x";'],
		["code after a division", "const half = total / 2; const argv = process.argv; const r = 1 / 4;"],
		["a look-alike of the exempt token", "const v = process.env.__PACKAGE_VERSION__X;"],
		["the exempt token reached through globalThis", "const v = globalThis.process.env.__PACKAGE_VERSION__;"],
		["a ternary branch", "const p = ok ? process : fallback;"],
		["code after a call divided", "const y = f(x) / 2; const a = process.argv; const b = 1 / 4;"],
		["code after a non-null assertion divided", "const y = x! / 2; const a = process.argv; const b = 1 / 4;"],
		[
			"code after an indexed non-null assertion divided",
			"const y = xs[0]! / 2; const a = process.argv; const b = 1 / 4;",
		],
		["code after a postfix increment divided", "const y = i++ / 2; const a = process.argv; const b = 1 / 4;"],
		["code after a postfix decrement divided", "const y = xs[0]-- / 2; const a = process.argv; const b = 1 / 4;"],
		["code after a regex that follows an if condition", "if (x) /\\/*/.test(s);\nconst a = process.argv;\n/* c */"],
		[
			"code after a variable named of, divided",
			"const of = 8; const x = of / 2; const a = process.argv; const y = 8 / 2;",
		],
		["code after a property named of, divided", "const x = o.of / 2; const a = process.argv; const y = 8 / 2;"],
		[
			"code after a regex that follows a while condition",
			"while (f(x)) /\\/*/.test(s);\nconst a = process.argv;\n/* c */",
		],
	] as const;
	for (const [name, text] of reads) {
		it(`flags ${name}`, () => assert.isTrue(SourceBoundary.referencesProcess(text), text));
	}

	const nonReads = [
		["a line comment", "// process.exit(1) is forbidden here"],
		["a block comment", "/* process.cwd() */ const x = 1;"],
		["a string", 'const label = "process.env";'],
		["template text", "const help = `run process.exit to quit`;"],
		["a regex literal", "const re = /process\\.env/g;"],
		["a member of another object", "const pid = child.process;"],
		["an identifier containing the word", 'import { ChildProcess } from "effect/process";'],
		["a private field", "class A { #process = 1; }"],
		["the exempt build-time constant", "const version = process.env.__PACKAGE_VERSION__;"],
		["an object-literal key", "const o = { process: 1, other: 2 };"],
		["an object-literal key after a comma", "const o = {\n\ta: 1,\n\tprocess: 2,\n};"],
		["an interface member", "interface I { a: string; process: string }"],
		["an optional type member", "interface I { process?: string }"],
	] as const;
	for (const [name, text] of nonReads) {
		it(`spares ${name}`, () => assert.isFalse(SourceBoundary.referencesProcess(text), text));
	}

	it("honours extra ignore tokens exactly, not as prefixes", () => {
		assert.isFalse(
			SourceBoundary.referencesProcess("const p = process.platform;", { ignoreTokens: ["process.platform"] }),
		);
		assert.isTrue(
			SourceBoundary.referencesProcess("const p = process.platforms;", { ignoreTokens: ["process.platform"] }),
		);
	});
});

describe("SourceBoundary.importSpecifiers", () => {
	it("reads static, side-effect, re-export, type-only, dynamic and require specifiers, in order", () => {
		const text = [
			'import { a } from "./a.js";',
			'import "./side-effect.js";',
			'export { b } from "./b.js";',
			'export * as c from "./c.js";',
			'import type { D } from "./d.js";',
			'const e = await import("./e.js");',
			"const f = await import(`./f.js`);",
			'const g = require("./g.js");',
			'import h = require("./h.js");',
		].join("\n");
		assert.deepStrictEqual(SourceBoundary.importSpecifiers(text), [
			"./a.js",
			"./side-effect.js",
			"./b.js",
			"./c.js",
			"./d.js",
			"./e.js",
			"./f.js",
			"./g.js",
			"./h.js",
		]);
	});

	it("reads a multi-line import", () => {
		assert.deepStrictEqual(SourceBoundary.importSpecifiers('import {\n\ta,\n\tb,\n} from\n\t"./multi.js";'), [
			"./multi.js",
		]);
	});

	it("reads a dynamic import carrying an options argument", () => {
		assert.deepStrictEqual(
			SourceBoundary.importSpecifiers('const j = await import("./j.json", { with: { type: "json" } });'),
			["./j.json"],
		);
	});

	it("ignores a call whose literal is only the first operand of a computed specifier", () => {
		const text = 'const x = await import("./x" + name);\nconst y = require("./y/" + name);';
		assert.deepStrictEqual(SourceBoundary.importSpecifiers(text), []);
	});

	it("ignores strings that are not specifiers, commented-out imports and computed dynamic imports", () => {
		const text = [
			'const s = "node:process";',
			'// import x from "./gone.js";',
			'const t = obj.require("./not.js");',
			'declare module "./ambient.js" {}',
			"const u = import(`./${name}.js`);",
		].join("\n");
		assert.deepStrictEqual(SourceBoundary.importSpecifiers(text), []);
	});
});

describe("SourceBoundary.importsNode", () => {
	it("matches the node: and bare forms, static or dynamic, and nothing that merely contains the name", () => {
		assert.isTrue(SourceBoundary.importsNode('import { env } from "node:process";', "process"));
		assert.isTrue(SourceBoundary.importsNode('import process from "process";', "process"));
		assert.isTrue(SourceBoundary.importsNode('const p = await import("node:process");', "process"));
		assert.isFalse(SourceBoundary.importsNode('import { ChildProcess } from "effect/process";', "process"));
		assert.isFalse(SourceBoundary.importsNode('const s = "node:process";', "process"));
		assert.isFalse(SourceBoundary.importsNode('import x from "processor";', "process"));
	});
});

describe("SourceBoundary.check", () => {
	it("locates an offence by 1-based line and column in the original text", () => {
		const [offence] = SourceBoundary.check("src/a.ts", "const a = 1;\n\tconst { env } = process;\n", ["process"]);
		assert.strictEqual(offence?.label, "src/a.ts:2:18 process process");
	});

	it("forbidImports matches an exact name, its subpaths, and a trailing-star prefix — nothing else", () => {
		const text = [
			'import { NodeServices } from "@effect/platform-node";',
			'import { App } from "@effected/app/x";',
			'import { Dirs } from "@effected/application";',
			'import { Effect } from "effect";',
		].join("\n");
		const found = SourceBoundary.check("f.ts", text, [{ forbidImports: ["@effect/platform*", "@effected/app"] }]);
		assert.deepStrictEqual(
			found.map((offence) => offence.detail),
			["@effect/platform-node", "@effected/app/x"],
		);
	});

	it("forbidTokens flags each token's exact text in code, as whole text, and names the token", () => {
		const text = [
			"export const version = process.env.__PACKAGE_VERSION__;",
			'const s = "process.env.__PACKAGE_VERSION__";',
			"// process.env.__PACKAGE_VERSION__",
			"const longer = process.env.__PACKAGE_VERSION__S;",
			"const prefixed = xprocess.env.__PACKAGE_VERSION__;",
			"const spaced = process . env.__PACKAGE_VERSION__;",
			"const member = globalThis.process.env.__PACKAGE_VERSION__;",
			"eval(code); evaluate(code);",
		].join("\n");
		const found = SourceBoundary.check("f.ts", text, [
			{ forbidTokens: ["process.env.__PACKAGE_VERSION__", "eval(", "", "eval("] },
		]);
		assert.deepStrictEqual(
			found.map((offence) => offence.label),
			[
				"f.ts:1:24 forbidTokens process.env.__PACKAGE_VERSION__",
				"f.ts:7:27 forbidTokens process.env.__PACKAGE_VERSION__",
				"f.ts:8:1 forbidTokens eval(",
			],
		);
	});

	it("forbidTokens leaves the process rule's exemption of the version constant in force", () => {
		const text = "export const version = process.env.__PACKAGE_VERSION__;";
		assert.deepStrictEqual(SourceBoundary.check("f.ts", text, ["process"]), []);
	});

	it("stdout-write flags a write through any stdout, in code only", () => {
		const text =
			'process.stdout.write("x");\nconst { stdout } = process;\nstdout.write(line);\nconst s = "stdout.write";\n// stdout.write';
		assert.deepStrictEqual(lines(text, "stdout-write"), [1, 3]);
	});

	it("stdout-write flags an end that writes a final chunk, never an end without one", () => {
		const text =
			'process.stdout.end("x");\nprocess.stdout.end();\nstdout?.end( line );\nstdout.end( );\nconst endless = stdout.ending;';
		assert.deepStrictEqual(lines(text, "stdout-write"), [1, 3]);
		assert.deepStrictEqual(
			SourceBoundary.check("main.ts", 'process.stdout.end("x");', ["stdout-write"]).map((offence) => offence.detail),
			["stdout.end"],
		);
	});

	it("console flags every reference to the global console, never core's Console service", () => {
		const text =
			'console.log("a");\nglobalThis.console.error(e);\nconst c = yield* Console.Console;\nlogger.console;\n// console.log';
		assert.deepStrictEqual(lines(text, "console"), [1, 2]);
	});

	it("is conservative about a local binding named console: there is no scope analysis, so it is flagged", () => {
		assert.deepStrictEqual(lines('const console = yield* Console.Console;\nconsole.log("x");', "console"), [1, 2]);
	});
});

describe("SourceBoundary.check console-stdout", () => {
	const flagged = [
		["console.log", 'console.log("x");'],
		["console.info", 'console.info("x");'],
		["console.debug", 'console.debug("x");'],
		["console.table", "console.table(rows);"],
		["console.dir", "console.dir(value);"],
		["console.dirxml", "console.dirxml(value);"],
		["console.count", 'console.count("x");'],
		["console.group", 'console.group("x");'],
		["console.time", 'console.time("x");'],
		["a stdout method through globalThis", 'globalThis.console.log("x");'],
		["a stdout method through optional chaining", 'console?.log("x");'],
		["a longer name that starts with a stderr method", 'console.errors("x");'],
		["a bare alias", 'const c = console;\nc.log("x");'],
		["console passed as an argument", "register(console);"],
		["a computed member", "console[method](x);"],
		["a computed member whose key is a stderr method's name", 'console["error"](x);'],
		["a spread", "const copy = { ...console };"],
	] as const;
	for (const [name, text] of flagged) {
		it(`flags ${name}`, () => assert.isNotEmpty(lines(text, "console-stdout"), text));
	}

	const spared = [
		["console.error", 'console.error("x");'],
		["console.warn", 'console.warn("x");'],
		["console.trace", 'console.trace("x");'],
		["console.assert", 'console.assert(ok, "x");'],
		["a stderr method through globalThis", "globalThis.console.error(e);"],
		["a stderr method through optional chaining", 'console?.warn("x");'],
		["a stderr method on the next line", 'console\n\t.error("x");'],
		["a stderr method read, not called", "const warn = console.warn;"],
		["core's Console service", "const current = yield* Console.Console;"],
		["core's Console module functions", 'yield* Console.log("x");'],
		[
			"a string, a comment and template text",
			'const s = "console.log";\n// console.log("x")\nconst t = `console.log`;',
		],
	] as const;
	for (const [name, text] of spared) {
		it(`spares ${name}`, () => assert.deepStrictEqual(lines(text, "console-stdout"), [], text));
	}

	it("names the member it flagged, or the bare global", () => {
		const found = SourceBoundary.check("f.ts", 'console.error("e");\nconsole.log("x");\nconst c = console;', [
			"console-stdout",
		]);
		assert.deepStrictEqual(
			found.map((offence) => offence.label),
			["f.ts:2:1 console-stdout console.log", "f.ts:3:11 console-stdout console"],
		);
	});

	it("positive control: console, on the same text, flags the stderr calls console-stdout spares", () => {
		const text = 'console.error("x");\nconsole.warn("x");\nconsole.trace("x");\nconsole.assert(ok);';
		assert.deepStrictEqual(lines(text, "console"), [1, 2, 3, 4]);
		assert.deepStrictEqual(lines(text, "console-stdout"), []);
	});
});

/** The OffenceRule a fixture's rule reports under. */
const kindOf = (rule: BoundaryRule): OffenceRule =>
	typeof rule === "string" ? rule : "forbidTokens" in rule ? "forbidTokens" : "forbidImports";

describe("SourceBoundary.fixtures", () => {
	it("every shipped fixture behaves as it claims (the consumer's positive control)", () => {
		assert.deepStrictEqual(SourceBoundary.verifyFixtures(), []);
	});

	it("covers both polarities for every rule kind", () => {
		const kinds = new Set(SourceBoundary.fixtures.map((fixture) => kindOf(fixture.rule)));
		for (const kind of kinds) {
			const own = SourceBoundary.fixtures.filter((fixture) => kindOf(fixture.rule) === kind);
			assert.isTrue(
				own.some((fixture) => fixture.flagged),
				`${kind} has a flagged fixture`,
			);
			assert.isTrue(
				own.some((fixture) => !fixture.flagged),
				`${kind} has a spared fixture`,
			);
		}
		assert.strictEqual(kinds.size, 7);
	});
});

describe("SourceBoundary on the real tree", () => {
	// ConfigDependencyHooks.ts embeds a node program (REPLAY_SCRIPT) as template
	// text: it reads process.argv, writes process.stdout and calls import(url),
	// all as TEXT that this module never executes.
	const file = resolve(dirname(fileURLToPath(import.meta.url)), "../../effected/workspaces/ConfigDependencyHooks.ts");
	const text = readFileSync(file, "utf8");
	const open = text.indexOf("const REPLAY_SCRIPT = `");
	const script = text.slice(text.indexOf("`", open) + 1, text.indexOf("\n`;", open));

	it("positive control: the embedded script, lexed as code, does read process and write stdout", () => {
		assert.isAbove(script.length, 1000, "the REPLAY_SCRIPT body was located");
		assert.isAbove(SourceBoundary.check("script.js", script, ["process"]).length, 2);
		assert.strictEqual(SourceBoundary.check("script.js", script, ["stdout-write"]).length, 1);
	});

	it("spares the process reads and the stdout write that sit in REPLAY_SCRIPT's template text", () => {
		const offences = SourceBoundary.check("src/ConfigDependencyHooks.ts", text, ["process", "stdout-write", "console"]);
		assert.deepStrictEqual(
			offences.map((offence) => offence.label),
			[],
		);
		assert.notInclude(SourceBoundary.importSpecifiers(text), "url");
		assert.include(SourceBoundary.importSpecifiers(text), "effect/process");
	});
});


describe("SourceBoundary review regressions", () => {
	it("owns structural rule and fixture schemas and a public offence literal kit", () => {
		for (const rule of OffenceRuleModel.literals) {
			assert.isTrue(OffenceRuleModel.is[rule](rule));
			assert.strictEqual(OffenceRuleModel.Enum[rule], rule);
		}
		assert.isTrue(S.is(BoundaryRuleModel)({ forbidImports: ["node:*"] }));
		assert.isTrue(S.is(BoundaryRuleModel)({ forbidTokens: ["eval("] }));
		for (const fixture of SourceBoundary.fixtures) assert.isTrue(S.is(BoundaryFixture)(fixture));
	});

	it("matches cooked escaped imports while reporting their original quote position", () => {
		const text = 'import p from "\\u006eode:process";';
		assert.deepStrictEqual(SourceBoundary.importSpecifiers(text), ["node:process"]);
		assert.isTrue(SourceBoundary.importsNode(text, "process"));
		assert.deepStrictEqual(
			SourceBoundary.check("f.ts", text, ["node:process", { forbidImports: ["node:*"] }]).map((o) => o.label),
			["f.ts:1:15 node:process node:process", "f.ts:1:15 forbidImports node:process"],
		);
	});

	for (const source of ["const 𝒙process = 1; 𝒙process;", "const process𝒙 = 1; process𝒙;"]) {
		it(`spares complete astral identifiers: ${source}`, () => {
			assert.isFalse(SourceBoundary.referencesProcess(source));
			assert.deepStrictEqual(SourceBoundary.check("f.ts", source, ["process", { forbidTokens: ["process"] }]), []);
		});
	}

	it("uses complete code points for stdout, console members and ignore-token boundaries", () => {
		assert.deepStrictEqual(SourceBoundary.check("f.ts", "𝒙stdout.write(x); stdout.write𝒙(x);", ["stdout-write"]), []);
		assert.deepStrictEqual(lines("console.error𝒙(x);", "console-stdout"), [1]);
		assert.isTrue(SourceBoundary.referencesProcess("process.env.__PACKAGE_VERSION__𝒙;"));
	});

	for (const separator of ["\r", "\u2028", "\u2029", "\r\n"]) {
		it(`ends a line comment and locates the following code after ${separator.codePointAt(0)}`, () => {
			const text = `// harmless${separator}process.touch();`;
			assert.strictEqual(SourceBoundary.stripComments(text), `           ${separator}process.touch();`);
			assert.deepStrictEqual(SourceBoundary.check("f.ts", text, ["process"]).map((o) => o.label), ["f.ts:2:1 process process"]);
		});
	}
});


describe("SourceBoundary round-2 scanner contracts", () => {
	it.effect("keeps option payloads plain, optional and free of eager defaults", () =>
		Effect.gen(function* () {
			const options: ScanOptions = { root: "/repo/src", rules: ["process"] };
			assert.deepStrictEqual(yield* S.decodeEffect(ScanOptions)(options), options);
			assert.deepStrictEqual(yield* S.decodeEffect(ReferenceOptions)({}), {});
			const explicit: ScanOptions = {
				...options,
				ignoreTokens: undefined,
				allow: undefined,
				extensions: undefined,
				allowRules: { process: undefined, forbidImports: ["allowed.ts"] },
			};
			assert.deepStrictEqual(yield* S.decodeEffect(ScanOptions)(explicit), explicit);
			assert.isTrue(S.is(ScanOptions)({ ...options, allowRules: undefined }));
		}));

	it("flags escaped process reads and spares longer cooked identifiers", () => {
		assert.isTrue(SourceBoundary.referencesProcess("const p = \\u0070rocess;"));
		assert.isFalse(SourceBoundary.referencesProcess("const process\\u0078 = 1; process\\u0078;"));
		assert.isFalse(SourceBoundary.referencesProcess("child.\\u0070rocess;"));
		assert.isFalse(SourceBoundary.referencesProcess("process\\u00ZZ;"));
		assert.deepStrictEqual(
			SourceBoundary.check("src/a.ts", 'const label = "😀";\r\n\tconst p = \\u{70}rocess;', ["process"]).map((offence) => offence.label),
			["src/a.ts:2:12 process process"],
		);
	});

	it("uses the raw escaped console width when sparing stderr methods", () => {
		assert.deepStrictEqual(SourceBoundary.check("f.ts", '\\u0063onsole.warn("x");', ["console-stdout"]), []);
		assert.deepStrictEqual(
			SourceBoundary.check("f.ts", '\\u{63}onsole.log("x");', ["console-stdout"]).map((offence) => offence.label),
			["f.ts:1:1 console-stdout console.log"],
		);
	});

	it("flags escaped and optional standalone require imports at the raw quote locations", () => {
		const text = '\\u0072equire("node:process");\r\nrequire?.("node:process");';
		assert.deepStrictEqual(SourceBoundary.importSpecifiers(text), ["node:process", "node:process"]);
		assert.isTrue(SourceBoundary.importsNode(text, "process"));
		assert.deepStrictEqual(
			SourceBoundary.check("src/a.ts", text, ["node:process"]).map((offence) => offence.label),
			["src/a.ts:1:14 node:process node:process", "src/a.ts:2:11 node:process node:process"],
		);
		assert.deepStrictEqual(SourceBoundary.check("f.ts", text, [{ forbidImports: ["node:*"] }]).map((offence) => offence.detail), ["node:process", "node:process"]);
	});

	it("spares escaped member and computed optional require calls", () => {
		const text = [
			'obj.\\u0072equire("node:process");',
			'obj?.require?.("node:process");',
			'require?.("node:process" + suffix);',
			'require\\u0078?.("node:process");',
			'\\u00ZZrequire?.("node:process");',
		].join("\n");
		assert.deepStrictEqual(SourceBoundary.importSpecifiers(text), []);
		assert.isFalse(SourceBoundary.importsNode(text, "process"));
		assert.deepStrictEqual(SourceBoundary.check("f.ts", text, ["node:process"]), []);
	});
});
