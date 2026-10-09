// Unit and property coverage for the frontmatter schema composition seam
// (P3 Task 3): `MarkdownFrontmatter.schema` and the `MarkdownDocument`
// frontmatter accessor.
//
// Naming note: the design doc's indicative spelling was `Frontmatter.schema`,
// but `Frontmatter` names the mdast-shaped capture node class (the Task 1
// co-location ruling), so the seam facade follows the package's
// Markdown-prefix convention instead — `MarkdownFrontmatter.schema`.
//
// The round-trip property generates data, stringifies it through each format
// package's public stringify surface (`Yaml.stringify`, `Toml.stringify`,
// `Jsonc.stringify`), wraps it in fences, parses with capture on and decodes
// back through the seam. Generated
// strings are constrained newline-free: a multi-line string could legally
// place a bare fence-closer at column zero inside the block (toml multi-line
// basic strings do exactly that), which the capture scanner would rightly
// treat as the closing fence — that is fence semantics, not a codec defect,
// so the property excludes it.

import { assert, describe, it } from "@effect/vitest";
import { Jsonc } from "../../effected/jsonc/index.ts";
import { Toml } from "../../effected/toml/index.ts";
import { Yaml } from "../../effected/yaml/index.ts";
import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FrontmatterMissingError, FrontmatterValidationError, MarkdownFrontmatter } from "../../effected/markdown/Frontmatter.ts";
import { JsonFrontmatter } from "../../effected/markdown/JsonFrontmatter.ts";
import { MarkdownParseOptions } from "../../effected/markdown/Markdown.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import { TomlFrontmatter } from "../../effected/markdown/TomlFrontmatter.ts";
import { YamlFrontmatter } from "../../effected/markdown/YamlFrontmatter.ts";

const withFrontmatter = MarkdownParseOptions.make({ frontmatter: true });

const Meta = S.Struct({
	title: S.String,
	count: S.Finite,
});

const parseDoc = (source: string) => MarkdownDocument.parse(source, withFrontmatter);

describe("MarkdownFrontmatter.schema", () => {
	it.effect("decodes yaml frontmatter to typed data end to end", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("---\ntitle: Hello\ncount: 2\n---\n\n# Body\n");
			const data = yield* MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document);
			assert.deepStrictEqual(data, { title: "Hello", count: 2 });
		}),
	);

	it.effect("decodes toml frontmatter to typed data end to end", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc('+++\ntitle = "Hello"\ncount = 2\n+++\n\n# Body\n');
			const data = yield* MarkdownFrontmatter.schema(Meta, TomlFrontmatter)(document);
			assert.deepStrictEqual(data, { title: "Hello", count: 2 });
		}),
	);

	it.effect("decodes json frontmatter to typed data end to end", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc('---json\n{ "title": "Hello", "count": 2 }\n---\n\n# Body\n');
			const data = yield* MarkdownFrontmatter.schema(Meta, JsonFrontmatter)(document);
			assert.deepStrictEqual(data, { title: "Hello", count: 2 });
		}),
	);

	it.effect("fails typed with FrontmatterMissingError reason absent when the source has no block", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("# Just a heading\n");
			const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
			assert.strictEqual(error._tag, "FrontmatterMissingError");
			assert.instanceOf(error, FrontmatterMissingError);
			// Capture was ON here — the source genuinely carries no block.
			assert.strictEqual(error.reason, "absent");
		}),
	);

	it.effect("a fenced document parsed with capture off reports missing with reason captureDisabled", () =>
		Effect.gen(function* () {
			const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n---\n");
			const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
			assert.strictEqual(error._tag, "FrontmatterMissingError");
			assert.instanceOf(error, FrontmatterMissingError);
			// The distinction this reason exists for: the source visibly opens
			// with a frontmatter block, but the parse ran with the toggle off.
			assert.strictEqual(error.reason, "captureDisabled");
		}),
	);

	it.effect("an unclosed fence is not frontmatter, so the reason is absent", () =>
		Effect.gen(function* () {
			// An opening fence with no close IS a thematic break plus content —
			// parsing with capture ON would capture nothing either, so
			// captureDisabled would be a lie here.
			const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n\n# Body\n");
			const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
			assert.instanceOf(error, FrontmatterMissingError);
			assert.strictEqual(error.reason, "absent");
		}),
	);

	it.effect("propagates the codec's format mismatch error", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc('+++\ntitle = "Hello"\ncount = 2\n+++\n');
			const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
			assert.strictEqual(error._tag, "FrontmatterFormatMismatchError");
		}),
	);

	it.effect("propagates the codec's decode error for unparseable content", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("---\n: [\n---\n");
			const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
			assert.strictEqual(error._tag, "FrontmatterDecodeError");
		}),
	);

	it.effect("fails typed with FrontmatterValidationError carrying the structured issue", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("---\ntitle: 42\ncount: 2\n---\n");
			const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
			assert.strictEqual(error._tag, "FrontmatterValidationError");
			assert.instanceOf(error, FrontmatterValidationError);
			// The issue is the structured v4 issue tree, never a string.
			assert.isObject(error.issue);
			const issue = error.issue;
			if (!P.isObject(issue)) assert.fail("expected a structured issue");
			assert.isString(issue._tag);
		}),
	);
});

