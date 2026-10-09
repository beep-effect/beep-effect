// in-toto statements: the value a signer wraps and a verifier reads.
//
// Nothing here reaches `@sigstore/*` — building and inspecting a statement is
// what lets a VERIFIER depend on the shapes alone, and it is half of why these
// live in their own module rather than inside the signer.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
	IN_TOTO_STATEMENT_V1,
	InTotoStatement,
	InTotoSubject,
	InvalidSha256DigestError,
	Sha256Digest,
	SlsaProvenance,
} from "../../effected/sbom/index.ts";

const HEX = "6a13657ec19f43b1d7b95c2f0a1c1e5b8d4f7a206a13657ec19f43b1d7b95c2f";

const digestOf = (value: string): Sha256Digest => {
	const parsed = Sha256Digest.parseResult(value);
	if (Result.isFailure(parsed)) throw new Error(`fixture digest rejected: ${value}`);
	return parsed.success;
};

describe("Sha256Digest", () => {
	it("accepts 64 lowercase hex characters", () => {
		const parsed = Sha256Digest.parseResult(HEX);
		assert.isTrue(Result.isSuccess(parsed));
		assert.strictEqual(Result.isSuccess(parsed) ? parsed.success : "", HEX);
	});

	it("strips the `sha256:` prefix a caller may have carried in", () => {
		const parsed = Sha256Digest.parseResult(`sha256:${HEX}`);
		assert.strictEqual(Result.isSuccess(parsed) ? parsed.success : "", HEX);
	});

	it("normalizes uppercase hex to lowercase", () => {
		// Both spellings name the same digest, and a subject that disagrees with a
		// verifier on case is an attestation nobody can match.
		const parsed = Sha256Digest.parseResult(HEX.toUpperCase());
		assert.strictEqual(Result.isSuccess(parsed) ? parsed.success : "", HEX);
	});

	it("rejects a digest of the wrong length", () => {
		const parsed = Sha256Digest.parseResult(HEX.slice(0, 63));
		assert.isTrue(Result.isFailure(parsed));
		if (Result.isFailure(parsed)) {
			assert.instanceOf(parsed.failure, InvalidSha256DigestError);
			assert.strictEqual(parsed.failure.input, HEX.slice(0, 63));
		}
	});

	it("rejects non-hex characters", () => {
		// `g` is the discriminating character: right length, wrong alphabet.
		assert.isTrue(Result.isFailure(Sha256Digest.parseResult(`g${HEX.slice(1)}`)));
		assert.isTrue(Result.isFailure(Sha256Digest.parseResult("")));
	});

	it("isValid agrees with parseResult", () => {
		assert.isTrue(Sha256Digest.isValid(HEX));
		assert.isFalse(Sha256Digest.isValid("sha256:nope"));
	});

	it.effect("the Effect form fails with the same typed error", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Sha256Digest.parse("nope"));
			assert.instanceOf(error, InvalidSha256DigestError);
			assert.include(error.message, "nope");
		}),
	);

	it.effect("the Effect form succeeds where the Result form does", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* Sha256Digest.parse(`SHA256:${HEX.toUpperCase()}`), HEX);
		}),
	);
});

describe("InTotoSubject", () => {
	it("names the digest algorithm the way the spec does", () => {
		const subject = InTotoSubject.forSha256("pkg:npm/left-pad@1.0.0", digestOf(HEX));
		assert.strictEqual(subject.name, "pkg:npm/left-pad@1.0.0");
		assert.deepStrictEqual(subject.digest, { sha256: HEX });
	});
});

