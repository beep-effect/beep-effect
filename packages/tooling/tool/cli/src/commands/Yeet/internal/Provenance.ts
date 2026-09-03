/**
 * Schema-first pull-request provenance detection and privacy-bounded public rendering.
 *
 * **Gotchas**
 *
 * Local session identifiers and filesystem paths belong only to workstation
 * registry records. The versioned public projection is the sole input accepted
 * by the pull-request footer renderer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Config, Context, DateTime, Effect, FileSystem, Order, Path, pipe, Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { renderPrettyCommandJson } from "../../../internal/cli/Json.ts";
import { runGitOutput } from "./GitExec.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Yeet/internal/Provenance");
const PrProvenancePath = S.NonEmptyString.pipe(
  $I.annoteSchema("PrProvenancePath", { description: "Absolute local path retained only in workstation state." })
);
const forbiddenGitBranchCharacter = /[\u0000-\u0020\u007f~^:?*[\\]/u;

/**
 * Git-valid branch name shared by local records and the public provenance projection.
 *
 * **Details**
 *
 * The refinement rejects option-like names, invalid path components, revision
 * syntax, controls, whitespace, and Git's forbidden ref characters.
 *
 * **Example** (Validate branch names)
 *
 * ```ts
 * import { PrProvenanceBranch } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PrProvenanceBranch)("feat/yeet-pr-resume-footer")) // true
 * console.log(S.is(PrProvenanceBranch)("branch with spaces")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrProvenanceBranch = S.NonEmptyString.check(
  S.makeFilter<string>(
    (branch) =>
      (!Str.startsWith("-")(branch) &&
        branch !== "@" &&
        O.isNone(Str.match(forbiddenGitBranchCharacter)(branch)) &&
        !Str.includes("..")(branch) &&
        !Str.includes("@{")(branch) &&
        !Str.startsWith("/")(branch) &&
        !Str.endsWith("/")(branch) &&
        !Str.endsWith(".")(branch) &&
        A.every(
          Str.split("/")(branch),
          (part) => Str.isNonEmpty(part) && !Str.startsWith(".")(part) && !Str.endsWith(".lock")(part)
        )) || { path: [], issue: "Expected a valid Git branch name" },
    { identifier: $I`PrProvenanceBranchCheck`, title: "Git branch", description: "A valid Git branch name." }
  )
).pipe($I.annoteSchema("PrProvenanceBranch", { description: "Git-valid provenance branch." }));
/**
 * Decoded Git branch accepted by {@link PrProvenanceBranch}.
 *
 * **Example** (Annotate a validated branch)
 *
 * ```ts
 * import { PrProvenanceBranch } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const branch: PrProvenanceBranch = S.decodeSync(PrProvenanceBranch)("feat/resume")
 * console.log(branch) // "feat/resume"
 * ```
 *
 * @see {@link PrProvenanceBranch} for the runtime validation schema.
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceBranch = typeof PrProvenanceBranch.Type;

/**
 * Positive integer identifying a GitHub pull request.
 *
 * **Example** (Reject a non-positive number)
 *
 * ```ts
 * import { PrNumber } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PrNumber)(42)) // true
 * console.log(S.is(PrNumber)(0)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrNumber = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PrNumber", { description: "Positive GitHub pull-request number." })
);
/**
 * Decoded positive pull-request number produced by {@link PrNumber}.
 *
 * **Example** (Annotate a pull-request number)
 *
 * ```ts
 * import { PrNumber } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const pr: PrNumber = S.decodeSync(PrNumber)(42)
 * console.log(pr) // 42
 * ```
 *
 * @see {@link PrNumber} for the runtime validation schema.
 * @category type-level
 * @since 0.0.0
 */
export type PrNumber = typeof PrNumber.Type;

