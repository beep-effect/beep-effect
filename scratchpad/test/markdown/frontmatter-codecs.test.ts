// Unit coverage for the three frontmatter codec modules (P3 Task 2).
//
// Each codec is a free-standing named export over its kit peer — never a
// namespace object (the config-file tree-shaking rule). The contract is
// field-identical across the three: check the capture's `format` marker
// first (mismatch fails typed, before any parsing), then decode through the
// peer's public parse surface, wrapping its typed failure structurally.
//
// Empty-capture behavior is pinned per engine, verified by probe: yaml's
// empty document is `null`, toml's is `{}`, and JSON has no empty-document
// value so the json codec fails typed on an empty capture.

import { assert, describe, it } from "@effect/vitest";
import { JsoncParseError } from "../../effected/jsonc/index.ts";
import { TomlParseError } from "../../effected/toml/index.ts";
import { YamlParseError } from "../../effected/yaml/index.ts";
import { Effect } from "effect";
import type { FrontmatterCodec } from "../../effected/markdown/Frontmatter.ts";
import { FrontmatterDecodeError, FrontmatterFormatMismatchError } from "../../effected/markdown/Frontmatter.ts";
import { JsonFrontmatter } from "../../effected/markdown/JsonFrontmatter.ts";
import { Markdown, MarkdownParseOptions } from "../../effected/markdown/Markdown.ts";
import type { FrontmatterFormat } from "../../effected/markdown/MarkdownNode.ts";
import { Frontmatter, Point, Position } from "../../effected/markdown/MarkdownNode.ts";
import { TomlFrontmatter } from "../../effected/markdown/TomlFrontmatter.ts";
import { YamlFrontmatter } from "../../effected/markdown/YamlFrontmatter.ts";

const withFrontmatter = MarkdownParseOptions.make({ frontmatter: true });

/** A hand-built capture node; the position is synthetic and irrelevant here. */
const capture = (format: FrontmatterFormat, value: string): Frontmatter =>
	Frontmatter.make({
		format,
		value,
		position: Position.make({
			start: Point.make({ line: 1, column: 1, offset: 0 }),
			end: Point.make({ line: 1, column: 1, offset: 0 }),
		}),
	});

/** The head frontmatter node of a real capture-enabled parse. */
const parsedCapture = (source: string) =>
	Effect.map(Markdown.parse(source, withFrontmatter), (root) => {
		const head = root.children[0];
		assert.isDefined(head, "expected a head node");
		assert.strictEqual(head?.type, "frontmatter");
		if (head?.type !== "frontmatter") {
			throw new TypeError("unreachable: asserted the type above");
		}
		return head;
	});

