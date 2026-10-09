// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { CurrentRuntimeEnv } from "../../effected/env/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { ConfigProvider, Effect, Layer, Option, Path } from "effect";
import type { CliLinksShape, EditorLinks } from "../../effected/cli/index.ts";
import { CliLinks } from "../../effected/cli/index.ts";
import { linksOf } from "./helpers/renderContext.ts";

const dir = MemoryFileSystem.directory();
const file = MemoryFileSystem.file("");

/** `n` nested directories under the root: `/a/a/a` for 3. */
const deep = (n: number): string => `/${Array.from({ length: n }, () => "a").join("/")}`;

interface Setup {
	readonly seed?: Record<
		string,
		ReturnType<typeof MemoryFileSystem.directory> | ReturnType<typeof MemoryFileSystem.file>
	>;
	readonly options?: { readonly editorLinks?: EditorLinks; readonly envVar?: string; readonly cwd?: string };
	readonly terminal?: string;
	readonly env?: Record<string, string>;
}

/** Build `CliLinks` over a memfs volume with a fixed runtime and environment. */
const links = (setup: Setup): Effect.Effect<CliLinksShape> => {
	const runtime = CurrentRuntimeEnv.layerTest(
		setup.terminal === undefined ? {} : { terminal: Option.some({ name: setup.terminal, version: Option.none() }) },
	);
	const layer = CliLinks.layer(setup.options).pipe(
		Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith(setup.seed ?? {}), Path.layer, runtime)),
	);
	return Effect.gen(function* () {
		return yield* CliLinks;
	}).pipe(
		Effect.provide(layer),
		Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(setup.env ?? {})),
	);
};

describe("CliLinks.layer: which mode auto picks", () => {
	it.effect("a .vscode directory at the .git root two levels up gives vscode", () =>
		Effect.gen(function* () {
			const l = yield* links({
				seed: { "/repo/.git": dir, "/repo/.vscode": dir, "/repo/a/b": dir },
				options: { cwd: "/repo/a/b" },
			});
			assert.strictEqual(l.mode, "vscode");
		}),
	);

	it.effect("a pnpm-workspace.yaml marks the root too", () =>
		Effect.gen(function* () {
			const l = yield* links({
				seed: { "/ws/pnpm-workspace.yaml": file, "/ws/.vscode": dir, "/ws/pkg/src": dir },
				options: { cwd: "/ws/pkg/src" },
			});
			assert.strictEqual(l.mode, "vscode");
		}),
	);

	it.effect("no .vscode gives file", () =>
		Effect.gen(function* () {
			const l = yield* links({ seed: { "/repo/.git": dir, "/repo/a/b": dir }, options: { cwd: "/repo/a/b" } });
			assert.strictEqual(l.mode, "file");
		}),
	);

	it.effect("the vscode terminal signal gives vscode with no .vscode", () =>
		Effect.gen(function* () {
			const l = yield* links({ seed: { "/repo/.git": dir }, options: { cwd: "/repo" }, terminal: "vscode" });
			assert.strictEqual(l.mode, "vscode");
			const other = yield* links({ seed: { "/repo/.git": dir }, options: { cwd: "/repo" }, terminal: "iterm2" });
			assert.strictEqual(other.mode, "file");
		}),
	);

	it.effect("a .vscode that is a file, not a directory, is not the signal", () =>
		Effect.gen(function* () {
			const l = yield* links({ seed: { "/repo/.git": dir, "/repo/.vscode": file }, options: { cwd: "/repo" } });
			assert.strictEqual(l.mode, "file");
		}),
	);

	it.effect("the root is the NEAREST ancestor with .git, so a parent's .vscode is not borrowed", () =>
		Effect.gen(function* () {
			const l = yield* links({
				seed: { "/repo/.git": dir, "/repo/.vscode": dir, "/repo/pkg/.git": dir, "/repo/pkg/x": dir },
				options: { cwd: "/repo/pkg/x" },
			});
			assert.strictEqual(l.mode, "file");
		}),
	);

	it.effect("with no root at all, cwd itself is checked", () =>
		Effect.gen(function* () {
			const l = yield* links({ seed: { "/p/q/.vscode": dir }, options: { cwd: "/p/q" } });
			assert.strictEqual(l.mode, "vscode");
			const none = yield* links({ seed: { "/p/q": dir }, options: { cwd: "/p/q" } });
			assert.strictEqual(none.mode, "file");
		}),
	);
});

