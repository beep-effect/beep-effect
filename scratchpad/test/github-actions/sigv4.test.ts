import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { canonicalize, sign, SigV4Credentials, SigV4Request } from "../../effected/github-actions/internal/sigv4.ts";

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

describe("SigV4 normalized transport headers", () => {
	it("replaces mixed-case Host and signing headers with exactly the signed values", () => {
		const input = {
			...request,
			path: "bucket/key",
			headers: {
				Host: "stale.example.test",
				"X-Amz-Date": "20000101T000000Z",
				"X-Amz-Content-Sha256": "stale-hash",
				"X-Amz-Security-Token": "stale-token",
				Authorization: "stale-authorization",
			},
		};
		const temporary = { ...credentials, sessionToken: "session-token" };
		const canonical = canonicalize(input, temporary);
		const signed = sign(input, temporary);
		const sent = new Headers(signed);
		assert.strictEqual(sent.get("host"), request.host);
		assert.strictEqual(sent.get("x-amz-date"), "20240101T000000Z");
		assert.strictEqual(sent.get("x-amz-security-token"), "session-token");
		assert.strictEqual(sent.get("x-amz-content-sha256"), canonical.headers["x-amz-content-sha256"]);
		assert.strictEqual(sent.get("authorization"), signed.authorization);
		assert.notProperty(signed, "Host");
		assert.notProperty(signed, "X-Amz-Date");
		assert.notProperty(signed, "Authorization");
		assert.notInclude(canonical.signedHeaders, "authorization");
		for (const [name, value] of Object.entries(canonical.headers)) {
			assert.strictEqual(sent.get(name), value);
			assert.include(canonical.canonicalRequest, `${name}:${value}\n`);
		}
		assert.strictEqual(signed.authorization, sign({ ...input, headers: {} }, temporary).authorization);
	});

	it("combines ordinary case collisions in transport order and signs the combined value", () => {
		const input = {
			...request,
			path: "bucket/key",
			headers: { "X-Test": "  first\t value  ", "x-test": " second  value ", "X-TEST": "third" },
		};
		const canonical = canonicalize(input, credentials);
		const signed = sign(input, credentials);
		const sent = new Headers(signed);
		assert.strictEqual(sent.get("x-test"), "first value, second value, third");
		assert.strictEqual(canonical.headers["x-test"], sent.get("x-test"));
		assert.include(canonical.canonicalRequest, "x-test:first value, second value, third\n");
		assert.strictEqual(canonical.signedHeaders, "host;x-amz-content-sha256;x-amz-date;x-test");
		assert.strictEqual(signed.authorization, sign({
			...input, headers: { "x-test": "first value, second value, third" },
		}, credentials).authorization);
		assert.strictEqual(canonicalize({ ...input, headers: canonical.headers }, credentials).canonicalRequest, canonical.canonicalRequest);
	});

	it("preserves endpoint escapes while encoding raw object segments once", () => {
		const canonical = canonicalize({
			...request,
			path: "cache/a%2Fb//?#",
			encodedPathPrefix: "/gateway%2ftenant/sp%20ace/%252F",
		}, credentials);
		assert.strictEqual(canonical.canonicalRequest.split("\n")[1], "/gateway%2ftenant/sp%20ace/%252F/cache/a%252Fb//%3F%23");
	});
});

describe("SigV4 executable contracts", () => {
	it.effect("keeps plain credential construction, free-form strings and optional explicit undefined", () =>
		Effect.gen(function* () {
			const plain: SigV4Credentials = { ...credentials, service: "custom-service", region: "", accessKeyId: "" };
			const decoded = yield* S.decodeEffect(SigV4Credentials)(plain);
			assert.deepStrictEqual(decoded, plain);
			assert.notProperty(decoded, "sessionToken");
			const explicit = yield* S.decodeEffect(SigV4Credentials)({ ...plain, sessionToken: undefined });
			assert.property(explicit, "sessionToken");
			assert.strictEqual(explicit.sessionToken, undefined);
			assert.isTrue(S.is(SigV4Credentials)({ ...plain, sessionToken: "" }));
			assert.isFalse(S.is(SigV4Credentials)({ ...plain, secretAccessKey: 123 }));
			assert.isFalse(S.is(SigV4Credentials)({ ...plain, sessionToken: null }));
		}),
	);

	it.effect("keeps request fields structural without coercion or added defaults", () =>
		Effect.gen(function* () {
			const plain: SigV4Request = { ...request, method: "custom", path: "", host: "" };
			const decoded = yield* S.decodeEffect(SigV4Request)(plain);
			assert.deepStrictEqual(decoded, plain);
			assert.strictEqual(decoded.body, plain.body);
			assert.strictEqual(decoded.now, plain.now);
			assert.notProperty(decoded, "encodedPathPrefix");
			assert.isTrue(S.is(SigV4Request)({ ...plain, encodedPathPrefix: undefined }));
			assert.isTrue(S.is(SigV4Request)({ ...plain, encodedPathPrefix: "/s3" }));
			assert.isFalse(S.is(SigV4Request)({ ...plain, body: [1, 2] }));
			assert.isFalse(S.is(SigV4Request)({ ...plain, now: "2024-01-01T00:00:00Z" }));
			assert.isFalse(S.is(SigV4Request)({ ...plain, headers: { "x-test": 1 } }));
			assert.isFalse(S.is(SigV4Request)({ ...plain, path: undefined }));
		}),
	);
});
