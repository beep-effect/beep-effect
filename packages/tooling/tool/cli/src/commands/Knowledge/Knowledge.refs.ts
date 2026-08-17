/**
 * Reference census schemas, the shared Markdown scanning machinery, the pure classifier, and the
 * single-tree evaluator behind `beep knowledge refs`.
 *
 * This module owns the reference grammar the whole Knowledge family reads from: the governed
 * repo-path normalizer, the fence-aware line reader, the inline-code span reader, and the
 * length-prefixed digest discipline. `Knowledge.service.ts` imports them rather than keeping private
 * copies, so Stage-1 enforcement and the phase-0 census can never drift apart on what a document
 * line means.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { Effect, flow, HashMap, HashSet, Match, MutableHashMap, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeGoalManifest } from "../Goals/Goals.schemas.ts";
import { parseGoalManifestText } from "../Goals/Inventory.ts";
import { KnowledgeOperationalError } from "./Knowledge.errors.ts";
import { KnowledgeFindingLocation } from "./Knowledge.schemas.ts";
import type * as AST from "effect/SchemaAST";
import type { KnowledgeTrackedEntry } from "./Knowledge.schemas.ts";

const $I = $RepoCliId.create("commands/Knowledge/Knowledge.refs");

const REF_NORMALIZATION_VERSION = "knowledge-ref-normalization/v1";
const REF_ID_PREFIX = "knowledge-ref/v1:";
const textEncoder = new TextEncoder();
const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });
const nfc = Str.normalize("NFC");

/**
 * Every reference bus the census can carry, including the reserved upstream domain.
 *
 * **Details**
 *
 * v1 emits `repo-path`, `host-path`, and `goal-uri` only. `upstream` is reserved by ratified
 * decision A5: `upstream://owner/repo@sha` provenance belongs to Workstream B's `skills-lock/v2`
 * bus, so the kind domain names it while no member class exists and no observation ever carries it.
 *
 * **Example** (Read the reference kind domain)
 *
 * ```ts
 * import { KnowledgeRefKind } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeRefKind.is["repo-path"]("repo-path")) // true
 * console.log(KnowledgeRefKind.Options.length) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRefKind = LiteralKit(["repo-path", "host-path", "goal-uri", "upstream"]).pipe(
  $I.annoteSchema("KnowledgeRefKind", {
    description: "Reference buses recognised by the census; upstream is reserved and never emitted.",
  })
);

/**
 * One reference bus, spanning the three emitted kinds and the reserved upstream domain.
 *
 * @see {@link KnowledgeRefKind} for the runtime schema and the reserved-member rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeRefKind = typeof KnowledgeRefKind.Type;

/**
 * Narrows an unknown value to a reference bus.
 *
 * **Example** (Reject an unregistered bus)
 *
 * ```ts
 * import { isKnowledgeRefKind } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeRefKind("goal-uri")) // true
 * console.log(isKnowledgeRefKind("goal-url")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeRefKind = S.is(KnowledgeRefKind);

/**
 * Lexical anchor that made a span machine-local.
 *
 * **Details**
 *
 * The five members reproduce the clone-agnosticism baseline exactly: absolute home prefixes,
 * home-relative `~/` prefixes, `/tmp/`, encoded session-directory literals, and the bare machine
 * tree name. The anchors are non-overlapping by construction, which is what makes census totals
 * comparable with the inventory that established them.
 *
 * **Example** (Read the anchor domain)
 *
 * ```ts
 * import { KnowledgeHostAnchor } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeHostAnchor.is["home-relative"]("home-relative")) // true
 * console.log(KnowledgeHostAnchor.Options.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeHostAnchor = LiteralKit([
  "home-absolute",
  "home-relative",
  "temp",
  "encoded-home",
  "bare-tree-name",
]).pipe(
  $I.annoteSchema("KnowledgeHostAnchor", {
    description: "Lexical anchor that made a span machine-local.",
  })
);

/**
 * The lexical anchor behind one machine-local reference.
 *
 * @see {@link KnowledgeHostAnchor} for the runtime schema and the non-overlap rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeHostAnchor = typeof KnowledgeHostAnchor.Type;

/**
 * Narrows an unknown value to a host anchor.
 *
 * **Example** (Reject an unregistered anchor)
 *
 * ```ts
 * import { isKnowledgeHostAnchor } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeHostAnchor("temp")) // true
 * console.log(isKnowledgeHostAnchor("tmp")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeHostAnchor = S.is(KnowledgeHostAnchor);

/**
 * Corpus disposition of the document that contains an observation.
 *
 * **Details**
 *
 * Stage-1 enforcement excludes archival directories; the census includes them and labels them
 * instead, because the archival bucket is 83 percent of the baseline and rewriting captured
 * provenance would rewrite history.
 *
 * **Example** (Read the surface domain)
 *
 * ```ts
 * import { KnowledgeRefSurface } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeRefSurface.is.archival("archival")) // true
 * console.log(KnowledgeRefSurface.Options.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRefSurface = LiteralKit(["live", "archival"]).pipe(
  $I.annoteSchema("KnowledgeRefSurface", {
    description: "Corpus disposition of the containing document.",
  })
);

/**
 * Whether the containing document is live guidance or a captured archival artifact.
 *
 * @see {@link KnowledgeRefSurface} for the runtime schema and the archival-inclusion rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeRefSurface = typeof KnowledgeRefSurface.Type;

/**
 * Narrows an unknown value to a corpus surface.
 *
 * **Example** (Reject an unregistered surface)
 *
 * ```ts
 * import { isKnowledgeRefSurface } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeRefSurface("live")) // true
 * console.log(isKnowledgeRefSurface("current")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeRefSurface = S.is(KnowledgeRefSurface);

/**
 * The surface selector a census listing can be narrowed to.
 *
 * **Details**
 *
 * `all` is the default and the only value that shows the whole corpus. The filter narrows the
 * detailed listing only: summary counts are always whole-corpus, so a filtered run can never
 * understate the census it reports.
 *
 * **Example** (Read the surface-filter domain)
 *
 * ```ts
 * import { KnowledgeRefSurfaceFilter } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeRefSurfaceFilter.is.all("all")) // true
 * console.log(KnowledgeRefSurfaceFilter.Options.length) // 3
 * ```
 *
 * @see {@link KnowledgeRefSurface} for the per-observation disposition it filters on.
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRefSurfaceFilter = LiteralKit(["all", "live", "archival"]).pipe(
  $I.annoteSchema("KnowledgeRefSurfaceFilter", {
    description: "Surface selector narrowing a census listing without changing its counts.",
  })
);

/**
 * Which surfaces a census listing shows.
 *
 * @see {@link KnowledgeRefSurfaceFilter} for the runtime schema and the counts-stay-whole rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeRefSurfaceFilter = typeof KnowledgeRefSurfaceFilter.Type;

/**
 * Deterministic triage class assigned to one reference observation.
 *
 * **Details**
 *
 * The twelve classes are computed by a total rule table, never hand-labelled — phase 0 exists to
 * eyeball the rule table rather than the individual rows. Four classes describe resolution outcomes
 * (`verified`, `broken-target`, `identity-mismatch`, `producer-owned-target`), six describe host
 * anchors, and two describe grammar failures.
 *
 * **Example** (Read the classification domain)
 *
 * ```ts
 * import { KnowledgeRefClassification } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeRefClassification.is["broken-target"]("broken-target")) // true
 * console.log(KnowledgeRefClassification.Options.length) // 12
 * ```
 *
 * @see {@link classifyKnowledgeRef} for the ordered rule table that assigns them.
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRefClassification = LiteralKit([
  "verified",
  "broken-target",
  "identity-mismatch",
  "producer-owned-target",
  "actionable-host-path",
  "portable-home-convention",
  "documented-temp-convention",
  "external-mirror-reference",
  "archival-provenance",
  "audit-pattern-literal",
  "ambiguous-ref-pairing",
  "ungoverned-syntax",
]).pipe(
  $I.annoteSchema("KnowledgeRefClassification", {
    description: "Deterministic triage class assigned to one reference observation.",
  })
);

/**
 * One deterministic triage class.
 *
 * @see {@link KnowledgeRefClassification} for the runtime schema and the rule-table discipline.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeRefClassification = typeof KnowledgeRefClassification.Type;

/**
 * Narrows an unknown value to a reference classification.
 *
 * **Example** (Reject an unregistered class)
 *
 * ```ts
 * import { isKnowledgeRefClassification } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeRefClassification("audit-pattern-literal")) // true
 * console.log(isKnowledgeRefClassification("false-positive")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeRefClassification = S.is(KnowledgeRefClassification);

/**
 * Resolution outcome of one reference against the requested tree.
 *
 * **Details**
 *
 * `not-applicable` is not a failure: every host path is unresolvable by construction rather than
 * broken, and so is a reference whose pairing was ambiguous enough that guessing a target would
 * violate the split-brain rule.
 *
 * **Example** (Read the resolution-status domain)
 *
 * ```ts
 * import { KnowledgeRefResolutionStatus } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeRefResolutionStatus.is["not-applicable"]("not-applicable")) // true
 * console.log(KnowledgeRefResolutionStatus.Options.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRefResolutionStatus = LiteralKit([
  "resolved",
  "missing",
  "identity-mismatch",
  "producer-owned",
  "not-applicable",
]).pipe(
  $I.annoteSchema("KnowledgeRefResolutionStatus", {
    description: "Tag domain of the reference resolution union.",
  })
);

/**
 * The tag of one reference resolution.
 *
 * @see {@link KnowledgeRefResolutionStatus} for the runtime schema and the not-applicable rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeRefResolutionStatus = typeof KnowledgeRefResolutionStatus.Type;

/**
 * Why a tracked blob under the scanned scope was recorded rather than read.
 *
 * **Details**
 *
 * Tracked symlinks are reported and never followed (ratified decision A6), so `.agents/skills` and
 * `.claude/skills` stay independently auditable. Malformed UTF-8 skips the blob and keeps the run
 * green: a census that dies on one undecodable file reports nothing about the other four thousand.
 *
 * **Example** (Read the skip-reason domain)
 *
 * ```ts
 * import { KnowledgeSkipReason } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeSkipReason.is.symlink("symlink")) // true
 * console.log(KnowledgeSkipReason.Options.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeSkipReason = LiteralKit(["symlink", "gitlink", "malformed-utf8"]).pipe(
  $I.annoteSchema("KnowledgeSkipReason", {
    description: "Why a scoped tracked blob was recorded instead of scanned.",
  })
);

/**
 * Why one scoped tracked blob was skipped.
 *
 * @see {@link KnowledgeSkipReason} for the runtime schema and the never-follow-symlinks rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeSkipReason = typeof KnowledgeSkipReason.Type;

/**
 * Narrows an unknown value to a skip reason.
 *
 * **Example** (Reject an unregistered reason)
 *
 * ```ts
 * import { isKnowledgeSkipReason } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeSkipReason("gitlink")) // true
 * console.log(isKnowledgeSkipReason("binary")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeSkipReason = S.is(KnowledgeSkipReason);

/**
 * The Git commit object name a census was computed against.
 *
 * **Gotchas**
 *
 * This is a SHA-1 object name, forty lowercase hexadecimal characters — not a SHA-256 digest. The
 * report carries both: `commit` pins the tree, while every `refId` carries a SHA-256 identity.
 *
 * **Example** (Validate a resolved commit)
 *
 * ```ts
 * import { KnowledgeCommitSha } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as S from "effect/Schema"
 *
 * const isCommit = S.is(KnowledgeCommitSha)
 *
 * console.log(isCommit("2162ebdc8a2162ebdc8a2162ebdc8a2162ebdc8a")) // true
 * console.log(isCommit("HEAD")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeCommitSha = S.String.check(
  S.isPattern(/^[0-9a-f]{40}$/u, {
    identifier: $I`KnowledgeCommitShaPatternCheck`,
    title: "Knowledge Commit Sha Pattern",
    description: "Lowercase forty-character hexadecimal Git commit object name.",
    message: "Expected a lowercase forty-character hexadecimal Git commit id",
  })
).pipe(
  $I.annoteSchema("KnowledgeCommitSha", {
    description: "Forty-character lowercase hexadecimal Git commit object name.",
  })
);

/**
 * A forty-character lowercase hexadecimal Git commit object name.
 *
 * @see {@link KnowledgeCommitSha} for the runtime schema and the SHA-1-versus-SHA-256 distinction.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeCommitSha = typeof KnowledgeCommitSha.Type;

/**
 * Versioned SHA-256 identity of one normalized reference instance.
 *
 * **Details**
 *
 * The digest covers the length-prefixed normalization version, kind, document id, normalized
 * subject, and duplicate occurrence index — never the display location — so reflowing a document
 * cannot relabel the references inside it.
 *
 * **Example** (Validate a reference identity)
 *
 * ```ts
 * import { KnowledgeRefId } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as S from "effect/Schema"
 *
 * const isRefId = S.is(KnowledgeRefId)
 *
 * console.log(
 *   isRefId("knowledge-ref/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * ) // true
 * console.log(isRefId("knowledge-ref/v1:short")) // false
 * ```
 *
 * @see {@link makeKnowledgeRefId} for the exact preimage it is computed from.
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRefId = S.TemplateLiteral(["knowledge-ref/v1:", Sha256Hex]).pipe(
  $I.annoteSchema("KnowledgeRefId", {
    description: "SHA-256 identity of one normalized reference instance.",
  })
);

/**
 * A `knowledge-ref/v1:`-prefixed SHA-256 reference identity.
 *
 * @see {@link KnowledgeRefId} for the runtime schema and the digest preimage rule.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeRefId = typeof KnowledgeRefId.Type;

/**
 * A repository-root-relative target after governed normalization.
 *
 * **Gotchas**
 *
 * `normalized` carries a resolved repository path only when the spelling was governed. For an
 * `ungoverned-syntax` observation it carries the best-effort cleaned spelling — the raw text minus
 * its query and fragment — because there is no governed path to report.
 *
 * **Example** (Record a governed repository reference)
 *
 * ```ts
 * import { KnowledgeRepoPathRef } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const ref = KnowledgeRepoPathRef.make({ raw: "./PLAN.md", normalized: "goals/example/PLAN.md" })
 *
 * console.log(ref.kind) // "repo-path"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRepoPathRef extends S.Class<KnowledgeRepoPathRef>($I`KnowledgeRepoPathRef`)(
  {
    kind: S.tag("repo-path"),
    raw: S.String,
    normalized: S.String,
  },
  $I.annote("KnowledgeRepoPathRef", {
    description: "Repo-root-relative target after governed normalization.",
  })
) {}

/**
 * A machine-local span that no tree can resolve.
 *
 * **Example** (Record a home-relative reference)
 *
 * ```ts
 * import { KnowledgeHostPathRef } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const ref = KnowledgeHostPathRef.make({ raw: "~/.claude/memory", anchor: "home-relative" })
 *
 * console.log(ref.anchor) // "home-relative"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeHostPathRef extends S.Class<KnowledgeHostPathRef>($I`KnowledgeHostPathRef`)(
  {
    kind: S.tag("host-path"),
    raw: S.String,
    anchor: KnowledgeHostAnchor,
  },
  $I.annote("KnowledgeHostPathRef", {
    description: "Machine-local span; never resolvable inside a tree.",
  })
) {}

/**
 * A `repo://goal/<slug>` identity plus the display path it was paired with.
 *
 * **Details**
 *
 * `displayPath` is absent for a heading-scope `beep:ref` and for an ambiguous pairing, because the
 * split-brain rule forbids guessing which object an identity names.
 *
 * **Example** (Record a goal identity without a display path)
 *
 * ```ts
 * import { KnowledgeGoalUriRef } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const ref = KnowledgeGoalUriRef.make({
 *   raw: "repo://goal/knowledge-surface-automation",
 *   slug: "knowledge-surface-automation",
 * })
 *
 * console.log(ref.slug) // "knowledge-surface-automation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeGoalUriRef extends S.Class<KnowledgeGoalUriRef>($I`KnowledgeGoalUriRef`)(
  {
    kind: S.tag("goal-uri"),
    raw: S.String,
    slug: S.String,
    displayPath: S.optionalKey(S.String),
  },
  $I.annote("KnowledgeGoalUriRef", {
    description: "repo://goal/<slug> identity plus its paired display path.",
  })
) {}

/**
 * One recognised reference across the typed buses.
 *
 * **Example** (Accept any emitted reference member)
 *
 * ```ts
 * import { KnowledgeHostPathRef, KnowledgeRef } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as S from "effect/Schema"
 *
 * const isRef = S.is(KnowledgeRef)
 *
 * console.log(isRef(KnowledgeHostPathRef.make({ raw: "/tmp/portless", anchor: "temp" }))) // true
 * console.log(isRef({ kind: "upstream" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRef = S.Union([KnowledgeRepoPathRef, KnowledgeHostPathRef, KnowledgeGoalUriRef]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("KnowledgeRef", {
    description: "One recognised reference across the typed buses.",
  })
);

/**
 * Any emitted reference, discriminated by `kind`.
 *
 * @see {@link KnowledgeRef} for the runtime schema and its tagged-union narrowing.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeRef = typeof KnowledgeRef.Type;

/**
 * A reference whose target exists in the scanned tree.
 *
 * **Gotchas**
 *
 * `mode` and `objectId` are present for a file target and absent for a directory target: a directory
 * has no blob of its own, and inventing one would make a directory hit indistinguishable from a file
 * hit in the report.
 *
 * **Example** (Record a resolved file target)
 *
 * ```ts
 * import { KnowledgeRefResolved } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const resolution = KnowledgeRefResolved.make({
 *   targetPath: "docs/README.md",
 *   mode: "100644",
 *   objectId: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
 * })
 *
 * console.log(resolution.status) // "resolved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRefResolved extends S.Class<KnowledgeRefResolved>($I`KnowledgeRefResolved`)(
  {
    status: S.tag("resolved"),
    targetPath: S.String,
    mode: S.optionalKey(S.String),
    objectId: S.optionalKey(S.String),
  },
  $I.annote("KnowledgeRefResolved", {
    description: "Reference target found in the scanned tree, with blob identity for file targets.",
  })
) {}

/**
 * A reference whose target is absent from the scanned tree.
 *
 * **Example** (Record a missing target)
 *
 * ```ts
 * import { KnowledgeRefMissing } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeRefMissing.make({}).status) // "missing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRefMissing extends S.Class<KnowledgeRefMissing>($I`KnowledgeRefMissing`)(
  {
    status: S.tag("missing"),
  },
  $I.annote("KnowledgeRefMissing", {
    description: "Reference target absent from the scanned tree and owned by no producer.",
  })
) {}

/**
 * A goal reference whose manifest exists but declares a different identity.
 *
 * **Details**
 *
 * This is the split-brain drift the specification names as Workstream A's load-bearing risk, which
 * is why it is reported distinctly from a missing target rather than folded into it.
 *
 * **Example** (Record drifted goal identity)
 *
 * ```ts
 * import { KnowledgeRefIdentityMismatch } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const resolution = KnowledgeRefIdentityMismatch.make({ declaredId: "another-slug" })
 *
 * console.log(resolution.declaredId) // "another-slug"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRefIdentityMismatch extends S.Class<KnowledgeRefIdentityMismatch>(
  $I`KnowledgeRefIdentityMismatch`
)(
  {
    status: S.tag("identity-mismatch"),
    declaredId: S.String,
  },
  $I.annote("KnowledgeRefIdentityMismatch", {
    description: "Tracked goal manifest whose declared initiative id disagrees with the referenced slug.",
  })
) {}

/**
 * A missing target that a registered producer regenerates.
 *
 * **Details**
 *
 * The registry exists so the report says "run this" rather than "broken". v1 registers exactly one
 * producer, `producer://goals/index`, which owns the generated `goals/INDEX.md` projection.
 *
 * **Example** (Record a producer-owned target)
 *
 * ```ts
 * import { KnowledgeRefProducerOwned } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const resolution = KnowledgeRefProducerOwned.make({
 *   producerId: "producer://goals/index",
 *   command: "bun run beep goals index --write",
 * })
 *
 * console.log(resolution.producerId) // "producer://goals/index"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRefProducerOwned extends S.Class<KnowledgeRefProducerOwned>($I`KnowledgeRefProducerOwned`)(
  {
    status: S.tag("producer-owned"),
    producerId: S.String,
    command: S.String,
  },
  $I.annote("KnowledgeRefProducerOwned", {
    description: "Absent target that a registered producer regenerates, carrying its exact command.",
  })
) {}

/**
 * A reference that no tree lookup can decide.
 *
 * **Example** (Record an unresolvable host path)
 *
 * ```ts
 * import { KnowledgeRefNotApplicable } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(KnowledgeRefNotApplicable.make({}).status) // "not-applicable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRefNotApplicable extends S.Class<KnowledgeRefNotApplicable>($I`KnowledgeRefNotApplicable`)(
  {
    status: S.tag("not-applicable"),
  },
  $I.annote("KnowledgeRefNotApplicable", {
    description: "Reference unresolvable by construction rather than broken.",
  })
) {}

/**
 * How one reference resolved against the scanned tree.
 *
 * **Example** (Accept any resolution member)
 *
 * ```ts
 * import { KnowledgeRefMissing, KnowledgeRefResolution } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as S from "effect/Schema"
 *
 * const isResolution = S.is(KnowledgeRefResolution)
 *
 * console.log(isResolution(KnowledgeRefMissing.make({}))) // true
 * console.log(isResolution({ status: "pending" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeRefResolution = S.Union([
  KnowledgeRefResolved,
  KnowledgeRefMissing,
  KnowledgeRefIdentityMismatch,
  KnowledgeRefProducerOwned,
  KnowledgeRefNotApplicable,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("KnowledgeRefResolution", {
    description: "Tree-resolution outcome of one reference observation.",
  })
);

/**
 * Any resolution outcome, discriminated by `status`.
 *
 * @see {@link KnowledgeRefResolution} for the runtime schema and its tagged-union narrowing.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeRefResolution = typeof KnowledgeRefResolution.Type;

/**
 * One scoped tracked blob the census recorded instead of scanning.
 *
 * **Example** (Record a tracked symlink)
 *
 * ```ts
 * import { KnowledgeSkippedBlob } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const skipped = KnowledgeSkippedBlob.make({
 *   path: ".agents/skills",
 *   mode: "120000",
 *   reason: "symlink",
 * })
 *
 * console.log(skipped.reason) // "symlink"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSkippedBlob extends S.Class<KnowledgeSkippedBlob>($I`KnowledgeSkippedBlob`)(
  {
    path: S.String,
    mode: S.String,
    reason: KnowledgeSkipReason,
  },
  $I.annote("KnowledgeSkippedBlob", {
    description: "A scoped tracked blob recorded with a reason rather than scanned.",
  })
) {}

/**
 * One resolved, classified reference occurrence.
 *
 * **Details**
 *
 * Observations are not findings. They live in a separate identity space on purpose: the census
 * measures the corpus, and the mapping onto gating finding classes belongs to a later evaluator that
 * cannot be confused with this one.
 *
 * **Example** (Read the identity of an observation)
 *
 * ```ts
 * import {
 *   KnowledgeHostPathRef,
 *   KnowledgeRefId,
 *   KnowledgeRefNotApplicable,
 *   KnowledgeRefObservation,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const observation = KnowledgeRefObservation.make({
 *   refId: S.decodeUnknownSync(KnowledgeRefId)(
 *     "knowledge-ref/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   ),
 *   ref: KnowledgeHostPathRef.make({ raw: "/tmp/portless", anchor: "temp" }),
 *   documentId: ".claude/skills/portless/SKILL.md",
 *   occurrence: NonNegativeInt.make(0),
 *   surface: "live",
 *   classification: "documented-temp-convention",
 *   resolution: KnowledgeRefNotApplicable.make({}),
 *   location: KnowledgeFindingLocation.make({ path: ".claude/skills/portless/SKILL.md" }),
 *   remediation: "None; the prefix is a documented temporary-path convention.",
 * })
 *
 * console.log(observation.classification) // "documented-temp-convention"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRefObservation extends S.Class<KnowledgeRefObservation>($I`KnowledgeRefObservation`)(
  {
    refId: KnowledgeRefId,
    ref: KnowledgeRef,
    documentId: S.String,
    occurrence: NonNegativeInt,
    surface: KnowledgeRefSurface,
    classification: KnowledgeRefClassification,
    resolution: KnowledgeRefResolution,
    location: KnowledgeFindingLocation,
    remediation: S.String,
  },
  $I.annote("KnowledgeRefObservation", {
    description: "One resolved, classified reference occurrence.",
  })
) {}

/**
 * Versioned reference census for one Git tree.
 *
 * **Details**
 *
 * `observations` is sorted by document path, line, column, kind, and subject, and `skipped` is
 * sorted by path, so permuting the oracle's tracked-entry order yields byte-identical JSON. That
 * stability is what makes two census runs diffable.
 *
 * **Example** (Read an empty census envelope)
 *
 * ```ts
 * import { KnowledgeRefsReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const report = KnowledgeRefsReport.make({
 *   treeish: "HEAD",
 *   commit: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   observations: [],
 *   skipped: [],
 * })
 *
 * console.log(report.schemaVersion) // "knowledge-refs/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeRefsReport extends S.Class<KnowledgeRefsReport>($I`KnowledgeRefsReport`)(
  {
    schemaVersion: S.tag("knowledge-refs/v1"),
    normalizationVersion: S.tag("knowledge-ref-normalization/v1"),
    treeish: S.String,
    commit: KnowledgeCommitSha,
    observations: S.Array(KnowledgeRefObservation),
    skipped: S.Array(KnowledgeSkippedBlob),
  },
  $I.annote("KnowledgeRefsReport", {
    description: "Versioned reference census for one Git tree.",
  })
) {}

/**
 * Narrows an unknown value to a decoded {@link KnowledgeRefsReport}.
 *
 * **Example** (Reject a partially built report)
 *
 * ```ts
 * import { isKnowledgeRefsReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeRefsReport({ treeish: "HEAD" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isKnowledgeRefsReport = S.is(KnowledgeRefsReport);

/**
 * Encodes a {@link KnowledgeRefsReport} directly to its JSON string form.
 *
 * **When to use**
 *
 * Use when `beep knowledge refs --json` must emit one machine-readable line, instead of encoding to
 * a record and stringifying separately.
 *
 * **Example** (Render an empty census as JSON)
 *
 * ```ts
 * import {
 *   encodeKnowledgeRefsReportJson,
 *   KnowledgeRefsReport,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { Effect } from "effect"
 *
 * const json = Effect.runSync(
 *   encodeKnowledgeRefsReportJson(
 *     KnowledgeRefsReport.make({
 *       treeish: "HEAD",
 *       commit: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *       observations: [],
 *       skipped: [],
 *     })
 *   )
 * )
 *
 * console.log(json.includes("\"knowledge-refs/v1\"")) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeKnowledgeRefsReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<string, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(S.fromJsonString(KnowledgeRefsReport)));

/**
 * Decodes one JSON census line back into a {@link KnowledgeRefsReport}.
 *
 * **When to use**
 *
 * Use when reading a census emitted by another run — a committed evidence artifact, or the
 * `--json` output of a subprocess — where the wire shape has not yet been validated.
 *
 * **Example** (Surface a decode failure)
 *
 * ```ts
 * import { decodeKnowledgeRefsReportJson } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { Effect, Result } from "effect"
 *
 * const outcome = Effect.runSync(Effect.result(decodeKnowledgeRefsReportJson("{}")))
 *
 * console.log(Result.isFailure(outcome)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeKnowledgeRefsReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<KnowledgeRefsReport, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<KnowledgeRefsReport, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(KnowledgeRefsReport)));

const decodeSha256 = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeRefId = S.decodeUnknownEffect(KnowledgeRefId);
const decodeCommitSha = S.decodeUnknownEffect(KnowledgeCommitSha);

/**
 * Length-prefixes one digest field so the concatenated preimage stays injective.
 *
 * **Details**
 *
 * The value is NFC-normalized first, then prefixed with its UTF-8 byte length and a colon. Without
 * the prefix, two different field splits could concatenate to the same preimage and collide into one
 * identity; with it, they cannot.
 *
 * **Example** (Prefix a document id)
 *
 * ```ts
 * import { knowledgeLengthPrefix } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(knowledgeLengthPrefix("CLAUDE.md")) // "9:CLAUDE.md"
 * ```
 *
 * @param value - One digest field, in any Unicode normalization form.
 * @returns The byte length, a colon, and the NFC-normalized value.
 * @category identifiers
 * @since 0.0.0
 */
