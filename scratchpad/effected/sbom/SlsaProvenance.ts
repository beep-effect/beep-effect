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

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type { PredicateType } from "./InTotoStatement.ts";

const $I = $ScratchpadId.create("effected/sbom/SlsaProvenance");

/**
 * The SLSA Provenance v1 predicate type URI.
 *
 * **Example** (Identify the provenance predicate)
 *
 * ```ts
 * import { SLSA_PROVENANCE_V1 } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
 *
 * console.log(SLSA_PROVENANCE_V1) // https://slsa.dev/provenance/v1
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1" as const;

/**
 * The SLSA build type identifying a GitHub Actions workflow build.
 *
 * **Details**
 *
 * A published **SLSA build-type identifier** — it names a provenance shape, not
 * an Actions runtime detail — which is why it lives with the provenance model
 * rather than in `@effected/github-actions`.
 *
 * **Example** (Identify a GitHub Actions workflow build)
 *
 * ```ts
 * import { GITHUB_BUILD_TYPE } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
 *
 * console.log(GITHUB_BUILD_TYPE) // https://actions.github.io/buildtypes/workflow/v1
 * ```
 *
 * @see {@link https://github.com/slsa-framework/github-actions-buildtypes/tree/main/workflow/v1 | workflow/v1} for the GitHub Actions workflow build type specification
 * @public
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_BUILD_TYPE = "https://actions.github.io/buildtypes/workflow/v1" as const;

/**
 * How the build was invoked, and what it was invoked from.
 *
 * **Example** (Record the workflow and consumed commit)
 *
 * ```ts
 * import { GITHUB_BUILD_TYPE, SlsaBuildDefinition } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
 *
 * const definition = SlsaBuildDefinition.make({
 *   buildType: GITHUB_BUILD_TYPE,
 *   externalParameters: {
 *     workflow: {
 *       ref: "refs/heads/main",
 *       repository: "https://github.com/acme/app",
 *       path: ".github/workflows/release.yml",
 *     },
 *   },
 *   internalParameters: {
 *     github: {
 *       event_name: "push",
 *       repository_id: "1",
 *       repository_owner_id: "2",
 *       runner_environment: "github-hosted",
 *     },
 *   },
 *   resolvedDependencies: [{
 *     uri: "git+https://github.com/acme/app@refs/heads/main",
 *     digest: { gitCommit: "0123456789abcdef0123456789abcdef01234567" },
 *   }],
 * });
 * console.log(definition.externalParameters.workflow.path) // .github/workflows/release.yml
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SlsaBuildDefinition extends S.Class<SlsaBuildDefinition>($I`SlsaBuildDefinition`)({
	/** The build type URI — {@link GITHUB_BUILD_TYPE} for an Actions workflow. */
	buildType: S.String.annotateKey({ description: "The build type URI — GITHUB_BUILD_TYPE for an Actions workflow." }),
	/** Parameters an external party controls: for Actions, the workflow itself. */
	externalParameters: S.Struct({
		/** The workflow the build ran. */
		workflow: S.Struct({
			/** The git ref the workflow ran on. */
			ref: S.String.annotateKey({ description: "The git ref the workflow ran on." }),
			/** The repository's browsable URL. */
			repository: S.String.annotateKey({ description: "The repository's browsable URL." }),
			/** The workflow file's path within the repository. */
			path: S.String.annotateKey({ description: "The workflow file's path within the repository." }),
		}).annotateKey({ description: "The workflow the build ran." }),
	}).annotateKey({ description: "Parameters an external party controls: for Actions, the workflow itself." }),
	/** Parameters the build platform controls. */
	internalParameters: S.Struct({
		/** The Actions-specific half, spelled in the claim names the platform uses. */
		github: S.Struct({
			/** The event that triggered the workflow. */
			event_name: S.String.annotateKey({ description: "The event that triggered the workflow." }),
			/** The repository's numeric id. */
			repository_id: S.String.annotateKey({ description: "The repository's numeric id." }),
			/** The repository owner's numeric id. */
			repository_owner_id: S.String.annotateKey({ description: "The repository owner's numeric id." }),
			/** `github-hosted` or `self-hosted`. */
			runner_environment: S.String.annotateKey({ description: "github-hosted or self-hosted." }),
		}).annotateKey({ description: "The Actions-specific half, spelled in the claim names the platform uses." }),
	}).annotateKey({ description: "Parameters the build platform controls." }),
	/** The artifacts the build consumed — for Actions, the commit it built. */
	resolvedDependencies: S.Array(
		S.Struct({
			/** A URI naming the dependency. */
			uri: S.String.annotateKey({ description: "A URI naming the dependency." }),
			/** Algorithm to digest; `gitCommit` for a repository. */
			digest: S.Record(S.String, S.String).annotateKey({ description: "Algorithm to digest; gitCommit for a repository." }),
		}),
	).annotateKey({ description: "The artifacts the build consumed — for Actions, the commit it built." }),
}, $I.annote("SlsaBuildDefinition", { description: "How the build was invoked, and what it was invoked from." })) {}