describe("CliLinks.layer: the ascent is bounded", () => {
	it.effect("a root exactly 64 directories above cwd is found; 65 above is not", () =>
		Effect.gen(function* () {
			const root = deep(10);
			const seed = { [`${root}/.git`]: dir, [`${root}/.vscode`]: dir };
			const found = yield* links({ seed: { ...seed, [deep(74)]: dir }, options: { cwd: deep(74) } });
			assert.strictEqual(found.mode, "vscode", "64 steps up reaches the root");
			const missed = yield* links({ seed: { ...seed, [deep(75)]: dir }, options: { cwd: deep(75) } });
			assert.strictEqual(
				missed.mode,
				"file",
				"65 steps up is past the bound, so cwd itself is checked and has no .vscode",
			);
		}),
	);

	it.effect("it stops at the filesystem root, where dirname reaches a fixpoint, without a root", () =>
		Effect.gen(function* () {
			const l = yield* links({ seed: { "/x/y": dir }, options: { cwd: "/x/y" } });
			assert.strictEqual(l.mode, "file");
			const atRoot = yield* links({ seed: { "/.vscode": dir }, options: { cwd: "/" } });
			assert.strictEqual(atRoot.mode, "vscode", "at / there is no parent to climb to, and cwd itself is checked");
		}),
	);
});

describe("CliLinks.layer: the setting", () => {
	it.effect("an explicit option beats auto", () =>
		Effect.gen(function* () {
			const seed = { "/repo/.git": dir, "/repo/.vscode": dir };
			assert.strictEqual((yield* links({ seed, options: { cwd: "/repo", editorLinks: "file" } })).mode, "file");
			assert.strictEqual((yield* links({ seed, options: { cwd: "/repo", editorLinks: "off" } })).mode, "off");
			assert.strictEqual((yield* links({ seed: {}, options: { cwd: "/repo", editorLinks: "vscode" } })).mode, "vscode");
		}),
	);

	it.effect("the env var beats the option, is case-insensitive, and an invalid value is ignored", () =>
		Effect.gen(function* () {
			const options = { cwd: "/repo", editorLinks: "vscode" as const, envVar: "MYTOOL_EDITOR_LINKS" };
			assert.strictEqual((yield* links({ options, env: { MYTOOL_EDITOR_LINKS: "off" } })).mode, "off");
			assert.strictEqual((yield* links({ options, env: { MYTOOL_EDITOR_LINKS: " FILE " } })).mode, "file");
			assert.strictEqual(
				(yield* links({ options, env: { MYTOOL_EDITOR_LINKS: "banana" } })).mode,
				"vscode",
				"falls back to the option",
			);
			assert.strictEqual((yield* links({ options, env: {} })).mode, "vscode", "unset falls back to the option");
			const auto = yield* links({
				options: { cwd: "/repo", envVar: "MYTOOL_EDITOR_LINKS" },
				env: { MYTOOL_EDITOR_LINKS: "auto" },
			});
			assert.strictEqual(auto.mode, "file", "auto through the env var still detects");
		}),
	);

	it.effect("a variable is read only when the consumer names it", () =>
		Effect.gen(function* () {
			const l = yield* links({ options: { cwd: "/repo" }, env: { MYTOOL_EDITOR_LINKS: "off", EDITOR_LINKS: "off" } });
			assert.strictEqual(l.mode, "file");
		}),
	);

	it.effect("cwd comes from the option, else PWD through Config", () =>
		Effect.gen(function* () {
			const seed = { "/from/pwd/.git": dir, "/from/pwd/.vscode": dir, "/from/option/.git": dir };
			assert.strictEqual((yield* links({ seed, env: { PWD: "/from/pwd" } })).mode, "vscode");
			assert.strictEqual(
				(yield* links({ seed, env: { PWD: "/from/pwd" }, options: { cwd: "/from/option" } })).mode,
				"file",
			);
		}),
	);
});