export const knowledgeLengthPrefix = (value: string): string => {
  const normalized = nfc(value);
  return `${textEncoder.encode(normalized).byteLength}:${normalized}`;
};

/**
 * Computes a lowercase SHA-256 digest, failing closed with the caller's own message.
 *
 * **Details**
 *
 * The message is a parameter because the two identity spaces report digest failures differently:
 * Stage 1 names the semantic delta, the census names the reference bus. Sharing the computation
 * while parameterizing the wording keeps one digest path without flattening two error surfaces into
 * one.
 *
 * **Example** (Build the digest effect for empty input)
 *
 * ```ts
 * import { knowledgeSha256Hex } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { Effect } from "effect"
 *
 * const digest = knowledgeSha256Hex(new Uint8Array(), "Failed to digest census input.")
 *
 * console.log(Effect.isEffect(digest)) // true
 * ```
 *
 * @param bytes - Exact preimage bytes.
 * @param message - Operational-error message used when the digest cannot be computed.
 * @returns The lowercase hexadecimal digest.
 * @category identifiers
 * @since 0.0.0
 */
export const knowledgeSha256Hex = Effect.fn("Knowledge.sha256Hex")(function* (bytes: Uint8Array, message: string) {
  return yield* decodeSha256(bytes).pipe(KnowledgeOperationalError.mapError(message));
});

