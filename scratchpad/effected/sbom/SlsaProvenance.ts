// SLSA Provenance v1 for a GitHub Actions `workflow/v1` build.
//
// Design notes:
//
// 1. TYPED, not `Record<string, unknown>`: a verifier reading a malformed
//    predicate fails far from the mistake.
// 2. TOTAL, no error channel: string interpolation over already-present claims
//    cannot throw.
// 3. NO ambient `process.env`: `serverUrl` is a field. Reading
//    `GITHUB_SERVER_URL` with no default would put the literal string
//    `undefined` into every URL built from an unset variable; a required field
//    cannot do that.
//
// The emitted shape is byte-compatible with `@actions/attest`'s
// `attestProvenance`, because a verifier must see the same structure whichever
// path produced the attestation.

import { Schema } from "effect";
import type { PredicateType } from "./InTotoStatement.ts";

/**
 * The SLSA Provenance v1 predicate type URI.
 *
 * @public
 */
export const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1" as const;

/**
 * The SLSA build type identifying a GitHub Actions workflow build.
 *
 * @remarks
 * A published **SLSA build-type identifier** — it names a provenance shape, not
 * an Actions runtime detail — which is why it lives with the provenance model
 * rather than in `@effected/github-actions`.
 *
 * @see {@link https://github.com/slsa-framework/github-actions-buildtypes/tree/main/workflow/v1 | workflow/v1}
 *
 * @public
 */
export const GITHUB_BUILD_TYPE = "https://actions.github.io/buildtypes/workflow/v1" as const;

/**
 * How the build was invoked, and what it was invoked from.
 *
 * @public
 */
export class SlsaBuildDefinition extends Schema.Class<SlsaBuildDefinition>("SlsaBuildDefinition")({
	/** The build type URI — {@link GITHUB_BUILD_TYPE} for an Actions workflow. */
	buildType: Schema.String,
	/** Parameters an external party controls: for Actions, the workflow itself. */
	externalParameters: Schema.Struct({
		/** The workflow the build ran. */
		workflow: Schema.Struct({
			/** The git ref the workflow ran on. */
			ref: Schema.String,
			/** The repository's browsable URL. */
			repository: Schema.String,
			/** The workflow file's path within the repository. */
			path: Schema.String,
		}),
	}),
	/** Parameters the build platform controls. */
	internalParameters: Schema.Struct({
		/** The Actions-specific half, spelled in the claim names the platform uses. */
		github: Schema.Struct({
			/** The event that triggered the workflow. */
			event_name: Schema.String,
			/** The repository's numeric id. */
			repository_id: Schema.String,
			/** The repository owner's numeric id. */
			repository_owner_id: Schema.String,
			/** `github-hosted` or `self-hosted`. */
			runner_environment: Schema.String,
		}),
	}),
	/** The artifacts the build consumed — for Actions, the commit it built. */
	resolvedDependencies: Schema.Array(
		Schema.Struct({
			/** A URI naming the dependency. */
			uri: Schema.String,
			/** Algorithm to digest; `gitCommit` for a repository. */
			digest: Schema.Record(Schema.String, Schema.String),
		}),
	),
}) {}

/**
 * Who ran the build, and the record of that run.
 *
 * @public
 */
export class SlsaRunDetails extends Schema.Class<SlsaRunDetails>("SlsaRunDetails")({
	/** The build platform's identity. */
	builder: Schema.Struct({
		/** A URI identifying the builder — the reusable workflow, for Actions. */
		id: Schema.String,
	}),
	/** Metadata about this particular run. */
	metadata: Schema.Struct({
		/** A URI locating the run that produced the artifact. */
		invocationId: Schema.String,
	}),
}) {}

/**
 * The claims and runner facts a GitHub Actions provenance predicate is built
 * from.
 *
 * @remarks
 * A plain input record, **not** a service. There is nothing to swap and no IO
 * to invert — it is the argument to a data constructor.
 *
 * Fields are camelCase here and re-spelled to the platform's claim names where
 * the predicate demands it, so a caller reads its own vocabulary and the
 * emitted document keeps the specification's.
 *
 * @public
 */
