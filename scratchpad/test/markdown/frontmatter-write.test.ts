// Coverage for the typed frontmatter write seam (`MarkdownFrontmatter.set` /
// `setToString`) and the codecs' `encode` members.
//
// The write side mirrors the decode seam: schema-ENCODE the typed data,
// serialize the encoded value through the codec, then splice — one
// whole-block replacement when a capture of the codec's format exists, one
// offset-0 insert when the document has none. The empty-object rulings are
// pinned per codec: yaml encodes `{}` to the flow mapping body `{}\n`
// (deliberately not an empty body, which would round-trip as `null`), toml
// encodes `{}` to the empty body (the mirror of its empty-capture decode
// ruling), json encodes `{}` to `{}`.
//
// Property strings are newline-free for the same reason the decode-side
// round-trip constrains them: a multi-line string could legally place a bare
// fence-closer at column zero inside the block, which the capture scanner
// rightly treats as the closing fence — fence semantics, not a codec defect.

import { assert, describe, it } from "@effect/vitest";
import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
	FrontmatterEncodeError,
	FrontmatterFormatMismatchError,
	FrontmatterValidationError,
	MarkdownFrontmatter,
} from "../../effected/markdown/Frontmatter.ts";
import { JsonFrontmatter } from "../../effected/markdown/JsonFrontmatter.ts";
import { MarkdownParseOptions } from "../../effected/markdown/Markdown.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import { MarkdownEdit } from "../../effected/markdown/MarkdownEdit.ts";
import { TomlFrontmatter } from "../../effected/markdown/TomlFrontmatter.ts";
import { YamlFrontmatter } from "../../effected/markdown/YamlFrontmatter.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

const withFrontmatter = MarkdownParseOptions.make({ frontmatter: true });
const parseDoc = (source: string) => MarkdownDocument.parse(source, withFrontmatter);

const Meta = S.Struct({
	title: S.String,
	count: S.Finite,
});

describe("codec encode", () => {
	it.effect("YamlFrontmatter.encode pins the empty object to the flow mapping body", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* YamlFrontmatter.encode({}), "{}\n");
		}),
	);

	it.effect("TomlFrontmatter.encode pins the empty object to the empty body", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* TomlFrontmatter.encode({}), "");
		}),
	);

	it.effect("JsonFrontmatter.encode pins the empty object to {}", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* JsonFrontmatter.encode({}), "{}");
		}),
	);

	it.effect("encode output is the body only — never fences", () =>
		Effect.gen(function* () {
			const yaml = yield* YamlFrontmatter.encode({ title: "Hi" });
			const toml = yield* TomlFrontmatter.encode({ title: "Hi" });
			const json = yield* JsonFrontmatter.encode({ title: "Hi" });
			assert.strictEqual(yaml, "title: Hi\n");
			assert.strictEqual(toml, 'title = "Hi"\n');
			assert.strictEqual(json, '{\n  "title": "Hi"\n}');
		}),
	);

	it.effect("a serialization failure is typed with the format package's error preserved structurally", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(JsonFrontmatter.encode({ big: BigInt(1) }));
			assert.instanceOf(error, FrontmatterEncodeError);
			assert.strictEqual(error._tag, "FrontmatterEncodeError");
			assert.strictEqual(error.format, "json");
			// The cause is the jsonc engine's typed stringify error, never a string.
			const cause = error.cause;
			if (!P.isObject(cause)) assert.fail("expected a structured cause");
			assert.strictEqual(cause._tag, "JsoncStringifyError");
		}),
	);
});

