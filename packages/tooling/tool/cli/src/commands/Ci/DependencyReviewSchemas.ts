/**
 * Schemas for the manifest-aware dependency review: the GitHub dependency-graph
 * compare response, the declared fixture-path policy, the review thresholds and
 * the review verdict.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/DependencyReviewSchemas");

/**
 * Whether a compare row adds or removes a dependency at the head revision.
 *
 * **Example** (Recognize an added row)
 *
 * ```ts
 * import { DependencyChangeType } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(DependencyChangeType.is.added("added")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DependencyChangeType = LiteralKit(["added", "removed"]).pipe(
  $I.annoteSchema("DependencyChangeType", { description: "Dependency-graph compare change type." })
);

/**
 * Change type carried by one compare row.
 *
 * @category models
 * @since 0.0.0
 */
export type DependencyChangeType = typeof DependencyChangeType.Type;

/**
 * Dependency scope GitHub assigns to a compare row.
 *
 * **Details**
 *
 * A row without a scope is treated as `runtime`, as the dependency-review
 * action does for GitHub Enterprise Server responses.
 *
 * **Example** (Recognize a development row)
 *
 * ```ts
 * import { DependencyScope } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(DependencyScope.is.development("development")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DependencyScope = LiteralKit(["unknown", "runtime", "development"]).pipe(
  $I.annoteSchema("DependencyScope", { description: "Dependency-graph compare dependency scope." })
);

/**
 * Scope carried by one compare row.
 *
 * @category models
 * @since 0.0.0
 */
export type DependencyScope = typeof DependencyScope.Type;

/**
 * GitHub advisory severity, most severe first.
 *
 * **Example** (Recognize a high advisory)
 *
 * ```ts
 * import { AdvisorySeverity } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(AdvisorySeverity.is.high("high")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdvisorySeverity = LiteralKit(["critical", "high", "moderate", "low"]).pipe(
  $I.annoteSchema("AdvisorySeverity", { description: "GitHub advisory severity, most severe first." })
);

/**
 * One advisory severity.
 *
 * @category models
 * @since 0.0.0
 */
export type AdvisorySeverity = typeof AdvisorySeverity.Type;

/**
 * One advisory attached to a compare row.
 *
 * **Details**
 *
 * A missing severity decodes as `low`, matching the dependency-review action's
 * schema default.
 *
 * **Example** (Decode an advisory without a severity)
 *
 * ```ts
 * import { DependencyVulnerability } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * const advisory = S.decodeUnknownSync(DependencyVulnerability)({
 *   advisory_ghsa_id: "GHSA-r5fr-rjxr-66jc",
 *   advisory_summary: "lodash code injection",
 *   advisory_url: "https://github.com/advisories/GHSA-r5fr-rjxr-66jc",
 * })
 * console.log(advisory.severity) // "low"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependencyVulnerability extends S.Opaque<DependencyVulnerability, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: AdvisorySeverity.pipe(S.withDecodingDefaultKey(Effect.succeed<AdvisorySeverity>("low"))),
    advisory_ghsa_id: S.String,
    advisory_summary: S.String,
    advisory_url: S.String,
  }).pipe($I.annoteSchema("DependencyVulnerability", { description: "One advisory attached to a compare row." }))
) {}

/**
 * One row of `GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}`.
 *
 * **Details**
 *
 * Rows are per manifest. A lockfile manifest (`uv.lock`, `Cargo.lock`,
 * `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`) reports its transitive
 * packages as ordinary rows, so per-manifest filtering keeps transitive
 * advisories for every manifest it does not exclude.
 *
 * **Example** (Decode a recorded row)
 *
 * ```ts
 * import { DependencyChange } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(DependencyChange)({
 *   change_type: "added",
 *   manifest: "packages/tooling/tool/cli/python/photo-face/uv.lock",
 *   ecosystem: "pip",
 *   name: "urllib3",
 *   version: "2.7.0",
 *   package_url: "pkg:pypi/urllib3@2.7.0",
 *   license: "MIT",
 *   source_repository_url: "https://github.com/urllib3/urllib3",
 *   scope: "runtime",
 * })
 * console.log(row.vulnerabilities.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependencyChange extends S.Opaque<DependencyChange, { readonly brand: unique symbol }>()(
  S.Struct({
    change_type: DependencyChangeType,
    manifest: S.String,
    ecosystem: S.String,
    name: S.String,
    version: S.String,
    package_url: S.NullOr(S.String),
    license: S.NullOr(S.String),
    source_repository_url: S.NullOr(S.String),
    scope: S.optionalKey(DependencyScope),
    vulnerabilities: S.Array(DependencyVulnerability).pipe(
      S.withDecodingDefaultKey(Effect.succeed<ReadonlyArray<typeof DependencyVulnerability.Encoded>>([]))
    ),
  }).pipe($I.annoteSchema("DependencyChange", { description: "One dependency-graph compare row." }))
) {}

/**
 * One page of the compare response: the rows GitHub returns for one
 * `per_page`/`page` request.
 *
 * **Details**
 *
 * GitHub's `per_page` counts manifests, not rows, and a page may be empty in
 * the middle of the sequence. Only the `Link` header's `rel="next"` says whether
 * another page follows.
 *
 * **Example** (Decode an empty page)
 *
 * ```ts
 * import { DependencyGraphComparePage } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(DependencyGraphComparePage)([]).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DependencyGraphComparePage = DependencyChange.pipe(
  S.Array,
  $I.annoteSchema("DependencyGraphComparePage", { description: "One page of dependency-graph compare rows." })
);

/**
 * One decoded compare page.
 *
 * @category models
 * @since 0.0.0
 */