/**
 * Agent harness that owns a recorded local session.
 *
 * **Example** (Inspect supported harnesses)
 *
 * ```ts
 * import { PrProvenanceHarness } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PrProvenanceHarness.Options) // ["claude-code", "codex", "unknown"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrProvenanceHarness = LiteralKit(["claude-code", "codex", "unknown"]).pipe(
  $I.annoteSchema("PrProvenanceHarness", { description: "Harness owning a recorded agent session." })
);
/**
 * Harness identifier decoded by {@link PrProvenanceHarness}.
 *
 * **Example** (Type a Codex harness)
 *
 * ```ts
 * import type { PrProvenanceHarness } from "@beep/repo-cli/test/Yeet"
 *
 * const harness: PrProvenanceHarness = "codex"
 * console.log(harness) // "codex"
 * ```
 *
 * @see {@link PrProvenanceHarness} for the supported runtime values.
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceHarness = typeof PrProvenanceHarness.Type;
/**
 * Harness entrypoint recorded to distinguish desktop, CLI, and nested agent launches.
 *
 * **Example** (Inspect supported entrypoints)
 *
 * ```ts
 * import { PrProvenanceEntrypoint } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PrProvenanceEntrypoint.Options.includes("codex-tui")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrProvenanceEntrypoint = LiteralKit([
  "claude-desktop",
  "cli",
  "sdk-cli",
  "codex-exec",
  "codex-tui",
  "unknown",
]).pipe($I.annoteSchema("PrProvenanceEntrypoint", { description: "Agent harness entrypoint." }));
/**
 * Entrypoint identifier decoded by {@link PrProvenanceEntrypoint}.
 *
 * **Example** (Type a desktop entrypoint)
 *
 * ```ts
 * import type { PrProvenanceEntrypoint } from "@beep/repo-cli/test/Yeet"
 *
 * const entrypoint: PrProvenanceEntrypoint = "claude-desktop"
 * console.log(entrypoint) // "claude-desktop"
 * ```
 *
 * @see {@link PrProvenanceEntrypoint} for the supported runtime values.
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceEntrypoint = typeof PrProvenanceEntrypoint.Type;
/**
 * Pull-request lifecycle action attributed to a recorded agent session.
 *
 * **Example** (Inspect lifecycle roles)
 *
 * ```ts
 * import { PrProvenanceRole } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PrProvenanceRole.Options) // ["created", "pushed", "monitored"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrProvenanceRole = LiteralKit(["created", "pushed", "monitored"]).pipe(
  $I.annoteSchema("PrProvenanceRole", { description: "PR lifecycle action recorded for a session." })
);
/**
 * Lifecycle role decoded by {@link PrProvenanceRole}.
 *
 * **Example** (Type a publishing role)
 *
 * ```ts
 * import type { PrProvenanceRole } from "@beep/repo-cli/test/Yeet"
 *
 * const role: PrProvenanceRole = "pushed"
 * console.log(role) // "pushed"
 * ```
 *
 * @see {@link PrProvenanceRole} for the supported runtime values.
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceRole = typeof PrProvenanceRole.Type;
/**
 * Evidence source attached to a locally discovered Claude display name.
 *
 * **Gotchas**
 *
 * A source does not make a name public-safe; label projection applies a separate
 * allowlist and exposes only user or derived names when labels are enabled.
 *
 * **Example** (Inspect name sources)
 *
 * ```ts
 * import { PrProvenanceNameSource } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PrProvenanceNameSource.Options.includes("user")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrProvenanceNameSource = LiteralKit([
  "user",
  "derived",
  "peer",
  "collision",
  "auto",
  "hook",
  "unknown",
]).pipe($I.annoteSchema("PrProvenanceNameSource", { description: "Source of a local Claude display name." }));
/**
 * Display-name evidence source decoded by {@link PrProvenanceNameSource}.
 *
 * **Example** (Type a derived name source)
 *
 * ```ts
 * import type { PrProvenanceNameSource } from "@beep/repo-cli/test/Yeet"
 *
 * const source: PrProvenanceNameSource = "derived"
 * console.log(source) // "derived"
 * ```
 *
 * @see {@link PrProvenanceNameSource} for the supported runtime values.
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceNameSource = typeof PrProvenanceNameSource.Type;
/**
 * Evidence source used to resolve the working directory for a resumable session.
 *
 * **Example** (Inspect session-home sources)
 *
 * ```ts
 * import { PrProvenanceSessionHomeSource } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PrProvenanceSessionHomeSource.Options) // ["transcript", "index", "checkout"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrProvenanceSessionHomeSource = LiteralKit(["transcript", "index", "checkout"]).pipe(
  $I.annoteSchema("PrProvenanceSessionHomeSource", { description: "Evidence source for the local session home." })
);
/**
 * Session-home evidence source decoded by {@link PrProvenanceSessionHomeSource}.
 *
 * **Example** (Type a transcript source)
 *
 * ```ts
 * import type { PrProvenanceSessionHomeSource } from "@beep/repo-cli/test/Yeet"
 *
 * const source: PrProvenanceSessionHomeSource = "transcript"
 * console.log(source) // "transcript"
 * ```
 *
 * @see {@link PrProvenanceSessionHomeSource} for the supported runtime values.
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceSessionHomeSource = typeof PrProvenanceSessionHomeSource.Type;

const labelPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const longHexPattern = /[0-9a-f]{16,}/iu;
/**
 * Short public-safe label admitted by a positive character and identifier allowlist.
 *
 * **Gotchas**
 *
 * UUIDs, long hexadecimal identifiers, path-like forms, and lock-file suffixes
 * are rejected even when their individual characters would otherwise be valid.
 *
 * **Example** (Validate public labels)
 *
 * ```ts
 * import { PrProvenanceLabel } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PrProvenanceLabel)("beep-effect10")) // true
 * console.log(S.is(PrProvenanceLabel)("019f359b-6a16-77e2-bea9-47cf6b2092af")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrProvenanceLabel = S.NonEmptyString.check(
  S.makeFilter<string>(
    (value) =>
      (labelPattern.test(value) &&
        !Str.includes("..")(value) &&
        !Str.endsWith(".lock")(value) &&
        !uuidPattern.test(value) &&
        !longHexPattern.test(value)) || { path: [], issue: "Expected a public-safe provenance label" },
    {
      identifier: $I`PrProvenanceLabelCheck`,
      title: "Public provenance label",
      description: "A short slug excluding UUID and long hexadecimal identifiers.",
    }
  )
).pipe($I.annoteSchema("PrProvenanceLabel", { description: "Public-safe workspace or Claude display label." }));
/**
 * Decoded public label accepted by {@link PrProvenanceLabel}.
 *
 * **Example** (Annotate a workspace label)
 *
 * ```ts
 * import { PrProvenanceLabel } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const label: PrProvenanceLabel = S.decodeSync(PrProvenanceLabel)("beep-effect10")
 * console.log(label) // "beep-effect10"
 * ```
 *
 * @see {@link PrProvenanceLabel} for the runtime validation schema.
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceLabel = typeof PrProvenanceLabel.Type;
/**
 * Public-safe model slug retained in the projected agent ledger.
 *
 * **Example** (Validate model slugs)
 *
 * ```ts
 * import { PrProvenanceModel } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PrProvenanceModel)("claude-sonnet-4.5")) // true
 * console.log(S.is(PrProvenanceModel)("model with spaces")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrProvenanceModel = S.NonEmptyString.check(
  S.makeFilter<string>(
    (value) =>
      (/^[a-z0-9][a-z0-9.()_-]{0,63}$/u.test(value) && !uuidPattern.test(value) && !longHexPattern.test(value)) || {
        path: [],
        issue: "Expected a public model slug",
      },
    {
      identifier: $I`PrProvenanceModelCheck`,
      title: "Model slug",
      description: "A public model identifier excluding UUID and long hexadecimal shapes.",
    }
  )
).pipe($I.annoteSchema("PrProvenanceModel", { description: "Public model slug, or unknown." }));
/**
 * Decoded model slug accepted by {@link PrProvenanceModel}.
 *
 * **Example** (Annotate a model slug)
 *
 * ```ts
 * import { PrProvenanceModel } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const model: PrProvenanceModel = S.decodeSync(PrProvenanceModel)("gpt-5.4")
 * console.log(model) // "gpt-5.4"
 * ```
 *
 * @see {@link PrProvenanceModel} for the runtime validation schema.
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceModel = typeof PrProvenanceModel.Type;
const GitHubName = S.NonEmptyString.check(
  S.makeFilter<string>((value) => /^[A-Za-z0-9_.-]+$/u.test(value) || { path: [], issue: "Expected a GitHub name" }, {
    identifier: $I`GitHubNameCheck`,
    title: "GitHub name",
    description: "GitHub owner or repository name.",
  })
);

/**
 * GitHub repository identity used to partition workstation-local session records.
 *
 * **Example** (Construct a repository key)
 *
 * ```ts
 * import { PrRepository } from "@beep/repo-cli/test/Yeet"
 *
 * const repository = PrRepository.make({
 *   host: "github.com",
 *   owner: "beep-effect",
 *   name: "beep-effect",
 * })
 * console.log(repository.owner) // "beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrRepository extends S.Class<PrRepository>($I`PrRepository`)(
  { host: S.Literal("github.com"), owner: GitHubName, name: GitHubName },
  $I.annote("PrRepository", { description: "GitHub repository identity for local PR-session state." })
) {}
/**
 * Workstation-local harness identity and filesystem evidence for one agent session.
 *
 * **Gotchas**
 *
 * Session identifiers, local paths, and session names must stay inside local
 * registry state; callers publish only the result of {@link toPublicPrProvenance}.
 *
 * **Example** (Construct local Codex provenance)
 *
 * ```ts
 * import { PrProvenance } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const provenance = PrProvenance.make({
 *   branch: "feat/yeet-pr-resume-footer",
 *   harness: "codex",
 *   hostHarness: O.none(),
 *   sessionId: O.some("thread-local-only"),
 *   hostSessionId: O.none(),
 *   sessionHome: O.some("/worktrees/beep-effect10"),
 *   sessionHomeSource: "transcript",
 *   entrypoint: "codex-tui",
 *   sessionName: O.none(),
 *   nameSource: "unknown",
 *   model: "gpt-5.4",
 *   clonePath: "/src/beep-effect",
 *   checkoutPath: "/worktrees/beep-effect10",
 *   worktreePath: O.some("/worktrees/beep-effect10"),
 *   workspace: "beep-effect10",
 *   sessionWorkspace: O.none(),
 *   childSession: false,
 * })
 * console.log(provenance.harness) // "codex"
 * ```
 *
 * @see {@link toPublicPrProvenance} for the sole public projection boundary.
 * @category models
 * @since 0.0.0
 */