describe("MarkdownFrontmatter.set", () => {
	it.effect("replaces an existing yaml block with one edit and preserves the rest byte-identically", () =>
		Effect.gen(function* () {
			const source = "---\ntitle: Old\ncount: 1\n---\n\n# Body\n\ntext after the block\n";
			const document = yield* parseDoc(source);
			const node = document.frontmatter;
			assert.isDefined(node);
			const edits = yield* MarkdownFrontmatter.set(Meta, YamlFrontmatter)(document, { title: "New", count: 2 });
			assert.strictEqual(edits.length, 1);
			assert.strictEqual(edits[0]?.offset, 0);
			const updated = MarkdownEdit.applyAll(source, edits);
			// Everything after the closing fence survives byte-identical.
			assert.isTrue(updated.endsWith(source.slice(node?.position.end.offset ?? 0)));
			// The re-parsed document decodes the new data with the same tree shape.
			const reparsed = yield* parseDoc(updated);
			const data = yield* MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(reparsed);
			assert.deepStrictEqual(data, { title: "New", count: 2 });
			assert.deepStrictEqual(
				reparsed.root.children.map((child) => child.type),
				document.root.children.map((child) => child.type),
			);
		}),
	);

	it.effect("inserts a fenced block at offset 0 with a blank line when the document has none", () =>
		Effect.gen(function* () {
			const source = "# Body\n\ntext\n";
			const document = yield* parseDoc(source);
			const edits = yield* MarkdownFrontmatter.set(Meta, TomlFrontmatter)(document, { title: "Hi", count: 3 });
			assert.strictEqual(edits.length, 1);
			assert.strictEqual(edits[0]?.offset, 0);
			assert.strictEqual(edits[0]?.length, 0);
			const updated = MarkdownEdit.applyAll(source, edits);
			// The existing content survives byte-identical after the blank line.
			assert.isTrue(updated.endsWith(`\n\n${source}`));
			const reparsed = yield* parseDoc(updated);
			const data = yield* MarkdownFrontmatter.schema(Meta, TomlFrontmatter)(reparsed);
			assert.deepStrictEqual(data, { title: "Hi", count: 3 });
		}),
	);

	it.effect("a format mismatch fails typed and never switches fences", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc('+++\ntitle = "Old"\ncount = 1\n+++\n\nbody\n');
			const error = yield* Effect.flip(
				MarkdownFrontmatter.set(Meta, YamlFrontmatter)(document, { title: "New", count: 2 }),
			);
			assert.instanceOf(error, FrontmatterFormatMismatchError);
			assert.strictEqual(error.expected, "yaml");
			assert.strictEqual(error.actual, "toml");
		}),
	);

	it.effect(
		"schema-encode-invalid data fails typed with FrontmatterValidationError carrying the structured issue",
		() =>
			Effect.gen(function* () {
				const document = yield* parseDoc("# Body\n");
				const error = yield* Effect.flip(
					MarkdownFrontmatter.set(Meta, YamlFrontmatter)(document, deliberatelyInvalid<never>({ title: 42, count: "x" })),
				);
				assert.instanceOf(error, FrontmatterValidationError);
				// The issue is the structured v4 issue tree, never a string.
				assert.isObject(error.issue);
				const issue = error.issue;
				if (!P.isObject(issue)) assert.fail("expected a structured issue");
				assert.isString(issue._tag);
			}),
	);

	it.effect("a codec serialization failure propagates as FrontmatterEncodeError", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("# Body\n");
			const error = yield* Effect.flip(
				MarkdownFrontmatter.set(S.Unknown, JsonFrontmatter)(document, { big: BigInt(1) }),
			);
			assert.instanceOf(error, FrontmatterEncodeError);
			assert.strictEqual(error.format, "json");
		}),
	);
});

