/**
 * Versioned schemas for the Stage-1 knowledge semantic-delta scanner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Knowledge/Knowledge.schemas");

const KnowledgePublicText = S.String.check(
  S.isPattern(/^[^\p{Cc}\p{Cf}]*$/u, {
    identifier: $I`KnowledgePublicTextCheck`,
    title: "Control-free knowledge report text",
    description: "Public knowledge finding fields contain no control or Unicode format characters.",
    message: "Expected knowledge report text without control or format characters",
  })
).pipe(
  $I.annoteSchema("KnowledgePublicText", {
    description: "Single-line control-free text safe for public knowledge report fields.",
  })
);

type KnowledgePublicText = typeof KnowledgePublicText.Type;

const isKnowledgePublicText = S.is(KnowledgePublicText);

const KnowledgePublicDetail = S.String.check(
  S.isPattern(/^(?:[^\p{Cc}\p{Cf}]|\n)*$/u, {
    identifier: $I`KnowledgePublicDetailCheck`,
    title: "Control-free knowledge report detail",
    description: "Public knowledge diagnostics may contain line feeds but no other control or format characters.",
    message: "Expected knowledge report detail without unsafe control or format characters",
  })
).pipe(
  $I.annoteSchema("KnowledgePublicDetail", {
    description: "Multiline public knowledge diagnostic text whose only permitted control is line feed.",
  })
);

type KnowledgePublicDetail = typeof KnowledgePublicDetail.Type;

/**
 * Stable finding classes owned by knowledge-surface evaluators.
 *
 * **Details**
 *
 * Stage 1 emits only `broken-tracked-path`, `unknown-beep-command`, `index-drift`, and
 * `failed-assertion`. A `broken-tracked-path` excludes inline spans that exactly name a live local
 * branch, remote-tracking branch, or tag. `unknown-beep-option` and the other members are reserved
 * for later evaluators and are never emitted by this scanner, so a report containing them came from
 * a newer producer.
 *
 * **Example** (Classify a Stage-1 finding kind)
 *
 * ```ts
 * import { KnowledgeFindingKind } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * console.log(KnowledgeFindingKind.is["index-drift"]("index-drift")) // true
 * console.log(KnowledgeFindingKind.Options.length) // 14
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeFindingKind = LiteralKit([
  "host-path-in-live-guidance",
  "host-path-in-historical-artifact",
  "skill-lock-coverage-drift",
  "unresolvable-skill-source",
  "floating-github-skill-source",
  "manifest-v1-legacy",
  "manifest-schema-version-gap",
  "index-drift",
  "exploration-goal-provenance-asymmetry",
  "unresolved-exploration-goal-link",
  "broken-tracked-path",
  "unknown-beep-command",
  "failed-assertion",
  "unknown-beep-option",
]).pipe(
  $I.annoteSchema("KnowledgeFindingKind", {
    description: "Stable classes emitted or reserved by knowledge-surface evaluators.",
  })
);

/**
 * One stable knowledge-surface finding class, spanning both Stage-1 and reserved members.
 *
 * @see {@link KnowledgeFindingKind} for the runtime schema and the Stage-1 emission subset.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeFindingKind = typeof KnowledgeFindingKind.Type;

/**
 * Narrows an unknown value to a stable knowledge finding class.
 *
 * **Example** (Reject an unregistered finding class)
 *
 * ```ts
 * import { isKnowledgeFindingKind } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * console.log(isKnowledgeFindingKind("broken-tracked-path")) // true
 * console.log(isKnowledgeFindingKind("broken-path")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeFindingKind = S.is(KnowledgeFindingKind);

/**
 * Enforcement severity carried by every knowledge finding.
 *
 * **Details**
 *
 * Stage-1 evaluators mint `blocking` findings only; `advisory` exists so later evaluators can report
 * without failing a pull request, and so the delta report shape never changes when they land.
 *
 * **Example** (Read the severity domain)
 *
 * ```ts
 * import { KnowledgeFindingSeverity } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * console.log(KnowledgeFindingSeverity.is.blocking("blocking")) // true
 * console.log(KnowledgeFindingSeverity.Options.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeFindingSeverity = LiteralKit(["blocking", "advisory"]).pipe(
  $I.annoteSchema("KnowledgeFindingSeverity", {
    description: "Finding enforcement severity; Stage-1 findings are blocking.",
  })
);

/**
 * Enforcement severity of a knowledge finding.
 *
 * @see {@link KnowledgeFindingSeverity} for the runtime schema and the Stage-1 severity rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeFindingSeverity = typeof KnowledgeFindingSeverity.Type;

/**
 * Narrows an unknown value to a knowledge finding severity.
 *
 * **Example** (Check a severity read from an archived report)
 *
 * ```ts
 * import { isKnowledgeFindingSeverity } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * console.log(isKnowledgeFindingSeverity("blocking")) // true
 * console.log(isKnowledgeFindingSeverity("warning")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeFindingSeverity = S.is(KnowledgeFindingSeverity);

/**
 * Whether a comparison was allowed to run current-checkout probes against archive data.
 *
 * **Details**
 *
 * The `--help` command probe and the index projection both load code only from the checkout already
 * executing the scan. The selected revision contributes filesystem data and the child process's
 * working directory, never executable modules. `skipped-untrusted-context` retains the fork policy
 * as defense in depth against data-driven behavior and records that the run deliberately declined to
 * probe, so a green fork report can never be mistaken for a fully probed one.
 *
 * `skipped-base-boot-failure` records the other way probe coverage is lost. The current-checkout
 * probe process exited non-zero against merge-base archive data without emitting its structured
 * output. That can happen when the current probe cannot interpret the base revision's data. The
 * branch cannot repair the base side, so the comparison degrades rather than failing closed. The
 * equivalent HEAD-data failure stays an operational error, because HEAD is the branch author's own
 * tree.
 *
 * **Gotchas**
 *
 * The policy is a property of the whole comparison, never of one side: probing only one archive's
 * data would turn every probe-class finding into a spurious introduced or resolved entry. That is
 * why a base boot failure discards the base probe results it had already collected instead of
 * comparing them against an unprobed HEAD.
 *
 * **Example** (Read the probe policy domain)
 *
 * ```ts
 * import { KnowledgeProbePolicy } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * console.log(KnowledgeProbePolicy.is.enabled("enabled")) // true
 * console.log(KnowledgeProbePolicy.Options.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeProbePolicy = LiteralKit([
  "enabled",
  "skipped-untrusted-context",
  "skipped-base-boot-failure",
]).pipe(
  $I.annoteSchema("KnowledgeProbePolicy", {
    description: "Whether current-checkout command and index probes ran against archive data.",
  })
);

/**
 * Whether current-checkout probes ran against archive data for a comparison.
 *
 * @see {@link KnowledgeProbePolicy} for the runtime schema and the fork-pull-request rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeProbePolicy = typeof KnowledgeProbePolicy.Type;

/**
 * Narrows an unknown value to a knowledge probe policy.
 *
 * **Example** (Check a policy read from an archived report)
 *
 * ```ts
 * import { isKnowledgeProbePolicy } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * console.log(isKnowledgeProbePolicy("enabled")) // true
 * console.log(isKnowledgeProbePolicy("sandboxed")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeProbePolicy = S.is(KnowledgeProbePolicy);

/**
 * Finding classes that only a current-checkout probe against archive data can decide.
 *
 * **Details**
 *
 * `unknown-beep-command` needs the current command tree plus the archive's documented command input,
 * and `index-drift` needs the current index projection over archive data. Both disappear from any
 * comparison whose {@link KnowledgeProbePolicy} is not `enabled`, while `broken-tracked-path` and
 * `failed-assertion` keep working from the tracked-tree oracle alone. This is the ratified graceful
 * degradation, and naming it here keeps the scanner and its tests reading from one list.
 *
 * **Example** (Read the probe-dependent classes)
 *
 * ```ts
 * import { KNOWLEDGE_PROBE_DEPENDENT_KINDS } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * console.log(KNOWLEDGE_PROBE_DEPENDENT_KINDS) // [ "unknown-beep-command", "index-drift" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_PROBE_DEPENDENT_KINDS: ReadonlyArray<KnowledgeFindingKind> = [
  "unknown-beep-command",
  "index-drift",
];

/**
 * Versioned SHA-256 identity of one normalized finding instance.
 *
 * **Details**
 *
 * The digest covers the length-prefixed normalization version, kind, document id, subject, and
 * duplicate occurrence index — never the display location — so moving a finding within a file keeps
 * its identity and the paired delta reports it as unchanged.
 *
 * **Example** (Validate a finding identity)
 *
 * ```ts
 * import { KnowledgeFindingId } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import * as S from "effect/Schema"
 *
 * const isFindingId = S.is(KnowledgeFindingId)
 *
 * console.log(
 *   isFindingId("knowledge-finding/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * ) // true
 * console.log(isFindingId("knowledge-finding/v1:short")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeFindingId = S.TemplateLiteral(["knowledge-finding/v1:", Sha256Hex]).pipe(
  $I.annoteSchema("KnowledgeFindingId", {
    description: "SHA-256 identity of one normalized semantic finding instance.",
  })
);

/**
 * A `knowledge-finding/v1:`-prefixed SHA-256 finding identity.
 *
 * @see {@link KnowledgeFindingId} for the runtime schema and the digest preimage rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeFindingId = typeof KnowledgeFindingId.Type;

/**
 * Display-only source location of a finding.
 *
 * **Details**
 *
 * Path, line, and column are excluded from the finding digest. They exist to render an actionable
 * report line and must never be read as part of a finding's identity.
 *
 * **Example** (Locate a finding for rendering)
 *
 * ```ts
 * import { KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const location = KnowledgeFindingLocation.make({
 *   path: "CLAUDE.md",
 *   line: NonNegativeInt.make(42),
 *   column: NonNegativeInt.make(7),
 * })
 *
 * console.log(`${location.path}:${location.line}`) // "CLAUDE.md:42"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeFindingLocation extends S.Class<KnowledgeFindingLocation>($I`KnowledgeFindingLocation`)(
  {
    path: S.String,
    line: S.optionalKey(NonNegativeInt),
    column: S.optionalKey(NonNegativeInt),
  },
  $I.annote("KnowledgeFindingLocation", {
    description: "Display location of a finding; path and offsets are excluded from identity.",
  })
) {}

const KnowledgePublicFindingLocation = KnowledgeFindingLocation.check(
  S.makeFilter<KnowledgeFindingLocation>(
    (location) =>
      isKnowledgePublicText(location.path) || {
        path: ["path"],
        issue: "Expected a knowledge finding path without control or format characters",
      },
    {
      identifier: $I`KnowledgePublicFindingLocationCheck`,
      title: "Control-free knowledge finding location",
      description: "Semantic-delta finding locations contain no terminal control or Unicode format characters.",
    }
  )
).pipe(
  $I.annoteSchema("KnowledgePublicFindingLocation", {
    description: "Display location safe for semantic-delta human and JSON report surfaces.",
  })
);

/**
 * One normalized knowledge finding, versioned for cross-archive comparison.
 *
 * **Details**
 *
 * `schemaVersion` and `normalizationVersion` are tags supplied by the constructor, so callers pass
 * only the semantic fields. Two findings are the same finding exactly when their `findingId` values
 * match; `occurrence` disambiguates repeated identical subjects inside one document. Report-facing
 * document, subject, location, message, and remediation text is control-free. The scanner assigns the
 * identity from the raw normalized candidate before sanitizing those display fields, so hardening a
 * renderer does not churn stable finding ids.
 *
 * **Example** (Build a broken-path finding)
 *
 * ```ts
 * import {
 *   KnowledgeFinding,
 *   KnowledgeFindingId,
 *   KnowledgeFindingLocation,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const finding = KnowledgeFinding.make({
 *   findingId: S.decodeUnknownSync(KnowledgeFindingId)(
 *     "knowledge-finding/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   ),
 *   kind: "broken-tracked-path",
 *   severity: "blocking",
 *   documentId: "base:CLAUDE.md",
 *   subject: "repo-path:goals/missing.md",
 *   occurrence: NonNegativeInt.make(0),
 *   location: KnowledgeFindingLocation.make({ path: "CLAUDE.md" }),
 *   message: "Tracked path does not exist: goals/missing.md.",
 *   remediation: "Update the inline path or add the tracked target.",
 * })
 *
 * console.log(finding.schemaVersion) // "knowledge-finding/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeFinding extends S.Class<KnowledgeFinding>($I`KnowledgeFinding`)(
  {
    schemaVersion: S.tag("knowledge-finding/v1"),
    normalizationVersion: S.tag("knowledge-normalization/v1"),
    findingId: KnowledgeFindingId,
    kind: KnowledgeFindingKind,
    severity: KnowledgeFindingSeverity,
    documentId: KnowledgePublicText,
    subject: KnowledgePublicText,
    occurrence: NonNegativeInt,
    location: KnowledgePublicFindingLocation,
    message: KnowledgePublicText,
    remediation: KnowledgePublicText,
  },
  $I.annote("KnowledgeFinding", {
    description: "Versioned normalized knowledge finding with comparison-scoped semantic identity.",
  })
) {}

/**
 * Narrows an unknown value to a decoded {@link KnowledgeFinding}.
 *
 * **Example** (Reject a partially built finding)
 *
 * ```ts
 * import { isKnowledgeFinding } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * console.log(isKnowledgeFinding({ kind: "index-drift" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeFinding = S.is(KnowledgeFinding);

/**
 * Decodes an archived JSON finding into a {@link KnowledgeFinding}.
 *
 * **When to use**
 *
 * Use when reading findings produced by another archive or an earlier scanner run, where the wire
 * shape has not yet been validated against the current normalization version.
 *
 * **Example** (Surface a decode failure)
 *
 * ```ts
 * import { decodeKnowledgeFinding } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { Effect, Result } from "effect"
 *
 * const outcome = Effect.runSync(Effect.result(decodeKnowledgeFinding({ kind: "index-drift" })))
 *
 * console.log(Result.isFailure(outcome)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeKnowledgeFinding: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<KnowledgeFinding, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<KnowledgeFinding, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(KnowledgeFinding));

/**
 * Encodes a {@link KnowledgeFinding} back to its JSON wire shape.
 *
 * **Example** (Encode a finding for transport)
 *
 * ```ts
 * import {
 *   encodeKnowledgeFinding,
 *   KnowledgeFinding,
 *   KnowledgeFindingId,
 *   KnowledgeFindingLocation,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const finding = KnowledgeFinding.make({
 *   findingId: S.decodeUnknownSync(KnowledgeFindingId)(
 *     "knowledge-finding/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   ),
 *   kind: "index-drift",
 *   severity: "blocking",
 *   documentId: "base:goals/INDEX.md",
 *   subject: "producer://goals/index",
 *   occurrence: NonNegativeInt.make(0),
 *   location: KnowledgeFindingLocation.make({ path: "goals/INDEX.md" }),
 *   message: "goals/INDEX.md differs from the current-checkout projection of the archive data.",
 *   remediation: "Run the goals index generator and commit the regenerated index.",
 * })
 *
 * console.log(Effect.runSync(encodeKnowledgeFinding(finding)).kind) // "index-drift"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeKnowledgeFinding: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof KnowledgeFinding.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof KnowledgeFinding.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(KnowledgeFinding));

/**
 * One tracked Git-tree entry backing the archive-local path oracle.
 *
 * **Details**
 *
 * Only regular blobs (`100644` and `100755`) are scanned; the mode is kept so symlinks and
 * submodule gitlinks can be filtered without a second Git call.
 *
 * **Example** (Record a tracked blob)
 *
 * ```ts
 * import { KnowledgeTrackedEntry } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * const entry = KnowledgeTrackedEntry.make({
 *   path: "goals/INDEX.md",
 *   mode: "100644",
 *   objectId: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
 * })
 *
 * console.log(entry.mode === "100644") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeTrackedEntry extends S.Class<KnowledgeTrackedEntry>($I`KnowledgeTrackedEntry`)(
  {
    path: S.String,
    mode: S.String,
    objectId: S.String,
  },
  $I.annote("KnowledgeTrackedEntry", {
    description: "Tracked path, Git mode, and object id from one commit tree.",
  })
) {}

/**
 * Rename lineage reported by the exact paired Git diff.
 *
 * **Details**
 *
 * A rename lets the HEAD side reuse the base document id, so findings inside a moved file stay
 * unchanged instead of appearing as one resolved and one introduced pair. Only renames at or above
 * the ratified 50 percent similarity threshold reach this schema.
 *
 * **Example** (Carry rename lineage into the delta)
 *
 * ```ts
 * import { KnowledgeRename } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const rename = KnowledgeRename.make({
 *   sourcePath: "docs/old-guide.md",
 *   targetPath: "docs/guide.md",
 *   score: NonNegativeInt.make(97),
 * })
 *
 * console.log(rename.score >= 50) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRename extends S.Class<KnowledgeRename>($I`KnowledgeRename`)(
  {
    sourcePath: S.String,
    targetPath: S.String,
    score: NonNegativeInt,
  },
  $I.annote("KnowledgeRename", {
    description: "A Git rename at or above the ratified 50 percent similarity threshold.",
  })
) {}

/**
 * A documented command that resolved against the current-checkout command tree.
 *
 * **Details**
 *
 * `canonicalPath` holds the resolved command names after alias expansion, so a document written with
 * an alias still reports the canonical spelling.
 *
 * **Example** (Record a resolved command probe)
 *
 * ```ts
 * import { KnowledgeCommandResolved } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * const resolved = KnowledgeCommandResolved.make({ canonicalPath: ["goals", "doctor"] })
 *
 * console.log(resolved.status) // "resolved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeCommandResolved extends S.Class<KnowledgeCommandResolved>($I`KnowledgeCommandResolved`)(
  {
    status: S.tag("resolved"),
    canonicalPath: S.Array(S.String),
  },
  $I.annote("KnowledgeCommandResolved", {
    description: "A structurally resolved current-checkout beep command path whose help action was probed.",
  })
) {}

/**
 * A documented command that failed to resolve against the current-checkout command tree.
 *
 * **Details**
 *
 * `canonicalPath` is the resolved prefix followed by the first unknown word, which is what the
 * emitted `unknown-beep-command` finding reports as its subject.
 *
 * **Example** (Record the first unknown command word)
 *
 * ```ts
 * import { KnowledgeCommandUnknown } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * const unknown = KnowledgeCommandUnknown.make({ canonicalPath: ["goals", "doktor"] })
 *
 * console.log(unknown.canonicalPath[1]) // "doktor"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeCommandUnknown extends S.Class<KnowledgeCommandUnknown>($I`KnowledgeCommandUnknown`)(
  {
    status: S.tag("unknown"),
    canonicalPath: S.Array(S.String),
  },
  $I.annote("KnowledgeCommandUnknown", {
    description: "Canonical resolved prefix followed by the first unknown command word.",
  })
) {}

/**
 * Result of the mandatory current-checkout structural command probe over archive data.
 *
 * **Details**
 *
 * The union is tagged on `status`, so a probe result narrows to {@link KnowledgeCommandResolved} or
 * {@link KnowledgeCommandUnknown} without a separate discriminator check.
 *
 * **Example** (Accept either probe outcome)
 *
 * ```ts
 * import {
 *   KnowledgeCommandProbeResult,
 *   KnowledgeCommandResolved,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import * as S from "effect/Schema"
 *
 * const isProbeResult = S.is(KnowledgeCommandProbeResult)
 *
 * console.log(isProbeResult(KnowledgeCommandResolved.make({ canonicalPath: ["goals"] }))) // true
 * console.log(isProbeResult({ status: "pending" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeCommandProbeResult = S.Union([KnowledgeCommandResolved, KnowledgeCommandUnknown]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("KnowledgeCommandProbeResult", {
    description: "Resolved or unknown current-checkout command-tree result for archive data.",
  })
);

/**
 * Either outcome of one current-checkout command probe over archive data, discriminated by `status`.
 *
 * @see {@link KnowledgeCommandProbeResult} for the runtime schema and its tagged-union narrowing.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeCommandProbeResult = typeof KnowledgeCommandProbeResult.Type;

/**
 * Expected and archived bytes of the generated goals index for one side of a comparison.
 *
 * **Details**
 *
 * The comparison is byte-exact: `expected` is produced by running the current-checkout index
 * generator with the archive as its working directory, and `archived` is the committed
 * `goals/INDEX.md` from that archive. Any difference becomes a single `index-drift` finding whose
 * subject carries both digests.
 *
 * **Example** (Compare a matching index pair)
 *
 * ```ts
 * import { KnowledgeIndexBytes } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * const encoder = new TextEncoder()
 * const bytes = KnowledgeIndexBytes.make({
 *   expected: encoder.encode("# Goal Portfolio\n"),
 *   archived: encoder.encode("# Goal Portfolio\n"),
 * })
 *
 * console.log(bytes.expected.byteLength === bytes.archived.byteLength) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeIndexBytes extends S.Class<KnowledgeIndexBytes>($I`KnowledgeIndexBytes`)(
  {
    expected: S.Uint8Array,
    archived: S.Uint8Array,
  },
  $I.annote("KnowledgeIndexBytes", {
    description: "Exact expected and archived goals index bytes for one side of a comparison.",
  })
) {}

/**
 * A finding extracted in deterministic source order, before identity is assigned.
 *
 * **Details**
 *
 * Candidates carry no `findingId`, `severity`, or `occurrence`: those are assigned in a second pass
 * that counts duplicate `kind` plus `documentId` plus `subject` groups, which is why extraction order
 * must stay deterministic.
 *
 * **Example** (Stage a broken-path candidate)
 *
 * ```ts
 * import {
 *   KnowledgeFindingCandidate,
 *   KnowledgeFindingLocation,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * const candidate = KnowledgeFindingCandidate.make({
 *   kind: "broken-tracked-path",
 *   documentId: "base:CLAUDE.md",
 *   subject: "repo-path:goals/missing.md",
 *   location: KnowledgeFindingLocation.make({ path: "CLAUDE.md" }),
 *   message: "Tracked path does not exist: goals/missing.md.",
 *   remediation: "Update the inline path or add the tracked target.",
 * })
 *
 * console.log(candidate.kind) // "broken-tracked-path"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeFindingCandidate extends S.Class<KnowledgeFindingCandidate>($I`KnowledgeFindingCandidate`)(
  {
    kind: KnowledgeFindingKind,
    documentId: S.String,
    subject: S.String,
    location: KnowledgeFindingLocation,
    message: S.String,
    remediation: S.String,
  },
  $I.annote("KnowledgeFindingCandidate", {
    description: "A normalized finding before duplicate occurrence and digest assignment.",
  })
) {}

/**
 * One archived `bun run beep` invocation awaiting current-checkout resolution.
 *
 * **Details**
 *
 * `words` holds the command tail after the `bun run beep` prefix, already split on whitespace, so the
 * probe can walk the current-checkout command tree without re-parsing the source span.
 *
 * **Example** (Queue a documented command for probing)
 *
 * ```ts
 * import {
 *   KnowledgeCommandOccurrence,
 *   KnowledgeFindingLocation,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 *
 * const occurrence = KnowledgeCommandOccurrence.make({
 *   documentId: "base:CLAUDE.md",
 *   location: KnowledgeFindingLocation.make({ path: "CLAUDE.md" }),
 *   words: ["goals", "doctor"],
 * })
 *
 * console.log(occurrence.words.join(" ")) // "goals doctor"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeCommandOccurrence extends S.Class<KnowledgeCommandOccurrence>($I`KnowledgeCommandOccurrence`)(
  {
    documentId: S.String,
    location: KnowledgeFindingLocation,
    words: S.Array(S.String),
  },
  $I.annote("KnowledgeCommandOccurrence", {
    description: "A source-ordered bun run beep command span before command-tree probing.",
  })
) {}

/**
 * The paired-archive semantic delta between merge-base and HEAD.
 *
 * **Details**
 *
 * Each bucket is sorted by `findingId`, so the report is byte-stable across runs. Only `introduced`
 * fails a pull request; `resolved` and `unchanged` exist to make the comparison auditable rather than
 * to gate it.
 *
 * **Gotchas**
 *
 * `probePolicy` is part of the report because coverage is part of the result. Under any policy other
 * than `enabled` the probe-dependent classes are absent rather than clean, so an empty `introduced`
 * bucket means less than it does under `enabled`. `probeSkipDetail` carries the evidence when the
 * skip was involuntary — the first lines of the base probe's boot failure — and is `O.none()`
 * otherwise, including under `skipped-untrusted-context`, where the policy name is the whole reason.
 *
 * **Example** (Read the gating bucket of a clean report)
 *
 * ```ts
 * import { KnowledgeSemanticDeltaReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import * as O from "effect/Option"
 *
 * const report = KnowledgeSemanticDeltaReport.make({
 *   introduced: [],
 *   resolved: [],
 *   unchanged: [],
 *   probePolicy: "enabled",
 * })
 *
 * console.log(report.introduced.length) // 0
 * console.log(O.isNone(report.probeSkipDetail)) // true
 * ```
 *
 * @see {@link KnowledgeProbePolicy} for what a skipped comparison stops checking.
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSemanticDeltaReport extends S.Class<KnowledgeSemanticDeltaReport>(
  $I`KnowledgeSemanticDeltaReport`
)(
  {
    introduced: S.Array(KnowledgeFinding),
    resolved: S.Array(KnowledgeFinding),
    unchanged: S.Array(KnowledgeFinding),
    probePolicy: KnowledgeProbePolicy,
    probeSkipDetail: S.OptionFromOptionalKey(KnowledgePublicDetail).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<KnowledgePublicDetail>()))
    ),
  },
  $I.annote("KnowledgeSemanticDeltaReport", {
    description: "Findings introduced, resolved, and unchanged between merge-base and HEAD archives.",
  })
) {}

/**
 * Encodes a {@link KnowledgeSemanticDeltaReport} directly to its JSON string form.
 *
 * **When to use**
 *
 * Use when `beep knowledge semantic-delta --json` must emit one machine-readable line, instead of
 * encoding to a record and stringifying separately.
 *
 * **Example** (Render a clean report as JSON)
 *
 * ```ts
 * import {
 *   encodeKnowledgeSemanticDeltaReportJson,
 *   KnowledgeSemanticDeltaReport,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { Effect } from "effect"
 *
 * const json = Effect.runSync(
 *   encodeKnowledgeSemanticDeltaReportJson(
 *     KnowledgeSemanticDeltaReport.make({
 *       introduced: [],
 *       resolved: [],
 *       unchanged: [],
 *       probePolicy: "enabled",
 *     })
 *   )
 * )
 *
 * console.log(json.includes("\"introduced\"")) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeKnowledgeSemanticDeltaReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<string, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(S.fromJsonString(KnowledgeSemanticDeltaReport)));
