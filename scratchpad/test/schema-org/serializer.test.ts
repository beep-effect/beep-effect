import { assert, describe, it } from "@effect/vitest";
import * as Result from "effect/Result";
import { JsonLdDocument } from "../../effected/schema-org/JsonLdDocument.ts";
import { NodeRef } from "../../effected/schema-org/NodeRef.ts";
import { Person } from "../../effected/schema-org/Person.ts";
import { SoftwareSourceCode } from "../../effected/schema-org/SoftwareSourceCode.ts";
import { TechArticle } from "../../effected/schema-org/TechArticle.ts";

/**
 * The payload is the real attack, not a sanitized stand-in: a `</script>` that
 * closes the JSON-LD block, followed by markup that runs. The trailing generic
 * is the innocent case that must survive unharmed — TSDoc is full of `<T>`.
 */
const HOSTILE_DESCRIPTION =
	"A summary containing </script><img src=x onerror=alert(1)> and a `<T>` generic, A &amp; B, and Foo & Bar";

const buildOrThrow = (nodes: Parameters<typeof JsonLdDocument.buildResult>[0]): JsonLdDocument => {
	const built = JsonLdDocument.buildResult(nodes);
	assert.isTrue(Result.isSuccess(built), "fixture graph should build");
	return (built as Extract<typeof built, { readonly _tag: "Success" }>).success;
};

/**
 * The alphabet deliberately includes the characters the serializer is
 * obliged to escape plus the ones a fidelity generator must not silently
 * exclude: C0 controls, a lone surrogate, newlines and quote characters.
 */
const ALPHABET = [
	"<",
	">",
	"&",
	"</script>",
	'"',
	"\\",
	"\u0000",
	"\u001F",
	"\u007F",
	"\n",
	"\r",
	"\t",
	"\ud800",
	" ",
	" ",
	"a",
	" ",
	"—",
	"🙂",
];

const sample = (seed: number): string => {
	let value = "";
	let state = seed;
	for (let index = 0; index < 12; index += 1) {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		value += ALPHABET[state % ALPHABET.length];
	}
	return value;
};

const hostileGraph = (): JsonLdDocument =>
	buildOrThrow([
		TechArticle.make({
			"@id": "https://example.com/docs#intro",
			headline: "Getting started",
			description: HOSTILE_DESCRIPTION,
		}),
	]);

describe("script embedding", () => {
	it("escapes every character that could terminate the element", () => {
		const body = hostileGraph().toScriptBody();

		// The strongest available form of the assertion: escaping makes it
		// literally true of the whole string, so there is no need to hunt for
		// specific dangerous substrings.
		assert.notInclude(body, "<", "no < may survive in a script body");
		assert.notInclude(body, ">", "no > may survive in a script body");
		assert.notInclude(body, "&", "no & may survive in a script body");
	});

	it("cannot be closed from inside", () => {
		const body = hostileGraph().toScriptBody();

		assert.notMatch(body, /<\/script/i, "the element must be unclosable from within its own body");
		assert.notMatch(body, /<!--/, "an HTML comment open must not survive either");
	});

	it("is lossless: the escaped body parses back to the original string", () => {
		const body = hostileGraph().toScriptBody();
		const parsed = JSON.parse(body) as { readonly "@graph": ReadonlyArray<{ readonly description: string }> };

		assert.strictEqual(
			parsed["@graph"][0]?.description,
			HOSTILE_DESCRIPTION,
			"escaping must not change the value a parser sees",
		);
	});

	/**
	 * The positive control, and the assertion that makes the other three mean
	 * anything. Without it they all pass against an empty graph, a stubbed
	 * serializer, or a fixture whose payload was sanitized somewhere upstream.
	 *
	 * It also pins the hazard itself: if a future `JSON.stringify` ever escaped
	 * these by default, this test tells us rather than quietly going vacuous.
	 */
	it("positive control: JSON.stringify of the same graph DOES carry the hazard", () => {
		const graph = hostileGraph();

		const unsafe = JSON.stringify(graph.toJsonLd());

		assert.include(unsafe, "</script>", "the hazard must be real, or the escaping test proves nothing");
		assert.include(unsafe, "<img src=x", "the injected markup must be present in the unescaped form");
		assert.include(unsafe, "&", "the fixture must carry an ampersand, or the & escape is untested");
		assert.notStrictEqual(unsafe, graph.toScriptBody(), "the safe and unsafe forms must actually differ");
	});

	it("leaves innocent content readable", () => {
		const graph = buildOrThrow([Person.make({ "@id": "https://example.com/#alice", name: "Alice" })]);

		const body = graph.toScriptBody();

		assert.include(body, "Alice", "ordinary text must not be mangled");
		assert.deepStrictEqual(JSON.parse(body), graph.toJsonLd(), "the body must parse back to the wire value");
	});

	it("escapes hostile content wherever it appears, not only in descriptions", () => {
		const graph = buildOrThrow([
			SoftwareSourceCode.make({
				"@id": "https://example.com/pkg#source",
				name: "</script>",
				keywords: ["</script>", "safe"],
				additional: { alternateName: "</script>" },
			}),
		]);

		const body = graph.toScriptBody();

		assert.notInclude(body, "<", "a typed scalar, an array member and a catch-all value must all be escaped");
		const parsed = JSON.parse(body) as {
			readonly "@graph": ReadonlyArray<{
				readonly name: string;
				readonly keywords: ReadonlyArray<string>;
				readonly alternateName: string;
			}>;
		};
		const node = parsed["@graph"][0];
		assert.strictEqual(node?.name, "</script>");
		assert.deepStrictEqual(node?.keywords, ["</script>", "safe"]);
		assert.strictEqual(node?.alternateName, "</script>", "flattened catch-all values must round-trip too");
	});

	it("escaping is stable under repetition", () => {
		const graph = hostileGraph();

		assert.strictEqual(graph.toScriptBody(), graph.toScriptBody(), "serialization must be deterministic");
	});
});