describe("CliLinks: the target of a link", () => {
	const target = (mode: "vscode" | "file" | "off", seedCwd = "/repo") =>
		links({ seed: { "/repo/.git": dir }, options: { cwd: seedCwd, editorLinks: mode } });

	it.effect("vscode is vscode://file/<abs>:<line>:<col>; a column needs a line", () =>
		Effect.gen(function* () {
			const l = yield* target("vscode");
			assert.deepStrictEqual(
				l.target({ file: "/repo/src/a.ts", line: 3, col: 4 }),
				Option.some("vscode://file/repo/src/a.ts:3:4"),
			);
			assert.deepStrictEqual(
				l.target({ file: "/repo/src/a.ts", line: 3 }),
				Option.some("vscode://file/repo/src/a.ts:3"),
			);
			assert.deepStrictEqual(l.target({ file: "/repo/src/a.ts" }), Option.some("vscode://file/repo/src/a.ts"));
			assert.deepStrictEqual(l.target({ file: "/repo/src/a.ts", col: 4 }), Option.some("vscode://file/repo/src/a.ts"));
		}),
	);

	it.effect("file is file://<abs> and drops the position", () =>
		Effect.gen(function* () {
			const l = yield* target("file");
			assert.deepStrictEqual(
				l.target({ file: "/repo/src/a.ts", line: 3, col: 4 }),
				Option.some("file:///repo/src/a.ts"),
			);
		}),
	);

	it.effect("off has no file target, but a URL is a URL", () =>
		Effect.gen(function* () {
			const l = yield* target("off");
			assert.deepStrictEqual(l.target({ file: "/repo/src/a.ts", line: 3 }), Option.none());
			assert.deepStrictEqual(l.target({ url: "https://example.test/x" }), Option.some("https://example.test/x"));
			const v = yield* target("vscode");
			assert.deepStrictEqual(v.target({ url: "https://example.test/x" }), Option.some("https://example.test/x"));
		}),
	);

	it.effect("a relative path resolves against cwd", () =>
		Effect.gen(function* () {
			const l = yield* target("vscode", "/repo/pkg");
			assert.deepStrictEqual(l.target({ file: "src/a.ts", line: 1 }), Option.some("vscode://file/repo/pkg/src/a.ts:1"));
			assert.deepStrictEqual(l.target({ file: "../x.ts" }), Option.some("vscode://file/repo/x.ts"));
		}),
	);

	it.effect("the path is URL-encoded per RFC 3986 with its slashes kept: spaces, #, %, ?, unicode, brackets", () =>
		Effect.gen(function* () {
			const l = yield* target("file");
			const enc = (file: string) => Option.getOrThrow(l.target({ file }));
			assert.strictEqual(enc("/repo/my dir/a b.ts"), "file:///repo/my%20dir/a%20b.ts");
			assert.strictEqual(enc("/repo/a#b.ts"), "file:///repo/a%23b.ts");
			assert.strictEqual(enc("/repo/100%.ts"), "file:///repo/100%25.ts");
			assert.strictEqual(enc("/repo/q?x.ts"), "file:///repo/q%3Fx.ts");
			assert.strictEqual(
				enc("/repo/日本語/ファイル.ts"),
				"file:///repo/%E6%97%A5%E6%9C%AC%E8%AA%9E/%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB.ts",
			);
			assert.strictEqual(enc("/repo/a(1)[2]'x'*!.ts"), "file:///repo/a%281%29%5B2%5D%27x%27%2A%21.ts");
			assert.strictEqual(enc("/repo/a:b,c;d.ts"), "file:///repo/a%3Ab%2Cc%3Bd.ts");
			assert.strictEqual(enc("/repo/ok-._~name.ts"), "file:///repo/ok-._~name.ts", "the unreserved characters stay");
			const v = yield* target("vscode");
			assert.deepStrictEqual(
				v.target({ file: "/repo/my dir/a.ts", line: 2, col: 3 }),
				Option.some("vscode://file/repo/my%20dir/a.ts:2:3"),
			);
		}),
	);

	it.effect("a Windows drive path is absolute everywhere and keeps its drive: file:///C:/x/y.ts, with slashes", () =>
		Effect.gen(function* () {
			const file = yield* target("file");
			const vscode = yield* target("vscode");
			for (const path of ["C:\\x\\y.ts", "C:/x/y.ts", "c:\\x\\y.ts"]) {
				const drive = path.slice(0, 1);
				assert.deepStrictEqual(file.target({ file: path, line: 3 }), Option.some(`file:///${drive}:/x/y.ts`), path);
				assert.deepStrictEqual(
					vscode.target({ file: path, line: 3, col: 4 }),
					Option.some(`vscode://file/${drive}:/x/y.ts:3:4`),
					path,
				);
			}
			assert.deepStrictEqual(file.target({ file: "C:\\my dir\\a#b.ts" }), Option.some("file:///C:/my%20dir/a%23b.ts"));
			// The same through layerTest, which has no filesystem and no Path.
			const test = yield* Effect.gen(function* () {
				return yield* CliLinks;
			}).pipe(Effect.provide(CliLinks.layerTest("file")));
			assert.deepStrictEqual(test.target({ file: "D:\\a\\b.ts" }), Option.some("file:///D:/a/b.ts"));
			// A drive-relative path ("C:x.ts") is not absolute, so it has no link without a Path to resolve it.
			assert.deepStrictEqual(test.target({ file: "C:x.ts" }), Option.none());
		}),
	);

	it.effect("layerTest fixes the mode without a filesystem", () =>
		Effect.gen(function* () {
			for (const mode of ["vscode", "file", "off"] as const) {
				const l = yield* Effect.gen(function* () {
					return yield* CliLinks;
				}).pipe(Effect.provide(CliLinks.layerTest(mode)));
				assert.strictEqual(l.mode, mode);
			}
			const v = yield* Effect.gen(function* () {
				return yield* CliLinks;
			}).pipe(Effect.provide(CliLinks.layerTest("vscode")));
			assert.deepStrictEqual(v.target({ file: "/a/b.ts", line: 1 }), Option.some("vscode://file/a/b.ts:1"));
			assert.deepStrictEqual(
				v.target({ file: "relative.ts" }),
				Option.none(),
				"with no cwd, a relative path has no link",
			);
		}),
	);
});

