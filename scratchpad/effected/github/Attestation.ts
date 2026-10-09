import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";

/**
 * The api-version this surface pins.
 *
 * @remarks
 * The legacy shape, which inlines the whole bundle in the listing, is deprecated
 * with a stated sunset. Pinning the version means the response is on a contract
 * the generated types do not describe — which is why this module is the one that
 * uses `requestDecoded` with owned schemas rather than the route table.
 */
const API_VERSION = "2026-03-10";

/**
 * A stored attestation.
 *
 * @public
 */
export class AttestationRecord extends S.Class<AttestationRecord>("AttestationRecord")({
	/** GitHub's id for it, when the response carried one. */
	id: S.optionalKey(S.Int),
	/** Where a human can look at it. */
	url: S.String,
}) {}

/**
 * One entry from an attestation listing.
 *
 * @public
 */
export class AttestationListEntry extends S.Class<AttestationListEntry>("AttestationListEntry")({
	/** Where the bundle lives. */
	url: S.String,
	/** The in-toto predicate type, when the listing reported one. */
	predicateType: S.optionalKey(S.String),
}) {}

const UploadResponse = S.Struct({ id: S.optionalKey(S.Int) });

const ListResponse = S.Struct({
	attestations: S.Struct({
		id: S.optionalKey(S.Int),
		bundle_url: S.optionalKey(S.String),
		predicate_type: S.optionalKey(S.String),
	}).pipe(S.Array, S.optionalKey),
});

/**
 * The attestation REST surface.
 *
 * @remarks
 * Upload and listing only. Building a statement, signing it and producing the
 * bundle belong to `@effected/sbom`; assembling those into a pipeline belongs to
 * the consumer.
 *
 * @public
 */
export interface AttestationShape {
	/** Store a signed bundle against the repository. */
	readonly upload: (bundle: unknown) => Effect.Effect<AttestationRecord, GitHubError, Repo>;
	/**
	 * Everything attested about a subject digest.
	 *
	 * @remarks
	 * **404 and 422 both mean "none"**, not "broken" — GitHub answers a digest it
	 * has never seen either way depending on the path, and a caller asking "is
	 * this attested?" wants an empty list for both.
	 */
	readonly listForSubject: (
		sha256: string,
		options?: { readonly predicateType?: string | undefined },
	) => Effect.Effect<ReadonlyArray<AttestationListEntry>, GitHubError, Repo>;
}

/**
 * Uploads signed attestation bundles to a repository and lists what is attested
 * about a subject digest.
 *
 * @remarks
 * Provide it with {@link Attestation.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * @public
 */
export class Attestation extends Context.Service<Attestation, AttestationShape>()("@beep/scratchpad/effected/github/Attestation") {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<Attestation, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<AttestationShape> = {}): AttestationShape => ({
		upload: overrides.upload ?? (() => unstubbed("upload")),
		listForSubject: overrides.listForSubject ?? (() => unstubbed("listForSubject")),
	});

	/** {@link Attestation.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<AttestationShape> = {}): Layer.Layer<Attestation> =>
		Layer.succeed(Attestation, Attestation.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`Attestation.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

const make = (client: GitHubClient["Service"]): AttestationShape => ({
	upload: Effect.fn("Attestation.upload")(function* (bundle: unknown) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo });
		const stored = yield* client.requestDecoded(
			"POST /repos/{owner}/{repo}/attestations",
			{ owner, repo, bundle, headers: { "x-github-api-version": API_VERSION } },
			UploadResponse,
		);
		return AttestationRecord.make({
			...(stored.id !== undefined ? { id: stored.id } : {}),
			url: `https://github.com/${owner}/${repo}/attestations/${stored.id ?? ""}`,
		});
	}),

	listForSubject: Effect.fn("Attestation.listForSubject")(function* (
		sha256: string,
		options?: { readonly predicateType?: string | undefined },
	) {
		const { owner, repo } = yield* Repo;
		const digest = sha256.startsWith("sha256:") ? sha256 : `sha256:${sha256}`;
		yield* Effect.annotateCurrentSpan({ owner, repo, digest });
		const listed = yield* client
			.requestDecoded(
				"GET /repos/{owner}/{repo}/attestations/{subject_digest}",
				{
					owner,
					repo,
					subject_digest: digest,
					...(options?.predicateType !== undefined ? { predicate_type: options.predicateType } : {}),
					headers: { "x-github-api-version": API_VERSION },
				},
				ListResponse,
			)
			.pipe(
				Effect.catchIf(
					(error) => error.kind === "notFound" || (error.status === 422 && error.kind === "rejected"),
					() => Effect.succeed({ attestations: [] as ReadonlyArray<never> }),
				),
			);
		return (listed.attestations ?? []).flatMap((entry) => {
			const url =
				entry.bundle_url ??
				(entry.id !== undefined ? `https://github.com/${owner}/${repo}/attestations/${entry.id}` : undefined);
			if (url === undefined) return [];
			return [
				AttestationListEntry.make({
					url,
					...(entry.predicate_type !== undefined ? { predicateType: entry.predicate_type } : {}),
				}),
			];
		});
	}),
});
