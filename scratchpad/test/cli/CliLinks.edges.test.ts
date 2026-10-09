// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { assert, describe, it } from "@effect/vitest";
import { CurrentRuntimeEnv } from "../../effected/env/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import type { CliLinksShape, EditorLinks, LinkTarget } from "../../effected/cli/index.ts";
import { CliLinks, Doc, Render } from "../../effected/cli/index.ts";
import { contextOf } from "./helpers/renderContext.ts";

const Json = S.fromJsonString(S.Unknown);

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(7);
const OSC_OPEN = `${ESC}]8;;`;
const ST = `${ESC}\\`;

const warnings = (sink: Array<string>) =>
	Logger.layer([
		Logger.make(({ message }) => {
			sink.push(Array.isArray(message) ? message.join(" ") : String(message));
		}),
	]);

/** `CliLinks` over a memfs volume rooted at /repo (a .git dir), with an environment. */
const links = (
	options: { readonly editorLinks?: EditorLinks; readonly envVar?: string } = {},
	env: Record<string, string> = {},
	sink: Array<string> = [],
): Effect.Effect<CliLinksShape> => {
	const layer = CliLinks.layer({ ...options, cwd: "/repo" }).pipe(
		Layer.provide(
			Layer.mergeAll(
				MemoryFileSystem.layerWith({ "/repo/.git": MemoryFileSystem.directory() }),
				Path.layer,
				CurrentRuntimeEnv.layerTest(),
			),
		),
	);
	return CliLinks.pipe(
		Effect.provide(layer),
		Effect.provide(warnings(sink)),
		Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
	);
};

const fixed = (mode: "vscode" | "file" | "off") =>
	CliLinks.pipe(Effect.provide(CliLinks.layerTest(mode)));

describe("a UNC path has no link target, never a link to a file that does not exist", () => {
	const UNC = ["\\\\server\\share\\a.ts", "//server/share/a.ts", "\\\\?\\C:\\x.ts", "//host/x"];

	it.effect("in file and vscode mode, with a filesystem and without one", () =>
		Effect.gen(function* () {
			for (const mode of ["file", "vscode"] as const) {
				const ambient = yield* links({ editorLinks: mode });
				const test = yield* fixed(mode);
				for (const path of UNC) {
					assert.deepStrictEqual(ambient.target({ file: path, line: 1 }), O.none(), `${mode} ${path}`);
					assert.deepStrictEqual(test.target({ file: path, line: 1 }), O.none(), `${mode} test ${path}`);
				}
			}
		}),
	);

	it.effect("control: a path with one leading slash, and a drive path, still link", () =>
		Effect.gen(function* () {
			const l = yield* links({ editorLinks: "file" });
			assert.deepStrictEqual(l.target({ file: "/server/share/a.ts" }), O.some("file:///server/share/a.ts"));
			assert.deepStrictEqual(l.target({ file: "C:\\x\\y.ts" }), O.some("file:///C:/x/y.ts"));
		}),
	);
});

describe("a colon in a POSIX path is data, not a drive", () => {
	it.effect("keeps it encoded in the path, wherever it sits", () =>
		Effect.gen(function* () {
			const l = yield* links({ editorLinks: "file" });
			assert.deepStrictEqual(l.target({ file: "/a/C:b" }), O.some("file:///a/C%3Ab"));
			assert.deepStrictEqual(l.target({ file: "./C:x" }), O.some("file:///repo/C%3Ax"));
			assert.deepStrictEqual(l.target({ file: "src/C:/x.ts" }), O.some("file:///repo/src/C%3A/x.ts"));
			assert.deepStrictEqual(l.target({ file: "/C:/x" }), O.some("file:///C%3A/x"));
		}),
	);

	it.effect("a drive-relative C:x.ts and a two-letter prefix are not absolute drive paths", () =>
		Effect.gen(function* () {
			const l = yield* links({ editorLinks: "file" });
			assert.deepStrictEqual(l.target({ file: "C:x.ts" }), O.some("file:///repo/C%3Ax.ts"));
			assert.deepStrictEqual(l.target({ file: "CC:\\x" }), O.some("file:///repo/CC%3A%5Cx"));
		}),
	);
});

