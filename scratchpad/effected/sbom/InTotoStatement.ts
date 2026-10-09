// in-toto Statement v1: the value that gets signed.
//
// This module reaches nothing — no `@sigstore/*`, no filesystem, no clock. That
// is deliberate: a statement, a subject and a digest are exactly what a
// VERIFIER needs, and a verifier must be able to depend on the shapes without
// loading Fulcio's transport. It is also what lets a caller build, inspect and
// serialize a statement in a test with no layers at all.

import { $ScratchpadId } from "@beep/identity/packages";
import type * as Brand from "effect/Brand";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/sbom/InTotoStatement");

/**
 * The in-toto Statement v1 type URI, stamped onto every statement this package
 * emits.
 *
 * **Example** (Inspect the statement version URI)
 *
 * ```ts
 * import { IN_TOTO_STATEMENT_V1 } from "@beep/scratchpad/effected/sbom/InTotoStatement";
 *
 * console.log(IN_TOTO_STATEMENT_V1) // https://in-toto.io/Statement/v1
 * ```
 *
 * @see {@link https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md | in-toto Statement v1} for the Statement v1 specification
 * @public
 * @category constants
 * @since 0.0.0
 */
export const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1" as const;

/**
 * The CycloneDX BOM predicate type, for attesting an SBOM.
 *
 * **Example** (Identify a CycloneDX predicate)
 *
 * ```ts
 * import { CYCLONEDX_BOM_PREDICATE } from "@beep/scratchpad/effected/sbom/InTotoStatement";
 *
 * console.log(CYCLONEDX_BOM_PREDICATE) // https://cyclonedx.org/bom
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const CYCLONEDX_BOM_PREDICATE = "https://cyclonedx.org/bom" as const;

/**
 * The URI naming what a statement asserts about its subjects.
 *
 * **Details**
 *
 * Deliberately an open string rather than a union: the predicate vocabulary is
 * extensible by design, and a closed union here would refuse a valid statement
 * for a predicate type this package has never heard of.
 * {@link (SlsaProvenance:class).predicateType} and {@link CYCLONEDX_BOM_PREDICATE}
 * are the two the kit produces.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PredicateType = string;

/**
 * Raised when a string is not a SHA-256 digest.
 *
 * **Example** (Inspect the invalid digest input)
 *
 * ```ts
 * import { InvalidSha256DigestError } from "@beep/scratchpad/effected/sbom/InTotoStatement";
 *
 * console.log(InvalidSha256DigestError.make({ input: "bad" }).input) // bad
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidSha256DigestError extends S.TaggedError<InvalidSha256DigestError>($I`InvalidSha256DigestError`)(
	"InvalidSha256DigestError",
	{
		/** The offending input, preserved verbatim. */
		input: S.String.annotateKey({ description: "The offending input, preserved verbatim." }),
	}, $I.annote("InvalidSha256DigestError", { description: "Raised when a string is not a SHA-256 digest." }),
) {
	/**
	 * Explains the digest format required for the rejected input.
	 *
	 * **Example** (Read the digest validation failure)
	 *
	 * ```ts
	 * import { InvalidSha256DigestError } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 *
	 * console.log(InvalidSha256DigestError.make({ input: "bad" }).message) // Invalid SHA-256 digest "bad": expected 64 hexadecimal characters
	 * ```
	 *
	 * @since 0.0.0
	 */
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
	/**
	 * Whether the value is, or normalizes to, a SHA-256 digest.
	 *
	 * **Example** (Recognize a normalized digest)
	 *
	 * ```ts
	 * import { Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 * console.log(Sha256Digest.isValid("sha256:" + "AB".repeat(32))) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	readonly isValid: (value: string) => boolean;
	/**
	 * Validate and normalize synchronously: an optional `sha256:` prefix is
	 * stripped and hex is lowercased. The sync primitive
	 * {@link (Sha256Digest:variable).parse} is defined in terms of.
	 *
	 * **Example** (Parse a digest synchronously)
	 *
	 * ```ts
	 * import { Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 * import * as Result from "effect/Result";
	 *
	 * console.log(Result.isSuccess(Sha256Digest.parseResult("ab".repeat(32)))) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	readonly parseResult: (value: string) => Result.Result<Sha256Digest, InvalidSha256DigestError>;
	/**
	 * {@link (Sha256Digest:variable).parseResult} in the `Effect` channel.
	 *
	 * **Example** (Parse a digest in the Effect channel)
	 *
	 * ```ts
	 * import { Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 * import * as Effect from "effect/Effect";
	 *
	 * console.log(Effect.runSync(Sha256Digest.parse("AB".repeat(32))) === "ab".repeat(32)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	readonly parse: (value: string) => Effect.Effect<Sha256Digest, InvalidSha256DigestError>;
}

const parseResult = (value: string): Result.Result<Sha256Digest, InvalidSha256DigestError> => {
	const normalized = normalizeDigest(value);
	return S.is(Sha256Digest)(normalized)
		? Result.succeed(normalized)
		: Result.fail(InvalidSha256DigestError.make({ input: value }));
};

const sha256Digest = S.String.pipe(
	// Put identity on the string AST, before the check, so JSON Schema retains
	// its inline pattern while the base schema carries the canonical identity.
	$I.annoteSchema("Sha256Digest", {
		description: "A SHA-256 digest as 64 lowercase hexadecimal characters, without an algorithm prefix.",
	}),
	S.check(S.isPattern(SHA256_RE)),
	S.brand("Sha256Digest"),
);

// Widen only Opaque's unused constructor to string members: TypeScript cannot
// extend a primitive. The schema's Type and runtime values stay branded strings.
const Sha256DigestBase: Omit<S.Opaque<Sha256Digest, typeof sha256Digest, {}>, never> &
	(new (_: never) => Pick<Sha256Digest, keyof Sha256Digest>) = S.Opaque<Sha256Digest>()(sha256Digest);

/**
 * A SHA-256 digest as 64 lowercase hexadecimal characters, without an
 * algorithm prefix.
 *
 * **Details**
 *
 * A deliberate small duplication rather than a shared package: `@effected/github`
 * types the same value structurally on its attestation surface, and dragging a
 * package across that seam to share one branded string would cost more than the
 * duplication does.
 *
 * **Example** (Normalize a prefixed uppercase digest)
 *
 * ```ts
 * import { Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
 * import * as Effect from "effect/Effect";
 *
 * const digest = Effect.runSync(Sha256Digest.parse("sha256:" + "AB".repeat(32)));
 * console.log(digest === "ab".repeat(32)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Sha256Digest = class extends Sha256DigestBase {
	/**
	 * Whether the value is, or normalizes to, a SHA-256 digest.
	 *
	 * **Example** (Recognize a normalized digest)
	 *
	 * ```ts
	 * import { Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 * console.log(Sha256Digest.isValid("sha256:" + "AB".repeat(32))) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static isValid = (value: string): boolean => S.is(Sha256Digest)(normalizeDigest(value));
	/**
	 * Validate and normalize synchronously: an optional `sha256:` prefix is
	 * stripped and hex is lowercased. The sync primitive
	 * {@link (Sha256Digest:variable).parse} is defined in terms of.
	 *
	 * **Example** (Parse a digest synchronously)
	 *
	 * ```ts
	 * import { Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 * import * as Result from "effect/Result";
	 *
	 * console.log(Result.isSuccess(Sha256Digest.parseResult("ab".repeat(32)))) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static parseResult = parseResult;
	/**
	 * {@link (Sha256Digest:variable).parseResult} in the `Effect` channel.
	 *
	 * **Example** (Parse a digest in the Effect channel)
	 *
	 * ```ts
	 * import { Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 * import * as Effect from "effect/Effect";
	 *
	 * console.log(Effect.runSync(Sha256Digest.parse("AB".repeat(32))) === "ab".repeat(32)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static parse = Effect.fn("Sha256Digest.parse")((value: string) => Effect.fromResult(parseResult(value)));
} satisfies Sha256DigestStatics;

/**
 * A SHA-256 digest as 64 lowercase hexadecimal characters.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type Sha256Digest = string & Brand.Brand<"Sha256Digest">;

/**
 * A content-addressed artifact an attestation is about.
 *
 * **Details**
 *
 * `name` is conventionally a package URL (`pkg:npm/%40scope/name@1.0.0`), but
 * the specification requires only that it be unique within the statement.
 * `digest` is an open algorithm → hex map because in-toto permits several; this
 * package writes `sha256`.
 *
 * **Example** (Build a content-addressed package subject)
 *
 * ```ts
 * import { InTotoSubject, Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
 * import * as Effect from "effect/Effect";
 *
 * const digest = Effect.runSync(Sha256Digest.parse("AB".repeat(32)));
 * const subject = InTotoSubject.forSha256("pkg:npm/widget@1.0.0", digest);
 * console.log(subject.digest.sha256 === "ab".repeat(32)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class InTotoSubject extends S.Class<InTotoSubject>($I`InTotoSubject`)({
	/** How the subject is identified — a purl for an npm package. */
	name: S.String.annotateKey({ description: "How the subject is identified — a purl for an npm package." }),
	/** Algorithm to hex digest. */
	digest: S.Record(S.String, S.String).annotateKey({ description: "Algorithm to hex digest." }),
}, $I.annote("InTotoSubject", { description: "A content-addressed artifact an attestation is about." })) {
	/**
	 * A subject identified by a SHA-256 digest.
	 *
	 * **Details**
	 *
	 * **Total** — the digest is already validated, which is what
	 * {@link (Sha256Digest:variable).parseResult} is for.
	 *
	 * **Example** (Attach the validated SHA-256 digest)
	 *
	 * ```ts
	 * import { InTotoSubject, Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 * import * as Effect from "effect/Effect";
	 *
	 * const digest = Effect.runSync(Sha256Digest.parse("AB".repeat(32)));
	 * console.log(InTotoSubject.forSha256("widget", digest).name) // widget
	 * ```
	 *
	 * @since 0.0.0
	 */
	static forSha256(name: string, digest: Sha256Digest): InTotoSubject {
		return InTotoSubject.make({ name, digest: { sha256: digest } });
	}
}