/**
 * A consumer that layers its own escaping over this output must not double-
 * escape. `@tsdoctor/seo` adopted this exact three-character set and runs its
 * pass unconditionally over output that already came from `toScriptBody`.
 *
 * That is safe, and the reason is narrow enough to be worth pinning rather than
 * inferring: the escape's *output* contains none of the three characters its
 * *input* matches on, so a second pass matches nothing. A plausible future
 * change breaks it — switching to HTML entity form (`&lt;`) would still be
 * correct escaping and would no longer be idempotent, because `&lt;` contains
 * an `&` the next pass would rewrite to `&amp;lt;`.
 */
describe("script embedding — idempotence, which a consumer now depends on", () => {
	/** A consumer-side escaper: the same three characters, applied independently. */
	const consumerEscape = (text: string): string =>
		text.replace(/[<>&]/g, (char) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" })[char] ?? char);

	it("a second escaping pass over the body is a no-op", () => {
		const body = hostileGraph().toScriptBody();

		assert.strictEqual(consumerEscape(body), body, "a consumer layering its own escaping must not double-escape");
	});

	it("stays a no-op over the hostile alphabet, not just the fixture", () => {
		for (let seed = 0; seed < 400; seed += 1) {
			const body = buildOrThrow([
				TechArticle.make({ "@id": "https://example.com/#a", description: sample(seed) }),
			]).toScriptBody();

			assert.strictEqual(consumerEscape(body), body, `second pass must be a no-op for seed ${seed}`);
		}
	});

	it("the reason it holds: the output contains none of the characters the escape matches", () => {
		// This is the property a future change breaks FIRST — before any
		// round-trip or injection assertion notices — so it is asserted on its
		// own rather than left as an inference from the tests above.
		const body = hostileGraph().toScriptBody();

		for (const char of ["<", ">", "&"]) {
			assert.notInclude(body, char, `an escape emitting ${char} would not be idempotent`);
		}
	});

	it("layering the consumer's pass still round-trips to the original value", () => {
		const doubled = consumerEscape(hostileGraph().toScriptBody());

		const parsed = JSON.parse(doubled) as { readonly "@graph": ReadonlyArray<{ readonly description: string }> };
		assert.strictEqual(parsed["@graph"][0]?.description, HOSTILE_DESCRIPTION, "a layered pass must not corrupt values");
	});
});

describe("script embedding — property", () => {
	it("never emits < > or & and always round-trips, over a hostile alphabet", () => {
		for (let seed = 0; seed < 400; seed += 1) {
			const description = sample(seed);
			const graph = buildOrThrow([TechArticle.make({ "@id": "https://example.com/#a", description })]);

			const body = graph.toScriptBody();

			assert.match(body, /^[^<>&]*$/u, `body must carry no < > & for seed ${seed}`);
			const parsed = JSON.parse(body) as { readonly "@graph": ReadonlyArray<{ readonly description: string }> };
			assert.strictEqual(parsed["@graph"][0]?.description, description, `must round-trip for seed ${seed}`);
		}
	});

	it("a reference id carrying hostile text is escaped as well", () => {
		const graph = buildOrThrow([
			TechArticle.make({
				"@id": "https://example.com/#a",
				isPartOf: [NodeRef.to("https://example.com/#</script>")],
			}),
		]);

		assert.notInclude(graph.toScriptBody(), "<", "an @id is a string like any other and must be escaped");
	});
});