describe("CliLinks.linker: the RenderContext.link policy", () => {
	const LABEL = "a.ts";
	const at = { file: "/repo/src/a.ts", line: 3, col: 4 };

	const linker = (
		mode: "vscode" | "file" | "off",
		options: { readonly hyperlinks: boolean; readonly audience: "human" | "agent" | "ci" },
	) =>
		Effect.gen(function* () {
			const l = yield* CliLinks;
			return CliLinks.linker({ links: l, ...options });
		}).pipe(Effect.provide(CliLinks.layerTest(mode)));

	it.effect("the truth table: agent never gets a hyperlink; a human gets OSC 8 only when hyperlinks are on", () =>
		Effect.gen(function* () {
			const agent = yield* linker("vscode", { hyperlinks: true, audience: "agent" });
			assert.strictEqual(agent(at, LABEL), LABEL, "agent + hyperlinks: the label alone");
			const human = yield* linker("vscode", { hyperlinks: true, audience: "human" });
			const out = human(at, LABEL);
			const links = linksOf(out);
			assert.strictEqual(links.pairs, 1, "human + hyperlinks: one OSC 8 pair");
			assert.isTrue(links.balanced);
			assert.strictEqual(links.wrapped, LABEL);
			assert.include(out, "]8;;vscode://file/repo/src/a.ts:3:4\u001B\\");
			const plain = yield* linker("vscode", { hyperlinks: false, audience: "human" });
			assert.strictEqual(plain(at, LABEL), LABEL, "human without hyperlinks: the label");
			const agentOff = yield* linker("vscode", { hyperlinks: false, audience: "agent" });
			assert.strictEqual(agentOff(at, LABEL), LABEL);
			const ci = yield* linker("vscode", { hyperlinks: true, audience: "ci" });
			assert.strictEqual(
				linksOf(ci(at, LABEL)).pairs,
				1,
				"ci is a person reading a log, so it links when the terminal can",
			);
		}),
	);

	it.effect("the sequence is OSC 8 with the ST terminator, around the label exactly as given", () =>
		Effect.gen(function* () {
			const human = yield* linker("file", { hyperlinks: true, audience: "human" });
			const painted = "\u001B[31ma.ts\u001B[39m";
			assert.strictEqual(human(at, painted), `\u001B]8;;file:///repo/src/a.ts\u001B\\${painted}\u001B]8;;\u001B\\`);
		}),
	);

	it.effect("mode off gives a file no link, but a URL one; a URL link needs hyperlinks and a human or ci", () =>
		Effect.gen(function* () {
			const off = yield* linker("off", { hyperlinks: true, audience: "human" });
			assert.strictEqual(off(at, LABEL), LABEL);
			const url = off({ url: "https://example.test/x" }, "docs");
			assert.strictEqual(linksOf(url).pairs, 1);
			const agent = yield* linker("off", { hyperlinks: true, audience: "agent" });
			assert.strictEqual(agent({ url: "https://example.test/x" }, "docs"), "docs");
		}),
	);

	it.effect(
		"a URL with a scheme that is not allowed is the label alone: javascript:, data:, vbscript: and their disguises",
		() =>
			Effect.gen(function* () {
				const human = yield* linker("vscode", { hyperlinks: true, audience: "human" });
				for (const url of [
					"javascript:alert(1)",
					"JaVaScRiPt:alert(1)",
					" javascript:alert(1)",
					"java\tscript:alert(1)",
					"java script:alert(1)",
					"data:text/html,<script>x</script>",
					"vbscript:x",
					"blob:https://x.test/y",
					"ftp://files.test/x",
					"ssh://host/repo",
				]) {
					assert.strictEqual(human({ url }, "label"), "label", JSON.stringify(url));
				}
				// The service itself has no target for one either, so no other caller of `target` gets one.
				const l = yield* Effect.gen(function* () {
					return yield* CliLinks;
				}).pipe(Effect.provide(CliLinks.layerTest("vscode")));
				assert.deepStrictEqual(l.target({ url: "javascript:alert(1)" }), Option.none());
				assert.deepStrictEqual(l.target({ url: "data:text/html,x" }), Option.none());
			}),
	);

	it.effect("an allowed scheme, or a relative URL, still links", () =>
		Effect.gen(function* () {
			const human = yield* linker("file", { hyperlinks: true, audience: "human" });
			for (const url of [
				"https://example.test/x",
				"http://example.test/x",
				"HTTPS://EXAMPLE.TEST/x",
				"mailto:a@b.test",
				"file:///repo/a.ts",
				"vscode://file/repo/a.ts:1",
				"vscode-insiders://file/repo/a.ts:1",
				"/relative/path",
				"#fragment",
				"relative/path.html",
			]) {
				assert.strictEqual(linksOf(human({ url }, "label")).pairs, 1, JSON.stringify(url));
			}
		}),
	);

	it.effect(
		"a custom service that hands back an unsafe URL still gets the label: the linker checks what it writes",
		() =>
			Effect.gen(function* () {
				const hostile: CliLinksShape = { mode: "vscode", target: () => Option.some("javascript:alert(1)") };
				const out = CliLinks.linker({ links: hostile, hyperlinks: true, audience: "human" })(
					{ file: "/a.ts" },
					"label",
				);
				assert.strictEqual(out, "label");
			}),
	);

	it.effect("a hostile file path or URL yields exactly one balanced pair and no injected sequence", () =>
		Effect.gen(function* () {
			const human = yield* linker("vscode", { hyperlinks: true, audience: "human" });
			const hostile = [
				`/repo/a\u001B]8;;https://evil.test\u0007b\u001B\\c\r\nd.ts`,
				"/repo/\u0007\u001B\\\u001B[2J.ts",
				"/repo/\u009B31m.ts",
			];
			const outs = [
				...hostile.map((f) => human({ file: f, line: 1 }, "label")),
				human({ url: "https://x.test/\u001B\\\u0007\r\nnext\u001B]8;;evil\u0007" }, "label"),
				human({ url: "\u001B]8;;" }, "label"),
			];
			for (const out of outs) {
				const links = linksOf(out);
				assert.strictEqual(links.pairs, 1, JSON.stringify(out));
				assert.isTrue(links.balanced, JSON.stringify(out));
				assert.strictEqual(links.wrapped, "label");
				// Four ESC in all: the open and close sequences' introducer and ST each. Nothing else.
				assert.strictEqual(out.split("\u001B").length - 1, 4, JSON.stringify(out));
				// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting their absence is the point
				assert.notMatch(out.replace(/\u001B\]8;;|\u001B\\/g, ""), /[\u0000-\u001F\u007F-\u009F]/, JSON.stringify(out));
			}
		}),
	);
});