/**
 * Who ran the build, and the record of that run.
 *
 * **Example** (Locate the workflow run attempt)
 *
 * ```ts
 * import { SlsaRunDetails } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
 *
 * const details = SlsaRunDetails.make({
 *   builder: { id: "https://github.com/acme/app/.github/workflows/release.yml@refs/heads/main" },
 *   metadata: { invocationId: "https://github.com/acme/app/actions/runs/3/attempts/1" },
 * });
 * console.log(details.metadata.invocationId) // https://github.com/acme/app/actions/runs/3/attempts/1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SlsaRunDetails extends S.Class<SlsaRunDetails>($I`SlsaRunDetails`)({
	/** The build platform's identity. */
	builder: S.Struct({
		/** A URI identifying the builder — the reusable workflow, for Actions. */
		id: S.String.annotateKey({ description: "A URI identifying the builder — the reusable workflow, for Actions." }),
	}).annotateKey({ description: "The build platform's identity." }),
	/** Metadata about this particular run. */
	metadata: S.Struct({
		/** A URI locating the run that produced the artifact. */
		invocationId: S.String.annotateKey({ description: "A URI locating the run that produced the artifact." }),
	}).annotateKey({ description: "Metadata about this particular run." }),
}, $I.annote("SlsaRunDetails", { description: "Who ran the build, and the record of that run." })) {}

/**
 * The claims and runner facts a GitHub Actions provenance predicate is built
 * from.
 *
 * **Details**
 *
 * A plain input record, **not** a service. There is nothing to swap and no IO
 * to invert — it is the argument to a data constructor.
 *
 * Fields are camelCase here and re-spelled to the platform's claim names where
 * the predicate demands it, so a caller reads its own vocabulary and the
 * emitted document keeps the specification's.
 *
 * **Example** (Decode GitHub workflow claims)
 *
 * ```ts
 * import { GitHubWorkflowProvenance } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
 * import * as S from "effect/Schema";
 *
 * const claims = S.decodeUnknownSync(GitHubWorkflowProvenance)({
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
 * console.log(claims.repository) // acme/app
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const GitHubWorkflowProvenance = S.Struct({
	/** The GitHub server's base URL — `https://github.com`, or a GHES host. */
	serverUrl: S.String.annotateKey({ description: "The GitHub server's base URL — https://github.com, or a GHES host." }),
	/** `owner/repo`. */
	repository: S.String.annotateKey({ description: "owner/repo." }),
	/** The git ref built. */
	ref: S.String.annotateKey({ description: "The git ref built." }),
	/** The commit built. */
	sha: S.String.annotateKey({ description: "The commit built." }),
	/** The event that triggered the workflow. */
	eventName: S.String.annotateKey({ description: "The event that triggered the workflow." }),
	/** The workflow reference: `owner/repo/.github/workflows/x.yml@ref`. */
	workflowRef: S.String.annotateKey({ description: "The workflow reference: owner/repo/.github/workflows/x.yml@ref." }),
	/** The job's workflow reference, which identifies the builder. */
	jobWorkflowRef: S.String.annotateKey({ description: "The job's workflow reference, which identifies the builder." }),
	/** The repository's numeric id. */
	repositoryId: S.String.annotateKey({ description: "The repository's numeric id." }),
	/** The repository owner's numeric id. */
	repositoryOwnerId: S.String.annotateKey({ description: "The repository owner's numeric id." }),
	/** `github-hosted` or `self-hosted`. */
	runnerEnvironment: S.String.annotateKey({ description: "github-hosted or self-hosted." }),
	/** The workflow run's id. */
	runId: S.String.annotateKey({ description: "The workflow run's id." }),
	/** Which attempt of that run this is. */
	runAttempt: S.String.annotateKey({ description: "Which attempt of that run this is." }),
}).pipe($I.annoteSchema("GitHubWorkflowProvenance", {
	description: "The claims and runner facts a GitHub Actions provenance predicate is built from.",
}));