describe("MarkdownFrontmatter.setToString", () => {
	const Empty = S.Struct({});

	it.effect("pins the empty-object block per codec on an empty document", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("");
			assert.strictEqual(
				yield* MarkdownFrontmatter.setToString(Empty, YamlFrontmatter)(document, {}),
				"---\n{}\n---\n",
			);
			assert.strictEqual(yield* MarkdownFrontmatter.setToString(Empty, TomlFrontmatter)(document, {}), "+++\n+++\n");
			assert.strictEqual(
				yield* MarkdownFrontmatter.setToString(Empty, JsonFrontmatter)(document, {}),
				"---json\n{}\n---\n",
			);
		}),
	);

	it.effect("the empty-object block re-parses and decodes back to the empty object in every codec", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("");
			for (const codec of [YamlFrontmatter, TomlFrontmatter, JsonFrontmatter]) {
				const updated = yield* MarkdownFrontmatter.setToString(Empty, codec)(document, {});
				const reparsed = yield* parseDoc(updated);
				const data = yield* MarkdownFrontmatter.schema(Empty, codec)(reparsed);
				assert.deepStrictEqual(data, {});
			}
		}),
	);

	it.effect("writes the json block with its language-hint fence", () =>
		Effect.gen(function* () {
			const document = yield* parseDoc("body\n");
			const updated = yield* MarkdownFrontmatter.setToString(Meta, JsonFrontmatter)(document, {
				title: "Hi",
				count: 1,
			});
			assert.strictEqual(updated, '---json\n{\n  "title": "Hi",\n  "count": 1\n}\n---\n\nbody\n');
		}),
	);
});

describe("frontmatter write round-trip property", () => {
	// Newline-free strings only — see the file header for why. The count stays
	// in the 32-bit range every frontmatter codec represents exactly.
	const Scalar = S.String.check(S.makeFilter((s) => !s.includes("\n") && !s.includes("\r")));
	const MetaArb = S.Struct({
		title: Scalar,
		count: S.Int.check(S.isBetween({ minimum: -(2 ** 31), maximum: 2 ** 31 - 1 })),
	});
	const bodyDoc = "# Title\n\nsome *emphasis* text\n";

	const insertRoundTrip = (
		codec: typeof YamlFrontmatter,
		data: { readonly title: string; readonly count: number },
	): { readonly title: string; readonly count: number } =>
		Effect.runSync(
			Effect.gen(function* () {
				const document = yield* parseDoc(bodyDoc);
				const updated = yield* MarkdownFrontmatter.setToString(Meta, codec)(document, data);
				// The pre-existing content survives byte-identical.
				assert.isTrue(updated.endsWith(`\n\n${bodyDoc}`));
				const reparsed = yield* parseDoc(updated);
				return yield* MarkdownFrontmatter.schema(Meta, codec)(reparsed);
			}),
		);

	it.prop(
		"yaml: set then re-parse then decode recovers the data",
		[MetaArb],
		([data]) => {
			assert.deepStrictEqual(insertRoundTrip(YamlFrontmatter, data), data);
		},
		{ arbitrary: { runs: 60 } },
	);

	it.prop(
		"toml: set then re-parse then decode recovers the data",
		[MetaArb],
		([data]) => {
			assert.deepStrictEqual(insertRoundTrip(TomlFrontmatter, data), data);
		},
		{ arbitrary: { runs: 60 } },
	);

	it.prop(
		"json: set then re-parse then decode recovers the data",
		[MetaArb],
		([data]) => {
			assert.deepStrictEqual(insertRoundTrip(JsonFrontmatter, data), data);
		},
		{ arbitrary: { runs: 60 } },
	);

	const fenced = `---\ntitle: Old\ncount: 0\n---\n\n${bodyDoc}`;
	it.prop(
		"yaml: replacing an existing block preserves the suffix byte-for-byte and recovers the data",
		[MetaArb],
		([data]) => {
			const result = Effect.runSync(
				Effect.gen(function* () {
					const document = yield* parseDoc(fenced);
					const updated = yield* MarkdownFrontmatter.setToString(Meta, YamlFrontmatter)(document, data);
					assert.isTrue(updated.endsWith(`\n\n${bodyDoc}`));
					const reparsed = yield* parseDoc(updated);
					return yield* MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(reparsed);
				}),
			);
			assert.deepStrictEqual(result, data);
		},
		{ arbitrary: { runs: 60 } },
	);
});