/**
 * Computes the ratified v1 reference identity from its exact length-prefixed preimage.
 *
 * **Details**
 *
 * The preimage concatenates the byte-length-prefixed normalization version, kind, NFC-normalized
 * document id, NFC-normalized subject, and occurrence index. Display location is deliberately
 * absent, so moving a reference inside a document keeps its identity. Subjects are per-bus:
 * `repo-path:<normalized>`, `host-path:<anchor>:<token>`, and `goal-uri:<slug>`.
 *
 * **Example** (Derive an identity for a repository reference)
 *
 * ```ts
 * import { makeKnowledgeRefId } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { Effect } from "effect"
 *
 * const refId = makeKnowledgeRefId("repo-path", "CLAUDE.md", "repo-path:goals/INDEX.md", 0)
 *
 * console.log(Effect.isEffect(refId)) // true
 * ```
 *
 * @param kind - Reference bus the observation came from.
 * @param documentId - NFC-normalized repository-relative path of the containing document.
 * @param subject - Per-bus normalized subject.
 * @param occurrence - Zero-based index among identical kind, document, and subject triples.
 * @category identifiers
 * @since 0.0.0
 */
export const makeKnowledgeRefId = Effect.fn("Knowledge.makeRefId")(function* (
  kind: KnowledgeRefKind,
  documentId: string,
  subject: string,
  occurrence: number
) {
  const preimage = A.join(
    A.map([REF_NORMALIZATION_VERSION, kind, nfc(documentId), nfc(subject), `${occurrence}`], knowledgeLengthPrefix),
    ""
  );
  const digest = yield* knowledgeSha256Hex(
    textEncoder.encode(preimage),
    "Failed to compute a knowledge reference SHA-256 digest."
  );
  return yield* decodeRefId(`${REF_ID_PREFIX}${digest}`).pipe(
    KnowledgeOperationalError.mapError("Computed knowledge reference id failed schema validation.")
  );
});

/**
 * The ten repository roots every knowledge-surface scanner reads.
 *
 * **Details**
 *
 * Two root files and eight directories. Stage-1 enforcement narrows this further by excluding
 * archival directories; the census keeps them and labels them instead.
 *
 * **Example** (Read the scanned roots)
 *
 * ```ts
 * import { KNOWLEDGE_SCANNER_SCOPE } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as A from "effect/Array"
 *
 * console.log(A.length(KNOWLEDGE_SCANNER_SCOPE)) // 10
 * console.log(A.contains(KNOWLEDGE_SCANNER_SCOPE, "standards")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_SCANNER_SCOPE: ReadonlyArray<string> = [
  "AGENTS.md",
  "CLAUDE.md",
  "goals",
  "explorations",
  "docs",
  ".claude",
  ".agents",
  ".codex",
  "standards",
  ".github",
];

const SCANNER_ROOT_FILES = HashSet.make("AGENTS.md", "CLAUDE.md");
const SCANNER_PREFIXES = A.map(A.drop(KNOWLEDGE_SCANNER_SCOPE, 2), (root) => `${root}/`);
const EXCLUDED_PREFIXES: ReadonlyArray<string> = ["docs/generated/", "docs/_internal/"];
const ARCHIVAL_SEGMENTS = HashSet.make(
  "history",
  "research",
  "reviews",
  "synthesis",
  "findings",
  "outputs",
  "reflections",
  "logs",
  ".proofs",
  // Admitted by the Workstream A rewrite pass: `data/` holds machine-captured pipeline
  // artifacts (hash-pinned extraction records quoting verbatim source text), the same
  // captured-proof class as `outputs` — rewriting them would corrupt the capture.
  "data"
);

/**
 * Whether a repository path sits inside the scanned knowledge surface.
 *
 * **Details**
 *
 * True for the two governed root files and for anything under the eight scanned directories, minus
 * the generated and private documentation trees. Archival directories stay in scope: the census
 * labels them rather than dropping them.
 *
 * **Example** (Accept a scoped path and reject a generated one)
 *
 * ```ts
 * import { isKnowledgeScopedPath } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeScopedPath("standards/ARCHITECTURE.md")) // true
 * console.log(isKnowledgeScopedPath("docs/generated/api.md")) // false
 * ```
 *
 * @param repoPath - Repository-relative path of a tracked entry.
 * @returns Whether the path belongs to the scanned knowledge surface.
 * @category predicates
 * @since 0.0.0
 */
export const isKnowledgeScopedPath = (repoPath: string): boolean => {
  if (HashSet.has(SCANNER_ROOT_FILES, repoPath)) {
    return true;
  }
  if (!A.some(SCANNER_PREFIXES, (prefix) => Str.startsWith(prefix)(repoPath))) {
    return false;
  }
  return !A.some(EXCLUDED_PREFIXES, (prefix) => Str.startsWith(prefix)(repoPath));
};

/**
 * Whether a repository path sits below an archival directory segment.
 *
 * **Details**
 *
 * The archival segments are `history`, `research`, `reviews`, `synthesis`, `findings`, `outputs`,
 * `reflections`, `logs`, `.proofs`, and `data`. The test is by exact path segment, so a file merely
 * named `research-notes.md` is live. `data` earned its place in the Workstream A rewrite pass:
 * packet `data/` directories hold machine-captured pipeline artifacts whose recorded text is
 * hash-pinned, so they are captured proof rather than editable guidance.
 *
 * **Example** (Separate archival evidence from live guidance)
 *
 * ```ts
 * import { isKnowledgeArchivalPath } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeArchivalPath("goals/example/research/notes.md")) // true
 * console.log(isKnowledgeArchivalPath("goals/example/PLAN.md")) // false
 * ```
 *
 * @param repoPath - Repository-relative path of a tracked entry.
 * @returns Whether the path is a captured archival artifact.
 * @category predicates
 * @since 0.0.0
 */
export const isKnowledgeArchivalPath = (repoPath: string): boolean =>
  A.some(Str.split("/")(repoPath), (segment) => HashSet.has(ARCHIVAL_SEGMENTS, segment));

const GOVERNED_BARE_ROOTS = HashSet.make(
  ".agents",
  ".claude",
  ".codex",
  ".github",
  "apps",
  "docs",
  "explorations",
  "goals",
  "infra",
  "packages",
  "plugins",
  "scripts",
  "standards",
  "tools"
);
const GOVERNED_ROOT_FILES = HashSet.make(
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "package.json",
  "bun.lock",
  "turbo.json",
  "tsconfig.json"
);

