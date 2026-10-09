import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import { Run } from "../commands/index.ts";
import type * as Scope from "effect/Scope";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { pipe } from "effect/Function";
import * as Base64 from "effect/encoding/Base64";
import { HttpClient } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { IntegrityHash } from "./IntegrityHash.ts";
import type { PublishedVersion } from "./NpmRegistry.ts";

const $I = $ScratchpadId.create("effected/npm/PackageTarball");

const TarballReason = LiteralKit(["notFound", "http", "integrityMismatch", "integrityUnverifiable", "extractFailed"])
	.annotate($I.annote("TarballReason", { description: "The reason a published tarball could not be read." }));
type TarballReason = typeof TarballReason.Type;

/**
 * Raised when a published tarball cannot be fetched, verified or extracted.
 *
 * @public
 */
const TarballErrorPayload = S.Struct({
	/**
	 * `notFound` — the registry recorded no tarball for this version, or the
	 * tarball URL answered 404. `http` — any other transport or non-2xx
	 * failure. `integrityMismatch` — the bytes did not match the integrity the
	 * registry vouched for. `extractFailed` — the bytes could not be written or
	 * unpacked.
	 *
	 * **The `notFound` split is load-bearing, not cosmetic.** A consumer that
	 * cannot tell "this version legitimately does not exist" from "something
	 * went wrong fetching a version that does" has to treat both the same way,
	 * and the failure that results is silent: an integrity mismatch handled as
	 * a missing version can send a caller down a lossy fallback on a run that
	 * still reports success. Branch on `reason`.
	 *
	 * `integrityUnverifiable` — the registry vouched for an integrity but no
	 * digest could be computed to check it, so nothing was compared.
	 */
	reason: TarballReason.annotateKey({ description: "`notFound` — the registry recorded no tarball for this version, or the tarball URL answered 404. `http` — any other transport or non-2xx failure. `integrityMismatch` — the bytes did not match the integrity the registry vouched for. `extractFailed` — the bytes could not be written or unpacked." }),
	/** The package being fetched. */
	package: S.String.annotateKey({ description: "The package being fetched." }),
	/** The version being fetched. */
	version: S.String.annotateKey({ description: "The version being fetched." }),
	/** The HTTP status, for `reason: "http"` and a 404 `notFound`. */
	status: S.optionalKey(S.Finite).annotateKey({ description: "The HTTP status, for `reason: \"http\"` and a 404 `notFound`." }),
	/** The integrity the registry vouched for, for `reason: "integrityMismatch"`. */
	expected: S.optionalKey(S.String).annotateKey({ description: "The integrity the registry vouched for, for `reason: \"integrityMismatch\"`." }),
	/** The integrity the downloaded bytes actually have. */
	actual: S.optionalKey(S.String).annotateKey({ description: "The integrity the downloaded bytes actually have." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({ description: "The underlying failure, preserved structurally." }),
}).annotate($I.annote("TarballErrorPayload", { description: "The compatible public tarball error payload." }));

const TarballCommon = {
	package: TarballErrorPayload.fields.package,
	version: TarballErrorPayload.fields.version,
};

const TarballFailure = TarballReason.mapMembers(([notFound, http, integrityMismatch, integrityUnverifiable, extractFailed]) => [
	S.Struct({ ...TarballCommon, reason: notFound.annotateKey({ description: "No tarball was published or the URL answered 404." }), status: TarballErrorPayload.fields.status })
		.annotate($I.annote("TarballNotFound", { description: "A missing published tarball." })),
	S.Struct({ ...TarballCommon, reason: http.annotateKey({ description: "A transport or non-2xx download failure." }), status: TarballErrorPayload.fields.status, cause: TarballErrorPayload.fields.cause })
		.annotate($I.annote("TarballHttpFailure", { description: "A failed tarball download." })),
	S.Struct({ ...TarballCommon, reason: integrityMismatch.annotateKey({ description: "The measured integrity differs from the published integrity." }), expected: TarballErrorPayload.fields.expected, actual: TarballErrorPayload.fields.actual })
		.annotate($I.annote("TarballIntegrityMismatch", { description: "A measured integrity mismatch." })),
	S.Struct({ ...TarballCommon, reason: integrityUnverifiable.annotateKey({ description: "No digest could be computed to verify the tarball." }), expected: TarballErrorPayload.fields.expected, cause: TarballErrorPayload.fields.cause })
		.annotate($I.annote("TarballIntegrityUnverifiable", { description: "An unmeasured tarball integrity." })),
	S.Struct({ ...TarballCommon, reason: extractFailed.annotateKey({ description: "The tarball could not be written or unpacked." }), cause: TarballErrorPayload.fields.cause })
		.annotate($I.annote("TarballExtractionFailure", { description: "A failed tarball extraction." })),
] as const).pipe(S.annotate($I.annote("TarballFailure", { description: "Validated case-specific tarball failures." })), S.toTaggedUnion("reason"));

// The public optional-field bag remains compatible. Composition projects it
// into the validated member for its reason, dropping irrelevant fields there.
const TarballFailureFromPayload = S.toType(TarballErrorPayload).pipe(S.decodeTo(S.toType(TarballFailure)));

/** Raised when a published tarball cannot be fetched, verified or extracted. */
export class TarballError extends S.TaggedError<TarballError>($I`TarballError`)("TarballError", TarballErrorPayload,
	$I.annote("TarballError", { description: "Raised when a published tarball cannot be fetched, verified or extracted." }),
) {
	private get variant(): typeof TarballFailure.Type {
		return pipe(this, S.decodeUnknownResult(TarballFailureFromPayload), Result.getOrThrow);
	}

	override get message(): string {
		const what = `${this.package}@${this.version}`;
		return TarballFailure.match(this.variant, {
			notFound: () => `No published tarball for ${what}`,
			http: (failure) => `Could not download the tarball for ${what}${failure.status === undefined ? "" : ` (HTTP ${failure.status})`}`,
			integrityMismatch: (failure) => `The tarball for ${what} did not match the integrity the registry published (expected ${failure.expected ?? "unknown"}, got ${failure.actual ?? "unknown"})`,
			integrityUnverifiable: (failure) => `Could not compute a digest to verify ${what}, so its integrity was never checked (expected ${failure.expected ?? "unknown"})`,
			extractFailed: () => `Could not extract the tarball for ${what}`,
		});
	}
}

/**
 * The {@link PackageTarball} service shape.
 *
 * @public
 */
export interface PackageTarballShape {
	/**
	 * Download, verify and extract one published version, answering the
	 * directory its `package/` root was unpacked into.
	 *
	 * @remarks
	 * **Scoped**: the temporary directory is removed when the calling scope
	 * closes, so a caller reads what it needs and never owns the cleanup.
	 */
	readonly extract: (published: PublishedVersion) => Effect.Effect<string, TarballError, Scope.Scope>;
}

/** Map an SRI algorithm name onto core's digest algorithm spelling. */
const digestAlgorithmOf = (algorithm: string): Crypto.DigestAlgorithm | undefined =>
	Match.value(algorithm).pipe(
		Match.when("sha1", () => "SHA-1" as const),
		Match.when("sha256", () => "SHA-256" as const),
		Match.when("sha384", () => "SHA-384" as const),
		Match.when("sha512", () => "SHA-512" as const),
		Match.orElse(() => undefined),
	);

/** An SRI value without its base64 padding, for a padding-insensitive compare. */
const unpadded = Str.replace(/=+$/, "");

/** Builds the service over already-resolved platform services. */
const make = Effect.fnUntraced(function* () {
	const fs = yield* FileSystem.FileSystem;
	const crypto = yield* Crypto.Crypto;
	const http = yield* HttpClient.HttpClient;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

	const extract = Effect.fn("PackageTarball.extract")(function* (published: PublishedVersion) {
		const name = published.name;
		const version = published.version;
		const fail = (
			reason: TarballReason,
			extra: { status?: number; expected?: string; actual?: string; cause?: unknown } = {},
		): TarballError => TarballError.make({ reason, package: name, version, ...extra });

		const url = published.tarball;
		if (url === undefined) {
			return yield* fail("notFound");
		}

		const response = yield* http.get(url).pipe(Effect.mapError((cause) => fail("http", { cause })));

		// A non-2xx body must be caught BEFORE it reaches the disk: piping a 404
		// error page to `tar` surfaces as a misleading "could not extract"
		// instead of naming the real failure.
		if (Math.floor(response.status / 100) !== 2) {
			return yield* fail(response.status === 404 ? "notFound" : "http", { status: response.status });
		}

		const bytes = yield* response.arrayBuffer.pipe(
			Effect.map((buffer) => new Uint8Array(buffer)),
			Effect.mapError((cause) => fail("http", { cause })),
		);

		// Verification happens BEFORE extraction and before anything reads the
		// contents: a poisoned intermediary (CDN edge, proxy, mirror) serving
		// different bytes than the registry vouched for must never reach `tar`.
		const expected = published.integrity;
		if (expected === undefined) {
			yield* Effect.logDebug(
				`PackageTarball: the registry published no integrity for ${name}@${version}; the download is unverified`,
			);
		} else {
			const algorithm = O.flatMap(IntegrityHash.algorithmOf(expected), (found) =>
				O.fromUndefinedOr(digestAlgorithmOf(found)),
			);
			if (!IntegrityHash.isSri(expected) || O.isNone(algorithm)) {
				// Not a form this can check (the yarn form names no algorithm).
				// Saying so is the point: a silent skip here is indistinguishable
				// from a passed verification.
				yield* Effect.logWarning(
					`PackageTarball: cannot verify ${name}@${version} — "${expected}" is not an integrity form this can check`,
				);
			} else {
				const digest = yield* crypto
					.digest(algorithm.value, bytes)
					// NOT integrityMismatch: nothing was compared. See the reason
					// docstring — a failure to verify presented as a measured
					// mismatch is the exact class this package fixes elsewhere.
					.pipe(Effect.mapError((cause) => fail("integrityUnverifiable", { expected, cause })));
				const actual = `${Str.slice(0, O.getOrElse(Str.indexOf("-")(expected), () => -1))(expected)}-${Base64.encode(digest)}`;
				// Compared without base64 padding: the SRI grammar permits an
				// unpadded value, and a padding difference is not a byte
				// difference. Refusing a valid tarball over one would be the
				// worse failure of the two.
				if (unpadded(actual) !== unpadded(expected)) {
					return yield* fail("integrityMismatch", { expected, actual });
				}
			}
		}

		const directory = yield* fs
			.makeTempDirectoryScoped({ prefix: "effected-tarball-" })
			.pipe(Effect.mapError((cause) => fail("extractFailed", { cause })));

		const archive = `${directory}/package.tgz`;
		yield* fs.writeFile(archive, bytes).pipe(Effect.mapError((cause) => fail("extractFailed", { cause })));

		const unpacked = yield* Run.succeeds(ChildProcess.make("tar", ["-xzf", archive, "-C", directory])).pipe(
			Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
		);
		if (!unpacked) {
			return yield* fail("extractFailed");
		}

		// npm tarballs unpack to a fixed `package/` root.
		return `${directory}/package`;
	});

	return { extract } satisfies PackageTarballShape;
});

/**
 * Fetch, verify and extract a published tarball.
 *
 * @remarks
 * The inbound half of the registry surface: `NpmRegistry` reads *metadata* and
 * `PackagePublish` sends a tarball out, while this service reads a published
 * tarball back. Use it to read something out of a published package **before
 * any install has run**, such as a tool reproducing a package manager's
 * config-dependency workflow, whose output is the input the install then
 * consumes.
 *
 * Pair it with `resolveEntryPoint` from `@effected/package-json` to find
 * the package's entry file inside the extracted directory. Loading that file is
 * deliberately **not** part of this surface: a dynamic `import()` of a computed
 * path is compiled into a context module by bundlers, and a kit-level loader
 * would hand every bundling consumer that problem with no seam to fix it.
 *
 * **Extraction shells out to `tar`** through core's `ChildProcessSpawner`
 * rather than taking a tarball-reader dependency, so the package keeps its
 * core-only dependency footprint. `tar` is on every CI runner image; a consumer
 * off a runner needs both a spawner and the `tar` binary.
 *
 * @example
 * ```ts
 * import { NpmRegistry, PackageTarball } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const read = Effect.gen(function* () {
 *   const registry = yield* NpmRegistry;
 *   const tarball = yield* PackageTarball;
 *   const found = yield* registry.version("some-config", "1.2.3");
 *   if (O.isNone(found)) return O.none();
 *   const directory = yield* tarball.extract(found.value);
 *   return O.some(directory);
 * }).pipe(Effect.scoped);
 * ```
 *
 * @public
 */
export class PackageTarball extends Context.Service<PackageTarball, PackageTarballShape>()(
	$I`PackageTarball`,
) {
	/**
	 * The live service, over core's `FileSystem`, `Crypto`, `HttpClient` and
	 * `ChildProcessSpawner`. Pair it with {@link NpmRegistry.layer} to obtain the
	 * {@link PublishedVersion} that `extract` takes.
	 */
	static readonly layer: Layer.Layer<
		PackageTarball,
		never,
		FileSystem.FileSystem | Crypto.Crypto | HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner
	> = Layer.effect(PackageTarball)(make());
}
