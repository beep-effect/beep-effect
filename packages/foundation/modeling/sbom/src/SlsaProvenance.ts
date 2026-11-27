/**
 * SLSA Provenance v1 for a GitHub Actions `workflow/v1` build.
 *
 * **Details**
 *
 * Design notes:
 *
 * 1. TYPED, not `Record<string, unknown>`: a verifier reading a malformed
 *    predicate fails far from the mistake.
 * 2. TOTAL, no error channel: string interpolation over already-present claims
 *    cannot throw.
 * 3. NO ambient `process.env`: `serverUrl` is a field. Reading
 *    `GITHUB_SERVER_URL` with no default would put the literal string
 *    `undefined` into every URL built from an unset variable; a required field
 *    cannot do that.
 *
 * The emitted shape is byte-compatible with `@actions/attest`'s
 * `attestProvenance`, because a verifier must see the same structure whichever
 * path produced the attestation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SbomId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PredicateType } from "./InTotoStatement.ts";

const $I = $SbomId.create("SlsaProvenance");

/**
 * The SLSA Provenance v1 predicate type URI.
 *
 * **Example** (Identify the provenance predicate)
 *
 * ```ts
 * import { SLSA_PROVENANCE_V1 } from "@beep/sbom/SlsaProvenance";
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
 * rather than in the effected `github-actions` driver module.
 *
 * **Example** (Identify a GitHub Actions workflow build)
 *
 * ```ts
 * import { GITHUB_BUILD_TYPE } from "@beep/sbom/SlsaProvenance";
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
 * **Example** (Record the workflow and consumed commit)
 *
 * ```ts
 * import { GITHUB_BUILD_TYPE, SlsaBuildDefinition } from "@beep/sbom/SlsaProvenance";
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
export class SlsaBuildDefinition extends S.Opaque<SlsaBuildDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The build type URI — {@link GITHUB_BUILD_TYPE} for an Actions workflow. */
    buildType: S.String.pipe(
      $I.annoteKey("SlsaBuildDefinition.buildType", {
        description: "The build type URI — GITHUB_BUILD_TYPE for an Actions workflow.",
      })
    ),
    /** Parameters an external party controls: for Actions, the workflow itself. */
    externalParameters: S.Struct({
      /** The workflow the build ran. */
      workflow: S.Struct({
        /** The git ref the workflow ran on. */
        ref: S.String.pipe(
          $I.annoteKey("SlsaBuildDefinition.externalParameters.workflow.ref", {
            description: "The git ref the workflow ran on.",
          })
        ),
        /** The repository's browsable URL. */
        repository: S.String.pipe(
          $I.annoteKey("SlsaBuildDefinition.externalParameters.workflow.repository", {
            description: "The repository's browsable URL.",
          })
        ),
        /** The workflow file's path within the repository. */
        path: S.String.pipe(
          $I.annoteKey("SlsaBuildDefinition.externalParameters.workflow.path", {
            description: "The workflow file's path within the repository.",
          })
        ),
      }).pipe(
        $I.annoteKey("SlsaBuildDefinition.externalParameters.workflow", { description: "The workflow the build ran." })
      ),
    }).pipe(
      $I.annoteKey("SlsaBuildDefinition.externalParameters", {
        description: "Parameters an external party controls: for Actions, the workflow itself.",
      })
    ),
    /** Parameters the build platform controls. */
    internalParameters: S.Struct({
      /** The Actions-specific half, spelled in the claim names the platform uses. */
      github: S.Struct({
        /** The event that triggered the workflow. */
        event_name: S.String.pipe(
          $I.annoteKey("SlsaBuildDefinition.internalParameters.github.event_name", {
            description: "The event that triggered the workflow.",
          })
        ),
        /** The repository's numeric id. */
        repository_id: S.String.pipe(
          $I.annoteKey("SlsaBuildDefinition.internalParameters.github.repository_id", {
            description: "The repository's numeric id.",
          })
        ),
        /** The repository owner's numeric id. */
        repository_owner_id: S.String.pipe(
          $I.annoteKey("SlsaBuildDefinition.internalParameters.github.repository_owner_id", {
            description: "The repository owner's numeric id.",
          })
        ),
        /** `github-hosted` or `self-hosted`. */
        runner_environment: S.String.pipe(
          $I.annoteKey("SlsaBuildDefinition.internalParameters.github.runner_environment", {
            description: "github-hosted or self-hosted.",
          })
        ),
      }).pipe(
        $I.annoteKey("SlsaBuildDefinition.internalParameters.github", {
          description: "The Actions-specific half, spelled in the claim names the platform uses.",
        })
      ),
    }).pipe(
      $I.annoteKey("SlsaBuildDefinition.internalParameters", { description: "Parameters the build platform controls." })
    ),
    /** The artifacts the build consumed — for Actions, the commit it built. */
    resolvedDependencies: S.Array(
      S.Struct({
        /** A URI naming the dependency. */
        uri: S.String.pipe(
          $I.annoteKey("SlsaBuildDefinition.resolvedDependencies.uri", { description: "A URI naming the dependency." })
        ),
        /** Algorithm to digest; `gitCommit` for a repository. */
        digest: S.Record(S.String, S.String).pipe(
          $I.annoteKey("SlsaBuildDefinition.resolvedDependencies.digest", {
            description: "Algorithm to digest; gitCommit for a repository.",
          })
        ),
      })
    ).pipe(
      $I.annoteKey("SlsaBuildDefinition.resolvedDependencies", {
        description: "The artifacts the build consumed — for Actions, the commit it built.",
      })
    ),
  }).pipe(
    $I.annoteSchema("SlsaBuildDefinition", { description: "How the build was invoked, and what it was invoked from." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SlsaBuildDefinition {
  /**
   * The plain object a {@link SlsaBuildDefinition} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SlsaBuildDefinition.Encoded;
}

/**
 * **Example** (Locate the workflow run attempt)
 *
 * ```ts
 * import { SlsaRunDetails } from "@beep/sbom/SlsaProvenance";
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
export class SlsaRunDetails extends S.Opaque<SlsaRunDetails, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The build platform's identity. */
    builder: S.Struct({
      /** A URI identifying the builder — the reusable workflow, for Actions. */
      id: S.String.pipe(
        $I.annoteKey("SlsaRunDetails.builder.id", {
          description: "A URI identifying the builder — the reusable workflow, for Actions.",
        })
      ),
    }).pipe($I.annoteKey("SlsaRunDetails.builder", { description: "The build platform's identity." })),
    /** Metadata about this particular run. */
    metadata: S.Struct({
      /** A URI locating the run that produced the artifact. */
      invocationId: S.String.pipe(
        $I.annoteKey("SlsaRunDetails.metadata.invocationId", {
          description: "A URI locating the run that produced the artifact.",
        })
      ),
    }).pipe($I.annoteKey("SlsaRunDetails.metadata", { description: "Metadata about this particular run." })),
  }).pipe($I.annoteSchema("SlsaRunDetails", { description: "Who ran the build, and the record of that run." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SlsaRunDetails {
  /**
   * The plain object a {@link SlsaRunDetails} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SlsaRunDetails.Encoded;
}

/**
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
 * import { GitHubWorkflowProvenance } from "@beep/sbom/SlsaProvenance";
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
export class GitHubWorkflowProvenance extends S.Opaque<GitHubWorkflowProvenance, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The GitHub server's base URL — `https://github.com`, or a GHES host. */
    serverUrl: S.String.pipe(
      $I.annoteKey("GitHubWorkflowProvenance.serverUrl", {
        description: "The GitHub server's base URL — https://github.com, or a GHES host.",
      })
    ),
    /** `owner/repo`. */
    repository: S.String.pipe($I.annoteKey("GitHubWorkflowProvenance.repository", { description: "owner/repo." })),
    /** The git ref built. */
    ref: S.String.pipe($I.annoteKey("GitHubWorkflowProvenance.ref", { description: "The git ref built." })),
    /** The commit built. */
    sha: S.String.pipe($I.annoteKey("GitHubWorkflowProvenance.sha", { description: "The commit built." })),
    /** The event that triggered the workflow. */
    eventName: S.String.pipe(
      $I.annoteKey("GitHubWorkflowProvenance.eventName", { description: "The event that triggered the workflow." })
    ),
    /** The workflow reference: `owner/repo/.github/workflows/x.yml@ref`. */
    workflowRef: S.String.pipe(
      $I.annoteKey("GitHubWorkflowProvenance.workflowRef", {
        description: "The workflow reference: owner/repo/.github/workflows/x.yml@ref.",
      })
    ),
    /** The job's workflow reference, which identifies the builder. */
    jobWorkflowRef: S.String.pipe(
      $I.annoteKey("GitHubWorkflowProvenance.jobWorkflowRef", {
        description: "The job's workflow reference, which identifies the builder.",
      })
    ),
    /** The repository's numeric id. */
    repositoryId: S.String.pipe(
      $I.annoteKey("GitHubWorkflowProvenance.repositoryId", { description: "The repository's numeric id." })
    ),
    /** The repository owner's numeric id. */
    repositoryOwnerId: S.String.pipe(
      $I.annoteKey("GitHubWorkflowProvenance.repositoryOwnerId", { description: "The repository owner's numeric id." })
    ),
    /** `github-hosted` or `self-hosted`. */
    runnerEnvironment: S.String.pipe(
      $I.annoteKey("GitHubWorkflowProvenance.runnerEnvironment", { description: "github-hosted or self-hosted." })
    ),
    /** The workflow run's id. */
    runId: S.String.pipe($I.annoteKey("GitHubWorkflowProvenance.runId", { description: "The workflow run's id." })),
    /** Which attempt of that run this is. */
    runAttempt: S.String.pipe(
      $I.annoteKey("GitHubWorkflowProvenance.runAttempt", { description: "Which attempt of that run this is." })
    ),
  }).pipe(
    $I.annoteSchema("GitHubWorkflowProvenance", {
      description: "The claims and runner facts a GitHub Actions provenance predicate is built from.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GitHubWorkflowProvenance {
  /**
   * The plain object a {@link GitHubWorkflowProvenance} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GitHubWorkflowProvenance.Encoded;
}

const workflowPathOf = (input: GitHubWorkflowProvenance.Encoded): string =>
  Str.replace(/@[\s\S]*$/, "")(Str.replace(`${input.repository}/`, "")(input.workflowRef));

/**
 * **Example** (Create provenance for a GitHub Actions workflow)
 *
 * ```ts
 * import { SlsaProvenance } from "@beep/sbom/SlsaProvenance";
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
export class SlsaProvenance extends S.Opaque<SlsaProvenance, { readonly brand: unique symbol }>()(
  S.Struct({
    /** What was built, and from what. */
    buildDefinition: SlsaBuildDefinition.pipe(
      $I.annoteKey("SlsaProvenance.buildDefinition", { description: "What was built, and from what." })
    ),
    /** Who built it, and when. */
    runDetails: SlsaRunDetails.pipe(
      $I.annoteKey("SlsaProvenance.runDetails", { description: "Who built it, and when." })
    ),
  }).pipe($I.annoteSchema("SlsaProvenance", { description: "A SLSA Provenance v1 predicate." }))
) {
  /**
   * The predicate type URI a statement carrying this must declare.
   *
   * **Example** (Select the statement predicate type)
   *
   * ```ts
   * import { SlsaProvenance } from "@beep/sbom/SlsaProvenance";
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
   * import { SlsaProvenance } from "@beep/sbom/SlsaProvenance";
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
   * **Gotchas**
   *
   * The workflow `path` is `workflowRef` with the repository prefix and the
   * `@ref` suffix removed (`owner/repo/.github/workflows/x.yml@main` →
   * `.github/workflows/x.yml`), reproducing `@actions/attest`'s extraction
   * exactly, first occurrence and first `@` included: a divergence here is a
   * divergence in the emitted predicate.
   *
   * **Example** (Project claims into the workflow predicate)
   *
   * ```ts
   * import { SlsaProvenance } from "@beep/sbom/SlsaProvenance";
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
  static forGitHubWorkflow(input: GitHubWorkflowProvenance.Encoded): SlsaProvenance {
    return SlsaProvenance.make({
      buildDefinition: {
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
      },
      runDetails: {
        builder: { id: `${input.serverUrl}/${input.jobWorkflowRef}` },
        metadata: {
          invocationId: `${input.serverUrl}/${input.repository}/actions/runs/${input.runId}/attempts/${input.runAttempt}`,
        },
      },
    });
  }
}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SlsaProvenance {
  /**
   * The plain object a {@link SlsaProvenance} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SlsaProvenance.Encoded;
}