export class PrProvenance extends S.Class<PrProvenance>($I`PrProvenance`)(
  {
    branch: PrProvenanceBranch,
    harness: PrProvenanceHarness,
    hostHarness: S.OptionFromNullOr(PrProvenanceHarness),
    sessionId: S.OptionFromNullOr(S.String),
    hostSessionId: S.OptionFromNullOr(S.String),
    sessionHome: S.OptionFromNullOr(PrProvenancePath),
    sessionHomeSource: PrProvenanceSessionHomeSource,
    entrypoint: PrProvenanceEntrypoint,
    sessionName: S.OptionFromNullOr(S.String),
    nameSource: PrProvenanceNameSource,
    model: PrProvenanceModel,
    clonePath: PrProvenancePath,
    checkoutPath: PrProvenancePath,
    worktreePath: S.OptionFromNullOr(PrProvenancePath),
    workspace: PrProvenanceLabel,
    sessionWorkspace: S.OptionFromNullOr(PrProvenanceLabel),
    childSession: S.Boolean,
  },
  $I.annote("PrProvenance", { description: "Workstation-local agent identity and filesystem provenance." })
) {}
const GitSha = S.NonEmptyString.pipe($I.annoteSchema("GitSha", { description: "Git commit identifier." }));
/**
 * Durable append-only row linking a local agent session to a pull-request action.
 *
 * **Details**
 *
 * Later actions append new rows rather than mutating earlier history; projection
 * sorts and deduplicates the accumulated rows when building a public footer.
 *
 * **Example** (Construct a registry row)
 *
 * ```ts
 * import { PrRepository, PrSessionRecord } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const record = PrSessionRecord.make({
 *   schemaVersion: 1,
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   prNumber: O.some(42),
 *   prUrl: O.some("https://github.com/beep-effect/beep-effect/pull/42"),
 *   branch: "feat/yeet-pr-resume-footer",
 *   harness: "claude-code",
 *   hostHarness: O.none(),
 *   sessionId: O.some("session-local-only"),
 *   hostSessionId: O.none(),
 *   sessionHome: O.some("/worktrees/beep-effect10"),
 *   sessionHomeSource: "transcript",
 *   entrypoint: "claude-desktop",
 *   sessionName: O.some("footer-revival"),
 *   nameSource: "user",
 *   model: "claude-sonnet-4.5",
 *   clonePath: "/src/beep-effect",
 *   checkoutPath: "/worktrees/beep-effect10",
 *   worktreePath: O.some("/worktrees/beep-effect10"),
 *   workspace: "beep-effect10",
 *   sessionWorkspace: O.none(),
 *   childSession: false,
 *   headSha: "abcdef123456",
 *   runId: "run-42",
 *   role: "created",
 *   recordedAt: DateTime.makeUnsafe("2026-09-03T12:00:00Z"),
 * })
 * console.log(record.role) // "created"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrSessionRecord extends PrProvenance.extend<PrSessionRecord>($I`PrSessionRecord`)(
  {
    schemaVersion: S.Literal(1),
    repository: PrRepository,
    prNumber: S.OptionFromNullOr(PrNumber),
    prUrl: S.OptionFromNullOr(S.String),
    headSha: GitSha,
    runId: S.String,
    role: PrProvenanceRole,
    recordedAt: S.DateTimeUtcFromString,
  },
  $I.annote("PrSessionRecord", { description: "Durable local record linking a PR action to an agent session." })
) {}
/**
 * Public-safe agent ledger entry projected from a local session record.
 *
 * **Details**
 *
 * The entry contains only allowlisted display fields and lifecycle facts; local
 * session identifiers, paths, commands, and timestamps are absent by design.
 *
 * **Example** (Construct a public agent entry)
 *
 * ```ts
 * import { PublicAgent } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const agent = PublicAgent.make({
 *   harness: "codex",
 *   entrypoint: "codex-tui",
 *   hostHarness: O.none(),
 *   model: "gpt-5.4",
 *   label: O.none(),
 *   workspace: O.some("beep-effect10"),
 *   role: "pushed",
 * })
 * console.log(agent.role) // "pushed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublicAgent extends S.Class<PublicAgent>($I`PublicAgent`)(
  {
    harness: PrProvenanceHarness,
    entrypoint: PrProvenanceEntrypoint,
    hostHarness: S.OptionFromNullOr(PrProvenanceHarness),
    model: PrProvenanceModel,
    label: S.OptionFromNullOr(PrProvenanceLabel),
    workspace: S.OptionFromNullOr(PrProvenanceLabel),
    role: PrProvenanceRole,
  },
  $I.annote("PublicAgent", { description: "Public-safe agent ledger entry." })
) {}
/**
 * Legacy version-one footer payload retained only so existing footers can be replaced.
 *
 * **Gotchas**
 *
 * New rendering uses {@link PublicPrProvenance}; this shape is a read-only
 * compatibility boundary and must not become a source of local registry state.
 *
 * **Example** (Decode a legacy payload)
 *
 * ```ts
 * import { PublicPrProvenanceV1 } from "@beep/repo-cli/test/Yeet"
 *
 * const legacy = PublicPrProvenanceV1.make({
 *   schemaVersion: 1,
 *   branch: "feat/legacy-footer",
 *   harness: "codex",
 * })
 * console.log(legacy.schemaVersion) // 1
 * ```
 *
 * @see {@link PublicPrProvenance} for the current public payload.
 * @category models
 * @since 0.0.0
 */
export class PublicPrProvenanceV1 extends S.Class<PublicPrProvenanceV1>($I`PublicPrProvenanceV1`)(
  { schemaVersion: S.Literal(1), branch: PrProvenanceBranch, harness: PrProvenanceHarness },
  $I.annote("PublicPrProvenanceV1", {
    description: "Legacy public provenance payload accepted only while replacing a footer.",
  })
) {}
/**
 * Version-two public provenance payload permitted to cross into a GitHub PR body.
 *
 * **Gotchas**
 *
 * This is the public boundary: it deliberately has no session identifier,
 * filesystem path, resume command, timestamp, or local run identifier.
 *
 * **Example** (Construct public provenance)
 *
 * ```ts
 * import { PublicAgent, PublicPrProvenance } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const provenance = PublicPrProvenance.make({
 *   schemaVersion: 2,
 *   pr: O.some(42),
 *   branch: "feat/yeet-pr-resume-footer",
 *   workspace: "beep-effect10",
 *   agents: [PublicAgent.make({
 *     harness: "codex",
 *     entrypoint: "codex-tui",
 *     hostHarness: O.none(),
 *     model: "gpt-5.4",
 *     label: O.none(),
 *     workspace: O.some("beep-effect10"),
 *     role: "pushed",
 *   })],
 * })
 * console.log(provenance.agents.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublicPrProvenance extends S.Class<PublicPrProvenance>($I`PublicPrProvenance`)(
  {
    schemaVersion: S.Literal(2),
    pr: S.OptionFromNullOr(PrNumber),
    branch: PrProvenanceBranch,
    workspace: PrProvenanceLabel,
    agents: S.Array(PublicAgent).check(S.isMaxLength(4)),
  },
  $I.annote("PublicPrProvenance", { description: "Only provenance data permitted to enter a GitHub PR body." })
) {}
/**
 * Union schema decoding either replaceable legacy or current public footer data.
 *
 * **Example** (Recognize a current payload)
 *
 * ```ts
 * import { PublicPrProvenanceAny } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const input = { schemaVersion: 2, pr: null, branch: "feat/footer", workspace: "beep-effect10", agents: [] }
 * console.log(S.is(PublicPrProvenanceAny)(input)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PublicPrProvenanceAny = S.Union([PublicPrProvenanceV1, PublicPrProvenance]).pipe(
  $I.annoteSchema("PublicPrProvenanceAny", { description: "Read-only union of replaceable public footer payloads." })
);
/**
 * Decoded legacy-or-current footer value produced by {@link PublicPrProvenanceAny}.
 *
 * **Example** (Narrow by schema version)
 *
 * ```ts
 * import { PublicPrProvenanceAny } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const value: PublicPrProvenanceAny = S.decodeSync(PublicPrProvenanceAny)({
 *   schemaVersion: 1,
 *   branch: "feat/legacy-footer",
 *   harness: "codex",
 * })
 * console.log(value.schemaVersion) // 1
 * ```
 *
 * @see {@link PublicPrProvenanceAny} for the runtime union schema.
 * @category type-level
 * @since 0.0.0
 */
