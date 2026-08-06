/**
 * Normalized capture contract consumed by `beep codex findings ingest`.
 *
 * The operator exports the findings view's own CSV from an already-signed-in
 * browser; `Findings.csv` decodes that export into a `codex-findings-capture/v1`
 * document, and everything in this module models it. The document is untrusted
 * external data: every field is length-bounded and pattern-checked so a hostile
 * finding title cannot reach a generated packet file, a terminal, or a
 * filesystem path.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Codex/Findings.capture.schemas");

/**
 * Severity domain of a Codex Cloud security finding.
 *
 * **Details**
 *
 * Declaration order is the packet sort rank: findings are ordered most severe
 * first, and `CSF-NNN` numbers are assigned from that order. Deriving the rank
 * from `Options.indexOf` is what keeps the literal domain and the ordering from
 * drifting apart when a severity is added.
 *
 * **Example** (Ranking a severity)
 *
 * ```ts
 * import { CodexFindingSeverity } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 *
 * console.log(CodexFindingSeverity.Options.indexOf("Medium")) // 1
 * console.log(CodexFindingSeverity.is.Informational("Informational")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexFindingSeverity = LiteralKit(["High", "Medium", "Low", "Informational"]).pipe(
  $I.annoteSchema("CodexFindingSeverity", {
    description: "Severity domain of a Codex Cloud security finding, ordered most severe first.",
  })
);

/**
 * Severity reported for one captured finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexFindingSeverity = typeof CodexFindingSeverity.Type;

/**
 * Lifecycle status a finding carries on the Codex Cloud dashboard.
 *
 * **Example** (Checking a captured status)
 *
 * ```ts
 * import { CodexFindingStatus } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 *
 * console.log(CodexFindingStatus.is.Open("Open")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexFindingStatus = LiteralKit(["Open", "New", "Closed"]).pipe(
  $I.annoteSchema("CodexFindingStatus", {
    description: "Lifecycle status a finding carries on the Codex Cloud dashboard.",
  })
);

/**
 * Dashboard status of one captured finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexFindingStatus = typeof CodexFindingStatus.Type;

/**
 * Session state observed while producing the capture.
 *
 * **Details**
 *
 * A capture is `expired` when the export came back as a signed-out shell rather
 * than findings. Planning refuses an `expired` payload rather than bootstrapping
 * a packet from zero findings, which would otherwise look like a clean scan. The
 * CSV lane detects this at the decode boundary, where a login document fails
 * header validation; the field keeps the guard available to any other source.
 *
 * **Example** (Rejecting an expired capture)
 *
 * ```ts
 * import { CodexCaptureAuthState } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 *
 * console.log(CodexCaptureAuthState.is.expired("expired")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexCaptureAuthState = LiteralKit(["authenticated", "expired"]).pipe(
  $I.annoteSchema("CodexCaptureAuthState", {
    description: "Session state observed while producing the capture.",
  })
);

/**
 * Authentication state reported by one capture run.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexCaptureAuthState = typeof CodexCaptureAuthState.Type;

const CodexFindingIdChecks = S.makeFilterGroup([
  S.isLengthBetween(32, 32, {
    identifier: $I`CodexFindingIdLengthCheck`,
    title: "Codex Finding Id Length",
    description: "Codex finding identifiers are exactly 32 characters.",
    message: "Expected a 32-character Codex finding identifier",
  }),
  S.isPattern(/^[0-9a-f]{32}$/, {
    identifier: $I`CodexFindingIdPatternCheck`,
    title: "Codex Finding Id Pattern",
    description: "Codex finding identifiers are lowercase hexadecimal.",
    message: "Expected a lowercase hexadecimal Codex finding identifier",
  }),
]);

/**
 * Opaque 32-character identifier Codex Cloud assigns to a finding.
 *
 * **Gotchas**
 *
 * This value is never used to build a filesystem path. Packet files are named
 * from CLI-assigned `CSF-NNN` ids so a hostile identifier cannot escape the
 * packet directory even if the pattern check is later loosened.
 *
 * **Example** (Validating a captured identifier)
 *
 * ```ts
 * import { CodexFindingId } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodexFindingId)("d2b9e11e8550819193516057a336ff90")) // true
 * console.log(S.is(CodexFindingId)("../../etc/passwd")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexFindingId = S.String.check(CodexFindingIdChecks).pipe(
  $I.annoteSchema("CodexFindingId", {
    description: "Opaque 32-character lowercase-hex identifier Codex Cloud assigns to a finding.",
  })
);

/**
 * Codex-assigned identifier of one captured finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexFindingId = typeof CodexFindingId.Type;

const GitCommitShaChecks = S.makeFilterGroup([
  S.isLengthBetween(40, 40, {
    identifier: $I`GitCommitShaLengthCheck`,
    title: "Git Commit Sha Length",
    description: "Full git object names are exactly 40 characters.",
    message: "Expected a 40-character git commit sha",
  }),
  S.isPattern(/^[0-9a-f]{40}$/, {
    identifier: $I`GitCommitShaPatternCheck`,
    title: "Git Commit Sha Pattern",
    description: "Git object names are lowercase hexadecimal.",
    message: "Expected a lowercase hexadecimal git commit sha",
  }),
]);

/**
 * Full git object name of the commit a finding was reported against.
 *
 * **Details**
 *
 * Ingest records this verbatim so a later triage phase can prove the reported
 * commit is an ancestor of the packet branch. Abbreviated shas are rejected
 * because ancestry checks against an ambiguous prefix are not decidable.
 *
 * **Example** (Validating a source commit)
 *
 * ```ts
 * import { GitCommitSha } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GitCommitSha)("244529aa4f560421cd096c2a4a4cb3cd21923070")) // true
 * console.log(S.is(GitCommitSha)("244529a")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GitCommitSha = S.String.check(GitCommitShaChecks).pipe(
  $I.annoteSchema("GitCommitSha", {
    description: "Full 40-character lowercase-hex git object name of a reported commit.",
  })
);

/**
 * Source commit reported for one captured finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GitCommitSha = typeof GitCommitSha.Type;

/**
 * Calendar date a capture ran, as `YYYY-MM-DD`.
 *
 * **Gotchas**
 *
 * This value becomes part of the packet slug, so it is pattern-checked before
 * any path is built from it. A value such as `2026-08-04/../..` fails here
 * rather than at the filesystem boundary.
 *
 * **Example** (Rejecting a traversal-shaped date)
 *
 * ```ts
 * import { CaptureDate } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CaptureDate)("2026-08-04")) // true
 * console.log(S.is(CaptureDate)("2026-08-04/../..")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CaptureDate = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}$/, {
    identifier: $I`CaptureDatePatternCheck`,
    title: "Capture Date Pattern",
    description: "Capture dates are ISO calendar dates without a time component.",
    message: "Expected a YYYY-MM-DD capture date",
  })
).pipe(
  $I.annoteSchema("CaptureDate", {
    description: "Calendar date a findings capture ran, used to derive the packet slug.",
  })
);

/**
 * Capture date used to derive a packet slug.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CaptureDate = typeof CaptureDate.Type;

/**
 * GitHub `owner/repo` slug the findings were scoped to.
 *
 * **Example** (Validating a repository slug)
 *
 * ```ts
 * import { GitHubRepoSlug } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GitHubRepoSlug)("kriegcloud/beep-effect")) // true
 * console.log(S.is(GitHubRepoSlug)("beep-effect")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GitHubRepoSlug = S.String.check(
  S.isPattern(/^[A-Za-z0-9._-]{1,39}\/[A-Za-z0-9._-]{1,100}$/, {
    identifier: $I`GitHubRepoSlugPatternCheck`,
    title: "GitHub Repo Slug Pattern",
    description: "Repository slugs are a bounded owner and name separated by a single slash.",
    message: "Expected an owner/repo GitHub slug",
  })
).pipe(
  $I.annoteSchema("GitHubRepoSlug", {
    description: "Bounded GitHub owner/repo slug the captured findings were scoped to.",
  })
);

/**
 * Repository slug a capture was scoped to.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GitHubRepoSlug = typeof GitHubRepoSlug.Type;

const CodexFindingTitleChecks = S.makeFilterGroup([
  S.isMinLength(1, {
    identifier: $I`CodexFindingTitleMinLengthCheck`,
    title: "Codex Finding Title Minimum Length",
    description: "Every captured finding carries a title.",
    message: "Expected a non-empty finding title",
  }),
  S.isMaxLength(300, {
    identifier: $I`CodexFindingTitleMaxLengthCheck`,
    title: "Codex Finding Title Maximum Length",
    description: "Finding titles are bounded so packet documents stay within their size budgets.",
    message: "Expected a finding title of at most 300 characters",
  }),
  S.isPattern(/^[^\p{Cc}\p{Cf}]+$/u, {
    identifier: $I`CodexFindingTitlePrintableCheck`,
    title: "Codex Finding Title Printable",
    description: "Finding titles contain no control or format characters.",
    message: "Expected a finding title without control or bidirectional format characters",
  }),
  // A title is captured from an external system and flows into tracked
  // Markdown that a reader may well paste into a spreadsheet. A leading sigil
  // is what turns that value into a formula, so it is refused at the boundary
  // rather than neutralized downstream.
  S.isPattern(/^[^=+\-@]/u, {
    identifier: $I`CodexFindingTitleFormulaCheck`,
    title: "Codex Finding Title Not A Formula",
    description: "Finding titles do not open with a spreadsheet formula sigil.",
    message: "Expected a finding title not beginning with =, +, -, or @",
  }),
]);

/**
 * Human-readable title of one captured finding.
 *
 * **Gotchas**
 *
 * The printable check rejects Unicode format characters, including the
 * bidirectional overrides (`U+202E` and friends) that would otherwise let a
 * title reverse how a generated table row renders in a reviewer's diff. Markdown
 * metacharacters are escaped separately at render time; this check only
 * guarantees the value is single-line printable text.
 *
 * **Example** (Rejecting a bidi override)
 *
 * ```ts
 * import { CodexFindingTitle } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodexFindingTitle)("Unbounded source resolution")) // true
 * console.log(S.is(CodexFindingTitle)("safe‮evil")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexFindingTitle = S.String.check(CodexFindingTitleChecks).pipe(
  $I.annoteSchema("CodexFindingTitle", {
    description: "Single-line printable title of a captured finding, bounded to 300 characters.",
  })
);

/**
 * Title of one captured finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexFindingTitle = typeof CodexFindingTitle.Type;

/**
 * One normalized finding row decoded from the findings export.
 *
 * **Details**
 *
 * This is deliberately the list-level projection only. The decoder never carries
 * a finding to reach its full report body, which keeps it short enough for an
 * operator to read before pasting and keeps report prose out of the payload
 * entirely.
 *
 * **Example** (Constructing a captured row)
 *
 * ```ts
 * import { CodexCaptureFinding } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 *
 * const finding = CodexCaptureFinding.make({
 *   codexId: "d2b9e11e8550819193516057a336ff90",
 *   title: "Unbounded source resolution enables sidecar memory DoS",
 *   severity: "Medium",
 *   codexStatus: "Open",
 *   commit: "244529aa4f560421cd096c2a4a4cb3cd21923070",
 * })
 *
 * console.log(finding.severity) // "Medium"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexCaptureFinding extends S.Class<CodexCaptureFinding>($I`CodexCaptureFinding`)(
  {
    codexId: CodexFindingId.pipe(
      $I.annoteKey("CodexCaptureFinding.codexId", {
        description: "Codex Cloud identifier used to reconcile reruns and post-merge closure.",
      })
    ),
    title: CodexFindingTitle.pipe(
      $I.annoteKey("CodexCaptureFinding.title", {
        description: "Single-line finding title as rendered on the dashboard.",
      })
    ),
    severity: CodexFindingSeverity.pipe(
      $I.annoteKey("CodexCaptureFinding.severity", {
        description: "Severity badge shown for the finding.",
      })
    ),
    codexStatus: CodexFindingStatus.pipe(
      $I.annoteKey("CodexCaptureFinding.codexStatus", {
        description: "Dashboard lifecycle status at capture time.",
      })
    ),
    commit: GitCommitSha.pipe(
      $I.annoteKey("CodexCaptureFinding.commit", {
        description: "Source commit the finding was reported against.",
      })
    ),
  },
  $I.annote("CodexCaptureFinding", {
    description: "One normalized finding row decoded from the findings export.",
  })
) {}

/**
 * Provenance describing a single capture run.
 *
 * **Gotchas**
 *
 * `expectedCount` is the dashboard's own reported total, not the number of rows
 * the export actually carried. Ingest compares it against the captured rows and
 * refuses a short read, which is what turns a silently truncated virtual list
 * into a hard failure.
 *
 * **Example** (Constructing capture provenance)
 *
 * ```ts
 * import { CodexCaptureMeta } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 *
 * const meta = CodexCaptureMeta.make({
 *   capturedAt: "2026-08-04",
 *   sourceUrl: "https://chatgpt.com/codex/cloud/security/findings/",
 *   repository: "kriegcloud/beep-effect",
 *   findingsView: "repo-scoped, status=open",
 *   expectedCount: 26,
 *   authState: "authenticated",
 * })
 *
 * console.log(meta.expectedCount) // 26
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexCaptureMeta extends S.Class<CodexCaptureMeta>($I`CodexCaptureMeta`)(
  {
    capturedAt: CaptureDate.pipe(
      $I.annoteKey("CodexCaptureMeta.capturedAt", {
        description: "Calendar date the capture ran, used to derive the packet slug.",
      })
    ),
    sourceUrl: S.String.check(
      S.isMaxLength(300, {
        identifier: $I`CodexCaptureMetaSourceUrlMaxLengthCheck`,
        title: "Capture Source Url Maximum Length",
        description: "The recorded source URL is bounded so manifests stay within budget.",
        message: "Expected a source URL of at most 300 characters",
      })
    ).pipe(
      $I.annoteKey("CodexCaptureMeta.sourceUrl", {
        description: "Dashboard URL the capture was taken from.",
      })
    ),
    repository: GitHubRepoSlug.pipe(
      $I.annoteKey("CodexCaptureMeta.repository", {
        description: "Repository the findings view was scoped to.",
      })
    ),
    findingsView: S.String.check(
      S.isMaxLength(120, {
        identifier: $I`CodexCaptureMetaFindingsViewMaxLengthCheck`,
        title: "Findings View Maximum Length",
        description: "The recorded view description is bounded.",
        message: "Expected a findings view description of at most 120 characters",
      })
    ).pipe(
      $I.annoteKey("CodexCaptureMeta.findingsView", {
        description: "Filter description of the captured dashboard view.",
      })
    ),
    expectedCount: S.Int.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`CodexCaptureMetaExpectedCountCheck`,
        title: "Expected Count Non Negative",
        description: "The dashboard's reported finding total is never negative.",
        message: "Expected a non-negative finding count",
      })
    ).pipe(
      $I.annoteKey("CodexCaptureMeta.expectedCount", {
        description: "Finding total the dashboard itself reported, used to detect a short read.",
      })
    ),
    authState: CodexCaptureAuthState.pipe(
      $I.annoteKey("CodexCaptureMeta.authState", {
        description: "Session state observed while capturing.",
      })
    ),
  },
  $I.annote("CodexCaptureMeta", {
    description: "Provenance describing one capture run of the Codex Cloud findings view.",
  })
) {}

const CodexCaptureFindingListChecks = S.makeFilterGroup([
  S.isMaxLength(500, {
    identifier: $I`CodexCaptureFindingListMaxLengthCheck`,
    title: "Capture Finding List Maximum Length",
    description: "A single capture carries a bounded number of findings.",
    message: "Expected at most 500 captured findings in one payload",
  }),
]);

/**
 * Complete `codex-findings-capture/v1` document decoded from an export.
 *
 * **When to use**
 *
 * Use as the only entry point for untrusted capture data. Ingest decodes through
 * this schema before any value reaches the redaction scan, the packet planner,
 * or the filesystem.
 *
 * **Gotchas**
 *
 * Duplicate `codexId` values are rejected rather than deduplicated. Two rows
 * sharing an identifier means the capture read the same virtualized row twice,
 * so the payload is unreliable as a whole and silently collapsing it would
 * under-count the batch.
 *
 * **Example** (Decoding a payload)
 *
 * ```ts
 * import { decodeCodexFindingsCapturePayload } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 * import { Effect } from "effect"
 *
 * const program = decodeCodexFindingsCapturePayload({
 *   schemaVersion: "codex-findings-capture/v1",
 *   capture: {
 *     capturedAt: "2026-08-04",
 *     sourceUrl: "https://chatgpt.com/codex/cloud/security/findings/",
 *     repository: "kriegcloud/beep-effect",
 *     findingsView: "repo-scoped, status=open",
 *     expectedCount: 0,
 *     authState: "authenticated",
 *   },
 *   findings: [],
 * }).pipe(Effect.map((payload) => payload.findings.length))
 *
 * console.log(Effect.runSync(program)) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexFindingsCapturePayload extends S.Class<CodexFindingsCapturePayload>($I`CodexFindingsCapturePayload`)(
  {
    schemaVersion: S.Literal("codex-findings-capture/v1").pipe(
      $I.annoteKey("CodexFindingsCapturePayload.schemaVersion", {
        description: "Payload contract discriminator.",
      })
    ),
    capture: CodexCaptureMeta.pipe(
      $I.annoteKey("CodexFindingsCapturePayload.capture", {
        description: "Provenance of the capture run.",
      })
    ),
    findings: S.Array(CodexCaptureFinding)
      .check(
        CodexCaptureFindingListChecks,
        S.isUnique({
          identifier: $I`CodexCaptureFindingListUniqueCheck`,
          title: "Unique Codex Finding Identifiers",
          description: "A capture never reports the same Codex finding twice.",
          message: "Expected every captured finding to carry a distinct Codex identifier",
        })
      )
      .pipe(
        $I.annoteKey("CodexFindingsCapturePayload.findings", {
          description: "Every finding row the export carried, in export order.",
        })
      ),
  },
  $I.annote("CodexFindingsCapturePayload", {
    description: "Complete normalized capture document decoded from a Codex findings export.",
  })
) {}

/**
 * Decode an untrusted capture payload into a validated document.
 *
 * **When to use**
 *
 * Use to validate an untrusted capture at the ingest boundary, before the
 * redaction scan. Every downstream stage assumes the bounds and patterns this
 * decoder enforces.
 *
 * **Example** (Rejecting an unknown payload contract)
 *
 * ```ts
 * import { decodeCodexFindingsCapturePayload } from "@beep/repo-cli/commands/Codex/Findings.capture.schemas"
 * import { Effect } from "effect"
 *
 * const program = decodeCodexFindingsCapturePayload({ schemaVersion: "codex-findings-capture/v99" }).pipe(
 *   Effect.map(() => "accepted"),
 *   Effect.orElseSucceed(() => "rejected")
 * )
 *
 * console.log(Effect.runSync(program)) // "rejected"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeCodexFindingsCapturePayload = S.decodeUnknownEffect(CodexFindingsCapturePayload);
