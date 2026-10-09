import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PageOptions } from "../../effected/github/Rest.ts";
import type { Data } from "../../effected/github/Rest.ts";
import { repositoryFixture } from "./fixtures.ts";

describe("Rest.Data", () => {
	it("preserves bodyful and bodyless successful payloads for a route union", () => {
		type Payload = Data<"GET /repos/{owner}/{repo}" | "DELETE /repos/{owner}/{repo}">;
		const bodyful: Payload = repositoryFixture({ full_name: "acme/widget" });
		const bodyless: Payload = "";
		const exact: [Payload] extends [Data<"GET /repos/{owner}/{repo}"> | ""]
			? ([Data<"GET /repos/{owner}/{repo}"> | ""] extends [Payload] ? true : never)
			: never = true;
		assert.isTrue(exact);
		assert.strictEqual(bodyful.full_name, "acme/widget");
		assert.strictEqual(bodyless, "");
	});
});

describe("PageOptions", () => {
	it("accepts a page size inside GitHub's range", () => {
		assert.strictEqual(PageOptions.make({ perPage: 1 }).perPage, 1);
		assert.strictEqual(PageOptions.make({ perPage: 100 }).perPage, 100);
	});

	it("refuses a page size above GitHub's ceiling", () => {
		// GitHub silently caps at 100, so a caller asking for 250 already has
		// arithmetic that is wrong. Failing here is cheaper than in production.
		assert.throws(() => PageOptions.make({ perPage: 250 }));
	});

	it("refuses a zero or negative page size", () => {
		assert.throws(() => PageOptions.make({ perPage: 0 }));
		assert.throws(() => PageOptions.make({ perPage: -1 }));
	});

	it("refuses a fractional page size", () => {
		assert.throws(() => PageOptions.make({ perPage: 2.5 }));
	});

	it("refuses a zero page budget", () => {
		assert.throws(() => PageOptions.make({ maxPages: 0 }));
	});

	it("allows both fields to be absent", () => {
		const options = PageOptions.make({});
		assert.strictEqual(options.perPage, undefined);
		assert.strictEqual(options.maxPages, undefined);
	});

	it.effect("surfaces an out-of-range page size as a SchemaError when decoded", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(S.decodeEffect(PageOptions)({ perPage: 101 }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it("all reads full pages with no page bound", () => {
		assert.strictEqual(PageOptions.all.perPage, 100);
		assert.strictEqual(PageOptions.all.maxPages, undefined);
	});

	it("first bounds the walk to a single page", () => {
		const options = PageOptions.first(5);
		assert.strictEqual(options.perPage, 5);
		assert.strictEqual(options.maxPages, 1);
	});
});
