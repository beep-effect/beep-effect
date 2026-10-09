import { assert, describe, it } from "@effect/vitest";
import { Option } from "effect";
import type { BareLineReference, ClosingKeyword, IssueReference } from "../../effected/github/index.ts";
import { CLOSING_KEYWORDS, harvestIssueReferences, parseBareLineReference } from "../../effected/github/index.ts";

/**
 * The issue-reference grammar moved to `@effected/github-references`
 * (effected#399). This package's entrypoint re-exports the six moved names so
 * existing consumers keep working; this suite is that promise, as a test.
 */
describe("IssueReferences compatibility re-exports", () => {
	it("the three value exports still work from the entrypoint", () => {
		assert.deepStrictEqual(
			[...CLOSING_KEYWORDS],
			["close", "closes", "closed", "fix", "fixes", "fixed", "resolve", "resolves", "resolved"],
		);
		assert.strictEqual(harvestIssueReferences("fixes #12")[0]?.issueNumber, 12);
		assert.strictEqual(Option.getOrThrow(parseBareLineReference("Closes: #7")).issueNumber, 7);
	});

	it("the three type exports still resolve from the entrypoint", () => {
		// Compiling is the assertion: each moved type annotates a value.
		const keyword: ClosingKeyword = "fixes";
		const inline: IssueReference | undefined = harvestIssueReferences(`${keyword} #1`)[0];
		const bare: Option.Option<BareLineReference> = parseBareLineReference(`${keyword} #1`);
		assert.strictEqual(inline?.keyword, keyword);
		assert.strictEqual(Option.getOrThrow(bare).keyword, keyword);
	});
});