/**
 * Input to {@link (InTotoStatement:class).of}.
 *
 * **Details**
 *
 * The two predicate members are spelled out here and again on
 * {@link InTotoSubjectInput} rather than shared through a base interface: an
 * internal type named on a `@public` signature is a forgotten export, and a
 * named alias is still a named symbol. Structural duplication is the only form
 * the API gate accepts.
 *
 * **Example** (Validate a statement input record)
 *
 * ```ts
 * import { InTotoStatementInput, CYCLONEDX_BOM_PREDICATE } from "@beep/scratchpad/effected/sbom/InTotoStatement";
 * import * as S from "effect/Schema";
 *
 * const input = InTotoStatementInput.make({ subject: [], predicateType: CYCLONEDX_BOM_PREDICATE, predicate: {} });
 * console.log(S.is(InTotoStatementInput)(input)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const InTotoStatementInput = S.Struct({
	/** The artifacts the statement is about. */
	subject: S.Array(InTotoSubject).annotateKey({ description: "The artifacts the statement is about." }),
	/** What the statement asserts. */
	predicateType: S.String.annotateKey({ description: "What the statement asserts." }),
	/** The assertion's body — a `SlsaProvenance`, a BOM, or a caller's own shape. */
	predicate: S.Unknown.annotateKey({ description: "The assertion's body — a SlsaProvenance, a BOM, or a caller's own shape." }),
}).pipe($I.annoteSchema("InTotoStatementInput", { description: "Input to InTotoStatement.of." }));

