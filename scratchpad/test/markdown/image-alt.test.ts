// Regressions for the upstream image-alt flattening bug: leaf HTML and hard
// breaks must survive, for inline images and reference images in both dialects.
import { assert, describe, it } from "@effect/vitest";
import * as Result from "effect/Result";
import { Markdown } from "../../effected/markdown/Markdown.ts";

const descriptions = [
	{ name: "backslash hard break", source: "a\\\nb", alt: "a\nb" },
	{ name: "two-space hard break", source: "a  \nb", alt: "a\nb" },
	{ name: "raw tags", source: "a <b>c</b>", alt: "a <b>c</b>" },
	{ name: "unclosed raw tag", source: "a <b>c", alt: "a <b>c" },
	{ name: "raw comment", source: "a <!-- note -->c", alt: "a <!-- note -->c" },
];

describe("image alt leaf content", () => {
	for (const dialect of ["commonmark", "gfm"] as const) {
		for (const { name, source, alt } of descriptions) {
			for (const reference of [false, true]) {
				it(`${dialect}: ${name} in ${reference ? "a reference" : "an inline"} image`, () => {
					const markdown = reference ? `![${source}][ref]\n\n[ref]: /u\n` : `![${source}](/u)`;
					const result = Markdown.parseResult(markdown, { dialect });
					assert.isTrue(Result.isSuccess(result));
					if (Result.isFailure(result)) {
						return;
					}
					const [paragraph] = result.success.children;
					assert.strictEqual(paragraph?.type, "paragraph");
					if (paragraph?.type !== "paragraph") {
						return;
					}
					const [image] = paragraph.children;
					assert.strictEqual(paragraph.children.length, 1);
					assert.strictEqual(image?.type, reference ? "imageReference" : "image");
					if (image?.type === "image" || image?.type === "imageReference") {
						assert.strictEqual(image.alt, alt);
						if (image.type === "imageReference") {
							assert.strictEqual(image.identifier, "ref");
							assert.strictEqual(image.referenceType, "full");
						}
					}
				});
			}
		}
	}
});
