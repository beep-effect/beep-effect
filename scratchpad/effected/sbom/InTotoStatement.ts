// in-toto Statement v1: the value that gets signed.
//
// This module reaches nothing — no `@sigstore/*`, no filesystem, no clock. That
// is deliberate: a statement, a subject and a digest are exactly what a
// VERIFIER needs, and a verifier must be able to depend on the shapes without
// loading Fulcio's transport. It is also what lets a caller build, inspect and
// serialize a statement in a test with no layers at all.

import type { Brand } from "effect";
import { Effect, Result, Schema } from "effect";

/**
 * The in-toto Statement v1 type URI, stamped onto every statement this package
 * emits.
 *
 * @see {@link https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md | in-toto Statement v1}
 *
 * @public
 */
export const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1" as const;

/**
 * The CycloneDX BOM predicate type, for attesting an SBOM.
 *
 * @public
 */
export const CYCLONEDX_BOM_PREDICATE = "https://cyclonedx.org/bom" as const;

/**
 * The URI naming what a statement asserts about its subjects.
 *
 * @remarks
 * Deliberately an open string rather than a union: the predicate vocabulary is
 * extensible by design, and a closed union here would refuse a valid statement
 * for a predicate type this package has never heard of.
 * {@link (SlsaProvenance:class).predicateType} and {@link CYCLONEDX_BOM_PREDICATE}
 * are the two the kit produces.
 *
 * @public
 */
export type PredicateType = string;

/**
 * Raised when a string is not a SHA-256 digest.
 *
 * @public
 */
export class InvalidSha256DigestError extends Schema.TaggedError<InvalidSha256DigestError>()(
	"InvalidSha256DigestError",
	{
		/** The offending input, preserved verbatim. */
		input: Schema.String,
	},
) {
	override get message(): string {
		return `Invalid SHA-256 digest "${this.input}": expected 64 hexadecimal characters`;
	}
}

/** 64 hex characters, lowercase — the normalized form. */
const SHA256_RE = /^[0-9a-f]{64}$/u;

/** The `sha256:` prefix a caller may have carried in from a digest reference. */
const SHA256_PREFIX_RE = /^sha256:/i;

const normalizeDigest = (value: string): string => value.replace(SHA256_PREFIX_RE, "").toLowerCase();

/** Statics attached to the {@link (Sha256Digest:variable)} schema. */
interface Sha256DigestStatics {
	/** Whether the value is, or normalizes to, a SHA-256 digest. */
	readonly isValid: (value: string) => boolean;
	/**
	 * Validate and normalize synchronously: an optional `sha256:` prefix is
	 * stripped and hex is lowercased. The sync primitive
	 * {@link (Sha256Digest:variable).parse} is defined in terms of.
	 */
	readonly parseResult: (value: string) => Result.Result<Sha256Digest, InvalidSha256DigestError>;
	/** {@link (Sha256Digest:variable).parseResult} in the `Effect` channel. */
	readonly parse: (value: string) => Effect.Effect<Sha256Digest, InvalidSha256DigestError>;
}

const parseResult = (value: string): Result.Result<Sha256Digest, InvalidSha256DigestError> => {
	const normalized = normalizeDigest(value);
	return SHA256_RE.test(normalized)
		? Result.succeed(normalized as Sha256Digest)
		: Result.fail(new InvalidSha256DigestError({ input: value }));
};

/**
 * A SHA-256 digest as 64 lowercase hexadecimal characters, without an
 * algorithm prefix.
 *
 * @remarks
 * A deliberate small duplication rather than a shared package: `@effected/github`
 * types the same value structurally on its attestation surface, and dragging a
 * package across that seam to share one branded string would cost more than the
 * duplication does.
 *
 * @public
 */
export const Sha256Digest = Object.assign(
	Schema.String.pipe(Schema.check(Schema.isPattern(SHA256_RE)), Schema.brand("Sha256Digest")),
	{
		isValid: (value: string): boolean => SHA256_RE.test(normalizeDigest(value)),
		parseResult,
		parse: Effect.fn("Sha256Digest.parse")((value: string) => Effect.fromResult(parseResult(value))),
	} satisfies Sha256DigestStatics,
);

/**
 * A SHA-256 digest as 64 lowercase hexadecimal characters.
 *
 * @public
 */
export type Sha256Digest = string & Brand.Brand<"Sha256Digest">;

/**
 * A content-addressed artifact an attestation is about.
 *
 * @remarks
 * `name` is conventionally a package URL (`pkg:npm/%40scope/name@1.0.0`), but
 * the specification requires only that it be unique within the statement.
 * `digest` is an open algorithm → hex map because in-toto permits several; this
 * package writes `sha256`.
 *
 * @public
 */