export type PublicPrProvenanceAny = typeof PublicPrProvenanceAny.Type;

const recordOrder = Order.mapInput(
  Order.Number,
  (record: PrSessionRecord) => -DateTime.toEpochMillis(record.recordedAt)
);
const publicLabel = (record: PrSessionRecord, enabled: boolean): O.Option<PrProvenanceLabel> =>
  enabled && record.harness === "claude-code" && (record.nameSource === "user" || record.nameSource === "derived")
    ? O.flatMap(record.sessionName, S.decodeUnknownOption(PrProvenanceLabel))
    : O.none();
const sameSession = (left: PrSessionRecord, right: PrSessionRecord): boolean =>
  O.isSome(left.sessionId) && O.isSome(right.sessionId)
    ? left.harness === right.harness && left.sessionId.value === right.sessionId.value
    : left.harness === right.harness && left.runId === right.runId;

/**
 * Collapse append-only lifecycle history to the newest row for each distinct session.
 *
 * **Details**
 *
 * The newest row retains the most recent role and metadata. Rows without a
 * session identifier are distinguished by harness and run id.
 *
 * **Example** (Collapse repeated lifecycle rows)
 *
 * ```ts
 * import { distinctPrSessions } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(distinctPrSessions([]).length) // 0
 * ```
 *
 * @param records - Append-only local rows to order and collapse.
 * @returns Newest-first rows with one entry per harness session.
 * @category projections
 * @since 0.0.0
 */
export const distinctPrSessions = (records: ReadonlyArray<PrSessionRecord>): ReadonlyArray<PrSessionRecord> => {
  const sorted = A.sort(records, recordOrder);
  return A.filter(sorted, (record, index) => A.every(A.take(sorted, index), (prior) => !sameSession(record, prior)));
};
/**
 * Project append-only local registry rows through the sole public-provenance boundary.
 *
 * **Details**
 *
 * Rows are sorted newest-first, deduplicated by session, and capped at four
 * public agent entries. Filesystem paths, session ids, run ids, and timestamps
 * cannot cross the output schema.
 *
 * **Gotchas**
 *
 * Claude display labels are included only when label publication is enabled,
 * the source is `user` or `derived`, and the value passes {@link PrProvenanceLabel}.
 *
 * **Example** (Project one local row)
 *
 * ```ts
 * import { PrRepository, PrSessionRecord, toPublicPrProvenance } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const record = PrSessionRecord.make({
 *   schemaVersion: 1,
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   prNumber: O.some(42),
 *   prUrl: O.some("https://github.com/beep-effect/beep-effect/pull/42"),
 *   branch: "feat/yeet-pr-resume-footer",
 *   harness: "claude-code",
 *   hostHarness: O.none(),
 *   sessionId: O.some("session-local-only"),
 *   hostSessionId: O.none(),
 *   sessionHome: O.some("/worktrees/beep-effect10"),
 *   sessionHomeSource: "transcript",
 *   entrypoint: "claude-desktop",
 *   sessionName: O.some("footer-revival"),
 *   nameSource: "user",
 *   model: "claude-sonnet-4.5",
 *   clonePath: "/src/beep-effect",
 *   checkoutPath: "/worktrees/beep-effect10",
 *   worktreePath: O.some("/worktrees/beep-effect10"),
 *   workspace: "beep-effect10",
 *   sessionWorkspace: O.none(),
 *   childSession: false,
 *   headSha: "abcdef123456",
 *   runId: "run-42",
 *   role: "created",
 *   recordedAt: DateTime.makeUnsafe("2026-09-03T12:00:00Z"),
 * })
 * const publicValue = toPublicPrProvenance([record], O.some(42), true)
 * console.log(publicValue.agents[0]?.label) // { _id: "Option", _tag: "Some", value: "footer-revival" }
 * ```
 *
 * @param records - Non-empty local history for one repository and pull request.
 * @param pr - Pull-request number to expose in the workstation-only resume fence.
 * @param labelsEnabled - Whether eligible public-safe Claude display labels may be projected.
 * @returns A version-two payload containing only fields permitted in the public PR body.
 * @category projections
 * @since 0.0.0
 */
export const toPublicPrProvenance: {
  (
    records: readonly [PrSessionRecord, ...Array<PrSessionRecord>],
    pr: O.Option<PrNumber>,
    labelsEnabled: boolean
  ): PublicPrProvenance;
  (
    pr: O.Option<PrNumber>,
    labelsEnabled: boolean
  ): (records: readonly [PrSessionRecord, ...Array<PrSessionRecord>]) => PublicPrProvenance;
} = dual(
  3,
  (
    records: readonly [PrSessionRecord, ...Array<PrSessionRecord>],
    pr: O.Option<PrNumber>,
    labelsEnabled: boolean
  ): PublicPrProvenance => {
    const agents = pipe(
      distinctPrSessions(records),
      A.take(4),
      A.map((record) =>
        PublicAgent.make({
          harness: record.harness,
          entrypoint: record.entrypoint,
          hostHarness: record.hostHarness,
          model: record.model,
          label: publicLabel(record, labelsEnabled),
          workspace: record.sessionWorkspace,
          role: record.role,
        })
      )
    );
    return PublicPrProvenance.make({
      schemaVersion: 2,
      pr,
      branch: records[0].branch,
      workspace: records[0].workspace,
      agents,
    });
  }
);

const encodePublic = S.encodeUnknownResult(S.fromJsonString(PublicPrProvenance));
const escapeHtml = (value: string): string =>
  pipe(
    value,
    Str.replaceAll("&", "&amp;"),
    Str.replaceAll("<", "&lt;"),
    Str.replaceAll(">", "&gt;"),
    Str.replaceAll("`", "&#96;"),
    Str.replaceAll("\r", "&#13;"),
    Str.replaceAll("\n", "&#10;")
  );
const escapeComment = (value: string): string =>
  pipe(value, Str.replaceAll("&", "\\u0026"), Str.replaceAll("<", "\\u003c"), Str.replaceAll(">", "\\u003e"));
/**
 * Render the only public resume command fence accepted by Yeet.
 *
 * **Gotchas**
 *
 * The argument is typed as {@link PrNumber}; accepting arbitrary strings here
 * would allow shell syntax into the otherwise fixed public command.
 *
 * **Example** (Render a typed resume fence)
 *
 * ```ts
 * import { PrNumber, renderResumeFence } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const pr = S.decodeSync(PrNumber)(42)
 * console.log(renderResumeFence(pr))
 * // ```sh
 * // bun run beep yeet resume 42
 * // ```
 * ```
 *
 * @param pr - Validated positive pull-request number embedded in the fixed command.
 * @returns A shell-fenced `yeet resume` command containing only the PR number.
 * @category formatting
 * @since 0.0.0
 */
