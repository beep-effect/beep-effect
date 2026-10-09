import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ManagedDocument, ManagedDocumentError } from "../../effected/github-actions/ManagedDocument.ts";

const NS = "savvy-web";
const KEY = "release-validation";

const fresh = (): ManagedDocument => Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY }));

const apply = (
	doc: ManagedDocument,
	entries: ReadonlyArray<readonly [key: string, content: string, meta?: Readonly<Record<string, string>>]>,
): ManagedDocument => Result.getOrThrow(doc.withRegionsResult(entries));

const failureOf = (result: Result.Result<ManagedDocument, ManagedDocumentError>): ManagedDocumentError => {
	if (Result.isFailure(result)) {
		return result.failure;
	}
	return assert.fail("expected a typed failure");
};

const marker = (kind: "BEGIN" | "END", region: string): string =>
	`<!-- --- ${kind} ${NS}.${KEY}.${region} MANAGED REGION --- -->`;

describe("ManagedDocument", () => {
	describe("create-or-update", () => {
		it("a fresh document gains its regions and exactly one sentinel", () => {
			const doc = apply(fresh(), [
				["header", "## Validating Release"],
				["body", ""],
				["footer", "generated"],
			]);
			assert.include(doc.text, marker("BEGIN", "header"));
			assert.include(doc.text, marker("END", "footer"));
			assert.strictEqual(doc.text.split(doc.sentinel).length - 1, 1, "exactly one sentinel");
			assert.deepStrictEqual(doc.region("header"), O.some("## Validating Release"));
			assert.deepStrictEqual(doc.region("body"), O.some(""));
			assert.deepStrictEqual(doc.region("missing"), O.none());
		});

		it("re-parsing rendered text reads the same regions back — no branch on existence", () => {
			const first = apply(fresh(), [["header", "v1"]]);
			const reread = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: first.text }));
			assert.deepStrictEqual(reread.region("header"), O.some("v1"));
			assert.deepStrictEqual(
				reread.regions.map((entry) => entry.key),
				["header"],
			);
		});

		it("applying identical regions is byte-identical — the compare-and-skip contract", () => {
			const doc = apply(fresh(), [
				["header", "same"],
				["footer", "same too"],
			]);
			const again = apply(doc, [
				["header", "same"],
				["footer", "same too"],
			]);
			assert.strictEqual(again.text, doc.text);
		});
	});

	describe("replacement, never appending", () => {
		it("a second application replaces the region in place", () => {
			const v1 = apply(fresh(), [["header", "state: pass"]]);
			const v2 = apply(v1, [["header", "state: fail"]]);
			assert.deepStrictEqual(v2.region("header"), O.some("state: fail"));
			assert.notInclude(v2.text, "state: pass", "the stale render must be gone");
			assert.strictEqual(v2.text.split(marker("BEGIN", "header")).length - 1, 1, "one region, not two");
		});

		it("regions not named in a call are left exactly as they are", () => {
			const both = apply(fresh(), [
				["header", "the table"],
				["footer", "the run link"],
			]);
			const updated = apply(both, [["header", "the NEW table"]]);
			assert.deepStrictEqual(updated.region("header"), O.some("the NEW table"));
			assert.deepStrictEqual(updated.region("footer"), O.some("the run link"));
		});
	});

	describe("human content", () => {
		it("bytes outside managed regions survive regeneration", () => {
			const seeded = apply(fresh(), [["notes", "generated notes"]]);
			const edited = `A human wrote this line.\n\n${seeded.text}\nAnd this trailing thought.`;
			const doc = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: edited }));
			const regenerated = apply(doc, [["notes", "regenerated notes"]]);
			assert.include(regenerated.text, "A human wrote this line.");
			assert.include(regenerated.text, "And this trailing thought.");
			assert.deepStrictEqual(regenerated.region("notes"), O.some("regenerated notes"));
		});

		it("a hand-written body without a sentinel is adopted, not clobbered", () => {
			const human = "This PR body was written by a person.";
			const doc = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: human }));
			const managed = apply(doc, [["squash", "```proposed-squash-commit\nrelease: 2.0.0\n```"]]);
			assert.include(managed.text, human);
			assert.include(managed.text, doc.sentinel);
			assert.deepStrictEqual(managed.region("squash"), O.some("```proposed-squash-commit\nrelease: 2.0.0\n```"));
		});

		it("another document's regions in the same text are preserved and never reported", () => {
			const foreign = [
				"<!-- --- BEGIN other-tool.status.header MANAGED REGION --- -->",
				"someone else's block",
				"<!-- --- END other-tool.status.header MANAGED REGION --- -->",
			].join("\n");
			const doc = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: foreign }));
			assert.deepStrictEqual(doc.regions, []);
			const ours = apply(doc, [["header", "our block"]]);
			assert.include(ours.text, "someone else's block");
			assert.deepStrictEqual(ours.region("header"), O.some("our block"));
		});

		it("a CRLF document stays CRLF", () => {
			const crlf = "human first line\r\nhuman second line\r\n";
			const doc = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: crlf }));
			const managed = apply(doc, [["header", "row one"]]);
			assert.include(managed.text, "human first line\r\nhuman second line");
			assert.include(managed.text, `${marker("BEGIN", "header")}\r\n`);
		});
	});

	describe("typed refusals — every kind fires", () => {
		it("unterminatedRegion", () => {
			const text = `${marker("BEGIN", "header")}\ncontent`;
			const error = failureOf(ManagedDocument.parseResult({ namespace: NS, key: KEY, text }));
			assert.strictEqual(error.kind, "unterminatedRegion");
			assert.strictEqual(error.line, 1);
		});

		it("orphanedEnd", () => {
			const error = failureOf(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: marker("END", "x") }));
			assert.strictEqual(error.kind, "orphanedEnd");
		});

		it("overlappingRegions", () => {
			const text = [marker("BEGIN", "a"), marker("BEGIN", "b"), marker("END", "a"), marker("END", "b")].join("\n");
			const error = failureOf(ManagedDocument.parseResult({ namespace: NS, key: KEY, text }));
			assert.strictEqual(error.kind, "overlappingRegions");
		});

		it("duplicateRegion", () => {
			const block = [marker("BEGIN", "a"), "x", marker("END", "a")].join("\n");
			const error = failureOf(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: `${block}\n${block}` }));
			assert.strictEqual(error.kind, "duplicateRegion");
		});

		it("markerInContent — content that would move a region boundary is refused", () => {
			const error = failureOf(fresh().withRegionsResult([["body", marker("END", "body")]]));
			assert.strictEqual(error.kind, "markerInContent");
			assert.strictEqual(error.key, "body", "the key is the consumer's region key, not the wire key");
		});

		it("duplicateDeclaration — two intentions for one region in one call", () => {
			const error = failureOf(
				fresh().withRegionsResult([
					["header", "first"],
					["header", "second"],
				]),
			);
			assert.strictEqual(error.kind, "duplicateDeclaration");
			assert.strictEqual(error.key, "header");
		});

		it("every kind renders a message naming the region", () => {
			const error = ManagedDocumentError.make({ kind: "markerInContent", key: "body" });
			assert.include(error.message, 'region "body"');
			const structural = ManagedDocumentError.make({ kind: "unterminatedRegion", line: 3 });
			assert.include(structural.message, "line 3");
		});
	});

	describe("region metadata", () => {
		it("meta round-trips verbatim through triples, regions and entry", () => {
			const meta = { at: "2024-01-01T00:00:00Z", runId: "42" };
			const doc = apply(fresh(), [["header", "the table", meta]]);
			assert.deepStrictEqual(
				doc.regions.map((region) => ({ key: region.key, meta: region.meta })),
				[{ key: "header", meta }],
			);
			assert.deepStrictEqual(doc.entry("header"), O.some({ content: "the table", meta }));
			assert.deepStrictEqual(doc.entry("missing"), O.none());
			// Addressability is untouched: content-only reads see the same region.
			assert.deepStrictEqual(doc.region("header"), O.some("the table"));
			// And a re-parse of the rendered text reads the same metadata back.
			const reread = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: doc.text }));
			assert.deepStrictEqual(reread.entry("header"), O.some({ content: "the table", meta }));
		});

		it("a two-tuple keeps today's behavior exactly, reporting empty meta", () => {
			const doc = apply(fresh(), [["header", "plain"]]);
			assert.include(doc.text, marker("BEGIN", "header"));
			assert.deepStrictEqual(doc.entry("header"), O.some({ content: "plain", meta: {} }));
			// A triple with empty meta renders the identical document.
			const withEmpty = apply(fresh(), [["header", "plain", {}]]);
			assert.strictEqual(withEmpty.text, doc.text);
		});

		it("meta survives a write by a party that does not know about it", () => {
			const meta = { owner: "run-a" };
			const seeded = apply(fresh(), [
				["header", "the table", meta],
				["footer", "the link"],
			]);
			// A later caller updates ONLY the footer, never mentioning metadata.
			const updated = apply(seeded, [["footer", "the NEW link"]]);
			assert.deepStrictEqual(updated.entry("header"), O.some({ content: "the table", meta }));
			assert.deepStrictEqual(updated.region("footer"), O.some("the NEW link"));
		});

		it("applying identical triples is byte-identical — suppression holds with meta", () => {
			const meta = { at: "2024-01-01T00:00:00Z", runId: "42" };
			const doc = apply(fresh(), [["header", "same", meta]]);
			const again = apply(doc, [["header", "same", meta]]);
			assert.strictEqual(again.text, doc.text);
		});

		it("invalidAttribute — a bad meta name fails typed, naming region and attribute", () => {
			const error = failureOf(fresh().withRegionsResult([["header", "x", { "bad name": "v" }]]));
			assert.strictEqual(error.kind, "invalidAttribute");
			assert.strictEqual(error.key, "header", "the key is the consumer's region key, not the wire key");
			assert.strictEqual(error.attribute, "bad name");
			assert.include(error.message, 'attribute "bad name"');
		});

		it("invalidAttribute — a value carrying a quote or a line break fails typed", () => {
			for (const value of ['say "hi"', "one\ntwo"]) {
				const error = failureOf(fresh().withRegionsResult([["header", "x", { note: value }]]));
				assert.strictEqual(error.kind, "invalidAttribute");
				assert.strictEqual(error.attribute, "note");
			}
		});
	});

	describe("sentinel", () => {
		it("matches the CommentMarker rendering for the same namespace and key", () => {
			// PullRequestComment.upsert appends `<!-- namespace:key -->`; the
			// document primitive must agree on the spelling, or the comment the
			// reconciler writes stops being findable by the marker that owns it.
			assert.strictEqual(fresh().sentinel, `<!-- ${NS}:${KEY} -->`);
			const doc = apply(fresh(), [["header", "x"]]);
			assert.isTrue(doc.matches(doc.text));
			assert.isFalse(doc.matches("no marker here"));
		});
	});

	describe("the Effect variants", () => {
		it.effect("parse and withRegions succeed through the Effect channel", () =>
			Effect.gen(function* () {
				const doc = yield* ManagedDocument.parse({ namespace: NS, key: KEY });
				const next = yield* doc.withRegions([["header", "v1"]]);
				assert.deepStrictEqual(next.region("header"), O.some("v1"));
				assert.isTrue(next.matches(next.text));
			}),
		);

		it.effect("both keep the TYPED error channel — a wrapper regression would defect instead", () =>
			Effect.gen(function* () {
				const parseError = yield* Effect.flip(
					ManagedDocument.parse({
						namespace: NS,
						key: KEY,
						text: `${marker("BEGIN", "header")}\nnever closed`,
					}),
				);
				assert.instanceOf(parseError, ManagedDocumentError);
				assert.strictEqual(parseError.kind, "unterminatedRegion");

				const doc = yield* ManagedDocument.parse({ namespace: NS, key: KEY });
				const applyError = yield* Effect.flip(doc.withRegions([["body", marker("BEGIN", "body")]]));
				assert.instanceOf(applyError, ManagedDocumentError);
				assert.strictEqual(applyError.kind, "markerInContent");
			}),
		);
	});

	describe("JSON Schema export", () => {
		it("namespace and key export their name-part pattern", () => {
			const document = S.toJsonSchemaDocument(ManagedDocument);
			for (const field of ["namespace", "key"]) {
				assert.nestedPropertyVal(
					document,
					`definitions.ManagedDocumentEncoded.properties.${field}.pattern`,
					"^[A-Za-z0-9][A-Za-z0-9_-]*$",
				);
			}
		});
	});
});