export type DependencyGraphComparePage = typeof DependencyGraphComparePage.Type;

/**
 * Several compare pages, one array of rows per page, as recorded fixtures store
 * them.
 *
 * **Example** (Decode two recorded pages)
 *
 * ```ts
 * import { DependencyGraphComparePages } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(DependencyGraphComparePages)([[], []]).length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DependencyGraphComparePages = DependencyGraphComparePage.pipe(
  S.Array,
  $I.annoteSchema("DependencyGraphComparePages", {
    description: "Paginated dependency-graph compare rows, one array per page.",
  })
);

/**
 * Decoded compare pages.
 *
 * @category models
 * @since 0.0.0
 */
export type DependencyGraphComparePages = typeof DependencyGraphComparePages.Type;

/**
 * A repository-relative manifest path pattern made of literal segments and
 * `**` (zero or more segments).
 *
 * **Details**
 *
 * Single-segment wildcards and character classes are rejected on purpose: a
 * fixture root is named by whole path segments, so a production path that only
 * resembles one (`test-fixtures`, `tests/fixtures`) never matches.
 *
 * **Example** (Accept a segment glob and reject a partial wildcard)
 *
 * ```ts
 * import { FixturePathPattern } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FixturePathPattern)("**\/test/**\/fixtures/**")) // true
 * console.log(S.is(FixturePathPattern)("**\/test*\/**")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FixturePathPattern = S.String.check(
  S.isPattern(/^(?:\*\*|[A-Za-z0-9._-]+)(?:\/(?:\*\*|[A-Za-z0-9._-]+))*$/u, {
    message: "a fixture path pattern is '/'-separated literal segments or '**'",
  })
).pipe(
  $I.annoteSchema("FixturePathPattern", {
    description: "Manifest path pattern of literal segments and '**' wildcards.",
  })
);

/**
 * One declared fixture root and why its manifests are synthetic.
 *
 * **Example** (Declare a fixture root)
 *
 * ```ts
 * import { FixturePathRule } from "@beep/repo-cli/commands/Ci"
 *
 * const rule = FixturePathRule.make({ pattern: "**\/test/**\/fixtures/**", reason: "test inputs" })
 * console.log(rule.pattern) // "**\/test/**\/fixtures/**"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FixturePathRule extends S.Opaque<FixturePathRule, { readonly brand: unique symbol }>()(
  S.Struct({
    pattern: FixturePathPattern,
    reason: S.NonEmptyString,
  }).pipe($I.annoteSchema("FixturePathRule", { description: "One declared synthetic-fixture manifest root." }))
) {}

/**
 * The reviewable policy naming every manifest root that holds synthetic test
 * input rather than installed dependencies.
 *
 * **Example** (Build a one-rule policy)
 *
 * ```ts
 * import { FixturePathPolicy, FixturePathRule } from "@beep/repo-cli/commands/Ci"
 *
 * const rule = FixturePathRule.make({ pattern: "**\/test/**\/fixtures/**", reason: "test inputs" })
 * const policy = FixturePathPolicy.make({ rules: [rule] })
 * console.log(policy.rules.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FixturePathPolicy extends S.Opaque<FixturePathPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    rules: S.NonEmptyArray(FixturePathRule),
  }).pipe(
    $I.annoteSchema("FixturePathPolicy", {
      description: "Declared manifest roots excluded from dependency review as synthetic fixtures.",
    })
  )
) {}

/**
 * The repository's fixture-path policy for dependency review.
 *
 * **Details**
 *
 * One rule: a manifest is a synthetic fixture when a `fixtures` path segment
 * follows a `test` path segment. That covers every test-fixture root the
 * dependency graph reports today (`scratchpad/test/**\/fixtures/**`,
 * `packages/**\/test/fixtures/**`). Every other manifest is production and is
 * reviewed in full. Changing this constant changes what CI ignores, so the
 * command prints the active rules in every summary.
 *
 * **Example** (Read the declared rule)
 *
 * ```ts
 * import { dependencyReviewFixturePolicy } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(dependencyReviewFixturePolicy.rules[0].pattern) // "**\/test/**\/fixtures/**"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const dependencyReviewFixturePolicy = FixturePathPolicy.make({
  rules: [
    FixturePathRule.make({
      pattern: "**/test/**/fixtures/**",
      reason: "Test fixture trees hold captured or synthetic manifests that tests read as data; nothing installs them.",
    }),
  ],
});

/**
 * Licenses whose addition fails dependency review.
 *
 * **Example** (Recognize a denied license)
 *
 * ```ts
 * import { DeniedLicense } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(DeniedLicense.is["GPL-3.0"]("GPL-3.0")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeniedLicense = LiteralKit(["AGPL-3.0", "GPL-3.0"]).pipe(
  $I.annoteSchema("DeniedLicense", { description: "SPDX license whose addition fails dependency review." })
);

/**
 * One denied license.
 *
 * @category models
 * @since 0.0.0
 */