const stripQueryAndFragment = Str.replace(/[?#].*$/u, "");

/**
 * Spellings a governed path may never contain: whitespace, glob and shell syntax, ellipses, absolute
 * roots, URLs.
 *
 * @param value - Query-and-fragment-stripped, NFC-normalized spelling read from a document.
 * @returns True when the spelling carries syntax no tracked repository path can legitimately use.
 */
const hasUngovernedPathSyntax = (value: string): boolean =>
  /[\s\\]/u.test(value) ||
  /[*[\]{}<>|:]/u.test(value) ||
  /(?:^|\/)\.\.\.(?:\/|$)/u.test(value) ||
  Str.includes("…")(value) ||
  Str.startsWith("/")(value) ||
  Str.includes("://")(value);

const isRelativePathSpelling = (value: string): boolean => Str.startsWith("./")(value) || Str.startsWith("../")(value);

const isGovernedPathSpelling = (raw: string): boolean => {
  const value = stripQueryAndFragment(nfc(raw));
  if (Str.isEmpty(value) || hasUngovernedPathSyntax(value)) {
    return false;
  }
  if (isRelativePathSpelling(value)) {
    return true;
  }
  return O.match(A.head(Str.split("/")(value)), {
    onNone: () => false,
    onSome: (segment) => HashSet.has(GOVERNED_BARE_ROOTS, segment) || HashSet.has(GOVERNED_ROOT_FILES, value),
  });
};

/**
 * Applies one path segment to the resolved stack, or `O.none()` when `..` escapes the repository
 * root.
 *
 * @param segments - Segments resolved so far, always rooted at the repository root.
 * @param segment - Next raw segment; empty and `.` segments leave the stack untouched.
 * @returns The extended stack, or `O.none()` when `..` would step above the repository root.
 */
const applyPathSegment = (segments: ReadonlyArray<string>, segment: string): O.Option<ReadonlyArray<string>> => {
  if (segment === "" || segment === ".") {
    return O.some(segments);
  }
  if (segment !== "..") {
    return O.some(A.append(segments, segment));
  }
  return A.isReadonlyArrayEmpty(segments) ? O.none() : O.some(A.dropRight(segments, 1));
};

const resolvePathSegments = (base: ReadonlyArray<string>, value: string): O.Option<ReadonlyArray<string>> => {
  let segments = base;
  for (const segment of Str.split("/")(value)) {
    const next = applyPathSegment(segments, segment);
    if (O.isNone(next)) {
      return O.none();
    }
    segments = next.value;
  }
  return O.some(segments);
};

/**
 * Normalizes one governed path spelling to a safe POSIX repository-relative path.
 *
 * **Details**
 *
 * Only spellings the repo governs survive: a bare governed root, a governed root file, or a `./` and
 * `../` path resolved against the containing document. URLs, globs, whitespace, ellipses, and
 * absolute paths return `O.none()`, and so does any relative path that escapes the repository root.
 *
 * **Example** (Resolve a relative link and reject a URL)
 *
 * ```ts
 * import { normalizeKnowledgeRepoPath } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(normalizeKnowledgeRepoPath("docs/README.md", "./guides/intro.md")))
 * // "docs/guides/intro.md"
 * console.log(O.isNone(normalizeKnowledgeRepoPath("docs/README.md", "https://example.com/a.md")))
 * // true
 * ```
 *
 * @param documentPath - Repository-relative path of the document containing the spelling.
 * @param raw - Path spelling exactly as written inside the document.
 * @returns The normalized path when the spelling is governed and stays inside the repository.
 * @category normalization
 * @since 0.0.0
 */
export const normalizeKnowledgeRepoPath: {
  (raw: string): (documentPath: string) => O.Option<string>;
  (documentPath: string, raw: string): O.Option<string>;
} = dual(2, (documentPath: string, raw: string): O.Option<string> => {
  if (!isGovernedPathSpelling(raw)) {
    return O.none();
  }
  const value = stripQueryAndFragment(nfc(raw));
  const base = isRelativePathSpelling(value) ? A.dropRight(Str.split("/")(nfc(documentPath)), 1) : A.empty<string>();

  return pipe(
    resolvePathSegments(base, value),
    O.filter(A.isReadonlyArrayNonEmpty),
    O.map((segments) => nfc(A.join(segments, "/")))
  );
});

/**
 * Drains a global pattern over one line, preserving `exec` order.
 *
 * **Details**
 *
 * Source order is what keeps duplicate occurrence indices stable, so every extractor in the family
 * reads its matches through this drain rather than through a one-shot match.
 *
 * **Example** (Read every match on one line)
 *
 * ```ts
 * import { knowledgeLineMatches } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as A from "effect/Array"
 *
 * console.log(A.length(knowledgeLineMatches(/a/gu, "banana"))) // 3
 * ```
 *
 * @param pattern - Global pattern whose `lastIndex` advances across the whole drain.
 * @param text - One document line.
 * @returns Every match in source order.
 * @category parsing
 * @since 0.0.0
 */
export const knowledgeLineMatches: {
  (text: string): (pattern: RegExp) => ReadonlyArray<RegExpExecArray>;
  (pattern: RegExp, text: string): ReadonlyArray<RegExpExecArray>;
} = dual(2, (pattern: RegExp, text: string): ReadonlyArray<RegExpExecArray> => {
  let matches = A.empty<RegExpExecArray>();
  let match = pattern.exec(text);
  while (match !== null) {
    matches = A.append(matches, match);
    match = pattern.exec(text);
  }
  return matches;
});

/**
 * An inline code span and the 1-based column its opening backtick run starts at.
 *
 * @see {@link knowledgeInlineSpans} for the reader that produces them.
 * @category models
 * @since 0.0.0
 */
export type KnowledgeInlineSpan = {
  readonly span: string;
  readonly column: number;
};

/**
 * Removes CommonMark inline-code padding: one leading and one trailing space, stripped only when both
 * are present and the content is not entirely spaces.
 *
 * @param content - Raw text between the opening and closing backtick runs.
 * @returns The span content a path or command reader sees.
 */
const stripInlineCodePadding = (content: string): string =>
  Str.startsWith(" ")(content) && Str.endsWith(" ")(content) && !/^ +$/u.test(content)
    ? Str.slice(1, -1)(content)
    : content;

const inlineSpanOf = (match: RegExpExecArray): O.Option<KnowledgeInlineSpan> => {
  const prefix = match[1];
  const content = match[3];
  return P.isString(prefix) && P.isString(content)
    ? O.some({ span: stripInlineCodePadding(content), column: match.index + Str.length(prefix) + 1 })
    : O.none();
};

/**
 * Reads every inline code span on one line, in source order.
 *
 * **Details**
 *
 * Backtick runs must match in length: an opening run of N backticks closes on the next run of
 * exactly N, so a single-backtick span and a triple-backtick span are read the same way.
 * CommonMark padding is stripped, and the reported column points at the opening run.
 *
 * **Example** (Read one span from a line)
 *
 * ```ts
 * import { knowledgeInlineSpans } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as A from "effect/Array"
 *
 * console.log(A.map(knowledgeInlineSpans("see `docs/README.md` first"), (span) => span.span))
 * // [ "docs/README.md" ]
 * ```
 *
 * @param lineText - One document line, already known to sit outside every fence.
 * @returns Every inline code span on the line, with 1-based columns.
 * @category parsing
 * @since 0.0.0
 */
export const knowledgeInlineSpans = (lineText: string): ReadonlyArray<KnowledgeInlineSpan> =>
  A.getSomes(A.map(knowledgeLineMatches(/(^|[^`\\])(`+)([^\r\n]*?)\2(?!`)/gu, lineText), inlineSpanOf));

/**
 * Whether an inline span documents a `bun run beep` invocation rather than a path.
 *
 * **Details**
 *
 * A span qualifies only when it starts with the exact command prefix and carries no shell
 * composition — pipes, sequencing, redirection, substitution, or a comment. Everything else is read
 * by the path bus instead, which is why the two readers share this one predicate.
 *
 * **Example** (Separate a documented command from a path)
 *
 * ```ts
 * import { isKnowledgeCommandSpan } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(isKnowledgeCommandSpan("bun run beep goals doctor")) // true
 * console.log(isKnowledgeCommandSpan("goals/INDEX.md")) // false
 * ```
 *
 * @param span - Inline code span content, with CommonMark padding already stripped.
 * @returns Whether the span should be read as a documented command.
 * @category predicates
 * @since 0.0.0
 */
export const isKnowledgeCommandSpan = (span: string): boolean =>
  /^bun run beep(?:$|[ \t])/u.test(span) && !/[|;&<>]|\$\(|(?:^|[ \t])#/u.test(span);

const FENCE_PATTERN = /^(`{3,}|~{3,})(.*)$/u;
const QUOTE_PREFIX_PATTERN = /^(?:[ \t]*>[ \t]?)+/u;
const LIST_PREFIX_PATTERN = /^[ \t]*(?:(?:[-+*]|[0-9]{1,9}[.)])[ \t]+)?/u;
const stripListPrefix = Str.replace(LIST_PREFIX_PATTERN, "");

/** One line split into the Markdown container it sits in and the body a fence delimiter is read from. */
type ContainerLine = {
  readonly depth: number;
  readonly body: string;
};

/**
 * Strips the Markdown container prefix so a fence nested in a blockquote or a list item is still
 * recognized as a fence.
 *
 * Blockquote markers are removed first and counted, then list-item indentation and an optional
 * bullet or ordered marker. Indentation is stripped without a depth limit, which is what makes a
 * fence inside a deeply nested list item visible; the trade is that a four-space indented code block
 * showing a literal fence now opens one, suppressing scanning rather than inventing findings.
 *
 * @param line - Raw document line.
 * @returns The blockquote depth the prefix carried and the body the fence matcher reads.
 */
const containerLine = (line: string): ContainerLine => {
  const quote = QUOTE_PREFIX_PATTERN.exec(line);
  const quoted = quote === null ? "" : quote[0];
  return {
    depth: A.length(Str.split(">")(quoted)) - 1,
    body: stripListPrefix(Str.slice(Str.length(quoted))(line)),
  };
};

/** The open fence a line is inside: its container depth, marker character, and closing run length. */
type OpenFence = {
  readonly marker: string;
  readonly length: number;
  readonly depth: number;
};

const openedFence = (line: ContainerLine): O.Option<OpenFence> => {
  const fence = FENCE_PATTERN.exec(line.body);
  if (fence === null || !P.isString(fence[1]) || !P.isString(fence[1][0])) {
    return O.none();
  }
  return O.some({ marker: fence[1][0], length: Str.length(fence[1]), depth: line.depth });
};

const closesFence = (line: ContainerLine, open: OpenFence): boolean => {
  const fence = FENCE_PATTERN.exec(line.body);
  return (
    fence !== null &&
    P.isString(fence[1]) &&
    P.isString(fence[2]) &&
    line.depth === open.depth &&
    fence[1][0] === open.marker &&
    Str.length(fence[1]) >= open.length &&
    /^\s*$/u.test(fence[2])
  );
};

/**
 * Fence state after one line: `O.none()` outside a fence, `O.some` while inside one.
 *
 * @param fence - Fence state carried in from the preceding line.
 * @param line - Container-stripped line whose delimiter may open or close the surrounding block.
 * @returns The fence state the next line starts from.
 */
const advanceFence = (fence: O.Option<OpenFence>, line: ContainerLine): O.Option<OpenFence> =>
  O.match(fence, {
    onNone: () => openedFence(line),
    onSome: (open) => (closesFence(line, open) ? O.none() : O.some(open)),
  });

/**
 * One document line, numbered, with the fence verdict every Markdown reader keys on.
 *
 * @see {@link knowledgeDocumentLines} for the reader that produces them.
 * @category models
 * @since 0.0.0
 */
export type KnowledgeDocumentLine = {
  readonly text: string;
  readonly number: number;
  readonly prose: boolean;
};

/**
 * Splits a decoded document into numbered lines carrying the ratified fence verdict.
 *
 * **Details**
 *
 * `prose` is true only for a line that sits outside every fence and is not itself a fence delimiter,
 * which is the exact "prose only" rule Stage-1 enforcement scans under. Both readers take their
 * verdict from here, so a fenced speculative tree can never mean one thing to the gate and another
 * to the census.
 *
 * **Gotchas**
 *
 * Host anchors deliberately ignore this verdict. A fenced `cd <HOME>/...` is precisely the guidance
 * that breaks a fresh clone, and the clone-agnosticism baseline counted anchors line-wise, so
 * exempting fences would make the census incomparable with the baseline it must reconcile against.
 *
 * **Example** (Read the fence verdict of a fenced line)
 *
 * The delimiter is assembled rather than written literally, because a fence cannot appear inside
 * this documentation block.
 *
 * ```ts
 * import { knowledgeDocumentLines } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as A from "effect/Array"
 *
 * const fence = A.join(A.replicate("~", 3), "")
 * const lines = knowledgeDocumentLines(A.join(["intro", fence, "fenced", fence, "outro"], "\n"))
 *
 * console.log(A.map(lines, (line) => line.prose)) // [ true, false, false, false, true ]
 * ```
 *
 * @param text - Whole decoded document text.
 * @returns Every line, 1-based numbered, with its fence verdict.
 * @category parsing
 * @since 0.0.0
 */
export const knowledgeDocumentLines = (text: string): ReadonlyArray<KnowledgeDocumentLine> => {
  // Single-allocation map with fence state threaded through the closure: per-line `A.append`
  // re-copies the whole accumulator and turns a large document quadratic.
  let fence = O.none<OpenFence>();
  return A.map(Str.split(/\r?\n/u)(text), (lineText, index) => {
    const nextFence = advanceFence(fence, containerLine(lineText));
    // Prose only: fence delimiters and fenced content alike are excluded.
    const prose = O.isNone(fence) && O.isNone(nextFence);
    fence = nextFence;
    return { text: lineText, number: index + 1, prose };
  });
};

const MACHINE_TREE_NAME = "YeeBois";
const ENCODED_HOME_MARKER = "-home-";
const BEEP_CHECKOUT_MARKER = "beep-effect";
const HOME_ABSOLUTE_PATTERN = /\/home\//gu;
const HOME_RELATIVE_PATTERN = /~\//gu;
const TEMP_PATTERN = /\/tmp\//gu;
const NON_WHITESPACE_RUN_PATTERN = /\S+/gu;
const HOST_TOKEN_LEADING_PATTERN = /^[`'"([{<]+/u;
const HOST_TOKEN_TRAILING_PATTERN = /[`'")\]}>.,;:]+$/u;

const trimHostToken: (token: string) => string = flow(
  Str.replace(HOST_TOKEN_LEADING_PATTERN, ""),
  Str.replace(HOST_TOKEN_TRAILING_PATTERN, "")
);

/**
 * One machine-local anchor occurrence and the token that carried it.
 *
 * @see {@link extractKnowledgeHostAnchors} for the reader that produces them.
 * @category models
 * @since 0.0.0
 */
export type KnowledgeHostAnchorMatch = {
  readonly anchor: KnowledgeHostAnchor;
  readonly token: string;
  readonly column: number;
};

/**
 * Reads every machine-local anchor on one line.
 *
 * **Details**
 *
 * The four lexical rules reproduce the clone-agnosticism baseline exactly: `/home/`, `~/`, `/tmp/`,
 * and a bare machine tree name not immediately preceded by a slash. The lookbehind on the last rule
 * is what makes the rules textually disjoint, so `/home/<user>/<tree>` counts once under `/home/`
 * and never again under the tree name. A token that carries the encoded session-directory marker is
 * reported as `encoded-home` rather than as a bare tree name.
 *
 * **Gotchas**
 *
 * One token can legitimately carry two anchors — an encoded scratchpad literal holds both a `/tmp/`
 * prefix and a bare tree name — and the baseline counted both. This reader reproduces that, so a
 * single token can yield two observations.
 *
 * **Example** (Read the anchors on one line)
 *
 * ```ts
 * import { extractKnowledgeHostAnchors } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as A from "effect/Array"
 *
 * const anchors = extractKnowledgeHostAnchors("run `~/.claude/hooks/pulse.ts` now")
 *
 * console.log(A.map(anchors, (match) => match.anchor)) // [ "home-relative" ]
 * console.log(A.map(anchors, (match) => match.token)) // [ "~/.claude/hooks/pulse.ts" ]
 * ```
 *
 * @param lineText - One document line, fenced or not.
 * @returns Every anchor occurrence with its trimmed containing token and 1-based column.
 * @category parsing
 * @since 0.0.0
 */
export const extractKnowledgeHostAnchors = (lineText: string): ReadonlyArray<KnowledgeHostAnchorMatch> => {
  const runs = knowledgeLineMatches(NON_WHITESPACE_RUN_PATTERN, lineText);
  const tokenAt = (index: number): string =>
    pipe(
      A.findFirst(runs, (run) => run.index <= index && index < run.index + Str.length(run[0])),
      O.match({ onNone: () => Str.empty, onSome: (run) => trimHostToken(run[0]) })
    );
  const anchored = (pattern: RegExp, anchor: KnowledgeHostAnchor): ReadonlyArray<KnowledgeHostAnchorMatch> =>
    A.map(knowledgeLineMatches(pattern, lineText), (match) => ({
      anchor,
      token: tokenAt(match.index),
      column: match.index + 1,
    }));
  const bare = A.map(
    knowledgeLineMatches(new RegExp(`(?<!/)${MACHINE_TREE_NAME}`, "gu"), lineText),
    (match): KnowledgeHostAnchorMatch => {
      const token = tokenAt(match.index);
      return {
        anchor: Str.includes(ENCODED_HOME_MARKER)(token)
          ? KnowledgeHostAnchor.Enum["encoded-home"]
          : KnowledgeHostAnchor.Enum["bare-tree-name"],
        token,
        column: match.index + 1,
      };
    }
  );
  return A.flatten([
    anchored(HOME_ABSOLUTE_PATTERN, KnowledgeHostAnchor.Enum["home-absolute"]),
    anchored(HOME_RELATIVE_PATTERN, KnowledgeHostAnchor.Enum["home-relative"]),
    anchored(TEMP_PATTERN, KnowledgeHostAnchor.Enum.temp),
    bare,
  ]);
};

// Every member is a config/state/toolchain directory convention of a named product or of the XDG
// basedir spec — portable across machines by definition, which is the class semantic. Widening
// this set is a deliberate CLI PR per ratified decision A3; the batch after `~/.openclaw` was
// admitted by the Workstream A rewrite pass with per-prefix rationale in
// goals/knowledge-surface-automation/research/p3-report-refs-rewrite.md.
const PORTABLE_HOME_CONVENTIONS = HashSet.make(
  "~/.claude",
  "~/.codex",
  "~/.config",
  "~/.bun",
  "~/.openclaw",
  "~/.cache",
  "~/.cargo",
  "~/.cursor",
  "~/.local/state/beep",
  "~/.mem0",
  "~/.oracle",
  "~/.portless",
  "~/.portless-lan",
  "~/.supermemory-claude"
);

// Exact-mention conventions: naming the XDG user directory itself is portable, but any concrete
// descendant (`~/Downloads/report.csv`) is machine session residue and stays gated — a prefix
// admission here would let live guidance park arbitrary machine-local files behind the folder name.
const PORTABLE_HOME_EXACT_CONVENTIONS = HashSet.make("~/Downloads");
const TEMP_CONVENTIONS = HashSet.make("/tmp/portless");
const stripTrailingSlashes = Str.replace(/\/+$/u, "");

const hasConventionPrefix = (conventions: HashSet.HashSet<string>, token: string): boolean =>
  HashSet.some(conventions, (prefix) => token === prefix || Str.startsWith(`${prefix}/`)(token));

const isExactHomeConvention = (token: string): boolean =>
  HashSet.has(PORTABLE_HOME_EXACT_CONVENTIONS, stripTrailingSlashes(token));

/**
 * Whether a line reads as rule, pattern, or inventory text rather than as guidance.
 *
 * **Details**
 *
 * This is the v1 lexical rule, and it is deliberately falsifiable rather than a judgement call: a
 * table delimiter, a regex group or class, a `--glob` argument, or a word-bounded `rg`/`grep`
 * invocation all mark the line as pattern text. The audit corpus is its own top offender — the
 * worktree standard, the surface inventory, and this packet's own verification command all contain
 * anchors as data — so without this rule the census reports its own instrumentation as debt.
 *
 * **Gotchas**
 *
 * The false-positive rate of this exact rule is what the phase-0 eyeball is for. Widening it is a
 * deliberate change, not a maintenance detail.
 *
 * **Example** (Separate a table row from guidance)
 *
 * ```ts
 * import { knowledgeRefPatternContext } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(knowledgeRefPatternContext("| `/home/` | 1,060 | Absolute home paths |")) // true
 * console.log(knowledgeRefPatternContext("Keep the checkout at ~/src/beep-effect.")) // false
 * ```
 *
 * @param lineText - One document line.
 * @returns Whether the anchor on that line is the subject of a rule rather than a reference.
 * @category predicates
 * @since 0.0.0
 */
export const knowledgeRefPatternContext = (lineText: string): boolean =>
  Str.includes("|")(lineText) ||
  Str.includes("(?")(lineText) ||
  Str.includes("[^")(lineText) ||
  Str.includes("--glob")(lineText) ||
  /\b(?:rg|grep)\s/u.test(lineText);

/**
 * Everything the pure classifier reads about one reference occurrence.
 *
 * **Details**
 *
 * `anchor` and `token` are populated for host paths only; `pairingAmbiguous` for goal URIs only; and
 * `ungoverned` for repository paths only. Keeping every field total — an `O.Option` rather than an
 * absent key — is what lets the rule table stay one ordered cascade instead of three per-bus tables.
 *
 * @see {@link classifyKnowledgeRef} for the cascade that consumes it.
 * @category models
 * @since 0.0.0
 */
export type KnowledgeRefClassificationInput = {
  readonly kind: KnowledgeRefKind;
  readonly surface: KnowledgeRefSurface;
  readonly resolutionStatus: KnowledgeRefResolutionStatus;
  readonly anchor: O.Option<KnowledgeHostAnchor>;
  readonly token: O.Option<string>;
  readonly patternContext: boolean;
  readonly pairingAmbiguous: boolean;
  readonly ungoverned: boolean;
};

/**
 * Rules 3c–3f of the cascade: a live, non-pattern host anchor judged by its convention and locus.
 *
 * @param anchor - Lexical anchor that made the span machine-local.
 * @param token - Trimmed containing token the convention sets and checkout marker are tested on.
 * @returns The convention, mirror, or actionable class for a live host anchor.
 */
const classifyLiveHostAnchor = (anchor: KnowledgeHostAnchor, token: string): KnowledgeRefClassification => {
  if (
    KnowledgeHostAnchor.is["home-relative"](anchor) &&
    (hasConventionPrefix(PORTABLE_HOME_CONVENTIONS, token) || isExactHomeConvention(token))
  ) {
    return KnowledgeRefClassification.Enum["portable-home-convention"];
  }
  if (KnowledgeHostAnchor.is.temp(anchor) && hasConventionPrefix(TEMP_CONVENTIONS, token)) {
    return KnowledgeRefClassification.Enum["documented-temp-convention"];
  }
  const homeAnchored =
    KnowledgeHostAnchor.is["home-absolute"](anchor) || KnowledgeHostAnchor.is["home-relative"](anchor);
  return homeAnchored && !Str.includes(BEEP_CHECKOUT_MARKER)(token)
    ? KnowledgeRefClassification.Enum["external-mirror-reference"]
    : KnowledgeRefClassification.Enum["actionable-host-path"];
};

const classifyHostAnchor = (
  anchor: KnowledgeHostAnchor,
  token: string,
  surface: KnowledgeRefSurface,
  patternContext: boolean
): KnowledgeRefClassification => {
  if (patternContext) {
    return KnowledgeRefClassification.Enum["audit-pattern-literal"];
  }
  return KnowledgeRefSurface.is.archival(surface)
    ? KnowledgeRefClassification.Enum["archival-provenance"]
    : classifyLiveHostAnchor(anchor, token);
};

/**
 * Assigns the deterministic triage class of one reference observation.
 *
 * **Details**
 *
 * The cascade is ordered and total. Pairing ambiguity and ungoverned syntax are decided first, since
 * neither leaves a target to resolve. Host paths are then decided lexically, and everything else
 * falls through to the resolution outcome. Inside the host branch the pattern-literal rule is
 * checked before the archival rule on purpose: an archival document that quotes an anchor as rule
 * data must classify as `audit-pattern-literal`, which is only reachable if pattern text outranks
 * archival provenance.
 *
 * **Gotchas**
 *
 * A `not-applicable` resolution outside the host bus can only come from a goal URI whose pairing was
 * rejected, because the ungoverned repository case is caught two rules earlier. That is why the
 * final arm maps it back to `ambiguous-ref-pairing` rather than inventing a thirteenth class.
 *
 * **Example** (Classify an archival host anchor and a broken repository path)
 *
 * ```ts
 * import { classifyKnowledgeRef } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as O from "effect/Option"
 *
 * console.log(
 *   classifyKnowledgeRef({
 *     kind: "host-path",
 *     surface: "archival",
 *     resolutionStatus: "not-applicable",
 *     anchor: O.some("home-absolute"),
 *     token: O.some("/home/example/checkouts/beep-effect"),
 *     patternContext: false,
 *     pairingAmbiguous: false,
 *     ungoverned: false,
 *   })
 * ) // "archival-provenance"
 *
 * console.log(
 *   classifyKnowledgeRef({
 *     kind: "repo-path",
 *     surface: "live",
 *     resolutionStatus: "missing",
 *     anchor: O.none(),
 *     token: O.none(),
 *     patternContext: false,
 *     pairingAmbiguous: false,
 *     ungoverned: false,
 *   })
 * ) // "broken-target"
 * ```
 *
 * @param input - Everything known about the occurrence before it is labelled.
 * @returns The single class the rule table assigns.
 * @category policies
 * @since 0.0.0
 */
export const classifyKnowledgeRef = (input: KnowledgeRefClassificationInput): KnowledgeRefClassification => {
  if (input.pairingAmbiguous) {
    return KnowledgeRefClassification.Enum["ambiguous-ref-pairing"];
  }
  if (input.ungoverned) {
    return KnowledgeRefClassification.Enum["ungoverned-syntax"];
  }
  if (KnowledgeRefKind.is["host-path"](input.kind)) {
    return O.match(input.anchor, {
      onNone: () => KnowledgeRefClassification.Enum["actionable-host-path"],
      onSome: (anchor) =>
        classifyHostAnchor(
          anchor,
          O.getOrElse(input.token, () => Str.empty),
          input.surface,
          input.patternContext
        ),
    });
  }
  return Match.value(input.resolutionStatus).pipe(
    Match.when("resolved", () => KnowledgeRefClassification.Enum.verified),
    Match.when("missing", () => KnowledgeRefClassification.Enum["broken-target"]),
    Match.when("identity-mismatch", () => KnowledgeRefClassification.Enum["identity-mismatch"]),
    Match.when("producer-owned", () => KnowledgeRefClassification.Enum["producer-owned-target"]),
    Match.when("not-applicable", () => KnowledgeRefClassification.Enum["ambiguous-ref-pairing"]),
    Match.exhaustive
  );
};

/**
 * The observation classes `beep knowledge refs --check` gates on.
 *
 * **Details**
 *
 * Both members are live-surface host-anchor classes with no convention or pattern excuse — exactly
 * the observation space that maps to the reserved `host-path-in-live-guidance` finding kind. The
 * archival counterpart (`archival-provenance`) never gates: rewriting captured proof rewrites
 * history. Widening this set is a deliberate policy change, not a maintenance detail.
 *
 * **Example** (Read the gated classes)
 *
 * ```ts
 * import { KNOWLEDGE_REFS_GATED_CLASSIFICATIONS } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(HashSet.has(KNOWLEDGE_REFS_GATED_CLASSIFICATIONS, "actionable-host-path")) // true
 * console.log(HashSet.has(KNOWLEDGE_REFS_GATED_CLASSIFICATIONS, "archival-provenance")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_REFS_GATED_CLASSIFICATIONS: HashSet.HashSet<KnowledgeRefClassification> = HashSet.make(
  KnowledgeRefClassification.Enum["actionable-host-path"],
  KnowledgeRefClassification.Enum["external-mirror-reference"]
);

/**
 * The observations a checked census gates on: live-surface members of the gated classes.
 *
 * **Details**
 *
 * This is the whole `--check` rule. Archival observations never gate regardless of class, and live
 * observations gate only when their classification sits in
 * {@link KNOWLEDGE_REFS_GATED_CLASSIFICATIONS}. The census itself stays a measurement; this selector
 * is the evaluator that turns it into a standing zero-tolerance gate now that the rewrite pass has
 * burned the live debt to zero.
 *
 * **Example** (An empty census carries no debt)
 *
 * ```ts
 * import { knowledgeRefsLiveDebt, KnowledgeRefsReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as A from "effect/Array"
 *
 * const report = KnowledgeRefsReport.make({
 *   treeish: "HEAD",
 *   commit: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   observations: [],
 *   skipped: [],
 * })
 *
 * console.log(A.length(knowledgeRefsLiveDebt(report))) // 0
 * ```
 *
 * @param report - Census to evaluate.
 * @returns Every live observation in a gated classification, in report order.
 * @category policies
 * @since 0.0.0
 */
export const knowledgeRefsLiveDebt = (report: KnowledgeRefsReport): ReadonlyArray<KnowledgeRefObservation> =>
  A.filter(
    report.observations,
    (observation) =>
      KnowledgeRefSurface.is.live(observation.surface) &&
      HashSet.has(KNOWLEDGE_REFS_GATED_CLASSIFICATIONS, observation.classification)
  );

/**
 * The one-sentence remediation the report prints for a classified observation.
 *
 * **Details**
 *
 * Every class has a fixed sentence except `producer-owned-target`, which quotes the registered
 * regeneration command so the report says "run this" rather than "broken". Classes that are not
 * defects say so explicitly instead of leaving the column blank.
 *
 * **Example** (Read the remediation of a broken target)
 *
 * ```ts
 * import {
 *   KnowledgeRefMissing,
 *   knowledgeRefRemediation,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * console.log(knowledgeRefRemediation("broken-target", KnowledgeRefMissing.make({})))
 * // "Update the reference or add the tracked target."
 * ```
 *
 * @param classification - Class assigned by {@link classifyKnowledgeRef}.
 * @param resolution - Resolution the observation carries, read for the producer command.
 * @returns One sentence of remediation guidance.
 * @category policies
 * @since 0.0.0
 */
export const knowledgeRefRemediation: {
  (resolution: KnowledgeRefResolution): (classification: KnowledgeRefClassification) => string;
  (classification: KnowledgeRefClassification, resolution: KnowledgeRefResolution): string;
} = dual(2, (classification: KnowledgeRefClassification, resolution: KnowledgeRefResolution): string =>
  Match.value(classification).pipe(
    Match.when("verified", () => "None; the reference resolves in the tree."),
    Match.when("broken-target", () => "Update the reference or add the tracked target."),
    Match.when("identity-mismatch", () => "Reconcile the manifest initiative id with the referenced goal slug."),
    Match.when("producer-owned-target", () => {
      const command = resolution.status === "producer-owned" ? resolution.command : "the owning producer";
      return `Run \`${command}\` and commit the regenerated output.`;
    }),
    Match.when("actionable-host-path", () => "Rewrite the machine-local path as a repo-relative reference."),
    Match.when("portable-home-convention", () => "None; the prefix is a documented portable home convention."),
    Match.when("documented-temp-convention", () => "None; the prefix is a documented temporary-path convention."),
    Match.when("external-mirror-reference", () => "Replace the machine-local mirror with a canonical upstream URL."),
    Match.when("archival-provenance", () => "None; rewriting captured provenance would rewrite history."),
    Match.when("audit-pattern-literal", () => "None; the anchor is rule or inventory data rather than guidance."),
    Match.when("ambiguous-ref-pairing", () => "Keep one `beep:ref` per line beside exactly one display path."),
    Match.when("ungoverned-syntax", () => "Rewrite the spelling as a governed repository-relative path."),
    Match.exhaustive
  )
);

/**
 * Everything the census may read from one Git tree.
 *
 * **Details**
 *
 * The evaluator never touches the filesystem: both the live archive-backed implementation and the
 * golden fixtures satisfy this shape, which is what keeps a fixture tree and a real tree
 * indistinguishable to the scanning logic. `trackedEntries` is the only existence oracle, so an
 * untracked working-copy file can never make a reference look valid.
 *
 * @see {@link scanKnowledgeRefsTree} for the evaluator that consumes it.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeTreeOracle {
  readonly commit: string;
  readonly readBytes: (repoPath: string) => Effect.Effect<Uint8Array, KnowledgeOperationalError>;
  readonly trackedEntries: ReadonlyArray<KnowledgeTrackedEntry>;
  readonly treeish: string;
}

const ELECTED_EXTENSIONS = HashSet.make(".md", ".json", ".jsonc", ".jsonl", ".toml", ".yml", ".yaml");
const SYMLINK_MODE = "120000";
const GITLINK_MODE = "160000";
const MARKDOWN_EXTENSION = ".md";
const HEADING_PATTERN = /^#{1,6}\s/u;
const GOAL_URI_PATTERN = /repo:\/\/goal\/([a-z0-9][a-z0-9-]*)(\/[^\s`")\]]*)?/gu;
const BEEP_REF_PATTERN = /<!-- beep:ref goal\/([a-z0-9][a-z0-9-]*) -->/gu;
const LINK_DESTINATION_PATTERN = /(\[[^\]]*\]\()([^)\s]+)(?:\s+"[^"]*")?\)/gu;

type ProducerRegistration = {
  readonly producerId: string;
  readonly targetPath: string;
  readonly command: string;
};

const PRODUCER_REGISTRY: ReadonlyArray<ProducerRegistration> = [
  {
    producerId: "producer://goals/index",
    targetPath: "goals/INDEX.md",
    command: "bun run beep goals index --write",
  },
];

const isRegularBlob = (entry: KnowledgeTrackedEntry): boolean => entry.mode === "100644" || entry.mode === "100755";

const isElectedExtension = (repoPath: string): boolean =>
  HashSet.some(ELECTED_EXTENSIONS, (extension) => Str.endsWith(extension)(repoPath));

const ancestorPrefixes = (repoPath: string): ReadonlyArray<string> => {
  const segments = A.dropRight(Str.split("/")(repoPath), 1);
  return A.map(segments, (_, index) => A.join(A.take(segments, index + 1), "/"));
};

const skippedEntry = (entry: KnowledgeTrackedEntry): O.Option<KnowledgeSkippedBlob> => {
  if (entry.mode === SYMLINK_MODE) {
    return O.some(KnowledgeSkippedBlob.make({ path: entry.path, mode: entry.mode, reason: "symlink" }));
  }
  return entry.mode === GITLINK_MODE
    ? O.some(KnowledgeSkippedBlob.make({ path: entry.path, mode: entry.mode, reason: "gitlink" }))
    : O.none();
};

/**
 * Decodes tracked bytes as strict UTF-8, failing closed with the caller's own message.
 *
 * **Details**
 *
 * The decoder is fatal: a blob that is not valid UTF-8 raises rather than silently substituting
 * replacement characters, because a lossy decode would let a mangled document scan as a clean one.
 * The message is a parameter for the same reason {@link knowledgeSha256Hex} takes one — Stage-1
 * enforcement and the census name their corpora differently in the error they surface.
 *
 * **Example** (Decode fixture bytes)
 *
 * ```ts
 * import { decodeKnowledgeUtf8 } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { Effect } from "effect"
 *
 * const text = decodeKnowledgeUtf8(new TextEncoder().encode("ok"), "Malformed UTF-8 in a fixture.")
 *
 * console.log(Effect.runSync(text)) // "ok"
 * ```
 *
 * @param bytes - Exact tracked blob bytes.
 * @param message - Operational-error message used when the bytes are not valid UTF-8.
 * @returns The decoded text.
 * @category decoding
 * @since 0.0.0
 */
export const decodeKnowledgeUtf8: {
  (message: string): (bytes: Uint8Array) => Effect.Effect<string, KnowledgeOperationalError>;
  (bytes: Uint8Array, message: string): Effect.Effect<string, KnowledgeOperationalError>;
} = dual(
  2,
  (bytes: Uint8Array, message: string): Effect.Effect<string, KnowledgeOperationalError> =>
    Effect.try({
      try: () => strictUtf8Decoder.decode(bytes),
      catch: KnowledgeOperationalError.new(message),
    })
);

const decodeUtf8 = (bytes: Uint8Array, repoPath: string): Effect.Effect<string, KnowledgeOperationalError> =>
  decodeKnowledgeUtf8(bytes, `Malformed UTF-8 in tracked file "${repoPath}".`);

/** A repository-path spelling after the ratified tri-state read: governed, ungoverned, or ignored. */
type RepoPathOutcome =
  | { readonly _tag: "governed"; readonly normalized: string }
  | { readonly _tag: "ungoverned"; readonly normalized: string }
  | { readonly _tag: "ignored" };

const IGNORED_OUTCOME: RepoPathOutcome = { _tag: "ignored" };

const isAbsoluteGovernedSpelling = (value: string): boolean =>
  Str.startsWith("/")(value) &&
  O.exists(A.head(Str.split("/")(Str.slice(1)(value))), (segment) => HashSet.has(GOVERNED_BARE_ROOTS, segment));

const isBackslashGovernedSpelling = (value: string): boolean =>
  Str.includes("\\")(value) && isGovernedPathSpelling(Str.replaceAll("\\", "/")(value));

/**
 * The tri-state read of one path spelling: a governed target, an ungoverned spelling worth
 * reporting, or nothing at all.
 *
 * `documentRelative` applies Markdown link semantics, where a bare `PLAN.md` destination means
 * `./PLAN.md`. Inline spans never get that extension: they are read under the Stage-1 grammar alone.
 *
 * @param documentPath - Repository-relative path of the containing document.
 * @param raw - Path spelling exactly as written inside the document.
 * @param documentRelative - Whether a bare relative spelling resolves from the document's directory.
 * @returns The governed, ungoverned, or ignored outcome for the spelling.
 */
const repoPathOutcome = (documentPath: string, raw: string, documentRelative: boolean): RepoPathOutcome => {
  const cleaned = stripQueryAndFragment(nfc(raw));
  if (Str.isEmpty(cleaned)) {
    return IGNORED_OUTCOME;
  }
  if (isAbsoluteGovernedSpelling(cleaned) || isBackslashGovernedSpelling(cleaned)) {
    return { _tag: "ungoverned", normalized: cleaned };
  }
  const spelling =
    documentRelative && !isRelativePathSpelling(cleaned) && !isGovernedPathSpelling(cleaned) ? `./${cleaned}` : cleaned;
  if (!isGovernedPathSpelling(spelling)) {
    return IGNORED_OUTCOME;
  }
  return O.match(normalizeKnowledgeRepoPath(documentPath, spelling), {
    // The spelling is governed, so the only remaining failure is a `..` escape above the root.
    onNone: (): RepoPathOutcome => ({ _tag: "ungoverned", normalized: cleaned }),
    onSome: (normalized): RepoPathOutcome => ({ _tag: "governed", normalized }),
  });
};

/** One extracted reference occurrence, before resolution, classification, and identity assignment. */
type RefCandidate = {
  readonly kind: KnowledgeRefKind;
  readonly subject: string;
  readonly ref: KnowledgeRef;
  readonly documentPath: string;
  readonly line: number;
  readonly column: number;
  readonly surface: KnowledgeRefSurface;
  readonly patternContext: boolean;
  readonly pairingAmbiguous: boolean;
  readonly ungoverned: boolean;
  readonly anchor: O.Option<KnowledgeHostAnchor>;
  readonly token: O.Option<string>;
  readonly slug: O.Option<string>;
  readonly normalized: O.Option<string>;
};

type RepoPathCandidate = {
  readonly raw: string;
  readonly column: number;
  readonly outcome: RepoPathOutcome;
};

const goalUriRef = (raw: string, slug: string, displayPath: O.Option<string>): KnowledgeGoalUriRef =>
  O.match(displayPath, {
    onNone: () => KnowledgeGoalUriRef.make({ raw, slug }),
    onSome: (value) => KnowledgeGoalUriRef.make({ raw, slug, displayPath: value }),
  });

const hostCandidates = (
  documentPath: string,
  line: KnowledgeDocumentLine,
  surface: KnowledgeRefSurface
): ReadonlyArray<RefCandidate> =>
  A.map(extractKnowledgeHostAnchors(line.text), (match) => ({
    kind: KnowledgeRefKind.Enum["host-path"],
    subject: nfc(`host-path:${match.anchor}:${match.token}`),
    ref: KnowledgeHostPathRef.make({ raw: match.token, anchor: match.anchor }),
    documentPath,
    line: line.number,
    column: match.column,
    surface,
    patternContext: knowledgeRefPatternContext(line.text),
    pairingAmbiguous: false,
    ungoverned: false,
    anchor: O.some(match.anchor),
    token: O.some(match.token),
    slug: O.none<string>(),
    normalized: O.none<string>(),
  }));

const stripAngleWrapping = (destination: string): string =>
  Str.startsWith("<")(destination) && Str.endsWith(">")(destination) ? Str.slice(1, -1)(destination) : destination;

const isExternalDestination = (destination: string): boolean =>
  Str.includes("://")(destination) || Str.startsWith("mailto:")(destination) || Str.startsWith("#")(destination);

/**
 * One Markdown inline-link destination, angle-wrapping stripped, with where it sits on the line.
 *
 * @see {@link knowledgeLinkDestinations} for the reader that produces them.
 * @category models
 * @since 0.0.0
 */
export type KnowledgeLinkDestination = {
  readonly destination: string;
  readonly column: number;
  readonly end: number;
};

const linkDestinationOf = (match: RegExpExecArray): O.Option<KnowledgeLinkDestination> => {
  const prefix = match[1];
  const raw = match[2];
  return P.isString(prefix) && P.isString(raw)
    ? O.some({
        destination: stripAngleWrapping(raw),
        column: match.index + Str.length(prefix) + 1,
        end: match.index + Str.length(match[0]),
      })
    : O.none();
};

/**
 * Reads every Markdown inline-link destination on one line, in source order.
 *
 * **Details**
 *
 * This is the shared link parser: the census link bus and `lint roadmap-refs` both read link
 * destinations through it, so one grammar decides what counts as a link everywhere. Angle wrapping
 * (`<dest>`) is stripped and an optional quoted title is tolerated; filtering — external schemes,
 * domain prefixes — stays with each caller, mirroring how {@link knowledgeInlineSpans} leaves the
 * command predicate to its readers. `column` is the 1-based column of the destination's first
 * character; `end` is the 0-based offset just past the link's closing paren, which is what a caller
 * pairing trailing annotations to the link keys on.
 *
 * **Example** (Read one destination from a line)
 *
 * ```ts
 * import { knowledgeLinkDestinations } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as A from "effect/Array"
 *
 * console.log(A.map(knowledgeLinkDestinations("see [the plan](../goals/x/PLAN.md) first"), (link) => link.destination))
 * // [ "../goals/x/PLAN.md" ]
 * ```
 *
 * @param lineText - One document line, already known to sit outside every fence.
 * @returns Every inline-link destination on the line, in source order.
 * @category parsing
 * @since 0.0.0
 */
export const knowledgeLinkDestinations = (lineText: string): ReadonlyArray<KnowledgeLinkDestination> =>
  A.getSomes(A.map(knowledgeLineMatches(LINK_DESTINATION_PATTERN, lineText), linkDestinationOf));

const repoPathCandidatesOn = (documentPath: string, lineText: string): ReadonlyArray<RepoPathCandidate> => {
  const inlines = A.map(
    A.filter(knowledgeInlineSpans(lineText), (inline) => !isKnowledgeCommandSpan(inline.span)),
    (inline): RepoPathCandidate => ({
      raw: inline.span,
      column: inline.column,
      outcome: repoPathOutcome(documentPath, inline.span, false),
    })
  );
  const links = A.getSomes(
    A.map(knowledgeLinkDestinations(lineText), (link) =>
      isExternalDestination(link.destination)
        ? O.none<RepoPathCandidate>()
        : O.some({
            raw: link.destination,
            column: link.column,
            outcome: repoPathOutcome(documentPath, link.destination, true),
          })
    )
  );
  return A.appendAll(inlines, links);
};

const repoPathCandidateRefs = (
  documentPath: string,
  line: KnowledgeDocumentLine,
  surface: KnowledgeRefSurface,
  candidates: ReadonlyArray<RepoPathCandidate>
): ReadonlyArray<RefCandidate> =>
  A.getSomes(
    A.map(candidates, (candidate) => {
      if (candidate.outcome._tag === "ignored") {
        return O.none<RefCandidate>();
      }
      const ungoverned = candidate.outcome._tag === "ungoverned";
      return O.some({
        kind: KnowledgeRefKind.Enum["repo-path"],
        subject: nfc(`repo-path:${candidate.outcome.normalized}`),
        ref: KnowledgeRepoPathRef.make({ raw: candidate.raw, normalized: candidate.outcome.normalized }),
        documentPath,
        line: line.number,
        column: candidate.column,
        surface,
        patternContext: knowledgeRefPatternContext(line.text),
        pairingAmbiguous: false,
        ungoverned,
        anchor: O.none<KnowledgeHostAnchor>(),
        token: O.none<string>(),
        slug: O.none<string>(),
        normalized: ungoverned ? O.none<string>() : O.some(candidate.outcome.normalized),
      });
    })
  );

const governedDisplayPaths = (candidates: ReadonlyArray<RepoPathCandidate>): ReadonlyArray<string> =>
  A.getSomes(
    A.map(candidates, (candidate) =>
      candidate.outcome._tag === "governed" ? O.some(candidate.outcome.normalized) : O.none<string>()
    )
  );

const followsHeading = (lines: ReadonlyArray<KnowledgeDocumentLine>, index: number): boolean =>
  pipe(
    A.take(lines, index),
    A.reverse,
    A.findFirst((line) => Str.isNonEmpty(Str.trim(line.text))),
    O.exists((line) => HEADING_PATTERN.test(line.text))
  );

const goalUriCandidate = (
  documentPath: string,
  line: KnowledgeDocumentLine,
  surface: KnowledgeRefSurface,
  raw: string,
  slug: string,
  column: number,
  displayPath: O.Option<string>,
  pairingAmbiguous: boolean
): RefCandidate => ({
  kind: KnowledgeRefKind.Enum["goal-uri"],
  subject: nfc(`goal-uri:${slug}`),
  ref: goalUriRef(raw, slug, displayPath),
  documentPath,
  line: line.number,
  column,
  surface,
  patternContext: knowledgeRefPatternContext(line.text),
  pairingAmbiguous,
  ungoverned: false,
  anchor: O.none<KnowledgeHostAnchor>(),
  token: O.none<string>(),
  slug: pairingAmbiguous ? O.none<string>() : O.some(slug),
  normalized: O.none<string>(),
});

const goalUriCandidates = (
  documentPath: string,
  line: KnowledgeDocumentLine,
  surface: KnowledgeRefSurface
): ReadonlyArray<RefCandidate> =>
  A.getSomes(
    A.map(knowledgeLineMatches(GOAL_URI_PATTERN, line.text), (match) => {
      const slug = match[1];
      if (!P.isString(slug)) {
        return O.none<RefCandidate>();
      }
      const tail = match[2];
      const displayPath = P.isString(tail) ? O.some(Str.slice(1)(tail)) : O.none<string>();
      return O.some(goalUriCandidate(documentPath, line, surface, match[0], slug, match.index + 1, displayPath, false));
    })
  );

const beepRefCandidates = (
  documentPath: string,
  lines: ReadonlyArray<KnowledgeDocumentLine>,
  index: number,
  line: KnowledgeDocumentLine,
  surface: KnowledgeRefSurface,
  displayPaths: ReadonlyArray<string>
): ReadonlyArray<RefCandidate> => {
  const refs = knowledgeLineMatches(BEEP_REF_PATTERN, line.text);
  if (A.isReadonlyArrayEmpty(refs)) {
    return A.empty<RefCandidate>();
  }
  // Ratified pairing rule A1: more than one reference on a line makes every reference on it
  // ambiguous, because the tool must never guess which object an identity names.
  const ambiguousLine = A.length(refs) > 1;
  return A.getSomes(
    A.map(refs, (match) => {
      const slug = match[1];
      if (!P.isString(slug)) {
        return O.none<RefCandidate>();
      }
      const soleDisplayPath = A.length(displayPaths) === 1 ? A.head(displayPaths) : O.none<string>();
      const alone = Str.isEmpty(Str.trim(Str.replace(match[0], "")(line.text)));
      const ambiguous =
        ambiguousLine ||
        (A.isReadonlyArrayEmpty(displayPaths) ? !(alone && followsHeading(lines, index)) : O.isNone(soleDisplayPath));
      return O.some(
        goalUriCandidate(
          documentPath,
          line,
          surface,
          match[0],
          slug,
          match.index + 1,
          ambiguous ? O.none<string>() : soleDisplayPath,
          ambiguous
        )
      );
    })
  );
};

const extractDocumentRefs = (
  documentPath: string,
  text: string,
  surface: KnowledgeRefSurface
): ReadonlyArray<RefCandidate> => {
  const lines = knowledgeDocumentLines(text);
  const markdown = Str.endsWith(MARKDOWN_EXTENSION)(documentPath);
  // One flatMap allocation for the whole document: accumulating with `A.appendAll` per line
  // re-copies every prior candidate and turns a dense document quadratic.
  return A.flatMap(lines, (line, index) => {
    // Host anchors are counted line-wise on every elected file type; fences never exempt them.
    const host = hostCandidates(documentPath, line, surface);
    if (!markdown || !line.prose) {
      return host;
    }
    const repoPaths = repoPathCandidatesOn(documentPath, line.text);
    return A.flatten([
      host,
      repoPathCandidateRefs(documentPath, line, surface, repoPaths),
      goalUriCandidates(documentPath, line, surface),
      beepRefCandidates(documentPath, lines, index, line, surface, governedDisplayPaths(repoPaths)),
    ]);
  });
};

const resolveRepoPath = (
  pathIndex: HashMap.HashMap<string, KnowledgeTrackedEntry>,
  directoryPrefixes: HashSet.HashSet<string>,
  normalized: string
): KnowledgeRefResolution => {
  const entry = HashMap.get(pathIndex, normalized);
  if (O.isSome(entry)) {
    return KnowledgeRefResolved.make({
      targetPath: normalized,
      mode: entry.value.mode,
      objectId: entry.value.objectId,
    });
  }
  if (HashSet.has(directoryPrefixes, normalized)) {
    return KnowledgeRefResolved.make({ targetPath: normalized });
  }
  return O.match(
    A.findFirst(PRODUCER_REGISTRY, (registration) => registration.targetPath === normalized),
    {
      onNone: (): KnowledgeRefResolution => KnowledgeRefMissing.make({}),
      onSome: (registration): KnowledgeRefResolution =>
        KnowledgeRefProducerOwned.make({ producerId: registration.producerId, command: registration.command }),
    }
  );
};

const goalManifestPath = (slug: string): string => `goals/${slug}/ops/manifest.json`;

const resolveGoalSlug = Effect.fn("Knowledge.resolveGoalSlug")(function* (
  oracle: KnowledgeTreeOracle,
  pathIndex: HashMap.HashMap<string, KnowledgeTrackedEntry>,
  slug: string
) {
  const manifestPath = goalManifestPath(slug);
  const entry = HashMap.get(pathIndex, manifestPath);
  // A manifest tracked as a symlink or a gitlink is recorded in `skipped` and never followed, so it
  // is unavailable as an identity source rather than readable. Reading it anyway would fail the
  // whole census on a blob the scan already decided not to open.
  if (O.isNone(entry) || !isRegularBlob(entry.value)) {
    return KnowledgeRefMissing.make({});
  }
  const text = yield* Effect.flatMap(oracle.readBytes(manifestPath), (bytes) => decodeUtf8(bytes, manifestPath));
  const parsed = parseGoalManifestText(text);
  if (O.isNone(parsed)) {
    return yield* KnowledgeOperationalError.make({
      message: `Tracked goal manifest "${manifestPath}" does not parse as JSON.`,
    });
  }
  const manifest = yield* decodeGoalManifest(parsed.value).pipe(
    KnowledgeOperationalError.mapError(`Tracked goal manifest "${manifestPath}" does not decode as a goal manifest.`)
  );
  return manifest.initiative.id === slug
    ? KnowledgeRefResolved.make({
        targetPath: manifestPath,
        mode: entry.value.mode,
        objectId: entry.value.objectId,
      })
    : KnowledgeRefIdentityMismatch.make({ declaredId: manifest.initiative.id });
});

const candidateOrder: Order.Order<RefCandidate> = Order.combineAll([
  Order.mapInput(Order.String, (candidate: RefCandidate) => candidate.documentPath),
  Order.mapInput(Order.Number, (candidate: RefCandidate) => candidate.line),
  Order.mapInput(Order.Number, (candidate: RefCandidate) => candidate.column),
  Order.mapInput(Order.String, (candidate: RefCandidate) => candidate.kind),
  Order.mapInput(Order.String, (candidate: RefCandidate) => candidate.subject),
]);

const skippedOrder = Order.mapInput(Order.String, (blob: KnowledgeSkippedBlob) => blob.path);
const entryPathOrder = Order.mapInput(Order.String, (entry: KnowledgeTrackedEntry) => entry.path);

/**
 * Censuses every reference in one fully injected Git tree.
 *
 * **Details**
 *
 * Scoped tracked entries are read once: non-regular blobs become `skipped` rows, elected-extension
 * blobs become the scanned corpus in path order, and everything else is silently out of corpus.
 * Each document is decoded strictly, scanned by the three buses, resolved against the tracked-entry
 * oracle alone, and classified by the pure rule table. Observations are then sorted by document,
 * line, column, kind, and subject, and duplicate occurrence ordinals are assigned in that same order
 * before identities are minted — which is what makes permuting the oracle's entry order produce
 * byte-identical output.
 *
 * **Gotchas**
 *
 * A blob whose bytes fail strict UTF-8 decoding is skipped and the run still succeeds; a goal
 * manifest that fails to parse or decode is an operational failure instead. The difference is
 * deliberate: the census may not silently downgrade an undecodable identity source into a missing
 * one, because that is exactly the split-brain state it exists to detect. A manifest tracked as a
 * symlink or gitlink is a third case: the scan never opens it, so it is unavailable rather than
 * undecodable, and the reference resolves as missing while the link itself is recorded in `skipped`.
 *
 * **Example** (Census an empty tree)
 *
 * ```ts
 * import { scanKnowledgeRefsTree } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { Effect } from "effect"
 * import type { KnowledgeTreeOracle } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const emptyTree: KnowledgeTreeOracle = {
 *   treeish: "HEAD",
 *   commit: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   trackedEntries: [],
 *   readBytes: () => Effect.succeed(new Uint8Array()),
 * }
 *
 * console.log(Effect.isEffect(scanKnowledgeRefsTree(emptyTree))) // true
 * ```
 *
 * @param oracle - Everything the census may read from the requested tree.
 * @returns The versioned census envelope for that tree.
 * @category use-cases
 * @since 0.0.0
 */
export const scanKnowledgeRefsTree = Effect.fn("Knowledge.scanRefsTree")(function* (oracle: KnowledgeTreeOracle) {
  const commit = yield* decodeCommitSha(oracle.commit).pipe(
    KnowledgeOperationalError.mapError(
      `Tree oracle commit "${oracle.commit}" is not a forty-character hexadecimal Git commit id.`
    )
  );
  const pathIndex = HashMap.fromIterable(
    A.map(oracle.trackedEntries, (entry): readonly [string, KnowledgeTrackedEntry] => [entry.path, entry])
  );
  const directoryPrefixes = HashSet.fromIterable(
    A.flatMap(oracle.trackedEntries, (entry) => ancestorPrefixes(entry.path))
  );
  const scoped = A.filter(oracle.trackedEntries, (entry) => isKnowledgeScopedPath(entry.path));
  const documents = pipe(
    scoped,
    A.filter((entry) => isRegularBlob(entry) && isElectedExtension(entry.path)),
    A.sort(entryPathOrder)
  );

  let skipped = A.getSomes(A.map(scoped, skippedEntry));
  // Per-document chunks flattened once: appending 18k candidates one document at a time re-copies
  // the whole accumulator per document and turns the corpus scan quadratic.
  let chunks = A.empty<ReadonlyArray<RefCandidate>>();
  for (const entry of documents) {
    const bytes = yield* oracle.readBytes(entry.path);
    const decoded = yield* Effect.option(decodeUtf8(bytes, entry.path));
    if (O.isNone(decoded)) {
      skipped = A.append(
        skipped,
        KnowledgeSkippedBlob.make({ path: entry.path, mode: entry.mode, reason: "malformed-utf8" })
      );
      continue;
    }
    const surface = isKnowledgeArchivalPath(entry.path)
      ? KnowledgeRefSurface.Enum.archival
      : KnowledgeRefSurface.Enum.live;
    chunks = A.append(chunks, extractDocumentRefs(entry.path, decoded.value, surface));
  }
  const candidates = A.flatten(chunks);

  const slugs = pipe(A.getSomes(A.map(candidates, (candidate) => candidate.slug)), A.dedupe, A.sort(Order.String));
  let slugResolutions = HashMap.empty<string, KnowledgeRefResolution>();
  for (const slug of slugs) {
    slugResolutions = HashMap.set(slugResolutions, slug, yield* resolveGoalSlug(oracle, pathIndex, slug));
  }

  const occurrences = MutableHashMap.empty<string, number>();
  const toObservation = Effect.fnUntraced(function* (candidate: RefCandidate) {
    const resolution = pipe(
      candidate.normalized,
      O.map((normalized) => resolveRepoPath(pathIndex, directoryPrefixes, normalized)),
      O.orElse(() => O.flatMap(candidate.slug, (slug) => HashMap.get(slugResolutions, slug))),
      O.getOrElse((): KnowledgeRefResolution => KnowledgeRefNotApplicable.make({}))
    );
    const classification = classifyKnowledgeRef({
      kind: candidate.kind,
      surface: candidate.surface,
      resolutionStatus: resolution.status,
      anchor: candidate.anchor,
      token: candidate.token,
      patternContext: candidate.patternContext,
      pairingAmbiguous: candidate.pairingAmbiguous,
      ungoverned: candidate.ungoverned,
    });
    const documentId = nfc(candidate.documentPath);
    const key = A.join(A.map([candidate.kind, documentId, candidate.subject], knowledgeLengthPrefix), "");
    const occurrence = O.getOrElse(MutableHashMap.get(occurrences, key), () => 0);
    MutableHashMap.set(occurrences, key, occurrence + 1);
    const refId = yield* makeKnowledgeRefId(candidate.kind, documentId, candidate.subject, occurrence);
    return KnowledgeRefObservation.make({
      refId,
      ref: candidate.ref,
      documentId,
      occurrence: NonNegativeInt.make(occurrence),
      surface: candidate.surface,
      classification,
      resolution,
      location: KnowledgeFindingLocation.make({
        path: candidate.documentPath,
        line: NonNegativeInt.make(candidate.line),
        column: NonNegativeInt.make(candidate.column),
      }),
      remediation: knowledgeRefRemediation(classification, resolution),
    });
  });
  // Sequential forEach allocates the observation list once; per-observation `A.append` re-copies
  // the whole accumulator and dominated the census runtime at corpus scale.
  const observations = yield* Effect.forEach(A.sort(candidates, candidateOrder), toObservation);

  return KnowledgeRefsReport.make({
    treeish: oracle.treeish,
    commit,
    observations,
    skipped: A.sort(skipped, skippedOrder),
  });
});