describe("frontmatter codecs", () => {
	describe("YamlFrontmatter", () => {
		it.effect("decodes a valid yaml capture to data", () =>
			Effect.gen(function* () {
				const data = yield* YamlFrontmatter.decode(capture("yaml", "title: Hello\ntags:\n  - a\n  - b\n"));
				assert.deepStrictEqual(data, { title: "Hello", tags: ["a", "b"] });
			}),
		);

		it.effect("decodes an empty capture to null, yaml's empty document", () =>
			Effect.gen(function* () {
				const data = yield* YamlFrontmatter.decode(capture("yaml", ""));
				assert.isNull(data);
			}),
		);

		it.effect("fails typed on unparseable yaml, carrying the YamlParseError structurally", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(YamlFrontmatter.decode(capture("yaml", "a: [1\n")));
				assert.instanceOf(error, FrontmatterDecodeError);
				assert.strictEqual(error.format, "yaml");
				assert.instanceOf(error.cause, YamlParseError);
			}),
		);

		it.effect("fails typed on a format mismatch, before any parsing", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(YamlFrontmatter.decode(capture("toml", "a = 1\n")));
				assert.instanceOf(error, FrontmatterFormatMismatchError);
				assert.strictEqual(error.expected, "yaml");
				assert.strictEqual(error.actual, "toml");
			}),
		);
	});

	describe("TomlFrontmatter", () => {
		it.effect("decodes a valid toml capture to data", () =>
			Effect.gen(function* () {
				const data = yield* TomlFrontmatter.decode(capture("toml", 'title = "Hello"\n\n[owner]\nname = "spencer"\n'));
				assert.deepStrictEqual(data, { title: "Hello", owner: { name: "spencer" } });
			}),
		);

		it.effect("decodes an empty capture to an empty table, toml's empty document", () =>
			Effect.gen(function* () {
				const data = yield* TomlFrontmatter.decode(capture("toml", ""));
				assert.deepStrictEqual(data, {});
			}),
		);

		it.effect("fails typed on unparseable toml, carrying the TomlParseError structurally", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TomlFrontmatter.decode(capture("toml", "a = = 1\n")));
				assert.instanceOf(error, FrontmatterDecodeError);
				assert.strictEqual(error.format, "toml");
				assert.instanceOf(error.cause, TomlParseError);
			}),
		);

		it.effect("fails typed on a format mismatch, before any parsing", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TomlFrontmatter.decode(capture("json", '{"a": 1}')));
				assert.instanceOf(error, FrontmatterFormatMismatchError);
				assert.strictEqual(error.expected, "toml");
				assert.strictEqual(error.actual, "json");
			}),
		);
	});

	describe("JsonFrontmatter", () => {
		it.effect("decodes a valid json capture to data", () =>
			Effect.gen(function* () {
				const data = yield* JsonFrontmatter.decode(capture("json", '{"title": "Hello", "draft": false}'));
				assert.deepStrictEqual(data, { title: "Hello", draft: false });
			}),
		);

		it.effect("decodes jsonc leniencies — comments and trailing commas — rather than failing", () =>
			Effect.gen(function* () {
				const data = yield* JsonFrontmatter.decode(capture("json", '{\n\t// a comment\n\t"a": 1,\n}'));
				assert.deepStrictEqual(data, { a: 1 });
			}),
		);

		it.effect("fails typed on an empty capture: JSON has no empty document", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(JsonFrontmatter.decode(capture("json", "")));
				assert.instanceOf(error, FrontmatterDecodeError);
				assert.strictEqual(error.format, "json");
				assert.instanceOf(error.cause, JsoncParseError);
			}),
		);

		it.effect("fails typed on unparseable json, carrying the JsoncParseError structurally", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(JsonFrontmatter.decode(capture("json", "{a: \n")));
				assert.instanceOf(error, FrontmatterDecodeError);
				assert.strictEqual(error.format, "json");
				assert.instanceOf(error.cause, JsoncParseError);
			}),
		);

		it.effect("fails typed on a format mismatch, before any parsing", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(JsonFrontmatter.decode(capture("yaml", "a: 1\n")));
				assert.instanceOf(error, FrontmatterFormatMismatchError);
				assert.strictEqual(error.expected, "json");
				assert.strictEqual(error.actual, "yaml");
			}),
		);
	});

	describe("end to end over Markdown.parse", () => {
		it.effect("yaml: parse with capture, decode the captured node", () =>
			Effect.gen(function* () {
				const node = yield* parsedCapture("---\ntitle: Hello\n---\n\n# Body\n");
				const data = yield* YamlFrontmatter.decode(node);
				assert.deepStrictEqual(data, { title: "Hello" });
			}),
		);

		it.effect("toml: parse with capture, decode the captured node", () =>
			Effect.gen(function* () {
				const node = yield* parsedCapture('+++\ntitle = "Hello"\n+++\n\n# Body\n');
				const data = yield* TomlFrontmatter.decode(node);
				assert.deepStrictEqual(data, { title: "Hello" });
			}),
		);

		it.effect("json: parse with capture, decode the captured node", () =>
			Effect.gen(function* () {
				const node = yield* parsedCapture('---json\n{"title": "Hello"}\n---\n\n# Body\n');
				const data = yield* JsonFrontmatter.decode(node);
				assert.deepStrictEqual(data, { title: "Hello" });
			}),
		);
	});

	describe("contract shape", () => {
		it("the three codecs carry field-identical contract shapes", () => {
			const codecs: ReadonlyArray<FrontmatterCodec> = [YamlFrontmatter, TomlFrontmatter, JsonFrontmatter];
			for (const codec of codecs) {
				assert.deepStrictEqual(Object.keys(codec).sort(), ["decode", "encode", "format"]);
				assert.isFunction(codec.decode);
				assert.isFunction(codec.encode);
			}
			assert.deepStrictEqual(
				codecs.map((codec) => codec.format),
				["yaml", "toml", "json"],
			);
		});
	});
});