export const renderResumeFence = (pr: PrNumber): string => `\`\`\`sh\nbun run beep yeet resume ${pr}\n\`\`\``;
const entrypointText = (entrypoint: PrProvenanceEntrypoint): string =>
  ({
    "claude-desktop": "desktop",
    cli: "cli",
    "sdk-cli": "sdk-cli",
    "codex-exec": "exec",
    "codex-tui": "tui",
    unknown: "unknown",
  })[entrypoint];
/**
 * Render a version-two public provenance value as marker-bounded Markdown and JSON.
 *
 * **Details**
 *
 * The visible ledger and hidden JSON twin are derived from the same public
 * value, preserving a reviewable display without importing local state.
 *
 * **Example** (Render a public footer)
 *
 * ```ts
 * import { PublicAgent, PublicPrProvenance, renderPrProvenance } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const provenance = PublicPrProvenance.make({
 *   schemaVersion: 2,
 *   pr: O.some(42),
 *   branch: "feat/yeet-pr-resume-footer",
 *   workspace: "beep-effect10",
 *   agents: [PublicAgent.make({
 *     harness: "codex",
 *     entrypoint: "codex-tui",
 *     hostHarness: O.none(),
 *     model: "gpt-5.4",
 *     label: O.none(),
 *     workspace: O.some("beep-effect10"),
 *     role: "pushed",
 *   })],
 * })
 * console.log(renderPrProvenance(provenance).includes("bun run beep yeet resume 42")) // true
 * ```
 *
 * @param provenance - Public-safe payload already projected from local registry rows.
 * @returns Marker-bounded Markdown with a visible ledger and encoded JSON twin.
 * @category formatting
 * @since 0.0.0
 */
export const renderPrProvenance = (provenance: PublicPrProvenance): string => {
  const encoded = pipe(
    provenance,
    encodePublic,
    Result.getOrThrow,
    renderPrettyCommandJson,
    Str.trimEnd,
    escapeComment
  );
  const agents = pipe(
    provenance.agents,
    A.map((agent) => {
      const via = O.match(agent.hostHarness, { onNone: () => "", onSome: (host) => `, via \`${host}\`` });
      const label = O.match(agent.label, {
        onNone: () => "",
        onSome: (value) => ` · <code>${escapeHtml(value)}</code>`,
      });
      const workspace = O.match(agent.workspace, {
        onNone: () => "",
        onSome: (value) => ` · workspace <code>${escapeHtml(value)}</code>`,
      });
      return `  - \`${agent.harness}\` (${entrypointText(agent.entrypoint)}${via}) · \`${agent.model}\`${label}${workspace} · ${agent.role}`;
    }),
    A.join("\n")
  );
  const resume = O.match(provenance.pr, {
    onNone: () => "",
    onSome: (pr) =>
      `\n\nResume the publishing agent from any beep-effect checkout on the publishing workstation:\n\n${renderResumeFence(pr)}`,
  });
  return `---\n\n<!-- yeet-provenance:start -->\n## Provenance\n\n- Workspace: <code>${escapeHtml(provenance.workspace)}</code>\n- Branch: <code>${escapeHtml(provenance.branch)}</code>\n- Agents (newest first):\n${agents}${resume}\n\n<!-- yeet-provenance\n${encoded}\n-->\n<!-- yeet-provenance:end -->\n`;
};

/**
 * Character offsets bounding a replaceable provenance footer in a PR body.
 *
 * **Example** (Describe a footer range)
 *
 * ```ts
 * import { PrProvenanceFooterRange } from "@beep/repo-cli/test/Yeet"
 *
 * const range = PrProvenanceFooterRange.make({ start: 12, end: 48 })
 * console.log(range.end - range.start) // 36
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrProvenanceFooterRange extends S.Class<PrProvenanceFooterRange>($I`PrProvenanceFooterRange`)(
  { start: S.Int, end: S.Int },
  $I.annote("PrProvenanceFooterRange", { description: "Character offsets bounding a replaceable provenance footer." })
) {}
const markerStart = "<!-- yeet-provenance:start -->";
const markerEnd = "<!-- yeet-provenance:end -->";
const legacyFooterPattern = /(?:\n|^)(?:---\n\n)?## Provenance\n[\s\S]*?<!-- yeet-provenance\n[\s\S]*?\n-->(?:\n|$)/u;
/**
 * Locate either the current marker pair or a replaceable legacy provenance block.
 *
 * **Example** (Locate a current footer)
 *
 * ```ts
 * import { parsePrProvenanceFooter } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const body = "Intro\n\n<!-- yeet-provenance:start -->\nfooter\n<!-- yeet-provenance:end -->\n"
 * console.log(O.isSome(parsePrProvenanceFooter(body))) // true
 * ```
 *
 * @param body - Existing pull-request Markdown to inspect without interpreting footer JSON.
 * @returns The replaceable character range when a current or legacy footer is present.
 * @category parsing
 * @since 0.0.0
 */
export const parsePrProvenanceFooter = (body: string): O.Option<PrProvenanceFooterRange> => {
  const start = Str.indexOf(markerStart)(body);
  if (O.isSome(start)) {
    const endRelative = Str.indexOf(markerEnd)(Str.slice(start.value)(body));
    return O.map(endRelative, (offset) => {
      const prefix = Str.slice(0, start.value)(body);
      const rangeStart = Str.endsWith("---\n\n")(prefix) ? start.value - 5 : start.value;
      const markerEndOffset = start.value + offset + Str.length(markerEnd);
      const rangeEnd = Str.startsWith("\n")(Str.slice(markerEndOffset)(body)) ? markerEndOffset + 1 : markerEndOffset;
      return PrProvenanceFooterRange.make({ start: rangeStart, end: rangeEnd });
    });
  }
  return pipe(
    Str.match(legacyFooterPattern)(body),
    O.map((match) =>
      PrProvenanceFooterRange.make({ start: match.index ?? 0, end: (match.index ?? 0) + Str.length(match[0]) })
    )
  );
};
/**
 * Replace or append a rendered provenance footer without consuming prior footer JSON as state.
 *
 * **Gotchas**
 *
 * The existing body supplies splice framing only. Local registry rows remain the
 * authority for every value written into the next public footer.
 *
 * **Example** (Append a footer to an existing body)
 *
 * ```ts
 * import { splicePrProvenanceFooter } from "@beep/repo-cli/test/Yeet"
 *
 * const next = splicePrProvenanceFooter("Summary", "<!-- yeet-provenance:start -->\nfooter\n<!-- yeet-provenance:end -->\n")
 * console.log(next.startsWith("Summary\n\n<!-- yeet-provenance:start -->")) // true
 * ```
 *
 * @param body - Existing pull-request Markdown used only as splice framing.
 * @param rendered - Fully rendered public footer derived from current local state.
 * @returns The body with exactly one current provenance footer.
 * @category formatting
 * @since 0.0.0
 */
export const splicePrProvenanceFooter: {
  (body: string, rendered: string): string;
  (rendered: string): (body: string) => string;
} = dual(2, (body: string, rendered: string): string =>
  O.match(parsePrProvenanceFooter(body), {
    onNone: () => `${Str.trimEnd(body)}${Str.isEmpty(Str.trim(body)) ? "" : "\n\n"}${rendered}`,
    onSome: ({ start, end }) =>
      `${Str.trimEnd(Str.slice(0, start)(body))}${start === 0 ? "" : "\n\n"}${rendered}${Str.slice(end)(body)}`,
  })
);