describe("InTotoStatement", () => {
	const subject = InTotoSubject.forSha256("pkg:npm/left-pad@1.0.0", digestOf(HEX));
	const predicate = { hello: "world" };

	it("stamps the in-toto Statement v1 type URI", () => {
		const statement = InTotoStatement.forSubject({
			name: "pkg:npm/left-pad@1.0.0",
			digest: digestOf(HEX),
			predicateType: "https://example.test/predicate/v1",
			predicate,
		});
		assert.strictEqual(statement._type, IN_TOTO_STATEMENT_V1);
		assert.strictEqual(IN_TOTO_STATEMENT_V1, "https://in-toto.io/Statement/v1");
	});

	it("carries exactly one subject for the single-subject constructor", () => {
		const statement = InTotoStatement.forSubject({
			name: "pkg:npm/left-pad@1.0.0",
			digest: digestOf(HEX),
			predicateType: "https://example.test/predicate/v1",
			predicate,
		});
		assert.lengthOf(statement.subject, 1);
		assert.deepStrictEqual(statement.subject[0]?.digest, { sha256: HEX });
		assert.deepStrictEqual(statement.predicate, predicate);
	});

	it("carries every subject of a multi-subject statement, in order", () => {
		const second = InTotoSubject.forSha256("pkg:npm/right-pad@1.0.0", digestOf(HEX.toUpperCase()));
		const statement = InTotoStatement.of({
			subject: [subject, second],
			predicateType: "https://example.test/predicate/v1",
			predicate,
		});
		assert.deepStrictEqual(
			statement.subject.map((entry) => entry.name),
			["pkg:npm/left-pad@1.0.0", "pkg:npm/right-pad@1.0.0"],
		);
	});

	it("serializes to compact JSON that round-trips", () => {
		const statement = InTotoStatement.of({
			subject: [subject],
			predicateType: "https://example.test/predicate/v1",
			predicate,
		});
		const json = statement.toJson();
		assert.isFalse(json.includes("\n"), "the DSSE payload is compact by default");
		assert.deepStrictEqual<unknown>(JSON.parse(json), {
			_type: IN_TOTO_STATEMENT_V1,
			subject: [{ name: "pkg:npm/left-pad@1.0.0", digest: { sha256: HEX } }],
			predicateType: "https://example.test/predicate/v1",
			predicate,
		});
	});

	it("indents on request, for a statement written down for a human", () => {
		const json = InTotoStatement.of({
			subject: [subject],
			predicateType: "https://example.test/predicate/v1",
			predicate,
		}).toJson({ space: 2 });
		assert.isTrue(json.includes("\n"));
	});

	it("nests a typed predicate without wrapping or renaming a field of it", () => {
		// The seam between the two halves of this package: a `SlsaProvenance` goes
		// in as the predicate and comes out of the payload as its own JSON shape.
		const provenance = SlsaProvenance.forGitHubWorkflow({
			serverUrl: "https://github.com",
			repository: "effected/kit",
			ref: "refs/heads/main",
			sha: "6a13657ec19f43b1d7b95c2f0a1c1e5b8d4f7a20",
			eventName: "push",
			workflowRef: "effected/kit/.github/workflows/release.yml@refs/heads/main",
			jobWorkflowRef: "effected/kit/.github/workflows/release.yml@refs/heads/main",
			repositoryId: "123456",
			repositoryOwnerId: "654321",
			runnerEnvironment: "github-hosted",
			runId: "42",
			runAttempt: "1",
		});
		const statement = InTotoStatement.forSubject({
			name: "pkg:npm/left-pad@1.0.0",
			digest: digestOf(HEX),
			predicateType: SlsaProvenance.predicateType,
			predicate: provenance,
		});
		const parsed = JSON.parse(statement.toJson()) as {
			predicateType: string;
			predicate: { buildDefinition: { buildType: string } };
		};
		assert.strictEqual(parsed.predicateType, "https://slsa.dev/provenance/v1");
		assert.strictEqual(parsed.predicate.buildDefinition.buildType, SlsaProvenance.buildType);
	});
});

describe("Sha256Digest JSON Schema export", () => {
	it("exports its 64-hex pattern", () => {
		assert.nestedPropertyVal(S.toJsonSchemaDocument(Sha256Digest), "schema.pattern", "^[0-9a-f]{64}$");
	});
});