export type DeniedLicense = typeof DeniedLicense.Type;

/**
 * Severity, scope and license thresholds a reviewed row is held to.
 *
 * **Example** (Build the thresholds)
 *
 * ```ts
 * import { DependencyReviewThresholds } from "@beep/repo-cli/commands/Ci"
 *
 * const thresholds = DependencyReviewThresholds.make({
 *   failOnSeverity: "high",
 *   failOnScopes: ["runtime"],
 *   denyLicenses: ["AGPL-3.0", "GPL-3.0"],
 * })
 * console.log(thresholds.failOnSeverity) // "high"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependencyReviewThresholds extends S.Opaque<
  DependencyReviewThresholds,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    failOnSeverity: AdvisorySeverity,
    failOnScopes: S.NonEmptyArray(DependencyScope),
    denyLicenses: S.NonEmptyArray(DeniedLicense),
  }).pipe(
    $I.annoteSchema("DependencyReviewThresholds", {
      description: "Severity, scope and license thresholds for dependency review.",
    })
  )
) {}

/**
 * The thresholds the pinned dependency-review-action step enforced:
 * `fail-on-severity: high`, the action's default `fail-on-scopes: runtime`, and
 * `deny-licenses: AGPL-3.0, GPL-3.0`.
 *
 * **Example** (Read the denied licenses)
 *
 * ```ts
 * import { dependencyReviewThresholds } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(dependencyReviewThresholds.denyLicenses) // ["AGPL-3.0", "GPL-3.0"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const dependencyReviewThresholds = DependencyReviewThresholds.make({
  failOnSeverity: "high",
  failOnScopes: ["runtime"],
  denyLicenses: ["AGPL-3.0", "GPL-3.0"],
});

/**
 * The fixture policy and thresholds one dependency review runs with.
 *
 * **Example** (Pair the repository policy with the repository thresholds)
 *
 * ```ts
 * import {
 *   DependencyReviewSettings,
 *   dependencyReviewFixturePolicy,
 *   dependencyReviewThresholds,
 * } from "@beep/repo-cli/commands/Ci"
 *
 * const settings = DependencyReviewSettings.make({
 *   policy: dependencyReviewFixturePolicy,
 *   thresholds: dependencyReviewThresholds,
 * })
 * console.log(settings.thresholds.failOnSeverity) // "high"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependencyReviewSettings extends S.Opaque<DependencyReviewSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    policy: FixturePathPolicy,
    thresholds: DependencyReviewThresholds,
  }).pipe(
    $I.annoteSchema("DependencyReviewSettings", {
      description: "Fixture policy and thresholds for one dependency review.",
    })
  )
) {}

/**
 * The repository's dependency review settings:
 * {@link dependencyReviewFixturePolicy} with {@link dependencyReviewThresholds}.
 *
 * **Example** (Read the active fixture rule)
 *
 * ```ts
 * import { dependencyReviewSettings } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(dependencyReviewSettings.policy.rules.length) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const dependencyReviewSettings = DependencyReviewSettings.make({
  policy: dependencyReviewFixturePolicy,
  thresholds: dependencyReviewThresholds,
});

/**
 * A full 40-character lowercase commit SHA.
 *
 * **Example** (Reject an abbreviated SHA)
 *
 * ```ts
 * import { CommitSha } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CommitSha)("d1f3330135")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CommitSha = S.String.check(
  S.isPattern(/^[0-9a-f]{40}$/u, { message: "expected a full 40-character lowercase commit SHA" })
).pipe($I.annoteSchema("CommitSha", { description: "Full 40-character lowercase commit SHA." }));

/**
 * The base and head commits of the pull request under review.
 *
 * **Example** (Build a request)
 *
 * ```ts
 * import { DependencyReviewRequest } from "@beep/repo-cli/commands/Ci"
 *
 * const request = DependencyReviewRequest.make({
 *   base: "19d8b3df005dd9768e003a9efc716d84bf0ad12a",
 *   head: "9fc17c2ed94893ac831ed12b4370c70dfc48a0af",
 * })
 * console.log(request.base.length) // 40
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependencyReviewRequest extends S.Opaque<DependencyReviewRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    base: CommitSha,
    head: CommitSha,
  }).pipe($I.annoteSchema("DependencyReviewRequest", { description: "Pull request base and head commits." }))
) {}

const findingTarget = {
  manifest: S.String,
  ecosystem: S.String,
  name: S.String,
  version: S.String,
};

/**
 * One reason a dependency review fails.
 *
 * **Details**
 *
 * `vulnerability` is an added row carrying at least one advisory at or above
 * the severity threshold. `denied-license` is an added row whose SPDX
 * expression can be satisfied by a denied license alone. `unresolved-license`
 * is an added row whose license string is not a valid SPDX expression, which
 * the dependency-review action also fails.
 *
 * **Example** (Make a denied-license finding)
 *
 * ```ts
 * import { DependencyReviewFinding } from "@beep/repo-cli/commands/Ci"
 *
 * const finding = DependencyReviewFinding.cases["denied-license"].make({
 *   manifest: "apps/oip-web/package.json",
 *   ecosystem: "npm",
 *   name: "example",
 *   version: "1.0.0",
 *   license: "GPL-3.0-only",
 * })
 * console.log(finding._tag) // "denied-license"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DependencyReviewFinding = S.TaggedUnion({
  vulnerability: { ...findingTarget, advisories: S.NonEmptyArray(DependencyVulnerability) },
  "denied-license": { ...findingTarget, license: S.String },
  "unresolved-license": { ...findingTarget, license: S.String },
}).pipe($I.annoteSchema("DependencyReviewFinding", { description: "One reason a dependency review fails." }));

/**
 * One dependency review failure reason.
 *
 * @category models
 * @since 0.0.0
 */