class ClaudeSessionIndex extends S.Class<ClaudeSessionIndex>($I`ClaudeSessionIndex`)(
  {
    pid: S.Int,
    sessionId: S.String,
    cwd: S.String,
    name: S.optionalKey(S.String),
    nameSource: S.optionalKey(S.String),
    entrypoint: S.optionalKey(S.String),
  },
  $I.annote("ClaudeSessionIndex", { description: "Boundary shape of a live Claude session index file." })
) {}
const decodeClaudeIndex = S.decodeUnknownOption(S.fromJsonString(ClaudeSessionIndex));
class TranscriptRecord extends S.Class<TranscriptRecord>($I`TranscriptRecord`)(
  {
    type: S.optionalKey(S.String),
    cwd: S.optionalKey(S.String),
    message: S.optionalKey(S.Struct({ model: S.optionalKey(S.String) })),
  },
  $I.annote("TranscriptRecord", { description: "Narrow Claude transcript record used for provenance detection." })
) {}
const decodeTranscriptRecord = S.decodeUnknownOption(S.fromJsonString(TranscriptRecord));
class CodexSessionHeader extends S.Class<CodexSessionHeader>($I`CodexSessionHeader`)(
  {
    type: S.String,
    payload: S.Struct({ id: S.String, cwd: S.String }),
  },
  $I.annote("CodexSessionHeader", { description: "Narrow Codex rollout session header." })
) {}
const decodeCodexHeader = S.decodeUnknownOption(S.fromJsonString(CodexSessionHeader));
class CodexTurnContext extends S.Class<CodexTurnContext>($I`CodexTurnContext`)(
  {
    type: S.String,
    model: S.optionalKey(S.String),
  },
  $I.annote("CodexTurnContext", { description: "Narrow Codex turn context used for active-model detection." })
) {}
const decodeCodexTurnContext = S.decodeUnknownOption(S.fromJsonString(CodexTurnContext));
class ProvenanceDetectionEnvironment extends S.Class<ProvenanceDetectionEnvironment>(
  $I`ProvenanceDetectionEnvironment`
)(
  {
    home: S.OptionFromNullOr(S.String),
    claudeId: S.OptionFromNullOr(S.String),
    claudePid: S.OptionFromNullOr(S.Int),
    configuredEntrypoint: S.OptionFromNullOr(S.String),
    hostSessionId: S.OptionFromNullOr(S.String),
    childSession: S.Boolean,
    companionTranscript: S.OptionFromNullOr(S.String),
    codexId: S.OptionFromNullOr(S.String),
  },
  $I.annote("ProvenanceDetectionEnvironment", {
    description: "Decoded environment inputs used by local provenance detection.",
  })
) {}
class ProvenanceSessionEvidence extends S.Class<ProvenanceSessionEvidence>($I`ProvenanceSessionEvidence`)(
  {
    sessionHome: S.OptionFromNullOr(PrProvenancePath),
    sessionHomeSource: PrProvenanceSessionHomeSource,
    entrypoint: PrProvenanceEntrypoint,
    sessionName: S.OptionFromNullOr(S.String),
    nameSource: PrProvenanceNameSource,
    model: PrProvenanceModel,
  },
  $I.annote("ProvenanceSessionEvidence", {
    description: "Session metadata enriched from local transcript and live-index evidence.",
  })
) {}
const optionalConfigString = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.string(name)).pipe(Effect.orElseSucceed(O.none));
const readDetectionEnvironment = Effect.fn("PrProvenance.readDetectionEnvironment")(function* () {
  const [home, claudeId, claudePid, configuredEntrypoint, hostSessionId, childSession, companionTranscript, codexId] =
    yield* Effect.all(
      [
        optionalConfigString("HOME"),
        optionalConfigString("CLAUDE_CODE_SESSION_ID"),
        Config.option(Config.number("CLAUDE_PID")).pipe(Effect.orElseSucceed(O.none)),
        optionalConfigString("CLAUDE_CODE_ENTRYPOINT"),
        optionalConfigString("CLAUDE_CODE_HOST_SESSION_ID"),
        Config.boolean("CLAUDE_CODE_CHILD_SESSION").pipe(Config.withDefault(false)),
        optionalConfigString("CODEX_COMPANION_TRANSCRIPT_PATH"),
        optionalConfigString("CODEX_THREAD_ID"),
      ],
      { concurrency: 8 }
    );
  return ProvenanceDetectionEnvironment.make({
    home,
    claudeId,
    claudePid,
    configuredEntrypoint,
    hostSessionId,
    childSession,
    companionTranscript,
    codexId,
  });
});
const normalizeEntrypoint = (value: O.Option<string>, codex: boolean): PrProvenanceEntrypoint =>
  O.flatMap(value, S.decodeUnknownOption(PrProvenanceEntrypoint)).pipe(
    O.getOrElse(() => (codex ? "codex-tui" : "unknown"))
  );
const normalizeNameSource = (value: O.Option<string>): PrProvenanceNameSource => {
  const decoded = O.flatMap(value, (candidate) => S.decodeUnknownOption(PrProvenanceNameSource)(candidate));
  return O.isSome(decoded) ? decoded.value : "unknown";
};
const normalizeModel = (value: O.Option<string>): PrProvenanceModel =>
  O.flatMap(value, S.decodeUnknownOption(PrProvenanceModel)).pipe(O.getOrElse(() => "unknown"));
const labelFromBasename = (path: Path.Path, value: string): PrProvenanceLabel =>
  S.decodeOption(PrProvenanceLabel)(path.basename(value)).pipe(O.getOrElse<PrProvenanceLabel>(() => "unknown"));
const readTranscript = Effect.fn("PrProvenance.readTranscript")(function* (transcriptPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(transcriptPath);
  const records = pipe(
    Str.split("\n")(content),
    A.filter(Str.isNonEmpty),
    A.map((line) => decodeTranscriptRecord(line)),
    A.getSomes
  );
  return {
    cwd: pipe(
      records,
      A.findFirst((record) => record.cwd !== undefined),
      O.flatMap((record) => O.fromUndefinedOr(record.cwd))
    ),
    model: pipe(
      records,
      A.filter((record) => record.type === "assistant"),
      A.map((record) => O.fromUndefinedOr(record.message?.model)),
      A.getSomes,
      A.last
    ),
  };
});
const findClaudeTranscript = Effect.fn("PrProvenance.findClaudeTranscript")(function* (home: string, id: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(home, ".claude", "projects");
  const names = yield* fs.readDirectory(root, { recursive: true });
  return pipe(
    names,
    A.findFirst((name) => Str.endsWith(`/${id}.jsonl`)(name) || name === `${id}.jsonl`),
    O.map((name) => path.join(root, name))
  );
});
const findCodexSession = Effect.fn("PrProvenance.findCodexSession")(function* (home: string, id: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(home, ".codex", "sessions");
  const names = yield* fs.readDirectory(root, { recursive: true });
  const match = yield* Effect.reduce(
    A.filter(names, Str.endsWith(".jsonl")),
    O.none<{ readonly cwd: string; readonly model: O.Option<PrProvenanceModel> }>,
    Effect.fnUntraced(function* (found, name) {
      if (O.isSome(found)) return found;
      const content = yield* fs.readFileString(path.join(root, name));
      const lines = pipe(Str.split("\n")(content), A.filter(Str.isNonEmpty));
      const header = pipe(
        lines,
        A.map((line) => decodeCodexHeader(line)),
        A.getSomes,
        A.findFirst((candidate) => candidate.type === "session_meta" && candidate.payload.id === id)
      );
      return O.map(header, (selected) => ({
        cwd: selected.payload.cwd,
        model: pipe(
          lines,
          A.map((line) => decodeCodexTurnContext(line)),
          A.getSomes,
          A.filter((record) => record.type === "turn_context"),
          A.map((record) => O.fromUndefinedOr(record.model)),
          A.getSomes,
          A.map((model) => S.decodeOption(PrProvenanceModel)(model)),
          A.getSomes,
          A.last
        ),
      }));
    })
  );
  return match;
});
const detectGitPaths = Effect.fn("PrProvenance.detectGitPaths")(function* (cwd: string) {
  const path = yield* Path.Path;
  const [common, checkout] = yield* Effect.all(
    [runGitOutput(cwd, ["rev-parse", "--git-common-dir"]), runGitOutput(cwd, ["rev-parse", "--show-toplevel"])],
    { concurrency: 2 }
  );
  const checkoutPath = path.resolve(Str.trim(checkout));
  const clonePath = path.dirname(path.resolve(checkoutPath, Str.trim(common)));
  return {
    clonePath,
    checkoutPath,
    worktreePath: checkoutPath === clonePath ? O.none<string>() : O.some(checkoutPath),
  };
});
/**
 * Read the exact Codex thread identity without inferring a session from ambient markers.
 *
 * **Example** (Inspect the detection effect)
 *
 * ```ts
 * import { detectCodexEnvironment } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(detectCodexEnvironment)) // true
 * ```
 *
 * @returns Whether an exact thread id exists together with its optional value.
 * @category detection
 * @since 0.0.0
 */