export class InTotoSubject extends Schema.Class<InTotoSubject>("InTotoSubject")({
	/** How the subject is identified — a purl for an npm package. */
	name: Schema.String,
	/** Algorithm to hex digest. */
	digest: Schema.Record(Schema.String, Schema.String),
}) {
	/**
	 * A subject identified by a SHA-256 digest.
	 *
	 * @remarks
	 * **Total** — the digest is already validated, which is what
	 * {@link (Sha256Digest:variable).parseResult} is for.
	 */
	static forSha256(name: string, digest: Sha256Digest): InTotoSubject {
		return InTotoSubject.make({ name, digest: { sha256: digest } });
	}
}

/**
 * Input to {@link (InTotoStatement:class).of}.
 *
 * @privateRemarks
 * The two predicate members are spelled out here and again on
 * {@link InTotoSubjectInput} rather than shared through a base interface: an
 * internal type named on a `@public` signature is a forgotten export, and a
 * named alias is still a named symbol. Structural duplication is the only form
 * the API gate accepts.
 *
 * @public
 */
export interface InTotoStatementInput {
	/** The artifacts the statement is about. */
	readonly subject: ReadonlyArray<InTotoSubject>;
	/** What the statement asserts. */
	readonly predicateType: PredicateType;
	/** The assertion's body — a `SlsaProvenance`, a BOM, or a caller's own shape. */
	readonly predicate: unknown;
}

/**
 * Input to {@link (InTotoStatement:class).forSubject}.
 *
 * @remarks
 * A record rather than positional arguments on purpose: `name` and
 * `predicateType` are both strings, and a positional constructor invites a
 * statement that silently attests the wrong thing.
 *
 * @public
 */
export interface InTotoSubjectInput {
	/** How the single subject is identified. */
	readonly name: string;
	/** Its SHA-256 digest. */
	readonly digest: Sha256Digest;
	/** What the statement asserts. */
	readonly predicateType: PredicateType;
	/** The assertion's body — a `SlsaProvenance`, a BOM, or a caller's own shape. */
	readonly predicate: unknown;
}

/**
 * An in-toto Statement v1.
 *
 * @remarks
 * `predicate` is `unknown` by design — SLSA provenance, a CycloneDX BOM and a
 * caller's own predicate all travel here, and the statement layer has no reason
 * to introspect any of them.
 *
 * @example
 * ```ts
 * import { InTotoStatement, Sha256Digest, SlsaProvenance } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const digest = yield* Sha256Digest.parse("ab".repeat(32));
 *   return InTotoStatement.forSubject({
 *     name: "pkg:npm/%40scope/pkg@1.0.0",
 *     digest,
 *     predicateType: SlsaProvenance.predicateType,
 *     predicate: {}, // a SlsaProvenance, a BOM, or any predicate body
 *   });
 * });
 * ```
 *
 * @public
 */
export class InTotoStatement extends Schema.Class<InTotoStatement>("InTotoStatement")({
	/** Always the in-toto Statement v1 URI. */
	_type: Schema.Literal(IN_TOTO_STATEMENT_V1),
	/** The artifacts attested. */
	subject: Schema.Array(InTotoSubject),
	/** What is being asserted about them. */
	predicateType: Schema.String,
	/** The assertion body. */
	predicate: Schema.Unknown,
}) {
	/** A statement over any number of subjects. **Total.** */
	static of(input: InTotoStatementInput): InTotoStatement {
		return InTotoStatement.make({
			_type: IN_TOTO_STATEMENT_V1,
			subject: input.subject,
			predicateType: input.predicateType,
			predicate: input.predicate,
		});
	}

	/** A statement over a single artifact — the common case. **Total.** */
	static forSubject(input: InTotoSubjectInput): InTotoStatement {
		return InTotoStatement.of({
			subject: [InTotoSubject.forSha256(input.name, input.digest)],
			predicateType: input.predicateType,
			predicate: input.predicate,
		});
	}

	/**
	 * The statement as JSON — the bytes a DSSE envelope carries as its payload.
	 *
	 * @remarks
	 * Compact and in a fixed key order by default, so the same statement
	 * serializes to the same bytes on every run. Pass `space` for a form meant to
	 * be read by a person.
	 */
	toJson(options?: { readonly space?: number | undefined }): string {
		return JSON.stringify(
			{
				_type: this._type,
				subject: this.subject.map((subject) => ({ name: subject.name, digest: subject.digest })),
				predicateType: this.predicateType,
				predicate: this.predicate,
			},
			null,
			options?.space ?? 0,
		);
	}
}