export interface GitHubWorkflowProvenance {
	/** The GitHub server's base URL — `https://github.com`, or a GHES host. */
	readonly serverUrl: string;
	/** `owner/repo`. */
	readonly repository: string;
	/** The git ref built. */
	readonly ref: string;
	/** The commit built. */
	readonly sha: string;
	/** The event that triggered the workflow. */
	readonly eventName: string;
	/** The workflow reference: `owner/repo/.github/workflows/x.yml@ref`. */
	readonly workflowRef: string;
	/** The job's workflow reference, which identifies the builder. */
	readonly jobWorkflowRef: string;
	/** The repository's numeric id. */
	readonly repositoryId: string;
	/** The repository owner's numeric id. */
	readonly repositoryOwnerId: string;
	/** `github-hosted` or `self-hosted`. */
	readonly runnerEnvironment: string;
	/** The workflow run's id. */
	readonly runId: string;
	/** Which attempt of that run this is. */
	readonly runAttempt: string;
}

/**
 * The workflow file's path, with the repository prefix and the `@ref` suffix
 * removed: `owner/repo/.github/workflows/x.yml@main` → `.github/workflows/x.yml`.
 *
 * Reproduces upstream's extraction exactly, first occurrence and first `@`
 * included — a divergence here is a divergence in the emitted predicate.
 */
const workflowPathOf = (input: GitHubWorkflowProvenance): string =>
	input.workflowRef.replace(`${input.repository}/`, "").split("@")[0] ?? "";

/**
 * A SLSA Provenance v1 predicate.
 *
 * @example
 * ```ts
 * import { SlsaProvenance } from "./index.ts";
 *
 * const provenance = SlsaProvenance.forGitHubWorkflow({
 *   serverUrl: "https://github.com",
 *   repository: "acme/app",
 *   ref: "refs/heads/main",
 *   sha: "0123456789abcdef0123456789abcdef01234567",
 *   eventName: "push",
 *   workflowRef: "acme/app/.github/workflows/release.yml@refs/heads/main",
 *   jobWorkflowRef: "acme/app/.github/workflows/release.yml@refs/heads/main",
 *   repositoryId: "1",
 *   repositoryOwnerId: "2",
 *   runnerEnvironment: "github-hosted",
 *   runId: "3",
 *   runAttempt: "1",
 * });
 * ```
 *
 * @public
 */
export class SlsaProvenance extends Schema.Class<SlsaProvenance>("SlsaProvenance")({
	/** What was built, and from what. */
	buildDefinition: SlsaBuildDefinition,
	/** Who built it, and when. */
	runDetails: SlsaRunDetails,
}) {
	/** The predicate type URI a statement carrying this must declare. */
	static readonly predicateType: PredicateType = SLSA_PROVENANCE_V1;

	/** The build type this package's GitHub-workflow constructor stamps. */
	static readonly buildType: string = GITHUB_BUILD_TYPE;

	/**
	 * Provenance for a GitHub Actions `workflow/v1` build.
	 *
	 * @remarks
	 * **Total** — a pure projection of its argument. Every value it needs is
	 * already in the input; nothing is read from the environment and nothing can
	 * fail.
	 */
	static forGitHubWorkflow(input: GitHubWorkflowProvenance): SlsaProvenance {
		return SlsaProvenance.make({
			buildDefinition: SlsaBuildDefinition.make({
				buildType: GITHUB_BUILD_TYPE,
				externalParameters: {
					workflow: {
						ref: input.ref,
						repository: `${input.serverUrl}/${input.repository}`,
						path: workflowPathOf(input),
					},
				},
				internalParameters: {
					github: {
						event_name: input.eventName,
						repository_id: input.repositoryId,
						repository_owner_id: input.repositoryOwnerId,
						runner_environment: input.runnerEnvironment,
					},
				},
				resolvedDependencies: [
					{
						uri: `git+${input.serverUrl}/${input.repository}@${input.ref}`,
						digest: { gitCommit: input.sha },
					},
				],
			}),
			runDetails: SlsaRunDetails.make({
				builder: { id: `${input.serverUrl}/${input.jobWorkflowRef}` },
				metadata: {
					invocationId: `${input.serverUrl}/${input.repository}/actions/runs/${input.runId}/attempts/${input.runAttempt}`,
				},
			}),
		});
	}
}