describe("MarkdownDocument.frontmatter", () => {
	it.effect("returns the captured node when frontmatter was parsed", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("---\ntitle: Hello\n---\n\nbody\n");
			const node = document.frontmatter;
			assert.isDefined(node);
			assert.strictEqual(node?.type, "frontmatter");
			assert.strictEqual(node?.format, "yaml");
			// Task 1 pinned capture semantics: the value carries the raw text
			// between the fences without the final line terminator.
			assert.strictEqual(node?.value, "title: Hello");
			assert.strictEqual(node, document.root.children[0]);
		}),
	);

	it.effect("is undefined when the document has no frontmatter", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("# Heading\n");
			assert.isUndefined(document.frontmatter);
		}),
	);

	it.effect("is undefined for a fenced document parsed with capture off", () =>
		Effect.gen(function* () {
			const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n---\n");
			assert.isUndefined(document.frontmatter);
		}),
	);
});

describe("MarkdownDocument.hasFrontmatterBlock", () => {
	it.effect("is true for a fenced document parsed with capture off — the disambiguating signal", () =>
		Effect.gen(function* () {
			const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n---\n\nbody\n");
			// The pair the accessor alone cannot distinguish: no capture node,
			// but the source structurally opens with a frontmatter block.
			assert.isUndefined(document.frontmatter);
			assert.isTrue(document.hasFrontmatterBlock);
		}),
	);

	it.effect("is true when the block was captured too — it reads the source, not the parse options", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("---\ntitle: Hello\n---\n\nbody\n");
			assert.isDefined(document.frontmatter);
			assert.isTrue(document.hasFrontmatterBlock);
		}),
	);

	it.effect("recognizes the whole closed fence grammar: toml and json fences", () =>
		Effect.gen(function* () {
			const toml = yield* MarkdownDocument.parse('+++\ntitle = "Hello"\n+++\n');
			assert.isTrue(toml.hasFrontmatterBlock);
			const json = yield* MarkdownDocument.parse('---json\n{ "title": "Hello" }\n---\n');
			assert.isTrue(json.hasFrontmatterBlock);
		}),
	);

	it.effect("is false when the source has no block", () =>
		Effect.gen(function* () {
			const document = yield* MarkdownDocument.parse("# Heading\n");
			assert.isFalse(document.hasFrontmatterBlock);
		}),
	);

	it.effect("is false for an unclosed fence — an opening fence with no close is not frontmatter", () =>
		Effect.gen(function* () {
			const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n\n# Body\n");
			assert.isFalse(document.hasFrontmatterBlock);
		}),
	);

	it.effect("is false for a fence below the head of the document", () =>
		Effect.gen(function* () {
			const document = yield* MarkdownDocument.parse("intro\n\n---\ntitle: Hello\n---\n");
			assert.isFalse(document.hasFrontmatterBlock);
		}),
	);
});

describe("frontmatter round-trip property", () => {
	// Newline-free strings only — see the file header for why. The count stays
	// in the 32-bit range every frontmatter codec represents exactly.
	const Scalar = S.String.check(S.makeFilter((s) => !s.includes("\n") && !s.includes("\r")));
	const MetaArb = S.Struct({
		title: Scalar,
		count: S.Int.check(S.isBetween({ minimum: -(2 ** 31), maximum: 2 ** 31 - 1 })),
	});

	/** Fence a stringified block, normalizing a missing trailing newline. */
	const fenced = (open: string, block: string, close: string): string =>
		`${open}\n${block}${block.endsWith("\n") ? "" : "\n"}${close}\n\nbody\n`;

	const decodeVia = (
		source: string,
		codec: typeof YamlFrontmatter,
	): { readonly title: string; readonly count: number } =>
		Effect.runSync(Effect.flatMap(parseDoc(source), (document) => MarkdownFrontmatter.schema(Meta, codec)(document)));

	it.prop(
		"yaml: stringify, parse and decode recovers the data",
		[MetaArb],
		([data]) => {
			const block = Effect.runSync(Yaml.stringify(data));
			assert.deepStrictEqual(decodeVia(fenced("---", block, "---"), YamlFrontmatter), data);
		},
		{ arbitrary: { runs: 60 } },
	);

	it.prop(
		"toml: stringify, parse and decode recovers the data",
		[MetaArb],
		([data]) => {
			const block = Effect.runSync(Toml.stringify(data));
			assert.deepStrictEqual(decodeVia(fenced("+++", block, "+++"), TomlFrontmatter), data);
		},
		{ arbitrary: { runs: 60 } },
	);

	it.prop(
		"json: stringify, parse and decode recovers the data",
		[MetaArb],
		([data]) => {
			const block = Effect.runSync(Jsonc.stringify(data));
			assert.deepStrictEqual(decodeVia(fenced("---json", block, "---"), JsonFrontmatter), data);
		},
		{ arbitrary: { runs: 60 } },
	);
});
