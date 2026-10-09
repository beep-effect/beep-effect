import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import { canonicalize, sign } from "../../effected/github-actions/internal/sigv4.ts";

const credentials = { accessKeyId: "AK", secretAccessKey: "SK", region: "us-east-1", service: "s3" };
const request = {
	method: "GET",
	host: "example.test",
	headers: { "z-last": "one", "a-first": "  two\t words  " },
	body: new Uint8Array(0),
	now: DateTime.toDateUtc(DateTime.makeUnsafe("2024-01-01T00:00:00Z")),
};

describe("SigV4 raw paths", () => {
	it("encodes reserved characters once and preserves every empty path segment", () => {
		for (const [raw, encoded] of [
			["bucket/a#b", "/bucket/a%23b"],
			["bucket/a?b", "/bucket/a%3Fb"],
			["bucket/a%2Fb", "/bucket/a%252Fb"],
			["bucket/a//b", "/bucket/a//b"],
			["bucket/folder/", "/bucket/folder/"],
			["/bucket/a//b/", "/bucket/a//b/"],
			["//bucket///", "//bucket///"],
			["", "/"],
			["/", "/"],
		] as const) {
			assert.strictEqual(canonicalize({ ...request, path: raw }, credentials).canonicalRequest.split("\n")[1], encoded);
		}
	});

	it("adds only the initial slash and does not change a leading slash already present", () => {
		const raw = canonicalize({ ...request, path: "bucket/a#b?c%2Fd//" }, credentials);
		const rooted = canonicalize({ ...request, path: "/bucket/a#b?c%2Fd//" }, credentials);
		assert.strictEqual(raw.canonicalRequest, rooted.canonicalRequest);
		assert.strictEqual(raw.canonicalRequest.split("\n")[1], "/bucket/a%23b%3Fc%252Fd//");
	});

	it("pins canonical header order, whitespace normalization and signature bytes", () => {
		const input = { ...request, path: "bucket/a#b?c%2Fd//" };
		const canonical = canonicalize(input, credentials);
		assert.strictEqual(canonical.signedHeaders, "a-first;host;x-amz-content-sha256;x-amz-date;z-last");
		assert.include(canonical.canonicalRequest, "a-first:two words\nhost:example.test\n");
		assert.strictEqual(sign(input, credentials).authorization,
			"AWS4-HMAC-SHA256 Credential=AK/20240101/us-east-1/s3/aws4_request, SignedHeaders=a-first;host;x-amz-content-sha256;x-amz-date;z-last, Signature=1dab5fb81569aa1efc80c9b15f099f3e293aadf4c41c867117580008059d8ea5");
		assert.strictEqual(sign({ ...input, headers: { "a-first": "  two\t words  ", "z-last": "one" } }, credentials).authorization, sign(input, credentials).authorization);
	});

	it("pins different signatures for keys differing only by an empty segment", () => {
		for (const [path, signature] of [
			["bucket/a/b", "c62a8dadc8ce3a938a0eb5befa73ac71358d8fc2d6daa3f5d71d162fca8b0a09"],
			["bucket/a//b", "26fab560ef7f68fb61215c4e178b6fa8e4c537ea2abbde357d095c8bd1173e04"],
			["bucket/folder/", "fa93adda07dc0c16ef4e60154df68dda983f892f8a447847175dc078ea423a65"],
		] as const) {
			assert.include(sign({ ...request, path }, credentials).authorization ?? "", `Signature=${signature}`);
		}
	});
});