/**
 * Decoded input accepted by the statement constructor.
 * @category type-level
 * @since 0.0.0
 */
export type InTotoStatementInput = typeof InTotoStatementInput.Type;

/**
 * Input to {@link (InTotoStatement:class).forSubject}.
 *
 * **Details**
 *
 * A record rather than positional arguments on purpose: `name` and
 * `predicateType` are both strings, and a positional constructor invites a
 * statement that silently attests the wrong thing.
 *
 * **Example** (Validate a single-subject input)
 *
 * ```ts
 * import { InTotoSubjectInput, Sha256Digest, CYCLONEDX_BOM_PREDICATE } from "@beep/scratchpad/effected/sbom/InTotoStatement";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const digest = Effect.runSync(Sha256Digest.parse("AB".repeat(32)));
 * const input = InTotoSubjectInput.make({ name: "widget", digest, predicateType: CYCLONEDX_BOM_PREDICATE, predicate: {} });
 * console.log(S.is(InTotoSubjectInput)(input)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const InTotoSubjectInput = S.Struct({
	/** How the single subject is identified. */
	name: S.String.annotateKey({ description: "How the single subject is identified." }),
	/** Its SHA-256 digest. */
	digest: Sha256Digest.annotateKey({ description: "Its SHA-256 digest." }),
	/** What the statement asserts. */
	predicateType: S.String.annotateKey({ description: "What the statement asserts." }),
	/** The assertion's body — a `SlsaProvenance`, a BOM, or a caller's own shape. */
	predicate: S.Unknown.annotateKey({ description: "The assertion's body — a SlsaProvenance, a BOM, or a caller's own shape." }),
}).pipe($I.annoteSchema("InTotoSubjectInput", { description: "Input to InTotoStatement.forSubject." }));