export type DependencyReviewFinding = typeof DependencyReviewFinding.Type;

/**
 * Why a review could not reach a pass or fail decision.
 *
 * **Example** (Recognize a rate limit)
 *
 * ```ts
 * import { DependencyReviewUnknownReason } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(DependencyReviewUnknownReason.is["rate-limited"]("rate-limited")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DependencyReviewUnknownReason = LiteralKit([
  "permission-denied",
  "not-found",
  "rate-limited",
  "request-failed",
  "malformed-response",
  "page-limit-exceeded",
]).pipe(
  $I.annoteSchema("DependencyReviewUnknownReason", {
    description: "Why a dependency review could not decide pass or fail.",
  })
);

/**
 * One unknown-verdict reason.
 *
 * @category models
 * @since 0.0.0
 */
export type DependencyReviewUnknownReason = typeof DependencyReviewUnknownReason.Type;

/**
 * A GitHub read the review depends on failed, so its state is unknown.
 *
 * **Example** (Raise a not-found failure)
 *
 * ```ts
 * import { DependencyReviewUnavailableError } from "@beep/repo-cli/commands/Ci"
 *
 * const error = DependencyReviewUnavailableError.make({ reason: "not-found", detail: "gh: Not Found (HTTP 404)" })
 * console.log(error.reason) // "not-found"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DependencyReviewUnavailableError extends S.TaggedError<
  DependencyReviewUnavailableError,
  { readonly brand: unique symbol }
>($I`DependencyReviewUnavailableError`)(
  "DependencyReviewUnavailableError",
  {
    reason: DependencyReviewUnknownReason,
    detail: S.String,
  },
  $I.annoteError<DependencyReviewUnavailableError>("DependencyReviewUnavailableError", {
    description: "A GitHub read needed by dependency review failed; the review state is unknown.",
  })
) {}

/**
 * Counts describing which compare rows a review looked at.
 *
 * **Example** (Build review counts)
 *
 * ```ts
 * import { DependencyReviewCounts } from "@beep/repo-cli/commands/Ci"
 *
 * const counts = DependencyReviewCounts.make({
 *   rows: 3,
 *   excludedRows: 1,
 *   excludedManifests: ["packages/tooling/library/repo-workspaces/test/fixtures/peers/npm/package-lock.json"],
 *   reviewedRows: 2,
 *   unlicensedRows: 0,
 * })
 * console.log(counts.reviewedRows) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependencyReviewCounts extends S.Opaque<DependencyReviewCounts, { readonly brand: unique symbol }>()(
  S.Struct({
    rows: S.Int,
    excludedRows: S.Int,
    excludedManifests: S.Array(S.String),
    reviewedRows: S.Int,
    unlicensedRows: S.Int,
  }).pipe(
    $I.annoteSchema("DependencyReviewCounts", {
      description: "Compare rows seen, excluded as fixtures, reviewed, and added without a license.",
    })
  )
) {}

/**
 * The outcome of one dependency review.
 *
 * **Details**
 *
 * `pass` and `fail` carry the row counts; `fail` also names every finding.
 * `unknown` means a GitHub read failed or returned data that does not decode.
 * It fails the job exactly like `fail`, so an outage or a missing permission
 * can never pass review.
 *
 * **Example** (Make an unknown verdict)
 *
 * ```ts
 * import { DependencyReviewVerdict } from "@beep/repo-cli/commands/Ci"
 *
 * const verdict = DependencyReviewVerdict.cases.unknown.make({ reason: "rate-limited", detail: "HTTP 429" })
 * console.log(verdict._tag) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DependencyReviewVerdict = S.TaggedUnion({
  pass: { counts: DependencyReviewCounts },
  fail: { counts: DependencyReviewCounts, findings: S.NonEmptyArray(DependencyReviewFinding) },
  unknown: { reason: DependencyReviewUnknownReason, detail: S.String },
}).pipe($I.annoteSchema("DependencyReviewVerdict", { description: "Outcome of one dependency review." }));

/**
 * One dependency review outcome.
 *
 * @category models
 * @since 0.0.0
 */
export type DependencyReviewVerdict = typeof DependencyReviewVerdict.Type;