export const detectCodexEnvironment = Config.option(Config.string("CODEX_THREAD_ID")).pipe(
  Effect.map((threadId) => [O.isSome(threadId), threadId] as const)
);
const classifyHarness = (environment: ProvenanceDetectionEnvironment): PrProvenanceHarness =>
  O.isSome(environment.codexId) ? "codex" : O.isSome(environment.claudeId) ? "claude-code" : "unknown";
const defaultSessionEvidence = (
  checkoutPath: string,
  entrypoint: PrProvenanceEntrypoint = "unknown"
): ProvenanceSessionEvidence =>
  ProvenanceSessionEvidence.make({
    sessionHome: O.some(checkoutPath),
    sessionHomeSource: "checkout",
    entrypoint,
    sessionName: O.none(),
    nameSource: "unknown",
    model: "unknown",
  });
const readCodexEvidence = Effect.fn("PrProvenance.readCodexEvidence")(function* (
  environment: ProvenanceDetectionEnvironment,
  checkoutPath: string
) {
  const fallback = defaultSessionEvidence(checkoutPath, O.isSome(environment.claudeId) ? "codex-exec" : "codex-tui");
  const coordinates = O.all({ home: environment.home, codexId: environment.codexId });
  if (O.isNone(coordinates)) return fallback;
  const session = yield* findCodexSession(coordinates.value.home, coordinates.value.codexId).pipe(
    Effect.orElseSucceed(O.none<{ readonly cwd: string; readonly model: O.Option<string> }>)
  );
  return O.map(session, (record) =>
    ProvenanceSessionEvidence.make({
      ...fallback,
      sessionHome: O.some(record.cwd),
      sessionHomeSource: "transcript",
      model: normalizeModel(record.model),
    })
  ).pipe(O.getOrElse(() => fallback));
});
const readClaudeTranscriptEvidence = Effect.fn("PrProvenance.readClaudeTranscriptEvidence")(function* (
  environment: ProvenanceDetectionEnvironment
) {
  const coordinates = O.all({ home: environment.home, claudeId: environment.claudeId });
  if (O.isNone(coordinates)) return O.none<{ readonly cwd: O.Option<string>; readonly model: O.Option<string> }>();
  const transcriptPath = yield* O.match(environment.companionTranscript, {
    onNone: () =>
      findClaudeTranscript(coordinates.value.home, coordinates.value.claudeId).pipe(Effect.orElseSucceed(O.none)),
    onSome: Effect.succeedSome,
  });
  return yield* O.match(transcriptPath, {
    onNone: () => Effect.succeedNone,
    onSome: (path) => readTranscript(path).pipe(Effect.option),
  });
});
const readClaudeIndexEvidence = Effect.fn("PrProvenance.readClaudeIndexEvidence")(function* (
  environment: ProvenanceDetectionEnvironment
) {
  const coordinates = O.all({
    home: environment.home,
    claudeId: environment.claudeId,
    claudePid: environment.claudePid,
  });
  if (O.isNone(coordinates)) return O.none<ClaudeSessionIndex>();
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const indexPath = path.join(coordinates.value.home, ".claude", "sessions", `${coordinates.value.claudePid}.json`);
  return yield* fs
    .readFileString(indexPath)
    .pipe(
      Effect.map(decodeClaudeIndex),
      Effect.map(O.filter((index) => index.sessionId === coordinates.value.claudeId)),
      Effect.orElseSucceed(O.none)
    );
});
const readClaudeEvidence = Effect.fn("PrProvenance.readClaudeEvidence")(function* (
  environment: ProvenanceDetectionEnvironment,
  checkoutPath: string
) {
  const [transcript, index] = yield* Effect.all(
    [readClaudeTranscriptEvidence(environment), readClaudeIndexEvidence(environment)],
    { concurrency: 2 }
  );
  const transcriptHome = O.flatMap(transcript, (record) => record.cwd);
  const indexHome = O.map(index, (record) => record.cwd);
  const sessionHome = O.orElse(transcriptHome, () => O.orElse(indexHome, () => O.some(checkoutPath)));
  const sessionHomeSource: PrProvenanceSessionHomeSource = O.isSome(transcriptHome)
    ? "transcript"
    : O.isSome(indexHome)
      ? "index"
      : "checkout";
  return ProvenanceSessionEvidence.make({
    sessionHome,
    sessionHomeSource,
    entrypoint: pipe(
      index,
      O.map((record) => normalizeEntrypoint(O.fromUndefinedOr(record.entrypoint), false)),
      O.getOrElse(() => normalizeEntrypoint(environment.configuredEntrypoint, false))
    ),
    sessionName: O.flatMap(index, (record) => O.fromUndefinedOr(record.name)),
    nameSource: pipe(
      index,
      O.map((record) => normalizeNameSource(O.fromUndefinedOr(record.nameSource))),
      O.getOrElse<PrProvenanceNameSource>(() => "unknown")
    ),
    model: pipe(
      transcript,
      O.flatMap((record) => record.model),
      normalizeModel
    ),
  });
});
const readSessionEvidence = Effect.fn("PrProvenance.readSessionEvidence")(function* (
  harness: PrProvenanceHarness,
  environment: ProvenanceDetectionEnvironment,
  checkoutPath: string
) {
  if (harness === "codex") return yield* readCodexEvidence(environment, checkoutPath);
  if (harness === "claude-code") return yield* readClaudeEvidence(environment, checkoutPath);
  return defaultSessionEvidence(checkoutPath, normalizeEntrypoint(environment.configuredEntrypoint, false));
});
const detectSessionWorkspace = Effect.fn("PrProvenance.detectSessionWorkspace")(function* (
  path: Path.Path,
  sessionHome: O.Option<string>,
  workspace: PrProvenanceLabel
) {
  const labelEquivalence = S.toEquivalence(PrProvenanceLabel);
  return yield* pipe(
    sessionHome,
    O.map((resolvedHome) =>
      detectGitPaths(resolvedHome).pipe(
        Effect.map(({ clonePath }) => labelFromBasename(path, clonePath)),
        Effect.map((label) => (labelEquivalence(label, workspace) ? O.none<PrProvenanceLabel>() : O.some(label))),
        Effect.catchCause(() => Effect.succeedNone)
      )
    ),
    O.getOrElse(() => Effect.succeedNone)
  );
});
/**
 * Detect workstation-local harness provenance from already-resolved Git paths.
 *
 * **Details**
 *
 * Exact Codex or Claude identifiers select transcript and live-index evidence;
 * absent or unreadable evidence falls back to the supplied checkout paths.
 *
 * **Example** (Build a path-bounded detection)
 *
 * ```ts
 * import { detectPrProvenanceFromPaths } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const detection = detectPrProvenanceFromPaths(
 *   "/src/beep-effect",
 *   "/worktrees/beep-effect10",
 *   O.some("/worktrees/beep-effect10"),
 *   "feat/yeet-pr-resume-footer",
 * )
 * console.log(Effect.isEffect(detection)) // true
 * ```
 *
 * @param clonePath - Absolute path to the repository's main clone.
 * @param checkoutPath - Absolute path to the checkout running Yeet.
 * @param worktreePath - Linked-worktree path when the checkout differs from the main clone.
 * @param branch - Git-valid branch associated with the detected session.
 * @returns Local provenance assembled from exact harness evidence and bounded fallbacks.
 * @category detection
 * @since 0.0.0
 */