describe("Render.markdown builds file links with the same builder as CliLinks", () => {
	const paths = [
		"/a/b.ts",
		"/a/my dir/b.ts",
		"C:\\x\\y.ts",
		"c:/x/y.ts",
		"/a/C:b",
		"/a/b#c.ts",
		"/a/b?c.ts",
		"/a/(x)/b.ts",
	];

	it.effect("the destination equals the file mode's URL, for POSIX paths, drive paths and awkward characters", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf({ audience: "human" });
			const file = yield* fixed("file");
			for (const path of paths) {
				const url = file.target({ file: path });
				assert.isTrue(O.isSome(url), path);
				const out = Render.markdown([Doc.paragraph(Doc.link({ file: path }, "label"))], ctx);
				assert.strictEqual(out, `[label](${O.getOrThrow(url)})`, path);
			}
		}),
	);

	it.effect("a UNC path and a relative path are the label with the target in code, never a link", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf({ audience: "human" });
			for (const path of ["\\\\server\\share\\a.ts", "//server/share/a.ts", "rel/a.ts"]) {
				const out = Render.markdown([Doc.paragraph(Doc.link({ file: path }, "label"))], ctx);
				assert.notInclude(out, "](", path);
				assert.include(out, "label", path);
			}
		}),
	);
});

describe("CliLinks.linker writes a URL as OSC 8 wants it: bytes outside 32 to 126 are percent-encoded", () => {
	const write = (url: string): string => {
		const l: CliLinksShape = {
			mode: "file",
			target: (target: LinkTarget) => ("url" in target ? O.some(target.url) : O.none()),
		};
		return CliLinks.linker({ links: l, hyperlinks: true, audience: "human" })({ url }, "label");
	};
	const urlOf = (written: string): string => written.slice(OSC_OPEN.length, written.indexOf(ST));

	it("a non-ASCII URL is encoded as UTF-8 bytes", () => {
		assert.strictEqual(urlOf(write("https://x.test/é/日本")), "https://x.test/%C3%A9/%E6%97%A5%E6%9C%AC");
		assert.strictEqual(urlOf(write("https://x.test/😀")), "https://x.test/%F0%9F%98%80");
	});

	it("an already-encoded URL is not encoded twice, and plain ASCII is untouched", () => {
		for (const url of ["https://x.test/%C3%A9", "https://x.test/a%20b?q=1&r=2#frag", "mailto:a@b.test", "/rel/path"]) {
			assert.strictEqual(urlOf(write(url)), url);
		}
	});

	it("a lone surrogate cannot throw, and a control character is gone before it could end the sequence", () => {
		assert.doesNotThrow(() => write("https://x.test/\uD800"));
		const out = write(`https://x.test/a${ESC}\\b${BEL}c`);
		assert.strictEqual(out.split(ESC).length - 1, 4, "exactly the two OSC 8 pairs' own escapes");
		for (const byte of out.slice(OSC_OPEN.length, out.indexOf(ST)))
			assert.isTrue(byte.charCodeAt(0) >= 32 && byte.charCodeAt(0) <= 126);
	});

	it("every character it writes between the escapes is printable ASCII", () => {
		const samples = [
			"https://x.test/é",
			"https://x.test/日本",
			"https://x.test/\u0085x",
			"https://x.test/\u200Bx",
			"https://x.test/\u00a0x",
		];
		for (const url of samples) {
			const written = urlOf(write(url));
			for (const ch of written)
				assert.isTrue(ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126, `${JSON.stringify(url)} -> ${written}`);
		}
	});
});

describe("an invalid editor-links value is warned about once, like the audience override", () => {
	it.effect("warns, names the variable and the accepted values, and falls back to the option", () =>
		Effect.gen(function* () {
			const sink: Array<string> = [];
			const l = yield* links(
				{ envVar: "TOOL_EDITOR_LINKS", editorLinks: "vscode" },
				{ TOOL_EDITOR_LINKS: "emacs" },
				sink,
			);
			assert.strictEqual(l.mode, "vscode", "the option, not the bad value");
			assert.strictEqual(sink.length, 1, sink.join("\n"));
			assert.include(sink[0] ?? "", "TOOL_EDITOR_LINKS=emacs");
			assert.include(sink[0] ?? "", "auto|vscode|file|off");
		}),
	);

	it.effect("a valid value, an unset one and an empty one do not warn", () =>
		Effect.gen(function* () {
			for (const env of [{ TOOL_EDITOR_LINKS: "FILE" }, {}, { TOOL_EDITOR_LINKS: "" }]) {
				const sink: Array<string> = [];
				yield* links({ envVar: "TOOL_EDITOR_LINKS" }, env, sink);
				assert.deepStrictEqual(sink, [], Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
			}
		}),
	);

	it.effect("without an envVar option nothing is read, so nothing warns", () =>
		Effect.gen(function* () {
			const sink: Array<string> = [];
			yield* links({}, { TOOL_EDITOR_LINKS: "emacs" }, sink);
			assert.deepStrictEqual(sink, []);
		}),
	);
});