/**
 * Decoded input accepted by the single-artifact constructor.
 * @category type-level
 * @since 0.0.0
 */
export type InTotoSubjectInput = typeof InTotoSubjectInput.Type;

/**
 * An in-toto Statement v1.
 *
 * **Details**
 *
 * `predicate` is `unknown` by design — SLSA provenance, a CycloneDX BOM and a
 * caller's own predicate all travel here, and the statement layer has no reason
 * to introspect any of them.
 *
 * **Example** (Create a statement for a SHA-256 subject)
 *
 * ```ts
 * import { InTotoStatement, Sha256Digest } from "@beep/scratchpad/effected/sbom/InTotoStatement";
 * import { SlsaProvenance } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const digest = yield* Sha256Digest.parse("ab".repeat(32));
 *   return InTotoStatement.forSubject({
 *     name: "pkg:npm/%40scope/pkg@1.0.0",
 *     digest,
 *     predicateType: SlsaProvenance.predicateType,
 *     predicate: {}, // a SlsaProvenance, a BOM, or a caller-defined predicate body
 *   });
 * });
 * console.log(Effect.runSync(program).subject[0]?.name) // pkg:npm/%40scope/pkg@1.0.0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class InTotoStatement extends S.Class<InTotoStatement>($I`InTotoStatement`)({
	/** Always the in-toto Statement v1 URI. */
	_type: S.Literal(IN_TOTO_STATEMENT_V1).annotateKey({ description: "Always the in-toto Statement v1 URI." }),
	/** The artifacts attested. */
	subject: S.Array(InTotoSubject).annotateKey({ description: "The artifacts attested." }),
	/** What is being asserted about them. */
	predicateType: S.String.annotateKey({ description: "What is being asserted about them." }),
	/** The assertion body. */
	predicate: S.Unknown.annotateKey({ description: "The assertion body." }),
}, $I.annote("InTotoStatement", { description: "An in-toto Statement v1." })) {
	/**
	 * A statement over any number of subjects. **Total.**
	 *
	 * **Example** (Create a statement without subjects)
	 *
	 * ```ts
	 * import { InTotoStatement, CYCLONEDX_BOM_PREDICATE } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 *
	 * const statement = InTotoStatement.of({ subject: [], predicateType: CYCLONEDX_BOM_PREDICATE, predicate: {} });
	 * console.log(statement.subject.length) // 0
	 * ```
	 *
	 * @since 0.0.0
	 */
	static of(input: InTotoStatementInput): InTotoStatement {
		return InTotoStatement.make({
			_type: IN_TOTO_STATEMENT_V1,
			subject: input.subject,
			predicateType: input.predicateType,
			predicate: input.predicate,
		});
	}

	/**
	 * A statement over a single artifact — the common case. **Total.**
	 *
	 * **Example** (Attest one artifact)
	 *
	 * ```ts
	 * import { InTotoStatement, Sha256Digest, CYCLONEDX_BOM_PREDICATE } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 * import * as Effect from "effect/Effect";
	 *
	 * const digest = Effect.runSync(Sha256Digest.parse("AB".repeat(32)));
	 * const statement = InTotoStatement.forSubject({ name: "widget", digest, predicateType: CYCLONEDX_BOM_PREDICATE, predicate: {} });
	 * console.log(statement.subject.length) // 1
	 * ```
	 *
	 * @since 0.0.0
	 */
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
	 * **Details**
	 *
	 * Compact and in a fixed key order by default, so the same statement
	 * serializes to the same bytes on every run. Pass `space` for a form meant to
	 * be read by a person.
	 *
	 * **Example** (Serialize a compact statement payload)
	 *
	 * ```ts
	 * import { InTotoStatement } from "@beep/scratchpad/effected/sbom/InTotoStatement";
	 *
	 * const statement = InTotoStatement.of({ subject: [], predicateType: "https://example.com/predicate", predicate: {} });
	 * console.log(statement.toJson()) // {"_type":"https://in-toto.io/Statement/v1","subject":[],"predicateType":"https://example.com/predicate","predicate":{}}
	 * ```
	 *
	 * @since 0.0.0
	 */
	toJson(options?: { readonly space?: number | undefined }): string {
		return Result.getOrThrow(
			S.encodeResult(S.fromJsonString(S.Unknown, { space: options?.space ?? 0 }))({
				_type: this._type,
				subject: this.subject.map((subject) => ({ name: subject.name, digest: subject.digest })),
				predicateType: this.predicateType,
				predicate: this.predicate,
			}),
		);
	}
}