export const detectPrProvenanceFromPaths = Effect.fn("PrProvenance.detectFromPaths")(function* (
  clonePath: string,
  checkoutPath: string,
  worktreePath: O.Option<string>,
  branch: string
) {
  const path = yield* Path.Path;
  const environment = yield* readDetectionEnvironment();
  const harness = classifyHarness(environment);
  const workspaceOverride = yield* runGitOutput(checkoutPath, ["config", "--get", "beep.workspace.label"]).pipe(
    Effect.map(Str.trim),
    Effect.option,
    Effect.map(O.flatMap(S.decodeUnknownOption(PrProvenanceLabel)))
  );
  const workspace = O.getOrElse(workspaceOverride, () => labelFromBasename(path, clonePath));
  const evidence = yield* readSessionEvidence(harness, environment, checkoutPath);
  const sessionWorkspace = yield* detectSessionWorkspace(path, evidence.sessionHome, workspace);
  return PrProvenance.make({
    branch,
    harness,
    hostHarness: harness === "codex" && O.isSome(environment.claudeId) ? O.some("claude-code") : O.none(),
    sessionId: harness === "codex" ? environment.codexId : environment.claudeId,
    hostSessionId: environment.hostSessionId,
    ...evidence,
    clonePath,
    checkoutPath,
    worktreePath,
    workspace,
    sessionWorkspace,
    childSession: environment.childSession,
  });
});

const fallbackHarness = (codexId: O.Option<string>, claudeId: O.Option<string>): PrProvenanceHarness =>
  O.isSome(codexId) ? "codex" : O.isSome(claudeId) ? "claude-code" : "unknown";
const fallbackHostHarness = (codexId: O.Option<string>, claudeId: O.Option<string>): O.Option<PrProvenanceHarness> =>
  O.isSome(codexId) && O.isSome(claudeId) ? O.some("claude-code") : O.none();
const fallbackSessionId = (codexId: O.Option<string>, claudeId: O.Option<string>): O.Option<string> =>
  O.isSome(codexId) ? codexId : claudeId;
const fallbackEntrypoint = (codexId: O.Option<string>, claudeId: O.Option<string>): PrProvenanceEntrypoint =>
  O.isSome(codexId) ? (O.isSome(claudeId) ? "codex-exec" : "codex-tui") : "unknown";
const makeFallbackProvenance = (
  path: Path.Path,
  cwd: string,
  branch: string,
  codexId: O.Option<string>,
  claudeId: O.Option<string>,
  hostSessionId: O.Option<string>
): PrProvenance => {
  const fallbackPath = path.resolve(cwd);
  return PrProvenance.make({
    branch,
    harness: fallbackHarness(codexId, claudeId),
    hostHarness: fallbackHostHarness(codexId, claudeId),
    sessionId: fallbackSessionId(codexId, claudeId),
    hostSessionId,
    sessionHome: O.some(fallbackPath),
    sessionHomeSource: "checkout",
    entrypoint: fallbackEntrypoint(codexId, claudeId),
    sessionName: O.none(),
    nameSource: "unknown",
    model: "unknown",
    clonePath: fallbackPath,
    checkoutPath: fallbackPath,
    worktreePath: O.none(),
    workspace: labelFromBasename(path, fallbackPath),
    sessionWorkspace: O.none(),
    childSession: false,
  });
};
/**
 * Service contract for detecting local provenance within one checkout boundary.
 *
 * **Example** (Build a service-aware operation)
 *
 * ```ts
 * import type { PrProvenanceServiceShape } from "@beep/repo-cli/test/Yeet"
 *
 * const detectForBranch = (service: PrProvenanceServiceShape) =>
 *   service.detect("/worktrees/beep-effect10", "feat/yeet-pr-resume-footer")
 * console.log(detectForBranch.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface PrProvenanceServiceShape {
  readonly detect: (cwd: string, branch: string) => Effect.Effect<PrProvenance>;
}
/**
 * Context service tag providing bounded workstation-local provenance detection.
 *
 * **Example** (Request the detector from Effect context)
 *
 * ```ts
 * import { PrProvenanceService } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* PrProvenanceService
 *   return yield* service.detect("/worktrees/beep-effect10", "feat/resume")
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PrProvenanceService extends Context.Service<PrProvenanceService, PrProvenanceServiceShape>()(
  $I`PrProvenanceService`
) {}
type Requirements = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;
/**
 * Construct the live provenance detector with captured platform requirements.
 *
 * **Example** (Build the live service effect)
 *
 * ```ts
 * import { makePrProvenanceServiceLive } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(makePrProvenanceServiceLive())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePrProvenanceServiceLive = Effect.fn("PrProvenanceService.make")(function* () {
  const path = yield* Path.Path;
  const context = yield* Effect.context<Requirements>();
  return PrProvenanceService.of({
    detect: Effect.fn("PrProvenanceService.detect")(function* (cwd, branch) {
      const [codexId, claudeId, hostSessionId] = yield* Effect.all(
        [
          optionalConfigString("CODEX_THREAD_ID"),
          optionalConfigString("CLAUDE_CODE_SESSION_ID"),
          optionalConfigString("CLAUDE_CODE_HOST_SESSION_ID"),
        ],
        { concurrency: 3 }
      );
      const fallback = makeFallbackProvenance(path, cwd, branch, codexId, claudeId, hostSessionId);
      return yield* detectGitPaths(cwd).pipe(
        Effect.flatMap(({ clonePath, checkoutPath, worktreePath }) =>
          detectPrProvenanceFromPaths(clonePath, checkoutPath, worktreePath, branch)
        ),
        Effect.provide(context),
        Effect.timeoutOrElse({ duration: "2 seconds", orElse: () => Effect.succeed(fallback) }),
        Effect.catchCause(() => Effect.succeed(fallback))
      );
    }),
  });
});