/**
 * Decoded claims and runner facts accepted by the GitHub workflow provenance constructor.
 *
 * @see {@link GitHubWorkflowProvenance} for the runtime schema that validates these claims.
 * @category type-level
 * @since 0.0.0
 */
export type GitHubWorkflowProvenance = typeof GitHubWorkflowProvenance.Type;

/**
 * The workflow file's path, with the repository prefix and the `@ref` suffix
 * removed: `owner/repo/.github/workflows/x.yml@main` → `.github/workflows/x.yml`.
 *
 * **Details**
 *
 * Reproduces upstream's extraction exactly, first occurrence and first `@`
 * included — a divergence here is a divergence in the emitted predicate.
 */
const workflowPathOf = (input: GitHubWorkflowProvenance): string =>
	input.workflowRef.replace(`${input.repository}/`, "").replace(/@[\s\S]*$/, "");

/**
 * A SLSA Provenance v1 predicate.
 *
 * **Example** (Create provenance for a GitHub Actions workflow)
 *
 * ```ts
 * import { SlsaProvenance } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
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
 * console.log(provenance.buildDefinition.externalParameters.workflow.path) // .github/workflows/release.yml
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SlsaProvenance extends S.Class<SlsaProvenance>($I`SlsaProvenance`)({
	/** What was built, and from what. */
	buildDefinition: SlsaBuildDefinition.annotateKey({ description: "What was built, and from what." }),
	/** Who built it, and when. */
	runDetails: SlsaRunDetails.annotateKey({ description: "Who built it, and when." }),
}, $I.annote("SlsaProvenance", { description: "A SLSA Provenance v1 predicate." })) {
	/**
	 * The predicate type URI a statement carrying this must declare.
	 *
	 * **Example** (Select the statement predicate type)
	 *
	 * ```ts
	 * import { SlsaProvenance } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
	 *
	 * console.log(SlsaProvenance.predicateType) // https://slsa.dev/provenance/v1
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly predicateType: PredicateType = SLSA_PROVENANCE_V1;

	/**
	 * The build type this package's GitHub-workflow constructor stamps.
	 *
	 * **Example** (Read the constructor build type)
	 *
	 * ```ts
	 * import { SlsaProvenance } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
	 *
	 * console.log(SlsaProvenance.buildType) // https://actions.github.io/buildtypes/workflow/v1
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly buildType: string = GITHUB_BUILD_TYPE;

	/**
	 * Provenance for a GitHub Actions `workflow/v1` build.
	 *
	 * **Details**
	 *
	 * **Total** — a pure projection of its argument. Every value it needs is
	 * already in the input; nothing is read from the environment and nothing can
	 * fail.
	 *
	 * **Example** (Project claims into the workflow predicate)
	 *
	 * ```ts
	 * import { SlsaProvenance } from "@beep/scratchpad/effected/sbom/SlsaProvenance";
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
	 * console.log(provenance.runDetails.metadata.invocationId) // https://github.com/acme/app/actions/runs/3/attempts/1
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
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
