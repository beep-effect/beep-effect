/**
 * Practice knowledge-graph projection and bundle schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { KgEdgePredicate, KgNodeKind } from "@beep/law-practice-domain/values";
import { LiteralKit, NonNegativeInt, UnknownRecord } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("PracticeKg.schemas");

/**
 * Validated options used by `corpus graph`.
 *
 * @remarks
 * `bundleOut` is the only optional key: omitting it puts the bundle under
 * `<corpusRoot>/staging/practice-kg-bundle`. `overwrite` is what distinguishes a
 * rebuild from an accidental clobber — without it a build refuses to run against
 * an existing bundle.
 *
 * @example
 * ```ts
 * import { PracticeKgOptions } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = PracticeKgOptions.make({
 *   corpusRoot: "/corpus",
 *   includeRefresh: true,
 *   maxTextBytes: NonNegativeInt.make(2_097_152),
 *   overwrite: false,
 *   skipEmails: false
 * })
 *
 * console.log(options.bundleOut) // undefined — defaults under the corpus root
 * console.log(options.maxTextBytes) // 2097152
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgOptions extends S.Class<PracticeKgOptions>($I`PracticeKgOptions`)(
  {
    bundleOut: S.optionalKey(S.String),
    corpusRoot: S.String,
    includeRefresh: S.Boolean,
    maxTextBytes: NonNegativeInt,
    overwrite: S.Boolean,
    skipEmails: S.Boolean,
  },
  $I.annote("PracticeKgOptions", {
    description: "Validated options used to build a deterministic practice knowledge-graph bundle.",
  })
) {}

/**
 * Epistemic labels stored on graph projections.
 *
 * @remarks
 * The distinction is load-bearing rather than descriptive: rows labelled
 * `derived-from-official-records` are reconcilable against the corpus catalog,
 * while `candidate-unreviewed` rows come from enrichment and must not be
 * presented as settled fact.
 *
 * @example
 * ```ts
 * import { PracticeKgEpistemicStatus } from "@beep/law-practice-server"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(PracticeKgEpistemicStatus)("candidate-unreviewed")
 * console.log(status) // "candidate-unreviewed"
 * console.log(PracticeKgEpistemicStatus.Enum["derived-from-official-records"])
 * // "derived-from-official-records"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgEpistemicStatus = LiteralKit(["derived-from-official-records", "candidate-unreviewed"]).pipe(
  $I.annoteSchema("PracticeKgEpistemicStatus", {
    description: "Authority label distinguishing deterministic spine rows from candidate claims.",
  })
);

/**
 * Runtime type for {@link PracticeKgEpistemicStatus}.
 *
 * @example
 * ```ts
 * import type { PracticeKgEpistemicStatus } from "@beep/law-practice-server"
 *
 * const isSettled = (status: PracticeKgEpistemicStatus): boolean =>
 *   status === "derived-from-official-records"
 *
 * console.log(isSettled("candidate-unreviewed")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgEpistemicStatus = typeof PracticeKgEpistemicStatus.Type;

/**
 * Closed provenance-reference kinds stored on graph projections.
 *
 * @remarks
 * The kind tells a reader how to interpret the accompanying `provenanceRef`: a
 * `catalog-digest` ref is a content digest, a `uspto-anchor` ref is an
 * application number, and so on. Widening this set means teaching every consumer
 * a new ref format.
 *
 * @example
 * ```ts
 * import { PracticeKgProvenanceKind } from "@beep/law-practice-server"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(PracticeKgProvenanceKind)("uspto-anchor")
 * console.log(kind) // "uspto-anchor"
 * console.log(PracticeKgProvenanceKind.Enum["extract-operation"]) // "extract-operation"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgProvenanceKind = LiteralKit([
  "catalog-digest",
  "uspto-anchor",
  "organize-row",
  "extract-operation",
]).pipe(
  $I.annoteSchema("PracticeKgProvenanceKind", {
    description: "Stable source-reference kinds accepted by the practice knowledge graph.",
  })
);

/**
 * Runtime type for {@link PracticeKgProvenanceKind}.
 *
 * @example
 * ```ts
 * import type { PracticeKgProvenanceKind } from "@beep/law-practice-server"
 *
 * const refLabel = (kind: PracticeKgProvenanceKind): string =>
 *   kind === "uspto-anchor" ? "application number" : "corpus reference"
 *
 * console.log(refLabel("uspto-anchor")) // "application number"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgProvenanceKind = typeof PracticeKgProvenanceKind.Type;

/**
 * One persisted `kg_node` row.
 *
 * @remarks
 * `iri` is the node's identity across the whole graph and the join target for
 * both edge endpoints; `naturalKey` is the human-facing key it was minted from.
 * `client` and `docketFamily` are absent — not empty — for nodes that belong to
 * neither, such as an email archive.
 *
 * @example
 * ```ts
 * import { PracticeKgNodeRow } from "@beep/law-practice-server"
 *
 * const node = PracticeKgNodeRow.make({
 *   client: "Acme Corp",
 *   docketFamily: "AB",
 *   epistemicStatus: "derived-from-official-records",
 *   iri: "urn:beep:practice-kg:docket:AB-1234",
 *   kind: "docket",
 *   label: "AB-1234",
 *   naturalKey: "AB-1234",
 *   payload: { sizeBytes: 18342 },
 *   provenanceKind: "catalog-digest",
 *   provenanceRef: "sha256:9f2c"
 * })
 *
 * console.log(node.iri) // "urn:beep:practice-kg:docket:AB-1234"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgNodeRow extends S.Class<PracticeKgNodeRow>($I`PracticeKgNodeRow`)(
  {
    client: S.optionalKey(S.String),
    docketFamily: S.optionalKey(S.String),
    epistemicStatus: PracticeKgEpistemicStatus,
    iri: S.NonEmptyString,
    kind: KgNodeKind,
    label: S.String,
    naturalKey: S.NonEmptyString,
    payload: UnknownRecord,
    provenanceKind: PracticeKgProvenanceKind,
    provenanceRef: S.NonEmptyString,
  },
  $I.annote("PracticeKgNodeRow", {
    description: "Schema-first row persisted in the packet-owned PGlite kg_node projection.",
  })
) {}

/**
 * One persisted `kg_edge` row.
 *
 * @remarks
 * The `(subjectIri, predicate, objectIri)` triple is the row's identity, so the
 * same assertion derived twice collapses to one edge. Both IRIs must name nodes
 * that exist in the same bundle.
 *
 * @example
 * ```ts
 * import { PracticeKgEdgeRow } from "@beep/law-practice-server"
 *
 * const edge = PracticeKgEdgeRow.make({
 *   epistemicStatus: "derived-from-official-records",
 *   objectIri: "urn:beep:practice-kg:patent:11111111",
 *   predicate: "granted_as",
 *   provenanceKind: "uspto-anchor",
 *   provenanceRef: "16/123,456",
 *   subjectIri: "urn:beep:practice-kg:application:16123456"
 * })
 *
 * console.log(edge.predicate) // "granted_as"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgEdgeRow extends S.Class<PracticeKgEdgeRow>($I`PracticeKgEdgeRow`)(
  {
    epistemicStatus: PracticeKgEpistemicStatus,
    objectIri: S.NonEmptyString,
    predicate: KgEdgePredicate,
    provenanceKind: PracticeKgProvenanceKind,
    provenanceRef: S.NonEmptyString,
    subjectIri: S.NonEmptyString,
  },
  $I.annote("PracticeKgEdgeRow", {
    description: "Schema-first row persisted in the packet-owned PGlite kg_edge projection.",
  })
) {}

/**
 * One parsed pffexport email-header row.
 *
 * @remarks
 * Headers only — no message body is ever read. `messageOrd` is the ordinal
 * parsed from the export directory name, and together with `archiveDigest` and
 * `folderPath` it gives the stable sort that makes a rebuild byte-identical. The
 * optional keys are absent when the header was missing from the export, which is
 * routine for drafts and calendar items.
 *
 * @example
 * ```ts
 * import { PracticeKgEmailHeaderRow } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const header = PracticeKgEmailHeaderRow.make({
 *   archiveDigest: "sha256:1a4f",
 *   folderPath: "Inbox/Acme",
 *   messageOrd: NonNegativeInt.make(12),
 *   messageRelPath: "artifact:sha256-1a4f.export/Inbox/Acme/Message00012",
 *   recipients: "ada@example.com | grace@example.com",
 *   senderEmail: "counsel@example.com",
 *   subject: "AB-1234 office action response"
 * })
 *
 * console.log(header.recipients.split(" | ").length) // 2
 * console.log(header.deliveryIso) // undefined — absent from the export headers
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgEmailHeaderRow extends S.Class<PracticeKgEmailHeaderRow>($I`PracticeKgEmailHeaderRow`)(
  {
    archiveDigest: S.NonEmptyString,
    conversationTopic: S.optionalKey(S.String),
    deliveryIso: S.optionalKey(S.String),
    folderPath: S.String,
    messageOrd: NonNegativeInt,
    messageRelPath: S.NonEmptyString,
    recipients: S.String,
    senderEmail: S.optionalKey(S.String),
    senderName: S.optionalKey(S.String),
    subject: S.String,
    submitIso: S.optionalKey(S.String),
  },
  $I.annote("PracticeKgEmailHeaderRow", {
    description: "Headers-only DuckDB row parsed from one pffexport message directory.",
  })
) {}

/**
 * Schema versions embedded in a graph bundle manifest.
 *
 * @remarks
 * The two stores version independently, so a reader can support a new DuckDB
 * layout without re-reading every PGlite bundle. Both are currently pinned at
 * `"1"`; a change to either is a breaking change for bundle consumers.
 *
 * @example
 * ```ts
 * import { PracticeKgSchemaVersions } from "@beep/law-practice-server"
 *
 * const versions = PracticeKgSchemaVersions.make({ duckdb: "1", pglite: "1" })
 *
 * console.log(versions.duckdb) // "1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgSchemaVersions extends S.Class<PracticeKgSchemaVersions>($I`PracticeKgSchemaVersions`)(
  {
    duckdb: S.Literal("1"),
    pglite: S.Literal("1"),
  },
  $I.annote("PracticeKgSchemaVersions", {
    description: "Independent schema versions for the two embedded graph stores.",
  })
) {}

/**
 * Included/excluded source runs embedded in a graph bundle manifest.
 *
 * @remarks
 * Recording exclusion explicitly, rather than omitting the run, is what lets a
 * reader tell "the refresh was deliberately left out" from "this bundle predates
 * the refresh".
 *
 * @example
 * ```ts
 * import { PracticeKgSourceRuns } from "@beep/law-practice-server"
 *
 * const runs = PracticeKgSourceRuns.make({ base: "included", refresh202607: "excluded" })
 *
 * console.log(runs.refresh202607) // "excluded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgSourceRuns extends S.Class<PracticeKgSourceRuns>($I`PracticeKgSourceRuns`)(
  {
    base: S.Literal("included"),
    refresh202607: LiteralKit(["included", "excluded"]),
  },
  $I.annote("PracticeKgSourceRuns", {
    description: "Explicit base and July 2026 refresh inclusion state for a graph bundle.",
  })
) {}

/**
 * Stable table counts embedded in graph artifacts.
 *
 * @remarks
 * These counts are the bundle's fingerprint: two builds over the same corpus
 * snapshot with the same options must produce identical values, so a difference
 * is evidence that an input moved.
 *
 * @example
 * ```ts
 * import { PracticeKgCounts } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const counts = PracticeKgCounts.make({
 *   documents: NonNegativeInt.make(6104),
 *   edges: NonNegativeInt.make(19233),
 *   emails: NonNegativeInt.make(2317),
 *   nodes: NonNegativeInt.make(8421)
 * })
 *
 * console.log(counts.edges > counts.nodes) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgCounts extends S.Class<PracticeKgCounts>($I`PracticeKgCounts`)(
  {
    documents: NonNegativeInt,
    edges: NonNegativeInt,
    emails: NonNegativeInt,
    nodes: NonNegativeInt,
  },
  $I.annote("PracticeKgCounts", {
    description: "Deterministic node, edge, document, and email counts for one graph build.",
  })
) {}

/**
 * Portable practice knowledge-graph bundle manifest.
 *
 * @remarks
 * Written as `bundle.manifest.json` at the bundle root and read first by any
 * consumer: it is what makes a bundle self-describing once it has been copied
 * away from the corpus it was built from. `corpusRootExpected` records whether
 * the bundle's paths still assume the originating corpus layout.
 *
 * @example
 * ```ts
 * import { PracticeKgBundleManifest, PracticeKgCounts } from "@beep/law-practice-server"
 * import { PracticeKgSchemaVersions, PracticeKgSourceRuns } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const manifest = PracticeKgBundleManifest.make({
 *   builtAt: "2026-07-27T18:04:11.000Z",
 *   bundleVersion: "2026.07.1",
 *   corpusRootExpected: true,
 *   counts: PracticeKgCounts.make({
 *     documents: NonNegativeInt.make(6104),
 *     edges: NonNegativeInt.make(19233),
 *     emails: NonNegativeInt.make(2317),
 *     nodes: NonNegativeInt.make(8421)
 *   }),
 *   schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "1", pglite: "1" }),
 *   sourceRuns: PracticeKgSourceRuns.make({ base: "included", refresh202607: "included" })
 * })
 *
 * console.log(manifest.counts.nodes) // 8421
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgBundleManifest extends S.Class<PracticeKgBundleManifest>($I`PracticeKgBundleManifest`)(
  {
    builtAt: S.String,
    bundleVersion: S.NonEmptyString,
    corpusRootExpected: S.Boolean,
    counts: PracticeKgCounts,
    schemaVersion: PracticeKgSchemaVersions,
    sourceRuns: PracticeKgSourceRuns,
  },
  $I.annote("PracticeKgBundleManifest", {
    description: "Portable manifest describing one read-only practice knowledge-graph bundle.",
  })
) {}

/**
 * Summary report written to `catalog/reports/graph-summary.json`.
 *
 * @remarks
 * Carries the reconciliation counts alongside the bundle counts, so a reviewer
 * can check the graph against the corpus it was projected from: `sourceRows` and
 * `baseDigests` describe the input, `counts` describes the output, and a gap
 * between them is the thing worth investigating.
 *
 * @example
 * ```ts
 * import { PracticeKgCounts, PracticeKgSummary } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = PracticeKgSummary.make({
 *   baseDigests: NonNegativeInt.make(6104),
 *   bundleOut: "/corpus/staging/practice-kg-bundle",
 *   counts: PracticeKgCounts.make({
 *     documents: NonNegativeInt.make(6104),
 *     edges: NonNegativeInt.make(19233),
 *     emails: NonNegativeInt.make(2317),
 *     nodes: NonNegativeInt.make(8421)
 *   }),
 *   docketFamilies: NonNegativeInt.make(212),
 *   docketFiles: NonNegativeInt.make(1904),
 *   familyAnchors: NonNegativeInt.make(198),
 *   includeRefresh: true,
 *   sourceRows: NonNegativeInt.make(7412)
 * })
 *
 * console.log(summary.counts.documents === summary.baseDigests) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgSummary extends S.Class<PracticeKgSummary>($I`PracticeKgSummary`)(
  {
    baseDigests: NonNegativeInt,
    bundleOut: S.String,
    counts: PracticeKgCounts,
    docketFiles: NonNegativeInt,
    docketFamilies: NonNegativeInt,
    familyAnchors: NonNegativeInt,
    includeRefresh: S.Boolean,
    sourceRows: NonNegativeInt,
  },
  $I.annote("PracticeKgSummary", {
    description: "Build result and reconciliation counts returned by corpus graph.",
  })
) {}

/**
 * Encode a bundle manifest as its JSON string form.
 *
 * @remarks
 * Produces the exact text written to `bundle.manifest.json`. Encoding is fallible
 * because the manifest's branded count fields are validated on the way out.
 *
 * @example
 * ```ts
 * import { encodePracticeKgBundleManifestJson, PracticeKgBundleManifest, PracticeKgCounts } from "@beep/law-practice-server"
 * import { PracticeKgSchemaVersions, PracticeKgSourceRuns } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const manifest = PracticeKgBundleManifest.make({
 *   builtAt: "2026-07-27T18:04:11.000Z",
 *   bundleVersion: "2026.07.1",
 *   corpusRootExpected: true,
 *   counts: PracticeKgCounts.make({
 *     documents: NonNegativeInt.make(6104),
 *     edges: NonNegativeInt.make(19233),
 *     emails: NonNegativeInt.make(2317),
 *     nodes: NonNegativeInt.make(8421)
 *   }),
 *   schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "1", pglite: "1" }),
 *   sourceRuns: PracticeKgSourceRuns.make({ base: "included", refresh202607: "included" })
 * })
 *
 * Effect.runPromise(encodePracticeKgBundleManifestJson(manifest)).then((json) => console.log(json.length > 0))
 * // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePracticeKgBundleManifestJson = S.encodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));

/**
 * Encode reconciliation counts as their JSON string form.
 *
 * @example
 * ```ts
 * import { encodePracticeKgCountsJson, PracticeKgCounts } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const counts = PracticeKgCounts.make({
 *   documents: NonNegativeInt.make(6104),
 *   edges: NonNegativeInt.make(19233),
 *   emails: NonNegativeInt.make(2317),
 *   nodes: NonNegativeInt.make(8421)
 * })
 *
 * Effect.runPromise(encodePracticeKgCountsJson(counts)).then(console.log)
 * // {"documents":6104,"edges":19233,"emails":2317,"nodes":8421}
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePracticeKgCountsJson = S.encodeUnknownEffect(S.fromJsonString(PracticeKgCounts));

/**
 * Encode a kg_node payload record as its JSON string form.
 *
 * @remarks
 * Node payloads are open records, so this validates only that the value is a
 * record of JSON-encodable entries — the payload's shape is the caller's
 * contract with whoever reads it back.
 *
 * @example
 * ```ts
 * import { encodePracticeKgNodePayloadJson } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * const payload = { digest: "sha256:9f2c", sizeBytes: 18342, runLabel: "base" }
 *
 * Effect.runPromise(encodePracticeKgNodePayloadJson(payload)).then((json) => console.log(json.length > 0))
 * // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePracticeKgNodePayloadJson = S.encodeUnknownEffect(S.fromJsonString(UnknownRecord));

/**
 * Encode a build summary as its JSON string form.
 *
 * @remarks
 * Produces the exact text written to `catalog/reports/graph-summary.json`.
 *
 * @example
 * ```ts
 * import { encodePracticeKgSummaryJson, PracticeKgCounts, PracticeKgSummary } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const summary = PracticeKgSummary.make({
 *   baseDigests: NonNegativeInt.make(6104),
 *   bundleOut: "/corpus/staging/practice-kg-bundle",
 *   counts: PracticeKgCounts.make({
 *     documents: NonNegativeInt.make(6104),
 *     edges: NonNegativeInt.make(19233),
 *     emails: NonNegativeInt.make(2317),
 *     nodes: NonNegativeInt.make(8421)
 *   }),
 *   docketFamilies: NonNegativeInt.make(212),
 *   docketFiles: NonNegativeInt.make(1904),
 *   familyAnchors: NonNegativeInt.make(198),
 *   includeRefresh: true,
 *   sourceRows: NonNegativeInt.make(7412)
 * })
 *
 * Effect.runPromise(encodePracticeKgSummaryJson(summary)).then((json) => console.log(json.includes("bundleOut")))
 * // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePracticeKgSummaryJson = S.encodeUnknownEffect(S.fromJsonString(PracticeKgSummary));
